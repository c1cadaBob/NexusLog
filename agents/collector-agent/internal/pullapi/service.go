// Package pullapi 提供 Agent 主动拉取接口（meta/pull/ack）最小实现。
package pullapi

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/nexuslog/collector-agent/internal/checkpoint"
	"github.com/nexuslog/collector-agent/plugins"
)

const (
	// ErrorCodeInvalidParams 统一参数错误码。
	ErrorCodeInvalidParams = "REQ_INVALID_PARAMS"
	// ErrorCodeNotFound 统一资源不存在错误码。
	ErrorCodeNotFound = "RES_NOT_FOUND"
	// ErrorCodeInternalError 统一内部错误码。
	ErrorCodeInternalError = "INTERNAL_ERROR"
	// ErrorCodeAuthMissingToken 表示缺少鉴权头。
	ErrorCodeAuthMissingToken = "AUTH_MISSING_TOKEN"
	// ErrorCodeAuthInvalidToken 表示鉴权头非法。
	ErrorCodeAuthInvalidToken = "AUTH_INVALID_TOKEN"
)

const (
	defaultMaxRecords = 200
	maxMaxRecords     = 1000
	defaultMaxBytes   = 1 * 1024 * 1024
	maxMaxBytes       = 5 * 1024 * 1024
	maxBufferedRecord = 20000
)

// MetaInfo 定义 /agent/v1/meta 响应骨架。
type MetaInfo struct {
	AgentID      string   `json:"agent_id"`
	Version      string   `json:"version"`
	Status       string   `json:"status"`
	Sources      []string `json:"sources"`
	Capabilities []string `json:"capabilities"`
}

// AuthConfig 定义 X-Agent-Key / X-Key-Id 鉴权配置。
type AuthConfig struct {
	KeysByID map[string]string
}

// PullRequest 定义 /agent/v1/logs/pull 请求。
type PullRequest struct {
	Cursor     string `json:"cursor"`
	MaxRecords int    `json:"max_records"`
	MaxBytes   int    `json:"max_bytes"`
	TimeoutMS  int    `json:"timeout_ms"`
}

// PullResponse 定义 /agent/v1/logs/pull 响应。
type PullResponse struct {
	BatchID    string      `json:"batch_id"`
	Records    []APIRecord `json:"records"`
	NextCursor string      `json:"next_cursor"`
	HasMore    bool        `json:"has_more"`
}

// AckRequest 定义 /agent/v1/logs/ack 请求。
type AckRequest struct {
	BatchID         string `json:"batch_id"`
	Status          string `json:"status"`
	CommittedCursor string `json:"committed_cursor"`
	Reason          string `json:"reason"`
}

// AckResponse 定义 /agent/v1/logs/ack 响应。
type AckResponse struct {
	Accepted          bool `json:"accepted"`
	CheckpointUpdated bool `json:"checkpoint_updated"`
}

// APIRecord 定义 pull 返回的记录骨架。
type APIRecord struct {
	// RecordID 为批次内记录标识，便于调用端做幂等追踪与问题排查。
	RecordID string `json:"record_id"`
	// Sequence 为 Agent 侧递增序号，可与 cursor 对照定位。
	Sequence int64 `json:"sequence"`
	// Source 为日志来源（通常是文件路径，也可为 syslog 等来源标识）。
	Source string `json:"source"`
	// Timestamp 为日志采集时间（Unix 纳秒）。
	Timestamp int64 `json:"timestamp"`
	// CollectedAt 为可读时间格式，便于直接展示与排障。
	CollectedAt string `json:"collected_at"`
	// Data 为日志原文。
	Data string `json:"data"`
	// SizeBytes 为日志原文字节数，便于上游估算带宽与批次大小。
	SizeBytes int `json:"size_bytes"`
	// Offset 为该条记录对应来源中的绝对偏移（行尾位置）。
	Offset int64 `json:"offset"`
	// Metadata 保留扩展元数据，至少保证 offset 可用（兼容历史调用方）。
	Metadata map[string]string `json:"metadata,omitempty"`
}

type internalRecord struct {
	Seq       int64
	Source    string
	Timestamp int64
	Data      []byte
	Offset    int64
	Metadata  map[string]string
}

type pendingBatch struct {
	Records    []internalRecord
	NextCursor int64
}

// Service 提供 pull/ack 会话状态管理。
type Service struct {
	mu              sync.RWMutex
	ckpStore        checkpoint.Store
	records         []internalRecord
	nextSeq         int64
	committedCursor int64
	pending         map[string]pendingBatch
	notifyCh        chan struct{}
}

// New 创建 pull API 状态服务。
func New(ckpStore checkpoint.Store) *Service {
	return &Service{
		ckpStore: ckpStore,
		records:  make([]internalRecord, 0, 1024),
		pending:  make(map[string]pendingBatch),
		notifyCh: make(chan struct{}, 1),
	}
}

// NewAuthConfig 创建 pull API 鉴权配置。
func NewAuthConfig(activeID, activeKey, nextID, nextKey string) AuthConfig {
	keys := make(map[string]string)
	if id := strings.TrimSpace(activeID); id != "" && strings.TrimSpace(activeKey) != "" {
		keys[id] = strings.TrimSpace(activeKey)
	}
	if id := strings.TrimSpace(nextID); id != "" && strings.TrimSpace(nextKey) != "" {
		keys[id] = strings.TrimSpace(nextKey)
	}
	return AuthConfig{KeysByID: keys}
}

// AddRecords 追加采集记录，供 pull 接口按 cursor 拉取。
func (s *Service) AddRecords(batch []plugins.Record) {
	if len(batch) == 0 {
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for _, record := range batch {
		s.nextSeq++
		s.records = append(s.records, internalRecord{
			Seq:       s.nextSeq,
			Source:    record.Source,
			Timestamp: normalizeTimestamp(record.Timestamp),
			Data:      append([]byte(nil), record.Data...),
			Offset:    parseOffset(record),
			Metadata:  cloneMetadata(record.Metadata),
		})
	}

	// 限制内存窗口，防止长时间运行无限增长。
	if len(s.records) > maxBufferedRecord {
		overflow := len(s.records) - maxBufferedRecord
		s.records = append([]internalRecord(nil), s.records[overflow:]...)
	}

	select {
	case s.notifyCh <- struct{}{}:
	default:
	}
}

// Pull 按游标返回批次记录，支持短时等待新增数据。
func (s *Service) Pull(req PullRequest) (PullResponse, error) {
	normalized, err := normalizePullRequest(req)
	if err != nil {
		return PullResponse{}, err
	}

	deadline := time.Now().Add(time.Duration(normalized.TimeoutMS) * time.Millisecond)
	for {
		resp, ok, err := s.tryBuildPullResponse(normalized)
		if err != nil {
			return PullResponse{}, err
		}
		if ok {
			return resp, nil
		}
		if normalized.TimeoutMS <= 0 || time.Now().After(deadline) {
			return PullResponse{
				BatchID:    "",
				Records:    []APIRecord{},
				NextCursor: normalized.Cursor,
				HasMore:    false,
			}, nil
		}

		remaining := time.Until(deadline)
		if remaining <= 0 {
			return PullResponse{
				BatchID:    "",
				Records:    []APIRecord{},
				NextCursor: normalized.Cursor,
				HasMore:    false,
			}, nil
		}
		timer := time.NewTimer(remaining)
		select {
		case <-s.notifyCh:
		case <-timer.C:
		}
		if !timer.Stop() {
			select {
			case <-timer.C:
			default:
			}
		}
	}
}

// Ack 处理 pull 批次确认，ACK 时回写 checkpoint。
func (s *Service) Ack(req AckRequest) (AckResponse, int, error) {
	normalized, err := normalizeAckRequest(req)
	if err != nil {
		return AckResponse{}, http.StatusBadRequest, err
	}

	s.mu.Lock()
	batch, ok := s.pending[normalized.BatchID]
	if !ok {
		s.mu.Unlock()
		return AckResponse{}, http.StatusNotFound, fmt.Errorf("batch_id not found")
	}
	delete(s.pending, normalized.BatchID)

	accepted := true
	checkpointUpdated := false
	if normalized.Status == "ack" {
		committedCursor := batch.NextCursor
		if normalized.CommittedCursor != "" {
			parsed, parseErr := strconv.ParseInt(normalized.CommittedCursor, 10, 64)
			if parseErr != nil || parsed < 0 {
				s.mu.Unlock()
				return AckResponse{}, http.StatusBadRequest, fmt.Errorf("committed_cursor must be a non-negative integer")
			}
			if parsed > committedCursor {
				committedCursor = parsed
			}
		}
		if committedCursor > s.committedCursor {
			s.committedCursor = committedCursor
		}

		latestOffsets := make(map[string]int64)
		for _, record := range batch.Records {
			if record.Source == "" || record.Offset <= 0 {
				continue
			}
			if existing, exists := latestOffsets[record.Source]; !exists || record.Offset > existing {
				latestOffsets[record.Source] = record.Offset
			}
		}

		// checkpoint 回写在锁内串行执行，保证 committed_cursor 与持久化语义一致。
		for source, offset := range latestOffsets {
			if saveErr := s.ckpStore.Save(source, offset); saveErr == nil {
				checkpointUpdated = true
			}
		}
	}
	s.mu.Unlock()

	return AckResponse{
		Accepted:          accepted,
		CheckpointUpdated: checkpointUpdated,
	}, http.StatusOK, nil
}

func (s *Service) tryBuildPullResponse(req PullRequest) (PullResponse, bool, error) {
	startCursor, err := parseCursor(req.Cursor)
	if err != nil {
		return PullResponse{}, false, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if req.Cursor == "" {
		startCursor = s.committedCursor
	}

	selected := make([]internalRecord, 0, req.MaxRecords)
	totalBytes := 0
	for _, record := range s.records {
		if record.Seq <= startCursor {
			continue
		}
		recordSize := len(record.Data)
		if len(selected) >= req.MaxRecords {
			break
		}
		if totalBytes+recordSize > req.MaxBytes && len(selected) > 0 {
			break
		}
		selected = append(selected, record)
		totalBytes += recordSize
	}

	if len(selected) == 0 {
		return PullResponse{}, false, nil
	}

	lastSeq := selected[len(selected)-1].Seq
	hasMore := false
	for _, record := range s.records {
		if record.Seq > lastSeq {
			hasMore = true
			break
		}
	}

	apiRecords := make([]APIRecord, 0, len(selected))
	for _, record := range selected {
		apiRecords = append(apiRecords, APIRecord{
			RecordID:    formatRecordID(record.Seq),
			Sequence:    record.Seq,
			Source:      record.Source,
			Timestamp:   record.Timestamp,
			CollectedAt: formatTimestampRFC3339Nano(record.Timestamp),
			Data:        string(record.Data),
			SizeBytes:   len(record.Data),
			Offset:      record.Offset,
			Metadata:    buildAPIMetadata(record),
		})
	}

	batchID := newBatchID()
	s.pending[batchID] = pendingBatch{
		Records:    append([]internalRecord(nil), selected...),
		NextCursor: lastSeq,
	}

	return PullResponse{
		BatchID:    batchID,
		Records:    apiRecords,
		NextCursor: strconv.FormatInt(lastSeq, 10),
		HasMore:    hasMore,
	}, true, nil
}

// RegisterRoutes 注册 agent pull 三个接口。
func RegisterRoutes(mux *http.ServeMux, svc *Service, meta MetaInfo, auth AuthConfig) {
	mux.HandleFunc("/agent/v1/meta", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, ErrorCodeInvalidParams, "method not allowed")
			return
		}
		if !authenticateRequest(w, r, auth) {
			return
		}
		writeJSON(w, http.StatusOK, meta)
	})

	mux.HandleFunc("/agent/v1/logs/pull", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, ErrorCodeInvalidParams, "method not allowed")
			return
		}
		if !authenticateRequest(w, r, auth) {
			return
		}
		var req PullRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, ErrorCodeInvalidParams, err.Error())
			return
		}
		resp, err := svc.Pull(req)
		if err != nil {
			writeError(w, http.StatusBadRequest, ErrorCodeInvalidParams, err.Error())
			return
		}
		writeJSONCompressed(w, http.StatusOK, resp, r)
	})

	mux.HandleFunc("/agent/v1/logs/ack", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, ErrorCodeInvalidParams, "method not allowed")
			return
		}
		if !authenticateRequest(w, r, auth) {
			return
		}
		var req AckRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, ErrorCodeInvalidParams, err.Error())
			return
		}
		resp, status, err := svc.Ack(req)
		if err != nil {
			code := ErrorCodeInvalidParams
			if status == http.StatusNotFound {
				code = ErrorCodeNotFound
			} else if status >= http.StatusInternalServerError {
				code = ErrorCodeInternalError
			}
			writeError(w, status, code, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})
}

func authenticateRequest(w http.ResponseWriter, r *http.Request, auth AuthConfig) bool {
	agentKey := strings.TrimSpace(r.Header.Get("X-Agent-Key"))
	if agentKey == "" {
		writeError(w, http.StatusUnauthorized, ErrorCodeAuthMissingToken, "unauthorized")
		return false
	}

	keyID := strings.TrimSpace(r.Header.Get("X-Key-Id"))
	if !auth.matches(keyID, agentKey) {
		writeError(w, http.StatusUnauthorized, ErrorCodeAuthInvalidToken, "unauthorized")
		return false
	}
	return true
}

func (a AuthConfig) matches(keyID, key string) bool {
	if len(a.KeysByID) == 0 {
		return false
	}

	if keyID != "" {
		expected, ok := a.KeysByID[keyID]
		return ok && expected == key
	}

	for _, expected := range a.KeysByID {
		if expected == key {
			return true
		}
	}
	return false
}

func normalizePullRequest(req PullRequest) (PullRequest, error) {
	normalized := PullRequest{
		Cursor:     strings.TrimSpace(req.Cursor),
		MaxRecords: req.MaxRecords,
		MaxBytes:   req.MaxBytes,
		TimeoutMS:  req.TimeoutMS,
	}
	if normalized.MaxRecords == 0 {
		normalized.MaxRecords = defaultMaxRecords
	}
	if normalized.MaxRecords < 0 {
		return PullRequest{}, fmt.Errorf("max_records must be >= 0")
	}
	if normalized.MaxRecords > maxMaxRecords {
		normalized.MaxRecords = maxMaxRecords
	}
	if normalized.MaxBytes == 0 {
		normalized.MaxBytes = defaultMaxBytes
	}
	if normalized.MaxBytes <= 0 {
		return PullRequest{}, fmt.Errorf("max_bytes must be > 0")
	}
	if normalized.MaxBytes > maxMaxBytes {
		normalized.MaxBytes = maxMaxBytes
	}
	if normalized.TimeoutMS < 0 {
		return PullRequest{}, fmt.Errorf("timeout_ms must be >= 0")
	}
	return normalized, nil
}

func normalizeAckRequest(req AckRequest) (AckRequest, error) {
	normalized := AckRequest{
		BatchID:         strings.TrimSpace(req.BatchID),
		Status:          strings.ToLower(strings.TrimSpace(req.Status)),
		CommittedCursor: strings.TrimSpace(req.CommittedCursor),
		Reason:          strings.TrimSpace(req.Reason),
	}
	if normalized.BatchID == "" {
		return AckRequest{}, fmt.Errorf("batch_id is required")
	}
	if normalized.Status != "ack" && normalized.Status != "nack" {
		return AckRequest{}, fmt.Errorf("status must be ack or nack")
	}
	if normalized.Status == "nack" && normalized.Reason == "" {
		return AckRequest{}, fmt.Errorf("reason is required when status is nack")
	}
	return normalized, nil
}

func parseCursor(cursor string) (int64, error) {
	if strings.TrimSpace(cursor) == "" {
		return 0, nil
	}
	parsed, err := strconv.ParseInt(cursor, 10, 64)
	if err != nil || parsed < 0 {
		return 0, fmt.Errorf("cursor must be a non-negative integer")
	}
	return parsed, nil
}

func parseOffset(record plugins.Record) int64 {
	if record.Metadata != nil {
		raw := strings.TrimSpace(record.Metadata["offset"])
		if raw != "" {
			if parsed, err := strconv.ParseInt(raw, 10, 64); err == nil && parsed >= 0 {
				return parsed
			}
		}
	}
	return int64(len(record.Data))
}

func normalizeTimestamp(ts int64) int64 {
	if ts > 0 {
		return ts
	}
	return time.Now().UTC().UnixNano()
}

func decodeJSON(r *http.Request, v any) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(v); err != nil {
		return err
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{
		"code":    code,
		"message": message,
	})
}

func newBatchID() string {
	raw := make([]byte, 12)
	if _, err := rand.Read(raw); err != nil {
		return fmt.Sprintf("batch-%d", time.Now().UnixNano())
	}
	return "batch-" + hex.EncodeToString(raw)
}

func cloneMetadata(src map[string]string) map[string]string {
	if len(src) == 0 {
		return nil
	}
	dst := make(map[string]string, len(src))
	for key, value := range src {
		dst[key] = value
	}
	return dst
}

// buildAPIMetadata 构造 pull 返回元数据。
// 兼容性要求：历史调用方依赖 metadata.offset，因此此处保证该字段始终可取。
func buildAPIMetadata(record internalRecord) map[string]string {
	metadata := cloneMetadata(record.Metadata)
	if record.Offset > 0 {
		if metadata == nil {
			metadata = make(map[string]string, 1)
		}
		if strings.TrimSpace(metadata["offset"]) == "" {
			metadata["offset"] = strconv.FormatInt(record.Offset, 10)
		}
	}
	if len(metadata) == 0 {
		return nil
	}
	return metadata
}

// formatRecordID 基于内部递增序号生成记录 ID。
func formatRecordID(seq int64) string {
	return "rec-" + strconv.FormatInt(seq, 10)
}

// formatTimestampRFC3339Nano 将 Unix 纳秒时间戳格式化为 UTC 字符串。
func formatTimestampRFC3339Nano(ts int64) string {
	if ts <= 0 {
		return ""
	}
	return time.Unix(0, ts).UTC().Format(time.RFC3339Nano)
}

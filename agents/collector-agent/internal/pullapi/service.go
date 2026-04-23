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
	"github.com/nexuslog/collector-agent/internal/pathmatch"
	"github.com/nexuslog/collector-agent/plugins"
)

const (
	ErrorCodeInvalidParams    = "REQ_INVALID_PARAMS"
	ErrorCodeNotFound         = "RES_NOT_FOUND"
	ErrorCodeInternalError    = "INTERNAL_ERROR"
	ErrorCodeAuthMissingToken = "AUTH_MISSING_TOKEN"
	ErrorCodeAuthInvalidToken = "AUTH_INVALID_TOKEN"
)

const (
	defaultMaxRecords  = 200
	maxMaxRecords      = 1000
	defaultMaxBytes    = 1 * 1024 * 1024
	maxMaxBytes        = 5 * 1024 * 1024
	maxBufferedRecord  = 20000
	defaultDedupWindow = 10 * time.Second
)

type MetaInfo struct {
	AgentID      string   `json:"agent_id"`
	Version      string   `json:"version"`
	Hostname     string   `json:"hostname,omitempty"`
	IP           string   `json:"ip,omitempty"`
	Status       string   `json:"status"`
	Sources      []string `json:"sources"`
	Capabilities []string `json:"capabilities"`
}

type AuthConfig struct {
	KeysByID map[string]string
}

type PullRequest struct {
	Cursor     string `json:"cursor"`
	SourcePath string `json:"source_path,omitempty"`
	MaxRecords int    `json:"max_records"`
	MaxBytes   int    `json:"max_bytes"`
	TimeoutMS  int    `json:"timeout_ms"`
}

type PullResponse struct {
	BatchID string      `json:"batch_id"`
	Agent   APIAgent    `json:"agent,omitempty"`
	Cursor  APICursor   `json:"cursor,omitempty"`
	Records []APIRecord `json:"records"`
}

type AckRequest struct {
	BatchID         string `json:"batch_id"`
	Status          string `json:"status"`
	CommittedCursor string `json:"committed_cursor"`
	Reason          string `json:"reason"`
}

type AckResponse struct {
	Accepted          bool `json:"accepted"`
	CheckpointUpdated bool `json:"checkpoint_updated"`
}

type APIAgent struct {
	ID       string `json:"id,omitempty"`
	Version  string `json:"version,omitempty"`
	Hostname string `json:"hostname,omitempty"`
	IP       string `json:"ip,omitempty"`
}

type APICursor struct {
	Next    string `json:"next,omitempty"`
	HasMore bool   `json:"has_more"`
}

type APISource struct {
	Kind   string `json:"kind,omitempty"`
	Path   string `json:"path,omitempty"`
	Offset int64  `json:"offset,omitempty"`
	Stream string `json:"stream,omitempty"`
}

type APISeverity struct {
	Text   string `json:"text,omitempty"`
	Number int    `json:"number,omitempty"`
}

type APIServiceInstance struct {
	ID string `json:"id,omitempty"`
}

type APIService struct {
	Name        string             `json:"name,omitempty"`
	Instance    APIServiceInstance `json:"instance,omitempty"`
	Version     string             `json:"version,omitempty"`
	Environment string             `json:"environment,omitempty"`
}

type APIContainer struct {
	Name string `json:"name,omitempty"`
}

type APIMultiline struct {
	Enabled                 bool  `json:"enabled"`
	LineCount               int   `json:"line_count,omitempty"`
	StartOffset             int64 `json:"start_offset,omitempty"`
	EndOffset               int64 `json:"end_offset,omitempty"`
	DroppedEmptyPrefixLines int   `json:"dropped_empty_prefix_lines,omitempty"`
}

type APIDedup struct {
	Hit         bool   `json:"hit,omitempty"`
	Count       int    `json:"count,omitempty"`
	FirstSeenAt string `json:"first_seen_at,omitempty"`
	LastSeenAt  string `json:"last_seen_at,omitempty"`
	WindowSec   int    `json:"window_sec,omitempty"`
	Strategy    string `json:"strategy,omitempty"`
}

type APIRecord struct {
	RecordID string `json:"record_id"`
	Sequence int64  `json:"sequence"`

	ObservedAt string            `json:"observed_at,omitempty"`
	Body       string            `json:"body,omitempty"`
	SizeBytes  int               `json:"size_bytes"`
	Source     APISource         `json:"source,omitempty"`
	Severity   APISeverity       `json:"severity,omitempty"`
	Service    APIService        `json:"service,omitempty"`
	Container  APIContainer      `json:"container,omitempty"`
	Attributes map[string]string `json:"attributes,omitempty"`
	Multiline  APIMultiline      `json:"multiline"`
	Dedup      APIDedup          `json:"dedup,omitempty"`
	Original   string            `json:"original,omitempty"`
}

type internalRecord struct {
	Seq       int64
	Source    string
	Timestamp int64
	Data      []byte
	Original  string
	Offset    int64
	Metadata  map[string]string

	SourceV2    APISource
	Severity    APISeverity
	Service     APIService
	Container   APIContainer
	Attributes  map[string]string
	Multiline   APIMultiline
	Dedup       APIDedup
	Fingerprint string
}

type pendingBatch struct {
	Records    []internalRecord
	NextCursor int64
	SourcePath string
}

type dedupCacheEntry struct {
	Seq      int64
	LastSeen time.Time
}

type Service struct {
	mu                  sync.RWMutex
	ckpStore            checkpoint.Store
	records             []internalRecord
	nextSeq             int64
	pending             map[string]pendingBatch
	notifyCh            chan struct{}
	agentID             string
	agentVersion        string
	agentHostname       string
	agentIP             string
	committedCursors    map[string]int64
	dedupWindow         time.Duration
	recentByFingerprint map[string]dedupCacheEntry
}

func New(ckpStore checkpoint.Store) *Service {
	return &Service{
		ckpStore:            ckpStore,
		records:             make([]internalRecord, 0, 1024),
		pending:             make(map[string]pendingBatch),
		notifyCh:            make(chan struct{}, 1),
		committedCursors:    make(map[string]int64),
		dedupWindow:         defaultDedupWindow,
		recentByFingerprint: make(map[string]dedupCacheEntry),
	}
}

func (s *Service) SetAgentInfo(agentID, version, hostname, ip string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.agentID = strings.TrimSpace(agentID)
	s.agentVersion = strings.TrimSpace(version)
	s.agentHostname = strings.TrimSpace(hostname)
	s.agentIP = strings.TrimSpace(ip)
}

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

func (s *Service) AddRecords(batch []plugins.Record) {
	if len(batch) == 0 {
		return
	}

	s.mu.RLock()
	agentHostname := s.agentHostname
	agentIP := s.agentIP
	s.mu.RUnlock()

	normalized := normalizePluginBatch(batch, agentHostname, agentIP)
	if len(normalized) == 0 {
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for _, record := range normalized {
		if s.tryAppendMultilineContinuationLocked(&record) {
			continue
		}
		s.nextSeq++
		record.Seq = s.nextSeq
		if s.tryMergeDuplicateLocked(&record) {
			continue
		}
		s.records = append(s.records, record)
		s.recentByFingerprint[record.Fingerprint] = dedupCacheEntry{Seq: record.Seq, LastSeen: time.Unix(0, record.Timestamp).UTC()}
	}

	if len(s.records) > maxBufferedRecord {
		overflow := len(s.records) - maxBufferedRecord
		s.records = append([]internalRecord(nil), s.records[overflow:]...)
		s.rebuildRecentCacheLocked()
	}

	select {
	case s.notifyCh <- struct{}{}:
	default:
	}
}

func (s *Service) tryAppendMultilineContinuationLocked(record *internalRecord) bool {
	if record == nil || len(s.records) == 0 {
		return false
	}

	for idx := len(s.records) - 1; idx >= 0; idx-- {
		existing := &s.records[idx]
		if !shouldAppendInternalRecordToMultiline(*existing, *record) {
			continue
		}
		oldFingerprint := existing.Fingerprint
		appendInternalRecordToMultiline(existing, *record)
		finalizeInternalRecord(existing)
		if oldFingerprint != "" && oldFingerprint != existing.Fingerprint {
			delete(s.recentByFingerprint, oldFingerprint)
		}
		s.recentByFingerprint[existing.Fingerprint] = dedupCacheEntry{Seq: existing.Seq, LastSeen: time.Unix(0, existing.Timestamp).UTC()}
		return true
	}
	return false
}

func shouldAppendInternalRecordToMultiline(current, next internalRecord) bool {
	if current.Source != next.Source {
		return false
	}
	if current.Service.Instance.ID != "" && next.Service.Instance.ID != "" && current.Service.Instance.ID != next.Service.Instance.ID {
		return false
	}
	currentSeen := time.Unix(0, current.Timestamp).UTC()
	nextSeen := time.Unix(0, next.Timestamp).UTC()
	if nextSeen.Before(currentSeen) || nextSeen.Sub(currentSeen) > defaultDedupWindow {
		return false
	}

	currentLastLine := lastNonEmptyLine(string(current.Data))
	nextBody := string(next.Data)
	nextLine := strings.TrimSpace(nextBody)
	if nextLine == "" {
		return false
	}
	if isStackTraceContinuation(nextLine) {
		return true
	}
	if isNPMErrorLine(currentLastLine) && isNPMErrorLine(nextLine) {
		return true
	}
	if strings.HasPrefix(nextBody, " ") || strings.HasPrefix(nextBody, "\t") {
		return isErrorHeader(currentLastLine) || current.Multiline.Enabled
	}
	return false
}

func appendInternalRecordToMultiline(current *internalRecord, next internalRecord) {
	if current == nil {
		return
	}
	current.Multiline.Enabled = true
	if current.Multiline.LineCount <= 0 {
		current.Multiline.LineCount = 1
	}
	current.Multiline.LineCount += max(1, next.Multiline.LineCount)
	current.Multiline.EndOffset = next.Offset
	current.Multiline.DroppedEmptyPrefixLines += next.Multiline.DroppedEmptyPrefixLines
	current.Offset = next.Offset
	current.SourceV2.Offset = next.Offset
	current.Data = append(current.Data, '\n')
	current.Data = append(current.Data, next.Data...)
	if strings.TrimSpace(next.Original) != "" {
		if strings.TrimSpace(current.Original) == "" {
			current.Original = next.Original
		} else {
			current.Original = current.Original + "\n" + next.Original
		}
	}
	if next.Timestamp > current.Timestamp {
		current.Timestamp = next.Timestamp
	}
	if current.Severity.Number < next.Severity.Number {
		current.Severity = next.Severity
	}
}

func max(left, right int) int {
	if left > right {
		return left
	}
	return right
}

func (s *Service) tryMergeDuplicateLocked(record *internalRecord) bool {
	if record == nil || record.Fingerprint == "" {
		return false
	}
	entry, ok := s.recentByFingerprint[record.Fingerprint]
	if !ok {
		return false
	}
	currentSeen := time.Unix(0, record.Timestamp).UTC()
	if currentSeen.Sub(entry.LastSeen) > s.dedupWindow {
		return false
	}
	idx := s.findRecordIndexBySeqLocked(entry.Seq)
	if idx < 0 {
		return false
	}
	existing := &s.records[idx]
	if existing.Dedup.Count <= 0 {
		existing.Dedup.Count = 1
		existing.Dedup.FirstSeenAt = formatTimestampRFC3339Nano(existing.Timestamp)
		existing.Dedup.LastSeenAt = formatTimestampRFC3339Nano(existing.Timestamp)
	}
	existing.Dedup.Hit = true
	existing.Dedup.Count++
	existing.Dedup.LastSeenAt = formatTimestampRFC3339Nano(record.Timestamp)
	existing.Dedup.WindowSec = int(s.dedupWindow.Seconds())
	if existing.Multiline.Enabled || record.Multiline.Enabled {
		existing.Dedup.Strategy = "multiline"
	} else {
		existing.Dedup.Strategy = "exact"
	}
	s.recentByFingerprint[record.Fingerprint] = dedupCacheEntry{Seq: existing.Seq, LastSeen: currentSeen}
	return true
}

func (s *Service) findRecordIndexBySeqLocked(seq int64) int {
	for i := len(s.records) - 1; i >= 0; i-- {
		if s.records[i].Seq == seq {
			return i
		}
	}
	return -1
}

func (s *Service) rebuildRecentCacheLocked() {
	s.recentByFingerprint = make(map[string]dedupCacheEntry)
	for i := range s.records {
		rec := s.records[i]
		if rec.Fingerprint == "" {
			continue
		}
		s.recentByFingerprint[rec.Fingerprint] = dedupCacheEntry{Seq: rec.Seq, LastSeen: time.Unix(0, rec.Timestamp).UTC()}
	}
}

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
			return PullResponse{Cursor: APICursor{Next: normalized.Cursor, HasMore: false}, Records: []APIRecord{}}, nil
		}
		remaining := time.Until(deadline)
		if remaining <= 0 {
			return PullResponse{Cursor: APICursor{Next: normalized.Cursor, HasMore: false}, Records: []APIRecord{}}, nil
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
		scopeKey := pullScopeKey(batch.SourcePath)
		if committedCursor > s.committedCursors[scopeKey] {
			s.committedCursors[scopeKey] = committedCursor
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
		for source, offset := range latestOffsets {
			if saveErr := s.ckpStore.Save(source, offset); saveErr == nil {
				checkpointUpdated = true
			}
		}
	}
	s.mu.Unlock()

	return AckResponse{Accepted: accepted, CheckpointUpdated: checkpointUpdated}, http.StatusOK, nil
}

func (s *Service) tryBuildPullResponse(req PullRequest) (PullResponse, bool, error) {
	startCursor, err := parseCursor(req.Cursor)
	if err != nil {
		return PullResponse{}, false, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	sourcePath := strings.TrimSpace(req.SourcePath)
	scopeKey := pullScopeKey(sourcePath)
	if req.Cursor == "" {
		startCursor = s.committedCursors[scopeKey]
	}

	latestMatchingSeq := int64(0)
	for _, record := range s.records {
		if !matchesSourcePath(record, sourcePath) {
			continue
		}
		latestMatchingSeq = record.Seq
	}
	if latestMatchingSeq > 0 && startCursor > latestMatchingSeq {
		startCursor = 0
	}

	selected := make([]internalRecord, 0, req.MaxRecords)
	totalBytes := 0
	for _, record := range s.records {
		if !matchesSourcePath(record, sourcePath) {
			continue
		}
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
		if !matchesSourcePath(record, sourcePath) {
			continue
		}
		if record.Seq > lastSeq {
			hasMore = true
			break
		}
	}

	apiRecords := make([]APIRecord, 0, len(selected))
	for _, record := range selected {
		apiRecords = append(apiRecords, APIRecord{
			RecordID:   formatRecordID(record.Seq),
			Sequence:   record.Seq,
			ObservedAt: formatTimestampRFC3339Nano(record.Timestamp),
			Body:       string(record.Data),
			SizeBytes:  len(record.Data),
			Source:     record.SourceV2,
			Severity:   record.Severity,
			Service:    record.Service,
			Container:  record.Container,
			Attributes: cloneMetadata(record.Attributes),
			Multiline:  record.Multiline,
			Dedup:      record.Dedup,
			Original:   record.Original,
		})
	}

	batchID := newBatchID()
	s.pending[batchID] = pendingBatch{Records: append([]internalRecord(nil), selected...), NextCursor: lastSeq, SourcePath: sourcePath}
	return PullResponse{
		BatchID: batchID,
		Agent:   APIAgent{ID: s.agentID, Version: s.agentVersion, Hostname: s.agentHostname, IP: s.agentIP},
		Cursor:  APICursor{Next: strconv.FormatInt(lastSeq, 10), HasMore: hasMore},
		Records: apiRecords,
	}, true, nil
}

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
	normalized := PullRequest{Cursor: strings.TrimSpace(req.Cursor), SourcePath: strings.TrimSpace(req.SourcePath), MaxRecords: req.MaxRecords, MaxBytes: req.MaxBytes, TimeoutMS: req.TimeoutMS}
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
	normalized := AckRequest{BatchID: strings.TrimSpace(req.BatchID), Status: strings.ToLower(strings.TrimSpace(req.Status)), CommittedCursor: strings.TrimSpace(req.CommittedCursor), Reason: strings.TrimSpace(req.Reason)}
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
	writeJSON(w, status, map[string]any{"code": code, "message": message})
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

func formatRecordID(seq int64) string {
	return "rec-" + strconv.FormatInt(seq, 10)
}

func pullScopeKey(sourcePath string) string {
	sourcePath = strings.TrimSpace(sourcePath)
	if sourcePath == "" {
		return "*"
	}
	return sourcePath
}

func matchesSourcePath(record internalRecord, sourcePath string) bool {
	patterns := parseSourcePathPatterns(sourcePath)
	if len(patterns) == 0 {
		return true
	}
	recordPath := strings.TrimSpace(record.SourceV2.Path)
	if recordPath == "" {
		recordPath = strings.TrimSpace(record.Source)
	}
	if recordPath == "" {
		return false
	}
	for _, pattern := range patterns {
		if sourcePathPatternMatches(pattern, recordPath) {
			return true
		}
	}
	return false
}

func parseSourcePathPatterns(sourcePath string) []string {
	if strings.TrimSpace(sourcePath) == "" {
		return nil
	}
	parts := strings.Split(sourcePath, ",")
	patterns := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		patterns = append(patterns, trimmed)
	}
	return patterns
}

func sourcePathPatternMatches(pattern, recordPath string) bool {
	pattern = strings.TrimSpace(pattern)
	recordPath = strings.TrimSpace(recordPath)
	if pattern == "" || recordPath == "" {
		return false
	}
	if matched, err := pathmatch.Match(pattern, recordPath); err == nil && matched {
		return true
	}
	return pattern == recordPath
}

func formatTimestampRFC3339Nano(ts int64) string {
	if ts <= 0 {
		return ""
	}
	return time.Unix(0, ts).UTC().Format(time.RFC3339Nano)
}

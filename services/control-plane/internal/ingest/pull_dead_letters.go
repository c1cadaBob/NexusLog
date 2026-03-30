package ingest

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	// ErrorCodeDeadLetterInvalidArgument 表示 dead-letter 请求参数非法。
	ErrorCodeDeadLetterInvalidArgument = ErrorCodeRequestInvalidParams
	// ErrorCodeDeadLetterNotFound 表示死信 ID 不存在。
	ErrorCodeDeadLetterNotFound = ErrorCodeResourceNotFound
	// ErrorCodeDeadLetterInternalError 表示 dead-letter 处理内部异常。
	ErrorCodeDeadLetterInternalError = ErrorCodeInternalError
)

var (
	allowedDeadLetterReplayedFilters = map[string]struct{}{
		"yes": {},
		"no":  {},
	}
)

// DeadLetterReplayRequest 定义 POST /api/v1/ingest/dead-letters/replay 请求体。
type DeadLetterReplayRequest struct {
	DeadLetterIDs []string `json:"dead_letter_ids"`
	Reason        string   `json:"reason"`
}

// DeadLetterRecord 定义死信记录结构（6.6 最小可用版本）。
type DeadLetterRecord struct {
	DeadLetterID  string     `json:"dead_letter_id"`
	PackageID     string     `json:"package_id,omitempty"`
	SourceRef     string     `json:"source_ref,omitempty"`
	ErrorCode     string     `json:"error_code,omitempty"`
	ErrorMessage  string     `json:"error_message,omitempty"`
	RetryCount    int        `json:"retry_count"`
	FailedAt      time.Time  `json:"failed_at"`
	CreatedAt     time.Time  `json:"created_at"`
	ReplayedAt    *time.Time `json:"replayed_at,omitempty"`
	ReplayBatchID string     `json:"replay_batch_id,omitempty"`
	ReplayReason  string     `json:"replay_reason,omitempty"`
}

type listDeadLettersQuery struct {
	SourceRef string
	PackageID string
	Replayed  string
	Page      int
	PageSize  int
}

// DeadLetterStore 提供死信记录写入、查询与重放能力（内存仓储）。
type DeadLetterStore struct {
	mu      sync.RWMutex
	items   map[string]DeadLetterRecord
	backend *PGBackend
}

// NewDeadLetterStore 创建死信内存仓储。
func NewDeadLetterStore() *DeadLetterStore {
	return &DeadLetterStore{
		items: make(map[string]DeadLetterRecord),
	}
}

// NewDeadLetterStoreWithPG 创建死信 PostgreSQL 仓储。
func NewDeadLetterStoreWithPG(backend *PGBackend) *DeadLetterStore {
	return &DeadLetterStore{
		items:   make(map[string]DeadLetterRecord),
		backend: backend,
	}
}

// CreateFromReceipt 在 NACK 回执后写入一条死信记录。
func (s *DeadLetterStore) CreateFromReceipt(pkg PullPackage, reason string, payloads ...map[string]any) (DeadLetterRecord, error) {
	var payload map[string]any
	if len(payloads) > 0 {
		payload = payloads[0]
	}
	if s.backend != nil {
		return s.createFromReceiptFromDB(context.Background(), pkg, reason, payload)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now().UTC()
	record := DeadLetterRecord{
		DeadLetterID: newUUIDLike(),
		PackageID:    pkg.PackageID,
		SourceRef:    pkg.SourceRef,
		ErrorCode:    "NACK_RECEIPT",
		ErrorMessage: strings.TrimSpace(reason),
		RetryCount:   0,
		FailedAt:     now,
		CreatedAt:    now,
	}
	s.items[record.DeadLetterID] = record
	return record, nil
}

// CreateForTest 仅用于测试场景注入死信记录。
func (s *DeadLetterStore) CreateForTest(record DeadLetterRecord) DeadLetterRecord {
	if s.backend != nil {
		created, err := s.createRecordFromDB(context.Background(), record)
		if err != nil {
			return DeadLetterRecord{}
		}
		return created
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	created := record
	if strings.TrimSpace(created.DeadLetterID) == "" {
		created.DeadLetterID = newUUIDLike()
	}
	if created.FailedAt.IsZero() {
		created.FailedAt = time.Now().UTC()
	}
	if created.CreatedAt.IsZero() {
		created.CreatedAt = created.FailedAt
	}
	s.items[created.DeadLetterID] = created
	return created
}

// List 按 source_ref/package_id/replayed 过滤并返回分页死信列表。
func (s *DeadLetterStore) List(sourceRef, packageID, replayed string, page, pageSize int) ([]DeadLetterRecord, int) {
	if s.backend != nil {
		return s.listFromDB(context.Background(), sourceRef, packageID, replayed, page, pageSize)
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	sourceRef = strings.TrimSpace(sourceRef)
	packageID = strings.TrimSpace(packageID)
	replayed = strings.ToLower(strings.TrimSpace(replayed))

	result := make([]DeadLetterRecord, 0, len(s.items))
	for _, item := range s.items {
		if sourceRef != "" && item.SourceRef != sourceRef {
			continue
		}
		if packageID != "" && item.PackageID != packageID {
			continue
		}
		if !matchesDeadLetterReplayedFilter(item, replayed) {
			continue
		}
		result = append(result, item)
	}

	sort.Slice(result, func(i, j int) bool {
		if result[i].FailedAt.Equal(result[j].FailedAt) {
			return result[i].DeadLetterID > result[j].DeadLetterID
		}
		return result[i].FailedAt.After(result[j].FailedAt)
	})

	total := len(result)
	start := (page - 1) * pageSize
	if start >= total {
		return []DeadLetterRecord{}, total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	return result[start:end], total
}

// Replay 按 dead_letter_ids 执行重放并返回批次号与成功数量。
func (s *DeadLetterStore) Replay(deadLetterIDs []string, reason string) (string, int, error) {
	if s.backend != nil {
		return s.replayFromDB(context.Background(), deadLetterIDs, reason)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	replayBatchID := newUUIDLike()
	replayedCount := 0
	replayedAt := time.Now().UTC()

	seen := make(map[string]struct{}, len(deadLetterIDs))
	for _, id := range deadLetterIDs {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, duplicated := seen[id]; duplicated {
			continue
		}
		seen[id] = struct{}{}

		record, ok := s.items[id]
		if !ok {
			continue
		}
		record.RetryCount++
		record.ReplayedAt = &replayedAt
		record.ReplayBatchID = replayBatchID
		record.ReplayReason = reason
		s.items[id] = record
		replayedCount++
	}

	return replayBatchID, replayedCount, nil
}

// Get 查询指定死信记录，供测试断言复用。
func (s *DeadLetterStore) Get(deadLetterID string) (DeadLetterRecord, bool) {
	if s.backend != nil {
		return s.getFromDB(context.Background(), deadLetterID)
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	record, ok := s.items[deadLetterID]
	return record, ok
}

// Count 返回当前死信数量，供测试断言。
func (s *DeadLetterStore) Count() int {
	if s.backend != nil {
		return s.countFromDB(context.Background())
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.items)
}

// DeadLetterHandler 实现死信查询与重放接口。
type DeadLetterHandler struct {
	store *DeadLetterStore
}

// NewDeadLetterHandler 创建死信处理器。
func NewDeadLetterHandler(store *DeadLetterStore) *DeadLetterHandler {
	return &DeadLetterHandler{store: store}
}

// RegisterDeadLetterRoutes 注册 6.6 所需路由。
func RegisterDeadLetterRoutes(router gin.IRouter, store *DeadLetterStore) {
	handler := NewDeadLetterHandler(store)
	router.GET("/api/v1/ingest/dead-letters", handler.ListDeadLetters)
	router.POST("/api/v1/ingest/dead-letters/replay", handler.ReplayDeadLetters)
}

// ListDeadLetters 处理 GET /api/v1/ingest/dead-letters。
func (h *DeadLetterHandler) ListDeadLetters(c *gin.Context) {
	query, err := parseListDeadLettersQuery(c)
	if err != nil {
		writeError(c, http.StatusBadRequest, ErrorCodeDeadLetterInvalidArgument, sanitizeIngestValidationError(err, "invalid query parameters"), gin.H{"field": "query"})
		return
	}

	items, total := h.store.List(query.SourceRef, query.PackageID, query.Replayed, query.Page, query.PageSize)
	writeSuccess(c, http.StatusOK, gin.H{"items": items}, buildPaginationMeta(query.Page, query.PageSize, total))
}

// ReplayDeadLetters 处理 POST /api/v1/ingest/dead-letters/replay。
func (h *DeadLetterHandler) ReplayDeadLetters(c *gin.Context) {
	var req DeadLetterReplayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, ErrorCodeDeadLetterInvalidArgument, "invalid request body", nil)
		return
	}

	normalized, err := normalizeDeadLetterReplayRequest(req)
	if err != nil {
		writeError(c, http.StatusBadRequest, ErrorCodeDeadLetterInvalidArgument, sanitizeIngestValidationError(err, "invalid replay payload"), nil)
		return
	}

	replayBatchID, replayedCount, err := h.store.Replay(normalized.DeadLetterIDs, normalized.Reason)
	if err != nil {
		writeError(c, http.StatusInternalServerError, ErrorCodeDeadLetterInternalError, "failed to replay dead letters", nil)
		return
	}
	if replayedCount == 0 {
		writeError(c, http.StatusNotFound, ErrorCodeDeadLetterNotFound, "dead letters not found", nil)
		return
	}

	writeSuccess(c, http.StatusOK, gin.H{
		"replay_batch_id": replayBatchID,
		"replayed_count":  replayedCount,
	}, gin.H{})
}

func parseListDeadLettersQuery(c *gin.Context) (listDeadLettersQuery, error) {
	page, err := parsePositiveInt(c.Query("page"), 1)
	if err != nil {
		return listDeadLettersQuery{}, fmt.Errorf("page must be a positive integer")
	}
	pageSize, err := parsePositiveInt(c.Query("page_size"), 20)
	if err != nil {
		return listDeadLettersQuery{}, fmt.Errorf("page_size must be a positive integer")
	}
	if pageSize > 200 {
		pageSize = 200
	}

	sourceRef := strings.TrimSpace(c.Query("source_ref"))
	packageID := strings.TrimSpace(c.Query("package_id"))
	replayed := strings.ToLower(strings.TrimSpace(c.Query("replayed")))
	if replayed != "" && !isAllowedDeadLetterReplayedFilter(replayed) {
		return listDeadLettersQuery{}, fmt.Errorf("replayed must be one of yes|no")
	}

	return listDeadLettersQuery{
		SourceRef: sourceRef,
		PackageID: packageID,
		Replayed:  replayed,
		Page:      page,
		PageSize:  pageSize,
	}, nil
}

func isAllowedDeadLetterReplayedFilter(replayed string) bool {
	_, ok := allowedDeadLetterReplayedFilters[replayed]
	return ok
}

func matchesDeadLetterReplayedFilter(item DeadLetterRecord, replayed string) bool {
	switch replayed {
	case "yes":
		return item.ReplayedAt != nil
	case "no":
		return item.ReplayedAt == nil
	default:
		return true
	}
}

// normalizeDeadLetterReplayRequest 校验并规范化重放请求。
func normalizeDeadLetterReplayRequest(req DeadLetterReplayRequest) (DeadLetterReplayRequest, error) {
	normalized := DeadLetterReplayRequest{
		DeadLetterIDs: make([]string, 0, len(req.DeadLetterIDs)),
		Reason:        strings.TrimSpace(req.Reason),
	}
	for _, id := range req.DeadLetterIDs {
		trimmed := strings.TrimSpace(id)
		if trimmed == "" {
			continue
		}
		normalized.DeadLetterIDs = append(normalized.DeadLetterIDs, trimmed)
	}
	if len(normalized.DeadLetterIDs) == 0 {
		return DeadLetterReplayRequest{}, fmt.Errorf("dead_letter_ids is required")
	}
	if normalized.Reason == "" {
		return DeadLetterReplayRequest{}, fmt.Errorf("reason is required")
	}
	return normalized, nil
}

package ingest

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	// ErrorCodeRequestInvalidParams 对齐 12 文档：请求参数校验失败。
	ErrorCodeRequestInvalidParams = "REQ_INVALID_PARAMS"
	// ErrorCodeResourceNotFound 对齐 12 文档：资源不存在。
	ErrorCodeResourceNotFound = "RES_NOT_FOUND"
	// ErrorCodeResourceConflict 对齐 12 文档：资源/状态冲突。
	ErrorCodeResourceConflict = "RES_CONFLICT"
	// ErrorCodeInternalError 对齐 12 文档：未分类内部异常。
	ErrorCodeInternalError = "INTERNAL_ERROR"

	// ErrorCodePullSourceInvalidArgument 表示请求参数非法。
	ErrorCodePullSourceInvalidArgument = ErrorCodeRequestInvalidParams
	// ErrorCodePullSourceNotFound 表示待更新的拉取源不存在。
	ErrorCodePullSourceNotFound = ErrorCodeResourceNotFound
	// ErrorCodePullSourceNameConflict 表示同名拉取源冲突。
	ErrorCodePullSourceNameConflict = ErrorCodeResourceConflict
	// ErrorCodePullSourceInternalError 表示服务内部异常。
	ErrorCodePullSourceInternalError = ErrorCodeInternalError
)

var (
	// allowedProtocols 对齐迁移 000013 中 protocol 约束。
	allowedProtocols = map[string]struct{}{
		"ssh":        {},
		"sftp":       {},
		"syslog_tcp": {},
		"syslog_udp": {},
		"http":       {},
		"https":      {},
		"tcp":        {},
	}
	// allowedStatuses 对齐迁移 000013 中 status 约束。
	allowedStatuses = map[string]struct{}{
		"active":   {},
		"paused":   {},
		"disabled": {},
	}

	// ErrPullSourceNotFound 表示拉取源不存在。
	ErrPullSourceNotFound = errors.New("pull source not found")
	// ErrPullSourceNameConflict 表示拉取源名称冲突。
	ErrPullSourceNameConflict = errors.New("pull source name conflict")
)

// PullSource 定义 pull-sources 列表/详情响应骨架。
type PullSource struct {
	SourceID        string    `json:"source_id"`
	Name            string    `json:"name"`
	Host            string    `json:"host"`
	Port            int       `json:"port"`
	Protocol        string    `json:"protocol"`
	Path            string    `json:"path"`
	Auth            string    `json:"auth"`
	AgentBaseURL    string    `json:"agent_base_url,omitempty"`
	PullIntervalSec int       `json:"pull_interval_sec"`
	PullTimeoutSec  int       `json:"pull_timeout_sec"`
	KeyRef          string    `json:"key_ref,omitempty"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// CreatePullSourceRequest 定义创建请求字段。
type CreatePullSourceRequest struct {
	Name            string `json:"name"`
	Host            string `json:"host"`
	Port            int    `json:"port"`
	Protocol        string `json:"protocol"`
	Path            string `json:"path"`
	Auth            string `json:"auth"`
	AgentBaseURL    string `json:"agent_base_url"`
	PullIntervalSec int    `json:"pull_interval_sec"`
	PullTimeoutSec  int    `json:"pull_timeout_sec"`
	KeyRef          string `json:"key_ref"`
	Status          string `json:"status"`
}

// UpdatePullSourceRequest 定义更新请求字段（支持部分更新）。
type UpdatePullSourceRequest struct {
	SourceID        string  `json:"source_id"`
	Name            *string `json:"name"`
	Host            *string `json:"host"`
	Port            *int    `json:"port"`
	Protocol        *string `json:"protocol"`
	Path            *string `json:"path"`
	Auth            *string `json:"auth"`
	AgentBaseURL    *string `json:"agent_base_url"`
	PullIntervalSec *int    `json:"pull_interval_sec"`
	PullTimeoutSec  *int    `json:"pull_timeout_sec"`
	KeyRef          *string `json:"key_ref"`
	Status          *string `json:"status"`
}

// listPullSourcesQuery 定义列表分页与筛选参数。
type listPullSourcesQuery struct {
	Page     int
	PageSize int
	Status   string
}

// PullSourceStore 提供线程安全的内存存储，用于 6.1 最小可用闭环。
type PullSourceStore struct {
	mu      sync.RWMutex
	items   map[string]PullSource
	backend *PGBackend
}

// NewPullSourceStore 创建拉取源内存仓储。
func NewPullSourceStore() *PullSourceStore {
	return &PullSourceStore{
		items: make(map[string]PullSource),
	}
}

// NewPullSourceStoreWithPG 创建 PostgreSQL 仓储版本。
func NewPullSourceStoreWithPG(backend *PGBackend) *PullSourceStore {
	return &PullSourceStore{
		items:   make(map[string]PullSource),
		backend: backend,
	}
}

// List 按状态与分页返回拉取源列表。
func (s *PullSourceStore) List(status string, page, pageSize int) ([]PullSource, int) {
	if s.backend != nil {
		return s.listFromDB(context.Background(), status, page, pageSize)
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]PullSource, 0, len(s.items))
	for _, item := range s.items {
		if status != "" && item.Status != status {
			continue
		}
		result = append(result, item)
	}

	// 使用更新时间倒序，保证控制台列表默认展示最近变更。
	sort.Slice(result, func(i, j int) bool {
		return result[i].UpdatedAt.After(result[j].UpdatedAt)
	})

	total := len(result)
	start := (page - 1) * pageSize
	if start >= total {
		return []PullSource{}, total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	return result[start:end], total
}

// Exists 判断指定 source_id 是否存在。
func (s *PullSourceStore) Exists(sourceID string) bool {
	if s.backend != nil {
		return s.existsFromDB(context.Background(), sourceID)
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	_, ok := s.items[sourceID]
	return ok
}

// Create 创建新的拉取源，并校验名称唯一性。
func (s *PullSourceStore) Create(req CreatePullSourceRequest) (PullSource, error) {
	if s.backend != nil {
		return s.createFromDB(context.Background(), req)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for _, item := range s.items {
		if strings.EqualFold(item.Name, req.Name) {
			return PullSource{}, ErrPullSourceNameConflict
		}
	}

	now := time.Now().UTC()
	created := PullSource{
		SourceID:        newUUIDLike(),
		Name:            req.Name,
		Host:            req.Host,
		Port:            req.Port,
		Protocol:        req.Protocol,
		Path:            req.Path,
		Auth:            req.Auth,
		AgentBaseURL:    req.AgentBaseURL,
		PullIntervalSec: req.PullIntervalSec,
		PullTimeoutSec:  req.PullTimeoutSec,
		KeyRef:          req.KeyRef,
		Status:          req.Status,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	s.items[created.SourceID] = created
	return created, nil
}

// Update 更新已有拉取源，并返回更新后的实体。
func (s *PullSourceStore) Update(sourceID string, req UpdatePullSourceRequest) (PullSource, error) {
	if s.backend != nil {
		return s.updateFromDB(context.Background(), sourceID, req)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	current, ok := s.items[sourceID]
	if !ok {
		return PullSource{}, ErrPullSourceNotFound
	}

	if req.Name != nil {
		trimmed := strings.TrimSpace(*req.Name)
		for _, item := range s.items {
			if item.SourceID == sourceID {
				continue
			}
			if strings.EqualFold(item.Name, trimmed) {
				return PullSource{}, ErrPullSourceNameConflict
			}
		}
		current.Name = trimmed
	}
	if req.Host != nil {
		current.Host = strings.TrimSpace(*req.Host)
	}
	if req.Port != nil {
		current.Port = *req.Port
	}
	if req.Protocol != nil {
		current.Protocol = strings.ToLower(strings.TrimSpace(*req.Protocol))
	}
	if req.Path != nil {
		current.Path = strings.TrimSpace(*req.Path)
	}
	if req.Auth != nil {
		current.Auth = strings.TrimSpace(*req.Auth)
	}
	if req.AgentBaseURL != nil {
		current.AgentBaseURL = strings.TrimSpace(*req.AgentBaseURL)
	}
	if req.PullIntervalSec != nil {
		current.PullIntervalSec = *req.PullIntervalSec
	}
	if req.PullTimeoutSec != nil {
		current.PullTimeoutSec = *req.PullTimeoutSec
	}
	if req.KeyRef != nil {
		current.KeyRef = strings.TrimSpace(*req.KeyRef)
	}
	if req.Status != nil {
		current.Status = strings.ToLower(strings.TrimSpace(*req.Status))
	}

	current.UpdatedAt = time.Now().UTC()
	s.items[sourceID] = current
	return current, nil
}

// GetByID 按 source_id 查询拉取源。
func (s *PullSourceStore) GetByID(sourceID string) (PullSource, bool) {
	if s.backend != nil {
		return s.getByIDFromDB(context.Background(), sourceID)
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	item, ok := s.items[sourceID]
	return item, ok
}

// PullSourceHandler 实现 pull-sources HTTP 处理逻辑。
type PullSourceHandler struct {
	store *PullSourceStore
}

// NewPullSourceHandler 创建 pull-sources 处理器。
func NewPullSourceHandler(store *PullSourceStore) *PullSourceHandler {
	return &PullSourceHandler{store: store}
}

// RegisterPullSourceRoutes 注册 6.1 所需的 GET/POST/PUT 路由。
func RegisterPullSourceRoutes(router gin.IRouter, store *PullSourceStore) {
	handler := NewPullSourceHandler(store)
	router.GET("/api/v1/ingest/pull-sources", handler.ListPullSources)
	router.POST("/api/v1/ingest/pull-sources", handler.CreatePullSource)
	// 同时支持路径参数形式（接口设计文档）和 body 带 source_id 形式（任务描述简写）。
	router.PUT("/api/v1/ingest/pull-sources/:source_id", handler.UpdatePullSourceByPath)
	router.PUT("/api/v1/ingest/pull-sources", handler.UpdatePullSourceByBody)
}

// ListPullSources 处理 GET /api/v1/ingest/pull-sources。
func (h *PullSourceHandler) ListPullSources(c *gin.Context) {
	query, err := parseListPullSourcesQuery(c)
	if err != nil {
		writeError(c, http.StatusBadRequest, ErrorCodePullSourceInvalidArgument, err.Error(), gin.H{"field": "query"})
		return
	}

	items, total := h.store.List(query.Status, query.Page, query.PageSize)
	writeSuccess(c, http.StatusOK, gin.H{"items": items}, buildPaginationMeta(query.Page, query.PageSize, total))
}

// CreatePullSource 处理 POST /api/v1/ingest/pull-sources。
func (h *PullSourceHandler) CreatePullSource(c *gin.Context) {
	var req CreatePullSourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, ErrorCodePullSourceInvalidArgument, "invalid request body", gin.H{"error": err.Error()})
		return
	}

	normalized, err := normalizeCreatePullSourceRequest(req)
	if err != nil {
		writeError(c, http.StatusBadRequest, ErrorCodePullSourceInvalidArgument, err.Error(), nil)
		return
	}

	created, err := h.store.Create(normalized)
	if err != nil {
		if errors.Is(err, ErrPullSourceNameConflict) {
			writeError(c, http.StatusConflict, ErrorCodePullSourceNameConflict, "pull source name already exists", nil)
			return
		}
		writeError(c, http.StatusInternalServerError, ErrorCodePullSourceInternalError, "failed to create pull source", nil)
		return
	}

	writeSuccess(c, http.StatusCreated, gin.H{
		"source_id": created.SourceID,
		"status":    created.Status,
	}, gin.H{})
}

// UpdatePullSourceByPath 处理 PUT /api/v1/ingest/pull-sources/:source_id。
func (h *PullSourceHandler) UpdatePullSourceByPath(c *gin.Context) {
	sourceID := strings.TrimSpace(c.Param("source_id"))
	if sourceID == "" {
		writeError(c, http.StatusBadRequest, ErrorCodePullSourceInvalidArgument, "source_id is required", nil)
		return
	}
	h.updatePullSource(c, sourceID)
}

// UpdatePullSourceByBody 处理 PUT /api/v1/ingest/pull-sources（body 含 source_id）。
func (h *PullSourceHandler) UpdatePullSourceByBody(c *gin.Context) {
	var req UpdatePullSourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, ErrorCodePullSourceInvalidArgument, "invalid request body", gin.H{"error": err.Error()})
		return
	}
	sourceID := strings.TrimSpace(req.SourceID)
	if sourceID == "" {
		writeError(c, http.StatusBadRequest, ErrorCodePullSourceInvalidArgument, "source_id is required", nil)
		return
	}
	h.updatePullSourceWithRequest(c, sourceID, req)
}

// updatePullSource 负责从 body 读取请求后执行更新。
func (h *PullSourceHandler) updatePullSource(c *gin.Context, sourceID string) {
	var req UpdatePullSourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, ErrorCodePullSourceInvalidArgument, "invalid request body", gin.H{"error": err.Error()})
		return
	}
	h.updatePullSourceWithRequest(c, sourceID, req)
}

// updatePullSourceWithRequest 负责校验并执行拉取源更新。
func (h *PullSourceHandler) updatePullSourceWithRequest(c *gin.Context, sourceID string, req UpdatePullSourceRequest) {
	normalized, err := normalizeUpdatePullSourceRequest(req)
	if err != nil {
		writeError(c, http.StatusBadRequest, ErrorCodePullSourceInvalidArgument, err.Error(), nil)
		return
	}

	_, err = h.store.Update(sourceID, normalized)
	if err != nil {
		switch {
		case errors.Is(err, ErrPullSourceNotFound):
			writeError(c, http.StatusNotFound, ErrorCodePullSourceNotFound, "pull source not found", nil)
		case errors.Is(err, ErrPullSourceNameConflict):
			writeError(c, http.StatusConflict, ErrorCodePullSourceNameConflict, "pull source name already exists", nil)
		default:
			writeError(c, http.StatusInternalServerError, ErrorCodePullSourceInternalError, "failed to update pull source", nil)
		}
		return
	}

	writeSuccess(c, http.StatusOK, gin.H{"updated": true}, gin.H{})
}

// parseListPullSourcesQuery 解析并校验分页、筛选参数。
func parseListPullSourcesQuery(c *gin.Context) (listPullSourcesQuery, error) {
	page, err := parsePositiveInt(c.Query("page"), 1)
	if err != nil {
		return listPullSourcesQuery{}, fmt.Errorf("page must be a positive integer")
	}
	pageSize, err := parsePositiveInt(c.Query("page_size"), 20)
	if err != nil {
		return listPullSourcesQuery{}, fmt.Errorf("page_size must be a positive integer")
	}
	if pageSize > 200 {
		pageSize = 200
	}

	status := strings.ToLower(strings.TrimSpace(c.Query("status")))
	if status != "" && !isAllowedStatus(status) {
		return listPullSourcesQuery{}, fmt.Errorf("status must be one of active|paused|disabled")
	}

	return listPullSourcesQuery{
		Page:     page,
		PageSize: pageSize,
		Status:   status,
	}, nil
}

// normalizeCreatePullSourceRequest 校验并规范化创建请求。
func normalizeCreatePullSourceRequest(req CreatePullSourceRequest) (CreatePullSourceRequest, error) {
	normalized := CreatePullSourceRequest{
		Name:            strings.TrimSpace(req.Name),
		Host:            strings.TrimSpace(req.Host),
		Port:            req.Port,
		Protocol:        strings.ToLower(strings.TrimSpace(req.Protocol)),
		Path:            strings.TrimSpace(req.Path),
		Auth:            strings.TrimSpace(req.Auth),
		AgentBaseURL:    strings.TrimSpace(req.AgentBaseURL),
		PullIntervalSec: req.PullIntervalSec,
		PullTimeoutSec:  req.PullTimeoutSec,
		KeyRef:          strings.TrimSpace(req.KeyRef),
		Status:          strings.ToLower(strings.TrimSpace(req.Status)),
	}

	if normalized.Name == "" {
		return CreatePullSourceRequest{}, fmt.Errorf("name is required")
	}
	if normalized.Host == "" {
		return CreatePullSourceRequest{}, fmt.Errorf("host is required")
	}
	if normalized.Port <= 0 || normalized.Port > 65535 {
		return CreatePullSourceRequest{}, fmt.Errorf("port must be between 1 and 65535")
	}
	if !isAllowedProtocol(normalized.Protocol) {
		return CreatePullSourceRequest{}, fmt.Errorf("protocol must be one of ssh|sftp|syslog_tcp|syslog_udp|http|https|tcp")
	}
	if normalized.Status == "" {
		normalized.Status = "active"
	}
	if !isAllowedStatus(normalized.Status) {
		return CreatePullSourceRequest{}, fmt.Errorf("status must be one of active|paused|disabled")
	}
	if normalized.PullIntervalSec <= 0 {
		normalized.PullIntervalSec = 30
	}
	if normalized.PullTimeoutSec <= 0 {
		normalized.PullTimeoutSec = 30
	}
	if normalized.AgentBaseURL == "" {
		scheme := "http"
		if normalized.Protocol == "https" {
			scheme = "https"
		}
		normalized.AgentBaseURL = fmt.Sprintf("%s://%s:%d", scheme, normalized.Host, normalized.Port)
	}
	return normalized, nil
}

// normalizeUpdatePullSourceRequest 校验并规范化更新请求。
func normalizeUpdatePullSourceRequest(req UpdatePullSourceRequest) (UpdatePullSourceRequest, error) {
	if req.Name == nil &&
		req.Host == nil &&
		req.Port == nil &&
		req.Protocol == nil &&
		req.Path == nil &&
		req.Auth == nil &&
		req.AgentBaseURL == nil &&
		req.PullIntervalSec == nil &&
		req.PullTimeoutSec == nil &&
		req.KeyRef == nil &&
		req.Status == nil {
		return UpdatePullSourceRequest{}, fmt.Errorf("at least one field is required")
	}

	normalized := UpdatePullSourceRequest{}
	if req.Name != nil {
		trimmed := strings.TrimSpace(*req.Name)
		if trimmed == "" {
			return UpdatePullSourceRequest{}, fmt.Errorf("name cannot be empty")
		}
		normalized.Name = &trimmed
	}
	if req.Host != nil {
		trimmed := strings.TrimSpace(*req.Host)
		if trimmed == "" {
			return UpdatePullSourceRequest{}, fmt.Errorf("host cannot be empty")
		}
		normalized.Host = &trimmed
	}
	if req.Port != nil {
		if *req.Port <= 0 || *req.Port > 65535 {
			return UpdatePullSourceRequest{}, fmt.Errorf("port must be between 1 and 65535")
		}
		normalized.Port = req.Port
	}
	if req.Protocol != nil {
		trimmed := strings.ToLower(strings.TrimSpace(*req.Protocol))
		if !isAllowedProtocol(trimmed) {
			return UpdatePullSourceRequest{}, fmt.Errorf("protocol must be one of ssh|sftp|syslog_tcp|syslog_udp|http|https|tcp")
		}
		normalized.Protocol = &trimmed
	}
	if req.Path != nil {
		trimmed := strings.TrimSpace(*req.Path)
		normalized.Path = &trimmed
	}
	if req.Auth != nil {
		trimmed := strings.TrimSpace(*req.Auth)
		normalized.Auth = &trimmed
	}
	if req.AgentBaseURL != nil {
		trimmed := strings.TrimSpace(*req.AgentBaseURL)
		normalized.AgentBaseURL = &trimmed
	}
	if req.PullIntervalSec != nil {
		if *req.PullIntervalSec <= 0 {
			return UpdatePullSourceRequest{}, fmt.Errorf("pull_interval_sec must be > 0")
		}
		normalized.PullIntervalSec = req.PullIntervalSec
	}
	if req.PullTimeoutSec != nil {
		if *req.PullTimeoutSec <= 0 {
			return UpdatePullSourceRequest{}, fmt.Errorf("pull_timeout_sec must be > 0")
		}
		normalized.PullTimeoutSec = req.PullTimeoutSec
	}
	if req.KeyRef != nil {
		trimmed := strings.TrimSpace(*req.KeyRef)
		normalized.KeyRef = &trimmed
	}
	if req.Status != nil {
		trimmed := strings.ToLower(strings.TrimSpace(*req.Status))
		if !isAllowedStatus(trimmed) {
			return UpdatePullSourceRequest{}, fmt.Errorf("status must be one of active|paused|disabled")
		}
		normalized.Status = &trimmed
	}
	return normalized, nil
}

func toNullableString(raw string) sql.NullString {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: trimmed, Valid: true}
}

// parsePositiveInt 解析正整数；空值返回默认值。
func parsePositiveInt(raw string, fallback int) (int, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return fallback, nil
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v <= 0 {
		return 0, fmt.Errorf("invalid positive integer")
	}
	return v, nil
}

// buildPaginationMeta 构造分页元信息并补齐 has_next，统一对齐 12 文档规范。
func buildPaginationMeta(page, pageSize, total int) gin.H {
	return gin.H{
		"page":      page,
		"page_size": pageSize,
		"total":     total,
		"has_next":  page*pageSize < total,
	}
}

// isAllowedProtocol 判断协议是否在白名单内。
func isAllowedProtocol(protocol string) bool {
	_, ok := allowedProtocols[protocol]
	return ok
}

// isAllowedStatus 判断状态是否在白名单内。
func isAllowedStatus(status string) bool {
	_, ok := allowedStatuses[status]
	return ok
}

// writeSuccess 输出统一成功响应结构。
func writeSuccess(c *gin.Context, status int, data any, meta gin.H) {
	if meta == nil {
		meta = gin.H{}
	}
	c.JSON(status, gin.H{
		"code":       "OK",
		"message":    "success",
		"request_id": requestID(c),
		"data":       data,
		"meta":       meta,
	})
}

// writeError 输出统一错误响应结构。
func writeError(c *gin.Context, status int, code, message string, details any) {
	if code == "" {
		code = ErrorCodePullSourceInternalError
	}
	if message == "" {
		message = "internal error"
	}
	c.JSON(status, gin.H{
		"code":       code,
		"message":    message,
		"request_id": requestID(c),
		"details":    details,
	})
}

// requestID 读取或生成请求追踪 ID。
func requestID(c *gin.Context) string {
	if existing := strings.TrimSpace(c.GetHeader("X-Request-ID")); existing != "" {
		c.Header("X-Request-ID", existing)
		return existing
	}

	generated := fmt.Sprintf("cp-%d-%s", time.Now().Unix(), shortRandomHex(6))
	c.Header("X-Request-ID", generated)
	return generated
}

// newUUIDLike 生成 UUID 形态的随机 ID，避免新增第三方依赖。
func newUUIDLike() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("src-%d", time.Now().UnixNano())
	}
	// 按 RFC4122 设置版本与变体位，便于后续无缝替换真实 UUID。
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// shortRandomHex 生成固定长度随机十六进制字符串。
func shortRandomHex(n int) string {
	if n <= 0 {
		return ""
	}
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return strconv.FormatInt(time.Now().UnixNano(), 16)
	}
	return hex.EncodeToString(buf)
}

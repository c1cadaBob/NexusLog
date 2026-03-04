// Package handler 提供 query-api 的 HTTP 请求处理逻辑。
package handler

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nexuslog/data-services/query-api/internal/repository"
	"github.com/nexuslog/data-services/query-api/internal/service"
)

const (
	// CodeOK 表示请求成功。
	CodeOK = "OK"
	// CodeQueryInvalidParams 表示查询参数非法。
	CodeQueryInvalidParams = "QUERY_INVALID_PARAMS"
	// CodeQueryInternalError 表示查询服务内部异常。
	CodeQueryInternalError = "QUERY_INTERNAL_ERROR"
	// CodeQueryUnauthorized 表示鉴权上下文缺失。
	CodeQueryUnauthorized = "QUERY_UNAUTHORIZED"
	// CodeQueryNotFound 表示资源不存在。
	CodeQueryNotFound = "QUERY_NOT_FOUND"
	// CodeQueryConflict 表示资源冲突。
	CodeQueryConflict = "QUERY_CONFLICT"
	// CodeQueryServiceUnavailable 表示依赖不可用。
	CodeQueryServiceUnavailable = "QUERY_SERVICE_UNAVAILABLE"
)

var uuidPattern = regexp.MustCompile(`^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$`)

// QueryHandler 封装 query-api 的 HTTP 处理逻辑。
type QueryHandler struct {
	svc *service.QueryService
}

// NewQueryHandler 创建 QueryHandler 实例。
func NewQueryHandler(svc *service.QueryService) *QueryHandler {
	return &QueryHandler{svc: svc}
}

// SearchLogs 处理 POST /api/v1/query/logs。
func (h *QueryHandler) SearchLogs(c *gin.Context) {
	var req service.SearchLogsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, CodeQueryInvalidParams, "invalid request body")
		return
	}

	// 统一兜底，避免调用方未传分页时造成大查询。
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = service.DefaultPageSize
	}

	result, err := h.svc.SearchLogs(c.Request.Context(), resolveActor(c), req)
	if err != nil {
		writeServiceError(c, err)
		return
	}

	writeSuccess(c, http.StatusOK, gin.H{
		"hits":         result.Hits,
		"aggregations": result.Aggregations,
	}, gin.H{
		"page":          result.Page,
		"page_size":     result.PageSize,
		"total":         result.Total,
		"has_next":      int64(result.Page*result.PageSize) < result.Total,
		"query_time_ms": result.QueryTimeMS,
		"timed_out":     result.TimedOut,
	})
}

// ListQueryHistories 处理 GET /api/v1/query/history。
func (h *QueryHandler) ListQueryHistories(c *gin.Context) {
	page := parsePositiveInt(c.Query("page"), 1)
	pageSize := parsePositiveInt(c.Query("page_size"), service.DefaultPageSize)
	req := service.ListQueryHistoriesRequest{
		Keyword: c.Query("keyword"),
		TimeRange: service.TimeRange{
			From: c.Query("from"),
			To:   c.Query("to"),
		},
		Page:     page,
		PageSize: pageSize,
	}

	result, err := h.svc.ListQueryHistories(c.Request.Context(), resolveActor(c), req)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	writeSuccess(c, http.StatusOK, gin.H{
		"items": result.Items,
	}, gin.H{
		"page":      result.Page,
		"page_size": result.PageSize,
		"total":     result.Total,
		"has_next":  int64(result.Page*result.PageSize) < result.Total,
	})
}

// DeleteQueryHistory 处理 DELETE /api/v1/query/history/:history_id。
func (h *QueryHandler) DeleteQueryHistory(c *gin.Context) {
	historyID := strings.TrimSpace(c.Param("history_id"))
	if historyID == "" {
		writeError(c, http.StatusBadRequest, CodeQueryInvalidParams, "history_id is required")
		return
	}
	deleted, err := h.svc.DeleteQueryHistory(c.Request.Context(), resolveActor(c), historyID)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	if !deleted {
		writeError(c, http.StatusNotFound, CodeQueryNotFound, "query history not found")
		return
	}
	writeSuccess(c, http.StatusOK, gin.H{
		"deleted": true,
	}, gin.H{})
}

// ListSavedQueries 处理 GET /api/v1/query/saved。
func (h *QueryHandler) ListSavedQueries(c *gin.Context) {
	page := parsePositiveInt(c.Query("page"), 1)
	pageSize := parsePositiveInt(c.Query("page_size"), service.DefaultPageSize)
	req := service.ListSavedQueriesRequest{
		Tag:      c.Query("tag"),
		Keyword:  c.Query("keyword"),
		Page:     page,
		PageSize: pageSize,
	}

	result, err := h.svc.ListSavedQueries(c.Request.Context(), resolveActor(c), req)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	writeSuccess(c, http.StatusOK, gin.H{
		"items": result.Items,
	}, gin.H{
		"page":      result.Page,
		"page_size": result.PageSize,
		"total":     result.Total,
		"has_next":  int64(result.Page*result.PageSize) < result.Total,
	})
}

// CreateSavedQuery 处理 POST /api/v1/query/saved。
func (h *QueryHandler) CreateSavedQuery(c *gin.Context) {
	var req service.UpsertSavedQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, CodeQueryInvalidParams, "invalid request body")
		return
	}

	item, err := h.svc.CreateSavedQuery(c.Request.Context(), resolveActor(c), req)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	writeSuccess(c, http.StatusCreated, gin.H{
		"saved_query_id": item.ID,
		"item":           item,
	}, gin.H{})
}

// UpdateSavedQuery 处理 PUT /api/v1/query/saved/:saved_query_id。
func (h *QueryHandler) UpdateSavedQuery(c *gin.Context) {
	savedQueryID := strings.TrimSpace(c.Param("saved_query_id"))
	if savedQueryID == "" {
		writeError(c, http.StatusBadRequest, CodeQueryInvalidParams, "saved_query_id is required")
		return
	}

	var req service.UpsertSavedQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, CodeQueryInvalidParams, "invalid request body")
		return
	}

	item, err := h.svc.UpdateSavedQuery(c.Request.Context(), resolveActor(c), savedQueryID, req)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	writeSuccess(c, http.StatusOK, gin.H{
		"updated": true,
		"item":    item,
	}, gin.H{})
}

// DeleteSavedQuery 处理 DELETE /api/v1/query/saved/:saved_query_id。
func (h *QueryHandler) DeleteSavedQuery(c *gin.Context) {
	savedQueryID := strings.TrimSpace(c.Param("saved_query_id"))
	if savedQueryID == "" {
		writeError(c, http.StatusBadRequest, CodeQueryInvalidParams, "saved_query_id is required")
		return
	}

	deleted, err := h.svc.DeleteSavedQuery(c.Request.Context(), resolveActor(c), savedQueryID)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	if !deleted {
		writeError(c, http.StatusNotFound, CodeQueryNotFound, "saved query not found")
		return
	}
	writeSuccess(c, http.StatusOK, gin.H{
		"deleted": true,
	}, gin.H{})
}

func writeSuccess(c *gin.Context, status int, data any, meta any) {
	c.JSON(status, gin.H{
		"code":       CodeOK,
		"message":    "success",
		"request_id": resolveRequestID(c),
		"data":       data,
		"meta":       meta,
	})
}

func writeError(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{
		"code":       code,
		"message":    message,
		"request_id": resolveRequestID(c),
		"data":       gin.H{},
		"meta":       gin.H{},
	})
}

func writeServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrUserContextRequired):
		writeError(c, http.StatusUnauthorized, CodeQueryUnauthorized, "user context is required")
	case errors.Is(err, service.ErrInvalidSavedQuery):
		writeError(c, http.StatusBadRequest, CodeQueryInvalidParams, "invalid saved query payload")
	case errors.Is(err, service.ErrMetadataNotConfigured),
		errors.Is(err, repository.ErrMetadataStoreNotConfigured):
		writeError(c, http.StatusServiceUnavailable, CodeQueryServiceUnavailable, "query metadata store is unavailable")
	case errors.Is(err, repository.ErrNotFound):
		writeError(c, http.StatusNotFound, CodeQueryNotFound, "resource not found")
	case errors.Is(err, repository.ErrConflict):
		writeError(c, http.StatusConflict, CodeQueryConflict, "resource conflict")
	default:
		writeError(c, http.StatusInternalServerError, CodeQueryInternalError, err.Error())
	}
}

func resolveActor(c *gin.Context) service.RequestActor {
	claims := resolveJWTClaims(c.GetHeader("Authorization"))
	tenantID := firstNonEmptyUUID(
		c.GetHeader("X-Tenant-ID"),
		claimString(claims, "tenant_id"),
		claimString(claims, "tid"),
	)
	userID := firstNonEmptyUUID(
		c.GetHeader("X-User-ID"),
		claimString(claims, "user_id"),
		claimString(claims, "sub"),
		claimString(claims, "uid"),
	)
	return service.RequestActor{
		TenantID: tenantID,
		UserID:   userID,
	}
}

func resolveJWTClaims(authorization string) map[string]any {
	token := extractBearerToken(authorization)
	if token == "" {
		return map[string]any{}
	}
	parts := strings.Split(token, ".")
	if len(parts) < 2 {
		return map[string]any{}
	}
	payloadRaw, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return map[string]any{}
	}
	var claims map[string]any
	if err := json.Unmarshal(payloadRaw, &claims); err != nil {
		return map[string]any{}
	}
	return claims
}

func extractBearerToken(authorization string) string {
	raw := strings.TrimSpace(authorization)
	if raw == "" {
		return ""
	}
	const prefix = "bearer "
	if len(raw) < len(prefix) || strings.ToLower(raw[:len(prefix)]) != prefix {
		return ""
	}
	return strings.TrimSpace(raw[len(prefix):])
}

func claimString(claims map[string]any, key string) string {
	if len(claims) == 0 {
		return ""
	}
	value, ok := claims[key]
	if !ok || value == nil {
		return ""
	}
	text := strings.TrimSpace(fmt.Sprintf("%v", value))
	if text == "" || text == "<nil>" {
		return ""
	}
	return text
}

func firstNonEmptyUUID(values ...string) string {
	for _, raw := range values {
		value := strings.TrimSpace(raw)
		if value == "" {
			continue
		}
		if !uuidPattern.MatchString(value) {
			continue
		}
		return strings.ToLower(value)
	}
	return ""
}

func parsePositiveInt(raw string, fallback int) int {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func resolveRequestID(c *gin.Context) string {
	requestID := strings.TrimSpace(c.GetHeader("X-Request-ID"))
	if requestID != "" {
		return requestID
	}
	return "query-" + time.Now().UTC().Format("20060102150405") + "-" + randomHex(4)
}

func randomHex(length int) string {
	if length <= 0 {
		length = 4
	}
	buf := make([]byte, length)
	if _, err := rand.Read(buf); err != nil {
		return "00000000"
	}
	return hex.EncodeToString(buf)
}

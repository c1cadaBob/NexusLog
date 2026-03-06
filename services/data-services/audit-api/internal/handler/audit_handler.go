// Package handler 提供 audit-api 的 HTTP 请求处理逻辑
package handler

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nexuslog/data-services/audit-api/internal/service"
)

const (
	CodeOK                  = "OK"
	CodeAuditInvalidParams  = "AUDIT_INVALID_PARAMS"
	CodeAuditInternalError  = "AUDIT_INTERNAL_ERROR"
	CodeAuditUnauthorized   = "AUDIT_UNAUTHORIZED"
	CodeAuditServiceUnavailable = "AUDIT_SERVICE_UNAVAILABLE"
)

const defaultTenantID = "00000000-0000-0000-0000-000000000001"

// AuditHandler 封装 audit-api 的 HTTP 处理逻辑
type AuditHandler struct {
	svc *service.AuditService
}

// NewAuditHandler 创建 AuditHandler 实例
func NewAuditHandler(svc *service.AuditService) *AuditHandler {
	return &AuditHandler{svc: svc}
}

// ListAuditLogs 处理 GET /api/v1/audit/logs
func (h *AuditHandler) ListAuditLogs(c *gin.Context) {
	actor := resolveActor(c)
	req := service.ListAuditLogsRequest{
		UserID:       c.Query("user_id"),
		Action:       c.Query("action"),
		ResourceType: c.Query("resource_type"),
		From:         c.Query("from"),
		To:           c.Query("to"),
		Page:         parsePositiveInt(c.Query("page"), 1),
		PageSize:     parsePositiveInt(c.Query("page_size"), 20),
		SortBy:       c.Query("sort_by"),
		SortOrder:    c.Query("sort_order"),
	}
	result, err := h.svc.ListAuditLogs(c.Request.Context(), actor.TenantID, req)
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
	errStr := err.Error()
	switch {
	case strings.Contains(errStr, "tenant_id is required"):
		writeError(c, http.StatusUnauthorized, CodeAuditUnauthorized, "tenant context is required")
	case strings.Contains(errStr, "not configured"):
		writeError(c, http.StatusServiceUnavailable, CodeAuditServiceUnavailable, "audit service is unavailable")
	default:
		writeError(c, http.StatusInternalServerError, CodeAuditInternalError, errStr)
	}
}

type requestActor struct {
	TenantID string
}

func resolveActor(c *gin.Context) requestActor {
	tenantID := firstNonEmpty(
		c.GetHeader("X-Tenant-ID"),
		c.GetHeader("X-Tenant-Id"),
	)
	if tenantID == "" {
		tenantID = defaultTenantID
	}
	return requestActor{TenantID: tenantID}
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if s := strings.TrimSpace(v); s != "" {
			return s
		}
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
	return "audit-" + time.Now().UTC().Format("20060102150405") + "-" + randomHex(4)
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

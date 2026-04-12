// Package handler 提供 audit-api 的 HTTP 请求处理逻辑
package handler

import (
	"bytes"
	"crypto/rand"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nexuslog/data-services/audit-api/internal/service"
	sharedauth "github.com/nexuslog/data-services/shared/auth"
)

const (
	CodeOK                      = "OK"
	CodeAuditInvalidParams      = "AUDIT_INVALID_PARAMS"
	CodeAuditInternalError      = "AUDIT_INTERNAL_ERROR"
	CodeAuditUnauthorized       = "AUDIT_UNAUTHORIZED"
	CodeAuditServiceUnavailable = "AUDIT_SERVICE_UNAVAILABLE"
)

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
	result, err := h.svc.ListAuditLogs(c.Request.Context(), actor, req)
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

// ExportAuditLogs 处理 GET /api/v1/audit/logs/export
func (h *AuditHandler) ExportAuditLogs(c *gin.Context) {
	actor := resolveActor(c)
	result, err := h.svc.ExportAuditLogs(c.Request.Context(), actor, service.ExportAuditLogsRequest{
		UserID:       c.Query("user_id"),
		Action:       c.Query("action"),
		ResourceType: c.Query("resource_type"),
		From:         c.Query("from"),
		To:           c.Query("to"),
		SortBy:       c.Query("sort_by"),
		SortOrder:    c.Query("sort_order"),
		Format:       c.Query("format"),
	})
	if err != nil {
		writeServiceError(c, err)
		return
	}

	contentType := "text/csv; charset=utf-8"
	var body []byte
	if result.Format == "json" {
		contentType = "application/json; charset=utf-8"
		body, err = json.MarshalIndent(result.Items, "", "  ")
		if err != nil {
			writeError(c, http.StatusInternalServerError, CodeAuditInternalError, "failed to encode export payload")
			return
		}
	} else {
		body, err = buildAuditCSV(result.Items)
		if err != nil {
			writeError(c, http.StatusInternalServerError, CodeAuditInternalError, "failed to encode export payload")
			return
		}
	}

	c.Header("Content-Type", contentType)
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", result.FileName))
	c.Data(http.StatusOK, contentType, body)
}

func buildAuditCSV(items []service.AuditLogItem) ([]byte, error) {
	buf := bytes.NewBuffer(nil)
	writer := csv.NewWriter(buf)
	if err := writer.Write([]string{
		"id",
		"tenant_id",
		"user_id",
		"action",
		"resource_type",
		"resource_id",
		"ip_address",
		"user_agent",
		"created_at",
		"detail",
	}); err != nil {
		return nil, err
	}
	for _, item := range items {
		detailJSON, err := json.Marshal(item.Detail)
		if err != nil {
			return nil, err
		}
		if err := writer.Write([]string{
			item.ID,
			item.TenantID,
			item.UserID,
			item.Action,
			item.ResourceType,
			item.ResourceID,
			item.IPAddress,
			item.UserAgent,
			item.CreatedAt,
			string(detailJSON),
		}); err != nil {
			return nil, err
		}
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
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
	case errors.Is(err, sharedauth.ErrAuthorizedTenantSetRequired), strings.Contains(errStr, "tenant_id is required"):
		writeError(c, http.StatusUnauthorized, CodeAuditUnauthorized, "tenant context is required")
	case strings.Contains(errStr, "unsupported time format"), strings.Contains(errStr, "invalid export format"):
		writeError(c, http.StatusBadRequest, CodeAuditInvalidParams, "invalid request parameters")
	case strings.Contains(errStr, "not configured"):
		writeError(c, http.StatusServiceUnavailable, CodeAuditServiceUnavailable, "audit service is unavailable")
	default:
		writeError(c, http.StatusInternalServerError, CodeAuditInternalError, "internal error")
	}
}

func resolveActor(c *gin.Context) service.RequestActor {
	return service.RequestActor{
		TenantID:            sharedauth.AuthenticatedTenantID(c),
		TenantReadScope:     sharedauth.AuthenticatedTenantReadScope(c),
		AuthorizedTenantIDs: sharedauth.AuthenticatedAuthorizedTenantIDs(c),
	}
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

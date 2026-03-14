// Package handler 提供 export-api 的 HTTP 请求处理逻辑
package handler

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nexuslog/data-services/export-api/internal/repository"
	"github.com/nexuslog/data-services/export-api/internal/service"
)

const (
	CodeOK                    = "OK"
	CodeExportInvalidParams   = "EXPORT_INVALID_PARAMS"
	CodeExportInternalError   = "EXPORT_INTERNAL_ERROR"
	CodeExportNotFound        = "EXPORT_NOT_FOUND"
	CodeExportServiceUnavailable = "EXPORT_SERVICE_UNAVAILABLE"
)

// ExportHandler 封装 export-api 的 HTTP 处理逻辑
type ExportHandler struct {
	svc *service.ExportService
}

// NewExportHandler 创建 ExportHandler 实例
func NewExportHandler(svc *service.ExportService) *ExportHandler {
	return &ExportHandler{svc: svc}
}

// CreateExportJob 处理 POST /api/v1/export/jobs
func (h *ExportHandler) CreateExportJob(c *gin.Context) {
	var req service.CreateExportJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, CodeExportInvalidParams, "invalid request body")
		return
	}
	actor := resolveActor(c)
	if actor.TenantID == "" {
		writeError(c, http.StatusUnauthorized, CodeExportInvalidParams, "tenant context is required")
		return
	}
	jobID, err := h.svc.CreateExportJob(c.Request.Context(), actor.TenantID, actor.UserID, req)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	writeSuccess(c, http.StatusAccepted, gin.H{
		"job_id": jobID,
		"status": "pending",
	}, gin.H{})
}

// ListExportJobs 处理 GET /api/v1/export/jobs
func (h *ExportHandler) ListExportJobs(c *gin.Context) {
	page := parsePositiveInt(c.Query("page"), 1)
	pageSize := parsePositiveInt(c.Query("page_size"), 20)
	actor := resolveActor(c)
	if actor.TenantID == "" {
		writeError(c, http.StatusUnauthorized, CodeExportInvalidParams, "tenant context is required")
		return
	}
	result, err := h.svc.ListJobs(c.Request.Context(), actor.TenantID, page, pageSize)
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

// GetExportJob 处理 GET /api/v1/export/jobs/:id
func (h *ExportHandler) GetExportJob(c *gin.Context) {
	jobID := strings.TrimSpace(c.Param("id"))
	if jobID == "" {
		writeError(c, http.StatusBadRequest, CodeExportInvalidParams, "job id is required")
		return
	}
	actor := resolveActor(c)
	if actor.TenantID == "" {
		writeError(c, http.StatusUnauthorized, CodeExportInvalidParams, "tenant context is required")
		return
	}
	item, err := h.svc.GetJob(c.Request.Context(), actor.TenantID, jobID)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	writeSuccess(c, http.StatusOK, gin.H{
		"job": item,
	}, gin.H{})
}

// DownloadExport 处理 GET /api/v1/export/jobs/:id/download
func (h *ExportHandler) DownloadExport(c *gin.Context) {
	jobID := strings.TrimSpace(c.Param("id"))
	if jobID == "" {
		writeError(c, http.StatusBadRequest, CodeExportInvalidParams, "job id is required")
		return
	}
	actor := resolveActor(c)
	if actor.TenantID == "" {
		writeError(c, http.StatusUnauthorized, CodeExportInvalidParams, "tenant context is required")
		return
	}
	filePath, contentType, err := h.svc.GetDownloadPath(c.Request.Context(), actor.TenantID, jobID)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	fileName := "nexuslog-export-" + jobID
	if contentType == "text/csv" {
		fileName += ".csv"
	} else {
		fileName += ".json"
	}
	c.Header("Content-Disposition", "attachment; filename=\""+fileName+"\"")
	c.Header("Content-Type", contentType)
	c.File(filePath)
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
	case errors.Is(err, repository.ErrExportNotFound):
		writeError(c, http.StatusNotFound, CodeExportNotFound, "export job not found")
	case strings.Contains(err.Error(), "not completed"):
		writeError(c, http.StatusBadRequest, CodeExportInvalidParams, "export file is not ready")
	case strings.Contains(err.Error(), "file not found"), strings.Contains(err.Error(), "file not available"):
		writeError(c, http.StatusNotFound, CodeExportNotFound, "export file is not available")
	default:
		writeError(c, http.StatusInternalServerError, CodeExportInternalError, "internal error")
	}
}

type requestActor struct {
	TenantID string
	UserID   string
}

func resolveActor(c *gin.Context) requestActor {
	tenantID := firstNonEmpty(
		c.GetHeader("X-Tenant-ID"),
		c.GetHeader("X-Tenant-Id"),
	)
	if tenantID == "" {
		return requestActor{TenantID: "", UserID: firstNonEmpty(c.GetHeader("X-User-ID"), c.GetHeader("X-User-Id"))}
	}
	userID := firstNonEmpty(
		c.GetHeader("X-User-ID"),
		c.GetHeader("X-User-Id"),
	)
	return requestActor{TenantID: tenantID, UserID: userID}
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
	return "export-" + time.Now().UTC().Format("20060102150405") + "-" + randomHex(4)
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

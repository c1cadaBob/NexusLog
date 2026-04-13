package storage

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	cpMiddleware "github.com/nexuslog/control-plane/internal/middleware"
)

const (
	ErrorCodeInvalidParams = "REQ_INVALID_PARAMS"
	ErrorCodeInternal      = "INTERNAL_ERROR"
	ErrorCodeUnavailable   = "STORAGE_UNAVAILABLE"
)

type IndexHandler struct {
	svc *IndexService
}

func NewIndexHandler(svc *IndexService) *IndexHandler {
	return &IndexHandler{svc: svc}
}

func RegisterAuthorizedRoutes(router gin.IRouter, db *sql.DB, handler *IndexHandler) {
	g := router.Group("/api/v1/storage")
	g.GET("/indices", cpMiddleware.RequireCapabilityOrAdminRole(db, "storage.index.read"), handler.ListIndices)
}

func (h *IndexHandler) ListIndices(c *gin.Context) {
	tenantID := strings.TrimSpace(cpMiddleware.AuthenticatedTenantID(c))
	if tenantID == "" {
		h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, "X-Tenant-ID header is required")
		return
	}
	result, err := h.svc.ListIndices(c.Request.Context())
	if err != nil {
		status := http.StatusInternalServerError
		code := ErrorCodeInternal
		message := "failed to list storage indices"
		if strings.Contains(strings.ToLower(err.Error()), "not configured") || strings.Contains(strings.ToLower(err.Error()), "invalid") {
			status = http.StatusServiceUnavailable
			code = ErrorCodeUnavailable
			message = "storage index service unavailable"
		}
		h.writeError(c, status, code, message)
		return
	}

	h.writeSuccess(c, http.StatusOK, result)
}

func (h *IndexHandler) writeSuccess(c *gin.Context, status int, data any) {
	c.JSON(status, gin.H{
		"code":       "OK",
		"message":    "success",
		"request_id": h.requestID(c),
		"data":       data,
		"meta":       gin.H{},
	})
}

func (h *IndexHandler) writeError(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{
		"code":       strings.TrimSpace(code),
		"message":    strings.TrimSpace(message),
		"request_id": h.requestID(c),
		"details":    gin.H{},
	})
}

func (h *IndexHandler) requestID(c *gin.Context) string {
	if rid := strings.TrimSpace(c.GetHeader("X-Request-ID")); rid != "" {
		return rid
	}
	rid := fmt.Sprintf("cp-storage-%d", time.Now().UTC().UnixNano())
	c.Header("X-Request-ID", rid)
	return rid
}

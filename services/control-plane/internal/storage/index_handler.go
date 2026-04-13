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
	g.GET("/lifecycle-policies", cpMiddleware.RequireCapabilityOrAdminRole(db, "data.retention.read"), handler.ListLifecyclePolicies)
}

func (h *IndexHandler) ListIndices(c *gin.Context) {
	tenantID := strings.TrimSpace(cpMiddleware.AuthenticatedTenantID(c))
	if tenantID == "" {
		h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, "X-Tenant-ID header is required")
		return
	}
	result, err := h.svc.ListIndices(c.Request.Context())
	if err != nil {
		h.writeStorageError(c, err, "failed to list storage indices", "storage index service unavailable")
		return
	}

	h.writeSuccess(c, http.StatusOK, result)
}

func (h *IndexHandler) ListLifecyclePolicies(c *gin.Context) {
	tenantID := strings.TrimSpace(cpMiddleware.AuthenticatedTenantID(c))
	if tenantID == "" {
		h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, "X-Tenant-ID header is required")
		return
	}
	result, err := h.svc.ListLifecyclePolicies(c.Request.Context())
	if err != nil {
		h.writeStorageError(c, err, "failed to list storage lifecycle policies", "storage lifecycle service unavailable")
		return
	}

	h.writeSuccess(c, http.StatusOK, result)
}

func (h *IndexHandler) writeStorageError(c *gin.Context, err error, defaultMessage, unavailableMessage string) {
	status := http.StatusInternalServerError
	code := ErrorCodeInternal
	message := defaultMessage
	if strings.Contains(strings.ToLower(err.Error()), "not configured") || strings.Contains(strings.ToLower(err.Error()), "invalid") {
		status = http.StatusServiceUnavailable
		code = ErrorCodeUnavailable
		message = unavailableMessage
	}
	h.writeError(c, status, code, message)
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

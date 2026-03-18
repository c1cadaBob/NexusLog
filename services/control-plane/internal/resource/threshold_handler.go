package resource

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	cpMiddleware "github.com/nexuslog/control-plane/internal/middleware"
)

const (
	ErrorCodeInvalidParams = "REQ_INVALID_PARAMS"
	ErrorCodeNotFound      = "RES_NOT_FOUND"
	ErrorCodeInternal      = "INTERNAL_ERROR"
)

// ThresholdHandler handles resource threshold HTTP endpoints.
type ThresholdHandler struct {
	repo *ThresholdRepository
}

// NewThresholdHandler creates a new threshold handler.
func NewThresholdHandler(repo *ThresholdRepository) *ThresholdHandler {
	return &ThresholdHandler{repo: repo}
}

// RegisterRoutes registers threshold routes under /api/v1/resource/thresholds.
func RegisterRoutes(router gin.IRouter, handler *ThresholdHandler) {
	g := router.Group("/api/v1/resource/thresholds")
	{
		g.GET("", handler.List)
		g.GET("/:id", handler.Get)
		g.POST("", handler.Create)
		g.PUT("/:id", handler.Update)
		g.DELETE("/:id", handler.Delete)
	}
}

// RegisterAuthorizedRoutes registers threshold routes with capability-first compatibility guards.
func RegisterAuthorizedRoutes(router gin.IRouter, db *sql.DB, handler *ThresholdHandler) {
	g := router.Group("/api/v1/resource/thresholds")
	{
		g.GET("", cpMiddleware.RequireCapabilityOrAdminRole(db, "resource.threshold.read"), handler.List)
		g.GET("/:id", cpMiddleware.RequireCapabilityOrAdminRole(db, "resource.threshold.read"), handler.Get)
		g.POST("", cpMiddleware.RequireCapabilityOrAdminRole(db, "resource.threshold.create"), handler.Create)
		g.PUT("/:id", cpMiddleware.RequireCapabilityOrAdminRole(db, "resource.threshold.update"), handler.Update)
		g.DELETE("/:id", cpMiddleware.RequireCapabilityOrAdminRole(db, "resource.threshold.delete"), handler.Delete)
	}
}

// List handles GET /api/v1/resource/thresholds.
func (h *ThresholdHandler) List(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": ErrorCodeInvalidParams, "message": "X-Tenant-ID header is required"})
		return
	}
	agentID := strings.TrimSpace(c.Query("agent_id"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 200 {
		pageSize = 20
	}

	items, total, err := h.repo.List(c.Request.Context(), tenantID, agentID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": ErrorCodeInternal, "message": "failed to list thresholds"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": "OK", "message": "success",
		"data": gin.H{"items": items},
		"meta": gin.H{"page": page, "page_size": pageSize, "total": total, "has_next": page*pageSize < total},
	})
}

// Get handles GET /api/v1/resource/thresholds/:id.
func (h *ThresholdHandler) Get(c *gin.Context) {
	tenantID := getTenantID(c)
	id := strings.TrimSpace(c.Param("id"))
	if tenantID == "" || id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": ErrorCodeInvalidParams, "message": "X-Tenant-ID and id are required"})
		return
	}

	t, err := h.repo.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		if err == ErrThresholdNotFound {
			c.JSON(http.StatusNotFound, gin.H{"code": ErrorCodeNotFound, "message": "threshold not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": ErrorCodeInternal, "message": "failed to get threshold"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": "OK", "message": "success", "data": t})
}

// CreateRequest for POST body.
type CreateRequest struct {
	AgentID              *string         `json:"agent_id"`
	MetricName           string          `json:"metric_name"`
	ThresholdValue       float64         `json:"threshold_value"`
	Comparison           string          `json:"comparison"`
	AlertSeverity        string          `json:"alert_severity"`
	Enabled              *bool           `json:"enabled"`
	NotificationChannels json.RawMessage `json:"notification_channels"`
}

// Create handles POST /api/v1/resource/thresholds.
func (h *ThresholdHandler) Create(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": ErrorCodeInvalidParams, "message": "X-Tenant-ID header is required"})
		return
	}

	var req CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": ErrorCodeInvalidParams, "message": "invalid request body"})
		return
	}

	metricName := strings.TrimSpace(req.MetricName)
	if metricName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": ErrorCodeInvalidParams, "message": "metric_name is required"})
		return
	}
	if metricName != "cpu_usage_pct" && metricName != "memory_usage_pct" && metricName != "disk_usage_pct" {
		c.JSON(http.StatusBadRequest, gin.H{"code": ErrorCodeInvalidParams, "message": "metric_name must be cpu_usage_pct, memory_usage_pct, or disk_usage_pct"})
		return
	}

	comparison := strings.TrimSpace(req.Comparison)
	if comparison == "" {
		comparison = ">"
	}
	if comparison != ">" && comparison != ">=" && comparison != "<" && comparison != "<=" {
		c.JSON(http.StatusBadRequest, gin.H{"code": ErrorCodeInvalidParams, "message": "comparison must be >, >=, <, or <="})
		return
	}

	severity := strings.TrimSpace(req.AlertSeverity)
	if severity == "" {
		severity = "warning"
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	notifCh := []byte("[]")
	if len(req.NotificationChannels) > 0 {
		notifCh = req.NotificationChannels
	}

	t := &ResourceThreshold{
		TenantID:             tenantID,
		AgentID:              req.AgentID,
		MetricName:           metricName,
		ThresholdValue:       req.ThresholdValue,
		Comparison:           comparison,
		AlertSeverity:        severity,
		Enabled:              enabled,
		NotificationChannels: notifCh,
	}
	t.CreatedBy = getActorID(c)

	if err := h.repo.Create(c.Request.Context(), t); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": ErrorCodeInternal, "message": "failed to create threshold"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"code": "OK", "message": "success", "data": gin.H{"id": t.ID}})
}

// UpdateRequest for PUT body.
type UpdateRequest struct {
	AgentID              *string         `json:"agent_id,omitempty"`
	MetricName           *string         `json:"metric_name,omitempty"`
	ThresholdValue       *float64        `json:"threshold_value,omitempty"`
	Comparison           *string         `json:"comparison,omitempty"`
	AlertSeverity        *string         `json:"alert_severity,omitempty"`
	Enabled              *bool           `json:"enabled,omitempty"`
	NotificationChannels json.RawMessage `json:"notification_channels,omitempty"`
}

// Update handles PUT /api/v1/resource/thresholds/:id.
func (h *ThresholdHandler) Update(c *gin.Context) {
	tenantID := getTenantID(c)
	id := strings.TrimSpace(c.Param("id"))
	if tenantID == "" || id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": ErrorCodeInvalidParams, "message": "X-Tenant-ID and id are required"})
		return
	}

	var req UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": ErrorCodeInvalidParams, "message": "invalid request body"})
		return
	}

	in := &UpdateInput{
		AgentID:        req.AgentID,
		MetricName:     req.MetricName,
		ThresholdValue: req.ThresholdValue,
		Comparison:     req.Comparison,
		AlertSeverity:  req.AlertSeverity,
		Enabled:        req.Enabled,
	}
	if len(req.NotificationChannels) > 0 {
		in.NotificationChannels = req.NotificationChannels
	}

	if err := h.repo.Update(c.Request.Context(), tenantID, id, in); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": ErrorCodeInternal, "message": "failed to update threshold"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": "OK", "message": "success", "data": gin.H{"updated": true}})
}

// Delete handles DELETE /api/v1/resource/thresholds/:id.
func (h *ThresholdHandler) Delete(c *gin.Context) {
	tenantID := getTenantID(c)
	id := strings.TrimSpace(c.Param("id"))
	if tenantID == "" || id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": ErrorCodeInvalidParams, "message": "X-Tenant-ID and id are required"})
		return
	}

	if err := h.repo.Delete(c.Request.Context(), tenantID, id); err != nil {
		if err == ErrThresholdNotFound {
			c.JSON(http.StatusNotFound, gin.H{"code": ErrorCodeNotFound, "message": "threshold not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": ErrorCodeInternal, "message": "failed to delete threshold"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": "OK", "message": "success", "data": gin.H{"deleted": true}})
}

func getTenantID(c *gin.Context) string {
	return cpMiddleware.AuthenticatedTenantID(c)
}

func getActorID(c *gin.Context) *string {
	return cpMiddleware.AuthenticatedUserIDPtr(c)
}

package notification

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	cpMiddleware "github.com/nexuslog/control-plane/internal/middleware"
)

const (
	ErrorCodeInvalidParams = "REQ_INVALID_PARAMS"
	ErrorCodeNotFound      = "RES_NOT_FOUND"
	ErrorCodeConflict      = "RES_CONFLICT"
	ErrorCodeInternal      = "INTERNAL_ERROR"
)

// ChannelHandler handles notification channel HTTP endpoints.
type ChannelHandler struct {
	repo           *ChannelRepository
	sender         *SMTPSender
	dingTalkSender *DingTalkSender
}

// NewChannelHandler creates a channel handler.
func NewChannelHandler(repo *ChannelRepository, sender *SMTPSender) *ChannelHandler {
	return &ChannelHandler{
		repo:           repo,
		sender:         sender,
		dingTalkSender: NewDingTalkSender(),
	}
}

// CreateChannelRequest for POST body.
type CreateChannelRequest struct {
	Name    string          `json:"name"`
	Type    string          `json:"type"`
	Config  json.RawMessage `json:"config"`
	Enabled *bool           `json:"enabled"`
}

// UpdateChannelRequest for PUT body.
type UpdateChannelRequest struct {
	Name    *string          `json:"name"`
	Config  *json.RawMessage `json:"config"`
	Enabled *bool            `json:"enabled"`
}

// TestChannelRequest for POST :id/test body (optional to address).
type TestChannelRequest struct {
	To string `json:"to"`
}

// RegisterChannelRoutes registers notification channel routes.
func RegisterChannelRoutes(router gin.IRouter, repo *ChannelRepository, sender *SMTPSender) {
	h := NewChannelHandler(repo, sender)
	g := router.Group("/api/v1/notification/channels")
	g.GET("", h.ListChannels)
	g.GET("/:id", h.GetChannel)
	g.POST("", h.CreateChannel)
	g.PUT("/:id", h.UpdateChannel)
	g.DELETE("/:id", h.DeleteChannel)
	g.POST("/:id/test", h.TestChannel)
}

// RegisterAuthorizedChannelRoutes registers notification channel routes with capability guards.
func RegisterAuthorizedChannelRoutes(router gin.IRouter, db *sql.DB, repo *ChannelRepository, sender *SMTPSender) {
	h := NewChannelHandler(repo, sender)
	g := router.Group("/api/v1/notification/channels")
	g.GET("", cpMiddleware.RequireCapabilityOrAdminRole(db, "notification.channel.read_metadata"), h.ListChannels)
	g.GET("/:id", cpMiddleware.RequireCapabilityOrAdminRole(db, "notification.channel.read_metadata"), h.GetChannel)
	g.POST("", cpMiddleware.RequireCapabilityOrAdminRole(db, "notification.channel.create"), h.CreateChannel)
	g.PUT("/:id", cpMiddleware.RequireCapabilityOrAdminRole(db, "notification.channel.update"), h.UpdateChannel)
	g.DELETE("/:id", cpMiddleware.RequireCapabilityOrAdminRole(db, "notification.channel.delete"), h.DeleteChannel)
	g.POST("/:id/test", cpMiddleware.RequireCapabilityOrAdminRole(db, "notification.channel.test"), h.TestChannel)
}

func sanitizeNotificationValidationError(err error, fallback string) string {
	if err == nil {
		return fallback
	}
	message := strings.TrimSpace(err.Error())
	if message == "" {
		return fallback
	}
	lower := strings.ToLower(message)
	switch {
	case strings.HasPrefix(lower, "config must be valid json:"):
		return "config must be valid JSON object"
	case strings.HasPrefix(lower, "smtp_port must be a number:"):
		return "smtp_port must be a number"
	case strings.Contains(lower, "invalid character"), strings.Contains(lower, "cannot unmarshal"):
		return fallback
	default:
		return message
	}
}

func (h *ChannelHandler) getTenantID(c *gin.Context) string {
	return cpMiddleware.AuthenticatedTenantID(c)
}

func (h *ChannelHandler) getActorID(c *gin.Context) *string {
	return cpMiddleware.AuthenticatedUserIDPtr(c)
}

type globalTenantReadAccessResolver interface {
	HasGlobalTenantReadAccess(ctx context.Context, tenantID, userID string) (bool, error)
}

func (h *ChannelHandler) getRequestID(c *gin.Context) string {
	if rid := strings.TrimSpace(c.GetHeader("X-Request-ID")); rid != "" {
		return rid
	}
	rid := fmt.Sprintf("cp-%d", time.Now().UTC().UnixNano())
	c.Header("X-Request-ID", rid)
	return rid
}

func (h *ChannelHandler) writeSuccess(c *gin.Context, status int, data interface{}, meta gin.H) {
	if meta == nil {
		meta = gin.H{}
	}
	c.JSON(status, gin.H{
		"code":       "OK",
		"message":    "success",
		"request_id": h.getRequestID(c),
		"data":       data,
		"meta":       meta,
	})
}

func (h *ChannelHandler) writeError(c *gin.Context, status int, code, message string, details interface{}) {
	c.JSON(status, gin.H{
		"code":       code,
		"message":    message,
		"request_id": h.getRequestID(c),
		"details":    details,
	})
}

func (h *ChannelHandler) resolveReadTenantScope(c *gin.Context, tenantID string) (string, error) {
	if h == nil || h.repo == nil {
		return tenantID, nil
	}
	repo, ok := any(h.repo).(globalTenantReadAccessResolver)
	if !ok {
		return tenantID, nil
	}
	userID := cpMiddleware.AuthenticatedUserID(c)
	allowed, err := repo.HasGlobalTenantReadAccess(c.Request.Context(), tenantID, userID)
	if err != nil {
		return "", err
	}
	if allowed {
		return "", nil
	}
	return tenantID, nil
}

// ListChannels GET /api/v1/notification/channels
func (h *ChannelHandler) ListChannels(c *gin.Context) {
	tenantID := h.getTenantID(c)
	if tenantID == "" {
		h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, "X-Tenant-ID header is required", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 200 {
		pageSize = 20
	}

	tenantScope, err := h.resolveReadTenantScope(c, tenantID)
	if err != nil {
		h.writeError(c, http.StatusInternalServerError, ErrorCodeInternal, "failed to authorize request", nil)
		return
	}

	items, total, err := h.repo.ListChannels(c.Request.Context(), tenantScope, page, pageSize)
	if err != nil {
		h.writeError(c, http.StatusInternalServerError, ErrorCodeInternal, "failed to list channels", nil)
		return
	}

	h.writeSuccess(c, http.StatusOK, gin.H{"items": sanitizeChannels(items)}, gin.H{
		"page":      page,
		"page_size": pageSize,
		"total":     total,
		"has_next":  page*pageSize < total,
	})
}

// GetChannel GET /api/v1/notification/channels/:id
func (h *ChannelHandler) GetChannel(c *gin.Context) {
	tenantID := h.getTenantID(c)
	id := strings.TrimSpace(c.Param("id"))
	if tenantID == "" || id == "" {
		h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, "X-Tenant-ID and id are required", nil)
		return
	}

	tenantScope, err := h.resolveReadTenantScope(c, tenantID)
	if err != nil {
		h.writeError(c, http.StatusInternalServerError, ErrorCodeInternal, "failed to authorize request", nil)
		return
	}

	ch, err := h.repo.GetChannel(c.Request.Context(), tenantScope, id)
	if err != nil {
		if err == ErrChannelNotFound {
			h.writeError(c, http.StatusNotFound, ErrorCodeNotFound, "channel not found", nil)
			return
		}
		h.writeError(c, http.StatusInternalServerError, ErrorCodeInternal, "failed to get channel", nil)
		return
	}

	h.writeSuccess(c, http.StatusOK, sanitizeChannel(ch), gin.H{})
}

// CreateChannel POST /api/v1/notification/channels
func (h *ChannelHandler) CreateChannel(c *gin.Context) {
	tenantID := h.getTenantID(c)
	if tenantID == "" {
		h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, "X-Tenant-ID header is required", nil)
		return
	}

	var req CreateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, "invalid request body", nil)
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, "name is required", nil)
		return
	}
	if err := ValidateChannelType(req.Type); err != nil {
		h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, sanitizeNotificationValidationError(err, "invalid channel type"), nil)
		return
	}
	if err := ValidateConfig(req.Type, req.Config); err != nil {
		h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, sanitizeNotificationValidationError(err, "invalid channel config"), nil)
		return
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	createdBy := h.getActorID(c)

	ch, err := h.repo.CreateChannel(c.Request.Context(), tenantID, name, req.Type, req.Config, enabled, createdBy)
	if err != nil {
		if err == ErrChannelNameConflict {
			h.writeError(c, http.StatusConflict, ErrorCodeConflict, "channel name already exists", nil)
			return
		}
		h.writeError(c, http.StatusInternalServerError, ErrorCodeInternal, "failed to create channel", nil)
		return
	}

	h.writeSuccess(c, http.StatusCreated, gin.H{
		"id":      ch.ID,
		"name":    ch.Name,
		"type":    ch.Type,
		"enabled": ch.Enabled,
	}, gin.H{})
}

// UpdateChannel PUT /api/v1/notification/channels/:id
func (h *ChannelHandler) UpdateChannel(c *gin.Context) {
	tenantID := h.getTenantID(c)
	id := strings.TrimSpace(c.Param("id"))
	if tenantID == "" || id == "" {
		h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, "X-Tenant-ID and id are required", nil)
		return
	}

	var req UpdateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, "invalid request body", nil)
		return
	}

	if req.Name == nil && req.Config == nil && req.Enabled == nil {
		h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, "at least one of name, config, enabled is required", nil)
		return
	}

	ch, err := h.repo.GetChannel(c.Request.Context(), tenantID, id)
	if err != nil {
		if err == ErrChannelNotFound {
			h.writeError(c, http.StatusNotFound, ErrorCodeNotFound, "channel not found", nil)
			return
		}
		h.writeError(c, http.StatusInternalServerError, ErrorCodeInternal, "failed to get channel", nil)
		return
	}

	if req.Config != nil {
		mergedConfig, err := mergeMaskedConfig(ch.Type, ch.Config, *req.Config)
		if err != nil {
			h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, "invalid config payload", nil)
			return
		}
		req.Config = &mergedConfig
		if err := ValidateConfig(ch.Type, mergedConfig); err != nil {
			h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, sanitizeNotificationValidationError(err, "invalid channel config"), nil)
			return
		}
	}

	updated, err := h.repo.UpdateChannel(c.Request.Context(), tenantID, id, req.Name, req.Config, req.Enabled)
	if err != nil {
		if err == ErrChannelNotFound {
			h.writeError(c, http.StatusNotFound, ErrorCodeNotFound, "channel not found", nil)
			return
		}
		if err == ErrChannelNameConflict {
			h.writeError(c, http.StatusConflict, ErrorCodeConflict, "channel name already exists", nil)
			return
		}
		h.writeError(c, http.StatusInternalServerError, ErrorCodeInternal, "failed to update channel", nil)
		return
	}

	h.writeSuccess(c, http.StatusOK, sanitizeChannel(updated), gin.H{})
}

// DeleteChannel DELETE /api/v1/notification/channels/:id
func (h *ChannelHandler) DeleteChannel(c *gin.Context) {
	tenantID := h.getTenantID(c)
	id := strings.TrimSpace(c.Param("id"))
	if tenantID == "" || id == "" {
		h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, "X-Tenant-ID and id are required", nil)
		return
	}

	err := h.repo.DeleteChannel(c.Request.Context(), tenantID, id)
	if err != nil {
		if err == ErrChannelNotFound {
			h.writeError(c, http.StatusNotFound, ErrorCodeNotFound, "channel not found", nil)
			return
		}
		h.writeError(c, http.StatusInternalServerError, ErrorCodeInternal, "failed to delete channel", nil)
		return
	}

	h.writeSuccess(c, http.StatusOK, gin.H{"deleted": true}, gin.H{})
}

// TestChannel POST /api/v1/notification/channels/:id/test
func (h *ChannelHandler) TestChannel(c *gin.Context) {
	tenantID := h.getTenantID(c)
	id := strings.TrimSpace(c.Param("id"))
	if tenantID == "" || id == "" {
		h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, "X-Tenant-ID and id are required", nil)
		return
	}

	ch, err := h.repo.GetChannel(c.Request.Context(), tenantID, id)
	if err != nil {
		if err == ErrChannelNotFound {
			h.writeError(c, http.StatusNotFound, ErrorCodeNotFound, "channel not found", nil)
			return
		}
		h.writeError(c, http.StatusInternalServerError, ErrorCodeInternal, "failed to get channel", nil)
		return
	}

	if !ch.Enabled {
		h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, "channel is disabled", nil)
		return
	}

	var req TestChannelRequest
	_ = c.ShouldBindJSON(&req)
	to := strings.TrimSpace(req.To)

	switch strings.ToLower(ch.Type) {
	case "email":
		if to == "" {
			// Try to get from config
			var m map[string]interface{}
			if json.Unmarshal(ch.Config, &m) == nil {
				if v, ok := m["from_email"].(string); ok && strings.TrimSpace(v) != "" {
					to = strings.TrimSpace(v)
				}
				if to == "" {
					if v, ok := m["smtp_username"].(string); ok && strings.TrimSpace(v) != "" {
						to = strings.TrimSpace(v)
					}
				}
			}
		}
		if to == "" {
			h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, "to address is required for email test", nil)
			return
		}
		cfg, err := ParseEmailConfig(ch.Config)
		if err != nil {
			h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, "invalid email channel config", nil)
			return
		}
		if err := validateEmailTestTarget(cfg, to); err != nil {
			h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, sanitizeNotificationValidationError(err, "invalid email test target"), nil)
			return
		}
		if err := h.sender.SendTestEmail(cfg, to); err != nil {
			h.writeError(c, http.StatusInternalServerError, ErrorCodeInternal, "failed to send test email", nil)
			return
		}
		h.writeSuccess(c, http.StatusOK, gin.H{"sent": true, "to": to}, gin.H{})
	case "dingtalk":
		cfg, err := ParseDingTalkConfig(ch.Config)
		if err != nil {
			h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, "invalid dingtalk channel config", nil)
			return
		}
		if err := validateDingTalkTarget(cfg); err != nil {
			h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, sanitizeNotificationValidationError(err, "invalid dingtalk target"), nil)
			return
		}
		testAlert := AlertMessage{
			Title:   "NexusLog Notification Channel Test",
			Detail:  "This is a test message from NexusLog notification channel.",
			FiredAt: time.Now().UTC().Format(time.RFC3339),
		}
		if err := h.dingTalkSender.Send(cfg, testAlert); err != nil {
			h.writeError(c, http.StatusInternalServerError, ErrorCodeInternal, "failed to send dingtalk test", nil)
			return
		}
		h.writeSuccess(c, http.StatusOK, gin.H{"sent": true, "type": "dingtalk"}, gin.H{})
	case "sms":
		h.writeError(c, http.StatusNotImplemented, ErrorCodeInternal, "test not implemented for sms", nil)
	default:
		h.writeError(c, http.StatusBadRequest, ErrorCodeInvalidParams, "unsupported channel type for test", nil)
	}
}

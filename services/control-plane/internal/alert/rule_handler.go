package alert

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	// ErrorCodeRequestInvalidParams indicates request parameter validation failed.
	ErrorCodeRequestInvalidParams = "REQ_INVALID_PARAMS"
	// ErrorCodeResourceNotFound indicates resource not found.
	ErrorCodeResourceNotFound = "RES_NOT_FOUND"
	// ErrorCodeResourceLimitExceeded indicates tenant limit exceeded (422).
	ErrorCodeResourceLimitExceeded = "RES_LIMIT_EXCEEDED"
	// ErrorCodeInternalError indicates internal error.
	ErrorCodeInternalError = "INTERNAL_ERROR"
)

// RuleHandler handles HTTP requests for alert rules.
type RuleHandler struct {
	svc *RuleService
}

// NewRuleHandler creates a new rule handler.
func NewRuleHandler(svc *RuleService) *RuleHandler {
	return &RuleHandler{svc: svc}
}

// RegisterAlertRuleRoutes registers alert rule routes under /api/v1/alert/rules.
func RegisterAlertRuleRoutes(router gin.IRouter, handler *RuleHandler) {
	g := router.Group("/api/v1/alert/rules")
	{
		g.GET("", handler.ListRules)
		g.GET("/:id", handler.GetRule)
		g.POST("", handler.CreateRule)
		g.PUT("/:id", handler.UpdateRule)
		g.DELETE("/:id", handler.DeleteRule)
		g.PUT("/:id/enable", handler.EnableRule)
		g.PUT("/:id/disable", handler.DisableRule)
	}
}

// ListRules handles GET /api/v1/alert/rules.
func (h *RuleHandler) ListRules(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		setAlertRuleAuditEvent(c, "alert_rules.list", "", buildRuleListAuditDetails(0, 0, 0, 0, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "X-Tenant-ID header is required", nil)
		return
	}

	page, err := parsePositiveInt(c.Query("page"), 1)
	if err != nil {
		setAlertRuleAuditEvent(c, "alert_rules.list", "", buildRuleListAuditDetails(0, 0, 0, 0, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "page must be a positive integer", nil)
		return
	}
	pageSize, err := parsePositiveInt(c.Query("page_size"), 20)
	if err != nil {
		setAlertRuleAuditEvent(c, "alert_rules.list", "", buildRuleListAuditDetails(page, 0, 0, 0, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "page_size must be a positive integer", nil)
		return
	}
	if pageSize > 200 {
		pageSize = 200
	}

	items, total, err := h.svc.ListRules(c.Request.Context(), tenantID, page, pageSize)
	if err != nil {
		setAlertRuleAuditEvent(c, "alert_rules.list", "", buildRuleListAuditDetails(page, pageSize, 0, 0, http.StatusInternalServerError, "failed", ErrorCodeInternalError))
		writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to list rules", nil)
		return
	}

	setAlertRuleAuditEvent(c, "alert_rules.list", "", buildRuleListAuditDetails(page, pageSize, total, len(items), http.StatusOK, "success", ""))
	writeSuccess(c, http.StatusOK, gin.H{"items": items}, buildPaginationMeta(page, pageSize, total))
}

// GetRule handles GET /api/v1/alert/rules/:id.
func (h *RuleHandler) GetRule(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		setAlertRuleAuditEvent(c, "alert_rules.read", "", buildRuleReadAuditDetails(nil, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "X-Tenant-ID header is required", nil)
		return
	}
	ruleID := strings.TrimSpace(c.Param("id"))
	if ruleID == "" {
		setAlertRuleAuditEvent(c, "alert_rules.read", "", buildRuleReadAuditDetails(nil, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "rule id is required", nil)
		return
	}

	rule, err := h.svc.GetRule(c.Request.Context(), tenantID, ruleID)
	if err != nil {
		if err == ErrRuleNotFound {
			setAlertRuleAuditEvent(c, "alert_rules.read", ruleID, buildRuleReadAuditDetails(nil, http.StatusNotFound, "failed", ErrorCodeResourceNotFound))
			writeError(c, http.StatusNotFound, ErrorCodeResourceNotFound, "alert rule not found", nil)
			return
		}
		setAlertRuleAuditEvent(c, "alert_rules.read", ruleID, buildRuleReadAuditDetails(nil, http.StatusInternalServerError, "failed", ErrorCodeInternalError))
		writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to get rule", nil)
		return
	}

	setAlertRuleAuditEvent(c, "alert_rules.read", ruleID, buildRuleReadAuditDetails(rule, http.StatusOK, "success", ""))
	writeSuccess(c, http.StatusOK, rule, gin.H{})
}

// CreateRuleRequest defines the request body for creating a rule.
type CreateRuleRequest struct {
	Name                 string          `json:"name"`
	Description          string          `json:"description"`
	Condition            json.RawMessage `json:"condition"`
	Severity             string          `json:"severity"`
	Enabled              *bool           `json:"enabled"`
	NotificationChannels json.RawMessage `json:"notification_channels"`
}

// CreateRule handles POST /api/v1/alert/rules.
func (h *RuleHandler) CreateRule(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		setAlertRuleAuditEvent(c, "alert_rules.create", "", buildRuleCreateRequestAuditDetails(CreateRuleRequest{}, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "X-Tenant-ID header is required", nil)
		return
	}

	var req CreateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		setAlertRuleAuditEvent(c, "alert_rules.create", "", buildRuleCreateRequestAuditDetails(req, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "invalid request body", nil)
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		setAlertRuleAuditEvent(c, "alert_rules.create", "", buildRuleCreateRequestAuditDetails(req, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "name is required", nil)
		return
	}
	if len(req.Condition) == 0 {
		setAlertRuleAuditEvent(c, "alert_rules.create", "", buildRuleCreateRequestAuditDetails(req, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "condition is required", nil)
		return
	}

	rule := &AlertRule{
		Name:                 name,
		Description:          strings.TrimSpace(req.Description),
		Condition:            req.Condition,
		Severity:             strings.TrimSpace(req.Severity),
		NotificationChannels: req.NotificationChannels,
	}
	if rule.Severity == "" {
		rule.Severity = "WARNING"
	}
	if req.Enabled != nil {
		rule.Enabled = *req.Enabled
	} else {
		rule.Enabled = true
	}

	id, err := h.svc.CreateRule(c.Request.Context(), tenantID, rule)
	if err != nil {
		if err == ErrRuleLimitExceeded {
			setAlertRuleAuditEvent(c, "alert_rules.create", "", buildRuleCreateRequestAuditDetails(req, http.StatusUnprocessableEntity, "failed", ErrorCodeResourceLimitExceeded))
			writeError(c, http.StatusUnprocessableEntity, ErrorCodeResourceLimitExceeded, "rule limit exceeded: max 1000 rules per tenant", nil)
			return
		}
		if errors.Is(err, ErrInvalidCondition) {
			setAlertRuleAuditEvent(c, "alert_rules.create", "", buildRuleCreateRequestAuditDetails(req, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
			writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, sanitizeRuleConditionError(err), nil)
			return
		}
		setAlertRuleAuditEvent(c, "alert_rules.create", "", buildRuleCreateRequestAuditDetails(req, http.StatusInternalServerError, "failed", ErrorCodeInternalError))
		writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to create rule", nil)
		return
	}

	setAlertRuleAuditEvent(c, "alert_rules.create", id, buildRuleAuditDetails(rule, http.StatusCreated, "success", "", nil))
	writeSuccess(c, http.StatusCreated, gin.H{"id": id, "enabled": rule.Enabled}, gin.H{})
}

// UpdateRuleRequest defines the request body for updating a rule.
type UpdateRuleRequest struct {
	Name                 *string         `json:"name,omitempty"`
	Description          *string         `json:"description,omitempty"`
	Condition            json.RawMessage `json:"condition,omitempty"`
	Severity             *string         `json:"severity,omitempty"`
	Enabled              *bool           `json:"enabled,omitempty"`
	NotificationChannels json.RawMessage `json:"notification_channels,omitempty"`
}

// UpdateRule handles PUT /api/v1/alert/rules/:id.
func (h *RuleHandler) UpdateRule(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		setAlertRuleAuditEvent(c, "alert_rules.update", "", buildRuleUpdateAuditDetails("", UpdateRuleRequest{}, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "X-Tenant-ID header is required", nil)
		return
	}
	ruleID := strings.TrimSpace(c.Param("id"))
	if ruleID == "" {
		setAlertRuleAuditEvent(c, "alert_rules.update", "", buildRuleUpdateAuditDetails("", UpdateRuleRequest{}, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "rule id is required", nil)
		return
	}

	var req UpdateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		setAlertRuleAuditEvent(c, "alert_rules.update", ruleID, buildRuleUpdateAuditDetails(ruleID, req, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "invalid request body", nil)
		return
	}

	update := &AlertRuleUpdate{}
	if req.Name != nil {
		trimmed := strings.TrimSpace(*req.Name)
		if trimmed == "" {
			setAlertRuleAuditEvent(c, "alert_rules.update", ruleID, buildRuleUpdateAuditDetails(ruleID, req, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
			writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "name cannot be empty", nil)
			return
		}
		update.Name = &trimmed
	}
	if req.Description != nil {
		trimmed := strings.TrimSpace(*req.Description)
		update.Description = &trimmed
	}
	if len(req.Condition) > 0 {
		update.Condition = req.Condition
	}
	if req.Severity != nil {
		trimmed := strings.TrimSpace(*req.Severity)
		update.Severity = &trimmed
	}
	if req.Enabled != nil {
		update.Enabled = req.Enabled
	}
	if len(req.NotificationChannels) > 0 {
		update.NotificationChannels = req.NotificationChannels
	}

	err := h.svc.UpdateRule(c.Request.Context(), tenantID, ruleID, update)
	if err != nil {
		if err == ErrRuleNotFound {
			setAlertRuleAuditEvent(c, "alert_rules.update", ruleID, buildRuleUpdateAuditDetails(ruleID, req, http.StatusNotFound, "failed", ErrorCodeResourceNotFound))
			writeError(c, http.StatusNotFound, ErrorCodeResourceNotFound, "alert rule not found", nil)
			return
		}
		if errors.Is(err, ErrInvalidCondition) {
			setAlertRuleAuditEvent(c, "alert_rules.update", ruleID, buildRuleUpdateAuditDetails(ruleID, req, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
			writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, sanitizeRuleConditionError(err), nil)
			return
		}
		setAlertRuleAuditEvent(c, "alert_rules.update", ruleID, buildRuleUpdateAuditDetails(ruleID, req, http.StatusInternalServerError, "failed", ErrorCodeInternalError))
		writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to update rule", nil)
		return
	}

	setAlertRuleAuditEvent(c, "alert_rules.update", ruleID, buildRuleUpdateAuditDetails(ruleID, req, http.StatusOK, "success", ""))
	writeSuccess(c, http.StatusOK, gin.H{"updated": true}, gin.H{})
}

// DeleteRule handles DELETE /api/v1/alert/rules/:id.
func (h *RuleHandler) DeleteRule(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		setAlertRuleAuditEvent(c, "alert_rules.delete", "", buildRuleUpdateAuditDetails("", UpdateRuleRequest{}, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "X-Tenant-ID header is required", nil)
		return
	}
	ruleID := strings.TrimSpace(c.Param("id"))
	if ruleID == "" {
		setAlertRuleAuditEvent(c, "alert_rules.delete", "", buildRuleUpdateAuditDetails("", UpdateRuleRequest{}, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "rule id is required", nil)
		return
	}

	err := h.svc.DeleteRule(c.Request.Context(), tenantID, ruleID)
	if err != nil {
		if err == ErrRuleNotFound {
			setAlertRuleAuditEvent(c, "alert_rules.delete", ruleID, buildRuleDeleteAuditDetails(ruleID, http.StatusNotFound, "failed", ErrorCodeResourceNotFound))
			writeError(c, http.StatusNotFound, ErrorCodeResourceNotFound, "alert rule not found", nil)
			return
		}
		setAlertRuleAuditEvent(c, "alert_rules.delete", ruleID, buildRuleDeleteAuditDetails(ruleID, http.StatusInternalServerError, "failed", ErrorCodeInternalError))
		writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to delete rule", nil)
		return
	}

	setAlertRuleAuditEvent(c, "alert_rules.delete", ruleID, buildRuleDeleteAuditDetails(ruleID, http.StatusOK, "success", ""))
	writeSuccess(c, http.StatusOK, gin.H{"deleted": true}, gin.H{})
}

// EnableRule handles PUT /api/v1/alert/rules/:id/enable.
func (h *RuleHandler) EnableRule(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		setAlertRuleAuditEvent(c, "alert_rules.enable", "", buildRuleToggleAuditDetails("", true, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "X-Tenant-ID header is required", nil)
		return
	}
	ruleID := strings.TrimSpace(c.Param("id"))
	if ruleID == "" {
		setAlertRuleAuditEvent(c, "alert_rules.enable", "", buildRuleToggleAuditDetails("", true, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "rule id is required", nil)
		return
	}

	err := h.svc.EnableRule(c.Request.Context(), tenantID, ruleID)
	if err != nil {
		if err == ErrRuleNotFound {
			setAlertRuleAuditEvent(c, "alert_rules.enable", ruleID, buildRuleToggleAuditDetails(ruleID, true, http.StatusNotFound, "failed", ErrorCodeResourceNotFound))
			writeError(c, http.StatusNotFound, ErrorCodeResourceNotFound, "alert rule not found", nil)
			return
		}
		setAlertRuleAuditEvent(c, "alert_rules.enable", ruleID, buildRuleToggleAuditDetails(ruleID, true, http.StatusInternalServerError, "failed", ErrorCodeInternalError))
		writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to enable rule", nil)
		return
	}

	setAlertRuleAuditEvent(c, "alert_rules.enable", ruleID, buildRuleToggleAuditDetails(ruleID, true, http.StatusOK, "success", ""))
	writeSuccess(c, http.StatusOK, gin.H{"enabled": true}, gin.H{})
}

// DisableRule handles PUT /api/v1/alert/rules/:id/disable.
func (h *RuleHandler) DisableRule(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		setAlertRuleAuditEvent(c, "alert_rules.disable", "", buildRuleToggleAuditDetails("", false, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "X-Tenant-ID header is required", nil)
		return
	}
	ruleID := strings.TrimSpace(c.Param("id"))
	if ruleID == "" {
		setAlertRuleAuditEvent(c, "alert_rules.disable", "", buildRuleToggleAuditDetails("", false, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "rule id is required", nil)
		return
	}

	err := h.svc.DisableRule(c.Request.Context(), tenantID, ruleID)
	if err != nil {
		if err == ErrRuleNotFound {
			setAlertRuleAuditEvent(c, "alert_rules.disable", ruleID, buildRuleToggleAuditDetails(ruleID, false, http.StatusNotFound, "failed", ErrorCodeResourceNotFound))
			writeError(c, http.StatusNotFound, ErrorCodeResourceNotFound, "alert rule not found", nil)
			return
		}
		setAlertRuleAuditEvent(c, "alert_rules.disable", ruleID, buildRuleToggleAuditDetails(ruleID, false, http.StatusInternalServerError, "failed", ErrorCodeInternalError))
		writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to disable rule", nil)
		return
	}

	setAlertRuleAuditEvent(c, "alert_rules.disable", ruleID, buildRuleToggleAuditDetails(ruleID, false, http.StatusOK, "success", ""))
	writeSuccess(c, http.StatusOK, gin.H{"enabled": false}, gin.H{})
}

func sanitizeRuleConditionError(err error) string {
	if !errors.Is(err, ErrInvalidCondition) {
		return "invalid condition payload"
	}
	message := strings.TrimSpace(err.Error())
	if message == ErrInvalidCondition.Error() {
		return "invalid condition payload"
	}
	prefix := ErrInvalidCondition.Error() + ":"
	if strings.HasPrefix(message, prefix) {
		detail := strings.TrimSpace(strings.TrimPrefix(message, prefix))
		if detail == "" {
			return "invalid condition payload"
		}
		lower := strings.ToLower(detail)
		if strings.Contains(lower, "invalid character") || strings.Contains(lower, "cannot unmarshal") {
			return "invalid condition payload"
		}
		return detail
	}
	return "invalid condition payload"
}

func getTenantID(c *gin.Context) string {
	return strings.TrimSpace(c.GetHeader("X-Tenant-ID"))
}

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

func buildPaginationMeta(page, pageSize, total int) gin.H {
	return gin.H{
		"page":      page,
		"page_size": pageSize,
		"total":     total,
		"has_next":  page*pageSize < total,
	}
}

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

func writeError(c *gin.Context, status int, code, message string, details any) {
	if code == "" {
		code = ErrorCodeInternalError
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

func requestID(c *gin.Context) string {
	if existing := strings.TrimSpace(c.GetHeader("X-Request-ID")); existing != "" {
		c.Header("X-Request-ID", existing)
		return existing
	}
	generated := fmt.Sprintf("cp-%d-%s", time.Now().Unix(), shortRandomHex(6))
	c.Header("X-Request-ID", generated)
	return generated
}

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

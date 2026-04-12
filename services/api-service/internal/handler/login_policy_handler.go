package handler

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/nexuslog/api-service/internal/httpx"
	"github.com/nexuslog/api-service/internal/model"
	"github.com/nexuslog/api-service/internal/service"
)

type LoginPolicyHandler struct {
	loginPolicyService *service.LoginPolicyService
}

func NewLoginPolicyHandler(loginPolicyService *service.LoginPolicyService) *LoginPolicyHandler {
	return &LoginPolicyHandler{loginPolicyService: loginPolicyService}
}

func (h *LoginPolicyHandler) Get(c *gin.Context) {
	tenantID := authenticatedTenantID(c)
	actorID := authenticatedUserID(c)
	resp, apiErr := h.loginPolicyService.GetLoginPolicy(c.Request.Context(), tenantID)
	if apiErr != nil {
		setAuthAuditEvent(c, "auth.login_policy.read", actorID, tenantID, buildAuditDetails(map[string]any{
			"result":      "failed",
			"error_code":  apiErr.Code,
			"http_status": apiErr.HTTPStatus,
		}))
		httpx.Error(c, apiErr)
		return
	}
	setAuthAuditEvent(c, "auth.login_policy.read", actorID, tenantID, buildAuditDetails(map[string]any{
		"result":      "success",
		"updated_at":  resp.UpdatedAt,
		"http_status": http.StatusOK,
	}))
	httpx.Success(c, http.StatusOK, resp)
}

func (h *LoginPolicyHandler) Update(c *gin.Context) {
	tenantID := authenticatedTenantID(c)
	actorID := authenticatedUserID(c)
	var req struct {
		Settings service.LoginPolicySettings `json:"settings"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		setAuthAuditEvent(c, "auth.login_policy.update", actorID, tenantID, buildAuditDetails(map[string]any{
			"result":      "failed",
			"error_code":  "LOGIN_POLICY_INVALID_ARGUMENT",
			"http_status": http.StatusBadRequest,
		}))
		httpx.Error(c, &model.APIError{HTTPStatus: http.StatusBadRequest, Code: "LOGIN_POLICY_INVALID_ARGUMENT", Message: "invalid request", Details: map[string]any{"field": "body"}})
		return
	}
	resp, apiErr := h.loginPolicyService.UpdateLoginPolicy(c.Request.Context(), tenantID, strings.TrimSpace(actorID), req.Settings)
	if apiErr != nil {
		setAuthAuditEvent(c, "auth.login_policy.update", actorID, tenantID, buildAuditDetails(map[string]any{
			"result":      "failed",
			"error_code":  apiErr.Code,
			"http_status": apiErr.HTTPStatus,
		}))
		httpx.Error(c, apiErr)
		return
	}
	setAuthAuditEvent(c, "auth.login_policy.update", actorID, tenantID, buildAuditDetails(map[string]any{
		"result":                "success",
		"updated_at":            resp.UpdatedAt,
		"ip_whitelist_enabled":  resp.Settings.IPWhitelistEnabled,
		"max_login_attempts":    resp.Settings.MaxLoginAttempts,
		"max_concurrent_session": resp.Settings.MaxConcurrentSessions,
		"http_status":           http.StatusOK,
	}))
	httpx.Success(c, http.StatusOK, resp)
}

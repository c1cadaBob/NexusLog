package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/nexuslog/api-service/internal/httpx"
	"github.com/nexuslog/api-service/internal/model"
	"github.com/nexuslog/api-service/internal/service"
)

// UserHandler handles user CRUD and role assignment endpoints.
type UserHandler struct {
	userService *service.UserService
}

func NewUserHandler(userService *service.UserService) *UserHandler {
	return &UserHandler{userService: userService}
}

func (h *UserHandler) List(c *gin.Context) {
	tenantID := authenticatedTenantID(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	filter := model.ListUsersFilter{
		Query:  strings.TrimSpace(c.Query("query")),
		Status: strings.TrimSpace(c.Query("status")),
		RoleID: strings.TrimSpace(c.Query("role_id")),
	}

	resp, apiErr := h.userService.ListUsers(c.Request.Context(), tenantID, page, pageSize, filter)
	if apiErr != nil {
		setUserAuditEvent(c, "users.list", "", buildAuditDetails(map[string]any{
			"result":      "failed",
			"query":       filter.Query,
			"status":      filter.Status,
			"role_id":     filter.RoleID,
			"page":        page,
			"page_size":   pageSize,
			"error_code":  apiErr.Code,
			"http_status": apiErr.HTTPStatus,
		}))
		httpx.Error(c, apiErr)
		return
	}
	setUserAuditEvent(c, "users.list", "", buildAuditDetails(map[string]any{
		"result":       "success",
		"query":        filter.Query,
		"status":       filter.Status,
		"role_id":      filter.RoleID,
		"page":         resp.Page,
		"page_size":    resp.Limit,
		"result_count": len(resp.Users),
		"total":        resp.Total,
		"http_status":  http.StatusOK,
	}))
	httpx.Success(c, http.StatusOK, resp)
}

func (h *UserHandler) Get(c *gin.Context) {
	tenantID := authenticatedTenantID(c)
	userID := c.Param("id")
	if userID == "" {
		setUserAuditEvent(c, "users.read", "", buildAuditDetails(map[string]any{
			"result":      "failed",
			"error_code":  "USER_GET_INVALID_ARGUMENT",
			"http_status": http.StatusBadRequest,
		}))
		httpx.Error(c, &model.APIError{
			HTTPStatus: http.StatusBadRequest,
			Code:       "USER_GET_INVALID_ARGUMENT",
			Message:    "user id required",
			Details:    map[string]any{"field": "id"},
		})
		return
	}

	resp, apiErr := h.userService.GetUser(c.Request.Context(), tenantID, userID)
	if apiErr != nil {
		setUserAuditEvent(c, "users.read", userID, buildAuditDetails(map[string]any{
			"result":         "failed",
			"target_user_id": userID,
			"error_code":     apiErr.Code,
			"http_status":    apiErr.HTTPStatus,
		}))
		httpx.Error(c, apiErr)
		return
	}
	setUserAuditEvent(c, "users.read", userID, buildAuditDetails(map[string]any{
		"result":         "success",
		"target_user_id": userID,
		"username":       resp.Username,
		"http_status":    http.StatusOK,
	}))
	httpx.Success(c, http.StatusOK, resp)
}

func (h *UserHandler) Create(c *gin.Context) {
	tenantID := authenticatedTenantID(c)

	var req model.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		setUserAuditEvent(c, "users.create", "", buildAuditDetails(map[string]any{
			"result":      "failed",
			"error_code":  "USER_CREATE_INVALID_ARGUMENT",
			"http_status": http.StatusBadRequest,
		}))
		httpx.Error(c, &model.APIError{
			HTTPStatus: http.StatusBadRequest,
			Code:       "USER_CREATE_INVALID_ARGUMENT",
			Message:    "invalid request",
			Details:    map[string]any{"field": "body"},
		})
		return
	}

	resp, apiErr := h.userService.CreateUser(c.Request.Context(), tenantID, req)
	if apiErr != nil {
		setUserAuditEvent(c, "users.create", "", buildAuditDetails(map[string]any{
			"result":      "failed",
			"username":    req.Username,
			"error_code":  apiErr.Code,
			"http_status": apiErr.HTTPStatus,
		}))
		httpx.Error(c, apiErr)
		return
	}
	setUserAuditEvent(c, "users.create", resp.ID, buildAuditDetails(map[string]any{
		"result":         "success",
		"target_user_id": resp.ID,
		"username":       resp.Username,
		"role_id":        req.RoleID,
		"http_status":    http.StatusCreated,
	}))
	httpx.Success(c, http.StatusCreated, resp)
}

func (h *UserHandler) Update(c *gin.Context) {
	tenantID := authenticatedTenantID(c)
	userID := c.Param("id")
	if userID == "" {
		setUserAuditEvent(c, "users.update", "", buildAuditDetails(map[string]any{
			"result":      "failed",
			"error_code":  "USER_UPDATE_INVALID_ARGUMENT",
			"http_status": http.StatusBadRequest,
		}))
		httpx.Error(c, &model.APIError{
			HTTPStatus: http.StatusBadRequest,
			Code:       "USER_UPDATE_INVALID_ARGUMENT",
			Message:    "user id required",
			Details:    map[string]any{"field": "id"},
		})
		return
	}

	var req model.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		setUserAuditEvent(c, "users.update", userID, buildAuditDetails(map[string]any{
			"result":         "failed",
			"target_user_id": userID,
			"error_code":     "USER_UPDATE_INVALID_ARGUMENT",
			"http_status":    http.StatusBadRequest,
		}))
		httpx.Error(c, &model.APIError{
			HTTPStatus: http.StatusBadRequest,
			Code:       "USER_UPDATE_INVALID_ARGUMENT",
			Message:    "invalid request",
			Details:    map[string]any{"field": "body"},
		})
		return
	}

	apiErr := h.userService.UpdateUser(c.Request.Context(), tenantID, userID, req)
	if apiErr != nil {
		setUserAuditEvent(c, "users.update", userID, buildAuditDetails(map[string]any{
			"result":         "failed",
			"target_user_id": userID,
			"display_name":   req.DisplayName,
			"email":          req.Email,
			"status":         req.Status,
			"error_code":     apiErr.Code,
			"http_status":    apiErr.HTTPStatus,
		}))
		httpx.Error(c, apiErr)
		return
	}
	setUserAuditEvent(c, "users.update", userID, buildAuditDetails(map[string]any{
		"result":         "success",
		"target_user_id": userID,
		"display_name":   req.DisplayName,
		"email":          req.Email,
		"status":         req.Status,
		"http_status":    http.StatusOK,
	}))
	httpx.Success(c, http.StatusOK, gin.H{"updated": true})
}

func (h *UserHandler) Delete(c *gin.Context) {
	tenantID := authenticatedTenantID(c)
	userID := c.Param("id")
	if userID == "" {
		setUserAuditEvent(c, "users.delete", "", buildAuditDetails(map[string]any{
			"result":      "failed",
			"error_code":  "USER_DELETE_INVALID_ARGUMENT",
			"http_status": http.StatusBadRequest,
		}))
		httpx.Error(c, &model.APIError{
			HTTPStatus: http.StatusBadRequest,
			Code:       "USER_DELETE_INVALID_ARGUMENT",
			Message:    "user id required",
			Details:    map[string]any{"field": "id"},
		})
		return
	}

	apiErr := h.userService.DisableUser(c.Request.Context(), tenantID, userID)
	if apiErr != nil {
		setUserAuditEvent(c, "users.delete", userID, buildAuditDetails(map[string]any{
			"result":         "failed",
			"target_user_id": userID,
			"error_code":     apiErr.Code,
			"http_status":    apiErr.HTTPStatus,
		}))
		httpx.Error(c, apiErr)
		return
	}
	setUserAuditEvent(c, "users.delete", userID, buildAuditDetails(map[string]any{
		"result":         "success",
		"target_user_id": userID,
		"http_status":    http.StatusOK,
	}))
	httpx.Success(c, http.StatusOK, gin.H{"disabled": true})
}

func (h *UserHandler) BatchUpdateStatus(c *gin.Context) {
	tenantID := authenticatedTenantID(c)

	var req model.BatchUpdateUsersStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		setUserAuditEvent(c, "users.batch_status", "", buildAuditDetails(map[string]any{
			"result":      "failed",
			"error_code":  "USER_BATCH_UPDATE_INVALID_ARGUMENT",
			"http_status": http.StatusBadRequest,
		}))
		httpx.Error(c, &model.APIError{
			HTTPStatus: http.StatusBadRequest,
			Code:       "USER_BATCH_UPDATE_INVALID_ARGUMENT",
			Message:    "invalid request",
			Details:    map[string]any{"field": "body"},
		})
		return
	}

	resp, apiErr := h.userService.BatchUpdateUsersStatus(c.Request.Context(), tenantID, req)
	if apiErr != nil {
		setUserAuditEvent(c, "users.batch_status", "", buildAuditDetails(map[string]any{
			"result":      "failed",
			"user_ids":    req.UserIDs,
			"status":      req.Status,
			"error_code":  apiErr.Code,
			"http_status": apiErr.HTTPStatus,
		}))
		httpx.Error(c, apiErr)
		return
	}
	setUserAuditEvent(c, "users.batch_status", "", buildAuditDetails(map[string]any{
		"result":      "success",
		"user_ids":    req.UserIDs,
		"status":      req.Status,
		"requested":   resp.Requested,
		"updated":     resp.Updated,
		"http_status": http.StatusOK,
	}))
	httpx.Success(c, http.StatusOK, resp)
}

func (h *UserHandler) AssignRole(c *gin.Context) {
	tenantID := authenticatedTenantID(c)
	userID := c.Param("id")
	if userID == "" {
		setUserAuditEvent(c, "users.assign_role", "", buildAuditDetails(map[string]any{
			"result":      "failed",
			"error_code":  "USER_ASSIGN_ROLE_INVALID_ARGUMENT",
			"http_status": http.StatusBadRequest,
		}))
		httpx.Error(c, &model.APIError{
			HTTPStatus: http.StatusBadRequest,
			Code:       "USER_ASSIGN_ROLE_INVALID_ARGUMENT",
			Message:    "user id required",
			Details:    map[string]any{"field": "id"},
		})
		return
	}

	var req model.AssignRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		setUserAuditEvent(c, "users.assign_role", userID, buildAuditDetails(map[string]any{
			"result":         "failed",
			"target_user_id": userID,
			"error_code":     "USER_ASSIGN_ROLE_INVALID_ARGUMENT",
			"http_status":    http.StatusBadRequest,
		}))
		httpx.Error(c, &model.APIError{
			HTTPStatus: http.StatusBadRequest,
			Code:       "USER_ASSIGN_ROLE_INVALID_ARGUMENT",
			Message:    "invalid request",
			Details:    map[string]any{"field": "body"},
		})
		return
	}
	if req.RoleID == "" {
		setUserAuditEvent(c, "users.assign_role", userID, buildAuditDetails(map[string]any{
			"result":         "failed",
			"target_user_id": userID,
			"error_code":     "USER_ASSIGN_ROLE_INVALID_ARGUMENT",
			"http_status":    http.StatusBadRequest,
		}))
		httpx.Error(c, &model.APIError{
			HTTPStatus: http.StatusBadRequest,
			Code:       "USER_ASSIGN_ROLE_INVALID_ARGUMENT",
			Message:    "role_id required",
			Details:    map[string]any{"field": "role_id"},
		})
		return
	}

	apiErr := h.userService.AssignRole(c.Request.Context(), tenantID, userID, req.RoleID)
	if apiErr != nil {
		setUserAuditEvent(c, "users.assign_role", userID, buildAuditDetails(map[string]any{
			"result":         "failed",
			"target_user_id": userID,
			"role_id":        req.RoleID,
			"error_code":     apiErr.Code,
			"http_status":    apiErr.HTTPStatus,
		}))
		httpx.Error(c, apiErr)
		return
	}
	setUserAuditEvent(c, "users.assign_role", userID, buildAuditDetails(map[string]any{
		"result":         "success",
		"target_user_id": userID,
		"role_id":        req.RoleID,
		"http_status":    http.StatusOK,
	}))
	httpx.Success(c, http.StatusOK, gin.H{"assigned": true})
}

func (h *UserHandler) RemoveRole(c *gin.Context) {
	tenantID := authenticatedTenantID(c)
	userID := c.Param("id")
	roleID := c.Param("roleId")
	if userID == "" || roleID == "" {
		setUserAuditEvent(c, "users.remove_role", userID, buildAuditDetails(map[string]any{
			"result":         "failed",
			"target_user_id": userID,
			"role_id":        roleID,
			"error_code":     "USER_REMOVE_ROLE_INVALID_ARGUMENT",
			"http_status":    http.StatusBadRequest,
		}))
		httpx.Error(c, &model.APIError{
			HTTPStatus: http.StatusBadRequest,
			Code:       "USER_REMOVE_ROLE_INVALID_ARGUMENT",
			Message:    "user id and role id required",
			Details:    map[string]any{"field": "id"},
		})
		return
	}

	apiErr := h.userService.RemoveRole(c.Request.Context(), tenantID, userID, roleID)
	if apiErr != nil {
		setUserAuditEvent(c, "users.remove_role", userID, buildAuditDetails(map[string]any{
			"result":         "failed",
			"target_user_id": userID,
			"role_id":        roleID,
			"error_code":     apiErr.Code,
			"http_status":    apiErr.HTTPStatus,
		}))
		httpx.Error(c, apiErr)
		return
	}
	setUserAuditEvent(c, "users.remove_role", userID, buildAuditDetails(map[string]any{
		"result":         "success",
		"target_user_id": userID,
		"role_id":        roleID,
		"http_status":    http.StatusOK,
	}))
	httpx.Success(c, http.StatusOK, gin.H{"removed": true})
}

func (h *UserHandler) ListRoles(c *gin.Context) {
	tenantID := authenticatedTenantID(c)

	resp, apiErr := h.userService.ListRoles(c.Request.Context(), tenantID)
	if apiErr != nil {
		setAuditEvent(c, auditEvent{
			Action:       "roles.list",
			ResourceType: "roles",
			Details: buildAuditDetails(map[string]any{
				"result":      "failed",
				"error_code":  apiErr.Code,
				"http_status": apiErr.HTTPStatus,
			}),
		})
		httpx.Error(c, apiErr)
		return
	}
	setAuditEvent(c, auditEvent{
		Action:       "roles.list",
		ResourceType: "roles",
		Details: buildAuditDetails(map[string]any{
			"result":      "success",
			"count":       len(resp),
			"http_status": http.StatusOK,
		}),
	})
	httpx.Success(c, http.StatusOK, gin.H{"roles": resp})
}

// GetMe returns the current user's info, roles, and permissions.
// Requires authenticated user and tenant context set by auth middleware.
func (h *UserHandler) GetMe(c *gin.Context) {
	userID := authenticatedUserID(c)
	if userID == "" {
		httpx.Error(c, &model.APIError{
			HTTPStatus: http.StatusUnauthorized,
			Code:       "USER_ME_UNAUTHORIZED",
			Message:    "authenticated user context required",
			Details:    map[string]any{"field": "user_id"},
		})
		return
	}

	tenantID := authenticatedTenantID(c)
	if tenantID == "" {
		httpx.Error(c, &model.APIError{
			HTTPStatus: http.StatusUnauthorized,
			Code:       "USER_ME_TENANT_REQUIRED",
			Message:    "authenticated tenant context required",
			Details:    map[string]any{"field": "tenant_id"},
		})
		return
	}

	if hasAuthenticatedAuthorizationSnapshot(c) {
		userData, apiErr := h.userService.GetUser(c.Request.Context(), tenantID, userID)
		if apiErr != nil {
			httpx.Error(c, apiErr)
			return
		}
		httpx.Success(c, http.StatusOK, model.GetMeResponseData{
			User:         userData,
			Roles:        userData.Roles,
			Permissions:  authenticatedPermissions(c),
			Capabilities: authenticatedCapabilities(c),
			Scopes:       authenticatedScopes(c),
			Entitlements: authenticatedEntitlements(c),
			FeatureFlags: authenticatedFeatureFlags(c),
			AuthzEpoch:   authenticatedAuthzEpoch(c),
			ActorFlags:   authenticatedActorFlags(c),
		})
		return
	}

	resp, apiErr := h.userService.GetMe(c.Request.Context(), tenantID, userID)
	if apiErr != nil {
		httpx.Error(c, apiErr)
		return
	}
	httpx.Success(c, http.StatusOK, resp)
}

func setUserAuditEvent(c *gin.Context, action, resourceID string, details map[string]any) {
	setAuditEvent(c, auditEvent{
		Action:       action,
		ResourceType: "users",
		ResourceID:   resourceID,
		Details:      details,
	})
}

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
	tenantID := c.GetHeader("X-Tenant-ID")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	filter := model.ListUsersFilter{
		Query:  strings.TrimSpace(c.Query("query")),
		Status: strings.TrimSpace(c.Query("status")),
		RoleID: strings.TrimSpace(c.Query("role_id")),
	}

	resp, apiErr := h.userService.ListUsers(c.Request.Context(), tenantID, page, pageSize, filter)
	if apiErr != nil {
		httpx.Error(c, apiErr)
		return
	}
	httpx.Success(c, http.StatusOK, resp)
}

func (h *UserHandler) Get(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")
	userID := c.Param("id")
	if userID == "" {
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
		httpx.Error(c, apiErr)
		return
	}
	httpx.Success(c, http.StatusOK, resp)
}

func (h *UserHandler) Create(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")

	var req model.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
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
		httpx.Error(c, apiErr)
		return
	}
	httpx.Success(c, http.StatusCreated, resp)
}

func (h *UserHandler) Update(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")
	userID := c.Param("id")
	if userID == "" {
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
		httpx.Error(c, apiErr)
		return
	}
	httpx.Success(c, http.StatusOK, gin.H{"updated": true})
}

func (h *UserHandler) Delete(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")
	userID := c.Param("id")
	if userID == "" {
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
		httpx.Error(c, apiErr)
		return
	}
	httpx.Success(c, http.StatusOK, gin.H{"disabled": true})
}

func (h *UserHandler) BatchUpdateStatus(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")

	var req model.BatchUpdateUsersStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
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
		httpx.Error(c, apiErr)
		return
	}
	httpx.Success(c, http.StatusOK, resp)
}

func (h *UserHandler) AssignRole(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")
	userID := c.Param("id")
	if userID == "" {
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
		httpx.Error(c, &model.APIError{
			HTTPStatus: http.StatusBadRequest,
			Code:       "USER_ASSIGN_ROLE_INVALID_ARGUMENT",
			Message:    "invalid request",
			Details:    map[string]any{"field": "body"},
		})
		return
	}
	if req.RoleID == "" {
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
		httpx.Error(c, apiErr)
		return
	}
	httpx.Success(c, http.StatusOK, gin.H{"assigned": true})
}

func (h *UserHandler) RemoveRole(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")
	userID := c.Param("id")
	roleID := c.Param("roleId")
	if userID == "" || roleID == "" {
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
		httpx.Error(c, apiErr)
		return
	}
	httpx.Success(c, http.StatusOK, gin.H{"removed": true})
}

func (h *UserHandler) ListRoles(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")

	resp, apiErr := h.userService.ListRoles(c.Request.Context(), tenantID)
	if apiErr != nil {
		httpx.Error(c, apiErr)
		return
	}
	httpx.Success(c, http.StatusOK, gin.H{"roles": resp})
}

// GetMe returns the current user's info, roles, and permissions.
// Requires user_id from context (set by auth middleware) and X-Tenant-ID header.
func (h *UserHandler) GetMe(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		userID = c.GetHeader("X-User-ID")
	}
	userID = strings.TrimSpace(userID)
	if userID == "" {
		httpx.Error(c, &model.APIError{
			HTTPStatus: http.StatusUnauthorized,
			Code:       "USER_ME_UNAUTHORIZED",
			Message:    "user_id required (set by auth middleware or X-User-ID header)",
			Details:    map[string]any{"field": "user_id"},
		})
		return
	}

	tenantID := strings.TrimSpace(c.GetHeader("X-Tenant-ID"))
	if tenantID == "" {
		httpx.Error(c, &model.APIError{
			HTTPStatus: http.StatusBadRequest,
			Code:       "USER_ME_TENANT_REQUIRED",
			Message:    "X-Tenant-ID header is required",
			Details:    map[string]any{"field": "X-Tenant-ID"},
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

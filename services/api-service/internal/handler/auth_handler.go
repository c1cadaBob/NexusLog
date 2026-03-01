package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/nexuslog/api-service/internal/httpx"
	"github.com/nexuslog/api-service/internal/model"
	"github.com/nexuslog/api-service/internal/service"
)

// AuthHandler handles auth endpoints.
type AuthHandler struct {
	authService *service.AuthService
}

func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// Register handles POST /api/v1/auth/register.
func (h *AuthHandler) Register(c *gin.Context) {
	var req model.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, &model.APIError{
			HTTPStatus: http.StatusBadRequest,
			Code:       "AUTH_REGISTER_INVALID_ARGUMENT",
			Message:    "invalid request",
			Details: map[string]any{
				"field": "body",
			},
		})
		return
	}

	resp, apiErr := h.authService.Register(c.Request.Context(), c.GetHeader("X-Tenant-ID"), req)
	if apiErr != nil {
		httpx.Error(c, apiErr)
		return
	}

	httpx.Success(c, http.StatusCreated, resp)
}

// Login handles POST /api/v1/auth/login.
func (h *AuthHandler) Login(c *gin.Context) {
	var req model.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, &model.APIError{
			HTTPStatus: http.StatusBadRequest,
			Code:       "AUTH_LOGIN_INVALID_ARGUMENT",
			Message:    "invalid request",
			Details: map[string]any{
				"field": "body",
			},
		})
		return
	}

	resp, apiErr := h.authService.Login(
		c.Request.Context(),
		c.GetHeader("X-Tenant-ID"),
		req,
		c.ClientIP(),
		c.Request.UserAgent(),
	)
	if apiErr != nil {
		httpx.Error(c, apiErr)
		return
	}

	httpx.Success(c, http.StatusOK, resp)
}

// Refresh handles POST /api/v1/auth/refresh.
func (h *AuthHandler) Refresh(c *gin.Context) {
	var req model.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, &model.APIError{
			HTTPStatus: http.StatusBadRequest,
			Code:       "AUTH_REFRESH_INVALID_ARGUMENT",
			Message:    "invalid request",
			Details: map[string]any{
				"field": "body",
			},
		})
		return
	}

	resp, apiErr := h.authService.Refresh(
		c.Request.Context(),
		c.GetHeader("X-Tenant-ID"),
		req,
		c.ClientIP(),
		c.Request.UserAgent(),
	)
	if apiErr != nil {
		httpx.Error(c, apiErr)
		return
	}

	httpx.Success(c, http.StatusOK, resp)
}

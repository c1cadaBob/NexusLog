package model

import (
	"net/http"
	"strings"
)

const (
	// Generic error code.
	ErrorCodeInternalError = "INTERNAL_ERROR"

	// Register.
	ErrorCodeAuthRegisterInvalidArgument  = "AUTH_REGISTER_INVALID_ARGUMENT"
	ErrorCodeAuthRegisterTenantRequired   = "AUTH_REGISTER_TENANT_REQUIRED"
	ErrorCodeAuthRegisterTenantInvalid    = "AUTH_REGISTER_TENANT_INVALID"
	ErrorCodeAuthRegisterTenantNotFound   = "AUTH_REGISTER_TENANT_NOT_FOUND"
	ErrorCodeAuthRegisterUsernameConflict = "AUTH_REGISTER_USERNAME_CONFLICT"
	ErrorCodeAuthRegisterEmailConflict    = "AUTH_REGISTER_EMAIL_CONFLICT"
	ErrorCodeAuthRegisterRateLimited      = "AUTH_REGISTER_RATE_LIMITED"
	ErrorCodeAuthRegisterInternalError    = "AUTH_REGISTER_INTERNAL_ERROR"

	// Login.
	ErrorCodeAuthLoginInvalidArgument    = "AUTH_LOGIN_INVALID_ARGUMENT"
	ErrorCodeAuthLoginTenantRequired     = "AUTH_LOGIN_TENANT_REQUIRED"
	ErrorCodeAuthLoginTenantInvalid      = "AUTH_LOGIN_TENANT_INVALID"
	ErrorCodeAuthLoginTenantNotFound     = "AUTH_LOGIN_TENANT_NOT_FOUND"
	ErrorCodeAuthLoginInvalidCredentials = "AUTH_LOGIN_INVALID_CREDENTIALS"
	ErrorCodeAuthLoginRateLimited        = "AUTH_LOGIN_RATE_LIMITED"
	ErrorCodeAuthLoginInternalError      = "AUTH_LOGIN_INTERNAL_ERROR"

	// Refresh.
	ErrorCodeAuthRefreshInvalidArgument = "AUTH_REFRESH_INVALID_ARGUMENT"
	ErrorCodeAuthRefreshTenantRequired  = "AUTH_REFRESH_TENANT_REQUIRED"
	ErrorCodeAuthRefreshTenantInvalid   = "AUTH_REFRESH_TENANT_INVALID"
	ErrorCodeAuthRefreshTenantNotFound  = "AUTH_REFRESH_TENANT_NOT_FOUND"
	ErrorCodeAuthRefreshInvalidToken    = "AUTH_REFRESH_INVALID_TOKEN"
	ErrorCodeAuthRefreshInternalError   = "AUTH_REFRESH_INTERNAL_ERROR"

	// Logout.
	ErrorCodeAuthLogoutInvalidArgument = "AUTH_LOGOUT_INVALID_ARGUMENT"
	ErrorCodeAuthLogoutTenantRequired  = "AUTH_LOGOUT_TENANT_REQUIRED"
	ErrorCodeAuthLogoutTenantInvalid   = "AUTH_LOGOUT_TENANT_INVALID"
	ErrorCodeAuthLogoutTenantNotFound  = "AUTH_LOGOUT_TENANT_NOT_FOUND"
	ErrorCodeAuthLogoutInvalidToken    = "AUTH_LOGOUT_INVALID_TOKEN"
	ErrorCodeAuthLogoutInternalError   = "AUTH_LOGOUT_INTERNAL_ERROR"

	// Reset-request.
	ErrorCodeAuthResetRequestInvalidArgument = "AUTH_RESET_REQUEST_INVALID_ARGUMENT"
	ErrorCodeAuthResetRequestTenantRequired  = "AUTH_RESET_REQUEST_TENANT_REQUIRED"
	ErrorCodeAuthResetRequestTenantInvalid   = "AUTH_RESET_REQUEST_TENANT_INVALID"
	ErrorCodeAuthResetRequestTenantNotFound  = "AUTH_RESET_REQUEST_TENANT_NOT_FOUND"
	ErrorCodeAuthResetRequestInternalError   = "AUTH_RESET_REQUEST_INTERNAL_ERROR"

	// Reset-confirm.
	ErrorCodeAuthResetConfirmInvalidArgument = "AUTH_RESET_CONFIRM_INVALID_ARGUMENT"
	ErrorCodeAuthResetConfirmTenantRequired  = "AUTH_RESET_CONFIRM_TENANT_REQUIRED"
	ErrorCodeAuthResetConfirmTenantInvalid   = "AUTH_RESET_CONFIRM_TENANT_INVALID"
	ErrorCodeAuthResetConfirmTenantNotFound  = "AUTH_RESET_CONFIRM_TENANT_NOT_FOUND"
	ErrorCodeAuthResetConfirmInvalidToken    = "AUTH_RESET_CONFIRM_INVALID_TOKEN"
	ErrorCodeAuthResetConfirmInternalError   = "AUTH_RESET_CONFIRM_INTERNAL_ERROR"
)

var authErrorStatusCatalog = map[string]int{
	ErrorCodeInternalError: http.StatusInternalServerError,

	ErrorCodeAuthRegisterInvalidArgument:  http.StatusBadRequest,
	ErrorCodeAuthRegisterTenantRequired:   http.StatusBadRequest,
	ErrorCodeAuthRegisterTenantInvalid:    http.StatusBadRequest,
	ErrorCodeAuthRegisterTenantNotFound:   http.StatusNotFound,
	ErrorCodeAuthRegisterUsernameConflict: http.StatusConflict,
	ErrorCodeAuthRegisterEmailConflict:    http.StatusConflict,
	ErrorCodeAuthRegisterRateLimited:      http.StatusTooManyRequests,
	ErrorCodeAuthRegisterInternalError:    http.StatusInternalServerError,

	ErrorCodeAuthLoginInvalidArgument:    http.StatusBadRequest,
	ErrorCodeAuthLoginTenantRequired:     http.StatusBadRequest,
	ErrorCodeAuthLoginTenantInvalid:      http.StatusBadRequest,
	ErrorCodeAuthLoginTenantNotFound:     http.StatusNotFound,
	ErrorCodeAuthLoginInvalidCredentials: http.StatusUnauthorized,
	ErrorCodeAuthLoginRateLimited:        http.StatusTooManyRequests,
	ErrorCodeAuthLoginInternalError:      http.StatusInternalServerError,

	ErrorCodeAuthRefreshInvalidArgument: http.StatusBadRequest,
	ErrorCodeAuthRefreshTenantRequired:  http.StatusBadRequest,
	ErrorCodeAuthRefreshTenantInvalid:   http.StatusBadRequest,
	ErrorCodeAuthRefreshTenantNotFound:  http.StatusNotFound,
	ErrorCodeAuthRefreshInvalidToken:    http.StatusUnauthorized,
	ErrorCodeAuthRefreshInternalError:   http.StatusInternalServerError,

	ErrorCodeAuthLogoutInvalidArgument: http.StatusBadRequest,
	ErrorCodeAuthLogoutTenantRequired:  http.StatusBadRequest,
	ErrorCodeAuthLogoutTenantInvalid:   http.StatusBadRequest,
	ErrorCodeAuthLogoutTenantNotFound:  http.StatusNotFound,
	ErrorCodeAuthLogoutInvalidToken:    http.StatusUnauthorized,
	ErrorCodeAuthLogoutInternalError:   http.StatusInternalServerError,

	ErrorCodeAuthResetRequestInvalidArgument: http.StatusBadRequest,
	ErrorCodeAuthResetRequestTenantRequired:  http.StatusBadRequest,
	ErrorCodeAuthResetRequestTenantInvalid:   http.StatusBadRequest,
	ErrorCodeAuthResetRequestTenantNotFound:  http.StatusNotFound,
	ErrorCodeAuthResetRequestInternalError:   http.StatusInternalServerError,

	ErrorCodeAuthResetConfirmInvalidArgument: http.StatusBadRequest,
	ErrorCodeAuthResetConfirmTenantRequired:  http.StatusBadRequest,
	ErrorCodeAuthResetConfirmTenantInvalid:   http.StatusBadRequest,
	ErrorCodeAuthResetConfirmTenantNotFound:  http.StatusNotFound,
	ErrorCodeAuthResetConfirmInvalidToken:    http.StatusBadRequest,
	ErrorCodeAuthResetConfirmInternalError:   http.StatusInternalServerError,
}

var authErrorMessageCatalog = map[string]string{
	ErrorCodeInternalError: "internal error",

	ErrorCodeAuthRegisterInvalidArgument:  "invalid request",
	ErrorCodeAuthRegisterTenantRequired:   "tenant header required",
	ErrorCodeAuthRegisterTenantInvalid:    "invalid tenant id",
	ErrorCodeAuthRegisterTenantNotFound:   "tenant not found",
	ErrorCodeAuthRegisterUsernameConflict: "username already exists",
	ErrorCodeAuthRegisterEmailConflict:    "email already exists",
	ErrorCodeAuthRegisterRateLimited:      "too many register attempts, retry later",
	ErrorCodeAuthRegisterInternalError:    "internal error",

	ErrorCodeAuthLoginInvalidArgument:    "invalid request",
	ErrorCodeAuthLoginTenantRequired:     "tenant header required",
	ErrorCodeAuthLoginTenantInvalid:      "invalid tenant id",
	ErrorCodeAuthLoginTenantNotFound:     "tenant not found",
	ErrorCodeAuthLoginInvalidCredentials: "username or password is incorrect",
	ErrorCodeAuthLoginRateLimited:        "too many login attempts, retry later",
	ErrorCodeAuthLoginInternalError:      "internal error",

	ErrorCodeAuthRefreshInvalidArgument: "invalid request",
	ErrorCodeAuthRefreshTenantRequired:  "tenant header required",
	ErrorCodeAuthRefreshTenantInvalid:   "invalid tenant id",
	ErrorCodeAuthRefreshTenantNotFound:  "tenant not found",
	ErrorCodeAuthRefreshInvalidToken:    "refresh token invalid or expired",
	ErrorCodeAuthRefreshInternalError:   "internal error",

	ErrorCodeAuthLogoutInvalidArgument: "invalid request",
	ErrorCodeAuthLogoutTenantRequired:  "tenant header required",
	ErrorCodeAuthLogoutTenantInvalid:   "invalid tenant id",
	ErrorCodeAuthLogoutTenantNotFound:  "tenant not found",
	ErrorCodeAuthLogoutInvalidToken:    "refresh token invalid or expired",
	ErrorCodeAuthLogoutInternalError:   "internal error",

	ErrorCodeAuthResetRequestInvalidArgument: "invalid request",
	ErrorCodeAuthResetRequestTenantRequired:  "tenant header required",
	ErrorCodeAuthResetRequestTenantInvalid:   "invalid tenant id",
	ErrorCodeAuthResetRequestTenantNotFound:  "tenant not found",
	ErrorCodeAuthResetRequestInternalError:   "internal error",

	ErrorCodeAuthResetConfirmInvalidArgument: "invalid request",
	ErrorCodeAuthResetConfirmTenantRequired:  "tenant header required",
	ErrorCodeAuthResetConfirmTenantInvalid:   "invalid tenant id",
	ErrorCodeAuthResetConfirmTenantNotFound:  "tenant not found",
	ErrorCodeAuthResetConfirmInvalidToken:    "reset token invalid or expired",
	ErrorCodeAuthResetConfirmInternalError:   "internal error",
}

// NormalizeAPIError ensures unified error envelope semantics for auth endpoints:
// stable status code mapping, non-empty message, and non-nil details object.
func NormalizeAPIError(apiErr *APIError) *APIError {
	if apiErr == nil {
		return &APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       ErrorCodeInternalError,
			Message:    authErrorMessageCatalog[ErrorCodeInternalError],
			Details:    map[string]any{},
		}
	}

	code := strings.TrimSpace(apiErr.Code)
	if code == "" {
		code = ErrorCodeInternalError
	}

	status := apiErr.HTTPStatus
	if expected, ok := authErrorStatusCatalog[code]; ok {
		status = expected
	}
	if status == 0 {
		status = http.StatusInternalServerError
	}

	message := strings.TrimSpace(apiErr.Message)
	if message == "" {
		if defaultMessage, ok := authErrorMessageCatalog[code]; ok {
			message = defaultMessage
		} else {
			message = authErrorMessageCatalog[ErrorCodeInternalError]
		}
	}

	details := apiErr.Details
	if details == nil {
		details = map[string]any{}
	}

	return &APIError{
		HTTPStatus: status,
		Code:       code,
		Message:    message,
		Details:    details,
	}
}

// AuthErrorCatalog returns a copy of auth code -> http status mapping.
func AuthErrorCatalog() map[string]int {
	out := make(map[string]int, len(authErrorStatusCatalog))
	for code, status := range authErrorStatusCatalog {
		out[code] = status
	}
	return out
}

package model

import "fmt"

// RegisterRequest defines request payload for POST /api/v1/auth/register.
type RegisterRequest struct {
	Username    string `json:"username"`
	Password    string `json:"password"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
}

// RegisterResponseData defines successful register response payload.
type RegisterResponseData struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
}

// LoginRequest defines request payload for POST /api/v1/auth/login.
type LoginRequest struct {
	Username   string `json:"username"`
	Password   string `json:"password"`
	RememberMe bool   `json:"remember_me"`
}

// LoginUserData defines successful login response user payload.
type LoginUserData struct {
	UserID      string `json:"user_id"`
	Username    string `json:"username"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
}

// LoginResponseData defines successful login response payload.
type LoginResponseData struct {
	AccessToken  string        `json:"access_token"`
	RefreshToken string        `json:"refresh_token"`
	ExpiresIn    int64         `json:"expires_in"`
	User         LoginUserData `json:"user"`
}

// RefreshRequest defines request payload for POST /api/v1/auth/refresh.
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// RefreshResponseData defines successful refresh response payload.
type RefreshResponseData struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
}

// LogoutRequest defines request payload for POST /api/v1/auth/logout.
type LogoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// LogoutResponseData defines successful logout response payload.
type LogoutResponseData struct {
	LoggedOut bool `json:"logged_out"`
}

// PasswordResetRequestRequest defines payload for POST /api/v1/auth/password/reset-request.
type PasswordResetRequestRequest struct {
	EmailOrUsername string `json:"email_or_username"`
}

// PasswordResetRequestResponseData defines successful reset-request response payload.
type PasswordResetRequestResponseData struct {
	Accepted bool `json:"accepted"`
}

// APIError defines unified API error envelope fields.
type APIError struct {
	HTTPStatus int
	Code       string
	Message    string
	Details    map[string]any
}

func (e *APIError) Error() string {
	if e == nil {
		return ""
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

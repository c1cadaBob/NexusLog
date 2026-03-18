package service

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/google/uuid"

	"github.com/nexuslog/api-service/internal/model"
	"github.com/nexuslog/api-service/internal/repository"
)

const (
	bcryptCost             = 12
	defaultAccessTTL       = 15 * time.Minute
	defaultRefreshTTL      = 7 * 24 * time.Hour
	defaultRememberRefresh = 30 * 24 * time.Hour
	defaultResetTokenTTL   = 30 * time.Minute
)

var usernamePattern = regexp.MustCompile(`^[a-zA-Z0-9_][a-zA-Z0-9_.-]{2,31}$`)

type authRepository interface {
	CheckTenantExists(ctx context.Context, tenantID uuid.UUID) (bool, error)
	RegisterUser(ctx context.Context, input repository.RegisterUserInput) (uuid.UUID, string, error)
	GetLoginUserByUsername(ctx context.Context, tenantID uuid.UUID, username string) (repository.LoginUserRecord, error)
	FindUserByEmailOrUsername(ctx context.Context, tenantID uuid.UUID, identifier string) (repository.UserIdentityRecord, error)
	GetRefreshTokenUser(ctx context.Context, tenantID uuid.UUID, refreshToken string) (repository.UserIdentityRecord, error)
	CreatePasswordResetToken(
		ctx context.Context,
		tenantID, userID uuid.UUID,
		rawToken string,
		expiresAt time.Time,
		requestedIP, userAgent string,
	) error
	ConfirmPasswordReset(
		ctx context.Context,
		tenantID uuid.UUID,
		rawToken string,
		passwordHash string,
		passwordCost int,
	) (uuid.UUID, error)
	CreateUserSession(ctx context.Context, input repository.CreateSessionInput) error
	RotateSessionByRefreshToken(ctx context.Context, input repository.RotateSessionInput) (uuid.UUID, error)
	RevokeSessionByRefreshToken(ctx context.Context, tenantID uuid.UUID, refreshToken string) error
	RevokeActiveSessionsByUserID(ctx context.Context, tenantID, userID uuid.UUID) error
	RecordLoginAttempt(ctx context.Context, input repository.LoginAttemptInput) error
	IsLoginLocked(ctx context.Context, tenantID uuid.UUID, username string) (bool, time.Time, error)
}

// AuthService handles auth business logic.
type AuthService struct {
	repo      authRepository
	jwtSecret string
}

func NewAuthService(repo authRepository, jwtSecret string) *AuthService {
	return &AuthService{repo: repo, jwtSecret: jwtSecret}
}

// GenerateAccessToken creates a JWT access token for the given user and tenant.
func (s *AuthService) GenerateAccessToken(userID, tenantID uuid.UUID) (string, error) {
	token, _, err := s.GenerateAccessTokenWithJTI(userID, tenantID, "")
	return token, err
}

// GenerateAccessTokenWithJTI creates a JWT access token and returns the token and effective JTI.
func (s *AuthService) GenerateAccessTokenWithJTI(userID, tenantID uuid.UUID, jti string) (string, string, error) {
	if s.jwtSecret == "" {
		return "", "", errors.New("jwt secret not configured")
	}
	jti = strings.TrimSpace(jti)
	if jti == "" {
		jti = uuid.NewString()
	}
	now := time.Now().UTC()
	claims := &model.JWTClaims{
		UserID:   userID.String(),
		TenantID: tenantID.String(),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(defaultAccessTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			ID:        jti,
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return "", "", err
	}
	return signed, jti, nil
}

// ValidateAccessToken parses and validates a JWT access token, returning claims or error.
func (s *AuthService) ValidateAccessToken(tokenString string) (*model.JWTClaims, error) {
	if s.jwtSecret == "" {
		return nil, errors.New("jwt secret not configured")
	}
	token, err := jwt.ParseWithClaims(tokenString, &model.JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(s.jwtSecret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*model.JWTClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}
	return claims, nil
}

func (s *AuthService) Register(ctx context.Context, tenantHeader string, req model.RegisterRequest) (model.RegisterResponseData, *model.APIError) {
	tenantID, apiErr := parseAndCheckTenant(ctx, s.repo, tenantHeader, "AUTH_REGISTER")
	if apiErr != nil {
		return model.RegisterResponseData{}, apiErr
	}

	normalizedReq, apiErr := normalizeAndValidate(req)
	if apiErr != nil {
		return model.RegisterResponseData{}, apiErr
	}

	hashBytes, err := bcrypt.GenerateFromPassword([]byte(normalizedReq.Password), bcryptCost)
	if err != nil {
		return model.RegisterResponseData{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "AUTH_REGISTER_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}

	userID, username, err := s.repo.RegisterUser(ctx, repository.RegisterUserInput{
		TenantID:     tenantID,
		Username:     normalizedReq.Username,
		Email:        normalizedReq.Email,
		DisplayName:  normalizedReq.DisplayName,
		PasswordHash: string(hashBytes),
		PasswordCost: bcryptCost,
	})
	if err != nil {
		if errors.Is(err, repository.ErrUsernameConflict) {
			return model.RegisterResponseData{}, &model.APIError{
				HTTPStatus: http.StatusConflict,
				Code:       "AUTH_REGISTER_USERNAME_CONFLICT",
				Message:    "username already exists",
				Details: map[string]any{
					"field": "username",
				},
			}
		}
		if errors.Is(err, repository.ErrEmailConflict) {
			return model.RegisterResponseData{}, &model.APIError{
				HTTPStatus: http.StatusConflict,
				Code:       "AUTH_REGISTER_EMAIL_CONFLICT",
				Message:    "email already exists",
				Details: map[string]any{
					"field": "email",
				},
			}
		}
		return model.RegisterResponseData{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "AUTH_REGISTER_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}

	return model.RegisterResponseData{
		UserID:   userID.String(),
		Username: username,
	}, nil
}

func (s *AuthService) Login(ctx context.Context, tenantHeader string, req model.LoginRequest, clientIP, userAgent string) (model.LoginResponseData, *model.APIError) {
	tenantID, apiErr := parseAndCheckTenant(ctx, s.repo, tenantHeader, "AUTH_LOGIN")
	if apiErr != nil {
		return model.LoginResponseData{}, apiErr
	}

	normalizedReq, apiErr := normalizeAndValidateLogin(req)
	if apiErr != nil {
		return model.LoginResponseData{}, apiErr
	}

	locked, lockUntil, err := s.repo.IsLoginLocked(ctx, tenantID, normalizedReq.Username)
	if err != nil {
		return model.LoginResponseData{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "AUTH_LOGIN_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}
	if locked {
		_ = s.repo.RecordLoginAttempt(ctx, repository.LoginAttemptInput{
			TenantID:  tenantID,
			Username:  normalizedReq.Username,
			IPAddress: clientIP,
			UserAgent: userAgent,
			Result:    "locked",
			Reason:    "account_locked",
		})
		return model.LoginResponseData{}, &model.APIError{
			HTTPStatus: http.StatusLocked,
			Code:       "AUTH_LOGIN_LOCKED",
			Message:    "account is temporarily locked",
			Details: map[string]any{
				"lock_until": lockUntil.UTC().Format(time.RFC3339),
			},
		}
	}

	userRec, err := s.repo.GetLoginUserByUsername(ctx, tenantID, normalizedReq.Username)
	if err != nil {
		_ = s.repo.RecordLoginAttempt(ctx, repository.LoginAttemptInput{
			TenantID:  tenantID,
			Username:  normalizedReq.Username,
			IPAddress: clientIP,
			UserAgent: userAgent,
			Result:    "failed",
			Reason:    "user_not_found_or_inactive",
		})
		if errors.Is(err, repository.ErrInvalidCredentials) {
			return model.LoginResponseData{}, &model.APIError{
				HTTPStatus: http.StatusUnauthorized,
				Code:       "AUTH_LOGIN_INVALID_CREDENTIALS",
				Message:    "username or password is incorrect",
			}
		}
		return model.LoginResponseData{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "AUTH_LOGIN_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}

	if err := bcrypt.CompareHashAndPassword([]byte(userRec.PasswordHash), []byte(normalizedReq.Password)); err != nil {
		uid := userRec.UserID
		_ = s.repo.RecordLoginAttempt(ctx, repository.LoginAttemptInput{
			TenantID:  tenantID,
			UserID:    &uid,
			Username:  userRec.Username,
			Email:     userRec.Email,
			IPAddress: clientIP,
			UserAgent: userAgent,
			Result:    "failed",
			Reason:    "password_mismatch",
		})
		return model.LoginResponseData{}, &model.APIError{
			HTTPStatus: http.StatusUnauthorized,
			Code:       model.ErrorCodeAuthLoginInvalidCredentials,
			Message:    "username or password is incorrect",
		}
	}

	loginContext := BuildAuthorizationContext(userRec.Username, nil, nil)
	if !loginContext.ActorFlags["interactive_login_allowed"] {
		uid := userRec.UserID
		_ = s.repo.RecordLoginAttempt(ctx, repository.LoginAttemptInput{
			TenantID:  tenantID,
			UserID:    &uid,
			Username:  userRec.Username,
			Email:     userRec.Email,
			IPAddress: clientIP,
			UserAgent: userAgent,
			Result:    "blocked",
			Reason:    "interactive_login_disallowed",
		})
		return model.LoginResponseData{}, &model.APIError{
			HTTPStatus: http.StatusForbidden,
			Code:       model.ErrorCodeAuthLoginInteractiveDisabled,
			Message:    "interactive login is disabled for this account",
		}
	}

	accessToken, refreshToken, loginErr := s.issueSessionTokens(ctx, tenantID, userRec.UserID, defaultRefreshTTLForRemember(normalizedReq.RememberMe), clientIP, userAgent)
	if loginErr != nil {
		return model.LoginResponseData{}, loginErr
	}

	uid := userRec.UserID
	_ = s.repo.RecordLoginAttempt(ctx, repository.LoginAttemptInput{
		TenantID:  tenantID,
		UserID:    &uid,
		Username:  userRec.Username,
		Email:     userRec.Email,
		IPAddress: clientIP,
		UserAgent: userAgent,
		Result:    "success",
		Reason:    "",
	})

	return model.LoginResponseData{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(defaultAccessTTL.Seconds()),
		User: model.LoginUserData{
			UserID:      userRec.UserID.String(),
			Username:    userRec.Username,
			Email:       userRec.Email,
			DisplayName: userRec.DisplayName,
		},
	}, nil
}

func (s *AuthService) Refresh(ctx context.Context, tenantHeader string, req model.RefreshRequest, clientIP, userAgent string) (model.RefreshResponseData, *model.APIError) {
	tenantID, apiErr := parseAndCheckTenant(ctx, s.repo, tenantHeader, "AUTH_REFRESH")
	if apiErr != nil {
		return model.RefreshResponseData{}, apiErr
	}

	normalizedReq, apiErr := normalizeAndValidateRefresh(req)
	if apiErr != nil {
		return model.RefreshResponseData{}, apiErr
	}

	refreshUser, err := s.repo.GetRefreshTokenUser(ctx, tenantID, normalizedReq.RefreshToken)
	if err != nil {
		if errors.Is(err, repository.ErrInvalidRefreshToken) || errors.Is(err, repository.ErrUserNotFound) {
			return model.RefreshResponseData{}, &model.APIError{
				HTTPStatus: http.StatusUnauthorized,
				Code:       model.ErrorCodeAuthRefreshInvalidToken,
				Message:    "refresh token invalid or expired",
			}
		}
		return model.RefreshResponseData{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       model.ErrorCodeAuthRefreshInternalError,
			Message:    "internal error",
		}
	}
	refreshContext := BuildAuthorizationContext(refreshUser.Username, nil, nil)
	if !refreshContext.ActorFlags["interactive_login_allowed"] {
		return model.RefreshResponseData{}, &model.APIError{
			HTTPStatus: http.StatusForbidden,
			Code:       model.ErrorCodeAuthRefreshInteractiveDisabled,
			Message:    "interactive login is disabled for this account",
		}
	}

	refreshToken, err := newOpaqueToken()
	if err != nil {
		return model.RefreshResponseData{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       model.ErrorCodeAuthRefreshInternalError,
			Message:    "internal error",
		}
	}

	accessTokenJTI := uuid.NewString()
	userID, rotateErr := s.rotateSession(ctx, tenantID, normalizedReq.RefreshToken, refreshToken, accessTokenJTI, clientIP, userAgent)
	if rotateErr != nil {
		if errors.Is(rotateErr, repository.ErrInvalidRefreshToken) {
			return model.RefreshResponseData{}, &model.APIError{
				HTTPStatus: http.StatusUnauthorized,
				Code:       model.ErrorCodeAuthRefreshInvalidToken,
				Message:    "refresh token invalid or expired",
			}
		}
		return model.RefreshResponseData{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       model.ErrorCodeAuthRefreshInternalError,
			Message:    "internal error",
		}
	}
	if refreshUser.UserID != uuid.Nil && refreshUser.UserID != userID {
		return model.RefreshResponseData{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       model.ErrorCodeAuthRefreshInternalError,
			Message:    "internal error",
		}
	}

	accessToken, _, err := s.GenerateAccessTokenWithJTI(userID, tenantID, accessTokenJTI)
	if err != nil {
		return model.RefreshResponseData{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       model.ErrorCodeAuthRefreshInternalError,
			Message:    "internal error",
		}
	}

	return model.RefreshResponseData{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(defaultAccessTTL.Seconds()),
	}, nil
}

func (s *AuthService) Logout(ctx context.Context, tenantHeader, userIDHeader string, req model.LogoutRequest) (model.LogoutResponseData, *model.APIError) {
	tenantID, apiErr := parseAndCheckTenant(ctx, s.repo, tenantHeader, "AUTH_LOGOUT")
	if apiErr != nil {
		return model.LogoutResponseData{}, apiErr
	}

	normalizedReq := normalizeLogout(req)
	if normalizedReq.RefreshToken != "" {
		if err := s.repo.RevokeSessionByRefreshToken(ctx, tenantID, normalizedReq.RefreshToken); err != nil {
			if errors.Is(err, repository.ErrInvalidRefreshToken) {
				return model.LogoutResponseData{}, &model.APIError{
					HTTPStatus: http.StatusUnauthorized,
					Code:       "AUTH_LOGOUT_INVALID_TOKEN",
					Message:    "refresh token invalid or expired",
				}
			}
			return model.LogoutResponseData{}, &model.APIError{
				HTTPStatus: http.StatusInternalServerError,
				Code:       "AUTH_LOGOUT_INTERNAL_ERROR",
				Message:    "internal error",
			}
		}
		return model.LogoutResponseData{LoggedOut: true}, nil
	}

	userIDRaw := strings.TrimSpace(userIDHeader)
	if userIDRaw == "" {
		return model.LogoutResponseData{}, invalidField("user_id", "AUTH_LOGOUT_INVALID_ARGUMENT", "authenticated user context is required")
	}
	userID, err := uuid.Parse(userIDRaw)
	if err != nil {
		return model.LogoutResponseData{}, invalidField("X-User-ID", "AUTH_LOGOUT_INVALID_ARGUMENT", "invalid request")
	}

	if err := s.repo.RevokeActiveSessionsByUserID(ctx, tenantID, userID); err != nil {
		return model.LogoutResponseData{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "AUTH_LOGOUT_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}
	return model.LogoutResponseData{LoggedOut: true}, nil
}

func (s *AuthService) PasswordResetRequest(
	ctx context.Context,
	tenantHeader string,
	req model.PasswordResetRequestRequest,
	clientIP, userAgent string,
) (model.PasswordResetRequestResponseData, *model.APIError) {
	tenantID, apiErr := parseAndCheckTenant(ctx, s.repo, tenantHeader, "AUTH_RESET_REQUEST")
	if apiErr != nil {
		return model.PasswordResetRequestResponseData{}, apiErr
	}

	normalizedReq, apiErr := normalizeAndValidateResetRequest(req)
	if apiErr != nil {
		return model.PasswordResetRequestResponseData{}, apiErr
	}

	userRec, err := s.repo.FindUserByEmailOrUsername(ctx, tenantID, normalizedReq.EmailOrUsername)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return model.PasswordResetRequestResponseData{Accepted: true}, nil
		}
		return model.PasswordResetRequestResponseData{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "AUTH_RESET_REQUEST_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}

	resetToken, err := newOpaqueToken()
	if err != nil {
		return model.PasswordResetRequestResponseData{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "AUTH_RESET_REQUEST_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}

	if err := s.repo.CreatePasswordResetToken(
		ctx,
		tenantID,
		userRec.UserID,
		resetToken,
		time.Now().UTC().Add(defaultResetTokenTTL),
		clientIP,
		userAgent,
	); err != nil {
		return model.PasswordResetRequestResponseData{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "AUTH_RESET_REQUEST_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}

	return model.PasswordResetRequestResponseData{Accepted: true}, nil
}

func (s *AuthService) PasswordResetConfirm(
	ctx context.Context,
	tenantHeader string,
	req model.PasswordResetConfirmRequest,
) (model.PasswordResetConfirmResponseData, *model.APIError) {
	tenantID, apiErr := parseAndCheckTenant(ctx, s.repo, tenantHeader, "AUTH_RESET_CONFIRM")
	if apiErr != nil {
		return model.PasswordResetConfirmResponseData{}, apiErr
	}

	normalizedReq, apiErr := normalizeAndValidateResetConfirm(req)
	if apiErr != nil {
		return model.PasswordResetConfirmResponseData{}, apiErr
	}

	hashBytes, err := bcrypt.GenerateFromPassword([]byte(normalizedReq.NewPassword), bcryptCost)
	if err != nil {
		return model.PasswordResetConfirmResponseData{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "AUTH_RESET_CONFIRM_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}

	if _, err := s.repo.ConfirmPasswordReset(
		ctx,
		tenantID,
		normalizedReq.Token,
		string(hashBytes),
		bcryptCost,
	); err != nil {
		if errors.Is(err, repository.ErrInvalidResetToken) {
			return model.PasswordResetConfirmResponseData{}, &model.APIError{
				HTTPStatus: http.StatusBadRequest,
				Code:       "AUTH_RESET_CONFIRM_INVALID_TOKEN",
				Message:    "reset token invalid or expired",
				Details: map[string]any{
					"field": "token",
				},
			}
		}
		return model.PasswordResetConfirmResponseData{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "AUTH_RESET_CONFIRM_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}

	return model.PasswordResetConfirmResponseData{Reset: true}, nil
}

func (s *AuthService) rotateSession(ctx context.Context, tenantID uuid.UUID, currentRefreshToken, newRefreshToken, accessTokenJTI, clientIP, userAgent string) (uuid.UUID, error) {
	userID, err := s.repo.RotateSessionByRefreshToken(ctx, repository.RotateSessionInput{
		TenantID:       tenantID,
		CurrentRefresh: currentRefreshToken,
		NewRefresh:     newRefreshToken,
		AccessTokenJTI: accessTokenJTI,
		ClientIP:       clientIP,
		UserAgent:      userAgent,
	})
	if err == nil {
		return userID, nil
	}

	if errors.Is(err, repository.ErrSessionTokenConflict) {
		retryRefresh, retryErr := newOpaqueToken()
		if retryErr != nil {
			return uuid.Nil, err
		}
		userID, retryRotateErr := s.repo.RotateSessionByRefreshToken(ctx, repository.RotateSessionInput{
			TenantID:       tenantID,
			CurrentRefresh: currentRefreshToken,
			NewRefresh:     retryRefresh,
			AccessTokenJTI: accessTokenJTI,
			ClientIP:       clientIP,
			UserAgent:      userAgent,
		})
		return userID, retryRotateErr
	}

	return uuid.Nil, err
}

func (s *AuthService) issueSessionTokens(ctx context.Context, tenantID, userID uuid.UUID, refreshTTL time.Duration, clientIP, userAgent string) (string, string, *model.APIError) {
	accessTokenJTI := uuid.NewString()
	accessToken, _, err := s.GenerateAccessTokenWithJTI(userID, tenantID, accessTokenJTI)
	if err != nil {
		return "", "", &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "AUTH_LOGIN_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}

	refreshToken, err := newOpaqueToken()
	if err != nil {
		return "", "", &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "AUTH_LOGIN_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}

	if err := s.repo.CreateUserSession(ctx, repository.CreateSessionInput{
		TenantID:       tenantID,
		UserID:         userID,
		RefreshToken:   refreshToken,
		AccessTokenJTI: accessTokenJTI,
		ClientIP:       clientIP,
		UserAgent:      userAgent,
		ExpiresAt:      time.Now().UTC().Add(refreshTTL),
	}); err != nil {
		if errors.Is(err, repository.ErrSessionTokenConflict) {
			if retryToken, retryErr := newOpaqueToken(); retryErr == nil {
				refreshToken = retryToken
				err = s.repo.CreateUserSession(ctx, repository.CreateSessionInput{
					TenantID:       tenantID,
					UserID:         userID,
					RefreshToken:   refreshToken,
					AccessTokenJTI: accessTokenJTI,
					ClientIP:       clientIP,
					UserAgent:      userAgent,
					ExpiresAt:      time.Now().UTC().Add(refreshTTL),
				})
			}
		}
		if err != nil {
			return "", "", &model.APIError{
				HTTPStatus: http.StatusInternalServerError,
				Code:       "AUTH_LOGIN_INTERNAL_ERROR",
				Message:    "internal error",
			}
		}
	}

	return accessToken, refreshToken, nil
}

func defaultRefreshTTLForRemember(remember bool) time.Duration {
	if remember {
		return defaultRememberRefresh
	}
	return defaultRefreshTTL
}

func normalizeAndValidate(req model.RegisterRequest) (model.RegisterRequest, *model.APIError) {
	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.DisplayName = strings.TrimSpace(req.DisplayName)

	if !usernamePattern.MatchString(req.Username) {
		return model.RegisterRequest{}, invalidField("username", "AUTH_REGISTER_INVALID_ARGUMENT", "invalid request")
	}
	if isReservedUsername(req.Username) {
		return model.RegisterRequest{}, &model.APIError{
			HTTPStatus: http.StatusForbidden,
			Code:       "AUTH_REGISTER_RESERVED_USERNAME",
			Message:    "username is reserved",
			Details:    map[string]any{"field": "username"},
		}
	}

	if len(req.Password) < 8 || len(req.Password) > 72 {
		return model.RegisterRequest{}, invalidField("password", "AUTH_REGISTER_INVALID_ARGUMENT", "invalid request")
	}

	if _, err := mail.ParseAddress(req.Email); err != nil {
		return model.RegisterRequest{}, invalidField("email", "AUTH_REGISTER_INVALID_ARGUMENT", "invalid request")
	}

	if len(req.DisplayName) > 255 {
		return model.RegisterRequest{}, invalidField("display_name", "AUTH_REGISTER_INVALID_ARGUMENT", "invalid request")
	}

	return req, nil
}

func normalizeAndValidateLogin(req model.LoginRequest) (model.LoginRequest, *model.APIError) {
	req.Username = strings.TrimSpace(req.Username)

	if !usernamePattern.MatchString(req.Username) {
		return model.LoginRequest{}, invalidField("username", "AUTH_LOGIN_INVALID_ARGUMENT", "invalid request")
	}

	if len(req.Password) == 0 || len(req.Password) > 72 {
		return model.LoginRequest{}, invalidField("password", "AUTH_LOGIN_INVALID_ARGUMENT", "invalid request")
	}

	return req, nil
}

func normalizeAndValidateRefresh(req model.RefreshRequest) (model.RefreshRequest, *model.APIError) {
	req.RefreshToken = strings.TrimSpace(req.RefreshToken)
	if req.RefreshToken == "" {
		return model.RefreshRequest{}, invalidField("refresh_token", "AUTH_REFRESH_INVALID_ARGUMENT", "invalid request")
	}
	if len(req.RefreshToken) > 2048 {
		return model.RefreshRequest{}, invalidField("refresh_token", "AUTH_REFRESH_INVALID_ARGUMENT", "invalid request")
	}
	return req, nil
}

func normalizeAndValidateResetRequest(req model.PasswordResetRequestRequest) (model.PasswordResetRequestRequest, *model.APIError) {
	req.EmailOrUsername = strings.TrimSpace(req.EmailOrUsername)
	if req.EmailOrUsername == "" {
		return model.PasswordResetRequestRequest{}, invalidField("email_or_username", "AUTH_RESET_REQUEST_INVALID_ARGUMENT", "invalid request")
	}
	if len(req.EmailOrUsername) > 255 {
		return model.PasswordResetRequestRequest{}, invalidField("email_or_username", "AUTH_RESET_REQUEST_INVALID_ARGUMENT", "invalid request")
	}
	return req, nil
}

func normalizeAndValidateResetConfirm(req model.PasswordResetConfirmRequest) (model.PasswordResetConfirmRequest, *model.APIError) {
	req.Token = strings.TrimSpace(req.Token)
	if req.Token == "" {
		return model.PasswordResetConfirmRequest{}, invalidField("token", "AUTH_RESET_CONFIRM_INVALID_ARGUMENT", "invalid request")
	}
	if len(req.Token) > 2048 {
		return model.PasswordResetConfirmRequest{}, invalidField("token", "AUTH_RESET_CONFIRM_INVALID_ARGUMENT", "invalid request")
	}
	if len(req.NewPassword) < 8 || len(req.NewPassword) > 72 {
		return model.PasswordResetConfirmRequest{}, invalidField("new_password", "AUTH_RESET_CONFIRM_INVALID_ARGUMENT", "invalid request")
	}
	return req, nil
}

func normalizeLogout(req model.LogoutRequest) model.LogoutRequest {
	req.RefreshToken = strings.TrimSpace(req.RefreshToken)
	return req
}

func parseAndCheckTenant(ctx context.Context, repo authRepository, tenantHeader, codePrefix string) (uuid.UUID, *model.APIError) {
	tenantRaw := strings.TrimSpace(tenantHeader)
	if tenantRaw == "" {
		return uuid.Nil, &model.APIError{
			HTTPStatus: http.StatusBadRequest,
			Code:       codePrefix + "_TENANT_REQUIRED",
			Message:    "tenant header required",
			Details: map[string]any{
				"field": "X-Tenant-ID",
			},
		}
	}

	tenantID, err := uuid.Parse(tenantRaw)
	if err != nil {
		return uuid.Nil, &model.APIError{
			HTTPStatus: http.StatusBadRequest,
			Code:       codePrefix + "_TENANT_INVALID",
			Message:    "invalid tenant id",
			Details: map[string]any{
				"field": "X-Tenant-ID",
			},
		}
	}

	exists, err := repo.CheckTenantExists(ctx, tenantID)
	if err != nil {
		return uuid.Nil, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       codePrefix + "_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}
	if !exists {
		return uuid.Nil, &model.APIError{
			HTTPStatus: http.StatusNotFound,
			Code:       codePrefix + "_TENANT_NOT_FOUND",
			Message:    "tenant not found",
		}
	}
	return tenantID, nil
}

func invalidField(field, code, message string) *model.APIError {
	return &model.APIError{
		HTTPStatus: http.StatusBadRequest,
		Code:       code,
		Message:    message,
		Details: map[string]any{
			"field": field,
		},
	}
}

func newOpaqueToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

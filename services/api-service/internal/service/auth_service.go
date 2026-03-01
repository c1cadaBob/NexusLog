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
)

var usernamePattern = regexp.MustCompile(`^[a-zA-Z0-9_][a-zA-Z0-9_.-]{2,31}$`)

type authRepository interface {
	CheckTenantExists(ctx context.Context, tenantID uuid.UUID) (bool, error)
	RegisterUser(ctx context.Context, input repository.RegisterUserInput) (uuid.UUID, string, error)
	GetLoginUserByUsername(ctx context.Context, tenantID uuid.UUID, username string) (repository.LoginUserRecord, error)
	CreateUserSession(ctx context.Context, input repository.CreateSessionInput) error
	RecordLoginAttempt(ctx context.Context, input repository.LoginAttemptInput) error
}

// AuthService handles auth business logic.
type AuthService struct {
	repo authRepository
}

func NewAuthService(repo authRepository) *AuthService {
	return &AuthService{repo: repo}
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
			Code:       "AUTH_LOGIN_INVALID_CREDENTIALS",
			Message:    "username or password is incorrect",
		}
	}

	expiresIn := int64(defaultAccessTTL.Seconds())
	refreshTTL := defaultRefreshTTL
	if normalizedReq.RememberMe {
		refreshTTL = defaultRememberRefresh
	}

	accessToken, err := newOpaqueToken()
	if err != nil {
		return model.LoginResponseData{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "AUTH_LOGIN_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}

	refreshToken, err := newOpaqueToken()
	if err != nil {
		return model.LoginResponseData{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "AUTH_LOGIN_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}

	jti := uuid.NewString()
	if err := s.repo.CreateUserSession(ctx, repository.CreateSessionInput{
		TenantID:       tenantID,
		UserID:         userRec.UserID,
		RefreshToken:   refreshToken,
		AccessTokenJTI: jti,
		ClientIP:       clientIP,
		UserAgent:      userAgent,
		ExpiresAt:      time.Now().UTC().Add(refreshTTL),
	}); err != nil {
		if errors.Is(err, repository.ErrSessionTokenConflict) {
			if retryToken, retryErr := newOpaqueToken(); retryErr == nil {
				refreshToken = retryToken
				err = s.repo.CreateUserSession(ctx, repository.CreateSessionInput{
					TenantID:       tenantID,
					UserID:         userRec.UserID,
					RefreshToken:   refreshToken,
					AccessTokenJTI: jti,
					ClientIP:       clientIP,
					UserAgent:      userAgent,
					ExpiresAt:      time.Now().UTC().Add(refreshTTL),
				})
			}
		}
		if err != nil {
			return model.LoginResponseData{}, &model.APIError{
				HTTPStatus: http.StatusInternalServerError,
				Code:       "AUTH_LOGIN_INTERNAL_ERROR",
				Message:    "internal error",
			}
		}
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
		ExpiresIn:    expiresIn,
		User: model.LoginUserData{
			UserID:      userRec.UserID.String(),
			Username:    userRec.Username,
			Email:       userRec.Email,
			DisplayName: userRec.DisplayName,
		},
	}, nil
}

func normalizeAndValidate(req model.RegisterRequest) (model.RegisterRequest, *model.APIError) {
	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.DisplayName = strings.TrimSpace(req.DisplayName)

	if !usernamePattern.MatchString(req.Username) {
		return model.RegisterRequest{}, invalidField("username", "AUTH_REGISTER_INVALID_ARGUMENT", "invalid request")
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

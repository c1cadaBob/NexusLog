package service

import (
	"context"
	"errors"
	"net/http"
	"net/mail"
	"regexp"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"github.com/google/uuid"

	"github.com/nexuslog/api-service/internal/model"
	"github.com/nexuslog/api-service/internal/repository"
)

const bcryptCost = 12

var usernamePattern = regexp.MustCompile(`^[a-zA-Z0-9_][a-zA-Z0-9_.-]{2,31}$`)

type authRepository interface {
	CheckTenantExists(ctx context.Context, tenantID uuid.UUID) (bool, error)
	RegisterUser(ctx context.Context, input repository.RegisterUserInput) (uuid.UUID, string, error)
}

// AuthService handles auth business logic.
type AuthService struct {
	repo authRepository
}

func NewAuthService(repo authRepository) *AuthService {
	return &AuthService{repo: repo}
}

func (s *AuthService) Register(ctx context.Context, tenantHeader string, req model.RegisterRequest) (model.RegisterResponseData, *model.APIError) {
	tenantRaw := strings.TrimSpace(tenantHeader)
	if tenantRaw == "" {
		return model.RegisterResponseData{}, &model.APIError{
			HTTPStatus: http.StatusBadRequest,
			Code:       "AUTH_REGISTER_TENANT_REQUIRED",
			Message:    "tenant header required",
			Details: map[string]any{
				"field": "X-Tenant-ID",
			},
		}
	}

	tenantID, err := uuid.Parse(tenantRaw)
	if err != nil {
		return model.RegisterResponseData{}, &model.APIError{
			HTTPStatus: http.StatusBadRequest,
			Code:       "AUTH_REGISTER_TENANT_INVALID",
			Message:    "invalid tenant id",
			Details: map[string]any{
				"field": "X-Tenant-ID",
			},
		}
	}

	normalizedReq, apiErr := normalizeAndValidate(req)
	if apiErr != nil {
		return model.RegisterResponseData{}, apiErr
	}

	exists, err := s.repo.CheckTenantExists(ctx, tenantID)
	if err != nil {
		return model.RegisterResponseData{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "AUTH_REGISTER_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}
	if !exists {
		return model.RegisterResponseData{}, &model.APIError{
			HTTPStatus: http.StatusNotFound,
			Code:       "AUTH_REGISTER_TENANT_NOT_FOUND",
			Message:    "tenant not found",
		}
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

func normalizeAndValidate(req model.RegisterRequest) (model.RegisterRequest, *model.APIError) {
	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.DisplayName = strings.TrimSpace(req.DisplayName)

	if !usernamePattern.MatchString(req.Username) {
		return model.RegisterRequest{}, invalidField("username", "invalid request")
	}

	if len(req.Password) < 8 || len(req.Password) > 72 {
		return model.RegisterRequest{}, invalidField("password", "invalid request")
	}

	if _, err := mail.ParseAddress(req.Email); err != nil {
		return model.RegisterRequest{}, invalidField("email", "invalid request")
	}

	if len(req.DisplayName) > 255 {
		return model.RegisterRequest{}, invalidField("display_name", "invalid request")
	}

	return req, nil
}

func invalidField(field, message string) *model.APIError {
	return &model.APIError{
		HTTPStatus: http.StatusBadRequest,
		Code:       "AUTH_REGISTER_INVALID_ARGUMENT",
		Message:    message,
		Details: map[string]any{
			"field": field,
		},
	}
}

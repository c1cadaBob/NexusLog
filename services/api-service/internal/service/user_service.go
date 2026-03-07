package service

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode"

	"golang.org/x/crypto/bcrypt"

	"github.com/google/uuid"

	"github.com/nexuslog/api-service/internal/model"
	"github.com/nexuslog/api-service/internal/repository"
)

const userBcryptCost = 12

var userUsernamePattern = regexp.MustCompile(`^[a-zA-Z0-9_][a-zA-Z0-9_.-]{2,31}$`)

type userRepository interface {
	CheckTenantExists(ctx context.Context, tenantID uuid.UUID) (bool, error)
	ListUsers(ctx context.Context, tenantID string, page, pageSize int, filter repository.ListUsersFilter) ([]repository.UserRecord, int, error)
	GetUser(ctx context.Context, tenantID, userID string) (*repository.UserRecord, error)
	CreateUser(ctx context.Context, input repository.CreateUserInput) (string, error)
	UpdateUser(ctx context.Context, tenantID, userID string, input repository.UpdateUserInput) error
	DisableUser(ctx context.Context, tenantID, userID string) error
	BatchUpdateUsersStatus(ctx context.Context, tenantID string, userIDs []uuid.UUID, status string) (int, error)
	AssignRole(ctx context.Context, userID, roleID string) error
	RemoveRole(ctx context.Context, userID, roleID string) error
	ListRoles(ctx context.Context, tenantID string) ([]repository.RoleRecord, error)
	GetUserRoles(ctx context.Context, userID string) ([]repository.RoleRecord, error)
	IsLoginLocked(ctx context.Context, tenantID, username string) (bool, time.Time, error)
}

// UserService handles user business logic.
type UserService struct {
	repo userRepository
}

func NewUserService(repo userRepository) *UserService {
	return &UserService{repo: repo}
}

// IsLoginLocked returns whether the username is locked due to 5 consecutive failed attempts.
// Can be used by auth flow before attempting login.
func (s *UserService) IsLoginLocked(ctx context.Context, tenantID, username string) (bool, time.Time, *model.APIError) {
	locked, until, err := s.repo.IsLoginLocked(ctx, tenantID, username)
	if err != nil {
		return false, time.Time{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "USER_LOGIN_LOCK_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}
	return locked, until, nil
}

func (s *UserService) ListUsers(ctx context.Context, tenantHeader string, page, pageSize int, filter model.ListUsersFilter) (model.ListUsersResponseData, *model.APIError) {
	tenantID, apiErr := parseAndCheckTenantUser(ctx, s.repo, tenantHeader, "USER")
	if apiErr != nil {
		return model.ListUsersResponseData{}, apiErr
	}

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}

	repoFilter, apiErr := normalizeListUsersFilter(filter)
	if apiErr != nil {
		return model.ListUsersResponseData{}, apiErr
	}

	users, total, err := s.repo.ListUsers(ctx, tenantID.String(), page, pageSize, repoFilter)
	if err != nil {
		return model.ListUsersResponseData{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "USER_LIST_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}

	items := make([]model.UserData, 0, len(users))
	for _, u := range users {
		items = append(items, userRecordToData(u, nil))
	}

	return model.ListUsersResponseData{
		Users: items,
		Total: total,
		Page:  page,
		Limit: pageSize,
	}, nil
}

func (s *UserService) GetUser(ctx context.Context, tenantHeader, userID string) (model.UserData, *model.APIError) {
	tenantID, apiErr := parseAndCheckTenantUser(ctx, s.repo, tenantHeader, "USER")
	if apiErr != nil {
		return model.UserData{}, apiErr
	}

	u, err := s.repo.GetUser(ctx, tenantID.String(), userID)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return model.UserData{}, &model.APIError{
				HTTPStatus: http.StatusNotFound,
				Code:       "USER_NOT_FOUND",
				Message:    "user not found",
			}
		}
		return model.UserData{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "USER_GET_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}

	roles, _ := s.repo.GetUserRoles(ctx, userID)
	roleData := make([]model.RoleData, 0, len(roles))
	for _, r := range roles {
		roleData = append(roleData, roleRecordToData(r))
	}

	return userRecordToData(*u, roleData), nil
}

func (s *UserService) CreateUser(ctx context.Context, tenantHeader string, req model.CreateUserRequest) (model.CreateUserResponseData, *model.APIError) {
	tenantID, apiErr := parseAndCheckTenantUser(ctx, s.repo, tenantHeader, "USER")
	if apiErr != nil {
		return model.CreateUserResponseData{}, apiErr
	}

	normalized, apiErr := normalizeAndValidateCreateUser(req)
	if apiErr != nil {
		return model.CreateUserResponseData{}, apiErr
	}

	if apiErr := validatePassword(normalized.Password); apiErr != nil {
		return model.CreateUserResponseData{}, apiErr
	}

	hashBytes, err := bcrypt.GenerateFromPassword([]byte(normalized.Password), userBcryptCost)
	if err != nil {
		return model.CreateUserResponseData{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "USER_CREATE_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}

	id, err := s.repo.CreateUser(ctx, repository.CreateUserInput{
		TenantID:     tenantID,
		Username:     normalized.Username,
		Email:        normalized.Email,
		DisplayName:  normalized.DisplayName,
		PasswordHash: string(hashBytes),
		PasswordCost: userBcryptCost,
	})
	if err != nil {
		if errors.Is(err, repository.ErrUsernameConflict) {
			return model.CreateUserResponseData{}, &model.APIError{
				HTTPStatus: http.StatusConflict,
				Code:       "USER_CREATE_USERNAME_CONFLICT",
				Message:    "username already exists",
				Details:    map[string]any{"field": "username"},
			}
		}
		if errors.Is(err, repository.ErrEmailConflict) {
			return model.CreateUserResponseData{}, &model.APIError{
				HTTPStatus: http.StatusConflict,
				Code:       "USER_CREATE_EMAIL_CONFLICT",
				Message:    "email already exists",
				Details:    map[string]any{"field": "email"},
			}
		}
		return model.CreateUserResponseData{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "USER_CREATE_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}

	if normalized.RoleID != nil && *normalized.RoleID != "" {
		_ = s.repo.AssignRole(ctx, id, *normalized.RoleID)
	}

	return model.CreateUserResponseData{
		ID:       id,
		Username: normalized.Username,
	}, nil
}

func (s *UserService) UpdateUser(ctx context.Context, tenantHeader, userID string, req model.UpdateUserRequest) *model.APIError {
	tenantID, apiErr := parseAndCheckTenantUser(ctx, s.repo, tenantHeader, "USER")
	if apiErr != nil {
		return apiErr
	}

	normalized := normalizeUpdateUser(req)
	if normalized == nil {
		return &model.APIError{
			HTTPStatus: http.StatusBadRequest,
			Code:       "USER_UPDATE_INVALID_ARGUMENT",
			Message:    "no fields to update",
			Details:    map[string]any{"field": "body"},
		}
	}

	err := s.repo.UpdateUser(ctx, tenantID.String(), userID, *normalized)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return &model.APIError{
				HTTPStatus: http.StatusNotFound,
				Code:       "USER_NOT_FOUND",
				Message:    "user not found",
			}
		}
		if errors.Is(err, repository.ErrEmailConflict) {
			return &model.APIError{
				HTTPStatus: http.StatusConflict,
				Code:       "USER_UPDATE_EMAIL_CONFLICT",
				Message:    "email already exists",
				Details:    map[string]any{"field": "email"},
			}
		}
		return &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "USER_UPDATE_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}
	return nil
}

func (s *UserService) DisableUser(ctx context.Context, tenantHeader, userID string) *model.APIError {
	return s.UpdateUser(ctx, tenantHeader, userID, model.UpdateUserRequest{Status: ptr("disabled")})
}

func (s *UserService) BatchUpdateUsersStatus(ctx context.Context, tenantHeader string, req model.BatchUpdateUsersStatusRequest) (model.BatchUpdateUsersStatusResponseData, *model.APIError) {
	tenantID, apiErr := parseAndCheckTenantUser(ctx, s.repo, tenantHeader, "USER")
	if apiErr != nil {
		return model.BatchUpdateUsersStatusResponseData{}, apiErr
	}

	normalizedStatus := strings.TrimSpace(req.Status)
	if normalizedStatus != "active" && normalizedStatus != "disabled" {
		return model.BatchUpdateUsersStatusResponseData{}, invalidFieldUser("status", "USER_BATCH_UPDATE_INVALID_ARGUMENT", "invalid status")
	}

	if len(req.UserIDs) == 0 {
		return model.BatchUpdateUsersStatusResponseData{}, invalidFieldUser("user_ids", "USER_BATCH_UPDATE_INVALID_ARGUMENT", "user_ids required")
	}

	uniqueIDs := make([]uuid.UUID, 0, len(req.UserIDs))
	seen := make(map[uuid.UUID]struct{}, len(req.UserIDs))
	for _, rawID := range req.UserIDs {
		trimmedID := strings.TrimSpace(rawID)
		if trimmedID == "" {
			return model.BatchUpdateUsersStatusResponseData{}, invalidFieldUser("user_ids", "USER_BATCH_UPDATE_INVALID_ARGUMENT", "user_ids contains empty value")
		}
		parsedID, err := uuid.Parse(trimmedID)
		if err != nil {
			return model.BatchUpdateUsersStatusResponseData{}, invalidFieldUser("user_ids", "USER_BATCH_UPDATE_INVALID_ARGUMENT", "user_ids contains invalid uuid")
		}
		if _, exists := seen[parsedID]; exists {
			continue
		}
		seen[parsedID] = struct{}{}
		uniqueIDs = append(uniqueIDs, parsedID)
	}

	updated, err := s.repo.BatchUpdateUsersStatus(ctx, tenantID.String(), uniqueIDs, normalizedStatus)
	if err != nil {
		return model.BatchUpdateUsersStatusResponseData{}, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "USER_BATCH_UPDATE_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}

	return model.BatchUpdateUsersStatusResponseData{
		Requested: len(uniqueIDs),
		Updated:   updated,
		Status:    normalizedStatus,
	}, nil
}

func (s *UserService) AssignRole(ctx context.Context, tenantHeader, userID string, roleID string) *model.APIError {
	tenantID, apiErr := parseAndCheckTenantUser(ctx, s.repo, tenantHeader, "USER")
	if apiErr != nil {
		return apiErr
	}

	_, err := s.repo.GetUser(ctx, tenantID.String(), userID)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return &model.APIError{
				HTTPStatus: http.StatusNotFound,
				Code:       "USER_NOT_FOUND",
				Message:    "user not found",
			}
		}
		return &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "USER_ASSIGN_ROLE_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}

	err = s.repo.AssignRole(ctx, userID, roleID)
	if err != nil {
		if errors.Is(err, repository.ErrRoleConflict) {
			return &model.APIError{
				HTTPStatus: http.StatusConflict,
				Code:       "USER_ASSIGN_ROLE_CONFLICT",
				Message:    "role already assigned",
				Details:    map[string]any{"field": "role_id"},
			}
		}
		if errors.Is(err, repository.ErrRoleNotFound) {
			return &model.APIError{
				HTTPStatus: http.StatusNotFound,
				Code:       "USER_ROLE_NOT_FOUND",
				Message:    "role not found",
				Details:    map[string]any{"field": "role_id"},
			}
		}
		return &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "USER_ASSIGN_ROLE_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}
	return nil
}

func (s *UserService) RemoveRole(ctx context.Context, tenantHeader, userID, roleID string) *model.APIError {
	_, apiErr := parseAndCheckTenantUser(ctx, s.repo, tenantHeader, "USER")
	if apiErr != nil {
		return apiErr
	}

	err := s.repo.RemoveRole(ctx, userID, roleID)
	if err != nil {
		if errors.Is(err, repository.ErrRoleNotFound) {
			return &model.APIError{
				HTTPStatus: http.StatusNotFound,
				Code:       "USER_ROLE_NOT_FOUND",
				Message:    "role not found or not assigned",
				Details:    map[string]any{"field": "role_id"},
			}
		}
		return &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "USER_REMOVE_ROLE_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}
	return nil
}

// GetMe returns the current user's info, roles, and flattened permissions list.
func (s *UserService) GetMe(ctx context.Context, tenantHeader, userID string) (model.GetMeResponseData, *model.APIError) {
	userData, apiErr := s.GetUser(ctx, tenantHeader, userID)
	if apiErr != nil {
		return model.GetMeResponseData{}, apiErr
	}

	permsSet := make(map[string]struct{})
	for _, r := range userData.Roles {
		for _, p := range r.Permissions {
			if p != "" {
				permsSet[p] = struct{}{}
			}
		}
	}
	permissions := make([]string, 0, len(permsSet))
	for p := range permsSet {
		permissions = append(permissions, p)
	}

	return model.GetMeResponseData{
		User:        userData,
		Roles:       userData.Roles,
		Permissions: permissions,
	}, nil
}

func (s *UserService) ListRoles(ctx context.Context, tenantHeader string) ([]model.RoleData, *model.APIError) {
	tenantID, apiErr := parseAndCheckTenantUser(ctx, s.repo, tenantHeader, "USER")
	if apiErr != nil {
		return nil, apiErr
	}

	roles, err := s.repo.ListRoles(ctx, tenantID.String())
	if err != nil {
		return nil, &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "USER_LIST_ROLES_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}

	result := make([]model.RoleData, 0, len(roles))
	for _, r := range roles {
		result = append(result, roleRecordToData(r))
	}
	return result, nil
}

func parseAndCheckTenantUser(ctx context.Context, repo userRepository, tenantHeader, codePrefix string) (uuid.UUID, *model.APIError) {
	tenantRaw := strings.TrimSpace(tenantHeader)
	if tenantRaw == "" {
		return uuid.Nil, &model.APIError{
			HTTPStatus: http.StatusBadRequest,
			Code:       codePrefix + "_TENANT_REQUIRED",
			Message:    "tenant header required",
			Details:    map[string]any{"field": "X-Tenant-ID"},
		}
	}

	tenantID, err := uuid.Parse(tenantRaw)
	if err != nil {
		return uuid.Nil, &model.APIError{
			HTTPStatus: http.StatusBadRequest,
			Code:       codePrefix + "_TENANT_INVALID",
			Message:    "invalid tenant id",
			Details:    map[string]any{"field": "X-Tenant-ID"},
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

func normalizeAndValidateCreateUser(req model.CreateUserRequest) (model.CreateUserRequest, *model.APIError) {
	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.DisplayName = strings.TrimSpace(req.DisplayName)

	if !userUsernamePattern.MatchString(req.Username) {
		return model.CreateUserRequest{}, invalidFieldUser("username", "USER_CREATE_INVALID_ARGUMENT", "invalid username")
	}
	if req.Email == "" {
		return model.CreateUserRequest{}, invalidFieldUser("email", "USER_CREATE_INVALID_ARGUMENT", "email required")
	}
	if len(req.Email) > 255 {
		return model.CreateUserRequest{}, invalidFieldUser("email", "USER_CREATE_INVALID_ARGUMENT", "email too long")
	}
	if len(req.DisplayName) > 255 {
		return model.CreateUserRequest{}, invalidFieldUser("display_name", "USER_CREATE_INVALID_ARGUMENT", "display_name too long")
	}
	if len(req.Password) > 72 {
		return model.CreateUserRequest{}, invalidFieldUser("password", "USER_CREATE_INVALID_ARGUMENT", "password too long")
	}
	return req, nil
}

func normalizeUpdateUser(req model.UpdateUserRequest) *repository.UpdateUserInput {
	var out repository.UpdateUserInput
	hasAny := false
	if req.DisplayName != nil {
		s := strings.TrimSpace(*req.DisplayName)
		out.DisplayName = &s
		hasAny = true
	}
	if req.Email != nil {
		s := strings.ToLower(strings.TrimSpace(*req.Email))
		out.Email = &s
		hasAny = true
	}
	if req.Status != nil {
		s := strings.TrimSpace(*req.Status)
		if s == "active" || s == "disabled" {
			out.Status = &s
			hasAny = true
		}
	}
	if !hasAny {
		return nil
	}
	return &out
}

func normalizeListUsersFilter(filter model.ListUsersFilter) (repository.ListUsersFilter, *model.APIError) {
	query := strings.TrimSpace(filter.Query)
	status := strings.TrimSpace(filter.Status)
	roleID := strings.TrimSpace(filter.RoleID)

	if status != "" && status != "active" && status != "disabled" {
		return repository.ListUsersFilter{}, invalidFieldUser("status", "USER_LIST_INVALID_ARGUMENT", "invalid status")
	}

	repoFilter := repository.ListUsersFilter{
		Query:  query,
		Status: status,
	}
	if roleID != "" {
		parsedRoleID, err := uuid.Parse(roleID)
		if err != nil {
			return repository.ListUsersFilter{}, invalidFieldUser("role_id", "USER_LIST_INVALID_ARGUMENT", "invalid role_id")
		}
		repoFilter.RoleID = &parsedRoleID
	}
	return repoFilter, nil
}

// validatePassword: min 8 chars, must contain 3 of: uppercase, lowercase, digit, special char.
// Returns 422 on weak password.
func validatePassword(password string) *model.APIError {
	if len(password) < 8 {
		return &model.APIError{
			HTTPStatus: http.StatusUnprocessableEntity,
			Code:       "USER_CREATE_WEAK_PASSWORD",
			Message:    "password must be at least 8 characters and contain 3 of: uppercase, lowercase, digit, special character",
			Details:    map[string]any{"field": "password"},
		}
	}

	var upper, lower, digit, special int
	for _, r := range password {
		switch {
		case unicode.IsUpper(r):
			upper = 1
		case unicode.IsLower(r):
			lower = 1
		case unicode.IsNumber(r):
			digit = 1
		case unicode.IsPunct(r) || unicode.IsSymbol(r):
			special = 1
		}
	}
	count := upper + lower + digit + special
	if count < 3 {
		return &model.APIError{
			HTTPStatus: http.StatusUnprocessableEntity,
			Code:       "USER_CREATE_WEAK_PASSWORD",
			Message:    "password must be at least 8 characters and contain 3 of: uppercase, lowercase, digit, special character",
			Details:    map[string]any{"field": "password"},
		}
	}
	return nil
}

func invalidFieldUser(field, code, message string) *model.APIError {
	return &model.APIError{
		HTTPStatus: http.StatusBadRequest,
		Code:       code,
		Message:    message,
		Details:    map[string]any{"field": field},
	}
}

func userRecordToData(u repository.UserRecord, roles []model.RoleData) model.UserData {
	displayName := ""
	if u.DisplayName.Valid {
		displayName = u.DisplayName.String
	}
	lastLoginAt := (*string)(nil)
	if u.LastLoginAt.Valid {
		s := u.LastLoginAt.Time.Format(time.RFC3339)
		lastLoginAt = &s
	}
	return model.UserData{
		ID:          u.ID.String(),
		Username:    u.Username,
		Email:       u.Email,
		DisplayName: displayName,
		Status:      u.Status,
		LastLoginAt: lastLoginAt,
		CreatedAt:   u.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   u.UpdatedAt.Format(time.RFC3339),
		Roles:       roles,
	}
}

func roleRecordToData(r repository.RoleRecord) model.RoleData {
	desc := ""
	if r.Description.Valid {
		desc = r.Description.String
	}
	var perms []string
	if len(r.Permissions) > 0 {
		_ = json.Unmarshal(r.Permissions, &perms)
	}
	return model.RoleData{
		ID:          r.ID.String(),
		Name:        r.Name,
		Description: desc,
		Permissions: perms,
	}
}

func ptr(s string) *string { return &s }

package service

import (
	"context"
	"errors"
	"testing"

	"golang.org/x/crypto/bcrypt"

	"github.com/google/uuid"

	"github.com/nexuslog/api-service/internal/model"
	"github.com/nexuslog/api-service/internal/repository"
)

type mockAuthRepository struct {
	tenantExists      bool
	checkErr          error
	registerErr       error
	userID            uuid.UUID
	username          string
	loginUser         repository.LoginUserRecord
	loginUserErr      error
	createSessionErr  error
	rotateErr         error
	lastLoginAttempt  *repository.LoginAttemptInput
	sessionCreateCall int
	rotateCall        int
}

func (m *mockAuthRepository) CheckTenantExists(_ context.Context, _ uuid.UUID) (bool, error) {
	if m.checkErr != nil {
		return false, m.checkErr
	}
	return m.tenantExists, nil
}

func (m *mockAuthRepository) RegisterUser(_ context.Context, _ repository.RegisterUserInput) (uuid.UUID, string, error) {
	if m.registerErr != nil {
		return uuid.Nil, "", m.registerErr
	}
	return m.userID, m.username, nil
}

func (m *mockAuthRepository) GetLoginUserByUsername(_ context.Context, _ uuid.UUID, _ string) (repository.LoginUserRecord, error) {
	if m.loginUserErr != nil {
		return repository.LoginUserRecord{}, m.loginUserErr
	}
	return m.loginUser, nil
}

func (m *mockAuthRepository) CreateUserSession(_ context.Context, _ repository.CreateSessionInput) error {
	m.sessionCreateCall++
	return m.createSessionErr
}

func (m *mockAuthRepository) RotateSessionByRefreshToken(_ context.Context, _ repository.RotateSessionInput) (uuid.UUID, error) {
	m.rotateCall++
	if m.rotateErr != nil {
		return uuid.Nil, m.rotateErr
	}
	return uuid.New(), nil
}

func (m *mockAuthRepository) RecordLoginAttempt(_ context.Context, input repository.LoginAttemptInput) error {
	cp := input
	m.lastLoginAttempt = &cp
	return nil
}

func TestRegisterValidationAndTenantErrors(t *testing.T) {
	svc := NewAuthService(&mockAuthRepository{tenantExists: true})

	_, err := svc.Register(context.Background(), "", model.RegisterRequest{})
	if err == nil || err.Code != "AUTH_REGISTER_TENANT_REQUIRED" {
		t.Fatalf("expected tenant required error, got %#v", err)
	}

	_, err = svc.Register(context.Background(), "bad-tenant", model.RegisterRequest{})
	if err == nil || err.Code != "AUTH_REGISTER_TENANT_INVALID" {
		t.Fatalf("expected tenant invalid error, got %#v", err)
	}

	_, err = svc.Register(context.Background(), uuid.NewString(), model.RegisterRequest{Username: "ab", Password: "Password123", Email: "a@example.com"})
	if err == nil || err.Code != "AUTH_REGISTER_INVALID_ARGUMENT" {
		t.Fatalf("expected invalid argument for username, got %#v", err)
	}

	_, err = svc.Register(context.Background(), uuid.NewString(), model.RegisterRequest{Username: "valid_user", Password: "short", Email: "a@example.com"})
	if err == nil || err.Code != "AUTH_REGISTER_INVALID_ARGUMENT" {
		t.Fatalf("expected invalid argument for password, got %#v", err)
	}

	_, err = svc.Register(context.Background(), uuid.NewString(), model.RegisterRequest{Username: "valid_user", Password: "Password123", Email: "bad-email"})
	if err == nil || err.Code != "AUTH_REGISTER_INVALID_ARGUMENT" {
		t.Fatalf("expected invalid argument for email, got %#v", err)
	}
}

func TestRegisterConflictAndSuccess(t *testing.T) {
	tenantID := uuid.NewString()

	svc := NewAuthService(&mockAuthRepository{tenantExists: false})
	_, err := svc.Register(context.Background(), tenantID, model.RegisterRequest{Username: "valid_user", Password: "Password123", Email: "a@example.com"})
	if err == nil || err.Code != "AUTH_REGISTER_TENANT_NOT_FOUND" {
		t.Fatalf("expected tenant not found, got %#v", err)
	}

	svc = NewAuthService(&mockAuthRepository{tenantExists: true, registerErr: repository.ErrUsernameConflict})
	_, err = svc.Register(context.Background(), tenantID, model.RegisterRequest{Username: "valid_user", Password: "Password123", Email: "a@example.com"})
	if err == nil || err.Code != "AUTH_REGISTER_USERNAME_CONFLICT" {
		t.Fatalf("expected username conflict, got %#v", err)
	}

	svc = NewAuthService(&mockAuthRepository{tenantExists: true, registerErr: repository.ErrEmailConflict})
	_, err = svc.Register(context.Background(), tenantID, model.RegisterRequest{Username: "valid_user", Password: "Password123", Email: "a@example.com"})
	if err == nil || err.Code != "AUTH_REGISTER_EMAIL_CONFLICT" {
		t.Fatalf("expected email conflict, got %#v", err)
	}

	svc = NewAuthService(&mockAuthRepository{tenantExists: true, checkErr: errors.New("db error")})
	_, err = svc.Register(context.Background(), tenantID, model.RegisterRequest{Username: "valid_user", Password: "Password123", Email: "a@example.com"})
	if err == nil || err.Code != "AUTH_REGISTER_INTERNAL_ERROR" {
		t.Fatalf("expected internal error on tenant check, got %#v", err)
	}

	expectedUserID := uuid.New()
	svc = NewAuthService(&mockAuthRepository{tenantExists: true, userID: expectedUserID, username: "valid_user"})
	resp, err := svc.Register(context.Background(), tenantID, model.RegisterRequest{
		Username:    " valid_user ",
		Password:    "Password123",
		Email:       "A@Example.com",
		DisplayName: "Alice",
	})
	if err != nil {
		t.Fatalf("expected success, got error %#v", err)
	}
	if resp.UserID != expectedUserID.String() || resp.Username != "valid_user" {
		t.Fatalf("unexpected success response: %#v", resp)
	}
}

func TestLoginValidationAndTenantErrors(t *testing.T) {
	svc := NewAuthService(&mockAuthRepository{tenantExists: true})

	_, err := svc.Login(context.Background(), "", model.LoginRequest{}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_LOGIN_TENANT_REQUIRED" {
		t.Fatalf("expected tenant required error, got %#v", err)
	}

	_, err = svc.Login(context.Background(), "bad-tenant", model.LoginRequest{}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_LOGIN_TENANT_INVALID" {
		t.Fatalf("expected tenant invalid error, got %#v", err)
	}

	_, err = svc.Login(context.Background(), uuid.NewString(), model.LoginRequest{Username: "ab", Password: "Password123"}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_LOGIN_INVALID_ARGUMENT" {
		t.Fatalf("expected invalid argument for username, got %#v", err)
	}

	_, err = svc.Login(context.Background(), uuid.NewString(), model.LoginRequest{Username: "valid_user", Password: ""}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_LOGIN_INVALID_ARGUMENT" {
		t.Fatalf("expected invalid argument for password, got %#v", err)
	}

	svc = NewAuthService(&mockAuthRepository{tenantExists: false})
	_, err = svc.Login(context.Background(), uuid.NewString(), model.LoginRequest{Username: "valid_user", Password: "Password123"}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_LOGIN_TENANT_NOT_FOUND" {
		t.Fatalf("expected tenant not found, got %#v", err)
	}
}

func TestLoginInvalidCredentialsAndSuccess(t *testing.T) {
	tenantID := uuid.NewString()
	userID := uuid.New()

	hash, hashErr := bcrypt.GenerateFromPassword([]byte("Password123"), bcrypt.DefaultCost)
	if hashErr != nil {
		t.Fatalf("bcrypt hash: %v", hashErr)
	}

	repoMock := &mockAuthRepository{
		tenantExists: true,
		loginUserErr: repository.ErrInvalidCredentials,
	}
	svc := NewAuthService(repoMock)
	_, err := svc.Login(context.Background(), tenantID, model.LoginRequest{Username: "valid_user", Password: "Password123"}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_LOGIN_INVALID_CREDENTIALS" {
		t.Fatalf("expected invalid credentials, got %#v", err)
	}
	if repoMock.lastLoginAttempt == nil || repoMock.lastLoginAttempt.Result != "failed" {
		t.Fatalf("expected failed login attempt record")
	}

	repoMock = &mockAuthRepository{
		tenantExists: true,
		loginUser: repository.LoginUserRecord{
			UserID:       userID,
			Username:     "valid_user",
			Email:        "user@example.com",
			DisplayName:  "User",
			Status:       "active",
			PasswordHash: string(hash),
		},
	}
	svc = NewAuthService(repoMock)
	resp, err := svc.Login(context.Background(), tenantID, model.LoginRequest{Username: "valid_user", Password: "Password123", RememberMe: true}, "127.0.0.1", "ua")
	if err != nil {
		t.Fatalf("expected success, got %#v", err)
	}
	if resp.AccessToken == "" || resp.RefreshToken == "" || resp.ExpiresIn <= 0 {
		t.Fatalf("unexpected token payload: %#v", resp)
	}
	if resp.User.UserID != userID.String() || resp.User.Username != "valid_user" {
		t.Fatalf("unexpected user payload: %#v", resp.User)
	}
	if repoMock.sessionCreateCall != 1 {
		t.Fatalf("expected session create call once, got %d", repoMock.sessionCreateCall)
	}
	if repoMock.lastLoginAttempt == nil || repoMock.lastLoginAttempt.Result != "success" {
		t.Fatalf("expected success login attempt record")
	}

	repoMock = &mockAuthRepository{
		tenantExists: true,
		loginUser: repository.LoginUserRecord{
			UserID:       userID,
			Username:     "valid_user",
			Email:        "user@example.com",
			DisplayName:  "User",
			Status:       "active",
			PasswordHash: string(hash),
		},
		createSessionErr: errors.New("session failed"),
	}
	svc = NewAuthService(repoMock)
	_, err = svc.Login(context.Background(), tenantID, model.LoginRequest{Username: "valid_user", Password: "Password123"}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_LOGIN_INTERNAL_ERROR" {
		t.Fatalf("expected internal error on session create, got %#v", err)
	}
}

func TestRefreshValidationAndRotation(t *testing.T) {
	tenantID := uuid.NewString()

	repoMock := &mockAuthRepository{tenantExists: true}
	svc := NewAuthService(repoMock)

	_, err := svc.Refresh(context.Background(), "", model.RefreshRequest{}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_REFRESH_TENANT_REQUIRED" {
		t.Fatalf("expected tenant required, got %#v", err)
	}

	_, err = svc.Refresh(context.Background(), "bad-tenant", model.RefreshRequest{}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_REFRESH_TENANT_INVALID" {
		t.Fatalf("expected tenant invalid, got %#v", err)
	}

	_, err = svc.Refresh(context.Background(), tenantID, model.RefreshRequest{RefreshToken: ""}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_REFRESH_INVALID_ARGUMENT" {
		t.Fatalf("expected invalid argument, got %#v", err)
	}

	repoMock.rotateErr = repository.ErrInvalidRefreshToken
	_, err = svc.Refresh(context.Background(), tenantID, model.RefreshRequest{RefreshToken: "rt-1"}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_REFRESH_INVALID_TOKEN" {
		t.Fatalf("expected invalid token, got %#v", err)
	}

	repoMock.rotateErr = nil
	resp, err := svc.Refresh(context.Background(), tenantID, model.RefreshRequest{RefreshToken: "rt-2"}, "127.0.0.1", "ua")
	if err != nil {
		t.Fatalf("expected refresh success, got %#v", err)
	}
	if resp.AccessToken == "" || resp.RefreshToken == "" || resp.ExpiresIn <= 0 {
		t.Fatalf("unexpected refresh response: %#v", resp)
	}
	if repoMock.rotateCall == 0 {
		t.Fatalf("expected rotate call")
	}

	repoMock.rotateErr = errors.New("db failed")
	_, err = svc.Refresh(context.Background(), tenantID, model.RefreshRequest{RefreshToken: "rt-3"}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_REFRESH_INTERNAL_ERROR" {
		t.Fatalf("expected internal error, got %#v", err)
	}
}

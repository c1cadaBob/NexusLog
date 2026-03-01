package service

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/nexuslog/api-service/internal/model"
	"github.com/nexuslog/api-service/internal/repository"
)

type mockAuthRepository struct {
	tenantExists bool
	checkErr     error
	registerErr  error
	userID       uuid.UUID
	username     string
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

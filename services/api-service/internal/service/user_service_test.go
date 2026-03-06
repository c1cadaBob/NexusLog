package service

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/nexuslog/api-service/internal/model"
	"github.com/nexuslog/api-service/internal/repository"
)

type mockUserRepository struct {
	tenantExists  bool
	listUsers     []repository.UserRecord
	listTotal     int
	listErr       error
	getUser       *repository.UserRecord
	getUserErr    error
	createUserID  string
	createUserErr error
	updateUserErr error
	assignRoleErr error
	removeRoleErr error
	listRoles     []repository.RoleRecord
	listRolesErr  error
	getUserRoles  []repository.RoleRecord
}

func (m *mockUserRepository) CheckTenantExists(_ context.Context, _ uuid.UUID) (bool, error) {
	return m.tenantExists, nil
}

func (m *mockUserRepository) ListUsers(_ context.Context, _ string, _, _ int) ([]repository.UserRecord, int, error) {
	if m.listErr != nil {
		return nil, 0, m.listErr
	}
	return m.listUsers, m.listTotal, nil
}

func (m *mockUserRepository) GetUser(_ context.Context, _, userID string) (*repository.UserRecord, error) {
	if m.getUserErr != nil {
		return nil, m.getUserErr
	}
	if m.getUser != nil {
		return m.getUser, nil
	}
	return nil, repository.ErrUserNotFound
}

func (m *mockUserRepository) CreateUser(_ context.Context, _ repository.CreateUserInput) (string, error) {
	if m.createUserErr != nil {
		return "", m.createUserErr
	}
	if m.createUserID != "" {
		return m.createUserID, nil
	}
	return uuid.NewString(), nil
}

func (m *mockUserRepository) UpdateUser(_ context.Context, _, _ string, _ repository.UpdateUserInput) error {
	return m.updateUserErr
}

func (m *mockUserRepository) DisableUser(_ context.Context, _, _ string) error {
	return m.updateUserErr
}

func (m *mockUserRepository) AssignRole(_ context.Context, _, _ string) error {
	return m.assignRoleErr
}

func (m *mockUserRepository) RemoveRole(_ context.Context, _, _ string) error {
	return m.removeRoleErr
}

func (m *mockUserRepository) ListRoles(_ context.Context, _ string) ([]repository.RoleRecord, error) {
	if m.listRolesErr != nil {
		return nil, m.listRolesErr
	}
	return m.listRoles, nil
}

func (m *mockUserRepository) GetUserRoles(_ context.Context, _ string) ([]repository.RoleRecord, error) {
	return m.getUserRoles, nil
}

func (m *mockUserRepository) IsLoginLocked(_ context.Context, _, _ string) (bool, time.Time, error) {
	return false, time.Time{}, nil
}

func TestUserServiceCreateUserWeakPassword(t *testing.T) {
	svc := NewUserService(&mockUserRepository{tenantExists: true})
	_, apiErr := svc.CreateUser(context.Background(), uuid.NewString(), model.CreateUserRequest{
		Username: "bob",
		Password: "abc",
		Email:    "bob@example.com",
	})
	if apiErr == nil {
		t.Fatal("expected error for weak password")
	}
	if apiErr.HTTPStatus != 422 {
		t.Fatalf("expected 422, got %d", apiErr.HTTPStatus)
	}
	if apiErr.Code != "USER_CREATE_WEAK_PASSWORD" {
		t.Fatalf("unexpected code: %s", apiErr.Code)
	}
}

func TestUserServiceCreateUserPasswordOnlyTwoCategories(t *testing.T) {
	svc := NewUserService(&mockUserRepository{tenantExists: true})
	_, apiErr := svc.CreateUser(context.Background(), uuid.NewString(), model.CreateUserRequest{
		Username: "bob",
		Password: "abcdefgh",
		Email:    "bob@example.com",
	})
	if apiErr == nil {
		t.Fatal("expected error for password with only 2 categories")
	}
	if apiErr.HTTPStatus != 422 {
		t.Fatalf("expected 422, got %d", apiErr.HTTPStatus)
	}
}

func TestUserServiceCreateUserSuccess(t *testing.T) {
	newID := uuid.NewString()
	svc := NewUserService(&mockUserRepository{
		tenantExists: true,
		createUserID: newID,
	})
	resp, apiErr := svc.CreateUser(context.Background(), uuid.NewString(), model.CreateUserRequest{
		Username: "bob",
		Password: "SecureP@ss1",
		Email:    "bob@example.com",
	})
	if apiErr != nil {
		t.Fatalf("unexpected error: %v", apiErr)
	}
	if resp.ID != newID || resp.Username != "bob" {
		t.Fatalf("unexpected response: %+v", resp)
	}
}

func TestUserServiceCreateUserDuplicateUsername(t *testing.T) {
	svc := NewUserService(&mockUserRepository{
		tenantExists:  true,
		createUserErr: repository.ErrUsernameConflict,
	})
	_, apiErr := svc.CreateUser(context.Background(), uuid.NewString(), model.CreateUserRequest{
		Username: "alice",
		Password: "SecureP@ss1",
		Email:    "alice@example.com",
	})
	if apiErr == nil {
		t.Fatal("expected error for duplicate username")
	}
	if apiErr.HTTPStatus != 409 {
		t.Fatalf("expected 409, got %d", apiErr.HTTPStatus)
	}
}

func TestUserServiceGetUser(t *testing.T) {
	uid := uuid.New()
	now := time.Now()
	svc := NewUserService(&mockUserRepository{
		tenantExists: true,
		getUser: &repository.UserRecord{
			ID:          uid,
			Username:    "alice",
			Email:       "alice@example.com",
			DisplayName: sql.NullString{String: "Alice", Valid: true},
			Status:      "active",
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		getUserRoles: []repository.RoleRecord{
			{ID: uuid.New(), Name: "admin", Description: sql.NullString{Valid: true}},
		},
	})
	resp, apiErr := svc.GetUser(context.Background(), uuid.NewString(), uid.String())
	if apiErr != nil {
		t.Fatalf("unexpected error: %v", apiErr)
	}
	if resp.Username != "alice" || resp.Email != "alice@example.com" {
		t.Fatalf("unexpected response: %+v", resp)
	}
	if len(resp.Roles) != 1 || resp.Roles[0].Name != "admin" {
		t.Fatalf("unexpected roles: %+v", resp.Roles)
	}
}

func TestUserServiceAssignRoleConflict(t *testing.T) {
	uid := uuid.New()
	svc := NewUserService(&mockUserRepository{
		tenantExists:  true,
		getUser:       &repository.UserRecord{ID: uid, Username: "alice", Email: "a@b.com", Status: "active"},
		assignRoleErr: repository.ErrRoleConflict,
	})
	apiErr := svc.AssignRole(context.Background(), uuid.NewString(), uid.String(), uuid.NewString())
	if apiErr == nil {
		t.Fatal("expected error for role conflict")
	}
	if apiErr.HTTPStatus != 409 {
		t.Fatalf("expected 409, got %d", apiErr.HTTPStatus)
	}
}

func TestUserServiceRemoveRoleNotFound(t *testing.T) {
	uid := uuid.New()
	svc := NewUserService(&mockUserRepository{
		tenantExists:  true,
		getUser:       &repository.UserRecord{ID: uid, Username: "alice", Email: "a@b.com", Status: "active"},
		removeRoleErr: repository.ErrRoleNotFound,
	})
	apiErr := svc.RemoveRole(context.Background(), uuid.NewString(), uid.String(), uuid.NewString())
	if apiErr == nil {
		t.Fatal("expected error for role not found")
	}
	if apiErr.HTTPStatus != 404 {
		t.Fatalf("expected 404, got %d", apiErr.HTTPStatus)
	}
}

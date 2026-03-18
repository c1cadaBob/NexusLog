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
	tenantExists           bool
	listUsers              []repository.UserRecord
	listTotal              int
	listErr                error
	lastListFilter         repository.ListUsersFilter
	getUser                *repository.UserRecord
	getUserErr             error
	createUserID           string
	createUserErr          error
	updateUserErr          error
	batchUpdateCount       int
	batchUpdateErr         error
	assignRoleErr          error
	lastAssignTenant       string
	removeRoleErr          error
	lastRemoveTenant       string
	listRoles              []repository.RoleRecord
	listRolesErr           error
	getRole                *repository.RoleRecord
	getRoleErr             error
	getUserRoles           []repository.RoleRecord
	lastGetUserRolesTenant string
}

type mockUserReservedPolicyRepository struct {
	policy       repository.ReservedSubjectPolicyRecord
	err          error
	unavailable  bool
	lastTenantID uuid.UUID
	lastUsername string
}

func (m *mockUserReservedPolicyRepository) LookupReservedUsernamePolicy(_ context.Context, tenantID uuid.UUID, username string) (repository.ReservedSubjectPolicyRecord, error) {
	m.lastTenantID = tenantID
	m.lastUsername = username
	if m.err != nil {
		return repository.ReservedSubjectPolicyRecord{}, m.err
	}
	return m.policy, nil
}

func (m *mockUserReservedPolicyRepository) LookupReservedUsernamePolicyWithAvailability(_ context.Context, tenantID uuid.UUID, username string) (repository.ReservedSubjectPolicyRecord, bool, error) {
	m.lastTenantID = tenantID
	m.lastUsername = username
	if m.err != nil {
		return repository.ReservedSubjectPolicyRecord{}, false, m.err
	}
	return m.policy, !m.unavailable, nil
}

func (m *mockUserRepository) CheckTenantExists(_ context.Context, _ uuid.UUID) (bool, error) {
	return m.tenantExists, nil
}

func (m *mockUserRepository) ListUsers(_ context.Context, _ string, _, _ int, filter repository.ListUsersFilter) ([]repository.UserRecord, int, error) {
	m.lastListFilter = filter
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

func (m *mockUserRepository) BatchUpdateUsersStatus(_ context.Context, _ string, _ []uuid.UUID, _ string) (int, error) {
	if m.batchUpdateErr != nil {
		return 0, m.batchUpdateErr
	}
	return m.batchUpdateCount, nil
}

func (m *mockUserRepository) AssignRole(_ context.Context, tenantID, _, _ string) error {
	m.lastAssignTenant = tenantID
	return m.assignRoleErr
}

func (m *mockUserRepository) RemoveRole(_ context.Context, tenantID, _, _ string) error {
	m.lastRemoveTenant = tenantID
	return m.removeRoleErr
}

func (m *mockUserRepository) ListRoles(_ context.Context, _ string) ([]repository.RoleRecord, error) {
	if m.listRolesErr != nil {
		return nil, m.listRolesErr
	}
	return m.listRoles, nil
}

func (m *mockUserRepository) GetRole(_ context.Context, _, _ string) (*repository.RoleRecord, error) {
	if m.getRoleErr != nil {
		return nil, m.getRoleErr
	}
	if m.getRole != nil {
		return m.getRole, nil
	}
	return nil, repository.ErrRoleNotFound
}

func (m *mockUserRepository) GetUserRoles(_ context.Context, tenantID, _ string) ([]repository.RoleRecord, error) {
	m.lastGetUserRolesTenant = tenantID
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

func TestUserServiceCreateUserRejectsReservedUsername(t *testing.T) {
	svc := NewUserService(&mockUserRepository{tenantExists: true})
	_, apiErr := svc.CreateUser(context.Background(), uuid.NewString(), model.CreateUserRequest{
		Username: reservedUsernameSuperAdmin,
		Password: "SecureP@ss1",
		Email:    "root@example.com",
	})
	if apiErr == nil {
		t.Fatal("expected reserved username error")
	}
	if apiErr.HTTPStatus != 403 || apiErr.Code != "USER_CREATE_RESERVED_USERNAME" {
		t.Fatalf("unexpected error: %+v", apiErr)
	}
}

func TestUserServiceCreateUserFailsClosedWhenReservedPolicySourceUnavailable(t *testing.T) {
	policyRepo := &mockUserReservedPolicyRepository{unavailable: true}
	tenantID := uuid.NewString()
	svc := NewUserService(&mockUserRepository{tenantExists: true}, policyRepo)
	_, apiErr := svc.CreateUser(context.Background(), tenantID, model.CreateUserRequest{
		Username: "tenant_root",
		Password: "SecureP@ss1",
		Email:    "root@example.com",
	})
	if apiErr == nil {
		t.Fatal("expected authorization unavailable error")
	}
	if apiErr.HTTPStatus != 503 || apiErr.Code != "AUTHORIZATION_UNAVAILABLE" {
		t.Fatalf("unexpected error: %+v", apiErr)
	}
}

func TestUserServiceCreateUserRejectsUsernameReservedByPolicy(t *testing.T) {
	policyRepo := &mockUserReservedPolicyRepository{
		policy: repository.ReservedSubjectPolicyRecord{Found: true, Reserved: true},
	}
	tenantID := uuid.NewString()
	svc := NewUserService(&mockUserRepository{tenantExists: true}, policyRepo)
	_, apiErr := svc.CreateUser(context.Background(), tenantID, model.CreateUserRequest{
		Username: "tenant_root",
		Password: "SecureP@ss1",
		Email:    "root@example.com",
	})
	if apiErr == nil {
		t.Fatal("expected reserved username error from policy")
	}
	if apiErr.HTTPStatus != 403 || apiErr.Code != "USER_CREATE_RESERVED_USERNAME" {
		t.Fatalf("unexpected error: %+v", apiErr)
	}
	parsedTenantID, _ := uuid.Parse(tenantID)
	if policyRepo.lastTenantID != parsedTenantID || policyRepo.lastUsername != "tenant_root" {
		t.Fatalf("unexpected lookup args tenant=%s username=%s", policyRepo.lastTenantID, policyRepo.lastUsername)
	}
}

func TestUserServiceCreateUserAssignRoleUsesTenant(t *testing.T) {
	newID := uuid.NewString()
	tenantID := uuid.NewString()
	roleID := uuid.NewString()
	repo := &mockUserRepository{
		tenantExists: true,
		createUserID: newID,
		getRole:      &repository.RoleRecord{ID: uuid.New(), Name: "operator"},
	}
	svc := NewUserService(repo)
	_, apiErr := svc.CreateUser(context.Background(), tenantID, model.CreateUserRequest{
		Username: "bob",
		Password: "SecureP@ss1",
		Email:    "bob@example.com",
		RoleID:   &roleID,
	})
	if apiErr != nil {
		t.Fatalf("unexpected error: %v", apiErr)
	}
	if repo.lastAssignTenant != tenantID {
		t.Fatalf("expected assign role tenant %s, got %s", tenantID, repo.lastAssignTenant)
	}
}

func TestUserServiceGetUser(t *testing.T) {
	uid := uuid.New()
	now := time.Now()
	tenantID := uuid.NewString()
	repo := &mockUserRepository{
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
	}
	svc := NewUserService(repo)
	resp, apiErr := svc.GetUser(context.Background(), tenantID, uid.String())
	if apiErr != nil {
		t.Fatalf("unexpected error: %v", apiErr)
	}
	if resp.Username != "alice" || resp.Email != "alice@example.com" {
		t.Fatalf("unexpected response: %+v", resp)
	}
	if len(resp.Roles) != 1 || resp.Roles[0].Name != "admin" {
		t.Fatalf("unexpected roles: %+v", resp.Roles)
	}
	if repo.lastGetUserRolesTenant != tenantID {
		t.Fatalf("expected get user roles tenant %s, got %s", tenantID, repo.lastGetUserRolesTenant)
	}
}

func TestUserServiceAssignRoleConflict(t *testing.T) {
	uid := uuid.New()
	tenantID := uuid.NewString()
	repo := &mockUserRepository{
		tenantExists:  true,
		getUser:       &repository.UserRecord{ID: uid, Username: "alice", Email: "a@b.com", Status: "active"},
		getRole:       &repository.RoleRecord{ID: uuid.New(), Name: "operator"},
		assignRoleErr: repository.ErrRoleConflict,
	}
	svc := NewUserService(repo)
	apiErr := svc.AssignRole(context.Background(), tenantID, uid.String(), uuid.NewString())
	if apiErr == nil {
		t.Fatal("expected error for role conflict")
	}
	if apiErr.HTTPStatus != 409 {
		t.Fatalf("expected 409, got %d", apiErr.HTTPStatus)
	}
	if repo.lastAssignTenant != tenantID {
		t.Fatalf("expected assign role tenant %s, got %s", tenantID, repo.lastAssignTenant)
	}
}

func TestUserServiceRemoveRoleNotFound(t *testing.T) {
	uid := uuid.New()
	tenantID := uuid.NewString()
	repo := &mockUserRepository{
		tenantExists:  true,
		getUser:       &repository.UserRecord{ID: uid, Username: "alice", Email: "a@b.com", Status: "active"},
		getRole:       &repository.RoleRecord{ID: uuid.New(), Name: "operator"},
		removeRoleErr: repository.ErrRoleNotFound,
	}
	svc := NewUserService(repo)
	apiErr := svc.RemoveRole(context.Background(), tenantID, uid.String(), uuid.NewString())
	if apiErr == nil {
		t.Fatal("expected error for role not found")
	}
	if apiErr.HTTPStatus != 404 {
		t.Fatalf("expected 404, got %d", apiErr.HTTPStatus)
	}
	if repo.lastRemoveTenant != tenantID {
		t.Fatalf("expected remove role tenant %s, got %s", tenantID, repo.lastRemoveTenant)
	}
}

func TestUserServiceUpdateRejectsProtectedUser(t *testing.T) {
	displayName := "New Name"
	svc := NewUserService(&mockUserRepository{
		tenantExists: true,
		getUser: &repository.UserRecord{
			ID:       uuid.New(),
			Username: reservedUsernameSuperAdmin,
			Email:    "superadmin@example.com",
			Status:   "active",
		},
	})
	apiErr := svc.UpdateUser(context.Background(), uuid.NewString(), uuid.NewString(), model.UpdateUserRequest{DisplayName: &displayName})
	if apiErr == nil {
		t.Fatal("expected protected user error")
	}
	if apiErr.HTTPStatus != 403 || apiErr.Code != "USER_UPDATE_PROTECTED" {
		t.Fatalf("unexpected error: %+v", apiErr)
	}
}

func TestUserServiceAssignRoleRejectsProtectedRole(t *testing.T) {
	uid := uuid.New()
	tenantID := uuid.NewString()
	repo := &mockUserRepository{
		tenantExists: true,
		getUser:      &repository.UserRecord{ID: uid, Username: "alice", Email: "a@b.com", Status: "active"},
		getRole:      &repository.RoleRecord{ID: uuid.New(), Name: protectedRoleNameSuperAdmin},
	}
	svc := NewUserService(repo)
	apiErr := svc.AssignRole(context.Background(), tenantID, uid.String(), uuid.NewString())
	if apiErr == nil {
		t.Fatal("expected protected role error")
	}
	if apiErr.HTTPStatus != 403 || apiErr.Code != "USER_ASSIGN_ROLE_PROTECTED_ROLE" {
		t.Fatalf("unexpected error: %+v", apiErr)
	}
}

func TestUserServiceListUsersWithFilters(t *testing.T) {
	now := time.Now()
	repo := &mockUserRepository{
		tenantExists: true,
		listUsers: []repository.UserRecord{
			{ID: uuid.New(), Username: "demo-viewer", Email: "viewer@example.com", Status: "active", CreatedAt: now, UpdatedAt: now},
		},
		listTotal: 1,
	}
	svc := NewUserService(repo)
	roleID := uuid.NewString()
	resp, apiErr := svc.ListUsers(context.Background(), uuid.NewString(), 2, 20, model.ListUsersFilter{
		Query:  "viewer",
		Status: "active",
		RoleID: roleID,
	})
	if apiErr != nil {
		t.Fatalf("unexpected error: %v", apiErr)
	}
	if resp.Total != 1 || len(resp.Users) != 1 {
		t.Fatalf("unexpected response: %+v", resp)
	}
	if repo.lastListFilter.Query != "viewer" || repo.lastListFilter.Status != "active" {
		t.Fatalf("unexpected repository filter: %+v", repo.lastListFilter)
	}
	if repo.lastListFilter.RoleID == nil || repo.lastListFilter.RoleID.String() != roleID {
		t.Fatalf("unexpected role filter: %+v", repo.lastListFilter.RoleID)
	}
	if resp.Page != 2 || resp.Limit != 20 {
		t.Fatalf("unexpected pagination: %+v", resp)
	}
}

func TestUserServiceListUsersRejectsInvalidStatusFilter(t *testing.T) {
	svc := NewUserService(&mockUserRepository{tenantExists: true})
	_, apiErr := svc.ListUsers(context.Background(), uuid.NewString(), 1, 10, model.ListUsersFilter{Status: "archived"})
	if apiErr == nil {
		t.Fatal("expected invalid status error")
	}
	if apiErr.HTTPStatus != 400 || apiErr.Code != "USER_LIST_INVALID_ARGUMENT" {
		t.Fatalf("unexpected error: %+v", apiErr)
	}
}

func TestUserServiceBatchUpdateUsersStatus(t *testing.T) {
	svc := NewUserService(&mockUserRepository{
		tenantExists:     true,
		batchUpdateCount: 2,
	})
	resp, apiErr := svc.BatchUpdateUsersStatus(context.Background(), uuid.NewString(), model.BatchUpdateUsersStatusRequest{
		UserIDs: []string{uuid.NewString(), uuid.NewString()},
		Status:  "disabled",
	})
	if apiErr != nil {
		t.Fatalf("unexpected error: %v", apiErr)
	}
	if resp.Requested != 2 || resp.Updated != 2 || resp.Status != "disabled" {
		t.Fatalf("unexpected response: %+v", resp)
	}
}

func TestUserServiceBatchUpdateUsersStatusRejectsInvalidUserID(t *testing.T) {
	svc := NewUserService(&mockUserRepository{tenantExists: true})
	_, apiErr := svc.BatchUpdateUsersStatus(context.Background(), uuid.NewString(), model.BatchUpdateUsersStatusRequest{
		UserIDs: []string{"not-a-uuid"},
		Status:  "active",
	})
	if apiErr == nil {
		t.Fatal("expected invalid user id error")
	}
	if apiErr.HTTPStatus != 400 || apiErr.Code != "USER_BATCH_UPDATE_INVALID_ARGUMENT" {
		t.Fatalf("unexpected error: %+v", apiErr)
	}
}

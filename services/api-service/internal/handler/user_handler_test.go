package handler

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/nexuslog/api-service/internal/model"
	"github.com/nexuslog/api-service/internal/repository"
	"github.com/nexuslog/api-service/internal/service"
)

type userRepoMock struct {
	tenantExists   bool
	listUsers      []repository.UserRecord
	listTotal      int
	listErr        error
	getUser        *repository.UserRecord
	getUserErr     error
	createUserID   string
	createUserErr  error
	updateUserErr  error
	assignRoleErr  error
	removeRoleErr  error
	listRoles      []repository.RoleRecord
	listRolesErr   error
	getUserRoles   []repository.RoleRecord
}

func (m *userRepoMock) CheckTenantExists(_ context.Context, _ uuid.UUID) (bool, error) {
	return m.tenantExists, nil
}

func (m *userRepoMock) ListUsers(_ context.Context, _ string, _, _ int) ([]repository.UserRecord, int, error) {
	if m.listErr != nil {
		return nil, 0, m.listErr
	}
	return m.listUsers, m.listTotal, nil
}

func (m *userRepoMock) GetUser(_ context.Context, _, userID string) (*repository.UserRecord, error) {
	if m.getUserErr != nil {
		return nil, m.getUserErr
	}
	if m.getUser != nil {
		return m.getUser, nil
	}
	return nil, repository.ErrUserNotFound
}

func (m *userRepoMock) CreateUser(_ context.Context, _ repository.CreateUserInput) (string, error) {
	if m.createUserErr != nil {
		return "", m.createUserErr
	}
	if m.createUserID != "" {
		return m.createUserID, nil
	}
	return uuid.NewString(), nil
}

func (m *userRepoMock) UpdateUser(_ context.Context, _, _ string, _ repository.UpdateUserInput) error {
	return m.updateUserErr
}

func (m *userRepoMock) DisableUser(_ context.Context, _, _ string) error {
	return m.updateUserErr
}

func (m *userRepoMock) AssignRole(_ context.Context, _, _ string) error {
	return m.assignRoleErr
}

func (m *userRepoMock) RemoveRole(_ context.Context, _, _ string) error {
	return m.removeRoleErr
}

func (m *userRepoMock) ListRoles(_ context.Context, _ string) ([]repository.RoleRecord, error) {
	if m.listRolesErr != nil {
		return nil, m.listRolesErr
	}
	return m.listRoles, nil
}

func (m *userRepoMock) GetUserRoles(_ context.Context, _ string) ([]repository.RoleRecord, error) {
	return m.getUserRoles, nil
}

func (m *userRepoMock) IsLoginLocked(_ context.Context, _, _ string) (bool, time.Time, error) {
	return false, time.Time{}, nil
}

func setupUserRouter(h *UserHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	apiV1 := router.Group("/api/v1")
	userV1 := apiV1.Group("/users")
	userV1.GET("", h.List)
	userV1.GET("/:id", h.Get)
	userV1.POST("", h.Create)
	userV1.PUT("/:id", h.Update)
	userV1.DELETE("/:id", h.Delete)
	userV1.POST("/:id/roles", h.AssignRole)
	userV1.DELETE("/:id/roles/:roleId", h.RemoveRole)
	roleV1 := apiV1.Group("/roles")
	roleV1.GET("", h.ListRoles)
	return router
}

func TestCreateUserValidPassword(t *testing.T) {
	mock := &userRepoMock{
		tenantExists:  true,
		createUserID:  uuid.NewString(),
	}
	h := NewUserHandler(service.NewUserService(mock))
	router := setupUserRouter(h)

	payload := model.CreateUserRequest{
		Username:    "bob",
		Password:    "SecureP@ss1",
		Email:       "bob@example.com",
		DisplayName: "Bob",
	}
	raw, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/users", bytes.NewBuffer(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", uuid.NewString())
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", resp.Code, resp.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body["code"] != "OK" {
		t.Fatalf("unexpected code: %v", body["code"])
	}
	data, ok := body["data"].(map[string]any)
	if !ok {
		t.Fatalf("missing data")
	}
	if data["id"] == "" || data["username"] != "bob" {
		t.Fatalf("unexpected data: %#v", data)
	}
}

func TestCreateUserInvalidPassword(t *testing.T) {
	mock := &userRepoMock{tenantExists: true}
	h := NewUserHandler(service.NewUserService(mock))
	router := setupUserRouter(h)

	payload := model.CreateUserRequest{
		Username:    "bob",
		Password:    "weak",
		Email:       "bob@example.com",
		DisplayName: "Bob",
	}
	raw, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/users", bytes.NewBuffer(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", uuid.NewString())
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422 for weak password, got %d: %s", resp.Code, resp.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body["code"] != "USER_CREATE_WEAK_PASSWORD" {
		t.Fatalf("unexpected code: %v", body["code"])
	}
}

func TestCreateUserDuplicateUsernameReturns409(t *testing.T) {
	mock := &userRepoMock{
		tenantExists:  true,
		createUserErr: repository.ErrUsernameConflict,
	}
	h := NewUserHandler(service.NewUserService(mock))
	router := setupUserRouter(h)

	payload := model.CreateUserRequest{
		Username:    "alice",
		Password:    "SecureP@ss1",
		Email:       "alice@example.com",
		DisplayName: "Alice",
	}
	raw, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/users", bytes.NewBuffer(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", uuid.NewString())
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusConflict {
		t.Fatalf("expected 409 for duplicate username, got %d: %s", resp.Code, resp.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body["code"] != "USER_CREATE_USERNAME_CONFLICT" {
		t.Fatalf("unexpected code: %v", body["code"])
	}
}

func TestListUsersPagination(t *testing.T) {
	uid := uuid.New()
	tenantID := uuid.New()
	now := time.Now()
	mock := &userRepoMock{
		tenantExists: true,
		listUsers: []repository.UserRecord{
			{
				ID:          uid,
				TenantID:    tenantID,
				Username:    "alice",
				Email:       "alice@example.com",
				DisplayName: sql.NullString{},
				Status:      "active",
				LastLoginAt: sql.NullTime{},
				CreatedAt:   now,
				UpdatedAt:   now,
			},
		},
		listTotal: 1,
	}
	h := NewUserHandler(service.NewUserService(mock))
	router := setupUserRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users?page=1&page_size=10", nil)
	req.Header.Set("X-Tenant-ID", uuid.NewString())
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body["code"] != "OK" {
		t.Fatalf("unexpected code: %v", body["code"])
	}
	data, ok := body["data"].(map[string]any)
	if !ok {
		t.Fatalf("missing data")
	}
	if data["total"].(float64) != 1 || data["page"].(float64) != 1 || data["limit"].(float64) != 10 {
		t.Fatalf("unexpected pagination: %#v", data)
	}
	users, ok := data["users"].([]any)
	if !ok || len(users) != 1 {
		t.Fatalf("expected 1 user, got %#v", users)
	}
}

func TestAssignRole(t *testing.T) {
	uid := uuid.New()
	tenantID := uuid.New()
	now := time.Now()
	mock := &userRepoMock{
		tenantExists: true,
		getUser: &repository.UserRecord{
			ID:          uid,
			TenantID:    tenantID,
			Username:    "alice",
			Email:       "alice@example.com",
			DisplayName: sql.NullString{},
			Status:      "active",
			LastLoginAt: sql.NullTime{},
			CreatedAt:   now,
			UpdatedAt:   now,
		},
	}
	h := NewUserHandler(service.NewUserService(mock))
	router := setupUserRouter(h)

	payload := model.AssignRoleRequest{RoleID: uuid.NewString()}
	raw, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/users/"+uid.String()+"/roles", bytes.NewBuffer(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", uuid.NewString())
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body["code"] != "OK" {
		t.Fatalf("unexpected code: %v", body["code"])
	}
	data, ok := body["data"].(map[string]any)
	if !ok {
		t.Fatalf("missing data")
	}
	if !data["assigned"].(bool) {
		t.Fatalf("expected assigned=true")
	}
}

func TestGetUserNotFound(t *testing.T) {
	mock := &userRepoMock{
		tenantExists: true,
		getUserErr:   repository.ErrUserNotFound,
	}
	h := NewUserHandler(service.NewUserService(mock))
	router := setupUserRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/"+uuid.NewString(), nil)
	req.Header.Set("X-Tenant-ID", uuid.NewString())
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", resp.Code, resp.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["code"] != "USER_NOT_FOUND" {
		t.Fatalf("unexpected code: %v", body["code"])
	}
}

func TestUpdateUser(t *testing.T) {
	uid := uuid.New()
	tenantID := uuid.New()
	now := time.Now()
	displayName := "Alice Updated"
	mock := &userRepoMock{
		tenantExists:  true,
		getUser:       &repository.UserRecord{ID: uid, TenantID: tenantID, Username: "alice", Email: "alice@example.com", Status: "active", CreatedAt: now, UpdatedAt: now},
		updateUserErr: nil,
	}
	h := NewUserHandler(service.NewUserService(mock))
	router := setupUserRouter(h)

	payload := model.UpdateUserRequest{DisplayName: &displayName}
	raw, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/users/"+uid.String(), bytes.NewBuffer(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", uuid.NewString())
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestDeleteUser(t *testing.T) {
	uid := uuid.New()
	tenantID := uuid.New()
	now := time.Now()
	mock := &userRepoMock{
		tenantExists:  true,
		getUser:       &repository.UserRecord{ID: uid, TenantID: tenantID, Username: "alice", Email: "alice@example.com", Status: "active", CreatedAt: now, UpdatedAt: now},
		updateUserErr: nil,
	}
	h := NewUserHandler(service.NewUserService(mock))
	router := setupUserRouter(h)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/users/"+uid.String(), nil)
	req.Header.Set("X-Tenant-ID", uuid.NewString())
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestListRoles(t *testing.T) {
	rid := uuid.New()
	mock := &userRepoMock{
		tenantExists: true,
		listRoles: []repository.RoleRecord{
			{ID: rid, Name: "admin", Description: sql.NullString{String: "Administrator", Valid: true}, Permissions: []byte("[]")},
		},
	}
	h := NewUserHandler(service.NewUserService(mock))
	router := setupUserRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/roles", nil)
	req.Header.Set("X-Tenant-ID", uuid.NewString())
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	roles, ok := body["data"].(map[string]any)["roles"]
	if !ok {
		t.Fatalf("missing roles in response")
	}
	if len(roles.([]any)) != 1 {
		t.Fatalf("expected 1 role, got %d", len(roles.([]any)))
	}
}

func TestRemoveRole(t *testing.T) {
	uid := uuid.New()
	tenantID := uuid.New()
	roleID := uuid.New()
	now := time.Now()
	mock := &userRepoMock{
		tenantExists: true,
		getUser: &repository.UserRecord{
			ID:          uid,
			TenantID:    tenantID,
			Username:    "alice",
			Email:       "alice@example.com",
			DisplayName: sql.NullString{},
			Status:      "active",
			LastLoginAt: sql.NullTime{},
			CreatedAt:   now,
			UpdatedAt:   now,
		},
	}
	h := NewUserHandler(service.NewUserService(mock))
	router := setupUserRouter(h)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/users/"+uid.String()+"/roles/"+roleID.String(), nil)
	req.Header.Set("X-Tenant-ID", uuid.NewString())
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body["code"] != "OK" {
		t.Fatalf("unexpected code: %v", body["code"])
	}
	data, ok := body["data"].(map[string]any)
	if !ok {
		t.Fatalf("missing data")
	}
	if !data["removed"].(bool) {
		t.Fatalf("expected removed=true")
	}
}

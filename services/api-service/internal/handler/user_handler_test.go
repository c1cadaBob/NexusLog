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
	tenantExists     bool
	listUsers        []repository.UserRecord
	listTotal        int
	listErr          error
	lastListFilter   repository.ListUsersFilter
	getUser          *repository.UserRecord
	getUserErr       error
	createUserID     string
	createUserErr    error
	updateUserErr    error
	batchUpdateCount int
	batchUpdateErr   error
	assignRoleErr    error
	removeRoleErr    error
	listRoles        []repository.RoleRecord
	listRolesErr     error
	getRole          *repository.RoleRecord
	getRoleErr       error
	getUserRoles     []repository.RoleRecord
}

func (m *userRepoMock) CheckTenantExists(_ context.Context, _ uuid.UUID) (bool, error) {
	return m.tenantExists, nil
}

func (m *userRepoMock) ListUsers(_ context.Context, _ string, _, _ int, filter repository.ListUsersFilter) ([]repository.UserRecord, int, error) {
	m.lastListFilter = filter
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

func (m *userRepoMock) BatchUpdateUsersStatus(_ context.Context, _ string, _ []uuid.UUID, _ string) (int, error) {
	if m.batchUpdateErr != nil {
		return 0, m.batchUpdateErr
	}
	return m.batchUpdateCount, nil
}

func (m *userRepoMock) AssignRole(_ context.Context, _, _, _ string) error {
	return m.assignRoleErr
}

func (m *userRepoMock) RemoveRole(_ context.Context, _, _, _ string) error {
	return m.removeRoleErr
}

func (m *userRepoMock) ListRoles(_ context.Context, _ string) ([]repository.RoleRecord, error) {
	if m.listRolesErr != nil {
		return nil, m.listRolesErr
	}
	return m.listRoles, nil
}

func (m *userRepoMock) GetRole(_ context.Context, _, _ string) (*repository.RoleRecord, error) {
	if m.getRoleErr != nil {
		return nil, m.getRoleErr
	}
	if m.getRole != nil {
		return m.getRole, nil
	}
	return nil, repository.ErrRoleNotFound
}

func (m *userRepoMock) GetUserRoles(_ context.Context, _, _ string) ([]repository.RoleRecord, error) {
	return m.getUserRoles, nil
}

func (m *userRepoMock) IsLoginLocked(_ context.Context, _, _ string) (bool, time.Time, error) {
	return false, time.Time{}, nil
}

func setupUserRouter(h *UserHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		if tenantID := c.GetHeader("X-Tenant-ID"); tenantID != "" {
			c.Set(contextKeyTenantID, tenantID)
		}
		c.Next()
	})
	apiV1 := router.Group("/api/v1")
	userV1 := apiV1.Group("/users")
	userV1.GET("", h.List)
	userV1.GET("/me", h.GetMe)
	userV1.POST("/batch/status", h.BatchUpdateStatus)
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
		tenantExists: true,
		createUserID: uuid.NewString(),
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

func TestCreateUserReservedUsernameReturns403(t *testing.T) {
	mock := &userRepoMock{tenantExists: true}
	h := NewUserHandler(service.NewUserService(mock))
	router := setupUserRouter(h)

	payload := model.CreateUserRequest{
		Username:    "sys-superadmin",
		Password:    "SecureP@ss1",
		Email:       "root@example.com",
		DisplayName: "Root",
	}
	raw, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/users", bytes.NewBuffer(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", uuid.NewString())
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", resp.Code, resp.Body.String())
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

func TestListUsersWithServerFilters(t *testing.T) {
	uid := uuid.New()
	tenantID := uuid.New()
	roleID := uuid.New()
	now := time.Now()
	mock := &userRepoMock{
		tenantExists: true,
		listUsers: []repository.UserRecord{
			{
				ID:          uid,
				TenantID:    tenantID,
				Username:    "demo-viewer",
				Email:       "viewer@example.com",
				DisplayName: sql.NullString{String: "Viewer", Valid: true},
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

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users?page=1&page_size=10&query=viewer&status=active&role_id="+roleID.String(), nil)
	req.Header.Set("X-Tenant-ID", uuid.NewString())
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	if mock.lastListFilter.Query != "viewer" || mock.lastListFilter.Status != "active" {
		t.Fatalf("unexpected filter: %+v", mock.lastListFilter)
	}
	if mock.lastListFilter.RoleID == nil || mock.lastListFilter.RoleID.String() != roleID.String() {
		t.Fatalf("unexpected role filter: %+v", mock.lastListFilter.RoleID)
	}
}

func TestAssignRole(t *testing.T) {
	uid := uuid.New()
	tenantID := uuid.New()
	now := time.Now()
	mock := &userRepoMock{
		tenantExists: true,
		getRole:      &repository.RoleRecord{ID: uuid.New(), Name: "operator"},
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

func TestDeleteProtectedUserReturns403(t *testing.T) {
	mock := &userRepoMock{
		tenantExists: true,
		getRole:      &repository.RoleRecord{ID: uuid.New(), Name: "operator"},
		getUser: &repository.UserRecord{
			ID:       uuid.New(),
			Username: "sys-superadmin",
			Email:    "superadmin@example.com",
			Status:   "active",
		},
	}
	h := NewUserHandler(service.NewUserService(mock))
	router := setupUserRouter(h)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/users/"+uuid.NewString(), nil)
	req.Header.Set("X-Tenant-ID", uuid.NewString())
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestBatchUpdateUsersStatus(t *testing.T) {
	mock := &userRepoMock{
		tenantExists:     true,
		batchUpdateCount: 2,
	}
	h := NewUserHandler(service.NewUserService(mock))
	router := setupUserRouter(h)

	payload := model.BatchUpdateUsersStatusRequest{
		UserIDs: []string{uuid.NewString(), uuid.NewString()},
		Status:  "disabled",
	}
	raw, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/users/batch/status", bytes.NewBuffer(raw))
	req.Header.Set("Content-Type", "application/json")
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
	data, ok := body["data"].(map[string]any)
	if !ok {
		t.Fatalf("missing data")
	}
	if data["requested"].(float64) != 2 || data["updated"].(float64) != 2 || data["status"] != "disabled" {
		t.Fatalf("unexpected data: %#v", data)
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
		getRole:      &repository.RoleRecord{ID: uuid.New(), Name: "operator"},
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

func TestGetMeUsesAuthenticatedContext(t *testing.T) {
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
			DisplayName: sql.NullString{String: "Alice", Valid: true},
			Status:      "active",
			LastLoginAt: sql.NullTime{},
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		getUserRoles: []repository.RoleRecord{{
			ID:          uuid.New(),
			TenantID:    tenantID,
			Name:        "viewer",
			Description: sql.NullString{String: "Viewer", Valid: true},
			Permissions: []byte(`["users:read"]`),
		}},
	}
	h := NewUserHandler(service.NewUserService(mock))

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(contextKeyUserID, uid.String())
		c.Set(contextKeyTenantID, tenantID.String())
		c.Next()
	})
	router.GET("/api/v1/users/me", h.GetMe)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/me", nil)
	req.Header.Set("X-Tenant-ID", tenantID.String())
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
	if data["user"].(map[string]any)["id"] != uid.String() {
		t.Fatalf("unexpected user payload: %#v", data["user"])
	}
	roles, ok := data["roles"].([]any)
	if !ok || len(roles) != 1 {
		t.Fatalf("unexpected roles payload: %#v", data["roles"])
	}
	permissions, ok := data["permissions"].([]any)
	if !ok || len(permissions) != 1 || permissions[0] != "users:read" {
		t.Fatalf("unexpected permissions payload: %#v", data["permissions"])
	}
}

func TestGetMeRejectsSpoofedUserHeaderWithoutAuthContext(t *testing.T) {
	h := NewUserHandler(service.NewUserService(&userRepoMock{tenantExists: true}))
	router := setupUserRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/me", nil)
	req.Header.Set("X-Tenant-ID", uuid.NewString())
	req.Header.Set("X-User-ID", uuid.NewString())
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", resp.Code, resp.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body["code"] != "USER_ME_UNAUTHORIZED" {
		t.Fatalf("unexpected code: %v", body["code"])
	}
}

package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/nexuslog/api-service/internal/service"
)

const routeTestJWTSecret = "router-test-secret"

func expectRouteAuthorizationContextQueries(mock sqlmock.Sqlmock, tenantID, userID uuid.UUID) {
	mock.ExpectQuery(`FROM legacy_permission_mapping`).
		WillReturnRows(sqlmock.NewRows([]string{"legacy_permission", "capability_bundle", "scope_bundle", "enabled"}))
	mock.ExpectQuery(`FROM authz_version`).
		WithArgs(tenantID, userID).
		WillReturnError(sql.ErrNoRows)
}

func TestRegisterRoutes_UserCreateAllowsLegacyUsersWriteAlias(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	userID := uuid.New()
	tenantID := uuid.New()
	accessToken := mustIssueRouteAccessToken(t, userID, tenantID, db, mock, "writer", []string{"users:write"})

	router := gin.New()
	registerRoutes(router, db, routeTestJWTSecret)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/users", strings.NewReader(`{"username":`))
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("X-Tenant-ID", tenantID.String())
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRegisterRoutes_UserCreateAllowsDirectCapabilityWithoutLegacyPermission(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	userID := uuid.New()
	tenantID := uuid.New()
	accessToken := mustIssueRouteAccessToken(t, userID, tenantID, db, mock, "cap-writer", []string{"iam.user.create"})

	router := gin.New()
	registerRoutes(router, db, routeTestJWTSecret)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/users", strings.NewReader(`{"username":`))
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("X-Tenant-ID", tenantID.String())
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRegisterRoutes_UserCreateRejectsMissingCapability(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	userID := uuid.New()
	tenantID := uuid.New()
	accessToken := mustIssueRouteAccessToken(t, userID, tenantID, db, mock, "reader", []string{"users:read"})

	router := gin.New()
	registerRoutes(router, db, routeTestJWTSecret)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/users", strings.NewReader(`{"username":`))
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("X-Tenant-ID", tenantID.String())
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRegisterRoutes_UserCreateRejectsOwnedOnlyScope(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	userID := uuid.New()
	tenantID := uuid.New()
	accessToken := mustIssueRouteAccessToken(t, userID, tenantID, db, mock, "owned-writer", []string{"iam.user.create", "owned"})

	router := gin.New()
	registerRoutes(router, db, routeTestJWTSecret)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/users", strings.NewReader(`{"username":`))
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("X-Tenant-ID", tenantID.String())
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", resp.Code, resp.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body["message"] != "insufficient scopes" {
		t.Fatalf("unexpected message: %v", body["message"])
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRegisterRoutes_RoleListAllowsDirectCapabilityWithoutLegacyPermission(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	userID := uuid.New()
	tenantID := uuid.New()
	accessToken := mustIssueRouteAccessToken(t, userID, tenantID, db, mock, "cap-reader", []string{"iam.role.read"})
	mock.ExpectQuery(`SELECT EXISTS\(SELECT 1 FROM obs\.tenant WHERE id = \$1 AND status = 'active'\)`).
		WithArgs(tenantID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	readerPerms, _ := json.Marshal([]string{"users:read"})
	mock.ExpectQuery("SELECT id, tenant_id, name, description, permissions FROM roles").
		WithArgs(tenantID).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "description", "permissions"}).
			AddRow(uuid.New(), tenantID, "viewer", nil, readerPerms))

	router := gin.New()
	registerRoutes(router, db, routeTestJWTSecret)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/roles", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("X-Tenant-ID", tenantID.String())
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRegisterRoutes_RoleListRejectsOwnedOnlyScope(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	userID := uuid.New()
	tenantID := uuid.New()
	accessToken := mustIssueRouteAccessToken(t, userID, tenantID, db, mock, "owned-role-reader", []string{"iam.role.read", "owned"})

	router := gin.New()
	registerRoutes(router, db, routeTestJWTSecret)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/roles", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("X-Tenant-ID", tenantID.String())
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", resp.Code, resp.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body["message"] != "insufficient scopes" {
		t.Fatalf("unexpected message: %v", body["message"])
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRegisterRoutes_UserMeDoesNotRequireUsersRead(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	userID := uuid.New()
	tenantID := uuid.New()
	authSvc := service.NewAuthService(nil, routeTestJWTSecret)
	accessToken, accessTokenJTI, err := authSvc.GenerateAccessTokenWithJTI(userID, tenantID, "")
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}

	mock.ExpectQuery(`FROM user_sessions`).
		WithArgs(tenantID.String(), userID.String(), accessTokenJTI, sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectQuery("SELECT .+ FROM users").
		WithArgs(tenantID, userID).
		WillReturnRows(newUserRows(userID, tenantID, "viewer", "viewer@nexuslog.local"))
	mock.ExpectQuery("SELECT .+ FROM users u.+JOIN user_roles ur.+JOIN roles r").
		WithArgs(tenantID, userID).
		WillReturnRows(newRoleRows(userID, tenantID, []string{"logs:read"}))
	expectRouteAuthorizationContextQueries(mock, tenantID, userID)
	mock.ExpectQuery(`SELECT EXISTS\(SELECT 1 FROM obs\.tenant WHERE id = \$1 AND status = 'active'\)`).
		WithArgs(tenantID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectQuery("SELECT .+ FROM users").
		WithArgs(tenantID, userID).
		WillReturnRows(newUserRows(userID, tenantID, "viewer", "viewer@nexuslog.local"))
	mock.ExpectQuery("SELECT .+ FROM users u.+JOIN user_roles ur.+JOIN roles r").
		WithArgs(tenantID, userID).
		WillReturnRows(newRoleRows(userID, tenantID, []string{"logs:read"}))

	router := gin.New()
	registerRoutes(router, db, routeTestJWTSecret)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/me", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("X-Tenant-ID", tenantID.String())
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", resp.Code, resp.Body.String())
	}

	var body struct {
		Code string `json:"code"`
		Data struct {
			Permissions  []string        `json:"permissions"`
			Capabilities []string        `json:"capabilities"`
			ActorFlags   map[string]bool `json:"actor_flags"`
			AuthzEpoch   int64           `json:"authz_epoch"`
		} `json:"data"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body.Code != "OK" {
		t.Fatalf("unexpected code: %s", body.Code)
	}
	if len(body.Data.Permissions) != 1 || body.Data.Permissions[0] != "logs:read" {
		t.Fatalf("unexpected permissions: %#v", body.Data.Permissions)
	}
	assertRouteContains(t, body.Data.Capabilities, "log.query.read")
	assertRouteNotContains(t, body.Data.Capabilities, "analysis.anomaly.read")
	if body.Data.AuthzEpoch != 1 {
		t.Fatalf("unexpected authz epoch: %d", body.Data.AuthzEpoch)
	}
	if !body.Data.ActorFlags["interactive_login_allowed"] {
		t.Fatalf("unexpected actor flags: %#v", body.Data.ActorFlags)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func mustIssueRouteAccessToken(t *testing.T, userID, tenantID uuid.UUID, _ *sql.DB, mock sqlmock.Sqlmock, username string, permissions []string) string {
	t.Helper()
	authSvc := service.NewAuthService(nil, routeTestJWTSecret)
	accessToken, accessTokenJTI, err := authSvc.GenerateAccessTokenWithJTI(userID, tenantID, "")
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}

	mock.ExpectQuery(`FROM user_sessions`).
		WithArgs(tenantID.String(), userID.String(), accessTokenJTI, sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectQuery("SELECT .+ FROM users").
		WithArgs(tenantID, userID).
		WillReturnRows(newUserRows(userID, tenantID, username, username+"@nexuslog.local"))
	mock.ExpectQuery("SELECT .+ FROM users u.+JOIN user_roles ur.+JOIN roles r").
		WithArgs(tenantID, userID).
		WillReturnRows(newRoleRows(userID, tenantID, permissions))
	expectRouteAuthorizationContextQueries(mock, tenantID, userID)

	return accessToken
}

func newUserRows(userID, tenantID uuid.UUID, username, email string) *sqlmock.Rows {
	return sqlmock.NewRows([]string{"id", "tenant_id", "username", "email", "display_name", "status", "last_login_at", "created_at", "updated_at"}).
		AddRow(userID, tenantID, username, email, nil, "active", nil, time.Now(), time.Now())
}

func newRoleRows(userID, tenantID uuid.UUID, permissions []string) *sqlmock.Rows {
	rawPermissions, _ := json.Marshal(permissions)
	return sqlmock.NewRows([]string{"id", "tenant_id", "name", "description", "permissions"}).
		AddRow(userID, tenantID, "viewer", nil, rawPermissions)
}

func assertRouteContains(t *testing.T, values []string, target string) {
	t.Helper()
	for _, value := range values {
		if value == target {
			return
		}
	}
	t.Fatalf("expected %q in %#v", target, values)
}

func assertRouteNotContains(t *testing.T, values []string, target string) {
	t.Helper()
	for _, value := range values {
		if value == target {
			t.Fatalf("did not expect %q in %#v", target, values)
		}
	}
}

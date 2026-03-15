package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/nexuslog/api-service/internal/service"
)

const routeTestJWTSecret = "router-test-secret"

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
	if len(body.Data.Capabilities) == 0 || body.Data.Capabilities[0] != "analysis.anomaly.read" {
		t.Fatalf("unexpected capabilities: %#v", body.Data.Capabilities)
	}
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

func newUserRows(userID, tenantID uuid.UUID, username, email string) *sqlmock.Rows {
	return sqlmock.NewRows([]string{"id", "tenant_id", "username", "email", "display_name", "status", "last_login_at", "created_at", "updated_at"}).
		AddRow(userID, tenantID, username, email, nil, "active", nil, time.Now(), time.Now())
}

func newRoleRows(userID, tenantID uuid.UUID, permissions []string) *sqlmock.Rows {
	rawPermissions, _ := json.Marshal(permissions)
	return sqlmock.NewRows([]string{"id", "tenant_id", "name", "description", "permissions"}).
		AddRow(userID, tenantID, "viewer", nil, rawPermissions)
}

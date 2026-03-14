package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"github.com/nexuslog/control-plane/internal/middleware"
	"github.com/nexuslog/control-plane/internal/notification"
)

const (
	testRouteJWTSecret = "control-plane-route-test-secret-20260314"
	testRouteTenantID  = "10000000-0000-0000-0000-000000000001"
	testRouteUserID    = "20000000-0000-0000-0000-000000000001"
)

const testAdminRoleExistsQuery = `
	SELECT EXISTS(
		SELECT 1
		FROM users u
		JOIN user_roles ur ON ur.user_id = u.id
		JOIN roles r ON r.id = ur.role_id
		WHERE u.id = $1::uuid
		  AND u.tenant_id = $2::uuid
		  AND u.status = 'active'
		  AND r.tenant_id = $2::uuid
		  AND (
			LOWER(r.name) = 'admin'
			OR COALESCE(r.permissions, '[]'::jsonb) ? '*'
		  )
	)
`

type routeAuthClaims struct {
	UserID   string `json:"user_id"`
	TenantID string `json:"tenant_id"`
	jwt.RegisteredClaims
}

func TestNotificationRoutes_RejectNonAdminUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := newNotificationAdminRouter(db)
	token := mustIssueRouteToken(t, testRouteUserID, testRouteTenantID, "jti-non-admin")

	mock.ExpectQuery(`FROM user_sessions s`).
		WithArgs(testRouteTenantID, testRouteUserID, "jti-non-admin", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectQuery(regexp.QuoteMeta(testAdminRoleExistsQuery)).
		WithArgs(testRouteUserID, testRouteTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/notification/channels", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestNotificationRoutes_AllowAdminUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := newNotificationAdminRouter(db)
	token := mustIssueRouteToken(t, testRouteUserID, testRouteTenantID, "jti-admin")

	mock.ExpectQuery(`FROM user_sessions s`).
		WithArgs(testRouteTenantID, testRouteUserID, "jti-admin", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectQuery(regexp.QuoteMeta(testAdminRoleExistsQuery)).
		WithArgs(testRouteUserID, testRouteTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COUNT(1) FROM notification_channels WHERE tenant_id = $1::uuid`)).
		WithArgs(testRouteTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery(`SELECT id::text, tenant_id::text, name, type, config, enabled,`).
		WithArgs(testRouteTenantID, 0, 20).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "type", "config", "enabled", "created_by", "created_at", "updated_at"}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/notification/channels", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", resp.Code, resp.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body["code"] != "OK" {
		t.Fatalf("unexpected response code: %#v", body["code"])
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func newNotificationAdminRouter(db *sql.DB) *gin.Engine {
	router := gin.New()
	router.Use(middleware.RequireAuthenticatedIdentity(db, testRouteJWTSecret))
	adminRoutes := router.Group("", middleware.RequireAdminRole(db))
	notification.RegisterChannelRoutes(adminRoutes, notification.NewChannelRepository(db), notification.NewSMTPSender())
	return router
}

func mustIssueRouteToken(t *testing.T, userID, tenantID, jti string) string {
	t.Helper()
	now := time.Now().UTC()
	claims := &routeAuthClaims{
		UserID:   userID,
		TenantID: tenantID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(now),
			ID:        jti,
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(testRouteJWTSecret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}

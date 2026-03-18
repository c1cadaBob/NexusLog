package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/nexuslog/data-services/audit-api/internal/handler"
	"github.com/nexuslog/data-services/audit-api/internal/service"
)

const testJWTSecret = "audit-api-route-test-secret-20260318"

type accessClaims struct {
	UserID   string `json:"user_id"`
	TenantID string `json:"tenant_id"`
	jwt.RegisteredClaims
}

func TestRegisterRoutes_AuditLogsAllowsDirectCapability(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	tenantID := "10000000-0000-0000-0000-000000000001"
	userID := "20000000-0000-0000-0000-000000000001"
	token := mustIssueToken(t, tenantID, userID, "jti-audit-capability")
	expectAuthenticatedIdentity(mock, tenantID, userID, "jti-audit-capability", "auditor", []string{"audit.log.read"})

	router := gin.New()
	registerRoutes(router, db, testJWTSecret, handler.NewAuditHandler(service.NewAuditService(nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/audit/logs", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d body=%s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRegisterRoutes_AuditLogsRejectsMissingCapability(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	tenantID := "10000000-0000-0000-0000-000000000001"
	userID := "20000000-0000-0000-0000-000000000002"
	token := mustIssueToken(t, tenantID, userID, "jti-audit-missing-capability")
	expectAuthenticatedIdentity(mock, tenantID, userID, "jti-audit-missing-capability", "writer", []string{"audit:write"})

	router := gin.New()
	registerRoutes(router, db, testJWTSecret, handler.NewAuditHandler(service.NewAuditService(nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/audit/logs", nil)
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

func expectAuthenticatedIdentity(mock sqlmock.Sqlmock, tenantID, userID, jti, username string, permissions []string) {
	mock.ExpectQuery(`FROM user_sessions`).
		WithArgs(tenantID, userID, jti, sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

	rawPermissions, _ := json.Marshal(permissions)
	mock.ExpectQuery(`FROM users u`).
		WithArgs(userID, tenantID).
		WillReturnRows(
			sqlmock.NewRows([]string{"username", "name", "permissions"}).
				AddRow(username, "auditor", rawPermissions),
		)
}

func mustIssueToken(t *testing.T, tenantID, userID, jti string) string {
	t.Helper()
	now := time.Now().UTC()
	claims := &accessClaims{
		UserID:   userID,
		TenantID: tenantID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(now),
			ID:        jti,
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(testJWTSecret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}

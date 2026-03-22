package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/nexuslog/data-services/query-api/internal/handler"
	"github.com/nexuslog/data-services/query-api/internal/service"
)

const testJWTSecret = "query-api-route-test-secret-20260318"

type accessClaims struct {
	UserID   string `json:"user_id"`
	TenantID string `json:"tenant_id"`
	jwt.RegisteredClaims
}

func TestRegisterRoutes_SearchLogsAllowsDirectCapability(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	tenantID := "10000000-0000-0000-0000-000000000001"
	userID := "20000000-0000-0000-0000-000000000001"
	token := mustIssueToken(t, tenantID, userID, "jti-query-capability")
	expectAuthenticatedIdentity(mock, tenantID, userID, "jti-query-capability", "cap-reader", []string{"log.query.read"})

	router := gin.New()
	registerRoutes(
		router,
		db,
		testJWTSecret,
		handler.NewQueryHandler(service.NewQueryService(nil, nil)),
		handler.NewStatsHandler(service.NewStatsService(nil, nil)),
	)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/query/logs", strings.NewReader(`{"keywords":`))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRegisterRoutes_SearchLogsRejectsMissingCapability(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	tenantID := "10000000-0000-0000-0000-000000000001"
	userID := "20000000-0000-0000-0000-000000000002"
	token := mustIssueToken(t, tenantID, userID, "jti-query-missing-capability")
	expectAuthenticatedIdentity(mock, tenantID, userID, "jti-query-missing-capability", "reader", []string{"audit:read"})

	router := gin.New()
	registerRoutes(
		router,
		db,
		testJWTSecret,
		handler.NewQueryHandler(service.NewQueryService(nil, nil)),
		handler.NewStatsHandler(service.NewStatsService(nil, nil)),
	)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/query/logs", strings.NewReader(`{"keywords":`))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRegisterRoutes_ClusterLogsAllowsDirectCapability(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	tenantID := "10000000-0000-0000-0000-000000000001"
	userID := "20000000-0000-0000-0000-000000000003"
	token := mustIssueToken(t, tenantID, userID, "jti-query-clusters-capability")
	expectAuthenticatedIdentity(mock, tenantID, userID, "jti-query-clusters-capability", "cluster-reader", []string{"log.query.aggregate"})

	router := gin.New()
	registerRoutes(
		router,
		db,
		testJWTSecret,
		handler.NewQueryHandler(service.NewQueryService(nil, nil)),
		handler.NewStatsHandler(service.NewStatsService(nil, nil)),
	)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/query/stats/clusters", strings.NewReader(`{"time_range":`))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRegisterRoutes_DetectAnomaliesAllowsDirectCapability(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	tenantID := "10000000-0000-0000-0000-000000000001"
	userID := "20000000-0000-0000-0000-000000000004"
	token := mustIssueToken(t, tenantID, userID, "jti-query-anomalies-capability")
	expectAuthenticatedIdentity(mock, tenantID, userID, "jti-query-anomalies-capability", "anomaly-reader", []string{"log.query.aggregate"})

	router := gin.New()
	registerRoutes(
		router,
		db,
		testJWTSecret,
		handler.NewQueryHandler(service.NewQueryService(nil, nil)),
		handler.NewStatsHandler(service.NewStatsService(nil, nil)),
	)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/query/stats/anomalies", strings.NewReader(`{"time_range":`))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", resp.Code, resp.Body.String())
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
				AddRow(username, "viewer", rawPermissions),
		)
	mock.ExpectQuery(`FROM legacy_permission_mapping`).
		WillReturnRows(sqlmock.NewRows([]string{"legacy_permission", "capability_bundle", "scope_bundle", "enabled"}))
	mock.ExpectQuery(`FROM authz_version`).
		WithArgs(tenantID, userID).
		WillReturnRows(sqlmock.NewRows([]string{"authz_epoch"}).AddRow(1))
	mock.ExpectQuery(`FROM subject_reserved_policy`).
		WithArgs(tenantID, username).
		WillReturnRows(
			sqlmock.NewRows([]string{"reserved", "interactive_login_allowed", "system_subject", "break_glass_allowed", "managed_by"}).
				AddRow(false, true, false, false, "test"),
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

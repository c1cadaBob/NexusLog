package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"github.com/nexuslog/control-plane/internal/alert"
	"github.com/nexuslog/control-plane/internal/incident"
	"github.com/nexuslog/control-plane/internal/ingest"
	"github.com/nexuslog/control-plane/internal/ingestv3"
	"github.com/nexuslog/control-plane/internal/metrics"
	"github.com/nexuslog/control-plane/internal/middleware"
	"github.com/nexuslog/control-plane/internal/notification"
	"github.com/nexuslog/control-plane/internal/resource"
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
		  AND COALESCE(r.permissions, '[]'::jsonb) ?| ARRAY[
			'*',
			'users:write',
			'iam.user.create',
			'iam.user.delete',
			'iam.user.grant_role',
			'iam.user.revoke_role',
			'iam.user.update_profile',
			'iam.user.update_status'
		  ]
	)
`

const testOperatorRoleExistsQuery = `
	SELECT EXISTS(
		SELECT 1
		FROM users u
		JOIN user_roles ur ON ur.user_id = u.id
		JOIN roles r ON r.id = ur.role_id
		WHERE u.id = $1::uuid
		  AND u.tenant_id = $2::uuid
		  AND u.status = 'active'
		  AND r.tenant_id = $2::uuid
		  AND COALESCE(r.permissions, '[]'::jsonb) ?| ARRAY[
			'*',
			'users:write',
			'iam.user.create',
			'iam.user.delete',
			'iam.user.grant_role',
			'iam.user.revoke_role',
			'iam.user.update_profile',
			'iam.user.update_status',
			'alerts:write',
			'incidents:write',
			'logs:export',
			'alert.rule.update',
			'alert.silence.update',
			'export.job.create',
			'incident.update'
		  ]
	)
`

const testAuthorizationContextQuery = `
	SELECT u.username, COALESCE(r.name, ''), COALESCE(r.permissions, '[]'::jsonb)
	FROM users u
	LEFT JOIN user_roles ur ON ur.user_id = u.id
	LEFT JOIN roles r ON r.id = ur.role_id AND r.tenant_id = u.tenant_id
	WHERE u.id = $1::uuid
	  AND u.tenant_id = $2::uuid
	  AND u.status = 'active'
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

	expectAuthenticatedSession(mock, "jti-non-admin")
	expectAuthorizationContextLookup(mock)
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

func TestResourceThresholdRoutes_RejectNonAdminUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := newManagementAdminRouter(db)
	token := mustIssueRouteToken(t, testRouteUserID, testRouteTenantID, "jti-threshold-non-admin")

	expectAuthenticatedSession(mock, "jti-threshold-non-admin")
	expectAuthorizationContextLookup(mock)
	mock.ExpectQuery(regexp.QuoteMeta(testAdminRoleExistsQuery)).
		WithArgs(testRouteUserID, testRouteTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/resource/thresholds", nil)
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

func TestResourceThresholdRoutes_AllowAdminUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := newManagementAdminRouter(db)
	token := mustIssueRouteToken(t, testRouteUserID, testRouteTenantID, "jti-threshold-admin")

	expectAuthenticatedSession(mock, "jti-threshold-admin")
	expectAuthorizationContextLookup(mock)
	mock.ExpectQuery(regexp.QuoteMeta(testAdminRoleExistsQuery)).
		WithArgs(testRouteUserID, testRouteTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COUNT(1) FROM resource_thresholds WHERE tenant_id = $1::uuid`)).
		WithArgs(testRouteTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery(`SELECT id, tenant_id, agent_id, metric_name, threshold_value, comparison, alert_severity, enabled,`).
		WithArgs(testRouteTenantID, 20, 0).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "agent_id", "metric_name", "threshold_value", "comparison", "alert_severity", "enabled", "created_by", "created_at", "updated_at", "notification_channels"}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/resource/thresholds", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestAlertRuleRoutes_RejectNonAdminUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := newManagementAdminRouter(db)
	token := mustIssueRouteToken(t, testRouteUserID, testRouteTenantID, "jti-alert-rule-non-admin")

	expectAuthenticatedSession(mock, "jti-alert-rule-non-admin")
	expectAuthorizationContextLookup(mock)
	mock.ExpectQuery(regexp.QuoteMeta(testAdminRoleExistsQuery)).
		WithArgs(testRouteUserID, testRouteTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/alert/rules", nil)
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

func TestAlertRuleRoutes_AllowCapabilityUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := newManagementAdminRouter(db)
	token := mustIssueRouteToken(t, testRouteUserID, testRouteTenantID, "jti-alert-rule-capability")

	expectAuthenticatedSession(mock, "jti-alert-rule-capability")
	expectAuthorizationContextLookup(mock, "alerts:read")
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COUNT(1) FROM alert_rules WHERE tenant_id = $1::uuid`)).
		WithArgs(testRouteTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery(`SELECT\s+id::text,\s+tenant_id::text,\s+name,`).
		WithArgs(testRouteTenantID, 0, 20).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "description", "condition", "severity", "enabled", "notification_channels", "created_by", "created_at", "updated_at"}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/alert/rules", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", resp.Code, resp.Body.String())
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

	expectAuthenticatedSession(mock, "jti-admin")
	expectAuthorizationContextLookup(mock, "alerts:read")
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

func TestIngestAdminRoutes_RejectNonAdminUser(t *testing.T) {
	testCases := []struct {
		name   string
		method string
		path   string
		body   string
	}{
		{name: "pull sources list", method: http.MethodGet, path: "/api/v1/ingest/pull-sources"},
		{name: "pull task detail", method: http.MethodGet, path: "/api/v1/ingest/pull-tasks/00000000-0000-0000-0000-000000000001"},
		{name: "pull task run", method: http.MethodPost, path: "/api/v1/ingest/pull-tasks/run"},
		{name: "packages list", method: http.MethodGet, path: "/api/v1/ingest/packages"},
		{name: "package detail", method: http.MethodGet, path: "/api/v1/ingest/packages/00000000-0000-0000-0000-000000000001"},
		{name: "receipts list", method: http.MethodGet, path: "/api/v1/ingest/receipts"},
		{name: "dead letters list", method: http.MethodGet, path: "/api/v1/ingest/dead-letters"},
		{name: "dead letter replay", method: http.MethodPost, path: "/api/v1/ingest/dead-letters/replay"},
		{name: "latency metrics", method: http.MethodGet, path: "/api/v1/ingest/metrics/latency"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			db, mock, err := sqlmock.New()
			if err != nil {
				t.Fatalf("sqlmock: %v", err)
			}
			defer db.Close()

			router := newIngestRuntimeRouter(t, db)
			token := mustIssueRouteToken(t, testRouteUserID, testRouteTenantID, "jti-ingest-non-admin")

			expectAuthenticatedSession(mock, "jti-ingest-non-admin")
			expectAuthorizationContextLookup(mock)
			mock.ExpectQuery(regexp.QuoteMeta(testAdminRoleExistsQuery)).
				WithArgs(testRouteUserID, testRouteTenantID).
				WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

			req := httptest.NewRequest(tc.method, tc.path, nil)
			if tc.body != "" {
				req = httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
				req.Header.Set("Content-Type", "application/json")
			}
			req.Header.Set("Authorization", "Bearer "+token)
			resp := httptest.NewRecorder()
			router.ServeHTTP(resp, req)

			if resp.Code != http.StatusForbidden {
				t.Fatalf("expected 403, got %d body=%s", resp.Code, resp.Body.String())
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatalf("expectations: %v", err)
			}
		})
	}
}

func TestIngestAdminRoutes_AllowAdminUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := newIngestRuntimeRouter(t, db)
	token := mustIssueRouteToken(t, testRouteUserID, testRouteTenantID, "jti-ingest-admin")

	expectAuthenticatedSession(mock, "jti-ingest-admin")
	expectAuthorizationContextLookup(mock)
	mock.ExpectQuery(regexp.QuoteMeta(testAdminRoleExistsQuery)).
		WithArgs(testRouteUserID, testRouteTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/ingest/pull-sources", nil)
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

func TestIngestAdminRoutes_AllowCapabilityUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := newIngestRuntimeRouter(t, db)
	token := mustIssueRouteToken(t, testRouteUserID, testRouteTenantID, "jti-ingest-capability")

	expectAuthenticatedSession(mock, "jti-ingest-capability")
	expectAuthorizationContextLookup(mock, "ingest.source.read")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/ingest/pull-sources", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestIngestReceiptRoute_RejectsNonOperatorUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := newIngestRuntimeRouter(t, db)
	token := mustIssueRouteToken(t, testRouteUserID, testRouteTenantID, "jti-ingest-receipt-non-operator")

	expectAuthenticatedSession(mock, "jti-ingest-receipt-non-operator")
	expectAuthorizationContextLookup(mock)
	mock.ExpectQuery(regexp.QuoteMeta(testOperatorRoleExistsQuery)).
		WithArgs(testRouteUserID, testRouteTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

	req := httptest.NewRequest(http.MethodPost, "/api/v1/ingest/receipts", strings.NewReader(`{"package_id":"missing-package","status":"ack","checksum":"checksum-1"}`))
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

func TestIngestReceiptRoute_AllowsOperatorUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := newIngestRuntimeRouter(t, db)
	token := mustIssueRouteToken(t, testRouteUserID, testRouteTenantID, "jti-ingest-receipt-operator")

	expectAuthenticatedSession(mock, "jti-ingest-receipt-operator")
	expectAuthorizationContextLookup(mock)
	mock.ExpectQuery(regexp.QuoteMeta(testOperatorRoleExistsQuery)).
		WithArgs(testRouteUserID, testRouteTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

	req := httptest.NewRequest(http.MethodPost, "/api/v1/ingest/receipts", strings.NewReader(`{"package_id":"missing-package","status":"ack","checksum":"checksum-1"}`))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", resp.Code, resp.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body["code"] != ingest.ErrorCodeReceiptPackageNotFound {
		t.Fatalf("unexpected response code: %#v", body["code"])
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestIngestReceiptRoute_AllowsCapabilityUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := newIngestRuntimeRouter(t, db)
	token := mustIssueRouteToken(t, testRouteUserID, testRouteTenantID, "jti-ingest-receipt-capability")

	expectAuthenticatedSession(mock, "jti-ingest-receipt-capability")
	expectAuthorizationContextLookup(mock, "ingest.receipt.create")

	req := httptest.NewRequest(http.MethodPost, "/api/v1/ingest/receipts", strings.NewReader(`{"package_id":"missing-package","status":"ack","checksum":"checksum-1"}`))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

type ingestV3TestCursorStore struct {
	items map[string]ingestv3.CursorEntry
}

func (s *ingestV3TestCursorStore) key(sourceID, filePath string) string {
	return sourceID + "|" + filePath
}

func (s *ingestV3TestCursorStore) Get(sourceID string, filePath string) (ingestv3.CursorEntry, bool) {
	if s == nil || s.items == nil {
		return ingestv3.CursorEntry{}, false
	}
	item, ok := s.items[s.key(sourceID, filePath)]
	return item, ok
}

func (s *ingestV3TestCursorStore) Put(entry ingestv3.CursorEntry) error {
	if s.items == nil {
		s.items = make(map[string]ingestv3.CursorEntry)
	}
	s.items[s.key(entry.SourceID, entry.FilePath)] = entry
	return nil
}

func TestIngestV3Routes_RejectNonAdminUser(t *testing.T) {
	testCases := []struct {
		name string
		path string
		body string
	}{
		{name: "resolve plans", path: "/api/v2/ingest/plans/resolve", body: `{"source_id":"source-1","file_paths":["/var/log/a.log"]}`},
		{name: "commit cursors", path: "/api/v2/ingest/cursors/commit", body: `{"source_id":"source-1","files":[{"file_path":"/var/log/a.log","next_cursor":"100","last_offset":10}]}`},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			db, mock, err := sqlmock.New()
			if err != nil {
				t.Fatalf("sqlmock: %v", err)
			}
			defer db.Close()

			router := newIngestV3AdminRouter(db)
			token := mustIssueRouteToken(t, testRouteUserID, testRouteTenantID, "jti-ingestv3-non-admin")

			expectAuthenticatedSession(mock, "jti-ingestv3-non-admin")
			expectAuthorizationContextLookup(mock)
			mock.ExpectQuery(regexp.QuoteMeta(testAdminRoleExistsQuery)).
				WithArgs(testRouteUserID, testRouteTenantID).
				WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

			req := httptest.NewRequest(http.MethodPost, tc.path, strings.NewReader(tc.body))
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
		})
	}
}

func TestIngestV3Routes_AllowAdminUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := newIngestV3AdminRouter(db)
	token := mustIssueRouteToken(t, testRouteUserID, testRouteTenantID, "jti-ingestv3-admin")

	expectAuthenticatedSession(mock, "jti-ingestv3-admin")
	expectAuthorizationContextLookup(mock)
	mock.ExpectQuery(regexp.QuoteMeta(testAdminRoleExistsQuery)).
		WithArgs(testRouteUserID, testRouteTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

	req := httptest.NewRequest(http.MethodPost, "/api/v2/ingest/plans/resolve", strings.NewReader(`{"source_id":"source-1","file_paths":["/var/log/a.log"]}`))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
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

func TestIngestV3Routes_AllowCapabilityUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := newIngestV3AdminRouter(db)
	token := mustIssueRouteToken(t, testRouteUserID, testRouteTenantID, "jti-ingestv3-capability")

	expectAuthenticatedSession(mock, "jti-ingestv3-capability")
	expectAuthorizationContextLookup(mock, "ingest.task.run")

	req := httptest.NewRequest(http.MethodPost, "/api/v2/ingest/plans/resolve", strings.NewReader(`{"source_id":"source-1","file_paths":["/var/log/a.log"]}`))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestAlertEventRoutes_RejectNonOperatorUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := newAlertEventOperatorRouter(db)
	token := mustIssueRouteToken(t, testRouteUserID, testRouteTenantID, "jti-alert-events-non-operator")

	expectAuthenticatedSession(mock, "jti-alert-events-non-operator")
	expectAuthorizationContextLookup(mock)
	mock.ExpectQuery(regexp.QuoteMeta(testOperatorRoleExistsQuery)).
		WithArgs(testRouteUserID, testRouteTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/alert/events?page=1", nil)
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

func TestAlertEventRoutes_AllowOperatorUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := newAlertEventOperatorRouter(db)
	token := mustIssueRouteToken(t, testRouteUserID, testRouteTenantID, "jti-alert-events-operator")

	expectAuthenticatedSession(mock, "jti-alert-events-operator")
	expectAuthorizationContextLookup(mock)
	mock.ExpectQuery(regexp.QuoteMeta(testOperatorRoleExistsQuery)).
		WithArgs(testRouteUserID, testRouteTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/alert/events?page=bad", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestIncidentRoutes_RejectNonOperatorUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := newIncidentOperatorRouter(db)
	token := mustIssueRouteToken(t, testRouteUserID, testRouteTenantID, "jti-incidents-non-operator")

	expectAuthenticatedSession(mock, "jti-incidents-non-operator")
	expectAuthorizationContextLookup(mock)
	mock.ExpectQuery(regexp.QuoteMeta(testOperatorRoleExistsQuery)).
		WithArgs(testRouteUserID, testRouteTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

	req := httptest.NewRequest(http.MethodPost, "/api/v1/incidents", strings.NewReader(`{"title":"incident title"}`))
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

func TestIncidentRoutes_AllowOperatorUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := newIncidentOperatorRouter(db)
	token := mustIssueRouteToken(t, testRouteUserID, testRouteTenantID, "jti-incidents-operator")

	expectAuthenticatedSession(mock, "jti-incidents-operator")
	expectAuthorizationContextLookup(mock, "incidents:write")

	req := httptest.NewRequest(http.MethodPost, "/api/v1/incidents", strings.NewReader(`{}`))
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

func TestMetricsQueryRoutes_RejectNonOperatorUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := newMetricsQueryOperatorRouter(db)
	token := mustIssueRouteToken(t, testRouteUserID, testRouteTenantID, "jti-metrics-query-non-operator")

	expectAuthenticatedSession(mock, "jti-metrics-query-non-operator")
	expectAuthorizationContextLookup(mock)
	mock.ExpectQuery(regexp.QuoteMeta(testOperatorRoleExistsQuery)).
		WithArgs(testRouteUserID, testRouteTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/metrics/servers/agent-1?range=24h", nil)
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

func TestMetricsQueryRoutes_AllowOperatorUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := newMetricsQueryOperatorRouter(db)
	token := mustIssueRouteToken(t, testRouteUserID, testRouteTenantID, "jti-metrics-query-operator")

	expectAuthenticatedSession(mock, "jti-metrics-query-operator")
	expectAuthorizationContextLookup(mock, "metrics:read")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/metrics/servers/agent-1?range=bad", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestMetricsReportRoute_RejectsBearerSession(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := newMetricsReportRouter(db)
	token := mustIssueRouteToken(t, testRouteUserID, testRouteTenantID, "jti-metrics-report-authenticated")

	req := httptest.NewRequest(http.MethodPost, "/api/v1/metrics/report", strings.NewReader(`{"agent_id"`))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d body=%s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestMetricsReportRoute_AllowsAgentKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := newMetricsReportRouter(db)

	mock.ExpectQuery(`FROM agent_pull_auth_keys`).
		WithArgs("active", "metrics-agent-secret", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"tenant_id", "agent_id"}).AddRow(testRouteTenantID, "agent-1"))

	req := httptest.NewRequest(http.MethodPost, "/api/v1/metrics/report", strings.NewReader(`{"agent_id"`))
	req.Header.Set("X-Agent-Key", "metrics-agent-secret")
	req.Header.Set("X-Key-Id", "active")
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

func newNotificationAdminRouter(db *sql.DB) *gin.Engine {
	router := gin.New()
	router.Use(middleware.RequireAuthenticatedIdentity(db, testRouteJWTSecret))
	notification.RegisterAuthorizedChannelRoutes(router, db, notification.NewChannelRepository(db), notification.NewSMTPSender())
	return router
}

func newManagementAdminRouter(db *sql.DB) *gin.Engine {
	router := gin.New()
	router.Use(middleware.RequireAuthenticatedIdentity(db, testRouteJWTSecret))
	resource.RegisterAuthorizedRoutes(router, db, resource.NewThresholdHandler(resource.NewThresholdRepository(db)))
	alertRuleRepo := alert.NewRuleRepositoryPG(db)
	alert.RegisterAuthorizedAlertRuleRoutes(router, db, alert.NewRuleHandler(alert.NewRuleService(alertRuleRepo)))
	return router
}

func newIngestRuntimeRouter(t *testing.T, db *sql.DB) *gin.Engine {
	t.Helper()
	router := gin.New()
	router.Use(middleware.RequireAuthenticatedIdentity(db, testRouteJWTSecret))
	workerCtx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	if err := enablePullIngestRuntime(router, db, workerCtx, nil); err != nil {
		t.Fatalf("enable pull ingest runtime: %v", err)
	}
	return router
}

func newIngestV3AdminRouter(db *sql.DB) *gin.Engine {
	router := gin.New()
	router.Use(middleware.RequireAuthenticatedIdentity(db, testRouteJWTSecret))
	store := &ingestV3TestCursorStore{items: map[string]ingestv3.CursorEntry{
		"source-1|/var/log/a.log": {
			SourceID:   "source-1",
			FilePath:   "/var/log/a.log",
			LastCursor: "42",
			LastOffset: 10,
		},
	}}
	registerIngestV3Routes(router, db, store, store)
	return router
}

func newAlertEventOperatorRouter(db *sql.DB) *gin.Engine {
	router := gin.New()
	router.Use(middleware.RequireAuthenticatedIdentity(db, testRouteJWTSecret))
	alert.RegisterAuthorizedAlertEventRoutes(router, db, alert.NewEventHandler(db))
	return router
}

func newIncidentOperatorRouter(db *sql.DB) *gin.Engine {
	router := gin.New()
	router.Use(middleware.RequireAuthenticatedIdentity(db, testRouteJWTSecret))
	incidentHandler := incident.NewHandler(incident.NewService(nil, nil))
	incident.RegisterAuthorizedIncidentRoutes(router, db, incidentHandler)
	return router
}

func newMetricsQueryOperatorRouter(db *sql.DB) *gin.Engine {
	router := gin.New()
	router.Use(middleware.RequireAuthenticatedIdentity(db, testRouteJWTSecret))
	metricsHandler := metrics.NewHandler(metrics.NewService(metrics.NewRepository(db)))
	metrics.RegisterAuthorizedQueryRoutes(router, db, metricsHandler)
	return router
}

func newMetricsReportRouter(db *sql.DB) *gin.Engine {
	router := gin.New()
	agentRoutes := router.Group("/")
	agentRoutes.Use(middleware.RequireAuthenticatedAgentIdentity(db))
	metricsHandler := metrics.NewHandler(metrics.NewService(metrics.NewRepository(db)))
	metrics.RegisterReportRoutes(agentRoutes, metricsHandler)
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

func expectAuthenticatedSession(mock sqlmock.Sqlmock, jti string) {
	mock.ExpectQuery(`FROM user_sessions s`).
		WithArgs(testRouteTenantID, testRouteUserID, jti, sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
}

func expectAuthorizationContextLookup(mock sqlmock.Sqlmock, permissions ...string) {
	permissionJSON := `[]`
	if len(permissions) > 0 {
		encoded, err := json.Marshal(permissions)
		if err == nil {
			permissionJSON = string(encoded)
		}
	}
	mock.ExpectQuery(regexp.QuoteMeta(testAuthorizationContextQuery)).
		WithArgs(testRouteUserID, testRouteTenantID).
		WillReturnRows(
			sqlmock.NewRows([]string{"username", "name", "permissions"}).
				AddRow("route-user", "viewer", []byte(permissionJSON)),
		)
	mock.ExpectQuery(`FROM legacy_permission_mapping`).
		WillReturnRows(sqlmock.NewRows([]string{"legacy_permission", "capability_bundle", "scope_bundle", "enabled"}))
	mock.ExpectQuery(`FROM authz_version`).
		WithArgs(testRouteTenantID, testRouteUserID).
		WillReturnRows(sqlmock.NewRows([]string{"authz_epoch"}).AddRow(1))
	mock.ExpectQuery(`FROM subject_reserved_policy`).
		WithArgs(testRouteTenantID, "route-user").
		WillReturnRows(sqlmock.NewRows([]string{"reserved", "interactive_login_allowed", "system_subject", "break_glass_allowed", "managed_by"}))
}

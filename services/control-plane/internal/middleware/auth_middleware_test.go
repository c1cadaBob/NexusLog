package middleware

import (
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
)

const testJWTSecret = "control-plane-auth-test-secret-20260314"

func expectControlPlaneAuthorizationRegistryQueries(mock sqlmock.Sqlmock, tenantID, userID string, authzEpoch int64) {
	mock.ExpectQuery(`FROM legacy_permission_mapping`).
		WillReturnRows(sqlmock.NewRows([]string{"legacy_permission", "capability_bundle", "scope_bundle", "enabled"}))
	mock.ExpectQuery(`FROM authz_version`).
		WithArgs(tenantID, userID).
		WillReturnRows(sqlmock.NewRows([]string{"authz_epoch"}).AddRow(authzEpoch))
}

func TestRequireAuthenticatedIdentity_PublicPathBypassesAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequireAuthenticatedIdentity(nil, testJWTSecret))
	router.GET("/healthz", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}
}

func TestRequireAuthenticatedIdentity_RejectsInvalidToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequireAuthenticatedIdentity(nil, testJWTSecret))
	router.GET("/api/v1/incidents", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/api/v1/incidents", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.Code)
	}
}

func TestRequireAuthenticatedAgentIdentity_RejectsMetricsReportWithoutAgentKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := gin.New()
	router.Use(RequireAuthenticatedAgentIdentity(db))
	router.POST("/api/v1/metrics/report", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodPost, "/api/v1/metrics/report", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d body=%s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRequireAuthenticatedAgentIdentity_SetsTenantFromAgentKeyForMetricsReport(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := gin.New()
	router.Use(RequireAuthenticatedAgentIdentity(db))
	router.POST("/api/v1/metrics/report", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"tenant_id": c.GetHeader("X-Tenant-ID"),
			"user_id":   c.GetHeader("X-User-ID"),
			"agent_id":  c.GetHeader("X-Agent-ID"),
		})
	})

	mock.ExpectQuery(`FROM agent_pull_auth_keys`).
		WithArgs("active", "metrics-agent-secret", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"tenant_id", "agent_id"}).AddRow("10000000-0000-0000-0000-000000000001", "agent-metrics-1"))

	req := httptest.NewRequest(http.MethodPost, "/api/v1/metrics/report", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Agent-Key", "metrics-agent-secret")
	req.Header.Set("X-Key-Id", "active")
	req.Header.Set("X-Tenant-ID", "spoofed-tenant")
	req.Header.Set("X-User-ID", "spoofed-user")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", resp.Code, resp.Body.String())
	}
	body := resp.Body.String()
	if !strings.Contains(body, "10000000-0000-0000-0000-000000000001") || !strings.Contains(body, "agent-metrics-1") {
		t.Fatalf("unexpected body: %s", body)
	}
	if strings.Contains(body, "spoofed-user") {
		t.Fatalf("unexpected spoofed user header in body: %s", body)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRequireAuthenticatedIdentity_SetsIdentityHeadersFromToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequireAuthenticatedIdentity(nil, testJWTSecret))
	router.GET("/api/v1/incidents", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"tenant_id": c.GetHeader("X-Tenant-ID"),
			"user_id":   c.GetHeader("X-User-ID"),
		})
	})

	token := mustIssueToken(t, "10000000-0000-0000-0000-000000000001", "20000000-0000-0000-0000-000000000001", "jti-1")
	req := httptest.NewRequest(http.MethodGet, "/api/v1/incidents", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-Tenant-ID", "spoofed-tenant")
	req.Header.Set("X-User-ID", "spoofed-user")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", resp.Code, resp.Body.String())
	}
	if body := resp.Body.String(); body == "" || !strings.Contains(body, "10000000-0000-0000-0000-000000000001") || !strings.Contains(body, "20000000-0000-0000-0000-000000000001") {
		t.Fatalf("unexpected body: %s", body)
	}
}

func TestRequireAuthenticatedIdentity_LoadsAuthorizationSnapshotFromDatabase(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	tenantID := "10000000-0000-0000-0000-000000000001"
	userID := "20000000-0000-0000-0000-000000000001"
	accessTokenJTI := "jti-authz"

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT EXISTS(
			SELECT 1
			FROM user_sessions s
			JOIN users u ON u.id = s.user_id AND u.tenant_id = s.tenant_id
			WHERE s.tenant_id = $1::uuid
			  AND s.user_id = $2::uuid
			  AND s.access_token_jti = $3
			  AND s.session_status = 'active'
			  AND s.expires_at > $4
			  AND u.status = 'active'
		)
	`)).
		WithArgs(tenantID, userID, accessTokenJTI, sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectQuery(regexp.QuoteMeta(authorizationContextQuery)).
		WithArgs(userID, tenantID).
		WillReturnRows(
			sqlmock.NewRows([]string{"username", "name", "permissions"}).
				AddRow("sys-superadmin", "super_admin", []byte(`["*"]`)),
		)
	expectControlPlaneAuthorizationRegistryQueries(mock, tenantID, userID, 1)
	mock.ExpectQuery(`FROM subject_reserved_policy`).
		WithArgs(tenantID, "sys-superadmin").
		WillReturnRows(
			sqlmock.NewRows([]string{"reserved", "interactive_login_allowed", "system_subject", "break_glass_allowed", "managed_by"}).
				AddRow(true, true, false, true, "test"),
		)

	router := gin.New()
	router.Use(RequireAuthenticatedIdentity(db, testJWTSecret))
	router.GET("/api/v1/incidents", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"permissions":  AuthenticatedPermissions(c),
			"capabilities": AuthenticatedCapabilities(c),
			"scopes":       AuthenticatedScopes(c),
			"actor_flags":  AuthenticatedActorFlags(c),
			"authz_epoch":  AuthenticatedAuthzEpoch(c),
		})
	})

	token := mustIssueToken(t, tenantID, userID, accessTokenJTI)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/incidents", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", resp.Code, resp.Body.String())
	}
	var body struct {
		Permissions  []string        `json:"permissions"`
		Capabilities []string        `json:"capabilities"`
		Scopes       []string        `json:"scopes"`
		ActorFlags   map[string]bool `json:"actor_flags"`
		AuthzEpoch   int64           `json:"authz_epoch"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !hasAuthorizationValue(body.Permissions, "*") {
		t.Fatalf("unexpected permissions: %#v", body.Permissions)
	}
	if !hasAuthorizationValue(body.Capabilities, "*") {
		t.Fatalf("unexpected capabilities: %#v", body.Capabilities)
	}
	if !hasAnyScope(body.Scopes, "all_tenants", "system") {
		t.Fatalf("unexpected scopes: %#v", body.Scopes)
	}
	if !body.ActorFlags["reserved"] || !body.ActorFlags["interactive_login_allowed"] {
		t.Fatalf("unexpected actor flags: %#v", body.ActorFlags)
	}
	if body.AuthzEpoch != 1 {
		t.Fatalf("unexpected authz epoch: %d", body.AuthzEpoch)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRequireAuthenticatedIdentity_RejectsSystemAutomationInteractiveAccess(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	tenantID := "10000000-0000-0000-0000-000000000001"
	userID := "20000000-0000-0000-0000-000000000099"
	accessTokenJTI := "jti-system"

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT EXISTS(
			SELECT 1
			FROM user_sessions s
			JOIN users u ON u.id = s.user_id AND u.tenant_id = s.tenant_id
			WHERE s.tenant_id = $1::uuid
			  AND s.user_id = $2::uuid
			  AND s.access_token_jti = $3
			  AND s.session_status = 'active'
			  AND s.expires_at > $4
			  AND u.status = 'active'
		)
	`)).
		WithArgs(tenantID, userID, accessTokenJTI, sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectQuery(regexp.QuoteMeta(authorizationContextQuery)).
		WithArgs(userID, tenantID).
		WillReturnRows(
			sqlmock.NewRows([]string{"username", "name", "permissions"}).
				AddRow("system-automation", "system_automation", []byte(`["audit:write"]`)),
		)
	expectControlPlaneAuthorizationRegistryQueries(mock, tenantID, userID, 1)
	mock.ExpectQuery(`FROM subject_reserved_policy`).
		WithArgs(tenantID, "system-automation").
		WillReturnRows(
			sqlmock.NewRows([]string{"reserved", "interactive_login_allowed", "system_subject", "break_glass_allowed", "managed_by"}).
				AddRow(true, false, true, false, "test"),
		)

	router := gin.New()
	router.Use(RequireAuthenticatedIdentity(db, testJWTSecret))
	router.GET("/api/v1/incidents", func(c *gin.Context) { c.Status(http.StatusOK) })

	token := mustIssueToken(t, tenantID, userID, accessTokenJTI)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/incidents", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", resp.Code, resp.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["code"] != "FORBIDDEN" {
		t.Fatalf("unexpected code: %v", body["code"])
	}
	if body["message"] != "interactive login is disabled for this account" {
		t.Fatalf("unexpected message: %v", body["message"])
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRequireAuthenticatedIdentity_RejectsInvalidUUIDClaims(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequireAuthenticatedIdentity(nil, testJWTSecret))
	router.GET("/api/v1/incidents", func(c *gin.Context) { c.Status(http.StatusOK) })

	token := mustIssueToken(t, "not-a-uuid", "20000000-0000-0000-0000-000000000001", "jti-1")
	req := httptest.NewRequest(http.MethodGet, "/api/v1/incidents", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.Code)
	}
}

func TestRequireAuthenticatedIdentity_RejectsInactiveUserSession(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	router := gin.New()
	router.Use(RequireAuthenticatedIdentity(db, testJWTSecret))
	router.GET("/api/v1/incidents", func(c *gin.Context) { c.Status(http.StatusOK) })

	token := mustIssueToken(t, "20000000-0000-0000-0000-000000000001", "10000000-0000-0000-0000-000000000001", "jti-disabled")
	mock.ExpectQuery(`FROM user_sessions s`).
		WithArgs("20000000-0000-0000-0000-000000000001", "10000000-0000-0000-0000-000000000001", "jti-disabled", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/incidents", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d body=%s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRequireAuthenticatedIdentity_RejectsTokenWithoutJTI(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequireAuthenticatedIdentity(nil, testJWTSecret))
	router.GET("/api/v1/incidents", func(c *gin.Context) { c.Status(http.StatusOK) })

	token := mustIssueToken(t, "10000000-0000-0000-0000-000000000001", "20000000-0000-0000-0000-000000000001", "")
	req := httptest.NewRequest(http.MethodGet, "/api/v1/incidents", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.Code)
	}
}

func mustIssueToken(t *testing.T, tenantID, userID, jti string) string {
	t.Helper()
	now := time.Now().UTC()
	claims := &authClaims{
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

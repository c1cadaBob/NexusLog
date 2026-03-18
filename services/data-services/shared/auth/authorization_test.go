package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
)

func TestRequireAuthenticatedIdentity_LoadsAuthorizationSnapshotFromDatabase(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	tenantID := "10000000-0000-0000-0000-000000000001"
	userID := "20000000-0000-0000-0000-000000000001"
	accessTokenJTI := "jti-1"

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT EXISTS(
			SELECT 1
			FROM user_sessions
			WHERE tenant_id = $1::uuid
			  AND user_id = $2::uuid
			  AND access_token_jti = $3
			  AND session_status = 'active'
			  AND expires_at > $4
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

	router := gin.New()
	router.Use(RequireAuthenticatedIdentity(db, testJWTSecret))
	router.GET("/api/v1/query/logs", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"permissions":       AuthenticatedPermissions(c),
			"capabilities":      AuthenticatedCapabilities(c),
			"scopes":            AuthenticatedScopes(c),
			"tenant_read_scope": AuthenticatedTenantReadScope(c),
			"actor_flags":       AuthenticatedActorFlags(c),
			"authz_epoch":       AuthenticatedAuthzEpoch(c),
		})
	})

	token := mustIssueToken(t, tenantID, userID, accessTokenJTI)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/query/logs", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	var body struct {
		Permissions     []string        `json:"permissions"`
		Capabilities    []string        `json:"capabilities"`
		Scopes          []string        `json:"scopes"`
		TenantReadScope TenantReadScope `json:"tenant_read_scope"`
		ActorFlags      map[string]bool `json:"actor_flags"`
		AuthzEpoch      int64           `json:"authz_epoch"`
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
	if body.TenantReadScope != TenantReadScopeAllTenants {
		t.Fatalf("unexpected tenant read scope: %q", body.TenantReadScope)
	}
	if !body.ActorFlags["reserved"] || !body.ActorFlags["interactive_login_allowed"] {
		t.Fatalf("unexpected actor flags: %#v", body.ActorFlags)
	}
	if body.AuthzEpoch != 1 {
		t.Fatalf("unexpected authz epoch: %d", body.AuthzEpoch)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRequireAuthenticatedIdentity_MapsCapabilitiesWithoutOverGranting(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	tenantID := "10000000-0000-0000-0000-000000000001"
	userID := "20000000-0000-0000-0000-000000000002"
	accessTokenJTI := "jti-2"

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT EXISTS(
			SELECT 1
			FROM user_sessions
			WHERE tenant_id = $1::uuid
			  AND user_id = $2::uuid
			  AND access_token_jti = $3
			  AND session_status = 'active'
			  AND expires_at > $4
		)
	`)).
		WithArgs(tenantID, userID, accessTokenJTI, sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectQuery(regexp.QuoteMeta(authorizationContextQuery)).
		WithArgs(userID, tenantID).
		WillReturnRows(
			sqlmock.NewRows([]string{"username", "name", "permissions"}).
				AddRow("viewer", "viewer", []byte(`["logs:read"]`)),
		)

	router := gin.New()
	router.Use(RequireAuthenticatedIdentity(db, testJWTSecret))
	router.GET("/api/v1/query/logs", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"capabilities": AuthenticatedCapabilities(c),
		})
	})

	token := mustIssueToken(t, tenantID, userID, accessTokenJTI)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/query/logs", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	var body struct {
		Capabilities []string `json:"capabilities"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !hasAuthorizationValue(body.Capabilities, "log.query.read") {
		t.Fatalf("expected log.query.read in %#v", body.Capabilities)
	}
	if hasAuthorizationValue(body.Capabilities, "dashboard.read") {
		t.Fatalf("did not expect dashboard.read in %#v", body.Capabilities)
	}
}

func TestRequirePermission_AllowsExactPermission(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(string(contextKeyAuthorizationReady), true)
		c.Set(string(contextKeyUserPermissions), []string{"logs:read"})
		c.Next()
	})
	router.Use(RequirePermission("logs:read"))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/protected", nil))
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestRequirePermission_AllowsWildcardPermission(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(string(contextKeyAuthorizationReady), true)
		c.Set(string(contextKeyUserPermissions), []string{"*"})
		c.Next()
	})
	router.Use(RequirePermission("audit:read"))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/protected", nil))
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestRequirePermission_RejectsInsufficientPermissions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(string(contextKeyAuthorizationReady), true)
		c.Set(string(contextKeyUserPermissions), []string{"logs:read"})
		c.Next()
	})
	router.Use(RequirePermission("logs:export"))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/protected", nil))
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", resp.Code, resp.Body.String())
	}
	if !strings.Contains(resp.Body.String(), "insufficient permissions") {
		t.Fatalf("unexpected body: %s", resp.Body.String())
	}
}

func TestRequirePermission_FailsClosedWhenAuthorizationUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(string(contextKeyAuthorizationReady), false)
		c.Next()
	})
	router.Use(RequirePermission("logs:read"))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/protected", nil))
	if resp.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestRequireCapability_AllowsExactCapability(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(string(contextKeyAuthorizationReady), true)
		c.Set(string(contextKeyUserCapabilities), []string{"audit.log.read"})
		c.Next()
	})
	router.Use(RequireCapability("audit.log.read"))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/protected", nil))
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestRequireCapability_AllowsWildcardCapability(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(string(contextKeyAuthorizationReady), true)
		c.Set(string(contextKeyUserCapabilities), []string{"*"})
		c.Next()
	})
	router.Use(RequireCapability("export.job.download"))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/protected", nil))
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestRequireCapability_RejectsInsufficientCapabilities(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(string(contextKeyAuthorizationReady), true)
		c.Set(string(contextKeyUserCapabilities), []string{"log.query.read"})
		c.Next()
	})
	router.Use(RequireCapability("export.job.read"))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/protected", nil))
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", resp.Code, resp.Body.String())
	}
	if !strings.Contains(resp.Body.String(), "insufficient capabilities") {
		t.Fatalf("unexpected body: %s", resp.Body.String())
	}
}

func TestRequireCapability_FailsClosedWhenAuthorizationUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(string(contextKeyAuthorizationReady), false)
		c.Next()
	})
	router.Use(RequireCapability("audit.log.read"))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/protected", nil))
	if resp.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestRequireAuthenticatedIdentity_LoadsDirectCapabilitiesIntoRequestContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	tenantID := "10000000-0000-0000-0000-000000000001"
	userID := "20000000-0000-0000-0000-000000000003"
	accessTokenJTI := "jti-direct-capability"

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT EXISTS(
			SELECT 1
			FROM user_sessions
			WHERE tenant_id = $1::uuid
			  AND user_id = $2::uuid
			  AND access_token_jti = $3
			  AND session_status = 'active'
			  AND expires_at > $4
		)
	`)).
		WithArgs(tenantID, userID, accessTokenJTI, sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectQuery(regexp.QuoteMeta(authorizationContextQuery)).
		WithArgs(userID, tenantID).
		WillReturnRows(
			sqlmock.NewRows([]string{"username", "name", "permissions"}).
				AddRow("cross-tenant-reader", "viewer", []byte(`["log.query.read","all_tenants"]`)),
		)

	router := gin.New()
	router.Use(RequireAuthenticatedIdentity(db, testJWTSecret))
	router.GET("/api/v1/query/logs", func(c *gin.Context) {
		ctxCapabilities, _ := c.Request.Context().Value(contextKeyUserCapabilities).([]string)
		ctxScopes, _ := c.Request.Context().Value(contextKeyUserScopes).([]string)
		ctxReady, _ := c.Request.Context().Value(contextKeyAuthorizationReady).(bool)
		c.JSON(http.StatusOK, gin.H{
			"capabilities":      AuthenticatedCapabilities(c),
			"scopes":            AuthenticatedScopes(c),
			"tenant_read_scope": AuthenticatedTenantReadScope(c),
			"ctx_capabilities":  ctxCapabilities,
			"ctx_scopes":        ctxScopes,
			"ctx_ready":         ctxReady,
		})
	})

	token := mustIssueToken(t, tenantID, userID, accessTokenJTI)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/query/logs", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	var body struct {
		Capabilities    []string        `json:"capabilities"`
		Scopes          []string        `json:"scopes"`
		TenantReadScope TenantReadScope `json:"tenant_read_scope"`
		CtxCapabilities []string        `json:"ctx_capabilities"`
		CtxScopes       []string        `json:"ctx_scopes"`
		CtxReady        bool            `json:"ctx_ready"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !hasAuthorizationValue(body.Capabilities, "log.query.read") || !hasAuthorizationValue(body.CtxCapabilities, "log.query.read") {
		t.Fatalf("unexpected capabilities: %#v %#v", body.Capabilities, body.CtxCapabilities)
	}
	if !hasAnyScope(body.Scopes, "all_tenants") || !hasAnyScope(body.CtxScopes, "all_tenants") {
		t.Fatalf("unexpected scopes: %#v %#v", body.Scopes, body.CtxScopes)
	}
	if body.TenantReadScope != TenantReadScopeAllTenants {
		t.Fatalf("expected all-tenant read access, got body=%#v", body)
	}
	if !body.CtxReady {
		t.Fatal("expected ctx_ready=true")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

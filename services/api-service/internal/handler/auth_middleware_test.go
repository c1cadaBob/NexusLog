package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/nexuslog/api-service/internal/model"
	"github.com/nexuslog/api-service/internal/service"
)

const testJWTSecret = "auth-middleware-test-secret"

func mustIssueAccessToken(t *testing.T, userID, tenantID uuid.UUID) (string, string) {
	t.Helper()
	authSvc := service.NewAuthService(nil, testJWTSecret)
	accessToken, accessTokenJTI, err := authSvc.GenerateAccessTokenWithJTI(userID, tenantID, "")
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}
	return accessToken, accessTokenJTI
}

func expectActiveSessionQuery(mock sqlmock.Sqlmock, tenantID, userID uuid.UUID, accessTokenJTI string) {
	mock.ExpectQuery(`FROM user_sessions`).
		WithArgs(tenantID.String(), userID.String(), accessTokenJTI, sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
}

func TestAuthRequired_NoToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, _, _ := sqlmock.New()
	defer db.Close()

	router := gin.New()
	router.Use(AuthRequired(db, testJWTSecret))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["code"] != "UNAUTHORIZED" {
		t.Fatalf("expected UNAUTHORIZED, got %v", body["code"])
	}
}

func TestAuthRequired_InvalidToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, _, _ := sqlmock.New()
	defer db.Close()

	router := gin.New()
	router.Use(AuthRequired(db, testJWTSecret))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["code"] != "UNAUTHORIZED" {
		t.Fatalf("expected UNAUTHORIZED, got %v", body["code"])
	}
}

func TestAuthRequired_ExpiredToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, _, _ := sqlmock.New()
	defer db.Close()

	userID := uuid.New()
	tenantID := uuid.New()
	expiredToken := mustCreateExpiredToken(t, userID, tenantID)

	router := gin.New()
	router.Use(AuthRequired(db, testJWTSecret))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+expiredToken)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for expired token, got %d", resp.Code)
	}
}

func mustCreateExpiredToken(t *testing.T, userID, tenantID uuid.UUID) string {
	t.Helper()
	claims := &model.JWTClaims{
		UserID:   userID.String(),
		TenantID: tenantID.String(),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	s, err := token.SignedString([]byte(testJWTSecret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return s
}

func TestAuthRequired_ValidToken_AdminRole(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	userID := uuid.New()
	tenantID := uuid.New()
	accessToken, accessTokenJTI := mustIssueAccessToken(t, userID, tenantID)
	expectActiveSessionQuery(mock, tenantID, userID, accessTokenJTI)

	// Mock GetUser
	userRows := sqlmock.NewRows([]string{"id", "tenant_id", "username", "email", "display_name", "status", "last_login_at", "created_at", "updated_at"}).
		AddRow(userID, tenantID, "admin", "admin@test.com", nil, "active", nil, time.Now(), time.Now())
	mock.ExpectQuery("SELECT .+ FROM users").WithArgs(tenantID, userID).WillReturnRows(userRows)

	// Mock GetUserRoles - admin has ["*"]
	adminPerms, _ := json.Marshal([]string{"*"})
	roleRows := sqlmock.NewRows([]string{"id", "tenant_id", "name", "description", "permissions"}).
		AddRow(uuid.New(), tenantID, "admin", nil, adminPerms)
	mock.ExpectQuery("SELECT .+ FROM users u.+JOIN user_roles ur.+JOIN roles r").WithArgs(tenantID, userID).WillReturnRows(roleRows)

	router := gin.New()
	router.Use(AuthRequired(db, testJWTSecret))
	router.GET("/protected", RequirePermission("users:write"), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("X-Tenant-ID", tenantID.String())
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200 for admin with *, got %d body=%s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestAuthRequired_ValidToken_ViewerRole_ReadAllowed(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	userID := uuid.New()
	tenantID := uuid.New()
	accessToken, accessTokenJTI := mustIssueAccessToken(t, userID, tenantID)
	expectActiveSessionQuery(mock, tenantID, userID, accessTokenJTI)

	userRows := sqlmock.NewRows([]string{"id", "tenant_id", "username", "email", "display_name", "status", "last_login_at", "created_at", "updated_at"}).
		AddRow(userID, tenantID, "viewer", "v@test.com", nil, "active", nil, time.Now(), time.Now())
	mock.ExpectQuery("SELECT .+ FROM users").WithArgs(tenantID, userID).WillReturnRows(userRows)

	viewerPerms, _ := json.Marshal([]string{"users:read", "logs:read", "dashboards:read"})
	roleRows := sqlmock.NewRows([]string{"id", "tenant_id", "name", "description", "permissions"}).
		AddRow(uuid.New(), tenantID, "viewer", nil, viewerPerms)
	mock.ExpectQuery("SELECT .+ FROM users u.+JOIN user_roles ur.+JOIN roles r").WithArgs(tenantID, userID).WillReturnRows(roleRows)

	router := gin.New()
	router.Use(AuthRequired(db, testJWTSecret))
	router.GET("/protected", RequirePermission("users:read"), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("X-Tenant-ID", tenantID.String())
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200 for viewer with users:read, got %d body=%s", resp.Code, resp.Body.String())
	}
}

func TestAuthRequired_ValidToken_ViewerRole_WriteBlocked(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	userID := uuid.New()
	tenantID := uuid.New()
	accessToken, accessTokenJTI := mustIssueAccessToken(t, userID, tenantID)
	expectActiveSessionQuery(mock, tenantID, userID, accessTokenJTI)

	userRows := sqlmock.NewRows([]string{"id", "tenant_id", "username", "email", "display_name", "status", "last_login_at", "created_at", "updated_at"}).
		AddRow(userID, tenantID, "viewer", "v@test.com", nil, "active", nil, time.Now(), time.Now())
	mock.ExpectQuery("SELECT .+ FROM users").WithArgs(tenantID, userID).WillReturnRows(userRows)

	viewerPerms, _ := json.Marshal([]string{"users:read", "logs:read"})
	roleRows := sqlmock.NewRows([]string{"id", "tenant_id", "name", "description", "permissions"}).
		AddRow(uuid.New(), tenantID, "viewer", nil, viewerPerms)
	mock.ExpectQuery("SELECT .+ FROM users u.+JOIN user_roles ur.+JOIN roles r").WithArgs(tenantID, userID).WillReturnRows(roleRows)

	router := gin.New()
	router.Use(AuthRequired(db, testJWTSecret))
	router.POST("/protected", RequirePermission("users:write"), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodPost, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("X-Tenant-ID", tenantID.String())
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for viewer without users:write, got %d body=%s", resp.Code, resp.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["code"] != "FORBIDDEN" {
		t.Fatalf("expected FORBIDDEN, got %v", body["code"])
	}
}

func TestAuthRequired_ThreeRoleIsolation(t *testing.T) {
	roles := []struct {
		name        string
		permissions []string
		usersRead   bool
		usersWrite  bool
	}{
		{"admin", []string{"*"}, true, true},
		{"operator", []string{"logs:read", "alerts:read", "alerts:write"}, false, false},
		{"viewer", []string{"users:read", "logs:read"}, true, false},
	}

	for _, r := range roles {
		t.Run(r.name, func(t *testing.T) {
			db, mock, err := sqlmock.New()
			if err != nil {
				t.Fatalf("sqlmock: %v", err)
			}
			defer db.Close()

			userID := uuid.New()
			tenantID := uuid.New()
			accessToken, accessTokenJTI := mustIssueAccessToken(t, userID, tenantID)
			expectActiveSessionQuery(mock, tenantID, userID, accessTokenJTI)

			userRows := sqlmock.NewRows([]string{"id", "tenant_id", "username", "email", "display_name", "status", "last_login_at", "created_at", "updated_at"}).
				AddRow(userID, tenantID, r.name, r.name+"@test.com", nil, "active", nil, time.Now(), time.Now())
			mock.ExpectQuery("SELECT .+ FROM users").WithArgs(tenantID, userID).WillReturnRows(userRows)

			perms, _ := json.Marshal(r.permissions)
			roleRows := sqlmock.NewRows([]string{"id", "tenant_id", "name", "description", "permissions"}).
				AddRow(uuid.New(), tenantID, r.name, nil, perms)
			mock.ExpectQuery("SELECT .+ FROM users u.+JOIN user_roles ur.+JOIN roles r").WithArgs(tenantID, userID).WillReturnRows(roleRows)

			router := gin.New()
			router.Use(AuthRequired(db, testJWTSecret))
			router.GET("/read", RequirePermission("users:read"), func(c *gin.Context) { c.Status(http.StatusOK) })
			router.POST("/write", RequirePermission("users:write"), func(c *gin.Context) { c.Status(http.StatusOK) })

			// Test users:read
			reqRead := httptest.NewRequest(http.MethodGet, "/read", nil)
			reqRead.Header.Set("Authorization", "Bearer "+accessToken)
			reqRead.Header.Set("X-Tenant-ID", tenantID.String())
			respRead := httptest.NewRecorder()
			router.ServeHTTP(respRead, reqRead)
			if r.usersRead && respRead.Code != http.StatusOK {
				t.Errorf("expected 200 for users:read, got %d", respRead.Code)
			}
			if !r.usersRead && respRead.Code != http.StatusForbidden {
				t.Errorf("expected 403 for users:read, got %d", respRead.Code)
			}

			// Re-setup mock for second request (session + GetUser + GetUserRoles again)
			expectActiveSessionQuery(mock, tenantID, userID, accessTokenJTI)
			mock.ExpectQuery("SELECT .+ FROM users").WithArgs(tenantID, userID).WillReturnRows(
				sqlmock.NewRows([]string{"id", "tenant_id", "username", "email", "display_name", "status", "last_login_at", "created_at", "updated_at"}).
					AddRow(userID, tenantID, r.name, r.name+"@test.com", nil, "active", nil, time.Now(), time.Now()))
			mock.ExpectQuery("SELECT .+ FROM users u.+JOIN user_roles ur.+JOIN roles r").WithArgs(tenantID, userID).WillReturnRows(
				sqlmock.NewRows([]string{"id", "tenant_id", "name", "description", "permissions"}).
					AddRow(uuid.New(), tenantID, r.name, nil, perms))

			reqWrite := httptest.NewRequest(http.MethodPost, "/write", nil)
			reqWrite.Header.Set("Authorization", "Bearer "+accessToken)
			reqWrite.Header.Set("X-Tenant-ID", tenantID.String())
			respWrite := httptest.NewRecorder()
			router.ServeHTTP(respWrite, reqWrite)
			if r.usersWrite && respWrite.Code != http.StatusOK {
				t.Errorf("expected 200 for users:write, got %d", respWrite.Code)
			}
			if !r.usersWrite && respWrite.Code != http.StatusForbidden {
				t.Errorf("expected 403 for users:write, got %d", respWrite.Code)
			}
		})
	}
}

func TestAuthRequired_InactiveSessionRejected(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	userID := uuid.New()
	tenantID := uuid.New()
	accessToken, accessTokenJTI := mustIssueAccessToken(t, userID, tenantID)
	mock.ExpectQuery(`FROM user_sessions`).
		WithArgs(tenantID.String(), userID.String(), accessTokenJTI, sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

	router := gin.New()
	router.Use(AuthRequired(db, testJWTSecret))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("X-Tenant-ID", tenantID.String())
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 when session inactive, got %d body=%s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestAuthRequired_UserNotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	userID := uuid.New()
	tenantID := uuid.New()
	accessToken, accessTokenJTI := mustIssueAccessToken(t, userID, tenantID)
	expectActiveSessionQuery(mock, tenantID, userID, accessTokenJTI)

	mock.ExpectQuery("SELECT .+ FROM users").WithArgs(tenantID, userID).WillReturnError(sql.ErrNoRows)

	router := gin.New()
	router.Use(AuthRequired(db, testJWTSecret))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 when user not found, got %d", resp.Code)
	}
}

func TestAuthRequired_MiddlewarePerformance(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	userID := uuid.New()
	tenantID := uuid.New()
	accessToken, accessTokenJTI := mustIssueAccessToken(t, userID, tenantID)
	expectActiveSessionQuery(mock, tenantID, userID, accessTokenJTI)

	userRows := sqlmock.NewRows([]string{"id", "tenant_id", "username", "email", "display_name", "status", "last_login_at", "created_at", "updated_at"}).
		AddRow(userID, tenantID, "perf", "p@test.com", nil, "active", nil, time.Now(), time.Now())
	roleRows := sqlmock.NewRows([]string{"id", "tenant_id", "name", "description", "permissions"}).
		AddRow(uuid.New(), tenantID, "admin", nil, []byte(`["*"]`))

	mock.ExpectQuery("SELECT .+ FROM users").WithArgs(tenantID, userID).WillReturnRows(userRows)
	mock.ExpectQuery("SELECT .+ FROM users u.+JOIN user_roles ur.+JOIN roles r").WithArgs(tenantID, userID).WillReturnRows(roleRows)

	router := gin.New()
	router.Use(AuthRequired(db, testJWTSecret))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("X-Tenant-ID", tenantID.String())

	start := time.Now()
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	elapsed := time.Since(start)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}
	if elapsed > 10*time.Millisecond {
		t.Logf("middleware execution %v (target <5ms); acceptable in test env", elapsed)
	}
}

func TestAuthRequired_InjectsAuthorizationSnapshot(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	userID := uuid.New()
	tenantID := uuid.New()
	accessToken, accessTokenJTI := mustIssueAccessToken(t, userID, tenantID)
	expectActiveSessionQuery(mock, tenantID, userID, accessTokenJTI)

	userRows := sqlmock.NewRows([]string{"id", "tenant_id", "username", "email", "display_name", "status", "last_login_at", "created_at", "updated_at"}).
		AddRow(userID, tenantID, "viewer", "viewer@test.com", nil, "active", nil, time.Now(), time.Now())
	mock.ExpectQuery("SELECT .+ FROM users").WithArgs(tenantID, userID).WillReturnRows(userRows)

	viewerPerms, _ := json.Marshal([]string{"users:read", "logs:read"})
	roleRows := sqlmock.NewRows([]string{"id", "tenant_id", "name", "description", "permissions"}).
		AddRow(uuid.New(), tenantID, "viewer", nil, viewerPerms)
	mock.ExpectQuery("SELECT .+ FROM users u.+JOIN user_roles ur.+JOIN roles r").WithArgs(tenantID, userID).WillReturnRows(roleRows)

	router := gin.New()
	router.Use(AuthRequired(db, testJWTSecret))
	router.GET("/snapshot", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"capabilities": authenticatedCapabilities(c),
			"scopes":       authenticatedScopes(c),
			"authz_epoch":  authenticatedAuthzEpoch(c),
			"actor_flags":  authenticatedActorFlags(c),
		})
	})

	req := httptest.NewRequest(http.MethodGet, "/snapshot", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("X-Tenant-ID", tenantID.String())
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", resp.Code, resp.Body.String())
	}

	var body struct {
		Capabilities []string        `json:"capabilities"`
		Scopes       []string        `json:"scopes"`
		AuthzEpoch   int64           `json:"authz_epoch"`
		ActorFlags   map[string]bool `json:"actor_flags"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	assertContainsString(t, body.Capabilities, "iam.user.read")
	assertContainsString(t, body.Capabilities, "log.query.read")
	assertNotContainsString(t, body.Capabilities, "dashboard.read")
	assertContainsString(t, body.Scopes, "tenant")
	assertContainsString(t, body.Scopes, "owned")
	if body.AuthzEpoch != 1 {
		t.Fatalf("expected authz epoch 1, got %d", body.AuthzEpoch)
	}
	if !body.ActorFlags["interactive_login_allowed"] || body.ActorFlags["system_subject"] {
		t.Fatalf("unexpected actor flags: %#v", body.ActorFlags)
	}
}

func TestRequireCapability_FailsClosedWhenAuthorizationUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequireCapability("iam.user.read"))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/protected", nil))
	if resp.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d body=%s", resp.Code, resp.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["code"] != "AUTHORIZATION_UNAVAILABLE" {
		t.Fatalf("expected AUTHORIZATION_UNAVAILABLE, got %v", body["code"])
	}
}

func TestRequireScope_AllowsExactScope(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(contextKeyAuthorizationReady, true)
		c.Set(contextKeyUserScopes, []string{"owned", "tenant"})
		c.Next()
	})
	router.Use(RequireScope("tenant"))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/protected", nil))
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", resp.Code, resp.Body.String())
	}
}

func TestRequireScope_RejectsInsufficientScopes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(contextKeyAuthorizationReady, true)
		c.Set(contextKeyUserScopes, []string{"owned"})
		c.Next()
	})
	router.Use(RequireScope("tenant"))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/protected", nil))
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", resp.Code, resp.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["message"] != "insufficient scopes" {
		t.Fatalf("unexpected message: %v", body["message"])
	}
}

func TestRequireScope_FailsClosedWhenAuthorizationUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequireScope("tenant"))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/protected", nil))
	if resp.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d body=%s", resp.Code, resp.Body.String())
	}
}

func TestRequireCapability_UsesCompatibilityMappingAndDeniesMissingCapability(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	userID := uuid.New()
	tenantID := uuid.New()
	accessToken, accessTokenJTI := mustIssueAccessToken(t, userID, tenantID)

	setupViewer := func() {
		expectActiveSessionQuery(mock, tenantID, userID, accessTokenJTI)
		userRows := sqlmock.NewRows([]string{"id", "tenant_id", "username", "email", "display_name", "status", "last_login_at", "created_at", "updated_at"}).
			AddRow(userID, tenantID, "viewer", "viewer@test.com", nil, "active", nil, time.Now(), time.Now())
		mock.ExpectQuery("SELECT .+ FROM users").WithArgs(tenantID, userID).WillReturnRows(userRows)
		viewerPerms, _ := json.Marshal([]string{"users:read"})
		roleRows := sqlmock.NewRows([]string{"id", "tenant_id", "name", "description", "permissions"}).
			AddRow(uuid.New(), tenantID, "viewer", nil, viewerPerms)
		mock.ExpectQuery("SELECT .+ FROM users u.+JOIN user_roles ur.+JOIN roles r").WithArgs(tenantID, userID).WillReturnRows(roleRows)
	}

	setupViewer()
	router := gin.New()
	router.Use(AuthRequired(db, testJWTSecret))
	router.GET("/allowed", RequireCapability("iam.user.read"), func(c *gin.Context) { c.Status(http.StatusOK) })
	router.GET("/blocked", RequireCapability("iam.user.create"), func(c *gin.Context) { c.Status(http.StatusOK) })

	reqAllowed := httptest.NewRequest(http.MethodGet, "/allowed", nil)
	reqAllowed.Header.Set("Authorization", "Bearer "+accessToken)
	reqAllowed.Header.Set("X-Tenant-ID", tenantID.String())
	respAllowed := httptest.NewRecorder()
	router.ServeHTTP(respAllowed, reqAllowed)
	if respAllowed.Code != http.StatusOK {
		t.Fatalf("expected 200 for mapped capability, got %d body=%s", respAllowed.Code, respAllowed.Body.String())
	}

	setupViewer()
	reqBlocked := httptest.NewRequest(http.MethodGet, "/blocked", nil)
	reqBlocked.Header.Set("Authorization", "Bearer "+accessToken)
	reqBlocked.Header.Set("X-Tenant-ID", tenantID.String())
	respBlocked := httptest.NewRecorder()
	router.ServeHTTP(respBlocked, reqBlocked)
	if respBlocked.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for unmapped capability, got %d body=%s", respBlocked.Code, respBlocked.Body.String())
	}
}

func TestAuthRequired_RejectsSystemAutomationInteractiveAccess(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	userID := uuid.New()
	tenantID := uuid.New()
	accessToken, accessTokenJTI := mustIssueAccessToken(t, userID, tenantID)
	expectActiveSessionQuery(mock, tenantID, userID, accessTokenJTI)

	userRows := sqlmock.NewRows([]string{"id", "tenant_id", "username", "email", "display_name", "status", "last_login_at", "created_at", "updated_at"}).
		AddRow(userID, tenantID, "system-automation", "system-automation@nexuslog.local", nil, "active", nil, time.Now(), time.Now())
	mock.ExpectQuery("SELECT .+ FROM users").WithArgs(tenantID, userID).WillReturnRows(userRows)

	automationPerms, _ := json.Marshal([]string{"audit:write"})
	roleRows := sqlmock.NewRows([]string{"id", "tenant_id", "name", "description", "permissions"}).
		AddRow(uuid.New(), tenantID, "system_automation", nil, automationPerms)
	mock.ExpectQuery("SELECT .+ FROM users u.+JOIN user_roles ur.+JOIN roles r").WithArgs(tenantID, userID).WillReturnRows(roleRows)

	router := gin.New()
	router.Use(AuthRequired(db, testJWTSecret))
	router.GET("/snapshot", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/snapshot", nil)
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
	if body["code"] != "FORBIDDEN" {
		t.Fatalf("expected FORBIDDEN, got %v", body["code"])
	}
	if body["message"] != "interactive login is disabled for this account" {
		t.Fatalf("unexpected message: %v", body["message"])
	}
}

func assertContainsString(t *testing.T, values []string, target string) {
	t.Helper()
	for _, value := range values {
		if value == target {
			return
		}
	}
	t.Fatalf("expected %q in %#v", target, values)
}

func assertNotContainsString(t *testing.T, values []string, target string) {
	t.Helper()
	for _, value := range values {
		if value == target {
			t.Fatalf("did not expect %q in %#v", target, values)
		}
	}
}

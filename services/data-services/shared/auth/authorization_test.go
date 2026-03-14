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

func TestRequireAuthenticatedIdentity_LoadsPermissionsFromDatabase(t *testing.T) {
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
	mock.ExpectQuery(regexp.QuoteMeta(userPermissionsQuery)).
		WithArgs(userID, tenantID).
		WillReturnRows(
			sqlmock.NewRows([]string{"permissions"}).
				AddRow([]byte(`["logs:read"]`)).
				AddRow([]byte(`["logs:export","audit:read"]`)),
		)

	router := gin.New()
	router.Use(RequireAuthenticatedIdentity(db, testJWTSecret))
	router.GET("/api/v1/query/logs", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"permissions": AuthenticatedPermissions(c),
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
		Permissions []string `json:"permissions"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !hasPermission(body.Permissions, "logs:read") || !hasPermission(body.Permissions, "logs:export") || !hasPermission(body.Permissions, "audit:read") {
		t.Fatalf("unexpected permissions: %#v", body.Permissions)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
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

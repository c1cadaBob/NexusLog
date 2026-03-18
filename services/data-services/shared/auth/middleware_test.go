package auth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const testJWTSecret = "data-services-auth-test-secret-20260314"

func TestRequireAuthenticatedIdentity_PublicPathBypassesAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequireAuthenticatedIdentity(nil, testJWTSecret))
	router.GET("/readyz", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
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
	router.GET("/api/v1/query/logs", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/api/v1/query/logs", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.Code)
	}
}

func TestRequireAuthenticatedIdentity_SetsIdentityHeadersFromToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequireAuthenticatedIdentity(nil, testJWTSecret))
	router.GET("/api/v1/query/logs", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"tenant_id":             c.GetHeader("X-Tenant-ID"),
			"user_id":               c.GetHeader("X-User-ID"),
			"authorized_tenant_ids": AuthenticatedAuthorizedTenantIDs(c),
		})
	})

	token := mustIssueToken(t, "10000000-0000-0000-0000-000000000001", "20000000-0000-0000-0000-000000000001", "jti-1")
	req := httptest.NewRequest(http.MethodGet, "/api/v1/query/logs", nil)
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
	if !strings.Contains(resp.Body.String(), `"authorized_tenant_ids":[]`) {
		t.Fatalf("expected empty authorized_tenant_ids in body: %s", resp.Body.String())
	}
}

func TestRequireAuthenticatedIdentity_RejectsInvalidUUIDClaims(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequireAuthenticatedIdentity(nil, testJWTSecret))
	router.GET("/api/v1/query/logs", func(c *gin.Context) { c.Status(http.StatusOK) })

	token := mustIssueToken(t, "not-a-uuid", "20000000-0000-0000-0000-000000000001", "jti-1")
	req := httptest.NewRequest(http.MethodGet, "/api/v1/query/logs", nil)
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

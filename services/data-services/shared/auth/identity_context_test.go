package auth

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestAuthenticatedTenantIDUsesContextOnly(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Request.Header.Set("X-Tenant-ID", "spoofed-tenant")

	c.Set(string(contextKeyTenantID), "authenticated-tenant")
	if got := AuthenticatedTenantID(c); got != "authenticated-tenant" {
		t.Fatalf("AuthenticatedTenantID() = %q, want authenticated-tenant", got)
	}
}

func TestAuthenticatedUserIDIgnoresHeadersWithoutContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Request.Header.Set("X-Tenant-ID", "spoofed-tenant")
	c.Request.Header.Set("X-User-ID", "spoofed-user")

	if got := AuthenticatedTenantID(c); got != "" {
		t.Fatalf("AuthenticatedTenantID() = %q, want empty", got)
	}
	if got := AuthenticatedUserID(c); got != "" {
		t.Fatalf("AuthenticatedUserID() = %q, want empty", got)
	}
}

func TestAuthenticatedPermissionsUsesContextOnly(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Set(string(contextKeyUserPermissions), []string{"logs:read", "logs:export"})

	permissions := AuthenticatedPermissions(c)
	if len(permissions) != 2 {
		t.Fatalf("AuthenticatedPermissions() = %#v, want 2 permissions", permissions)
	}
}

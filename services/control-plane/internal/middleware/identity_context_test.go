package middleware

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

	c.Set(authContextKeyTenantID, "authenticated-tenant")
	if got := AuthenticatedTenantID(c); got != "authenticated-tenant" {
		t.Fatalf("AuthenticatedTenantID() = %q, want authenticated-tenant", got)
	}
	if got := AuthenticatedUserID(c); got != "" {
		t.Fatalf("AuthenticatedUserID() = %q, want empty", got)
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
	if got := AuthenticatedUserIDPtr(c); got != nil {
		t.Fatalf("AuthenticatedUserIDPtr() = %v, want nil", got)
	}
}

func TestAuthenticatedAuthorizationSnapshotUsesContextOnly(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Set(authContextKeyUserPermissions, []string{"logs:read", "logs:export"})
	c.Set(authContextKeyUserCapabilities, []string{"log.query.read", "export.job.read"})
	c.Set(authContextKeyUserScopes, []string{"tenant", "owned"})
	c.Set(authContextKeyUserAuthzEpoch, int64(7))
	c.Set(authContextKeyUserActorFlags, map[string]bool{"reserved": true})

	permissions := AuthenticatedPermissions(c)
	capabilities := AuthenticatedCapabilities(c)
	scopes := AuthenticatedScopes(c)
	actorFlags := AuthenticatedActorFlags(c)
	if len(permissions) != 2 || len(capabilities) != 2 || len(scopes) != 2 {
		t.Fatalf("unexpected snapshot: perms=%#v caps=%#v scopes=%#v", permissions, capabilities, scopes)
	}
	if AuthenticatedAuthzEpoch(c) != 7 {
		t.Fatalf("AuthenticatedAuthzEpoch() = %d, want 7", AuthenticatedAuthzEpoch(c))
	}
	if !actorFlags["reserved"] {
		t.Fatalf("AuthenticatedActorFlags() = %#v, want reserved=true", actorFlags)
	}
}

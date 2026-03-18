package auth

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestResolveTenantReadScope_AllTenantsRequiresScopeAndReadCapability(t *testing.T) {
	scope := ResolveTenantReadScope([]string{"log.query.read"}, []string{"all_tenants"})
	if scope != TenantReadScopeAllTenants {
		t.Fatalf("ResolveTenantReadScope() = %q, want %q", scope, TenantReadScopeAllTenants)
	}
}

func TestResolveTenantReadScope_StaysTenantWithoutCrossTenantScope(t *testing.T) {
	scope := ResolveTenantReadScope([]string{"log.query.read"}, []string{"tenant"})
	if scope != TenantReadScopeTenant {
		t.Fatalf("ResolveTenantReadScope() = %q, want %q", scope, TenantReadScopeTenant)
	}
}

func TestAuthenticatedTenantReadScope_DerivesFromCapabilitiesAndScopes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Set(string(contextKeyUserCapabilities), []string{"log.query.read"})
	c.Set(string(contextKeyUserScopes), []string{"all_tenants"})

	if got := AuthenticatedTenantReadScope(c); got != TenantReadScopeAllTenants {
		t.Fatalf("AuthenticatedTenantReadScope() = %q, want %q", got, TenantReadScopeAllTenants)
	}
}

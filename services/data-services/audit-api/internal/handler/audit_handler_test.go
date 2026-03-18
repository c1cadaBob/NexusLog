package handler

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	sharedauth "github.com/nexuslog/data-services/shared/auth"
)

func TestResolveActorIncludesBypassScope(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Set("tenant_id", "10000000-0000-0000-0000-000000000001")
	c.Set("user_capabilities", []string{"audit.log.read"})
	c.Set("user_scopes", []string{"all_tenants"})

	actor := resolveActor(c)
	if actor.TenantID != "10000000-0000-0000-0000-000000000001" {
		t.Fatalf("resolveActor().TenantID = %q", actor.TenantID)
	}
	if actor.TenantReadScope != sharedauth.TenantReadScopeAllTenants {
		t.Fatalf("resolveActor().TenantReadScope = %q, want %q", actor.TenantReadScope, sharedauth.TenantReadScopeAllTenants)
	}
}

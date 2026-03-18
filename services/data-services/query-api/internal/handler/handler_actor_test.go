package handler

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	sharedauth "github.com/nexuslog/data-services/shared/auth"
)

func TestResolveActor_IncludesAuthorizedTenantIDs(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Set("tenant_id", "10000000-0000-0000-0000-000000000001")
	c.Set("user_id", "20000000-0000-0000-0000-000000000001")
	c.Set("user_capabilities", []string{"log.query.read"})
	c.Set("user_scopes", []string{"tenant"})
	c.Set("user_authorized_tenant_ids", []string{"tenant-a", "tenant-b"})

	actor := resolveActor(c)
	if actor.TenantID != "10000000-0000-0000-0000-000000000001" {
		t.Fatalf("resolveActor().TenantID = %q", actor.TenantID)
	}
	if actor.UserID != "20000000-0000-0000-0000-000000000001" {
		t.Fatalf("resolveActor().UserID = %q", actor.UserID)
	}
	if actor.TenantReadScope != sharedauth.TenantReadScopeTenant {
		t.Fatalf("resolveActor().TenantReadScope = %q, want %q", actor.TenantReadScope, sharedauth.TenantReadScopeTenant)
	}
	if len(actor.AuthorizedTenantIDs) != 2 {
		t.Fatalf("resolveActor().AuthorizedTenantIDs = %#v, want 2 items", actor.AuthorizedTenantIDs)
	}
}

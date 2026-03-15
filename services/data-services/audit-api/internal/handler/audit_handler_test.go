package handler

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestResolveActorIncludesBypassScope(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Set("tenant_id", "10000000-0000-0000-0000-000000000001")
	c.Set("global_log_access", true)

	actor := resolveActor(c)
	if actor.TenantID != "10000000-0000-0000-0000-000000000001" {
		t.Fatalf("resolveActor().TenantID = %q", actor.TenantID)
	}
	if !actor.BypassTenantScope {
		t.Fatal("resolveActor().BypassTenantScope = false, want true")
	}
}

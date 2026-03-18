package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/nexuslog/data-services/export-api/internal/service"
	sharedauth "github.com/nexuslog/data-services/shared/auth"
)

func TestResolveActor_UsesAuthenticatedTenantReadScope(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Set("tenant_id", "tenant-a")
	c.Set("user_id", "user-a")
	c.Set("user_capabilities", []string{"log.query.read"})
	c.Set("user_scopes", []string{"all_tenants", "tenant"})

	actor := resolveActor(c)
	if actor.TenantID != "tenant-a" || actor.UserID != "user-a" {
		t.Fatalf("resolveActor() = %#v, want tenant/user from authenticated context", actor)
	}
	if actor.TenantReadScope != sharedauth.TenantReadScopeAllTenants {
		t.Fatalf("resolveActor().TenantReadScope = %q, want %q", actor.TenantReadScope, sharedauth.TenantReadScopeAllTenants)
	}
	if len(actor.Capabilities) != 1 || actor.Capabilities[0] != "log.query.read" {
		t.Fatalf("resolveActor().Capabilities = %#v, want log.query.read", actor.Capabilities)
	}
	if len(actor.Scopes) != 2 || actor.Scopes[0] != "all_tenants" || actor.Scopes[1] != "tenant" {
		t.Fatalf("resolveActor().Scopes = %#v, want authenticated scopes", actor.Scopes)
	}
}

func TestResolveActor_ReturnTypeMatchesServiceActor(t *testing.T) {
	var actor any = resolveActor(nil)
	if _, ok := actor.(service.RequestActor); !ok {
		t.Fatalf("resolveActor() type = %T, want service.RequestActor", actor)
	}
}

func TestWriteServiceError_MapsScopeDeniedToForbidden(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	writeServiceError(c, errors.Join(service.ErrExportScopeDenied, errors.New("owned")))

	if w.Code != http.StatusForbidden {
		t.Fatalf("writeServiceError() status = %d, want %d", w.Code, http.StatusForbidden)
	}
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if body["code"] != CodeExportForbidden {
		t.Fatalf("writeServiceError() code = %v, want %q", body["code"], CodeExportForbidden)
	}
	if body["message"] != "insufficient scopes" {
		t.Fatalf("writeServiceError() message = %v, want insufficient scopes", body["message"])
	}
}

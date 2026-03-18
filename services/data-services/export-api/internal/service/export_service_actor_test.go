package service

import (
	"errors"
	"testing"

	"github.com/nexuslog/data-services/export-api/internal/repository"
	sharedauth "github.com/nexuslog/data-services/shared/auth"
)

func TestNormalizeActor_RejectsMissingTenant(t *testing.T) {
	_, err := normalizeActor(RequestActor{})
	if !errors.Is(err, repository.ErrTenantContextRequired) {
		t.Fatalf("normalizeActor() error = %v, want ErrTenantContextRequired", err)
	}
}

func TestNormalizeActor_NormalizesTenantReadScope(t *testing.T) {
	actor, err := normalizeActor(RequestActor{
		TenantID:        " tenant-a ",
		UserID:          " user-a ",
		TenantReadScope: sharedauth.TenantReadScope("all_tenants"),
	})
	if err != nil {
		t.Fatalf("normalizeActor() error = %v", err)
	}
	if actor.TenantID != "tenant-a" || actor.UserID != "user-a" {
		t.Fatalf("normalizeActor() = %#v, want trimmed tenant/user", actor)
	}
	if actor.TenantReadScope != sharedauth.TenantReadScopeAllTenants {
		t.Fatalf("normalizeActor().TenantReadScope = %q, want %q", actor.TenantReadScope, sharedauth.TenantReadScopeAllTenants)
	}
}

func TestParseQueryParams_UsesActorTenantID(t *testing.T) {
	params := parseQueryParams(RequestActor{
		TenantID:        "tenant-a",
		TenantReadScope: sharedauth.TenantReadScopeAllTenants,
	}, map[string]any{
		"tenant_id": "tenant-b",
		"keywords":  "error",
	})
	if params.TenantID != "tenant-a" {
		t.Fatalf("parseQueryParams().TenantID = %q, want actor tenant", params.TenantID)
	}
	if params.Keywords != "error" {
		t.Fatalf("parseQueryParams().Keywords = %q, want error", params.Keywords)
	}
}

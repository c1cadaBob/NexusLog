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
		Capabilities:    []string{" export.job.read ", ""},
		Scopes:          []string{" tenant ", ""},
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
	if len(actor.Capabilities) != 1 || actor.Capabilities[0] != CapabilityExportJobRead {
		t.Fatalf("normalizeActor().Capabilities = %#v, want [%q]", actor.Capabilities, CapabilityExportJobRead)
	}
	if len(actor.Scopes) != 1 || actor.Scopes[0] != ScopeTenant {
		t.Fatalf("normalizeActor().Scopes = %#v, want [%q]", actor.Scopes, ScopeTenant)
	}
}

func TestRequireActorCapability_AllowsExactAndWildcard(t *testing.T) {
	if err := requireActorCapability(RequestActor{Capabilities: []string{CapabilityExportJobCreate}}, CapabilityExportJobCreate); err != nil {
		t.Fatalf("requireActorCapability() error = %v, want nil", err)
	}
	if err := requireActorCapability(RequestActor{Capabilities: []string{"*"}}, CapabilityExportJobDownload); err != nil {
		t.Fatalf("requireActorCapability() wildcard error = %v, want nil", err)
	}
}

func TestRequireActorCapability_RejectsMissingCapability(t *testing.T) {
	err := requireActorCapability(RequestActor{Capabilities: []string{CapabilityExportJobRead}}, CapabilityExportJobDownload)
	if !errors.Is(err, ErrExportPermissionDenied) {
		t.Fatalf("requireActorCapability() error = %v, want ErrExportPermissionDenied", err)
	}
}

func TestResolveExportOwnerFilter_AllowsTenantScopeWithoutOwnerFilter(t *testing.T) {
	ownerUserID, err := resolveExportOwnerFilter(RequestActor{TenantID: "tenant-a", Scopes: []string{ScopeTenant}})
	if err != nil {
		t.Fatalf("resolveExportOwnerFilter() error = %v", err)
	}
	if ownerUserID != "" {
		t.Fatalf("resolveExportOwnerFilter() = %q, want empty", ownerUserID)
	}
}

func TestResolveExportOwnerFilter_UsesActorUserForOwnedScope(t *testing.T) {
	ownerUserID, err := resolveExportOwnerFilter(RequestActor{TenantID: "tenant-a", UserID: "user-a", Scopes: []string{ScopeOwned}})
	if err != nil {
		t.Fatalf("resolveExportOwnerFilter() error = %v", err)
	}
	if ownerUserID != "user-a" {
		t.Fatalf("resolveExportOwnerFilter() = %q, want user-a", ownerUserID)
	}
}

func TestResolveExportOwnerFilter_RejectsMissingScopes(t *testing.T) {
	_, err := resolveExportOwnerFilter(RequestActor{TenantID: "tenant-a"})
	if !errors.Is(err, ErrExportScopeDenied) {
		t.Fatalf("resolveExportOwnerFilter() error = %v, want ErrExportScopeDenied", err)
	}
}

func TestRequireExportCreateScope_AcceptsOwnedAndTenant(t *testing.T) {
	if err := requireExportCreateScope(RequestActor{TenantID: "tenant-a", UserID: "20000000-0000-0000-0000-000000000001", Scopes: []string{ScopeOwned}}); err != nil {
		t.Fatalf("requireExportCreateScope() owned error = %v", err)
	}
	if err := requireExportCreateScope(RequestActor{TenantID: "tenant-a", Scopes: []string{ScopeTenant}}); err != nil {
		t.Fatalf("requireExportCreateScope() tenant error = %v", err)
	}
}

func TestRequireExportCreateScope_RejectsOwnedScopeWithoutUserID(t *testing.T) {
	err := requireExportCreateScope(RequestActor{TenantID: "tenant-a", Scopes: []string{ScopeOwned}})
	if !errors.Is(err, ErrExportScopeDenied) {
		t.Fatalf("requireExportCreateScope() error = %v, want ErrExportScopeDenied", err)
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

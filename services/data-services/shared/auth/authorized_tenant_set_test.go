package auth

import (
	"errors"
	"reflect"
	"testing"
)

func TestResolveAuthorizedTenantSet_UsesCurrentTenantForTenantScope(t *testing.T) {
	set, err := ResolveAuthorizedTenantSet("tenant-b", TenantReadScopeTenant, nil)
	if err != nil {
		t.Fatalf("ResolveAuthorizedTenantSet() error = %v", err)
	}
	if set.AllowsAllTenants() {
		t.Fatal("ResolveAuthorizedTenantSet() unexpectedly allows all tenants")
	}
	if got := set.TenantIDs(); !reflect.DeepEqual(got, []string{"tenant-b"}) {
		t.Fatalf("ResolveAuthorizedTenantSet() tenant ids = %#v, want tenant-b", got)
	}
}

func TestResolveAuthorizedTenantSet_UsesExplicitAuthorizedTenants(t *testing.T) {
	set, err := ResolveAuthorizedTenantSet("tenant-z", TenantReadScopeTenant, []string{"tenant-b", "tenant-a", "tenant-b", "  ", "tenant-c"})
	if err != nil {
		t.Fatalf("ResolveAuthorizedTenantSet() error = %v", err)
	}
	if got := set.TenantIDs(); !reflect.DeepEqual(got, []string{"tenant-a", "tenant-b", "tenant-c"}) {
		t.Fatalf("ResolveAuthorizedTenantSet() tenant ids = %#v, want normalized list", got)
	}
}

func TestResolveAuthorizedTenantSet_AllTenantsBypassesTenantList(t *testing.T) {
	set, err := ResolveAuthorizedTenantSet("", TenantReadScopeAllTenants, nil)
	if err != nil {
		t.Fatalf("ResolveAuthorizedTenantSet() error = %v", err)
	}
	if !set.AllowsAllTenants() {
		t.Fatal("ResolveAuthorizedTenantSet() = tenant-scoped, want all tenants")
	}
	if got := set.TenantIDs(); len(got) != 0 {
		t.Fatalf("ResolveAuthorizedTenantSet() tenant ids = %#v, want empty", got)
	}
}

func TestResolveAuthorizedTenantSet_RejectsEmptyTenantScope(t *testing.T) {
	_, err := ResolveAuthorizedTenantSet("", TenantReadScopeTenant, nil)
	if !errors.Is(err, ErrAuthorizedTenantSetRequired) {
		t.Fatalf("ResolveAuthorizedTenantSet() error = %v, want ErrAuthorizedTenantSetRequired", err)
	}
}

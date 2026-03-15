package repository

import "testing"

func TestAuditTenantScopeArg(t *testing.T) {
	if got := auditTenantScopeArg("tenant-1", false); got != "tenant-1" {
		t.Fatalf("auditTenantScopeArg() = %#v, want tenant-1", got)
	}
	if got := auditTenantScopeArg("tenant-1", true); got != nil {
		t.Fatalf("auditTenantScopeArg() = %#v, want nil", got)
	}
	if got := auditTenantScopeArg("", false); got != nil {
		t.Fatalf("auditTenantScopeArg() = %#v, want nil", got)
	}
}

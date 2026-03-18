package repository

import (
	"testing"

	sharedauth "github.com/nexuslog/data-services/shared/auth"
)

func TestAuditTenantScopeArg(t *testing.T) {
	if got := auditTenantScopeArg("tenant-1", sharedauth.TenantReadScopeTenant); got != "tenant-1" {
		t.Fatalf("auditTenantScopeArg() = %#v, want tenant-1", got)
	}
	if got := auditTenantScopeArg("tenant-1", sharedauth.TenantReadScopeAllTenants); got != nil {
		t.Fatalf("auditTenantScopeArg() = %#v, want nil", got)
	}
	if got := auditTenantScopeArg("", sharedauth.TenantReadScopeTenant); got != nil {
		t.Fatalf("auditTenantScopeArg() = %#v, want nil", got)
	}
}

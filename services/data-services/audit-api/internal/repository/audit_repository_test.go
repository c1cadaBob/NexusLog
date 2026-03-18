package repository

import (
	"testing"

	sharedauth "github.com/nexuslog/data-services/shared/auth"
)

func TestBuildAuditLogWhereClause_UsesExplicitTenantScope(t *testing.T) {
	clause, args, err := buildAuditLogWhereClause(ListAuditLogsInput{TenantID: "tenant-1", TenantReadScope: sharedauth.TenantReadScopeTenant})
	if err != nil {
		t.Fatalf("buildAuditLogWhereClause() error = %v", err)
	}
	if clause != "tenant_id = $1::uuid" {
		t.Fatalf("buildAuditLogWhereClause() clause = %q, want tenant clause", clause)
	}
	if len(args) != 1 || args[0] != "tenant-1" {
		t.Fatalf("buildAuditLogWhereClause() args = %#v, want tenant-1", args)
	}
}

func TestBuildAuditLogWhereClause_OmitsTenantPredicateForAllTenants(t *testing.T) {
	clause, args, err := buildAuditLogWhereClause(ListAuditLogsInput{TenantID: "tenant-1", TenantReadScope: sharedauth.TenantReadScopeAllTenants})
	if err != nil {
		t.Fatalf("buildAuditLogWhereClause() error = %v", err)
	}
	if clause != "1=1" {
		t.Fatalf("buildAuditLogWhereClause() clause = %q, want 1=1", clause)
	}
	if len(args) != 0 {
		t.Fatalf("buildAuditLogWhereClause() args = %#v, want empty", args)
	}
}

func TestBuildAuditLogWhereClause_RejectsMissingTenantForTenantScope(t *testing.T) {
	_, _, err := buildAuditLogWhereClause(ListAuditLogsInput{TenantReadScope: sharedauth.TenantReadScopeTenant})
	if err == nil || err.Error() != "tenant_id is required" {
		t.Fatalf("buildAuditLogWhereClause() error = %v, want tenant_id is required", err)
	}
}

package repository

import (
	"database/sql/driver"
	"errors"
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

func TestBuildAuditLogWhereClause_UsesAuthorizedTenantSetWhenPresent(t *testing.T) {
	clause, args, err := buildAuditLogWhereClause(ListAuditLogsInput{
		TenantReadScope:     sharedauth.TenantReadScopeTenant,
		AuthorizedTenantIDs: []string{"tenant-b", "tenant-a", "tenant-b"},
	})
	if err != nil {
		t.Fatalf("buildAuditLogWhereClause() error = %v", err)
	}
	if clause != "tenant_id = ANY($1::uuid[])" {
		t.Fatalf("buildAuditLogWhereClause() clause = %q, want ANY tenant clause", clause)
	}
	if len(args) != 1 {
		t.Fatalf("buildAuditLogWhereClause() args len = %d, want 1", len(args))
	}
	valuer, ok := args[0].(driver.Valuer)
	if !ok {
		t.Fatalf("buildAuditLogWhereClause() arg[0] type = %T, want driver.Valuer", args[0])
	}
	encoded, err := valuer.Value()
	if err != nil {
		t.Fatalf("valuer.Value() error = %v", err)
	}
	if encoded != `{"tenant-a","tenant-b"}` {
		t.Fatalf("valuer.Value() = %v, want normalized pq array", encoded)
	}
}

func TestBuildAuditLogWhereClause_RejectsMissingTenantForTenantScope(t *testing.T) {
	_, _, err := buildAuditLogWhereClause(ListAuditLogsInput{TenantReadScope: sharedauth.TenantReadScopeTenant})
	if !errors.Is(err, sharedauth.ErrAuthorizedTenantSetRequired) {
		t.Fatalf("buildAuditLogWhereClause() error = %v, want ErrAuthorizedTenantSetRequired", err)
	}
}

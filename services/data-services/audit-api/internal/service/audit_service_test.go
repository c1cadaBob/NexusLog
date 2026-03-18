package service

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/nexuslog/data-services/audit-api/internal/repository"
	sharedauth "github.com/nexuslog/data-services/shared/auth"
)

func TestListAuditLogs_AllTenantsScopeDoesNotRequireTenantID(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	now := time.Date(2026, 3, 18, 10, 0, 0, 0, time.UTC)
	mock.ExpectQuery(`SELECT COUNT\(1\)\s+FROM audit_logs\s+WHERE 1=1`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery(`SELECT\s+id::text,\s+tenant_id::text,\s+user_id::text,\s+action,\s+resource_type,\s+resource_id,\s+details,\s+ip_address::text,\s+user_agent,\s+created_at\s+FROM audit_logs\s+WHERE 1=1\s+ORDER BY created_at DESC\s+OFFSET \$1 LIMIT \$2`).
		WithArgs(0, 20).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "user_id", "action", "resource_type", "resource_id", "details", "ip_address", "user_agent", "created_at"}).
			AddRow("audit-1", "tenant-a", "user-a", "user.login", "session", "session-1", []byte(`{"ok":true}`), "127.0.0.1", "tester", now))

	svc := NewAuditService(repository.NewAuditRepository(db))
	result, err := svc.ListAuditLogs(context.Background(), RequestActor{TenantReadScope: sharedauth.TenantReadScopeAllTenants}, ListAuditLogsRequest{})
	if err != nil {
		t.Fatalf("ListAuditLogs() error = %v", err)
	}
	if result.Total != 1 {
		t.Fatalf("ListAuditLogs() total = %d, want 1", result.Total)
	}
	if len(result.Items) != 1 {
		t.Fatalf("ListAuditLogs() items = %d, want 1", len(result.Items))
	}
	if result.Items[0].TenantID != "tenant-a" {
		t.Fatalf("ListAuditLogs() tenant_id = %q, want tenant-a", result.Items[0].TenantID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

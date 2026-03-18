package repository

import (
	"context"
	"database/sql"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

func TestLoadLegacyPermissionMappings(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	repo := NewAuthRepository(db)
	mock.ExpectQuery(`FROM legacy_permission_mapping`).WillReturnRows(
		sqlmock.NewRows([]string{"legacy_permission", "capability_bundle", "scope_bundle", "enabled"}).
			AddRow("users:read", []byte(`["iam.user.read","iam.role.read"]`), []byte(`["tenant"]`), true).
			AddRow("users:write", []byte(`["iam.user.create"]`), []byte(`["tenant"]`), false),
	)

	capabilityAliases, permissionScopes, found, err := repo.LoadLegacyPermissionMappings(context.Background())
	if err != nil {
		t.Fatalf("LoadLegacyPermissionMappings returned error: %v", err)
	}
	if !found {
		t.Fatal("expected explicit mapping table to be detected")
	}
	if len(capabilityAliases["users:read"]) != 2 {
		t.Fatalf("unexpected capability aliases: %#v", capabilityAliases)
	}
	if len(permissionScopes["users:read"]) != 1 || permissionScopes["users:read"][0] != "tenant" {
		t.Fatalf("unexpected permission scopes: %#v", permissionScopes)
	}
	if _, exists := capabilityAliases["users:write"]; exists {
		t.Fatalf("disabled mapping should not be exposed: %#v", capabilityAliases)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestLoadLegacyPermissionMappings_MissingTableFallsBack(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	repo := NewAuthRepository(db)
	mock.ExpectQuery(`FROM legacy_permission_mapping`).WillReturnError(&pq.Error{Code: "42P01"})

	capabilityAliases, permissionScopes, found, err := repo.LoadLegacyPermissionMappings(context.Background())
	if err != nil {
		t.Fatalf("LoadLegacyPermissionMappings returned error: %v", err)
	}
	if found {
		t.Fatal("expected explicit mapping table to be absent")
	}
	if len(capabilityAliases) != 0 || len(permissionScopes) != 0 {
		t.Fatalf("expected empty fallback payload, got aliases=%#v scopes=%#v", capabilityAliases, permissionScopes)
	}
}

func TestGetUserAuthzEpoch_NoRowsReturnsZero(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	repo := NewAuthRepository(db)
	tenantID := uuid.New()
	userID := uuid.New()
	mock.ExpectQuery(`FROM authz_version`).WithArgs(tenantID, userID).WillReturnError(sql.ErrNoRows)

	epoch, err := repo.GetUserAuthzEpoch(context.Background(), tenantID, userID)
	if err != nil {
		t.Fatalf("GetUserAuthzEpoch returned error: %v", err)
	}
	if epoch != 0 {
		t.Fatalf("epoch=%d, want 0", epoch)
	}
}

package middleware

import (
	"context"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestHasGlobalTenantReadAccess(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery(regexp.QuoteMeta(authorizationContextQuery)).
		WithArgs("20000000-0000-0000-0000-000000000001", "10000000-0000-0000-0000-000000000001").
		WillReturnRows(
			sqlmock.NewRows([]string{"username", "name", "permissions"}).
				AddRow("delegated-reader", "viewer", []byte(`[
					"alert.rule.read",
					"all_tenants"
				]`)),
		)
	mock.ExpectQuery(`FROM legacy_permission_mapping`).
		WillReturnRows(sqlmock.NewRows([]string{"legacy_permission", "capability_bundle", "scope_bundle", "enabled"}))
	mock.ExpectQuery(`FROM authz_version`).
		WithArgs("10000000-0000-0000-0000-000000000001", "20000000-0000-0000-0000-000000000001").
		WillReturnRows(sqlmock.NewRows([]string{"authz_epoch"}).AddRow(1))

	allowed, err := HasGlobalTenantReadAccess(context.Background(), db, "10000000-0000-0000-0000-000000000001", "20000000-0000-0000-0000-000000000001")
	if err != nil {
		t.Fatalf("HasGlobalTenantReadAccess() error = %v", err)
	}
	if !allowed {
		t.Fatal("HasGlobalTenantReadAccess() = false, want true")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestHasGlobalTenantReadAccess_AllowsContextBackedWildcardScope(t *testing.T) {
	ctx := context.WithValue(context.Background(), authContextKeyAuthorizationReady, true)
	ctx = context.WithValue(ctx, authContextKeyUserCapabilities, []string{"*"})
	ctx = context.WithValue(ctx, authContextKeyUserScopes, []string{"all_tenants", "tenant"})

	allowed, err := HasGlobalTenantReadAccess(ctx, nil, "10000000-0000-0000-0000-000000000001", "20000000-0000-0000-0000-000000000001")
	if err != nil {
		t.Fatalf("HasGlobalTenantReadAccess() error = %v", err)
	}
	if !allowed {
		t.Fatal("HasGlobalTenantReadAccess() = false, want true")
	}
}

func TestHasGlobalTenantReadAccess_AllowsContextBackedReadCapabilityWithScope(t *testing.T) {
	ctx := context.WithValue(context.Background(), authContextKeyAuthorizationReady, true)
	ctx = context.WithValue(ctx, authContextKeyUserCapabilities, []string{"notification.channel.read_metadata"})
	ctx = context.WithValue(ctx, authContextKeyUserScopes, []string{"all_tenants", "tenant"})

	allowed, err := HasGlobalTenantReadAccess(ctx, nil, "10000000-0000-0000-0000-000000000001", "20000000-0000-0000-0000-000000000001")
	if err != nil {
		t.Fatalf("HasGlobalTenantReadAccess() error = %v", err)
	}
	if !allowed {
		t.Fatal("HasGlobalTenantReadAccess() = false, want true")
	}
}

func TestHasGlobalTenantReadAccess_RejectsUntrustedContextSnapshot(t *testing.T) {
	ctx := context.WithValue(context.Background(), authContextKeyUserCapabilities, []string{"*"})
	ctx = context.WithValue(ctx, authContextKeyUserScopes, []string{"all_tenants", "tenant"})

	allowed, err := HasGlobalTenantReadAccess(ctx, nil, "10000000-0000-0000-0000-000000000001", "20000000-0000-0000-0000-000000000001")
	if err != nil {
		t.Fatalf("HasGlobalTenantReadAccess() error = %v", err)
	}
	if allowed {
		t.Fatal("HasGlobalTenantReadAccess() = true, want false")
	}
}

func TestHasGlobalTenantReadAccess_SkipsWhenIdentityMissing(t *testing.T) {
	allowed, err := HasGlobalTenantReadAccess(context.Background(), nil, "", "")
	if err != nil {
		t.Fatalf("HasGlobalTenantReadAccess() error = %v", err)
	}
	if allowed {
		t.Fatal("HasGlobalTenantReadAccess() = true, want false")
	}
}

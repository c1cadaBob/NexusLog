package repository

import (
	"errors"
	"testing"
)

func TestNormalizeRequiredUUID_RejectsMissingTenantContext(t *testing.T) {
	_, err := normalizeRequiredUUID("", ErrTenantContextRequired)
	if !errors.Is(err, ErrTenantContextRequired) {
		t.Fatalf("normalizeRequiredUUID() error = %v, want ErrTenantContextRequired", err)
	}
}

func TestNormalizeRequiredUUID_NormalizesValidUUID(t *testing.T) {
	got, err := normalizeRequiredUUID("10000000-0000-0000-0000-0000000000AA", ErrTenantContextRequired)
	if err != nil {
		t.Fatalf("normalizeRequiredUUID() error = %v", err)
	}
	if got != "10000000-0000-0000-0000-0000000000aa" {
		t.Fatalf("normalizeRequiredUUID() = %q, want lowercase uuid", got)
	}
}

func TestNormalizeOptionalUUID_RejectsInvalidNonEmptyValue(t *testing.T) {
	_, err := normalizeOptionalUUID("not-a-uuid", "created_by")
	if err == nil || err.Error() != "created_by is invalid" {
		t.Fatalf("normalizeOptionalUUID() error = %v, want created_by is invalid", err)
	}
}

func TestNormalizeLookupUUID_UsesProvidedFallbackError(t *testing.T) {
	_, err := normalizeLookupUUID("bad-id", ErrExportNotFound)
	if !errors.Is(err, ErrExportNotFound) {
		t.Fatalf("normalizeLookupUUID() error = %v, want ErrExportNotFound", err)
	}
}

func TestBuildCreatedByOwnershipClause_OmitsOwnerFilterWhenEmpty(t *testing.T) {
	clause, args, err := buildCreatedByOwnershipClause(3, "")
	if err != nil {
		t.Fatalf("buildCreatedByOwnershipClause() error = %v", err)
	}
	if clause != "" || len(args) != 0 {
		t.Fatalf("buildCreatedByOwnershipClause() = (%q, %#v), want empty", clause, args)
	}
}

func TestBuildCreatedByOwnershipClause_UsesExplicitPredicateWhenOwned(t *testing.T) {
	clause, args, err := buildCreatedByOwnershipClause(3, "20000000-0000-0000-0000-0000000000AA")
	if err != nil {
		t.Fatalf("buildCreatedByOwnershipClause() error = %v", err)
	}
	if clause != " AND created_by = $3::uuid" {
		t.Fatalf("buildCreatedByOwnershipClause() clause = %q, want explicit created_by predicate", clause)
	}
	if len(args) != 1 || args[0] != "20000000-0000-0000-0000-0000000000aa" {
		t.Fatalf("buildCreatedByOwnershipClause() args = %#v, want lowercase owner uuid", args)
	}
}

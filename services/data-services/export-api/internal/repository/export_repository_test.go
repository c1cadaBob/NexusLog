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

package ingest

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNewPGBackendRequiresExplicitTenantID(t *testing.T) {
	t.Setenv(ingestDefaultTenantEnvKey, "")

	backend, err := NewPGBackend(nil, PGOptions{})
	if err == nil {
		t.Fatal("expected error when ingest tenant id is missing")
	}
	if backend != nil {
		t.Fatal("expected backend to be nil when ingest tenant id is missing")
	}
}

func TestNewPGBackendUsesOptionTenantID(t *testing.T) {
	t.Setenv(ingestDefaultTenantEnvKey, "")

	backend, err := NewPGBackend(nil, PGOptions{DefaultTenantID: "11111111-1111-1111-1111-111111111111"})
	if err != nil {
		t.Fatalf("expected backend init success, got error: %v", err)
	}
	if backend == nil {
		t.Fatal("expected backend instance")
	}
	if got := backend.ResolveTenantID(nil); got != "11111111-1111-1111-1111-111111111111" {
		t.Fatalf("unexpected tenant id: %s", got)
	}
}

func TestNewPGBackendUsesTenantIDFile(t *testing.T) {
	t.Setenv(ingestDefaultTenantEnvKey, "")

	tenantFile := filepath.Join(t.TempDir(), "tenant-id")
	if err := os.WriteFile(tenantFile, []byte("22222222-2222-2222-2222-222222222222\n"), 0o600); err != nil {
		t.Fatalf("write tenant file: %v", err)
	}
	t.Setenv(ingestDefaultTenantFileEnvKey, tenantFile)

	backend, err := NewPGBackend(nil, PGOptions{})
	if err != nil {
		t.Fatalf("expected backend init success, got error: %v", err)
	}
	if backend == nil {
		t.Fatal("expected backend instance")
	}
	if got := backend.ResolveTenantID(nil); got != "22222222-2222-2222-2222-222222222222" {
		t.Fatalf("unexpected tenant id: %s", got)
	}
}

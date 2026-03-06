package alert

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"
	"testing"

	_ "github.com/lib/pq"
)

// TestRuleRepositoryPG_Integration runs against a real PostgreSQL if DATABASE_URL is set.
func TestRuleRepositoryPG_Integration(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = os.Getenv("DB_DSN")
	}
	if dsn == "" {
		t.Skip("DATABASE_URL or DB_DSN not set, skipping integration test")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		t.Skipf("cannot ping db: %v", err)
	}

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"
	repo := NewRuleRepositoryPG(db)

	// Create
	rule := &AlertRule{
		TenantID: tenantID,
		Name:     "test-repo-rule",
		Description: "integration test",
		Condition: json.RawMessage(`{"type":"keyword","keyword":"error","field":"message"}`),
		Severity:  "WARNING",
		Enabled:   true,
	}
	id, err := repo.CreateRule(ctx, rule)
	if err != nil {
		t.Fatalf("CreateRule: %v", err)
	}
	if id == "" {
		t.Fatal("expected non-empty id")
	}

	// Get
	got, err := repo.GetRule(ctx, tenantID, id)
	if err != nil {
		t.Fatalf("GetRule: %v", err)
	}
	if got.Name != "test-repo-rule" {
		t.Errorf("got name %s", got.Name)
	}

	// List
	items, total, err := repo.ListRules(ctx, tenantID, 1, 10)
	if err != nil {
		t.Fatalf("ListRules: %v", err)
	}
	if total < 1 || len(items) < 1 {
		t.Errorf("expected at least 1 item, got total=%d len=%d", total, len(items))
	}

	// Count
	count, err := repo.CountRules(ctx, tenantID)
	if err != nil {
		t.Fatalf("CountRules: %v", err)
	}
	if count < 1 {
		t.Errorf("expected count >= 1, got %d", count)
	}

	// Update
	newName := "updated-name"
	err = repo.UpdateRule(ctx, tenantID, id, &AlertRuleUpdate{Name: &newName})
	if err != nil {
		t.Fatalf("UpdateRule: %v", err)
	}
	got, _ = repo.GetRule(ctx, tenantID, id)
	if got.Name != "updated-name" {
		t.Errorf("after update got name %s", got.Name)
	}

	// Delete
	err = repo.DeleteRule(ctx, tenantID, id)
	if err != nil {
		t.Fatalf("DeleteRule: %v", err)
	}
	_, err = repo.GetRule(ctx, tenantID, id)
	if err != ErrRuleNotFound {
		t.Errorf("expected ErrRuleNotFound after delete, got %v", err)
	}
}

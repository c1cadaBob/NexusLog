package esindex

import (
	"database/sql"
	"net/http"
	"testing"
	"time"
)

func newEnabledReconcilerForTest() *OperationalReconciler {
	db := &sql.DB{}
	return &OperationalReconciler{
		db:        db,
		interval:  time.Minute,
		batchSize: 100,
		alertSyncer: &AlertEventSyncer{
			db:        db,
			endpoint:  "http://localhost:9200",
			indexName: defaultAlertEventsIndex,
			client:    &http.Client{},
		},
		auditSyncer: &AuditLogSyncer{
			db:        db,
			endpoint:  "http://localhost:9200",
			indexName: defaultAuditIndex,
			client:    &http.Client{},
		},
	}
}

func TestOperationalReconcilerSnapshotTransitions(t *testing.T) {
	reconciler := newEnabledReconcilerForTest()

	initial := reconciler.Snapshot()
	if !initial.Enabled {
		t.Fatalf("expected reconciler to be enabled")
	}
	if initial.State != "starting" {
		t.Fatalf("expected initial state to be starting, got %s", initial.State)
	}
	if !initial.Healthy {
		t.Fatalf("expected initial reconciler to be healthy")
	}

	startedAt := time.Date(2026, 4, 7, 15, 0, 0, 0, time.UTC)
	reconciler.markRunStarted(startedAt)
	running := reconciler.Snapshot()
	if running.State != "running" {
		t.Fatalf("expected state running, got %s", running.State)
	}
	if !running.Running {
		t.Fatalf("expected running=true")
	}

	completedAt := startedAt.Add(3 * time.Second)
	reconciler.markRunFinished(completedAt, 3*time.Second, 12, 34, "")
	healthy := reconciler.Snapshot()
	if healthy.State != "healthy" {
		t.Fatalf("expected healthy state, got %s", healthy.State)
	}
	if healthy.LastRunAlertSynced != 12 || healthy.LastRunAuditSynced != 34 {
		t.Fatalf("unexpected synced counts: alerts=%d audit=%d", healthy.LastRunAlertSynced, healthy.LastRunAuditSynced)
	}
	if healthy.SuccessfulRuns != 1 || healthy.FailedRuns != 0 {
		t.Fatalf("unexpected run counters: success=%d failed=%d", healthy.SuccessfulRuns, healthy.FailedRuns)
	}

	reconciler.markRunStarted(completedAt.Add(time.Minute))
	reconciler.markRunFinished(completedAt.Add(time.Minute+2*time.Second), 2*time.Second, 1, 2, "sync audit failed")
	degraded := reconciler.Snapshot()
	if degraded.State != "degraded" {
		t.Fatalf("expected degraded state, got %s", degraded.State)
	}
	if degraded.Healthy {
		t.Fatalf("expected degraded reconciler to be unhealthy")
	}
	if degraded.FailedRuns != 1 {
		t.Fatalf("expected failed runs to be 1, got %d", degraded.FailedRuns)
	}
	if degraded.LastError == "" {
		t.Fatalf("expected last error to be set")
	}
}

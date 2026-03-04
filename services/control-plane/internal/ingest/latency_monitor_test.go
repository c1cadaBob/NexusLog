package ingest

import (
	"testing"
	"time"
)

func TestPullLatencyMonitorObserveAndSnapshot(t *testing.T) {
	monitor := NewPullLatencyMonitor(5, 100, 200, 10*time.Millisecond)
	now := time.Now().UTC()

	snapshot, alert := monitor.Observe("source-a", "task-1", "success", now.Add(-120*time.Millisecond), now)
	if alert {
		t.Fatalf("unexpected alert for first sample")
	}
	if snapshot.Count != 1 {
		t.Fatalf("expected count=1, got %d", snapshot.Count)
	}
	if snapshot.LastTaskID != "task-1" || snapshot.LastSourceID != "source-a" {
		t.Fatalf("unexpected snapshot identity: %+v", snapshot)
	}

	_, _ = monitor.Observe("source-a", "task-2", "success", now.Add(-80*time.Millisecond), now.Add(20*time.Millisecond))
	_, _ = monitor.Observe("source-a", "task-3", "failed", now.Add(-220*time.Millisecond), now.Add(40*time.Millisecond))

	latest := monitor.Snapshot()
	if latest.Count != 3 {
		t.Fatalf("expected count=3, got %d", latest.Count)
	}
	if latest.P95MS < latest.P50MS {
		t.Fatalf("expected p95 >= p50, got p95=%d p50=%d", latest.P95MS, latest.P50MS)
	}
}

func TestPullLatencyMonitorAlertThreshold(t *testing.T) {
	monitor := NewPullLatencyMonitor(10, 50, 80, 0)
	base := time.Now().UTC()
	for i := 0; i < 5; i++ {
		_, _ = monitor.Observe("source-b", "task-pre", "success", base.Add(-10*time.Millisecond), base)
	}

	snapshot, alert := monitor.Observe("source-b", "task-alert", "success", base.Add(-200*time.Millisecond), base.Add(10*time.Millisecond))
	if !alert {
		t.Fatalf("expected alert when latency exceeds thresholds, snapshot=%+v", snapshot)
	}
	if snapshot.P95MS < 50 {
		t.Fatalf("expected p95 to exceed threshold, got %d", snapshot.P95MS)
	}
}

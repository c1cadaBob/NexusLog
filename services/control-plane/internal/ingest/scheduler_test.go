package ingest

import (
	"fmt"
	"testing"
	"time"
)

// TestPullTaskSchedulerSchedulesActiveSource 验证 active source 会被自动转成 scheduled 任务。
func TestPullTaskSchedulerSchedulesActiveSource(t *testing.T) {
	fixture := newTestFixture()
	source := createSchedulerSourceForTest(t, fixture.sourceStore, "active", 5, 7)

	scheduler := NewPullTaskScheduler(fixture.sourceStore, fixture.taskStore, PullTaskSchedulerConfig{
		CheckInterval: time.Second,
		PageSize:      50,
	})
	scheduler.tick()

	items, total := fixture.taskStore.List(source.SourceID, "", 1, 10)
	if total != 1 || len(items) != 1 {
		t.Fatalf("expected one scheduled task, total=%d len=%d", total, len(items))
	}
	if items[0].TriggerType != "scheduled" {
		t.Fatalf("unexpected trigger_type: %s", items[0].TriggerType)
	}
	if items[0].Status != "pending" {
		t.Fatalf("unexpected status: %s", items[0].Status)
	}
	timeoutMS := resolveIntOption(items[0].Options, "timeout_ms", -1)
	if timeoutMS != 7000 {
		t.Fatalf("unexpected timeout_ms option: %d", timeoutMS)
	}
}

// TestPullTaskSchedulerSkipsNonActiveSource 验证非 active source 不会被调度。
func TestPullTaskSchedulerSkipsNonActiveSource(t *testing.T) {
	fixture := newTestFixture()
	_ = createSchedulerSourceForTest(t, fixture.sourceStore, "paused", 5, 7)

	scheduler := NewPullTaskScheduler(fixture.sourceStore, fixture.taskStore, PullTaskSchedulerConfig{
		CheckInterval: time.Second,
		PageSize:      50,
	})
	scheduler.tick()

	if fixture.taskStore.Count() != 0 {
		t.Fatalf("expected no task for paused source, got %d", fixture.taskStore.Count())
	}
}

// TestPullTaskSchedulerSkipsWhenInFlight 验证 source 已有 pending/running 任务时不会重复入队。
func TestPullTaskSchedulerSkipsWhenInFlight(t *testing.T) {
	fixture := newTestFixture()
	source := createSchedulerSourceForTest(t, fixture.sourceStore, "active", 5, 7)

	task := fixture.taskStore.CreatePending(RunPullTaskRequest{
		SourceID:    source.SourceID,
		TriggerType: "manual",
		Options:     map[string]any{},
	})
	if task.TaskID == "" {
		t.Fatalf("failed to seed pending task")
	}

	scheduler := NewPullTaskScheduler(fixture.sourceStore, fixture.taskStore, PullTaskSchedulerConfig{
		CheckInterval: time.Second,
		PageSize:      50,
	})
	scheduler.tick()

	if fixture.taskStore.Count() != 1 {
		t.Fatalf("expected no duplicate task when in-flight exists, got %d", fixture.taskStore.Count())
	}
}

// TestPullTaskSchedulerRespectsInterval 验证同一 source 会严格遵循 pull_interval_sec。
func TestPullTaskSchedulerRespectsInterval(t *testing.T) {
	fixture := newTestFixture()
	source := createSchedulerSourceForTest(t, fixture.sourceStore, "active", 10, 7)

	scheduler := NewPullTaskScheduler(fixture.sourceStore, fixture.taskStore, PullTaskSchedulerConfig{
		CheckInterval: time.Second,
		PageSize:      50,
	})

	scheduler.tick()
	firstTask, ok := fixture.taskStore.LatestBySource(source.SourceID)
	if !ok || firstTask.TaskID == "" {
		t.Fatalf("expected first scheduled task")
	}
	if !fixture.taskStore.SetStatusForTest(firstTask.TaskID, "success") {
		t.Fatalf("failed to update first task status for interval test")
	}

	// 未到间隔时不应生成新任务。
	scheduler.nowFn = func() time.Time {
		return firstTask.ScheduledAt.Add(5 * time.Second)
	}
	scheduler.tick()
	if fixture.taskStore.Count() != 1 {
		t.Fatalf("expected no new task before interval, got %d", fixture.taskStore.Count())
	}

	// 超过间隔后应生成新任务。
	scheduler.nowFn = func() time.Time {
		return firstTask.ScheduledAt.Add(11 * time.Second)
	}
	scheduler.tick()
	if fixture.taskStore.Count() != 2 {
		t.Fatalf("expected one extra task after interval, got %d", fixture.taskStore.Count())
	}
}

func createSchedulerSourceForTest(t *testing.T, store *PullSourceStore, status string, intervalSec, timeoutSec int) PullSource {
	t.Helper()

	name := fmt.Sprintf("scheduler-source-%d", time.Now().UnixNano())
	source, err := store.Create(CreatePullSourceRequest{
		Name:            name,
		Host:            "127.0.0.1",
		Port:            16666,
		Protocol:        "http",
		Path:            "/var/log/*.log",
		Auth:            "agent-key",
		AgentBaseURL:    "http://127.0.0.1:16666",
		PullIntervalSec: intervalSec,
		PullTimeoutSec:  timeoutSec,
		KeyRef:          "",
		Status:          status,
	})
	if err != nil {
		t.Fatalf("create source failed: %v", err)
	}
	return source
}

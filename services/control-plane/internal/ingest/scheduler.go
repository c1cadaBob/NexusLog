package ingest

import (
	"context"
	"log"
	"strings"
	"time"
)

const (
	// defaultSchedulerCheckInterval 默认调度扫描间隔。
	defaultSchedulerCheckInterval = time.Second
	// defaultSchedulerPageSize 默认单次扫描 source 数量。
	defaultSchedulerPageSize = 200
	// defaultSourcePullIntervalSec 拉取间隔默认值（秒）。
	defaultSourcePullIntervalSec = 30
	// defaultSourcePullTimeoutSec 拉取超时默认值（秒）。
	defaultSourcePullTimeoutSec = 30
)

// PullTaskSchedulerConfig 定义调度器运行参数。
type PullTaskSchedulerConfig struct {
	CheckInterval time.Duration
	PageSize      int
}

// PullTaskScheduler 负责将 active source 按 pull_interval_sec 自动转成 pull task。
type PullTaskScheduler struct {
	sourceStore *PullSourceStore
	taskStore   *PullTaskStore
	config      PullTaskSchedulerConfig
	nowFn       func() time.Time
}

// NewPullTaskScheduler 创建调度器实例。
func NewPullTaskScheduler(sourceStore *PullSourceStore, taskStore *PullTaskStore, config PullTaskSchedulerConfig) *PullTaskScheduler {
	if config.CheckInterval <= 0 {
		config.CheckInterval = defaultSchedulerCheckInterval
	}
	if config.PageSize <= 0 {
		config.PageSize = defaultSchedulerPageSize
	}
	return &PullTaskScheduler{
		sourceStore: sourceStore,
		taskStore:   taskStore,
		config:      config,
		nowFn:       func() time.Time { return time.Now().UTC() },
	}
}

// Start 启动后台调度循环，收到 ctx cancel 后退出。
func (s *PullTaskScheduler) Start(ctx context.Context) {
	if s == nil || s.sourceStore == nil || s.taskStore == nil {
		return
	}
	// 启动后先执行一次，避免服务重启后需要额外等待一个扫描周期。
	s.tick()

	ticker := time.NewTicker(s.config.CheckInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.tick()
		}
	}
}

// tick 执行一次全量扫描，仅处理 active source。
func (s *PullTaskScheduler) tick() {
	page := 1
	for {
		sources, total := s.sourceStore.List("active", page, s.config.PageSize)
		if len(sources) == 0 {
			return
		}
		for _, source := range sources {
			s.scheduleSource(source)
		}
		if page*s.config.PageSize >= total {
			return
		}
		page++
	}
}

func (s *PullTaskScheduler) scheduleSource(source PullSource) {
	sourceID := strings.TrimSpace(source.SourceID)
	if sourceID == "" {
		return
	}
	// 同一 source 存在 pending/running 时不重复入队，避免并发重入。
	if s.taskStore.HasInFlight(sourceID) {
		return
	}

	now := s.now()
	if !s.shouldSchedule(sourceID, source.PullIntervalSec, now) {
		return
	}

	task := s.taskStore.CreatePending(RunPullTaskRequest{
		SourceID:    sourceID,
		TriggerType: "scheduled",
		Options:     s.buildTaskOptions(source),
	})
	if task.TaskID == "" {
		log.Printf("ingest scheduler create task failed source_id=%s", sourceID)
		return
	}
	log.Printf(
		"ingest scheduler created task source_id=%s task_id=%s interval_sec=%d",
		sourceID,
		task.TaskID,
		resolveSourcePullIntervalSec(source.PullIntervalSec),
	)
}

func (s *PullTaskScheduler) shouldSchedule(sourceID string, intervalSec int, now time.Time) bool {
	latest, ok := s.taskStore.LatestBySource(sourceID)
	if !ok {
		return true
	}
	lastScheduledAt := latest.ScheduledAt
	if lastScheduledAt.IsZero() {
		lastScheduledAt = latest.CreatedAt
	}
	if lastScheduledAt.IsZero() {
		return true
	}
	interval := time.Duration(resolveSourcePullIntervalSec(intervalSec)) * time.Second
	return !now.Before(lastScheduledAt.Add(interval))
}

func (s *PullTaskScheduler) buildTaskOptions(source PullSource) map[string]any {
	return map[string]any{
		"timeout_ms": resolveSourcePullTimeoutSec(source.PullTimeoutSec) * 1000,
	}
}

func (s *PullTaskScheduler) now() time.Time {
	if s.nowFn != nil {
		return s.nowFn().UTC()
	}
	return time.Now().UTC()
}

func resolveSourcePullIntervalSec(raw int) int {
	if raw <= 0 {
		return defaultSourcePullIntervalSec
	}
	return raw
}

func resolveSourcePullTimeoutSec(raw int) int {
	if raw <= 0 {
		return defaultSourcePullTimeoutSec
	}
	return raw
}

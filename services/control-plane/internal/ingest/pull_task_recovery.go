package ingest

import (
	"context"
	"strings"
	"time"
)

const (
	// ErrorCodePullTaskStaleRecovered 表示 pending/running 任务因超时被调度器回收。
	ErrorCodePullTaskStaleRecovered = "INGEST_TASK_STALE_RECOVERED"
)

// RecoverStaleInFlight 将超过阈值仍处于 pending/running 的任务标记为 failed，
// 避免服务重启、热更新或异常退出后遗留 in-flight 任务永久阻塞调度。
func (s *PullTaskStore) RecoverStaleInFlight(staleBefore time.Time, errorCode, errorMessage string) int {
	if s == nil || staleBefore.IsZero() {
		return 0
	}
	errorCode = strings.TrimSpace(errorCode)
	if errorCode == "" {
		errorCode = ErrorCodePullTaskStaleRecovered
	}
	errorMessage = strings.TrimSpace(errorMessage)
	if errorMessage == "" {
		errorMessage = "stale in-flight pull task recovered by scheduler"
	}
	staleBefore = staleBefore.UTC()
	if s.backend != nil {
		return s.recoverStaleInFlightFromDB(context.Background(), staleBefore, errorCode, errorMessage)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now().UTC()
	recovered := 0
	for taskID, task := range s.items {
		if task.Status != "pending" && task.Status != "running" {
			continue
		}
		referenceTime := staleTaskReferenceTime(task)
		if referenceTime.IsZero() || !referenceTime.Before(staleBefore) {
			continue
		}
		task.Status = "failed"
		task.ErrorCode = errorCode
		task.ErrorMessage = errorMessage
		task.FinishedAt = &now
		task.UpdatedAt = now
		s.items[taskID] = task
		recovered++
	}
	return recovered
}

func (s *PullTaskStore) recoverStaleInFlightFromDB(ctx context.Context, staleBefore time.Time, errorCode, errorMessage string) int {
	if s == nil || s.backend == nil || s.backend.DB() == nil {
		return 0
	}
	query := `
UPDATE ingest_pull_tasks
SET
    status = 'failed',
    error_code = NULLIF($2, ''),
    error_message = NULLIF($3, ''),
    finished_at = $4,
    updated_at = $4
WHERE status IN ('pending', 'running')
  AND COALESCE(started_at, scheduled_at, created_at) < $1
`
	now := time.Now().UTC()
	res, err := s.backend.DB().ExecContext(ctx, query, staleBefore, errorCode, errorMessage, now)
	if err != nil {
		return 0
	}
	affected, err := res.RowsAffected()
	if err != nil || affected <= 0 {
		return 0
	}
	return int(affected)
}

func staleTaskReferenceTime(task PullTask) time.Time {
	if task.StartedAt != nil && !task.StartedAt.IsZero() {
		return task.StartedAt.UTC()
	}
	if !task.ScheduledAt.IsZero() {
		return task.ScheduledAt.UTC()
	}
	if !task.CreatedAt.IsZero() {
		return task.CreatedAt.UTC()
	}
	return time.Time{}
}

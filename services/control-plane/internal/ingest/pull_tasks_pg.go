package ingest

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

func (s *PullTaskStore) createPendingFromDB(ctx context.Context, req RunPullTaskRequest) (PullTask, error) {
	now := time.Now().UTC()
	requestID := fmt.Sprintf("cp-task-%d-%s", now.Unix(), shortRandomHex(4))
	query := `
INSERT INTO ingest_pull_tasks (
    source_id,
    scheduled_at,
    status,
    trigger_type,
    options,
    request_id,
    created_at,
    updated_at
) VALUES (
    $1::uuid,
    $2,
    'pending',
    $3,
    $4::jsonb,
    $5,
    $2,
    $2
)
RETURNING
    id::text,
    source_id::text,
    trigger_type,
    options,
    status,
    request_id,
    COALESCE(batch_id, ''),
    COALESCE(last_cursor, ''),
    COALESCE(retry_count, 0),
    scheduled_at,
    started_at,
    finished_at,
    COALESCE(error_code, ''),
    COALESCE(error_message, ''),
    created_at,
    updated_at
`

	var (
		task       PullTask
		optionsRaw []byte
		startedAt  sql.NullTime
		finishedAt sql.NullTime
	)
	err := s.backend.DB().QueryRowContext(
		ctx,
		query,
		req.SourceID,
		now,
		req.TriggerType,
		mustMarshalJSONOrEmpty(req.Options),
		requestID,
	).Scan(
		&task.TaskID,
		&task.SourceID,
		&task.TriggerType,
		&optionsRaw,
		&task.Status,
		&task.RequestID,
		&task.BatchID,
		&task.LastCursor,
		&task.RetryCount,
		&task.ScheduledAt,
		&startedAt,
		&finishedAt,
		&task.ErrorCode,
		&task.ErrorMessage,
		&task.CreatedAt,
		&task.UpdatedAt,
	)
	if err != nil {
		return PullTask{}, wrapDBError("create pull task", err)
	}
	task.Options = parseTaskOptions(optionsRaw)
	task.StartedAt, task.FinishedAt = buildTaskPointers(startedAt, finishedAt)
	task.ScheduledAt = task.ScheduledAt.UTC()
	task.CreatedAt = task.CreatedAt.UTC()
	task.UpdatedAt = task.UpdatedAt.UTC()
	return task, nil
}

func (s *PullTaskStore) listFromDB(ctx context.Context, sourceID, status string, page, pageSize int) ([]PullTask, int) {
	sourceID = strings.TrimSpace(sourceID)
	status = strings.TrimSpace(status)
	countQuery := `
SELECT COUNT(1)
FROM ingest_pull_tasks
WHERE ($1 = '' OR source_id = NULLIF($1, '')::uuid)
  AND ($2 = '' OR status = $2)
`
	total := 0
	if err := s.backend.DB().QueryRowContext(ctx, countQuery, sourceID, status).Scan(&total); err != nil {
		return []PullTask{}, 0
	}

	query := `
SELECT
    id::text,
    source_id::text,
    trigger_type,
    options,
    status,
    COALESCE(request_id, ''),
    COALESCE(batch_id, ''),
    COALESCE(last_cursor, ''),
    COALESCE(retry_count, 0),
    scheduled_at,
    started_at,
    finished_at,
    COALESCE(error_code, ''),
    COALESCE(error_message, ''),
    created_at,
    updated_at
FROM ingest_pull_tasks
WHERE ($1 = '' OR source_id = NULLIF($1, '')::uuid)
  AND ($2 = '' OR status = $2)
ORDER BY scheduled_at DESC
OFFSET $3
LIMIT $4
`
	offset := (page - 1) * pageSize
	rows, err := s.backend.DB().QueryContext(ctx, query, sourceID, status, offset, pageSize)
	if err != nil {
		return []PullTask{}, total
	}
	defer mustRowsClose(rows)

	items := make([]PullTask, 0, pageSize)
	for rows.Next() {
		var (
			task       PullTask
			optionsRaw []byte
			startedAt  sql.NullTime
			finishedAt sql.NullTime
		)
		if scanErr := rows.Scan(
			&task.TaskID,
			&task.SourceID,
			&task.TriggerType,
			&optionsRaw,
			&task.Status,
			&task.RequestID,
			&task.BatchID,
			&task.LastCursor,
			&task.RetryCount,
			&task.ScheduledAt,
			&startedAt,
			&finishedAt,
			&task.ErrorCode,
			&task.ErrorMessage,
			&task.CreatedAt,
			&task.UpdatedAt,
		); scanErr != nil {
			continue
		}
		task.Options = parseTaskOptions(optionsRaw)
		task.StartedAt, task.FinishedAt = buildTaskPointers(startedAt, finishedAt)
		task.ScheduledAt = task.ScheduledAt.UTC()
		task.CreatedAt = task.CreatedAt.UTC()
		task.UpdatedAt = task.UpdatedAt.UTC()
		items = append(items, task)
	}
	return items, total
}

func (s *PullTaskStore) getByIDFromDB(ctx context.Context, taskID string) (PullTask, bool) {
	taskID = strings.TrimSpace(taskID)
	if taskID == "" {
		return PullTask{}, false
	}
	query := `
SELECT
    id::text,
    source_id::text,
    trigger_type,
    options,
    status,
    COALESCE(request_id, ''),
    COALESCE(batch_id, ''),
    COALESCE(last_cursor, ''),
    COALESCE(retry_count, 0),
    scheduled_at,
    started_at,
    finished_at,
    COALESCE(error_code, ''),
    COALESCE(error_message, ''),
    created_at,
    updated_at
FROM ingest_pull_tasks
WHERE id = $1::uuid
`
	var (
		task       PullTask
		optionsRaw []byte
		startedAt  sql.NullTime
		finishedAt sql.NullTime
	)
	if err := s.backend.DB().QueryRowContext(ctx, query, taskID).Scan(
		&task.TaskID,
		&task.SourceID,
		&task.TriggerType,
		&optionsRaw,
		&task.Status,
		&task.RequestID,
		&task.BatchID,
		&task.LastCursor,
		&task.RetryCount,
		&task.ScheduledAt,
		&startedAt,
		&finishedAt,
		&task.ErrorCode,
		&task.ErrorMessage,
		&task.CreatedAt,
		&task.UpdatedAt,
	); err != nil {
		return PullTask{}, false
	}
	task.Options = parseTaskOptions(optionsRaw)
	task.StartedAt, task.FinishedAt = buildTaskPointers(startedAt, finishedAt)
	task.ScheduledAt = task.ScheduledAt.UTC()
	task.CreatedAt = task.CreatedAt.UTC()
	task.UpdatedAt = task.UpdatedAt.UTC()
	return task, true
}

func (s *PullTaskStore) markRunningFromDB(ctx context.Context, taskID string) bool {
	query := `
UPDATE ingest_pull_tasks
SET status = 'running', started_at = $2, updated_at = $2
WHERE id = $1::uuid
`
	res, err := s.backend.DB().ExecContext(ctx, query, taskID, time.Now().UTC())
	if err != nil {
		return false
	}
	affected, _ := res.RowsAffected()
	return affected > 0
}

func (s *PullTaskStore) markSuccessFromDB(ctx context.Context, taskID, batchID, lastCursor string) bool {
	query := `
UPDATE ingest_pull_tasks
SET
    status = 'success',
    batch_id = NULLIF($2, ''),
    last_cursor = NULLIF($3, ''),
    finished_at = $4,
    updated_at = $4
WHERE id = $1::uuid
`
	now := time.Now().UTC()
	res, err := s.backend.DB().ExecContext(ctx, query, taskID, strings.TrimSpace(batchID), strings.TrimSpace(lastCursor), now)
	if err != nil {
		return false
	}
	affected, _ := res.RowsAffected()
	return affected > 0
}

func (s *PullTaskStore) markFailedFromDB(ctx context.Context, taskID, code, message string, retryCount int) bool {
	query := `
UPDATE ingest_pull_tasks
SET
    status = 'failed',
    error_code = NULLIF($2, ''),
    error_message = NULLIF($3, ''),
    retry_count = $4,
    finished_at = $5,
    updated_at = $5
WHERE id = $1::uuid
`
	now := time.Now().UTC()
	res, err := s.backend.DB().ExecContext(ctx, query, taskID, strings.TrimSpace(code), strings.TrimSpace(message), retryCount, now)
	if err != nil {
		return false
	}
	affected, _ := res.RowsAffected()
	return affected > 0
}

func (s *PullTaskStore) setStatusForTestFromDB(ctx context.Context, taskID, status string) bool {
	query := `
UPDATE ingest_pull_tasks
SET
    status = $2,
    updated_at = $3,
    started_at = CASE WHEN $2 = 'running' THEN $3 ELSE started_at END,
    finished_at = CASE WHEN $2 IN ('success', 'failed', 'canceled') THEN $3 ELSE finished_at END
WHERE id = $1::uuid
`
	now := time.Now().UTC()
	res, err := s.backend.DB().ExecContext(ctx, query, taskID, status, now)
	if err != nil {
		return false
	}
	affected, _ := res.RowsAffected()
	return affected > 0
}

func (s *PullTaskStore) countFromDB(ctx context.Context) int {
	query := `SELECT COUNT(1) FROM ingest_pull_tasks`
	total := 0
	if err := s.backend.DB().QueryRowContext(ctx, query).Scan(&total); err != nil {
		return 0
	}
	return total
}

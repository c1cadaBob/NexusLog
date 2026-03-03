package ingest

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

func (s *PullBatchStore) upsertFromDB(ctx context.Context, batch PullBatch) (PullBatch, error) {
	if s.backend == nil || s.backend.DB() == nil {
		return PullBatch{}, fmt.Errorf("postgres backend is not configured")
	}
	normalized, err := normalizePullBatch(batch)
	if err != nil {
		return PullBatch{}, err
	}

	query := `
INSERT INTO agent_pull_batches (
    tenant_id,
    source_id,
    task_id,
    package_id,
    agent_id,
    batch_id,
    checksum,
    cursor,
    next_cursor,
    status,
    record_count,
    size_bytes,
    retry_count,
    request_id,
    error_code,
    error_message,
    acked_at,
    created_at,
    updated_at
) VALUES (
    $1::uuid,
    NULLIF($2, '')::uuid,
    NULLIF($3, '')::uuid,
    NULLIF($4, '')::uuid,
    $5,
    $6,
    $7,
    NULLIF($8, ''),
    NULLIF($9, ''),
    $10,
    $11,
    $12,
    $13,
    NULLIF($14, ''),
    NULLIF($15, ''),
    NULLIF($16, ''),
    $17,
    $18,
    $19
)
ON CONFLICT (batch_id, checksum) DO UPDATE SET
    package_id = COALESCE(EXCLUDED.package_id, agent_pull_batches.package_id),
    task_id = COALESCE(EXCLUDED.task_id, agent_pull_batches.task_id),
    source_id = COALESCE(EXCLUDED.source_id, agent_pull_batches.source_id),
    status = EXCLUDED.status,
    next_cursor = COALESCE(EXCLUDED.next_cursor, agent_pull_batches.next_cursor),
    request_id = COALESCE(EXCLUDED.request_id, agent_pull_batches.request_id),
    retry_count = GREATEST(agent_pull_batches.retry_count, EXCLUDED.retry_count),
    error_code = COALESCE(EXCLUDED.error_code, agent_pull_batches.error_code),
    error_message = COALESCE(EXCLUDED.error_message, agent_pull_batches.error_message),
    acked_at = COALESCE(EXCLUDED.acked_at, agent_pull_batches.acked_at),
    updated_at = EXCLUDED.updated_at
RETURNING
    batch_id,
    checksum,
    COALESCE(source_id::text, ''),
    COALESCE(task_id::text, ''),
    COALESCE(package_id::text, ''),
    agent_id,
    COALESCE(cursor, ''),
    COALESCE(next_cursor, ''),
    status,
    record_count,
    size_bytes,
    retry_count,
    COALESCE(request_id, ''),
    COALESCE(error_code, ''),
    COALESCE(error_message, ''),
    acked_at,
    created_at,
    updated_at
`
	var (
		created PullBatch
		ackedAt sql.NullTime
	)
	err = s.backend.DB().QueryRowContext(
		ctx,
		query,
		s.backend.ResolveTenantID(ctx),
		normalized.SourceID,
		normalized.TaskID,
		normalized.PackageID,
		normalized.AgentID,
		normalized.BatchID,
		normalized.Checksum,
		normalized.Cursor,
		normalized.NextCursor,
		normalized.Status,
		normalized.RecordCount,
		normalized.SizeBytes,
		normalized.RetryCount,
		normalized.RequestID,
		normalized.ErrorCode,
		normalized.ErrorMessage,
		toNullTimePtr(optionalTime(normalized.AckedAt)),
		normalized.CreatedAt.UTC(),
		time.Now().UTC(),
	).Scan(
		&created.BatchID,
		&created.Checksum,
		&created.SourceID,
		&created.TaskID,
		&created.PackageID,
		&created.AgentID,
		&created.Cursor,
		&created.NextCursor,
		&created.Status,
		&created.RecordCount,
		&created.SizeBytes,
		&created.RetryCount,
		&created.RequestID,
		&created.ErrorCode,
		&created.ErrorMessage,
		&ackedAt,
		&created.CreatedAt,
		&created.UpdatedAt,
	)
	if err != nil {
		return PullBatch{}, wrapDBError("upsert pull batch", err)
	}
	if ackedAt.Valid {
		created.AckedAt = ackedAt.Time.UTC()
	}
	created.CreatedAt = created.CreatedAt.UTC()
	created.UpdatedAt = created.UpdatedAt.UTC()
	return created, nil
}

func (s *PullBatchStore) markStatusFromDB(ctx context.Context, batchID, checksum, status, errorCode, errorMessage string, retryCount int, ackedAt *time.Time) bool {
	query := `
UPDATE agent_pull_batches
SET
    status = $3,
    error_code = NULLIF($4, ''),
    error_message = NULLIF($5, ''),
    retry_count = $6,
    acked_at = CASE WHEN $7::timestamptz IS NULL THEN acked_at ELSE $7 END,
    updated_at = $8
WHERE batch_id = $1 AND checksum = $2
`
	now := time.Now().UTC()
	res, err := s.backend.DB().ExecContext(
		ctx,
		query,
		strings.TrimSpace(batchID),
		strings.TrimSpace(checksum),
		normalizeBatchStatus(status),
		strings.TrimSpace(errorCode),
		strings.TrimSpace(errorMessage),
		maxInt(retryCount, 0),
		toNullTimePtr(ackedAt),
		now,
	)
	if err != nil {
		return false
	}
	affected, _ := res.RowsAffected()
	return affected > 0
}

func (s *PullBatchStore) getLatestByBatchIDFromDB(ctx context.Context, batchID string) (PullBatch, bool) {
	batchID = strings.TrimSpace(batchID)
	if batchID == "" {
		return PullBatch{}, false
	}
	query := `
SELECT
    batch_id,
    checksum,
    COALESCE(source_id::text, ''),
    COALESCE(task_id::text, ''),
    COALESCE(package_id::text, ''),
    agent_id,
    COALESCE(cursor, ''),
    COALESCE(next_cursor, ''),
    status,
    record_count,
    size_bytes,
    retry_count,
    COALESCE(request_id, ''),
    COALESCE(error_code, ''),
    COALESCE(error_message, ''),
    acked_at,
    created_at,
    updated_at
FROM agent_pull_batches
WHERE batch_id = $1
ORDER BY created_at DESC
LIMIT 1
`
	var (
		item    PullBatch
		ackedAt sql.NullTime
	)
	if err := s.backend.DB().QueryRowContext(ctx, query, batchID).Scan(
		&item.BatchID,
		&item.Checksum,
		&item.SourceID,
		&item.TaskID,
		&item.PackageID,
		&item.AgentID,
		&item.Cursor,
		&item.NextCursor,
		&item.Status,
		&item.RecordCount,
		&item.SizeBytes,
		&item.RetryCount,
		&item.RequestID,
		&item.ErrorCode,
		&item.ErrorMessage,
		&ackedAt,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return PullBatch{}, false
	}
	if ackedAt.Valid {
		item.AckedAt = ackedAt.Time.UTC()
	}
	item.CreatedAt = item.CreatedAt.UTC()
	item.UpdatedAt = item.UpdatedAt.UTC()
	return item, true
}

func optionalTime(v time.Time) *time.Time {
	if v.IsZero() {
		return nil
	}
	v = v.UTC()
	return &v
}

func maxInt(a, b int) int {
	if a >= b {
		return a
	}
	return b
}

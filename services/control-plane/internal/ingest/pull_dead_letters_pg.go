package ingest

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

func (s *DeadLetterStore) createFromReceiptFromDB(ctx context.Context, pkg PullPackage, reason string, payload map[string]any) (DeadLetterRecord, error) {
	seed := DeadLetterRecord{
		PackageID:    strings.TrimSpace(pkg.PackageID),
		SourceRef:    strings.TrimSpace(pkg.SourceRef),
		ErrorCode:    "NACK_RECEIPT",
		ErrorMessage: strings.TrimSpace(reason),
		RetryCount:   0,
		FailedAt:     time.Now().UTC(),
		CreatedAt:    time.Now().UTC(),
	}
	return s.createRecordFromDB(ctx, seed, withDeadLetterExtra{
		SourceID:  strings.TrimSpace(pkg.SourceID),
		TaskID:    strings.TrimSpace(pkg.TaskID),
		BatchID:   strings.TrimSpace(pkg.BatchID),
		RequestID: strings.TrimSpace(pkg.RequestID),
		Payload:   payload,
	})
}

type withDeadLetterExtra struct {
	SourceID  string
	TaskID    string
	BatchID   string
	RequestID string
	Payload   map[string]any
}

func (s *DeadLetterStore) createRecordFromDB(ctx context.Context, record DeadLetterRecord, extras ...withDeadLetterExtra) (DeadLetterRecord, error) {
	if s.backend == nil || s.backend.DB() == nil {
		return DeadLetterRecord{}, fmt.Errorf("postgres backend is not configured")
	}

	now := time.Now().UTC()
	if record.FailedAt.IsZero() {
		record.FailedAt = now
	}
	if record.CreatedAt.IsZero() {
		record.CreatedAt = record.FailedAt
	}
	if strings.TrimSpace(record.ErrorCode) == "" {
		record.ErrorCode = "INGEST_PULL_FAILED"
	}

	extra := withDeadLetterExtra{}
	if len(extras) > 0 {
		extra = extras[0]
	}

	payload := map[string]any{
		"package_id":  strings.TrimSpace(record.PackageID),
		"source_ref":  strings.TrimSpace(record.SourceRef),
		"error_code":  strings.TrimSpace(record.ErrorCode),
		"error_msg":   strings.TrimSpace(record.ErrorMessage),
		"retry_count": record.RetryCount,
	}
	if len(extra.Payload) > 0 {
		payload["first_failure"] = extra.Payload
	}

	payloadRaw, err := json.Marshal(payload)
	if err != nil {
		payloadRaw = []byte(`{}`)
	}

	query := `
INSERT INTO ingest_dead_letters (
    tenant_id,
    source_ref,
    package_id,
    source_id,
    task_id,
    batch_id,
    request_id,
    payload,
    error_code,
    error_message,
    retry_count,
    failed_at,
    created_at
) VALUES (
    $1::uuid,
    NULLIF($2, ''),
    NULLIF($3, '')::uuid,
    NULLIF($4, '')::uuid,
    NULLIF($5, '')::uuid,
    NULLIF($6, ''),
    NULLIF($7, ''),
    $8::jsonb,
    NULLIF($9, ''),
    NULLIF($10, ''),
    $11,
    $12,
    $13
)
RETURNING
    id::text,
    COALESCE(package_id::text, ''),
    COALESCE(source_ref, ''),
    COALESCE(error_code, ''),
    COALESCE(error_message, ''),
    retry_count,
    failed_at,
    created_at,
    replayed_at,
    COALESCE(replay_batch_id, ''),
    COALESCE(replay_reason, '')
`
	created := DeadLetterRecord{}
	var replayedAt sql.NullTime
	err = s.backend.DB().QueryRowContext(
		ctx,
		query,
		s.backend.ResolveTenantID(ctx),
		strings.TrimSpace(record.SourceRef),
		strings.TrimSpace(record.PackageID),
		strings.TrimSpace(extra.SourceID),
		strings.TrimSpace(extra.TaskID),
		strings.TrimSpace(extra.BatchID),
		strings.TrimSpace(extra.RequestID),
		payloadRaw,
		strings.TrimSpace(record.ErrorCode),
		strings.TrimSpace(record.ErrorMessage),
		record.RetryCount,
		record.FailedAt.UTC(),
		record.CreatedAt.UTC(),
	).Scan(
		&created.DeadLetterID,
		&created.PackageID,
		&created.SourceRef,
		&created.ErrorCode,
		&created.ErrorMessage,
		&created.RetryCount,
		&created.FailedAt,
		&created.CreatedAt,
		&replayedAt,
		&created.ReplayBatchID,
		&created.ReplayReason,
	)
	if err != nil {
		return DeadLetterRecord{}, wrapDBError("insert dead letter", err)
	}
	created.FailedAt = created.FailedAt.UTC()
	created.CreatedAt = created.CreatedAt.UTC()
	created.ReplayedAt = parseOptionalTime(replayedAt)
	return created, nil
}

func (s *DeadLetterStore) replayFromDB(ctx context.Context, deadLetterIDs []string, reason string) (string, int, error) {
	if s.backend == nil || s.backend.DB() == nil {
		return "", 0, fmt.Errorf("postgres backend is not configured")
	}

	normalizedIDs := normalizeDeadLetterIDs(deadLetterIDs)
	if len(normalizedIDs) == 0 {
		return "", 0, nil
	}

	replayBatchID := newUUIDLike()
	now := time.Now().UTC()
	query := `
UPDATE ingest_dead_letters
SET
    retry_count = retry_count + 1,
    replay_batch_id = $2,
    replay_reason = $3,
    replayed_at = $4
WHERE id::text = ANY($1::text[])
`
	res, err := s.backend.DB().ExecContext(
		ctx,
		query,
		normalizedIDs,
		replayBatchID,
		strings.TrimSpace(reason),
		now,
	)
	if err != nil {
		return "", 0, wrapDBError("replay dead letters", err)
	}
	affected, _ := res.RowsAffected()
	return replayBatchID, int(affected), nil
}

func (s *DeadLetterStore) getFromDB(ctx context.Context, deadLetterID string) (DeadLetterRecord, bool) {
	if s.backend == nil || s.backend.DB() == nil {
		return DeadLetterRecord{}, false
	}
	deadLetterID = strings.TrimSpace(deadLetterID)
	if deadLetterID == "" {
		return DeadLetterRecord{}, false
	}

	query := `
SELECT
    id::text,
    COALESCE(package_id::text, ''),
    COALESCE(source_ref, ''),
    COALESCE(error_code, ''),
    COALESCE(error_message, ''),
    retry_count,
    failed_at,
    created_at,
    replayed_at,
    COALESCE(replay_batch_id, ''),
    COALESCE(replay_reason, '')
FROM ingest_dead_letters
WHERE id::text = $1
`
	var (
		record     DeadLetterRecord
		replayedAt sql.NullTime
	)
	if err := s.backend.DB().QueryRowContext(ctx, query, deadLetterID).Scan(
		&record.DeadLetterID,
		&record.PackageID,
		&record.SourceRef,
		&record.ErrorCode,
		&record.ErrorMessage,
		&record.RetryCount,
		&record.FailedAt,
		&record.CreatedAt,
		&replayedAt,
		&record.ReplayBatchID,
		&record.ReplayReason,
	); err != nil {
		return DeadLetterRecord{}, false
	}
	record.FailedAt = record.FailedAt.UTC()
	record.CreatedAt = record.CreatedAt.UTC()
	record.ReplayedAt = parseOptionalTime(replayedAt)
	return record, true
}

func (s *DeadLetterStore) countFromDB(ctx context.Context) int {
	if s.backend == nil || s.backend.DB() == nil {
		return 0
	}
	query := `SELECT COUNT(1) FROM ingest_dead_letters`
	total := 0
	if err := s.backend.DB().QueryRowContext(ctx, query).Scan(&total); err != nil {
		return 0
	}
	return total
}

func normalizeDeadLetterIDs(ids []string) []string {
	seen := make(map[string]struct{}, len(ids))
	result := make([]string, 0, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	return result
}

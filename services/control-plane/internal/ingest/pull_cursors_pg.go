package ingest

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

func (s *PullCursorStore) upsertFromDB(ctx context.Context, cursor PullCursor) error {
	if s.backend == nil || s.backend.DB() == nil {
		return fmt.Errorf("postgres backend is not configured")
	}
	normalized, err := normalizePullCursor(cursor)
	if err != nil {
		return err
	}

	query := `
INSERT INTO agent_pull_cursors (
    source_id,
    task_id,
    agent_id,
    source_ref,
    source_path,
    last_cursor,
    last_offset,
    last_batch_id,
    request_id,
    updated_at
) VALUES (
    $1::uuid,
    NULLIF($2, '')::uuid,
    $3,
    $4,
    $5,
    NULLIF($6, ''),
    $7,
    NULLIF($8, ''),
    NULLIF($9, ''),
    $10
)
ON CONFLICT (source_id, source_path) DO UPDATE SET
    task_id = COALESCE(EXCLUDED.task_id, agent_pull_cursors.task_id),
    agent_id = EXCLUDED.agent_id,
    source_ref = EXCLUDED.source_ref,
    last_cursor = COALESCE(EXCLUDED.last_cursor, agent_pull_cursors.last_cursor),
    last_offset = GREATEST(agent_pull_cursors.last_offset, EXCLUDED.last_offset),
    last_batch_id = COALESCE(EXCLUDED.last_batch_id, agent_pull_cursors.last_batch_id),
    request_id = COALESCE(EXCLUDED.request_id, agent_pull_cursors.request_id),
    updated_at = EXCLUDED.updated_at
`
	_, err = s.backend.DB().ExecContext(
		ctx,
		query,
		normalized.SourceID,
		normalized.TaskID,
		normalized.AgentID,
		normalized.SourceRef,
		normalized.SourcePath,
		normalized.LastCursor,
		normalized.LastOffset,
		normalized.LastBatchID,
		normalized.RequestID,
		normalized.UpdatedAt.UTC(),
	)
	return wrapDBError("upsert pull cursor", err)
}

func (s *PullCursorStore) getFromDB(ctx context.Context, sourceID, sourcePath string) (PullCursor, bool) {
	sourceID = strings.TrimSpace(sourceID)
	sourcePath = strings.TrimSpace(sourcePath)
	if sourceID == "" || sourcePath == "" {
		return PullCursor{}, false
	}

	query := `
SELECT
    source_id::text,
    COALESCE(task_id::text, ''),
    agent_id,
    source_ref,
    source_path,
    COALESCE(last_cursor, ''),
    COALESCE(last_offset, 0),
    COALESCE(last_batch_id, ''),
    COALESCE(request_id, ''),
    updated_at
FROM agent_pull_cursors
WHERE source_id = $1::uuid
  AND source_path = $2
`
	return scanPullCursorRow(s.backend.DB().QueryRowContext(ctx, query, sourceID, sourcePath))
}

func (s *PullCursorStore) getLatestBySourceFromDB(ctx context.Context, sourceID string) (PullCursor, bool) {
	sourceID = strings.TrimSpace(sourceID)
	if sourceID == "" {
		return PullCursor{}, false
	}

	query := `
SELECT
    source_id::text,
    COALESCE(task_id::text, ''),
    agent_id,
    source_ref,
    source_path,
    COALESCE(last_cursor, ''),
    COALESCE(last_offset, 0),
    COALESCE(last_batch_id, ''),
    COALESCE(request_id, ''),
    updated_at
FROM agent_pull_cursors
WHERE source_id = $1::uuid
ORDER BY updated_at DESC, last_offset DESC
LIMIT 1
`
	return scanPullCursorRow(s.backend.DB().QueryRowContext(ctx, query, sourceID))
}

func (s *PullCursorStore) getLatestMatchingSourcePathFromDB(ctx context.Context, sourceID, sourcePathPattern string) (PullCursor, bool) {
	sourceID = strings.TrimSpace(sourceID)
	patterns := parseCursorSourcePathPatterns(sourcePathPattern)
	if sourceID == "" || len(patterns) == 0 {
		return PullCursor{}, false
	}

	query := `
SELECT
    source_id::text,
    COALESCE(task_id::text, ''),
    agent_id,
    source_ref,
    source_path,
    COALESCE(last_cursor, ''),
    COALESCE(last_offset, 0),
    COALESCE(last_batch_id, ''),
    COALESCE(request_id, ''),
    updated_at
FROM agent_pull_cursors
WHERE source_id = $1::uuid
ORDER BY updated_at DESC, last_offset DESC
`
	rows, err := s.backend.DB().QueryContext(ctx, query, sourceID)
	if err != nil {
		return PullCursor{}, false
	}
	defer rows.Close()

	latest := PullCursor{}
	found := false
	for rows.Next() {
		item, ok, err := scanPullCursorRows(rows)
		if err != nil || !ok {
			continue
		}
		if !cursorSourcePathMatches(patterns, item.SourcePath) {
			continue
		}
		latest = item
		found = true
		break
	}
	if err := rows.Err(); err != nil {
		return PullCursor{}, false
	}
	return latest, found
}

func scanPullCursorRow(row *sql.Row) (PullCursor, bool) {
	item, ok, err := scanPullCursorRows(row)
	if err != nil || !ok {
		return PullCursor{}, false
	}
	return item, true
}

type pullCursorScanner interface {
	Scan(dest ...any) error
}

func scanPullCursorRows(scanner pullCursorScanner) (PullCursor, bool, error) {
	item := PullCursor{}
	var updatedAt sql.NullTime
	if err := scanner.Scan(
		&item.SourceID,
		&item.TaskID,
		&item.AgentID,
		&item.SourceRef,
		&item.SourcePath,
		&item.LastCursor,
		&item.LastOffset,
		&item.LastBatchID,
		&item.RequestID,
		&updatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return PullCursor{}, false, nil
		}
		return PullCursor{}, false, err
	}
	if updatedAt.Valid {
		item.UpdatedAt = updatedAt.Time.UTC()
	} else {
		item.UpdatedAt = time.Now().UTC()
	}
	return item, true, nil
}

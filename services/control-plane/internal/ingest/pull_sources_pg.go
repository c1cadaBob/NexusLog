package ingest

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
)

func (s *PullSourceStore) listFromDB(ctx context.Context, status string, page, pageSize int) ([]PullSource, int) {
	if s.backend == nil || s.backend.DB() == nil {
		return []PullSource{}, 0
	}

	tenantID := s.backend.ResolveTenantID(ctx)
	total := 0
	countQuery := `
SELECT COUNT(1)
FROM ingest_pull_sources
WHERE tenant_id = $1::uuid
  AND ($2 = '' OR status = $2)
`
	if err := s.backend.DB().QueryRowContext(ctx, countQuery, tenantID, status).Scan(&total); err != nil {
		return []PullSource{}, 0
	}

	query := `
SELECT
	tenant_id::text,
    id::text,
    name,
    host,
    port,
    protocol,
    COALESCE(path_pattern, ''),
    COALESCE(auth_ref, ''),
    COALESCE(agent_base_url, ''),
    COALESCE(pull_interval_sec, 30),
    COALESCE(pull_timeout_sec, 30),
    COALESCE(key_ref, ''),
    status,
    created_at,
    updated_at
FROM ingest_pull_sources
WHERE tenant_id = $1::uuid
  AND ($2 = '' OR status = $2)
ORDER BY updated_at DESC
OFFSET $3
LIMIT $4
`

	offset := (page - 1) * pageSize
	rows, err := s.backend.DB().QueryContext(ctx, query, tenantID, status, offset, pageSize)
	if err != nil {
		return []PullSource{}, 0
	}
	defer mustRowsClose(rows)

	items := make([]PullSource, 0, pageSize)
	for rows.Next() {
		var item PullSource
		if scanErr := rows.Scan(
			&item.TenantID,
			&item.SourceID,
			&item.Name,
			&item.Host,
			&item.Port,
			&item.Protocol,
			&item.Path,
			&item.Auth,
			&item.AgentBaseURL,
			&item.PullIntervalSec,
			&item.PullTimeoutSec,
			&item.KeyRef,
			&item.Status,
			&item.CreatedAt,
			&item.UpdatedAt,
		); scanErr != nil {
			continue
		}
		item.CreatedAt = item.CreatedAt.UTC()
		item.UpdatedAt = item.UpdatedAt.UTC()
		items = append(items, item)
	}
	return items, total
}

func (s *PullSourceStore) existsFromDB(ctx context.Context, sourceID string) bool {
	if s.backend == nil || s.backend.DB() == nil {
		return false
	}
	sourceID = strings.TrimSpace(sourceID)
	if sourceID == "" {
		return false
	}
	tenantID := s.backend.ResolveTenantID(ctx)
	query := `
SELECT EXISTS(
    SELECT 1
    FROM ingest_pull_sources
    WHERE id = $1::uuid
      AND tenant_id = $2::uuid
)
`
	var ok bool
	if err := s.backend.DB().QueryRowContext(ctx, query, sourceID, tenantID).Scan(&ok); err != nil {
		return false
	}
	return ok
}

func (s *PullSourceStore) createFromDB(ctx context.Context, req CreatePullSourceRequest) (PullSource, error) {
	if s.backend == nil || s.backend.DB() == nil {
		return PullSource{}, fmt.Errorf("postgres backend is not configured")
	}

	candidate := PullSource{
		Host:         req.Host,
		Port:         req.Port,
		Protocol:     req.Protocol,
		AgentBaseURL: req.AgentBaseURL,
		Status:       req.Status,
	}
	if err := s.ensureNoActiveOverlapFromDB(ctx, candidate, ""); err != nil {
		return PullSource{}, err
	}

	tenantID := s.backend.ResolveTenantID(ctx)
	now := s.backend.Now()
	query := `
INSERT INTO ingest_pull_sources (
    tenant_id,
    name,
    host,
    port,
    protocol,
    path_pattern,
    auth_ref,
    agent_base_url,
    pull_interval_sec,
    pull_timeout_sec,
    key_ref,
    status,
    created_at,
    updated_at
) VALUES (
    $1::uuid,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11,
    $12,
    $13,
    $13
)
RETURNING
	tenant_id::text,
    id::text,
    name,
    host,
    port,
    protocol,
    COALESCE(path_pattern, ''),
    COALESCE(auth_ref, ''),
    COALESCE(agent_base_url, ''),
    COALESCE(pull_interval_sec, 30),
    COALESCE(pull_timeout_sec, 30),
    COALESCE(key_ref, ''),
    status,
    created_at,
    updated_at
`

	var created PullSource
	err := s.backend.DB().QueryRowContext(
		ctx,
		query,
		tenantID,
		req.Name,
		req.Host,
		req.Port,
		req.Protocol,
		sqlNullString(req.Path),
		sqlNullString(req.Auth),
		sqlNullString(req.AgentBaseURL),
		req.PullIntervalSec,
		req.PullTimeoutSec,
		sqlNullString(req.KeyRef),
		req.Status,
		now,
	).Scan(
		&created.TenantID,
		&created.SourceID,
		&created.Name,
		&created.Host,
		&created.Port,
		&created.Protocol,
		&created.Path,
		&created.Auth,
		&created.AgentBaseURL,
		&created.PullIntervalSec,
		&created.PullTimeoutSec,
		&created.KeyRef,
		&created.Status,
		&created.CreatedAt,
		&created.UpdatedAt,
	)
	if err != nil {
		if IsUniqueViolation(err) {
			return PullSource{}, ErrPullSourceNameConflict
		}
		return PullSource{}, wrapDBError("insert pull source", err)
	}
	created.CreatedAt = created.CreatedAt.UTC()
	created.UpdatedAt = created.UpdatedAt.UTC()
	return created, nil
}

func (s *PullSourceStore) updateFromDB(ctx context.Context, sourceID string, req UpdatePullSourceRequest) (PullSource, error) {
	if s.backend == nil || s.backend.DB() == nil {
		return PullSource{}, fmt.Errorf("postgres backend is not configured")
	}

	sourceID = strings.TrimSpace(sourceID)
	if sourceID == "" {
		return PullSource{}, ErrPullSourceNotFound
	}

	current, ok := s.getByIDFromDB(ctx, sourceID)
	if !ok {
		return PullSource{}, ErrPullSourceNotFound
	}
	candidate := applyPullSourceUpdate(current, req)
	if err := s.ensureNoActiveOverlapFromDB(ctx, candidate, sourceID); err != nil {
		return PullSource{}, err
	}

	now := s.backend.Now()
	query := `
UPDATE ingest_pull_sources
SET
    name = COALESCE($2, name),
    host = COALESCE($3, host),
    port = COALESCE($4, port),
    protocol = COALESCE($5, protocol),
    path_pattern = COALESCE($6, path_pattern),
    auth_ref = COALESCE($7, auth_ref),
    agent_base_url = COALESCE($8, agent_base_url),
    pull_interval_sec = COALESCE($9, pull_interval_sec),
    pull_timeout_sec = COALESCE($10, pull_timeout_sec),
    key_ref = COALESCE($11, key_ref),
    status = COALESCE($12, status),
    updated_at = $13
WHERE id = $1::uuid
RETURNING
	tenant_id::text,
    id::text,
    name,
    host,
    port,
    protocol,
    COALESCE(path_pattern, ''),
    COALESCE(auth_ref, ''),
    COALESCE(agent_base_url, ''),
    COALESCE(pull_interval_sec, 30),
    COALESCE(pull_timeout_sec, 30),
    COALESCE(key_ref, ''),
    status,
    created_at,
    updated_at
`

	var updated PullSource
	err := s.backend.DB().QueryRowContext(
		ctx,
		query,
		sourceID,
		derefString(req.Name),
		derefString(req.Host),
		derefInt(req.Port),
		derefString(req.Protocol),
		derefString(req.Path),
		derefString(req.Auth),
		derefString(req.AgentBaseURL),
		derefInt(req.PullIntervalSec),
		derefInt(req.PullTimeoutSec),
		derefString(req.KeyRef),
		derefString(req.Status),
		now,
	).Scan(
		&updated.TenantID,
		&updated.SourceID,
		&updated.Name,
		&updated.Host,
		&updated.Port,
		&updated.Protocol,
		&updated.Path,
		&updated.Auth,
		&updated.AgentBaseURL,
		&updated.PullIntervalSec,
		&updated.PullTimeoutSec,
		&updated.KeyRef,
		&updated.Status,
		&updated.CreatedAt,
		&updated.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return PullSource{}, ErrPullSourceNotFound
		}
		if IsUniqueViolation(err) {
			return PullSource{}, ErrPullSourceNameConflict
		}
		return PullSource{}, wrapDBError("update pull source", err)
	}
	updated.CreatedAt = updated.CreatedAt.UTC()
	updated.UpdatedAt = updated.UpdatedAt.UTC()
	return updated, nil
}

func (s *PullSourceStore) getByIDFromDB(ctx context.Context, sourceID string) (PullSource, bool) {
	if s.backend == nil || s.backend.DB() == nil {
		return PullSource{}, false
	}
	sourceID = strings.TrimSpace(sourceID)
	if sourceID == "" {
		return PullSource{}, false
	}
	query := `
SELECT
	tenant_id::text,
    id::text,
    name,
    host,
    port,
    protocol,
    COALESCE(path_pattern, ''),
    COALESCE(auth_ref, ''),
    COALESCE(agent_base_url, ''),
    COALESCE(pull_interval_sec, 30),
    COALESCE(pull_timeout_sec, 30),
    COALESCE(key_ref, ''),
    status,
    created_at,
    updated_at
FROM ingest_pull_sources
WHERE id = $1::uuid
`
	var item PullSource
	if err := s.backend.DB().QueryRowContext(ctx, query, sourceID).Scan(
		&item.TenantID,
		&item.SourceID,
		&item.Name,
		&item.Host,
		&item.Port,
		&item.Protocol,
		&item.Path,
		&item.Auth,
		&item.AgentBaseURL,
		&item.PullIntervalSec,
		&item.PullTimeoutSec,
		&item.KeyRef,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return PullSource{}, false
	}
	item.CreatedAt = item.CreatedAt.UTC()
	item.UpdatedAt = item.UpdatedAt.UTC()
	return item, true
}

func (s *PullSourceStore) ensureNoActiveOverlapFromDB(ctx context.Context, candidate PullSource, excludeSourceID string) error {
	if s.backend == nil || s.backend.DB() == nil {
		return nil
	}

	candidateIdentity, ok := activeAgentIdentity(candidate)
	if !ok {
		return nil
	}

	tenantID := s.backend.ResolveTenantID(ctx)
	excludeSourceID = strings.TrimSpace(excludeSourceID)

	query := `
SELECT EXISTS (
    SELECT 1
    FROM ingest_pull_sources
    WHERE tenant_id = $1::uuid
      AND status = 'active'
      AND LOWER(protocol) IN ('http', 'https')
      AND COALESCE(NULLIF(LOWER(BTRIM(agent_base_url)), ''), LOWER(BTRIM(protocol)) || '://' || LOWER(BTRIM(host)) || ':' || port::text) = $2
      AND ($3::uuid IS NULL OR id <> $3::uuid)
)
`
	var exclude sql.NullString
	if excludeSourceID != "" {
		exclude = sql.NullString{String: excludeSourceID, Valid: true}
	}

	var exists bool
	if err := s.backend.DB().QueryRowContext(ctx, query, tenantID, candidateIdentity, exclude).Scan(&exists); err != nil {
		return wrapDBError("check pull source overlap", err)
	}
	if exists {
		return ErrPullSourceOverlapConflict
	}
	return nil
}

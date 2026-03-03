package ingest

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

func (s *PullPackageStore) listFromDB(ctx context.Context, agentID, sourceRef, status string, page, pageSize int) ([]PullPackage, int) {
	agentID = strings.TrimSpace(agentID)
	sourceRef = strings.TrimSpace(sourceRef)
	status = strings.TrimSpace(status)

	countQuery := `
SELECT COUNT(1)
FROM agent_incremental_packages
WHERE ($1 = '' OR agent_id = $1)
  AND ($2 = '' OR source_ref = $2)
  AND ($3 = '' OR status = $3)
`
	total := 0
	if err := s.backend.DB().QueryRowContext(ctx, countQuery, agentID, sourceRef, status).Scan(&total); err != nil {
		return []PullPackage{}, 0
	}

	query := `
SELECT
    id::text,
    COALESCE(source_id::text, ''),
    COALESCE(task_id::text, ''),
    agent_id,
    source_ref,
    package_no,
    COALESCE(batch_id, ''),
    COALESCE(next_cursor, ''),
    COALESCE(record_count, 0),
    from_offset,
    to_offset,
    file_count,
    size_bytes,
    checksum,
    status,
    COALESCE(request_id, ''),
    metadata,
    sent_at,
    acked_at,
    created_at
FROM agent_incremental_packages
WHERE ($1 = '' OR agent_id = $1)
  AND ($2 = '' OR source_ref = $2)
  AND ($3 = '' OR status = $3)
ORDER BY created_at DESC
OFFSET $4
LIMIT $5
`
	offset := (page - 1) * pageSize
	rows, err := s.backend.DB().QueryContext(ctx, query, agentID, sourceRef, status, offset, pageSize)
	if err != nil {
		return []PullPackage{}, total
	}
	defer mustRowsClose(rows)

	items := make([]PullPackage, 0, pageSize)
	packageIDs := make([]string, 0, pageSize)
	for rows.Next() {
		var (
			item        PullPackage
			metadataRaw []byte
			sentAt      sql.NullTime
			ackedAt     sql.NullTime
		)
		if scanErr := rows.Scan(
			&item.PackageID,
			&item.SourceID,
			&item.TaskID,
			&item.AgentID,
			&item.SourceRef,
			&item.PackageNo,
			&item.BatchID,
			&item.NextCursor,
			&item.RecordCount,
			&item.FromOffset,
			&item.ToOffset,
			&item.FileCount,
			&item.SizeBytes,
			&item.Checksum,
			&item.Status,
			&item.RequestID,
			&metadataRaw,
			&sentAt,
			&ackedAt,
			&item.CreatedAt,
		); scanErr != nil {
			continue
		}
		item.Metadata = decodePackageMetadata(metadataRaw)
		item.SentAt = parseOptionalTime(sentAt)
		item.AckedAt = parseOptionalTime(ackedAt)
		item.CreatedAt = item.CreatedAt.UTC()
		items = append(items, item)
		packageIDs = append(packageIDs, item.PackageID)
	}

	filesByPackage := s.listFilesByPackageIDs(ctx, packageIDs)
	for i := range items {
		items[i].Files = filesByPackage[items[i].PackageID]
	}
	return items, total
}

func (s *PullPackageStore) getFromDB(ctx context.Context, packageID string) (PullPackage, bool) {
	packageID = strings.TrimSpace(packageID)
	if packageID == "" {
		return PullPackage{}, false
	}
	query := `
SELECT
    id::text,
    COALESCE(source_id::text, ''),
    COALESCE(task_id::text, ''),
    agent_id,
    source_ref,
    package_no,
    COALESCE(batch_id, ''),
    COALESCE(next_cursor, ''),
    COALESCE(record_count, 0),
    from_offset,
    to_offset,
    file_count,
    size_bytes,
    checksum,
    status,
    COALESCE(request_id, ''),
    metadata,
    sent_at,
    acked_at,
    created_at
FROM agent_incremental_packages
WHERE id = $1::uuid
`
	var (
		item        PullPackage
		metadataRaw []byte
		sentAt      sql.NullTime
		ackedAt     sql.NullTime
	)
	if err := s.backend.DB().QueryRowContext(ctx, query, packageID).Scan(
		&item.PackageID,
		&item.SourceID,
		&item.TaskID,
		&item.AgentID,
		&item.SourceRef,
		&item.PackageNo,
		&item.BatchID,
		&item.NextCursor,
		&item.RecordCount,
		&item.FromOffset,
		&item.ToOffset,
		&item.FileCount,
		&item.SizeBytes,
		&item.Checksum,
		&item.Status,
		&item.RequestID,
		&metadataRaw,
		&sentAt,
		&ackedAt,
		&item.CreatedAt,
	); err != nil {
		return PullPackage{}, false
	}
	item.Metadata = decodePackageMetadata(metadataRaw)
	item.SentAt = parseOptionalTime(sentAt)
	item.AckedAt = parseOptionalTime(ackedAt)
	item.CreatedAt = item.CreatedAt.UTC()
	item.Files = s.listFilesByPackageIDs(ctx, []string{item.PackageID})[item.PackageID]
	return item, true
}

func (s *PullPackageStore) applyReceiptFromDB(ctx context.Context, packageID, receiptStatus string, receivedAt time.Time) (PullPackage, bool) {
	receiptStatus = strings.TrimSpace(receiptStatus)
	if receiptStatus != "ack" && receiptStatus != "nack" {
		return PullPackage{}, false
	}
	if receivedAt.IsZero() {
		receivedAt = time.Now().UTC()
	}
	statusValue := "nacked"
	ackedAt := sql.NullTime{}
	if receiptStatus == "ack" {
		statusValue = "acked"
		ackedAt = sql.NullTime{Time: receivedAt, Valid: true}
	}
	query := `
UPDATE agent_incremental_packages
SET
    status = $2,
    acked_at = CASE WHEN $3::timestamptz IS NULL THEN acked_at ELSE $3 END
WHERE id = $1::uuid
`
	if _, err := s.backend.DB().ExecContext(ctx, query, packageID, statusValue, ackedAt); err != nil {
		return PullPackage{}, false
	}
	return s.getFromDB(ctx, packageID)
}

func (s *PullPackageStore) createFromDB(ctx context.Context, pkg PullPackage) (PullPackage, error) {
	now := time.Now().UTC()
	if strings.TrimSpace(pkg.PackageID) == "" {
		pkg.PackageID = newUUIDLike()
	}
	if strings.TrimSpace(pkg.Status) == "" {
		pkg.Status = "uploaded"
	}
	if pkg.RecordCount <= 0 && len(pkg.Files) > 0 {
		total := 0
		for _, file := range pkg.Files {
			total += file.LineCount
		}
		pkg.RecordCount = total
	}
	tx, err := s.backend.DB().BeginTx(ctx, nil)
	if err != nil {
		return PullPackage{}, wrapDBError("begin package tx", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	insertPackageQuery := `
INSERT INTO agent_incremental_packages (
    id,
    source_id,
    task_id,
    agent_id,
    source_ref,
    package_no,
    batch_id,
    next_cursor,
    record_count,
    from_offset,
    to_offset,
    file_count,
    size_bytes,
    checksum,
    status,
    sent_at,
    metadata,
    request_id,
    created_at
) VALUES (
    $1::uuid,
    NULLIF($2, '')::uuid,
    NULLIF($3, '')::uuid,
    $4,
    $5,
    $6,
    NULLIF($7, ''),
    NULLIF($8, ''),
    $9,
    $10,
    $11,
    $12,
    $13,
    $14,
    $15,
    $16,
    $17::jsonb,
    NULLIF($18, ''),
    $19
)
`
	_, err = tx.ExecContext(
		ctx,
		insertPackageQuery,
		pkg.PackageID,
		pkg.SourceID,
		pkg.TaskID,
		pkg.AgentID,
		pkg.SourceRef,
		pkg.PackageNo,
		pkg.BatchID,
		pkg.NextCursor,
		pkg.RecordCount,
		pkg.FromOffset,
		pkg.ToOffset,
		pkg.FileCount,
		pkg.SizeBytes,
		pkg.Checksum,
		pkg.Status,
		toNullTimePtr(pkg.SentAt),
		encodePackageMetadata(pkg.Metadata),
		pkg.RequestID,
		now,
	)
	if err != nil {
		if IsUniqueViolation(err) {
			existing, ok := s.findExistingPackageInTx(ctx, tx, pkg)
			if ok {
				_ = tx.Rollback()
				return existing, nil
			}
		}
		return PullPackage{}, wrapDBError("insert package", err)
	}

	fileInsertQuery := `
INSERT INTO agent_package_files (
    package_id,
    file_path,
    from_offset,
    to_offset,
    line_count,
    size_bytes,
    checksum,
    first_record_id,
    last_record_id,
    first_sequence,
    last_sequence,
    created_at
) VALUES (
    $1::uuid,
    $2,
    $3,
    $4,
    $5,
    $6,
    NULLIF($7, ''),
    NULLIF($8, ''),
    NULLIF($9, ''),
    $10,
    $11,
    $12
)
`
	for _, file := range pkg.Files {
		if strings.TrimSpace(file.FilePath) == "" {
			continue
		}
		if _, fileErr := tx.ExecContext(
			ctx,
			fileInsertQuery,
			pkg.PackageID,
			file.FilePath,
			file.FromOffset,
			file.ToOffset,
			file.LineCount,
			file.SizeBytes,
			file.Checksum,
			file.FirstRecordID,
			file.LastRecordID,
			sql.NullInt64{Int64: file.FirstSequence, Valid: file.FirstSequence > 0},
			sql.NullInt64{Int64: file.LastSequence, Valid: file.LastSequence > 0},
			now,
		); fileErr != nil {
			return PullPackage{}, wrapDBError("insert package file", fileErr)
		}
	}

	if commitErr := tx.Commit(); commitErr != nil {
		return PullPackage{}, wrapDBError("commit package tx", commitErr)
	}
	created, ok := s.getFromDB(ctx, pkg.PackageID)
	if !ok {
		return PullPackage{}, fmt.Errorf("read package after create failed")
	}
	return created, nil
}

func (s *PullPackageStore) findExistingPackageInTx(ctx context.Context, tx *sql.Tx, pkg PullPackage) (PullPackage, bool) {
	query := `
SELECT id::text
FROM agent_incremental_packages
WHERE ($1 <> '' AND batch_id = $1 AND checksum = $2)
   OR (agent_id = $3 AND source_ref = $4 AND checksum = $2)
ORDER BY created_at DESC
LIMIT 1
`
	var packageID string
	if err := tx.QueryRowContext(
		ctx,
		query,
		strings.TrimSpace(pkg.BatchID),
		strings.TrimSpace(pkg.Checksum),
		strings.TrimSpace(pkg.AgentID),
		strings.TrimSpace(pkg.SourceRef),
	).Scan(&packageID); err != nil {
		return PullPackage{}, false
	}
	return s.getFromDB(ctx, packageID)
}

func (s *PullPackageStore) listFilesByPackageIDs(ctx context.Context, packageIDs []string) map[string][]PullPackageFile {
	result := make(map[string][]PullPackageFile, len(packageIDs))
	for _, packageID := range packageIDs {
		if strings.TrimSpace(packageID) == "" {
			continue
		}
		query := `
SELECT
    package_id::text,
    file_path,
    from_offset,
    to_offset,
    line_count,
    COALESCE(size_bytes, 0),
    COALESCE(checksum, ''),
    COALESCE(first_record_id, ''),
    COALESCE(last_record_id, ''),
    first_sequence,
    last_sequence
FROM agent_package_files
WHERE package_id = $1::uuid
ORDER BY created_at ASC
`
		rows, err := s.backend.DB().QueryContext(ctx, query, packageID)
		if err != nil {
			continue
		}
		files := make([]PullPackageFile, 0, 8)
		for rows.Next() {
			var (
				item          PullPackageFile
				filePackageID string
				firstSeq      sql.NullInt64
				lastSeq       sql.NullInt64
			)
			if scanErr := rows.Scan(
				&filePackageID,
				&item.FilePath,
				&item.FromOffset,
				&item.ToOffset,
				&item.LineCount,
				&item.SizeBytes,
				&item.Checksum,
				&item.FirstRecordID,
				&item.LastRecordID,
				&firstSeq,
				&lastSeq,
			); scanErr != nil {
				continue
			}
			if firstSeq.Valid {
				item.FirstSequence = firstSeq.Int64
			}
			if lastSeq.Valid {
				item.LastSequence = lastSeq.Int64
			}
			files = append(files, item)
		}
		_ = rows.Close()
		result[packageID] = files
	}
	return result
}

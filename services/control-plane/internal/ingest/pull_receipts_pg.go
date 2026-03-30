package ingest

import (
	"context"
	"fmt"
	"strings"
	"time"
)

func (s *ReceiptStore) createFromDB(ctx context.Context, receipt DeliveryReceipt) (DeliveryReceipt, error) {
	if s.backend == nil || s.backend.DB() == nil {
		return DeliveryReceipt{}, fmt.Errorf("postgres backend is not configured")
	}

	now := time.Now().UTC()
	if receipt.ReceivedAt.IsZero() {
		receipt.ReceivedAt = now
	}
	if receipt.CreatedAt.IsZero() {
		receipt.CreatedAt = receipt.ReceivedAt
	}
	result := strings.TrimSpace(receipt.Status)
	if result == "" {
		result = "ack"
	}
	errorCode := strings.TrimSpace(receipt.ErrorCode)
	if errorCode == "" {
		errorCode = buildReceiptErrorCode(result)
	}

	query := `
INSERT INTO ingest_delivery_receipts (
    package_id,
    received_at,
    result,
    error_code,
    error_message,
    created_at
) VALUES (
    $1::uuid,
    $2,
    $3,
    NULLIF($4, ''),
    NULLIF($5, ''),
    $6
)
RETURNING
    id::text,
    package_id::text,
    result,
    COALESCE(error_code, ''),
    COALESCE(error_message, ''),
    received_at,
    created_at
`
	created := DeliveryReceipt{}
	err := s.backend.DB().QueryRowContext(
		ctx,
		query,
		strings.TrimSpace(receipt.PackageID),
		receipt.ReceivedAt.UTC(),
		result,
		errorCode,
		strings.TrimSpace(receipt.Reason),
		receipt.CreatedAt.UTC(),
	).Scan(
		&created.ReceiptID,
		&created.PackageID,
		&created.Status,
		&created.ErrorCode,
		&created.Reason,
		&created.ReceivedAt,
		&created.CreatedAt,
	)
	if err != nil {
		return DeliveryReceipt{}, wrapDBError("insert delivery receipt", err)
	}

	created.PackageNo = strings.TrimSpace(receipt.PackageNo)
	created.SourceRef = strings.TrimSpace(receipt.SourceRef)
	created.Accepted = true
	created.Checksum = strings.TrimSpace(receipt.Checksum)
	created.ReceivedAt = created.ReceivedAt.UTC()
	created.CreatedAt = created.CreatedAt.UTC()
	return created, nil
}

func (s *ReceiptStore) listFromDB(ctx context.Context, sourceRef, packageID, status, errorCode string, page, pageSize int) ([]DeliveryReceipt, int) {
	sourceRef = strings.TrimSpace(sourceRef)
	packageID = strings.TrimSpace(packageID)
	status = strings.ToLower(strings.TrimSpace(status))
	errorCode = strings.TrimSpace(errorCode)

	countQuery := `
SELECT COUNT(1)
FROM ingest_delivery_receipts r
LEFT JOIN agent_incremental_packages p ON p.id = r.package_id
WHERE ($1 = '' OR COALESCE(p.source_ref, '') = $1)
  AND ($2 = '' OR COALESCE(r.package_id::text, '') = $2)
  AND ($3 = '' OR COALESCE(r.result, '') = $3)
  AND ($4 = '' OR COALESCE(r.error_code, '') = $4)
`
	total := 0
	if err := s.backend.DB().QueryRowContext(ctx, countQuery, sourceRef, packageID, status, errorCode).Scan(&total); err != nil {
		return []DeliveryReceipt{}, 0
	}

	query := `
SELECT
    r.id::text,
    r.package_id::text,
    COALESCE(p.package_no, ''),
    COALESCE(p.source_ref, ''),
    COALESCE(r.result, ''),
    COALESCE(r.error_code, ''),
    COALESCE(r.error_message, ''),
    r.received_at,
    r.created_at
FROM ingest_delivery_receipts r
LEFT JOIN agent_incremental_packages p ON p.id = r.package_id
WHERE ($1 = '' OR COALESCE(p.source_ref, '') = $1)
  AND ($2 = '' OR COALESCE(r.package_id::text, '') = $2)
  AND ($3 = '' OR COALESCE(r.result, '') = $3)
  AND ($4 = '' OR COALESCE(r.error_code, '') = $4)
ORDER BY r.received_at DESC, r.id DESC
OFFSET $5
LIMIT $6
`
	offset := (page - 1) * pageSize
	rows, err := s.backend.DB().QueryContext(ctx, query, sourceRef, packageID, status, errorCode, offset, pageSize)
	if err != nil {
		return []DeliveryReceipt{}, total
	}
	defer mustRowsClose(rows)

	items := make([]DeliveryReceipt, 0, pageSize)
	for rows.Next() {
		var item DeliveryReceipt
		if scanErr := rows.Scan(
			&item.ReceiptID,
			&item.PackageID,
			&item.PackageNo,
			&item.SourceRef,
			&item.Status,
			&item.ErrorCode,
			&item.Reason,
			&item.ReceivedAt,
			&item.CreatedAt,
		); scanErr != nil {
			continue
		}
		item.Accepted = true
		item.ReceivedAt = item.ReceivedAt.UTC()
		item.CreatedAt = item.CreatedAt.UTC()
		items = append(items, item)
	}
	return items, total
}

func (s *ReceiptStore) summarizeFromDB(ctx context.Context, sourceRef, packageID string) ReceiptListSummary {
	sourceRef = strings.TrimSpace(sourceRef)
	packageID = strings.TrimSpace(packageID)
	summary := ReceiptListSummary{}

	statusQuery := `
SELECT COALESCE(r.result, ''), COUNT(1)
FROM ingest_delivery_receipts r
LEFT JOIN agent_incremental_packages p ON p.id = r.package_id
WHERE ($1 = '' OR COALESCE(p.source_ref, '') = $1)
  AND ($2 = '' OR COALESCE(r.package_id::text, '') = $2)
GROUP BY COALESCE(r.result, '')
`
	statusRows, statusErr := s.backend.DB().QueryContext(ctx, statusQuery, sourceRef, packageID)
	if statusErr == nil {
		defer mustRowsClose(statusRows)
		for statusRows.Next() {
			var status string
			var count int
			if scanErr := statusRows.Scan(&status, &count); scanErr != nil {
				continue
			}
			switch strings.ToLower(strings.TrimSpace(status)) {
			case "ack":
				summary.AckCount = count
			case "nack":
				summary.NackCount = count
			}
		}
	}

	errorCodeQuery := `
SELECT COALESCE(r.error_code, ''), COUNT(1)
FROM ingest_delivery_receipts r
LEFT JOIN agent_incremental_packages p ON p.id = r.package_id
WHERE ($1 = '' OR COALESCE(p.source_ref, '') = $1)
  AND ($2 = '' OR COALESCE(r.package_id::text, '') = $2)
  AND COALESCE(r.error_code, '') <> ''
GROUP BY COALESCE(r.error_code, '')
ORDER BY COUNT(1) DESC, COALESCE(r.error_code, '') ASC
LIMIT 10
`
	errorCodeRows, errorCodeErr := s.backend.DB().QueryContext(ctx, errorCodeQuery, sourceRef, packageID)
	if errorCodeErr == nil {
		defer mustRowsClose(errorCodeRows)
		summary.ErrorCodeBuckets = make([]ReceiptErrorCodeBucket, 0, 10)
		for errorCodeRows.Next() {
			var bucket ReceiptErrorCodeBucket
			if scanErr := errorCodeRows.Scan(&bucket.ErrorCode, &bucket.Count); scanErr != nil {
				continue
			}
			summary.ErrorCodeBuckets = append(summary.ErrorCodeBuckets, bucket)
		}
	}

	nackReasonQuery := `
SELECT COALESCE(r.error_code, ''), COALESCE(r.error_message, ''), COUNT(1)
FROM ingest_delivery_receipts r
LEFT JOIN agent_incremental_packages p ON p.id = r.package_id
WHERE ($1 = '' OR COALESCE(p.source_ref, '') = $1)
  AND ($2 = '' OR COALESCE(r.package_id::text, '') = $2)
  AND COALESCE(r.result, '') = 'nack'
GROUP BY COALESCE(r.error_code, ''), COALESCE(r.error_message, '')
ORDER BY COUNT(1) DESC, COALESCE(r.error_code, '') ASC, COALESCE(r.error_message, '') ASC
LIMIT 10
`
	nackReasonRows, nackReasonErr := s.backend.DB().QueryContext(ctx, nackReasonQuery, sourceRef, packageID)
	if nackReasonErr == nil {
		defer mustRowsClose(nackReasonRows)
		summary.NackReasonBuckets = make([]ReceiptNackReasonBucket, 0, 10)
		for nackReasonRows.Next() {
			var bucket ReceiptNackReasonBucket
			if scanErr := nackReasonRows.Scan(&bucket.ErrorCode, &bucket.Reason, &bucket.Count); scanErr != nil {
				continue
			}
			summary.NackReasonBuckets = append(summary.NackReasonBuckets, bucket)
		}
	}

	return trimReceiptSummaryBuckets(summary)
}

func buildReceiptErrorCode(status string) string {
	if strings.EqualFold(strings.TrimSpace(status), "nack") {
		return "NACK_RECEIPT"
	}
	return ""
}

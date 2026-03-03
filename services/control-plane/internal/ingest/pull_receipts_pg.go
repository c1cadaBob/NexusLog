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
		buildReceiptErrorCode(result),
		strings.TrimSpace(receipt.Reason),
		receipt.CreatedAt.UTC(),
	).Scan(
		&created.ReceiptID,
		&created.PackageID,
		&created.Status,
		&created.Reason,
		&created.ReceivedAt,
		&created.CreatedAt,
	)
	if err != nil {
		return DeliveryReceipt{}, wrapDBError("insert delivery receipt", err)
	}

	created.Accepted = true
	created.Checksum = strings.TrimSpace(receipt.Checksum)
	created.ReceivedAt = created.ReceivedAt.UTC()
	created.CreatedAt = created.CreatedAt.UTC()
	return created, nil
}

func buildReceiptErrorCode(status string) string {
	if strings.EqualFold(strings.TrimSpace(status), "nack") {
		return "NACK_RECEIPT"
	}
	return ""
}

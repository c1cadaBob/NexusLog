package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

func bumpUserAuthzVersionTx(ctx context.Context, tx *sql.Tx, tenantID, userID uuid.UUID, reason string) error {
	if tx == nil || tenantID == uuid.Nil || userID == uuid.Nil {
		return nil
	}

	const q = `
        INSERT INTO authz_version (tenant_id, subject_type, subject_id, authz_epoch, reason)
        VALUES ($1, 'user', $2, 2, $3)
        ON CONFLICT (tenant_id, subject_type, subject_id)
        DO UPDATE SET authz_epoch = authz_version.authz_epoch + 1,
                      reason = EXCLUDED.reason,
                      updated_at = NOW()
    `

	if _, err := tx.ExecContext(ctx, q, tenantID, userID, reason); err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "42P01" {
			return nil
		}
		return fmt.Errorf("bump user authz version: %w", err)
	}
	return nil
}

func bumpUsersAuthzVersionTx(ctx context.Context, tx *sql.Tx, tenantID uuid.UUID, userIDs []uuid.UUID, reason string) error {
	if tx == nil || tenantID == uuid.Nil || len(userIDs) == 0 {
		return nil
	}

	idStrings := make([]string, 0, len(userIDs))
	for _, userID := range userIDs {
		if userID == uuid.Nil {
			continue
		}
		idStrings = append(idStrings, userID.String())
	}
	if len(idStrings) == 0 {
		return nil
	}

	const q = `
        INSERT INTO authz_version (tenant_id, subject_type, subject_id, authz_epoch, reason)
        SELECT $1, 'user', id, 2, $3
        FROM unnest($2::uuid[]) AS id
        ON CONFLICT (tenant_id, subject_type, subject_id)
        DO UPDATE SET authz_epoch = authz_version.authz_epoch + 1,
                      reason = EXCLUDED.reason,
                      updated_at = NOW()
    `

	if _, err := tx.ExecContext(ctx, q, tenantID, pq.Array(idStrings), reason); err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "42P01" {
			return nil
		}
		return fmt.Errorf("bump users authz version: %w", err)
	}
	return nil
}

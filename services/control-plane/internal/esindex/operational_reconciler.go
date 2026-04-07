package esindex

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	defaultOperationalReconcilerInterval      = 10 * time.Minute
	defaultOperationalReconcilerBatchSize     = 200
	defaultOperationalReconcilerAlertLookback = 7 * 24 * time.Hour
	defaultOperationalReconcilerAlertOverlap  = 30 * time.Minute
	defaultOperationalReconcilerAuditLookback = 24 * time.Hour
	defaultOperationalReconcilerAuditOverlap  = 15 * time.Minute
)

type OperationalReconciler struct {
	db                   *sql.DB
	alertSyncer          *AlertEventSyncer
	auditSyncer          *AuditLogSyncer
	interval             time.Duration
	batchSize            int
	alertStartupLookback time.Duration
	alertOverlap         time.Duration
	auditStartupLookback time.Duration
	auditOverlap         time.Duration

	lastAlertSweepCompletedAt time.Time
	lastAuditSweepCompletedAt time.Time
}

func NewOperationalReconcilerFromEnv(db *sql.DB) *OperationalReconciler {
	return &OperationalReconciler{
		db:                   db,
		alertSyncer:          NewAlertEventSyncerFromEnv(db),
		auditSyncer:          NewAuditLogSyncerFromEnv(db),
		interval:             parseDurationFromEnv("OPERATIONAL_ES_RECONCILER_INTERVAL", defaultOperationalReconcilerInterval),
		batchSize:            parsePositiveIntFromEnv("OPERATIONAL_ES_RECONCILER_BATCH_SIZE", defaultOperationalReconcilerBatchSize),
		alertStartupLookback: parseDurationFromEnv("OPERATIONAL_ES_RECONCILER_ALERT_STARTUP_LOOKBACK", defaultOperationalReconcilerAlertLookback),
		alertOverlap:         parseDurationFromEnv("OPERATIONAL_ES_RECONCILER_ALERT_OVERLAP", defaultOperationalReconcilerAlertOverlap),
		auditStartupLookback: parseDurationFromEnv("OPERATIONAL_ES_RECONCILER_AUDIT_STARTUP_LOOKBACK", defaultOperationalReconcilerAuditLookback),
		auditOverlap:         parseDurationFromEnv("OPERATIONAL_ES_RECONCILER_AUDIT_OVERLAP", defaultOperationalReconcilerAuditOverlap),
	}
}

func (r *OperationalReconciler) Enabled() bool {
	if r == nil || r.db == nil || r.interval <= 0 || r.batchSize <= 0 {
		return false
	}
	return (r.alertSyncer != nil && r.alertSyncer.Enabled()) || (r.auditSyncer != nil && r.auditSyncer.Enabled())
}

func (r *OperationalReconciler) Interval() time.Duration {
	if r == nil {
		return 0
	}
	return r.interval
}

func (r *OperationalReconciler) BatchSize() int {
	if r == nil {
		return 0
	}
	return r.batchSize
}

func (r *OperationalReconciler) Run(ctx context.Context) {
	if !r.Enabled() {
		return
	}
	r.syncOnce(ctx)

	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			r.syncOnce(ctx)
		}
	}
}

func (r *OperationalReconciler) syncOnce(ctx context.Context) {
	if r == nil || r.db == nil {
		return
	}
	if r.alertSyncer != nil && r.alertSyncer.Enabled() {
		if err := r.syncAlerts(ctx); err != nil {
			log.Printf("operational es reconciler: sync alerts failed: %v", err)
		}
	}
	if r.auditSyncer != nil && r.auditSyncer.Enabled() {
		if err := r.syncAudit(ctx); err != nil {
			log.Printf("operational es reconciler: sync audit failed: %v", err)
		}
	}
}

func (r *OperationalReconciler) syncAlerts(ctx context.Context) error {
	cutoff := r.alertWindowStart(time.Now().UTC())
	cursorTime := cutoff
	cursorID := ""
	processed := 0
	for {
		rows, err := r.db.QueryContext(ctx, `
SELECT
    id::text,
    GREATEST(
        created_at,
        fired_at,
        COALESCE(resolved_at, '-infinity'::timestamptz),
        COALESCE(notified_at, '-infinity'::timestamptz)
    ) AS activity_at
FROM alert_events
WHERE (
    GREATEST(
        created_at,
        fired_at,
        COALESCE(resolved_at, '-infinity'::timestamptz),
        COALESCE(notified_at, '-infinity'::timestamptz)
    ) > $1::timestamptz
    OR (
        GREATEST(
            created_at,
            fired_at,
            COALESCE(resolved_at, '-infinity'::timestamptz),
            COALESCE(notified_at, '-infinity'::timestamptz)
        ) = $1::timestamptz
        AND id::text > $2
    )
)
ORDER BY activity_at ASC, id::text ASC
LIMIT $3
`, cursorTime, cursorID, r.batchSize)
		if err != nil {
			return fmt.Errorf("query alert candidates: %w", err)
		}

		batchCount := 0
		for rows.Next() {
			var (
				alertID    string
				activityAt time.Time
			)
			if err := rows.Scan(&alertID, &activityAt); err != nil {
				rows.Close()
				return fmt.Errorf("scan alert candidate: %w", err)
			}
			if err := r.alertSyncer.SyncByID(ctx, alertID); err != nil {
				rows.Close()
				return fmt.Errorf("sync alert %s: %w", alertID, err)
			}
			cursorTime = activityAt.UTC()
			cursorID = strings.TrimSpace(alertID)
			processed++
			batchCount++
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return fmt.Errorf("iterate alert candidates: %w", err)
		}
		rows.Close()
		if batchCount == 0 {
			break
		}
	}
	r.lastAlertSweepCompletedAt = time.Now().UTC()
	if processed > 0 {
		log.Printf("operational es reconciler: synced alerts count=%d cutoff=%s", processed, cutoff.Format(time.RFC3339))
	}
	return nil
}

func (r *OperationalReconciler) syncAudit(ctx context.Context) error {
	cutoff := r.auditWindowStart(time.Now().UTC())
	cursorTime := cutoff
	cursorID := ""
	processed := 0
	for {
		rows, err := r.db.QueryContext(ctx, `
SELECT
    id::text,
    created_at
FROM audit_logs
WHERE (
    created_at > $1::timestamptz
    OR (created_at = $1::timestamptz AND id::text > $2)
)
ORDER BY created_at ASC, id::text ASC
LIMIT $3
`, cursorTime, cursorID, r.batchSize)
		if err != nil {
			return fmt.Errorf("query audit candidates: %w", err)
		}

		batchCount := 0
		for rows.Next() {
			var (
				auditID   string
				createdAt time.Time
			)
			if err := rows.Scan(&auditID, &createdAt); err != nil {
				rows.Close()
				return fmt.Errorf("scan audit candidate: %w", err)
			}
			if err := r.auditSyncer.SyncByID(ctx, auditID); err != nil {
				rows.Close()
				return fmt.Errorf("sync audit %s: %w", auditID, err)
			}
			cursorTime = createdAt.UTC()
			cursorID = strings.TrimSpace(auditID)
			processed++
			batchCount++
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return fmt.Errorf("iterate audit candidates: %w", err)
		}
		rows.Close()
		if batchCount == 0 {
			break
		}
	}
	r.lastAuditSweepCompletedAt = time.Now().UTC()
	if processed > 0 {
		log.Printf("operational es reconciler: synced audit logs count=%d cutoff=%s", processed, cutoff.Format(time.RFC3339))
	}
	return nil
}

func (r *OperationalReconciler) alertWindowStart(now time.Time) time.Time {
	if r == nil {
		return now.UTC().Add(-defaultOperationalReconcilerAlertLookback)
	}
	if r.lastAlertSweepCompletedAt.IsZero() {
		return now.UTC().Add(-r.alertStartupLookback)
	}
	return r.lastAlertSweepCompletedAt.UTC().Add(-r.alertOverlap)
}

func (r *OperationalReconciler) auditWindowStart(now time.Time) time.Time {
	if r == nil {
		return now.UTC().Add(-defaultOperationalReconcilerAuditLookback)
	}
	if r.lastAuditSweepCompletedAt.IsZero() {
		return now.UTC().Add(-r.auditStartupLookback)
	}
	return r.lastAuditSweepCompletedAt.UTC().Add(-r.auditOverlap)
}

func parseDurationFromEnv(key string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(raw)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func parsePositiveIntFromEnv(key string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

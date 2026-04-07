package esindex

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

const (
	defaultOperationalReconcilerInterval      = 10 * time.Minute
	defaultOperationalReconcilerBatchSize     = 200
	defaultOperationalReconcilerAlertLookback = 7 * 24 * time.Hour
	defaultOperationalReconcilerAlertOverlap  = 30 * time.Minute
	defaultOperationalReconcilerAuditLookback = 24 * time.Hour
	defaultOperationalReconcilerAuditOverlap  = 15 * time.Minute
)

var (
	operationalReconcilerEnabled = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "nexuslog_operational_reconciler_enabled",
			Help: "Whether the operational Elasticsearch reconciler is enabled.",
		},
	)
	operationalReconcilerRunsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "nexuslog_operational_reconciler_runs_total",
			Help: "Total number of operational Elasticsearch reconciler runs by result.",
		},
		[]string{"result"},
	)
	operationalReconcilerSyncedTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "nexuslog_operational_reconciler_synced_total",
			Help: "Total number of records synced by the operational Elasticsearch reconciler.",
		},
		[]string{"target"},
	)
	operationalReconcilerLastRunStartedAt = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "nexuslog_operational_reconciler_last_run_started_at_seconds",
			Help: "Unix timestamp when the operational Elasticsearch reconciler last started.",
		},
	)
	operationalReconcilerLastRunCompletedAt = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "nexuslog_operational_reconciler_last_run_completed_at_seconds",
			Help: "Unix timestamp when the operational Elasticsearch reconciler last completed.",
		},
	)
	operationalReconcilerLastSuccessAt = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "nexuslog_operational_reconciler_last_success_at_seconds",
			Help: "Unix timestamp when the operational Elasticsearch reconciler last completed successfully.",
		},
	)
	operationalReconcilerLastRunDurationMs = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "nexuslog_operational_reconciler_last_run_duration_milliseconds",
			Help: "Duration of the last operational Elasticsearch reconciler run in milliseconds.",
		},
	)
	operationalReconcilerLastRunSynced = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "nexuslog_operational_reconciler_last_run_synced",
			Help: "Number of records synced in the last operational Elasticsearch reconciler run.",
		},
		[]string{"target"},
	)
)

type OperationalReconcilerSnapshot struct {
	Enabled            bool
	Healthy            bool
	State              string
	Running            bool
	Interval           time.Duration
	BatchSize          int
	LastRunStartedAt   time.Time
	LastRunCompletedAt time.Time
	LastSuccessAt      time.Time
	LastError          string
	LastRunDuration    time.Duration
	LastRunAlertSynced int
	LastRunAuditSynced int
	TotalAlertSynced   int64
	TotalAuditSynced   int64
	SuccessfulRuns     int64
	FailedRuns         int64
}

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

	mu sync.RWMutex

	running                   bool
	lastAlertSweepCompletedAt time.Time
	lastAuditSweepCompletedAt time.Time
	lastRunStartedAt          time.Time
	lastRunCompletedAt        time.Time
	lastSuccessAt             time.Time
	lastError                 string
	lastRunDuration           time.Duration
	lastRunAlertSynced        int
	lastRunAuditSynced        int
	totalAlertSynced          int64
	totalAuditSynced          int64
	successfulRuns            int64
	failedRuns                int64
}

func NewOperationalReconcilerFromEnv(db *sql.DB) *OperationalReconciler {
	r := &OperationalReconciler{
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
	if r.Enabled() {
		operationalReconcilerEnabled.Set(1)
	} else {
		operationalReconcilerEnabled.Set(0)
	}
	return r
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

func (r *OperationalReconciler) Snapshot() OperationalReconcilerSnapshot {
	if r == nil {
		return OperationalReconcilerSnapshot{Enabled: false, Healthy: true, State: "disabled"}
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	snapshot := OperationalReconcilerSnapshot{
		Enabled:            r.Enabled(),
		Running:            r.running,
		Interval:           r.interval,
		BatchSize:          r.batchSize,
		LastRunStartedAt:   r.lastRunStartedAt,
		LastRunCompletedAt: r.lastRunCompletedAt,
		LastSuccessAt:      r.lastSuccessAt,
		LastError:          r.lastError,
		LastRunDuration:    r.lastRunDuration,
		LastRunAlertSynced: r.lastRunAlertSynced,
		LastRunAuditSynced: r.lastRunAuditSynced,
		TotalAlertSynced:   r.totalAlertSynced,
		TotalAuditSynced:   r.totalAuditSynced,
		SuccessfulRuns:     r.successfulRuns,
		FailedRuns:         r.failedRuns,
	}
	snapshot.State = deriveOperationalReconcilerState(snapshot)
	snapshot.Healthy = !snapshot.Enabled || snapshot.State == "healthy" || snapshot.State == "starting" || snapshot.State == "running"
	return snapshot
}

func deriveOperationalReconcilerState(snapshot OperationalReconcilerSnapshot) string {
	if !snapshot.Enabled {
		return "disabled"
	}
	if snapshot.Running {
		return "running"
	}
	if snapshot.LastRunStartedAt.IsZero() && snapshot.LastRunCompletedAt.IsZero() {
		return "starting"
	}
	if strings.TrimSpace(snapshot.LastError) != "" {
		return "degraded"
	}
	return "healthy"
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
	startedAt := time.Now().UTC()
	r.markRunStarted(startedAt)

	alertSynced := 0
	auditSynced := 0
	errors := make([]string, 0, 2)

	if r.alertSyncer != nil && r.alertSyncer.Enabled() {
		count, err := r.syncAlerts(ctx)
		alertSynced = count
		if err != nil {
			log.Printf("operational es reconciler: sync alerts failed: %v", err)
			errors = append(errors, err.Error())
		}
	}
	if r.auditSyncer != nil && r.auditSyncer.Enabled() {
		count, err := r.syncAudit(ctx)
		auditSynced = count
		if err != nil {
			log.Printf("operational es reconciler: sync audit failed: %v", err)
			errors = append(errors, err.Error())
		}
	}

	completedAt := time.Now().UTC()
	r.markRunFinished(completedAt, completedAt.Sub(startedAt), alertSynced, auditSynced, strings.Join(errors, "; "))
}

func (r *OperationalReconciler) markRunStarted(startedAt time.Time) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.running = true
	r.lastRunStartedAt = startedAt.UTC()
	operationalReconcilerLastRunStartedAt.Set(float64(r.lastRunStartedAt.Unix()))
}

func (r *OperationalReconciler) markRunFinished(completedAt time.Time, duration time.Duration, alertSynced, auditSynced int, lastError string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.running = false
	r.lastRunCompletedAt = completedAt.UTC()
	r.lastRunDuration = duration
	r.lastRunAlertSynced = alertSynced
	r.lastRunAuditSynced = auditSynced
	r.lastError = strings.TrimSpace(lastError)
	r.totalAlertSynced += int64(alertSynced)
	r.totalAuditSynced += int64(auditSynced)

	operationalReconcilerLastRunCompletedAt.Set(float64(r.lastRunCompletedAt.Unix()))
	operationalReconcilerLastRunDurationMs.Set(float64(duration.Milliseconds()))
	operationalReconcilerLastRunSynced.WithLabelValues("alerts").Set(float64(alertSynced))
	operationalReconcilerLastRunSynced.WithLabelValues("audit").Set(float64(auditSynced))
	if alertSynced > 0 {
		operationalReconcilerSyncedTotal.WithLabelValues("alerts").Add(float64(alertSynced))
	}
	if auditSynced > 0 {
		operationalReconcilerSyncedTotal.WithLabelValues("audit").Add(float64(auditSynced))
	}

	if r.lastError == "" {
		r.lastSuccessAt = r.lastRunCompletedAt
		r.successfulRuns++
		operationalReconcilerRunsTotal.WithLabelValues("success").Inc()
		operationalReconcilerLastSuccessAt.Set(float64(r.lastSuccessAt.Unix()))
		return
	}

	r.failedRuns++
	operationalReconcilerRunsTotal.WithLabelValues("failure").Inc()
}

func (r *OperationalReconciler) syncAlerts(ctx context.Context) (int, error) {
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
			return processed, fmt.Errorf("query alert candidates: %w", err)
		}

		batchCount := 0
		for rows.Next() {
			var (
				alertID    string
				activityAt time.Time
			)
			if err := rows.Scan(&alertID, &activityAt); err != nil {
				rows.Close()
				return processed, fmt.Errorf("scan alert candidate: %w", err)
			}
			if err := r.alertSyncer.SyncByID(ctx, alertID); err != nil {
				rows.Close()
				return processed, fmt.Errorf("sync alert %s: %w", alertID, err)
			}
			cursorTime = activityAt.UTC()
			cursorID = strings.TrimSpace(alertID)
			processed++
			batchCount++
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return processed, fmt.Errorf("iterate alert candidates: %w", err)
		}
		rows.Close()
		if batchCount == 0 {
			break
		}
	}
	r.setLastAlertSweepCompletedAt(time.Now().UTC())
	if processed > 0 {
		log.Printf("operational es reconciler: synced alerts count=%d cutoff=%s", processed, cutoff.Format(time.RFC3339))
	}
	return processed, nil
}

func (r *OperationalReconciler) syncAudit(ctx context.Context) (int, error) {
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
			return processed, fmt.Errorf("query audit candidates: %w", err)
		}

		batchCount := 0
		for rows.Next() {
			var (
				auditID   string
				createdAt time.Time
			)
			if err := rows.Scan(&auditID, &createdAt); err != nil {
				rows.Close()
				return processed, fmt.Errorf("scan audit candidate: %w", err)
			}
			if err := r.auditSyncer.SyncByID(ctx, auditID); err != nil {
				rows.Close()
				return processed, fmt.Errorf("sync audit %s: %w", auditID, err)
			}
			cursorTime = createdAt.UTC()
			cursorID = strings.TrimSpace(auditID)
			processed++
			batchCount++
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return processed, fmt.Errorf("iterate audit candidates: %w", err)
		}
		rows.Close()
		if batchCount == 0 {
			break
		}
	}
	r.setLastAuditSweepCompletedAt(time.Now().UTC())
	if processed > 0 {
		log.Printf("operational es reconciler: synced audit logs count=%d cutoff=%s", processed, cutoff.Format(time.RFC3339))
	}
	return processed, nil
}

func (r *OperationalReconciler) setLastAlertSweepCompletedAt(ts time.Time) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.lastAlertSweepCompletedAt = ts.UTC()
}

func (r *OperationalReconciler) setLastAuditSweepCompletedAt(ts time.Time) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.lastAuditSweepCompletedAt = ts.UTC()
}

func (r *OperationalReconciler) alertWindowStart(now time.Time) time.Time {
	if r == nil {
		return now.UTC().Add(-defaultOperationalReconcilerAlertLookback)
	}
	r.mu.RLock()
	lastCompleted := r.lastAlertSweepCompletedAt
	lookback := r.alertStartupLookback
	overlap := r.alertOverlap
	r.mu.RUnlock()
	if lastCompleted.IsZero() {
		return now.UTC().Add(-lookback)
	}
	return lastCompleted.UTC().Add(-overlap)
}

func (r *OperationalReconciler) auditWindowStart(now time.Time) time.Time {
	if r == nil {
		return now.UTC().Add(-defaultOperationalReconcilerAuditLookback)
	}
	r.mu.RLock()
	lastCompleted := r.lastAuditSweepCompletedAt
	lookback := r.auditStartupLookback
	overlap := r.auditOverlap
	r.mu.RUnlock()
	if lastCompleted.IsZero() {
		return now.UTC().Add(-lookback)
	}
	return lastCompleted.UTC().Add(-overlap)
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

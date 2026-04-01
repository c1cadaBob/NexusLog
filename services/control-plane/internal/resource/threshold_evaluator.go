package resource

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/nexuslog/control-plane/internal/metrics"
	"github.com/nexuslog/control-plane/internal/notification"
)

// ThresholdNotificationDispatcher dispatches threshold notifications through configured channels.
type ThresholdNotificationDispatcher interface {
	Dispatch(ctx context.Context, tenantID string, rawChannelIDs json.RawMessage, payload notification.DispatchPayload) (*notification.DispatchSummary, error)
}

// IncidentCreator auto-creates or links incidents from alert events.
type IncidentCreator interface {
	CreateFromAlert(ctx context.Context, tenantID, ruleID, resourceThresholdID, alertEventID, title, detail, severity string) error
}

// ThresholdEvaluator evaluates metrics against resource thresholds and creates alert_events.
type ThresholdEvaluator struct {
	thresholdRepo   *ThresholdRepository
	db              *sql.DB
	suppressor      *ThresholdSuppressor
	notifier        ThresholdNotificationDispatcher
	incidentCreator IncidentCreator
}

// ThresholdSuppressor prevents duplicate alerts for the same threshold within a cooldown window.
type ThresholdSuppressor struct {
	mu       map[string]time.Time
	cooldown time.Duration
}

// NewThresholdSuppressor creates a suppressor with the given cooldown.
func NewThresholdSuppressor(cooldown time.Duration) *ThresholdSuppressor {
	return &ThresholdSuppressor{
		mu:       make(map[string]time.Time),
		cooldown: cooldown,
	}
}

// ShouldSuppress returns true if we should suppress an alert for this threshold.
func (s *ThresholdSuppressor) ShouldSuppress(thresholdID string) bool {
	key := thresholdID
	if last, ok := s.mu[key]; ok && time.Since(last) < s.cooldown {
		return true
	}
	return false
}

// Record records that we fired an alert for this threshold.
func (s *ThresholdSuppressor) Record(thresholdID string) {
	s.mu[thresholdID] = time.Now()
}

// NewThresholdEvaluator creates a new evaluator.
func NewThresholdEvaluator(thresholdRepo *ThresholdRepository, db *sql.DB) *ThresholdEvaluator {
	return &ThresholdEvaluator{
		thresholdRepo: thresholdRepo,
		db:            db,
		suppressor:    NewThresholdSuppressor(5 * time.Minute),
	}
}

// WithNotifier sets the notification dispatcher used after threshold alerts are created.
func (e *ThresholdEvaluator) WithNotifier(notifier ThresholdNotificationDispatcher) *ThresholdEvaluator {
	e.notifier = notifier
	return e
}

// WithIncidentCreator sets the incident creator used after threshold alerts are created.
func (e *ThresholdEvaluator) WithIncidentCreator(creator IncidentCreator) *ThresholdEvaluator {
	e.incidentCreator = creator
	return e
}

// EvaluateMetrics checks thresholds against the reported metrics and creates alert_events when exceeded.
func (e *ThresholdEvaluator) EvaluateMetrics(ctx context.Context, tenantID, agentID string, m *metrics.SystemMetrics) error {
	thresholds, err := e.thresholdRepo.ListEnabledForAgent(ctx, tenantID, agentID)
	if err != nil {
		return err
	}
	for _, t := range thresholds {
		if e.suppressor.ShouldSuppress(t.ID) {
			continue
		}
		exceeded, currentVal := e.checkThreshold(&t, m)
		if exceeded {
			title := fmt.Sprintf("Resource threshold exceeded: %s %.2f%% (threshold: %s %.2f%%)", t.MetricName, currentVal, t.Comparison, t.ThresholdValue)
			detail := fmt.Sprintf("Agent %s: %s = %.2f%%, threshold %s %.2f%% (severity: %s)", agentID, t.MetricName, currentVal, t.Comparison, t.ThresholdValue, t.AlertSeverity)
			alertEventID, err := e.createAlertEvent(ctx, tenantID, agentID, &t, title, detail)
			if err != nil {
				return err
			}
			if e.notifier != nil {
				summary, dispatchErr := e.notifier.Dispatch(ctx, tenantID, t.NotificationChannels, notification.DispatchPayload{
					Title:               title,
					Detail:              detail,
					Severity:            t.AlertSeverity,
					FiredAt:             time.Now().UTC().Format(time.RFC3339),
					TenantID:            tenantID,
					ResourceThresholdID: t.ID,
					AgentID:             agentID,
					SourceID:            t.MetricName,
				})
				if dispatchErr != nil {
					log.Printf("resource threshold evaluator: dispatch notification failed for threshold %s: %v", t.ID, dispatchErr)
				}
				if summary != nil {
					if err := e.recordNotificationResult(ctx, alertEventID, map[string]any{"channel_dispatch": summary}); err != nil {
						log.Printf("resource threshold evaluator: persist notification result failed for event %s: %v", alertEventID, err)
					}
				}
			}
			if e.incidentCreator != nil {
				if err := e.incidentCreator.CreateFromAlert(ctx, tenantID, "", t.ID, alertEventID, title, detail, t.AlertSeverity); err != nil {
					log.Printf("resource threshold evaluator: auto-create incident failed for threshold %s: %v", t.ID, err)
				}
			}
			e.suppressor.Record(t.ID)
		}
	}
	return nil
}

func (e *ThresholdEvaluator) checkThreshold(t *ResourceThreshold, m *metrics.SystemMetrics) (exceeded bool, currentVal float64) {
	var val float64
	switch t.MetricName {
	case "cpu_usage_pct":
		val = m.CPUUsagePct
	case "memory_usage_pct":
		val = m.MemoryUsagePct
	case "disk_usage_pct":
		val = m.DiskUsagePct
	default:
		return false, 0
	}
	exceeded = e.compare(val, t.ThresholdValue, t.Comparison)
	return exceeded, val
}

func (e *ThresholdEvaluator) compare(val, threshold float64, op string) bool {
	switch strings.TrimSpace(op) {
	case ">":
		return val > threshold
	case ">=":
		return val >= threshold
	case "<":
		return val < threshold
	case "<=":
		return val <= threshold
	default:
		return val > threshold
	}
}

func (e *ThresholdEvaluator) createAlertEvent(ctx context.Context, tenantID, agentID string, t *ResourceThreshold, title, detail string) (string, error) {
	query := `
INSERT INTO alert_events (tenant_id, rule_id, resource_threshold_id, severity, title, detail, agent_id, source_id, status, fired_at)
VALUES ($1::uuid, NULL, $2::uuid, $3, $4, $5, $6, $7, 'firing', NOW())
RETURNING id::text
`
	var alertEventID string
	err := e.db.QueryRowContext(ctx, query,
		tenantID, t.ID, t.AlertSeverity, title, detail, agentID, t.MetricName,
	).Scan(&alertEventID)
	return alertEventID, err
}

func (e *ThresholdEvaluator) recordNotificationResult(ctx context.Context, alertEventID string, payload map[string]any) error {
	if e == nil || e.db == nil || strings.TrimSpace(alertEventID) == "" || payload == nil {
		return nil
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = e.db.ExecContext(ctx, `
UPDATE alert_events
SET notification_result = COALESCE(notification_result, '{}'::jsonb) || $2::jsonb
WHERE id = $1::uuid
`, alertEventID, raw)
	return err
}

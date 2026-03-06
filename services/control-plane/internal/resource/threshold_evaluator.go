package resource

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/nexuslog/control-plane/internal/metrics"
)

// ThresholdEvaluator evaluates metrics against resource thresholds and creates alert_events.
type ThresholdEvaluator struct {
	thresholdRepo *ThresholdRepository
	db            *sql.DB
	suppressor    *ThresholdSuppressor
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
			if err := e.createAlertEvent(ctx, tenantID, agentID, &t, currentVal); err != nil {
				return err
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

func (e *ThresholdEvaluator) createAlertEvent(ctx context.Context, tenantID, agentID string, t *ResourceThreshold, currentVal float64) error {
	title := fmt.Sprintf("Resource threshold exceeded: %s %.2f%% (threshold: %s %.2f%%)",
		t.MetricName, currentVal, t.Comparison, t.ThresholdValue)
	detail := fmt.Sprintf("Agent %s: %s = %.2f%%, threshold %s %.2f%% (severity: %s)",
		agentID, t.MetricName, currentVal, t.Comparison, t.ThresholdValue, t.AlertSeverity)

	query := `
INSERT INTO alert_events (tenant_id, rule_id, resource_threshold_id, severity, title, detail, agent_id, source_id, status, fired_at)
VALUES ($1::uuid, NULL, $2::uuid, $3, $4, $5, $6, $7, 'firing', NOW())
`
	_, err := e.db.ExecContext(ctx, query,
		tenantID, t.ID, t.AlertSeverity, title, detail, agentID, t.MetricName,
	)
	return err
}

package alert

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// IncidentCreatorPG creates incidents from eligible alerts using PostgreSQL.
type IncidentCreatorPG struct {
	db *sql.DB
}

type sqlExecutor interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

// NewIncidentCreator creates a new incident creator.
func NewIncidentCreator(db *sql.DB) *IncidentCreatorPG {
	return &IncidentCreatorPG{db: db}
}

// CreateFromAlert auto-creates or links an incident for critical alerts.
//
// Current product policy keeps automatic incident creation scoped to critical alerts only.
// When an open incident already exists for the same rule or resource threshold, the new alert
// event will be linked to that incident instead of creating a duplicate incident.
func (ic *IncidentCreatorPG) CreateFromAlert(ctx context.Context, tenantID, ruleID, resourceThresholdID, alertEventID, title, detail, severity string) error {
	if ic == nil || ic.db == nil {
		return fmt.Errorf("incident creator is not configured")
	}
	if !shouldAutoCreateIncident(severity) {
		return nil
	}

	tenantID = strings.TrimSpace(tenantID)
	ruleID = strings.TrimSpace(ruleID)
	resourceThresholdID = strings.TrimSpace(resourceThresholdID)
	alertEventID = strings.TrimSpace(alertEventID)
	if tenantID == "" || alertEventID == "" {
		return fmt.Errorf("tenant_id and alert_event_id are required")
	}
	if ruleID == "" && resourceThresholdID == "" {
		return fmt.Errorf("rule_id or resource_threshold_id is required")
	}

	existingIncidentID, err := ic.findOpenIncidentID(ctx, tenantID, ruleID, resourceThresholdID)
	if err != nil {
		return err
	}
	if existingIncidentID != "" {
		return ic.persistIncidentLink(ctx, ic.db, alertEventID, existingIncidentID, false)
	}

	tx, err := ic.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin create incident tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	incidentSeverity := mapAlertSeverityToIncidentSeverity(severity)
	insertIncidentQuery := `
INSERT INTO incidents (tenant_id, title, description, severity, status, source_alert_id, created_at, updated_at)
VALUES ($1::uuid, $2, NULLIF(TRIM($3), ''), $4, 'open', $5::uuid, NOW(), NOW())
RETURNING id::text
`
	var incidentID string
	if err := tx.QueryRowContext(ctx, insertIncidentQuery, tenantID, title, detail, incidentSeverity, alertEventID).Scan(&incidentID); err != nil {
		return fmt.Errorf("create incident: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
INSERT INTO incident_timeline (incident_id, action, detail, created_at)
VALUES ($1::uuid, 'created', $2, NOW())
`, incidentID, buildIncidentCreationDetail(alertEventID, title)); err != nil {
		return fmt.Errorf("create incident timeline: %w", err)
	}

	if err := ic.persistIncidentLink(ctx, tx, alertEventID, incidentID, true); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit create incident: %w", err)
	}
	return nil
}

func (ic *IncidentCreatorPG) findOpenIncidentID(ctx context.Context, tenantID, ruleID, resourceThresholdID string) (string, error) {
	conditions := make([]string, 0, 2)
	args := []any{tenantID}
	if ruleID != "" {
		args = append(args, ruleID)
		conditions = append(conditions, fmt.Sprintf("ae.rule_id = $%d::uuid", len(args)))
	}
	if resourceThresholdID != "" {
		args = append(args, resourceThresholdID)
		conditions = append(conditions, fmt.Sprintf("ae.resource_threshold_id = $%d::uuid", len(args)))
	}
	if len(conditions) == 0 {
		return "", nil
	}

	query := fmt.Sprintf(`
SELECT i.id::text
FROM incidents i
JOIN alert_events ae ON ae.id = i.source_alert_id
WHERE i.tenant_id = $1::uuid
  AND i.status IN ('open', 'acknowledged', 'investigating')
  AND (%s)
ORDER BY i.created_at DESC
LIMIT 1
`, strings.Join(conditions, " OR "))

	var incidentID string
	err := ic.db.QueryRowContext(ctx, query, args...).Scan(&incidentID)
	if err == nil {
		return incidentID, nil
	}
	if err == sql.ErrNoRows {
		return "", nil
	}
	return "", fmt.Errorf("check open incident: %w", err)
}

func (ic *IncidentCreatorPG) persistIncidentLink(ctx context.Context, execer sqlExecutor, alertEventID, incidentID string, autoCreated bool) error {
	payload, err := json.Marshal(map[string]any{
		"incident_link": map[string]any{
			"incident_id":  incidentID,
			"auto_created": autoCreated,
			"linked_at":    time.Now().UTC().Format(time.RFC3339),
		},
	})
	if err != nil {
		return fmt.Errorf("marshal incident link: %w", err)
	}
	if _, err := execer.ExecContext(ctx, `
UPDATE alert_events
SET notification_result = COALESCE(notification_result, '{}'::jsonb) || $2::jsonb
WHERE id = $1::uuid
`, alertEventID, payload); err != nil {
		return fmt.Errorf("persist incident link: %w", err)
	}
	return nil
}

func shouldAutoCreateIncident(severity string) bool {
	return strings.EqualFold(strings.TrimSpace(severity), "critical")
}

func mapAlertSeverityToIncidentSeverity(severity string) string {
	switch strings.ToLower(strings.TrimSpace(severity)) {
	case "critical":
		return "critical"
	case "high":
		return "major"
	default:
		return "minor"
	}
}

func buildIncidentCreationDetail(alertEventID, title string) string {
	trimmedTitle := strings.TrimSpace(title)
	if trimmedTitle == "" {
		return fmt.Sprintf("Auto-created from alert event %s", alertEventID)
	}
	return fmt.Sprintf("Auto-created from alert event %s: %s", alertEventID, trimmedTitle)
}

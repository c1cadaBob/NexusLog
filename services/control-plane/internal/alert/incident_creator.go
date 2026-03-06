package alert

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

// IncidentCreatorPG creates incidents from critical alerts using PostgreSQL.
type IncidentCreatorPG struct {
	db *sql.DB
}

// NewIncidentCreator creates a new incident creator.
func NewIncidentCreator(db *sql.DB) *IncidentCreatorPG {
	return &IncidentCreatorPG{db: db}
}

// CreateFromAlert creates an incident if severity is critical and no open incident exists for the rule.
// Skips if severity is not "critical" or "CRITICAL".
// Skips if an open incident already exists for the same rule_id (via source_alert_id -> alert_events.rule_id).
func (ic *IncidentCreatorPG) CreateFromAlert(ctx context.Context, tenantID, ruleID, alertEventID, title, detail, severity string) error {
	sev := strings.ToUpper(strings.TrimSpace(severity))
	if sev != "CRITICAL" {
		return nil // only auto-create for critical
	}

	tenantID = strings.TrimSpace(tenantID)
	ruleID = strings.TrimSpace(ruleID)
	alertEventID = strings.TrimSpace(alertEventID)
	if tenantID == "" || ruleID == "" || alertEventID == "" {
		return fmt.Errorf("tenant_id, rule_id, and alert_event_id are required")
	}

	// Check if open incident exists for same rule_id (via any alert_event with that rule_id linked to an incident)
	checkQuery := `
SELECT 1 FROM incidents i
JOIN alert_events ae ON ae.id = i.source_alert_id
WHERE ae.rule_id = $1::uuid
  AND i.tenant_id = $2::uuid
  AND i.status IN ('open', 'acknowledged', 'investigating')
LIMIT 1
`
	var exists int
	err := ic.db.QueryRowContext(ctx, checkQuery, ruleID, tenantID).Scan(&exists)
	if err == nil {
		return nil // open incident exists, skip
	}
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("check open incident: %w", err)
	}
	// err == sql.ErrNoRows: no open incident, proceed to create

	// Create incident with source_alert_id set
	insertQuery := `
INSERT INTO incidents (tenant_id, title, description, severity, status, source_alert_id, created_at, updated_at)
VALUES ($1::uuid, $2, NULLIF(TRIM($3), ''), 'critical', 'open', $4::uuid, NOW(), NOW())
`
	_, err = ic.db.ExecContext(ctx, insertQuery, tenantID, title, detail, alertEventID)
	if err != nil {
		return fmt.Errorf("create incident: %w", err)
	}
	return nil
}

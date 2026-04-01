package alert

import (
	"context"
	"database/sql"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestIncidentCreatorPG_CreateFromAlert_CreatesIncidentAndLink(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	creator := NewIncidentCreator(db)
	ctx := context.Background()
	tenantID := "10000000-0000-0000-0000-000000000001"
	ruleID := "20000000-0000-0000-0000-000000000001"
	alertEventID := "30000000-0000-0000-0000-000000000001"
	incidentID := "40000000-0000-0000-0000-000000000001"
	title := "Critical CPU Alert"
	detail := "cpu usage exceeds threshold"

	mock.ExpectQuery(regexp.QuoteMeta(`
SELECT i.id::text
FROM incidents i
JOIN alert_events ae ON ae.id = i.source_alert_id
WHERE i.tenant_id = $1::uuid
  AND i.status IN ('open', 'acknowledged', 'investigating')
  AND (ae.rule_id = $2::uuid)
ORDER BY i.created_at DESC
LIMIT 1
`)).
		WithArgs(tenantID, ruleID).
		WillReturnError(sql.ErrNoRows)

	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta(`
INSERT INTO incidents (tenant_id, title, description, severity, status, source_alert_id, created_at, updated_at)
VALUES ($1::uuid, $2, NULLIF(TRIM($3), ''), $4, 'open', $5::uuid, NOW(), NOW())
RETURNING id::text
`)).
		WithArgs(tenantID, title, detail, "critical", alertEventID).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(incidentID))
	mock.ExpectExec(regexp.QuoteMeta(`
INSERT INTO incident_timeline (incident_id, action, detail, created_at)
VALUES ($1::uuid, 'created', $2, NOW())
`)).
		WithArgs(incidentID, buildIncidentCreationDetail(alertEventID, title)).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec(regexp.QuoteMeta(`
UPDATE alert_events
SET notification_result = COALESCE(notification_result, '{}'::jsonb) || $2::jsonb
WHERE id = $1::uuid
`)).
		WithArgs(alertEventID, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	if err := creator.CreateFromAlert(ctx, tenantID, ruleID, "", alertEventID, title, detail, "critical"); err != nil {
		t.Fatalf("CreateFromAlert: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestIncidentCreatorPG_CreateFromAlert_LinksExistingIncident(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	creator := NewIncidentCreator(db)
	ctx := context.Background()
	tenantID := "10000000-0000-0000-0000-000000000001"
	resourceThresholdID := "20000000-0000-0000-0000-000000000001"
	alertEventID := "30000000-0000-0000-0000-000000000001"
	incidentID := "40000000-0000-0000-0000-000000000001"

	mock.ExpectQuery(regexp.QuoteMeta(`
SELECT i.id::text
FROM incidents i
JOIN alert_events ae ON ae.id = i.source_alert_id
WHERE i.tenant_id = $1::uuid
  AND i.status IN ('open', 'acknowledged', 'investigating')
  AND (ae.resource_threshold_id = $2::uuid)
ORDER BY i.created_at DESC
LIMIT 1
`)).
		WithArgs(tenantID, resourceThresholdID).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(incidentID))
	mock.ExpectExec(regexp.QuoteMeta(`
UPDATE alert_events
SET notification_result = COALESCE(notification_result, '{}'::jsonb) || $2::jsonb
WHERE id = $1::uuid
`)).
		WithArgs(alertEventID, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	if err := creator.CreateFromAlert(ctx, tenantID, "", resourceThresholdID, alertEventID, "Resource threshold exceeded", "detail", "critical"); err != nil {
		t.Fatalf("CreateFromAlert: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

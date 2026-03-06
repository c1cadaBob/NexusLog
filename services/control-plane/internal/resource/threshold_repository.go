package resource

import (
	"context"
	"database/sql"
	"strconv"
)

// ResourceThreshold represents a resource threshold configuration.
type ResourceThreshold struct {
	ID              string  `json:"id"`
	TenantID        string  `json:"tenant_id"`
	AgentID         *string `json:"agent_id,omitempty"`
	MetricName      string  `json:"metric_name"`
	ThresholdValue  float64 `json:"threshold_value"`
	Comparison      string  `json:"comparison"`
	AlertSeverity   string  `json:"alert_severity"`
	Enabled         bool    `json:"enabled"`
	CreatedBy       *string `json:"created_by,omitempty"`
	CreatedAt       string  `json:"created_at"`
	UpdatedAt       string  `json:"updated_at"`
	NotificationChannels []byte `json:"notification_channels,omitempty"`
}

// ThresholdRepository provides CRUD for resource_thresholds.
type ThresholdRepository struct {
	db *sql.DB
}

// NewThresholdRepository creates a new threshold repository.
func NewThresholdRepository(db *sql.DB) *ThresholdRepository {
	return &ThresholdRepository{db: db}
}

// List returns thresholds for a tenant, optionally filtered by agent_id.
func (r *ThresholdRepository) List(ctx context.Context, tenantID, agentID string, page, pageSize int) ([]ResourceThreshold, int, error) {
	countQuery := `SELECT COUNT(1) FROM resource_thresholds WHERE tenant_id = $1::uuid`
	countArgs := []interface{}{tenantID}
	if agentID != "" {
		countQuery += ` AND (agent_id IS NULL OR agent_id = $2)`
		countArgs = append(countArgs, agentID)
	}
	var total int
	if err := r.db.QueryRowContext(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
SELECT id, tenant_id, agent_id, metric_name, threshold_value, comparison, alert_severity, enabled,
	created_by, created_at, updated_at, COALESCE(notification_channels, '[]'::jsonb)
FROM resource_thresholds
WHERE tenant_id = $1::uuid
`
	args := []interface{}{tenantID}
	if agentID != "" {
		query += ` AND (agent_id IS NULL OR agent_id = $2)`
		args = append(args, agentID)
	}
	query += ` ORDER BY created_at DESC LIMIT $` + strconv.Itoa(len(args)+1) + ` OFFSET $` + strconv.Itoa(len(args)+2)
	args = append(args, pageSize, (page-1)*pageSize)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []ResourceThreshold
	for rows.Next() {
		var t ResourceThreshold
		var agentIDVal sql.NullString
		var createdBy sql.NullString
		err := rows.Scan(&t.ID, &t.TenantID, &agentIDVal, &t.MetricName, &t.ThresholdValue, &t.Comparison,
			&t.AlertSeverity, &t.Enabled, &createdBy, &t.CreatedAt, &t.UpdatedAt, &t.NotificationChannels)
		if err != nil {
			return nil, 0, err
		}
		if agentIDVal.Valid {
			t.AgentID = &agentIDVal.String
		}
		if createdBy.Valid {
			t.CreatedBy = &createdBy.String
		}
		list = append(list, t)
	}
	return list, total, rows.Err()
}

// Get returns a single threshold by ID.
func (r *ThresholdRepository) Get(ctx context.Context, tenantID, id string) (*ResourceThreshold, error) {
	query := `
SELECT id, tenant_id, agent_id, metric_name, threshold_value, comparison, alert_severity, enabled,
	created_by, created_at, updated_at, COALESCE(notification_channels, '[]'::jsonb)
FROM resource_thresholds WHERE id = $1::uuid AND tenant_id = $2::uuid
`
	var t ResourceThreshold
	var agentIDVal, createdBy sql.NullString
	err := r.db.QueryRowContext(ctx, query, id, tenantID).Scan(
		&t.ID, &t.TenantID, &agentIDVal, &t.MetricName, &t.ThresholdValue, &t.Comparison,
		&t.AlertSeverity, &t.Enabled, &createdBy, &t.CreatedAt, &t.UpdatedAt, &t.NotificationChannels)
	if err == sql.ErrNoRows {
		return nil, ErrThresholdNotFound
	}
	if err != nil {
		return nil, err
	}
	if agentIDVal.Valid {
		t.AgentID = &agentIDVal.String
	}
	if createdBy.Valid {
		t.CreatedBy = &createdBy.String
	}
	return &t, nil
}

// Create inserts a new threshold.
func (r *ThresholdRepository) Create(ctx context.Context, t *ResourceThreshold) error {
	query := `
INSERT INTO resource_thresholds (tenant_id, agent_id, metric_name, threshold_value, comparison, alert_severity, enabled, created_by, notification_channels)
VALUES ($1::uuid, NULLIF($2,''), $3, $4, $5, $6, $7, NULLIF($8,'')::uuid, COALESCE($9::jsonb, '[]'::jsonb))
RETURNING id, created_at, updated_at
`
	var agentID, createdBy string
	if t.AgentID != nil {
		agentID = *t.AgentID
	}
	if t.CreatedBy != nil {
		createdBy = *t.CreatedBy
	}
	notifCh := []byte("[]")
	if len(t.NotificationChannels) > 0 {
		notifCh = t.NotificationChannels
	}
	return r.db.QueryRowContext(ctx, query,
		t.TenantID, agentID, t.MetricName, t.ThresholdValue, t.Comparison, t.AlertSeverity, t.Enabled, createdBy, notifCh,
	).Scan(&t.ID, &t.CreatedAt, &t.UpdatedAt)
}

// UpdateInput contains optional fields for updating a threshold.
type UpdateInput struct {
	AgentID              *string
	MetricName           *string
	ThresholdValue       *float64
	Comparison           *string
	AlertSeverity        *string
	Enabled              *bool
	NotificationChannels []byte
}

// Update updates an existing threshold.
func (r *ThresholdRepository) Update(ctx context.Context, tenantID, id string, in *UpdateInput) error {
	query := `
UPDATE resource_thresholds SET
	agent_id = COALESCE($2, agent_id),
	metric_name = COALESCE($3, metric_name),
	threshold_value = COALESCE($4, threshold_value),
	comparison = COALESCE($5, comparison),
	alert_severity = COALESCE($6, alert_severity),
	enabled = COALESCE($7, enabled),
	notification_channels = COALESCE($8::jsonb, notification_channels),
	updated_at = now()
WHERE id = $1::uuid AND tenant_id = $9::uuid
`
	_, err := r.db.ExecContext(ctx, query,
		id, in.AgentID, in.MetricName, in.ThresholdValue, in.Comparison, in.AlertSeverity, in.Enabled,
		in.NotificationChannels, tenantID,
	)
	return err
}

// Delete removes a threshold.
func (r *ThresholdRepository) Delete(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM resource_thresholds WHERE id = $1::uuid AND tenant_id = $2::uuid`, id, tenantID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return ErrThresholdNotFound
	}
	return nil
}

// ListEnabledForAgent returns all enabled thresholds that apply to an agent (tenant-wide or agent-specific).
func (r *ThresholdRepository) ListEnabledForAgent(ctx context.Context, tenantID, agentID string) ([]ResourceThreshold, error) {
	query := `
SELECT id, tenant_id, agent_id, metric_name, threshold_value, comparison, alert_severity, enabled,
	created_by, created_at, updated_at, COALESCE(notification_channels, '[]'::jsonb)
FROM resource_thresholds
WHERE tenant_id = $1::uuid AND enabled = true AND (agent_id IS NULL OR agent_id = $2)
`
	rows, err := r.db.QueryContext(ctx, query, tenantID, agentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []ResourceThreshold
	for rows.Next() {
		var t ResourceThreshold
		var agentIDVal, createdBy sql.NullString
		err := rows.Scan(&t.ID, &t.TenantID, &agentIDVal, &t.MetricName, &t.ThresholdValue, &t.Comparison,
			&t.AlertSeverity, &t.Enabled, &createdBy, &t.CreatedAt, &t.UpdatedAt, &t.NotificationChannels)
		if err != nil {
			return nil, err
		}
		if agentIDVal.Valid {
			t.AgentID = &agentIDVal.String
		}
		if createdBy.Valid {
			t.CreatedBy = &createdBy.String
		}
		list = append(list, t)
	}
	return list, rows.Err()
}

func ptrStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

var ErrThresholdNotFound = &NotFoundError{}

type NotFoundError struct{}

func (e *NotFoundError) Error() string {
	return "resource threshold not found"
}

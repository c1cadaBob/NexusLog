package incident

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

var (
	// ErrIncidentNotFound indicates the incident was not found.
	ErrIncidentNotFound = errors.New("incident not found")
)

// IncidentFilters holds optional filters for listing incidents.
type IncidentFilters struct {
	Status   string // open, acknowledged, investigating, resolved, closed
	Severity string // critical, major, minor
	Query    string // id, title, description, assignee, source alert, root cause, resolution, verdict
}

// Incident represents an incident entity.
type Incident struct {
	ID                 string     `json:"id"`
	TenantID           string     `json:"tenant_id"`
	Title              string     `json:"title"`
	Description        string     `json:"description"`
	Severity           string     `json:"severity"`
	Status             string     `json:"status"`
	SourceAlertID      *string    `json:"source_alert_id,omitempty"`
	AssignedTo         *string    `json:"assigned_to,omitempty"`
	CreatedBy          *string    `json:"created_by,omitempty"`
	AcknowledgedAt     *time.Time `json:"acknowledged_at,omitempty"`
	ResolvedAt         *time.Time `json:"resolved_at,omitempty"`
	ClosedAt           *time.Time `json:"closed_at,omitempty"`
	RootCause          *string    `json:"root_cause,omitempty"`
	Resolution         *string    `json:"resolution,omitempty"`
	Verdict            *string    `json:"verdict,omitempty"`
	SLAResponseMinutes *int       `json:"sla_response_minutes,omitempty"`
	SLAResolveMinutes  *int       `json:"sla_resolve_minutes,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

// IncidentUpdate holds partial update fields.
type IncidentUpdate struct {
	Title              *string `json:"title,omitempty"`
	Description        *string `json:"description,omitempty"`
	Severity           *string `json:"severity,omitempty"`
	AssignedTo         *string `json:"assigned_to,omitempty"`
	RootCause          *string `json:"root_cause,omitempty"`
	Resolution         *string `json:"resolution,omitempty"`
	SLAResponseMinutes *int    `json:"sla_response_minutes,omitempty"`
	SLAResolveMinutes  *int    `json:"sla_resolve_minutes,omitempty"`
}

// StatusUpdate holds status transition fields.
type StatusUpdate struct {
	Status         string
	AcknowledgedAt *time.Time
	ResolvedAt     *time.Time
	ClosedAt       *time.Time
	Resolution     *string
}

// Repository defines the interface for incident persistence.
type Repository interface {
	ListIncidents(ctx context.Context, tenantID string, page, pageSize int, filters *IncidentFilters) ([]Incident, int, error)
	GetIncident(ctx context.Context, tenantID, incidentID string) (*Incident, error)
	CreateIncident(ctx context.Context, inc *Incident) (string, error)
	UpdateIncident(ctx context.Context, tenantID, incidentID string, update *IncidentUpdate) error
	UpdateIncidentStatus(ctx context.Context, tenantID, incidentID string, upd *StatusUpdate) error
	ArchiveIncident(ctx context.Context, tenantID, incidentID string, verdict string) error
	DeleteIncident(ctx context.Context, tenantID, incidentID string) error
	GetSLASummary(ctx context.Context, tenantID string) (*SLASummary, error)
}

// RepositoryPG implements Repository using PostgreSQL.
type RepositoryPG struct {
	db *sql.DB
}

// NewRepositoryPG creates a new PostgreSQL-backed incident repository.
func NewRepositoryPG(db *sql.DB) *RepositoryPG {
	return &RepositoryPG{db: db}
}

// ListIncidents returns paginated incidents for a tenant with optional filters.
func (r *RepositoryPG) ListIncidents(ctx context.Context, tenantID string, page, pageSize int, filters *IncidentFilters) ([]Incident, int, error) {
	tenantID = strings.TrimSpace(tenantID)
	if tenantID == "" {
		return nil, 0, fmt.Errorf("tenant_id is required")
	}

	where := []string{"tenant_id = $1::uuid"}
	args := []interface{}{tenantID}
	argIdx := 2

	if filters != nil {
		if s := strings.TrimSpace(filters.Status); s != "" {
			where = append(where, fmt.Sprintf("status = $%d", argIdx))
			args = append(args, s)
			argIdx++
		}
		if s := strings.TrimSpace(filters.Severity); s != "" {
			where = append(where, fmt.Sprintf("severity = $%d", argIdx))
			args = append(args, s)
			argIdx++
		}
		if q := strings.ToLower(strings.TrimSpace(filters.Query)); q != "" {
			where = append(where, fmt.Sprintf(`(
				LOWER(id::text) LIKE $%d OR
				LOWER(title) LIKE $%d OR
				LOWER(COALESCE(description, '')) LIKE $%d OR
				LOWER(COALESCE(source_alert_id::text, '')) LIKE $%d OR
				LOWER(COALESCE(assigned_to::text, '')) LIKE $%d OR
				LOWER(COALESCE(root_cause, '')) LIKE $%d OR
				LOWER(COALESCE(resolution, '')) LIKE $%d OR
				LOWER(COALESCE(verdict, '')) LIKE $%d
			)`, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx))
			args = append(args, "%"+q+"%")
			argIdx++
		}
	}

	whereClause := strings.Join(where, " AND ")

	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(1) FROM incidents WHERE %s", whereClause)
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count incidents: %w", err)
	}

	offset := (page - 1) * pageSize
	args = append(args, offset, pageSize)
	query := fmt.Sprintf(`
SELECT
    id::text,
    tenant_id::text,
    title,
    COALESCE(description, ''),
    severity,
    status,
    source_alert_id::text,
    assigned_to::text,
    created_by::text,
    acknowledged_at,
    resolved_at,
    closed_at,
    root_cause,
    resolution,
    verdict,
    sla_response_minutes,
    sla_resolve_minutes,
    created_at,
    updated_at
FROM incidents
WHERE %s
ORDER BY created_at DESC
OFFSET $%d
LIMIT $%d
`, whereClause, argIdx, argIdx+1)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list incidents: %w", err)
	}
	defer rows.Close()

	items := make([]Incident, 0, pageSize)
	for rows.Next() {
		var inc Incident
		var sourceAlertID, assignedTo, createdBy sql.NullString
		var rootCause, resolution, verdict sql.NullString
		var acknowledgedAt, resolvedAt, closedAt sql.NullTime
		var slaResp, slaRes sql.NullInt64

		if err := rows.Scan(
			&inc.ID,
			&inc.TenantID,
			&inc.Title,
			&inc.Description,
			&inc.Severity,
			&inc.Status,
			&sourceAlertID,
			&assignedTo,
			&createdBy,
			&acknowledgedAt,
			&resolvedAt,
			&closedAt,
			&rootCause,
			&resolution,
			&verdict,
			&slaResp,
			&slaRes,
			&inc.CreatedAt,
			&inc.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan incident: %w", err)
		}
		if sourceAlertID.Valid {
			inc.SourceAlertID = &sourceAlertID.String
		}
		if assignedTo.Valid {
			inc.AssignedTo = &assignedTo.String
		}
		if createdBy.Valid {
			inc.CreatedBy = &createdBy.String
		}
		if acknowledgedAt.Valid {
			t := acknowledgedAt.Time.UTC()
			inc.AcknowledgedAt = &t
		}
		if resolvedAt.Valid {
			t := resolvedAt.Time.UTC()
			inc.ResolvedAt = &t
		}
		if closedAt.Valid {
			t := closedAt.Time.UTC()
			inc.ClosedAt = &t
		}
		if rootCause.Valid {
			inc.RootCause = &rootCause.String
		}
		if resolution.Valid {
			inc.Resolution = &resolution.String
		}
		if verdict.Valid {
			inc.Verdict = &verdict.String
		}
		if slaResp.Valid {
			m := int(slaResp.Int64)
			inc.SLAResponseMinutes = &m
		}
		if slaRes.Valid {
			m := int(slaRes.Int64)
			inc.SLAResolveMinutes = &m
		}
		inc.CreatedAt = inc.CreatedAt.UTC()
		inc.UpdatedAt = inc.UpdatedAt.UTC()
		items = append(items, inc)
	}
	return items, total, nil
}

// GetIncident returns a single incident by ID.
func (r *RepositoryPG) GetIncident(ctx context.Context, tenantID, incidentID string) (*Incident, error) {
	tenantID = strings.TrimSpace(tenantID)
	incidentID = strings.TrimSpace(incidentID)
	if tenantID == "" || incidentID == "" {
		return nil, ErrIncidentNotFound
	}

	query := `
SELECT
    id::text,
    tenant_id::text,
    title,
    COALESCE(description, ''),
    severity,
    status,
    source_alert_id::text,
    assigned_to::text,
    created_by::text,
    acknowledged_at,
    resolved_at,
    closed_at,
    root_cause,
    resolution,
    verdict,
    sla_response_minutes,
    sla_resolve_minutes,
    created_at,
    updated_at
FROM incidents
WHERE tenant_id = $1::uuid AND id = $2::uuid
`
	var inc Incident
	var sourceAlertID, assignedTo, createdBy sql.NullString
	var rootCause, resolution, verdict sql.NullString
	var acknowledgedAt, resolvedAt, closedAt sql.NullTime
	var slaResp, slaRes sql.NullInt64

	err := r.db.QueryRowContext(ctx, query, tenantID, incidentID).Scan(
		&inc.ID,
		&inc.TenantID,
		&inc.Title,
		&inc.Description,
		&inc.Severity,
		&inc.Status,
		&sourceAlertID,
		&assignedTo,
		&createdBy,
		&acknowledgedAt,
		&resolvedAt,
		&closedAt,
		&rootCause,
		&resolution,
		&verdict,
		&slaResp,
		&slaRes,
		&inc.CreatedAt,
		&inc.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrIncidentNotFound
		}
		return nil, fmt.Errorf("get incident: %w", err)
	}
	if sourceAlertID.Valid {
		inc.SourceAlertID = &sourceAlertID.String
	}
	if assignedTo.Valid {
		inc.AssignedTo = &assignedTo.String
	}
	if createdBy.Valid {
		inc.CreatedBy = &createdBy.String
	}
	if acknowledgedAt.Valid {
		t := acknowledgedAt.Time.UTC()
		inc.AcknowledgedAt = &t
	}
	if resolvedAt.Valid {
		t := resolvedAt.Time.UTC()
		inc.ResolvedAt = &t
	}
	if closedAt.Valid {
		t := closedAt.Time.UTC()
		inc.ClosedAt = &t
	}
	if rootCause.Valid {
		inc.RootCause = &rootCause.String
	}
	if resolution.Valid {
		inc.Resolution = &resolution.String
	}
	if verdict.Valid {
		inc.Verdict = &verdict.String
	}
	if slaResp.Valid {
		m := int(slaResp.Int64)
		inc.SLAResponseMinutes = &m
	}
	if slaRes.Valid {
		m := int(slaRes.Int64)
		inc.SLAResolveMinutes = &m
	}
	inc.CreatedAt = inc.CreatedAt.UTC()
	inc.UpdatedAt = inc.UpdatedAt.UTC()
	return &inc, nil
}

// CreateIncident inserts a new incident and returns its ID.
func (r *RepositoryPG) CreateIncident(ctx context.Context, inc *Incident) (string, error) {
	if inc == nil {
		return "", fmt.Errorf("incident is required")
	}
	tenantID := strings.TrimSpace(inc.TenantID)
	if tenantID == "" {
		return "", fmt.Errorf("tenant_id is required")
	}
	if strings.TrimSpace(inc.Title) == "" {
		return "", fmt.Errorf("title is required")
	}
	if strings.TrimSpace(inc.Severity) == "" {
		return "", fmt.Errorf("severity is required")
	}

	query := `
INSERT INTO incidents (
    tenant_id,
    title,
    description,
    severity,
    status,
    source_alert_id,
    assigned_to,
    created_by,
    sla_response_minutes,
    sla_resolve_minutes,
    created_at,
    updated_at
) VALUES (
    $1::uuid,
    $2,
    NULLIF(TRIM($3), ''),
    $4,
    COALESCE(NULLIF(TRIM($5), ''), 'open'),
    NULLIF(TRIM($6), '')::uuid,
    NULLIF(TRIM($7), '')::uuid,
    NULLIF(TRIM($8), '')::uuid,
    $9,
    $10,
    NOW(),
    NOW()
)
RETURNING id::text
`
	var sourceAlertID, assignedTo, createdBy interface{}
	if inc.SourceAlertID != nil && *inc.SourceAlertID != "" {
		sourceAlertID = *inc.SourceAlertID
	} else {
		sourceAlertID = nil
	}
	if inc.AssignedTo != nil && *inc.AssignedTo != "" {
		assignedTo = *inc.AssignedTo
	} else {
		assignedTo = nil
	}
	if inc.CreatedBy != nil && *inc.CreatedBy != "" {
		createdBy = *inc.CreatedBy
	} else {
		createdBy = nil
	}
	var slaResp, slaRes interface{}
	if inc.SLAResponseMinutes != nil {
		slaResp = *inc.SLAResponseMinutes
	} else {
		slaResp = nil
	}
	if inc.SLAResolveMinutes != nil {
		slaRes = *inc.SLAResolveMinutes
	} else {
		slaRes = nil
	}

	status := inc.Status
	if status == "" {
		status = "open"
	}

	var id string
	err := r.db.QueryRowContext(ctx, query,
		tenantID,
		inc.Title,
		inc.Description,
		inc.Severity,
		status,
		sourceAlertID,
		assignedTo,
		createdBy,
		slaResp,
		slaRes,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("create incident: %w", err)
	}
	return id, nil
}

// UpdateIncident updates an existing incident.
func (r *RepositoryPG) UpdateIncident(ctx context.Context, tenantID, incidentID string, update *IncidentUpdate) error {
	tenantID = strings.TrimSpace(tenantID)
	incidentID = strings.TrimSpace(incidentID)
	if tenantID == "" || incidentID == "" {
		return ErrIncidentNotFound
	}
	if update == nil {
		return fmt.Errorf("update is required")
	}

	sets := []string{}
	args := []interface{}{tenantID, incidentID}
	argIdx := 3

	if update.Title != nil {
		sets = append(sets, fmt.Sprintf("title = $%d", argIdx))
		args = append(args, *update.Title)
		argIdx++
	}
	if update.Description != nil {
		sets = append(sets, fmt.Sprintf("description = NULLIF(TRIM($%d), '')", argIdx))
		args = append(args, *update.Description)
		argIdx++
	}
	if update.Severity != nil {
		sets = append(sets, fmt.Sprintf("severity = $%d", argIdx))
		args = append(args, *update.Severity)
		argIdx++
	}
	if update.AssignedTo != nil {
		sets = append(sets, fmt.Sprintf("assigned_to = NULLIF(TRIM($%d), '')::uuid", argIdx))
		args = append(args, *update.AssignedTo)
		argIdx++
	}
	if update.RootCause != nil {
		sets = append(sets, fmt.Sprintf("root_cause = NULLIF(TRIM($%d), '')", argIdx))
		args = append(args, *update.RootCause)
		argIdx++
	}
	if update.Resolution != nil {
		sets = append(sets, fmt.Sprintf("resolution = NULLIF(TRIM($%d), '')", argIdx))
		args = append(args, *update.Resolution)
		argIdx++
	}
	if update.SLAResponseMinutes != nil {
		sets = append(sets, fmt.Sprintf("sla_response_minutes = $%d", argIdx))
		args = append(args, *update.SLAResponseMinutes)
		argIdx++
	}
	if update.SLAResolveMinutes != nil {
		sets = append(sets, fmt.Sprintf("sla_resolve_minutes = $%d", argIdx))
		args = append(args, *update.SLAResolveMinutes)
		argIdx++
	}

	if len(sets) == 0 {
		return nil
	}

	sets = append(sets, "updated_at = NOW()")
	query := fmt.Sprintf(`
UPDATE incidents
SET %s
WHERE tenant_id = $1::uuid AND id = $2::uuid
`, strings.Join(sets, ", "))

	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("update incident: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrIncidentNotFound
	}
	return nil
}

// UpdateIncidentStatus updates status and optional timestamps for state transitions.
func (r *RepositoryPG) UpdateIncidentStatus(ctx context.Context, tenantID, incidentID string, upd *StatusUpdate) error {
	tenantID = strings.TrimSpace(tenantID)
	incidentID = strings.TrimSpace(incidentID)
	if tenantID == "" || incidentID == "" {
		return ErrIncidentNotFound
	}
	if upd == nil || strings.TrimSpace(upd.Status) == "" {
		return fmt.Errorf("status update is required")
	}

	sets := []string{"status = $3", "updated_at = NOW()"}
	args := []interface{}{tenantID, incidentID, upd.Status}
	argIdx := 4

	if upd.AcknowledgedAt != nil {
		sets = append(sets, fmt.Sprintf("acknowledged_at = $%d", argIdx))
		args = append(args, *upd.AcknowledgedAt)
		argIdx++
	}
	if upd.ResolvedAt != nil {
		sets = append(sets, fmt.Sprintf("resolved_at = $%d", argIdx))
		args = append(args, *upd.ResolvedAt)
		argIdx++
	}
	if upd.ClosedAt != nil {
		sets = append(sets, fmt.Sprintf("closed_at = $%d", argIdx))
		args = append(args, *upd.ClosedAt)
		argIdx++
	}
	if upd.Resolution != nil {
		sets = append(sets, fmt.Sprintf("resolution = NULLIF(TRIM($%d), '')", argIdx))
		args = append(args, *upd.Resolution)
		argIdx++
	}

	query := fmt.Sprintf(`
UPDATE incidents
SET %s
WHERE tenant_id = $1::uuid AND id = $2::uuid
`, strings.Join(sets, ", "))

	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("update incident status: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrIncidentNotFound
	}
	return nil
}

// ArchiveIncident sets verdict and transitions to closed.
func (r *RepositoryPG) ArchiveIncident(ctx context.Context, tenantID, incidentID string, verdict string) error {
	tenantID = strings.TrimSpace(tenantID)
	incidentID = strings.TrimSpace(incidentID)
	if tenantID == "" || incidentID == "" {
		return ErrIncidentNotFound
	}
	if strings.TrimSpace(verdict) == "" {
		return fmt.Errorf("verdict is required for archive")
	}

	query := `
UPDATE incidents
SET status = 'closed', verdict = $3, closed_at = NOW(), updated_at = NOW()
WHERE tenant_id = $1::uuid AND id = $2::uuid
`
	result, err := r.db.ExecContext(ctx, query, tenantID, incidentID, verdict)
	if err != nil {
		return fmt.Errorf("archive incident: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrIncidentNotFound
	}
	return nil
}

// DeleteIncident permanently removes an incident and its timeline entries.
func (r *RepositoryPG) DeleteIncident(ctx context.Context, tenantID, incidentID string) error {
	tenantID = strings.TrimSpace(tenantID)
	incidentID = strings.TrimSpace(incidentID)
	if tenantID == "" || incidentID == "" {
		return ErrIncidentNotFound
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin delete incident transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if _, err := tx.ExecContext(ctx, `DELETE FROM incident_timeline WHERE incident_id = $1::uuid`, incidentID); err != nil {
		return fmt.Errorf("delete incident timeline: %w", err)
	}

	result, err := tx.ExecContext(ctx, `DELETE FROM incidents WHERE tenant_id = $1::uuid AND id = $2::uuid`, tenantID, incidentID)
	if err != nil {
		return fmt.Errorf("delete incident: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrIncidentNotFound
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit delete incident: %w", err)
	}
	return nil
}

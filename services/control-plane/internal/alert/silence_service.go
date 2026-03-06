package alert

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// Silence represents an alert silence policy.
type Silence struct {
	ID        string            `json:"id"`
	TenantID  string            `json:"tenant_id"`
	Matchers  map[string]string `json:"matchers"`
	Reason    string            `json:"reason"`
	StartsAt  time.Time         `json:"starts_at"`
	EndsAt    time.Time         `json:"ends_at"`
	CreatedBy string            `json:"created_by,omitempty"`
	CreatedAt time.Time         `json:"created_at"`
	UpdatedAt time.Time         `json:"updated_at"`
}

// SilenceService handles silence CRUD and matching.
type SilenceService struct {
	db *sql.DB
}

// NewSilenceService creates a silence service.
func NewSilenceService(db *sql.DB) *SilenceService {
	return &SilenceService{db: db}
}

// ListActive returns silences that are currently active (now between starts_at and ends_at).
func (s *SilenceService) ListActive(ctx context.Context, tenantID string) ([]Silence, error) {
	if s.db == nil {
		return nil, nil
	}
	now := time.Now().UTC()
	query := `
SELECT id, tenant_id, matchers, reason, starts_at, ends_at, created_by, created_at, updated_at
FROM alert_silences
WHERE starts_at <= $1 AND ends_at >= $1
`
	args := []any{now}
	if tenantID != "" {
		query += ` AND (tenant_id IS NULL OR tenant_id = $2::uuid)`
		args = append(args, tenantID)
	}
	query += ` ORDER BY starts_at ASC`

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var silences []Silence
	for rows.Next() {
		var sil Silence
		var tenantIDNull, createdByNull sql.NullString
		var matchersRaw []byte
		if err := rows.Scan(
			&sil.ID, &tenantIDNull, &matchersRaw, &sil.Reason,
			&sil.StartsAt, &sil.EndsAt, &createdByNull, &sil.CreatedAt, &sil.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if tenantIDNull.Valid {
			sil.TenantID = tenantIDNull.String
		}
		if createdByNull.Valid {
			sil.CreatedBy = createdByNull.String
		}
		if len(matchersRaw) > 0 {
			_ = json.Unmarshal(matchersRaw, &sil.Matchers)
		}
		if sil.Matchers == nil {
			sil.Matchers = map[string]string{}
		}
		silences = append(silences, sil)
	}
	return silences, rows.Err()
}

// Create creates a new silence.
func (s *SilenceService) Create(ctx context.Context, tenantID, createdBy string, matchers map[string]string, reason string, startsAt, endsAt time.Time) (*Silence, error) {
	if s.db == nil {
		return nil, fmt.Errorf("database not configured")
	}
	if endsAt.Before(startsAt) {
		return nil, fmt.Errorf("ends_at must be after starts_at")
	}
	matchersJSON, _ := json.Marshal(matchers)
	if matchersJSON == nil {
		matchersJSON = []byte("{}")
	}

	query := `
INSERT INTO alert_silences (tenant_id, matchers, reason, starts_at, ends_at, created_by, created_at, updated_at)
VALUES ($1::uuid, $2::jsonb, NULLIF($3,''), $4, $5, NULLIF($6,'')::uuid, NOW(), NOW())
RETURNING id, tenant_id, matchers, reason, starts_at, ends_at, created_by, created_at, updated_at
`
	var sil Silence
	var tenantIDNull, createdByNull sql.NullString
	var matchersRaw []byte
	err := s.db.QueryRowContext(ctx, query,
		nullUUID(tenantID), matchersJSON, strings.TrimSpace(reason), startsAt, endsAt, nullUUID(createdBy),
	).Scan(
		&sil.ID, &tenantIDNull, &matchersRaw, &sil.Reason,
		&sil.StartsAt, &sil.EndsAt, &createdByNull, &sil.CreatedAt, &sil.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if tenantIDNull.Valid {
		sil.TenantID = tenantIDNull.String
	}
	if createdByNull.Valid {
		sil.CreatedBy = createdByNull.String
	}
	if len(matchersRaw) > 0 {
		_ = json.Unmarshal(matchersRaw, &sil.Matchers)
	}
	if sil.Matchers == nil {
		sil.Matchers = map[string]string{}
	}
	return &sil, nil
}

// Update updates an existing silence.
func (s *SilenceService) Update(ctx context.Context, id, tenantID string, matchers map[string]string, reason string, startsAt, endsAt time.Time) (*Silence, error) {
	if s.db == nil {
		return nil, fmt.Errorf("database not configured")
	}
	if endsAt.Before(startsAt) {
		return nil, fmt.Errorf("ends_at must be after starts_at")
	}
	matchersJSON, _ := json.Marshal(matchers)
	if matchersJSON == nil {
		matchersJSON = []byte("{}")
	}

	query := `
UPDATE alert_silences
SET matchers = $2::jsonb, reason = NULLIF($3,''), starts_at = $4, ends_at = $5, updated_at = NOW()
WHERE id = $1::uuid
`
	args := []any{id, matchersJSON, strings.TrimSpace(reason), startsAt, endsAt}
	if strings.TrimSpace(tenantID) != "" {
		query += ` AND (tenant_id IS NULL OR tenant_id = $6::uuid)`
		args = append(args, tenantID)
	}
	query += ` RETURNING id, tenant_id, matchers, reason, starts_at, ends_at, created_by, created_at, updated_at`

	var sil Silence
	var tenantIDNull, createdByNull sql.NullString
	var matchersRaw []byte
	err := s.db.QueryRowContext(ctx, query, args...).Scan(
		&sil.ID, &tenantIDNull, &matchersRaw, &sil.Reason,
		&sil.StartsAt, &sil.EndsAt, &createdByNull, &sil.CreatedAt, &sil.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("silence not found")
	}
	if err != nil {
		return nil, err
	}
	if tenantIDNull.Valid {
		sil.TenantID = tenantIDNull.String
	}
	if createdByNull.Valid {
		sil.CreatedBy = createdByNull.String
	}
	if len(matchersRaw) > 0 {
		_ = json.Unmarshal(matchersRaw, &sil.Matchers)
	}
	if sil.Matchers == nil {
		sil.Matchers = map[string]string{}
	}
	return &sil, nil
}

// Delete deletes a silence.
func (s *SilenceService) Delete(ctx context.Context, id, tenantID string) error {
	if s.db == nil {
		return fmt.Errorf("database not configured")
	}
	var result sql.Result
	var err error
	if strings.TrimSpace(tenantID) != "" {
		result, err = s.db.ExecContext(ctx, `DELETE FROM alert_silences WHERE id = $1::uuid AND (tenant_id IS NULL OR tenant_id = $2::uuid)`, id, tenantID)
	} else {
		result, err = s.db.ExecContext(ctx, `DELETE FROM alert_silences WHERE id = $1::uuid`, id)
	}
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("silence not found")
	}
	return nil
}

// IsSilenced returns true if the alert matches any active silence.
// Matchers are checked: all silence matchers must match alert attributes.
func (s *SilenceService) IsSilenced(ctx context.Context, tenantID, ruleID, severity, sourceID string) (bool, error) {
	if s.db == nil {
		return false, nil
	}
	silences, err := s.ListActive(ctx, tenantID)
	if err != nil {
		return false, err
	}
	alertAttrs := map[string]string{
		"rule_id":  ruleID,
		"severity": severity,
		"source_id": sourceID,
	}
	for _, sil := range silences {
		if matchesSilence(alertAttrs, sil.Matchers) {
			return true, nil
		}
	}
	return false, nil
}

func matchesSilence(alertAttrs, matchers map[string]string) bool {
	if len(matchers) == 0 {
		return true // empty matchers = match all
	}
	for k, v := range matchers {
		alertVal := alertAttrs[k]
		if !strings.EqualFold(strings.TrimSpace(alertVal), strings.TrimSpace(v)) {
			return false
		}
	}
	return true
}

func nullUUID(s string) interface{} {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return s
}

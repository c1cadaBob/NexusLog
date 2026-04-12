package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

var ErrLoginPolicyNotFound = errors.New("login policy not found")

type LoginPolicyRecord struct {
	TenantID  string
	Settings  map[string]any
	UpdatedBy string
	UpdatedAt time.Time
}

type LoginPolicyRepository struct {
	db *sql.DB
}

func NewLoginPolicyRepository(db *sql.DB) *LoginPolicyRepository {
	return &LoginPolicyRepository{db: db}
}

func (r *LoginPolicyRepository) IsConfigured() bool {
	return r != nil && r.db != nil
}

func (r *LoginPolicyRepository) Get(ctx context.Context, tenantID string) (LoginPolicyRecord, error) {
	if !r.IsConfigured() {
		return LoginPolicyRecord{}, fmt.Errorf("login policy repository is not configured")
	}
	const query = `
SELECT tenant_id::text, settings, COALESCE(updated_by::text, ''), updated_at
FROM login_policy_settings
WHERE tenant_id = $1::uuid
LIMIT 1
`
	var (
		record LoginPolicyRecord
		settingsRaw []byte
	)
	err := r.db.QueryRowContext(ctx, query, strings.TrimSpace(tenantID)).Scan(
		&record.TenantID,
		&settingsRaw,
		&record.UpdatedBy,
		&record.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return LoginPolicyRecord{}, ErrLoginPolicyNotFound
		}
		return LoginPolicyRecord{}, fmt.Errorf("query login policy: %w", err)
	}
	if len(settingsRaw) > 0 {
		_ = json.Unmarshal(settingsRaw, &record.Settings)
	}
	if record.Settings == nil {
		record.Settings = map[string]any{}
	}
	record.UpdatedAt = record.UpdatedAt.UTC()
	return record, nil
}

func (r *LoginPolicyRepository) Upsert(ctx context.Context, tenantID, updatedBy string, settings map[string]any) (LoginPolicyRecord, error) {
	if !r.IsConfigured() {
		return LoginPolicyRecord{}, fmt.Errorf("login policy repository is not configured")
	}
	if settings == nil {
		settings = map[string]any{}
	}
	settingsRaw, err := json.Marshal(settings)
	if err != nil {
		return LoginPolicyRecord{}, fmt.Errorf("marshal login policy settings: %w", err)
	}
	const query = `
INSERT INTO login_policy_settings (tenant_id, settings, updated_by, updated_at)
VALUES ($1::uuid, $2::jsonb, NULLIF($3, '')::uuid, NOW())
ON CONFLICT (tenant_id) DO UPDATE
SET settings = EXCLUDED.settings,
    updated_by = EXCLUDED.updated_by,
    updated_at = NOW()
RETURNING tenant_id::text, settings, COALESCE(updated_by::text, ''), updated_at
`
	var record LoginPolicyRecord
	var returnedSettingsRaw []byte
	err = r.db.QueryRowContext(ctx, query, strings.TrimSpace(tenantID), settingsRaw, strings.TrimSpace(updatedBy)).Scan(
		&record.TenantID,
		&returnedSettingsRaw,
		&record.UpdatedBy,
		&record.UpdatedAt,
	)
	if err != nil {
		return LoginPolicyRecord{}, fmt.Errorf("upsert login policy: %w", err)
	}
	if len(returnedSettingsRaw) > 0 {
		_ = json.Unmarshal(returnedSettingsRaw, &record.Settings)
	}
	if record.Settings == nil {
		record.Settings = map[string]any{}
	}
	record.UpdatedAt = record.UpdatedAt.UTC()
	return record, nil
}

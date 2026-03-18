package alert

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	cpMiddleware "github.com/nexuslog/control-plane/internal/middleware"
)

var (
	// ErrRuleNotFound indicates the alert rule was not found.
	ErrRuleNotFound = errors.New("alert rule not found")
)

// RuleRepository defines the interface for alert rule persistence.
type RuleRepository interface {
	ListRules(ctx context.Context, tenantID string, page, pageSize int) ([]AlertRule, int, error)
	ListRulesForScope(ctx context.Context, scope cpMiddleware.TenantReadScope, page, pageSize int) ([]AlertRule, int, error)
	ListEnabledRules(ctx context.Context) ([]AlertRule, error)
	GetRule(ctx context.Context, tenantID, ruleID string) (*AlertRule, error)
	GetRuleForScope(ctx context.Context, scope cpMiddleware.TenantReadScope, ruleID string) (*AlertRule, error)
	CreateRule(ctx context.Context, rule *AlertRule) (string, error)
	UpdateRule(ctx context.Context, tenantID, ruleID string, update *AlertRuleUpdate) error
	DeleteRule(ctx context.Context, tenantID, ruleID string) error
	CountRules(ctx context.Context, tenantID string) (int, error)
}

// AlertRule represents an alert rule entity.
type AlertRule struct {
	ID                   string          `json:"id"`
	TenantID             string          `json:"tenant_id"`
	Name                 string          `json:"name"`
	Description          string          `json:"description"`
	Condition            json.RawMessage `json:"condition"`
	Severity             string          `json:"severity"`
	Enabled              bool            `json:"enabled"`
	NotificationChannels json.RawMessage `json:"notification_channels"`
	CreatedBy            *string         `json:"created_by,omitempty"`
	CreatedAt            time.Time       `json:"created_at"`
	UpdatedAt            time.Time       `json:"updated_at"`
}

// AlertRuleUpdate represents partial update fields for an alert rule.
type AlertRuleUpdate struct {
	Name                 *string         `json:"name,omitempty"`
	Description          *string         `json:"description,omitempty"`
	Condition            json.RawMessage `json:"condition,omitempty"`
	Severity             *string         `json:"severity,omitempty"`
	Enabled              *bool           `json:"enabled,omitempty"`
	NotificationChannels json.RawMessage `json:"notification_channels,omitempty"`
}

// RuleRepositoryPG implements RuleRepository using PostgreSQL.
type RuleRepositoryPG struct {
	db *sql.DB
}

// NewRuleRepositoryPG creates a new PostgreSQL-backed rule repository.
func NewRuleRepositoryPG(db *sql.DB) *RuleRepositoryPG {
	return &RuleRepositoryPG{db: db}
}

// ListRules returns paginated alert rules for a tenant.
func (r *RuleRepositoryPG) ListRules(ctx context.Context, tenantID string, page, pageSize int) ([]AlertRule, int, error) {
	scope := cpMiddleware.TenantReadScope{TenantID: tenantID}
	if strings.TrimSpace(tenantID) == "" {
		scope.Global = true
	}
	return r.ListRulesForScope(ctx, scope, page, pageSize)
}

// ListRulesForScope returns paginated alert rules for an explicit read scope.
func (r *RuleRepositoryPG) ListRulesForScope(ctx context.Context, scope cpMiddleware.TenantReadScope, page, pageSize int) ([]AlertRule, int, error) {
	tenantID := strings.TrimSpace(scope.TenantID)

	var (
		total int
		rows  *sql.Rows
		err   error
	)

	offset := (page - 1) * pageSize
	if scope.Global {
		countQuery := `SELECT COUNT(1) FROM alert_rules`
		if err := r.db.QueryRowContext(ctx, countQuery).Scan(&total); err != nil {
			return nil, 0, fmt.Errorf("count rules: %w", err)
		}
		query := `
SELECT
    id::text,
    tenant_id::text,
    name,
    COALESCE(description, ''),
    condition,
    COALESCE(severity, 'WARNING'),
    COALESCE(enabled, true),
    COALESCE(notification_channels, '[]'::jsonb),
    created_by::text,
    created_at,
    updated_at
FROM alert_rules
ORDER BY updated_at DESC
OFFSET $1
LIMIT $2
`
		rows, err = r.db.QueryContext(ctx, query, offset, pageSize)
	} else {
		countQuery := `SELECT COUNT(1) FROM alert_rules WHERE tenant_id = $1::uuid`
		if err := r.db.QueryRowContext(ctx, countQuery, tenantID).Scan(&total); err != nil {
			return nil, 0, fmt.Errorf("count rules: %w", err)
		}
		query := `
SELECT
    id::text,
    tenant_id::text,
    name,
    COALESCE(description, ''),
    condition,
    COALESCE(severity, 'WARNING'),
    COALESCE(enabled, true),
    COALESCE(notification_channels, '[]'::jsonb),
    created_by::text,
    created_at,
    updated_at
FROM alert_rules
WHERE tenant_id = $1::uuid
ORDER BY updated_at DESC
OFFSET $2
LIMIT $3
`
		rows, err = r.db.QueryContext(ctx, query, tenantID, offset, pageSize)
	}
	if err != nil {
		return nil, 0, fmt.Errorf("list rules: %w", err)
	}
	defer rows.Close()

	items := make([]AlertRule, 0, pageSize)
	for rows.Next() {
		var rule AlertRule
		var createdBy sql.NullString
		if err := rows.Scan(
			&rule.ID,
			&rule.TenantID,
			&rule.Name,
			&rule.Description,
			&rule.Condition,
			&rule.Severity,
			&rule.Enabled,
			&rule.NotificationChannels,
			&createdBy,
			&rule.CreatedAt,
			&rule.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan rule: %w", err)
		}
		if createdBy.Valid {
			rule.CreatedBy = &createdBy.String
		}
		rule.CreatedAt = rule.CreatedAt.UTC()
		rule.UpdatedAt = rule.UpdatedAt.UTC()
		items = append(items, rule)
	}
	return items, total, nil
}

// ListEnabledRules returns all enabled alert rules across tenants (for evaluator).
func (r *RuleRepositoryPG) ListEnabledRules(ctx context.Context) ([]AlertRule, error) {
	query := `
SELECT
    id::text,
    tenant_id::text,
    name,
    COALESCE(description, ''),
    condition,
    COALESCE(severity, 'WARNING'),
    COALESCE(enabled, true),
    COALESCE(notification_channels, '[]'::jsonb),
    created_by::text,
    created_at,
    updated_at
FROM alert_rules
WHERE enabled = true
ORDER BY tenant_id, updated_at DESC
`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list enabled rules: %w", err)
	}
	defer rows.Close()

	var items []AlertRule
	for rows.Next() {
		var rule AlertRule
		var createdBy sql.NullString
		if err := rows.Scan(
			&rule.ID,
			&rule.TenantID,
			&rule.Name,
			&rule.Description,
			&rule.Condition,
			&rule.Severity,
			&rule.Enabled,
			&rule.NotificationChannels,
			&createdBy,
			&rule.CreatedAt,
			&rule.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan rule: %w", err)
		}
		if createdBy.Valid {
			rule.CreatedBy = &createdBy.String
		}
		rule.CreatedAt = rule.CreatedAt.UTC()
		rule.UpdatedAt = rule.UpdatedAt.UTC()
		items = append(items, rule)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate enabled rules: %w", err)
	}
	return items, nil
}

// GetRule returns a single alert rule by ID.
func (r *RuleRepositoryPG) GetRule(ctx context.Context, tenantID, ruleID string) (*AlertRule, error) {
	scope := cpMiddleware.TenantReadScope{TenantID: tenantID}
	if strings.TrimSpace(tenantID) == "" {
		scope.Global = true
	}
	return r.GetRuleForScope(ctx, scope, ruleID)
}

func (r *RuleRepositoryPG) GetRuleForScope(ctx context.Context, scope cpMiddleware.TenantReadScope, ruleID string) (*AlertRule, error) {
	tenantID := strings.TrimSpace(scope.TenantID)
	ruleID = strings.TrimSpace(ruleID)
	if ruleID == "" {
		return nil, ErrRuleNotFound
	}

	var (
		query string
		args  []any
	)
	if scope.Global {
		query = `
SELECT
    id::text,
    tenant_id::text,
    name,
    COALESCE(description, ''),
    condition,
    COALESCE(severity, 'WARNING'),
    COALESCE(enabled, true),
    COALESCE(notification_channels, '[]'::jsonb),
    created_by::text,
    created_at,
    updated_at
FROM alert_rules
WHERE id = $1::uuid
`
		args = []any{ruleID}
	} else {
		query = `
SELECT
    id::text,
    tenant_id::text,
    name,
    COALESCE(description, ''),
    condition,
    COALESCE(severity, 'WARNING'),
    COALESCE(enabled, true),
    COALESCE(notification_channels, '[]'::jsonb),
    created_by::text,
    created_at,
    updated_at
FROM alert_rules
WHERE tenant_id = $1::uuid AND id = $2::uuid
`
		args = []any{tenantID, ruleID}
	}
	var rule AlertRule
	var createdBy sql.NullString
	err := r.db.QueryRowContext(ctx, query, args...).Scan(
		&rule.ID,
		&rule.TenantID,
		&rule.Name,
		&rule.Description,
		&rule.Condition,
		&rule.Severity,
		&rule.Enabled,
		&rule.NotificationChannels,
		&createdBy,
		&rule.CreatedAt,
		&rule.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrRuleNotFound
		}
		return nil, fmt.Errorf("get rule: %w", err)
	}
	if createdBy.Valid {
		rule.CreatedBy = &createdBy.String
	}
	rule.CreatedAt = rule.CreatedAt.UTC()
	rule.UpdatedAt = rule.UpdatedAt.UTC()
	return &rule, nil
}

func (r *RuleRepositoryPG) HasGlobalTenantReadAccess(ctx context.Context, tenantID, userID string) (bool, error) {
	return cpMiddleware.HasGlobalTenantReadAccess(ctx, r.db, tenantID, userID)
}

// CreateRule inserts a new alert rule and returns its ID.
func (r *RuleRepositoryPG) CreateRule(ctx context.Context, rule *AlertRule) (string, error) {
	if rule == nil {
		return "", fmt.Errorf("rule is required")
	}
	tenantID := strings.TrimSpace(rule.TenantID)
	if tenantID == "" {
		return "", fmt.Errorf("tenant_id is required")
	}
	if len(rule.Condition) == 0 {
		return "", fmt.Errorf("condition is required")
	}

	query := `
INSERT INTO alert_rules (
    tenant_id,
    name,
    description,
    condition,
    severity,
    enabled,
    notification_channels,
    created_by,
    created_at,
    updated_at
) VALUES (
    $1::uuid,
    $2,
    NULLIF(TRIM($3), ''),
    $4::jsonb,
    COALESCE(NULLIF(TRIM($5), ''), 'WARNING'),
    COALESCE($6, true),
    COALESCE($7::jsonb, '[]'::jsonb),
    NULLIF(TRIM($8), '')::uuid,
    NOW(),
    NOW()
)
RETURNING id::text
`
	var id string
	var createdBy interface{}
	if rule.CreatedBy != nil && *rule.CreatedBy != "" {
		createdBy = *rule.CreatedBy
	} else {
		createdBy = nil
	}
	notifCh := rule.NotificationChannels
	if len(notifCh) == 0 {
		notifCh = []byte("[]")
	}
	err := r.db.QueryRowContext(ctx, query,
		tenantID,
		rule.Name,
		rule.Description,
		rule.Condition,
		rule.Severity,
		rule.Enabled,
		notifCh,
		createdBy,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("create rule: %w", err)
	}
	return id, nil
}

// UpdateRule updates an existing alert rule.
func (r *RuleRepositoryPG) UpdateRule(ctx context.Context, tenantID, ruleID string, update *AlertRuleUpdate) error {
	tenantID = strings.TrimSpace(tenantID)
	ruleID = strings.TrimSpace(ruleID)
	if tenantID == "" || ruleID == "" {
		return ErrRuleNotFound
	}
	if update == nil {
		return fmt.Errorf("update is required")
	}

	// Build dynamic update query based on provided fields
	sets := []string{}
	args := []interface{}{tenantID, ruleID}
	argIdx := 3

	if update.Name != nil {
		sets = append(sets, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, *update.Name)
		argIdx++
	}
	if update.Description != nil {
		sets = append(sets, fmt.Sprintf("description = NULLIF(TRIM($%d), '')", argIdx))
		args = append(args, *update.Description)
		argIdx++
	}
	if len(update.Condition) > 0 {
		sets = append(sets, fmt.Sprintf("condition = $%d::jsonb", argIdx))
		args = append(args, update.Condition)
		argIdx++
	}
	if update.Severity != nil {
		sets = append(sets, fmt.Sprintf("severity = $%d", argIdx))
		args = append(args, *update.Severity)
		argIdx++
	}
	if update.Enabled != nil {
		sets = append(sets, fmt.Sprintf("enabled = $%d", argIdx))
		args = append(args, *update.Enabled)
		argIdx++
	}
	if len(update.NotificationChannels) > 0 {
		sets = append(sets, fmt.Sprintf("notification_channels = $%d::jsonb", argIdx))
		args = append(args, update.NotificationChannels)
		argIdx++
	}

	if len(sets) == 0 {
		return nil
	}

	sets = append(sets, "updated_at = NOW()")
	query := fmt.Sprintf(`
UPDATE alert_rules
SET %s
WHERE tenant_id = $1::uuid AND id = $2::uuid
`, strings.Join(sets, ", "))

	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("update rule: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrRuleNotFound
	}
	return nil
}

// DeleteRule removes an alert rule.
func (r *RuleRepositoryPG) DeleteRule(ctx context.Context, tenantID, ruleID string) error {
	tenantID = strings.TrimSpace(tenantID)
	ruleID = strings.TrimSpace(ruleID)
	if tenantID == "" || ruleID == "" {
		return ErrRuleNotFound
	}

	query := `DELETE FROM alert_rules WHERE tenant_id = $1::uuid AND id = $2::uuid`
	result, err := r.db.ExecContext(ctx, query, tenantID, ruleID)
	if err != nil {
		return fmt.Errorf("delete rule: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrRuleNotFound
	}
	return nil
}

// CountRules returns the total number of rules for a tenant.
func (r *RuleRepositoryPG) CountRules(ctx context.Context, tenantID string) (int, error) {
	tenantID = strings.TrimSpace(tenantID)
	if tenantID == "" {
		return 0, fmt.Errorf("tenant_id is required")
	}

	var count int
	query := `SELECT COUNT(1) FROM alert_rules WHERE tenant_id = $1::uuid`
	if err := r.db.QueryRowContext(ctx, query, tenantID).Scan(&count); err != nil {
		return 0, fmt.Errorf("count rules: %w", err)
	}
	return count, nil
}

package notification

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/lib/pq"

	cpMiddleware "github.com/nexuslog/control-plane/internal/middleware"
)

var (
	ErrChannelNotFound     = errors.New("notification channel not found")
	ErrChannelNameConflict = errors.New("notification channel name conflict")
)

// Channel represents a notification channel.
type Channel struct {
	ID        string          `json:"id"`
	TenantID  string          `json:"tenant_id"`
	Name      string          `json:"name"`
	Type      string          `json:"type"`
	Config    json.RawMessage `json:"config"`
	Enabled   bool            `json:"enabled"`
	CreatedBy sql.NullString  `json:"created_by,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

// ChannelRepository provides CRUD for notification_channels.
type ChannelRepository struct {
	db *sql.DB
}

// NewChannelRepository creates a new channel repository.
func NewChannelRepository(db *sql.DB) *ChannelRepository {
	return &ChannelRepository{db: db}
}

// ListChannels returns channels for a tenant with pagination.
func (r *ChannelRepository) ListChannels(ctx context.Context, tenantID string, page, pageSize int) ([]Channel, int, error) {
	scope := cpMiddleware.TenantReadScope{TenantID: tenantID}
	if strings.TrimSpace(tenantID) == "" {
		scope.Global = true
	}
	return r.ListChannelsForScope(ctx, scope, page, pageSize)
}

// ListChannelsForScope returns channels for an explicit read scope with pagination.
func (r *ChannelRepository) ListChannelsForScope(ctx context.Context, scope cpMiddleware.TenantReadScope, page, pageSize int) ([]Channel, int, error) {
	tenantID := strings.TrimSpace(scope.TenantID)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 200 {
		pageSize = 20
	}

	var (
		total int
		rows  *sql.Rows
		err   error
	)
	offset := (page - 1) * pageSize
	if scope.Global {
		countQuery := `SELECT COUNT(1) FROM notification_channels`
		if err := r.db.QueryRowContext(ctx, countQuery).Scan(&total); err != nil {
			return nil, 0, fmt.Errorf("count channels: %w", err)
		}
		query := `
SELECT id::text, tenant_id::text, name, type, config, enabled,
       created_by::text, created_at, updated_at
FROM notification_channels
ORDER BY updated_at DESC
OFFSET $1 LIMIT $2
`
		rows, err = r.db.QueryContext(ctx, query, offset, pageSize)
	} else {
		countQuery := `SELECT COUNT(1) FROM notification_channels WHERE tenant_id = $1::uuid`
		if err := r.db.QueryRowContext(ctx, countQuery, tenantID).Scan(&total); err != nil {
			return nil, 0, fmt.Errorf("count channels: %w", err)
		}
		query := `
SELECT id::text, tenant_id::text, name, type, config, enabled,
       created_by::text, created_at, updated_at
FROM notification_channels
WHERE tenant_id = $1::uuid
ORDER BY updated_at DESC
OFFSET $2 LIMIT $3
`
		rows, err = r.db.QueryContext(ctx, query, tenantID, offset, pageSize)
	}
	if err != nil {
		return nil, 0, fmt.Errorf("list channels: %w", err)
	}
	defer rows.Close()

	var items []Channel
	for rows.Next() {
		var ch Channel
		var createdBy sql.NullString
		if err := rows.Scan(
			&ch.ID,
			&ch.TenantID,
			&ch.Name,
			&ch.Type,
			&ch.Config,
			&ch.Enabled,
			&createdBy,
			&ch.CreatedAt,
			&ch.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan channel: %w", err)
		}
		ch.CreatedBy = createdBy
		ch.CreatedAt = ch.CreatedAt.UTC()
		ch.UpdatedAt = ch.UpdatedAt.UTC()
		items = append(items, ch)
	}
	return items, total, nil
}

// GetChannel returns a channel by ID and tenant.
func (r *ChannelRepository) GetChannel(ctx context.Context, tenantID, id string) (Channel, error) {
	scope := cpMiddleware.TenantReadScope{TenantID: tenantID}
	if strings.TrimSpace(tenantID) == "" {
		scope.Global = true
	}
	return r.GetChannelForScope(ctx, scope, id)
}

// GetChannelForScope returns a channel by ID for an explicit read scope.
func (r *ChannelRepository) GetChannelForScope(ctx context.Context, scope cpMiddleware.TenantReadScope, id string) (Channel, error) {
	tenantID := strings.TrimSpace(scope.TenantID)
	id = strings.TrimSpace(id)
	if id == "" {
		return Channel{}, fmt.Errorf("id is required")
	}

	var (
		query string
		args  []any
	)
	if scope.Global {
		query = `
SELECT id::text, tenant_id::text, name, type, config, enabled,
       created_by::text, created_at, updated_at
FROM notification_channels
WHERE id = $1::uuid
`
		args = []any{id}
	} else {
		query = `
SELECT id::text, tenant_id::text, name, type, config, enabled,
       created_by::text, created_at, updated_at
FROM notification_channels
WHERE id = $1::uuid AND tenant_id = $2::uuid
`
		args = []any{id, tenantID}
	}
	var ch Channel
	var createdBy sql.NullString
	err := r.db.QueryRowContext(ctx, query, args...).Scan(
		&ch.ID,
		&ch.TenantID,
		&ch.Name,
		&ch.Type,
		&ch.Config,
		&ch.Enabled,
		&createdBy,
		&ch.CreatedAt,
		&ch.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Channel{}, ErrChannelNotFound
		}
		return Channel{}, fmt.Errorf("get channel: %w", err)
	}
	ch.CreatedBy = createdBy
	ch.CreatedAt = ch.CreatedAt.UTC()
	ch.UpdatedAt = ch.UpdatedAt.UTC()
	return ch, nil
}

func (r *ChannelRepository) HasGlobalTenantReadAccess(ctx context.Context, tenantID, userID string) (bool, error) {
	return cpMiddleware.HasGlobalTenantReadAccess(ctx, r.db, tenantID, userID)
}

// CreateChannel creates a new notification channel.
func (r *ChannelRepository) CreateChannel(ctx context.Context, tenantID string, name, chType string, config json.RawMessage, enabled bool, createdBy *string) (Channel, error) {
	tenantID = strings.TrimSpace(tenantID)
	name = strings.TrimSpace(name)
	chType = strings.TrimSpace(chType)
	if tenantID == "" || name == "" || chType == "" {
		return Channel{}, fmt.Errorf("tenant_id, name, and type are required")
	}
	if config == nil {
		config = json.RawMessage("{}")
	}

	query := `
INSERT INTO notification_channels (tenant_id, name, type, config, enabled, created_by, created_at, updated_at)
VALUES ($1::uuid, $2, $3, $4, $5, $6::uuid, now(), now())
RETURNING id::text, tenant_id::text, name, type, config, enabled, created_by::text, created_at, updated_at
`
	var ch Channel
	var createdByVal sql.NullString
	var createdByArg interface{}
	if createdBy != nil && strings.TrimSpace(*createdBy) != "" {
		createdByArg = strings.TrimSpace(*createdBy)
		createdByVal = sql.NullString{String: strings.TrimSpace(*createdBy), Valid: true}
	} else {
		createdByArg = nil
	}

	err := r.db.QueryRowContext(ctx, query, tenantID, name, chType, config, enabled, createdByArg).Scan(
		&ch.ID,
		&ch.TenantID,
		&ch.Name,
		&ch.Type,
		&ch.Config,
		&ch.Enabled,
		&createdByVal,
		&ch.CreatedAt,
		&ch.UpdatedAt,
	)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return Channel{}, ErrChannelNameConflict
		}
		return Channel{}, fmt.Errorf("create channel: %w", err)
	}
	ch.CreatedBy = createdByVal
	ch.CreatedAt = ch.CreatedAt.UTC()
	ch.UpdatedAt = ch.UpdatedAt.UTC()
	return ch, nil
}

// UpdateChannel updates an existing channel.
func (r *ChannelRepository) UpdateChannel(ctx context.Context, tenantID, id string, name *string, config *json.RawMessage, enabled *bool) (Channel, error) {
	tenantID = strings.TrimSpace(tenantID)
	id = strings.TrimSpace(id)
	if tenantID == "" || id == "" {
		return Channel{}, fmt.Errorf("tenant_id and id are required")
	}

	_, err := r.GetChannel(ctx, tenantID, id)
	if err != nil {
		return Channel{}, err
	}

	updates := []string{"updated_at = now()"}
	args := []interface{}{tenantID, id}
	argIdx := 3
	if name != nil {
		updates = append(updates, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, strings.TrimSpace(*name))
		argIdx++
	}
	if config != nil {
		updates = append(updates, fmt.Sprintf("config = $%d", argIdx))
		args = append(args, *config)
		argIdx++
	}
	if enabled != nil {
		updates = append(updates, fmt.Sprintf("enabled = $%d", argIdx))
		args = append(args, *enabled)
		argIdx++
	}
	if len(updates) <= 1 {
		return r.GetChannel(ctx, tenantID, id)
	}

	query := fmt.Sprintf(`
UPDATE notification_channels
SET %s
WHERE id = $1::uuid AND tenant_id = $2::uuid
RETURNING id::text, tenant_id::text, name, type, config, enabled, created_by::text, created_at, updated_at
`, strings.Join(updates, ", "))

	var ch Channel
	var createdBy sql.NullString
	err = r.db.QueryRowContext(ctx, query, args...).Scan(
		&ch.ID,
		&ch.TenantID,
		&ch.Name,
		&ch.Type,
		&ch.Config,
		&ch.Enabled,
		&createdBy,
		&ch.CreatedAt,
		&ch.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Channel{}, ErrChannelNotFound
		}
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return Channel{}, ErrChannelNameConflict
		}
		return Channel{}, fmt.Errorf("update channel: %w", err)
	}
	ch.CreatedBy = createdBy
	ch.CreatedAt = ch.CreatedAt.UTC()
	ch.UpdatedAt = ch.UpdatedAt.UTC()
	return ch, nil
}

// DeleteChannel deletes a channel.
func (r *ChannelRepository) DeleteChannel(ctx context.Context, tenantID, id string) error {
	tenantID = strings.TrimSpace(tenantID)
	id = strings.TrimSpace(id)
	if tenantID == "" || id == "" {
		return fmt.Errorf("tenant_id and id are required")
	}

	res, err := r.db.ExecContext(ctx,
		`DELETE FROM notification_channels WHERE id = $1::uuid AND tenant_id = $2::uuid`,
		id, tenantID,
	)
	if err != nil {
		return fmt.Errorf("delete channel: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrChannelNotFound
	}
	return nil
}

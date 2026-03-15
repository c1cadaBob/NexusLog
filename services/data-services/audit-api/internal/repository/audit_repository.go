// Package repository 提供 audit-api 的数据访问层
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

var (
	ErrAuditNotFound = errors.New("audit log not found")
)

// AuditLog 表示审计日志记录
type AuditLog struct {
	ID           string
	TenantID     string
	UserID       string
	Action       string
	ResourceType string
	ResourceID   string
	Detail       map[string]any
	IPAddress    string
	UserAgent    string
	CreatedAt    time.Time
}

// ListAuditLogsInput 审计日志列表过滤参数
type ListAuditLogsInput struct {
	TenantID          string
	BypassTenantScope bool
	UserID            *string
	Action            *string
	ResourceType      *string
	FromTime          *time.Time
	ToTime            *time.Time
	Page              int
	PageSize          int
	SortBy            string
	SortOrder         string
}

// ListAuditLogsOutput 审计日志列表输出
type ListAuditLogsOutput struct {
	Items []AuditLog
	Total int64
}

// AuditRepository 提供 audit_logs 表的持久化
type AuditRepository struct {
	db *sql.DB
}

// NewAuditRepository 创建审计仓储实例
func NewAuditRepository(db *sql.DB) *AuditRepository {
	return &AuditRepository{db: db}
}

// IsConfigured 判断仓储是否可用
func (r *AuditRepository) IsConfigured() bool {
	return r != nil && r.db != nil
}

// ListAuditLogs 按过滤条件分页返回审计日志
func (r *AuditRepository) ListAuditLogs(ctx context.Context, in ListAuditLogsInput) (ListAuditLogsOutput, error) {
	if !r.IsConfigured() {
		return ListAuditLogsOutput{}, fmt.Errorf("audit repository is not configured")
	}
	page := normalizePage(in.Page)
	pageSize := normalizePageSize(in.PageSize)
	offset := (page - 1) * pageSize
	sortBy := normalizeSortBy(in.SortBy)
	sortOrder := normalizeSortOrder(in.SortOrder)

	countQuery := `
SELECT COUNT(1)
FROM audit_logs
WHERE ($1::uuid IS NULL OR tenant_id = $1::uuid)
  AND ($2::uuid IS NULL OR user_id = $2)
  AND ($3::text IS NULL OR action = $3)
  AND ($4::text IS NULL OR resource_type = $4)
  AND ($5::timestamptz IS NULL OR created_at >= $5)
  AND ($6::timestamptz IS NULL OR created_at <= $6)
`
	var total int64
	tenantScope := auditTenantScopeArg(strings.TrimSpace(in.TenantID), in.BypassTenantScope)
	if tenantScope == nil && !in.BypassTenantScope {
		return ListAuditLogsOutput{}, fmt.Errorf("tenant_id is required")
	}
	err := r.db.QueryRowContext(ctx, countQuery,
		tenantScope,
		nullableStringPtr(in.UserID),
		nullableStringPtr(in.Action),
		nullableStringPtr(in.ResourceType),
		in.FromTime,
		in.ToTime,
	).Scan(&total)
	if err != nil {
		return ListAuditLogsOutput{}, fmt.Errorf("count audit logs: %w", err)
	}

	listQuery := fmt.Sprintf(`
SELECT
	id::text,
	tenant_id::text,
	user_id::text,
	action,
	resource_type,
	resource_id,
	details,
	ip_address::text,
	user_agent,
	created_at
FROM audit_logs
WHERE ($1::uuid IS NULL OR tenant_id = $1::uuid)
  AND ($2::uuid IS NULL OR user_id = $2)
  AND ($3::text IS NULL OR action = $3)
  AND ($4::text IS NULL OR resource_type = $4)
  AND ($5::timestamptz IS NULL OR created_at >= $5)
  AND ($6::timestamptz IS NULL OR created_at <= $6)
ORDER BY %s %s
OFFSET $7 LIMIT $8
`, sortBy, sortOrder)

	rows, err := r.db.QueryContext(ctx, listQuery,
		tenantScope,
		nullableStringPtr(in.UserID),
		nullableStringPtr(in.Action),
		nullableStringPtr(in.ResourceType),
		in.FromTime,
		in.ToTime,
		offset,
		pageSize,
	)
	if err != nil {
		return ListAuditLogsOutput{}, fmt.Errorf("list audit logs: %w", err)
	}
	defer rows.Close()

	items := make([]AuditLog, 0, pageSize)
	for rows.Next() {
		var log AuditLog
		var detailsRaw []byte
		var tenantID, userID, resourceID, ipAddr sql.NullString
		if err := rows.Scan(
			&log.ID,
			&tenantID,
			&userID,
			&log.Action,
			&log.ResourceType,
			&resourceID,
			&detailsRaw,
			&ipAddr,
			&log.UserAgent,
			&log.CreatedAt,
		); err != nil {
			return ListAuditLogsOutput{}, fmt.Errorf("scan audit log: %w", err)
		}
		if tenantID.Valid {
			log.TenantID = tenantID.String
		}
		if userID.Valid {
			log.UserID = userID.String
		}
		if resourceID.Valid {
			log.ResourceID = resourceID.String
		}
		if ipAddr.Valid {
			log.IPAddress = ipAddr.String
		}
		if len(detailsRaw) > 0 {
			_ = json.Unmarshal(detailsRaw, &log.Detail)
		}
		if log.Detail == nil {
			log.Detail = map[string]any{}
		}
		log.CreatedAt = log.CreatedAt.UTC()
		items = append(items, log)
	}
	if err := rows.Err(); err != nil {
		return ListAuditLogsOutput{}, fmt.Errorf("iterate audit logs: %w", err)
	}
	return ListAuditLogsOutput{Items: items, Total: total}, nil
}

func normalizePage(page int) int {
	if page <= 0 {
		return 1
	}
	return page
}

func normalizePageSize(pageSize int) int {
	switch {
	case pageSize <= 0:
		return 20
	case pageSize > 200:
		return 200
	default:
		return pageSize
	}
}

func normalizeSortBy(sortBy string) string {
	sortBy = strings.TrimSpace(strings.ToLower(sortBy))
	switch sortBy {
	case "created_at", "action", "resource_type", "user_id":
		return sortBy
	default:
		return "created_at"
	}
}

func normalizeSortOrder(order string) string {
	order = strings.TrimSpace(strings.ToLower(order))
	if order == "asc" {
		return "ASC"
	}
	return "DESC"
}

func auditTenantScopeArg(tenantID string, bypassTenantScope bool) any {
	if bypassTenantScope {
		return nil
	}
	if tenantID == "" {
		return nil
	}
	return tenantID
}

func nullableStringPtr(s *string) any {
	if s == nil {
		return nil
	}
	v := strings.TrimSpace(*s)
	if v == "" {
		return nil
	}
	return v
}

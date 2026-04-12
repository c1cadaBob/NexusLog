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

	"github.com/lib/pq"
	sharedauth "github.com/nexuslog/data-services/shared/auth"
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
	TenantID            string
	TenantReadScope     sharedauth.TenantReadScope
	AuthorizedTenantIDs []string
	UserID              *string
	Action              *string
	ResourceType        *string
	FromTime            *time.Time
	ToTime              *time.Time
	Page                int
	PageSize            int
	SortBy              string
	SortOrder           string
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

	whereClause, whereArgs, err := buildAuditLogWhereClause(in)
	if err != nil {
		return ListAuditLogsOutput{}, err
	}
	countQuery := `
SELECT COUNT(1)
FROM audit_logs
WHERE ` + whereClause
	var total int64
	err = r.db.QueryRowContext(ctx, countQuery, whereArgs...).Scan(&total)
	if err != nil {
		return ListAuditLogsOutput{}, fmt.Errorf("count audit logs: %w", err)
	}

	listArgs := append(append([]any{}, whereArgs...), offset, pageSize)
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
WHERE %s
ORDER BY %s %s
OFFSET $%d LIMIT $%d
`, whereClause, sortBy, sortOrder, len(whereArgs)+1, len(whereArgs)+2)

	items, err := r.queryAuditLogs(ctx, listQuery, pageSize, listArgs...)
	if err != nil {
		return ListAuditLogsOutput{}, err
	}
	return ListAuditLogsOutput{Items: items, Total: total}, nil
}

// ListAuditLogsForExport 返回导出用的审计日志集合。
func (r *AuditRepository) ListAuditLogsForExport(ctx context.Context, in ListAuditLogsInput, limit int) ([]AuditLog, error) {
	if !r.IsConfigured() {
		return nil, fmt.Errorf("audit repository is not configured")
	}
	if limit <= 0 {
		limit = 10000
	}
	if limit > 50000 {
		limit = 50000
	}

	whereClause, whereArgs, err := buildAuditLogWhereClause(in)
	if err != nil {
		return nil, err
	}
	sortBy := normalizeSortBy(in.SortBy)
	sortOrder := normalizeSortOrder(in.SortOrder)
	queryArgs := append(append([]any{}, whereArgs...), limit)
	query := fmt.Sprintf(`
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
WHERE %s
ORDER BY %s %s
LIMIT $%d
`, whereClause, sortBy, sortOrder, len(whereArgs)+1)

	return r.queryAuditLogs(ctx, query, limit, queryArgs...)
}

func (r *AuditRepository) queryAuditLogs(ctx context.Context, query string, capacity int, args ...any) ([]AuditLog, error) {
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list audit logs: %w", err)
	}
	defer rows.Close()

	items := make([]AuditLog, 0, capacity)
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
			return nil, fmt.Errorf("scan audit log: %w", err)
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
		return nil, fmt.Errorf("iterate audit logs: %w", err)
	}
	return items, nil
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

func buildAuditLogWhereClause(in ListAuditLogsInput) (string, []any, error) {
	clauses := make([]string, 0, 6)
	args := make([]any, 0, 6)

	authorizedTenantSet, err := sharedauth.ResolveAuthorizedTenantSet(in.TenantID, in.TenantReadScope, in.AuthorizedTenantIDs)
	if err != nil {
		return "", nil, err
	}
	if !authorizedTenantSet.AllowsAllTenants() {
		tenantIDs := authorizedTenantSet.TenantIDs()
		switch len(tenantIDs) {
		case 0:
			return "", nil, sharedauth.ErrAuthorizedTenantSetRequired
		case 1:
			args = append(args, tenantIDs[0])
			clauses = append(clauses, fmt.Sprintf("tenant_id = $%d::uuid", len(args)))
		default:
			args = append(args, pq.Array(tenantIDs))
			clauses = append(clauses, fmt.Sprintf("tenant_id = ANY($%d::uuid[])", len(args)))
		}
	}
	if userID := nullableStringPtr(in.UserID); userID != nil {
		args = append(args, userID)
		clauses = append(clauses, fmt.Sprintf("user_id = $%d::uuid", len(args)))
	}
	if action := nullableStringPtr(in.Action); action != nil {
		args = append(args, action)
		clauses = append(clauses, fmt.Sprintf("action = $%d::text", len(args)))
	}
	if resourceType := nullableStringPtr(in.ResourceType); resourceType != nil {
		args = append(args, resourceType)
		clauses = append(clauses, fmt.Sprintf("resource_type = $%d::text", len(args)))
	}
	if in.FromTime != nil {
		args = append(args, in.FromTime)
		clauses = append(clauses, fmt.Sprintf("created_at >= $%d::timestamptz", len(args)))
	}
	if in.ToTime != nil {
		args = append(args, in.ToTime)
		clauses = append(clauses, fmt.Sprintf("created_at <= $%d::timestamptz", len(args)))
	}
	if len(clauses) == 0 {
		return "1=1", args, nil
	}
	return strings.Join(clauses, "\n  AND "), args, nil
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

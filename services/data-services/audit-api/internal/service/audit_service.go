// Package service 提供 audit-api 的业务逻辑层
package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/nexuslog/data-services/audit-api/internal/repository"
	sharedauth "github.com/nexuslog/data-services/shared/auth"
)

const maxAuditExportRows = 10000

// AuditLogItem 审计日志项（API 响应）
type AuditLogItem struct {
	ID           string         `json:"id"`
	TenantID     string         `json:"tenant_id"`
	UserID       string         `json:"user_id"`
	Action       string         `json:"action"`
	ResourceType string         `json:"resource_type"`
	ResourceID   string         `json:"resource_id"`
	Detail       map[string]any `json:"detail"`
	IPAddress    string         `json:"ip_address"`
	UserAgent    string         `json:"user_agent"`
	CreatedAt    string         `json:"created_at"`
}

// ListAuditLogsRequest 审计日志列表请求参数
type ListAuditLogsRequest struct {
	UserID       string
	Action       string
	ResourceType string
	From         string
	To           string
	Page         int
	PageSize     int
	SortBy       string
	SortOrder    string
}

// ExportAuditLogsRequest 审计日志导出请求参数。
type ExportAuditLogsRequest struct {
	UserID       string
	Action       string
	ResourceType string
	From         string
	To           string
	SortBy       string
	SortOrder    string
	Format       string
}

// ExportAuditLogsResult 审计日志导出结果。
type ExportAuditLogsResult struct {
	Format   string
	FileName string
	Items    []AuditLogItem
}

// ListAuditLogsResult 审计日志列表结果
type ListAuditLogsResult struct {
	Items    []AuditLogItem
	Total    int64
	Page     int
	PageSize int
}

// AuditService 封装审计日志业务逻辑
type AuditService struct {
	repo *repository.AuditRepository
}

// NewAuditService 创建审计服务实例
func NewAuditService(repo *repository.AuditRepository) *AuditService {
	return &AuditService{repo: repo}
}

// RequestActor 描述一次审计查询请求的调用身份。
type RequestActor struct {
	TenantID            string
	TenantReadScope     sharedauth.TenantReadScope
	AuthorizedTenantIDs []string
}

// ListAuditLogs 分页查询审计日志
func (s *AuditService) ListAuditLogs(ctx context.Context, actor RequestActor, req ListAuditLogsRequest) (ListAuditLogsResult, error) {
	if s == nil || s.repo == nil || !s.repo.IsConfigured() {
		return ListAuditLogsResult{}, fmt.Errorf("audit service is not configured")
	}
	actor = normalizeActor(actor)
	if _, err := sharedauth.ResolveAuthorizedTenantSet(actor.TenantID, actor.TenantReadScope, actor.AuthorizedTenantIDs); err != nil {
		return ListAuditLogsResult{}, err
	}
	page := req.Page
	if page <= 0 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 200 {
		pageSize = 200
	}

	output, err := s.repo.ListAuditLogs(ctx, buildListInput(actor, req.UserID, req.Action, req.ResourceType, req.From, req.To, page, pageSize, req.SortBy, req.SortOrder))
	if err != nil {
		return ListAuditLogsResult{}, err
	}

	items := make([]AuditLogItem, 0, len(output.Items))
	for _, log := range output.Items {
		items = append(items, mapAuditLogItem(log))
	}
	return ListAuditLogsResult{
		Items:    items,
		Total:    output.Total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// ExportAuditLogs 查询并返回导出数据。
func (s *AuditService) ExportAuditLogs(ctx context.Context, actor RequestActor, req ExportAuditLogsRequest) (ExportAuditLogsResult, error) {
	if s == nil || s.repo == nil || !s.repo.IsConfigured() {
		return ExportAuditLogsResult{}, fmt.Errorf("audit service is not configured")
	}
	actor = normalizeActor(actor)
	if _, err := sharedauth.ResolveAuthorizedTenantSet(actor.TenantID, actor.TenantReadScope, actor.AuthorizedTenantIDs); err != nil {
		return ExportAuditLogsResult{}, err
	}
	format := strings.ToLower(strings.TrimSpace(req.Format))
	if format == "" {
		format = "csv"
	}
	if format != "csv" && format != "json" {
		return ExportAuditLogsResult{}, fmt.Errorf("invalid export format")
	}

	logs, err := s.repo.ListAuditLogsForExport(ctx, buildListInput(actor, req.UserID, req.Action, req.ResourceType, req.From, req.To, 1, maxAuditExportRows, req.SortBy, req.SortOrder), maxAuditExportRows)
	if err != nil {
		return ExportAuditLogsResult{}, err
	}

	items := make([]AuditLogItem, 0, len(logs))
	for _, log := range logs {
		items = append(items, mapAuditLogItem(log))
	}
	stamp := time.Now().UTC().Format("20060102-150405")
	return ExportAuditLogsResult{
		Format:   format,
		FileName: fmt.Sprintf("nexuslog-audit-%s.%s", stamp, format),
		Items:    items,
	}, nil
}

func buildListInput(
	actor RequestActor,
	userID string,
	action string,
	resourceType string,
	from string,
	to string,
	page int,
	pageSize int,
	sortBy string,
	sortOrder string,
) repository.ListAuditLogsInput {
	fromTime, _ := parseOptionalTime(from)
	toTime, _ := parseOptionalTime(to)

	var userIDPtr, actionPtr, resourceTypePtr *string
	if v := strings.TrimSpace(userID); v != "" {
		userIDPtr = &v
	}
	if v := strings.TrimSpace(action); v != "" {
		actionPtr = &v
	}
	if v := strings.TrimSpace(resourceType); v != "" {
		resourceTypePtr = &v
	}

	return repository.ListAuditLogsInput{
		TenantID:            actor.TenantID,
		TenantReadScope:     actor.TenantReadScope,
		AuthorizedTenantIDs: actor.AuthorizedTenantIDs,
		UserID:              userIDPtr,
		Action:              actionPtr,
		ResourceType:        resourceTypePtr,
		FromTime:            fromTime,
		ToTime:              toTime,
		Page:                page,
		PageSize:            pageSize,
		SortBy:              strings.TrimSpace(sortBy),
		SortOrder:           strings.TrimSpace(sortOrder),
	}
}

func mapAuditLogItem(log repository.AuditLog) AuditLogItem {
	return AuditLogItem{
		ID:           log.ID,
		TenantID:     log.TenantID,
		UserID:       log.UserID,
		Action:       log.Action,
		ResourceType: log.ResourceType,
		ResourceID:   log.ResourceID,
		Detail:       log.Detail,
		IPAddress:    log.IPAddress,
		UserAgent:    log.UserAgent,
		CreatedAt:    log.CreatedAt.UTC().Format(time.RFC3339),
	}
}

func normalizeActor(actor RequestActor) RequestActor {
	return RequestActor{
		TenantID:            strings.TrimSpace(actor.TenantID),
		TenantReadScope:     sharedauth.NormalizeTenantReadScope(actor.TenantReadScope),
		AuthorizedTenantIDs: sharedauth.NormalizeAuthorizedTenantIDs(actor.AuthorizedTenantIDs),
	}
}

func parseOptionalTime(raw string) (*time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	layouts := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
		"2006-01-02",
	}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, raw); err == nil {
			v := parsed.UTC()
			return &v, nil
		}
	}
	return nil, fmt.Errorf("unsupported time format: %s", raw)
}

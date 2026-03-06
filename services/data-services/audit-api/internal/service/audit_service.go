// Package service 提供 audit-api 的业务逻辑层
package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/nexuslog/data-services/audit-api/internal/repository"
)

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

// ListAuditLogs 分页查询审计日志
func (s *AuditService) ListAuditLogs(ctx context.Context, tenantID string, req ListAuditLogsRequest) (ListAuditLogsResult, error) {
	if s == nil || s.repo == nil || !s.repo.IsConfigured() {
		return ListAuditLogsResult{}, fmt.Errorf("audit service is not configured")
	}
	tenantID = strings.TrimSpace(tenantID)
	if tenantID == "" {
		return ListAuditLogsResult{}, fmt.Errorf("tenant_id is required")
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

	fromTime, _ := parseOptionalTime(req.From)
	toTime, _ := parseOptionalTime(req.To)

	var userID, action, resourceType *string
	if v := strings.TrimSpace(req.UserID); v != "" {
		userID = &v
	}
	if v := strings.TrimSpace(req.Action); v != "" {
		action = &v
	}
	if v := strings.TrimSpace(req.ResourceType); v != "" {
		resourceType = &v
	}

	output, err := s.repo.ListAuditLogs(ctx, repository.ListAuditLogsInput{
		TenantID:     tenantID,
		UserID:       userID,
		Action:       action,
		ResourceType: resourceType,
		FromTime:     fromTime,
		ToTime:       toTime,
		Page:         page,
		PageSize:     pageSize,
		SortBy:       strings.TrimSpace(req.SortBy),
		SortOrder:    strings.TrimSpace(req.SortOrder),
	})
	if err != nil {
		return ListAuditLogsResult{}, err
	}

	items := make([]AuditLogItem, 0, len(output.Items))
	for _, log := range output.Items {
		items = append(items, AuditLogItem{
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
		})
	}
	return ListAuditLogsResult{
		Items:    items,
		Total:    output.Total,
		Page:     page,
		PageSize: pageSize,
	}, nil
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

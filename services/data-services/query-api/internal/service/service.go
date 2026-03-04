// Package service 提供 query-api 的业务逻辑层。
package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/nexuslog/data-services/query-api/internal/repository"
)

const (
	// DefaultPageSize 定义默认分页大小。
	DefaultPageSize = 50
	// MaxPageSize 定义最大分页大小，避免单次查询过重。
	MaxPageSize = 200
	// DefaultTenantID 用于请求缺失租户上下文时兜底。
	DefaultTenantID = "00000000-0000-0000-0000-000000000001"
)

var (
	// ErrMetadataNotConfigured 表示元数据仓储未启用。
	ErrMetadataNotConfigured = errors.New("query metadata store is not configured")
	// ErrUserContextRequired 表示接口调用缺少用户上下文。
	ErrUserContextRequired = errors.New("user context is required")
	// ErrInvalidSavedQuery 表示收藏查询参数非法。
	ErrInvalidSavedQuery = errors.New("invalid saved query payload")
)

// RequestActor 描述一次查询请求的调用身份。
type RequestActor struct {
	TenantID string
	UserID   string
}

// TimeRange 定义时间范围查询参数。
type TimeRange struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// SortField 定义排序字段。
type SortField struct {
	Field string `json:"field"`
	Order string `json:"order"`
}

// SearchLogsRequest 定义日志查询请求。
type SearchLogsRequest struct {
	TimeRange TimeRange      `json:"time_range"`
	Keywords  string         `json:"keywords"`
	Filters   map[string]any `json:"filters"`
	Sort      []SortField    `json:"sort"`
	Page      int            `json:"page"`
	PageSize  int            `json:"page_size"`
}

// SearchLogHit 定义单条日志查询结果。
type SearchLogHit struct {
	ID        string         `json:"id"`
	Timestamp string         `json:"timestamp"`
	Level     string         `json:"level"`
	Service   string         `json:"service"`
	Message   string         `json:"message"`
	RawLog    string         `json:"raw_log,omitempty"`
	Fields    map[string]any `json:"fields,omitempty"`
}

// SearchLogsResult 定义日志查询结果集合。
type SearchLogsResult struct {
	Hits         []SearchLogHit `json:"hits"`
	Aggregations map[string]any `json:"aggregations,omitempty"`
	Total        int64          `json:"total"`
	Page         int            `json:"page"`
	PageSize     int            `json:"page_size"`
	QueryTimeMS  int            `json:"query_time_ms"`
	TimedOut     bool           `json:"timed_out"`
}

// ListQueryHistoriesRequest 定义查询历史列表请求参数。
type ListQueryHistoriesRequest struct {
	Keyword   string
	TimeRange TimeRange
	Page      int
	PageSize  int
}

// QueryHistoryItem 定义查询历史项。
type QueryHistoryItem struct {
	ID          string `json:"id"`
	Query       string `json:"query"`
	ExecutedAt  string `json:"executed_at"`
	DurationMS  int    `json:"duration_ms"`
	ResultCount int64  `json:"result_count"`
	Status      string `json:"status"`
}

// ListQueryHistoriesResult 定义查询历史列表返回。
type ListQueryHistoriesResult struct {
	Items    []QueryHistoryItem
	Total    int64
	Page     int
	PageSize int
}

// ListSavedQueriesRequest 定义收藏查询列表请求参数。
type ListSavedQueriesRequest struct {
	Tag      string
	Keyword  string
	Page     int
	PageSize int
}

// UpsertSavedQueryRequest 定义创建/更新收藏查询参数。
type UpsertSavedQueryRequest struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Query       string         `json:"query"`
	Filters     map[string]any `json:"filters"`
	Tags        []string       `json:"tags"`
}

// SavedQueryItem 定义收藏查询项。
type SavedQueryItem struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Query     string   `json:"query"`
	Tags      []string `json:"tags"`
	RunCount  int64    `json:"run_count"`
	CreatedAt string   `json:"created_at"`
	UpdatedAt string   `json:"updated_at"`
}

// ListSavedQueriesResult 定义收藏查询列表返回。
type ListSavedQueriesResult struct {
	Items    []SavedQueryItem
	Total    int64
	Page     int
	PageSize int
}

// QueryService 封装日志查询业务逻辑。
type QueryService struct {
	logRepo      *repository.ElasticsearchRepository
	metadataRepo *repository.QueryMetadataRepository
}

// NewQueryService 创建查询服务实例。
func NewQueryService(
	logRepo *repository.ElasticsearchRepository,
	metadataRepo *repository.QueryMetadataRepository,
) *QueryService {
	return &QueryService{
		logRepo:      logRepo,
		metadataRepo: metadataRepo,
	}
}

// SearchLogs 执行日志查询并映射成前端可直接消费的数据结构。
func (s *QueryService) SearchLogs(ctx context.Context, actor RequestActor, req SearchLogsRequest) (SearchLogsResult, error) {
	if s == nil || s.logRepo == nil {
		return SearchLogsResult{}, fmt.Errorf("query service is not configured")
	}

	actor = normalizeActor(actor)
	page := req.Page
	if page <= 0 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = DefaultPageSize
	}
	if pageSize > MaxPageSize {
		pageSize = MaxPageSize
	}

	repoResult, err := s.logRepo.SearchLogs(ctx, repository.SearchLogsInput{
		Keywords:      strings.TrimSpace(req.Keywords),
		TimeRangeFrom: strings.TrimSpace(req.TimeRange.From),
		TimeRangeTo:   strings.TrimSpace(req.TimeRange.To),
		Filters:       req.Filters,
		Sort:          toRepositorySort(req.Sort),
		Page:          page,
		PageSize:      pageSize,
	})
	if err != nil {
		s.tryRecordQueryHistory(ctx, actor, req, SearchLogsResult{
			Page:     page,
			PageSize: pageSize,
		}, err)
		return SearchLogsResult{}, err
	}

	hits := make([]SearchLogHit, 0, len(repoResult.Hits))
	for _, item := range repoResult.Hits {
		hits = append(hits, mapRawHit(item))
	}

	result := SearchLogsResult{
		Hits:         hits,
		Aggregations: repoResult.Aggregations,
		Total:        repoResult.Total,
		Page:         page,
		PageSize:     pageSize,
		QueryTimeMS:  repoResult.TookMS,
		TimedOut:     repoResult.TimedOut,
	}
	s.tryRecordQueryHistory(ctx, actor, req, result, nil)
	return result, nil
}

// ListQueryHistories 返回历史查询列表。
func (s *QueryService) ListQueryHistories(
	ctx context.Context,
	actor RequestActor,
	req ListQueryHistoriesRequest,
) (ListQueryHistoriesResult, error) {
	if s == nil || s.metadataRepo == nil || !s.metadataRepo.IsConfigured() {
		return ListQueryHistoriesResult{}, ErrMetadataNotConfigured
	}
	actor = normalizeActor(actor)
	if actor.UserID == "" {
		return ListQueryHistoriesResult{}, ErrUserContextRequired
	}

	page := req.Page
	if page <= 0 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = DefaultPageSize
	}
	if pageSize > MaxPageSize {
		pageSize = MaxPageSize
	}

	from, _ := parseOptionalTime(req.TimeRange.From)
	to, _ := parseOptionalTime(req.TimeRange.To)
	output, err := s.metadataRepo.ListQueryHistories(ctx, repository.ListQueryHistoriesInput{
		TenantID:       actor.TenantID,
		UserID:         actor.UserID,
		Keyword:        strings.TrimSpace(req.Keyword),
		TimeRangeStart: from,
		TimeRangeEnd:   to,
		Page:           page,
		PageSize:       pageSize,
	})
	if err != nil {
		return ListQueryHistoriesResult{}, err
	}

	items := make([]QueryHistoryItem, 0, len(output.Items))
	for _, item := range output.Items {
		items = append(items, QueryHistoryItem{
			ID:          item.ID,
			Query:       item.QueryText,
			ExecutedAt:  item.CreatedAt.UTC().Format(time.RFC3339),
			DurationMS:  item.DurationMS,
			ResultCount: item.ResultCount,
			Status:      item.Status,
		})
	}
	return ListQueryHistoriesResult{
		Items:    items,
		Total:    output.Total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// DeleteQueryHistory 删除指定查询历史。
func (s *QueryService) DeleteQueryHistory(ctx context.Context, actor RequestActor, historyID string) (bool, error) {
	if s == nil || s.metadataRepo == nil || !s.metadataRepo.IsConfigured() {
		return false, ErrMetadataNotConfigured
	}
	actor = normalizeActor(actor)
	if actor.UserID == "" {
		return false, ErrUserContextRequired
	}
	deleted, err := s.metadataRepo.DeleteQueryHistory(ctx, actor.TenantID, actor.UserID, strings.TrimSpace(historyID))
	if err != nil {
		return false, err
	}
	return deleted, nil
}

// ListSavedQueries 返回收藏查询列表。
func (s *QueryService) ListSavedQueries(
	ctx context.Context,
	actor RequestActor,
	req ListSavedQueriesRequest,
) (ListSavedQueriesResult, error) {
	if s == nil || s.metadataRepo == nil || !s.metadataRepo.IsConfigured() {
		return ListSavedQueriesResult{}, ErrMetadataNotConfigured
	}
	actor = normalizeActor(actor)
	if actor.UserID == "" {
		return ListSavedQueriesResult{}, ErrUserContextRequired
	}

	page := req.Page
	if page <= 0 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = DefaultPageSize
	}
	if pageSize > MaxPageSize {
		pageSize = MaxPageSize
	}

	output, err := s.metadataRepo.ListSavedQueries(ctx, repository.ListSavedQueriesInput{
		TenantID: actor.TenantID,
		UserID:   actor.UserID,
		Tag:      strings.TrimSpace(req.Tag),
		Keyword:  strings.TrimSpace(req.Keyword),
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		return ListSavedQueriesResult{}, err
	}
	items := make([]SavedQueryItem, 0, len(output.Items))
	for _, item := range output.Items {
		items = append(items, SavedQueryItem{
			ID:        item.ID,
			Name:      item.Name,
			Query:     item.QueryText,
			Tags:      item.Tags,
			RunCount:  item.RunCount,
			CreatedAt: item.CreatedAt.UTC().Format(time.RFC3339),
			UpdatedAt: item.UpdatedAt.UTC().Format(time.RFC3339),
		})
	}
	return ListSavedQueriesResult{
		Items:    items,
		Total:    output.Total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// CreateSavedQuery 创建收藏查询。
func (s *QueryService) CreateSavedQuery(
	ctx context.Context,
	actor RequestActor,
	req UpsertSavedQueryRequest,
) (SavedQueryItem, error) {
	if s == nil || s.metadataRepo == nil || !s.metadataRepo.IsConfigured() {
		return SavedQueryItem{}, ErrMetadataNotConfigured
	}
	actor = normalizeActor(actor)
	if actor.UserID == "" {
		return SavedQueryItem{}, ErrUserContextRequired
	}
	name := strings.TrimSpace(req.Name)
	queryText := strings.TrimSpace(req.Query)
	if name == "" || queryText == "" {
		return SavedQueryItem{}, ErrInvalidSavedQuery
	}

	created, err := s.metadataRepo.CreateSavedQuery(ctx, repository.SavedQueryCreateInput{
		TenantID:    actor.TenantID,
		UserID:      actor.UserID,
		Name:        name,
		Description: strings.TrimSpace(req.Description),
		QueryText:   queryText,
		Filters:     req.Filters,
		Tags:        req.Tags,
		Now:         time.Now().UTC(),
	})
	if err != nil {
		return SavedQueryItem{}, err
	}
	return SavedQueryItem{
		ID:        created.ID,
		Name:      created.Name,
		Query:     created.QueryText,
		Tags:      created.Tags,
		RunCount:  created.RunCount,
		CreatedAt: created.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt: created.UpdatedAt.UTC().Format(time.RFC3339),
	}, nil
}

// UpdateSavedQuery 更新收藏查询。
func (s *QueryService) UpdateSavedQuery(
	ctx context.Context,
	actor RequestActor,
	savedQueryID string,
	req UpsertSavedQueryRequest,
) (SavedQueryItem, error) {
	if s == nil || s.metadataRepo == nil || !s.metadataRepo.IsConfigured() {
		return SavedQueryItem{}, ErrMetadataNotConfigured
	}
	actor = normalizeActor(actor)
	if actor.UserID == "" {
		return SavedQueryItem{}, ErrUserContextRequired
	}
	savedQueryID = strings.TrimSpace(savedQueryID)
	if savedQueryID == "" {
		return SavedQueryItem{}, ErrInvalidSavedQuery
	}

	name := strings.TrimSpace(req.Name)
	queryText := strings.TrimSpace(req.Query)
	if name == "" || queryText == "" {
		return SavedQueryItem{}, ErrInvalidSavedQuery
	}
	nameCopy := name
	descriptionCopy := strings.TrimSpace(req.Description)
	queryCopy := queryText
	filtersCopy := req.Filters
	tagsCopy := req.Tags
	updated, err := s.metadataRepo.UpdateSavedQuery(ctx, repository.SavedQueryUpdateInput{
		TenantID:     actor.TenantID,
		UserID:       actor.UserID,
		SavedQueryID: savedQueryID,
		Name:         &nameCopy,
		Description:  &descriptionCopy,
		QueryText:    &queryCopy,
		Filters:      &filtersCopy,
		Tags:         &tagsCopy,
		Now:          time.Now().UTC(),
	})
	if err != nil {
		return SavedQueryItem{}, err
	}
	return SavedQueryItem{
		ID:        updated.ID,
		Name:      updated.Name,
		Query:     updated.QueryText,
		Tags:      updated.Tags,
		RunCount:  updated.RunCount,
		CreatedAt: updated.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt: updated.UpdatedAt.UTC().Format(time.RFC3339),
	}, nil
}

// DeleteSavedQuery 删除收藏查询。
func (s *QueryService) DeleteSavedQuery(ctx context.Context, actor RequestActor, savedQueryID string) (bool, error) {
	if s == nil || s.metadataRepo == nil || !s.metadataRepo.IsConfigured() {
		return false, ErrMetadataNotConfigured
	}
	actor = normalizeActor(actor)
	if actor.UserID == "" {
		return false, ErrUserContextRequired
	}
	deleted, err := s.metadataRepo.DeleteSavedQuery(ctx, actor.TenantID, actor.UserID, strings.TrimSpace(savedQueryID))
	if err != nil {
		return false, err
	}
	return deleted, nil
}

func (s *QueryService) tryRecordQueryHistory(
	ctx context.Context,
	actor RequestActor,
	req SearchLogsRequest,
	result SearchLogsResult,
	queryErr error,
) {
	if s == nil || s.metadataRepo == nil || !s.metadataRepo.IsConfigured() {
		return
	}
	actor = normalizeActor(actor)

	queryText := strings.TrimSpace(req.Keywords)
	if queryText == "" {
		queryText = buildQueryText(req)
	}
	if queryText == "" {
		queryText = "(empty query)"
	}

	status := "success"
	errorMessage := ""
	if queryErr != nil {
		status = "failed"
		errorMessage = queryErr.Error()
	} else if result.TimedOut {
		status = "timeout"
	}

	timeRangeFrom, _ := parseOptionalTime(req.TimeRange.From)
	timeRangeTo, _ := parseOptionalTime(req.TimeRange.To)
	historyFilters := map[string]any{
		"filters": req.Filters,
		"sort":    req.Sort,
	}
	if req.TimeRange.From != "" || req.TimeRange.To != "" {
		historyFilters["time_range"] = map[string]string{
			"from": req.TimeRange.From,
			"to":   req.TimeRange.To,
		}
	}

	_ = s.metadataRepo.CreateQueryHistory(ctx, repository.QueryHistoryCreateInput{
		TenantID:       actor.TenantID,
		UserID:         actor.UserID,
		QueryText:      queryText,
		QueryHash:      hashQueryPayload(req),
		Filters:        historyFilters,
		TimeRangeStart: timeRangeFrom,
		TimeRangeEnd:   timeRangeTo,
		ResultCount:    result.Total,
		DurationMS:     result.QueryTimeMS,
		Status:         status,
		ErrorMessage:   errorMessage,
		CreatedAt:      time.Now().UTC(),
	})
}

func buildQueryText(req SearchLogsRequest) string {
	parts := make([]string, 0, 3)
	if keywords := strings.TrimSpace(req.Keywords); keywords != "" {
		parts = append(parts, keywords)
	}
	if len(req.Filters) > 0 {
		parts = append(parts, "filters:"+marshalMapOrEmpty(req.Filters))
	}
	if req.TimeRange.From != "" || req.TimeRange.To != "" {
		parts = append(parts, fmt.Sprintf("time:[%s,%s]", req.TimeRange.From, req.TimeRange.To))
	}
	return strings.Join(parts, " ")
}

func hashQueryPayload(req SearchLogsRequest) string {
	raw, err := json.Marshal(req)
	if err != nil {
		return ""
	}
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}

func normalizeActor(actor RequestActor) RequestActor {
	tenantID := strings.TrimSpace(actor.TenantID)
	if tenantID == "" {
		tenantID = DefaultTenantID
	}
	return RequestActor{
		TenantID: tenantID,
		UserID:   strings.TrimSpace(actor.UserID),
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

func toRepositorySort(input []SortField) []repository.SortField {
	output := make([]repository.SortField, 0, len(input))
	for _, item := range input {
		output = append(output, repository.SortField{
			Field: strings.TrimSpace(item.Field),
			Order: strings.TrimSpace(item.Order),
		})
	}
	return output
}

func mapRawHit(raw repository.RawLogHit) SearchLogHit {
	fields := cloneMap(raw.Source)
	if fields == nil {
		fields = map[string]any{}
	}
	fields["_index"] = raw.Index

	timestamp := firstString(raw.Source, "@timestamp", "timestamp", "collected_at")
	message := firstString(raw.Source, "message", "data", "raw_log")
	if message == "" {
		message = marshalMapOrEmpty(raw.Source)
	}
	rawLog := firstString(raw.Source, "raw_log", "data")
	if rawLog == "" {
		rawLog = message
	}
	level := normalizeLevel(firstString(raw.Source, "level", "severity"), message)
	service := firstString(raw.Source, "service", "service_name", "app", "agent_id", "source_id")
	if service == "" {
		service = "unknown"
	}
	id := strings.TrimSpace(raw.ID)
	if id == "" {
		id = firstString(raw.Source, "record_id")
	}
	if id == "" {
		id = fmt.Sprintf("%s:%s", service, timestamp)
	}

	return SearchLogHit{
		ID:        id,
		Timestamp: timestamp,
		Level:     level,
		Service:   service,
		Message:   message,
		RawLog:    rawLog,
		Fields:    fields,
	}
}

func firstString(source map[string]any, keys ...string) string {
	for _, key := range keys {
		value, ok := source[key]
		if !ok || value == nil {
			continue
		}
		text := strings.TrimSpace(fmt.Sprintf("%v", value))
		if text != "" && text != "<nil>" {
			return text
		}
	}
	return ""
}

func normalizeLevel(rawLevel string, message string) string {
	level := strings.ToLower(strings.TrimSpace(rawLevel))
	switch level {
	case "error", "warn", "info", "debug":
		return level
	case "warning":
		return "warn"
	}

	messageLower := strings.ToLower(message)
	switch {
	case strings.Contains(messageLower, "error"),
		strings.Contains(messageLower, "fatal"),
		strings.Contains(messageLower, "panic"),
		strings.Contains(messageLower, "fail"):
		return "error"
	case strings.Contains(messageLower, "warn"):
		return "warn"
	case strings.Contains(messageLower, "debug"):
		return "debug"
	default:
		return "info"
	}
}

func cloneMap(source map[string]any) map[string]any {
	if len(source) == 0 {
		return map[string]any{}
	}
	out := make(map[string]any, len(source))
	for key, value := range source {
		out[key] = value
	}
	return out
}

func marshalMapOrEmpty(source map[string]any) string {
	if len(source) == 0 {
		return ""
	}
	raw, err := json.Marshal(source)
	if err != nil {
		return ""
	}
	return string(raw)
}

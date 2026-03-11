// Package service 提供 query-api 的业务逻辑层。
package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"path"
	"regexp"
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
	// levelTokenPattern 用于在日志正文中优先识别显式级别词。
	levelTokenPattern = regexp.MustCompile(`(?i)\b(trace|debug|info|warn(?:ing)?|error|fatal|panic)\b`)
	// ansiColorPattern 用于移除 ANSI 颜色控制序列。
	ansiColorPattern = regexp.MustCompile(`\x1b\[[0-?]*[ -/]*[@-~]`)
	// controlCharPattern 用于移除非换行/回车/制表符控制字符。
	controlCharPattern = regexp.MustCompile(`[\x00-\x08\x0B-\x1F\x7F]`)
	// rfc3164HostnamePattern 提取 RFC3164 风格 syslog 主机名。
	rfc3164HostnamePattern = regexp.MustCompile(`^[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+([^\s]+)\s+`)
	// rfc5424HostnamePattern 提取 RFC5424 风格 syslog 主机名。
	rfc5424HostnamePattern = regexp.MustCompile(`^(?:<\d{1,3}>)?\d+\s+\S+\s+([^\s]+)\s+`)
	// bogusServiceNames 用于过滤 syslog 月份被误识别为服务名的情况。
	bogusServiceNames = map[string]struct{}{
		"jan": {}, "feb": {}, "mar": {}, "apr": {}, "may": {}, "jun": {},
		"jul": {}, "aug": {}, "sep": {}, "oct": {}, "nov": {}, "dec": {},
	}
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
	TimeRange     TimeRange      `json:"time_range"`
	Keywords      string         `json:"keywords"`
	Filters       map[string]any `json:"filters"`
	Sort          []SortField    `json:"sort"`
	Page          int            `json:"page"`
	PageSize      int            `json:"page_size"`
	RecordHistory bool           `json:"record_history"`
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

	serviceHints := s.lookupServiceHintsBySourcePath(ctx, repoResult.Hits)
	hits := make([]SearchLogHit, 0, len(repoResult.Hits))
	for _, item := range repoResult.Hits {
		hits = append(hits, mapRawHitWithServiceHint(item, serviceHints[displaySourcePathFromSource(item.Source)]))
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
	if !req.RecordHistory {
		return
	}
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
	return mapRawHitWithServiceHint(raw, "")
}

func mapRawHitWithServiceHint(raw repository.RawLogHit, serviceHint string) SearchLogHit {
	fields := cloneMap(raw.Source)
	if fields == nil {
		fields = map[string]any{}
	}
	fields["_index"] = raw.Index
	populateDisplayFieldAliases(fields, raw.Source)
	normalizeSourceFieldsForDisplay(fields)

	timestamp := firstPathString(raw.Source, "@timestamp", "timestamp", "collected_at")
	sourceMessage := firstPathString(raw.Source, "message", "error.message", "data", "raw_log")
	if sourceMessage == "" {
		sourceMessage = marshalMapOrEmpty(raw.Source)
	}
	rawLog := firstPathString(raw.Source, "event.original", "error.stack_trace", "raw_log", "data", "message")
	if rawLog == "" {
		rawLog = sourceMessage
	}
	message := normalizeDisplayMessage(sourceMessage)
	if message == "" {
		message = normalizeDisplayMessage(rawLog)
	}
	if message == "" {
		message = sourceMessage
	}
	if firstString(fields, "host") == "" {
		if resolvedHost := resolveDisplayHost(raw.Source, sourceMessage, rawLog); resolvedHost != "" {
			fields["host"] = resolvedHost
		}
	}
	if firstString(fields, "host_ip") == "" {
		if resolvedHostIP := resolveDisplayHostIP(raw.Source); resolvedHostIP != "" {
			fields["host_ip"] = resolvedHostIP
		}
	}
	level := normalizeLevel(firstPathString(raw.Source, "log.level", "level", "severity", "severity.text"), sourceMessage)
	service := resolveDisplayServiceWithHint(raw.Source, serviceHint)
	fields["service_name"] = service
	fields["service"] = service
	id := strings.TrimSpace(firstPathString(raw.Source, "event.id", "event_id", "event.record_id", "record_id"))
	if id == "" {
		id = strings.TrimSpace(raw.ID)
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

func normalizeSourceFieldsForDisplay(fields map[string]any) {
	if len(fields) == 0 {
		return
	}

	sourceRaw := firstString(fields, "source")
	sourcePathRaw := firstString(fields, "source_path")
	original := sourceRaw
	if original == "" {
		original = sourcePathRaw
	}
	if original == "" {
		return
	}

	display := normalizeSourcePathForDisplay(original)
	fields["source"] = display
	fields["source_path"] = display
	if display != original {
		fields["source_internal"] = original
	}
}

func populateDisplayFieldAliases(fields map[string]any, source map[string]any) {
	if fields == nil {
		return
	}
	setAliasString(fields, "event_id", source, "event.id", "event_id")
	setAliasString(fields, "level", source, "log.level", "level", "severity")
	setAliasString(fields, "timestamp", source, "@timestamp", "timestamp")
	setAliasString(fields, "service_name", source, "service.name", "service_name", "service")
	setAliasString(fields, "service_instance_id", source, "service.instance.id")
	setAliasString(fields, "container_name", source, "container.name")
	setAliasString(fields, "agent_id", source, "agent.id", "agent_id")
	setAliasString(fields, "batch_id", source, "nexuslog.transport.batch_id", "batch_id")
	setAliasValue(fields, "sequence", source, "event.sequence", "sequence")
	setAliasString(fields, "ingested_at", source, "nexuslog.ingest.received_at", "ingested_at")
	setAliasString(fields, "schema_version", source, "nexuslog.ingest.schema_version", "schema_version")
	setAliasString(fields, "pipeline_version", source, "nexuslog.ingest.pipeline_version", "pipeline_version")
	setAliasString(fields, "tenant_id", source, "nexuslog.governance.tenant_id", "tenant_id")
	setAliasString(fields, "retention_policy", source, "nexuslog.governance.retention_policy", "retention_policy")
	setAliasValue(fields, "pii_masked", source, "nexuslog.governance.pii_masked", "pii_masked")
	setAliasString(fields, "host", source, "host.name", "hostname", "syslog_hostname", "server_id")
	if hostIP := resolveDisplayHostIP(source); hostIP != "" {
		fields["host_ip"] = hostIP
	}
	setAliasString(fields, "env", source, "service.environment", "labels.env", "env")
	setAliasString(fields, "method", source, "http.request.method", "method")
	setAliasValue(fields, "statusCode", source, "http.response.status_code", "statusCode")
	setAliasString(fields, "traceId", source, "trace.id", "traceId")
	setAliasString(fields, "spanId", source, "span.id", "spanId")
	setAliasString(fields, "error_type", source, "error.type", "error_type")
	setAliasString(fields, "error_message", source, "error.message", "error_message")
	setAliasString(fields, "raw_message", source, "event.original", "error.stack_trace", "raw_log", "raw_message")
	setAliasString(fields, "collect_time", source, "@timestamp", "collect_time")
	setAliasString(fields, "message", source, "message")

	sourceDisplay := firstPathString(source, "source.path", "log.file.path", "source_path", "source")
	if sourceDisplay != "" {
		fields["source"] = sourceDisplay
		fields["source_path"] = sourceDisplay
	}
}

func resolveDisplayHost(source map[string]any, messages ...string) string {
	for _, path := range []string{"host.name", "host", "hostname", "syslog_hostname", "server_id"} {
		if value := lookupScalarString(source, path); value != "" {
			return value
		}
	}
	for _, candidate := range messages {
		if hostname := extractHostnameFromSyslogMessage(candidate); hostname != "" {
			return hostname
		}
	}
	return lookupScalarString(source, "agent.hostname")
}

func resolveDisplayHostIP(source map[string]any) string {
	for _, path := range []string{"host.ip", "host_ip", "server_ip", "agent.ip", "agent_ip"} {
		if value := lookupScalarStringOrFirstListItem(source, path); value != "" {
			return value
		}
	}
	return ""
}

func resolveDisplayService(source map[string]any) string {
	return resolveDisplayServiceWithHint(source, "")
}

func resolveDisplayServiceWithHint(source map[string]any, serviceHint string) string {
	for _, key := range []string{"service.name", "service_name", "service", "app", "container.name"} {
		if value := sanitizeDisplayServiceName(lookupScalarString(source, key)); value != "" {
			return value
		}
	}
	if value := sanitizeDisplayServiceName(serviceHint); value != "" {
		return value
	}
	if value := resolveDisplayServiceFromDockerMetadata(source); value != "" {
		return value
	}
	if value := deriveServiceNameFromSourcePath(source); value != "" {
		return value
	}
	for _, key := range []string{"service.instance.id", "source_id"} {
		if value := sanitizeDisplayServiceName(lookupScalarString(source, key)); value != "" {
			return value
		}
	}
	return "unknown"
}

func sanitizeDisplayServiceName(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return ""
	}
	lowerValue := strings.ToLower(value)
	if _, blocked := bogusServiceNames[lowerValue]; blocked {
		return ""
	}
	if queryDockerContainerIDPattern.MatchString(lowerValue) || queryDockerJSONLogNamePattern.MatchString(lowerValue) {
		return ""
	}
	if strings.HasPrefix(value, "{") || strings.HasPrefix(value, "[") {
		return ""
	}
	if strings.Contains(value, `{"`) || strings.Contains(value, `\\"`) || strings.ContainsAny(value, "\r\n\t") {
		return ""
	}
	return value
}

func deriveServiceNameFromSourcePath(source map[string]any) string {
	sourcePath := displaySourcePathFromSource(source)
	base := strings.TrimSpace(path.Base(sourcePath))
	switch base {
	case "", ".", "/":
		return ""
	default:
		return sanitizeDisplayServiceName(base)
	}
}

func displaySourcePathFromSource(source map[string]any) string {
	sourcePath := firstPathString(source, "source.path", "log.file.path", "source_path", "source")
	return normalizeSourcePathForDisplay(sourcePath)
}

func looksLikeDockerSourcePath(sourcePath string) bool {
	trimmed := strings.ToLower(strings.TrimSpace(sourcePath))
	return strings.HasPrefix(trimmed, "/var/lib/docker/containers/") || strings.HasPrefix(trimmed, "/host-docker-containers/")
}

func (s *QueryService) lookupServiceHintsBySourcePath(ctx context.Context, hits []repository.RawLogHit) map[string]string {
	if s == nil || s.logRepo == nil || len(hits) == 0 {
		return nil
	}

	targets := make([]string, 0)
	seen := make(map[string]struct{})
	for _, hit := range hits {
		sourcePath := displaySourcePathFromSource(hit.Source)
		if sourcePath == "" || !looksLikeDockerSourcePath(sourcePath) {
			continue
		}
		if direct := resolveDisplayService(hit.Source); direct != "unknown" {
			continue
		}
		if _, exists := seen[sourcePath]; exists {
			continue
		}
		seen[sourcePath] = struct{}{}
		targets = append(targets, sourcePath)
	}
	if len(targets) == 0 {
		return nil
	}

	shouldClauses := make([]map[string]any, 0, len(targets)*2)
	for _, sourcePath := range targets {
		shouldClauses = append(shouldClauses,
			map[string]any{"match_phrase": map[string]any{"source.path": sourcePath}},
			map[string]any{"match_phrase": map[string]any{"log.file.path": sourcePath}},
		)
	}

	result, err := s.logRepo.SearchWithBody(ctx, map[string]any{
		"size": minInt(len(targets)*8, 200),
		"sort": []map[string]any{{"@timestamp": map[string]any{"order": "desc"}}},
		"query": map[string]any{
			"bool": map[string]any{
				"should":               shouldClauses,
				"minimum_should_match": 1,
			},
		},
	})
	if err != nil {
		return nil
	}
	return buildSourcePathServiceHints(result.Hits)
}

func buildSourcePathServiceHints(hits []repository.RawLogHit) map[string]string {
	if len(hits) == 0 {
		return nil
	}
	hints := make(map[string]string)
	for _, hit := range hits {
		sourcePath := displaySourcePathFromSource(hit.Source)
		if sourcePath == "" || hints[sourcePath] != "" {
			continue
		}
		service := resolveDisplayService(hit.Source)
		if service == "" || service == "unknown" {
			continue
		}
		hints[sourcePath] = service
	}
	if len(hints) == 0 {
		return nil
	}
	return hints
}

func minInt(left, right int) int {
	if left < right {
		return left
	}
	return right
}

func extractHostnameFromSyslogMessage(raw string) string {
	message := unwrapMessageForLevel(raw)
	if message == "" {
		return ""
	}
	message = strings.TrimSpace(message)
	for _, pattern := range []*regexp.Regexp{rfc3164HostnamePattern, rfc5424HostnamePattern} {
		matched := pattern.FindStringSubmatch(message)
		if len(matched) < 2 {
			continue
		}
		hostname := strings.TrimSpace(matched[1])
		if hostname != "" && hostname != "-" {
			return hostname
		}
	}
	return ""
}

func lookupScalarString(source map[string]any, path string) string {
	value, ok := lookupPathValue(source, path)
	if !ok || value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case fmt.Stringer:
		return strings.TrimSpace(typed.String())
	case map[string]any, []any:
		return ""
	default:
		text := strings.TrimSpace(fmt.Sprintf("%v", value))
		if text == "" || text == "<nil>" {
			return ""
		}
		return text
	}
}

func lookupScalarStringOrFirstListItem(source map[string]any, path string) string {
	value, ok := lookupPathValue(source, path)
	if !ok || value == nil {
		return ""
	}
	switch typed := value.(type) {
	case []any:
		for _, item := range typed {
			text := strings.TrimSpace(fmt.Sprintf("%v", item))
			if text != "" && text != "<nil>" && text != "-" {
				return text
			}
		}
		return ""
	case []string:
		for _, item := range typed {
			text := strings.TrimSpace(item)
			if text != "" && text != "-" {
				return text
			}
		}
		return ""
	default:
		text := lookupScalarString(source, path)
		if text == "-" {
			return ""
		}
		return text
	}
}

func normalizeSourcePathForDisplay(raw string) string {
	path := strings.TrimSpace(raw)
	if path == "" {
		return path
	}

	const (
		hostVarLogPrefix           = "/host-var-log"
		hostDockerContainersPrefix = "/host-docker-containers"
		canonicalVarLogPrefix      = "/var/log"
		canonicalDockerPrefix      = "/var/lib/docker/containers"
	)

	switch {
	case path == hostVarLogPrefix:
		return canonicalVarLogPrefix
	case strings.HasPrefix(path, hostVarLogPrefix+"/"):
		return canonicalVarLogPrefix + strings.TrimPrefix(path, hostVarLogPrefix)
	case path == hostDockerContainersPrefix:
		return canonicalDockerPrefix
	case strings.HasPrefix(path, hostDockerContainersPrefix+"/"):
		return canonicalDockerPrefix + strings.TrimPrefix(path, hostDockerContainersPrefix)
	default:
		return path
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

func firstPathValue(source map[string]any, paths ...string) (any, bool) {
	for _, path := range paths {
		value, ok := lookupPathValue(source, path)
		if !ok || value == nil {
			continue
		}
		text := strings.TrimSpace(fmt.Sprintf("%v", value))
		if text == "" || text == "<nil>" {
			continue
		}
		return value, true
	}
	return nil, false
}

func firstPathString(source map[string]any, paths ...string) string {
	value, ok := firstPathValue(source, paths...)
	if !ok {
		return ""
	}
	return strings.TrimSpace(fmt.Sprintf("%v", value))
}

func lookupPathValue(source map[string]any, path string) (any, bool) {
	trimmed := strings.TrimSpace(path)
	if trimmed == "" || source == nil {
		return nil, false
	}
	if value, ok := source[trimmed]; ok {
		return value, true
	}
	current := any(source)
	for _, part := range strings.Split(trimmed, ".") {
		asMap, ok := current.(map[string]any)
		if !ok {
			return nil, false
		}
		value, exists := asMap[part]
		if !exists {
			return nil, false
		}
		current = value
	}
	return current, true
}

func setAliasString(target map[string]any, alias string, source map[string]any, paths ...string) {
	if value := firstPathString(source, paths...); value != "" {
		target[alias] = value
	}
}

func setAliasValue(target map[string]any, alias string, source map[string]any, paths ...string) {
	if value, ok := firstPathValue(source, paths...); ok {
		target[alias] = value
	}
}

func normalizeLevel(rawLevel string, message string) string {
	level := strings.ToLower(strings.TrimSpace(rawLevel))
	switch level {
	case "error", "warn", "info", "debug":
		return level
	case "warning":
		return "warn"
	}

	if explicit := detectLevelFromMessage(message); explicit != "" {
		return explicit
	}

	messageLower := strings.ToLower(message)
	warnIndex := earliestKeywordIndex(messageLower, "warn", "warning")
	errorIndex := earliestKeywordIndex(messageLower, "error", "fatal", "panic", "fail")
	if warnIndex >= 0 && (errorIndex < 0 || warnIndex < errorIndex) {
		return "warn"
	}
	switch {
	case errorIndex >= 0:
		return "error"
	case strings.Contains(messageLower, "debug"):
		return "debug"
	default:
		return "info"
	}
}

func detectLevelFromMessage(message string) string {
	primary := unwrapMessageForLevel(message)
	if primary == "" {
		return ""
	}
	matched := levelTokenPattern.FindStringSubmatch(primary)
	if len(matched) < 2 {
		return ""
	}
	switch strings.ToLower(strings.TrimSpace(matched[1])) {
	case "warn", "warning":
		return "warn"
	case "error", "fatal", "panic":
		return "error"
	case "debug", "trace":
		return "debug"
	case "info":
		return "info"
	default:
		return ""
	}
}

func normalizeDisplayMessage(message string) string {
	primary := unwrapMessageForLevel(message)
	if primary == "" {
		primary = strings.TrimSpace(message)
	}
	if primary == "" {
		return ""
	}

	cleaned := ansiColorPattern.ReplaceAllString(primary, "")
	cleaned = strings.ReplaceAll(cleaned, "\r\n", "\n")
	cleaned = strings.ReplaceAll(cleaned, "\r", "\n")
	cleaned = strings.ReplaceAll(cleaned, "\t", " ")
	cleaned = controlCharPattern.ReplaceAllString(cleaned, " ")
	cleaned = strings.ReplaceAll(cleaned, "\n", " ")
	cleaned = strings.Join(strings.Fields(cleaned), " ")
	return strings.TrimSpace(cleaned)
}

func unwrapMessageForLevel(message string) string {
	trimmed := strings.TrimSpace(message)
	if trimmed == "" {
		return ""
	}
	if !(strings.HasPrefix(trimmed, "{") && strings.HasSuffix(trimmed, "}")) {
		return trimmed
	}

	var payload map[string]any
	if err := json.Unmarshal([]byte(trimmed), &payload); err != nil {
		return trimmed
	}
	for _, key := range []string{"log", "message", "msg", "raw_log"} {
		candidate := strings.TrimSpace(fmt.Sprintf("%v", payload[key]))
		if candidate == "" || candidate == "<nil>" {
			continue
		}
		return candidate
	}
	return trimmed
}

func earliestKeywordIndex(text string, keywords ...string) int {
	result := -1
	for _, keyword := range keywords {
		if keyword == "" {
			continue
		}
		index := strings.Index(text, keyword)
		if index < 0 {
			continue
		}
		if result < 0 || index < result {
			result = index
		}
	}
	return result
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

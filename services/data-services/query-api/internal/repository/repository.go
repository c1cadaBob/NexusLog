// Package repository 提供 query-api 的数据访问层。
package repository

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	sharedauth "github.com/nexuslog/data-services/shared/auth"
	sharedhttpguard "github.com/nexuslog/data-services/shared/httpguard"
)

const (
	defaultElasticsearchAddress   = "http://localhost:9200"
	defaultLogsIndex              = "nexuslog-logs-read"
	defaultRequestTimeout         = 15 * time.Second
	defaultPITKeepAlive           = "5m"
	defaultTrackTotalHitsLimit    = 10000
	defaultSearchRetryBackoff     = 150 * time.Millisecond
	defaultSearchRetryMinBudget   = 750 * time.Millisecond
	totalRelationEqual            = "eq"
	totalRelationGreaterThanEqual = "gte"
)

// SortField 定义 ES 排序字段。
type SortField struct {
	Field string
	Order string
}

// SearchLogsInput 定义检索日志请求参数。
type SearchLogsInput struct {
	TenantID        string
	TenantReadScope sharedauth.TenantReadScope
	Keywords        string
	TimeRangeFrom   string
	TimeRangeTo     string
	Filters         map[string]any
	Sort            []SortField
	Page            int
	PageSize        int
	PITID           string
	SearchAfter     []any
}

// RawLogHit 表示 ES 返回的原始日志命中项。
type RawLogHit struct {
	ID     string
	Index  string
	Source map[string]any
}

// SearchLogsResult 定义 ES 查询结果。
type SearchLogsResult struct {
	TookMS          int
	TimedOut        bool
	Total           int64
	TotalRelation   string
	Hits            []RawLogHit
	Aggregations    map[string]any
	PITID           string
	NextSearchAfter []any
}

// ElasticsearchRepository 通过 ES REST API 执行日志检索。
type ElasticsearchRepository struct {
	address    string
	addressErr error
	index      string
	username   string
	password   string
	client     *http.Client
}

// NewElasticsearchRepositoryFromEnv 读取环境变量创建 ES 仓储。
func NewElasticsearchRepositoryFromEnv() *ElasticsearchRepository {
	address := resolveElasticsearchAddress()
	index := resolveLogsIndex()
	timeout := resolveRequestTimeout()
	username := strings.TrimSpace(firstNonEmpty(
		os.Getenv("DATABASE_ELASTICSEARCH_USERNAME"),
		os.Getenv("ELASTICSEARCH_USERNAME"),
	))
	password := strings.TrimSpace(firstNonEmpty(
		os.Getenv("DATABASE_ELASTICSEARCH_PASSWORD"),
		os.Getenv("ELASTICSEARCH_PASSWORD"),
	))
	normalizedAddress, addressErr := sharedhttpguard.NormalizeBaseURL(address, sharedhttpguard.BaseURLOptions{
		AllowPrivate:  true,
		AllowLoopback: true,
	})
	return &ElasticsearchRepository{
		address:    normalizedAddress,
		addressErr: addressErr,
		index:      index,
		username:   username,
		password:   password,
		client: &http.Client{
			Timeout: timeout,
		},
	}
}

func (r *ElasticsearchRepository) ensureReady() error {
	if r == nil || r.client == nil {
		return fmt.Errorf("elasticsearch repository is not configured")
	}
	if r.addressErr != nil {
		return fmt.Errorf("elasticsearch endpoint is invalid: %w", r.addressErr)
	}
	if r.address == "" {
		return fmt.Errorf("elasticsearch endpoint is not configured")
	}
	if strings.TrimSpace(r.index) == "" {
		return fmt.Errorf("elasticsearch index is not configured")
	}
	return nil
}

var (
	ErrTenantScopeRequired      = errors.New("tenant scope is required")
	ErrSearchBackendUnavailable = errors.New("search backend is temporarily unavailable")
)

// SearchLogs 调用 ES _search 执行检索。
func (r *ElasticsearchRepository) SearchLogs(ctx context.Context, in SearchLogsInput) (SearchLogsResult, error) {
	if err := r.ensureReady(); err != nil {
		return SearchLogsResult{}, err
	}
	in.TenantID = strings.TrimSpace(in.TenantID)
	if in.TenantID == "" && !sharedauth.TenantReadScopeAllowsAllTenants(in.TenantReadScope) {
		return SearchLogsResult{}, ErrTenantScopeRequired
	}
	if in.Page <= 0 {
		in.Page = 1
	}
	if in.PageSize <= 0 {
		in.PageSize = 50
	}

	pitID := strings.TrimSpace(in.PITID)
	usePIT := pitID != ""
	if !usePIT && shouldAutoOpenPIT(in) {
		openedPIT, err := r.openPointInTime(ctx, defaultPITKeepAlive)
		if err == nil {
			pitID = openedPIT
			usePIT = pitID != ""
		} else if len(in.SearchAfter) > 0 {
			return SearchLogsResult{}, err
		}
	}

	queryPayload := map[string]any{
		"track_total_hits": resolveTrackTotalHits(in),
		"size":             in.PageSize,
		"query":            BuildESQuery(in),
		"sort":             buildESSort(in.Sort),
	}
	if len(in.SearchAfter) > 0 {
		queryPayload["search_after"] = in.SearchAfter
	} else {
		queryPayload["from"] = (in.Page - 1) * in.PageSize
	}
	endpoint := fmt.Sprintf("%s/%s/_search", r.address, r.index)
	if usePIT {
		queryPayload["pit"] = map[string]any{
			"id":         pitID,
			"keep_alive": defaultPITKeepAlive,
		}
		endpoint = fmt.Sprintf("%s/_search", r.address)
	}

	parsed, err := r.executeSearchWithRetry(ctx, endpoint, queryPayload)
	if err != nil && usePIT && isRetryablePITError(err) {
		refreshedPIT, pitErr := r.openPointInTime(ctx, defaultPITKeepAlive)
		if pitErr == nil {
			pitID = refreshedPIT
			queryPayload["pit"] = map[string]any{
				"id":         pitID,
				"keep_alive": defaultPITKeepAlive,
			}
			parsed, err = r.executeSearchWithRetry(ctx, fmt.Sprintf("%s/_search", r.address), queryPayload)
		}
	}
	if err != nil {
		return SearchLogsResult{}, wrapRetryableSearchError(err)
	}

	total, totalRelation := parseHitsTotal(parsed.Hits.Total)
	result := SearchLogsResult{
		TookMS:        parsed.Took,
		TimedOut:      parsed.TimedOut,
		Total:         total,
		TotalRelation: totalRelation,
		Hits:          make([]RawLogHit, 0, len(parsed.Hits.Hits)),
		Aggregations:  parsed.Aggregations,
		PITID:         strings.TrimSpace(firstNonEmpty(parsed.PITID, pitID)),
	}
	for _, hit := range parsed.Hits.Hits {
		result.Hits = append(result.Hits, RawLogHit{
			ID:     strings.TrimSpace(hit.ID),
			Index:  strings.TrimSpace(hit.Index),
			Source: hit.Source,
		})
		result.NextSearchAfter = cloneSlice(hit.Sort)
	}
	return result, nil
}

// SearchWithBody executes a raw ES _search with custom body (for aggregations).
func (r *ElasticsearchRepository) SearchWithBody(ctx context.Context, body map[string]any) (SearchLogsResult, error) {
	if err := r.ensureReady(); err != nil {
		return SearchLogsResult{}, err
	}
	endpoint := fmt.Sprintf("%s/%s/_search", r.address, r.index)
	parsed, err := r.executeSearchWithRetry(ctx, endpoint, body)
	if err != nil {
		return SearchLogsResult{}, err
	}
	total, totalRelation := parseHitsTotal(parsed.Hits.Total)
	result := SearchLogsResult{
		TookMS:        parsed.Took,
		TimedOut:      parsed.TimedOut,
		Total:         total,
		TotalRelation: totalRelation,
		Hits:          make([]RawLogHit, 0, len(parsed.Hits.Hits)),
		Aggregations:  parsed.Aggregations,
	}
	for _, hit := range parsed.Hits.Hits {
		result.Hits = append(result.Hits, RawLogHit{
			ID:     strings.TrimSpace(hit.ID),
			Index:  strings.TrimSpace(hit.Index),
			Source: hit.Source,
		})
	}
	return result, nil
}

type esSearchResponse struct {
	Took         int            `json:"took"`
	TimedOut     bool           `json:"timed_out"`
	PITID        string         `json:"pit_id"`
	Hits         esHitsResponse `json:"hits"`
	Aggregations map[string]any `json:"aggregations"`
}

type esAPIError struct {
	Operation string
	Status    int
	Body      string
}

func (e *esAPIError) Error() string {
	if e == nil {
		return ""
	}
	return fmt.Sprintf("%s failed: status=%d body=%s", e.Operation, e.Status, e.Body)
}

type esHitsResponse struct {
	Total json.RawMessage `json:"total"`
	Hits  []struct {
		ID     string         `json:"_id"`
		Index  string         `json:"_index"`
		Source map[string]any `json:"_source"`
		Sort   []any          `json:"sort"`
	} `json:"hits"`
}

func (r *ElasticsearchRepository) executeSearch(ctx context.Context, endpoint string, queryPayload map[string]any) (esSearchResponse, error) {
	if err := r.ensureReady(); err != nil {
		return esSearchResponse{}, err
	}
	payloadRaw, err := json.Marshal(queryPayload)
	if err != nil {
		return esSearchResponse{}, fmt.Errorf("marshal es query: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payloadRaw))
	if err != nil {
		return esSearchResponse{}, fmt.Errorf("build es request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if r.username != "" {
		req.SetBasicAuth(r.username, r.password)
	}

	resp, err := r.client.Do(req)
	if err != nil {
		return esSearchResponse{}, fmt.Errorf("execute es request: %w", err)
	}
	defer resp.Body.Close()

	bodyRaw, err := sharedhttpguard.ReadLimitedBody(resp.Body, 0)
	if err != nil {
		return esSearchResponse{}, fmt.Errorf("read es response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return esSearchResponse{}, &esAPIError{
			Operation: "es search",
			Status:    resp.StatusCode,
			Body:      string(bodyRaw),
		}
	}

	var parsed esSearchResponse
	if err := json.Unmarshal(bodyRaw, &parsed); err != nil {
		return esSearchResponse{}, fmt.Errorf("decode es response: %w", err)
	}
	return parsed, nil
}

func (r *ElasticsearchRepository) executeSearchWithRetry(ctx context.Context, endpoint string, queryPayload map[string]any) (esSearchResponse, error) {
	parsed, err := r.executeSearch(ctx, endpoint, queryPayload)
	if err == nil {
		return parsed, nil
	}
	if !isRetryableSearchError(err) {
		return esSearchResponse{}, err
	}
	if !hasRetryBudget(ctx, defaultSearchRetryMinBudget) {
		return esSearchResponse{}, wrapRetryableSearchError(err)
	}
	if err := waitRetryBackoff(ctx, defaultSearchRetryBackoff); err != nil {
		return esSearchResponse{}, wrapRetryableSearchError(err)
	}
	parsed, retryErr := r.executeSearch(ctx, endpoint, queryPayload)
	if retryErr != nil {
		return esSearchResponse{}, wrapRetryableSearchError(retryErr)
	}
	return parsed, nil
}

func wrapRetryableSearchError(err error) error {
	if err == nil || !isRetryableSearchError(err) {
		return err
	}
	if errors.Is(err, ErrSearchBackendUnavailable) {
		return err
	}
	return fmt.Errorf("%w: %w", ErrSearchBackendUnavailable, err)
}

func isRetryableSearchError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.Canceled) {
		return false
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return true
	}
	var apiErr *esAPIError
	if errors.As(err, &apiErr) {
		switch apiErr.Status {
		case http.StatusTooManyRequests,
			http.StatusInternalServerError,
			http.StatusBadGateway,
			http.StatusServiceUnavailable,
			http.StatusGatewayTimeout:
			return true
		default:
			return false
		}
	}
	message := strings.ToLower(strings.TrimSpace(err.Error()))
	return strings.Contains(message, "deadline exceeded") || strings.Contains(message, "timeout")
}

func hasRetryBudget(ctx context.Context, minBudget time.Duration) bool {
	if ctx == nil {
		return true
	}
	deadline, ok := ctx.Deadline()
	if !ok {
		return true
	}
	return time.Until(deadline) > minBudget
}

func waitRetryBackoff(ctx context.Context, delay time.Duration) error {
	if delay <= 0 {
		return nil
	}
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func shouldAutoOpenPIT(in SearchLogsInput) bool {
	if len(in.SearchAfter) > 0 {
		return true
	}
	return in.Page > 1
}

func resolveTrackTotalHits(in SearchLogsInput) any {
	if in.Page <= 1 && strings.TrimSpace(in.PITID) == "" && len(in.SearchAfter) == 0 {
		return defaultTrackTotalHitsLimit
	}
	return true
}

func isRetryablePITError(err error) bool {
	var apiErr *esAPIError
	if !errors.As(err, &apiErr) || apiErr == nil {
		return false
	}
	body := strings.ToLower(strings.TrimSpace(apiErr.Body))
	if body == "" {
		return false
	}
	if strings.Contains(body, "point in time") {
		return true
	}
	if strings.Contains(body, "resource_not_found_exception") {
		return true
	}
	if strings.Contains(body, "search_context_missing_exception") {
		return true
	}
	if strings.Contains(body, "no search context found") {
		return true
	}
	return false
}

func (r *ElasticsearchRepository) openPointInTime(ctx context.Context, keepAlive string) (string, error) {
	if err := r.ensureReady(); err != nil {
		return "", err
	}
	endpoint := fmt.Sprintf("%s/%s/_pit?keep_alive=%s", r.address, r.index, keepAlive)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, http.NoBody)
	if err != nil {
		return "", fmt.Errorf("build es pit request: %w", err)
	}
	if r.username != "" {
		req.SetBasicAuth(r.username, r.password)
	}

	resp, err := r.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("open es pit: %w", err)
	}
	defer resp.Body.Close()

	bodyRaw, err := sharedhttpguard.ReadLimitedBody(resp.Body, 0)
	if err != nil {
		return "", fmt.Errorf("read es pit response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("open es pit failed: status=%d body=%s", resp.StatusCode, string(bodyRaw))
	}

	var parsed struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(bodyRaw, &parsed); err != nil {
		return "", fmt.Errorf("decode es pit response: %w", err)
	}
	pitID := strings.TrimSpace(parsed.ID)
	if pitID == "" {
		return "", fmt.Errorf("open es pit failed: empty id")
	}
	return pitID, nil
}

func cloneSlice(source []any) []any {
	if len(source) == 0 {
		return nil
	}
	out := make([]any, len(source))
	copy(out, source)
	return out
}

func resolveElasticsearchAddress() string {
	candidates := []string{
		os.Getenv("DATABASE_ELASTICSEARCH_ADDRESSES"),
		os.Getenv("ELASTICSEARCH_URL"),
		os.Getenv("SEARCH_ELASTICSEARCH_ADDRESSES"),
	}
	for _, candidate := range candidates {
		if addr := firstAddress(candidate); addr != "" {
			return addr
		}
	}
	return defaultElasticsearchAddress
}

func resolveLogsIndex() string {
	index := strings.TrimSpace(firstNonEmpty(
		os.Getenv("QUERY_LOGS_INDEX"),
		os.Getenv("DATABASE_ELASTICSEARCH_INDEX"),
		os.Getenv("INGEST_ES_INDEX"),
	))
	if index == "" {
		return defaultLogsIndex
	}
	return index
}

func resolveRequestTimeout() time.Duration {
	raw := strings.TrimSpace(os.Getenv("QUERY_ES_TIMEOUT_SEC"))
	if raw == "" {
		return defaultRequestTimeout
	}
	seconds, err := strconv.Atoi(raw)
	if err != nil || seconds <= 0 {
		return defaultRequestTimeout
	}
	return time.Duration(seconds) * time.Second
}

func firstAddress(raw string) string {
	for _, part := range strings.Split(raw, ",") {
		addr := strings.TrimSpace(part)
		if addr != "" {
			return addr
		}
	}
	return ""
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if text := strings.TrimSpace(value); text != "" {
			return text
		}
	}
	return ""
}

func parseHitsTotal(raw json.RawMessage) (int64, string) {
	if len(raw) == 0 {
		return 0, totalRelationEqual
	}
	var wrapped struct {
		Value    int64  `json:"value"`
		Relation string `json:"relation"`
	}
	if err := json.Unmarshal(raw, &wrapped); err == nil {
		relation := strings.TrimSpace(strings.ToLower(wrapped.Relation))
		if relation == "" {
			relation = totalRelationEqual
		}
		return wrapped.Value, relation
	}
	var plain int64
	if err := json.Unmarshal(raw, &plain); err == nil {
		return plain, totalRelationEqual
	}
	return 0, totalRelationEqual
}

func BuildESQuery(in SearchLogsInput) map[string]any {
	filterClauses := make([]map[string]any, 0, 10)
	mustClauses := make([]map[string]any, 0, 2)

	tenantID := strings.TrimSpace(in.TenantID)
	if !sharedauth.TenantReadScopeAllowsAllTenants(in.TenantReadScope) {
		if tenantID == "" {
			return tenantScopedMatchNoneQuery()
		}
		filterClauses = append(filterClauses, tenantScopeFilterClause(tenantID))
	}
	mustNotClauses := make([]map[string]any, 0, 2)

	keywords := strings.TrimSpace(in.Keywords)
	if keywords != "" {
		mustClauses = append(mustClauses, map[string]any{
			"multi_match": map[string]any{
				"query":    keywords,
				"operator": "and",
				"type":     "best_fields",
				"fields": []string{
					"message^3",
					"event.original",
					"error.message^2",
					"error.stack_trace",
					"service.name^2",
					"service.instance.id",
					"container.name",
					"log.file.path",
					"source.path",
					"agent.id",
					"event.record_id",
					"nexuslog.transport.batch_id",
					"trace.id",
					"span.id",
					"request.id",
				},
			},
		})
	}
	if from := strings.TrimSpace(in.TimeRangeFrom); from != "" {
		filterClauses = append(filterClauses, map[string]any{
			"range": map[string]any{
				"@timestamp": map[string]any{
					"gte": from,
				},
			},
		})
	}
	if to := strings.TrimSpace(in.TimeRangeTo); to != "" {
		filterClauses = append(filterClauses, map[string]any{
			"range": map[string]any{
				"@timestamp": map[string]any{
					"lte": to,
				},
			},
		})
	}
	for key, value := range in.Filters {
		rawKey := strings.TrimSpace(key)
		if rawKey == "exclude_internal_noise" {
			if filterFlagEnabled(value) {
				mustNotClauses = append(mustNotClauses, buildRealtimeInternalNoiseMustNotClause())
			}
			continue
		}
		field := normalizeFilterField(rawKey)
		if field == "" || value == nil {
			continue
		}
		if rawKey == "service" {
			filterClauses = append(filterClauses, buildServiceCompatibilityFilterClause(value))
			continue
		}
		if fields := compatibilityFilterFields(rawKey, field); len(fields) > 1 {
			filterClauses = append(filterClauses, buildCompatibilityFilterClause(fields, value))
			continue
		}
		if terms := normalizeTerms(value); len(terms) > 0 {
			filterClauses = append(filterClauses, map[string]any{
				"terms": map[string]any{
					field: terms,
				},
			})
			continue
		}
		filterClauses = append(filterClauses, map[string]any{
			"term": map[string]any{
				field: value,
			},
		})
	}

	if len(mustClauses) == 0 && len(filterClauses) == 0 && len(mustNotClauses) == 0 {
		return map[string]any{"match_all": map[string]any{}}
	}
	boolQuery := map[string]any{}
	if len(mustClauses) > 0 {
		boolQuery["must"] = mustClauses
	}
	if len(filterClauses) > 0 {
		boolQuery["filter"] = filterClauses
	}
	if len(mustNotClauses) > 0 {
		boolQuery["must_not"] = mustNotClauses
	}
	return map[string]any{
		"bool": boolQuery,
	}
}

func tenantScopeFilterClause(tenantID string) map[string]any {
	return map[string]any{
		"bool": map[string]any{
			"should": []any{
				map[string]any{"term": map[string]any{"tenant_id": tenantID}},
				map[string]any{"term": map[string]any{"nexuslog.governance.tenant_id": tenantID}},
			},
			"minimum_should_match": 1,
		},
	}
}

func tenantScopedMatchNoneQuery() map[string]any {
	return map[string]any{
		"bool": map[string]any{
			"filter": []map[string]any{{"match_none": map[string]any{}}},
		},
	}
}

func filterFlagEnabled(value any) bool {
	switch typed := value.(type) {
	case bool:
		return typed
	case string:
		normalized := strings.TrimSpace(strings.ToLower(typed))
		return normalized == "1" || normalized == "true" || normalized == "yes" || normalized == "on"
	default:
		return false
	}
}

func buildRealtimeInternalNoiseMustNotClause() map[string]any {
	rules := []map[string]any{
		buildLowValueRealtimeNoiseRule(buildServiceCompatibilityFilterClause("query-api"), []string{
			"/api/v1/query/logs",
			"/api/v1/query/stats/aggregate",
			"/api/v1/query/stats/overview",
		}),
		buildLowValueRealtimeNoiseRule(nil, []string{
			"/metrics",
		}),
		buildLowValueRealtimeNoiseRule(nil, []string{
			`GET "/healthz"`,
			`GET "/readyz"`,
		}),
		buildLowValueRealtimeNoiseRule(buildServiceCompatibilityFilterClause("es-compat-proxy"), []string{
			"POST /_bulk?timeout=1m HTTP/1.1",
			"GET /_cluster/health HTTP/1.1",
		}),
		buildRealtimeNoiseRule(buildServiceCompatibilityFilterClause("control-plane"), []string{
			"ingest scheduler created task",
		}, nil),
		buildLowValueRealtimeNoiseRule(buildServiceCompatibilityFilterClause("collector-agent"), []string{
			"kafka_producer.go:153: 发送",
		}),
		buildLowValueRealtimeNoiseRule(buildServiceCompatibilityFilterClause("schema-registry"), []string{
			"GET /subjects HTTP/1.1",
		}),
		buildLowValueRealtimeNoiseRule(buildServiceCompatibilityFilterClause("zookeeper"), []string{
			"Processing srvr command from",
		}),
		buildLowValueRealtimeNoiseRule(buildServiceCompatibilityFilterClause("kafka-exporter"), []string{
			"kafka_exporter.go:678]",
		}),
		buildLowValueRealtimeNoiseRule(buildServiceCompatibilityFilterClause("kafka"), []string{
			"Leader imbalance ratio for broker",
			"Topics not in preferred replica for broker",
			"Checking need to trigger auto leader balancing",
			"Processing automatic preferred replica leader election",
		}),
		buildLowValueRealtimeNoiseRule(buildServiceCompatibilityFilterClause("flink-jobmanager"), []string{
			"Triggering checkpoint",
			"Completed checkpoint",
			"Marking checkpoint",
		}),
		buildLowValueRealtimeNoiseRule(buildServiceCompatibilityFilterClause("postgres"), []string{
			"checkpoint complete:",
		}),
		buildRealtimeNoiseRule(buildServiceCompatibilityFilterClause("flink-taskmanager"), []string{
			"Name collision: Group already contains a Metric with the name 'pendingCommittables'",
		}, []string{"warn", "WARN"}),
		buildLowValueRealtimeNoiseRuleAllPhrases(buildServiceCompatibilityFilterClause("messages"), []string{
			"run-docker-runtime",
			"Succeeded.",
		}),
		buildLowValueRealtimeNoiseRuleAllPhrases(buildServiceCompatibilityFilterClause("messages"), []string{
			"chronyd[",
			"Selected source",
		}),
		buildLowValueRealtimeNoiseRuleAllPhrases(buildServiceCompatibilityFilterClause("messages"), []string{
			"chronyd[",
			"Detected falseticker",
		}),
		buildLowValueRealtimeNoiseRule(buildServiceCompatibilityFilterClause("audit.log"), []string{
			"type=PROCTITLE",
		}),
		buildLowValueRealtimeNoiseRuleAllPhrases(buildServiceCompatibilityFilterClause("audit.log"), []string{
			`comm="iptables"`,
			"type=NETFILTER_CFG",
		}),
		buildLowValueRealtimeNoiseRuleAllPhrases(buildServiceCompatibilityFilterClause("audit.log"), []string{
			`comm="iptables"`,
			"type=SYSCALL",
		}),
		buildLowValueRealtimeNoiseRuleAllPhrases(buildServiceCompatibilityFilterClause("audit.log"), []string{
			`comm="iptables"`,
			"type=PROCTITLE",
		}),
		buildLowValueRealtimeNoiseRuleAllPhrases(buildServiceCompatibilityFilterClause("audit.log"), []string{
			`comm="dockerd"`,
			"type=SYSCALL",
		}),
		buildLowValueRealtimeNoiseRuleAllPhrases(buildServiceCompatibilityFilterClause("audit.log"), []string{
			`comm="dockerd"`,
			"type=ANOM_PROMISCUOUS",
		}),
	}
	return map[string]any{
		"bool": map[string]any{
			"should":               rules,
			"minimum_should_match": 1,
		},
	}
}

func buildLowValueRealtimeNoiseRule(serviceClause map[string]any, phrases []string) map[string]any {
	return buildRealtimeNoiseRule(serviceClause, phrases, []string{"info", "debug", "INFO", "DEBUG"})
}

func buildLowValueRealtimeNoiseRuleAllPhrases(serviceClause map[string]any, phrases []string) map[string]any {
	return buildRealtimeNoiseRuleAllPhrases(serviceClause, phrases, []string{"info", "debug", "INFO", "DEBUG"})
}

func buildRealtimeNoiseRule(serviceClause map[string]any, phrases []string, levels []string) map[string]any {
	filterClauses := make([]map[string]any, 0, 2)
	if len(levels) > 0 {
		filterClauses = append(filterClauses, map[string]any{
			"terms": map[string]any{
				"log.level": levels,
			},
		})
	}
	if len(serviceClause) > 0 {
		filterClauses = append(filterClauses, serviceClause)
	}
	boolQuery := map[string]any{
		"must": []map[string]any{
			buildMessagePhraseShouldClause(phrases),
		},
	}
	if len(filterClauses) > 0 {
		boolQuery["filter"] = filterClauses
	}
	return map[string]any{
		"bool": boolQuery,
	}
}

func buildRealtimeNoiseRuleAllPhrases(serviceClause map[string]any, phrases []string, levels []string) map[string]any {
	filterClauses := make([]map[string]any, 0, 2)
	if len(levels) > 0 {
		filterClauses = append(filterClauses, map[string]any{
			"terms": map[string]any{
				"log.level": levels,
			},
		})
	}
	if len(serviceClause) > 0 {
		filterClauses = append(filterClauses, serviceClause)
	}
	mustClauses := buildMessagePhraseMustClauses(phrases)
	boolQuery := map[string]any{
		"must": mustClauses,
	}
	if len(filterClauses) > 0 {
		boolQuery["filter"] = filterClauses
	}
	return map[string]any{
		"bool": boolQuery,
	}
}

func buildMessagePhraseShouldClause(phrases []string) map[string]any {
	return map[string]any{
		"bool": map[string]any{
			"should":               buildMessagePhraseMatchClauses(phrases),
			"minimum_should_match": 1,
		},
	}
}

func buildMessagePhraseMustClauses(phrases []string) []map[string]any {
	must := make([]map[string]any, 0, len(phrases))
	for _, phrase := range phrases {
		matches := buildMessagePhraseMatchClauses([]string{phrase})
		if len(matches) == 0 {
			continue
		}
		must = append(must, map[string]any{
			"bool": map[string]any{
				"should":               matches,
				"minimum_should_match": 1,
			},
		})
	}
	return must
}

func buildMessagePhraseMatchClauses(phrases []string) []map[string]any {
	fields := []string{"message", "event.original"}
	should := make([]map[string]any, 0, len(fields)*len(phrases))
	for _, phrase := range phrases {
		phrase = strings.TrimSpace(phrase)
		if phrase == "" {
			continue
		}
		for _, field := range fields {
			should = append(should, map[string]any{
				"match_phrase": map[string]any{
					field: phrase,
				},
			})
		}
	}
	return should
}

func buildESSort(sortFields []SortField) []map[string]any {
	sorts := make([]map[string]any, 0, len(sortFields)+6)
	seen := make(map[string]struct{}, len(sortFields)+6)
	primaryOrder := "desc"

	appendSort := func(field, order string) {
		field = strings.TrimSpace(field)
		if field == "" {
			return
		}
		if _, exists := seen[field]; exists {
			return
		}
		order = strings.ToLower(strings.TrimSpace(order))
		if order != "asc" && order != "desc" {
			order = "desc"
		}
		options := map[string]any{
			"order":   order,
			"missing": "_last",
		}
		if unmappedType := sortFieldUnmappedType(field); unmappedType != "" {
			options["unmapped_type"] = unmappedType
		}
		sorts = append(sorts, map[string]any{field: options})
		seen[field] = struct{}{}
	}

	for _, sortField := range sortFields {
		field := normalizeSortField(sortField.Field)
		if field == "" {
			continue
		}
		order := strings.ToLower(strings.TrimSpace(sortField.Order))
		if order != "asc" && order != "desc" {
			order = "desc"
		}
		if len(seen) == 0 {
			primaryOrder = order
		}
		appendSort(field, order)
	}
	if len(sorts) == 0 {
		appendSort("@timestamp", primaryOrder)
	}
	appendSort("nexuslog.ingest.received_at", primaryOrder)
	appendSort("event.sequence", primaryOrder)
	appendSort("log.offset", primaryOrder)
	appendSort("source.path", "asc")
	appendSort("event.id", primaryOrder)
	return sorts
}

func sortFieldUnmappedType(field string) string {
	switch strings.TrimSpace(field) {
	case "@timestamp", "nexuslog.ingest.received_at":
		return "date"
	case "event.sequence", "log.offset":
		return "long"
	case "source.path", "event.id":
		return "keyword"
	default:
		return ""
	}
}

func normalizeTerms(value any) []any {
	switch typed := value.(type) {
	case []any:
		out := make([]any, 0, len(typed))
		for _, item := range typed {
			if item == nil {
				continue
			}
			out = append(out, item)
		}
		return out
	case []string:
		out := make([]any, 0, len(typed))
		for _, item := range typed {
			text := strings.TrimSpace(item)
			if text == "" {
				continue
			}
			out = append(out, text)
		}
		return out
	default:
		return nil
	}
}

func buildCompatibilityFilterClause(fields []string, value any) map[string]any {
	should := make([]map[string]any, 0, len(fields))
	if terms := normalizeTerms(value); len(terms) > 0 {
		for _, field := range fields {
			should = append(should, map[string]any{
				"terms": map[string]any{
					field: terms,
				},
			})
		}
	} else {
		for _, field := range fields {
			should = append(should, map[string]any{
				"term": map[string]any{
					field: value,
				},
			})
		}
	}
	return map[string]any{
		"bool": map[string]any{
			"should":               should,
			"minimum_should_match": 1,
		},
	}
}

func buildServiceCompatibilityFilterClause(value any) map[string]any {
	structuredFields := []string{"service.name", "service.instance.id", "container.name", "agent.id"}
	pathFields := []string{"source.path", "log.file.path"}
	should := make([]map[string]any, 0, len(structuredFields)+len(pathFields))

	if terms := normalizeTerms(value); len(terms) > 0 {
		for _, field := range structuredFields {
			should = append(should, map[string]any{
				"terms": map[string]any{
					field: terms,
				},
			})
		}
		for _, term := range terms {
			pattern := sanitizeWildcardLiteral(strings.TrimSpace(fmt.Sprintf("%v", term)))
			if pattern == "" {
				continue
			}
			pattern = "*/" + pattern
			for _, field := range pathFields {
				should = append(should, map[string]any{
					"wildcard": map[string]any{
						field: map[string]any{
							"value":            pattern,
							"case_insensitive": true,
						},
					},
				})
			}
		}
	} else {
		for _, field := range structuredFields {
			should = append(should, map[string]any{
				"term": map[string]any{
					field: value,
				},
			})
		}
		pattern := sanitizeWildcardLiteral(strings.TrimSpace(fmt.Sprintf("%v", value)))
		if pattern != "" {
			pattern = "*/" + pattern
			for _, field := range pathFields {
				should = append(should, map[string]any{
					"wildcard": map[string]any{
						field: map[string]any{
							"value":            pattern,
							"case_insensitive": true,
						},
					},
				})
			}
		}
	}

	return map[string]any{
		"bool": map[string]any{
			"should":               should,
			"minimum_should_match": 1,
		},
	}
}

func compatibilityFilterFields(rawKey, normalizedField string) []string {
	switch rawKey {
	case "service":
		return []string{"service.name", "service.instance.id", "container.name", "agent.id"}
	case "source":
		return []string{"source.path", "log.file.path"}
	default:
		return []string{normalizedField}
	}
}

func normalizeFilterField(raw string) string {
	switch strings.TrimSpace(raw) {
	case "level", "log.level":
		return "log.level"
	case "service", "service.name":
		return "service.name"
	case "service.instance.id":
		return "service.instance.id"
	case "container.name":
		return "container.name"
	case "source", "source.path":
		return "source.path"
	case "log.file.path":
		return "log.file.path"
	case "agent_id", "agent.id":
		return "agent.id"
	case "batch_id", "nexuslog.transport.batch_id":
		return "nexuslog.transport.batch_id"
	case "traceId", "trace.id":
		return "trace.id"
	case "spanId", "span.id":
		return "span.id"
	case "statusCode", "http.response.status_code":
		return "http.response.status_code"
	case "request.id":
		return "request.id"
	case "event.record_id":
		return "event.record_id"
	default:
		return ""
	}
}

func normalizeSortField(raw string) string {
	switch strings.TrimSpace(raw) {
	case "@timestamp":
		return "@timestamp"
	case "nexuslog.ingest.received_at":
		return "nexuslog.ingest.received_at"
	case "event.sequence":
		return "event.sequence"
	case "log.offset":
		return "log.offset"
	case "source", "source.path":
		return "source.path"
	case "event.id":
		return "event.id"
	case "level", "log.level":
		return "log.level"
	case "service", "service.name":
		return "service.name"
	case "service.instance.id":
		return "service.instance.id"
	case "container.name":
		return "container.name"
	case "agent_id", "agent.id":
		return "agent.id"
	case "batch_id", "nexuslog.transport.batch_id":
		return "nexuslog.transport.batch_id"
	case "traceId", "trace.id":
		return "trace.id"
	case "spanId", "span.id":
		return "span.id"
	case "request.id":
		return "request.id"
	case "statusCode", "http.response.status_code":
		return "http.response.status_code"
	default:
		return ""
	}
}

func sanitizeWildcardLiteral(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	cleaned := strings.Map(func(r rune) rune {
		switch r {
		case '*', '?':
			return -1
		default:
			return r
		}
	}, raw)
	return strings.TrimSpace(cleaned)
}

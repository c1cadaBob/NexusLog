// Package repository 提供 query-api 的数据访问层。
package repository

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	defaultElasticsearchAddress = "http://localhost:9200"
	defaultLogsIndex            = "nexuslog-logs-v2"
	defaultRequestTimeout       = 15 * time.Second
)

// SortField 定义 ES 排序字段。
type SortField struct {
	Field string
	Order string
}

// SearchLogsInput 定义检索日志请求参数。
type SearchLogsInput struct {
	Keywords      string
	TimeRangeFrom string
	TimeRangeTo   string
	Filters       map[string]any
	Sort          []SortField
	Page          int
	PageSize      int
}

// RawLogHit 表示 ES 返回的原始日志命中项。
type RawLogHit struct {
	ID     string
	Index  string
	Source map[string]any
}

// SearchLogsResult 定义 ES 查询结果。
type SearchLogsResult struct {
	TookMS       int
	TimedOut     bool
	Total        int64
	Hits         []RawLogHit
	Aggregations map[string]any
}

// ElasticsearchRepository 通过 ES REST API 执行日志检索。
type ElasticsearchRepository struct {
	address  string
	index    string
	username string
	password string
	client   *http.Client
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
	return &ElasticsearchRepository{
		address:  strings.TrimRight(address, "/"),
		index:    index,
		username: username,
		password: password,
		client: &http.Client{
			Timeout: timeout,
		},
	}
}

// SearchLogs 调用 ES _search 执行检索。
func (r *ElasticsearchRepository) SearchLogs(ctx context.Context, in SearchLogsInput) (SearchLogsResult, error) {
	if r == nil || r.client == nil {
		return SearchLogsResult{}, fmt.Errorf("elasticsearch repository is not configured")
	}
	if in.Page <= 0 {
		in.Page = 1
	}
	if in.PageSize <= 0 {
		in.PageSize = 50
	}

	queryPayload := map[string]any{
		"track_total_hits": true,
		"from":             (in.Page - 1) * in.PageSize,
		"size":             in.PageSize,
		"query":            buildESQuery(in),
		"sort":             buildESSort(in.Sort),
	}

	payloadRaw, err := json.Marshal(queryPayload)
	if err != nil {
		return SearchLogsResult{}, fmt.Errorf("marshal es query: %w", err)
	}

	endpoint := fmt.Sprintf("%s/%s/_search", r.address, r.index)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payloadRaw))
	if err != nil {
		return SearchLogsResult{}, fmt.Errorf("build es request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if r.username != "" {
		req.SetBasicAuth(r.username, r.password)
	}

	resp, err := r.client.Do(req)
	if err != nil {
		return SearchLogsResult{}, fmt.Errorf("execute es request: %w", err)
	}
	defer resp.Body.Close()

	bodyRaw, err := io.ReadAll(resp.Body)
	if err != nil {
		return SearchLogsResult{}, fmt.Errorf("read es response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return SearchLogsResult{}, fmt.Errorf("es search failed: status=%d body=%s", resp.StatusCode, string(bodyRaw))
	}

	var parsed esSearchResponse
	if err := json.Unmarshal(bodyRaw, &parsed); err != nil {
		return SearchLogsResult{}, fmt.Errorf("decode es response: %w", err)
	}

	result := SearchLogsResult{
		TookMS:       parsed.Took,
		TimedOut:     parsed.TimedOut,
		Total:        parseHitsTotal(parsed.Hits.Total),
		Hits:         make([]RawLogHit, 0, len(parsed.Hits.Hits)),
		Aggregations: parsed.Aggregations,
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

// SearchWithBody executes a raw ES _search with custom body (for aggregations).
func (r *ElasticsearchRepository) SearchWithBody(ctx context.Context, body map[string]any) (SearchLogsResult, error) {
	if r == nil || r.client == nil {
		return SearchLogsResult{}, fmt.Errorf("elasticsearch repository is not configured")
	}
	payloadRaw, err := json.Marshal(body)
	if err != nil {
		return SearchLogsResult{}, fmt.Errorf("marshal es query: %w", err)
	}
	endpoint := fmt.Sprintf("%s/%s/_search", r.address, r.index)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payloadRaw))
	if err != nil {
		return SearchLogsResult{}, fmt.Errorf("build es request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if r.username != "" {
		req.SetBasicAuth(r.username, r.password)
	}
	resp, err := r.client.Do(req)
	if err != nil {
		return SearchLogsResult{}, fmt.Errorf("execute es request: %w", err)
	}
	defer resp.Body.Close()
	bodyRaw, err := io.ReadAll(resp.Body)
	if err != nil {
		return SearchLogsResult{}, fmt.Errorf("read es response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return SearchLogsResult{}, fmt.Errorf("es search failed: status=%d body=%s", resp.StatusCode, string(bodyRaw))
	}
	var parsed esSearchResponse
	if err := json.Unmarshal(bodyRaw, &parsed); err != nil {
		return SearchLogsResult{}, fmt.Errorf("decode es response: %w", err)
	}
	return SearchLogsResult{
		TookMS:       parsed.Took,
		TimedOut:     parsed.TimedOut,
		Total:        parseHitsTotal(parsed.Hits.Total),
		Hits:         nil,
		Aggregations: parsed.Aggregations,
	}, nil
}

type esSearchResponse struct {
	Took         int            `json:"took"`
	TimedOut     bool           `json:"timed_out"`
	Hits         esHitsResponse `json:"hits"`
	Aggregations map[string]any `json:"aggregations"`
}

type esHitsResponse struct {
	Total json.RawMessage `json:"total"`
	Hits  []struct {
		ID     string         `json:"_id"`
		Index  string         `json:"_index"`
		Source map[string]any `json:"_source"`
	} `json:"hits"`
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

func parseHitsTotal(raw json.RawMessage) int64 {
	if len(raw) == 0 {
		return 0
	}
	var wrapped struct {
		Value int64 `json:"value"`
	}
	if err := json.Unmarshal(raw, &wrapped); err == nil {
		return wrapped.Value
	}
	var plain int64
	if err := json.Unmarshal(raw, &plain); err == nil {
		return plain
	}
	return 0
}

func buildESQuery(in SearchLogsInput) map[string]any {
	filterClauses := make([]map[string]any, 0, 8)
	mustClauses := make([]map[string]any, 0, 2)

	keywords := strings.TrimSpace(in.Keywords)
	if keywords != "" {
		mustClauses = append(mustClauses, map[string]any{
			"simple_query_string": map[string]any{
				"query":            keywords,
				"default_operator": "and",
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
		field := normalizeFilterField(rawKey)
		if field == "" || value == nil {
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

	if len(mustClauses) == 0 && len(filterClauses) == 0 {
		return map[string]any{"match_all": map[string]any{}}
	}
	boolQuery := map[string]any{}
	if len(mustClauses) > 0 {
		boolQuery["must"] = mustClauses
	}
	if len(filterClauses) > 0 {
		boolQuery["filter"] = filterClauses
	}
	return map[string]any{
		"bool": boolQuery,
	}
}

func buildESSort(sortFields []SortField) []map[string]any {
	sorts := make([]map[string]any, 0, len(sortFields)+1)
	for _, sortField := range sortFields {
		field := strings.TrimSpace(sortField.Field)
		if field == "" {
			continue
		}
		order := strings.ToLower(strings.TrimSpace(sortField.Order))
		if order != "asc" && order != "desc" {
			order = "desc"
		}
		sorts = append(sorts, map[string]any{
			field: map[string]any{
				"order": order,
			},
		})
	}
	if len(sorts) == 0 {
		sorts = append(sorts, map[string]any{
			"@timestamp": map[string]any{
				"order": "desc",
			},
		})
	}
	return sorts
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
	case "level":
		return "log.level"
	case "service":
		return "service.name"
	case "source":
		return "source.path"
	case "agent_id":
		return "agent.id"
	case "batch_id":
		return "nexuslog.transport.batch_id"
	case "traceId":
		return "trace.id"
	case "spanId":
		return "span.id"
	case "statusCode":
		return "http.response.status_code"
	default:
		return strings.TrimSpace(raw)
	}
}

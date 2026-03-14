package repository

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	sharedhttpguard "github.com/nexuslog/data-services/shared/httpguard"
)

const (
	defaultESAddress  = "http://localhost:9200"
	defaultLogsIndex  = "nexuslog-logs-v2"
	defaultScrollKeep = "5m"
	defaultBatchSize  = 5000
	maxExportRecords  = 100000
	defaultESTimeout  = 60 * time.Second
)

// LogHit 表示单条日志命中
type LogHit struct {
	ID     string
	Index  string
	Source map[string]any
}

// ExportQueryParams 导出查询参数，与 query-api SearchLogsInput 兼容
type ExportQueryParams struct {
	TenantID      string         `json:"tenant_id"`
	Keywords      string         `json:"keywords"`
	TimeRangeFrom string         `json:"time_range_from"`
	TimeRangeTo   string         `json:"time_range_to"`
	Filters       map[string]any `json:"filters"`
	Sort          []struct {
		Field string `json:"field"`
		Order string `json:"order"`
	} `json:"sort"`
}

// ESExportRepository 通过 ES scroll API 批量拉取日志用于导出
type ESExportRepository struct {
	address    string
	addressErr error
	index      string
	username   string
	password   string
	client     *http.Client
}

// NewESExportRepositoryFromEnv 从环境变量创建 ES 导出仓储
func NewESExportRepositoryFromEnv() *ESExportRepository {
	address := resolveESAddress()
	index := resolveLogsIndex()
	normalizedAddress, addressErr := sharedhttpguard.NormalizeBaseURL(address, sharedhttpguard.BaseURLOptions{
		AllowPrivate:  true,
		AllowLoopback: true,
	})
	return &ESExportRepository{
		address:    normalizedAddress,
		addressErr: addressErr,
		index:      index,
		username:   strings.TrimSpace(firstNonEmpty(os.Getenv("DATABASE_ELASTICSEARCH_USERNAME"), os.Getenv("ELASTICSEARCH_USERNAME"))),
		password:   strings.TrimSpace(firstNonEmpty(os.Getenv("DATABASE_ELASTICSEARCH_PASSWORD"), os.Getenv("ELASTICSEARCH_PASSWORD"))),
		client:     &http.Client{Timeout: defaultESTimeout},
	}
}

func (r *ESExportRepository) ensureReady() error {
	if r == nil || r.client == nil {
		return fmt.Errorf("es export repository is not configured")
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

// ScrollSearch 使用 scroll API 批量拉取日志，最多 maxRecords 条，回调每批
func (r *ESExportRepository) ScrollSearch(ctx context.Context, params ExportQueryParams, maxRecords int, batchFn func([]LogHit) error) error {
	if err := r.ensureReady(); err != nil {
		return err
	}
	if maxRecords <= 0 || maxRecords > maxExportRecords {
		maxRecords = maxExportRecords
	}
	batchSize := defaultBatchSize
	if batchSize > maxRecords {
		batchSize = maxRecords
	}

	query := buildExportESQuery(params)
	sort := buildExportESSort(params.Sort)
	payload := map[string]any{
		"size":  batchSize,
		"query": query,
		"sort":  sort,
	}
	payloadRaw, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal es query: %w", err)
	}

	// 初始 search with scroll
	endpoint := fmt.Sprintf("%s/%s/_search?scroll=%s", r.address, r.index, defaultScrollKeep)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payloadRaw))
	if err != nil {
		return fmt.Errorf("build es request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if r.username != "" {
		req.SetBasicAuth(r.username, r.password)
	}

	resp, err := r.client.Do(req)
	if err != nil {
		return fmt.Errorf("execute es search: %w", err)
	}
	bodyRaw, err := sharedhttpguard.ReadLimitedBody(resp.Body, 0)
	resp.Body.Close()
	if err != nil {
		return fmt.Errorf("read es response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("es search failed: status=%d body=%s", resp.StatusCode, string(bodyRaw))
	}

	var searchResp esScrollSearchResponse
	if err := json.Unmarshal(bodyRaw, &searchResp); err != nil {
		return fmt.Errorf("decode es response: %w", err)
	}

	totalFetched := 0
	for {
		hits := make([]LogHit, 0, len(searchResp.Hits.Hits))
		for _, h := range searchResp.Hits.Hits {
			hits = append(hits, LogHit{ID: h.ID, Index: h.Index, Source: h.Source})
		}
		if len(hits) > 0 {
			if err := batchFn(hits); err != nil {
				return err
			}
			totalFetched += len(hits)
			if totalFetched >= maxRecords {
				return nil
			}
		}
		if len(searchResp.Hits.Hits) == 0 {
			return nil
		}

		// 继续 scroll
		scrollPayload := map[string]string{
			"scroll_id": searchResp.ScrollID,
			"scroll":    defaultScrollKeep,
		}
		scrollRaw, _ := json.Marshal(scrollPayload)
		scrollReq, err := http.NewRequestWithContext(ctx, http.MethodPost, r.address+"/_search/scroll", bytes.NewReader(scrollRaw))
		if err != nil {
			return fmt.Errorf("build scroll request: %w", err)
		}
		scrollReq.Header.Set("Content-Type", "application/json")
		if r.username != "" {
			scrollReq.SetBasicAuth(r.username, r.password)
		}
		scrollResp, err := r.client.Do(scrollReq)
		if err != nil {
			return fmt.Errorf("execute scroll: %w", err)
		}
		bodyRaw, err = sharedhttpguard.ReadLimitedBody(scrollResp.Body, 0)
		scrollResp.Body.Close()
		if err != nil {
			return fmt.Errorf("read scroll response: %w", err)
		}
		if scrollResp.StatusCode < 200 || scrollResp.StatusCode >= 300 {
			return fmt.Errorf("es scroll failed: status=%d body=%s", scrollResp.StatusCode, string(bodyRaw))
		}
		if err := json.Unmarshal(bodyRaw, &searchResp); err != nil {
			return fmt.Errorf("decode scroll response: %w", err)
		}
	}
}

type esScrollSearchResponse struct {
	ScrollID string `json:"_scroll_id"`
	Hits     struct {
		Hits []struct {
			ID     string         `json:"_id"`
			Index  string         `json:"_index"`
			Source map[string]any `json:"_source"`
		} `json:"hits"`
	} `json:"hits"`
}

func buildExportESQuery(params ExportQueryParams) map[string]any {
	filterClauses := make([]map[string]any, 0, 10)
	mustClauses := make([]map[string]any, 0, 2)

	tenantID := strings.TrimSpace(params.TenantID)
	if tenantID != "" {
		filterClauses = append(filterClauses, map[string]any{
			"bool": map[string]any{
				"should": []any{
					map[string]any{"term": map[string]any{"tenant_id": tenantID}},
					map[string]any{"term": map[string]any{"nexuslog.governance.tenant_id": tenantID}},
				},
				"minimum_should_match": 1,
			},
		})
	}

	keywords := strings.TrimSpace(params.Keywords)
	if keywords != "" {
		mustClauses = append(mustClauses, map[string]any{
			"multi_match": map[string]any{
				"query":    keywords,
				"operator": "and",
				"type":     "best_fields",
				"fields":   []string{"message^2", "raw_log", "source_ref", "source_path", "agent_id", "record_id", "batch_id", "service"},
			},
		})
	}
	if from := strings.TrimSpace(params.TimeRangeFrom); from != "" {
		filterClauses = append(filterClauses, map[string]any{
			"range": map[string]any{"@timestamp": map[string]any{"gte": from}},
		})
	}
	if to := strings.TrimSpace(params.TimeRangeTo); to != "" {
		filterClauses = append(filterClauses, map[string]any{
			"range": map[string]any{"@timestamp": map[string]any{"lte": to}},
		})
	}
	for key, value := range params.Filters {
		field := normalizeExportFilterField(key)
		if field == "" || value == nil {
			continue
		}
		if terms := normalizeTerms(value); len(terms) > 0 {
			filterClauses = append(filterClauses, map[string]any{"terms": map[string]any{field: terms}})
		} else {
			filterClauses = append(filterClauses, map[string]any{"term": map[string]any{field: value}})
		}
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
	return map[string]any{"bool": boolQuery}
}

func buildExportESSort(sort []struct {
	Field string `json:"field"`
	Order string `json:"order"`
}) []map[string]any {
	sorts := make([]map[string]any, 0, len(sort)+1)
	for _, s := range sort {
		field := normalizeExportSortField(s.Field)
		if field == "" {
			continue
		}
		order := strings.ToLower(strings.TrimSpace(s.Order))
		if order != "asc" && order != "desc" {
			order = "desc"
		}
		sorts = append(sorts, map[string]any{field: map[string]any{"order": order}})
	}
	if len(sorts) == 0 {
		sorts = append(sorts, map[string]any{"@timestamp": map[string]any{"order": "desc"}})
	}
	return sorts
}

func normalizeExportFilterField(raw string) string {
	switch strings.TrimSpace(raw) {
	case "@timestamp", "timestamp":
		return "@timestamp"
	case "message":
		return "message"
	case "level":
		return "level"
	case "service":
		return "service"
	case "source", "source_path":
		return "source_path"
	case "source_ref":
		return "source_ref"
	case "agent_id":
		return "agent_id"
	case "record_id":
		return "record_id"
	case "batch_id":
		return "batch_id"
	default:
		return ""
	}
}

func normalizeExportSortField(raw string) string {
	switch strings.TrimSpace(raw) {
	case "@timestamp", "timestamp":
		return "@timestamp"
	case "message":
		return "message"
	case "level":
		return "level"
	case "service":
		return "service"
	case "raw_log":
		return "raw_log"
	case "source_ref":
		return "source_ref"
	case "source", "source_path":
		return "source_path"
	case "agent_id":
		return "agent_id"
	case "record_id":
		return "record_id"
	case "batch_id":
		return "batch_id"
	default:
		return ""
	}
}

func normalizeTerms(value any) []any {
	switch typed := value.(type) {
	case []any:
		out := make([]any, 0, len(typed))
		for _, item := range typed {
			if item != nil {
				out = append(out, item)
			}
		}
		return out
	case []string:
		out := make([]any, 0, len(typed))
		for _, item := range typed {
			if s := strings.TrimSpace(item); s != "" {
				out = append(out, s)
			}
		}
		return out
	default:
		return nil
	}
}

func resolveESAddress() string {
	for _, key := range []string{"DATABASE_ELASTICSEARCH_ADDRESSES", "ELASTICSEARCH_URL", "SEARCH_ELASTICSEARCH_ADDRESSES"} {
		if v := os.Getenv(key); v != "" {
			for _, part := range strings.Split(v, ",") {
				if addr := strings.TrimSpace(part); addr != "" {
					return addr
				}
			}
		}
	}
	return defaultESAddress
}

func resolveLogsIndex() string {
	for _, key := range []string{"QUERY_LOGS_INDEX", "DATABASE_ELASTICSEARCH_INDEX", "INGEST_ES_INDEX"} {
		if v := strings.TrimSpace(os.Getenv(key)); v != "" {
			return v
		}
	}
	return defaultLogsIndex
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if s := strings.TrimSpace(v); s != "" {
			return s
		}
	}
	return ""
}

func resolveESTimeout() time.Duration {
	raw := strings.TrimSpace(os.Getenv("QUERY_ES_TIMEOUT_SEC"))
	if raw == "" {
		return defaultESTimeout
	}
	sec, err := strconv.Atoi(raw)
	if err != nil || sec <= 0 {
		return defaultESTimeout
	}
	return time.Duration(sec) * time.Second
}

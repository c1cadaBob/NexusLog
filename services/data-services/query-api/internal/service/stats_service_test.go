package service

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/nexuslog/data-services/query-api/internal/repository"
	sharedauth "github.com/nexuslog/data-services/shared/auth"
)

func TestStatsServiceAggregate_UsesMinuteHistogramAndStructuredQuery(t *testing.T) {
	t.Helper()

	var captured map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("decode request body failed: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"took": 3,
			"timed_out": false,
			"hits": {"total": {"value": 0}, "hits": []},
			"aggregations": {
				"by_dim": {
					"buckets": [
						{"key_as_string": "2026-03-11T12:00:00.000Z", "doc_count": 5},
						{"key_as_string": "2026-03-11T12:01:00.000Z", "doc_count": 2}
					]
				}
			}
		}`))
	}))
	defer server.Close()

	t.Setenv("DATABASE_ELASTICSEARCH_ADDRESSES", server.URL)
	t.Setenv("QUERY_LOGS_INDEX", "nexuslog-logs-read")

	actor := RequestActor{TenantID: "11111111-1111-1111-1111-111111111111"}
	svc := NewStatsService(repository.NewElasticsearchRepositoryFromEnv(), nil)
	result, err := svc.Aggregate(context.Background(), actor, AggregateRequest{
		GroupBy:   "minute",
		TimeRange: "30m",
		Keywords:  "level:error AND service:query-api",
		Filters: map[string]any{
			"service": "query-api",
		},
	})
	if err != nil {
		t.Fatalf("Aggregate() error = %v", err)
	}
	if len(result.Buckets) != 2 {
		t.Fatalf("Aggregate() buckets len = %d, want 2", len(result.Buckets))
	}
	if result.Buckets[0].Key != "2026-03-11T12:00:00.000Z" || result.Buckets[0].Count != 5 {
		t.Fatalf("unexpected first bucket: %+v", result.Buckets[0])
	}

	trackTotalHits, ok := captured["track_total_hits"].(bool)
	if !ok {
		t.Fatalf("request track_total_hits missing: %#v", captured)
	}
	if trackTotalHits {
		t.Fatalf("track_total_hits = %v, want false", trackTotalHits)
	}

	aggs, ok := captured["aggs"].(map[string]any)
	if !ok {
		t.Fatalf("request aggs missing: %#v", captured)
	}
	byDim, ok := aggs["by_dim"].(map[string]any)
	if !ok {
		t.Fatalf("request by_dim missing: %#v", aggs)
	}
	dateHistogram, ok := byDim["date_histogram"].(map[string]any)
	if !ok {
		t.Fatalf("request date_histogram missing: %#v", byDim)
	}
	if got := dateHistogram["fixed_interval"]; got != "1m" {
		t.Fatalf("fixed_interval = %v, want 1m", got)
	}
	if got := dateHistogram["min_doc_count"]; got != float64(0) {
		t.Fatalf("min_doc_count = %v, want 0", got)
	}
	bounds, ok := dateHistogram["extended_bounds"].(map[string]any)
	if !ok {
		t.Fatalf("extended_bounds missing: %#v", dateHistogram)
	}
	minRaw, _ := bounds["min"].(string)
	maxRaw, _ := bounds["max"].(string)
	if minRaw == "" || maxRaw == "" {
		t.Fatalf("extended bounds should contain min/max, got %#v", bounds)
	}

	raw, err := json.Marshal(captured)
	if err != nil {
		t.Fatalf("marshal captured request failed: %v", err)
	}
	body := string(raw)
	for _, fragment := range []string{
		`"multi_match"`,
		`"query":"level:error AND service:query-api"`,
		`"service.name":"query-api"`,
		`"value":"*/query-api"`,
		`"@timestamp"`,
	} {
		if !strings.Contains(body, fragment) {
			t.Fatalf("expected request body to contain %s, got %s", fragment, body)
		}
	}
}

func TestStatsServiceAggregate_SourceBucketsExposeHostAndService(t *testing.T) {
	t.Helper()

	var captured map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("decode request body failed: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"took": 3,
			"timed_out": false,
			"hits": {"total": {"value": 0}, "hits": []},
			"aggregations": {
				"by_source_service_name": {
					"pairs": {
						"buckets": [
							{"key": ["node-a", "nginx"], "doc_count": 5},
							{"key": ["node-b", "api"], "doc_count": 3}
						]
					}
				},
				"by_source_container_name": {
					"pairs": {
						"buckets": [
							{"key": ["node-a", "nginx"], "doc_count": 4}
						]
					}
				},
				"by_source_instance_id": {
					"pairs": {
						"buckets": [
							{"key": ["node-c", "instance-1"], "doc_count": 2}
						]
					}
				},
				"by_source_log_path": {
					"pairs": {
						"buckets": [
							{"key": ["node-d", "/var/log/audit/audit.log"], "doc_count": 7}
						]
					}
				}
			}
		}`))
	}))
	defer server.Close()

	t.Setenv("DATABASE_ELASTICSEARCH_ADDRESSES", server.URL)
	t.Setenv("QUERY_LOGS_INDEX", "nexuslog-logs-read")

	svc := NewStatsService(repository.NewElasticsearchRepositoryFromEnv(), nil)
	result, err := svc.Aggregate(context.Background(), RequestActor{TenantID: "11111111-1111-1111-1111-111111111111"}, AggregateRequest{
		GroupBy:   "source",
		TimeRange: "7d",
	})
	if err != nil {
		t.Fatalf("Aggregate() error = %v", err)
	}
	if len(result.Buckets) != 4 {
		t.Fatalf("Aggregate() buckets len = %d, want 4", len(result.Buckets))
	}
	if got := result.Buckets[0]; got.Host != "node-a" || got.Service != "nginx" || got.Label != "node-a / nginx" || got.Count != 9 {
		t.Fatalf("unexpected merged source aggregate bucket: %+v", got)
	}
	if got := result.Buckets[1]; got.Host != "node-d" || got.Service != "audit.log" || got.Label != "node-d / audit.log" || got.Count != 7 {
		t.Fatalf("unexpected log-path fallback bucket: %+v", got)
	}

	raw, err := json.Marshal(captured)
	if err != nil {
		t.Fatalf("marshal captured request failed: %v", err)
	}
	body := string(raw)
	for _, fragment := range []string{"multi_terms", "host.name", "service.name", "container.name", "service.instance.id", "log.file.path"} {
		if !strings.Contains(body, fragment) {
			t.Fatalf("expected request body to contain %q, got %s", fragment, body)
		}
	}
	for _, fragment := range []string{"top_hits", "sample_document", "script"} {
		if strings.Contains(body, fragment) {
			t.Fatalf("expected source aggregate request not to contain %q, got %s", fragment, body)
		}
	}
}

func TestStatsServiceAggregate_SourceBucketsFallbackToLogPathForBogusServiceValues(t *testing.T) {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"took": 3,
			"timed_out": false,
			"hits": {"total": {"value": 0}, "hits": []},
			"aggregations": {
				"by_source_service_name": {
					"pairs": {
						"buckets": [
							{"key": ["node-a", "Mar", "/var/log/messages"], "doc_count": 5},
							{"key": ["node-b", "2026", "/var/log/audit/audit.log"], "doc_count": 3},
							{"key": ["node-c", "query-api", "/var/log/query-api/current.log"], "doc_count": 2}
						]
					}
				}
			}
		}`))
	}))
	defer server.Close()

	t.Setenv("DATABASE_ELASTICSEARCH_ADDRESSES", server.URL)
	t.Setenv("QUERY_LOGS_INDEX", "nexuslog-logs-read")

	svc := NewStatsService(repository.NewElasticsearchRepositoryFromEnv(), nil)
	result, err := svc.Aggregate(context.Background(), RequestActor{TenantID: "11111111-1111-1111-1111-111111111111"}, AggregateRequest{
		GroupBy:   "source",
		TimeRange: "7d",
	})
	if err != nil {
		t.Fatalf("Aggregate() error = %v", err)
	}
	if len(result.Buckets) != 3 {
		t.Fatalf("Aggregate() buckets len = %d, want 3", len(result.Buckets))
	}
	if got := result.Buckets[0]; got.Host != "node-a" || got.Service != "messages" || got.Label != "node-a / messages" || got.Count != 5 {
		t.Fatalf("unexpected month-name fallback bucket: %+v", got)
	}
	if got := result.Buckets[1]; got.Host != "node-b" || got.Service != "audit.log" || got.Label != "node-b / audit.log" || got.Count != 3 {
		t.Fatalf("unexpected numeric fallback bucket: %+v", got)
	}
	if got := result.Buckets[2]; got.Host != "node-c" || got.Service != "query-api" || got.Label != "node-c / query-api" || got.Count != 2 {
		t.Fatalf("unexpected preserved service bucket: %+v", got)
	}
}

func TestStatsServiceAggregate_UsesFreshCacheForIdenticalRequests(t *testing.T) {
	t.Helper()

	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"took": 2,
			"timed_out": false,
			"hits": {"total": {"value": 0}, "hits": []},
			"aggregations": {
				"by_dim": {
					"buckets": [
						{"key_as_string": "2026-03-11T12:00:00.000Z", "doc_count": 5}
					]
				}
			}
		}`))
	}))
	defer server.Close()

	t.Setenv("DATABASE_ELASTICSEARCH_ADDRESSES", server.URL)
	t.Setenv("QUERY_LOGS_INDEX", "nexuslog-logs-read")

	svc := NewStatsService(repository.NewElasticsearchRepositoryFromEnv(), nil)
	actor := RequestActor{TenantID: "11111111-1111-1111-1111-111111111111"}
	req := AggregateRequest{GroupBy: "minute", TimeRange: "30m"}

	first, err := svc.Aggregate(context.Background(), actor, req)
	if err != nil {
		t.Fatalf("first Aggregate() error = %v", err)
	}
	second, err := svc.Aggregate(context.Background(), actor, req)
	if err != nil {
		t.Fatalf("second Aggregate() error = %v", err)
	}
	if requestCount != 1 {
		t.Fatalf("expected a single ES request, got %d", requestCount)
	}
	if len(first.Buckets) != 1 || len(second.Buckets) != 1 {
		t.Fatalf("unexpected cached buckets: first=%d second=%d", len(first.Buckets), len(second.Buckets))
	}
}

func TestStatsServiceAggregate_FallsBackToStaleCacheOnESError(t *testing.T) {
	t.Helper()

	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		w.Header().Set("Content-Type", "application/json")
		if requestCount == 1 {
			_, _ = w.Write([]byte(`{
				"took": 2,
				"timed_out": false,
				"hits": {"total": {"value": 0}, "hits": []},
				"aggregations": {
					"by_dim": {
						"buckets": [
							{"key_as_string": "2026-03-11T12:00:00.000Z", "doc_count": 5}
						]
					}
				}
			}`))
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":"es unavailable"}`))
	}))
	defer server.Close()

	t.Setenv("DATABASE_ELASTICSEARCH_ADDRESSES", server.URL)
	t.Setenv("QUERY_LOGS_INDEX", "nexuslog-logs-read")

	svc := NewStatsService(repository.NewElasticsearchRepositoryFromEnv(), nil)
	actor := RequestActor{TenantID: "11111111-1111-1111-1111-111111111111"}
	req := AggregateRequest{GroupBy: "minute", TimeRange: "30m"}

	first, err := svc.Aggregate(context.Background(), actor, req)
	if err != nil {
		t.Fatalf("first Aggregate() error = %v", err)
	}
	cacheKey := aggregateCacheKey(actor, normalizeAggregateRequest(req))
	svc.aggregateCacheMu.Lock()
	entry := svc.aggregateCache[cacheKey]
	entry.expiresAt = time.Now().Add(-time.Second)
	svc.aggregateCache[cacheKey] = entry
	svc.aggregateCacheMu.Unlock()

	second, err := svc.Aggregate(context.Background(), actor, req)
	if err != nil {
		t.Fatalf("second Aggregate() should fall back to stale cache, got %v", err)
	}
	if requestCount != 3 {
		t.Fatalf("expected three ES requests with one retry before stale fallback, got %d", requestCount)
	}
	if len(first.Buckets) != 1 || len(second.Buckets) != 1 || first.Buckets[0].Count != second.Buckets[0].Count {
		t.Fatalf("unexpected fallback buckets: first=%+v second=%+v", first.Buckets, second.Buckets)
	}
}

func TestBuildAlertSummaryQuery_UsesExplicitTenantPredicate(t *testing.T) {
	query, args, err := buildAlertSummaryQuery(RequestActor{TenantID: "tenant-a"})
	if err != nil {
		t.Fatalf("buildAlertSummaryQuery() error = %v", err)
	}
	if !strings.Contains(query, "tenant_id = $1::uuid") {
		t.Fatalf("buildAlertSummaryQuery() query = %q, want tenant predicate", query)
	}
	if len(args) != 1 || args[0] != "tenant-a" {
		t.Fatalf("buildAlertSummaryQuery() args = %#v, want tenant-a", args)
	}
}

func TestBuildAlertSummaryQuery_OmitsTenantPredicateForAllTenants(t *testing.T) {
	query, args, err := buildAlertSummaryQuery(RequestActor{TenantID: "tenant-a", TenantReadScope: sharedauth.TenantReadScopeAllTenants})
	if err != nil {
		t.Fatalf("buildAlertSummaryQuery() error = %v", err)
	}
	if strings.Contains(query, "tenant_id = $1::uuid") {
		t.Fatalf("buildAlertSummaryQuery() query = %q, did not expect tenant predicate", query)
	}
	if len(args) != 0 {
		t.Fatalf("buildAlertSummaryQuery() args = %#v, want empty", args)
	}
}

func TestBuildAlertSummaryQuery_UsesAuthorizedTenantSetWhenPresent(t *testing.T) {
	query, args, err := buildAlertSummaryQuery(RequestActor{AuthorizedTenantIDs: []string{"tenant-b", "tenant-a"}})
	if err != nil {
		t.Fatalf("buildAlertSummaryQuery() error = %v", err)
	}
	if !strings.Contains(query, "tenant_id = ANY($1::uuid[])") {
		t.Fatalf("buildAlertSummaryQuery() query = %q, want ANY tenant predicate", query)
	}
	if len(args) != 1 {
		t.Fatalf("buildAlertSummaryQuery() args len = %d, want 1", len(args))
	}
	valuer, ok := args[0].(driver.Valuer)
	if !ok {
		t.Fatalf("buildAlertSummaryQuery() arg[0] type = %T, want driver.Valuer", args[0])
	}
	encoded, err := valuer.Value()
	if err != nil {
		t.Fatalf("valuer.Value() error = %v", err)
	}
	if encoded != `{"tenant-a","tenant-b"}` {
		t.Fatalf("valuer.Value() = %v, want normalized pq array", encoded)
	}
}

func TestAppendTenantFilter_UsesMatchNoneWhenTenantMissing(t *testing.T) {
	filters := appendTenantFilter(nil, RequestActor{})
	if len(filters) != 1 {
		t.Fatalf("appendTenantFilter() len = %d, want 1", len(filters))
	}
	if _, ok := filters[0]["match_none"]; !ok {
		t.Fatalf("appendTenantFilter() = %#v, want match_none guard", filters)
	}
}

func TestAppendTenantFilter_SkipsTenantScopeForGlobalAccess(t *testing.T) {
	filters := appendTenantFilter([]map[string]any{{"term": map[string]any{"log.level": "error"}}}, RequestActor{TenantID: "tenant-a", TenantReadScope: sharedauth.TenantReadScopeAllTenants})
	if len(filters) != 1 {
		t.Fatalf("appendTenantFilter() len = %d, want 1", len(filters))
	}
	if _, ok := filters[0]["term"]; !ok {
		t.Fatalf("appendTenantFilter() = %#v, want original filters only", filters)
	}
}

func TestAppendTenantFilter_UsesAuthorizedTenantSetTermsFilter(t *testing.T) {
	filters := appendTenantFilter(nil, RequestActor{AuthorizedTenantIDs: []string{"tenant-b", "tenant-a"}})
	if len(filters) != 1 {
		t.Fatalf("appendTenantFilter() len = %d, want 1", len(filters))
	}
	raw, err := json.Marshal(filters[0])
	if err != nil {
		t.Fatalf("marshal filter failed: %v", err)
	}
	body := string(raw)
	if !strings.Contains(body, `"terms":{"tenant_id":["tenant-a","tenant-b"]}`) {
		t.Fatalf("appendTenantFilter() = %s, want tenant terms filter", body)
	}
	if !strings.Contains(body, `"terms":{"nexuslog.governance.tenant_id":["tenant-a","tenant-b"]}`) {
		t.Fatalf("appendTenantFilter() = %s, want governance tenant terms filter", body)
	}
}

func TestStatsServiceGetOverviewStats_SkipsTenantFilterForGlobalAccess(t *testing.T) {
	t.Helper()

	var captured map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("decode request body failed: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"took": 2,
			"timed_out": false,
			"hits": {"total": {"value": 12}, "hits": []},
			"aggregations": {
				"by_level": {"buckets": []},
				"by_source": {"buckets": []},
				"log_trend": {"buckets": []}
			}
		}`))
	}))
	defer server.Close()

	t.Setenv("DATABASE_ELASTICSEARCH_ADDRESSES", server.URL)
	t.Setenv("QUERY_LOGS_INDEX", "nexuslog-logs-read")

	svc := NewStatsService(repository.NewElasticsearchRepositoryFromEnv(), nil)
	_, err := svc.GetOverviewStats(context.Background(), RequestActor{
		TenantID:        "11111111-1111-1111-1111-111111111111",
		TenantReadScope: sharedauth.TenantReadScopeAllTenants,
	}, "24h")
	if err != nil {
		t.Fatalf("GetOverviewStats() error = %v", err)
	}

	raw, err := json.Marshal(captured)
	if err != nil {
		t.Fatalf("marshal captured request failed: %v", err)
	}
	body := string(raw)
	if strings.Contains(body, `"tenant_id":"11111111-1111-1111-1111-111111111111"`) {
		t.Fatalf("unexpected tenant filter in %s", body)
	}
	if strings.Contains(body, `"nexuslog.governance.tenant_id":"11111111-1111-1111-1111-111111111111"`) {
		t.Fatalf("unexpected governance tenant filter in %s", body)
	}
}

func TestStatsServiceGetOverviewStats_ExtractsTopSourceHostAndService(t *testing.T) {
	t.Helper()

	var captured map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("decode request body failed: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"took": 2,
			"timed_out": false,
			"hits": {"total": {"value": 12}, "hits": []},
			"aggregations": {
				"by_level": {"buckets": []},
				"by_source_service_name": {
					"pairs": {
						"buckets": [
							{"key": ["node-a", "nginx", "/var/log/nginx/access.log"], "doc_count": 9}
						]
					}
				},
				"by_source_container_name": {"pairs": {"buckets": []}},
				"by_source_instance_id": {"pairs": {"buckets": []}},
				"by_source_log_path": {"pairs": {"buckets": []}},
				"log_trend": {"buckets": []}
			}
		}`))
	}))
	defer server.Close()

	t.Setenv("DATABASE_ELASTICSEARCH_ADDRESSES", server.URL)
	t.Setenv("QUERY_LOGS_INDEX", "nexuslog-logs-read")

	svc := NewStatsService(repository.NewElasticsearchRepositoryFromEnv(), nil)
	result, err := svc.GetOverviewStats(context.Background(), RequestActor{TenantID: "11111111-1111-1111-1111-111111111111"}, "24h")
	if err != nil {
		t.Fatalf("GetOverviewStats() error = %v", err)
	}
	if len(result.TopSources) != 1 {
		t.Fatalf("GetOverviewStats() top sources len = %d, want 1", len(result.TopSources))
	}
	if got := result.TopSources[0]; got.Source != "node-a / nginx" || got.Host != "node-a" || got.Service != "nginx" || got.Count != 9 {
		t.Fatalf("unexpected top source: %+v", got)
	}

	raw, err := json.Marshal(captured)
	if err != nil {
		t.Fatalf("marshal captured request failed: %v", err)
	}
	body := string(raw)
	for _, fragment := range []string{"multi_terms", "host.name", "service.name", "log.file.path"} {
		if !strings.Contains(body, fragment) {
			t.Fatalf("expected request body to contain %q, got %s", fragment, body)
		}
	}
	for _, fragment := range []string{"sample_document", "top_hits"} {
		if strings.Contains(body, fragment) {
			t.Fatalf("expected request body not to contain %q, got %s", fragment, body)
		}
	}
}

func TestStatsServiceGetOverviewStats_UsesSevenDayRangeAndDailyTrend(t *testing.T) {
	t.Helper()

	var captured map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("decode request body failed: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"took": 2,
			"timed_out": false,
			"hits": {"total": {"value": 42}, "hits": []},
			"aggregations": {
				"by_level": {"buckets": []},
				"by_source_service_name": {"pairs": {"buckets": []}},
				"by_source_container_name": {"pairs": {"buckets": []}},
				"by_source_instance_id": {"pairs": {"buckets": []}},
				"by_source_log_path": {"pairs": {"buckets": []}},
				"log_trend": {
					"buckets": [
						{"key_as_string": "2026-03-10T00:00:00.000Z", "doc_count": 10},
						{"key_as_string": "2026-03-11T00:00:00.000Z", "doc_count": 32}
					]
				}
			}
		}`))
	}))
	defer server.Close()

	t.Setenv("DATABASE_ELASTICSEARCH_ADDRESSES", server.URL)
	t.Setenv("QUERY_LOGS_INDEX", "nexuslog-logs-read")

	svc := NewStatsService(repository.NewElasticsearchRepositoryFromEnv(), nil)
	result, err := svc.GetOverviewStats(context.Background(), RequestActor{TenantID: "11111111-1111-1111-1111-111111111111"}, "7d")
	if err != nil {
		t.Fatalf("GetOverviewStats() error = %v", err)
	}
	if result.TotalLogs != 42 {
		t.Fatalf("GetOverviewStats() total_logs = %d, want 42", result.TotalLogs)
	}
	if len(result.LogTrend) != 2 {
		t.Fatalf("GetOverviewStats() log_trend len = %d, want 2", len(result.LogTrend))
	}

	raw, err := json.Marshal(captured)
	if err != nil {
		t.Fatalf("marshal captured request failed: %v", err)
	}
	body := string(raw)
	if !strings.Contains(body, `"calendar_interval":"day"`) {
		t.Fatalf("expected 7d overview request to use day histogram, got %s", body)
	}
	if !strings.Contains(body, `"extended_bounds"`) {
		t.Fatalf("expected 7d overview request to include extended bounds, got %s", body)
	}
	if !strings.Contains(body, `"gte"`) || !strings.Contains(body, `"lte"`) {
		t.Fatalf("expected 7d overview request to include time range query, got %s", body)
	}
}

func TestStatsServiceGetOverviewStats_ReusesFreshCacheForBurstRequests(t *testing.T) {
	t.Helper()

	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"took": 2,
			"timed_out": false,
			"hits": {"total": {"value": 21}, "hits": []},
			"aggregations": {
				"by_level": {"buckets": []},
				"by_source": {"buckets": []},
				"log_trend": {"buckets": []}
			}
		}`))
	}))
	defer server.Close()

	t.Setenv("DATABASE_ELASTICSEARCH_ADDRESSES", server.URL)
	t.Setenv("QUERY_LOGS_INDEX", "nexuslog-logs-read")

	svc := NewStatsService(repository.NewElasticsearchRepositoryFromEnv(), nil)
	actor := RequestActor{TenantID: "11111111-1111-1111-1111-111111111111"}

	first, err := svc.GetOverviewStats(context.Background(), actor, "24h")
	if err != nil {
		t.Fatalf("first GetOverviewStats() error = %v", err)
	}
	second, err := svc.GetOverviewStats(context.Background(), actor, "24h")
	if err != nil {
		t.Fatalf("second GetOverviewStats() error = %v", err)
	}
	if requestCount != 1 {
		t.Fatalf("expected a single ES request, got %d", requestCount)
	}
	if first.TotalLogs != 21 || second.TotalLogs != 21 {
		t.Fatalf("unexpected cached totals: first=%d second=%d", first.TotalLogs, second.TotalLogs)
	}
}

func TestStatsServiceGetOverviewStats_FallsBackToStaleCacheOnESError(t *testing.T) {
	t.Helper()

	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		w.Header().Set("Content-Type", "application/json")
		if requestCount == 1 {
			_, _ = w.Write([]byte(`{
				"took": 2,
				"timed_out": false,
				"hits": {"total": {"value": 34}, "hits": []},
				"aggregations": {
					"by_level": {"buckets": []},
					"by_source": {"buckets": []},
					"log_trend": {"buckets": []}
				}
			}`))
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":"es unavailable"}`))
	}))
	defer server.Close()

	t.Setenv("DATABASE_ELASTICSEARCH_ADDRESSES", server.URL)
	t.Setenv("QUERY_LOGS_INDEX", "nexuslog-logs-read")

	svc := NewStatsService(repository.NewElasticsearchRepositoryFromEnv(), nil)
	actor := RequestActor{TenantID: "11111111-1111-1111-1111-111111111111"}

	first, err := svc.GetOverviewStats(context.Background(), actor, "24h")
	if err != nil {
		t.Fatalf("first GetOverviewStats() error = %v", err)
	}
	cacheKey := overviewStatsCacheKey(actor, "24h")
	svc.overviewCacheMu.Lock()
	entry := svc.overviewCache[cacheKey]
	entry.expiresAt = time.Now().Add(-time.Second)
	svc.overviewCache[cacheKey] = entry
	svc.overviewCacheMu.Unlock()

	second, err := svc.GetOverviewStats(context.Background(), actor, "24h")
	if err != nil {
		t.Fatalf("second GetOverviewStats() should fall back to stale cache, got %v", err)
	}
	if requestCount != 3 {
		t.Fatalf("expected three ES requests with one retry before stale fallback, got %d", requestCount)
	}
	if first.TotalLogs != 34 || second.TotalLogs != 34 {
		t.Fatalf("unexpected fallback totals: first=%d second=%d", first.TotalLogs, second.TotalLogs)
	}
}

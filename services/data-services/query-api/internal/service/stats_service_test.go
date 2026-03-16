package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/nexuslog/data-services/query-api/internal/repository"
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

func TestAppendTenantFilter_UsesMatchNoneWhenTenantMissing(t *testing.T) {
	filters := appendTenantFilter(nil, "", false)
	if len(filters) != 1 {
		t.Fatalf("appendTenantFilter() len = %d, want 1", len(filters))
	}
	if _, ok := filters[0]["match_none"]; !ok {
		t.Fatalf("appendTenantFilter() = %#v, want match_none guard", filters)
	}
}

func TestAppendTenantFilter_SkipsTenantScopeForGlobalAccess(t *testing.T) {
	filters := appendTenantFilter([]map[string]any{{"term": map[string]any{"log.level": "error"}}}, "tenant-a", true)
	if len(filters) != 1 {
		t.Fatalf("appendTenantFilter() len = %d, want 1", len(filters))
	}
	if _, ok := filters[0]["term"]; !ok {
		t.Fatalf("appendTenantFilter() = %#v, want original filters only", filters)
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
		TenantID:       "11111111-1111-1111-1111-111111111111",
		CanReadAllLogs: true,
	})
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
				"by_source": {
					"buckets": [
						{
							"key": "/var/log/nginx/access.log",
							"doc_count": 9,
							"sample_document": {
								"hits": {
									"hits": [
										{
											"_source": {
												"source": {"path": "/var/log/nginx/access.log"},
												"host": {"name": "node-a"},
												"service": {"name": "nginx"}
											}
										}
									]
								}
							}
						}
					]
				},
				"log_trend": {"buckets": []}
			}
		}`))
	}))
	defer server.Close()

	t.Setenv("DATABASE_ELASTICSEARCH_ADDRESSES", server.URL)
	t.Setenv("QUERY_LOGS_INDEX", "nexuslog-logs-read")

	svc := NewStatsService(repository.NewElasticsearchRepositoryFromEnv(), nil)
	result, err := svc.GetOverviewStats(context.Background(), RequestActor{TenantID: "11111111-1111-1111-1111-111111111111"})
	if err != nil {
		t.Fatalf("GetOverviewStats() error = %v", err)
	}
	if len(result.TopSources) != 1 {
		t.Fatalf("GetOverviewStats() top sources len = %d, want 1", len(result.TopSources))
	}
	if got := result.TopSources[0]; got.Source != "/var/log/nginx/access.log" || got.Host != "node-a" || got.Service != "nginx" || got.Count != 9 {
		t.Fatalf("unexpected top source: %+v", got)
	}

	raw, err := json.Marshal(captured)
	if err != nil {
		t.Fatalf("marshal captured request failed: %v", err)
	}
	body := string(raw)
	for _, fragment := range []string{"sample_document", "top_hits", "host.name", "service.name"} {
		if !strings.Contains(body, fragment) {
			t.Fatalf("expected request body to contain %q, got %s", fragment, body)
		}
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

	first, err := svc.GetOverviewStats(context.Background(), actor)
	if err != nil {
		t.Fatalf("first GetOverviewStats() error = %v", err)
	}
	second, err := svc.GetOverviewStats(context.Background(), actor)
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

	first, err := svc.GetOverviewStats(context.Background(), actor)
	if err != nil {
		t.Fatalf("first GetOverviewStats() error = %v", err)
	}
	cacheKey := overviewStatsCacheKey(actor)
	svc.overviewCacheMu.Lock()
	entry := svc.overviewCache[cacheKey]
	entry.expiresAt = time.Now().Add(-time.Second)
	svc.overviewCache[cacheKey] = entry
	svc.overviewCacheMu.Unlock()

	second, err := svc.GetOverviewStats(context.Background(), actor)
	if err != nil {
		t.Fatalf("second GetOverviewStats() should fall back to stale cache, got %v", err)
	}
	if requestCount != 2 {
		t.Fatalf("expected two ES requests, got %d", requestCount)
	}
	if first.TotalLogs != 34 || second.TotalLogs != 34 {
		t.Fatalf("unexpected fallback totals: first=%d second=%d", first.TotalLogs, second.TotalLogs)
	}
}

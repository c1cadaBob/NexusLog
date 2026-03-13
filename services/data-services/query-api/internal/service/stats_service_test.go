package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

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

	svc := NewStatsService(repository.NewElasticsearchRepositoryFromEnv(), nil)
	result, err := svc.Aggregate(context.Background(), DefaultTenantID, AggregateRequest{
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
		`"simple_query_string"`,
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

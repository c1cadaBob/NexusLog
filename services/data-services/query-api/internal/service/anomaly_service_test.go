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

func TestStatsServiceDetectAnomalies_ReturnsTrendAndDetectedItems(t *testing.T) {
	t.Helper()

	var captured map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("decode request body failed: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"took": 5,
			"timed_out": false,
			"hits": {"total": {"value": 0}, "hits": []},
			"aggregations": {
				"timeline": {
					"buckets": [
						{"key_as_string": "2026-03-21T00:00:00Z", "doc_count": 100, "error_logs": {"doc_count": 5}},
						{"key_as_string": "2026-03-21T02:00:00Z", "doc_count": 110, "error_logs": {"doc_count": 6}},
						{"key_as_string": "2026-03-21T04:00:00Z", "doc_count": 95, "error_logs": {"doc_count": 5}},
						{"key_as_string": "2026-03-21T06:00:00Z", "doc_count": 320, "error_logs": {"doc_count": 60}}
					]
				},
				"by_source_service_name": {
					"pairs": {
						"buckets": [
							{"key": ["node-a", "payments-api"], "doc_count": 120}
						]
					}
				},
				"by_source_container_name": {"pairs": {"buckets": []}},
				"by_source_instance_id": {"pairs": {"buckets": []}},
				"by_source_log_path": {"pairs": {"buckets": []}}
			}
		}`))
	}))
	defer server.Close()

	t.Setenv("DATABASE_ELASTICSEARCH_ADDRESSES", server.URL)
	t.Setenv("QUERY_LOGS_INDEX", "nexuslog-logs-read")

	svc := NewStatsService(repository.NewElasticsearchRepositoryFromEnv(), nil)
	result, err := svc.DetectAnomalies(context.Background(), RequestActor{TenantID: "11111111-1111-1111-1111-111111111111"}, AnomalyRequest{
		TimeRange: "24h",
	})
	if err != nil {
		t.Fatalf("DetectAnomalies() error = %v", err)
	}
	if len(result.Trend) != 4 {
		t.Fatalf("trend len = %d, want 4", len(result.Trend))
	}
	if len(result.Anomalies) == 0 {
		t.Fatalf("expected anomalies, got %+v", result)
	}
	if result.Summary.TotalAnomalies != len(result.Anomalies) {
		t.Fatalf("summary total anomalies = %d, want %d", result.Summary.TotalAnomalies, len(result.Anomalies))
	}
	if result.Summary.CriticalCount == 0 {
		t.Fatalf("expected at least one critical anomaly, got %+v", result.Anomalies)
	}
	if got := result.Anomalies[0].Service; got != "payments-api" {
		t.Fatalf("dominant service = %q, want payments-api", got)
	}
	if !result.Trend[3].IsAnomaly {
		t.Fatalf("expected last trend bucket to be anomaly, got %+v", result.Trend[3])
	}

	raw, err := json.Marshal(captured)
	if err != nil {
		t.Fatalf("marshal captured request failed: %v", err)
	}
	body := string(raw)
	for _, fragment := range []string{
		`"timeline"`,
		`"error_logs"`,
		`"fixed_interval":"2h"`,
		`"extended_bounds"`,
	} {
		if !strings.Contains(body, fragment) {
			t.Fatalf("expected request body to contain %q, got %s", fragment, body)
		}
	}
}

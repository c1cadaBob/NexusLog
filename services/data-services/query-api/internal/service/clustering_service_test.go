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

func TestStatsServiceClusterLogs_GroupsNormalizedTemplates(t *testing.T) {
	t.Helper()

	var captured map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("decode request body failed: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"took": 4,
			"timed_out": false,
			"hits": {
				"total": {"value": 5},
				"hits": [
					{
						"_id": "1",
						"_source": {
							"@timestamp": "2026-03-22T08:15:00Z",
							"message": "Error: Connection timed out to database 192.168.1.101 at port 5432",
							"log": {"level": "error"},
							"service": {"name": "order-api"},
							"host": {"name": "db-node-01"}
						}
					},
					{
						"_id": "2",
						"_source": {
							"@timestamp": "2026-03-22T08:13:00Z",
							"message": "Error: Connection timed out to database 192.168.1.102 at port 5432",
							"log": {"level": "error"},
							"service": {"name": "order-api"},
							"host": {"name": "db-node-02"}
						}
					},
					{
						"_id": "3",
						"_source": {
							"@timestamp": "2026-03-22T07:58:00Z",
							"message": "User admin_01 failed login attempt from 10.10.1.8",
							"log": {"level": "warn"},
							"service": {"name": "auth-api"},
							"host": {"name": "auth-node-01"}
						}
					},
					{
						"_id": "4",
						"_source": {
							"@timestamp": "2026-03-22T07:55:00Z",
							"message": "User guest_user failed login attempt from 10.10.1.9",
							"log": {"level": "warn"},
							"service": {"name": "auth-api"},
							"host": {"name": "auth-node-02"}
						}
					},
					{
						"_id": "5",
						"_source": {
							"@timestamp": "2026-03-22T07:30:00Z",
							"message": "INFO: Batch job job_001 completed in 1234 ms",
							"log": {"level": "info"},
							"service": {"name": "batch-worker"},
							"host": {"name": "worker-node-01"}
						}
					}
				]
			}
		}`))
	}))
	defer server.Close()

	t.Setenv("DATABASE_ELASTICSEARCH_ADDRESSES", server.URL)
	t.Setenv("QUERY_LOGS_INDEX", "nexuslog-logs-read")

	svc := NewStatsService(repository.NewElasticsearchRepositoryFromEnv(), nil)
	result, err := svc.ClusterLogs(context.Background(), RequestActor{TenantID: "11111111-1111-1111-1111-111111111111"}, ClusterRequest{
		TimeRange:  "24h",
		Limit:      10,
		SampleSize: 5,
	})
	if err != nil {
		t.Fatalf("ClusterLogs() error = %v", err)
	}
	if result.Summary.AnalyzedLogsTotal != 5 {
		t.Fatalf("AnalyzedLogsTotal = %d, want 5", result.Summary.AnalyzedLogsTotal)
	}
	if result.Summary.SampledLogs != 5 {
		t.Fatalf("SampledLogs = %d, want 5", result.Summary.SampledLogs)
	}
	if result.Summary.UniquePatterns != 3 {
		t.Fatalf("UniquePatterns = %d, want 3", result.Summary.UniquePatterns)
	}
	if len(result.Patterns) != 3 {
		t.Fatalf("patterns len = %d, want 3", len(result.Patterns))
	}

	var errorPattern *ClusterPattern
	var warnPattern *ClusterPattern
	for index := range result.Patterns {
		pattern := &result.Patterns[index]
		switch pattern.Template {
		case "Error: Connection timed out to database {IP_ADDRESS} at port {PORT}":
			errorPattern = pattern
		case "User {USER_ID} failed login attempt from {IP_ADDRESS}":
			warnPattern = pattern
		}
	}
	if errorPattern == nil {
		t.Fatalf("expected timeout cluster template in %+v", result.Patterns)
	}
	if errorPattern.Occurrences != 2 || errorPattern.Level != "error" {
		t.Fatalf("unexpected error cluster: %+v", *errorPattern)
	}
	if len(errorPattern.Trend) != 8 {
		t.Fatalf("error cluster trend len = %d, want 8", len(errorPattern.Trend))
	}
	if len(errorPattern.Samples) == 0 || errorPattern.Samples[0].Variables["IP_ADDRESS"] == "" || errorPattern.Samples[0].Variables["PORT"] == "" {
		t.Fatalf("expected extracted variables in error sample: %+v", errorPattern.Samples)
	}
	if warnPattern == nil {
		t.Fatalf("expected login cluster template in %+v", result.Patterns)
	}
	if warnPattern.Occurrences != 2 || warnPattern.Level != "warn" {
		t.Fatalf("unexpected warn cluster: %+v", *warnPattern)
	}

	raw, err := json.Marshal(captured)
	if err != nil {
		t.Fatalf("marshal captured request failed: %v", err)
	}
	body := string(raw)
	for _, fragment := range []string{
		`"track_total_hits":true`,
		`"size":5`,
		`"@timestamp"`,
		`"message"`,
	} {
		if !strings.Contains(body, fragment) {
			t.Fatalf("expected request body to contain %q, got %s", fragment, body)
		}
	}
}

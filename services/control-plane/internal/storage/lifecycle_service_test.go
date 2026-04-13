package storage

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestIndexServiceListLifecyclePolicies(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/_ilm/policy":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{
				"nexuslog-logs-ilm": {
					"modified_date": "2026-04-13T05:00:00Z",
					"policy": {
						"phases": {
							"hot": {"min_age": "0ms", "actions": {"rollover": {"max_age": "1d", "max_primary_shard_size": "50gb"}}},
							"warm": {"min_age": "7d", "actions": {"forcemerge": {"max_num_segments": 1}}},
							"delete": {"min_age": "30d", "actions": {"delete": {"delete_searchable_snapshot": true}}}
						},
						"_meta": {"managed": true, "description": "NexusLog logs retention"},
						"deprecated": false
					},
					"in_use_by": {
						"indices": [],
						"data_streams": ["nexuslog-logs-v2"],
						"composable_templates": ["nexuslog-logs-template"]
					}
				},
				"orphan-policy": {
					"modified_date": "2026-04-10T01:00:00Z",
					"policy": {
						"phases": {
							"hot": {"min_age": "0ms", "actions": {"rollover": {"max_age": "7d"}}}
						},
						"_meta": {"managed": false, "description": "Unused policy"},
						"deprecated": true
					},
					"in_use_by": {
						"indices": [],
						"data_streams": [],
						"composable_templates": []
					}
				}
			}`))
		case "/_all/_ilm/explain":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{
				"indices": {
					".ds-nexuslog-logs-v2-000001": {
						"index": ".ds-nexuslog-logs-v2-000001",
						"managed": true,
						"policy": "nexuslog-logs-ilm",
						"phase": "hot",
						"action": "complete",
						"step": "complete"
					},
					"nexuslog-logs-stream-canary": {
						"index": "nexuslog-logs-stream-canary",
						"managed": true,
						"policy": "nexuslog-logs-ilm",
						"phase": "hot",
						"action": "rollover",
						"step": "ERROR",
						"failed_step": "check-rollover-ready",
						"step_info": {
							"type": "illegal_argument_exception",
							"reason": "rollover alias is missing"
						}
					},
					".tasks": {
						"index": ".tasks",
						"managed": false
					}
				}
			}`))
		case "/_ilm/status":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"operation_mode":"RUNNING"}`))
		default:
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
	}))
	defer server.Close()

	svc := &IndexService{
		endpoint: server.URL,
		client:   server.Client(),
	}

	result, err := svc.ListLifecyclePolicies(context.Background())
	if err != nil {
		t.Fatalf("ListLifecyclePolicies returned error: %v", err)
	}
	if len(result.Items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(result.Items))
	}
	if result.Summary.Total != 2 || result.Summary.Error != 1 || result.Summary.Unused != 1 || result.Summary.Active != 0 {
		t.Fatalf("unexpected lifecycle summary: %+v", result.Summary)
	}
	if result.Summary.ManagedIndices != 2 {
		t.Fatalf("expected managed indices = 2, got %d", result.Summary.ManagedIndices)
	}
	if result.Summary.OperationMode != "RUNNING" {
		t.Fatalf("expected operation mode RUNNING, got %s", result.Summary.OperationMode)
	}

	first := result.Items[0]
	if first.Name != "nexuslog-logs-ilm" {
		t.Fatalf("expected first item nexuslog-logs-ilm, got %s", first.Name)
	}
	if first.Status != PolicyStatusError {
		t.Fatalf("expected first item status Error, got %s", first.Status)
	}
	if first.ExecutionStatus != ExecutionStatusFailed {
		t.Fatalf("expected failed execution status, got %s", first.ExecutionStatus)
	}
	if first.ManagedIndexCount != 2 {
		t.Fatalf("expected managed index count = 2, got %d", first.ManagedIndexCount)
	}
	if len(first.Phases) != 2 {
		t.Fatalf("expected 2 phase transitions, got %d", len(first.Phases))
	}
	if first.Phases[0].Condition != "7d" {
		t.Fatalf("expected first phase transition condition 7d, got %s", first.Phases[0].Condition)
	}
	if len(first.CurrentPhaseCounts) != 1 || first.CurrentPhaseCounts[0].Phase != LifecyclePhaseHot || first.CurrentPhaseCounts[0].Count != 2 {
		t.Fatalf("unexpected current phase counts: %+v", first.CurrentPhaseCounts)
	}
	if !strings.Contains(first.ExecutionMessage, "rollover alias is missing") {
		t.Fatalf("expected execution message to include error reason, got %s", first.ExecutionMessage)
	}

	second := result.Items[1]
	if second.Name != "orphan-policy" {
		t.Fatalf("expected second item orphan-policy, got %s", second.Name)
	}
	if second.Status != PolicyStatusUnused {
		t.Fatalf("expected second item status Unused, got %s", second.Status)
	}
	if second.ExecutionStatus != ExecutionStatusIdle {
		t.Fatalf("expected idle execution status, got %s", second.ExecutionStatus)
	}
	if !second.Deprecated {
		t.Fatal("expected orphan policy to be deprecated")
	}
	if result.RefreshedAt == "" {
		t.Fatal("expected refreshed_at to be set")
	}
}

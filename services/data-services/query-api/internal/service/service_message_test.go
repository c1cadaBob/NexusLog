package service

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nexuslog/data-services/query-api/internal/repository"
)

func TestNormalizeDisplayMessage_UnwrapsJSONAndCompactsWhitespace(t *testing.T) {
	input := `{"log":"\u0009at org.hibernate.service.internal.AbstractServiceRegistryImpl.createServiceRegistryImpl(AbstractServiceRegistryImpl.java:263)\n","stream":"stdout"}`

	got := normalizeDisplayMessage(input)
	want := "at org.hibernate.service.internal.AbstractServiceRegistryImpl.createServiceRegistryImpl(AbstractServiceRegistryImpl.java:263)"
	if got != want {
		t.Fatalf("normalizeDisplayMessage() = %q, want %q", got, want)
	}
	if strings.Contains(got, "\n") || strings.Contains(got, "\t") {
		t.Fatalf("normalizeDisplayMessage() should remove newline/tab, got %q", got)
	}
}

func TestNormalizeDisplayMessage_RemovesANSIColorCodes(t *testing.T) {
	input := "\x1b[31mERROR\x1b[0m message with \t control \n chars"

	got := normalizeDisplayMessage(input)
	want := "ERROR message with control chars"
	if got != want {
		t.Fatalf("normalizeDisplayMessage() = %q, want %q", got, want)
	}
}

func TestMapRawHit_UsesCleanMessageButKeepsRawLog(t *testing.T) {
	rawMessage := `{"log":"\u0009hello\nworld","stream":"stdout"}`
	hit := mapRawHit(repository.RawLogHit{
		ID:    "id-1",
		Index: "nexuslog-logs-v2",
		Source: map[string]any{
			"message": rawMessage,
			"level":   "info",
		},
	})

	if hit.Message != "hello world" {
		t.Fatalf("hit.Message = %q, want %q", hit.Message, "hello world")
	}
	if hit.RawLog != rawMessage {
		t.Fatalf("hit.RawLog = %q, want original %q", hit.RawLog, rawMessage)
	}
}

func TestMapRawHit_NormalizesSourcePathForDisplay(t *testing.T) {
	internalSource := "/host-docker-containers/abc/abc-json.log"
	hit := mapRawHit(repository.RawLogHit{
		ID:    "id-2",
		Index: "nexuslog-logs-v2",
		Source: map[string]any{
			"message": "plain message",
			"source":  internalSource,
		},
	})

	display := "/var/lib/docker/containers/abc/abc-json.log"
	if got := hit.Fields["source"]; got != display {
		t.Fatalf("fields[source]=%v, want %s", got, display)
	}
	if got := hit.Fields["source_path"]; got != display {
		t.Fatalf("fields[source_path]=%v, want %s", got, display)
	}
	if got := hit.Fields["source_internal"]; got != internalSource {
		t.Fatalf("fields[source_internal]=%v, want %s", got, internalSource)
	}
}

func TestMapRawHit_MapsStructuredV2DocumentToCompatibilityFields(t *testing.T) {
	hit := mapRawHit(repository.RawLogHit{
		ID:    "es-doc-1",
		Index: "nexuslog-logs-v2",
		Source: map[string]any{
			"@timestamp": "2026-03-07T10:00:00Z",
			"message":    "npm start:dev failed with code 127",
			"event": map[string]any{
				"id":        "event-1",
				"record_id": "rec-1",
				"sequence":  float64(42),
				"original":  "full original log",
			},
			"log": map[string]any{
				"level": "error",
				"file": map[string]any{
					"path": "/host-var-log/app.log",
				},
			},
			"service": map[string]any{
				"name": "bff-service",
				"instance": map[string]any{
					"id": "bff-service-1",
				},
				"environment": "dev",
			},
			"container": map[string]any{
				"name": "bff-service-1",
			},
			"host": map[string]any{
				"name": "node-a",
				"ip":   "10.0.0.8",
			},
			"source": map[string]any{
				"path": "/host-docker-containers/abc/abc-json.log",
			},
			"agent": map[string]any{
				"id": "agent-1",
			},
			"span": map[string]any{
				"id": "span-1",
			},
			"trace": map[string]any{
				"id": "trace-1",
			},
			"http": map[string]any{
				"request":  map[string]any{"method": "POST"},
				"response": map[string]any{"status_code": float64(500)},
			},
			"error": map[string]any{
				"message":     "npm lifecycle failed",
				"stack_trace": "stack trace body",
				"type":        "npm.lifecycle_error",
			},
			"nexuslog": map[string]any{
				"transport": map[string]any{"batch_id": "batch-1"},
				"ingest": map[string]any{
					"received_at":      "2026-03-07T10:00:02Z",
					"schema_version":   "2.0",
					"pipeline_version": "2.0",
				},
				"governance": map[string]any{
					"tenant_id":        "tenant-a",
					"retention_policy": "hot-30d",
					"pii_masked":       false,
				},
			},
			"labels": map[string]any{
				"env": "dev",
			},
		},
	})

	if hit.ID != "event-1" {
		t.Fatalf("hit.ID=%q, want event-1", hit.ID)
	}
	if hit.Level != "error" {
		t.Fatalf("hit.Level=%q, want error", hit.Level)
	}
	if hit.Service != "bff-service" {
		t.Fatalf("hit.Service=%q, want bff-service", hit.Service)
	}
	if hit.RawLog != "full original log" {
		t.Fatalf("hit.RawLog=%q, want full original log", hit.RawLog)
	}
	if got := hit.Fields["event_id"]; got != "event-1" {
		t.Fatalf("fields[event_id]=%v, want event-1", got)
	}
	if got := hit.Fields["batch_id"]; got != "batch-1" {
		t.Fatalf("fields[batch_id]=%v, want batch-1", got)
	}
	if got := hit.Fields["schema_version"]; got != "2.0" {
		t.Fatalf("fields[schema_version]=%v, want 2.0", got)
	}
	if got := hit.Fields["traceId"]; got != "trace-1" {
		t.Fatalf("fields[traceId]=%v, want trace-1", got)
	}
	if got := hit.Fields["host"]; got != "node-a" {
		t.Fatalf("fields[host]=%v, want node-a", got)
	}
	if got := hit.Fields["host_ip"]; got != "10.0.0.8" {
		t.Fatalf("fields[host_ip]=%v, want 10.0.0.8", got)
	}
	if got := hit.Fields["spanId"]; got != "span-1" {
		t.Fatalf("fields[spanId]=%v, want span-1", got)
	}
	if got := hit.Fields["source"]; got != "/var/lib/docker/containers/abc/abc-json.log" {
		t.Fatalf("fields[source]=%v, want normalized docker path", got)
	}
	if got := hit.Fields["source_internal"]; got != "/host-docker-containers/abc/abc-json.log" {
		t.Fatalf("fields[source_internal]=%v, want original mounted path", got)
	}
}

func TestMapRawHit_ResolvesHostFromSyslogMessageFallback(t *testing.T) {
	hit := mapRawHit(repository.RawLogHit{
		ID:    "id-host-fallback",
		Index: "nexuslog-logs-v2",
		Source: map[string]any{
			"message": "Dec 21 12:01:58 localhost.localdomain chronyd[2304]: Selected source 139.199.215.251",
			"log":     map[string]any{"level": "info"},
		},
	})

	if got := hit.Fields["host"]; got != "localhost.localdomain" {
		t.Fatalf("fields[host]=%v, want localhost.localdomain", got)
	}
}

func TestResolveDisplayHost_FallsBackToAgentHostname(t *testing.T) {
	source := map[string]any{
		"agent": map[string]any{
			"hostname": "agent-hostname-a",
		},
	}
	if got := resolveDisplayHost(source, "plain application log without hostname"); got != "agent-hostname-a" {
		t.Fatalf("resolveDisplayHost()=%q, want agent-hostname-a", got)
	}
}

func TestResolveDisplayHostIP_PrefersStructuredValueAndArrayFallback(t *testing.T) {
	source := map[string]any{
		"host": map[string]any{
			"ip": []any{"10.10.0.9", "fe80::1"},
		},
	}
	if got := resolveDisplayHostIP(source); got != "10.10.0.9" {
		t.Fatalf("resolveDisplayHostIP()=%q, want 10.10.0.9", got)
	}
}

func TestResolveDisplayHostIP_FallsBackToAgentIP(t *testing.T) {
	source := map[string]any{
		"agent": map[string]any{
			"ip": "10.10.0.11",
		},
	}
	if got := resolveDisplayHostIP(source); got != "10.10.0.11" {
		t.Fatalf("resolveDisplayHostIP()=%q, want 10.10.0.11", got)
	}
}

func TestMapRawHit_FallsBackToSourceFileWhenServiceLooksLikeMonth(t *testing.T) {
	hit := mapRawHit(repository.RawLogHit{
		ID:    "id-service-fallback",
		Index: "nexuslog-logs-v2",
		Source: map[string]any{
			"message": "Dec 21 12:01:58 localhost.localdomain chronyd[2304]: Selected source 139.199.215.251",
			"service": map[string]any{
				"name": "Dec",
			},
			"log": map[string]any{
				"file": map[string]any{
					"path": "/var/log/anaconda/journal.log",
				},
			},
		},
	})

	if got := hit.Service; got != "journal.log" {
		t.Fatalf("hit.Service=%q, want journal.log", got)
	}
	if got := hit.Fields["service_name"]; got != "journal.log" {
		t.Fatalf("fields[service_name]=%v, want journal.log", got)
	}
}

func TestMapRawHit_FallsBackToSourceFileWhenServiceLooksLikeJSONEnvelope(t *testing.T) {
	hit := mapRawHit(repository.RawLogHit{
		ID:    "id-service-json-fallback",
		Index: "nexuslog-logs-v2",
		Source: map[string]any{
			"service": map[string]any{
				"name": `{"log":"[GIN] 2026/03/09 - 06:07:31` + "...",
			},
			"log": map[string]any{
				"file": map[string]any{
					"path": "/var/log/messages",
				},
			},
		},
	})

	if got := hit.Service; got != "messages" {
		t.Fatalf("hit.Service=%q, want messages", got)
	}
}

func TestResolveDisplayService_FallsBackToDockerComposeMetadata(t *testing.T) {
	containerID := strings.Repeat("a", 64)
	rootDir := t.TempDir()
	containerDir := filepath.Join(rootDir, containerID)
	if err := os.MkdirAll(containerDir, 0o755); err != nil {
		t.Fatalf("mkdir container dir failed: %v", err)
	}
	configPath := filepath.Join(containerDir, "config.v2.json")
	config := `{"ID":"` + containerID + `","Name":"/nexuslog-query-api-1","Config":{"Labels":{"com.docker.compose.service":"query-api"}}}`
	if err := os.WriteFile(configPath, []byte(config), 0o644); err != nil {
		t.Fatalf("write config failed: %v", err)
	}

	t.Setenv("QUERY_DOCKER_CONTAINERS_ROOT", rootDir)
	source := map[string]any{
		"service": map[string]any{
			"name": containerID + "-json.log",
		},
		"log": map[string]any{
			"file": map[string]any{
				"path": filepath.Join("/var/lib/docker/containers", containerID, containerID+"-json.log"),
			},
		},
	}

	if got := resolveDisplayService(source); got != "query-api" {
		t.Fatalf("resolveDisplayService()=%q, want query-api", got)
	}
}

func TestResolveDisplayServiceWithHint_FixesHistoricalDockerFilename(t *testing.T) {
	containerID := strings.Repeat("b", 64)
	source := map[string]any{
		"service": map[string]any{
			"name": containerID + "-json.log",
		},
		"log": map[string]any{
			"file": map[string]any{
				"path": filepath.Join("/var/lib/docker/containers", containerID, containerID+"-json.log"),
			},
		},
	}

	if got := resolveDisplayServiceWithHint(source, "query-api"); got != "query-api" {
		t.Fatalf("resolveDisplayServiceWithHint()=%q, want query-api", got)
	}
}

func TestBuildQueryText_SkipsTrulyEmptySearch(t *testing.T) {
	if got := buildQueryText(SearchLogsRequest{}); got != "" {
		t.Fatalf("buildQueryText(empty)=%q, want empty string", got)
	}
}

func TestBuildQueryText_IncludesStructuredCriteria(t *testing.T) {
	got := buildQueryText(SearchLogsRequest{
		Keywords: "level:error",
		Filters: map[string]any{
			"service": "query-api",
		},
		TimeRange: TimeRange{From: "2026-03-11T12:00:00Z", To: "2026-03-11T13:00:00Z"},
	})

	for _, fragment := range []string{"level:error", "filters:{\"service\":\"query-api\"}", "time:[2026-03-11T12:00:00Z,2026-03-11T13:00:00Z]"} {
		if !strings.Contains(got, fragment) {
			t.Fatalf("buildQueryText()=%q, want fragment %q", got, fragment)
		}
	}
}

func TestBuildQueryText_SkipsRealtimeAutoUpperBoundOnly(t *testing.T) {
	got := buildQueryText(SearchLogsRequest{
		Keywords:  "level:error AND service:payment",
		TimeRange: TimeRange{To: "2026-03-11T13:36:35.647Z"},
	})

	if strings.Contains(got, "time:[") {
		t.Fatalf("buildQueryText()=%q, want no auto upper-bound time range", got)
	}
	if got != "level:error AND service:payment" {
		t.Fatalf("buildQueryText()=%q, want only keywords", got)
	}
}

func TestSearchLogs_RejectsCursorWithoutPITID(t *testing.T) {
	svc := NewQueryService(nil, nil)
	_, err := svc.SearchLogs(context.Background(), RequestActor{}, SearchLogsRequest{
		Page:        501,
		PageSize:    20,
		SearchAfter: []any{"2026-03-13T08:00:00Z", 99},
	})
	if err == nil || !strings.Contains(err.Error(), "not configured") {
		t.Fatalf("SearchLogs() with nil repo should still fail configuration first, got %v", err)
	}

	repo := repository.NewElasticsearchRepositoryFromEnv()
	svc = NewQueryService(repo, nil)
	_, err = svc.SearchLogs(context.Background(), RequestActor{}, SearchLogsRequest{
		Page:        501,
		PageSize:    20,
		SearchAfter: []any{"2026-03-13T08:00:00Z", 99},
	})
	if err == nil || !errors.Is(err, ErrInvalidSearchCursor) {
		t.Fatalf("SearchLogs() error = %v, want ErrInvalidSearchCursor", err)
	}
}

func TestSearchLogs_AllowsDeepPageWhenCursorProvided(t *testing.T) {
	var captured map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		if r.URL.Path != "/_search" {
			http.NotFound(w, r)
			return
		}
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("decode request body failed: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"took": 4,
			"timed_out": false,
			"pit_id": "pit-deep-page",
			"hits": {
				"total": {"value": 20001},
				"hits": [
					{
						"_id": "log-deep",
						"_index": "nexuslog-logs-read",
						"sort": ["2026-03-13T08:00:00Z", 1001],
						"_source": {
							"@timestamp": "2026-03-13T08:00:00Z",
							"message": "deep page log"
						}
					}
				]
			}
		}`))
	}))
	defer server.Close()

	t.Setenv("DATABASE_ELASTICSEARCH_ADDRESSES", server.URL)
	t.Setenv("QUERY_LOGS_INDEX", "nexuslog-logs-read")
	repo := repository.NewElasticsearchRepositoryFromEnv()
	svc := NewQueryService(repo, nil)
	result, err := svc.SearchLogs(context.Background(), RequestActor{}, SearchLogsRequest{
		Page:        501,
		PageSize:    20,
		PITID:       "pit-deep-page",
		SearchAfter: []any{"2026-03-13T07:59:00Z", 1000},
		Sort:        []SortField{{Field: "@timestamp", Order: "desc"}},
	})
	if err != nil {
		t.Fatalf("SearchLogs() error = %v", err)
	}
	if result.Page != 501 {
		t.Fatalf("result.Page=%d, want 501", result.Page)
	}
	if result.PITID != "pit-deep-page" {
		t.Fatalf("result.PITID=%q, want pit-deep-page", result.PITID)
	}
	if len(result.Hits) != 1 || result.Hits[0].Message != "deep page log" {
		t.Fatalf("unexpected deep-page hits: %+v", result.Hits)
	}
	if _, exists := captured["from"]; exists {
		t.Fatalf("from should be omitted for deep-page cursor search: %#v", captured)
	}
	if _, ok := captured["search_after"].([]any); !ok {
		t.Fatalf("search_after missing: %#v", captured)
	}
}

func TestExceedsMaxSearchResultWindow(t *testing.T) {
	if exceedsMaxSearchResultWindow(500, 20) {
		t.Fatalf("page 500 with size 20 should still be allowed")
	}
	if !exceedsMaxSearchResultWindow(501, 20) {
		t.Fatalf("page 501 with size 20 should exceed the max result window")
	}
	if maxSupportedPage(10) != 1000 {
		t.Fatalf("maxSupportedPage(10)=%d, want 1000", maxSupportedPage(10))
	}
}

func TestBuildSourcePathServiceHints_UsesNewestValidService(t *testing.T) {
	containerID := strings.Repeat("c", 64)
	sourcePath := filepath.Join("/var/lib/docker/containers", containerID, containerID+"-json.log")
	hints := buildSourcePathServiceHints([]repository.RawLogHit{
		{
			ID:    "new-hit",
			Index: "nexuslog-logs-v2",
			Source: map[string]any{
				"service": map[string]any{
					"name": "query-api",
				},
				"source": map[string]any{
					"path": sourcePath,
				},
			},
		},
		{
			ID:    "old-hit",
			Index: "nexuslog-logs-v2",
			Source: map[string]any{
				"service": map[string]any{
					"name": containerID + "-json.log",
				},
				"source": map[string]any{
					"path": sourcePath,
				},
			},
		},
	})

	if got := hints[sourcePath]; got != "query-api" {
		t.Fatalf("hints[%q]=%q, want query-api", sourcePath, got)
	}
}

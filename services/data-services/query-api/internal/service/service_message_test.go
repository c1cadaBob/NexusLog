package service

import (
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

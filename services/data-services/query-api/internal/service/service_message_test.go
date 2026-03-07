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

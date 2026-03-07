package repository

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestBuildESQuery_UsesStructuredV2FieldsAndFilterAliases(t *testing.T) {
	query := buildESQuery(SearchLogsInput{
		Keywords: "dnf.exceptions.RepoError",
		Filters: map[string]any{
			"level":      "error",
			"service":    "keycloak",
			"agent_id":   "agent-1",
			"batch_id":   "batch-1",
			"statusCode": 500,
			"traceId":    "trace-1",
			"spanId":     "span-1",
		},
	})

	raw, err := json.Marshal(query)
	if err != nil {
		t.Fatalf("marshal query failed: %v", err)
	}
	encoded := string(raw)

	assertContainsAll(t, encoded, []string{
		`"message^3"`,
		`"event.original"`,
		`"error.message^2"`,
		`"error.stack_trace"`,
		`"service.name^2"`,
		`"service.instance.id"`,
		`"container.name"`,
		`"log.file.path"`,
		`"source.path"`,
		`"agent.id"`,
		`"event.record_id"`,
		`"nexuslog.transport.batch_id"`,
		`"trace.id"`,
		`"span.id"`,
		`"request.id"`,
	})

	assertContainsAll(t, encoded, []string{
		`"log.level":"error"`,
		`"service.name":"keycloak"`,
		`"agent.id":"agent-1"`,
		`"nexuslog.transport.batch_id":"batch-1"`,
		`"http.response.status_code":500`,
		`"trace.id":"trace-1"`,
		`"span.id":"span-1"`,
	})
}

func TestNormalizeFilterField_MapsFrontendAliasesToV2Fields(t *testing.T) {
	tests := map[string]string{
		"level":      "log.level",
		"service":    "service.name",
		"source":     "source.path",
		"agent_id":   "agent.id",
		"batch_id":   "nexuslog.transport.batch_id",
		"traceId":    "trace.id",
		"spanId":     "span.id",
		"statusCode": "http.response.status_code",
	}

	for input, want := range tests {
		if got := normalizeFilterField(input); got != want {
			t.Fatalf("normalizeFilterField(%q)=%q, want %q", input, got, want)
		}
	}
}

func assertContainsAll(t *testing.T, raw string, fragments []string) {
	t.Helper()
	for _, fragment := range fragments {
		if !strings.Contains(raw, fragment) {
			t.Fatalf("expected query to contain %s, got %s", fragment, raw)
		}
	}
}

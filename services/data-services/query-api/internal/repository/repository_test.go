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
		`"value":"*/keycloak"`,
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

func TestBuildESSort_AppendsStableTieBreakers(t *testing.T) {
	sorts := buildESSort([]SortField{{Field: "@timestamp", Order: "desc"}})
	wantFields := []string{"@timestamp", "nexuslog.ingest.received_at", "event.sequence", "log.offset", "source.path", "event.id"}
	if len(sorts) != len(wantFields) {
		t.Fatalf("buildESSort returned %d clauses, want %d", len(sorts), len(wantFields))
	}

	for index, field := range wantFields {
		options := sortOptions(t, sorts[index], field)
		wantOrder := "desc"
		if field == "source.path" {
			wantOrder = "asc"
		}
		if got := options["order"]; got != wantOrder {
			t.Fatalf("sort[%d] order=%v, want %s", index, got, wantOrder)
		}
		if got := options["missing"]; got != "_last" {
			t.Fatalf("sort[%d] missing=%v, want _last", index, got)
		}
	}

	if got := sortOptions(t, sorts[0], "@timestamp")["unmapped_type"]; got != "date" {
		t.Fatalf("@timestamp unmapped_type=%v, want date", got)
	}
	if got := sortOptions(t, sorts[1], "nexuslog.ingest.received_at")["unmapped_type"]; got != "date" {
		t.Fatalf("nexuslog.ingest.received_at unmapped_type=%v, want date", got)
	}
	if got := sortOptions(t, sorts[2], "event.sequence")["unmapped_type"]; got != "long" {
		t.Fatalf("event.sequence unmapped_type=%v, want long", got)
	}
	if got := sortOptions(t, sorts[3], "log.offset")["unmapped_type"]; got != "long" {
		t.Fatalf("log.offset unmapped_type=%v, want long", got)
	}
	if got := sortOptions(t, sorts[4], "source.path")["unmapped_type"]; got != "keyword" {
		t.Fatalf("source.path unmapped_type=%v, want keyword", got)
	}
	if got := sortOptions(t, sorts[5], "event.id")["unmapped_type"]; got != "keyword" {
		t.Fatalf("event.id unmapped_type=%v, want keyword", got)
	}
}

func TestBuildESSort_DeduplicatesRequestedTieBreakers(t *testing.T) {
	sorts := buildESSort([]SortField{
		{Field: "@timestamp", Order: "desc"},
		{Field: "event.id", Order: "asc"},
	})
	wantFields := []string{"@timestamp", "event.id", "nexuslog.ingest.received_at", "event.sequence", "log.offset", "source.path"}
	if len(sorts) != len(wantFields) {
		t.Fatalf("buildESSort returned %d clauses, want %d", len(sorts), len(wantFields))
	}
	for index, field := range wantFields {
		if _, ok := sorts[index][field]; !ok {
			t.Fatalf("sort[%d] missing field %s: %#v", index, field, sorts[index])
		}
	}
	if got := sortOptions(t, sorts[1], "event.id")["order"]; got != "asc" {
		t.Fatalf("event.id order=%v, want asc", got)
	}
}

func sortOptions(t *testing.T, clause map[string]any, field string) map[string]any {
	t.Helper()
	raw, ok := clause[field]
	if !ok {
		t.Fatalf("sort clause missing %s: %#v", field, clause)
	}
	options, ok := raw.(map[string]any)
	if !ok {
		t.Fatalf("sort clause for %s has unexpected type %T", field, raw)
	}
	return options
}

func assertContainsAll(t *testing.T, raw string, fragments []string) {
	t.Helper()
	for _, fragment := range fragments {
		if !strings.Contains(raw, fragment) {
			t.Fatalf("expected query to contain %s, got %s", fragment, raw)
		}
	}
}

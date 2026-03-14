package repository

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestBuildExportESQuery_TreatsKeywordsAsLiteralTextAndDropsUnknownFilters(t *testing.T) {
	query := buildExportESQuery(ExportQueryParams{
		Keywords: `error OR *`,
		Filters: map[string]any{
			"unknown.field": "boom",
			"service":       "query-api",
		},
	})

	raw, err := json.Marshal(query)
	if err != nil {
		t.Fatalf("marshal query failed: %v", err)
	}
	encoded := string(raw)
	if !strings.Contains(encoded, `"multi_match"`) {
		t.Fatalf("expected multi_match query, got %s", encoded)
	}
	if strings.Contains(encoded, `"simple_query_string"`) {
		t.Fatalf("unexpected simple_query_string in %s", encoded)
	}
	if strings.Contains(encoded, `unknown.field`) {
		t.Fatalf("unexpected unknown filter field in %s", encoded)
	}
	if !strings.Contains(encoded, `"service":"query-api"`) {
		t.Fatalf("expected service filter in %s", encoded)
	}
}

func TestBuildExportESSort_DropsUnknownFields(t *testing.T) {
	sorts := buildExportESSort([]struct {
		Field string `json:"field"`
		Order string `json:"order"`
	}{
		{Field: `script[0]`, Order: "asc"},
	})

	if len(sorts) != 1 {
		t.Fatalf("buildExportESSort returned %d clauses, want 1", len(sorts))
	}
	if _, ok := sorts[0]["@timestamp"]; !ok {
		t.Fatalf("expected default @timestamp sort, got %#v", sorts[0])
	}
}

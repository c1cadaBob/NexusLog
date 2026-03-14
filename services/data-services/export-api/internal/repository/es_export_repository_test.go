package repository

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestBuildExportESQuery_TreatsKeywordsAsLiteralTextAndDropsUnknownFilters(t *testing.T) {
	query := buildExportESQuery(ExportQueryParams{
		TenantID: "tenant-a",
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

func TestBuildExportESQuery_UsesMatchNoneWhenTenantMissing(t *testing.T) {
	query := buildExportESQuery(ExportQueryParams{Keywords: "error"})

	raw, err := json.Marshal(query)
	if err != nil {
		t.Fatalf("marshal query failed: %v", err)
	}
	encoded := string(raw)
	if !strings.Contains(encoded, `"match_none"`) {
		t.Fatalf("expected match_none query, got %s", encoded)
	}
	if strings.Contains(encoded, `"tenant_id"`) {
		t.Fatalf("unexpected tenant filter in %s", encoded)
	}
}

func TestScrollSearch_RejectsMissingTenantScope(t *testing.T) {
	called := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		http.NotFound(w, r)
	}))
	defer server.Close()

	repo := &ESExportRepository{
		address: server.URL,
		index:   "nexuslog-logs-v2",
		client:  server.Client(),
	}
	err := repo.ScrollSearch(context.Background(), ExportQueryParams{}, 10, func([]LogHit) error { return nil })
	if !errors.Is(err, ErrTenantScopeRequired) {
		t.Fatalf("ScrollSearch() error = %v, want ErrTenantScopeRequired", err)
	}
	if called {
		t.Fatal("expected repository to reject before issuing network request")
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

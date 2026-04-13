package storage

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestIndexServiceListIndices(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/_cat/indices" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[
			{"health":"green","status":"open","index":"nexuslog-logs-000001","pri":"1","rep":"1","docs.count":"1200","store.size":"2048"},
			{"health":"yellow","status":"close","index":"nexuslog-audit-000001","pri":"2","rep":"1","docs.count":"300","store.size":"1024"},
			{"health":"red","status":"open","index":"nexuslog-metrics-000001","pri":"1","rep":"0","docs.count":"50","store.size":"512"}
		]`))
	}))
	defer server.Close()

	svc := &IndexService{
		endpoint: server.URL,
		client:   server.Client(),
	}

	result, err := svc.ListIndices(context.Background())
	if err != nil {
		t.Fatalf("ListIndices returned error: %v", err)
	}
	if len(result.Items) != 3 {
		t.Fatalf("expected 3 items, got %d", len(result.Items))
	}
	if result.Items[0].Health != IndexHealthGreen {
		t.Fatalf("expected first item health Green, got %s", result.Items[0].Health)
	}
	if result.Items[1].Status != IndexStatusClosed {
		t.Fatalf("expected second item status Closed, got %s", result.Items[1].Status)
	}
	if result.Summary.Total != 3 || result.Summary.Green != 1 || result.Summary.Yellow != 1 || result.Summary.Red != 1 {
		t.Fatalf("unexpected summary counts: %+v", result.Summary)
	}
	if result.Summary.DocsCount != 1550 {
		t.Fatalf("expected docs_count 1550, got %d", result.Summary.DocsCount)
	}
	if result.Summary.StoreSizeBytes != 3584 {
		t.Fatalf("expected store_size_bytes 3584, got %d", result.Summary.StoreSizeBytes)
	}
	if result.RefreshedAt == "" {
		t.Fatal("expected refreshed_at to be set")
	}
}

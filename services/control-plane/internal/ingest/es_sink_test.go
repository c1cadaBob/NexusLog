package ingest

import (
	"strings"
	"testing"
	"time"
)

func TestNormalizeSourcePathForDisplay(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "docker mounted path",
			in:   "/host-docker-containers/abc/abc-json.log",
			want: "/var/lib/docker/containers/abc/abc-json.log",
		},
		{
			name: "var log mounted path",
			in:   "/host-var-log/messages",
			want: "/var/log/messages",
		},
		{
			name: "unknown path unchanged",
			in:   "/data/custom/app.log",
			want: "/data/custom/app.log",
		},
		{
			name: "empty path",
			in:   "   ",
			want: "unknown",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := normalizeSourcePathForDisplay(tc.in)
			if got != tc.want {
				t.Fatalf("normalizeSourcePathForDisplay(%q)=%q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestESSinkApplySemanticDedup(t *testing.T) {
	sink := NewESSink("http://localhost:9200", "nexuslog-logs-v2", "", "", 5*time.Second)
	first := LogDocument{
		Timestamp: time.Date(2026, 3, 7, 10, 0, 0, 0, time.UTC).Format(time.RFC3339Nano),
		Event:     EventLayer{ID: "event-1"},
		NexusLog:  NexusLogLayer{Dedup: DedupLayer{Fingerprint: "sha256:test", Count: 1}},
	}
	second := LogDocument{
		Timestamp: time.Date(2026, 3, 7, 10, 0, 5, 0, time.UTC).Format(time.RFC3339Nano),
		Event:     EventLayer{ID: "event-2"},
		NexusLog:  NexusLogLayer{Dedup: DedupLayer{Fingerprint: "sha256:test", Count: 1}},
	}

	first = sink.applySemanticDedup(first)
	second = sink.applySemanticDedup(second)

	if second.Event.ID != first.Event.ID {
		t.Fatalf("expected semantic dedup to reuse first event id, got first=%s second=%s", first.Event.ID, second.Event.ID)
	}
	if !second.NexusLog.Dedup.Hit {
		t.Fatalf("expected semantic dedup hit, got %+v", second.NexusLog.Dedup)
	}
	if second.NexusLog.Dedup.Count != 2 || second.NexusLog.Dedup.SuppressedCount != 1 {
		t.Fatalf("unexpected dedup aggregation: %+v", second.NexusLog.Dedup)
	}
}

func TestFirstBulkFailureDetail_ExtractsMappingConflict(t *testing.T) {
	resp := esBulkResponse{
		Errors: true,
		Items: []esBulkItemRaw{
			{
				"index": esBulkItem{
					Status: 400,
					Index:  "nexuslog-logs-v2",
					ID:     "event-1",
					Error: &esBulkItemError{
						Type:   "mapper_parsing_exception",
						Reason: "object mapping for [service] tried to parse field [service] as object, but found a concrete value",
					},
				},
			},
		},
	}

	detail := firstBulkFailureDetail(resp)
	if detail == nil {
		t.Fatal("expected first bulk failure detail")
	}
	if detail.Index != "nexuslog-logs-v2" {
		t.Fatalf("detail.Index=%q, want nexuslog-logs-v2", detail.Index)
	}
	if detail.DocumentID != "event-1" {
		t.Fatalf("detail.DocumentID=%q, want event-1", detail.DocumentID)
	}
	if detail.ErrorType != "mapper_parsing_exception" {
		t.Fatalf("detail.ErrorType=%q, want mapper_parsing_exception", detail.ErrorType)
	}
	if detail.Field != "service" {
		t.Fatalf("detail.Field=%q, want service", detail.Field)
	}

	writeErr := (&ESBulkWriteError{Indexed: 0, Failed: 1, FirstFailure: detail}).Error()
	if writeErr == "" || !containsAll(writeErr, []string{"indexed=0", "failed=1", "mapper_parsing_exception", "service"}) {
		t.Fatalf("unexpected error message: %s", writeErr)
	}
}

func TestIsIgnorableBulkConflict_VersionConflictIsTreatedAsIdempotentSuccess(t *testing.T) {
	if !isIgnorableBulkConflict(esBulkItem{
		Status: 409,
		Error:  &esBulkItemError{Type: "version_conflict_engine_exception"},
	}) {
		t.Fatal("expected version conflict to be ignorable")
	}
	if isIgnorableBulkConflict(esBulkItem{
		Status: 400,
		Error:  &esBulkItemError{Type: "mapper_parsing_exception"},
	}) {
		t.Fatal("expected mapper parsing exception to remain non-ignorable")
	}
}

func containsAll(raw string, fragments []string) bool {
	for _, fragment := range fragments {
		if !strings.Contains(raw, fragment) {
			return false
		}
	}
	return true
}

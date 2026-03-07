package ingest

import (
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

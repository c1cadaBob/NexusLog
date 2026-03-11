package retry

import (
	"testing"
	"time"

	"github.com/nexuslog/collector-agent/plugins"
)

func TestDiskCacheStoresAndLoadsFullRecords(t *testing.T) {
	t.Parallel()

	cache, err := NewDiskCache(t.TempDir())
	if err != nil {
		t.Fatalf("NewDiskCache: %v", err)
	}

	createdAt := time.Date(2026, time.March, 8, 10, 0, 0, 0, time.UTC)
	batch := CachedBatch{
		ID: "batch-records",
		Records: []plugins.Record{
			{
				Source:    "/var/log/app.log",
				Timestamp: createdAt.UnixNano(),
				Data:      []byte("hello"),
				Metadata: map[string]string{
					"event_id": "evt-001",
					"offset":   "42",
				},
			},
		},
		CreatedAt: createdAt,
	}
	if err := cache.Store(batch); err != nil {
		t.Fatalf("Store: %v", err)
	}

	loaded, err := cache.LoadAll()
	if err != nil {
		t.Fatalf("LoadAll: %v", err)
	}
	if len(loaded) != 1 {
		t.Fatalf("len(loaded) = %d, want 1", len(loaded))
	}
	if len(loaded[0].Records) != 1 {
		t.Fatalf("len(records) = %d, want 1", len(loaded[0].Records))
	}
	if got := loaded[0].Records[0].Metadata["event_id"]; got != "evt-001" {
		t.Fatalf("event_id = %q, want evt-001", got)
	}
	if got := loaded[0].Records[0].Metadata["offset"]; got != "42" {
		t.Fatalf("offset = %q, want 42", got)
	}
}

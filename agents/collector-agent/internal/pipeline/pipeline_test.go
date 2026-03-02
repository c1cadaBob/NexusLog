package pipeline

import (
	"context"
	"testing"

	"github.com/nexuslog/collector-agent/internal/checkpoint"
	"github.com/nexuslog/collector-agent/internal/retry"
	"github.com/nexuslog/collector-agent/plugins"
)

type mockProducer struct{}

func (mockProducer) Send(context.Context, string, []plugins.Record) error { return nil }
func (mockProducer) Close() error                                         { return nil }

type mockCheckpointStore struct {
	saved map[string]int64
}

func newMockCheckpointStore() *mockCheckpointStore {
	return &mockCheckpointStore{saved: make(map[string]int64)}
}

func (m *mockCheckpointStore) Save(source string, offset int64) error {
	m.saved[source] = offset
	return nil
}

func (m *mockCheckpointStore) Load(source string) (checkpoint.Position, error) {
	return checkpoint.Position{Source: source, Offset: m.saved[source]}, nil
}

func (m *mockCheckpointStore) LoadAll() (map[string]checkpoint.Position, error) {
	result := make(map[string]checkpoint.Position, len(m.saved))
	for source, offset := range m.saved {
		result[source] = checkpoint.Position{Source: source, Offset: offset}
	}
	return result, nil
}

func (m *mockCheckpointStore) Close() error { return nil }

// TestResolveCheckpointOffset 验证优先使用记录中的绝对 offset。
func TestResolveCheckpointOffset(t *testing.T) {
	withMetadata := plugins.Record{
		Data:     []byte("abc"),
		Metadata: map[string]string{"offset": "128"},
	}
	if got := resolveCheckpointOffset(withMetadata); got != 128 {
		t.Fatalf("expected 128, got %d", got)
	}

	invalidMetadata := plugins.Record{
		Data:     []byte("abcdef"),
		Metadata: map[string]string{"offset": "bad-value"},
	}
	if got := resolveCheckpointOffset(invalidMetadata); got != int64(len(invalidMetadata.Data)) {
		t.Fatalf("expected fallback=%d, got %d", len(invalidMetadata.Data), got)
	}
}

// TestProcessBatchSavesLatestOffsetPerSource 验证按 source 回写最大 offset。
func TestProcessBatchSavesLatestOffsetPerSource(t *testing.T) {
	store := newMockCheckpointStore()
	p, err := New(Config{
		Workers:     1,
		Topic:       "test-topic",
		CacheDir:    t.TempDir(),
		RetryConfig: retry.DefaultConfig(),
	}, plugins.NewRegistry(), mockProducer{}, store)
	if err != nil {
		t.Fatalf("new pipeline failed: %v", err)
	}

	batch := []plugins.Record{
		{Source: "/var/log/a.log", Data: []byte("x"), Metadata: map[string]string{"offset": "10"}},
		{Source: "/var/log/a.log", Data: []byte("y"), Metadata: map[string]string{"offset": "25"}},
		{Source: "/var/log/b.log", Data: []byte("hello")},
	}

	if err := p.processBatch(context.Background(), batch); err != nil {
		t.Fatalf("process batch failed: %v", err)
	}

	if got := store.saved["/var/log/a.log"]; got != 25 {
		t.Fatalf("expected /var/log/a.log offset=25, got %d", got)
	}
	if got := store.saved["/var/log/b.log"]; got != int64(len("hello")) {
		t.Fatalf("expected /var/log/b.log offset=%d, got %d", len("hello"), got)
	}
}

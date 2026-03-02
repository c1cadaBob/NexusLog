package collector

import (
	"context"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"github.com/nexuslog/collector-agent/internal/checkpoint"
	"github.com/nexuslog/collector-agent/plugins"
)

// TestCollectFilesIncrementalFromCheckpoint 验证采集器按 checkpoint 偏移做增量读取。
func TestCollectFilesIncrementalFromCheckpoint(t *testing.T) {
	tempDir := t.TempDir()
	logPath := filepath.Join(tempDir, "app.log")
	logContent := "line-1\nline-2\nline-3\n"
	if err := os.WriteFile(logPath, []byte(logContent), 0644); err != nil {
		t.Fatalf("write log file failed: %v", err)
	}

	store, err := checkpoint.NewFileStore(filepath.Join(tempDir, "checkpoints"))
	if err != nil {
		t.Fatalf("new checkpoint store failed: %v", err)
	}
	defer store.Close()

	// 预置到第二行末尾，采集器只应读出第三行。
	if err := store.Save(logPath, int64(len("line-1\nline-2\n"))); err != nil {
		t.Fatalf("save checkpoint failed: %v", err)
	}

	coll := New(Config{
		Sources:       []SourceConfig{{Type: SourceTypeFile, Paths: []string{logPath}}},
		BatchSize:     10,
		FlushInterval: 20 * time.Millisecond,
		BufferSize:    4,
	}, store)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := coll.Start(ctx); err != nil {
		t.Fatalf("start collector failed: %v", err)
	}

	batch := waitBatch(t, coll.Output(), 2*time.Second)
	if len(batch) != 1 {
		t.Fatalf("expected 1 record, got %d", len(batch))
	}
	if string(batch[0].Data) != "line-3" {
		t.Fatalf("unexpected record data: %q", string(batch[0].Data))
	}

	offset, err := strconv.ParseInt(batch[0].Metadata["offset"], 10, 64)
	if err != nil {
		t.Fatalf("parse offset metadata failed: %v", err)
	}
	if offset != int64(len(logContent)) {
		t.Fatalf("unexpected record offset: got %d want %d", offset, len(logContent))
	}
}

// TestCollectFilesResumeAfterRestart 验证重启后从 checkpoint 继续，不重复全量读取。
func TestCollectFilesResumeAfterRestart(t *testing.T) {
	tempDir := t.TempDir()
	logPath := filepath.Join(tempDir, "resume.log")
	if err := os.WriteFile(logPath, []byte("first\nsecond\n"), 0644); err != nil {
		t.Fatalf("write initial log file failed: %v", err)
	}

	store, err := checkpoint.NewFileStore(filepath.Join(tempDir, "checkpoints"))
	if err != nil {
		t.Fatalf("new checkpoint store failed: %v", err)
	}
	defer store.Close()

	startCollector := func() (*Collector, context.CancelFunc) {
		coll := New(Config{
			Sources:       []SourceConfig{{Type: SourceTypeFile, Paths: []string{logPath}}},
			BatchSize:     10,
			FlushInterval: 20 * time.Millisecond,
			BufferSize:    4,
		}, store)
		ctx, cancel := context.WithCancel(context.Background())
		if err := coll.Start(ctx); err != nil {
			t.Fatalf("start collector failed: %v", err)
		}
		return coll, cancel
	}

	// 第一次启动读出初始日志，并将最大 offset 写回 checkpoint。
	firstCollector, firstCancel := startCollector()
	firstBatch := waitBatch(t, firstCollector.Output(), 2*time.Second)
	if len(firstBatch) != 2 {
		t.Fatalf("expected 2 initial records, got %d", len(firstBatch))
	}
	maxOffset := maxRecordOffset(t, firstBatch)
	if err := store.Save(logPath, maxOffset); err != nil {
		t.Fatalf("save max checkpoint failed: %v", err)
	}
	firstCancel()

	// 追加新日志后重启，只应读到新增内容。
	f, err := os.OpenFile(logPath, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		t.Fatalf("open log file for append failed: %v", err)
	}
	if _, err := f.WriteString("third\n"); err != nil {
		_ = f.Close()
		t.Fatalf("append log failed: %v", err)
	}
	_ = f.Close()

	secondCollector, secondCancel := startCollector()
	defer secondCancel()

	secondBatch := waitBatch(t, secondCollector.Output(), 2*time.Second)
	if len(secondBatch) != 1 {
		t.Fatalf("expected 1 appended record, got %d", len(secondBatch))
	}
	if string(secondBatch[0].Data) != "third" {
		t.Fatalf("unexpected appended data: %q", string(secondBatch[0].Data))
	}
}

// TestCollectFilesWithExcludePatterns 验证 include 命中时 exclude 可正确过滤。
func TestCollectFilesWithExcludePatterns(t *testing.T) {
	tempDir := t.TempDir()
	includeFile := filepath.Join(tempDir, "include.log")
	excludeFile := filepath.Join(tempDir, "exclude.log")
	if err := os.WriteFile(includeFile, []byte("keep-me\n"), 0644); err != nil {
		t.Fatalf("write include file failed: %v", err)
	}
	if err := os.WriteFile(excludeFile, []byte("drop-me\n"), 0644); err != nil {
		t.Fatalf("write exclude file failed: %v", err)
	}

	store, err := checkpoint.NewFileStore(filepath.Join(tempDir, "checkpoints"))
	if err != nil {
		t.Fatalf("new checkpoint store failed: %v", err)
	}
	defer store.Close()

	coll := New(Config{
		Sources: []SourceConfig{
			{
				Type:         SourceTypeFile,
				Paths:        []string{filepath.Join(tempDir, "*.log")},
				ExcludePaths: []string{excludeFile},
			},
		},
		BatchSize:     10,
		FlushInterval: 20 * time.Millisecond,
		BufferSize:    4,
	}, store)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := coll.Start(ctx); err != nil {
		t.Fatalf("start collector failed: %v", err)
	}

	batch := waitBatch(t, coll.Output(), 2*time.Second)
	if len(batch) != 1 {
		t.Fatalf("expected 1 record after exclude filter, got %d", len(batch))
	}
	if string(batch[0].Data) != "keep-me" {
		t.Fatalf("unexpected data after exclude filter: %q", string(batch[0].Data))
	}
	if batch[0].Source != includeFile {
		t.Fatalf("unexpected source after exclude filter: %s", batch[0].Source)
	}
}

func waitBatch(t *testing.T, ch <-chan []plugins.Record, timeout time.Duration) []plugins.Record {
	t.Helper()
	select {
	case batch := <-ch:
		return batch
	case <-time.After(timeout):
		t.Fatalf("wait batch timeout after %s", timeout)
		return nil
	}
}

func maxRecordOffset(t *testing.T, batch []plugins.Record) int64 {
	t.Helper()
	var max int64
	for _, record := range batch {
		raw := record.Metadata["offset"]
		parsed, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			t.Fatalf("parse record offset failed: %v", err)
		}
		if parsed > max {
			max = parsed
		}
	}
	return max
}

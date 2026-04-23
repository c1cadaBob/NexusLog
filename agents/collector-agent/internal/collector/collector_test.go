package collector

import (
	"context"
	"os"
	"path/filepath"
	"strconv"
	"strings"
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

func TestCollectFilesWithRecursiveGlob(t *testing.T) {
	tempDir := t.TempDir()
	rootFile := filepath.Join(tempDir, "root.log")
	nestedDir := filepath.Join(tempDir, "a", "b")
	if err := os.MkdirAll(nestedDir, 0755); err != nil {
		t.Fatalf("mkdir nested dir failed: %v", err)
	}
	nestedFile := filepath.Join(nestedDir, "nested.log")
	if err := os.WriteFile(rootFile, []byte("root-line\n"), 0644); err != nil {
		t.Fatalf("write root log failed: %v", err)
	}
	if err := os.WriteFile(nestedFile, []byte("nested-line\n"), 0644); err != nil {
		t.Fatalf("write nested log failed: %v", err)
	}

	store, err := checkpoint.NewFileStore(filepath.Join(tempDir, "checkpoints"))
	if err != nil {
		t.Fatalf("new checkpoint store failed: %v", err)
	}
	defer store.Close()

	disableFSNotify := false
	coll := New(Config{
		Sources: []SourceConfig{{
			Type:  SourceTypeFile,
			Paths: []string{filepath.Join(tempDir, "**", "*.log")},
		}},
		BatchSize:      10,
		FlushInterval:  20 * time.Millisecond,
		BufferSize:     4,
		EnableFSNotify: &disableFSNotify,
	}, store)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := coll.Start(ctx); err != nil {
		t.Fatalf("start collector failed: %v", err)
	}

	batch := waitBatch(t, coll.Output(), 2*time.Second)
	if len(batch) != 2 {
		t.Fatalf("expected 2 records with recursive glob, got %d", len(batch))
	}
	bySource := make(map[string]plugins.Record, len(batch))
	for _, record := range batch {
		bySource[record.Source] = record
	}
	if got := string(bySource[rootFile].Data); got != "root-line" {
		t.Fatalf("unexpected root record: %q", got)
	}
	if got := string(bySource[nestedFile].Data); got != "nested-line" {
		t.Fatalf("unexpected nested record: %q", got)
	}
}

// TestCollectFilesWithPathLabelRules 验证按路径匹配规则注入自定义标签。
func TestCollectFilesWithPathLabelRules(t *testing.T) {
	tempDir := t.TempDir()
	nginxFile := filepath.Join(tempDir, "nginx-access.log")
	appFile := filepath.Join(tempDir, "app.log")
	if err := os.WriteFile(nginxFile, []byte("nginx-line\n"), 0644); err != nil {
		t.Fatalf("write nginx log failed: %v", err)
	}
	if err := os.WriteFile(appFile, []byte("app-line\n"), 0644); err != nil {
		t.Fatalf("write app log failed: %v", err)
	}

	store, err := checkpoint.NewFileStore(filepath.Join(tempDir, "checkpoints"))
	if err != nil {
		t.Fatalf("new checkpoint store failed: %v", err)
	}
	defer store.Close()

	coll := New(Config{
		Sources: []SourceConfig{
			{
				Type:  SourceTypeFile,
				Paths: []string{filepath.Join(tempDir, "*.log")},
				PathLabelRules: []PathLabelRule{
					{
						Pattern: filepath.Join(tempDir, "nginx-*.log"),
						Labels: map[string]string{
							"service": "nginx",
							"tier":    "edge",
						},
					},
					{
						Pattern: filepath.Join(tempDir, "app*.log"),
						Labels: map[string]string{
							"service": "app",
							"tier":    "core",
						},
					},
				},
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
	if len(batch) != 2 {
		t.Fatalf("expected 2 records, got %d", len(batch))
	}

	bySource := make(map[string]plugins.Record, len(batch))
	for _, record := range batch {
		bySource[record.Source] = record
	}

	nginxRecord, ok := bySource[nginxFile]
	if !ok {
		t.Fatalf("nginx record not found in batch")
	}
	if nginxRecord.Metadata["service"] != "nginx" || nginxRecord.Metadata["tier"] != "edge" {
		t.Fatalf("unexpected nginx labels: %#v", nginxRecord.Metadata)
	}
	if nginxRecord.Metadata["offset"] == "" {
		t.Fatalf("expected nginx metadata.offset to be present")
	}

	appRecord, ok := bySource[appFile]
	if !ok {
		t.Fatalf("app record not found in batch")
	}
	if appRecord.Metadata["service"] != "app" || appRecord.Metadata["tier"] != "core" {
		t.Fatalf("unexpected app labels: %#v", appRecord.Metadata)
	}
	if appRecord.Metadata["offset"] == "" {
		t.Fatalf("expected app metadata.offset to be present")
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

func TestCollectFilesRoundRobinFairness(t *testing.T) {
	tempDir := t.TempDir()
	hotFile := filepath.Join(tempDir, "hot.log")
	coldFile := filepath.Join(tempDir, "cold.log")
	if err := os.WriteFile(hotFile, []byte("hot-1\nhot-2\nhot-3\n"), 0644); err != nil {
		t.Fatalf("write hot log failed: %v", err)
	}
	if err := os.WriteFile(coldFile, []byte("cold-1\n"), 0644); err != nil {
		t.Fatalf("write cold log failed: %v", err)
	}

	store, err := checkpoint.NewFileStore(filepath.Join(tempDir, "checkpoints"))
	if err != nil {
		t.Fatalf("new checkpoint store failed: %v", err)
	}
	defer store.Close()

	disableFSNotify := false
	coll := New(Config{
		Sources: []SourceConfig{{
			Type:  SourceTypeFile,
			Paths: []string{hotFile, coldFile},
		}},
		BatchSize:        2,
		PerFileReadLimit: 1,
		FlushInterval:    10 * time.Millisecond,
		BufferSize:       4,
		EnableFSNotify:   &disableFSNotify,
	}, store)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := coll.Start(ctx); err != nil {
		t.Fatalf("start collector failed: %v", err)
	}

	batch := waitBatch(t, coll.Output(), 2*time.Second)
	if len(batch) != 2 {
		t.Fatalf("expected 2 records, got %d", len(batch))
	}
	sourceSet := map[string]bool{}
	for _, item := range batch {
		sourceSet[item.Source] = true
	}
	if !sourceSet[hotFile] || !sourceSet[coldFile] {
		t.Fatalf("expected round-robin batch from both files, got sources=%#v", sourceSet)
	}
}

func TestCollectFilesCriticalFastPathWithFSNotify(t *testing.T) {
	tempDir := t.TempDir()
	logPath := filepath.Join(tempDir, "critical.log")
	if err := os.WriteFile(logPath, []byte(""), 0644); err != nil {
		t.Fatalf("write log file failed: %v", err)
	}

	store, err := checkpoint.NewFileStore(filepath.Join(tempDir, "checkpoints"))
	if err != nil {
		t.Fatalf("new checkpoint store failed: %v", err)
	}
	defer store.Close()

	enableFSNotify := true
	coll := New(Config{
		Sources: []SourceConfig{{
			Type:             SourceTypeFile,
			Paths:            []string{logPath},
			CriticalKeywords: []string{"fatal"},
		}},
		BatchSize:      10,
		FlushInterval:  2 * time.Second,
		BufferSize:     4,
		EnableFSNotify: &enableFSNotify,
		EventDebounce:  20 * time.Millisecond,
	}, store)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := coll.Start(ctx); err != nil {
		t.Fatalf("start collector failed: %v", err)
	}

	time.Sleep(100 * time.Millisecond)
	f, err := os.OpenFile(logPath, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		t.Fatalf("open critical log failed: %v", err)
	}
	if _, err = f.WriteString("fatal: subsystem unavailable\n"); err != nil {
		_ = f.Close()
		t.Fatalf("append critical log failed: %v", err)
	}
	_ = f.Close()

	deadline := time.After(1200 * time.Millisecond)
	for {
		select {
		case batch := <-coll.Output():
			for _, item := range batch {
				if !strings.Contains(string(item.Data), "fatal: subsystem unavailable") {
					continue
				}
				if item.Metadata["log_priority"] != string(SourcePriorityCritical) {
					t.Fatalf("expected critical metadata, got %#v", item.Metadata)
				}
				return
			}
		case <-deadline:
			t.Fatalf("expected critical record to be emitted before fallback flush interval")
		}
	}
}

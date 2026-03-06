package retry

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/nexuslog/collector-agent/plugins"
)

func tempWALDir(t *testing.T) string {
	t.Helper()
	dir, err := os.MkdirTemp("", "wal_buffer_test_*")
	if err != nil {
		t.Fatalf("创建临时目录失败: %v", err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	return dir
}

func makeRecord(source string, data string, critical bool) plugins.Record {
	r := plugins.Record{Source: source, Data: []byte(data), Timestamp: 12345}
	if critical {
		r.Metadata = map[string]string{"log_priority": "critical"}
	}
	return r
}

func TestWALBuffer_WriteReadPending_Roundtrip(t *testing.T) {
	dir := tempWALDir(t)
	cfg := WALConfig{Dir: dir}
	w, err := NewWALBuffer(cfg)
	if err != nil {
		t.Fatalf("NewWALBuffer: %v", err)
	}
	defer w.Close()

	records := []plugins.Record{
		makeRecord("src1", "data1", false),
		makeRecord("src2", "data2", true),
	}
	if err := w.Write(records); err != nil {
		t.Fatalf("Write: %v", err)
	}

	got, err := w.ReadPending()
	if err != nil {
		t.Fatalf("ReadPending: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("ReadPending: 期望 2 条记录, 得到 %d", len(got))
	}
	if got[0].Source != "src1" || string(got[0].Data) != "data1" {
		t.Errorf("记录 0: 期望 src1/data1, 得到 %s/%s", got[0].Source, string(got[0].Data))
	}
	if got[1].Source != "src2" || string(got[1].Data) != "data2" {
		t.Errorf("记录 1: 期望 src2/data2, 得到 %s/%s", got[1].Source, string(got[1].Data))
	}
}

func TestWALBuffer_AckClearsBuffer(t *testing.T) {
	dir := tempWALDir(t)
	cfg := WALConfig{Dir: dir}
	w, err := NewWALBuffer(cfg)
	if err != nil {
		t.Fatalf("NewWALBuffer: %v", err)
	}
	defer w.Close()

	if err := w.Write([]plugins.Record{makeRecord("a", "1", false)}); err != nil {
		t.Fatalf("Write: %v", err)
	}
	if err := w.Ack(); err != nil {
		t.Fatalf("Ack: %v", err)
	}

	got, err := w.ReadPending()
	if err != nil {
		t.Fatalf("ReadPending: %v", err)
	}
	if got != nil {
		t.Fatalf("Ack 后 ReadPending 应返回 nil, 得到 %v", got)
	}
	if w.Size() != 0 {
		t.Errorf("Ack 后 Size 应为 0, 得到 %d", w.Size())
	}
}

func TestWALBuffer_BackoffExponential(t *testing.T) {
	dir := tempWALDir(t)
	cfg := WALConfig{
		Dir:       dir,
		InitDelay: time.Second,
		MaxDelay:  5 * time.Minute,
	}
	w, err := NewWALBuffer(cfg)
	if err != nil {
		t.Fatalf("NewWALBuffer: %v", err)
	}
	defer w.Close()

	expect := []time.Duration{
		time.Second,      // retry 0
		2 * time.Second,  // retry 1
		4 * time.Second,  // retry 2
		8 * time.Second,  // retry 3
		16 * time.Second, // retry 4
		32 * time.Second, // retry 5
		64 * time.Second, // retry 6
		128 * time.Second,
		256 * time.Second,
		5 * time.Minute, // 512s > 5min, cap at 5min
		5 * time.Minute, // stays at max
	}
	for i, exp := range expect {
		d := w.NextRetryDelay()
		if d != exp {
			t.Errorf("retry %d: 期望 %v, 得到 %v", i, exp, d)
		}
		w.RecordRetry()
	}
}

func TestWALBuffer_ResetBackoff(t *testing.T) {
	dir := tempWALDir(t)
	cfg := WALConfig{Dir: dir, InitDelay: time.Second, MaxDelay: 5 * time.Minute}
	w, err := NewWALBuffer(cfg)
	if err != nil {
		t.Fatalf("NewWALBuffer: %v", err)
	}
	defer w.Close()

	if d := w.NextRetryDelay(); d != time.Second {
		t.Errorf("初始: 期望 1s, 得到 %v", d)
	}
	w.RecordRetry()
	w.RecordRetry()
	if d := w.NextRetryDelay(); d != 4*time.Second {
		t.Errorf("2 次重试后: 期望 4s, 得到 %v", d)
	}
	w.ResetBackoff()
	if d := w.NextRetryDelay(); d != time.Second {
		t.Errorf("ResetBackoff 后: 期望 1s, 得到 %v", d)
	}
}

func TestWALBuffer_SizeTracking(t *testing.T) {
	dir := tempWALDir(t)
	cfg := WALConfig{Dir: dir}
	w, err := NewWALBuffer(cfg)
	if err != nil {
		t.Fatalf("NewWALBuffer: %v", err)
	}
	defer w.Close()

	if s := w.Size(); s != 0 {
		t.Errorf("空缓冲 Size 应为 0, 得到 %d", s)
	}
	r := makeRecord("x", "hello", false)
	if err := w.Write([]plugins.Record{r}); err != nil {
		t.Fatalf("Write: %v", err)
	}
	s := w.Size()
	if s <= 0 {
		t.Errorf("写入后 Size 应 > 0, 得到 %d", s)
	}
	// 再写一条，size 应增加
	r2 := makeRecord("y", "world", false)
	if err := w.Write([]plugins.Record{r2}); err != nil {
		t.Fatalf("Write: %v", err)
	}
	if w.Size() <= s {
		t.Errorf("第二次写入后 Size 应增加, 之前 %d 现在 %d", s, w.Size())
	}
}

func TestWALBuffer_EmptyBufferReturnsNil(t *testing.T) {
	dir := tempWALDir(t)
	cfg := WALConfig{Dir: dir}
	w, err := NewWALBuffer(cfg)
	if err != nil {
		t.Fatalf("NewWALBuffer: %v", err)
	}
	defer w.Close()

	got, err := w.ReadPending()
	if err != nil {
		t.Fatalf("ReadPending: %v", err)
	}
	if got != nil {
		t.Fatalf("空缓冲 ReadPending 应返回 nil, 得到 %v", got)
	}
}

func TestWALBuffer_OverflowKeepsCritical(t *testing.T) {
	dir := tempWALDir(t)
	// 使用很小的 maxBytes 以触发溢出
	cfg := WALConfig{Dir: dir, MaxBytes: 100}
	w, err := NewWALBuffer(cfg)
	if err != nil {
		t.Fatalf("NewWALBuffer: %v", err)
	}
	defer w.Close()

	// 写入足够多的普通记录填满 WAL，再写关键记录
	var batch []plugins.Record
	for i := 0; i < 20; i++ {
		batch = append(batch, makeRecord("n", "normal_data_xxxx", false))
	}
	batch = append(batch, makeRecord("c", "critical", true))
	if err := w.Write(batch); err != nil {
		t.Fatalf("Write: %v", err)
	}

	got, err := w.ReadPending()
	if err != nil {
		t.Fatalf("ReadPending: %v", err)
	}
	// 应至少保留关键记录
	hasCritical := false
	for _, r := range got {
		if r.Source == "c" && string(r.Data) == "critical" {
			hasCritical = true
			break
		}
	}
	if !hasCritical {
		t.Errorf("溢出后应保留关键记录, 得到 %d 条: %v", len(got), got)
	}
}

func TestWALBuffer_DefaultConfig(t *testing.T) {
	dir := tempWALDir(t)
	cfg := WALConfig{Dir: dir}
	w, err := NewWALBuffer(cfg)
	if err != nil {
		t.Fatalf("NewWALBuffer: %v", err)
	}
	defer w.Close()

	// 默认 InitDelay 1s, MaxDelay 5min
	if d := w.NextRetryDelay(); d != time.Second {
		t.Errorf("默认 InitDelay 应为 1s, 得到 %v", d)
	}
}

func TestWALBuffer_ReopenReadsPending(t *testing.T) {
	dir := tempWALDir(t)
	cfg := WALConfig{Dir: dir}
	w1, err := NewWALBuffer(cfg)
	if err != nil {
		t.Fatalf("NewWALBuffer: %v", err)
	}
	if err := w1.Write([]plugins.Record{makeRecord("a", "1", false)}); err != nil {
		t.Fatalf("Write: %v", err)
	}
	w1.Close()

	// 重新打开应能读到
	w2, err := NewWALBuffer(cfg)
	if err != nil {
		t.Fatalf("NewWALBuffer (reopen): %v", err)
	}
	defer w2.Close()
	got, err := w2.ReadPending()
	if err != nil {
		t.Fatalf("ReadPending: %v", err)
	}
	if len(got) != 1 || got[0].Source != "a" {
		t.Errorf("重开后应读到 1 条记录, 得到 %v", got)
	}
}

func TestWALBuffer_InvalidDir(t *testing.T) {
	_, err := NewWALBuffer(WALConfig{Dir: ""})
	if err == nil {
		t.Error("空 Dir 应返回错误")
	}
}

func TestWALBuffer_InvalidPath(t *testing.T) {
	dir := tempWALDir(t)
	// 使用已存在的文件作为 Dir，MkdirAll 会失败
	f := filepath.Join(dir, "file")
	if err := os.WriteFile(f, []byte("x"), 0644); err != nil {
		t.Fatalf("创建文件失败: %v", err)
	}
	_, err := NewWALBuffer(WALConfig{Dir: f})
	if err == nil {
		t.Error("以文件路径作为 Dir 应返回错误")
	}
}

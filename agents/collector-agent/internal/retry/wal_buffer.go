// Package retry 实现 WAL 缓冲与指数退避重试
package retry

import (
	"bufio"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/nexuslog/collector-agent/plugins"
)

const (
	defaultMaxBytes  = 1 << 30 // 1GB
	defaultInitDelay = time.Second
	defaultMaxDelay  = 5 * time.Minute
	walFileName      = "wal.jsonl"
)

// WALConfig WAL 缓冲配置
type WALConfig struct {
	Dir      string        // WAL 目录
	MaxBytes int64         // 最大字节数，默认 1GB
	InitDelay time.Duration // 初始退避时间，默认 1s
	MaxDelay  time.Duration // 最大退避时间，默认 5min
}

// walRecord 用于序列化的记录结构
type walRecord struct {
	Source    string            `json:"source"`
	Timestamp int64             `json:"timestamp"`
	Data      []byte            `json:"data"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

// WALBuffer 基于文件的 WAL 缓冲，支持断连时持久化与指数退避重试
type WALBuffer struct {
	mu        sync.Mutex
	dir       string
	path      string
	maxBytes  int64
	initDelay time.Duration
	maxDelay  time.Duration
	size      int64
	retryCount int
	file      *os.File
}

// NewWALBuffer 创建 WAL 缓冲
func NewWALBuffer(cfg WALConfig) (*WALBuffer, error) {
	if cfg.Dir == "" {
		return nil, fmt.Errorf("WAL Dir 不能为空")
	}
	if err := os.MkdirAll(cfg.Dir, 0755); err != nil {
		return nil, fmt.Errorf("创建 WAL 目录失败: %w", err)
	}

	maxBytes := cfg.MaxBytes
	if maxBytes <= 0 {
		maxBytes = defaultMaxBytes
	}
	initDelay := cfg.InitDelay
	if initDelay <= 0 {
		initDelay = defaultInitDelay
	}
	maxDelay := cfg.MaxDelay
	if maxDelay <= 0 {
		maxDelay = defaultMaxDelay
	}

	w := &WALBuffer{
		dir:       cfg.Dir,
		path:      filepath.Join(cfg.Dir, walFileName),
		maxBytes:  maxBytes,
		initDelay: initDelay,
		maxDelay:  maxDelay,
	}

	// 打开或创建 WAL 文件，计算当前大小
	fi, err := os.Stat(w.path)
	if err == nil {
		w.size = fi.Size()
	}
	// 以追加模式打开，供 Write 使用
	w.file, err = os.OpenFile(w.path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return nil, fmt.Errorf("打开 WAL 文件失败: %w", err)
	}

	return w, nil
}

// isCritical 判断记录是否为关键记录
func isCritical(r plugins.Record) bool {
	if r.Metadata == nil {
		return false
	}
	return strings.EqualFold(strings.TrimSpace(r.Metadata["log_priority"]), "critical")
}

// recordToWal 转换为 walRecord
func recordToWal(r plugins.Record) walRecord {
	return walRecord{
		Source:    r.Source,
		Timestamp: r.Timestamp,
		Data:      r.Data,
		Metadata:  r.Metadata,
	}
}

// walToRecord 转换为 plugins.Record
func walToRecord(w walRecord) plugins.Record {
	return plugins.Record{
		Source:    w.Source,
		Timestamp: w.Timestamp,
		Data:      w.Data,
		Metadata:  w.Metadata,
	}
}

// Write 追加记录到 WAL
func (w *WALBuffer) Write(records []plugins.Record) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.writeLocked(records)
}

// writeLocked 持有锁时追加记录
func (w *WALBuffer) writeLocked(records []plugins.Record) error {
	for _, r := range records {
		line, err := json.Marshal(recordToWal(r))
		if err != nil {
			return fmt.Errorf("序列化记录失败: %w", err)
		}
		line = append(line, '\n')
		n, err := w.file.Write(line)
		if err != nil {
			return fmt.Errorf("写入 WAL 失败: %w", err)
		}
		w.size += int64(n)
	}
	return w.truncateIfOverflow()
}

// truncateIfOverflow 若超出 maxBytes，移除非关键记录
func (w *WALBuffer) truncateIfOverflow() error {
	if w.size <= w.maxBytes {
		return nil
	}
	// 读取全部，过滤非关键，重写
	if err := w.file.Sync(); err != nil {
		return err
	}
	if err := w.file.Close(); err != nil {
		return err
	}

	records, err := w.readAllRecords()
	if err != nil {
		return err
	}

	// 保留关键记录
	var kept []plugins.Record
	for _, r := range records {
		if isCritical(r) {
			kept = append(kept, r)
		}
	}

	// 重写文件
	w.file, err = os.Create(w.path)
	if err != nil {
		return fmt.Errorf("重建 WAL 文件失败: %w", err)
	}
	w.size = 0
	for _, r := range kept {
		line, err := json.Marshal(recordToWal(r))
		if err != nil {
			return err
		}
		line = append(line, '\n')
		n, _ := w.file.Write(line)
		w.size += int64(n)
	}
	return nil
}

// readAllRecords 读取文件中所有记录（需在持有锁且文件已关闭时调用，或只读打开）
func (w *WALBuffer) readAllRecords() ([]plugins.Record, error) {
	data, err := os.ReadFile(w.path)
	if err != nil {
		return nil, err
	}
	var records []plugins.Record
	scanner := bufio.NewScanner(strings.NewReader(string(data)))
	for scanner.Scan() {
		line := scanner.Text()
		if len(line) == 0 {
			continue
		}
		var wr walRecord
		if err := json.Unmarshal([]byte(line), &wr); err != nil {
			continue
		}
		records = append(records, walToRecord(wr))
	}
	return records, scanner.Err()
}

// ReadPending 读取待重试的缓冲记录
func (w *WALBuffer) ReadPending() ([]plugins.Record, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.size == 0 {
		return nil, nil
	}
	// 需要先 sync 确保写入落盘，再读取
	if err := w.file.Sync(); err != nil {
		return nil, err
	}
	return w.readAllRecords()
}

// Ack 确认记录已发送，从 WAL 中移除
func (w *WALBuffer) Ack() error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if err := w.file.Sync(); err != nil {
		return err
	}
	if err := w.file.Close(); err != nil {
		return err
	}
	// 清空文件
	var err error
	w.file, err = os.Create(w.path)
	if err != nil {
		return fmt.Errorf("清空 WAL 失败: %w", err)
	}
	w.size = 0
	return nil
}

// NextRetryDelay 返回当前退避延迟
func (w *WALBuffer) NextRetryDelay() time.Duration {
	w.mu.Lock()
	defer w.mu.Unlock()
	delay := float64(w.initDelay) * math.Pow(2, float64(w.retryCount))
	if delay > float64(w.maxDelay) {
		delay = float64(w.maxDelay)
	}
	return time.Duration(delay)
}

// RecordRetry 增加重试计数，提高退避
func (w *WALBuffer) RecordRetry() {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.retryCount++
}

// ResetBackoff 发送成功后重置退避
func (w *WALBuffer) ResetBackoff() {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.retryCount = 0
}

// Close 关闭 WAL
func (w *WALBuffer) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.file != nil {
		err := w.file.Close()
		w.file = nil
		return err
	}
	return nil
}

// Size 返回当前 WAL 大小（字节）
func (w *WALBuffer) Size() int64 {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.size
}

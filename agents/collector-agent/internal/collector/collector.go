// Package collector 实现日志采集器核心逻辑
// 负责从配置的数据源读取日志，支持文件和 syslog 两种采集方式
package collector

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/nexuslog/collector-agent/internal/checkpoint"
	"github.com/nexuslog/collector-agent/plugins"
)

// SourceType 采集源类型
type SourceType string

const (
	SourceTypeFile   SourceType = "file"
	SourceTypeSyslog SourceType = "syslog"
)

// SourceConfig 采集源配置
type SourceConfig struct {
	Type         SourceType
	Paths        []string          // 文件采集包含路径（file 类型）
	ExcludePaths []string          // 文件采集排除路径（file 类型）
	Protocol     string            // 协议（syslog 类型: udp/tcp）
	Bind         string            // 监听地址（syslog 类型）
	Extra        map[string]string // 额外配置
}

// Collector 日志采集器
type Collector struct {
	mu            sync.RWMutex
	sources       []SourceConfig
	ckpStore      checkpoint.Store
	outputCh      chan []plugins.Record
	batchSize     int
	flushInterval time.Duration
	running       bool
}

// Config 采集器配置
type Config struct {
	Sources       []SourceConfig
	BatchSize     int
	FlushInterval time.Duration
	BufferSize    int
}

// New 创建采集器实例
func New(cfg Config, ckpStore checkpoint.Store) *Collector {
	if cfg.BatchSize <= 0 {
		cfg.BatchSize = 1000
	}
	if cfg.FlushInterval <= 0 {
		cfg.FlushInterval = 5 * time.Second
	}
	if cfg.BufferSize <= 0 {
		cfg.BufferSize = 10000
	}
	return &Collector{
		sources:       cfg.Sources,
		ckpStore:      ckpStore,
		outputCh:      make(chan []plugins.Record, cfg.BufferSize),
		batchSize:     cfg.BatchSize,
		flushInterval: cfg.FlushInterval,
	}
}

// Output 返回采集输出通道，下游 pipeline 从此通道消费
func (c *Collector) Output() <-chan []plugins.Record {
	return c.outputCh
}

// Start 启动所有采集源
func (c *Collector) Start(ctx context.Context) error {
	c.mu.Lock()
	if c.running {
		c.mu.Unlock()
		return fmt.Errorf("采集器已在运行")
	}
	c.running = true
	c.mu.Unlock()

	for i, src := range c.sources {
		switch src.Type {
		case SourceTypeFile:
			go c.collectFiles(ctx, src)
		case SourceTypeSyslog:
			go c.collectSyslog(ctx, src)
		default:
			log.Printf("未知采集源类型 #%d: %s, 跳过", i, src.Type)
		}
	}
	log.Printf("采集器已启动，共 %d 个采集源", len(c.sources))
	return nil
}

// collectFiles 从文件源采集日志
func (c *Collector) collectFiles(ctx context.Context, src SourceConfig) {
	// fileOffsets 维护当前进程内各文件读取位置，首次从 checkpoint 恢复。
	fileOffsets := make(map[string]int64)
	ticker := time.NewTicker(c.flushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			batch, latestOffsets := c.scanIncrementalFileRecords(src, fileOffsets)
			if len(batch) == 0 {
				continue
			}
			if !c.emitBatch(ctx, batch) {
				return
			}
			// 只有批次成功投递到下游通道后，才推进本进程读取位置。
			for path, offset := range latestOffsets {
				fileOffsets[path] = offset
			}
		}
	}
}

// scanIncrementalFileRecords 按源配置扫描新增内容并生成批次。
func (c *Collector) scanIncrementalFileRecords(src SourceConfig, fileOffsets map[string]int64) ([]plugins.Record, map[string]int64) {
	batch := make([]plugins.Record, 0, c.batchSize)
	latestOffsets := make(map[string]int64)

	for _, configured := range src.Paths {
		paths, err := resolveScanPaths(configured)
		if err != nil {
			log.Printf("解析采集路径失败 [%s]: %v", configured, err)
			continue
		}
		for _, path := range paths {
			if len(batch) >= c.batchSize {
				return batch, latestOffsets
			}
			if isExcludedPath(path, src.ExcludePaths) {
				continue
			}

			currentOffset, err := c.loadOffsetIfNeeded(path, fileOffsets)
			if err != nil {
				log.Printf("加载 checkpoint 失败 [%s]: %v, 使用 offset=0", path, err)
				currentOffset = 0
			}

			records, nextOffset, err := c.readFileIncremental(path, currentOffset, c.batchSize-len(batch))
			if err != nil {
				log.Printf("增量读取失败 [%s]: %v", path, err)
				continue
			}
			if len(records) == 0 {
				continue
			}

			batch = append(batch, records...)
			latestOffsets[path] = nextOffset
		}
	}
	return batch, latestOffsets
}

// loadOffsetIfNeeded 在当前进程未缓存时，从 checkpoint 存储恢复文件偏移。
func (c *Collector) loadOffsetIfNeeded(path string, fileOffsets map[string]int64) (int64, error) {
	if offset, ok := fileOffsets[path]; ok {
		return offset, nil
	}

	pos, err := c.ckpStore.Load(path)
	if err != nil {
		return 0, err
	}
	fileOffsets[path] = pos.Offset
	if pos.Offset > 0 {
		log.Printf("从 checkpoint 恢复 [%s]: offset=%d", path, pos.Offset)
	}
	return pos.Offset, nil
}

// readFileIncremental 从指定偏移读取文件新增日志，返回记录与新偏移。
func (c *Collector) readFileIncremental(path string, startOffset int64, maxRecords int) ([]plugins.Record, int64, error) {
	if maxRecords <= 0 {
		return nil, startOffset, nil
	}

	file, err := os.Open(path)
	if err != nil {
		return nil, startOffset, err
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return nil, startOffset, err
	}
	if info.IsDir() {
		return nil, startOffset, fmt.Errorf("path is directory")
	}
	// 文件被截断或轮转时回退到头部，避免 seek 到无效偏移。
	if info.Size() < startOffset {
		startOffset = 0
	}

	if _, err = file.Seek(startOffset, io.SeekStart); err != nil {
		return nil, startOffset, err
	}

	reader := bufio.NewReader(file)
	records := make([]plugins.Record, 0, maxRecords)
	currentOffset := startOffset

	for len(records) < maxRecords {
		line, readErr := reader.ReadBytes('\n')
		if len(line) > 0 {
			currentOffset += int64(len(line))
			payload := bytes.TrimRight(line, "\r\n")
			record := plugins.Record{
				Source:    path,
				Timestamp: time.Now().UTC().UnixNano(),
				Data:      append([]byte(nil), payload...),
				Metadata: map[string]string{
					// 记录“已提交到该行末尾”的绝对偏移，供 pipeline 回写 checkpoint。
					"offset": strconv.FormatInt(currentOffset, 10),
				},
			}
			records = append(records, record)
		}

		if readErr != nil {
			if errors.Is(readErr, io.EOF) {
				break
			}
			return nil, startOffset, readErr
		}
	}

	return records, currentOffset, nil
}

// resolveScanPaths 将配置项解析为可读取文件列表，支持 glob 与单文件路径。
func resolveScanPaths(configured string) ([]string, error) {
	configured = strings.TrimSpace(configured)
	if configured == "" {
		return nil, nil
	}

	matches, err := filepath.Glob(configured)
	if err != nil {
		return nil, err
	}
	if len(matches) > 0 {
		return matches, nil
	}

	info, statErr := os.Stat(configured)
	if statErr == nil && !info.IsDir() {
		return []string{configured}, nil
	}
	if statErr != nil && !os.IsNotExist(statErr) {
		return nil, statErr
	}
	return nil, nil
}

// isExcludedPath 判断文件路径是否命中排除规则。
func isExcludedPath(path string, excludePatterns []string) bool {
	for _, raw := range excludePatterns {
		pattern := strings.TrimSpace(raw)
		if pattern == "" {
			continue
		}
		if matched, err := filepath.Match(pattern, path); err == nil && matched {
			return true
		}
		// 兼容仅写文件名模式（如 *.gz）。
		if matched, err := filepath.Match(pattern, filepath.Base(path)); err == nil && matched {
			return true
		}
	}
	return false
}

// emitBatch 向下游发送批次；如果上下文结束则返回 false。
func (c *Collector) emitBatch(ctx context.Context, batch []plugins.Record) bool {
	select {
	case c.outputCh <- batch:
		return true
	case <-ctx.Done():
		return false
	}
}

// collectSyslog 从 syslog 源采集日志
func (c *Collector) collectSyslog(ctx context.Context, src SourceConfig) {
	log.Printf("Syslog 采集器启动: %s://%s", src.Protocol, src.Bind)
	// TODO: 启动 UDP/TCP syslog 监听器
	// 接收到的日志封装为 Record 发送到 outputCh
	<-ctx.Done()
	log.Printf("Syslog 采集器已停止: %s", src.Bind)
}

// Stop 停止采集器
func (c *Collector) Stop() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.running = false
	close(c.outputCh)
}

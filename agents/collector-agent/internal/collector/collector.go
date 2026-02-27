// Package collector 实现日志采集器核心逻辑
// 负责从配置的数据源读取日志，支持文件和 syslog 两种采集方式
package collector

import (
	"context"
	"fmt"
	"log"
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
	Type     SourceType
	Paths    []string          // 文件采集路径（file 类型）
	Protocol string            // 协议（syslog 类型: udp/tcp）
	Bind     string            // 监听地址（syslog 类型）
	Extra    map[string]string // 额外配置
}

// Collector 日志采集器
type Collector struct {
	mu          sync.RWMutex
	sources     []SourceConfig
	ckpStore    checkpoint.Store
	outputCh    chan []plugins.Record
	batchSize   int
	flushInterval time.Duration
	running     bool
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
	for _, path := range src.Paths {
		// 从 checkpoint 恢复采集位置
		pos, err := c.ckpStore.Load(path)
		if err != nil {
			log.Printf("加载 checkpoint 失败 [%s]: %v, 从头开始采集", path, err)
		} else if pos.Offset > 0 {
			log.Printf("从 checkpoint 恢复 [%s]: offset=%d", path, pos.Offset)
		}
	}

	ticker := time.NewTicker(c.flushInterval)
	defer ticker.Stop()

	var batch []plugins.Record
	for {
		select {
		case <-ctx.Done():
			// 关闭前刷新剩余数据
			if len(batch) > 0 {
				c.outputCh <- batch
			}
			return
		case <-ticker.C:
			// TODO: 读取文件新增内容，追加到 batch
			// 当 batch 达到 batchSize 或 flushInterval 到期时发送
			if len(batch) > 0 {
				c.outputCh <- batch
				batch = nil
			}
		}
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

// Package retry 实现指数退避重试策略和本地缓存
// 当下游（Kafka）不可用时，将日志数据缓存到本地磁盘，
// 并按指数退避策略重试发送
package retry

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/nexuslog/collector-agent/plugins"
)

// Config 重试策略配置
type Config struct {
	// MaxRetries 最大重试次数，0 表示无限重试
	MaxRetries int
	// InitialBackoff 初始退避时间
	InitialBackoff time.Duration
	// MaxBackoff 最大退避时间
	MaxBackoff time.Duration
	// Multiplier 退避时间乘数
	Multiplier float64
	// CacheDir 本地缓存目录
	CacheDir string
}

// DefaultConfig 返回默认重试配置
func DefaultConfig() Config {
	return Config{
		MaxRetries:     5,
		InitialBackoff: time.Second,
		MaxBackoff:     60 * time.Second,
		Multiplier:     2.0,
		CacheDir:       "/var/lib/collector-agent/cache",
	}
}

// Retryer 重试执行器
type Retryer struct {
	config Config
	mu     sync.Mutex
}

// New 创建重试执行器
func New(cfg Config) *Retryer {
	return &Retryer{config: cfg}
}

// Do 执行带重试的操作
// fn 为需要重试的函数，返回 error 时触发重试
func (r *Retryer) Do(ctx context.Context, name string, fn func() error) error {
	var lastErr error
	for attempt := 0; r.config.MaxRetries == 0 || attempt <= r.config.MaxRetries; attempt++ {
		if err := ctx.Err(); err != nil {
			return fmt.Errorf("重试被取消: %w", err)
		}

		lastErr = fn()
		if lastErr == nil {
			if attempt > 0 {
				log.Printf("操作 %s: 第 %d 次重试成功", name, attempt)
			}
			return nil
		}

		backoff := r.calcBackoff(attempt)
		log.Printf("操作 %s 失败 (第 %d 次): %v, %v 后重试", name, attempt+1, lastErr, backoff)

		select {
		case <-ctx.Done():
			return fmt.Errorf("重试被取消: %w", ctx.Err())
		case <-time.After(backoff):
		}
	}
	return fmt.Errorf("操作 %s: 达到最大重试次数 %d, 最后错误: %w", name, r.config.MaxRetries, lastErr)
}

// calcBackoff 计算指数退避时间
func (r *Retryer) calcBackoff(attempt int) time.Duration {
	backoff := float64(r.config.InitialBackoff) * math.Pow(r.config.Multiplier, float64(attempt))
	if backoff > float64(r.config.MaxBackoff) {
		backoff = float64(r.config.MaxBackoff)
	}
	return time.Duration(backoff)
}

// CachedBatch 缓存的日志批次
type CachedBatch struct {
	ID        string           `json:"id"`
	Data      [][]byte         `json:"data,omitempty"`
	Records   []plugins.Record `json:"records,omitempty"`
	CreatedAt time.Time        `json:"created_at"`
	Retries   int              `json:"retries"`
}

// DiskCache 基于磁盘的本地缓存
// 当下游不可用时，将待发送的日志批次写入本地磁盘
type DiskCache struct {
	mu  sync.Mutex
	dir string
}

// NewDiskCache 创建磁盘缓存
func NewDiskCache(dir string) (*DiskCache, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("创建缓存目录失败: %w", err)
	}
	return &DiskCache{dir: dir}, nil
}

// Store 将日志批次缓存到磁盘
func (dc *DiskCache) Store(batch CachedBatch) error {
	dc.mu.Lock()
	defer dc.mu.Unlock()

	data, err := json.Marshal(batch)
	if err != nil {
		return fmt.Errorf("序列化缓存批次失败: %w", err)
	}
	path := filepath.Join(dc.dir, batch.ID+".json")
	return os.WriteFile(path, data, 0644)
}

// LoadAll 加载所有缓存的批次
func (dc *DiskCache) LoadAll() ([]CachedBatch, error) {
	dc.mu.Lock()
	defer dc.mu.Unlock()

	entries, err := os.ReadDir(dc.dir)
	if err != nil {
		return nil, err
	}

	var batches []CachedBatch
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dc.dir, entry.Name()))
		if err != nil {
			log.Printf("读取缓存文件 %s 失败: %v", entry.Name(), err)
			continue
		}
		var batch CachedBatch
		if err := json.Unmarshal(data, &batch); err != nil {
			log.Printf("解析缓存文件 %s 失败: %v", entry.Name(), err)
			continue
		}
		if len(batch.Records) == 0 && len(batch.Data) > 0 {
			batch.Records = make([]plugins.Record, len(batch.Data))
			for index, payload := range batch.Data {
				batch.Records[index] = plugins.Record{Data: payload, Timestamp: batch.CreatedAt.UnixNano()}
			}
		}
		batches = append(batches, batch)
	}
	return batches, nil
}

// Remove 删除已成功发送的缓存批次
func (dc *DiskCache) Remove(id string) error {
	dc.mu.Lock()
	defer dc.mu.Unlock()
	return os.Remove(filepath.Join(dc.dir, id+".json"))
}

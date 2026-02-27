// Package pipeline 实现日志处理管道
// 从采集器接收日志 → 插件处理 → 重试发送到 Kafka → 更新 checkpoint
// 整个流程确保 at-least-once 语义
package pipeline

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/nexuslog/collector-agent/internal/checkpoint"
	"github.com/nexuslog/collector-agent/internal/retry"
	"github.com/nexuslog/collector-agent/plugins"
)

// KafkaProducer Kafka 生产者接口
// 抽象 Kafka 发送逻辑，便于测试和替换
type KafkaProducer interface {
	// Send 发送一批日志记录到 Kafka
	Send(ctx context.Context, topic string, records []plugins.Record) error
	// Close 关闭生产者连接
	Close() error
}

// Config 管道配置
type Config struct {
	Workers    int
	Topic      string
	CacheDir   string
	RetryConfig retry.Config
}

// Pipeline 日志处理管道
type Pipeline struct {
	config    Config
	registry  *plugins.Registry
	producer  KafkaProducer
	ckpStore  checkpoint.Store
	retryer   *retry.Retryer
	cache     *retry.DiskCache
	wg        sync.WaitGroup
}

// New 创建处理管道
func New(cfg Config, registry *plugins.Registry, producer KafkaProducer, ckpStore checkpoint.Store) (*Pipeline, error) {
	if cfg.Workers <= 0 {
		cfg.Workers = 4
	}
	if cfg.CacheDir == "" {
		cfg.CacheDir = "/var/lib/collector-agent/cache"
	}

	cache, err := retry.NewDiskCache(cfg.CacheDir)
	if err != nil {
		return nil, fmt.Errorf("创建磁盘缓存失败: %w", err)
	}

	return &Pipeline{
		config:   cfg,
		registry: registry,
		producer: producer,
		ckpStore: ckpStore,
		retryer:  retry.New(cfg.RetryConfig),
		cache:    cache,
	}, nil
}

// Start 启动管道，从 inputCh 消费日志批次并处理
func (p *Pipeline) Start(ctx context.Context, inputCh <-chan []plugins.Record) {
	// 先尝试重发缓存中的历史数据
	go p.replayCache(ctx)

	// 启动多个 worker 并行处理
	for i := 0; i < p.config.Workers; i++ {
		p.wg.Add(1)
		go p.worker(ctx, i, inputCh)
	}
	log.Printf("管道已启动，%d 个 worker", p.config.Workers)
}

// worker 单个处理 worker
func (p *Pipeline) worker(ctx context.Context, id int, inputCh <-chan []plugins.Record) {
	defer p.wg.Done()

	for {
		select {
		case <-ctx.Done():
			return
		case batch, ok := <-inputCh:
			if !ok {
				return
			}
			if err := p.processBatch(ctx, batch); err != nil {
				log.Printf("Worker %d: 处理批次失败: %v", id, err)
			}
		}
	}
}

// processBatch 处理一个日志批次
// 流程: 插件处理 → 重试发送到 Kafka → 更新 checkpoint
func (p *Pipeline) processBatch(ctx context.Context, batch []plugins.Record) error {
	// 1. 通过插件链处理
	processed, err := p.registry.Process(ctx, batch)
	if err != nil {
		return fmt.Errorf("插件处理失败: %w", err)
	}

	// 2. 带重试地发送到 Kafka
	err = p.retryer.Do(ctx, "kafka-send", func() error {
		return p.producer.Send(ctx, p.config.Topic, processed)
	})

	if err != nil {
		// 重试耗尽，缓存到本地磁盘
		log.Printf("发送到 Kafka 失败，缓存到本地: %v", err)
		cacheData := make([][]byte, len(processed))
		for i, r := range processed {
			cacheData[i] = r.Data
		}
		cacheBatch := retry.CachedBatch{
			ID:        fmt.Sprintf("batch-%d", time.Now().UnixNano()),
			Data:      cacheData,
			CreatedAt: time.Now(),
		}
		if cacheErr := p.cache.Store(cacheBatch); cacheErr != nil {
			log.Printf("缓存到磁盘也失败: %v", cacheErr)
		}
		return err
	}

	// 3. 发送成功后更新 checkpoint（at-least-once 保证的关键）
	for _, r := range processed {
		if r.Source != "" {
			if ckpErr := p.ckpStore.Save(r.Source, int64(len(r.Data))); ckpErr != nil {
				log.Printf("更新 checkpoint 失败 [%s]: %v", r.Source, ckpErr)
			}
		}
	}

	return nil
}

// replayCache 重发磁盘缓存中的历史数据
func (p *Pipeline) replayCache(ctx context.Context) {
	batches, err := p.cache.LoadAll()
	if err != nil {
		log.Printf("加载缓存数据失败: %v", err)
		return
	}
	if len(batches) == 0 {
		return
	}

	log.Printf("发现 %d 个缓存批次，开始重发", len(batches))
	for _, batch := range batches {
		if ctx.Err() != nil {
			return
		}
		records := make([]plugins.Record, len(batch.Data))
		for i, d := range batch.Data {
			records[i] = plugins.Record{Data: d, Timestamp: batch.CreatedAt.UnixNano()}
		}
		err := p.retryer.Do(ctx, "cache-replay", func() error {
			return p.producer.Send(ctx, p.config.Topic, records)
		})
		if err != nil {
			log.Printf("重发缓存批次 %s 失败: %v", batch.ID, err)
			continue
		}
		if err := p.cache.Remove(batch.ID); err != nil {
			log.Printf("删除已重发的缓存 %s 失败: %v", batch.ID, err)
		}
	}
}

// Wait 等待所有 worker 完成
func (p *Pipeline) Wait() {
	p.wg.Wait()
}

// Close 关闭管道资源
func (p *Pipeline) Close() error {
	p.wg.Wait()
	if p.producer != nil {
		return p.producer.Close()
	}
	return nil
}

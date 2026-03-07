// Package pipeline 中的 Kafka Producer 实现
// 封装 Kafka 生产者逻辑，支持批量发送和压缩
package pipeline

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/nexuslog/collector-agent/plugins"
	"github.com/segmentio/kafka-go"
)

// KafkaConfig Kafka 生产者配置
type KafkaConfig struct {
	// Brokers Kafka broker 地址列表
	Brokers []string
	// Topic 默认发送 Topic
	Topic string
	// Compression 压缩算法: none, snappy, gzip, lz4, zstd
	Compression string
	// BatchSize 批量发送大小
	BatchSize int
	// Acks 确认级别: 0, 1, -1
	Acks int
	// FlushBytes 刷盘字节阈值
	FlushBytes int
	// FlushMs 刷盘时间阈值(ms)
	FlushMs int
}

// SimpleKafkaProducer 简易 Kafka 生产者实现
// 封装了连接管理、批量发送和错误处理
type SimpleKafkaProducer struct {
	mu      sync.Mutex
	config  KafkaConfig
	closed  bool
	writer  *kafka.Writer
}

// NewKafkaProducer 创建 Kafka 生产者
func NewKafkaProducer(cfg KafkaConfig) (*SimpleKafkaProducer, error) {
	if len(cfg.Brokers) == 0 {
		return nil, fmt.Errorf("Kafka broker 地址不能为空")
	}
	if cfg.Topic == "" {
		return nil, fmt.Errorf("Kafka topic 不能为空")
	}

	// 设置默认值
	if cfg.BatchSize <= 0 {
		cfg.BatchSize = 100
	}
	if cfg.Acks == 0 {
		cfg.Acks = 1 // 默认 leader 确认
	}
	if cfg.FlushBytes <= 0 {
		cfg.FlushBytes = 1024 * 1024 // 1MB
	}
	if cfg.FlushMs <= 0 {
		cfg.FlushMs = 1000 // 1s
	}

	log.Printf("Kafka Producer 初始化: brokers=%v, topic=%s, compression=%s, batch=%d, acks=%d",
		cfg.Brokers, cfg.Topic, cfg.Compression, cfg.BatchSize, cfg.Acks)

	// 使用 segmentio/kafka-go 建立真实连接
	writer := &kafka.Writer{
		Addr:         kafka.TCP(cfg.Brokers...),
		Topic:        cfg.Topic,
		Balancer:     &kafka.Hash{},
		BatchSize:    cfg.BatchSize,
		BatchBytes:   int64(cfg.FlushBytes),
		BatchTimeout: time.Duration(cfg.FlushMs) * time.Millisecond,
		Compression:  kafkaCompression(cfg.Compression),
		RequiredAcks: kafka.RequiredAcks(cfg.Acks),
	}

	return &SimpleKafkaProducer{
		config: cfg,
		writer: writer,
	}, nil
}

// Send 发送一批日志记录到 Kafka
func (p *SimpleKafkaProducer) Send(ctx context.Context, topic string, records []plugins.Record) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.closed {
		return fmt.Errorf("Kafka Producer 已关闭")
	}

	if len(records) == 0 {
		return nil
	}

	if topic == "" {
		topic = p.config.Topic
	}

	// 转换为 Kafka 消息并发送
	messages := make([]kafka.Message, 0, len(records))
	for _, record := range records {
		messages = append(messages, kafka.Message{
			Key:   []byte(record.Source),
			Value: record.Data,
		})
	}

	err := p.writer.WriteMessages(ctx, messages...)
	if err != nil {
		log.Printf("发送 %d 条记录到 Kafka topic=%s 失败: %v", len(records), topic, err)
		return fmt.Errorf("发送 Kafka 消息失败: %w", err)
	}

	log.Printf("发送 %d 条记录到 Kafka topic=%s 成功", len(records), topic)
	return nil
}

// Close 关闭 Kafka 生产者连接
func (p *SimpleKafkaProducer) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.closed {
		return nil
	}
	p.closed = true

	if p.writer != nil {
		return p.writer.Close()
	}

	log.Println("Kafka Producer 已关闭")
	return nil
}

// parseCompression 解析压缩算法
func kafkaCompression(compression string) kafka.Compression {
	switch compression {
	case "snappy":
		return kafka.Snappy
	case "gzip":
		return kafka.Gzip
	case "lz4":
		return kafka.Lz4
	case "zstd":
		return kafka.Zstd
	default:
		return 0 // 无压缩
	}
}

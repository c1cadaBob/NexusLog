package ingest

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
)

// SemanticDedupConfig 语义去重 Redis 配置
type SemanticDedupConfig struct {
	// Addrs Redis 地址列表
	Addrs []string
	// Password Redis 密码
	Password string
	// DB Redis 数据库编号
	DB int
	// PoolSize 连接池大小
	PoolSize int
	// KeyPrefix Redis key 前缀
	KeyPrefix string
	// WindowSeconds 语义去重时间窗口（秒）
	WindowSeconds int
	// LuaScript SHA Redis Lua 脚本 SHA（用于原子操作）
	LuaScriptSHA string
}

// RedisSemanticDedup 基于 Redis 的语义去重实现
// 使用 Redis Hash 存储指纹与聚合状态，支持多实例共享
type RedisSemanticDedup struct {
	client     *redis.Client
	cluster    *redis.ClusterClient
	isCluster  bool
	keyPrefix  string
	window     time.Duration
	luaScript  *redis.Script
	localCache map[string]semanticDedupEntry // 本地缓存，用于快速读取
	mu         sync.RWMutex
}

// NewRedisSemanticDedup 创建 Redis 语义去重器
func NewRedisSemanticDedup(cfg SemanticDedupConfig) (*RedisSemanticDedup, error) {
	if len(cfg.Addrs) == 0 {
		return nil, fmt.Errorf("Redis 地址不能为空")
	}
	if cfg.WindowSeconds <= 0 {
		cfg.WindowSeconds = 10
	}
	if cfg.KeyPrefix == "" {
		cfg.KeyPrefix = "nexuslog:semantic_dedup"
	}

	var client *redis.Client
	var cluster *redis.ClusterClient

	// 根据地址数量判断是单机还是集群
	if len(cfg.Addrs) > 1 {
		// 集群模式
		cluster = redis.NewClusterClient(&redis.ClusterOptions{
			Addrs:    cfg.Addrs,
			Password: cfg.Password,
			PoolSize: cfg.PoolSize,
		})
	} else {
		// 单机模式
		client = redis.NewClient(&redis.Options{
			Addr:     cfg.Addrs[0],
			Password: cfg.Password,
			DB:       cfg.DB,
			PoolSize: cfg.PoolSize,
		})
	}

	// 测试连接
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var err error
	if cluster != nil {
		err = cluster.Ping(ctx).Err()
	} else {
		err = client.Ping(ctx).Err()
	}

	if err != nil {
		if client != nil {
			client.Close()
		}
		if cluster != nil {
			cluster.Close()
		}
		return nil, fmt.Errorf("Redis 连接失败: %w", err)
	}

	// Lua 脚本：原子执行"检查-更新"操作
	luaScript := redis.NewScript(`...`)

	return &RedisSemanticDedup{
		client:     client,
		cluster:    cluster,
		isCluster:  cluster != nil,
		keyPrefix:  cfg.KeyPrefix,
		window:     time.Duration(cfg.WindowSeconds) * time.Second,
		luaScript:  luaScript,
		localCache: make(map[string]semanticDedupEntry),
	}, nil
}

// Process 应用语义去重逻辑
// 返回处理后的 LogDocument，如果命中去重则更新文档的 dedup 字段
func (r *RedisSemanticDedup) Process(ctx context.Context, doc LogDocument) LogDocument {
	fingerprint := strings.TrimSpace(doc.NexusLog.Dedup.Fingerprint)
	if fingerprint == "" {
		return doc
	}

	// 生成 Redis key
	key := fmt.Sprintf("%s:%s", r.keyPrefix, fingerprint)

	// 获取时间戳
	firstSeen := parseRFC3339OrNow(doc.Timestamp)
	lastSeen := firstSeen

	// 准备 Lua 脚本参数
	firstSeenNano := firstSeen.UTC().UnixNano()
	lastSeenNano := lastSeen.UTC().UnixNano()
	increment := doc.NexusLog.Dedup.Count
	if increment <= 0 {
		increment = 1
	}
	windowSec := int(r.window.Seconds())
	if doc.NexusLog.Dedup.WindowSec > 0 {
		windowSec = doc.NexusLog.Dedup.WindowSec
	}

	// 调用 Lua 脚本原子执行
	result, err := r.luaScript.Run(ctx, r.client, []string{key},
		doc.Event.ID,
		strconv.FormatInt(firstSeenNano, 10),
		strconv.FormatInt(lastSeenNano, 10),
		strconv.Itoa(increment),
		strconv.Itoa(windowSec),
	).Slice()

	if err != nil {
		// Redis 失败时降级为本地处理
		return r.processLocalFallback(ctx, doc, fingerprint)
	}

	if len(result) >= 5 {
		hit := result[0].(int64) == 1
		eventID := string(result[1].([]byte))
		firstSeenStr := string(result[2].([]byte))
		lastSeenStr := string(result[3].([]byte))
		count := int(result[4].(int64))

		doc.NexusLog.Dedup.Hit = hit
		doc.NexusLog.Dedup.Count = count
		doc.NexusLog.Dedup.FirstSeenAt = firstSeenStr
		doc.NexusLog.Dedup.LastSeenAt = lastSeenStr
		doc.NexusLog.Dedup.WindowSec = windowSec

		if hit {
			// 命中去重，使用 Redis 中的事件 ID
			doc.Event.ID = eventID
			doc.NexusLog.Dedup.SuppressedCount = count - 1
			if doc.NexusLog.Dedup.Strategy == "" {
				if doc.NexusLog.Multiline.Enabled {
					doc.NexusLog.Dedup.Strategy = "multiline"
				} else {
					doc.NexusLog.Dedup.Strategy = "normalized"
				}
			}
		}

		// 更新本地缓存
		r.mu.Lock()
		r.localCache[fingerprint] = semanticDedupEntry{
			DocumentID:  eventID,
			FirstSeenAt: parseUnixNano(firstSeenStr),
			LastSeenAt:  parseUnixNano(lastSeenStr),
			Count:       count,
		}
		r.mu.Unlock()

		return doc
	}

	// 返回结果异常，降级为本地处理
	return r.processLocalFallback(ctx, doc, fingerprint)
}

// processLocalFallback 本地缓存降级处理
func (r *RedisSemanticDedup) processLocalFallback(ctx context.Context, doc LogDocument, fingerprint string) LogDocument {
	r.mu.Lock()
	defer r.mu.Unlock()

	seenAt := parseRFC3339OrNow(doc.Timestamp)

	// 清理过期条目
	for key, entry := range r.localCache {
		if seenAt.Sub(entry.LastSeenAt) > r.window {
			delete(r.localCache, key)
		}
	}

	entry, ok := r.localCache[fingerprint]
	if !ok || seenAt.Sub(entry.LastSeenAt) > r.window {
		// 新指纹
		count := doc.NexusLog.Dedup.Count
		if count <= 0 {
			count = 1
		}
		doc.NexusLog.Dedup.Count = count
		doc.NexusLog.Dedup.Hit = false
		r.localCache[fingerprint] = semanticDedupEntry{
			DocumentID:  doc.Event.ID,
			FirstSeenAt: seenAt,
			LastSeenAt:  seenAt,
			Count:       count,
		}
		return doc
	}

	// 命中去重
	entry.Count++
	entry.LastSeenAt = seenAt
	doc.Event.ID = entry.DocumentID
	doc.NexusLog.Dedup.Hit = true
	doc.NexusLog.Dedup.Count = entry.Count
	doc.NexusLog.Dedup.FirstSeenAt = entry.FirstSeenAt.UTC().Format(time.RFC3339Nano)
	doc.NexusLog.Dedup.LastSeenAt = entry.LastSeenAt.UTC().Format(time.RFC3339Nano)
	doc.NexusLog.Dedup.WindowSec = int(r.window.Seconds())
	doc.NexusLog.Dedup.SuppressedCount = entry.Count - 1

	if doc.NexusLog.Dedup.Strategy == "" {
		if doc.NexusLog.Multiline.Enabled {
			doc.NexusLog.Dedup.Strategy = "multiline"
		} else {
			doc.NexusLog.Dedup.Strategy = "normalized"
		}
	}

	r.localCache[fingerprint] = entry
	return doc
}

// Cleanup 清理过期缓存
func (r *RedisSemanticDedup) Cleanup() {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	for key, entry := range r.localCache {
		if now.Sub(entry.LastSeenAt) > r.window {
			delete(r.localCache, key)
		}
	}
}

// Close 关闭 Redis 连接
func (r *RedisSemanticDedup) Close() error {
	if r.client != nil {
		return r.client.Close()
	}
	return nil
}

// parseUnixNano 将 Unix 纳秒时间字符串解析为 time.Time
func parseUnixNano(s string) time.Time {
	nano, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return time.Now()
	}
	return time.Unix(0, nano)
}

// NewRedisSemanticDedupFromConfig 从配置创建 Redis 语义去重器
func NewRedisSemanticDedupFromConfig(cfg struct {
	RedisAddrs     []string
	RedisPassword  string
	RedisDB        int
	RedisPoolSize  int
	DedupWindowSec int
}) (*RedisSemanticDedup, error) {
	semanticCfg := SemanticDedupConfig{
		Addrs:        cfg.RedisAddrs,
		Password:     cfg.RedisPassword,
		DB:           cfg.RedisDB,
		PoolSize:     cfg.RedisPoolSize,
		KeyPrefix:    "nexuslog:semantic_dedup",
		WindowSeconds: cfg.DedupWindowSec,
	}
	return NewRedisSemanticDedup(semanticCfg)
}

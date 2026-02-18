# 模块一：日志采集

> **文档版本**: v1.0  
> **创建日期**: 2026-01-29  
> **所属模块**: 模块一：日志采集  
> **需求编号**: 

---

**模块概述**: 

负责从多种数据源采集日志数据，支持多协议、跨平台部署，提供动态优先级管理和数据预处理能力。

**模块技术栈**:
- 采集代理：Go 1.21+ (轻量级、跨平台、高性能)
- 协议适配：插件化架构，每种协议独立插件
- 本地缓存：BoltDB/BadgerDB (嵌入式 KV 存储)
- 传输协议：gRPC/HTTP/2 (高效传输)
- 配置管理：PostgreSQL + Redis 配置中心（热配置）

**模块架构**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                日志采集模块整体架构                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            配置中心（控制面）                                          │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ PostgreSQL   │───▶│    Redis     │───▶│   Pub/Sub    │                           │ │
│  │  │ (版本化配置) │    │ (当前版本)   │    │ (变更通知)   │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────┬───────┘                           │ │
│  └────────────────────────────────────────────────────┼─────────────────────────────────┘ │
│                                                       │                                   │
│                                                       ▼                                   │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         Log Collector 实例（采集代理）                                 │ │
│  │                                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │  配置订阅器 (goroutine 订阅 config:reload)                                   │    │ │
│  │  │  使用 atomic.Value 热更新配置，无需重启                                      │    │ │
│  │  └──────────────────────────────────────────────────────────────────────────────┘    │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │                        数据源插件层（Input Plugins）                         │     │ │
│  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │     │ │
│  │  │  │ Syslog  │  │  HTTP   │  │  JDBC   │  │  Kafka  │  │  File   │          │     │ │
│  │  │  │ Plugin  │  │ Plugin  │  │ Plugin  │  │ Plugin  │  │ Plugin  │          │     │ │
│  │  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘          │     │ │
│  │  │       └────────────┴────────────┴────────────┴────────────┘                │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │                        优先级管理层（Priority Manager）                      │     │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                      │     │ │
│  │  │  │ 高优先级队列  │  │ 中优先级队列  │  │ 低优先级队列  │                      │     │ │
│  │  │  │ (紧急日志)   │  │ (常规日志)   │  │ (调试日志)   │                      │     │ │
│  │  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                      │     │ │
│  │  │         └──────────────────┴──────────────────┘                             │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │                      数据处理层（Processing Pipeline）                       │     │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │     │ │
│  │  │  │ 数据清洗  │─▶│ 格式转换  │─▶│ 字段提取  │─▶│ 数据脱敏  │                   │     │ │
│  │  │  │(Cleaner) │  │(Parser)  │  │(Extractor)│  │(Masker)  │                   │     │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                   │     │ │
│  │  │                                                                              │     │ │
│  │  │  ┌──────────┐  ┌──────────┐                                                │     │ │
│  │  │  │ 去重处理  │  │ 时间标准化│                                                │     │ │
│  │  │  │(Deduper) │  │(Normalizer)│                                               │     │ │
│  │  │  └──────────┘  └──────────┘                                                │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │                        本地缓冲层（Local Buffer）                            │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐                                      │     │ │
│  │  │  │ 内存缓冲区    │───▶│ 持久化缓存    │                                      │     │ │
│  │  │  │ (Ring Buffer)│    │ (BoltDB)     │                                      │     │ │
│  │  │  │ 快速写入     │    │ 断线保护     │                                      │     │ │
│  │  │  └──────────────┘    └──────────────┘                                      │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │                        传输层（Stream Manager）                              │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ LZ4 压缩     │───▶│ Kafka 生产者  │───▶│ 多目标分发    │                 │     │ │
│  │  │  │ (70%压缩率)  │    │ (批量发送)   │    │ (并行传输)   │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  └────────────────────────────────────────┼───────────────────────────────────────────┘ │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐ │
│  │                              Kafka 消息队列                                        │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                       │ │
│  │  │ logs-storage │    │ logs-analysis│    │ logs-alert   │                       │ │
│  │  │ (存储主题)   │    │ (分析主题)   │    │ (告警主题)   │                       │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                       │ │
│  └───────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            监控与健康检查                                          │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                       │ │
│  │  │ Prometheus   │    │ 健康检查端点  │    │ 日志审计     │                       │ │
│  │  │ 指标采集     │    │ /health      │    │ 配置变更记录  │                       │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                       │ │
│  └───────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**架构说明**:

1. **配置中心层**: 使用 PostgreSQL 存储版本化配置，Redis 分发当前生效配置，通过 Pub/Sub 实现配置热更新
2. **数据源插件层**: 支持多种协议的插件化采集，每种协议独立插件，易于扩展
3. **优先级管理层**: 三级优先级队列（高/中/低），支持动态调整和自动提升
4. **数据处理层**: 流水线式处理，包括清洗、转换、提取、脱敏、去重、标准化
5. **本地缓冲层**: 内存缓冲 + 持久化缓存，保证断线时数据不丢失
6. **传输层**: LZ4 压缩 + Kafka 批量发送 + 多目标并行分发
7. **监控层**: Prometheus 指标采集 + 健康检查 + 审计日志

**数据流向**:

```
数据源 → 插件采集 → 优先级队列 → 数据处理 → 本地缓冲 → 压缩传输 → Kafka → 下游系统
         ↑                                                              ↓
         └──────────────── 配置中心（热更新）─────────────────────────────┘
```

**需求列表**:
- 需求 1-1：多源日志采集 [MVP]
- 需求 1-2：动态日志采集与优先级管理 [MVP]
- 需求 1-3：数据清洗与预处理 [MVP]
- 需求 1-4：实时日志流传输 [MVP]
- 需求 1-5：多格式日志支持 [Phase 2]

---

## 需求 1-1：多源日志采集 [MVP]

**用户故事**: 

作为运维工程师，我希望能够从多种数据源采集日志，以便集中管理所有系统的日志数据。

**验收标准**:

1. THE Log_Collector SHALL 支持从操作系统、应用程序、数据库、容器和网络设备采集日志
2. WHEN 任意数据源产生新的日志条目时，THE Log_Collector SHALL 在 2 秒内完成捕获和传输
3. THE Log_Collector SHALL 支持 Syslog、HTTP(S)、JDBC、Kafka 和 Fluentd 协议
4. WHILE Log_Collector 运行时，THE Log_Collector SHALL 保持 CPU 占用低于宿主系统的 5%，内存占用低于 100MB
5. IF 与中央服务器的连接丢失，THEN THE Log_Collector SHALL 在本地缓冲日志（最大 1GB），并使用指数退避策略（初始 1 秒，最大 5 分钟）重试传输
6. THE Log_Collector SHALL 支持跨平台部署（Linux、Windows、macOS、AWS、Azure、GCP、Docker、Kubernetes）
7. THE Log_Collector SHALL 通过配置中心（PostgreSQL + Redis）获取采集配置，支持热更新无需重启

**实现方向**:

**实现方式**:

```go
// 日志采集器核心结构
type LogCollector struct {
    sources    []Source          // 数据源列表
    buffer     *RingBuffer       // 环形缓冲区
    sender     *Sender           // 发送器
    config     atomic.Value      // 配置（支持热更新）
    workerPool *WorkerPool       // 工作协程池
}

// 数据源接口
type Source interface {
    Read(ctx context.Context) ([]LogEntry, error)
    Type() string
    Name() string
}

// 采集主循环
func (c *LogCollector) Collect(ctx context.Context) error {
    for {
        select {
        case <-ctx.Done():
            return c.gracefulShutdown()
        default:
            // 从所有数据源采集日志
            for _, source := range c.sources {
                logs, err := source.Read(ctx)
                if err != nil {
                    log.Error("采集失败", "source", source.Name(), "error", err)
                    continue
                }
                
                // 写入缓冲区（带背压控制）
                if err := c.buffer.Write(logs); err != nil {
                    log.Warn("缓冲区满，触发背压", "source", source.Name())
                    time.Sleep(100 * time.Millisecond)
                    continue
                }
            }
            
            // 批量发送
            if c.buffer.Size() > 0 {
                batch := c.buffer.Flush()
                if err := c.sender.SendWithRetry(ctx, batch); err != nil {
                    // 连接失败，写入本地持久化缓存
                    c.persistToLocal(batch)
                }
            }
        }
    }
}

// 优雅关闭
func (c *LogCollector) gracefulShutdown() error {
    log.Info("开始优雅关闭...")
    
    // 1. 停止接收新数据
    c.stopAccepting()
    
    // 2. 等待缓冲区清空（最多等待 30 秒）
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    
    for c.buffer.Size() > 0 {
        select {
        case <-ctx.Done():
            log.Warn("超时，强制关闭")
            return ctx.Err()
        default:
            batch := c.buffer.Flush()
            c.sender.SendWithRetry(ctx, batch)
            time.Sleep(100 * time.Millisecond)
        }
    }
    
    log.Info("优雅关闭完成")
    return nil
}
```

**关键实现点**:

1. 使用 goroutine 池控制并发，限制资源占用（最大 100 个 goroutine）
2. 实现 backpressure 机制防止内存溢出（缓冲区满时阻塞读取）
3. 采用 mmap 技术优化文件读取性能（减少系统调用）
4. 配置热更新使用 atomic.Value 保证并发安全（无锁读取）
5. 支持优雅关闭，确保数据不丢失（等待缓冲区清空）

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| sources | array | [] | 数据源列表配置 |
| buffer_size | int | 1024 | 本地缓冲区大小（MB） |
| retry_interval | int | 1 | 重试初始间隔（秒） |
| retry_max_interval | int | 300 | 重试最大间隔（秒） |
| worker_pool_size | int | 100 | 工作协程池大小 |
| batch_size | int | 1000 | 批量发送大小（条） |
| flush_interval | int | 5 | 强制刷新间隔（秒） |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一次采集周期）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值
4. THE System SHALL 记录所有配置变更的审计日志

---

## 需求 1-2：动态日志采集与优先级管理 [MVP]

**用户故事**: 

作为运维工程师，我希望能够动态调整日志采集频率和优先级，以便在系统负载高峰期优先采集关键日志。

**验收标准**:

1. WHEN 系统 CPU 使用率超过 80% 时，THE Log_Collector SHALL 自动将非关键日志的采集频率降低 50%
2. THE Log_Collector SHALL 支持为不同日志源配置采集优先级（高、中、低三级）
3. WHEN 多个日志源同时产生大量日志时，THE Log_Collector SHALL 使用优先级队列，确保高优先级日志在 500ms 内处理
4. THE Dashboard SHALL 提供日志采集优先级的可视化配置界面
5. WHEN 检测到异常事件（错误率超过阈值 5%）时，THE Log_Collector SHALL 自动将相关日志源的采集优先级提升为高
6. THE Log_Collector SHALL 支持通过 API 实时调整优先级配置
7. THE Log_Collector SHALL 实现优先级继承机制，关联日志源自动继承优先级
8. WHEN 配置变更时，THE Log_Collector SHALL 在 3 秒内完成热更新，无需重启

**实现方向**:

**实现方式**:

```go
// 优先级队列管理器
type PriorityManager struct {
    queues map[Priority]*PriorityQueue  // 三个优先级队列
    config atomic.Value                 // 优先级配置（支持热更新）
    stats  *Statistics                  // 统计信息
}

// 优先级定义
type Priority int

const (
    PriorityHigh   Priority = 3
    PriorityMedium Priority = 2
    PriorityLow    Priority = 1
)

// 优先级队列（使用堆实现）
type PriorityQueue struct {
    items    []*LogEntry
    capacity int
    mu       sync.RWMutex
}

// 优先级规则
type PriorityRule struct {
    Pattern   string   // 匹配模式，如 "security-*", "payment-*"
    Level     []string // 日志级别，如 ["ERROR", "FATAL"]
    Priority  Priority // 优先级
    Enabled   bool     // 是否启用
}

// 自动提升规则
type AutoPromotionRule struct {
    Enabled              bool    // 是否启用
    ErrorRateThreshold   float64 // 错误率阈值（如 5.0 表示 5%）
    WindowSizeSeconds    int     // 时间窗口（秒）
    PromotionDuration    int     // 提升持续时间（秒）
}

// 处理日志条目
func (pm *PriorityManager) Process(entry *LogEntry) error {
    // 1. 检查系统负载
    if pm.isHighLoad() {
        // 高负载时，降低低优先级日志的采集频率
        if entry.Priority == PriorityLow && pm.shouldThrottle() {
            return nil // 跳过此条日志
        }
    }
    
    // 2. 确定优先级
    priority := pm.determinePriority(entry)
    
    // 3. 检查是否需要自动提升
    if pm.shouldAutoPromote(entry) {
        priority = PriorityHigh
        log.Info("自动提升优先级", "source", entry.Source, "reason", "error_rate_exceeded")
    }
    
    // 4. 加入对应的优先级队列
    queue := pm.queues[priority]
    if err := queue.Push(entry); err != nil {
        return fmt.Errorf("队列已满: %w", err)
    }
    
    return nil
}

// 确定日志优先级
func (pm *PriorityManager) determinePriority(entry *LogEntry) Priority {
    config := pm.config.Load().(*PriorityConfig)
    
    // 遍历优先级规则
    for _, rule := range config.Rules {
        if !rule.Enabled {
            continue
        }
        
        // 检查源名称匹配
        if matched, _ := filepath.Match(rule.Pattern, entry.Source); matched {
            return rule.Priority
        }
        
        // 检查日志级别匹配
        for _, level := range rule.Level {
            if entry.Level == level {
                return rule.Priority
            }
        }
    }
    
    // 默认中等优先级
    return PriorityMedium
}

// 检查是否需要自动提升
func (pm *PriorityManager) shouldAutoPromote(entry *LogEntry) bool {
    config := pm.config.Load().(*PriorityConfig)
    if !config.AutoPromotion.Enabled {
        return false
    }
    
    // 计算时间窗口内的错误率
    errorRate := pm.stats.GetErrorRate(
        entry.Source,
        time.Duration(config.AutoPromotion.WindowSizeSeconds)*time.Second,
    )
    
    return errorRate > config.AutoPromotion.ErrorRateThreshold
}

// 检查系统是否高负载
func (pm *PriorityManager) isHighLoad() bool {
    cpuUsage := pm.stats.GetCPUUsage()
    return cpuUsage > 80.0
}

// 判断是否应该限流
func (pm *PriorityManager) shouldThrottle() bool {
    // 使用令牌桶算法实现限流
    // 高负载时，低优先级日志采集频率降低 50%
    return rand.Float64() < 0.5
}

// 从队列中取出日志（按优先级）
func (pm *PriorityManager) Pop() *LogEntry {
    // 优先从高优先级队列取
    for priority := PriorityHigh; priority >= PriorityLow; priority-- {
        queue := pm.queues[priority]
        if entry := queue.Pop(); entry != nil {
            return entry
        }
    }
    return nil
}
```

**关键实现点**:

1. 使用三个独立的优先级队列（高、中、低），基于堆实现高效的优先级排序
2. 实现自适应限流机制，高负载时自动降低低优先级日志采集频率
3. 支持基于模式匹配（通配符）和日志级别的优先级规则
4. 实现滑动时间窗口统计错误率，支持自动优先级提升
5. 使用 atomic.Value 实现配置热更新，无需加锁

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| priority_rules | array | [] | 优先级规则列表 |
| auto_promotion_enabled | bool | true | 是否启用自动提升 |
| error_rate_threshold | float | 5.0 | 错误率阈值（%） |
| window_size_seconds | int | 60 | 统计时间窗口（秒） |
| promotion_duration_seconds | int | 300 | 提升持续时间（秒） |
| high_load_threshold | float | 80.0 | 高负载阈值（CPU %） |
| throttle_rate | float | 0.5 | 限流比例（0-1） |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一次优先级判断）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志并发送告警

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值和优先级统计
4. THE System SHALL 记录所有配置变更的审计日志，包括变更前后的配置对比

---

## 需求 1-3：数据清洗与预处理 [MVP]

**用户故事**: 

作为数据工程师，我希望系统能够自动清洗和格式化日志数据，以便提高日志数据的质量和一致性。

**验收标准**:

1. THE Data_Processor SHALL 自动去除无效字符（控制字符、非法 UTF-8 序列），确保数据完整性
2. THE Data_Processor SHALL 将不同格式的日志统一转换为标准 JSON 格式
3. THE Data_Processor SHALL 对敏感信息（IP 地址、用户名、密码、信用卡号、身份证号）进行自动脱敏处理
4. THE Data_Processor SHALL 自动提取结构化字段（时间戳、日志级别、来源、消息内容）
5. THE Data_Processor SHALL 对重复日志（5 秒内相同内容）进行去重处理，保留计数信息
6. THE Data_Processor SHALL 将所有时间戳标准化为 UTC 格式（ISO 8601: YYYY-MM-DDTHH:mm:ss.sssZ）
7. THE Data_Processor SHALL 使用布隆过滤器实现高效去重检测，误判率 < 0.1%
8. THE Data_Processor SHALL 支持自定义清洗规则的热加载，无需重启服务

**实现方向**:

**实现方式**:

```go
// 数据处理器
type DataProcessor struct {
    cleaners   []Cleaner           // 清洗器链
    deduper    *BloomDeduplicator  // 去重器
    masker     *DataMasker         // 脱敏器
    config     atomic.Value        // 配置（支持热更新）
}

// 清洗器接口
type Cleaner interface {
    Clean(entry *LogEntry) error
    Name() string
}

// 处理日志条目
func (dp *DataProcessor) Process(entry *LogEntry) (*LogEntry, error) {
    // 1. 数据清洗（去除无效字符）
    if err := dp.cleanInvalidChars(entry); err != nil {
        return nil, fmt.Errorf("清洗失败: %w", err)
    }
    
    // 2. 格式标准化（转换为 JSON）
    if err := dp.normalizeFormat(entry); err != nil {
        return nil, fmt.Errorf("格式化失败: %w", err)
    }
    
    // 3. 时间戳标准化（转换为 UTC）
    if err := dp.normalizeTimestamp(entry); err != nil {
        return nil, fmt.Errorf("时间戳标准化失败: %w", err)
    }
    
    // 4. 敏感信息脱敏
    if err := dp.masker.Mask(entry); err != nil {
        return nil, fmt.Errorf("脱敏失败: %w", err)
    }
    
    // 5. 去重检测
    if dp.deduper.IsDuplicate(entry) {
        // 重复日志，增加计数
        dp.deduper.IncrementCount(entry)
        return nil, nil // 返回 nil 表示跳过
    }
    
    // 6. 提取结构化字段
    if err := dp.extractFields(entry); err != nil {
        log.Warn("字段提取失败", "error", err)
        // 继续处理，不中断
    }
    
    return entry, nil
}

// 清洗无效字符
func (dp *DataProcessor) cleanInvalidChars(entry *LogEntry) error {
    // 去除控制字符（除了 \n, \r, \t）
    entry.Message = removeControlChars(entry.Message)
    
    // 修复非法 UTF-8 序列
    if !utf8.ValidString(entry.Message) {
        entry.Message = strings.ToValidUTF8(entry.Message, "�")
    }
    
    // 去除 BOM（Byte Order Mark）
    entry.Message = strings.TrimPrefix(entry.Message, "\ufeff")
    
    return nil
}

// 格式标准化
func (dp *DataProcessor) normalizeFormat(entry *LogEntry) error {
    // 如果已经是 JSON 格式，直接返回
    if entry.Format == "json" {
        return nil
    }
    
    // 转换为标准 JSON 格式
    normalized := map[string]interface{}{
        "@timestamp": entry.Timestamp,
        "@version":   "1",
        "level":      entry.Level,
        "source":     entry.Source,
        "host":       entry.Host,
        "message":    entry.Message,
        "fields":     entry.Fields,
        "_meta": map[string]interface{}{
            "original_format": entry.Format,
            "processed_at":    time.Now().UTC().Format(time.RFC3339Nano),
        },
    }
    
    entry.Data = normalized
    entry.Format = "json"
    
    return nil
}

// 时间戳标准化
func (dp *DataProcessor) normalizeTimestamp(entry *LogEntry) error {
    // 解析时间戳（支持多种格式）
    t, err := parseTimestamp(entry.Timestamp)
    if err != nil {
        // 解析失败，使用当前时间
        t = time.Now()
        log.Warn("时间戳解析失败，使用当前时间", "original", entry.Timestamp)
    }
    
    // 转换为 UTC 并格式化为 ISO 8601
    entry.Timestamp = t.UTC().Format(time.RFC3339Nano)
    
    return nil
}

// 提取结构化字段
func (dp *DataProcessor) extractFields(entry *LogEntry) error {
    config := dp.config.Load().(*ProcessorConfig)
    
    // 应用自定义提取规则
    for _, rule := range config.ExtractionRules {
        if !rule.Enabled {
            continue
        }
        
        // 使用正则表达式提取字段
        if matches := rule.Pattern.FindStringSubmatch(entry.Message); matches != nil {
            for i, name := range rule.FieldNames {
                if i+1 < len(matches) {
                    entry.Fields[name] = matches[i+1]
                }
            }
        }
    }
    
    return nil
}

// 布隆过滤器去重器
type BloomDeduplicator struct {
    filter    *bloom.BloomFilter  // 布隆过滤器
    cache     *lru.Cache           // LRU 缓存（存储计数）
    window    time.Duration        // 时间窗口
    mu        sync.RWMutex
}

// 检查是否重复
func (bd *BloomDeduplicator) IsDuplicate(entry *LogEntry) bool {
    // 计算日志指纹（基于内容哈希）
    fingerprint := bd.calculateFingerprint(entry)
    
    bd.mu.RLock()
    defer bd.mu.RUnlock()
    
    // 使用布隆过滤器快速检测
    if !bd.filter.Test([]byte(fingerprint)) {
        // 肯定不重复
        bd.filter.Add([]byte(fingerprint))
        return false
    }
    
    // 可能重复，检查 LRU 缓存确认
    if item, ok := bd.cache.Get(fingerprint); ok {
        lastSeen := item.(time.Time)
        // 检查是否在时间窗口内
        if time.Since(lastSeen) < bd.window {
            return true // 确认重复
        }
    }
    
    // 不重复，更新缓存
    bd.cache.Add(fingerprint, time.Now())
    return false
}

// 计算日志指纹
func (bd *BloomDeduplicator) calculateFingerprint(entry *LogEntry) string {
    // 使用 xxhash 计算快速哈希
    h := xxhash.New()
    h.Write([]byte(entry.Source))
    h.Write([]byte(entry.Level))
    h.Write([]byte(entry.Message))
    return fmt.Sprintf("%x", h.Sum64())
}

// 数据脱敏器
type DataMasker struct {
    rules []MaskingRule
}

// 脱敏规则
type MaskingRule struct {
    Type    string         // ip, email, phone, credit_card, id_card, password
    Pattern *regexp.Regexp // 匹配模式
    Masker  func(string) string // 脱敏函数
}

// 执行脱敏
func (dm *DataMasker) Mask(entry *LogEntry) error {
    for _, rule := range dm.rules {
        entry.Message = rule.Pattern.ReplaceAllStringFunc(entry.Message, rule.Masker)
        
        // 对字段也进行脱敏
        for key, value := range entry.Fields {
            if str, ok := value.(string); ok {
                entry.Fields[key] = rule.Pattern.ReplaceAllStringFunc(str, rule.Masker)
            }
        }
    }
    
    return nil
}

// IP 地址脱敏：192.168.1.100 → 192.168.*.*
func maskIP(ip string) string {
    parts := strings.Split(ip, ".")
    if len(parts) == 4 {
        return fmt.Sprintf("%s.%s.*.*", parts[0], parts[1])
    }
    return ip
}

// 邮箱脱敏：user@example.com → u***@example.com
func maskEmail(email string) string {
    parts := strings.Split(email, "@")
    if len(parts) == 2 {
        username := parts[0]
        if len(username) > 1 {
            return string(username[0]) + "***@" + parts[1]
        }
    }
    return email
}

// 手机号脱敏：13812345678 → 138****5678
func maskPhone(phone string) string {
    if len(phone) == 11 {
        return phone[:3] + "****" + phone[7:]
    }
    return phone
}
```

**关键实现点**:

1. 使用布隆过滤器实现高效去重（空间复杂度 O(1)，时间复杂度 O(k)）
2. 结合 LRU 缓存避免布隆过滤器的误判（确保准确性）
3. 使用 xxhash 快速计算日志指纹（比 MD5/SHA1 快 10 倍以上）
4. 支持多种脱敏规则，使用正则表达式灵活匹配
5. 清洗规则支持热加载，使用 atomic.Value 实现无锁配置更新

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| dedup_enabled | bool | true | 是否启用去重 |
| dedup_window_seconds | int | 5 | 去重时间窗口（秒） |
| bloom_filter_size | int | 1000000 | 布隆过滤器大小 |
| bloom_filter_fp_rate | float | 0.001 | 布隆过滤器误判率 |
| masking_rules | array | [] | 脱敏规则列表 |
| extraction_rules | array | [] | 字段提取规则列表 |
| normalize_timestamp | bool | true | 是否标准化时间戳 |
| remove_control_chars | bool | true | 是否去除控制字符 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一条日志处理）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN 脱敏规则变更时，THE System SHALL 验证正则表达式的有效性

---

## 需求 1-4：实时日志流传输 [MVP]

**用户故事**: 

作为运维工程师，我希望能够通过实时日志流获取最新的日志数据，以便及时发现和响应问题。

**验收标准**:

1. THE Log_Collector SHALL 支持通过 Kafka 进行高吞吐量（≥100 万条/秒）的实时日志流传输
2. THE Log_Stream SHALL 支持实时过滤和转换，处理延迟不超过 100ms
3. THE Log_Stream SHALL 支持多目标分发，同时向存储、分析、告警系统发送日志
4. THE Log_Stream SHALL 支持回放功能，允许重新处理最近 7 天的历史日志数据
5. WHEN 传输日志时，THE Log_Collector SHALL 使用 LZ4 压缩，带宽使用减少至少 70%
6. THE Log_Stream SHALL 保证消息顺序性，同一来源的日志按时间顺序传输
7. IF 消费者处理速度慢，THEN THE Log_Stream SHALL 实施背压机制，避免内存溢出

**实现方向**:

**实现方式**:

```go
// Kafka 流传输管理器
type StreamManager struct {
    producer   *kafka.Producer      // Kafka 生产者
    consumers  []*kafka.Consumer    // Kafka 消费者列表
    compressor *LZ4Compressor       // LZ4 压缩器
    router     *MessageRouter       // 消息路由器
    config     atomic.Value         // 配置（支持热更新）
    metrics    *StreamMetrics       // 流指标统计
}

// 流配置
type StreamConfig struct {
    KafkaBrokers       []string          // Kafka 集群地址
    Topic              string            // 主题名称
    Partitions         int               // 分区数
    ReplicationFactor  int               // 副本因子
    CompressionEnabled bool              // 是否启用压缩
    BatchSize          int               // 批量大小
    LingerMs           int               // 延迟时间（毫秒）
    Targets            []StreamTarget    // 目标系统列表
    BackpressureConfig BackpressureConfig // 背压配置
}

// 流目标
type StreamTarget struct {
    Name    string   // 目标名称：storage, analysis, alert
    Enabled bool     // 是否启用
    Filter  string   // 过滤规则（可选）
    Topic   string   // 目标 Topic
}

// 背压配置
type BackpressureConfig struct {
    Enabled           bool    // 是否启用背压
    HighWatermark     int     // 高水位（触发背压）
    LowWatermark      int     // 低水位（解除背压）
    MaxBufferSize     int     // 最大缓冲区大小
    DropPolicy        string  // 丢弃策略：oldest/newest/none
}

// 发送日志到 Kafka
func (sm *StreamManager) Send(entry *LogEntry) error {
    config := sm.config.Load().(*StreamConfig)
    
    // 1. 检查背压状态
    if sm.isBackpressureActive() {
        return sm.handleBackpressure(entry)
    }
    
    // 2. 序列化日志条目
    data, err := json.Marshal(entry)
    if err != nil {
        return fmt.Errorf("序列化失败: %w", err)
    }
    
    // 3. LZ4 压缩（如果启用）
    if config.CompressionEnabled {
        compressed, err := sm.compressor.Compress(data)
        if err != nil {
            log.Warn("压缩失败，使用原始数据", "error", err)
        } else {
            data = compressed
            sm.metrics.RecordCompression(len(data), len(compressed))
        }
    }
    
    // 4. 构造 Kafka 消息
    message := &kafka.Message{
        Topic: config.Topic,
        Key:   []byte(entry.Source), // 使用来源作为 Key 保证顺序
        Value: data,
        Headers: []kafka.Header{
            {Key: "source", Value: []byte(entry.Source)},
            {Key: "level", Value: []byte(entry.Level)},
            {Key: "timestamp", Value: []byte(entry.Timestamp)},
            {Key: "compressed", Value: []byte(strconv.FormatBool(config.CompressionEnabled))},
        },
    }
    
    // 5. 发送到 Kafka（异步）
    deliveryChan := make(chan kafka.Event, 1)
    err = sm.producer.Produce(message, deliveryChan)
    if err != nil {
        return fmt.Errorf("发送失败: %w", err)
    }
    
    // 6. 等待确认（可选，根据配置）
    go func() {
        e := <-deliveryChan
        m := e.(*kafka.Message)
        if m.TopicPartition.Error != nil {
            log.Error("消息发送失败", "error", m.TopicPartition.Error)
            sm.metrics.RecordFailure()
        } else {
            sm.metrics.RecordSuccess()
        }
    }()
    
    return nil
}

// 多目标分发
func (sm *StreamManager) Distribute(entry *LogEntry) error {
    config := sm.config.Load().(*StreamConfig)
    
    var wg sync.WaitGroup
    errChan := make(chan error, len(config.Targets))
    
    for _, target := range config.Targets {
        if !target.Enabled {
            continue
        }
        
        // 应用过滤规则
        if target.Filter != "" && !sm.matchFilter(entry, target.Filter) {
            continue
        }
        
        wg.Add(1)
        go func(t StreamTarget) {
            defer wg.Done()
            
            // 发送到目标 Topic
            if err := sm.sendToTarget(entry, t); err != nil {
                errChan <- fmt.Errorf("发送到 %s 失败: %w", t.Name, err)
            }
        }(target)
    }
    
    wg.Wait()
    close(errChan)
    
    // 收集错误
    var errors []error
    for err := range errChan {
        errors = append(errors, err)
    }
    
    if len(errors) > 0 {
        return fmt.Errorf("部分目标发送失败: %v", errors)
    }
    
    return nil
}

// 回放历史日志
func (sm *StreamManager) Replay(startTime, endTime time.Time, filter string) error {
    config := sm.config.Load().(*StreamConfig)
    
    // 1. 创建回放消费者
    consumer, err := kafka.NewConsumer(&kafka.ConfigMap{
        "bootstrap.servers": strings.Join(config.KafkaBrokers, ","),
        "group.id":          fmt.Sprintf("replay-%d", time.Now().Unix()),
        "auto.offset.reset": "earliest",
    })
    if err != nil {
        return fmt.Errorf("创建消费者失败: %w", err)
    }
    defer consumer.Close()
    
    // 2. 订阅 Topic
    if err := consumer.Subscribe(config.Topic, nil); err != nil {
        return fmt.Errorf("订阅失败: %w", err)
    }
    
    // 3. 读取并重新处理消息
    log.Info("开始回放日志", "start", startTime, "end", endTime)
    
    for {
        msg, err := consumer.ReadMessage(100 * time.Millisecond)
        if err != nil {
            if err.(kafka.Error).Code() == kafka.ErrTimedOut {
                continue
            }
            return fmt.Errorf("读取消息失败: %w", err)
        }
        
        // 解析日志条目
        var entry LogEntry
        
        // 检查是否压缩
        compressed := false
        for _, header := range msg.Headers {
            if header.Key == "compressed" && string(header.Value) == "true" {
                compressed = true
                break
            }
        }
        
        // 解压缩（如果需要）
        data := msg.Value
        if compressed {
            decompressed, err := sm.compressor.Decompress(data)
            if err != nil {
                log.Warn("解压缩失败", "error", err)
                continue
            }
            data = decompressed
        }
        
        // 反序列化
        if err := json.Unmarshal(data, &entry); err != nil {
            log.Warn("反序列化失败", "error", err)
            continue
        }
        
        // 检查时间范围
        entryTime, _ := time.Parse(time.RFC3339Nano, entry.Timestamp)
        if entryTime.Before(startTime) {
            continue
        }
        if entryTime.After(endTime) {
            break // 超出时间范围，停止回放
        }
        
        // 应用过滤规则
        if filter != "" && !sm.matchFilter(&entry, filter) {
            continue
        }
        
        // 重新处理日志
        if err := sm.reprocessLog(&entry); err != nil {
            log.Error("重新处理失败", "error", err)
        }
        
        sm.metrics.RecordReplay()
    }
    
    log.Info("回放完成")
    return nil
}

// 背压处理
func (sm *StreamManager) handleBackpressure(entry *LogEntry) error {
    config := sm.config.Load().(*StreamConfig)
    bp := config.BackpressureConfig
    
    if !bp.Enabled {
        return nil
    }
    
    // 检查缓冲区大小
    bufferSize := sm.getBufferSize()
    
    if bufferSize >= bp.HighWatermark {
        log.Warn("触发背压", "buffer_size", bufferSize, "high_watermark", bp.HighWatermark)
        
        switch bp.DropPolicy {
        case "oldest":
            // 丢弃最旧的消息
            sm.dropOldest()
        case "newest":
            // 丢弃当前消息
            return fmt.Errorf("背压：丢弃新消息")
        case "none":
            // 阻塞等待
            sm.waitForSpace()
        }
    }
    
    return nil
}

// LZ4 压缩器
type LZ4Compressor struct{}

func (c *LZ4Compressor) Compress(data []byte) ([]byte, error) {
    buf := make([]byte, lz4.CompressBlockBound(len(data)))
    n, err := lz4.CompressBlock(data, buf, nil)
    if err != nil {
        return nil, err
    }
    return buf[:n], nil
}

func (c *LZ4Compressor) Decompress(data []byte) ([]byte, error) {
    // 预估解压后大小（通常是压缩前的 3-5 倍）
    buf := make([]byte, len(data)*5)
    n, err := lz4.UncompressBlock(data, buf)
    if err != nil {
        return nil, err
    }
    return buf[:n], nil
}
```

**关键实现点**:

1. 使用 Kafka 分区保证同一来源的日志顺序性（使用 source 作为 partition key）
2. 实现 LZ4 压缩算法，压缩比达到 70% 以上，压缩/解压速度 > 500MB/s
3. 支持多目标并发分发，使用 goroutine 并行发送到不同系统
4. 实现背压机制，监控缓冲区水位，防止内存溢出
5. 支持历史日志回放，基于时间范围和过滤条件重新处理数据

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| kafka_brokers | array | ["localhost:9092"] | Kafka 集群地址列表 |
| topic | string | "logs" | 主题名称 |
| partitions | int | 10 | 分区数 |
| replication_factor | int | 3 | 副本因子 |
| compression_enabled | bool | true | 是否启用 LZ4 压缩 |
| batch_size | int | 1000 | 批量发送大小 |
| linger_ms | int | 10 | 延迟时间（毫秒） |
| targets | array | [] | 目标系统列表 |
| backpressure_enabled | bool | true | 是否启用背压 |
| high_watermark | int | 10000 | 高水位阈值 |
| low_watermark | int | 5000 | 低水位阈值 |
| drop_policy | string | "oldest" | 丢弃策略 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一批消息发送）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值和流指标
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN Kafka 连接配置变更时，THE System SHALL 重新建立连接而不丢失缓冲区中的数据

---

## 需求 1-5：多格式日志支持 [Phase 2]

**用户故事**: 

作为数据工程师，我希望系统能够支持多种日志格式并提供格式转换功能，以便处理来自不同系统的日志数据。

**验收标准**:

1. THE Log_Parser SHALL 支持解析 JSON、XML、CSV、Protobuf、Avro、Syslog、Apache/Nginx 共 7 种日志格式
2. WHEN 导出日志时，THE System SHALL 提供 JSON、CSV、XML、TXT、Parquet 共 5 种目标格式选择
3. THE System SHALL 支持通过正则表达式或 Grok 模式配置自定义解析规则
4. WHEN 接收到未知格式日志时，THE System SHALL 在 1 秒内自动检测格式并应用最匹配的解析规则，准确率 ≥ 90%
5. THE UI SHALL 提供日志格式预览功能，在导入前展示解析结果的前 10 条记录
6. IF 格式解析失败，THEN THE System SHALL 记录原始日志并发送告警，不丢弃数据
7. THE System SHALL 支持批量格式转换，处理速度 ≥ 10,000 条/秒

**实现方向**:

**实现方式**:

```go
// 多格式解析器管理器
type ParserManager struct {
    parsers   map[string]Parser    // 格式解析器映射
    detector  *FormatDetector      // 格式检测器
    grok      *GrokProcessor       // Grok 处理器
    exporters map[string]Exporter  // 格式导出器映射
    config    atomic.Value         // 配置（支持热更新）
}

// 解析器接口
type Parser interface {
    Parse(data []byte) (*LogEntry, error)
    Name() string
    CanParse(data []byte) bool
}

// 导出器接口
type Exporter interface {
    Export(entries []*LogEntry) ([]byte, error)
    Format() string
}

// 支持的格式
const (
    FormatJSON      = "json"
    FormatXML       = "xml"
    FormatCSV       = "csv"
    FormatProtobuf  = "protobuf"
    FormatAvro      = "avro"
    FormatSyslog    = "syslog"
    FormatApache    = "apache"
    FormatNginx     = "nginx"
)

// 解析配置
type ParserConfig struct {
    CustomRules    []CustomRule     // 自定义解析规则
    GrokPatterns   map[string]string // Grok 模式
    AutoDetect     bool             // 是否启用自动检测
    PreviewLines   int              // 预览行数
    BatchSize      int              // 批量处理大小
}

// 自定义规则
type CustomRule struct {
    Name        string         // 规则名称
    Type        string         // 规则类型：regex/grok
    Pattern     string         // 匹配模式
    Fields      []string       // 提取字段
    Enabled     bool           // 是否启用
    Priority    int            // 优先级
}

// 解析日志
func (pm *ParserManager) Parse(data []byte) (*LogEntry, error) {
    config := pm.config.Load().(*ParserConfig)
    
    // 1. 尝试自动检测格式
    format := ""
    if config.AutoDetect {
        detected, confidence := pm.detector.Detect(data)
        if confidence >= 0.9 {
            format = detected
            log.Debug("自动检测格式", "format", format, "confidence", confidence)
        }
    }
    
    // 2. 如果未检测到，尝试所有解析器
    if format == "" {
        for name, parser := range pm.parsers {
            if parser.CanParse(data) {
                format = name
                break
            }
        }
    }
    
    // 3. 使用对应的解析器
    if format != "" {
        parser, ok := pm.parsers[format]
        if ok {
            entry, err := parser.Parse(data)
            if err == nil {
                entry.Format = format
                return entry, nil
            }
            log.Warn("解析失败", "format", format, "error", err)
        }
    }
    
    // 4. 尝试自定义规则
    for _, rule := range config.CustomRules {
        if !rule.Enabled {
            continue
        }
        
        entry, err := pm.parseWithCustomRule(data, rule)
        if err == nil {
            return entry, nil
        }
    }
    
    // 5. 解析失败，保存原始数据
    log.Error("所有解析器均失败，保存原始数据")
    return &LogEntry{
        Message:   string(data),
        Format:    "raw",
        Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
        Fields: map[string]interface{}{
            "_parse_error": "无法识别格式",
        },
    }, nil
}

// JSON 解析器
type JSONParser struct{}

func (p *JSONParser) Parse(data []byte) (*LogEntry, error) {
    var entry LogEntry
    if err := json.Unmarshal(data, &entry); err != nil {
        return nil, fmt.Errorf("JSON 解析失败: %w", err)
    }
    return &entry, nil
}

func (p *JSONParser) CanParse(data []byte) bool {
    // 检查是否以 { 或 [ 开头
    trimmed := bytes.TrimSpace(data)
    return len(trimmed) > 0 && (trimmed[0] == '{' || trimmed[0] == '[')
}

func (p *JSONParser) Name() string {
    return FormatJSON
}

// Syslog 解析器（RFC 3164/5424）
type SyslogParser struct{}

func (p *SyslogParser) Parse(data []byte) (*LogEntry, error) {
    line := string(data)
    
    // RFC 5424 格式：<priority>version timestamp hostname app-name procid msgid structured-data msg
    // 示例：<34>1 2024-01-15T10:30:45.123Z server01 app 1234 - - Connection timeout
    rfc5424Pattern := regexp.MustCompile(`^<(\d+)>(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$`)
    
    if matches := rfc5424Pattern.FindStringSubmatch(line); matches != nil {
        priority, _ := strconv.Atoi(matches[1])
        facility := priority / 8
        severity := priority % 8
        
        return &LogEntry{
            Timestamp: matches[3],
            Host:      matches[4],
            Source:    matches[5],
            Level:     severityToLevel(severity),
            Message:   matches[8],
            Fields: map[string]interface{}{
                "facility": facility,
                "severity": severity,
                "procid":   matches[6],
                "msgid":    matches[7],
            },
        }, nil
    }
    
    // RFC 3164 格式：<priority>timestamp hostname tag: message
    // 示例：<34>Jan 15 10:30:45 server01 app[1234]: Connection timeout
    rfc3164Pattern := regexp.MustCompile(`^<(\d+)>(\w+\s+\d+\s+\d+:\d+:\d+)\s+(\S+)\s+(\S+?):\s+(.*)$`)
    
    if matches := rfc3164Pattern.FindStringSubmatch(line); matches != nil {
        priority, _ := strconv.Atoi(matches[1])
        facility := priority / 8
        severity := priority % 8
        
        return &LogEntry{
            Timestamp: matches[2],
            Host:      matches[3],
            Source:    matches[4],
            Level:     severityToLevel(severity),
            Message:   matches[5],
            Fields: map[string]interface{}{
                "facility": facility,
                "severity": severity,
            },
        }, nil
    }
    
    return nil, fmt.Errorf("不是有效的 Syslog 格式")
}

func (p *SyslogParser) CanParse(data []byte) bool {
    // Syslog 以 <数字> 开头
    return len(data) > 0 && data[0] == '<'
}

func (p *SyslogParser) Name() string {
    return FormatSyslog
}

// Apache/Nginx 日志解析器
type ApacheParser struct{}

func (p *ApacheParser) Parse(data []byte) (*LogEntry, error) {
    line := string(data)
    
    // Apache Combined Log Format:
    // 127.0.0.1 - user [15/Jan/2024:10:30:45 +0000] "GET /api/users HTTP/1.1" 200 1234 "http://example.com" "Mozilla/5.0"
    pattern := regexp.MustCompile(`^(\S+)\s+\S+\s+(\S+)\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)\s+(\S+)"\s+(\d+)\s+(\d+)\s+"([^"]*)"\s+"([^"]*)"`)
    
    matches := pattern.FindStringSubmatch(line)
    if matches == nil {
        return nil, fmt.Errorf("不是有效的 Apache 日志格式")
    }
    
    return &LogEntry{
        Timestamp: matches[3],
        Source:    "apache",
        Level:     statusToLevel(matches[7]),
        Message:   line,
        Fields: map[string]interface{}{
            "remote_addr":  matches[1],
            "remote_user":  matches[2],
            "method":       matches[4],
            "uri":          matches[5],
            "protocol":     matches[6],
            "status":       matches[7],
            "bytes_sent":   matches[8],
            "referer":      matches[9],
            "user_agent":   matches[10],
        },
    }, nil
}

func (p *ApacheParser) CanParse(data []byte) bool {
    // 简单检查是否包含 Apache 日志的特征
    line := string(data)
    return strings.Contains(line, "[") && strings.Contains(line, "]") && 
           strings.Contains(line, "\"") && strings.Contains(line, "HTTP/")
}

func (p *ApacheParser) Name() string {
    return FormatApache
}

// Grok 处理器
type GrokProcessor struct {
    patterns map[string]*grok.Pattern
}

func (gp *GrokProcessor) Parse(data []byte, patternName string) (*LogEntry, error) {
    pattern, ok := gp.patterns[patternName]
    if !ok {
        return nil, fmt.Errorf("未找到 Grok 模式: %s", patternName)
    }
    
    values, err := pattern.Parse(string(data))
    if err != nil {
        return nil, fmt.Errorf("Grok 解析失败: %w", err)
    }
    
    // 转换为 LogEntry
    entry := &LogEntry{
        Fields: make(map[string]interface{}),
    }
    
    for key, value := range values {
        switch key {
        case "timestamp":
            entry.Timestamp = value
        case "level":
            entry.Level = value
        case "message":
            entry.Message = value
        case "source":
            entry.Source = value
        default:
            entry.Fields[key] = value
        }
    }
    
    return entry, nil
}

// 格式检测器
type FormatDetector struct {
    signatures map[string][]byte // 格式签名
}

func (fd *FormatDetector) Detect(data []byte) (string, float64) {
    trimmed := bytes.TrimSpace(data)
    if len(trimmed) == 0 {
        return "", 0.0
    }
    
    // JSON 检测
    if trimmed[0] == '{' || trimmed[0] == '[' {
        var js json.RawMessage
        if json.Unmarshal(trimmed, &js) == nil {
            return FormatJSON, 1.0
        }
    }
    
    // XML 检测
    if trimmed[0] == '<' {
        if bytes.Contains(trimmed, []byte("<?xml")) {
            return FormatXML, 1.0
        }
    }
    
    // Syslog 检测
    if trimmed[0] == '<' && bytes.Contains(trimmed, []byte(">")) {
        return FormatSyslog, 0.9
    }
    
    // CSV 检测
    if bytes.Count(trimmed, []byte(",")) >= 2 {
        return FormatCSV, 0.7
    }
    
    // Apache/Nginx 检测
    if bytes.Contains(trimmed, []byte("[")) && 
       bytes.Contains(trimmed, []byte("]")) && 
       bytes.Contains(trimmed, []byte("HTTP/")) {
        return FormatApache, 0.9
    }
    
    return "", 0.0
}

// JSON 导出器
type JSONExporter struct{}

func (e *JSONExporter) Export(entries []*LogEntry) ([]byte, error) {
    return json.MarshalIndent(entries, "", "  ")
}

func (e *JSONExporter) Format() string {
    return "json"
}

// CSV 导出器
type CSVExporter struct{}

func (e *CSVExporter) Export(entries []*LogEntry) ([]byte, error) {
    var buf bytes.Buffer
    writer := csv.NewWriter(&buf)
    
    // 写入表头
    headers := []string{"timestamp", "level", "source", "host", "message"}
    writer.Write(headers)
    
    // 写入数据
    for _, entry := range entries {
        record := []string{
            entry.Timestamp,
            entry.Level,
            entry.Source,
            entry.Host,
            entry.Message,
        }
        writer.Write(record)
    }
    
    writer.Flush()
    return buf.Bytes(), writer.Error()
}

func (e *CSVExporter) Format() string {
    return "csv"
}

// Parquet 导出器（用于大数据分析）
type ParquetExporter struct{}

func (e *ParquetExporter) Export(entries []*LogEntry) ([]byte, error) {
    // 使用 parquet-go 库导出
    var buf bytes.Buffer
    
    // 创建 Parquet writer
    writer, err := parquet.NewWriter(&buf, new(LogEntry))
    if err != nil {
        return nil, fmt.Errorf("创建 Parquet writer 失败: %w", err)
    }
    
    // 写入数据
    for _, entry := range entries {
        if err := writer.Write(entry); err != nil {
            return nil, fmt.Errorf("写入数据失败: %w", err)
        }
    }
    
    // 关闭 writer
    if err := writer.Close(); err != nil {
        return nil, fmt.Errorf("关闭 writer 失败: %w", err)
    }
    
    return buf.Bytes(), nil
}

func (e *ParquetExporter) Format() string {
    return "parquet"
}

// 批量格式转换
func (pm *ParserManager) BatchConvert(data [][]byte, targetFormat string) ([]byte, error) {
    config := pm.config.Load().(*ParserConfig)
    
    // 1. 解析所有日志
    entries := make([]*LogEntry, 0, len(data))
    
    // 使用 goroutine 池并行解析
    type parseResult struct {
        index int
        entry *LogEntry
        err   error
    }
    
    resultChan := make(chan parseResult, len(data))
    semaphore := make(chan struct{}, 10) // 限制并发数
    
    for i, line := range data {
        semaphore <- struct{}{}
        go func(idx int, d []byte) {
            defer func() { <-semaphore }()
            
            entry, err := pm.Parse(d)
            resultChan <- parseResult{index: idx, entry: entry, err: err}
        }(i, line)
    }
    
    // 收集结果
    results := make([]parseResult, len(data))
    for i := 0; i < len(data); i++ {
        result := <-resultChan
        results[result.index] = result
    }
    
    // 按顺序添加成功解析的条目
    for _, result := range results {
        if result.err == nil && result.entry != nil {
            entries = append(entries, result.entry)
        } else {
            log.Warn("解析失败", "index", result.index, "error", result.err)
        }
    }
    
    // 2. 导出为目标格式
    exporter, ok := pm.exporters[targetFormat]
    if !ok {
        return nil, fmt.Errorf("不支持的导出格式: %s", targetFormat)
    }
    
    return exporter.Export(entries)
}

// 辅助函数：Syslog severity 转日志级别
func severityToLevel(severity int) string {
    levels := []string{"EMERGENCY", "ALERT", "CRITICAL", "ERROR", "WARNING", "NOTICE", "INFO", "DEBUG"}
    if severity >= 0 && severity < len(levels) {
        return levels[severity]
    }
    return "UNKNOWN"
}

// 辅助函数：HTTP 状态码转日志级别
func statusToLevel(status string) string {
    code, _ := strconv.Atoi(status)
    switch {
    case code >= 500:
        return "ERROR"
    case code >= 400:
        return "WARN"
    case code >= 300:
        return "INFO"
    default:
        return "DEBUG"
    }
}
```

**关键实现点**:

1. 实现插件化解析器架构，每种格式独立解析器，易于扩展新格式
2. 使用格式检测器自动识别日志格式，基于特征签名和置信度评分
3. 支持 Grok 模式，兼容 Logstash 的 Grok 语法，方便迁移
4. 实现批量并行转换，使用 goroutine 池控制并发，处理速度 > 10,000 条/秒
5. 解析失败时保留原始数据，不丢失任何日志信息

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| custom_rules | array | [] | 自定义解析规则列表 |
| grok_patterns | object | {} | Grok 模式定义 |
| auto_detect_enabled | bool | true | 是否启用自动格式检测 |
| preview_lines | int | 10 | 预览行数 |
| batch_size | int | 1000 | 批量处理大小 |
| supported_input_formats | array | ["json","xml","csv","protobuf","avro","syslog","apache","nginx"] | 支持的输入格式 |
| supported_output_formats | array | ["json","csv","xml","txt","parquet"] | 支持的输出格式 |
| parse_timeout_ms | int | 1000 | 解析超时时间（毫秒） |
| max_line_length | int | 1048576 | 最大行长度（字节，1MB） |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一条日志解析）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值和解析统计
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN 自定义规则变更时，THE System SHALL 验证正则表达式和 Grok 模式的有效性
6. THE System SHALL 支持自定义规则的优先级排序，高优先级规则优先匹配

---

# 模块一 API 接口汇总

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-1-01 | 获取数据源列表 | Collector | GET | /api/v1/collector/sources | collector.read | Query: tenant_id, page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | - | 支持分页 |
| API-1-02 | 添加数据源 | Collector | POST | /api/v1/collector/sources | collector.write | Body: source_config | {code:0,data:{id:"src-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-1-03 | 更新数据源配置 | Collector | PUT | /api/v1/collector/sources/{id} | collector.write | Body: source_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-1-04 | 删除数据源 | Collector | DELETE | /api/v1/collector/sources/{id} | collector.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-1-05 | 启用数据源 | Collector | POST | /api/v1/collector/sources/{id}/enable | collector.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-1-06 | 禁用数据源 | Collector | POST | /api/v1/collector/sources/{id}/disable | collector.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-1-07 | 获取优先级规则 | Collector | GET | /api/v1/collector/priority/rules | collector.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-1-08 | 添加优先级规则 | Collector | POST | /api/v1/collector/priority/rules | collector.write | Body: rule_config | {code:0,data:{id:"rule-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-1-09 | 更新优先级规则 | Collector | PUT | /api/v1/collector/priority/rules/{id} | collector.write | Body: rule_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-1-10 | 删除优先级规则 | Collector | DELETE | /api/v1/collector/priority/rules/{id} | collector.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-1-11 | 获取优先级统计 | Collector | GET | /api/v1/collector/priority/stats | collector.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-1-12 | 获取处理规则 | Collector | GET | /api/v1/collector/processor/rules | collector.read | Query: type | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-1-13 | 添加处理规则 | Collector | POST | /api/v1/collector/processor/rules | collector.write | Body: rule_config | {code:0,data:{id:"rule-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-1-14 | 获取脱敏规则 | Collector | GET | /api/v1/collector/processor/masking | collector.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-1-15 | 更新脱敏规则 | Collector | PUT | /api/v1/collector/processor/masking | collector.write | Body: masking_config | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-1-16 | 获取流配置 | Collector | GET | /api/v1/collector/stream/config | collector.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-1-17 | 更新流配置 | Collector | PUT | /api/v1/collector/stream/config | collector.write | Body: stream_config | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-1-18 | 获取流目标列表 | Collector | GET | /api/v1/collector/stream/targets | collector.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-1-19 | 更新流目标配置 | Collector | PUT | /api/v1/collector/stream/targets/{name} | collector.write | Body: target_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-1-20 | 触发日志回放 | Collector | POST | /api/v1/collector/stream/replay | collector.write | Body: {start_time,end_time,filter} | {code:0,data:{task_id:"task-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-1-21 | 获取流指标 | Collector | GET | /api/v1/collector/stream/metrics | collector.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-1-22 | 获取支持的格式列表 | Collector | GET | /api/v1/collector/parser/formats | collector.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-1-23 | 检测日志格式 | Collector | POST | /api/v1/collector/parser/detect | collector.read | Body: log_sample | {code:0,data:{format:"json"}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-1-24 | 预览解析结果 | Collector | POST | /api/v1/collector/parser/preview | collector.read | Body: {log_sample,format} | {code:0,data:{...}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-1-25 | 获取自定义解析规则 | Collector | GET | /api/v1/collector/parser/rules | collector.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-1-26 | 添加自定义解析规则 | Collector | POST | /api/v1/collector/parser/rules | collector.write | Body: rule_config | {code:0,data:{id:"rule-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-1-27 | 批量格式转换 | Collector | POST | /api/v1/collector/parser/convert | collector.write | Body: {logs,target_format} | Binary | 200/400/401/403/500 | v1 | 是 | 否 | - | 返回二进制数据 |
| API-1-28 | 触发配置热更新 | Collector | POST | /api/v1/collector/config/reload | collector.admin | Body: {component} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | 仅管理员 |
| API-1-29 | 获取当前配置版本 | Collector | GET | /api/v1/collector/config/version | collector.read | Query: component | {code:0,data:{version:"v1.0"}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-1-30 | 健康检查 | Collector | GET | /api/v1/collector/health | 无 | 无 | {code:0,data:{status:"healthy"}} | 200/500 | v1 | 是 | 否 | - | 公开接口 |
| API-1-31 | 获取采集指标 | Collector | GET | /api/v1/collector/metrics | collector.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |

---




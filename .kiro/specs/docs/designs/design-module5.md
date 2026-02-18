# 模块五：分布式追踪与诊断 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-01-31  
> **状态**: 已发布  
> **相关需求**: [requirements-module5.md](../requirements/requirements-module5.md)

---

## 1. 文档信息

### 1.1 版本历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-01-31 | 系统架构团队 | 初稿，完整设计方案 |

### 1.2 相关文档

- [需求文档](../requirements/requirements-module5.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)
- [模块2设计](./design-module2.md)

---

## 2. 总体架构

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                  分布式追踪与诊断模块架构                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  Trace采集层 (OpenTelemetry)                         │      │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │      │
│  │  │ SDK埋点     │  │ 自动注入    │  │ 协议转换    │     │      │
│  │  │ (手动)     │  │ (Agent)    │  │ (Zipkin)   │     │      │
│  │  └────────────┘  └────────────┘  └────────────┘     │      │
│  └──────────────────────────────────────────────────────┘      │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  Trace处理层 (Collector)                             │      │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │      │
│  │  │ 数据接收    │  │ 采样策略    │  │ 数据转换    │     │      │
│  │  │ (gRPC)     │  │ (智能采样)  │  │ (标准化)   │     │      │
│  │  └────────────┘  └────────────┘  └────────────┘     │      │
│  └──────────────────────────────────────────────────────┘      │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  Trace存储层 (Jaeger + ES)                           │      │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │      │
│  │  │ Span存储    │  │ 索引管理    │  │ 数据压缩    │     │      │
│  │  │ (ES)       │  │ (ILM)      │  │ (Zstd)     │     │      │
│  │  └────────────┘  └────────────┘  └────────────┘     │      │
│  └──────────────────────────────────────────────────────┘      │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  Trace分析层                                          │      │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │      │
│  │  │ 链路分析    │  │ 性能诊断    │  │ 依赖分析    │     │      │
│  │  │ (关联)     │  │ (瓶颈)     │  │ (拓扑)     │     │      │
│  │  └────────────┘  └────────────┘  └────────────┘     │      │
│  └──────────────────────────────────────────────────────┘      │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  可视化层 (Jaeger UI)                                 │      │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │      │
│  │  │ 链路图      │  │ 火焰图      │  │ 依赖图      │     │      │
│  │  │ (Timeline) │  │ (Flamegraph)│  │ (DAG)      │     │      │
│  │  └────────────┘  └────────────┘  └────────────┘     │      │
│  └──────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分

| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| Trace采集 | 数据采集 | SDK埋点、自动注入、协议转换 |
| Trace处理 | 数据处理 | 接收、采样、转换、路由 |
| Trace存储 | 数据存储 | Span存储、索引、压缩 |
| Trace分析 | 数据分析 | 链路关联、性能诊断、依赖分析 |
| Trace可视化 | 数据展示 | 链路图、火焰图、依赖图 |

### 2.3 关键路径

```
应用埋点 → SDK采集(1ms) → Collector接收(10ms) → 采样决策(5ms)
  → ES存储(50ms) → 查询分析(200ms) → UI展示
```

---

## 3. 技术选型

### 3.1 核心技术栈

| 技术 | 版本 | 选择理由 |
|------|------|----------|
| OpenTelemetry | 1.21+ | 统一标准、社区活跃 |
| Jaeger | 1.50+ | 成熟稳定、功能完善 |
| Elasticsearch | 8.11+ | 存储后端、查询性能好 |
| Kafka | 3.6+ | 数据缓冲、解耦 |
| Go | 1.21+ | Collector实现语言 |

### 3.2 追踪系统对比

| 系统 | 采样 | 存储 | 查询 | UI | 选择 |
|------|------|------|------|-----|------|
| Jaeger | 支持 | 多种 | 快 | 好 | ✅ |
| Zipkin | 支持 | 多种 | 中 | 一般 | ❌ |
| SkyWalking | 支持 | 自带 | 快 | 好 | ❌ |

---

## 4. 关键流程设计

### 4.1 Trace采集流程

```
1. 应用启动时初始化OpenTelemetry SDK
2. 配置Tracer Provider:
   - Service Name
   - Exporter (gRPC/HTTP)
   - Sampler (采样策略)
3. 业务代码埋点:
   - 创建Span
   - 添加Attributes
   - 记录Events
   - 设置Status
4. Span自动导出到Collector
5. Collector接收并处理
```

### 4.2 智能采样流程

```
1. 接收Trace数据
2. 判断采样策略:
   - 头部采样: 在请求入口决定
   - 尾部采样: 在请求结束后决定
3. 头部采样规则:
   - 固定比例: 10%
   - 错误必采: status=error
   - 慢请求必采: duration>1s
4. 尾部采样规则:
   - 完整Trace分析
   - 异常Trace保留
   - 正常Trace按比例采样
5. 采样决策
6. 保留或丢弃Trace
```

### 4.3 链路关联流程

```
1. 接收查询请求(Trace ID)
2. 从ES查询所有Span
3. 构建Span树:
   - 根据Parent Span ID关联
   - 构建父子关系
4. 计算时间线:
   - 每个Span的开始结束时间
   - 计算总耗时
5. 识别关键路径:
   - 找出最长路径
   - 标记瓶颈Span
6. 返回链路数据
```

### 4.4 性能诊断流程

```
1. 分析Trace数据
2. 识别性能问题:
   - 慢Span: duration > threshold
   - 错误Span: status = error
   - 重试Span: retry count > 0
3. 计算性能指标:
   - P50/P95/P99延迟
   - 错误率
   - QPS
4. 生成诊断报告:
   - 瓶颈服务
   - 慢接口
   - 优化建议
5. 返回诊断结果
```

---

## 5. 接口设计

### 5.1 API列表

详见 [API设计文档](./api-design.md) 模块5部分

### 5.2 OpenTelemetry SDK示例

```go
// 初始化Tracer
func initTracer() (*sdktrace.TracerProvider, error) {
    // 创建Exporter
    exporter, err := otlptracegrpc.New(
        context.Background(),
        otlptracegrpc.WithEndpoint("collector:4317"),
        otlptracegrpc.WithInsecure(),
    )
    if err != nil {
        return nil, err
    }
    
    // 创建Resource
    resource := resource.NewWithAttributes(
        semconv.SchemaURL,
        semconv.ServiceNameKey.String("my-service"),
        semconv.ServiceVersionKey.String("v1.0.0"),
    )
    
    // 创建TracerProvider
    tp := sdktrace.NewTracerProvider(
        sdktrace.WithBatcher(exporter),
        sdktrace.WithResource(resource),
        sdktrace.WithSampler(sdktrace.ParentBased(
            sdktrace.TraceIDRatioBased(0.1), // 10%采样
        )),
    )
    
    otel.SetTracerProvider(tp)
    return tp, nil
}

// 业务代码埋点
func handleRequest(ctx context.Context, req *Request) error {
    tracer := otel.Tracer("my-service")
    
    // 创建Span
    ctx, span := tracer.Start(ctx, "handleRequest")
    defer span.End()
    
    // 添加属性
    span.SetAttributes(
        attribute.String("user.id", req.UserID),
        attribute.String("request.id", req.ID),
    )
    
    // 调用下游服务
    err := callDownstream(ctx, req)
    if err != nil {
        // 记录错误
        span.RecordError(err)
        span.SetStatus(codes.Error, err.Error())
        return err
    }
    
    // 记录事件
    span.AddEvent("request.processed")
    span.SetStatus(codes.Ok, "success")
    
    return nil
}
```

---

## 6. 数据设计

### 6.1 Span数据模型

```go
type Span struct {
    TraceID      string                 // Trace ID
    SpanID       string                 // Span ID
    ParentSpanID string                 // 父Span ID
    OperationName string                // 操作名称
    StartTime    time.Time              // 开始时间
    Duration     time.Duration          // 持续时间
    Tags         map[string]interface{} // 标签
    Logs         []Log                  // 日志事件
    References   []Reference            // 引用关系
    Process      Process                // 进程信息
}

type Log struct {
    Timestamp time.Time              // 时间戳
    Fields    map[string]interface{} // 字段
}

type Reference struct {
    Type    string // CHILD_OF / FOLLOWS_FROM
    TraceID string
    SpanID  string
}

type Process struct {
    ServiceName string                 // 服务名
    Tags        map[string]interface{} // 标签
}
```

### 6.2 ES索引设计

**Span索引模板**:

```json
{
  "index_patterns": ["jaeger-span-*"],
  "settings": {
    "number_of_shards": 5,
    "number_of_replicas": 1,
    "codec": "best_compression"
  },
  "mappings": {
    "properties": {
      "traceID": {"type": "keyword"},
      "spanID": {"type": "keyword"},
      "parentSpanID": {"type": "keyword"},
      "operationName": {"type": "keyword"},
      "startTime": {"type": "date"},
      "duration": {"type": "long"},
      "tags": {"type": "nested"},
      "process": {
        "properties": {
          "serviceName": {"type": "keyword"}
        }
      }
    }
  }
}
```

### 6.3 缓存设计

```
# Trace缓存(热点Trace)
trace:cache:{trace_id} -> Trace数据 (TTL: 1h)

# 服务依赖缓存
trace:dependency:{service} -> 依赖列表 (TTL: 10min)

# 性能指标缓存
trace:metrics:{service}:{operation} -> 指标数据 (TTL: 5min)
```

---

## 7. 安全设计

### 7.1 数据安全

- Trace数据脱敏(敏感字段)
- 传输加密(TLS)
- 存储加密(ES加密)
- 访问控制(RBAC)

### 7.2 采样安全

- 敏感Trace强制采样
- 错误Trace必须保留
- 采样率动态调整
- 采样审计日志

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| SDK开销 | <1ms | 性能测试 |
| Collector延迟 | <10ms | 端到端监控 |
| 存储延迟 | <50ms | ES metrics |
| 查询延迟 | <200ms | Jaeger UI |
| 吞吐量 | 10万Span/秒 | 压测统计 |

### 8.2 优化策略

**采集优化**:
- 异步导出(不阻塞业务)
- 批量发送(减少网络开销)
- 本地缓冲(网络故障保护)
- 采样优化(减少数据量)

**存储优化**:
- 批量写入ES
- 数据压缩(Zstd)
- 索引优化(分片策略)
- 生命周期管理(ILM)

**查询优化**:
- 查询缓存(Redis)
- 索引预热
- 分页查询
- 并行查询

---

## 9. 部署方案

### 9.1 部署架构

```yaml
# Jaeger Collector
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jaeger-collector
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: jaeger-collector
        image: jaegertracing/jaeger-collector:1.50
        ports:
        - containerPort: 14250  # gRPC
        - containerPort: 14268  # HTTP
        env:
        - name: SPAN_STORAGE_TYPE
          value: elasticsearch
        - name: ES_SERVER_URLS
          value: http://elasticsearch:9200
        resources:
          requests:
            cpu: 1
            memory: 2Gi
          limits:
            cpu: 2
            memory: 4Gi
```

### 9.2 资源配置

| 组件 | 副本数 | CPU | 内存 | 存储 |
|------|--------|-----|------|------|
| Jaeger Collector | 3 | 1核 | 2GB | - |
| Jaeger Query | 2 | 1核 | 2GB | - |
| Jaeger Agent | DaemonSet | 0.5核 | 512MB | - |
| Elasticsearch | 3 | 8核 | 32GB | 1TB |

---

## 10. 监控与运维

### 10.1 监控指标

```
# Collector指标
jaeger_collector_spans_received_total
jaeger_collector_spans_saved_total
jaeger_collector_spans_dropped_total
jaeger_collector_queue_length

# Query指标
jaeger_query_requests_total
jaeger_query_latency_seconds
jaeger_query_errors_total

# 存储指标
jaeger_storage_latency_seconds
jaeger_storage_errors_total
```

### 10.2 告警规则

| 告警 | 条件 | 级别 | 处理 |
|------|------|------|------|
| Span丢失率高 | >1% | Critical | 检查Collector |
| 查询延迟高 | P95>1s | Warning | 优化查询 |
| 存储失败 | >5% | Critical | 检查ES |
| 队列积压 | >10000 | Warning | 增加Collector |

---

## 11. 配置热更新详细设计

### 11.1 配置分层说明

模块5的配置分为三个层次，热更新支持情况如下：

**基础设施层（❌ 不支持热更新）**:
- Jaeger Collector部署配置（副本数、资源限制）
- Elasticsearch存储配置（集群地址、索引配置）
- Kafka缓冲配置（broker地址、topic）
- 原因：需要重启服务，影响正在采集的追踪数据

**连接层（⚠️ 不推荐热更新）**:
- Elasticsearch连接配置（地址、认证）
- Kafka连接配置（broker、topic）
- Redis连接配置（地址、密码）
- 原因：需要重建连接池，可能导致追踪数据丢失

**应用层（✅ 推荐热更新）**:
- 采样率配置
- 慢请求阈值配置
- 队列大小配置
- 批量大小配置
- 导出超时配置
- 查询缓存配置
- 原因：不影响底层连接，可以平滑切换

### 11.2 可热更新配置项

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|---------|----------|---------------|
| sampling_rate | float | 0.1 | 采样率(0-1) | Redis Pub/Sub | 下次采样决策 | ✅ 推荐 |
| slow_threshold_ms | int | 1000 | 慢请求阈值(毫秒) | Redis Pub/Sub | 立即生效 | ✅ 推荐 |
| error_sampling_enabled | bool | true | 错误必采样 | Redis Pub/Sub | 立即生效 | ✅ 推荐 |
| max_queue_size | int | 10000 | 最大队列大小 | Redis Pub/Sub | 新队列生效 | ✅ 推荐 |
| batch_size | int | 100 | 批量大小 | Redis Pub/Sub | 下次批量 | ✅ 推荐 |
| export_timeout_ms | int | 30000 | 导出超时(毫秒) | Redis Pub/Sub | 下次导出 | ✅ 推荐 |
| query_cache_ttl | int | 300 | 查询缓存TTL(秒) | Redis Pub/Sub | 下次缓存写入 | ✅ 推荐 |
| max_trace_duration_hours | int | 24 | 最大追踪时长(小时) | Redis Pub/Sub | 下次查询 | ✅ 推荐 |
| span_attributes_limit | int | 100 | Span属性数量限制 | Redis Pub/Sub | 下次采集 | ✅ 推荐 |
| jaeger_collector_url | string | "" | Jaeger Collector地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重建gRPC连接) |
| elasticsearch_addresses | array | [] | ES集群地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重建客户端) |
| kafka_brokers | array | [] | Kafka broker地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重建生产者) |

### 11.3 不可热更新配置项（需要重启）

**Kubernetes部署配置** (❌ 不支持热更新):

```yaml
# deploy/kubernetes/jaeger-collector-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jaeger-collector
spec:
  replicas: 3  # ❌ 不支持热更新，需要重启
  template:
    spec:
      containers:
      - name: jaeger-collector
        resources:
          requests:
            cpu: 1      # ❌ 不支持热更新，需要重启
            memory: 2Gi # ❌ 不支持热更新，需要重启
        env:
        - name: SPAN_STORAGE_TYPE
          value: elasticsearch  # ❌ 不支持热更新，需要重启
```

**原因**: 这些是Kubernetes资源配置，修改后需要重新部署Pod。

**连接配置** (⚠️ 不推荐热更新):

```yaml
# configs/jaeger-collector.yaml
elasticsearch:
  server_urls: ["http://es:9200"]  # ⚠️ 不推荐热更新，需要重建客户端
  username: "elastic"              # ⚠️ 不推荐热更新，需要重建客户端
  password: "secret"               # ⚠️ 不推荐热更新，需要重建客户端
  index_prefix: "jaeger-"          # ⚠️ 不推荐热更新，影响索引写入

kafka:
  brokers: ["kafka:9092"]          # ⚠️ 不推荐热更新，需要重建连接
  topic: "jaeger-spans"            # ⚠️ 不推荐热更新，需要重建生产者
```

**原因**: 修改连接配置需要重建连接池和客户端，可能导致追踪数据丢失。建议通过滚动重启更新。

### 11.4 热更新实现

**配置管理器**:

```go
// internal/trace/config/manager.go
package config

import (
    "context"
    "encoding/json"
    "sync/atomic"
    "time"
)

// 追踪配置管理器
type TraceConfigManager struct {
    // 使用atomic.Value实现无锁读取
    samplingConfig  atomic.Value  // *SamplingConfig
    collectorConfig atomic.Value  // *CollectorConfig
    queryConfig     atomic.Value  // *QueryConfig
    
    db     *PostgreSQL
    redis  *Redis
    pubsub *redis.PubSub
}

// 采样配置
type SamplingConfig struct {
    SamplingRate           float64 `json:"sampling_rate"`
    SlowThresholdMs        int     `json:"slow_threshold_ms"`
    ErrorSamplingEnabled   bool    `json:"error_sampling_enabled"`
    SpanAttributesLimit    int     `json:"span_attributes_limit"`
    UpdatedAt              time.Time `json:"updated_at"`
}

// Collector配置
type CollectorConfig struct {
    MaxQueueSize      int `json:"max_queue_size"`
    BatchSize         int `json:"batch_size"`
    ExportTimeoutMs   int `json:"export_timeout_ms"`
    UpdatedAt         time.Time `json:"updated_at"`
}

// 查询配置
type QueryConfig struct {
    CacheTTL                int `json:"cache_ttl"`
    MaxTraceDurationHours   int `json:"max_trace_duration_hours"`
    MaxSpansPerTrace        int `json:"max_spans_per_trace"`
    UpdatedAt               time.Time `json:"updated_at"`
}

// 创建配置管理器
func NewTraceConfigManager(db *PostgreSQL, redis *Redis) (*TraceConfigManager, error) {
    tcm := &TraceConfigManager{
        db:    db,
        redis: redis,
    }
    
    // 从数据库加载初始配置
    if err := tcm.loadInitialConfig(); err != nil {
        return nil, err
    }
    
    // 订阅配置变更通知
    tcm.pubsub = redis.Subscribe("config:trace:reload")
    
    return tcm, nil
}

// 启动配置热更新监听
func (tcm *TraceConfigManager) Start(ctx context.Context) error {
    go tcm.watchConfigChanges(ctx)
    log.Info("追踪配置热更新监听已启动")
    return nil
}

// 监听配置变更
func (tcm *TraceConfigManager) watchConfigChanges(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():
            return
        case msg := <-tcm.pubsub.Channel():
            tcm.handleConfigChange(msg)
        }
    }
}

// 处理配置变更
func (tcm *TraceConfigManager) handleConfigChange(msg *redis.Message) {
    log.Infof("收到追踪配置变更通知: %s", msg.Payload)
    
    // 解析变更类型
    var change ConfigChange
    if err := json.Unmarshal([]byte(msg.Payload), &change); err != nil {
        log.Errorf("解析配置变更失败: %v", err)
        return
    }
    
    // 根据配置类型重新加载
    switch change.Type {
    case "sampling":
        tcm.reloadSamplingConfig()
    case "collector":
        tcm.reloadCollectorConfig()
    case "query":
        tcm.reloadQueryConfig()
    case "all":
        tcm.reloadAllConfig()
    }
}

// 重新加载采样配置
func (tcm *TraceConfigManager) reloadSamplingConfig() {
    log.Info("开始重新加载采样配置")
    
    // 1. 从Redis加载配置
    configJSON, err := tcm.redis.Get("config:trace:sampling")
    if err != nil {
        log.Errorf("从Redis加载采样配置失败: %v", err)
        return
    }
    
    // 2. 解析配置
    var newConfig SamplingConfig
    if err := json.Unmarshal([]byte(configJSON), &newConfig); err != nil {
        log.Errorf("解析采样配置失败: %v", err)
        return
    }
    
    // 3. 验证配置
    if err := tcm.validateSamplingConfig(&newConfig); err != nil {
        log.Errorf("采样配置验证失败: %v", err)
        return
    }
    
    // 4. 原子更新配置
    tcm.samplingConfig.Store(&newConfig)
    
    // 5. 记录审计日志
    tcm.logConfigChange("sampling", &newConfig)
    
    log.Info("采样配置重新加载完成")
}

// 重新加载Collector配置
func (tcm *TraceConfigManager) reloadCollectorConfig() {
    log.Info("开始重新加载Collector配置")
    
    // 1. 从Redis加载配置
    configJSON, err := tcm.redis.Get("config:trace:collector")
    if err != nil {
        log.Errorf("从Redis加载Collector配置失败: %v", err)
        return
    }
    
    // 2. 解析配置
    var newConfig CollectorConfig
    if err := json.Unmarshal([]byte(configJSON), &newConfig); err != nil {
        log.Errorf("解析Collector配置失败: %v", err)
        return
    }
    
    // 3. 验证配置
    if err := tcm.validateCollectorConfig(&newConfig); err != nil {
        log.Errorf("Collector配置验证失败: %v", err)
        return
    }
    
    // 4. 原子更新配置
    tcm.collectorConfig.Store(&newConfig)
    
    // 5. 记录审计日志
    tcm.logConfigChange("collector", &newConfig)
    
    log.Info("Collector配置重新加载完成")
}

// 重新加载查询配置
func (tcm *TraceConfigManager) reloadQueryConfig() {
    log.Info("开始重新加载查询配置")
    
    // 1. 从Redis加载配置
    configJSON, err := tcm.redis.Get("config:trace:query")
    if err != nil {
        log.Errorf("从Redis加载查询配置失败: %v", err)
        return
    }
    
    // 2. 解析配置
    var newConfig QueryConfig
    if err := json.Unmarshal([]byte(configJSON), &newConfig); err != nil {
        log.Errorf("解析查询配置失败: %v", err)
        return
    }
    
    // 3. 验证配置
    if err := tcm.validateQueryConfig(&newConfig); err != nil {
        log.Errorf("查询配置验证失败: %v", err)
        return
    }
    
    // 4. 原子更新配置
    tcm.queryConfig.Store(&newConfig)
    
    // 5. 记录审计日志
    tcm.logConfigChange("query", &newConfig)
    
    log.Info("查询配置重新加载完成")
}

// 验证采样配置
func (tcm *TraceConfigManager) validateSamplingConfig(config *SamplingConfig) error {
    if config.SamplingRate < 0 || config.SamplingRate > 1 {
        return fmt.Errorf("采样率必须在0-1之间")
    }
    
    if config.SlowThresholdMs < 0 || config.SlowThresholdMs > 60000 {
        return fmt.Errorf("慢请求阈值必须在0-60000毫秒之间")
    }
    
    if config.SpanAttributesLimit < 1 || config.SpanAttributesLimit > 1000 {
        return fmt.Errorf("Span属性限制必须在1-1000之间")
    }
    
    return nil
}

// 验证Collector配置
func (tcm *TraceConfigManager) validateCollectorConfig(config *CollectorConfig) error {
    if config.MaxQueueSize < 100 || config.MaxQueueSize > 100000 {
        return fmt.Errorf("最大队列大小必须在100-100000之间")
    }
    
    if config.BatchSize < 1 || config.BatchSize > 10000 {
        return fmt.Errorf("批量大小必须在1-10000之间")
    }
    
    if config.ExportTimeoutMs < 1000 || config.ExportTimeoutMs > 300000 {
        return fmt.Errorf("导出超时必须在1000-300000毫秒之间")
    }
    
    return nil
}

// 验证查询配置
func (tcm *TraceConfigManager) validateQueryConfig(config *QueryConfig) error {
    if config.CacheTTL < 0 || config.CacheTTL > 3600 {
        return fmt.Errorf("缓存TTL必须在0-3600秒之间")
    }
    
    if config.MaxTraceDurationHours < 1 || config.MaxTraceDurationHours > 168 {
        return fmt.Errorf("最大追踪时长必须在1-168小时之间")
    }
    
    if config.MaxSpansPerTrace < 100 || config.MaxSpansPerTrace > 100000 {
        return fmt.Errorf("每个Trace最大Span数必须在100-100000之间")
    }
    
    return nil
}

// 获取采样配置（无锁读取）
func (tcm *TraceConfigManager) GetSamplingConfig() *SamplingConfig {
    config := tcm.samplingConfig.Load()
    if config == nil {
        return &SamplingConfig{}
    }
    return config.(*SamplingConfig)
}

// 获取Collector配置（无锁读取）
func (tcm *TraceConfigManager) GetCollectorConfig() *CollectorConfig {
    config := tcm.collectorConfig.Load()
    if config == nil {
        return &CollectorConfig{}
    }
    return config.(*CollectorConfig)
}

// 获取查询配置（无锁读取）
func (tcm *TraceConfigManager) GetQueryConfig() *QueryConfig {
    config := tcm.queryConfig.Load()
    if config == nil {
        return &QueryConfig{}
    }
    return config.(*QueryConfig)
}

// 记录配置变更审计日志
func (tcm *TraceConfigManager) logConfigChange(configType string, config interface{}) {
    auditLog := AuditLog{
        EventType:    "config_change",
        ResourceType: "trace_" + configType,
        Action:       "update",
        Timestamp:    time.Now(),
        Details:      config,
    }
    
    // 保存到数据库
    if err := tcm.db.SaveAuditLog(&auditLog); err != nil {
        log.Errorf("保存审计日志失败: %v", err)
    }
}

// 从数据库加载初始配置
func (tcm *TraceConfigManager) loadInitialConfig() error {
    // 加载采样配置
    samplingConfig, err := tcm.db.GetSamplingConfig()
    if err != nil {
        return fmt.Errorf("加载采样配置失败: %w", err)
    }
    tcm.samplingConfig.Store(samplingConfig)
    
    // 加载Collector配置
    collectorConfig, err := tcm.db.GetCollectorConfig()
    if err != nil {
        return fmt.Errorf("加载Collector配置失败: %w", err)
    }
    tcm.collectorConfig.Store(collectorConfig)
    
    // 加载查询配置
    queryConfig, err := tcm.db.GetQueryConfig()
    if err != nil {
        return fmt.Errorf("加载查询配置失败: %w", err)
    }
    tcm.queryConfig.Store(queryConfig)
    
    log.Info("初始配置加载完成")
    return nil
}

// 重新加载所有配置
func (tcm *TraceConfigManager) reloadAllConfig() {
    log.Info("开始重新加载所有配置")
    
    tcm.reloadSamplingConfig()
    tcm.reloadCollectorConfig()
    tcm.reloadQueryConfig()
    
    log.Info("所有配置重新加载完成")
}
```

### 11.5 配置更新API

**更新采样配置**:

```http
PUT /api/v1/trace/sampling-config
Content-Type: application/json
Authorization: Bearer <token>

{
  "sampling_rate": 0.2,
  "slow_threshold_ms": 1500,
  "error_sampling_enabled": true,
  "span_attributes_limit": 150
}

Response:
{
  "code": 0,
  "message": "采样配置已更新并生效"
}
```

**更新Collector配置**:

```http
PUT /api/v1/trace/collector-config
Content-Type: application/json
Authorization: Bearer <token>

{
  "max_queue_size": 15000,
  "batch_size": 200,
  "export_timeout_ms": 45000
}

Response:
{
  "code": 0,
  "message": "Collector配置已更新并生效"
}
```

**更新查询配置**:

```http
PUT /api/v1/trace/query-config
Content-Type: application/json
Authorization: Bearer <token>

{
  "cache_ttl": 600,
  "max_trace_duration_hours": 48,
  "max_spans_per_trace": 50000
}

Response:
{
  "code": 0,
  "message": "查询配置已更新并生效"
}
```

### 11.6 YAML配置备用方案

当热更新机制不可用时，可以通过修改YAML配置文件并重启服务来更新配置：

```yaml
# configs/trace_config.yaml
# ✅ 支持热更新，也可以通过YAML文件更新
sampling:
  sampling_rate: 0.1
  slow_threshold_ms: 1000
  error_sampling_enabled: true
  span_attributes_limit: 100

# ✅ 支持热更新，也可以通过YAML文件更新
collector:
  max_queue_size: 10000
  batch_size: 100
  export_timeout_ms: 30000

# ✅ 支持热更新，也可以通过YAML文件更新
query:
  cache_ttl: 300
  max_trace_duration_hours: 24
  max_spans_per_trace: 10000
```

**更新流程**:
1. 修改YAML配置文件
2. 通过ConfigMap更新Kubernetes配置
3. 滚动重启服务
4. 新配置生效

```bash
# 更新ConfigMap
kubectl create configmap trace-config \
  --from-file=configs/trace_config.yaml \
  --dry-run=client -o yaml | kubectl apply -f -

# 滚动重启服务
kubectl rollout restart deployment/jaeger-collector -n log-management
```

### 11.7 扩展接口设计

为了支持未来的配置扩展，预留以下接口：

```go
// 配置变更钩子接口
type ConfigHook interface {
    // 配置变更前调用
    OnBeforeConfigChange(configType string, oldConfig, newConfig interface{}) error
    
    // 配置变更后调用
    OnAfterConfigChange(configType string, config interface{}) error
}

// 注册配置钩子
func (tcm *TraceConfigManager) RegisterHook(hook ConfigHook) {
    tcm.hooks = append(tcm.hooks, hook)
}

// 采样策略接口
type SamplingStrategy interface {
    // 判断是否采样
    ShouldSample(span *Span) bool
}

// 注册采样策略
func (tcm *TraceConfigManager) RegisterSamplingStrategy(name string, strategy SamplingStrategy) {
    tcm.samplingStrategies[name] = strategy
}
```

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 性能影响 | 中 | 中 | 采样、异步 |
| 数据丢失 | 低 | 高 | 本地缓冲、重试 |
| 存储压力 | 中 | 中 | 采样、压缩、ILM |
| 查询慢 | 中 | 中 | 缓存、索引优化 |

### 12.2 回滚方案

**采样策略回滚**:
1. 检测到性能下降
2. 降低采样率
3. 验证性能恢复
4. 记录回滚日志

---

## 13. 附录

### 13.1 术语表

| 术语 | 说明 |
|------|------|
| Trace | 一次完整的请求链路 |
| Span | Trace中的一个操作单元 |
| OpenTelemetry | 统一的可观测性标准 |
| Jaeger | 分布式追踪系统 |

### 13.2 参考文档

- [OpenTelemetry文档](https://opentelemetry.io/docs/)
- [Jaeger文档](https://www.jaegertracing.io/docs/)
- [分布式追踪最佳实践](https://opentracing.io/docs/best-practices/)

### 13.3 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-01-31 | v1.0 | 初稿，完整设计方案 | 系统架构团队 |

# 模块一：日志采集 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-01-31  
> **状态**: 已发布  
> **相关需求**: [requirements-module1.md](../requirements/requirements-module1.md)

---

## 1. 文档信息

### 1.1 版本历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-01-31 | 系统架构团队 | 初稿，完整设计方案 |

### 1.2 文档状态

- **当前状态**: 已发布
- **评审状态**: 已通过
- **实施阶段**: MVP

### 1.3 相关文档

- [需求文档](../requirements/requirements-module1.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)

---

## 2. 总体架构

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    日志采集模块架构                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  配置中心 (PostgreSQL + Redis)                                  │
│       ↓ (热更新)                                                │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  Log Collector Agent (Go 1.21+)                      │      │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │      │
│  │  │ 数据源插件  │→│ 优先级队列  │→│ 数据处理器  │     │      │
│  │  └────────────┘  └────────────┘  └────────────┘     │      │
│  │         ↓              ↓              ↓              │      │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │      │
│  │  │ 本地缓冲    │→│ LZ4压缩     │→│ Kafka发送   │     │      │
│  │  └────────────┘  └────────────┘  └────────────┘     │      │
│  └──────────────────────────────────────────────────────┘      │
│                          ↓                                      │
│                    Kafka 消息队列                               │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分

| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| 数据源插件层 | 多协议采集 | Syslog/HTTP/File/Kafka/JDBC |
| 优先级管理层 | 动态优先级 | 三级队列、自动提升 |
| 数据处理层 | 数据预处理 | 清洗、脱敏、去重、标准化 |
| 本地缓冲层 | 断线保护 | 内存缓冲 + BoltDB持久化 |
| 传输层 | 高效传输 | LZ4压缩 + Kafka批量发送 |

### 2.3 关键路径

```
数据源 → 插件采集(50ms) → 优先级队列(10ms) → 数据处理(30ms) 
  → 本地缓冲(5ms) → 压缩传输(100ms) → Kafka

总延迟: < 200ms (P95)
```

---

## 3. 技术选型

### 3.1 核心技术栈

| 技术 | 版本 | 选择理由 |
|------|------|----------|
| Go | 1.21+ | 高性能、跨平台、并发友好 |
| BoltDB | 1.3+ | 嵌入式KV存储、无需外部依赖 |
| Kafka | 3.6+ | 高吞吐、持久化、消息回放 |
| LZ4 | - | 压缩速度快、CPU占用低 |
| Redis | 7.2+ | 配置分发、Pub/Sub通知 |

### 3.2 插件架构选型

采用 **Go Plugin** 机制实现动态插件加载:
- 优点: 原生支持、类型安全、性能好
- 缺点: 需要相同Go版本编译
- 替代方案: gRPC插件(跨语言但性能略低)

---

## 4. 关键流程设计

### 4.1 主流程

**采集处理流程**:

```
1. 数据源插件读取日志
2. 写入优先级队列(根据规则分级)
3. 从队列取出日志(高优先级优先)
4. 数据处理管道(清洗→脱敏→去重→标准化)
5. 写入本地缓冲区
6. LZ4压缩
7. 批量发送到Kafka
```

**时序图**:

```
数据源  插件  队列  处理器  缓冲  压缩  Kafka
  │      │     │      │      │     │     │
  │─读取→│     │      │      │     │     │
  │      │─入队→│      │      │     │     │
  │      │     │─取出→│      │     │     │
  │      │     │      │─处理→│     │     │
  │      │     │      │      │─写入→│     │
  │      │     │      │      │     │─压缩→│
  │      │     │      │      │     │     │─发送→
```


### 4.2 异常流程

| 异常类型 | 处理策略 | 恢复机制 |
|----------|----------|----------|
| 网络断开 | 写入BoltDB持久化 | 指数退避重连(1s→5min) |
| 队列满 | 触发背压、阻塞读取 | 等待队列消费 |
| 解析失败 | 记录原始日志+告警 | 人工处理 |
| Kafka不可用 | 本地缓存(最大1GB) | 自动重试 |

### 4.3 配置热更新流程

```
1. 用户在Web Console修改配置
2. 配置保存到PostgreSQL(版本化)
3. 配置同步到Redis
4. Redis发布Pub/Sub通知(config:reload频道)
5. Collector订阅通知
6. 使用atomic.Value原子更新配置
7. 记录审计日志
```

---

## 5. 接口设计

### 5.1 API列表

详见 [API设计文档](./api-design.md) 模块1部分，共31个接口:

- 数据源管理: 增删改查、启用禁用
- 优先级管理: 规则配置、统计查询
- 处理规则管理: 清洗、脱敏、去重配置
- 流管理: 配置、目标、回放、指标
- 解析器管理: 格式检测、预览、自定义规则
- 配置热更新: 触发更新、查询版本
- 健康检查: 状态查询、指标获取

### 5.2 内部接口

**插件接口**:

```go
// 数据源插件接口
type SourcePlugin interface {
    // 初始化插件
    Init(config map[string]interface{}) error
    
    // 读取日志(非阻塞)
    Read(ctx context.Context) ([]LogEntry, error)
    
    // 获取插件信息
    Info() PluginInfo
    
    // 关闭插件
    Close() error
}

// 处理器插件接口
type ProcessorPlugin interface {
    // 处理日志
    Process(entry *LogEntry) (*LogEntry, error)
    
    // 获取插件信息
    Info() PluginInfo
}
```

---

## 6. 数据设计

### 6.1 数据模型

**日志条目结构**:

```go
type LogEntry struct {
    ID        string                 // 唯一标识
    Timestamp time.Time              // 时间戳
    Level     string                 // 日志级别
    Source    string                 // 来源
    Host      string                 // 主机名
    Message   string                 // 消息内容
    Fields    map[string]interface{} // 自定义字段
    Priority  Priority               // 优先级
    Metadata  map[string]string      // 元数据
}
```

### 6.2 配置数据模型

**采集配置示例**（此为数据结构说明，实际配置见11.3节）:

```yaml
# 注意：这是配置数据结构示例，用于说明配置格式
# 实际使用时：
# - sources、buffer、processing 等配置 ✅ 推荐热更新（通过Redis Pub/Sub）
# - kafka 连接配置 ⚠️ 不推荐热更新（需要重启服务）

collector:
  # ✅ 支持热更新
  sources:
    - name: "app-logs"
      type: "file"
      enabled: true
      config:
        paths: ["/var/log/app/*.log"]
        encoding: "utf-8"
      priority: "high"
  
  # ✅ 支持热更新
  buffer:
    memory_size: 1024  # MB
    disk_path: "/data/buffer"
    max_disk_size: 1024  # MB
  
  # ✅ 支持热更新
  processing:
    dedup_enabled: true
    dedup_window: 5  # 秒
    masking_enabled: true
  
  # ⚠️ 不推荐热更新（需要重启服务）
  kafka:
    brokers: ["kafka-1:9092"]
    topic: "logs"
    # 原因：Kafka连接配置变更需要重建连接池和生产者实例
```

### 6.3 缓存设计

**本地缓冲**:
- L1: 内存环形缓冲区(1024条)
- L2: BoltDB持久化(最大1GB)

**配置缓存**:
- Redis存储当前生效配置
- TTL: 永久(手动更新)
- Key格式: `collector:config:{component}`

---

## 7. 安全设计

### 7.1 数据安全

**敏感信息脱敏**:

| 类型 | 脱敏规则 | 示例 |
|------|----------|------|
| IP地址 | 保留前两段 | 192.168.*.* |
| 邮箱 | 保留首字母和域名 | u***@example.com |
| 手机号 | 保留前3后4位 | 138****5678 |
| 密码 | 完全替换 | ******** |

### 7.2 传输安全

- Kafka连接使用TLS 1.3加密
- 支持SASL认证(PLAIN/SCRAM)
- 配置中心连接使用TLS

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 采集延迟 | < 50ms | 时间戳差值 |
| 处理吞吐 | 10万条/秒 | 计数器统计 |
| CPU占用 | < 5% | 系统监控 |
| 内存占用 | < 100MB | 进程监控 |
| 压缩率 | > 70% | 压缩前后大小对比 |

### 8.2 优化策略

**采集优化**:
- 使用mmap减少文件读取系统调用
- 批量读取(每次1000条)
- 异步IO避免阻塞

**处理优化**:
- Worker池并发处理(100个goroutine)
- 零拷贝传输(避免内存复制)
- 布隆过滤器快速去重

**传输优化**:
- LZ4压缩(速度快、CPU占用低)
- Kafka批量发送(每批10000条或1MB)
- 连接池复用

---

## 9. 部署方案

### 9.1 部署架构

**DaemonSet部署**(Kubernetes):

> **注意**: 以下是Kubernetes部署配置，属于基础设施层面，❌ **不支持热更新**。
> 
> 这些配置需要通过 `kubectl apply` 更新，会触发Pod滚动重启：
> - 镜像版本 (image)
> - 资源限制 (resources)
> - 环境变量 (env)
> - 卷挂载 (volumeMounts)
> 
> 应用层配置（数据源、处理规则等）✅ **支持热更新**，见第11节。

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: log-collector
  namespace: log-management
spec:
  selector:
    matchLabels:
      app: log-collector
  template:
    metadata:
      labels:
        app: log-collector
    spec:
      containers:
      - name: collector
        image: log-collector:v1.0  # ❌ 镜像版本变更需要重启
        resources:                  # ❌ 资源限制变更需要重启
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 256Mi
        env:                        # ❌ 环境变量变更需要重启
        - name: REDIS_HOST
          value: "redis:6379"
        - name: KAFKA_BROKERS
          value: "kafka-1:9092,kafka-2:9092"
        volumeMounts:               # ❌ 卷挂载变更需要重启
        - name: varlog
          mountPath: /var/log
          readOnly: true
        - name: config
          mountPath: /etc/log-collector
          readOnly: true
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
      - name: config
        configMap:
          name: log-collector-config  # 应用配置通过热更新，不依赖ConfigMap
```

**配置层次说明**:

| 配置层次 | 配置内容 | 更新方式 | 是否重启 | 生效时间 |
|---------|---------|---------|---------|---------|
| **基础设施层** | K8s资源定义、镜像版本、资源限制 | kubectl apply | ✅ 需要 | 滚动重启后 |
| **连接层** | Kafka/Redis/DB连接配置 | YAML文件 + 重启 | ✅ 需要 | 重启后 |
| **应用层** | 数据源、处理规则、业务配置 | Redis Pub/Sub | ❌ 不需要 | 立即(1-3秒) |

### 9.2 资源配置

| 环境 | CPU | 内存 | 磁盘 | 实例数 |
|------|-----|------|------|--------|
| 开发 | 0.5核 | 128MB | 1GB | 1 |
| 测试 | 1核 | 256MB | 5GB | 3 |
| 生产 | 2核 | 512MB | 10GB | 每节点1个 |

---

## 10. 监控与运维

### 10.1 监控指标

**Prometheus指标**:

```
# 采集指标
collector_logs_collected_total{source="app"}
collector_logs_processed_total{status="success|failed"}
collector_processing_duration_seconds{quantile="0.95"}

# 队列指标
collector_queue_size{priority="high|medium|low"}
collector_queue_wait_duration_seconds

# 缓冲指标
collector_buffer_memory_bytes
collector_buffer_disk_bytes
collector_buffer_full_total

# 传输指标
collector_kafka_send_total{status="success|failed"}
collector_kafka_send_duration_seconds
collector_compression_ratio
```

### 10.2 告警规则

| 告警 | 条件 | 级别 | 处理 |
|------|------|------|------|
| 采集延迟高 | > 1s | Warning | 检查数据源 |
| 队列积压 | > 10000 | Warning | 增加处理能力 |
| 缓冲区满 | > 90% | Critical | 检查Kafka连接 |
| 发送失败率高 | > 5% | Critical | 检查网络和Kafka |

### 10.3 日志规范

**日志级别**:
- DEBUG: 详细调试信息
- INFO: 正常运行信息
- WARN: 警告信息(不影响运行)
- ERROR: 错误信息(需要关注)
- FATAL: 致命错误(程序退出)

**日志格式**(JSON):

```json
{
  "timestamp": "2026-01-31T12:00:00Z",
  "level": "INFO",
  "component": "collector",
  "message": "日志采集成功",
  "source": "app-logs",
  "count": 1000,
  "duration_ms": 45
}
```

---

## 11. 配置热更新详细设计

### 11.1 可热更新配置项

**配置分层说明**:

```
┌─────────────────────────────────────────────────────────────┐
│  基础设施层 (Kubernetes)                                     │
│  ❌ 不支持热更新，需要 kubectl apply + 滚动重启              │
│  - 镜像版本、资源限制、环境变量、卷挂载                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  连接层 (基础服务连接)                                       │
│  ⚠️ 不推荐热更新，建议通过YAML文件更新并重启服务             │
│  - Kafka连接配置、Redis连接配置、数据库连接配置              │
│  原因：需要重建连接池，可能导致短暂服务中断                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  应用层 (业务配置)                                           │
│  ✅ 推荐热更新，通过Redis Pub/Sub立即生效                    │
│  - 数据源配置、处理规则、业务参数                            │
└─────────────────────────────────────────────────────────────┘
```

**详细配置项列表**:

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|----------|----------|---------------|
| sources | array | [] | 数据源列表 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| buffer_size | int | 1024 | 缓冲区大小(MB) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| worker_pool_size | int | 100 | 工作协程数 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| batch_size | int | 1000 | 批量大小 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| priority_rules | array | [] | 优先级规则 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| masking_rules | array | [] | 脱敏规则 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| dedup_enabled | bool | true | 是否启用去重 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| compression_level | int | 1 | 压缩级别(1-9) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| kafka_brokers | array | [] | Kafka broker地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| kafka_auth | object | {} | Kafka认证配置 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| redis_host | string | - | Redis主机地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| image_version | string | - | 容器镜像版本 | kubectl apply | 滚动重启后 | ❌ 不支持 |
| resource_limits | object | {} | 资源限制 | kubectl apply | 滚动重启后 | ❌ 不支持 |

**不推荐热更新的原因说明**:

1. **Kafka连接配置** (kafka_brokers, kafka_auth):
   - 需要关闭现有Kafka生产者
   - 重建连接池和生产者实例
   - 可能导致短暂的消息发送失败
   - 建议：通过YAML文件更新并重启服务

2. **Redis连接配置** (redis_host, redis_auth):
   - 需要重建Redis客户端连接
   - 影响配置热更新机制本身
   - 建议：通过YAML文件更新并重启服务

3. **基础设施配置** (image_version, resource_limits):
   - 属于Kubernetes资源定义
   - 必须通过kubectl apply更新
   - 会触发Pod滚动重启

**备用更新方式**:
- 如果Redis不可用，支持通过YAML配置文件更新，需要重启服务
- 配置文件路径: `/etc/log-collector/config.yaml`
- 重启命令: `kubectl rollout restart daemonset/log-collector`

### 11.2 热更新实现

```go
// CollectorConfig 采集器配置
type CollectorConfig struct {
    Sources          []SourceConfig     `json:"sources"`
    BufferSize       int                `json:"buffer_size"`
    WorkerPoolSize   int                `json:"worker_pool_size"`
    BatchSize        int                `json:"batch_size"`
    PriorityRules    []PriorityRule     `json:"priority_rules"`
    MaskingRules     []MaskingRule      `json:"masking_rules"`
    DedupEnabled     bool               `json:"dedup_enabled"`
    CompressionLevel int                `json:"compression_level"`
    Version          int64              `json:"version"`
    UpdatedAt        time.Time          `json:"updated_at"`
}

// Collector 采集器
type Collector struct {
    config       atomic.Value  // 存储*CollectorConfig
    redis        *redis.Client
    workerPool   *WorkerPool
    sources      map[string]SourcePlugin
    mu           sync.RWMutex
    
    // 扩展接口
    configHooks  []ConfigHook  // 配置变更钩子
    pluginLoader PluginLoader  // 插件加载器
}

// ConfigHook 配置变更钩子接口(扩展点)
type ConfigHook interface {
    // OnConfigChange 配置变更时调用
    OnConfigChange(oldConfig, newConfig *CollectorConfig) error
    
    // Name 钩子名称
    Name() string
}

// PluginLoader 插件加载器接口(扩展点)
type PluginLoader interface {
    // LoadPlugin 加载插件
    LoadPlugin(name string, config map[string]interface{}) (SourcePlugin, error)
    
    // UnloadPlugin 卸载插件
    UnloadPlugin(name string) error
    
    // ListPlugins 列出所有插件
    ListPlugins() []string
}

// RegisterConfigHook 注册配置变更钩子(扩展接口)
func (c *Collector) RegisterConfigHook(hook ConfigHook) {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.configHooks = append(c.configHooks, hook)
    log.Info("注册配置钩子", "name", hook.Name())
}

// 订阅配置变更
func (c *Collector) subscribeConfigChanges() {
    pubsub := c.redis.Subscribe(context.Background(), "config:collector:reload")
    defer pubsub.Close()
    
    for msg := range pubsub.Channel() {
        // 从Redis获取最新配置
        newConfig, err := c.loadConfigFromRedis()
        if err != nil {
            log.Error("加载配置失败", "error", err)
            continue
        }
        
        // 验证配置
        if err := c.validateConfig(newConfig); err != nil {
            log.Error("配置验证失败", "error", err)
            continue
        }
        
        // 获取旧配置
        oldConfig := c.getConfig()
        
        // 执行配置变更钩子
        for _, hook := range c.configHooks {
            if err := hook.OnConfigChange(oldConfig, newConfig); err != nil {
                log.Error("配置钩子执行失败", "hook", hook.Name(), "error", err)
                return
            }
        }
        
        // 原子更新配置
        c.config.Store(newConfig)
        
        // 应用配置变更
        c.applyConfigChanges(oldConfig, newConfig)
        
        log.Info("配置已更新", "version", newConfig.Version)
    }
}

// applyConfigChanges 应用配置变更
func (c *Collector) applyConfigChanges(oldConfig, newConfig *CollectorConfig) {
    // 数据源变更
    if !reflect.DeepEqual(oldConfig.Sources, newConfig.Sources) {
        c.reloadSources(newConfig.Sources)
    }
    
    // Worker池大小变更
    if oldConfig.WorkerPoolSize != newConfig.WorkerPoolSize {
        c.workerPool.Resize(newConfig.WorkerPoolSize)
    }
    
    // 脱敏规则变更
    if !reflect.DeepEqual(oldConfig.MaskingRules, newConfig.MaskingRules) {
        c.reloadMaskingRules(newConfig.MaskingRules)
    }
    
    // 优先级规则变更
    if !reflect.DeepEqual(oldConfig.PriorityRules, newConfig.PriorityRules) {
        c.reloadPriorityRules(newConfig.PriorityRules)
    }
}

// reloadSources 重新加载数据源(热更新)
func (c *Collector) reloadSources(sources []SourceConfig) {
    c.mu.Lock()
    defer c.mu.Unlock()
    
    // 停止已删除的数据源
    for name := range c.sources {
        found := false
        for _, src := range sources {
            if src.Name == name {
                found = true
                break
            }
        }
        if !found {
            c.sources[name].Close()
            delete(c.sources, name)
            log.Info("数据源已停止", "name", name)
        }
    }
    
    // 启动新增的数据源
    for _, src := range sources {
        if _, exists := c.sources[src.Name]; !exists && src.Enabled {
            plugin, err := c.pluginLoader.LoadPlugin(src.Type, src.Config)
            if err != nil {
                log.Error("加载数据源失败", "name", src.Name, "error", err)
                continue
            }
            c.sources[src.Name] = plugin
            log.Info("数据源已启动", "name", src.Name)
        }
    }
}

// validateConfig 验证配置
func (c *Collector) validateConfig(config *CollectorConfig) error {
    if config.BufferSize < 1 || config.BufferSize > 10240 {
        return fmt.Errorf("buffer_size必须在1-10240之间")
    }
    
    if config.WorkerPoolSize < 1 || config.WorkerPoolSize > 1000 {
        return fmt.Errorf("worker_pool_size必须在1-1000之间")
    }
    
    if config.BatchSize < 1 || config.BatchSize > 100000 {
        return fmt.Errorf("batch_size必须在1-100000之间")
    }
    
    if config.CompressionLevel < 1 || config.CompressionLevel > 9 {
        return fmt.Errorf("compression_level必须在1-9之间")
    }
    
    return nil
}

// 获取当前配置(无锁)
func (c *Collector) getConfig() *CollectorConfig {
    return c.config.Load().(*CollectorConfig)
}
```

### 11.3 YAML配置文件备用方案

**配置文件结构** (`/etc/log-collector/config.yaml`):
```yaml
# 日志采集器配置文件
# 注意: 此配置文件仅在Redis不可用时使用，需要重启服务生效

# 数据源配置(支持热更新)
sources:
  - name: "app-logs"
    type: "file"
    enabled: true
    config:
      paths:
        - "/var/log/app/*.log"
        - "/var/log/app/**/*.log"
      encoding: "utf-8"
      tail: true
      multiline:
        pattern: '^\d{4}-\d{2}-\d{2}'
        negate: true
        match: after
    priority: "high"
  
  - name: "system-logs"
    type: "syslog"
    enabled: true
    config:
      protocol: "tcp"
      address: "0.0.0.0:514"
      format: "rfc5424"
    priority: "medium"

# 缓冲配置(支持热更新)
buffer:
  memory_size: 1024      # MB
  disk_path: "/data/buffer"
  max_disk_size: 10240   # MB

# 处理配置(支持热更新)
processing:
  worker_pool_size: 100
  batch_size: 1000
  compression_level: 1   # 1-9, 1最快9最小
  
  # 去重配置
  dedup:
    enabled: true
    window: 5            # 秒
    fields: ["message"]  # 去重字段
  
  # 脱敏规则
  masking_rules:
    - field: "password"
      pattern: ".*"
      replace: "******"
    - field: "credit_card"
      pattern: '(\d{4})\d{8}(\d{4})'
      replace: "$1********$2"
    - field: "phone"
      pattern: '(\d{3})\d{4}(\d{4})'
      replace: "$1****$2"
  
  # 优先级规则
  priority_rules:
    - name: "错误日志高优先级"
      condition:
        field: "level"
        operator: "eq"
        value: "ERROR"
      priority: "high"
    - name: "警告日志中优先级"
      condition:
        field: "level"
        operator: "eq"
        value: "WARN"
      priority: "medium"

# Kafka配置(不推荐热更新，需要重启)
kafka:
  brokers:
    - "kafka-1:9092"
    - "kafka-2:9092"
    - "kafka-3:9092"
  topic: "logs"
  compression: "lz4"
  
  # 认证配置
  sasl:
    enabled: true
    mechanism: "SCRAM-SHA-512"
    username: "${KAFKA_USERNAME}"  # 支持环境变量
    password: "${KAFKA_PASSWORD}"
  
  # TLS配置
  tls:
    enabled: true
    ca_cert: "/etc/certs/ca.crt"
    client_cert: "/etc/certs/client.crt"
    client_key: "/etc/certs/client.key"
  
  # 生产者配置
  producer:
    acks: "all"
    retries: 3
    batch_size: 16384
    linger_ms: 10
    max_in_flight: 5

# 监控配置
monitoring:
  metrics_port: 9090
  health_port: 8080
  log_level: "info"
```

**加载YAML配置**:
```go
// LoadConfigFromYAML 从YAML文件加载配置
func LoadConfigFromYAML(filepath string) (*CollectorConfig, error) {
    data, err := ioutil.ReadFile(filepath)
    if err != nil {
        return nil, fmt.Errorf("读取配置文件失败: %w", err)
    }
    
    // 替换环境变量
    data = []byte(os.ExpandEnv(string(data)))
    
    var yamlConfig struct {
        Sources    []SourceConfig    `yaml:"sources"`
        Buffer     BufferConfig      `yaml:"buffer"`
        Processing ProcessingConfig  `yaml:"processing"`
        Kafka      KafkaConfig       `yaml:"kafka"`
        Monitoring MonitoringConfig  `yaml:"monitoring"`
    }
    
    if err := yaml.Unmarshal(data, &yamlConfig); err != nil {
        return nil, fmt.Errorf("解析配置文件失败: %w", err)
    }
    
    // 转换为CollectorConfig
    config := &CollectorConfig{
        Sources:          yamlConfig.Sources,
        BufferSize:       yamlConfig.Buffer.MemorySize,
        WorkerPoolSize:   yamlConfig.Processing.WorkerPoolSize,
        BatchSize:        yamlConfig.Processing.BatchSize,
        PriorityRules:    yamlConfig.Processing.PriorityRules,
        MaskingRules:     yamlConfig.Processing.MaskingRules,
        DedupEnabled:     yamlConfig.Processing.Dedup.Enabled,
        CompressionLevel: yamlConfig.Processing.CompressionLevel,
        Version:          time.Now().UnixNano(),
        UpdatedAt:        time.Now(),
    }
    
    return config, nil
}

// Initialize 初始化采集器
func (c *Collector) Initialize() error {
    // 优先从Redis加载配置
    if err := c.loadConfigFromRedis(); err == nil {
        log.Info("从Redis加载配置成功")
        go c.subscribeConfigChanges()
        return nil
    }
    
    log.Warn("从Redis加载配置失败，尝试从YAML文件加载")
    
    // 从YAML文件加载配置
    config, err := LoadConfigFromYAML("/etc/log-collector/config.yaml")
    if err != nil {
        return fmt.Errorf("从YAML文件加载配置失败: %w", err)
    }
    
    c.config.Store(config)
    
    // 尝试同步到Redis
    if err := c.syncConfigToRedis(config); err != nil {
        log.Warn("同步配置到Redis失败", "error", err)
    }
    
    log.Info("从YAML文件加载配置成功")
    return nil
}
```

### 11.4 扩展接口示例

**自定义配置钩子**:
```go
// MetricsHook 指标收集钩子
type MetricsHook struct {
    metrics *prometheus.Registry
}

func (h *MetricsHook) Name() string {
    return "metrics-hook"
}

func (h *MetricsHook) OnConfigChange(oldConfig, newConfig *CollectorConfig) error {
    // 记录配置变更指标
    configChangeCounter.Inc()
    
    // 记录数据源数量变化
    sourceCountGauge.Set(float64(len(newConfig.Sources)))
    
    log.Info("配置变更指标已更新")
    return nil
}

// 注册钩子
collector.RegisterConfigHook(&MetricsHook{metrics: promRegistry})
```

**自定义插件加载器**:
```go
// CustomPluginLoader 自定义插件加载器
type CustomPluginLoader struct {
    plugins map[string]SourcePlugin
    mu      sync.RWMutex
}

func (l *CustomPluginLoader) LoadPlugin(name string, config map[string]interface{}) (SourcePlugin, error) {
    l.mu.Lock()
    defer l.mu.Unlock()
    
    // 根据类型加载不同插件
    switch name {
    case "file":
        return NewFilePlugin(config)
    case "syslog":
        return NewSyslogPlugin(config)
    case "http":
        return NewHTTPPlugin(config)
    default:
        return nil, fmt.Errorf("未知插件类型: %s", name)
    }
}

func (l *CustomPluginLoader) UnloadPlugin(name string) error {
    l.mu.Lock()
    defer l.mu.Unlock()
    
    if plugin, exists := l.plugins[name]; exists {
        plugin.Close()
        delete(l.plugins, name)
    }
    
    return nil
}

func (l *CustomPluginLoader) ListPlugins() []string {
    l.mu.RLock()
    defer l.mu.RUnlock()
    
    names := make([]string, 0, len(l.plugins))
    for name := range l.plugins {
        names = append(names, name)
    }
    return names
}
```

### 11.5 验收标准

**功能验收**:
1. ✅ 配置变更后3秒内生效
2. ✅ 配置无效时保持原配置
3. ✅ 支持API查询当前配置
4. ✅ 记录配置变更审计日志
5. ✅ 数据源支持热更新(启动/停止)
6. ✅ 脱敏规则支持热更新
7. ✅ 优先级规则支持热更新
8. ✅ Redis不可用时降级到YAML配置
9. ✅ 支持自定义配置钩子扩展
10. ✅ 支持自定义插件加载器扩展

**性能验收**:
1. ✅ 配置更新不影响正在处理的日志
2. ✅ 配置读取延迟 < 1ms
3. ✅ 数据源热更新延迟 < 5秒

**可靠性验收**:
1. ✅ 配置验证失败时拒绝更新
2. ✅ 数据源加载失败时记录错误但不影响其他数据源
3. ✅ 配置钩子执行失败时回滚配置

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 数据丢失 | 低 | 高 | 本地持久化缓冲 |
| 性能下降 | 中 | 中 | 限流、背压机制 |
| 内存泄漏 | 低 | 高 | 定期重启、监控告警 |
| 配置错误 | 中 | 中 | 配置验证、灰度发布 |

### 12.2 回滚方案

**配置回滚**:
1. 检测到异常(错误率>5%)
2. 从PostgreSQL获取上一版本配置
3. 通过Redis Pub/Sub下发回滚通知
4. Collector自动加载旧配置
5. 验证回滚成功

**代码回滚**:
1. Kubernetes滚动更新失败
2. 执行 `kubectl rollout undo`
3. 回滚到上一个稳定版本
4. 验证服务恢复

---

## 13. 附录

### 13.1 术语表

| 术语 | 说明 |
|------|------|
| DaemonSet | Kubernetes中每个节点运行一个Pod的部署方式 |
| 背压 | Backpressure，当下游处理慢时阻止上游继续发送 |
| 布隆过滤器 | Bloom Filter，快速判断元素是否存在的概率数据结构 |
| 原子操作 | Atomic Operation，不可分割的操作，保证并发安全 |

### 13.2 参考文档

- [Go Plugin文档](https://pkg.go.dev/plugin)
- [Kafka Producer配置](https://kafka.apache.org/documentation/#producerconfigs)
- [BoltDB文档](https://github.com/etcd-io/bbolt)
- [LZ4压缩算法](https://github.com/lz4/lz4)

### 13.3 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-01-31 | v1.0 | 初稿，完整设计方案 | 系统架构团队 |

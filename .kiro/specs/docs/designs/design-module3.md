# 模块三：日志分析 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-01-31  
> **状态**: 已发布  
> **相关需求**: [requirements-module3.md](../requirements/requirements-module3.md)

---

## 1. 文档信息

### 1.1 版本历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-01-31 | 系统架构团队 | 初稿，完整设计方案 |

### 1.2 相关文档

- [需求文档](../requirements/requirements-module3.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)
- [模块2设计](./design-module2.md)

---

## 2. 总体架构

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    日志分析模块架构                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  Apache Flink 流处理引擎                             │      │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │      │
│  │  │ 实时分析    │  │ CEP引擎     │  │ 聚合统计    │     │      │
│  │  │ (窗口计算)  │  │ (模式匹配)  │  │ (多维分析)  │     │      │
│  │  └────────────┘  └────────────┘  └────────────┘     │      │
│  └──────────────────────────────────────────────────────┘      │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  ML/AI 分析引擎                                       │      │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │      │
│  │  │ 异常检测    │  │ 日志聚类    │  │ 模式识别    │     │      │
│  │  │ (ONNX)     │  │ (K-Means)  │  │ (NLP)      │     │      │
│  │  └────────────┘  └────────────┘  └────────────┘     │      │
│  └──────────────────────────────────────────────────────┘      │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  查询引擎                                             │      │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │      │
│  │  │ SQL查询     │  │ DSL查询     │  │ NLP查询     │     │      │
│  │  │ (Presto)   │  │ (ES DSL)   │  │ (LLM)      │     │      │
│  │  └────────────┘  └────────────┘  └────────────┘     │      │
│  └──────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分

| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| 实时分析引擎 | 流式处理 | 窗口聚合、实时统计、趋势分析 |
| CEP引擎 | 复杂事件处理 | 模式匹配、序列检测、关联分析 |
| ML分析引擎 | 智能分析 | 异常检测、聚类分析、预测 |
| 查询引擎 | 多样化查询 | SQL/DSL/NLP查询支持 |
| 规则引擎 | 规则管理 | 分析规则配置、热更新 |

### 2.3 关键路径

```
日志流 → Flink处理(100ms) → 实时分析(50ms) → 结果输出
日志流 → CEP匹配(200ms) → 模式识别 → 事件生成
查询请求 → 查询解析(10ms) → ES查询(500ms) → 结果返回
```

---

## 3. 技术选型

### 3.1 核心技术栈

| 技术 | 版本 | 选择理由 |
|------|------|----------|
| Apache Flink | 1.18+ | 流批一体、状态管理、CEP支持 |
| ONNX Runtime | 1.16+ | 跨平台模型推理、高性能 |
| scikit-learn | 1.3+ | 机器学习算法库 |
| Presto | 0.280+ | 分布式SQL查询引擎 |
| Redis | 7.2+ | 缓存、配置分发 |

### 3.2 分析引擎对比

| 引擎 | 延迟 | 吞吐 | 状态管理 | CEP | 选择 |
|------|------|------|----------|-----|------|
| Flink | 毫秒级 | 百万/秒 | 强 | 支持 | ✅ |
| Spark Streaming | 秒级 | 十万/秒 | 中 | 不支持 | ❌ |
| Storm | 毫秒级 | 百万/秒 | 弱 | 不支持 | ❌ |

---

## 4. 关键流程设计

### 4.1 实时分析流程

```
1. 从Kafka消费日志流
2. Flink窗口聚合(滑动窗口5分钟)
3. 计算统计指标:
   - 日志量趋势
   - 错误率统计
   - 响应时间分布
   - Top N 错误
4. 结果写入Redis缓存
5. 触发告警(如果超过阈值)
6. 结果持久化到ES
```

### 4.2 CEP模式匹配流程

```
1. 定义CEP模式(如: 连续3次登录失败)
2. Flink CEP引擎实时匹配
3. 检测到模式后生成事件
4. 事件关联分析(关联用户、IP等)
5. 触发告警或自动响应
6. 记录事件到ES
```

### 4.3 异常检测流程

```
1. 收集历史日志数据
2. 训练异常检测模型(Isolation Forest)
3. 模型导出为ONNX格式
4. 实时日志通过ONNX Runtime推理
5. 计算异常分数
6. 超过阈值标记为异常
7. 生成异常事件
```

---

## 5. 接口设计

### 5.1 API列表

详见 [API设计文档](./api-design.md) 模块3部分，共36个接口:

- 分析规则管理: 增删改查、启用禁用
- 流处理管理: 状态查询、聚合统计
- 查询接口: SQL/DSL/NLP查询
- ML模型管理: 模型列表、指标查询、更新
- 异常检测: 检测、列表、反馈
- 聚类分析: 执行、列表、详情、可视化
- 配置热更新: 触发更新、版本查询

### 5.2 Flink作业接口

```java
// Flink DataStream API
DataStream<LogEntry> logStream = env
    .addSource(new FlinkKafkaConsumer<>(...))
    .keyBy(log -> log.getSource())
    .window(TumblingEventTimeWindows.of(Time.minutes(5)))
    .aggregate(new LogAggregator())
    .addSink(new ElasticsearchSink<>(...));

// Flink CEP API
Pattern<LogEntry, ?> pattern = Pattern
    .<LogEntry>begin("start")
    .where(new SimpleCondition<LogEntry>() {
        @Override
        public boolean filter(LogEntry log) {
            return log.getLevel().equals("ERROR");
        }
    })
    .times(3).consecutive()
    .within(Time.minutes(5));
```

---

## 6. 数据设计

### 6.1 分析结果数据模型

```go
// 聚合统计结果
type AggregationResult struct {
    TimeWindow  TimeRange              // 时间窗口
    Source      string                 // 数据源
    Metrics     map[string]float64     // 指标值
    Dimensions  map[string]string      // 维度
    Timestamp   time.Time              // 时间戳
}

// 异常检测结果
type AnomalyResult struct {
    ID          string                 // 异常ID
    LogEntry    *LogEntry              // 原始日志
    Score       float64                // 异常分数
    Threshold   float64                // 阈值
    IsAnomaly   bool                   // 是否异常
    Reason      string                 // 异常原因
    DetectedAt  time.Time              // 检测时间
}

// CEP事件
type CEPEvent struct {
    ID          string                 // 事件ID
    PatternName string                 // 模式名称
    Logs        []*LogEntry            // 匹配的日志
    Context     map[string]interface{} // 上下文信息
    CreatedAt   time.Time              // 创建时间
}
```

### 6.2 Flink状态存储

```java
// 使用RocksDB作为状态后端
env.setStateBackend(new EmbeddedRocksDBStateBackend());
env.getCheckpointConfig().setCheckpointStorage("s3://bucket/checkpoints");

// 状态TTL配置
StateTtlConfig ttlConfig = StateTtlConfig
    .newBuilder(Time.hours(24))
    .setUpdateType(StateTtlConfig.UpdateType.OnCreateAndWrite)
    .setStateVisibility(StateTtlConfig.StateVisibility.NeverReturnExpired)
    .build();
```

---

## 7. 安全设计

### 7.1 查询安全

- SQL注入防护(参数化查询)
- 查询权限控制(基于RBAC)
- 查询结果脱敏
- 查询审计日志

### 7.2 模型安全

- 模型文件加密存储
- 模型访问权限控制
- 模型版本管理
- 模型推理审计

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 实时分析延迟 | <100ms | Flink metrics |
| CEP匹配延迟 | <200ms | Flink metrics |
| 查询延迟P95 | <500ms | APM监控 |
| 异常检测延迟 | <50ms | ONNX推理时间 |
| 吞吐量 | 100万条/秒 | Flink吞吐统计 |

### 8.2 优化策略

**Flink优化**:
- 并行度调优(根据CPU核数)
- 状态后端优化(RocksDB)
- 检查点优化(增量检查点)
- 反压处理(背压监控)

**查询优化**:
- 查询结果缓存(Redis)
- 索引优化(ES)
- 查询改写(优化器)
- 分页查询(避免深分页)

**ML推理优化**:
- 模型量化(减少模型大小)
- 批量推理(提升吞吐)
- GPU加速(可选)
- 模型缓存(避免重复加载)

---

## 9. 部署方案

### 9.1 Flink集群部署

**Kubernetes部署**:

```yaml
apiVersion: flink.apache.org/v1beta1
kind: FlinkDeployment
metadata:
  name: log-analysis
spec:
  image: flink:1.18
  flinkVersion: v1_18
  jobManager:
    resource:
      memory: "2048m"
      cpu: 2
  taskManager:
    resource:
      memory: "4096m"
      cpu: 4
    replicas: 3
  job:
    jarURI: s3://bucket/log-analysis.jar
    parallelism: 12
    state: running
```

### 9.2 资源配置

| 组件 | 副本数 | CPU | 内存 | 存储 |
|------|--------|-----|------|------|
| Flink JobManager | 1 | 2核 | 2GB | - |
| Flink TaskManager | 3 | 4核 | 4GB | - |
| ONNX Runtime | 2 | 2核 | 2GB | - |
| Presto Coordinator | 1 | 4核 | 8GB | - |
| Presto Worker | 3 | 8核 | 16GB | - |

---

## 10. 监控与运维

### 10.1 监控指标

```
# Flink指标
flink_taskmanager_job_task_numRecordsInPerSecond
flink_taskmanager_job_task_numRecordsOutPerSecond
flink_jobmanager_job_lastCheckpointDuration
flink_taskmanager_Status_JVM_Memory_Heap_Used

# 分析指标
analysis_rules_executed_total
analysis_anomaly_detected_total
analysis_cep_pattern_matched_total
analysis_query_duration_seconds

# ML指标
ml_inference_duration_seconds
ml_model_accuracy
ml_anomaly_detection_rate
```

### 10.2 告警规则

| 告警 | 条件 | 级别 | 处理 |
|------|------|------|------|
| Flink作业失败 | 状态=FAILED | Critical | 自动重启 |
| 检查点失败 | 连续3次 | Warning | 检查状态后端 |
| 反压严重 | backpressure>0.8 | Warning | 增加并行度 |
| 查询延迟高 | P95>2s | Warning | 优化查询 |

---

## 11. 配置热更新详细设计

### 11.1 配置分层说明

模块3的配置分为三个层次，热更新支持情况如下：

**基础设施层（❌ 不支持热更新）**:
- Flink集群配置（JobManager/TaskManager资源）
- Kubernetes部署配置（副本数、资源限制）
- 状态后端配置（RocksDB、检查点存储）
- 原因：需要重启Flink作业，影响正在运行的流处理任务

**连接层（⚠️ 不推荐热更新）**:
- Kafka连接配置（broker地址、topic）
- Elasticsearch连接配置（集群地址、索引）
- Redis连接配置（地址、密码）
- 原因：需要重建连接池，可能导致数据丢失或处理中断

**应用层（✅ 推荐热更新）**:
- 分析规则配置
- CEP模式配置
- 异常检测阈值
- 窗口大小配置
- 查询缓存配置
- ML模型路径
- 原因：不影响底层连接，可以平滑切换

### 11.2 可热更新配置项

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|---------|----------|---------------|
| analysis_rules | array | [] | 分析规则列表 | Redis Pub/Sub | 下次窗口计算 | ✅ 推荐 |
| window_size_minutes | int | 5 | 窗口大小(分钟) | Redis Pub/Sub | 新窗口生效 | ✅ 推荐 |
| anomaly_threshold | float | 0.8 | 异常阈值 | Redis Pub/Sub | 立即生效 | ✅ 推荐 |
| cep_patterns | array | [] | CEP模式列表 | Redis Pub/Sub | 下次模式匹配 | ✅ 推荐 |
| ml_model_path | string | "" | ML模型路径 | Redis Pub/Sub | 下次推理 | ✅ 推荐 |
| query_cache_ttl | int | 300 | 查询缓存TTL(秒) | Redis Pub/Sub | 下次缓存写入 | ✅ 推荐 |
| max_query_time_range_days | int | 7 | 最大查询时间范围(天) | Redis Pub/Sub | 下次查询 | ✅ 推荐 |
| slow_query_threshold_ms | int | 1000 | 慢查询阈值(毫秒) | Redis Pub/Sub | 立即生效 | ✅ 推荐 |
| kafka_brokers | array | [] | Kafka broker地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重建连接) |
| kafka_topic | string | "logs" | Kafka主题名称 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重建消费者) |
| elasticsearch_addresses | array | [] | ES集群地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重建客户端) |
| redis_address | string | "redis:6379" | Redis地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重建连接) |
| flink_jobmanager_rpc_address | string | "" | Flink JobManager地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重启Flink作业) |

### 11.3 不可热更新配置项（需要重启）

**Flink集群配置** (❌ 不支持热更新):

```yaml
# deploy/kubernetes/flink/jobmanager-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: flink-jobmanager
spec:
  replicas: 1  # ❌ 不支持热更新，需要重启
  template:
    spec:
      containers:
      - name: jobmanager
        resources:
          requests:
            cpu: 2      # ❌ 不支持热更新，需要重启
            memory: 2Gi # ❌ 不支持热更新，需要重启
        env:
        - name: FLINK_PROPERTIES
          value: |
            jobmanager.rpc.address: flink-jobmanager  # ❌ 不支持热更新
            jobmanager.memory.process.size: 2048m     # ❌ 不支持热更新
            taskmanager.numberOfTaskSlots: 4          # ❌ 不支持热更新
```

**原因**: 这些是Kubernetes资源配置，修改后需要重新部署Pod，会导致Flink作业重启。

**连接配置** (⚠️ 不推荐热更新):

```yaml
# configs/analysis.yaml
kafka:
  brokers: "kafka:9092"        # ⚠️ 不推荐热更新，需要重建连接
  topic: "logs"                # ⚠️ 不推荐热更新，需要重建消费者
  group_id: "analysis-group"   # ⚠️ 不推荐热更新，需要重建消费者

elasticsearch:
  addresses: ["es:9200"]       # ⚠️ 不推荐热更新，需要重建客户端
  index_prefix: "logs-"        # ⚠️ 不推荐热更新，影响索引写入
```

**原因**: 修改连接配置需要重建连接池和客户端，可能导致数据丢失或处理中断。建议通过滚动重启更新。

### 11.4 热更新实现

**配置管理器**:

```go
// internal/analyzer/config/manager.go
package config

import (
    "context"
    "encoding/json"
    "sync/atomic"
    "time"
)

// 分析引擎配置管理器
type AnalysisConfigManager struct {
    // 使用atomic.Value实现无锁读取
    rules           atomic.Value  // []AnalysisRule
    cepPatterns     atomic.Value  // []CEPPattern
    anomalyConfig   atomic.Value  // *AnomalyConfig
    queryConfig     atomic.Value  // *QueryConfig
    
    db     *PostgreSQL
    redis  *Redis
    pubsub *redis.PubSub
}

// 分析规则
type AnalysisRule struct {
    ID          string                 `json:"id"`
    Name        string                 `json:"name"`
    Enabled     bool                   `json:"enabled"`
    Type        string                 `json:"type"`  // aggregation/filter/transform
    Condition   string                 `json:"condition"`
    Action      string                 `json:"action"`
    Priority    int                    `json:"priority"`
    CreatedAt   time.Time              `json:"created_at"`
    UpdatedAt   time.Time              `json:"updated_at"`
}

// CEP模式
type CEPPattern struct {
    ID          string                 `json:"id"`
    Name        string                 `json:"name"`
    Enabled     bool                   `json:"enabled"`
    Pattern     string                 `json:"pattern"`  // Flink CEP DSL
    Within      string                 `json:"within"`   // 时间窗口
    Action      string                 `json:"action"`
    CreatedAt   time.Time              `json:"created_at"`
    UpdatedAt   time.Time              `json:"updated_at"`
}

// 异常检测配置
type AnomalyConfig struct {
    Enabled         bool    `json:"enabled"`
    Threshold       float64 `json:"threshold"`
    ModelPath       string  `json:"model_path"`
    WindowSize      int     `json:"window_size_minutes"`
    UpdatedAt       time.Time `json:"updated_at"`
}

// 查询配置
type QueryConfig struct {
    CacheTTL              int  `json:"cache_ttl"`
    MaxTimeRangeDays      int  `json:"max_time_range_days"`
    SlowQueryThresholdMs  int  `json:"slow_query_threshold_ms"`
    UpdatedAt             time.Time `json:"updated_at"`
}

// 创建配置管理器
func NewAnalysisConfigManager(db *PostgreSQL, redis *Redis) (*AnalysisConfigManager, error) {
    acm := &AnalysisConfigManager{
        db:    db,
        redis: redis,
    }
    
    // 从数据库加载初始配置
    if err := acm.loadInitialConfig(); err != nil {
        return nil, err
    }
    
    // 订阅配置变更通知
    acm.pubsub = redis.Subscribe("config:analysis:reload")
    
    return acm, nil
}

// 启动配置热更新监听
func (acm *AnalysisConfigManager) Start(ctx context.Context) error {
    go acm.watchConfigChanges(ctx)
    log.Info("分析引擎配置热更新监听已启动")
    return nil
}

// 监听配置变更
func (acm *AnalysisConfigManager) watchConfigChanges(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():
            return
        case msg := <-acm.pubsub.Channel():
            acm.handleConfigChange(msg)
        }
    }
}

// 处理配置变更
func (acm *AnalysisConfigManager) handleConfigChange(msg *redis.Message) {
    log.Infof("收到分析配置变更通知: %s", msg.Payload)
    
    // 解析变更类型
    var change ConfigChange
    if err := json.Unmarshal([]byte(msg.Payload), &change); err != nil {
        log.Errorf("解析配置变更失败: %v", err)
        return
    }
    
    // 根据配置类型重新加载
    switch change.Type {
    case "rules":
        acm.reloadRules()
    case "cep_patterns":
        acm.reloadCEPPatterns()
    case "anomaly":
        acm.reloadAnomalyConfig()
    case "query":
        acm.reloadQueryConfig()
    case "all":
        acm.reloadAllConfig()
    }
}

// 重新加载分析规则
func (acm *AnalysisConfigManager) reloadRules() {
    log.Info("开始重新加载分析规则")
    
    // 1. 从Redis加载规则
    rulesJSON, err := acm.redis.Get("config:analysis:rules")
    if err != nil {
        log.Errorf("从Redis加载规则失败: %v", err)
        return
    }
    
    // 2. 解析规则
    var newRules []AnalysisRule
    if err := json.Unmarshal([]byte(rulesJSON), &newRules); err != nil {
        log.Errorf("解析规则失败: %v", err)
        return
    }
    
    // 3. 验证规则
    for _, rule := range newRules {
        if err := acm.validateRule(&rule); err != nil {
            log.Errorf("规则验证失败: %v", err)
            return
        }
    }
    
    // 4. 原子更新规则
    acm.rules.Store(newRules)
    
    // 5. 记录审计日志
    acm.logConfigChange("rules", newRules)
    
    log.Infof("分析规则重新加载完成，共%d条规则", len(newRules))
}

// 重新加载CEP模式
func (acm *AnalysisConfigManager) reloadCEPPatterns() {
    log.Info("开始重新加载CEP模式")
    
    // 1. 从Redis加载模式
    patternsJSON, err := acm.redis.Get("config:analysis:cep_patterns")
    if err != nil {
        log.Errorf("从Redis加载CEP模式失败: %v", err)
        return
    }
    
    // 2. 解析模式
    var newPatterns []CEPPattern
    if err := json.Unmarshal([]byte(patternsJSON), &newPatterns); err != nil {
        log.Errorf("解析CEP模式失败: %v", err)
        return
    }
    
    // 3. 验证模式
    for _, pattern := range newPatterns {
        if err := acm.validateCEPPattern(&pattern); err != nil {
            log.Errorf("CEP模式验证失败: %v", err)
            return
        }
    }
    
    // 4. 原子更新模式
    acm.cepPatterns.Store(newPatterns)
    
    // 5. 记录审计日志
    acm.logConfigChange("cep_patterns", newPatterns)
    
    log.Infof("CEP模式重新加载完成，共%d个模式", len(newPatterns))
}

// 重新加载异常检测配置
func (acm *AnalysisConfigManager) reloadAnomalyConfig() {
    log.Info("开始重新加载异常检测配置")
    
    // 1. 从Redis加载配置
    configJSON, err := acm.redis.Get("config:analysis:anomaly")
    if err != nil {
        log.Errorf("从Redis加载异常检测配置失败: %v", err)
        return
    }
    
    // 2. 解析配置
    var newConfig AnomalyConfig
    if err := json.Unmarshal([]byte(configJSON), &newConfig); err != nil {
        log.Errorf("解析异常检测配置失败: %v", err)
        return
    }
    
    // 3. 验证配置
    if err := acm.validateAnomalyConfig(&newConfig); err != nil {
        log.Errorf("异常检测配置验证失败: %v", err)
        return
    }
    
    // 4. 原子更新配置
    acm.anomalyConfig.Store(&newConfig)
    
    // 5. 记录审计日志
    acm.logConfigChange("anomaly", &newConfig)
    
    log.Info("异常检测配置重新加载完成")
}

// 验证分析规则
func (acm *AnalysisConfigManager) validateRule(rule *AnalysisRule) error {
    if rule.Name == "" {
        return fmt.Errorf("规则名称不能为空")
    }
    
    if rule.Type == "" {
        return fmt.Errorf("规则类型不能为空")
    }
    
    validTypes := map[string]bool{
        "aggregation": true,
        "filter":      true,
        "transform":   true,
    }
    if !validTypes[rule.Type] {
        return fmt.Errorf("无效的规则类型: %s", rule.Type)
    }
    
    if rule.Condition == "" {
        return fmt.Errorf("规则条件不能为空")
    }
    
    return nil
}

// 验证CEP模式
func (acm *AnalysisConfigManager) validateCEPPattern(pattern *CEPPattern) error {
    if pattern.Name == "" {
        return fmt.Errorf("模式名称不能为空")
    }
    
    if pattern.Pattern == "" {
        return fmt.Errorf("模式定义不能为空")
    }
    
    if pattern.Within == "" {
        return fmt.Errorf("时间窗口不能为空")
    }
    
    // 验证时间窗口格式
    if _, err := time.ParseDuration(pattern.Within); err != nil {
        return fmt.Errorf("时间窗口格式错误: %w", err)
    }
    
    return nil
}

// 验证异常检测配置
func (acm *AnalysisConfigManager) validateAnomalyConfig(config *AnomalyConfig) error {
    if config.Threshold < 0 || config.Threshold > 1 {
        return fmt.Errorf("异常阈值必须在0-1之间")
    }
    
    if config.WindowSize < 1 || config.WindowSize > 60 {
        return fmt.Errorf("窗口大小必须在1-60分钟之间")
    }
    
    return nil
}

// 获取分析规则（无锁读取）
func (acm *AnalysisConfigManager) GetRules() []AnalysisRule {
    rules := acm.rules.Load()
    if rules == nil {
        return []AnalysisRule{}
    }
    return rules.([]AnalysisRule)
}

// 获取CEP模式（无锁读取）
func (acm *AnalysisConfigManager) GetCEPPatterns() []CEPPattern {
    patterns := acm.cepPatterns.Load()
    if patterns == nil {
        return []CEPPattern{}
    }
    return patterns.([]CEPPattern)
}

// 获取异常检测配置（无锁读取）
func (acm *AnalysisConfigManager) GetAnomalyConfig() *AnomalyConfig {
    config := acm.anomalyConfig.Load()
    if config == nil {
        return &AnomalyConfig{}
    }
    return config.(*AnomalyConfig)
}

// 获取查询配置（无锁读取）
func (acm *AnalysisConfigManager) GetQueryConfig() *QueryConfig {
    config := acm.queryConfig.Load()
    if config == nil {
        return &QueryConfig{}
    }
    return config.(*QueryConfig)
}

// 记录配置变更审计日志
func (acm *AnalysisConfigManager) logConfigChange(configType string, config interface{}) {
    auditLog := AuditLog{
        EventType:    "config_change",
        ResourceType: "analysis_" + configType,
        Action:       "update",
        Timestamp:    time.Now(),
        Details:      config,
    }
    
    // 保存到数据库
    if err := acm.db.SaveAuditLog(&auditLog); err != nil {
        log.Errorf("保存审计日志失败: %v", err)
    }
}

// 从数据库加载初始配置
func (acm *AnalysisConfigManager) loadInitialConfig() error {
    // 加载分析规则
    rules, err := acm.db.GetAnalysisRules()
    if err != nil {
        return fmt.Errorf("加载分析规则失败: %w", err)
    }
    acm.rules.Store(rules)
    
    // 加载CEP模式
    patterns, err := acm.db.GetCEPPatterns()
    if err != nil {
        return fmt.Errorf("加载CEP模式失败: %w", err)
    }
    acm.cepPatterns.Store(patterns)
    
    // 加载异常检测配置
    anomalyConfig, err := acm.db.GetAnomalyConfig()
    if err != nil {
        return fmt.Errorf("加载异常检测配置失败: %w", err)
    }
    acm.anomalyConfig.Store(anomalyConfig)
    
    // 加载查询配置
    queryConfig, err := acm.db.GetQueryConfig()
    if err != nil {
        return fmt.Errorf("加载查询配置失败: %w", err)
    }
    acm.queryConfig.Store(queryConfig)
    
    log.Info("初始配置加载完成")
    return nil
}

// 重新加载所有配置
func (acm *AnalysisConfigManager) reloadAllConfig() {
    log.Info("开始重新加载所有配置")
    
    acm.reloadRules()
    acm.reloadCEPPatterns()
    acm.reloadAnomalyConfig()
    acm.reloadQueryConfig()
    
    log.Info("所有配置重新加载完成")
}
```

### 11.5 配置更新API

**更新分析规则**:

```http
POST /api/v1/analysis/rules
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "高错误率检测",
  "enabled": true,
  "type": "aggregation",
  "condition": "level == 'ERROR'",
  "action": "alert",
  "priority": 1
}

Response:
{
  "code": 0,
  "data": {
    "id": "rule-123456",
    "message": "分析规则已创建并生效"
  }
}
```

**更新CEP模式**:

```http
POST /api/v1/analysis/cep-patterns
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "连续登录失败检测",
  "enabled": true,
  "pattern": "BEGIN -> (FAIL{3,}) -> END",
  "within": "5m",
  "action": "alert"
}

Response:
{
  "code": 0,
  "data": {
    "id": "pattern-123456",
    "message": "CEP模式已创建并生效"
  }
}
```

**更新异常检测配置**:

```http
PUT /api/v1/analysis/anomaly-config
Content-Type: application/json
Authorization: Bearer <token>

{
  "enabled": true,
  "threshold": 0.85,
  "model_path": "/models/anomaly_v2.onnx",
  "window_size_minutes": 10
}

Response:
{
  "code": 0,
  "message": "异常检测配置已更新并生效"
}
```

### 11.6 YAML配置备用方案

当热更新机制不可用时，可以通过修改YAML配置文件并重启服务来更新配置：

```yaml
# configs/analysis_rules.yaml
# ✅ 支持热更新，也可以通过YAML文件更新
analysis_rules:
  - id: "rule-001"
    name: "高错误率检测"
    enabled: true
    type: "aggregation"
    condition: "level == 'ERROR'"
    action: "alert"
    priority: 1
  
  - id: "rule-002"
    name: "慢查询检测"
    enabled: true
    type: "filter"
    condition: "duration > 1000"
    action: "log"
    priority: 2

# ✅ 支持热更新，也可以通过YAML文件更新
cep_patterns:
  - id: "pattern-001"
    name: "连续登录失败"
    enabled: true
    pattern: "BEGIN -> (FAIL{3,}) -> END"
    within: "5m"
    action: "alert"

# ✅ 支持热更新，也可以通过YAML文件更新
anomaly_detection:
  enabled: true
  threshold: 0.8
  model_path: "/models/anomaly.onnx"
  window_size_minutes: 5

# ✅ 支持热更新，也可以通过YAML文件更新
query_config:
  cache_ttl: 300
  max_time_range_days: 7
  slow_query_threshold_ms: 1000
```

**更新流程**:
1. 修改YAML配置文件
2. 通过ConfigMap更新Kubernetes配置
3. 滚动重启服务（不影响Flink作业）
4. 新配置生效

```bash
# 更新ConfigMap
kubectl create configmap analysis-config \
  --from-file=configs/analysis_rules.yaml \
  --dry-run=client -o yaml | kubectl apply -f -

# 滚动重启服务
kubectl rollout restart deployment/analysis-api -n log-management
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
func (acm *AnalysisConfigManager) RegisterHook(hook ConfigHook) {
    acm.hooks = append(acm.hooks, hook)
}

// 规则验证器接口
type RuleValidator interface {
    // 验证规则
    Validate(rule *AnalysisRule) error
}

// 注册规则验证器
func (acm *AnalysisConfigManager) RegisterRuleValidator(validator RuleValidator) {
    acm.ruleValidators = append(acm.ruleValidators, validator)
}
```

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| Flink作业失败 | 中 | 高 | 自动重启+检查点恢复 |
| 状态丢失 | 低 | 高 | 增量检查点+S3持久化 |
| 查询超时 | 中 | 中 | 查询超时限制+缓存 |
| 模型推理慢 | 低 | 中 | 模型优化+批量推理 |

### 12.2 回滚方案

**Flink作业回滚**:
1. 停止当前作业
2. 从最近的检查点恢复
3. 使用旧版本JAR启动
4. 验证作业运行正常

---

## 13. 附录

### 13.1 术语表

| 术语 | 说明 |
|------|------|
| CEP | Complex Event Processing，复杂事件处理 |
| ONNX | Open Neural Network Exchange，开放神经网络交换格式 |
| Isolation Forest | 孤立森林，异常检测算法 |

### 13.2 参考文档

- [Apache Flink文档](https://flink.apache.org/docs/)
- [ONNX Runtime文档](https://onnxruntime.ai/docs/)
- [Presto文档](https://prestodb.io/docs/current/)

### 13.3 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-01-31 | v1.0 | 初稿，完整设计方案 | 系统架构团队 |

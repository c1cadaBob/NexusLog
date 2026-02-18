# 模块五：分布式追踪与诊断

> **文档版本**: v1.0  
> **创建日期**: 2026-01-29  
> **所属模块**: 模块五：分布式追踪与诊断  
> **需求编号**: 

---

**模块概述**: 

负责分布式系统的调用链追踪和智能故障诊断，支持跨服务追踪、性能分析、根因定位和故障预测能力。

**模块技术栈**:
- 追踪系统：Jaeger 1.50+ / Zipkin 2.24+ (分布式追踪)
- 追踪协议：OpenTelemetry (统一标准)
- 存储后端：Elasticsearch 8.x / Cassandra 4.x (追踪数据存储)
- 诊断引擎：Go + 规则引擎 + ML 模型 (故障诊断)
- 知识库：PostgreSQL (故障案例库)
- 配置管理：PostgreSQL + Redis 配置中心（热配置）

**模块架构**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                            分布式追踪与诊断模块整体架构                                      │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            配置中心（控制面）                                          │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ PostgreSQL   │───▶│    Redis     │───▶│   Pub/Sub    │                           │ │
│  │  │ (诊断规则/   │    │ (当前规则)   │    │ (规则变更)   │                           │ │
│  │  │  知识库)     │    │              │    │              │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────┬───────┘                           │ │
│  └────────────────────────────────────────────────────┼─────────────────────────────────┘ │
│                                                       │                                   │
│                                                       ▼                                   │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            追踪数据采集层（Tracing Collection）                        │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  OpenTelemetry SDK/Agent                                                     │     │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │     │ │
│  │  │  │ Java SDK     │  │ Go SDK       │  │ Python SDK   │  │ Node.js SDK  │   │     │ │
│  │  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │     │ │
│  │  │         └──────────────────┴──────────────────┴──────────────────┘           │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  Trace Collector (Jaeger/Zipkin)                                            │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 采样控制     │───▶│ 数据过滤     │───▶│ 批量聚合     │                 │     │ │
│  │  │  │ (Sampling)   │    │ (Filter)     │    │ (Batch)      │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  └────────────────────────────────────────┼──────────────────────────────────────────┘ │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            追踪数据存储层（Storage）                                   │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ Elasticsearch│    │  Cassandra   │    │    Redis     │                           │ │
│  │  │ (热数据7天)  │───▶│ (冷数据30天) │───▶│  (缓存层)    │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └────────────────────────────────────────┬──────────────────────────────────────────┘ │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            追踪分析层（Analysis）                                      │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  调用链分析 (Trace Analysis)                                                 │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 调用树构建   │───▶│ 性能分析     │───▶│ 依赖分析     │                 │     │ │
│  │  │  │ (Trace Tree) │    │ (Latency)    │    │ (Dependency) │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  关联分析 (Correlation)                                                      │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 日志关联     │───▶│ 指标关联     │───▶│ 事件关联     │                 │     │ │
│  │  │  │ (Log Link)   │    │ (Metric Link)│    │ (Event Link) │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            智能诊断层（Diagnosis）                                     │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  异常检测 (Anomaly Detection)                                                │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 延迟异常     │───▶│ 错误率异常   │───▶│ 流量异常     │                 │     │ │
│  │  │  │ (Latency)    │    │ (Error Rate) │    │ (Traffic)    │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  根因分析 (Root Cause Analysis)                                              │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 规则引擎     │───▶│ 图算法       │───▶│ ML 模型      │                 │     │ │
│  │  │  │ (Rule Engine)│    │ (Graph)      │    │ (ML)         │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  故障预测与修复建议 (Prediction & Solution)                                  │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 知识库匹配   │───▶│ 修复建议     │───▶│ 诊断向导     │                 │     │ │
│  │  │  │ (KB Match)   │    │ (Solution)   │    │ (Wizard)     │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            监控与可视化                                            │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                       │ │
│  │  │ 服务拓扑图   │    │ 调用链火焰图  │    │ 性能趋势图   │                       │ │
│  │  │ (Topology)   │    │ (Flame Graph)│    │ (Trend)      │                       │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                       │ │
│  └───────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**架构说明**:

1. **配置中心层**: 使用 PostgreSQL 存储诊断规则和知识库，Redis 分发当前生效规则
2. **追踪数据采集层**: OpenTelemetry SDK 多语言支持，Jaeger/Zipkin Collector 采样和聚合
3. **追踪数据存储层**: Elasticsearch 存储热数据（7天），Cassandra 存储冷数据（30天），Redis 缓存
4. **追踪分析层**: 调用链分析、性能分析、依赖分析、日志/指标/事件关联
5. **智能诊断层**: 异常检测、根因分析、故障预测、修复建议
6. **监控可视化层**: 服务拓扑图、调用链火焰图、性能趋势图

**追踪能力矩阵**:

| 能力 | 技术方案 | 延迟 | 准确率 | 覆盖率 |
|------|----------|------|--------|--------|
| 调用链追踪 | Jaeger/Zipkin | < 1s | 100% | 95% |
| 性能分析 | Span 分析 | < 2s | 100% | 95% |
| 日志关联 | Trace ID | < 500ms | 100% | 90% |
| 异常检测 | ML 模型 | < 5s | 90% | 85% |
| 根因分析 | 规则引擎 | < 10s | 80% | 70% |
| 故障预测 | LSTM | < 30s | 75% | 60% |

**数据流向**:

```
应用服务 → OpenTelemetry SDK → Collector → 存储层 → 分析层 → 诊断层 → 可视化
            ↑                                                        ↓
            └──────────────── 配置中心（热更新）─────────────────────┘
```

**需求列表**:
- 需求 5-18：分布式追踪 [MVP]
- 需求 5-19：智能故障诊断 [Phase 2]

---


#### 需求 5-18：分布式追踪 [MVP]

**用户故事**: 

作为运维工程师，我希望能够追踪分布式系统中的请求调用链，以便快速定位性能瓶颈和故障点。

**验收标准**:

1. THE Tracing_System SHALL 集成分布式追踪工具（Jaeger、Zipkin），提供服务间调用链的跟踪功能
2. WHEN 用户选择某个请求时，THE UI SHALL 展示该请求在各服务间的完整调用链路
3. THE UI SHALL 对异常堆栈提供可视化展示，自动显示异常类型和错误发生的具体代码位置
4. THE Tracing_System SHALL 支持跨系统日志关联分析，通过 Trace ID 关联不同系统的日志
5. THE UI SHALL 展示实时的日志信息流，延迟 ≤ 1 秒
6. THE Tracing_System SHALL 支持追踪数据采样（默认 1%），可配置采样率
7. THE UI SHALL 展示服务依赖拓扑图，自动发现服务间依赖关系
8. THE Tracing_System SHALL 支持 Span 级别的性能分析，识别慢调用
9. THE UI SHALL 支持按服务、操作、标签筛选追踪数据
10. THE Tracing_System SHALL 通过配置中心管理追踪配置，支持热更新

**实现方向**:

**实现方式**:

```go
// 追踪管理器
type TracingManager struct {
    collector  *TraceCollector      // 追踪收集器
    storage    TraceStorage          // 追踪存储
    analyzer   *TraceAnalyzer        // 追踪分析器
    correlator *LogCorrelator        // 日志关联器
    topology   *TopologyAnalyzer     // 拓扑分析器
    sampler    *SamplingController   // 采样控制器
    config     atomic.Value          // 配置（支持热更新）
    metrics    *TracingMetrics       // 追踪指标
}

// 追踪配置
type TracingConfig struct {
    Enabled          bool              // 是否启用追踪
    SamplingRate     float64           // 采样率（0.0-1.0）
    MaxSpansPerTrace int               // 每个 Trace 最大 Span 数
    StorageBackend   string            // 存储后端：elasticsearch/cassandra
    RetentionDays    int               // 数据保留天数
    Exporters        []ExporterConfig  // 导出器配置
}

// 导出器配置
type ExporterConfig struct {
    Type     string   // 类型：jaeger/zipkin/otlp
    Endpoint string   // 端点地址
    Enabled  bool     // 是否启用
}

// Trace 对象
type Trace struct {
    TraceID     string              // Trace ID
    SpanID      string              // Root Span ID
    ServiceName string              // 服务名称
    Operation   string              // 操作名称
    StartTime   time.Time           // 开始时间
    Duration    time.Duration       // 持续时间
    Spans       []*Span             // Span 列表
    Tags        map[string]string   // 标签
    Logs        []Log               // 日志
    Status      string              // 状态：ok/error
}

// Span 对象
type Span struct {
    SpanID      string              // Span ID
    TraceID     string              // Trace ID
    ParentID    string              // 父 Span ID
    ServiceName string              // 服务名称
    Operation   string              // 操作名称
    StartTime   time.Time           // 开始时间
    Duration    time.Duration       // 持续时间
    Tags        map[string]string   // 标签
    Logs        []Log               // 日志
    Status      string              // 状态：ok/error
    Kind        string              // 类型：client/server/producer/consumer
    Children    []*Span             // 子 Span
}

// 日志对象
type Log struct {
    Timestamp time.Time              // 时间戳
    Fields    map[string]interface{} // 字段
}

// 查询追踪
func (tm *TracingManager) QueryTrace(traceID string) (*Trace, error) {
    // 1. 从存储中查询
    trace, err := tm.storage.GetTrace(traceID)
    if err != nil {
        return nil, fmt.Errorf("查询 Trace 失败: %w", err)
    }
    
    // 2. 构建调用树
    trace.Spans = tm.buildSpanTree(trace.Spans)
    
    // 3. 关联日志
    if err := tm.correlator.CorrelateLog(trace); err != nil {
        log.Warn("关联日志失败", "trace_id", traceID, "error", err)
    }
    
    // 4. 更新服务拓扑
    if err := tm.topology.BuildTopology(trace); err != nil {
        log.Warn("更新拓扑失败", "trace_id", traceID, "error", err)
    }
    
    return trace, nil
}

// 构建 Span 树
func (tm *TracingManager) buildSpanTree(spans []*Span) []*Span {
    // 创建 Span 映射
    spanMap := make(map[string]*Span)
    for _, span := range spans {
        spanMap[span.SpanID] = span
    }
    
    // 构建树结构
    var rootSpans []*Span
    for _, span := range spans {
        if span.ParentID == "" {
            // 根 Span
            rootSpans = append(rootSpans, span)
        } else {
            // 子 Span，添加到父 Span
            if parent, ok := spanMap[span.ParentID]; ok {
                if parent.Children == nil {
                    parent.Children = []*Span{}
                }
                parent.Children = append(parent.Children, span)
            }
        }
    }
    
    return rootSpans
}

// 追踪分析器
type TraceAnalyzer struct {
    config atomic.Value
}

// 分析追踪性能
func (ta *TraceAnalyzer) AnalyzePerformance(trace *Trace) *PerformanceAnalysis {
    analysis := &PerformanceAnalysis{
        TraceID:       trace.TraceID,
        TotalDuration: trace.Duration,
        SpanCount:     len(trace.Spans),
    }
    
    // 1. 找出最慢的 Span
    var slowestSpan *Span
    var maxDuration time.Duration
    
    for _, span := range trace.Spans {
        if span.Duration > maxDuration {
            maxDuration = span.Duration
            slowestSpan = span
        }
    }
    
    if slowestSpan != nil {
        analysis.SlowestSpan = &SpanSummary{
            SpanID:      slowestSpan.SpanID,
            ServiceName: slowestSpan.ServiceName,
            Operation:   slowestSpan.Operation,
            Duration:    slowestSpan.Duration,
            Percentage:  float64(slowestSpan.Duration) / float64(trace.Duration) * 100,
        }
    }
    
    // 2. 按服务统计耗时
    serviceTime := make(map[string]time.Duration)
    for _, span := range trace.Spans {
        serviceTime[span.ServiceName] += span.Duration
    }
    
    for service, duration := range serviceTime {
        analysis.ServiceBreakdown = append(analysis.ServiceBreakdown, ServiceTime{
            ServiceName: service,
            Duration:    duration,
            Percentage:  float64(duration) / float64(trace.Duration) * 100,
        })
    }
    
    // 3. 识别错误 Span
    for _, span := range trace.Spans {
        if span.Status == "error" {
            analysis.ErrorSpans = append(analysis.ErrorSpans, &SpanSummary{
                SpanID:      span.SpanID,
                ServiceName: span.ServiceName,
                Operation:   span.Operation,
                Duration:    span.Duration,
            })
        }
    }
    
    // 4. 计算关键路径
    analysis.CriticalPath = ta.calculateCriticalPath(trace)
    
    return analysis
}

// 性能分析结果
type PerformanceAnalysis struct {
    TraceID          string
    TotalDuration    time.Duration
    SpanCount        int
    SlowestSpan      *SpanSummary
    ServiceBreakdown []ServiceTime
    ErrorSpans       []*SpanSummary
    CriticalPath     []*Span
}

// Span 摘要
type SpanSummary struct {
    SpanID      string
    ServiceName string
    Operation   string
    Duration    time.Duration
    Percentage  float64
}

// 服务耗时
type ServiceTime struct {
    ServiceName string
    Duration    time.Duration
    Percentage  float64
}

// 计算关键路径
func (ta *TraceAnalyzer) calculateCriticalPath(trace *Trace) []*Span {
    // 使用深度优先搜索找出最长路径
    var criticalPath []*Span
    var maxPathDuration time.Duration
    
    var dfs func(span *Span, path []*Span, duration time.Duration)
    dfs = func(span *Span, path []*Span, duration time.Duration) {
        path = append(path, span)
        duration += span.Duration
        
        if len(span.Children) == 0 {
            // 叶子节点，检查是否是最长路径
            if duration > maxPathDuration {
                maxPathDuration = duration
                criticalPath = make([]*Span, len(path))
                copy(criticalPath, path)
            }
            return
        }
        
        // 递归处理子节点
        for _, child := range span.Children {
            dfs(child, path, duration)
        }
    }
    
    // 从根 Span 开始搜索
    for _, span := range trace.Spans {
        if span.ParentID == "" {
            dfs(span, nil, 0)
        }
    }
    
    return criticalPath
}

// 日志关联器
type LogCorrelator struct {
    logStorage LogStorage // 日志存储接口
    cache      *lru.Cache // LRU 缓存
}

// 关联日志
func (lc *LogCorrelator) CorrelateLog(trace *Trace) error {
    // 1. 通过 Trace ID 查询关联日志
    logs, err := lc.logStorage.QueryByTraceID(trace.TraceID)
    if err != nil {
        return fmt.Errorf("查询日志失败: %w", err)
    }
    
    // 2. 将日志关联到对应的 Span
    spanMap := make(map[string]*Span)
    for _, span := range trace.Spans {
        spanMap[span.SpanID] = span
    }
    
    for _, log := range logs {
        // 从日志中提取 Span ID
        spanID, ok := log.Fields["span_id"].(string)
        if !ok {
            // 没有 Span ID，关联到根 Span
            spanID = trace.SpanID
        }
        
        // 添加到对应的 Span
        if span, exists := spanMap[spanID]; exists {
            span.Logs = append(span.Logs, Log{
                Timestamp: log.Timestamp,
                Fields: map[string]interface{}{
                    "level":   log.Level,
                    "message": log.Message,
                    "source":  log.Source,
                },
            })
        }
    }
    
    return nil
}

// 服务拓扑分析器
type TopologyAnalyzer struct {
    graph *ServiceGraph // 服务依赖图
    mu    sync.RWMutex
}

// 服务依赖图
type ServiceGraph struct {
    Nodes map[string]*ServiceNode // 服务节点
    Edges map[string]*ServiceEdge // 服务边
}

// 服务节点
type ServiceNode struct {
    Name       string        // 服务名称
    CallCount  int64         // 调用次数
    ErrorCount int64         // 错误次数
    AvgLatency time.Duration // 平均延迟
    LastSeen   time.Time     // 最后出现时间
}

// 服务边（调用关系）
type ServiceEdge struct {
    From       string        // 源服务
    To         string        // 目标服务
    CallCount  int64         // 调用次数
    ErrorCount int64         // 错误次数
    AvgLatency time.Duration // 平均延迟
}

// 构建服务拓扑
func (ta *TopologyAnalyzer) BuildTopology(trace *Trace) error {
    ta.mu.Lock()
    defer ta.mu.Unlock()
    
    // 遍历所有 Span，构建服务依赖关系
    for _, span := range trace.Spans {
        // 更新服务节点
        node, exists := ta.graph.Nodes[span.ServiceName]
        if !exists {
            node = &ServiceNode{
                Name: span.ServiceName,
            }
            ta.graph.Nodes[span.ServiceName] = node
        }
        
        node.CallCount++
        if span.Status == "error" {
            node.ErrorCount++
        }
        node.AvgLatency = (node.AvgLatency*time.Duration(node.CallCount-1) + span.Duration) / time.Duration(node.CallCount)
        node.LastSeen = time.Now()
        
        // 如果有父 Span，创建服务边
        if span.ParentID != "" {
            // 查找父 Span
            for _, parentSpan := range trace.Spans {
                if parentSpan.SpanID == span.ParentID {
                    // 创建边
                    edgeKey := fmt.Sprintf("%s->%s", parentSpan.ServiceName, span.ServiceName)
                    edge, exists := ta.graph.Edges[edgeKey]
                    if !exists {
                        edge = &ServiceEdge{
                            From: parentSpan.ServiceName,
                            To:   span.ServiceName,
                        }
                        ta.graph.Edges[edgeKey] = edge
                    }
                    
                    edge.CallCount++
                    if span.Status == "error" {
                        edge.ErrorCount++
                    }
                    edge.AvgLatency = (edge.AvgLatency*time.Duration(edge.CallCount-1) + span.Duration) / time.Duration(edge.CallCount)
                    
                    break
                }
            }
        }
    }
    
    return nil
}

// 获取服务拓扑
func (ta *TopologyAnalyzer) GetTopology() *ServiceGraph {
    ta.mu.RLock()
    defer ta.mu.RUnlock()
    
    // 深拷贝
    graph := &ServiceGraph{
        Nodes: make(map[string]*ServiceNode),
        Edges: make(map[string]*ServiceEdge),
    }
    
    for k, v := range ta.graph.Nodes {
        nodeCopy := *v
        graph.Nodes[k] = &nodeCopy
    }
    
    for k, v := range ta.graph.Edges {
        edgeCopy := *v
        graph.Edges[k] = &edgeCopy
    }
    
    return graph
}

// 采样控制器
type SamplingController struct {
    config atomic.Value // 采样配置
}

// 采样配置
type SamplingConfig struct {
    DefaultRate    float64            // 默认采样率
    ServiceRates   map[string]float64 // 服务级别采样率
    OperationRates map[string]float64 // 操作级别采样率
    ErrorSampling  bool               // 是否对错误 100% 采样
}

// 判断是否应该采样
func (sc *SamplingController) ShouldSample(serviceName, operation string, isError bool) bool {
    config := sc.config.Load().(*SamplingConfig)
    
    // 错误 100% 采样
    if isError && config.ErrorSampling {
        return true
    }
    
    // 检查操作级别采样率
    if rate, ok := config.OperationRates[operation]; ok {
        return rand.Float64() < rate
    }
    
    // 检查服务级别采样率
    if rate, ok := config.ServiceRates[serviceName]; ok {
        return rand.Float64() < rate
    }
    
    // 使用默认采样率
    return rand.Float64() < config.DefaultRate
}
```

**关键实现点**:

1. 使用 OpenTelemetry SDK 集成 Jaeger/Zipkin，支持多种导出器
2. 构建 Span 树结构，支持递归遍历和可视化展示
3. 实现性能分析器，自动识别最慢 Span 和关键路径
4. 通过 Trace ID 关联日志，构建完整的调用上下文
5. 自动构建服务依赖拓扑图，实时更新服务调用关系
6. 支持多级采样控制（服务级、操作级、错误级），错误 100% 采样
7. 使用 atomic.Value 实现配置热更新，无需重启服务

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| enabled | bool | true | 是否启用追踪 |
| sampling_rate | float | 0.01 | 默认采样率（1%） |
| service_sampling_rates | map | {} | 服务级别采样率 |
| operation_sampling_rates | map | {} | 操作级别采样率 |
| error_sampling | bool | true | 错误是否 100% 采样 |
| max_spans_per_trace | int | 1000 | 每个 Trace 最大 Span 数 |
| storage_backend | string | "elasticsearch" | 存储后端 |
| retention_days | int | 7 | 数据保留天数 |
| exporters | array | [] | 导出器配置列表 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一次追踪采样判断）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志并发送告警

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值和采样统计
4. THE System SHALL 记录所有配置变更的审计日志，包括变更前后的配置对比
5. WHEN 采样率变更时，THE System SHALL 平滑过渡，避免突然的流量变化

---


#### 需求 5-19：智能故障诊断 [Phase 2]

**用户故事**: 

作为运维工程师，我希望系统能够自动诊断故障原因并提供修复建议，以便快速解决问题并减少人工排查时间。

**验收标准**:

1. THE Diagnosis_System SHALL 自动检测异常模式（延迟异常、错误率异常、流量异常），检测准确率 ≥ 90%
2. WHEN 检测到异常时，THE Diagnosis_System SHALL 在 10 秒内完成根因分析
3. THE Diagnosis_System SHALL 使用规则引擎、图算法和机器学习模型进行多维度分析
4. THE UI SHALL 展示故障传播路径，可视化显示故障如何在服务间传播
5. THE Diagnosis_System SHALL 从知识库中匹配相似故障案例，匹配准确率 ≥ 80%
6. THE UI SHALL 提供具体的修复建议和操作步骤
7. THE Diagnosis_System SHALL 支持故障预测，提前 5-30 分钟预警潜在故障
8. THE Diagnosis_System SHALL 学习历史故障案例，持续优化诊断准确率
9. THE UI SHALL 提供诊断向导，引导用户逐步排查问题
10. THE Diagnosis_System SHALL 通过配置中心管理诊断规则，支持热更新

**实现方向**:

**实现方式**:

```go
// 智能诊断系统
type DiagnosisSystem struct {
    detector    *AnomalyDetector     // 异常检测器
    analyzer    *RootCauseAnalyzer   // 根因分析器
    predictor   *FaultPredictor      // 故障预测器
    knowledgeDB *KnowledgeBase       // 知识库
    ruleEngine  *RuleEngine          // 规则引擎
    mlModel     *MLModel             // 机器学习模型
    config      atomic.Value         // 配置（支持热更新）
    metrics     *DiagnosisMetrics    // 诊断指标
}

// 诊断配置
type DiagnosisConfig struct {
    Enabled              bool              // 是否启用诊断
    AnomalyThresholds    AnomalyThresholds // 异常阈值
    RootCauseAlgorithm   string            // 根因算法：rule/graph/ml/hybrid
    PredictionEnabled    bool              // 是否启用故障预测
    PredictionWindow     int               // 预测时间窗口（分钟）
    KnowledgeDBEnabled   bool              // 是否启用知识库
    LearningEnabled      bool              // 是否启用学习
}

// 异常阈值
type AnomalyThresholds struct {
    LatencyP95       float64 // P95 延迟阈值（毫秒）
    LatencyP99       float64 // P99 延迟阈值（毫秒）
    ErrorRate        float64 // 错误率阈值（%）
    TrafficDeviation float64 // 流量偏差阈值（%）
}

// 异常检测器
type AnomalyDetector struct {
    config    atomic.Value
    baseline  *BaselineManager  // 基线管理器
    detector  *StatDetector     // 统计检测器
}

// 检测异常
func (ad *AnomalyDetector) DetectAnomalies(metrics *ServiceMetrics) []*Anomaly {
    var anomalies []*Anomaly
    
    // 1. 延迟异常检测
    if latencyAnomaly := ad.detectLatencyAnomaly(metrics); latencyAnomaly != nil {
        anomalies = append(anomalies, latencyAnomaly)
    }
    
    // 2. 错误率异常检测
    if errorAnomaly := ad.detectErrorRateAnomaly(metrics); errorAnomaly != nil {
        anomalies = append(anomalies, errorAnomaly)
    }
    
    // 3. 流量异常检测
    if trafficAnomaly := ad.detectTrafficAnomaly(metrics); trafficAnomaly != nil {
        anomalies = append(anomalies, trafficAnomaly)
    }
    
    return anomalies
}

// 检测延迟异常
func (ad *AnomalyDetector) detectLatencyAnomaly(metrics *ServiceMetrics) *Anomaly {
    config := ad.config.Load().(*DiagnosisConfig)
    
    // 获取基线
    baseline := ad.baseline.GetBaseline(metrics.ServiceName)
    
    // 计算偏差
    p95Deviation := (metrics.LatencyP95 - baseline.LatencyP95) / baseline.LatencyP95 * 100
    p99Deviation := (metrics.LatencyP99 - baseline.LatencyP99) / baseline.LatencyP99 * 100
    
    // 判断是否异常
    if p95Deviation > config.AnomalyThresholds.LatencyP95 || 
       p99Deviation > config.AnomalyThresholds.LatencyP99 {
        return &Anomaly{
            Type:        "latency",
            ServiceName: metrics.ServiceName,
            Severity:    ad.calculateSeverity(p95Deviation, p99Deviation),
            Description: fmt.Sprintf("延迟异常：P95 偏差 %.2f%%, P99 偏差 %.2f%%", p95Deviation, p99Deviation),
            Timestamp:   time.Now(),
            Metrics: map[string]float64{
                "p95_deviation": p95Deviation,
                "p99_deviation": p99Deviation,
                "current_p95":   metrics.LatencyP95,
                "current_p99":   metrics.LatencyP99,
                "baseline_p95":  baseline.LatencyP95,
                "baseline_p99":  baseline.LatencyP99,
            },
        }
    }
    
    return nil
}

// 检测错误率异常
func (ad *AnomalyDetector) detectErrorRateAnomaly(metrics *ServiceMetrics) *Anomaly {
    config := ad.config.Load().(*DiagnosisConfig)
    
    // 计算错误率
    errorRate := float64(metrics.ErrorCount) / float64(metrics.TotalCount) * 100
    
    // 获取基线
    baseline := ad.baseline.GetBaseline(metrics.ServiceName)
    
    // 判断是否异常
    if errorRate > config.AnomalyThresholds.ErrorRate || 
       errorRate > baseline.ErrorRate*2 {
        return &Anomaly{
            Type:        "error_rate",
            ServiceName: metrics.ServiceName,
            Severity:    ad.calculateErrorSeverity(errorRate),
            Description: fmt.Sprintf("错误率异常：当前 %.2f%%, 基线 %.2f%%", errorRate, baseline.ErrorRate),
            Timestamp:   time.Now(),
            Metrics: map[string]float64{
                "current_error_rate": errorRate,
                "baseline_error_rate": baseline.ErrorRate,
                "error_count":        float64(metrics.ErrorCount),
                "total_count":        float64(metrics.TotalCount),
            },
        }
    }
    
    return nil
}

// 检测流量异常
func (ad *AnomalyDetector) detectTrafficAnomaly(metrics *ServiceMetrics) *Anomaly {
    config := ad.config.Load().(*DiagnosisConfig)
    
    // 获取基线
    baseline := ad.baseline.GetBaseline(metrics.ServiceName)
    
    // 计算流量偏差
    trafficDeviation := math.Abs(float64(metrics.RequestCount-baseline.RequestCount)) / float64(baseline.RequestCount) * 100
    
    // 判断是否异常
    if trafficDeviation > config.AnomalyThresholds.TrafficDeviation {
        return &Anomaly{
            Type:        "traffic",
            ServiceName: metrics.ServiceName,
            Severity:    "medium",
            Description: fmt.Sprintf("流量异常：偏差 %.2f%%", trafficDeviation),
            Timestamp:   time.Now(),
            Metrics: map[string]float64{
                "traffic_deviation":   trafficDeviation,
                "current_request_count": float64(metrics.RequestCount),
                "baseline_request_count": float64(baseline.RequestCount),
            },
        }
    }
    
    return nil
}

// 异常对象
type Anomaly struct {
    Type        string             // 异常类型：latency/error_rate/traffic
    ServiceName string             // 服务名称
    Severity    string             // 严重程度：low/medium/high/critical
    Description string             // 描述
    Timestamp   time.Time          // 时间戳
    Metrics     map[string]float64 // 指标数据
}

// 根因分析器
type RootCauseAnalyzer struct {
    ruleEngine *RuleEngine       // 规则引擎
    graphAlgo  *GraphAlgorithm   // 图算法
    mlModel    *MLModel          // 机器学习模型
    topology   *TopologyAnalyzer // 拓扑分析器
    config     atomic.Value
}

// 分析根因
func (rca *RootCauseAnalyzer) AnalyzeRootCause(anomaly *Anomaly) (*RootCauseResult, error) {
    config := rca.config.Load().(*DiagnosisConfig)
    
    result := &RootCauseResult{
        Anomaly:   anomaly,
        Timestamp: time.Now(),
    }
    
    // 根据配置选择分析算法
    switch config.RootCauseAlgorithm {
    case "rule":
        // 使用规则引擎
        causes := rca.ruleEngine.Analyze(anomaly)
        result.PossibleCauses = causes
        
    case "graph":
        // 使用图算法（基于服务依赖图）
        causes := rca.graphAlgo.FindRootCause(anomaly, rca.topology.GetTopology())
        result.PossibleCauses = causes
        
    case "ml":
        // 使用机器学习模型
        causes := rca.mlModel.Predict(anomaly)
        result.PossibleCauses = causes
        
    case "hybrid":
        // 混合方法：结合规则、图算法和 ML
        ruleCauses := rca.ruleEngine.Analyze(anomaly)
        graphCauses := rca.graphAlgo.FindRootCause(anomaly, rca.topology.GetTopology())
        mlCauses := rca.mlModel.Predict(anomaly)
        
        // 融合结果（加权投票）
        result.PossibleCauses = rca.fuseCauses(ruleCauses, graphCauses, mlCauses)
    }
    
    // 按置信度排序
    sort.Slice(result.PossibleCauses, func(i, j int) bool {
        return result.PossibleCauses[i].Confidence > result.PossibleCauses[j].Confidence
    })
    
    // 分析故障传播路径
    result.PropagationPath = rca.analyzePropagationPath(anomaly)
    
    return result, nil
}

// 根因结果
type RootCauseResult struct {
    Anomaly         *Anomaly         // 异常
    PossibleCauses  []*PossibleCause // 可能的根因列表
    PropagationPath []*PropagationNode // 故障传播路径
    Timestamp       time.Time        // 时间戳
}

// 可能的根因
type PossibleCause struct {
    Type        string  // 类型：service/database/network/external
    ServiceName string  // 服务名称
    Component   string  // 组件名称
    Description string  // 描述
    Confidence  float64 // 置信度（0-1）
    Evidence    []string // 证据列表
}

// 故障传播节点
type PropagationNode struct {
    ServiceName string    // 服务名称
    Timestamp   time.Time // 时间戳
    Impact      string    // 影响：source/propagated/affected
}

// 分析故障传播路径
func (rca *RootCauseAnalyzer) analyzePropagationPath(anomaly *Anomaly) []*PropagationNode {
    // 获取服务拓扑
    topology := rca.topology.GetTopology()
    
    // 使用 BFS 追踪故障传播
    var path []*PropagationNode
    visited := make(map[string]bool)
    queue := []string{anomaly.ServiceName}
    
    for len(queue) > 0 {
        current := queue[0]
        queue = queue[1:]
        
        if visited[current] {
            continue
        }
        visited[current] = true
        
        // 添加到路径
        node := topology.Nodes[current]
        if node != nil {
            path = append(path, &PropagationNode{
                ServiceName: current,
                Timestamp:   node.LastSeen,
                Impact:      rca.determineImpact(current, anomaly.ServiceName),
            })
            
            // 查找下游服务
            for _, edge := range topology.Edges {
                if edge.From == current && !visited[edge.To] {
                    queue = append(queue, edge.To)
                }
            }
        }
    }
    
    return path
}

// 故障预测器
type FaultPredictor struct {
    model   *LSTMModel        // LSTM 模型
    history *MetricsHistory   // 历史指标
    config  atomic.Value
}

// 预测故障
func (fp *FaultPredictor) PredictFault(serviceName string) (*FaultPrediction, error) {
    config := fp.config.Load().(*DiagnosisConfig)
    if !config.PredictionEnabled {
        return nil, nil
    }
    
    // 获取历史指标
    history := fp.history.GetHistory(serviceName, time.Hour)
    
    // 使用 LSTM 模型预测
    prediction := fp.model.Predict(history)
    
    // 判断是否有故障风险
    if prediction.FaultProbability > 0.7 {
        return &FaultPrediction{
            ServiceName:       serviceName,
            FaultProbability:  prediction.FaultProbability,
            PredictedTime:     time.Now().Add(time.Duration(prediction.TimeToFault) * time.Minute),
            PredictedType:     prediction.FaultType,
            Confidence:        prediction.Confidence,
            RecommendedAction: fp.getRecommendedAction(prediction),
        }, nil
    }
    
    return nil, nil
}

// 故障预测结果
type FaultPrediction struct {
    ServiceName       string    // 服务名称
    FaultProbability  float64   // 故障概率（0-1）
    PredictedTime     time.Time // 预测故障时间
    PredictedType     string    // 预测故障类型
    Confidence        float64   // 置信度（0-1）
    RecommendedAction string    // 推荐操作
}

// 知识库
type KnowledgeBase struct {
    db     *sql.DB
    cache  *lru.Cache
    config atomic.Value
}

// 匹配相似案例
func (kb *KnowledgeBase) MatchSimilarCases(anomaly *Anomaly) ([]*KnowledgeCase, error) {
    // 1. 从缓存中查找
    cacheKey := kb.generateCacheKey(anomaly)
    if cached, ok := kb.cache.Get(cacheKey); ok {
        return cached.([]*KnowledgeCase), nil
    }
    
    // 2. 从数据库查询
    query := `
        SELECT id, title, description, root_cause, solution, similarity
        FROM knowledge_cases
        WHERE type = $1 AND service_name = $2
        ORDER BY similarity DESC
        LIMIT 5
    `
    
    rows, err := kb.db.Query(query, anomaly.Type, anomaly.ServiceName)
    if err != nil {
        return nil, fmt.Errorf("查询知识库失败: %w", err)
    }
    defer rows.Close()
    
    var cases []*KnowledgeCase
    for rows.Next() {
        var c KnowledgeCase
        if err := rows.Scan(&c.ID, &c.Title, &c.Description, &c.RootCause, &c.Solution, &c.Similarity); err != nil {
            continue
        }
        cases = append(cases, &c)
    }
    
    // 3. 缓存结果
    kb.cache.Add(cacheKey, cases)
    
    return cases, nil
}

// 知识案例
type KnowledgeCase struct {
    ID          int64   // 案例 ID
    Title       string  // 标题
    Description string  // 描述
    RootCause   string  // 根因
    Solution    string  // 解决方案
    Similarity  float64 // 相似度（0-1）
    Steps       []string // 操作步骤
}

// 学习新案例
func (kb *KnowledgeBase) LearnCase(anomaly *Anomaly, rootCause *RootCauseResult, solution string) error {
    // 插入新案例到知识库
    query := `
        INSERT INTO knowledge_cases (type, service_name, description, root_cause, solution, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
    `
    
    _, err := kb.db.Exec(query,
        anomaly.Type,
        anomaly.ServiceName,
        anomaly.Description,
        rootCause.PossibleCauses[0].Description,
        solution,
        time.Now(),
    )
    
    return err
}
```

**关键实现点**:

1. 使用多维度异常检测（延迟、错误率、流量），基于统计方法和基线对比
2. 实现混合根因分析算法，结合规则引擎、图算法和机器学习模型
3. 使用 BFS 算法追踪故障传播路径，可视化故障影响范围
4. 使用 LSTM 模型进行故障预测，提前 5-30 分钟预警
5. 构建知识库系统，支持相似案例匹配和持续学习
6. 使用 LRU 缓存优化知识库查询性能
7. 支持诊断规则和阈值的热更新，无需重启服务

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| enabled | bool | true | 是否启用诊断 |
| latency_p95_threshold | float | 50.0 | P95 延迟阈值（%） |
| latency_p99_threshold | float | 100.0 | P99 延迟阈值（%） |
| error_rate_threshold | float | 5.0 | 错误率阈值（%） |
| traffic_deviation_threshold | float | 30.0 | 流量偏差阈值（%） |
| root_cause_algorithm | string | "hybrid" | 根因算法 |
| prediction_enabled | bool | true | 是否启用故障预测 |
| prediction_window | int | 30 | 预测时间窗口（分钟） |
| knowledge_db_enabled | bool | true | 是否启用知识库 |
| learning_enabled | bool | true | 是否启用学习 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一次异常检测）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志并发送告警

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值和诊断统计
4. THE System SHALL 记录所有配置变更的审计日志，包括变更前后的配置对比
5. WHEN 阈值变更时，THE System SHALL 重新评估当前指标，避免误报或漏报

---


### API 接口汇总

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-5-155 | 查询追踪列表 | Tracing | GET | /api/v1/traces | tracing.read | Query: time_range, service, status | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-5-156 | 获取追踪详情 | Tracing | GET | /api/v1/traces/{traceId} | tracing.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-5-157 | 获取Span列表 | Tracing | GET | /api/v1/traces/{traceId}/spans | tracing.read | 无 | {code:0,data:[...]} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-5-158 | 获取调用树 | Tracing | GET | /api/v1/traces/{traceId}/tree | tracing.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-5-159 | 获取关联日志 | Tracing | GET | /api/v1/traces/{traceId}/logs | tracing.read | 无 | {code:0,data:[...]} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-5-160 | 获取性能分析 | Tracing | GET | /api/v1/traces/{traceId}/analysis | tracing.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-5-161 | 获取服务拓扑图 | Topology | GET | /api/v1/topology | topology.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-5-162 | 获取服务列表 | Topology | GET | /api/v1/topology/services | topology.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-5-163 | 获取服务详情 | Topology | GET | /api/v1/topology/services/{serviceName} | topology.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-5-164 | 获取服务依赖 | Topology | GET | /api/v1/topology/services/{serviceName}/dependencies | topology.read | 无 | {code:0,data:[...]} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-5-165 | 获取服务调用关系 | Topology | GET | /api/v1/topology/edges | topology.read | Query: time_range | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-5-166 | 获取采样配置 | Tracing | GET | /api/v1/tracing/sampling/config | tracing.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-5-167 | 更新采样配置 | Tracing | PUT | /api/v1/tracing/sampling/config | tracing.write | Body: sampling_config | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-5-168 | 获取采样统计 | Tracing | GET | /api/v1/tracing/sampling/stats | tracing.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-5-169 | 查询异常列表 | Diagnosis | GET | /api/v1/diagnosis/anomalies | diagnosis.read | Query: time_range, severity | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-5-170 | 获取异常详情 | Diagnosis | GET | /api/v1/diagnosis/anomalies/{anomalyId} | diagnosis.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-5-171 | 触发根因分析 | Diagnosis | POST | /api/v1/diagnosis/anomalies/{anomalyId}/analyze | diagnosis.write | 无 | {code:0,data:{task_id:"task-1"}} | 200/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-5-172 | 获取根因分析结果 | Diagnosis | GET | /api/v1/diagnosis/anomalies/{anomalyId}/root-cause | diagnosis.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-5-173 | 获取故障传播路径 | Diagnosis | GET | /api/v1/diagnosis/anomalies/{anomalyId}/propagation | diagnosis.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-5-174 | 获取故障预测列表 | Diagnosis | GET | /api/v1/diagnosis/predictions | diagnosis.read | Query: time_range | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-5-175 | 获取服务故障预测 | Diagnosis | GET | /api/v1/diagnosis/predictions/{serviceName} | diagnosis.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-5-176 | 触发故障预测 | Diagnosis | POST | /api/v1/diagnosis/predictions/{serviceName}/trigger | diagnosis.write | 无 | {code:0,data:{task_id:"task-1"}} | 200/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-5-177 | 查询知识案例 | Knowledge | GET | /api/v1/diagnosis/knowledge/cases | knowledge.read | Query: keyword, category | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | - | 支持分页 |
| API-5-178 | 获取案例详情 | Knowledge | GET | /api/v1/diagnosis/knowledge/cases/{caseId} | knowledge.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-5-179 | 创建知识案例 | Knowledge | POST | /api/v1/diagnosis/knowledge/cases | knowledge.write | Body: case_data | {code:0,data:{id:"case-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-5-180 | 更新知识案例 | Knowledge | PUT | /api/v1/diagnosis/knowledge/cases/{caseId} | knowledge.write | Body: case_data | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-5-181 | 删除知识案例 | Knowledge | DELETE | /api/v1/diagnosis/knowledge/cases/{caseId} | knowledge.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-5-182 | 匹配相似案例 | Knowledge | POST | /api/v1/diagnosis/knowledge/match | knowledge.read | Body: {symptoms} | {code:0,data:[...]} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-5-183 | 获取诊断配置 | Diagnosis | GET | /api/v1/diagnosis/config | diagnosis.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-5-184 | 更新诊断配置 | Diagnosis | PUT | /api/v1/diagnosis/config | diagnosis.write | Body: config_data | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-5-185 | 获取异常阈值配置 | Diagnosis | GET | /api/v1/diagnosis/config/thresholds | diagnosis.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-5-186 | 更新异常阈值配置 | Diagnosis | PUT | /api/v1/diagnosis/config/thresholds | diagnosis.write | Body: thresholds | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-5-187 | 获取诊断统计 | Diagnosis | GET | /api/v1/diagnosis/stats | diagnosis.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-5-188 | 获取诊断准确率 | Diagnosis | GET | /api/v1/diagnosis/stats/accuracy | diagnosis.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-5-189 | 获取诊断性能指标 | Diagnosis | GET | /api/v1/diagnosis/stats/performance | diagnosis.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |

---



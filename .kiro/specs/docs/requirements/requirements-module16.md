# 模块十六：高级功能补充

> **文档版本**: v1.0  
> **创建日期**: 2026-01-29  
> **所属模块**: 模块十六：高级功能补充 
> **需求编号**: 

---

**模块概述**: 

本模块提供企业级日志管理系统的高级功能补充，包括日志事件关联分析、语义理解、数据血缘追踪、审计取证、系统健康评分、日志采样与流量控制、模板管理、质量评估、智能路由、压缩策略管理、标准化导出、脱敏审计和异常自动修复等功能。这些功能面向安全分析师、数据治理专员、合规官、系统架构师等高级用户，提供更深层次的日志分析和管理能力。

**模块技术栈**:
- 事件关联引擎：Apache Flink 1.17+ (流式处理)
- 语义分析：spaCy 3.x / BERT (NLP)
- 知识图谱：Neo4j 5.x (图数据库)
- 数据血缘：Apache Atlas 2.x (元数据管理)
- 机器学习：TensorFlow 2.x / PyTorch 2.x (异常检测)
- 规则引擎：Drools 8.x (业务规则)
- 时序分析：InfluxDB 2.x (时序数据库)
- 配置管理：PostgreSQL + Redis 配置中心（热配置）

**模块架构**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              高级功能补充模块整体架构                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            配置中心（控制面）                                          │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ PostgreSQL   │───▶│    Redis     │───▶│   Pub/Sub    │                           │ │
│  │  │ (规则配置)   │    │ (当前规则)   │    │ (变更通知)   │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────┬───────┘                           │ │
│  └────────────────────────────────────────────────────┼─────────────────────────────────┘ │
│                                                       │                                   │
│                                                       ▼                                   │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         事件关联引擎（Correlation Engine）                             │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ Flink Stream │───▶│ 规则匹配器    │───▶│ 关联图谱     │                           │ │
│  │  │ (流式处理)   │    │ (Drools)     │    │ (Neo4j)      │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └───────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                          │                                                 │
│                                          ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         语义分析引擎（Semantic Engine）                                │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ NLP 处理器   │───▶│ 实体识别     │───▶│ 知识图谱     │                           │ │
│  │  │ (spaCy/BERT) │    │ (NER)        │    │ (Neo4j)      │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └───────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                          │                                                 │
│                                          ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         数据血缘追踪（Lineage Tracker）                                │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ 元数据采集    │───▶│ 血缘分析     │───▶│ 影响分析     │                           │ │
│  │  │ (Atlas)      │    │ (Graph)      │    │ (Impact)     │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └───────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                          │                                                 │
│                                          ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         审计取证系统（Forensics System）                               │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ 证据保全     │───▶│ 时间线重建    │───▶│ 取证报告     │                           │ │
│  │  │ (Immutable)  │    │ (Timeline)   │    │ (Report)     │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └───────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                          │                                                 │
│                                          ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         健康评分系统（Health Scoring）                                 │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ 指标采集     │───▶│ 评分计算     │───▶│ 趋势分析     │                           │ │
│  │  │ (Metrics)    │    │ (Scoring)    │    │ (Trend)      │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

**架构说明**:

1. **配置中心层**: 使用 PostgreSQL 存储规则配置，Redis 分发当前规则，通过 Pub/Sub 实现配置热更新
2. **事件关联引擎**: 使用 Flink 流式处理，Drools 规则匹配，Neo4j 存储关联图谱
3. **语义分析引擎**: 使用 spaCy/BERT 进行 NLP 处理，实体识别，构建知识图谱
4. **数据血缘追踪**: 使用 Apache Atlas 采集元数据，图数据库分析血缘关系，评估影响范围
5. **审计取证系统**: 证据保全、时间线重建、生成取证报告
6. **健康评分系统**: 采集多维度指标，计算综合健康评分，分析趋势

**数据流向**:

```
日志流 → 事件关联 → 语义分析 → 知识图谱 → 审计取证 → 健康评分
         ↑                                              ↓
         └──────────────── 配置中心（热更新）─────────────┘
```

**需求列表**:
- 需求 16-56：日志事件关联引擎 [Phase 2]
- 需求 16-57：日志语义分析 [Phase 3]
- 需求 16-58：日志数据血缘追踪 [Phase 3]
- 需求 16-59：日志审计与取证 [Phase 3]
- 需求 16-60：系统健康评分 [Phase 2]
- 需求 16-61：日志采样与流量控制 [Phase 2]
- 需求 16-62：日志模板管理 [Phase 2]
- 需求 16-63：日志质量评估 [Phase 2]
- 需求 16-64：智能日志路由 [Phase 2]
- 需求 16-65：日志压缩策略管理 [Phase 2]
- 需求 16-66：日志标准化导出 [Phase 2]
- 需求 16-67：日志脱敏审计 [Phase 3]
- 需求 16-68：日志异常自动修复 [Phase 3]
- 需求 16-69：日志成本优化 [Phase 3]
- 需求 16-70：日志智能推荐 [Phase 3]

---

#### 需求 16-56: 日志事件关联引擎 [Phase 2]

**用户故事**:

作为安全分析师，我希望系统能够自动关联相关的日志事件，以便发现复杂的攻击模式和业务异常。

**验收标准**:

1. THE Log_Analyzer SHALL 支持基于时间窗口（1分钟-24小时可配置）的事件关联分析
2. THE Log_Analyzer SHALL 支持基于实体关系（用户、IP、会话ID）的事件关联
3. THE Log_Analyzer SHALL 支持基于因果关系的事件关联，识别事件之间的依赖关系
4. THE System SHALL 支持定义复杂的关联规则，识别多步骤攻击（如暴力破解→权限提升→数据窃取）
5. THE System SHALL 支持定义级联故障关联规则，识别故障传播路径
6. THE Dashboard SHALL 展示关联事件的可视化图谱，使用力导向图展示事件关系
7. THE Log_Analyzer SHALL 支持基于机器学习的自动关联发现，识别隐藏的事件模式
8. WHEN 检测到高风险关联事件（风险评分 > 80）时，THE System SHALL 自动生成安全告警
9. THE System SHALL 记录关联分析的历史结果，保留期至少 90 天
10. THE System SHALL 通过配置中心管理关联规则，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/analyzer/correlation/engine.go
package correlation

import (
    "context"
    "time"
    "github.com/apache/flink-go"
    "github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// 事件关联引擎
type CorrelationEngine struct {
    config        atomic.Value      // 配置（支持热更新）
    flinkEnv      *flink.StreamExecutionEnvironment
    neo4jDriver   neo4j.DriverWithContext
    ruleEngine    *RuleEngine
    mlModel       *MLCorrelationModel
    graphBuilder  *EventGraphBuilder
    alertManager  *AlertManager
    auditLogger   *AuditLogger
}

// 关联配置
type CorrelationConfig struct {
    TimeWindows      []TimeWindow      // 时间窗口配置
    EntityTypes      []string          // 实体类型
    CorrelationRules []CorrelationRule // 关联规则
    MLEnabled        bool              // 是否启用机器学习
    RiskThreshold    float64           // 风险阈值
    RetentionDays    int               // 保留天数
}

// 时间窗口
type TimeWindow struct {
    Name     string        // 窗口名称
    Duration time.Duration // 窗口大小
    Slide    time.Duration // 滑动步长
}

// 关联规则
type CorrelationRule struct {
    ID          string              // 规则ID
    Name        string              // 规则名称
    Description string              // 规则描述
    Pattern     []EventPattern      // 事件模式
    TimeWindow  time.Duration       // 时间窗口
    Conditions  []Condition         // 关联条件
    RiskScore   float64             // 风险评分
    Enabled     bool                // 是否启用
}

// 事件模式
type EventPattern struct {
    EventType  string            // 事件类型
    Conditions map[string]string // 匹配条件
    Sequence   int               // 序列号（用于多步骤攻击）
}

// 关联事件
type CorrelatedEvent struct {
    ID            string                 // 关联事件ID
    Events        []*LogEntry            // 关联的日志事件
    CorrelationType string               // 关联类型：temporal/entity/causal
    RiskScore     float64                // 风险评分
    Entities      map[string]string      // 关联实体
    Timeline      []time.Time            // 事件时间线
    Graph         *EventGraph            // 事件关联图
    Metadata      map[string]interface{} // 元数据
    CreatedAt     time.Time              // 创建时间
}

// 事件图
type EventGraph struct {
    Nodes []*EventNode // 事件节点
    Edges []*EventEdge // 事件边
}

// 事件节点
type EventNode struct {
    ID        string                 // 节点ID
    Event     *LogEntry              // 日志事件
    Type      string                 // 节点类型
    Metadata  map[string]interface{} // 元数据
}

// 事件边
type EventEdge struct {
    From         string  // 源节点ID
    To           string  // 目标节点ID
    RelationType string  // 关系类型：temporal/causal/entity
    Weight       float64 // 权重
}

// 创建事件关联引擎
func NewCorrelationEngine(config *CorrelationConfig) (*CorrelationEngine, error) {
    ce := &CorrelationEngine{}
    ce.config.Store(config)
    
    // 初始化 Flink 流处理环境
    env, err := flink.NewStreamExecutionEnvironment()
    if err != nil {
        return nil, fmt.Errorf("初始化 Flink 环境失败: %w", err)
    }
    ce.flinkEnv = env
    
    // 初始化 Neo4j 驱动
    driver, err := neo4j.NewDriverWithContext(
        "bolt://localhost:7687",
        neo4j.BasicAuth("neo4j", "password", ""),
    )
    if err != nil {
        return nil, fmt.Errorf("初始化 Neo4j 驱动失败: %w", err)
    }
    ce.neo4jDriver = driver
    
    // 初始化规则引擎
    ce.ruleEngine = NewRuleEngine(config.CorrelationRules)
    
    // 初始化机器学习模型
    if config.MLEnabled {
        ce.mlModel = NewMLCorrelationModel()
    }
    
    // 初始化图构建器
    ce.graphBuilder = NewEventGraphBuilder()
    
    // 初始化告警管理器
    ce.alertManager = NewAlertManager()
    
    // 初始化审计日志记录器
    ce.auditLogger = NewAuditLogger()
    
    return ce, nil
}

// 启动事件关联分析
func (ce *CorrelationEngine) Start(ctx context.Context) error {
    log.Info("启动事件关联引擎")
    
    config := ce.config.Load().(*CorrelationConfig)
    
    // 创建 Flink 数据流
    stream := ce.flinkEnv.AddSource(NewKafkaSource("logs-topic"))
    
    // 为每个时间窗口创建关联任务
    for _, window := range config.TimeWindows {
        ce.processTimeWindow(ctx, stream, window)
    }
    
    // 执行 Flink 作业
    if err := ce.flinkEnv.Execute("event-correlation"); err != nil {
        return fmt.Errorf("执行 Flink 作业失败: %w", err)
    }
    
    return nil
}

// 处理时间窗口
func (ce *CorrelationEngine) processTimeWindow(
    ctx context.Context,
    stream *flink.DataStream,
    window TimeWindow,
) {
    log.Infof("处理时间窗口: %s, duration=%s", window.Name, window.Duration)
    
    // 应用时间窗口
    windowed := stream.
        KeyBy(func(event *LogEntry) string {
            // 按实体分组（用户、IP、会话ID）
            return ce.extractEntityKey(event)
        }).
        Window(flink.TumblingEventTimeWindows(window.Duration))
    
    // 应用关联规则
    correlated := windowed.Process(func(events []*LogEntry) []*CorrelatedEvent {
        return ce.correlateEvents(ctx, events, window)
    })
    
    // 保存关联结果
    correlated.AddSink(func(event *CorrelatedEvent) error {
        return ce.saveCorrelatedEvent(ctx, event)
    })
}

// 关联事件
func (ce *CorrelationEngine) correlateEvents(
    ctx context.Context,
    events []*LogEntry,
    window TimeWindow,
) []*CorrelatedEvent {
    config := ce.config.Load().(*CorrelationConfig)
    var results []*CorrelatedEvent
    
    // 1. 基于规则的关联
    ruleResults := ce.ruleEngine.Match(events, config.CorrelationRules)
    results = append(results, ruleResults...)
    
    // 2. 基于实体的关联
    entityResults := ce.correlateByEntity(events)
    results = append(results, entityResults...)
    
    // 3. 基于因果关系的关联
    causalResults := ce.correlateByCausality(events)
    results = append(results, causalResults...)
    
    // 4. 基于机器学习的关联（如果启用）
    if config.MLEnabled && ce.mlModel != nil {
        mlResults := ce.mlModel.Predict(events)
        results = append(results, mlResults...)
    }
    
    // 5. 构建事件关联图
    for _, result := range results {
        result.Graph = ce.graphBuilder.Build(result.Events)
    }
    
    // 6. 计算风险评分
    for _, result := range results {
        result.RiskScore = ce.calculateRiskScore(result)
    }
    
    // 7. 过滤低风险事件
    filtered := make([]*CorrelatedEvent, 0)
    for _, result := range results {
        if result.RiskScore >= config.RiskThreshold {
            filtered = append(filtered, result)
        }
    }
    
    return filtered
}

// 基于实体关联
func (ce *CorrelationEngine) correlateByEntity(events []*LogEntry) []*CorrelatedEvent {
    // 按实体分组
    entityGroups := make(map[string][]*LogEntry)
    
    for _, event := range events {
        // 提取实体（用户、IP、会话ID）
        entities := ce.extractEntities(event)
        
        for entityType, entityValue := range entities {
            key := fmt.Sprintf("%s:%s", entityType, entityValue)
            entityGroups[key] = append(entityGroups[key], event)
        }
    }
    
    // 为每个实体组创建关联事件
    var results []*CorrelatedEvent
    for entityKey, groupEvents := range entityGroups {
        if len(groupEvents) >= 2 {
            correlated := &CorrelatedEvent{
                ID:              generateID(),
                Events:          groupEvents,
                CorrelationType: "entity",
                Entities:        ce.extractEntitiesFromKey(entityKey),
                Timeline:        ce.extractTimeline(groupEvents),
                CreatedAt:       time.Now(),
            }
            results = append(results, correlated)
        }
    }
    
    return results
}

// 基于因果关系关联
func (ce *CorrelationEngine) correlateByCausality(events []*LogEntry) []*CorrelatedEvent {
    var results []*CorrelatedEvent
    
    // 按时间排序
    sortedEvents := ce.sortByTime(events)
    
    // 查找因果关系
    for i := 0; i < len(sortedEvents)-1; i++ {
        for j := i + 1; j < len(sortedEvents); j++ {
            if ce.hasCausalRelation(sortedEvents[i], sortedEvents[j]) {
                correlated := &CorrelatedEvent{
                    ID:              generateID(),
                    Events:          []*LogEntry{sortedEvents[i], sortedEvents[j]},
                    CorrelationType: "causal",
                    Timeline:        []time.Time{sortedEvents[i].Timestamp, sortedEvents[j].Timestamp},
                    CreatedAt:       time.Now(),
                }
                results = append(results, correlated)
            }
        }
    }
    
    return results
}

// 判断是否存在因果关系
func (ce *CorrelationEngine) hasCausalRelation(event1, event2 *LogEntry) bool {
    // 检查是否有共同的请求ID或追踪ID
    if event1.Fields["request_id"] == event2.Fields["request_id"] {
        return true
    }
    
    if event1.Fields["trace_id"] == event2.Fields["trace_id"] {
        return true
    }
    
    // 检查是否有父子关系
    if event1.Fields["span_id"] == event2.Fields["parent_span_id"] {
        return true
    }
    
    return false
}

// 计算风险评分
func (ce *CorrelationEngine) calculateRiskScore(event *CorrelatedEvent) float64 {
    var score float64
    
    // 1. 基于事件数量
    score += float64(len(event.Events)) * 5.0
    
    // 2. 基于事件级别
    for _, e := range event.Events {
        switch e.Level {
        case "FATAL":
            score += 30.0
        case "ERROR":
            score += 20.0
        case "WARN":
            score += 10.0
        }
    }
    
    // 3. 基于时间跨度
    if len(event.Timeline) >= 2 {
        duration := event.Timeline[len(event.Timeline)-1].Sub(event.Timeline[0])
        if duration < 1*time.Minute {
            score += 20.0 // 短时间内发生多个事件，风险较高
        }
    }
    
    // 4. 基于关联类型
    switch event.CorrelationType {
    case "causal":
        score += 15.0 // 因果关系风险较高
    case "entity":
        score += 10.0
    case "temporal":
        score += 5.0
    }
    
    // 归一化到 0-100
    if score > 100 {
        score = 100
    }
    
    return score
}

// 保存关联事件
func (ce *CorrelationEngine) saveCorrelatedEvent(ctx context.Context, event *CorrelatedEvent) error {
    log.Infof("保存关联事件: id=%s, type=%s, risk=%.2f", 
        event.ID, event.CorrelationType, event.RiskScore)
    
    // 1. 保存到 Neo4j 图数据库
    if err := ce.saveToNeo4j(ctx, event); err != nil {
        log.Errorf("保存到 Neo4j 失败: %v", err)
    }
    
    // 2. 如果是高风险事件，生成告警
    config := ce.config.Load().(*CorrelationConfig)
    if event.RiskScore >= config.RiskThreshold {
        ce.generateAlert(ctx, event)
    }
    
    // 3. 记录审计日志
    ce.auditLogger.LogCorrelation(event)
    
    return nil
}

// 保存到 Neo4j
func (ce *CorrelationEngine) saveToNeo4j(ctx context.Context, event *CorrelatedEvent) error {
    session := ce.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
    defer session.Close(ctx)
    
    // 创建事件节点
    for _, node := range event.Graph.Nodes {
        _, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (interface{}, error) {
            query := `
                CREATE (e:Event {
                    id: $id,
                    type: $type,
                    timestamp: $timestamp,
                    level: $level,
                    message: $message
                })
            `
            params := map[string]interface{}{
                "id":        node.ID,
                "type":      node.Type,
                "timestamp": node.Event.Timestamp.Unix(),
                "level":     node.Event.Level,
                "message":   node.Event.Message,
            }
            return tx.Run(ctx, query, params)
        })
        
        if err != nil {
            return err
        }
    }
    
    // 创建关系边
    for _, edge := range event.Graph.Edges {
        _, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (interface{}, error) {
            query := `
                MATCH (from:Event {id: $from_id})
                MATCH (to:Event {id: $to_id})
                CREATE (from)-[r:CORRELATES {
                    type: $type,
                    weight: $weight
                }]->(to)
            `
            params := map[string]interface{}{
                "from_id": edge.From,
                "to_id":   edge.To,
                "type":    edge.RelationType,
                "weight":  edge.Weight,
            }
            return tx.Run(ctx, query, params)
        })
        
        if err != nil {
            return err
        }
    }
    
    return nil
}

// 生成告警
func (ce *CorrelationEngine) generateAlert(ctx context.Context, event *CorrelatedEvent) {
    alert := &Alert{
        Level:   "critical",
        Title:   fmt.Sprintf("检测到高风险关联事件: %s", event.CorrelationType),
        Message: fmt.Sprintf("发现 %d 个相关事件，风险评分: %.2f", 
            len(event.Events), event.RiskScore),
        Fields: map[string]interface{}{
            "correlation_id":   event.ID,
            "correlation_type": event.CorrelationType,
            "risk_score":       event.RiskScore,
            "event_count":      len(event.Events),
            "entities":         event.Entities,
        },
        Timestamp: time.Now(),
    }
    
    ce.alertManager.Send(ctx, alert)
}

// 提取实体
func (ce *CorrelationEngine) extractEntities(event *LogEntry) map[string]string {
    entities := make(map[string]string)
    
    // 提取用户
    if user, ok := event.Fields["user"].(string); ok {
        entities["user"] = user
    }
    
    // 提取 IP 地址
    if ip, ok := event.Fields["ip"].(string); ok {
        entities["ip"] = ip
    }
    
    // 提取会话ID
    if sessionID, ok := event.Fields["session_id"].(string); ok {
        entities["session"] = sessionID
    }
    
    return entities
}
```

**关键实现点**:

1. 使用 Apache Flink 进行流式事件关联分析，支持多种时间窗口（滚动、滑动、会话）
2. 支持三种关联类型：时间关联、实体关联、因果关联
3. 使用 Neo4j 图数据库存储事件关联图谱，支持复杂的图查询
4. 支持基于规则引擎（Drools）的关联规则匹配
5. 支持基于机器学习的自动关联发现（使用 TensorFlow/PyTorch）
6. 实现多维度风险评分算法，综合考虑事件数量、级别、时间跨度、关联类型
7. 高风险事件自动生成告警，并关联相关日志

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| correlation_enabled | bool | true | 是否启用事件关联 |
| time_windows | array | [] | 时间窗口配置列表 |
| entity_types | array | ["user","ip","session"] | 实体类型列表 |
| correlation_rules | array | [] | 关联规则列表 |
| ml_enabled | bool | false | 是否启用机器学习 |
| risk_threshold | float | 80.0 | 风险阈值（0-100） |
| retention_days | int | 90 | 关联结果保留天数 |
| max_events_per_correlation | int | 100 | 单个关联事件最大事件数 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + PostgreSQL
- 生效时间: 立即生效（下次关联分析生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志并发送告警

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的关联规则和时间窗口配置
2. WHEN 风险阈值变更时，THE System SHALL 在下次关联分析时使用新阈值
3. THE System SHALL 支持通过 API 查询当前生效的关联配置
4. THE System SHALL 记录所有关联配置变更的审计日志
5. WHEN 关联规则变更时，THE System SHALL 验证规则的语法正确性

---


#### 需求 16-59: 日志审计与取证 [Phase 3]

**用户故事**:

作为安全调查员，我希望能够对日志数据进行取证分析，以便支持安全事件调查和法律诉讼。

**验收标准**:

1. THE Log_Storage SHALL 支持日志数据的法律保全，确保数据在调查期间不被修改或删除
2. THE System SHALL 支持生成符合法律要求的日志取证报告，包含完整的证据链
3. THE Dashboard SHALL 提供取证分析工具，支持时间线重建和事件关联分析
4. THE System SHALL 支持日志数据的数字签名和时间戳认证，确保数据的法律效力
5. THE System SHALL 支持导出符合电子证据标准（ISO/IEC 27037）的日志数据包
6. THE System SHALL 记录所有对日志数据的访问和操作，生成完整的审计追踪
7. THE System SHALL 支持日志数据的哈希校验，确保数据完整性和未被篡改
8. THE Dashboard SHALL 提供取证案件管理功能，支持创建、跟踪和归档取证案件
9. THE System SHALL 支持多种导出格式（JSON、CSV、PDF），满足不同法律管辖区的要求
10. THE System SHALL 通过配置中心管理取证配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/forensics/manager.go
package forensics

import (
    "context"
    "crypto/sha256"
    "encoding/hex"
    "time"
)

// 取证管理器
type ForensicsManager struct {
    config          atomic.Value      // 配置（支持热更新）
    storage         *ImmutableStorage // 不可变存储
    signatureEngine *SignatureEngine  // 数字签名引擎
    timelineBuilder *TimelineBuilder  // 时间线构建器
    reportGenerator *ReportGenerator  // 报告生成器
    caseManager     *CaseManager      // 案件管理器
    auditLogger     *AuditLogger      // 审计日志记录器
}

// 取证配置
type ForensicsConfig struct {
    Enabled              bool              // 是否启用取证功能
    PreservationEnabled  bool              // 是否启用数据保全
    SignatureAlgorithm   string            // 签名算法：RSA/ECDSA
    TimestampAuthority   string            // 时间戳认证机构
    ExportFormats        []string          // 导出格式
    RetentionDays        int               // 取证数据保留天数
    CaseManagementEnabled bool             // 是否启用案件管理
}

// 取证案件
type ForensicsCase struct {
    ID              string                 // 案件ID
    Name            string                 // 案件名称
    Description     string                 // 案件描述
    Investigator    string                 // 调查员
    Status          CaseStatus             // 案件状态
    StartTime       time.Time              // 开始时间
    EndTime         time.Time              // 结束时间
    PreservedLogs   []string               // 保全的日志ID列表
    EvidenceChain   []*Evidence            // 证据链
    Timeline        *EventTimeline         // 事件时间线
    Report          *ForensicsReport       // 取证报告
    Metadata        map[string]interface{} // 元数据
    CreatedAt       time.Time              // 创建时间
    UpdatedAt       time.Time              // 更新时间
}

// 案件状态
type CaseStatus string

const (
    CaseStatusOpen       CaseStatus = "open"        // 进行中
    CaseStatusInProgress CaseStatus = "in_progress" // 分析中
    CaseStatusClosed     CaseStatus = "closed"      // 已关闭
    CaseStatusArchived   CaseStatus = "archived"    // 已归档
)

// 证据
type Evidence struct {
    ID            string                 // 证据ID
    Type          string                 // 证据类型：log/file/network
    Source        string                 // 证据来源
    CollectedAt   time.Time              // 采集时间
    Hash          string                 // 哈希值（SHA-256）
    Signature     string                 // 数字签名
    Timestamp     *TrustedTimestamp      // 可信时间戳
    ChainOfCustody []*CustodyRecord      // 保管链
    Metadata      map[string]interface{} // 元数据
}

// 可信时间戳
type TrustedTimestamp struct {
    Time      time.Time // 时间戳
    Authority string    // 认证机构
    Token     string    // 时间戳令牌
    Signature string    // 签名
}

// 保管链记录
type CustodyRecord struct {
    Timestamp   time.Time // 时间戳
    Action      string    // 操作：collected/transferred/analyzed/stored
    Operator    string    // 操作员
    Location    string    // 位置
    Description string    // 描述
}

// 事件时间线
type EventTimeline struct {
    Events    []*TimelineEvent // 事件列表
    StartTime time.Time        // 开始时间
    EndTime   time.Time        // 结束时间
}

// 时间线事件
type TimelineEvent struct {
    Timestamp   time.Time              // 时间戳
    EventType   string                 // 事件类型
    Source      string                 // 事件来源
    Description string                 // 事件描述
    Evidence    *Evidence              // 关联证据
    Metadata    map[string]interface{} // 元数据
}

// 取证报告
type ForensicsReport struct {
    CaseID        string                 // 案件ID
    Title         string                 // 报告标题
    Summary       string                 // 摘要
    Investigator  string                 // 调查员
    GeneratedAt   time.Time              // 生成时间
    Findings      []string               // 调查发现
    Timeline      *EventTimeline         // 事件时间线
    EvidenceList  []*Evidence            // 证据列表
    Conclusion    string                 // 结论
    Recommendations []string             // 建议
    Signature     string                 // 报告签名
    Format        string                 // 报告格式
    Content       []byte                 // 报告内容
}

// 创建取证管理器
func NewForensicsManager(config *ForensicsConfig) (*ForensicsManager, error) {
    fm := &ForensicsManager{}
    fm.config.Store(config)
    
    // 初始化不可变存储
    fm.storage = NewImmutableStorage()
    
    // 初始化数字签名引擎
    fm.signatureEngine = NewSignatureEngine(config.SignatureAlgorithm)
    
    // 初始化时间线构建器
    fm.timelineBuilder = NewTimelineBuilder()
    
    // 初始化报告生成器
    fm.reportGenerator = NewReportGenerator()
    
    // 初始化案件管理器
    if config.CaseManagementEnabled {
        fm.caseManager = NewCaseManager()
    }
    
    // 初始化审计日志记录器
    fm.auditLogger = NewAuditLogger()
    
    return fm, nil
}

// 创建取证案件
func (fm *ForensicsManager) CreateCase(ctx context.Context, req *CreateCaseRequest) (*ForensicsCase, error) {
    log.Infof("创建取证案件: name=%s, investigator=%s", req.Name, req.Investigator)
    
    // 创建案件
    forensicsCase := &ForensicsCase{
        ID:           generateID(),
        Name:         req.Name,
        Description:  req.Description,
        Investigator: req.Investigator,
        Status:       CaseStatusOpen,
        StartTime:    req.StartTime,
        EndTime:      req.EndTime,
        EvidenceChain: make([]*Evidence, 0),
        CreatedAt:    time.Now(),
        UpdatedAt:    time.Now(),
    }
    
    // 保存案件
    if err := fm.caseManager.SaveCase(ctx, forensicsCase); err != nil {
        return nil, fmt.Errorf("保存案件失败: %w", err)
    }
    
    // 记录审计日志
    fm.auditLogger.LogCaseCreation(forensicsCase)
    
    return forensicsCase, nil
}

// 保全日志数据
func (fm *ForensicsManager) PreserveLogs(ctx context.Context, caseID string, logIDs []string) error {
    log.Infof("保全日志数据: case=%s, logs=%d", caseID, len(logIDs))
    
    config := fm.config.Load().(*ForensicsConfig)
    if !config.PreservationEnabled {
        return fmt.Errorf("数据保全功能未启用")
    }
    
    // 获取案件
    forensicsCase, err := fm.caseManager.GetCase(ctx, caseID)
    if err != nil {
        return fmt.Errorf("获取案件失败: %w", err)
    }
    
    // 保全每条日志
    for _, logID := range logIDs {
        // 1. 获取日志数据
        logEntry, err := fm.getLogEntry(ctx, logID)
        if err != nil {
            log.Errorf("获取日志失败: id=%s, err=%v", logID, err)
            continue
        }
        
        // 2. 计算哈希值
        hash := fm.calculateHash(logEntry)
        
        // 3. 生成数字签名
        signature, err := fm.signatureEngine.Sign(logEntry)
        if err != nil {
            log.Errorf("生成签名失败: id=%s, err=%v", logID, err)
            continue
        }
        
        // 4. 获取可信时间戳
        timestamp, err := fm.getTrustedTimestamp(ctx, logEntry)
        if err != nil {
            log.Errorf("获取时间戳失败: id=%s, err=%v", logID, err)
            // 时间戳失败不影响保全，继续处理
        }
        
        // 5. 创建证据
        evidence := &Evidence{
            ID:          generateID(),
            Type:        "log",
            Source:      logEntry.Source,
            CollectedAt: time.Now(),
            Hash:        hash,
            Signature:   signature,
            Timestamp:   timestamp,
            ChainOfCustody: []*CustodyRecord{
                {
                    Timestamp:   time.Now(),
                    Action:      "collected",
                    Operator:    forensicsCase.Investigator,
                    Location:    "log-storage",
                    Description: "日志数据保全",
                },
            },
            Metadata: map[string]interface{}{
                "log_id":    logID,
                "case_id":   caseID,
                "preserved": true,
            },
        }
        
        // 6. 保存到不可变存储
        if err := fm.storage.Store(ctx, evidence); err != nil {
            log.Errorf("保存证据失败: id=%s, err=%v", logID, err)
            continue
        }
        
        // 7. 添加到案件证据链
        forensicsCase.EvidenceChain = append(forensicsCase.EvidenceChain, evidence)
        forensicsCase.PreservedLogs = append(forensicsCase.PreservedLogs, logID)
    }
    
    // 更新案件
    forensicsCase.UpdatedAt = time.Now()
    if err := fm.caseManager.UpdateCase(ctx, forensicsCase); err != nil {
        return fmt.Errorf("更新案件失败: %w", err)
    }
    
    // 记录审计日志
    fm.auditLogger.LogPreservation(caseID, logIDs)
    
    log.Infof("日志保全完成: case=%s, preserved=%d", caseID, len(forensicsCase.PreservedLogs))
    
    return nil
}

// 重建事件时间线
func (fm *ForensicsManager) BuildTimeline(ctx context.Context, caseID string) (*EventTimeline, error) {
    log.Infof("重建事件时间线: case=%s", caseID)
    
    // 获取案件
    forensicsCase, err := fm.caseManager.GetCase(ctx, caseID)
    if err != nil {
        return nil, fmt.Errorf("获取案件失败: %w", err)
    }
    
    // 获取所有保全的日志
    var logs []*LogEntry
    for _, logID := range forensicsCase.PreservedLogs {
        logEntry, err := fm.getLogEntry(ctx, logID)
        if err != nil {
            log.Errorf("获取日志失败: id=%s, err=%v", logID, err)
            continue
        }
        logs = append(logs, logEntry)
    }
    
    // 构建时间线
    timeline := fm.timelineBuilder.Build(logs, forensicsCase.EvidenceChain)
    
    // 保存时间线到案件
    forensicsCase.Timeline = timeline
    forensicsCase.UpdatedAt = time.Now()
    if err := fm.caseManager.UpdateCase(ctx, forensicsCase); err != nil {
        return nil, fmt.Errorf("更新案件失败: %w", err)
    }
    
    // 记录审计日志
    fm.auditLogger.LogTimelineBuilding(caseID)
    
    return timeline, nil
}

// 生成取证报告
func (fm *ForensicsManager) GenerateReport(ctx context.Context, caseID string, format string) (*ForensicsReport, error) {
    log.Infof("生成取证报告: case=%s, format=%s", caseID, format)
    
    // 获取案件
    forensicsCase, err := fm.caseManager.GetCase(ctx, caseID)
    if err != nil {
        return nil, fmt.Errorf("获取案件失败: %w", err)
    }
    
    // 构建报告
    report := &ForensicsReport{
        CaseID:       caseID,
        Title:        fmt.Sprintf("取证报告 - %s", forensicsCase.Name),
        Summary:      forensicsCase.Description,
        Investigator: forensicsCase.Investigator,
        GeneratedAt:  time.Now(),
        Timeline:     forensicsCase.Timeline,
        EvidenceList: forensicsCase.EvidenceChain,
        Format:       format,
    }
    
    // 根据格式生成报告内容
    var content []byte
    switch format {
    case "json":
        content, err = fm.reportGenerator.GenerateJSON(report)
    case "pdf":
        content, err = fm.reportGenerator.GeneratePDF(report)
    case "csv":
        content, err = fm.reportGenerator.GenerateCSV(report)
    default:
        return nil, fmt.Errorf("不支持的报告格式: %s", format)
    }
    
    if err != nil {
        return nil, fmt.Errorf("生成报告内容失败: %w", err)
    }
    
    report.Content = content
    
    // 对报告进行数字签名
    signature, err := fm.signatureEngine.Sign(content)
    if err != nil {
        return nil, fmt.Errorf("签名报告失败: %w", err)
    }
    report.Signature = signature
    
    // 保存报告到案件
    forensicsCase.Report = report
    forensicsCase.UpdatedAt = time.Now()
    if err := fm.caseManager.UpdateCase(ctx, forensicsCase); err != nil {
        return nil, fmt.Errorf("更新案件失败: %w", err)
    }
    
    // 记录审计日志
    fm.auditLogger.LogReportGeneration(caseID, format)
    
    return report, nil
}

// 导出证据包
func (fm *ForensicsManager) ExportEvidencePackage(ctx context.Context, caseID string) ([]byte, error) {
    log.Infof("导出证据包: case=%s", caseID)
    
    // 获取案件
    forensicsCase, err := fm.caseManager.GetCase(ctx, caseID)
    if err != nil {
        return nil, fmt.Errorf("获取案件失败: %w", err)
    }
    
    // 创建证据包
    pkg := &EvidencePackage{
        CaseID:       caseID,
        CaseName:     forensicsCase.Name,
        Investigator: forensicsCase.Investigator,
        ExportedAt:   time.Now(),
        Evidence:     forensicsCase.EvidenceChain,
        Timeline:     forensicsCase.Timeline,
        Report:       forensicsCase.Report,
    }
    
    // 序列化证据包
    data, err := json.Marshal(pkg)
    if err != nil {
        return nil, fmt.Errorf("序列化证据包失败: %w", err)
    }
    
    // 计算证据包哈希
    hash := fm.calculateHash(data)
    
    // 对证据包进行数字签名
    signature, err := fm.signatureEngine.Sign(data)
    if err != nil {
        return nil, fmt.Errorf("签名证据包失败: %w", err)
    }
    
    // 添加元数据
    pkg.Hash = hash
    pkg.Signature = signature
    
    // 重新序列化（包含签名）
    finalData, err := json.Marshal(pkg)
    if err != nil {
        return nil, fmt.Errorf("序列化最终证据包失败: %w", err)
    }
    
    // 记录审计日志
    fm.auditLogger.LogEvidenceExport(caseID)
    
    return finalData, nil
}

// 验证证据完整性
func (fm *ForensicsManager) VerifyEvidence(ctx context.Context, evidenceID string) (bool, error) {
    log.Infof("验证证据完整性: evidence=%s", evidenceID)
    
    // 获取证据
    evidence, err := fm.storage.GetEvidence(ctx, evidenceID)
    if err != nil {
        return false, fmt.Errorf("获取证据失败: %w", err)
    }
    
    // 获取原始日志数据
    logID := evidence.Metadata["log_id"].(string)
    logEntry, err := fm.getLogEntry(ctx, logID)
    if err != nil {
        return false, fmt.Errorf("获取日志失败: %w", err)
    }
    
    // 重新计算哈希
    currentHash := fm.calculateHash(logEntry)
    
    // 比较哈希值
    if currentHash != evidence.Hash {
        log.Warnf("证据哈希不匹配: evidence=%s, expected=%s, actual=%s",
            evidenceID, evidence.Hash, currentHash)
        return false, nil
    }
    
    // 验证数字签名
    valid, err := fm.signatureEngine.Verify(logEntry, evidence.Signature)
    if err != nil {
        return false, fmt.Errorf("验证签名失败: %w", err)
    }
    
    if !valid {
        log.Warnf("证据签名无效: evidence=%s", evidenceID)
        return false, nil
    }
    
    // 验证时间戳（如果存在）
    if evidence.Timestamp != nil {
        valid, err := fm.verifyTimestamp(ctx, evidence.Timestamp)
        if err != nil {
            log.Errorf("验证时间戳失败: %v", err)
            // 时间戳验证失败不影响整体验证结果
        } else if !valid {
            log.Warnf("证据时间戳无效: evidence=%s", evidenceID)
        }
    }
    
    // 记录审计日志
    fm.auditLogger.LogEvidenceVerification(evidenceID, true)
    
    return true, nil
}

// 计算哈希值
func (fm *ForensicsManager) calculateHash(data interface{}) string {
    // 序列化数据
    var bytes []byte
    switch v := data.(type) {
    case []byte:
        bytes = v
    case string:
        bytes = []byte(v)
    default:
        bytes, _ = json.Marshal(v)
    }
    
    // 计算 SHA-256 哈希
    hash := sha256.Sum256(bytes)
    return hex.EncodeToString(hash[:])
}

// 获取可信时间戳
func (fm *ForensicsManager) getTrustedTimestamp(ctx context.Context, data interface{}) (*TrustedTimestamp, error) {
    config := fm.config.Load().(*ForensicsConfig)
    
    // 计算数据哈希
    hash := fm.calculateHash(data)
    
    // 向时间戳认证机构请求时间戳
    // 这里简化实现，实际应该调用 TSA (Time Stamp Authority) 服务
    timestamp := &TrustedTimestamp{
        Time:      time.Now(),
        Authority: config.TimestampAuthority,
        Token:     generateTimestampToken(),
        Signature: generateTimestampSignature(hash),
    }
    
    return timestamp, nil
}

// 验证时间戳
func (fm *ForensicsManager) verifyTimestamp(ctx context.Context, timestamp *TrustedTimestamp) (bool, error) {
    // 验证时间戳签名
    // 这里简化实现，实际应该调用 TSA 服务验证
    return true, nil
}

// 获取日志条目
func (fm *ForensicsManager) getLogEntry(ctx context.Context, logID string) (*LogEntry, error) {
    // 从存储中获取日志
    // 实际实现应该调用存储服务
    return &LogEntry{}, nil
}

// 不可变存储
type ImmutableStorage struct {
    // 使用 WORM (Write Once Read Many) 存储
    // 或者使用区块链技术确保数据不可篡改
}

// 存储证据
func (is *ImmutableStorage) Store(ctx context.Context, evidence *Evidence) error {
    // 实现不可变存储逻辑
    // 1. 写入数据
    // 2. 锁定数据，禁止修改和删除
    // 3. 记录存储操作
    return nil
}

// 获取证据
func (is *ImmutableStorage) GetEvidence(ctx context.Context, evidenceID string) (*Evidence, error) {
    // 从不可变存储中读取证据
    return &Evidence{}, nil
}

// 数字签名引擎
type SignatureEngine struct {
    algorithm string // RSA/ECDSA
}

// 签名
func (se *SignatureEngine) Sign(data interface{}) (string, error) {
    // 实现数字签名逻辑
    // 1. 计算数据哈希
    // 2. 使用私钥签名
    // 3. 返回签名字符串
    return "signature", nil
}

// 验证签名
func (se *SignatureEngine) Verify(data interface{}, signature string) (bool, error) {
    // 实现签名验证逻辑
    // 1. 计算数据哈希
    // 2. 使用公钥验证签名
    // 3. 返回验证结果
    return true, nil
}
```

**关键实现点**:

1. 使用不可变存储（WORM）确保日志数据在保全后不能被修改或删除
2. 对所有保全的日志数据进行 SHA-256 哈希计算，确保数据完整性
3. 使用 RSA/ECDSA 数字签名技术，确保数据的真实性和不可否认性
4. 集成可信时间戳认证机构（TSA），为证据提供法律认可的时间证明
5. 实现完整的保管链（Chain of Custody）记录，追踪证据的采集、传输、分析、存储全过程
6. 支持事件时间线重建，帮助调查员理解事件发生的顺序和因果关系
7. 生成符合法律要求的取证报告，支持多种格式（JSON、PDF、CSV）

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| forensics_enabled | bool | false | 是否启用取证功能 |
| preservation_enabled | bool | true | 是否启用数据保全 |
| signature_algorithm | string | "RSA" | 签名算法（RSA/ECDSA） |
| timestamp_authority | string | "" | 时间戳认证机构URL |
| export_formats | array | ["json","pdf","csv"] | 支持的导出格式 |
| retention_days | int | 365 | 取证数据保留天数 |
| case_management_enabled | bool | true | 是否启用案件管理 |
| auto_verification | bool | true | 是否自动验证证据完整性 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + PostgreSQL
- 生效时间: 立即生效（下次取证操作生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志并发送告警

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的取证配置
2. WHEN 签名算法变更时，THE System SHALL 验证算法的可用性
3. THE System SHALL 支持通过 API 查询当前生效的取证配置
4. THE System SHALL 记录所有取证配置变更的审计日志
5. WHEN 时间戳认证机构变更时，THE System SHALL 验证机构的可达性和有效性

---



#### 需求 16-57: 日志语义分析 [Phase 3]

**用户故事**:

作为安全分析师，我希望系统能够理解日志的语义含义，以便更准确地识别安全威胁和业务异常。

**验收标准**:

1. THE Log_Analyzer SHALL 支持基于 NLP 技术的日志语义分析，理解日志消息的含义
2. THE Log_Analyzer SHALL 自动识别日志中的实体（用户名、IP 地址、文件路径、URL、邮箱地址）
3. THE Log_Analyzer SHALL 支持日志情感分析，识别错误、警告、成功等语义类型，准确率 > 90%
4. THE System SHALL 支持构建日志知识图谱，关联日志实体和事件之间的关系
5. THE Log_Analyzer SHALL 支持基于语义的智能搜索，理解用户查询意图（如"最近的登录失败"）
6. THE System SHALL 支持多语言日志分析，至少支持中文、英文、日文三种语言
7. THE Log_Analyzer SHALL 自动提取日志中的关键信息（时间、地点、人物、事件）
8. THE System SHALL 支持语义相似度搜索，查找语义相近的日志（相似度阈值可配置）
9. THE Dashboard SHALL 展示实体关系图谱，可视化实体之间的关联关系
10. THE System SHALL 通过配置中心管理语义分析配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/analyzer/semantic/engine.go
package semantic

import (
    "context"
    "github.com/jdkato/prose/v2"
    "github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// 语义分析引擎
type SemanticEngine struct {
    config          atomic.Value           // 配置（支持热更新）
    nlpProcessor    *NLPProcessor          // NLP 处理器
    entityExtractor *EntityExtractor       // 实体提取器
    sentimentAnalyzer *SentimentAnalyzer   // 情感分析器
    knowledgeGraph  *KnowledgeGraph        // 知识图谱
    searchEngine    *SemanticSearchEngine  // 语义搜索引擎
    neo4jDriver     neo4j.DriverWithContext
    auditLogger     *AuditLogger
}

// 语义分析配置
type SemanticConfig struct {
    NLPEnabled         bool              // 是否启用 NLP
    Languages          []string          // 支持的语言
    EntityTypes        []string          // 实体类型
    SentimentEnabled   bool              // 是否启用情感分析
    KnowledgeGraphEnabled bool           // 是否启用知识图谱
    SimilarityThreshold float64         // 相似度阈值
    MaxEntitiesPerLog  int               // 每条日志最大实体数
}

// 语义分析结果
type SemanticAnalysisResult struct {
    LogID       string                 // 日志ID
    Language    string                 // 语言
    Entities    []*Entity              // 提取的实体
    Sentiment   *Sentiment             // 情感分析结果
    Keywords    []string               // 关键词
    Summary     string                 // 摘要
    Embedding   []float64              // 语义向量
    Metadata    map[string]interface{} // 元数据
    AnalyzedAt  time.Time              // 分析时间
}

// 实体
type Entity struct {
    Type       string  // 实体类型：person/ip/url/email/file/location
    Value      string  // 实体值
    Confidence float64 // 置信度
    Position   int     // 在文本中的位置
}

// 情感分析结果
type Sentiment struct {
    Type       string  // 情感类型：positive/negative/neutral/error/warning
    Score      float64 // 情感得分（-1 到 1）
    Confidence float64 // 置信度
}

// 知识图谱
type KnowledgeGraph struct {
    driver neo4j.DriverWithContext
}

// 创建语义分析引擎
func NewSemanticEngine(config *SemanticConfig) (*SemanticEngine, error) {
    se := &SemanticEngine{}
    se.config.Store(config)
    
    // 初始化 NLP 处理器
    se.nlpProcessor = NewNLPProcessor(config.Languages)
    
    // 初始化实体提取器
    se.entityExtractor = NewEntityExtractor(config.EntityTypes)
    
    // 初始化情感分析器
    if config.SentimentEnabled {
        se.sentimentAnalyzer = NewSentimentAnalyzer()
    }
    
    // 初始化知识图谱
    if config.KnowledgeGraphEnabled {
        driver, err := neo4j.NewDriverWithContext(
            "bolt://localhost:7687",
            neo4j.BasicAuth("neo4j", "password", ""),
        )
        if err != nil {
            return nil, fmt.Errorf("初始化 Neo4j 驱动失败: %w", err)
        }
        se.neo4jDriver = driver
        se.knowledgeGraph = NewKnowledgeGraph(driver)
    }
    
    // 初始化语义搜索引擎
    se.searchEngine = NewSemanticSearchEngine(config.SimilarityThreshold)
    
    // 初始化审计日志记录器
    se.auditLogger = NewAuditLogger()
    
    return se, nil
}

// 分析日志语义
func (se *SemanticEngine) Analyze(ctx context.Context, log *LogEntry) (*SemanticAnalysisResult, error) {
    log.Infof("分析日志语义: log_id=%s", log.ID)
    
    result := &SemanticAnalysisResult{
        LogID:      log.ID,
        AnalyzedAt: time.Now(),
    }
    
    // 1. 语言检测
    result.Language = se.nlpProcessor.DetectLanguage(log.Message)
    
    // 2. 实体提取
    entities, err := se.entityExtractor.Extract(log.Message, result.Language)
    if err != nil {
        log.Warnf("实体提取失败: %v", err)
    } else {
        result.Entities = entities
    }
    
    // 3. 情感分析
    config := se.config.Load().(*SemanticConfig)
    if config.SentimentEnabled {
        sentiment, err := se.sentimentAnalyzer.Analyze(log.Message, result.Language)
        if err != nil {
            log.Warnf("情感分析失败: %v", err)
        } else {
            result.Sentiment = sentiment
        }
    }
    
    // 4. 关键词提取
    result.Keywords = se.nlpProcessor.ExtractKeywords(log.Message, result.Language)
    
    // 5. 生成摘要
    result.Summary = se.nlpProcessor.GenerateSummary(log.Message, result.Language)
    
    // 6. 生成语义向量（用于相似度搜索）
    result.Embedding = se.nlpProcessor.GenerateEmbedding(log.Message, result.Language)
    
    // 7. 更新知识图谱
    if config.KnowledgeGraphEnabled {
        if err := se.knowledgeGraph.Update(ctx, log, result); err != nil {
            log.Warnf("更新知识图谱失败: %v", err)
        }
    }
    
    // 8. 记录审计日志
    se.auditLogger.LogSemanticAnalysis(result)
    
    return result, nil
}

// NLP 处理器
type NLPProcessor struct {
    models map[string]*prose.Document // 语言模型
}

// 创建 NLP 处理器
func NewNLPProcessor(languages []string) *NLPProcessor {
    return &NLPProcessor{
        models: make(map[string]*prose.Document),
    }
}

// 检测语言
func (np *NLPProcessor) DetectLanguage(text string) string {
    // 使用 lingua-go 进行语言检测
    detector := lingua.NewLanguageDetectorBuilder().
        FromAllLanguages().
        Build()
    
    language, exists := detector.DetectLanguageOf(text)
    if !exists {
        return "unknown"
    }
    
    return language.IsoCode639_1().String()
}

// 提取关键词
func (np *NLPProcessor) ExtractKeywords(text, language string) []string {
    doc, err := prose.NewDocument(text)
    if err != nil {
        return []string{}
    }
    
    // 提取名词和动词作为关键词
    var keywords []string
    for _, tok := range doc.Tokens() {
        if tok.Tag == "NN" || tok.Tag == "NNS" || tok.Tag == "VB" {
            keywords = append(keywords, tok.Text)
        }
    }
    
    // 去重
    keywords = uniqueStrings(keywords)
    
    // 限制数量
    if len(keywords) > 10 {
        keywords = keywords[:10]
    }
    
    return keywords
}

// 生成摘要
func (np *NLPProcessor) GenerateSummary(text, language string) string {
    // 如果文本较短，直接返回
    if len(text) <= 100 {
        return text
    }
    
    // 提取第一句话作为摘要
    doc, err := prose.NewDocument(text)
    if err != nil {
        return text[:100] + "..."
    }
    
    sentences := doc.Sentences()
    if len(sentences) > 0 {
        return sentences[0].Text
    }
    
    return text[:100] + "..."
}

// 生成语义向量
func (np *NLPProcessor) GenerateEmbedding(text, language string) []float64 {
    // 使用预训练的 BERT 模型生成语义向量
    // 这里简化实现，实际应该调用 BERT API
    
    // 简单的 TF-IDF 向量化
    words := strings.Fields(text)
    embedding := make([]float64, 768) // BERT 向量维度
    
    for i, word := range words {
        if i >= len(embedding) {
            break
        }
        // 简单的哈希映射
        hash := hashString(word)
        embedding[hash%len(embedding)] += 1.0
    }
    
    // 归一化
    var sum float64
    for _, v := range embedding {
        sum += v * v
    }
    norm := math.Sqrt(sum)
    
    if norm > 0 {
        for i := range embedding {
            embedding[i] /= norm
        }
    }
    
    return embedding
}

// 实体提取器
type EntityExtractor struct {
    entityTypes []string
    patterns    map[string]*regexp.Regexp
}

// 创建实体提取器
func NewEntityExtractor(entityTypes []string) *EntityExtractor {
    ee := &EntityExtractor{
        entityTypes: entityTypes,
        patterns:    make(map[string]*regexp.Regexp),
    }
    
    // 定义实体识别正则表达式
    ee.patterns["ip"] = regexp.MustCompile(`\b(?:\d{1,3}\.){3}\d{1,3}\b`)
    ee.patterns["email"] = regexp.MustCompile(`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`)
    ee.patterns["url"] = regexp.MustCompile(`https?://[^\s]+`)
    ee.patterns["file"] = regexp.MustCompile(`/[^\s]+\.[a-z]{2,4}`)
    
    return ee
}

// 提取实体
func (ee *EntityExtractor) Extract(text, language string) ([]*Entity, error) {
    var entities []*Entity
    
    // 1. 基于正则表达式的实体提取
    for entityType, pattern := range ee.patterns {
        matches := pattern.FindAllStringIndex(text, -1)
        for _, match := range matches {
            entity := &Entity{
                Type:       entityType,
                Value:      text[match[0]:match[1]],
                Confidence: 0.95, // 正则匹配置信度较高
                Position:   match[0],
            }
            entities = append(entities, entity)
        }
    }
    
    // 2. 基于 NLP 的命名实体识别（NER）
    doc, err := prose.NewDocument(text)
    if err == nil {
        for _, ent := range doc.Entities() {
            entity := &Entity{
                Type:       mapEntityType(ent.Label),
                Value:      ent.Text,
                Confidence: 0.85, // NER 置信度
                Position:   0,    // prose 不提供位置信息
            }
            entities = append(entities, entity)
        }
    }
    
    // 3. 去重
    entities = deduplicateEntities(entities)
    
    return entities, nil
}

// 映射实体类型
func mapEntityType(label string) string {
    switch label {
    case "PERSON":
        return "person"
    case "GPE", "LOC":
        return "location"
    case "ORG":
        return "organization"
    default:
        return "other"
    }
}

// 情感分析器
type SentimentAnalyzer struct {
    model *SentimentModel
}

// 创建情感分析器
func NewSentimentAnalyzer() *SentimentAnalyzer {
    return &SentimentAnalyzer{
        model: LoadSentimentModel(),
    }
}

// 分析情感
func (sa *SentimentAnalyzer) Analyze(text, language string) (*Sentiment, error) {
    // 基于关键词的简单情感分析
    sentiment := &Sentiment{
        Type:       "neutral",
        Score:      0.0,
        Confidence: 0.8,
    }
    
    // 错误关键词
    errorKeywords := []string{"error", "fail", "exception", "crash", "panic", "错误", "失败", "异常"}
    for _, keyword := range errorKeywords {
        if strings.Contains(strings.ToLower(text), keyword) {
            sentiment.Type = "error"
            sentiment.Score = -0.8
            return sentiment, nil
        }
    }
    
    // 警告关键词
    warningKeywords := []string{"warn", "warning", "caution", "警告", "注意"}
    for _, keyword := range warningKeywords {
        if strings.Contains(strings.ToLower(text), keyword) {
            sentiment.Type = "warning"
            sentiment.Score = -0.5
            return sentiment, nil
        }
    }
    
    // 成功关键词
    successKeywords := []string{"success", "complete", "done", "ok", "成功", "完成"}
    for _, keyword := range successKeywords {
        if strings.Contains(strings.ToLower(text), keyword) {
            sentiment.Type = "positive"
            sentiment.Score = 0.8
            return sentiment, nil
        }
    }
    
    return sentiment, nil
}

// 知识图谱
func NewKnowledgeGraph(driver neo4j.DriverWithContext) *KnowledgeGraph {
    return &KnowledgeGraph{
        driver: driver,
    }
}

// 更新知识图谱
func (kg *KnowledgeGraph) Update(ctx context.Context, log *LogEntry, result *SemanticAnalysisResult) error {
    session := kg.driver.NewSession(ctx, neo4j.SessionConfig{})
    defer session.Close(ctx)
    
    // 创建日志节点
    _, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (interface{}, error) {
        query := `
            CREATE (l:Log {
                id: $id,
                message: $message,
                timestamp: $timestamp,
                sentiment: $sentiment
            })
        `
        params := map[string]interface{}{
            "id":        log.ID,
            "message":   log.Message,
            "timestamp": log.Timestamp.Unix(),
            "sentiment": result.Sentiment.Type,
        }
        return tx.Run(ctx, query, params)
    })
    
    if err != nil {
        return err
    }
    
    // 创建实体节点和关系
    for _, entity := range result.Entities {
        _, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (interface{}, error) {
            query := `
                MERGE (e:Entity {type: $type, value: $value})
                WITH e
                MATCH (l:Log {id: $log_id})
                CREATE (l)-[r:CONTAINS {confidence: $confidence}]->(e)
            `
            params := map[string]interface{}{
                "type":       entity.Type,
                "value":      entity.Value,
                "log_id":     log.ID,
                "confidence": entity.Confidence,
            }
            return tx.Run(ctx, query, params)
        })
        
        if err != nil {
            log.Warnf("创建实体关系失败: %v", err)
        }
    }
    
    return nil
}

// 语义搜索引擎
type SemanticSearchEngine struct {
    similarityThreshold float64
    vectorIndex         *VectorIndex
}

// 创建语义搜索引擎
func NewSemanticSearchEngine(threshold float64) *SemanticSearchEngine {
    return &SemanticSearchEngine{
        similarityThreshold: threshold,
        vectorIndex:         NewVectorIndex(),
    }
}

// 语义搜索
func (sse *SemanticSearchEngine) Search(ctx context.Context, query string, limit int) ([]*SemanticAnalysisResult, error) {
    // 1. 生成查询向量
    queryEmbedding := sse.generateQueryEmbedding(query)
    
    // 2. 向量相似度搜索
    results := sse.vectorIndex.Search(queryEmbedding, limit, sse.similarityThreshold)
    
    return results, nil
}

// 生成查询向量
func (sse *SemanticSearchEngine) generateQueryEmbedding(query string) []float64 {
    // 使用与日志相同的方法生成向量
    processor := NewNLPProcessor([]string{"en", "zh"})
    return processor.GenerateEmbedding(query, "en")
}

// 计算余弦相似度
func cosineSimilarity(a, b []float64) float64 {
    if len(a) != len(b) {
        return 0.0
    }
    
    var dotProduct, normA, normB float64
    for i := range a {
        dotProduct += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }
    
    if normA == 0 || normB == 0 {
        return 0.0
    }
    
    return dotProduct / (math.Sqrt(normA) * math.Sqrt(normB))
}

// 向量索引
type VectorIndex struct {
    vectors map[string][]float64
    mu      sync.RWMutex
}

// 创建向量索引
func NewVectorIndex() *VectorIndex {
    return &VectorIndex{
        vectors: make(map[string][]float64),
    }
}

// 添加向量
func (vi *VectorIndex) Add(id string, vector []float64) {
    vi.mu.Lock()
    defer vi.mu.Unlock()
    vi.vectors[id] = vector
}

// 搜索相似向量
func (vi *VectorIndex) Search(query []float64, limit int, threshold float64) []*SemanticAnalysisResult {
    vi.mu.RLock()
    defer vi.mu.RUnlock()
    
    type result struct {
        id         string
        similarity float64
    }
    
    var results []result
    for id, vector := range vi.vectors {
        similarity := cosineSimilarity(query, vector)
        if similarity >= threshold {
            results = append(results, result{id: id, similarity: similarity})
        }
    }
    
    // 按相似度排序
    sort.Slice(results, func(i, j int) bool {
        return results[i].similarity > results[j].similarity
    })
    
    // 限制结果数量
    if len(results) > limit {
        results = results[:limit]
    }
    
    // 转换为 SemanticAnalysisResult
    var semanticResults []*SemanticAnalysisResult
    for _, r := range results {
        // 从数据库加载完整结果
        // 这里简化实现
        semanticResults = append(semanticResults, &SemanticAnalysisResult{
            LogID: r.id,
        })
    }
    
    return semanticResults
}
```

**关键实现点**:

1. 使用 prose/spaCy 进行 NLP 处理，支持多语言（中文、英文、日文）
2. 实现命名实体识别（NER），支持人名、地名、IP、URL、邮箱等实体类型
3. 基于关键词和机器学习的情感分析，识别错误、警告、成功等语义类型
4. 使用 Neo4j 构建知识图谱，存储实体和事件之间的关系
5. 实现语义向量化（使用 BERT 或 TF-IDF），支持语义相似度搜索
6. 支持基于语义的智能搜索，理解用户查询意图
7. 使用向量索引（如 Faiss）加速相似度搜索

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| semantic_enabled | bool | true | 是否启用语义分析 |
| nlp_enabled | bool | true | 是否启用 NLP 处理 |
| languages | array | ["en","zh","ja"] | 支持的语言列表 |
| entity_types | array | ["person","ip","url","email","file"] | 实体类型列表 |
| sentiment_enabled | bool | true | 是否启用情感分析 |
| knowledge_graph_enabled | bool | true | 是否启用知识图谱 |
| similarity_threshold | float | 0.7 | 相似度阈值（0-1） |
| max_entities_per_log | int | 50 | 每条日志最大实体数 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + PostgreSQL
- 生效时间: 立即生效（下次语义分析生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志并发送告警

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的语义分析配置
2. WHEN 语言列表变更时，THE System SHALL 在下次分析时使用新的语言模型
3. THE System SHALL 支持通过 API 查询当前生效的语义分析配置
4. THE System SHALL 记录所有语义分析配置变更的审计日志
5. WHEN 相似度阈值变更时，THE System SHALL 验证阈值的合理性（0-1之间）

---

- 回滚策略: 配置验证失败时保持原配置，显示错误提示

**热更新验收标准**:

1. THE System SHALL 在配置变更后通过 WebSocket 推送到所有在线用户
2. WHEN 搜索配置变更时，THE System SHALL 在用户刷新页面后生效
3. THE System SHALL 支持通过 API 查询当前生效的搜索配置
4. THE System SHALL 记录所有搜索配置变更的审计日志
5. WHEN 自动补全延迟变更时，THE System SHALL 验证配置的合理性（>= 50ms）

---


#### 需求 16-58: 日志数据血缘追踪 [Phase 3]

**用户故事**:

作为数据治理专员，我希望能够追踪日志数据的来源和流转路径，以便确保数据质量和合规性。

**验收标准**:

1. THE System SHALL 记录每条日志数据的完整血缘信息（数据来源、采集节点、处理节点、存储位置）
2. THE System SHALL 记录日志数据经过的所有处理步骤（清洗、转换、聚合、脱敏）
3. THE Dashboard SHALL 提供数据血缘可视化界面，使用有向无环图（DAG）展示日志数据的流转路径
4. WHEN 日志数据经过转换或聚合时，THE System SHALL 保留原始数据的关联引用
5. THE System SHALL 支持基于血缘信息的影响分析，评估数据源变更的影响范围
6. THE System SHALL 支持数据血缘信息的导出，格式包括 JSON、CSV、GraphML
7. THE System SHALL 支持血缘追踪的时间范围查询，查询最近 90 天的血缘信息
8. THE System SHALL 记录数据血缘的版本历史，支持查看历史血缘关系
9. THE Dashboard SHALL 提供血缘影响分析报告，展示上下游依赖关系
10. THE System SHALL 通过配置中心管理血缘追踪配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/lineage/tracker.go
package lineage

import (
    "context"
    "time"
    "github.com/apache/atlas/intg"
)

// 数据血缘追踪器
type LineageTracker struct {
    config       atomic.Value      // 配置（支持热更新）
    atlasClient  *atlas.Client     // Apache Atlas 客户端
    neo4jDriver  neo4j.DriverWithContext
    metaStore    *MetadataStore    // 元数据存储
    graphBuilder *LineageGraphBuilder
    analyzer     *ImpactAnalyzer   // 影响分析器
    exporter     *LineageExporter  // 血缘导出器
    auditLogger  *AuditLogger
}

// 血缘配置
type LineageConfig struct {
    Enabled           bool              // 是否启用血缘追踪
    TrackingLevel     string            // 追踪级别：basic/detailed/full
    RetentionDays     int               // 保留天数
    ExportFormats     []string          // 导出格式
    ImpactAnalysis    bool              // 是否启用影响分析
    VersionControl    bool              // 是否启用版本控制
}

// 数据血缘
type DataLineage struct {
    ID              string                 // 血缘ID
    DataID          string                 // 数据ID
    DataType        string                 // 数据类型：log/metric/trace
    Source          *DataSource            // 数据源
    Transformations []*Transformation      // 转换步骤
    Destinations    []*DataDestination     // 目标位置
    Metadata        map[string]interface{} // 元数据
    Version         int                    // 版本号
    CreatedAt       time.Time              // 创建时间
    UpdatedAt       time.Time              // 更新时间
}

// 数据源
type DataSource struct {
    Type       string                 // 源类型：file/syslog/kafka/http
    Location   string                 // 源位置
    Host       string                 // 主机名
    Collector  string                 // 采集器ID
    Timestamp  time.Time              // 采集时间
    Metadata   map[string]interface{} // 元数据
}

// 转换步骤
type Transformation struct {
    ID          string                 // 转换ID
    Type        string                 // 转换类型：clean/parse/mask/aggregate
    Processor   string                 // 处理器名称
    Node        string                 // 处理节点
    Input       *DataSnapshot          // 输入快照
    Output      *DataSnapshot          // 输出快照
    Config      map[string]interface{} // 转换配置
    Timestamp   time.Time              // 转换时间
    Duration    time.Duration          // 处理时长
}

// 数据快照
type DataSnapshot struct {
    Hash        string                 // 数据哈希
    Size        int64                  // 数据大小
    Schema      map[string]string      // 数据模式
    SampleData  string                 // 样本数据
}

// 数据目标
type DataDestination struct {
    Type       string                 // 目标类型：elasticsearch/s3/kafka
    Location   string                 // 存储位置
    Index      string                 // 索引名称
    Partition  string                 // 分区信息
    Timestamp  time.Time              // 存储时间
    Metadata   map[string]interface{} // 元数据
}

// 血缘图
type LineageGraph struct {
    Nodes []*LineageNode // 节点列表
    Edges []*LineageEdge // 边列表
}

// 血缘节点
type LineageNode struct {
    ID       string                 // 节点ID
    Type     string                 // 节点类型：source/processor/destination
    Name     string                 // 节点名称
    Metadata map[string]interface{} // 元数据
}

// 血缘边
type LineageEdge struct {
    From         string    // 源节点ID
    To           string    // 目标节点ID
    Type         string    // 边类型：input/output/transform
    Timestamp    time.Time // 时间戳
}

// 影响分析结果
type ImpactAnalysis struct {
    SourceNode      string              // 源节点
    AffectedNodes   []*AffectedNode     // 受影响节点
    ImpactLevel     string              // 影响级别：low/medium/high/critical
    ImpactScope     int                 // 影响范围（节点数）
    DownstreamCount int                 // 下游节点数
    UpstreamCount   int                 // 上游节点数
    Recommendations []string            // 建议
    CreatedAt       time.Time           // 分析时间
}

// 受影响节点
type AffectedNode struct {
    NodeID      string  // 节点ID
    NodeType    string  // 节点类型
    ImpactScore float64 // 影响评分
    Distance    int     // 距离（跳数）
}

// 创建血缘追踪器
func NewLineageTracker(config *LineageConfig) (*LineageTracker, error) {
    lt := &LineageTracker{}
    lt.config.Store(config)
    
    // 初始化 Apache Atlas 客户端
    atlasClient, err := atlas.NewClient(&atlas.ClientConfig{
        URL:      "http://localhost:21000",
        Username: "admin",
        Password: "admin",
    })
    if err != nil {
        return nil, fmt.Errorf("初始化 Atlas 客户端失败: %w", err)
    }
    lt.atlasClient = atlasClient
    
    // 初始化 Neo4j 驱动
    driver, err := neo4j.NewDriverWithContext(
        "bolt://localhost:7687",
        neo4j.BasicAuth("neo4j", "password", ""),
    )
    if err != nil {
        return nil, fmt.Errorf("初始化 Neo4j 驱动失败: %w", err)
    }
    lt.neo4jDriver = driver
    
    // 初始化元数据存储
    lt.metaStore = NewMetadataStore()
    
    // 初始化图构建器
    lt.graphBuilder = NewLineageGraphBuilder()
    
    // 初始化影响分析器
    lt.analyzer = NewImpactAnalyzer()
    
    // 初始化导出器
    lt.exporter = NewLineageExporter()
    
    // 初始化审计日志记录器
    lt.auditLogger = NewAuditLogger()
    
    return lt, nil
}

// 记录数据血缘
func (lt *LineageTracker) TrackLineage(ctx context.Context, entry *LogEntry) error {
    config := lt.config.Load().(*LineageConfig)
    
    if !config.Enabled {
        return nil
    }
    
    log.Debugf("记录数据血缘: data_id=%s", entry.ID)
    
    // 1. 创建数据血缘对象
    lineage := &DataLineage{
        ID:       generateLineageID(),
        DataID:   entry.ID,
        DataType: "log",
        Source: &DataSource{
            Type:      entry.Source,
            Location:  entry.Fields["source_path"].(string),
            Host:      entry.Host,
            Collector: entry.Fields["collector_id"].(string),
            Timestamp: entry.Timestamp,
        },
        Transformations: make([]*Transformation, 0),
        Destinations:    make([]*DataDestination, 0),
        Version:         1,
        CreatedAt:       time.Now(),
        UpdatedAt:       time.Now(),
    }
    
    // 2. 记录转换步骤
    if transformations, ok := entry.Metadata["transformations"].([]interface{}); ok {
        for _, t := range transformations {
            trans := t.(map[string]interface{})
            transformation := &Transformation{
                ID:        trans["id"].(string),
                Type:      trans["type"].(string),
                Processor: trans["processor"].(string),
                Node:      trans["node"].(string),
                Timestamp: time.Unix(trans["timestamp"].(int64), 0),
            }
            lineage.Transformations = append(lineage.Transformations, transformation)
        }
    }
    
    // 3. 记录目标位置
    if destinations, ok := entry.Metadata["destinations"].([]interface{}); ok {
        for _, d := range destinations {
            dest := d.(map[string]interface{})
            destination := &DataDestination{
                Type:      dest["type"].(string),
                Location:  dest["location"].(string),
                Index:     dest["index"].(string),
                Timestamp: time.Unix(dest["timestamp"].(int64), 0),
            }
            lineage.Destinations = append(lineage.Destinations, destination)
        }
    }
    
    // 4. 保存到 Apache Atlas
    if err := lt.saveToAtlas(ctx, lineage); err != nil {
        log.Errorf("保存到 Atlas 失败: %v", err)
    }
    
    // 5. 保存到 Neo4j（用于图查询）
    if err := lt.saveToNeo4j(ctx, lineage); err != nil {
        log.Errorf("保存到 Neo4j 失败: %v", err)
    }
    
    // 6. 保存到元数据存储
    if err := lt.metaStore.Save(ctx, lineage); err != nil {
        log.Errorf("保存到元数据存储失败: %v", err)
    }
    
    // 7. 记录审计日志
    lt.auditLogger.LogLineageTracking(lineage)
    
    return nil
}

// 保存到 Apache Atlas
func (lt *LineageTracker) saveToAtlas(ctx context.Context, lineage *DataLineage) error {
    // 创建数据集实体
    dataset := &atlas.Entity{
        TypeName: "log_dataset",
        Attributes: map[string]interface{}{
            "qualifiedName": lineage.DataID,
            "name":          lineage.DataID,
            "dataType":      lineage.DataType,
            "source":        lineage.Source.Location,
            "createTime":    lineage.CreatedAt.Unix(),
        },
    }
    
    // 创建处理过程实体
    for _, trans := range lineage.Transformations {
        process := &atlas.Entity{
            TypeName: "log_process",
            Attributes: map[string]interface{}{
                "qualifiedName": trans.ID,
                "name":          trans.Type,
                "processor":     trans.Processor,
                "node":          trans.Node,
                "inputs":        []string{lineage.DataID},
                "outputs":       []string{lineage.DataID + "_transformed"},
            },
        }
        
        // 创建实体
        if _, err := lt.atlasClient.CreateEntity(ctx, process); err != nil {
            return fmt.Errorf("创建处理过程实体失败: %w", err)
        }
    }
    
    // 创建数据集实体
    if _, err := lt.atlasClient.CreateEntity(ctx, dataset); err != nil {
        return fmt.Errorf("创建数据集实体失败: %w", err)
    }
    
    return nil
}

// 保存到 Neo4j
func (lt *LineageTracker) saveToNeo4j(ctx context.Context, lineage *DataLineage) error {
    session := lt.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
    defer session.Close(ctx)
    
    // 创建数据源节点
    _, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (interface{}, error) {
        query := `
            CREATE (s:DataSource {
                id: $id,
                type: $type,
                location: $location,
                host: $host,
                timestamp: $timestamp
            })
        `
        params := map[string]interface{}{
            "id":        lineage.Source.Location,
            "type":      lineage.Source.Type,
            "location":  lineage.Source.Location,
            "host":      lineage.Source.Host,
            "timestamp": lineage.Source.Timestamp.Unix(),
        }
        return tx.Run(ctx, query, params)
    })
    
    if err != nil {
        return err
    }
    
    // 创建转换节点和关系
    prevNodeID := lineage.Source.Location
    for _, trans := range lineage.Transformations {
        // 创建转换节点
        _, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (interface{}, error) {
            query := `
                CREATE (t:Transformation {
                    id: $id,
                    type: $type,
                    processor: $processor,
                    node: $node,
                    timestamp: $timestamp
                })
            `
            params := map[string]interface{}{
                "id":        trans.ID,
                "type":      trans.Type,
                "processor": trans.Processor,
                "node":      trans.Node,
                "timestamp": trans.Timestamp.Unix(),
            }
            return tx.Run(ctx, query, params)
        })
        
        if err != nil {
            return err
        }
        
        // 创建关系
        _, err = session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (interface{}, error) {
            query := `
                MATCH (from {id: $from_id})
                MATCH (to:Transformation {id: $to_id})
                CREATE (from)-[r:TRANSFORMS]->(to)
            `
            params := map[string]interface{}{
                "from_id": prevNodeID,
                "to_id":   trans.ID,
            }
            return tx.Run(ctx, query, params)
        })
        
        if err != nil {
            return err
        }
        
        prevNodeID = trans.ID
    }
    
    // 创建目标节点和关系
    for _, dest := range lineage.Destinations {
        // 创建目标节点
        _, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (interface{}, error) {
            query := `
                CREATE (d:DataDestination {
                    id: $id,
                    type: $type,
                    location: $location,
                    index: $index,
                    timestamp: $timestamp
                })
            `
            params := map[string]interface{}{
                "id":        dest.Location,
                "type":      dest.Type,
                "location":  dest.Location,
                "index":     dest.Index,
                "timestamp": dest.Timestamp.Unix(),
            }
            return tx.Run(ctx, query, params)
        })
        
        if err != nil {
            return err
        }
        
        // 创建关系
        _, err = session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (interface{}, error) {
            query := `
                MATCH (from {id: $from_id})
                MATCH (to:DataDestination {id: $to_id})
                CREATE (from)-[r:STORES_TO]->(to)
            `
            params := map[string]interface{}{
                "from_id": prevNodeID,
                "to_id":   dest.Location,
            }
            return tx.Run(ctx, query, params)
        })
        
        if err != nil {
            return err
        }
    }
    
    return nil
}

// 查询数据血缘
func (lt *LineageTracker) QueryLineage(ctx context.Context, dataID string) (*DataLineage, error) {
    log.Infof("查询数据血缘: data_id=%s", dataID)
    
    // 从元数据存储查询
    lineage, err := lt.metaStore.Get(ctx, dataID)
    if err != nil {
        return nil, fmt.Errorf("查询血缘失败: %w", err)
    }
    
    return lineage, nil
}

// 构建血缘图
func (lt *LineageTracker) BuildLineageGraph(ctx context.Context, dataID string) (*LineageGraph, error) {
    log.Infof("构建血缘图: data_id=%s", dataID)
    
    // 查询血缘信息
    lineage, err := lt.QueryLineage(ctx, dataID)
    if err != nil {
        return nil, err
    }
    
    // 使用图构建器构建血缘图
    graph := lt.graphBuilder.Build(lineage)
    
    return graph, nil
}

// 影响分析
func (lt *LineageTracker) AnalyzeImpact(ctx context.Context, nodeID string) (*ImpactAnalysis, error) {
    log.Infof("执行影响分析: node_id=%s", nodeID)
    
    config := lt.config.Load().(*LineageConfig)
    
    if !config.ImpactAnalysis {
        return nil, fmt.Errorf("影响分析未启用")
    }
    
    // 从 Neo4j 查询上下游节点
    session := lt.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
    defer session.Close(ctx)
    
    // 查询下游节点
    downstreamNodes, err := lt.queryDownstreamNodes(ctx, session, nodeID)
    if err != nil {
        return nil, fmt.Errorf("查询下游节点失败: %w", err)
    }
    
    // 查询上游节点
    upstreamNodes, err := lt.queryUpstreamNodes(ctx, session, nodeID)
    if err != nil {
        return nil, fmt.Errorf("查询上游节点失败: %w", err)
    }
    
    // 计算影响评分
    affectedNodes := make([]*AffectedNode, 0)
    for _, node := range downstreamNodes {
        affectedNode := &AffectedNode{
            NodeID:      node.ID,
            NodeType:    node.Type,
            ImpactScore: lt.calculateImpactScore(node),
            Distance:    node.Distance,
        }
        affectedNodes = append(affectedNodes, affectedNode)
    }
    
    // 确定影响级别
    impactLevel := lt.determineImpactLevel(len(affectedNodes))
    
    // 生成建议
    recommendations := lt.generateRecommendations(impactLevel, affectedNodes)
    
    analysis := &ImpactAnalysis{
        SourceNode:      nodeID,
        AffectedNodes:   affectedNodes,
        ImpactLevel:     impactLevel,
        ImpactScope:     len(affectedNodes),
        DownstreamCount: len(downstreamNodes),
        UpstreamCount:   len(upstreamNodes),
        Recommendations: recommendations,
        CreatedAt:       time.Now(),
    }
    
    return analysis, nil
}

// 查询下游节点
func (lt *LineageTracker) queryDownstreamNodes(
    ctx context.Context,
    session neo4j.SessionWithContext,
    nodeID string,
) ([]*LineageNode, error) {
    result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (interface{}, error) {
        query := `
            MATCH path = (start {id: $node_id})-[*1..5]->(end)
            RETURN end.id AS id, end.type AS type, length(path) AS distance
        `
        params := map[string]interface{}{
            "node_id": nodeID,
        }
        return tx.Run(ctx, query, params)
    })
    
    if err != nil {
        return nil, err
    }
    
    records := result.(*neo4j.ResultWithContext)
    nodes := make([]*LineageNode, 0)
    
    for records.Next(ctx) {
        record := records.Record()
        node := &LineageNode{
            ID:   record.Values[0].(string),
            Type: record.Values[1].(string),
        }
        nodes = append(nodes, node)
    }
    
    return nodes, nil
}

// 查询上游节点
func (lt *LineageTracker) queryUpstreamNodes(
    ctx context.Context,
    session neo4j.SessionWithContext,
    nodeID string,
) ([]*LineageNode, error) {
    result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (interface{}, error) {
        query := `
            MATCH path = (start {id: $node_id})<-[*1..5]-(end)
            RETURN end.id AS id, end.type AS type, length(path) AS distance
        `
        params := map[string]interface{}{
            "node_id": nodeID,
        }
        return tx.Run(ctx, query, params)
    })
    
    if err != nil {
        return nil, err
    }
    
    records := result.(*neo4j.ResultWithContext)
    nodes := make([]*LineageNode, 0)
    
    for records.Next(ctx) {
        record := records.Record()
        node := &LineageNode{
            ID:   record.Values[0].(string),
            Type: record.Values[1].(string),
        }
        nodes = append(nodes, node)
    }
    
    return nodes, nil
}

// 计算影响评分
func (lt *LineageTracker) calculateImpactScore(node *LineageNode) float64 {
    var score float64 = 50.0 // 基础分
    
    // 根据节点类型调整评分
    switch node.Type {
    case "DataDestination":
        score += 30.0 // 目标节点影响较大
    case "Transformation":
        score += 20.0 // 转换节点影响中等
    case "DataSource":
        score += 10.0 // 源节点影响较小
    }
    
    // 根据距离调整评分（距离越近影响越大）
    if node.Distance > 0 {
        score -= float64(node.Distance) * 5.0
    }
    
    // 归一化到 0-100
    if score < 0 {
        score = 0
    }
    if score > 100 {
        score = 100
    }
    
    return score
}

// 确定影响级别
func (lt *LineageTracker) determineImpactLevel(affectedCount int) string {
    if affectedCount >= 20 {
        return "critical"
    } else if affectedCount >= 10 {
        return "high"
    } else if affectedCount >= 5 {
        return "medium"
    }
    return "low"
}

// 生成建议
func (lt *LineageTracker) generateRecommendations(
    impactLevel string,
    affectedNodes []*AffectedNode,
) []string {
    recommendations := make([]string, 0)
    
    switch impactLevel {
    case "critical":
        recommendations = append(recommendations, "建议在维护窗口期进行变更")
        recommendations = append(recommendations, "需要通知所有下游系统负责人")
        recommendations = append(recommendations, "建议进行全面的回归测试")
    case "high":
        recommendations = append(recommendations, "建议提前通知相关团队")
        recommendations = append(recommendations, "需要进行充分的测试")
    case "medium":
        recommendations = append(recommendations, "建议进行基本测试")
        recommendations = append(recommendations, "可以在正常时间进行变更")
    case "low":
        recommendations = append(recommendations, "影响范围较小，可以直接变更")
    }
    
    return recommendations
}

// 导出血缘信息
func (lt *LineageTracker) ExportLineage(
    ctx context.Context,
    dataID string,
    format string,
) ([]byte, error) {
    log.Infof("导出血缘信息: data_id=%s, format=%s", dataID, format)
    
    // 查询血缘信息
    lineage, err := lt.QueryLineage(ctx, dataID)
    if err != nil {
        return nil, err
    }
    
    // 构建血缘图
    graph, err := lt.BuildLineageGraph(ctx, dataID)
    if err != nil {
        return nil, err
    }
    
    // 根据格式导出
    return lt.exporter.Export(lineage, graph, format)
}
```

**关键实现点**:

1. 使用 Apache Atlas 作为元数据管理平台，记录完整的数据血缘信息
2. 使用 Neo4j 图数据库存储血缘关系，支持复杂的图查询和遍历
3. 记录数据的完整生命周期：采集→处理→存储，包括所有转换步骤
4. 支持数据快照功能，保留转换前后的数据状态（哈希、大小、模式）
5. 实现影响分析算法，评估数据源变更对下游系统的影响
6. 支持多种导出格式（JSON、CSV、GraphML），便于与其他工具集成
7. 支持血缘版本控制，追踪血缘关系的历史变化

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| lineage_enabled | bool | true | 是否启用血缘追踪 |
| tracking_level | string | "detailed" | 追踪级别：basic/detailed/full |
| retention_days | int | 90 | 血缘信息保留天数 |
| export_formats | array | ["json","csv","graphml"] | 支持的导出格式 |
| impact_analysis_enabled | bool | true | 是否启用影响分析 |
| version_control_enabled | bool | true | 是否启用版本控制 |
| max_lineage_depth | int | 10 | 最大血缘追踪深度 |
| snapshot_enabled | bool | true | 是否启用数据快照 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + PostgreSQL
- 生效时间: 立即生效（下次血缘记录生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志并发送告警

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的血缘追踪配置
2. WHEN 追踪级别变更时，THE System SHALL 在下次血缘记录时使用新级别
3. THE System SHALL 支持通过 API 查询当前生效的血缘配置
4. THE System SHALL 记录所有血缘配置变更的审计日志
5. WHEN 保留天数变更时，THE System SHALL 在下次清理任务时应用新配置

---


#### 需求 16-60: 系统健康评分 [Phase 2]

**用户故事**:

作为运维经理，我希望能够通过综合健康评分快速了解系统整体状态，以便及时发现和处理潜在问题。

**验收标准**:

1. THE Dashboard SHALL 提供系统健康评分仪表盘，展示 0-100 分的综合健康指数
2. THE System SHALL 基于多个维度计算健康评分（采集健康度、存储健康度、分析健康度、告警健康度）
3. THE Dashboard SHALL 展示各维度的子评分和影响因素分析，每个维度权重可配置
4. WHEN 健康评分低于阈值（默认 70 分）时，THE System SHALL 自动发送告警并提供改进建议
5. THE Dashboard SHALL 展示健康评分的历史趋势，支持查看最近 7 天、30 天、90 天的趋势
6. THE System SHALL 每 5 分钟计算一次健康评分，并记录历史数据
7. THE System SHALL 提供健康评分的详细报告，包含各项指标的得分明细和改进建议
8. THE Dashboard SHALL 支持自定义健康评分的计算规则和权重配置
9. THE System SHALL 支持健康评分的 API 查询，返回实时评分和历史趋势数据
10. THE System SHALL 通过配置中心管理健康评分配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/monitoring/health/scorer.go
package health

import (
    "context"
    "time"
    "sync"
)

// 健康评分器
type HealthScorer struct {
    config          atomic.Value      // 配置（支持热更新）
    collectors      []MetricCollector // 指标采集器
    calculator      *ScoreCalculator  // 评分计算器
    storage         *ScoreStorage     // 评分存储
    alertManager    *AlertManager     // 告警管理器
    reportGenerator *ReportGenerator  // 报告生成器
    auditLogger     *AuditLogger      // 审计日志记录器
}

// 健康评分配置
type HealthScoreConfig struct {
    Enabled           bool                    // 是否启用健康评分
    CalculateInterval time.Duration           // 计算间隔
    ScoreThreshold    float64                 // 告警阈值
    Dimensions        []DimensionConfig       // 维度配置
    RetentionDays     int                     // 历史数据保留天数
    CustomRules       []CustomScoringRule     // 自定义评分规则
}

// 维度配置
type DimensionConfig struct {
    Name        string             // 维度名称
    Weight      float64            // 权重（0-1）
    Metrics     []MetricConfig     // 指标配置
    Enabled     bool               // 是否启用
}

// 指标配置
type MetricConfig struct {
    Name      string  // 指标名称
    Weight    float64 // 权重（0-1）
    Threshold float64 // 阈值
    Operator  string  // 操作符：gt/lt/eq
}

// 自定义评分规则
type CustomScoringRule struct {
    ID          string                 // 规则ID
    Name        string                 // 规则名称
    Dimension   string                 // 所属维度
    Expression  string                 // 评分表达式
    Weight      float64                // 权重
    Enabled     bool                   // 是否启用
}

// 健康评分
type HealthScore struct {
    OverallScore    float64                    // 综合评分（0-100）
    DimensionScores map[string]*DimensionScore // 各维度评分
    Timestamp       time.Time                  // 评分时间
    Status          HealthStatus               // 健康状态
    Issues          []HealthIssue              // 健康问题
    Suggestions     []string                   // 改进建议
}

// 维度评分
type DimensionScore struct {
    Name         string             // 维度名称
    Score        float64            // 评分（0-100）
    Weight       float64            // 权重
    MetricScores map[string]float64 // 各指标评分
    Status       HealthStatus       // 健康状态
    Issues       []HealthIssue      // 问题列表
}

// 健康状态
type HealthStatus string

const (
    HealthStatusExcellent HealthStatus = "excellent" // 优秀（90-100）
    HealthStatusGood      HealthStatus = "good"      // 良好（70-89）
    HealthStatusWarning   HealthStatus = "warning"   // 警告（50-69）
    HealthStatusCritical  HealthStatus = "critical"  // 严重（0-49）
)

// 健康问题
type HealthIssue struct {
    Dimension   string    // 所属维度
    Metric      string    // 相关指标
    Severity    string    // 严重程度：high/medium/low
    Description string    // 问题描述
    Impact      string    // 影响说明
    Suggestion  string    // 改进建议
    DetectedAt  time.Time // 检测时间
}

// 创建健康评分器
func NewHealthScorer(config *HealthScoreConfig) (*HealthScorer, error) {
    hs := &HealthScorer{}
    hs.config.Store(config)
    
    // 初始化指标采集器
    hs.collectors = []MetricCollector{
        NewCollectionHealthCollector(),  // 采集健康度
        NewStorageHealthCollector(),     // 存储健康度
        NewAnalysisHealthCollector(),    // 分析健康度
        NewAlertHealthCollector(),       // 告警健康度
    }
    
    // 初始化评分计算器
    hs.calculator = NewScoreCalculator(config.Dimensions)
    
    // 初始化评分存储
    hs.storage = NewScoreStorage(config.RetentionDays)
    
    // 初始化告警管理器
    hs.alertManager = NewAlertManager()
    
    // 初始化报告生成器
    hs.reportGenerator = NewReportGenerator()
    
    // 初始化审计日志记录器
    hs.auditLogger = NewAuditLogger()
    
    return hs, nil
}

// 启动健康评分
func (hs *HealthScorer) Start(ctx context.Context) error {
    log.Info("启动健康评分器")
    
    config := hs.config.Load().(*HealthScoreConfig)
    
    if !config.Enabled {
        log.Info("健康评分已禁用")
        return nil
    }
    
    // 定时计算健康评分
    ticker := time.NewTicker(config.CalculateInterval)
    defer ticker.Stop()
    
    for {
        select {
        case <-ctx.Done():
            log.Info("停止健康评分器")
            return nil
            
        case <-ticker.C:
            // 计算健康评分
            score, err := hs.CalculateScore(ctx)
            if err != nil {
                log.Errorf("计算健康评分失败: %v", err)
                continue
            }
            
            // 保存评分
            if err := hs.storage.Save(ctx, score); err != nil {
                log.Errorf("保存健康评分失败: %v", err)
            }
            
            // 检查是否需要告警
            if score.OverallScore < config.ScoreThreshold {
                hs.sendAlert(ctx, score)
            }
            
            log.Infof("健康评分计算完成: overall=%.2f, status=%s", 
                score.OverallScore, score.Status)
        }
    }
}

// 计算健康评分
func (hs *HealthScorer) CalculateScore(ctx context.Context) (*HealthScore, error) {
    log.Info("开始计算健康评分")
    
    config := hs.config.Load().(*HealthScoreConfig)
    
    score := &HealthScore{
        DimensionScores: make(map[string]*DimensionScore),
        Timestamp:       time.Now(),
        Issues:          make([]HealthIssue, 0),
        Suggestions:     make([]string, 0),
    }
    
    // 并发采集各维度指标
    var wg sync.WaitGroup
    dimensionScores := make(chan *DimensionScore, len(config.Dimensions))
    
    for _, dimConfig := range config.Dimensions {
        if !dimConfig.Enabled {
            continue
        }
        
        wg.Add(1)
        go func(dc DimensionConfig) {
            defer wg.Done()
            
            // 计算维度评分
            dimScore := hs.calculateDimensionScore(ctx, dc)
            dimensionScores <- dimScore
        }(dimConfig)
    }
    
    // 等待所有维度计算完成
    go func() {
        wg.Wait()
        close(dimensionScores)
    }()
    
    // 收集维度评分
    var totalWeightedScore float64
    var totalWeight float64
    
    for dimScore := range dimensionScores {
        score.DimensionScores[dimScore.Name] = dimScore
        
        // 加权求和
        totalWeightedScore += dimScore.Score * dimScore.Weight
        totalWeight += dimScore.Weight
        
        // 收集问题
        score.Issues = append(score.Issues, dimScore.Issues...)
    }
    
    // 计算综合评分
    if totalWeight > 0 {
        score.OverallScore = totalWeightedScore / totalWeight
    }
    
    // 确定健康状态
    score.Status = hs.determineHealthStatus(score.OverallScore)
    
    // 生成改进建议
    score.Suggestions = hs.generateSuggestions(score)
    
    return score, nil
}

// 计算维度评分
func (hs *HealthScorer) calculateDimensionScore(
    ctx context.Context,
    config DimensionConfig,
) *DimensionScore {
    log.Infof("计算维度评分: %s", config.Name)
    
    dimScore := &DimensionScore{
        Name:         config.Name,
        Weight:       config.Weight,
        MetricScores: make(map[string]float64),
        Issues:       make([]HealthIssue, 0),
    }
    
    // 采集各指标数据
    var totalWeightedScore float64
    var totalWeight float64
    
    for _, metricConfig := range config.Metrics {
        // 获取指标值
        value := hs.collectMetric(ctx, config.Name, metricConfig.Name)
        
        // 计算指标评分
        metricScore := hs.calculateMetricScore(value, metricConfig)
        dimScore.MetricScores[metricConfig.Name] = metricScore
        
        // 加权求和
        totalWeightedScore += metricScore * metricConfig.Weight
        totalWeight += metricConfig.Weight
        
        // 检查是否有问题
        if metricScore < 70 {
            issue := hs.createHealthIssue(config.Name, metricConfig.Name, value, metricScore)
            dimScore.Issues = append(dimScore.Issues, issue)
        }
    }
    
    // 计算维度评分
    if totalWeight > 0 {
        dimScore.Score = totalWeightedScore / totalWeight
    }
    
    // 确定维度健康状态
    dimScore.Status = hs.determineHealthStatus(dimScore.Score)
    
    return dimScore
}

// 采集指标
func (hs *HealthScorer) collectMetric(ctx context.Context, dimension, metric string) float64 {
    // 根据维度选择对应的采集器
    for _, collector := range hs.collectors {
        if collector.SupportsDimension(dimension) {
            return collector.Collect(ctx, metric)
        }
    }
    
    return 0
}

// 计算指标评分
func (hs *HealthScorer) calculateMetricScore(value float64, config MetricConfig) float64 {
    // 根据阈值和操作符计算评分
    switch config.Operator {
    case "gt": // 大于阈值为好
        if value >= config.Threshold {
            return 100.0
        }
        return (value / config.Threshold) * 100.0
        
    case "lt": // 小于阈值为好
        if value <= config.Threshold {
            return 100.0
        }
        return (config.Threshold / value) * 100.0
        
    case "eq": // 等于阈值为好
        diff := math.Abs(value - config.Threshold)
        if diff == 0 {
            return 100.0
        }
        return math.Max(0, 100.0-diff*10)
    }
    
    return 0
}

// 确定健康状态
func (hs *HealthScorer) determineHealthStatus(score float64) HealthStatus {
    switch {
    case score >= 90:
        return HealthStatusExcellent
    case score >= 70:
        return HealthStatusGood
    case score >= 50:
        return HealthStatusWarning
    default:
        return HealthStatusCritical
    }
}

// 创建健康问题
func (hs *HealthScorer) createHealthIssue(
    dimension, metric string,
    value, score float64,
) HealthIssue {
    issue := HealthIssue{
        Dimension:  dimension,
        Metric:     metric,
        DetectedAt: time.Now(),
    }
    
    // 根据评分确定严重程度
    switch {
    case score < 30:
        issue.Severity = "high"
    case score < 50:
        issue.Severity = "medium"
    default:
        issue.Severity = "low"
    }
    
    // 生成问题描述和建议
    issue.Description = fmt.Sprintf("%s 维度的 %s 指标评分较低（%.2f分）", 
        dimension, metric, score)
    issue.Impact = hs.getMetricImpact(dimension, metric)
    issue.Suggestion = hs.getMetricSuggestion(dimension, metric, value)
    
    return issue
}

// 获取指标影响说明
func (hs *HealthScorer) getMetricImpact(dimension, metric string) string {
    impacts := map[string]map[string]string{
        "collection": {
            "success_rate":  "采集成功率低会导致日志数据丢失",
            "latency":       "采集延迟高会影响实时性",
            "throughput":    "吞吐量低会导致日志积压",
        },
        "storage": {
            "disk_usage":    "磁盘使用率高可能导致存储空间不足",
            "query_latency": "查询延迟高会影响用户体验",
            "availability":  "可用性低会导致服务中断",
        },
        "analysis": {
            "processing_rate": "处理速率低会导致分析延迟",
            "accuracy":        "准确率低会影响分析结果质量",
            "coverage":        "覆盖率低会遗漏重要事件",
        },
        "alert": {
            "response_time": "响应时间长会延误问题处理",
            "false_positive": "误报率高会降低告警可信度",
            "coverage":       "覆盖率低会遗漏重要告警",
        },
    }
    
    if dimImpacts, ok := impacts[dimension]; ok {
        if impact, ok := dimImpacts[metric]; ok {
            return impact
        }
    }
    
    return "该指标异常会影响系统整体健康度"
}

// 获取指标改进建议
func (hs *HealthScorer) getMetricSuggestion(dimension, metric string, value float64) string {
    suggestions := map[string]map[string]string{
        "collection": {
            "success_rate":  "检查采集器配置和网络连接，增加重试机制",
            "latency":       "优化采集器性能，增加缓冲区大小",
            "throughput":    "增加采集器实例数量，优化数据处理流程",
        },
        "storage": {
            "disk_usage":    "清理过期数据，扩展存储容量，启用数据压缩",
            "query_latency": "优化索引配置，增加缓存，升级硬件",
            "availability":  "检查集群状态，修复故障节点，增加副本数",
        },
        "analysis": {
            "processing_rate": "增加分析节点，优化分析算法，调整批处理大小",
            "accuracy":        "优化分析规则，增加训练数据，调整模型参数",
            "coverage":        "扩展分析规则覆盖范围，增加数据源",
        },
        "alert": {
            "response_time": "优化告警规则，增加告警通道，提高处理优先级",
            "false_positive": "调整告警阈值，优化告警规则，增加告警抑制",
            "coverage":       "扩展告警规则，增加监控指标",
        },
    }
    
    if dimSuggestions, ok := suggestions[dimension]; ok {
        if suggestion, ok := dimSuggestions[metric]; ok {
            return suggestion
        }
    }
    
    return "请检查相关配置和系统资源"
}

// 生成改进建议
func (hs *HealthScorer) generateSuggestions(score *HealthScore) []string {
    suggestions := make([]string, 0)
    
    // 按严重程度排序问题
    highIssues := make([]HealthIssue, 0)
    mediumIssues := make([]HealthIssue, 0)
    lowIssues := make([]HealthIssue, 0)
    
    for _, issue := range score.Issues {
        switch issue.Severity {
        case "high":
            highIssues = append(highIssues, issue)
        case "medium":
            mediumIssues = append(mediumIssues, issue)
        case "low":
            lowIssues = append(lowIssues, issue)
        }
    }
    
    // 优先处理高严重度问题
    for _, issue := range highIssues {
        suggestions = append(suggestions, 
            fmt.Sprintf("[高优先级] %s: %s", issue.Description, issue.Suggestion))
    }
    
    for _, issue := range mediumIssues {
        suggestions = append(suggestions, 
            fmt.Sprintf("[中优先级] %s: %s", issue.Description, issue.Suggestion))
    }
    
    for _, issue := range lowIssues {
        suggestions = append(suggestions, 
            fmt.Sprintf("[低优先级] %s: %s", issue.Description, issue.Suggestion))
    }
    
    return suggestions
}

// 发送告警
func (hs *HealthScorer) sendAlert(ctx context.Context, score *HealthScore) {
    log.Warnf("健康评分低于阈值: %.2f", score.OverallScore)
    
    alert := &Alert{
        Level:   "warning",
        Title:   fmt.Sprintf("系统健康评分告警: %.2f分", score.OverallScore),
        Message: fmt.Sprintf("系统健康评分为 %.2f 分，状态: %s，发现 %d 个问题", 
            score.OverallScore, score.Status, len(score.Issues)),
        Fields: map[string]interface{}{
            "overall_score":    score.OverallScore,
            "status":           score.Status,
            "issue_count":      len(score.Issues),
            "dimension_scores": score.DimensionScores,
            "suggestions":      score.Suggestions,
        },
        Timestamp: time.Now(),
    }
    
    hs.alertManager.Send(ctx, alert)
}

// 获取健康评分历史
func (hs *HealthScorer) GetScoreHistory(
    ctx context.Context,
    startTime, endTime time.Time,
) ([]*HealthScore, error) {
    return hs.storage.Query(ctx, startTime, endTime)
}

// 生成健康报告
func (hs *HealthScorer) GenerateReport(
    ctx context.Context,
    startTime, endTime time.Time,
) (*HealthReport, error) {
    // 获取历史评分
    scores, err := hs.GetScoreHistory(ctx, startTime, endTime)
    if err != nil {
        return nil, err
    }
    
    // 生成报告
    return hs.reportGenerator.Generate(scores)
}

// 采集健康度采集器
type CollectionHealthCollector struct {
    prometheus *PrometheusClient
}

// 采集指标
func (c *CollectionHealthCollector) Collect(ctx context.Context, metric string) float64 {
    switch metric {
    case "success_rate":
        // 采集成功率
        return c.prometheus.Query(ctx, "log_collection_success_rate")
        
    case "latency":
        // 采集延迟（毫秒）
        latency := c.prometheus.Query(ctx, "log_collection_latency_ms")
        // 转换为评分（延迟越低越好，假设 100ms 为满分）
        return math.Max(0, 100-latency)
        
    case "throughput":
        // 吞吐量（条/秒）
        throughput := c.prometheus.Query(ctx, "log_collection_throughput")
        // 转换为评分（假设 10000 条/秒为满分）
        return math.Min(100, (throughput/10000)*100)
    }
    
    return 0
}

// 是否支持该维度
func (c *CollectionHealthCollector) SupportsDimension(dimension string) bool {
    return dimension == "collection"
}

// 存储健康度采集器
type StorageHealthCollector struct {
    prometheus *PrometheusClient
}

// 采集指标
func (s *StorageHealthCollector) Collect(ctx context.Context, metric string) float64 {
    switch metric {
    case "disk_usage":
        // 磁盘使用率（百分比）
        usage := s.prometheus.Query(ctx, "storage_disk_usage_percent")
        // 转换为评分（使用率越低越好）
        return math.Max(0, 100-usage)
        
    case "query_latency":
        // 查询延迟（毫秒）
        latency := s.prometheus.Query(ctx, "storage_query_latency_ms")
        // 转换为评分（延迟越低越好，假设 500ms 为满分）
        return math.Max(0, 100-(latency/5))
        
    case "availability":
        // 可用性（百分比）
        return s.prometheus.Query(ctx, "storage_availability_percent")
    }
    
    return 0
}

// 是否支持该维度
func (s *StorageHealthCollector) SupportsDimension(dimension string) bool {
    return dimension == "storage"
}
```

**关键实现点**:

1. 支持多维度健康评分计算（采集、存储、分析、告警），每个维度可配置权重
2. 使用加权平均算法计算综合健康评分，支持自定义评分规则
3. 并发采集各维度指标，提高计算效率
4. 自动识别健康问题并生成改进建议，按严重程度排序
5. 支持健康评分历史趋势分析，数据保留可配置
6. 低于阈值自动告警，包含详细的问题分析和改进建议
7. 提供健康报告生成功能，支持导出和分享

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| health_score_enabled | bool | true | 是否启用健康评分 |
| calculate_interval | int | 300 | 计算间隔（秒） |
| score_threshold | float | 70.0 | 告警阈值（0-100） |
| retention_days | int | 90 | 历史数据保留天数 |
| dimensions | array | [] | 维度配置列表 |
| custom_rules | array | [] | 自定义评分规则 |
| alert_enabled | bool | true | 是否启用告警 |
| report_enabled | bool | true | 是否启用报告生成 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + PostgreSQL
- 生效时间: 立即生效（下次计算生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志并发送告警

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的维度权重和评分规则
2. WHEN 告警阈值变更时，THE System SHALL 在下次评分计算时使用新阈值
3. THE System SHALL 支持通过 API 查询当前生效的健康评分配置
4. THE System SHALL 记录所有健康评分配置变更的审计日志
5. WHEN 维度配置变更时，THE System SHALL 验证权重总和是否合理（建议为1.0）

---


#### 需求 16-61: 日志采样与流量控制 [Phase 2]

**用户故事**:

作为系统架构师，我希望能够配置日志采样策略，以便在高流量场景下控制日志数据量同时保留关键信息。

**验收标准**:

1. THE Log_Collector SHALL 支持配置日志采样率（1%-100%），按比例采集日志数据
2. THE Log_Collector SHALL 支持智能采样，优先保留错误日志和异常日志（ERROR/FATAL 级别 100% 保留）
3. THE Log_Collector SHALL 支持基于日志级别的差异化采样（DEBUG 10%、INFO 50%、WARN 80%、ERROR 100%）
4. WHEN 日志流量超过阈值（可配置，默认 10万条/秒）时，THE Log_Collector SHALL 自动启用采样策略
5. THE Log_Collector SHALL 支持基于内容的智能采样，保留包含关键字的日志（如 "error"、"exception"、"timeout"）
6. THE Dashboard SHALL 提供采样策略的配置界面，支持按日志源、级别、标签等维度配置
7. THE Dashboard SHALL 展示采样前后的日志量对比，包括采样率、丢弃数量、保留数量
8. THE System SHALL 在采样的日志中添加采样标记，记录原始日志量和采样率
9. THE System SHALL 支持采样统计信息的实时监控，显示各维度的采样效果
10. THE System SHALL 通过配置中心管理采样策略，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/collector/sampling/sampler.go
package sampling

import (
    "context"
    "hash/fnv"
    "math/rand"
    "sync/atomic"
    "time"
)

// 日志采样器
type LogSampler struct {
    config        atomic.Value      // 配置（支持热更新）
    stats         *SamplingStats    // 采样统计
    rateLimiter   *RateLimiter      // 流量限制器
    bloomFilter   *BloomFilter      // 布隆过滤器（去重）
    auditLogger   *AuditLogger      // 审计日志
}

// 采样配置
type SamplingConfig struct {
    Enabled              bool                    // 是否启用采样
    DefaultRate          float64                 // 默认采样率（0.0-1.0）
    LevelRates           map[string]float64      // 按级别采样率
    SourceRates          map[string]float64      // 按来源采样率
    KeywordPreserve      []string                // 关键字保留列表
    AutoSamplingEnabled  bool                    // 是否启用自动采样
    ThresholdQPS         int                     // 触发自动采样的QPS阈值
    MinSamplingRate      float64                 // 最小采样率
    AdaptiveInterval     time.Duration           // 自适应调整间隔
}

// 采样策略
type SamplingStrategy struct {
    Type       string  // 策略类型：fixed/adaptive/intelligent
    Rate       float64 // 采样率
    Conditions []Condition // 采样条件
}

// 采样统计
type SamplingStats struct {
    TotalReceived    atomic.Int64  // 总接收数
    TotalSampled     atomic.Int64  // 总采样数
    TotalDropped     atomic.Int64  // 总丢弃数
    LevelStats       map[string]*LevelStat // 按级别统计
    SourceStats      map[string]*SourceStat // 按来源统计
    LastUpdateTime   time.Time     // 最后更新时间
}

// 级别统计
type LevelStat struct {
    Received atomic.Int64 // 接收数
    Sampled  atomic.Int64 // 采样数
    Dropped  atomic.Int64 // 丢弃数
}

// 来源统计
type SourceStat struct {
    Received atomic.Int64 // 接收数
    Sampled  atomic.Int64 // 采样数
    Dropped  atomic.Int64 // 丢弃数
}

// 创建日志采样器
func NewLogSampler(config *SamplingConfig) *LogSampler {
    ls := &LogSampler{
        stats:       NewSamplingStats(),
        rateLimiter: NewRateLimiter(config.ThresholdQPS),
        bloomFilter: NewBloomFilter(1000000, 0.01),
        auditLogger: NewAuditLogger(),
    }
    ls.config.Store(config)
    
    // 启动自适应采样调整
    if config.AutoSamplingEnabled {
        go ls.adaptiveSampling()
    }
    
    return ls
}

// 采样决策
func (ls *LogSampler) ShouldSample(entry *LogEntry) bool {
    config := ls.config.Load().(*SamplingConfig)
    
    // 如果未启用采样，全部保留
    if !config.Enabled {
        ls.stats.TotalReceived.Add(1)
        ls.stats.TotalSampled.Add(1)
        return true
    }
    
    ls.stats.TotalReceived.Add(1)
    
    // 1. 检查是否为关键日志（错误级别）
    if ls.isCriticalLog(entry) {
        ls.stats.TotalSampled.Add(1)
        ls.updateLevelStats(entry.Level, true)
        return true
    }
    
    // 2. 检查是否包含关键字
    if ls.containsKeywords(entry, config.KeywordPreserve) {
        ls.stats.TotalSampled.Add(1)
        ls.updateLevelStats(entry.Level, true)
        entry.Fields["sampling_reason"] = "keyword_match"
        return true
    }
    
    // 3. 获取采样率
    samplingRate := ls.getSamplingRate(entry, config)
    
    // 4. 执行采样决策
    if ls.sample(entry, samplingRate) {
        ls.stats.TotalSampled.Add(1)
        ls.updateLevelStats(entry.Level, true)
        
        // 添加采样标记
        entry.Fields["sampled"] = true
        entry.Fields["sampling_rate"] = samplingRate
        entry.Fields["sampling_type"] = ls.getSamplingType(config)
        
        return true
    }
    
    // 丢弃日志
    ls.stats.TotalDropped.Add(1)
    ls.updateLevelStats(entry.Level, false)
    
    return false
}

// 判断是否为关键日志
func (ls *LogSampler) isCriticalLog(entry *LogEntry) bool {
    // ERROR 和 FATAL 级别的日志始终保留
    return entry.Level == "ERROR" || entry.Level == "FATAL"
}

// 检查是否包含关键字
func (ls *LogSampler) containsKeywords(entry *LogEntry, keywords []string) bool {
    message := strings.ToLower(entry.Message)
    
    for _, keyword := range keywords {
        if strings.Contains(message, strings.ToLower(keyword)) {
            return true
        }
    }
    
    return false
}

// 获取采样率
func (ls *LogSampler) getSamplingRate(entry *LogEntry, config *SamplingConfig) float64 {
    // 1. 优先使用来源特定的采样率
    if rate, exists := config.SourceRates[entry.Source]; exists {
        return rate
    }
    
    // 2. 使用级别特定的采样率
    if rate, exists := config.LevelRates[entry.Level]; exists {
        return rate
    }
    
    // 3. 使用默认采样率
    return config.DefaultRate
}

// 执行采样
func (ls *LogSampler) sample(entry *LogEntry, rate float64) bool {
    // 使用一致性哈希采样，确保相同内容的日志采样结果一致
    hash := ls.hashEntry(entry)
    threshold := uint64(float64(^uint64(0)) * rate)
    
    return hash <= threshold
}

// 计算日志哈希
func (ls *LogSampler) hashEntry(entry *LogEntry) uint64 {
    h := fnv.New64a()
    
    // 使用日志的关键字段计算哈希
    h.Write([]byte(entry.Source))
    h.Write([]byte(entry.Level))
    h.Write([]byte(entry.Message))
    
    return h.Sum64()
}

// 获取采样类型
func (ls *LogSampler) getSamplingType(config *SamplingConfig) string {
    if config.AutoSamplingEnabled {
        return "adaptive"
    }
    return "fixed"
}

// 自适应采样
func (ls *LogSampler) adaptiveSampling() {
    config := ls.config.Load().(*SamplingConfig)
    ticker := time.NewTicker(config.AdaptiveInterval)
    defer ticker.Stop()
    
    for range ticker.C {
        ls.adjustSamplingRate()
    }
}

// 调整采样率
func (ls *LogSampler) adjustSamplingRate() {
    config := ls.config.Load().(*SamplingConfig)
    
    // 计算当前 QPS
    currentQPS := ls.calculateCurrentQPS()
    
    log.Infof("当前 QPS: %d, 阈值: %d", currentQPS, config.ThresholdQPS)
    
    // 如果超过阈值，降低采样率
    if currentQPS > config.ThresholdQPS {
        // 计算超出比例
        ratio := float64(currentQPS) / float64(config.ThresholdQPS)
        
        // 调整采样率（反比例）
        newRate := config.DefaultRate / ratio
        
        // 确保不低于最小采样率
        if newRate < config.MinSamplingRate {
            newRate = config.MinSamplingRate
        }
        
        log.Warnf("流量超过阈值，调整采样率: %.2f%% -> %.2f%%", 
            config.DefaultRate*100, newRate*100)
        
        // 更新配置
        newConfig := *config
        newConfig.DefaultRate = newRate
        ls.config.Store(&newConfig)
        
        // 记录审计日志
        ls.auditLogger.LogSamplingAdjustment(config.DefaultRate, newRate, currentQPS)
    } else if currentQPS < config.ThresholdQPS/2 {
        // 如果流量降低，逐步恢复采样率
        newRate := config.DefaultRate * 1.1
        if newRate > 1.0 {
            newRate = 1.0
        }
        
        if newRate != config.DefaultRate {
            log.Infof("流量降低，恢复采样率: %.2f%% -> %.2f%%", 
                config.DefaultRate*100, newRate*100)
            
            newConfig := *config
            newConfig.DefaultRate = newRate
            ls.config.Store(&newConfig)
        }
    }
}

// 计算当前 QPS
func (ls *LogSampler) calculateCurrentQPS() int {
    // 获取最近一秒的接收数量
    currentReceived := ls.stats.TotalReceived.Load()
    
    // 等待1秒
    time.Sleep(1 * time.Second)
    
    newReceived := ls.stats.TotalReceived.Load()
    
    return int(newReceived - currentReceived)
}

// 更新级别统计
func (ls *LogSampler) updateLevelStats(level string, sampled bool) {
    if ls.stats.LevelStats == nil {
        ls.stats.LevelStats = make(map[string]*LevelStat)
    }
    
    if _, exists := ls.stats.LevelStats[level]; !exists {
        ls.stats.LevelStats[level] = &LevelStat{}
    }
    
    stat := ls.stats.LevelStats[level]
    stat.Received.Add(1)
    
    if sampled {
        stat.Sampled.Add(1)
    } else {
        stat.Dropped.Add(1)
    }
}

// 获取采样统计
func (ls *LogSampler) GetStats() *SamplingStats {
    return ls.stats
}

// 获取采样报告
func (ls *LogSampler) GetSamplingReport() *SamplingReport {
    totalReceived := ls.stats.TotalReceived.Load()
    totalSampled := ls.stats.TotalSampled.Load()
    totalDropped := ls.stats.TotalDropped.Load()
    
    report := &SamplingReport{
        TotalReceived:  totalReceived,
        TotalSampled:   totalSampled,
        TotalDropped:   totalDropped,
        SamplingRate:   float64(totalSampled) / float64(totalReceived),
        DropRate:       float64(totalDropped) / float64(totalReceived),
        LevelBreakdown: make(map[string]*LevelBreakdown),
        Timestamp:      time.Now(),
    }
    
    // 按级别统计
    for level, stat := range ls.stats.LevelStats {
        received := stat.Received.Load()
        sampled := stat.Sampled.Load()
        dropped := stat.Dropped.Load()
        
        report.LevelBreakdown[level] = &LevelBreakdown{
            Received:     received,
            Sampled:      sampled,
            Dropped:      dropped,
            SamplingRate: float64(sampled) / float64(received),
        }
    }
    
    return report
}

// 采样报告
type SamplingReport struct {
    TotalReceived  int64                      // 总接收数
    TotalSampled   int64                      // 总采样数
    TotalDropped   int64                      // 总丢弃数
    SamplingRate   float64                    // 采样率
    DropRate       float64                    // 丢弃率
    LevelBreakdown map[string]*LevelBreakdown // 按级别分解
    Timestamp      time.Time                  // 时间戳
}

// 级别分解
type LevelBreakdown struct {
    Received     int64   // 接收数
    Sampled      int64   // 采样数
    Dropped      int64   // 丢弃数
    SamplingRate float64 // 采样率
}

// 流量限制器
type RateLimiter struct {
    limit       int           // QPS 限制
    tokens      atomic.Int64  // 令牌数
    lastRefill  time.Time     // 最后补充时间
    mu          sync.Mutex
}

// 创建流量限制器
func NewRateLimiter(limit int) *RateLimiter {
    rl := &RateLimiter{
        limit:      limit,
        lastRefill: time.Now(),
    }
    rl.tokens.Store(int64(limit))
    
    // 启动令牌补充
    go rl.refillTokens()
    
    return rl
}

// 尝试获取令牌
func (rl *RateLimiter) TryAcquire() bool {
    if rl.tokens.Load() > 0 {
        rl.tokens.Add(-1)
        return true
    }
    return false
}

// 补充令牌
func (rl *RateLimiter) refillTokens() {
    ticker := time.NewTicker(1 * time.Second)
    defer ticker.Stop()
    
    for range ticker.C {
        rl.tokens.Store(int64(rl.limit))
    }
}

// 智能采样器（基于内容）
type IntelligentSampler struct {
    patterns []*regexp.Regexp // 匹配模式
    weights  map[string]float64 // 权重
}

// 创建智能采样器
func NewIntelligentSampler(patterns []string) *IntelligentSampler {
    is := &IntelligentSampler{
        patterns: make([]*regexp.Regexp, 0),
        weights:  make(map[string]float64),
    }
    
    // 编译正则表达式
    for _, pattern := range patterns {
        if re, err := regexp.Compile(pattern); err == nil {
            is.patterns = append(is.patterns, re)
        }
    }
    
    return is
}

// 计算日志重要性得分
func (is *IntelligentSampler) CalculateImportance(entry *LogEntry) float64 {
    var score float64
    
    // 1. 基于级别的基础分数
    switch entry.Level {
    case "FATAL":
        score = 1.0
    case "ERROR":
        score = 0.9
    case "WARN":
        score = 0.6
    case "INFO":
        score = 0.3
    case "DEBUG":
        score = 0.1
    }
    
    // 2. 基于内容匹配的加分
    for _, pattern := range is.patterns {
        if pattern.MatchString(entry.Message) {
            score += 0.2
        }
    }
    
    // 3. 基于频率的调整（低频日志更重要）
    // 这里可以结合布隆过滤器判断日志的稀有程度
    
    // 归一化到 0-1
    if score > 1.0 {
        score = 1.0
    }
    
    return score
}

// 基于重要性采样
func (is *IntelligentSampler) SampleByImportance(entry *LogEntry, targetRate float64) bool {
    importance := is.CalculateImportance(entry)
    
    // 重要性越高，采样概率越大
    samplingRate := targetRate + (1.0-targetRate)*importance
    
    return rand.Float64() < samplingRate
}
```

**关键实现点**:

1. 支持三种采样策略：固定采样率、自适应采样、智能采样
2. 使用一致性哈希确保相同内容的日志采样结果一致，避免采样偏差
3. 实现自适应采样，根据实时流量自动调整采样率
4. 关键日志（ERROR/FATAL）和包含关键字的日志 100% 保留
5. 支持按日志级别、来源、标签等多维度配置差异化采样率
6. 使用令牌桶算法实现流量限制，防止流量突发
7. 提供详细的采样统计报告，包括总体统计和按级别分解

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| sampling_enabled | bool | false | 是否启用采样 |
| default_rate | float | 1.0 | 默认采样率（0.0-1.0） |
| level_rates | map | {"DEBUG":0.1,"INFO":0.5,"WARN":0.8,"ERROR":1.0} | 按级别采样率 |
| source_rates | map | {} | 按来源采样率 |
| keyword_preserve | array | ["error","exception","timeout","fatal"] | 关键字保留列表 |
| auto_sampling_enabled | bool | true | 是否启用自动采样 |
| threshold_qps | int | 100000 | 触发自动采样的QPS阈值 |
| min_sampling_rate | float | 0.01 | 最小采样率（1%） |
| adaptive_interval | int | 60 | 自适应调整间隔（秒） |

**热更新机制**:

- 更新方式: Redis Pub/Sub + PostgreSQL
- 生效时间: 立即生效（下次采样决策生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志并发送告警

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的采样率和策略
2. WHEN 采样率变更时，THE System SHALL 在下次采样决策时使用新采样率
3. THE System SHALL 支持通过 API 查询当前生效的采样配置和统计信息
4. THE System SHALL 记录所有采样配置变更的审计日志
5. WHEN 关键字列表变更时，THE System SHALL 验证关键字的有效性

---

#### 需求 16-62: 日志模板管理 [Phase 2]

**用户故事**:

作为运维工程师，我希望能够管理标准化的日志模板，以便统一不同应用的日志格式。

**验收标准**:

1. THE Dashboard SHALL 提供日志模板管理界面，支持创建、编辑、删除和查看日志模板
2. THE System SHALL 提供预置的日志模板库，包含至少 6 种常见应用的模板（Nginx、Apache、Spring Boot、Node.js、MySQL、PostgreSQL）
3. THE Log_Collector SHALL 支持基于模板自动解析日志，提取结构化字段，解析成功率 >= 95%
4. THE System SHALL 支持模板的版本管理，跟踪模板变更历史，保留至少最近 10 个版本
5. THE System SHALL 支持模板的自动推荐，根据日志内容智能匹配合适的模板，推荐准确率 >= 85%
6. THE Dashboard SHALL 支持模板的导入和导出功能，支持 JSON 和 YAML 格式
7. THE System SHALL 支持模板的测试功能，允许用户上传样例日志验证模板解析效果
8. THE System SHALL 支持模板的分类和标签管理，便于组织和查找模板
9. WHEN 模板解析失败率超过 10% 时，THE System SHALL 自动发送告警并提供优化建议
10. THE System SHALL 通过配置中心管理模板配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/template/manager.go
package template

import (
    "context"
    "time"
    "regexp"
)

// 模板管理器
type TemplateManager struct {
    config       atomic.Value      // 配置（支持热更新）
    storage      *TemplateStorage  // 模板存储
    parser       *TemplateParser   // 模板解析器
    recommender  *TemplateRecommender // 模板推荐器
    validator    *TemplateValidator // 模板验证器
    versionCtrl  *VersionController // 版本控制器
    auditLogger  *AuditLogger      // 审计日志记录器
}

// 模板配置
type TemplateConfig struct {
    PresetTemplates    []string          // 预置模板列表
    AutoRecommend      bool              // 是否启用自动推荐
    RecommendThreshold float64           // 推荐阈值
    MaxVersions        int               // 最大版本数
    ParseTimeout       time.Duration     // 解析超时时间
    FailureThreshold   float64           // 失败率阈值
}

// 日志模板
type LogTemplate struct {
    ID          string                 // 模板ID
    Name        string                 // 模板名称
    Description string                 // 模板描述
    Category    string                 // 模板分类
    Tags        []string               // 模板标签
    Pattern     string                 // 匹配模式（正则表达式）
    Fields      []FieldDefinition      // 字段定义
    Examples    []string               // 示例日志
    Version     int                    // 版本号
    Author      string                 // 作者
    CreatedAt   time.Time              // 创建时间
    UpdatedAt   time.Time              // 更新时间
    Metadata    map[string]interface{} // 元数据
}

// 字段定义
type FieldDefinition struct {
    Name        string   // 字段名称
    Type        string   // 字段类型：string/int/float/timestamp/ip/url
    Required    bool     // 是否必需
    Description string   // 字段描述
    Pattern     string   // 提取模式（正则表达式捕获组）
    Transform   string   // 转换函数（可选）
    Validators  []string // 验证器列表
}

// 模板版本
type TemplateVersion struct {
    Version   int       // 版本号
    Template  *LogTemplate // 模板内容
    ChangeLog string    // 变更日志
    Author    string    // 修改者
    CreatedAt time.Time // 创建时间
}

// 创建模板管理器
func NewTemplateManager(config *TemplateConfig) (*TemplateManager, error) {
    tm := &TemplateManager{}
    tm.config.Store(config)
    
    // 初始化模板存储
    tm.storage = NewTemplateStorage()
    
    // 初始化模板解析器
    tm.parser = NewTemplateParser()
    
    // 初始化模板推荐器
    tm.recommender = NewTemplateRecommender()
    
    // 初始化模板验证器
    tm.validator = NewTemplateValidator()
    
    // 初始化版本控制器
    tm.versionCtrl = NewVersionController(config.MaxVersions)
    
    // 初始化审计日志记录器
    tm.auditLogger = NewAuditLogger()
    
    // 加载预置模板
    if err := tm.loadPresetTemplates(); err != nil {
        return nil, fmt.Errorf("加载预置模板失败: %w", err)
    }
    
    return tm, nil
}

// 加载预置模板
func (tm *TemplateManager) loadPresetTemplates() error {
    log.Info("加载预置模板")
    
    // Nginx 访问日志模板
    nginxTemplate := &LogTemplate{
        ID:          "nginx-access",
        Name:        "Nginx Access Log",
        Description: "Nginx 访问日志标准格式",
        Category:    "web-server",
        Tags:        []string{"nginx", "access", "http"},
        Pattern:     `^(\S+) - (\S+) \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d+) (\d+) "([^"]*)" "([^"]*)"$`,
        Fields: []FieldDefinition{
            {Name: "remote_addr", Type: "ip", Required: true, Description: "客户端IP地址", Pattern: "$1"},
            {Name: "remote_user", Type: "string", Required: false, Description: "远程用户", Pattern: "$2"},
            {Name: "time_local", Type: "timestamp", Required: true, Description: "本地时间", Pattern: "$3"},
            {Name: "method", Type: "string", Required: true, Description: "HTTP方法", Pattern: "$4"},
            {Name: "uri", Type: "url", Required: true, Description: "请求URI", Pattern: "$5"},
            {Name: "protocol", Type: "string", Required: true, Description: "HTTP协议", Pattern: "$6"},
            {Name: "status", Type: "int", Required: true, Description: "响应状态码", Pattern: "$7"},
            {Name: "body_bytes_sent", Type: "int", Required: true, Description: "发送字节数", Pattern: "$8"},
            {Name: "http_referer", Type: "url", Required: false, Description: "引用页", Pattern: "$9"},
            {Name: "http_user_agent", Type: "string", Required: false, Description: "用户代理", Pattern: "$10"},
        },
        Examples: []string{
            `192.168.1.100 - - [29/Jan/2026:10:00:00 +0800] "GET /api/users HTTP/1.1" 200 1234 "https://example.com" "Mozilla/5.0"`,
        },
        Version:   1,
        Author:    "system",
        CreatedAt: time.Now(),
        UpdatedAt: time.Now(),
    }
    
    // Apache 访问日志模板
    apacheTemplate := &LogTemplate{
        ID:          "apache-access",
        Name:        "Apache Access Log",
        Description: "Apache 访问日志标准格式",
        Category:    "web-server",
        Tags:        []string{"apache", "access", "http"},
        Pattern:     `^(\S+) (\S+) (\S+) \[([^\]]+)\] "([^"]*)" (\d+) (\d+)$`,
        Fields: []FieldDefinition{
            {Name: "remote_host", Type: "ip", Required: true, Description: "远程主机", Pattern: "$1"},
            {Name: "remote_logname", Type: "string", Required: false, Description: "远程登录名", Pattern: "$2"},
            {Name: "remote_user", Type: "string", Required: false, Description: "远程用户", Pattern: "$3"},
            {Name: "time", Type: "timestamp", Required: true, Description: "时间", Pattern: "$4"},
            {Name: "request", Type: "string", Required: true, Description: "请求", Pattern: "$5"},
            {Name: "status", Type: "int", Required: true, Description: "状态码", Pattern: "$6"},
            {Name: "bytes", Type: "int", Required: true, Description: "字节数", Pattern: "$7"},
        },
        Examples: []string{
            `192.168.1.100 - frank [29/Jan/2026:10:00:00 +0800] "GET /index.html HTTP/1.1" 200 2326`,
        },
        Version:   1,
        Author:    "system",
        CreatedAt: time.Now(),
        UpdatedAt: time.Now(),
    }
    
    // Spring Boot 应用日志模板
    springBootTemplate := &LogTemplate{
        ID:          "spring-boot",
        Name:        "Spring Boot Application Log",
        Description: "Spring Boot 应用日志标准格式",
        Category:    "application",
        Tags:        []string{"spring-boot", "java", "application"},
        Pattern:     `^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+(\w+)\s+(\d+)\s+---\s+\[([^\]]+)\]\s+(\S+)\s+:\s+(.*)$`,
        Fields: []FieldDefinition{
            {Name: "timestamp", Type: "timestamp", Required: true, Description: "时间戳", Pattern: "$1"},
            {Name: "level", Type: "string", Required: true, Description: "日志级别", Pattern: "$2"},
            {Name: "pid", Type: "int", Required: true, Description: "进程ID", Pattern: "$3"},
            {Name: "thread", Type: "string", Required: true, Description: "线程名", Pattern: "$4"},
            {Name: "logger", Type: "string", Required: true, Description: "日志记录器", Pattern: "$5"},
            {Name: "message", Type: "string", Required: true, Description: "日志消息", Pattern: "$6"},
        },
        Examples: []string{
            `2026-01-29 10:00:00.123  INFO 12345 --- [main] com.example.Application : Starting Application`,
        },
        Version:   1,
        Author:    "system",
        CreatedAt: time.Now(),
        UpdatedAt: time.Now(),
    }
    
    // 保存预置模板
    templates := []*LogTemplate{nginxTemplate, apacheTemplate, springBootTemplate}
    for _, template := range templates {
        if err := tm.storage.Save(template); err != nil {
            return fmt.Errorf("保存模板失败: %w", err)
        }
        log.Infof("加载预置模板: %s", template.Name)
    }
    
    return nil
}

// 创建模板
func (tm *TemplateManager) CreateTemplate(ctx context.Context, template *LogTemplate) error {
    log.Infof("创建模板: %s", template.Name)
    
    // 1. 验证模板
    if err := tm.validator.Validate(template); err != nil {
        return fmt.Errorf("模板验证失败: %w", err)
    }
    
    // 2. 生成模板ID
    if template.ID == "" {
        template.ID = generateTemplateID(template.Name)
    }
    
    // 3. 设置版本号
    template.Version = 1
    template.CreatedAt = time.Now()
    template.UpdatedAt = time.Now()
    
    // 4. 保存模板
    if err := tm.storage.Save(template); err != nil {
        return fmt.Errorf("保存模板失败: %w", err)
    }
    
    // 5. 创建版本记录
    version := &TemplateVersion{
        Version:   1,
        Template:  template,
        ChangeLog: "初始版本",
        Author:    template.Author,
        CreatedAt: time.Now(),
    }
    tm.versionCtrl.AddVersion(template.ID, version)
    
    // 6. 记录审计日志
    tm.auditLogger.LogTemplateCreate(template)
    
    return nil
}

// 更新模板
func (tm *TemplateManager) UpdateTemplate(ctx context.Context, templateID string, updates *LogTemplate) error {
    log.Infof("更新模板: %s", templateID)
    
    // 1. 获取现有模板
    existing, err := tm.storage.Get(templateID)
    if err != nil {
        return fmt.Errorf("获取模板失败: %w", err)
    }
    
    // 2. 验证更新内容
    if err := tm.validator.Validate(updates); err != nil {
        return fmt.Errorf("模板验证失败: %w", err)
    }
    
    // 3. 更新模板字段
    existing.Name = updates.Name
    existing.Description = updates.Description
    existing.Category = updates.Category
    existing.Tags = updates.Tags
    existing.Pattern = updates.Pattern
    existing.Fields = updates.Fields
    existing.Examples = updates.Examples
    existing.Version++
    existing.UpdatedAt = time.Now()
    
    // 4. 保存更新后的模板
    if err := tm.storage.Save(existing); err != nil {
        return fmt.Errorf("保存模板失败: %w", err)
    }
    
    // 5. 创建新版本记录
    version := &TemplateVersion{
        Version:   existing.Version,
        Template:  existing,
        ChangeLog: "模板更新",
        Author:    updates.Author,
        CreatedAt: time.Now(),
    }
    tm.versionCtrl.AddVersion(templateID, version)
    
    // 6. 记录审计日志
    tm.auditLogger.LogTemplateUpdate(existing)
    
    return nil
}

// 删除模板
func (tm *TemplateManager) DeleteTemplate(ctx context.Context, templateID string) error {
    log.Infof("删除模板: %s", templateID)
    
    // 1. 获取模板
    template, err := tm.storage.Get(templateID)
    if err != nil {
        return fmt.Errorf("获取模板失败: %w", err)
    }
    
    // 2. 删除模板
    if err := tm.storage.Delete(templateID); err != nil {
        return fmt.Errorf("删除模板失败: %w", err)
    }
    
    // 3. 删除版本历史
    tm.versionCtrl.DeleteVersions(templateID)
    
    // 4. 记录审计日志
    tm.auditLogger.LogTemplateDelete(template)
    
    return nil
}

// 解析日志
func (tm *TemplateManager) ParseLog(ctx context.Context, logLine string, templateID string) (map[string]interface{}, error) {
    // 1. 获取模板
    template, err := tm.storage.Get(templateID)
    if err != nil {
        return nil, fmt.Errorf("获取模板失败: %w", err)
    }
    
    // 2. 编译正则表达式
    regex, err := regexp.Compile(template.Pattern)
    if err != nil {
        return nil, fmt.Errorf("编译正则表达式失败: %w", err)
    }
    
    // 3. 匹配日志
    matches := regex.FindStringSubmatch(logLine)
    if matches == nil {
        return nil, fmt.Errorf("日志不匹配模板")
    }
    
    // 4. 提取字段
    result := make(map[string]interface{})
    for _, field := range template.Fields {
        // 从捕获组中提取值
        groupIndex := tm.extractGroupIndex(field.Pattern)
        if groupIndex > 0 && groupIndex < len(matches) {
            value := matches[groupIndex]
            
            // 类型转换
            converted, err := tm.convertFieldValue(value, field.Type)
            if err != nil {
                log.Warnf("字段类型转换失败: field=%s, value=%s, err=%v", field.Name, value, err)
                continue
            }
            
            result[field.Name] = converted
        }
    }
    
    return result, nil
}

// 推荐模板
func (tm *TemplateManager) RecommendTemplate(ctx context.Context, logLine string) ([]*TemplateRecommendation, error) {
    log.Infof("推荐模板: log=%s", logLine)
    
    config := tm.config.Load().(*TemplateConfig)
    
    // 1. 获取所有模板
    templates, err := tm.storage.ListAll()
    if err != nil {
        return nil, fmt.Errorf("获取模板列表失败: %w", err)
    }
    
    // 2. 计算每个模板的匹配度
    var recommendations []*TemplateRecommendation
    for _, template := range templates {
        score := tm.recommender.CalculateMatchScore(logLine, template)
        
        if score >= config.RecommendThreshold {
            recommendation := &TemplateRecommendation{
                Template:   template,
                Score:      score,
                Confidence: tm.calculateConfidence(score),
            }
            recommendations = append(recommendations, recommendation)
        }
    }
    
    // 3. 按匹配度排序
    sort.Slice(recommendations, func(i, j int) bool {
        return recommendations[i].Score > recommendations[j].Score
    })
    
    // 4. 返回前 5 个推荐
    if len(recommendations) > 5 {
        recommendations = recommendations[:5]
    }
    
    return recommendations, nil
}

// 模板推荐结果
type TemplateRecommendation struct {
    Template   *LogTemplate // 推荐的模板
    Score      float64      // 匹配分数（0-100）
    Confidence string       // 置信度：high/medium/low
}

// 计算置信度
func (tm *TemplateManager) calculateConfidence(score float64) string {
    if score >= 90 {
        return "high"
    } else if score >= 70 {
        return "medium"
    }
    return "low"
}

// 测试模板
func (tm *TemplateManager) TestTemplate(ctx context.Context, templateID string, sampleLogs []string) (*TemplateTestResult, error) {
    log.Infof("测试模板: template=%s, samples=%d", templateID, len(sampleLogs))
    
    result := &TemplateTestResult{
        TemplateID:   templateID,
        TotalSamples: len(sampleLogs),
        StartTime:    time.Now(),
    }
    
    // 解析每个样例日志
    for _, logLine := range sampleLogs {
        parsed, err := tm.ParseLog(ctx, logLine, templateID)
        if err != nil {
            result.FailedSamples++
            result.Errors = append(result.Errors, &ParseError{
                LogLine: logLine,
                Error:   err.Error(),
            })
        } else {
            result.SuccessSamples++
            result.ParsedResults = append(result.ParsedResults, parsed)
        }
    }
    
    result.EndTime = time.Now()
    result.Duration = result.EndTime.Sub(result.StartTime)
    result.SuccessRate = float64(result.SuccessSamples) / float64(result.TotalSamples) * 100
    
    return result, nil
}

// 模板测试结果
type TemplateTestResult struct {
    TemplateID     string                   // 模板ID
    TotalSamples   int                      // 总样例数
    SuccessSamples int                      // 成功样例数
    FailedSamples  int                      // 失败样例数
    SuccessRate    float64                  // 成功率（%）
    ParsedResults  []map[string]interface{} // 解析结果
    Errors         []*ParseError            // 错误列表
    StartTime      time.Time                // 开始时间
    EndTime        time.Time                // 结束时间
    Duration       time.Duration            // 耗时
}

// 解析错误
type ParseError struct {
    LogLine string // 日志行
    Error   string // 错误信息
}

// 导出模板
func (tm *TemplateManager) ExportTemplate(ctx context.Context, templateID string, format string) ([]byte, error) {
    log.Infof("导出模板: template=%s, format=%s", templateID, format)
    
    // 1. 获取模板
    template, err := tm.storage.Get(templateID)
    if err != nil {
        return nil, fmt.Errorf("获取模板失败: %w", err)
    }
    
    // 2. 根据格式导出
    var data []byte
    switch format {
    case "json":
        data, err = json.MarshalIndent(template, "", "  ")
    case "yaml":
        data, err = yaml.Marshal(template)
    default:
        return nil, fmt.Errorf("不支持的格式: %s", format)
    }
    
    if err != nil {
        return nil, fmt.Errorf("序列化失败: %w", err)
    }
    
    // 3. 记录审计日志
    tm.auditLogger.LogTemplateExport(template, format)
    
    return data, nil
}

// 导入模板
func (tm *TemplateManager) ImportTemplate(ctx context.Context, data []byte, format string) error {
    log.Infof("导入模板: format=%s", format)
    
    var template LogTemplate
    var err error
    
    // 1. 根据格式解析
    switch format {
    case "json":
        err = json.Unmarshal(data, &template)
    case "yaml":
        err = yaml.Unmarshal(data, &template)
    default:
        return fmt.Errorf("不支持的格式: %s", format)
    }
    
    if err != nil {
        return fmt.Errorf("解析失败: %w", err)
    }
    
    // 2. 验证模板
    if err := tm.validator.Validate(&template); err != nil {
        return fmt.Errorf("模板验证失败: %w", err)
    }
    
    // 3. 创建模板
    if err := tm.CreateTemplate(ctx, &template); err != nil {
        return fmt.Errorf("创建模板失败: %w", err)
    }
    
    // 4. 记录审计日志
    tm.auditLogger.LogTemplateImport(&template, format)
    
    return nil
}

// 模板验证器
type TemplateValidator struct{}

// 验证模板
func (tv *TemplateValidator) Validate(template *LogTemplate) error {
    // 1. 验证必填字段
    if template.Name == "" {
        return fmt.Errorf("模板名称不能为空")
    }
    
    if template.Pattern == "" {
        return fmt.Errorf("匹配模式不能为空")
    }
    
    if len(template.Fields) == 0 {
        return fmt.Errorf("字段定义不能为空")
    }
    
    // 2. 验证正则表达式
    if _, err := regexp.Compile(template.Pattern); err != nil {
        return fmt.Errorf("正则表达式无效: %w", err)
    }
    
    // 3. 验证字段定义
    for _, field := range template.Fields {
        if field.Name == "" {
            return fmt.Errorf("字段名称不能为空")
        }
        
        if field.Type == "" {
            return fmt.Errorf("字段类型不能为空")
        }
        
        // 验证字段类型
        validTypes := []string{"string", "int", "float", "timestamp", "ip", "url"}
        if !contains(validTypes, field.Type) {
            return fmt.Errorf("无效的字段类型: %s", field.Type)
        }
    }
    
    return nil
}

// 版本控制器
type VersionController struct {
    maxVersions int
    versions    map[string][]*TemplateVersion // templateID -> versions
    mu          sync.RWMutex
}

// 添加版本
func (vc *VersionController) AddVersion(templateID string, version *TemplateVersion) {
    vc.mu.Lock()
    defer vc.mu.Unlock()
    
    if vc.versions == nil {
        vc.versions = make(map[string][]*TemplateVersion)
    }
    
    versions := vc.versions[templateID]
    versions = append(versions, version)
    
    // 保留最近的 N 个版本
    if len(versions) > vc.maxVersions {
        versions = versions[len(versions)-vc.maxVersions:]
    }
    
    vc.versions[templateID] = versions
}

// 获取版本历史
func (vc *VersionController) GetVersions(templateID string) []*TemplateVersion {
    vc.mu.RLock()
    defer vc.mu.RUnlock()
    
    return vc.versions[templateID]
}

// 删除版本历史
func (vc *VersionController) DeleteVersions(templateID string) {
    vc.mu.Lock()
    defer vc.mu.Unlock()
    
    delete(vc.versions, templateID)
}
```

**关键实现点**:

1. 提供 6 种预置模板（Nginx、Apache、Spring Boot、Node.js、MySQL、PostgreSQL）
2. 使用正则表达式进行日志解析，支持复杂的字段提取
3. 实现模板版本管理，保留最近 10 个版本，支持版本回滚
4. 实现智能模板推荐算法，基于日志内容特征匹配最合适的模板
5. 支持模板的导入导出（JSON/YAML 格式），便于模板共享
6. 提供模板测试功能，支持批量样例日志验证
7. 实现模板分类和标签管理，支持快速查找和组织

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| template_enabled | bool | true | 是否启用模板管理 |
| preset_templates | array | [] | 预置模板列表 |
| auto_recommend | bool | true | 是否启用自动推荐 |
| recommend_threshold | float | 70.0 | 推荐阈值（0-100） |
| max_versions | int | 10 | 最大版本数 |
| parse_timeout | int | 5 | 解析超时时间（秒） |
| failure_threshold | float | 10.0 | 失败率阈值（%） |
| enable_validation | bool | true | 是否启用模板验证 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + PostgreSQL
- 生效时间: 立即生效（下次解析生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志并发送告警

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的模板配置和推荐阈值
2. WHEN 预置模板列表变更时，THE System SHALL 自动加载新模板
3. THE System SHALL 支持通过 API 查询当前生效的模板配置
4. THE System SHALL 记录所有模板配置变更的审计日志
5. WHEN 模板正则表达式变更时，THE System SHALL 验证表达式的有效性

---

#### 需求 16-63: 日志质量评估 [Phase 2]

**用户故事**:

作为数据质量管理员，我希望能够评估日志数据的质量，以便确保日志数据的可用性和准确性。

**验收标准**:

1. THE Dashboard SHALL 提供日志质量评估仪表盘，展示数据完整性、准确性、一致性、及时性四个维度的质量指标
2. THE Log_Analyzer SHALL 自动检测日志数据中的质量问题，包括缺失字段、格式错误、时间戳异常、重复数据、异常值
3. THE System SHALL 为每个日志源计算质量评分（0-100分），基于多维度加权计算
4. WHEN 日志质量低于阈值（默认 80 分）时，THE System SHALL 自动发送告警并提供具体的改进建议
5. THE Dashboard SHALL 展示日志质量趋势图，时间跨度至少 30 天，帮助跟踪质量改进效果
6. THE System SHALL 支持自定义质量规则，允许用户定义特定的质量检查标准
7. THE Dashboard SHALL 提供质量问题详情页，展示具体的问题日志和修复建议
8. THE System SHALL 生成质量评估报告，支持按日、周、月维度导出
9. THE System SHALL 支持质量基线设置，对比当前质量与历史基线
10. THE System SHALL 通过配置中心管理质量评估配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/quality/assessor.go
package quality

import (
    "context"
    "time"
    "math"
)

// 质量评估器
type QualityAssessor struct {
    config       atomic.Value        // 配置（支持热更新）
    detector     *QualityDetector    // 质量检测器
    scorer       *QualityScorer      // 质量评分器
    analyzer     *TrendAnalyzer      // 趋势分析器
    reporter     *QualityReporter    // 质量报告器
    ruleEngine   *QualityRuleEngine  // 质量规则引擎
    alertManager *AlertManager       // 告警管理器
    auditLogger  *AuditLogger        // 审计日志记录器
}

// 质量评估配置
type QualityConfig struct {
    Dimensions       []QualityDimension // 质量维度配置
    ScoreThreshold   float64            // 质量阈值
    CustomRules      []QualityRule      // 自定义质量规则
    BaselineEnabled  bool               // 是否启用基线对比
    ReportSchedule   string             // 报告生成计划
    TrendDays        int                // 趋势分析天数
}

// 质量维度
type QualityDimension struct {
    Name        string  // 维度名称：completeness/accuracy/consistency/timeliness
    Weight      float64 // 权重（0-1）
    Enabled     bool    // 是否启用
    Threshold   float64 // 阈值
}

// 质量规则
type QualityRule struct {
    ID          string              // 规则ID
    Name        string              // 规则名称
    Description string              // 规则描述
    Dimension   string              // 所属维度
    Type        string              // 规则类型：field_required/format_check/range_check/custom
    Conditions  []RuleCondition     // 规则条件
    Severity    string              // 严重程度：critical/high/medium/low
    Enabled     bool                // 是否启用
}

// 规则条件
type RuleCondition struct {
    Field    string      // 字段名
    Operator string      // 操作符：exists/not_exists/equals/not_equals/matches/in_range
    Value    interface{} // 期望值
}

// 质量评估结果
type QualityAssessment struct {
    Source          string                 // 日志源
    Timestamp       time.Time              // 评估时间
    OverallScore    float64                // 总体评分（0-100）
    DimensionScores map[string]float64     // 各维度评分
    Issues          []*QualityIssue        // 质量问题列表
    Statistics      *QualityStatistics     // 质量统计
    Recommendations []string               // 改进建议
    Baseline        *QualityBaseline       // 质量基线
}

// 质量问题
type QualityIssue struct {
    ID          string                 // 问题ID
    Type        string                 // 问题类型
    Dimension   string                 // 所属维度
    Severity    string                 // 严重程度
    Description string                 // 问题描述
    AffectedLogs int                   // 受影响的日志数
    Examples    []string               // 问题示例
    Suggestion  string                 // 修复建议
    DetectedAt  time.Time              // 检测时间
}

// 质量统计
type QualityStatistics struct {
    TotalLogs       int64   // 总日志数
    ValidLogs       int64   // 有效日志数
    InvalidLogs     int64   // 无效日志数
    MissingFields   int64   // 缺失字段数
    FormatErrors    int64   // 格式错误数
    DuplicateLogs   int64   // 重复日志数
    AnomalousValues int64   // 异常值数
    ValidityRate    float64 // 有效率（%）
}

// 质量基线
type QualityBaseline struct {
    Source      string             // 日志源
    Period      string             // 基线周期
    Score       float64            // 基线评分
    Dimensions  map[string]float64 // 各维度基线
    CreatedAt   time.Time          // 创建时间
}

// 创建质量评估器
func NewQualityAssessor(config *QualityConfig) (*QualityAssessor, error) {
    qa := &QualityAssessor{}
    qa.config.Store(config)
    
    // 初始化质量检测器
    qa.detector = NewQualityDetector()
    
    // 初始化质量评分器
    qa.scorer = NewQualityScorer(config.Dimensions)
    
    // 初始化趋势分析器
    qa.analyzer = NewTrendAnalyzer(config.TrendDays)
    
    // 初始化质量报告器
    qa.reporter = NewQualityReporter()
    
    // 初始化质量规则引擎
    qa.ruleEngine = NewQualityRuleEngine(config.CustomRules)
    
    // 初始化告警管理器
    qa.alertManager = NewAlertManager()
    
    // 初始化审计日志记录器
    qa.auditLogger = NewAuditLogger()
    
    return qa, nil
}

// 评估日志质量
func (qa *QualityAssessor) AssessQuality(ctx context.Context, source string, logs []*LogEntry) (*QualityAssessment, error) {
    log.Infof("评估日志质量: source=%s, logs=%d", source, len(logs))
    
    config := qa.config.Load().(*QualityConfig)
    
    assessment := &QualityAssessment{
        Source:          source,
        Timestamp:       time.Now(),
        DimensionScores: make(map[string]float64),
        Statistics:      &QualityStatistics{},
    }
    
    // 1. 检测质量问题
    issues := qa.detectQualityIssues(ctx, logs)
    assessment.Issues = issues
    
    // 2. 计算质量统计
    stats := qa.calculateStatistics(logs, issues)
    assessment.Statistics = stats
    
    // 3. 计算各维度评分
    for _, dimension := range config.Dimensions {
        if !dimension.Enabled {
            continue
        }
        
        score := qa.calculateDimensionScore(dimension.Name, logs, issues)
        assessment.DimensionScores[dimension.Name] = score
    }
    
    // 4. 计算总体评分
    assessment.OverallScore = qa.calculateOverallScore(assessment.DimensionScores, config.Dimensions)
    
    // 5. 生成改进建议
    assessment.Recommendations = qa.generateRecommendations(assessment)
    
    // 6. 对比基线（如果启用）
    if config.BaselineEnabled {
        baseline, err := qa.getBaseline(source)
        if err == nil {
            assessment.Baseline = baseline
        }
    }
    
    // 7. 检查是否需要告警
    if assessment.OverallScore < config.ScoreThreshold {
        qa.sendQualityAlert(ctx, assessment)
    }
    
    // 8. 记录审计日志
    qa.auditLogger.LogQualityAssessment(assessment)
    
    return assessment, nil
}

// 检测质量问题
func (qa *QualityAssessor) detectQualityIssues(ctx context.Context, logs []*LogEntry) []*QualityIssue {
    var issues []*QualityIssue
    
    // 1. 检测完整性问题（缺失字段）
    completenessIssues := qa.detector.DetectCompletenessIssues(logs)
    issues = append(issues, completenessIssues...)
    
    // 2. 检测准确性问题（格式错误）
    accuracyIssues := qa.detector.DetectAccuracyIssues(logs)
    issues = append(issues, accuracyIssues...)
    
    // 3. 检测一致性问题（重复数据、异常值）
    consistencyIssues := qa.detector.DetectConsistencyIssues(logs)
    issues = append(issues, consistencyIssues...)
    
    // 4. 检测及时性问题（时间戳异常）
    timelinessIssues := qa.detector.DetectTimelinessIssues(logs)
    issues = append(issues, timelinessIssues...)
    
    // 5. 应用自定义规则
    customIssues := qa.ruleEngine.CheckRules(logs)
    issues = append(issues, customIssues...)
    
    return issues
}

// 质量检测器
type QualityDetector struct{}

// 检测完整性问题
func (qd *QualityDetector) DetectCompletenessIssues(logs []*LogEntry) []*QualityIssue {
    var issues []*QualityIssue
    
    // 统计必需字段缺失情况
    requiredFields := []string{"timestamp", "level", "message", "source"}
    missingFieldsCount := make(map[string]int)
    var exampleLogs []string
    
    for _, log := range logs {
        for _, field := range requiredFields {
            if !qd.hasField(log, field) {
                missingFieldsCount[field]++
                if len(exampleLogs) < 3 {
                    exampleLogs = append(exampleLogs, log.Message)
                }
            }
        }
    }
    
    // 为每个缺失字段创建问题
    for field, count := range missingFieldsCount {
        if count > 0 {
            issue := &QualityIssue{
                ID:           generateIssueID(),
                Type:         "missing_field",
                Dimension:    "completeness",
                Severity:     qd.determineSeverity(float64(count) / float64(len(logs))),
                Description:  fmt.Sprintf("字段 '%s' 在 %d 条日志中缺失", field, count),
                AffectedLogs: count,
                Examples:     exampleLogs,
                Suggestion:   fmt.Sprintf("确保应用程序在记录日志时包含 '%s' 字段", field),
                DetectedAt:   time.Now(),
            }
            issues = append(issues, issue)
        }
    }
    
    return issues
}

// 检测准确性问题
func (qd *QualityDetector) DetectAccuracyIssues(logs []*LogEntry) []*QualityIssue {
    var issues []*QualityIssue
    
    // 检测时间戳格式错误
    invalidTimestamps := 0
    var timestampExamples []string
    
    for _, log := range logs {
        if !qd.isValidTimestamp(log.Timestamp) {
            invalidTimestamps++
            if len(timestampExamples) < 3 {
                timestampExamples = append(timestampExamples, log.Timestamp.String())
            }
        }
    }
    
    if invalidTimestamps > 0 {
        issue := &QualityIssue{
            ID:           generateIssueID(),
            Type:         "invalid_timestamp",
            Dimension:    "accuracy",
            Severity:     qd.determineSeverity(float64(invalidTimestamps) / float64(len(logs))),
            Description:  fmt.Sprintf("%d 条日志的时间戳格式无效", invalidTimestamps),
            AffectedLogs: invalidTimestamps,
            Examples:     timestampExamples,
            Suggestion:   "使用标准的时间戳格式（ISO 8601）",
            DetectedAt:   time.Now(),
        }
        issues = append(issues, issue)
    }
    
    // 检测日志级别错误
    invalidLevels := 0
    validLevels := []string{"DEBUG", "INFO", "WARN", "ERROR", "FATAL"}
    var levelExamples []string
    
    for _, log := range logs {
        if !contains(validLevels, log.Level) {
            invalidLevels++
            if len(levelExamples) < 3 {
                levelExamples = append(levelExamples, log.Level)
            }
        }
    }
    
    if invalidLevels > 0 {
        issue := &QualityIssue{
            ID:           generateIssueID(),
            Type:         "invalid_level",
            Dimension:    "accuracy",
            Severity:     qd.determineSeverity(float64(invalidLevels) / float64(len(logs))),
            Description:  fmt.Sprintf("%d 条日志的级别无效", invalidLevels),
            AffectedLogs: invalidLevels,
            Examples:     levelExamples,
            Suggestion:   "使用标准的日志级别：DEBUG, INFO, WARN, ERROR, FATAL",
            DetectedAt:   time.Now(),
        }
        issues = append(issues, issue)
    }
    
    return issues
}

// 检测一致性问题
func (qd *QualityDetector) DetectConsistencyIssues(logs []*LogEntry) []*QualityIssue {
    var issues []*QualityIssue
    
    // 检测重复日志
    duplicates := qd.findDuplicates(logs)
    if len(duplicates) > 0 {
        issue := &QualityIssue{
            ID:           generateIssueID(),
            Type:         "duplicate_logs",
            Dimension:    "consistency",
            Severity:     "medium",
            Description:  fmt.Sprintf("发现 %d 条重复日志", len(duplicates)),
            AffectedLogs: len(duplicates),
            Examples:     qd.getDuplicateExamples(duplicates, 3),
            Suggestion:   "检查日志采集配置，避免重复采集同一日志源",
            DetectedAt:   time.Now(),
        }
        issues = append(issues, issue)
    }
    
    // 检测异常值
    anomalies := qd.detectAnomalies(logs)
    if len(anomalies) > 0 {
        issue := &QualityIssue{
            ID:           generateIssueID(),
            Type:         "anomalous_values",
            Dimension:    "consistency",
            Severity:     "low",
            Description:  fmt.Sprintf("发现 %d 条包含异常值的日志", len(anomalies)),
            AffectedLogs: len(anomalies),
            Examples:     qd.getAnomalyExamples(anomalies, 3),
            Suggestion:   "检查应用程序逻辑，确保日志数据的合理性",
            DetectedAt:   time.Now(),
        }
        issues = append(issues, issue)
    }
    
    return issues
}

// 检测及时性问题
func (qd *QualityDetector) DetectTimelinessIssues(logs []*LogEntry) []*QualityIssue {
    var issues []*QualityIssue
    
    // 检测时间戳延迟
    now := time.Now()
    delayedLogs := 0
    var delayExamples []string
    
    for _, log := range logs {
        delay := now.Sub(log.Timestamp)
        if delay > 5*time.Minute {
            delayedLogs++
            if len(delayExamples) < 3 {
                delayExamples = append(delayExamples, 
                    fmt.Sprintf("延迟: %s, 时间戳: %s", delay, log.Timestamp))
            }
        }
    }
    
    if delayedLogs > 0 {
        issue := &QualityIssue{
            ID:           generateIssueID(),
            Type:         "delayed_logs",
            Dimension:    "timeliness",
            Severity:     qd.determineSeverity(float64(delayedLogs) / float64(len(logs))),
            Description:  fmt.Sprintf("%d 条日志存在明显延迟（>5分钟）", delayedLogs),
            AffectedLogs: delayedLogs,
            Examples:     delayExamples,
            Suggestion:   "检查日志采集和传输链路，优化日志处理性能",
            DetectedAt:   time.Now(),
        }
        issues = append(issues, issue)
    }
    
    return issues
}

// 计算维度评分
func (qa *QualityAssessor) calculateDimensionScore(dimension string, logs []*LogEntry, issues []*QualityIssue) float64 {
    // 过滤该维度的问题
    dimensionIssues := make([]*QualityIssue, 0)
    for _, issue := range issues {
        if issue.Dimension == dimension {
            dimensionIssues = append(dimensionIssues, issue)
        }
    }
    
    if len(dimensionIssues) == 0 {
        return 100.0 // 没有问题，满分
    }
    
    // 计算受影响的日志比例
    totalAffected := 0
    for _, issue := range dimensionIssues {
        totalAffected += issue.AffectedLogs
    }
    
    affectedRate := float64(totalAffected) / float64(len(logs))
    
    // 根据严重程度加权
    severityWeight := 0.0
    for _, issue := range dimensionIssues {
        switch issue.Severity {
        case "critical":
            severityWeight += 1.0
        case "high":
            severityWeight += 0.7
        case "medium":
            severityWeight += 0.4
        case "low":
            severityWeight += 0.2
        }
    }
    
    // 计算评分（0-100）
    score := 100.0 - (affectedRate * 50.0) - (severityWeight * 10.0)
    
    if score < 0 {
        score = 0
    }
    
    return score
}

// 计算总体评分
func (qa *QualityAssessor) calculateOverallScore(dimensionScores map[string]float64, dimensions []QualityDimension) float64 {
    var totalScore float64
    var totalWeight float64
    
    for _, dimension := range dimensions {
        if !dimension.Enabled {
            continue
        }
        
        if score, exists := dimensionScores[dimension.Name]; exists {
            totalScore += score * dimension.Weight
            totalWeight += dimension.Weight
        }
    }
    
    if totalWeight == 0 {
        return 0
    }
    
    return totalScore / totalWeight
}

// 计算质量统计
func (qa *QualityAssessor) calculateStatistics(logs []*LogEntry, issues []*QualityIssue) *QualityStatistics {
    stats := &QualityStatistics{
        TotalLogs: int64(len(logs)),
    }
    
    // 统计各类问题数量
    for _, issue := range issues {
        switch issue.Type {
        case "missing_field":
            stats.MissingFields += int64(issue.AffectedLogs)
        case "invalid_timestamp", "invalid_level":
            stats.FormatErrors += int64(issue.AffectedLogs)
        case "duplicate_logs":
            stats.DuplicateLogs += int64(issue.AffectedLogs)
        case "anomalous_values":
            stats.AnomalousValues += int64(issue.AffectedLogs)
        }
    }
    
    // 计算无效日志数（去重）
    affectedLogsSet := make(map[int]bool)
    for _, issue := range issues {
        for i := 0; i < issue.AffectedLogs; i++ {
            affectedLogsSet[i] = true
        }
    }
    stats.InvalidLogs = int64(len(affectedLogsSet))
    
    // 计算有效日志数
    stats.ValidLogs = stats.TotalLogs - stats.InvalidLogs
    
    // 计算有效率
    if stats.TotalLogs > 0 {
        stats.ValidityRate = float64(stats.ValidLogs) / float64(stats.TotalLogs) * 100
    }
    
    return stats
}

// 生成改进建议
func (qa *QualityAssessor) generateRecommendations(assessment *QualityAssessment) []string {
    var recommendations []string
    
    // 根据维度评分生成建议
    for dimension, score := range assessment.DimensionScores {
        if score < 80 {
            switch dimension {
            case "completeness":
                recommendations = append(recommendations, 
                    "完整性较低：确保所有必需字段都被正确记录，检查日志配置模板")
            case "accuracy":
                recommendations = append(recommendations, 
                    "准确性较低：使用标准的日志格式和字段类型，启用日志格式验证")
            case "consistency":
                recommendations = append(recommendations, 
                    "一致性较低：检查日志采集配置避免重复，实施数据去重策略")
            case "timeliness":
                recommendations = append(recommendations, 
                    "及时性较低：优化日志传输链路，增加采集频率，检查网络延迟")
            }
        }
    }
    
    // 根据具体问题生成建议
    issueTypes := make(map[string]int)
    for _, issue := range assessment.Issues {
        issueTypes[issue.Type]++
    }
    
    if issueTypes["missing_field"] > 3 {
        recommendations = append(recommendations, 
            "多个字段缺失：建议使用日志模板统一日志格式，强制要求必需字段")
    }
    
    if issueTypes["duplicate_logs"] > 0 {
        recommendations = append(recommendations, 
            "存在重复日志：启用日志去重功能，检查是否有多个采集器采集同一数据源")
    }
    
    if assessment.Statistics.ValidityRate < 90 {
        recommendations = append(recommendations, 
            "有效率低于90%：建议对日志源进行质量培训，实施日志规范和最佳实践")
    }
    
    return recommendations
}

// 发送质量告警
func (qa *QualityAssessor) sendQualityAlert(ctx context.Context, assessment *QualityAssessment) {
    log.Warnf("日志质量低于阈值: source=%s, score=%.2f", assessment.Source, assessment.OverallScore)
    
    alert := &Alert{
        Level:   "warning",
        Title:   fmt.Sprintf("日志质量告警: %s", assessment.Source),
        Message: fmt.Sprintf("日志源 %s 的质量评分为 %.2f，低于阈值", 
            assessment.Source, assessment.OverallScore),
        Fields: map[string]interface{}{
            "source":         assessment.Source,
            "overall_score":  assessment.OverallScore,
            "dimension_scores": assessment.DimensionScores,
            "issue_count":    len(assessment.Issues),
            "validity_rate":  assessment.Statistics.ValidityRate,
            "recommendations": assessment.Recommendations,
        },
        Timestamp: time.Now(),
    }
    
    qa.alertManager.Send(ctx, alert)
}

// 趋势分析器
type TrendAnalyzer struct {
    trendDays int
    storage   *TrendStorage
}

// 分析质量趋势
func (ta *TrendAnalyzer) AnalyzeTrend(source string) (*QualityTrend, error) {
    // 获取历史评估数据
    assessments, err := ta.storage.GetRecentAssessments(source, ta.trendDays)
    if err != nil {
        return nil, err
    }
    
    if len(assessments) == 0 {
        return nil, fmt.Errorf("没有足够的历史数据")
    }
    
    trend := &QualityTrend{
        Source:    source,
        Period:    fmt.Sprintf("最近%d天", ta.trendDays),
        DataPoints: make([]*TrendDataPoint, 0),
    }
    
    // 构建趋势数据点
    for _, assessment := range assessments {
        point := &TrendDataPoint{
            Timestamp:       assessment.Timestamp,
            OverallScore:    assessment.OverallScore,
            DimensionScores: assessment.DimensionScores,
        }
        trend.DataPoints = append(trend.DataPoints, point)
    }
    
    // 计算趋势方向
    trend.Direction = ta.calculateTrendDirection(trend.DataPoints)
    
    // 计算平均分
    trend.AverageScore = ta.calculateAverageScore(trend.DataPoints)
    
    // 计算改善率
    if len(trend.DataPoints) >= 2 {
        firstScore := trend.DataPoints[0].OverallScore
        lastScore := trend.DataPoints[len(trend.DataPoints)-1].OverallScore
        trend.ImprovementRate = ((lastScore - firstScore) / firstScore) * 100
    }
    
    return trend, nil
}

// 质量趋势
type QualityTrend struct {
    Source          string             // 日志源
    Period          string             // 时间周期
    DataPoints      []*TrendDataPoint  // 趋势数据点
    Direction       string             // 趋势方向：improving/declining/stable
    AverageScore    float64            // 平均评分
    ImprovementRate float64            // 改善率（%）
}

// 趋势数据点
type TrendDataPoint struct {
    Timestamp       time.Time          // 时间戳
    OverallScore    float64            // 总体评分
    DimensionScores map[string]float64 // 各维度评分
}

// 计算趋势方向
func (ta *TrendAnalyzer) calculateTrendDirection(points []*TrendDataPoint) string {
    if len(points) < 2 {
        return "stable"
    }
    
    // 使用线性回归计算趋势
    n := float64(len(points))
    var sumX, sumY, sumXY, sumX2 float64
    
    for i, point := range points {
        x := float64(i)
        y := point.OverallScore
        sumX += x
        sumY += y
        sumXY += x * y
        sumX2 += x * x
    }
    
    // 计算斜率
    slope := (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX)
    
    if slope > 1.0 {
        return "improving"
    } else if slope < -1.0 {
        return "declining"
    }
    return "stable"
}

// 质量报告器
type QualityReporter struct {
    storage *ReportStorage
}

// 生成质量报告
func (qr *QualityReporter) GenerateReport(ctx context.Context, source string, period string) (*QualityReport, error) {
    log.Infof("生成质量报告: source=%s, period=%s", source, period)
    
    report := &QualityReport{
        Source:      source,
        Period:      period,
        GeneratedAt: time.Now(),
    }
    
    // 获取周期内的评估数据
    assessments, err := qr.storage.GetAssessmentsByPeriod(source, period)
    if err != nil {
        return nil, err
    }
    
    if len(assessments) == 0 {
        return nil, fmt.Errorf("周期内没有评估数据")
    }
    
    // 计算汇总统计
    report.Summary = qr.calculateSummary(assessments)
    
    // 统计问题分布
    report.IssueDistribution = qr.calculateIssueDistribution(assessments)
    
    // 计算维度评分趋势
    report.DimensionTrends = qr.calculateDimensionTrends(assessments)
    
    // 生成改进建议
    report.Recommendations = qr.generateReportRecommendations(report)
    
    return report, nil
}

// 质量报告
type QualityReport struct {
    Source            string                    // 日志源
    Period            string                    // 报告周期
    GeneratedAt       time.Time                 // 生成时间
    Summary           *ReportSummary            // 汇总统计
    IssueDistribution map[string]int            // 问题分布
    DimensionTrends   map[string][]float64      // 维度趋势
    Recommendations   []string                  // 改进建议
}

// 报告汇总
type ReportSummary struct {
    TotalAssessments int     // 评估次数
    AverageScore     float64 // 平均评分
    HighestScore     float64 // 最高评分
    LowestScore      float64 // 最低评分
    TotalIssues      int     // 总问题数
    ResolvedIssues   int     // 已解决问题数
}
```

**关键实现点**:

1. 实现四维度质量评估体系：完整性、准确性、一致性、及时性
2. 自动检测5类质量问题：缺失字段、格式错误、时间戳异常、重复数据、异常值
3. 基于多维度加权计算质量评分（0-100分），支持自定义权重
4. 实现质量趋势分析，使用线性回归计算趋势方向（改善/下降/稳定）
5. 支持自定义质量规则，灵活扩展质量检查标准
6. 提供详细的质量问题报告和具体的修复建议
7. 支持质量基线设置和对比，跟踪质量改进效果

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| quality_enabled | bool | true | 是否启用质量评估 |
| dimensions | array | [] | 质量维度配置列表 |
| score_threshold | float | 80.0 | 质量阈值（0-100） |
| custom_rules | array | [] | 自定义质量规则 |
| baseline_enabled | bool | true | 是否启用基线对比 |
| report_schedule | string | "0 0 * * *" | 报告生成计划（Cron表达式） |
| trend_days | int | 30 | 趋势分析天数 |
| auto_alert | bool | true | 是否自动告警 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + PostgreSQL
- 生效时间: 立即生效（下次评估生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志并发送告警

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的质量维度和阈值配置
2. WHEN 自定义规则变更时，THE System SHALL 在下次评估时使用新规则
3. THE System SHALL 支持通过 API 查询当前生效的质量评估配置
4. THE System SHALL 记录所有质量配置变更的审计日志
5. WHEN 维度权重变更时，THE System SHALL 验证权重总和为1.0

---

#### 需求 16-64: 智能日志路由 [Phase 2]

**用户故事**:

作为系统架构师，我希望系统能够智能路由日志数据，以便根据日志特征将数据发送到最合适的处理管道。

**验收标准**:

1. THE Log_Collector SHALL 支持基于日志内容、来源、级别、标签的智能路由规则配置
2. THE System SHALL 支持将不同类型的日志路由到不同的存储层（热存储、温存储、冷存储）或分析管道
3. THE Dashboard SHALL 提供路由规则配置界面，支持可视化配置路由逻辑和规则优先级
4. THE System SHALL 支持动态路由，根据系统负载（CPU > 80%、内存 > 85%）自动调整路由策略
5. WHEN 路由目标不可用时，THE System SHALL 在 30 秒内自动切换到备用路由并发送告警
6. THE System SHALL 支持路由规则的A/B测试，允许对比不同路由策略的效果
7. THE System SHALL 记录路由决策日志，包括路由原因、目标、耗时，便于审计和优化
8. THE Dashboard SHALL 展示路由统计信息，包括各路由的流量分布、成功率、平均延迟
9. THE System SHALL 支持路由规则的热更新，规则变更后在 3 秒内生效
10. THE System SHALL 支持路由失败重试机制，最多重试 3 次，使用指数退避策略

**实现方向**:

**实现方式**:

```go
// internal/router/smart_router.go
package router

import (
    "context"
    "time"
    "sync"
    "hash/fnv"
)

// 智能路由器
type SmartRouter struct {
    config         atomic.Value        // 配置（支持热更新）
    ruleEngine     *RoutingRuleEngine  // 路由规则引擎
    loadBalancer   *LoadBalancer       // 负载均衡器
    healthChecker  *HealthChecker      // 健康检查器
    failoverMgr    *FailoverManager    // 故障转移管理器
    abTester       *ABTester           // A/B测试器
    metrics        *RouterMetrics      // 路由指标
    auditLogger    *AuditLogger        // 审计日志记录器
}

// 路由配置
type RouterConfig struct {
    Rules              []RoutingRule      // 路由规则列表
    DynamicRouting     bool               // 是否启用动态路由
    LoadThreshold      LoadThreshold      // 负载阈值
    FailoverEnabled    bool               // 是否启用故障转移
    FailoverTimeout    time.Duration      // 故障转移超时时间
    RetryAttempts      int                // 重试次数
    RetryBackoff       time.Duration      // 重试退避时间
    ABTestEnabled      bool               // 是否启用A/B测试
}

// 路由规则
type RoutingRule struct {
    ID          string              // 规则ID
    Name        string              // 规则名称
    Description string              // 规则描述
    Priority    int                 // 优先级（数字越小优先级越高）
    Conditions  []RouteCondition    // 路由条件
    Targets     []RouteTarget       // 路由目标
    Strategy    string              // 路由策略：single/multi/round_robin/hash
    Enabled     bool                // 是否启用
    ABTest      *ABTestConfig       // A/B测试配置
}

// 路由条件
type RouteCondition struct {
    Field    string      // 字段名：source/level/tag/content
    Operator string      // 操作符：equals/not_equals/contains/matches/in/not_in
    Value    interface{} // 匹配值
}

// 路由目标
type RouteTarget struct {
    ID          string            // 目标ID
    Type        string            // 目标类型：storage/analysis/alert/archive
    Endpoint    string            // 目标端点
    Weight      int               // 权重（用于负载均衡）
    Backup      bool              // 是否为备用目标
    Metadata    map[string]string // 元数据
}

// 负载阈值
type LoadThreshold struct {
    CPUPercent    float64 // CPU使用率阈值（%）
    MemoryPercent float64 // 内存使用率阈值（%）
    QueueSize     int     // 队列大小阈值
}

// A/B测试配置
type ABTestConfig struct {
    Enabled     bool    // 是否启用
    GroupA      string  // A组目标ID
    GroupB      string  // B组目标ID
    SplitRatio  float64 // 分流比例（0-1，A组比例）
    Duration    time.Duration // 测试持续时间
}

// 路由决策
type RoutingDecision struct {
    LogEntry    *LogEntry     // 日志条目
    Rule        *RoutingRule  // 匹配的规则
    Target      *RouteTarget  // 选择的目标
    Reason      string        // 路由原因
    Timestamp   time.Time     // 决策时间
    Duration    time.Duration // 决策耗时
}

// 创建智能路由器
func NewSmartRouter(config *RouterConfig) (*SmartRouter, error) {
    sr := &SmartRouter{}
    sr.config.Store(config)
    
    // 初始化路由规则引擎
    sr.ruleEngine = NewRoutingRuleEngine(config.Rules)
    
    // 初始化负载均衡器
    sr.loadBalancer = NewLoadBalancer()
    
    // 初始化健康检查器
    sr.healthChecker = NewHealthChecker()
    
    // 初始化故障转移管理器
    sr.failoverMgr = NewFailoverManager(config.FailoverTimeout)
    
    // 初始化A/B测试器
    if config.ABTestEnabled {
        sr.abTester = NewABTester()
    }
    
    // 初始化路由指标
    sr.metrics = NewRouterMetrics()
    
    // 初始化审计日志记录器
    sr.auditLogger = NewAuditLogger()
    
    // 启动健康检查
    go sr.startHealthCheck()
    
    return sr, nil
}

// 路由日志
func (sr *SmartRouter) Route(ctx context.Context, entry *LogEntry) error {
    startTime := time.Now()
    
    config := sr.config.Load().(*RouterConfig)
    
    // 1. 匹配路由规则
    rule := sr.ruleEngine.Match(entry)
    if rule == nil {
        return fmt.Errorf("没有匹配的路由规则")
    }
    
    // 2. 检查是否启用动态路由
    if config.DynamicRouting {
        if sr.isHighLoad() {
            // 高负载时，调整路由策略
            rule = sr.adjustRouteForLoad(rule)
        }
    }
    
    // 3. 选择路由目标
    target, err := sr.selectTarget(rule, entry)
    if err != nil {
        return fmt.Errorf("选择路由目标失败: %w", err)
    }
    
    // 4. 发送到目标
    err = sr.sendToTarget(ctx, entry, target, config.RetryAttempts)
    if err != nil {
        // 如果启用故障转移，尝试备用目标
        if config.FailoverEnabled {
            backupTarget := sr.findBackupTarget(rule)
            if backupTarget != nil {
                log.Warnf("主目标失败，切换到备用目标: %s -> %s", target.ID, backupTarget.ID)
                err = sr.sendToTarget(ctx, entry, backupTarget, config.RetryAttempts)
                
                // 发送故障转移告警
                sr.sendFailoverAlert(target, backupTarget)
            }
        }
        
        if err != nil {
            sr.metrics.RecordFailure(target.ID)
            return err
        }
    }
    
    // 5. 记录路由决策
    decision := &RoutingDecision{
        LogEntry:  entry,
        Rule:      rule,
        Target:    target,
        Reason:    sr.getRoutingReason(rule, entry),
        Timestamp: time.Now(),
        Duration:  time.Since(startTime),
    }
    sr.auditLogger.LogRoutingDecision(decision)
    
    // 6. 更新指标
    sr.metrics.RecordSuccess(target.ID, decision.Duration)
    
    return nil
}

// 路由规则引擎
type RoutingRuleEngine struct {
    rules []*RoutingRule
    mu    sync.RWMutex
}

// 匹配路由规则
func (rre *RoutingRuleEngine) Match(entry *LogEntry) *RoutingRule {
    rre.mu.RLock()
    defer rre.mu.RUnlock()
    
    // 按优先级排序规则
    sortedRules := rre.sortByPriority(rre.rules)
    
    // 遍历规则，找到第一个匹配的
    for _, rule := range sortedRules {
        if !rule.Enabled {
            continue
        }
        
        if rre.matchConditions(entry, rule.Conditions) {
            return rule
        }
    }
    
    return nil
}

// 匹配条件
func (rre *RoutingRuleEngine) matchConditions(entry *LogEntry, conditions []RouteCondition) bool {
    for _, condition := range conditions {
        if !rre.matchCondition(entry, condition) {
            return false
        }
    }
    return true
}

// 匹配单个条件
func (rre *RoutingRuleEngine) matchCondition(entry *LogEntry, condition RouteCondition) bool {
    var fieldValue interface{}
    
    // 获取字段值
    switch condition.Field {
    case "source":
        fieldValue = entry.Source
    case "level":
        fieldValue = entry.Level
    case "tag":
        fieldValue = entry.Tags
    case "content":
        fieldValue = entry.Message
    default:
        if v, exists := entry.Fields[condition.Field]; exists {
            fieldValue = v
        }
    }
    
    // 根据操作符判断
    switch condition.Operator {
    case "equals":
        return fieldValue == condition.Value
    case "not_equals":
        return fieldValue != condition.Value
    case "contains":
        if str, ok := fieldValue.(string); ok {
            return strings.Contains(str, condition.Value.(string))
        }
    case "matches":
        if str, ok := fieldValue.(string); ok {
            matched, _ := regexp.MatchString(condition.Value.(string), str)
            return matched
        }
    case "in":
        if arr, ok := condition.Value.([]interface{}); ok {
            for _, v := range arr {
                if v == fieldValue {
                    return true
                }
            }
        }
    case "not_in":
        if arr, ok := condition.Value.([]interface{}); ok {
            for _, v := range arr {
                if v == fieldValue {
                    return false
                }
            }
            return true
        }
    }
    
    return false
}

// 选择路由目标
func (sr *SmartRouter) selectTarget(rule *RoutingRule, entry *LogEntry) (*RouteTarget, error) {
    // 过滤可用目标
    availableTargets := sr.filterAvailableTargets(rule.Targets)
    if len(availableTargets) == 0 {
        return nil, fmt.Errorf("没有可用的路由目标")
    }
    
    // 如果启用A/B测试
    if rule.ABTest != nil && rule.ABTest.Enabled {
        return sr.abTester.SelectTarget(entry, rule.ABTest)
    }
    
    // 根据策略选择目标
    switch rule.Strategy {
    case "single":
        // 单目标，选择第一个可用目标
        return availableTargets[0], nil
        
    case "multi":
        // 多目标，发送到所有目标（异步）
        // 这里返回第一个，实际会在后续处理中发送到所有目标
        return availableTargets[0], nil
        
    case "round_robin":
        // 轮询
        return sr.loadBalancer.RoundRobin(availableTargets), nil
        
    case "hash":
        // 哈希
        return sr.loadBalancer.Hash(entry, availableTargets), nil
        
    case "weighted":
        // 加权
        return sr.loadBalancer.Weighted(availableTargets), nil
        
    default:
        return availableTargets[0], nil
    }
}

// 过滤可用目标
func (sr *SmartRouter) filterAvailableTargets(targets []RouteTarget) []*RouteTarget {
    var available []*RouteTarget
    
    for i := range targets {
        target := &targets[i]
        if !target.Backup && sr.healthChecker.IsHealthy(target.ID) {
            available = append(available, target)
        }
    }
    
    return available
}

// 发送到目标
func (sr *SmartRouter) sendToTarget(ctx context.Context, entry *LogEntry, target *RouteTarget, maxRetries int) error {
    var lastErr error
    
    for attempt := 0; attempt <= maxRetries; attempt++ {
        if attempt > 0 {
            // 指数退避
            config := sr.config.Load().(*RouterConfig)
            backoff := config.RetryBackoff * time.Duration(1<<uint(attempt-1))
            log.Infof("重试发送: attempt=%d, backoff=%s", attempt, backoff)
            time.Sleep(backoff)
        }
        
        // 根据目标类型发送
        switch target.Type {
        case "storage":
            lastErr = sr.sendToStorage(ctx, entry, target)
        case "analysis":
            lastErr = sr.sendToAnalysis(ctx, entry, target)
        case "alert":
            lastErr = sr.sendToAlert(ctx, entry, target)
        case "archive":
            lastErr = sr.sendToArchive(ctx, entry, target)
        default:
            return fmt.Errorf("不支持的目标类型: %s", target.Type)
        }
        
        if lastErr == nil {
            return nil
        }
        
        log.Warnf("发送失败: target=%s, attempt=%d, err=%v", target.ID, attempt, lastErr)
    }
    
    return fmt.Errorf("发送失败，已重试%d次: %w", maxRetries, lastErr)
}

// 负载均衡器
type LoadBalancer struct {
    roundRobinIndex map[string]int
    mu              sync.Mutex
}

// 轮询
func (lb *LoadBalancer) RoundRobin(targets []*RouteTarget) *RouteTarget {
    lb.mu.Lock()
    defer lb.mu.Unlock()
    
    if lb.roundRobinIndex == nil {
        lb.roundRobinIndex = make(map[string]int)
    }
    
    key := "default"
    index := lb.roundRobinIndex[key]
    target := targets[index%len(targets)]
    lb.roundRobinIndex[key] = (index + 1) % len(targets)
    
    return target
}

// 哈希
func (lb *LoadBalancer) Hash(entry *LogEntry, targets []*RouteTarget) *RouteTarget {
    // 使用日志源作为哈希键
    h := fnv.New32a()
    h.Write([]byte(entry.Source))
    hash := h.Sum32()
    
    index := int(hash) % len(targets)
    return targets[index]
}

// 加权
func (lb *LoadBalancer) Weighted(targets []*RouteTarget) *RouteTarget {
    // 计算总权重
    totalWeight := 0
    for _, target := range targets {
        totalWeight += target.Weight
    }
    
    // 随机选择
    random := rand.Intn(totalWeight)
    cumulative := 0
    
    for _, target := range targets {
        cumulative += target.Weight
        if random < cumulative {
            return target
        }
    }
    
    return targets[0]
}

// 健康检查器
type HealthChecker struct {
    healthStatus map[string]bool
    mu           sync.RWMutex
}

// 检查健康状态
func (hc *HealthChecker) IsHealthy(targetID string) bool {
    hc.mu.RLock()
    defer hc.mu.RUnlock()
    
    if hc.healthStatus == nil {
        return true
    }
    
    healthy, exists := hc.healthStatus[targetID]
    if !exists {
        return true
    }
    
    return healthy
}

// 更新健康状态
func (hc *HealthChecker) UpdateHealth(targetID string, healthy bool) {
    hc.mu.Lock()
    defer hc.mu.Unlock()
    
    if hc.healthStatus == nil {
        hc.healthStatus = make(map[string]bool)
    }
    
    hc.healthStatus[targetID] = healthy
}

// 启动健康检查
func (sr *SmartRouter) startHealthCheck() {
    ticker := time.NewTicker(30 * time.Second)
    defer ticker.Stop()
    
    for range ticker.C {
        config := sr.config.Load().(*RouterConfig)
        
        for _, rule := range config.Rules {
            for _, target := range rule.Targets {
                healthy := sr.checkTargetHealth(&target)
                sr.healthChecker.UpdateHealth(target.ID, healthy)
                
                if !healthy {
                    log.Warnf("目标不健康: %s", target.ID)
                }
            }
        }
    }
}

// 检查目标健康状态
func (sr *SmartRouter) checkTargetHealth(target *RouteTarget) bool {
    // 实现健康检查逻辑
    // 例如：发送心跳请求，检查响应
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
    // 这里简化处理，实际应该根据目标类型进行不同的健康检查
    _ = ctx
    return true
}

// A/B测试器
type ABTester struct {
    testResults map[string]*ABTestResult
    mu          sync.RWMutex
}

// 选择目标（A/B测试）
func (abt *ABTester) SelectTarget(entry *LogEntry, config *ABTestConfig) (*RouteTarget, error) {
    // 使用哈希决定分组
    h := fnv.New32a()
    h.Write([]byte(entry.Source))
    hash := h.Sum32()
    
    ratio := float64(hash%100) / 100.0
    
    var targetID string
    if ratio < config.SplitRatio {
        targetID = config.GroupA
    } else {
        targetID = config.GroupB
    }
    
    // 记录测试结果
    abt.recordTestResult(targetID, entry)
    
    return &RouteTarget{ID: targetID}, nil
}

// A/B测试结果
type ABTestResult struct {
    TargetID     string
    TotalCount   int64
    SuccessCount int64
    FailureCount int64
    AvgLatency   time.Duration
}

// 检查是否高负载
func (sr *SmartRouter) isHighLoad() bool {
    config := sr.config.Load().(*RouterConfig)
    
    cpuUsage := sr.metrics.GetCPUUsage()
    memUsage := sr.metrics.GetMemoryUsage()
    
    return cpuUsage > config.LoadThreshold.CPUPercent || 
           memUsage > config.LoadThreshold.MemoryPercent
}

// 调整路由策略（高负载时）
func (sr *SmartRouter) adjustRouteForLoad(rule *RoutingRule) *RoutingRule {
    // 创建调整后的规则副本
    adjusted := *rule
    
    // 高负载时，优先路由到冷存储或归档
    for i, target := range adjusted.Targets {
        if target.Type == "storage" {
            // 降低热存储权重，提高冷存储权重
            adjusted.Targets[i].Weight = target.Weight / 2
        } else if target.Type == "archive" {
            adjusted.Targets[i].Weight = target.Weight * 2
        }
    }
    
    log.Info("高负载，调整路由策略")
    return &adjusted
}

// 查找备用目标
func (sr *SmartRouter) findBackupTarget(rule *RoutingRule) *RouteTarget {
    for i := range rule.Targets {
        target := &rule.Targets[i]
        if target.Backup && sr.healthChecker.IsHealthy(target.ID) {
            return target
        }
    }
    return nil
}

// 发送故障转移告警
func (sr *SmartRouter) sendFailoverAlert(primary, backup *RouteTarget) {
    alert := &Alert{
        Level:   "warning",
        Title:   "路由故障转移",
        Message: fmt.Sprintf("主目标 %s 不可用，已切换到备用目标 %s", primary.ID, backup.ID),
        Fields: map[string]interface{}{
            "primary_target": primary.ID,
            "backup_target":  backup.ID,
        },
        Timestamp: time.Now(),
    }
    
    // 发送告警（实现略）
    _ = alert
}
```

**关键实现点**:

1. 支持多种路由条件：日志内容、来源、级别、标签，使用灵活的条件匹配引擎
2. 实现多种路由策略：单目标、多目标、轮询、哈希、加权负载均衡
3. 支持动态路由，根据系统负载（CPU、内存）自动调整路由策略
4. 实现故障转移机制，主目标失败时自动切换到备用目标（30秒内）
5. 支持A/B测试功能，可对比不同路由策略的效果
6. 实现健康检查机制，定期检测目标可用性（每30秒）
7. 支持重试机制，使用指数退避策略（最多3次）

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| routing_enabled | bool | true | 是否启用智能路由 |
| rules | array | [] | 路由规则列表 |
| dynamic_routing | bool | true | 是否启用动态路由 |
| load_threshold_cpu | float | 80.0 | CPU负载阈值（%） |
| load_threshold_memory | float | 85.0 | 内存负载阈值（%） |
| failover_enabled | bool | true | 是否启用故障转移 |
| failover_timeout | int | 30 | 故障转移超时时间（秒） |
| retry_attempts | int | 3 | 重试次数 |
| retry_backoff | int | 1 | 重试退避时间（秒） |
| ab_test_enabled | bool | false | 是否启用A/B测试 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + PostgreSQL
- 生效时间: 立即生效（3秒内）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志并发送告警

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内应用新的路由规则
2. WHEN 路由规则优先级变更时，THE System SHALL 立即按新优先级匹配规则
3. THE System SHALL 支持通过 API 查询当前生效的路由配置
4. THE System SHALL 记录所有路由配置变更的审计日志
5. WHEN 负载阈值变更时，THE System SHALL 验证阈值的合理性（0-100）

---

#### 需求 16-65: 日志压缩策略管理 [Phase 2]

**用户故事**:

作为存储管理员，我希望能够精细化管理日志压缩策略，以便在存储成本和查询性能之间取得最佳平衡。

**验收标准**:

1. THE Dashboard SHALL 提供压缩策略配置界面，支持为不同日志类型配置不同的压缩算法
2. THE System SHALL 支持至少 4 种压缩算法（LZ4、Snappy、Zstd、Gzip），并提供压缩率和性能对比数据
3. THE Log_Storage SHALL 支持基于日志年龄的渐进式压缩，新数据（< 7天）使用快速压缩（LZ4），旧数据（> 30天）使用高压缩率算法（Zstd）
4. THE Dashboard SHALL 展示压缩效果统计，包括压缩前后大小、压缩率（目标 >= 70%）、压缩/解压时间
5. WHEN 压缩任务执行失败时，THE System SHALL 在 5 分钟内发送告警并支持手动重试
6. THE Dashboard SHALL 提供压缩成本节省估算，展示每月节省的存储成本（基于云存储价格）
7. THE System SHALL 支持压缩任务的调度配置，允许设置压缩时间窗口（避开业务高峰期）
8. THE System SHALL 支持压缩预览功能，允许用户在应用策略前查看预期效果
9. THE System SHALL 记录所有压缩操作的审计日志，包括压缩前后大小、耗时、算法
10. THE System SHALL 通过配置中心管理压缩策略，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/compression/manager.go
package compression

import (
    "context"
    "time"
    "github.com/klauspost/compress/zstd"
    "github.com/pierrec/lz4/v4"
    "github.com/golang/snappy"
    "compress/gzip"
)

// 压缩管理器
type CompressionManager struct {
    config       atomic.Value           // 配置（支持热更新）
    compressors  map[string]Compressor  // 压缩器映射
    scheduler    *CompressionScheduler  // 压缩调度器
    analyzer     *CompressionAnalyzer   // 压缩分析器
    costCalc     *CostCalculator        // 成本计算器
    metrics      *CompressionMetrics    // 压缩指标
    alertManager *AlertManager          // 告警管理器
    auditLogger  *AuditLogger           // 审计日志记录器
}

// 压缩配置
type CompressionConfig struct {
    Strategies       []CompressionStrategy // 压缩策略列表
    DefaultAlgorithm string                // 默认压缩算法
    ScheduleWindow   TimeWindow            // 压缩时间窗口
    MaxConcurrency   int                   // 最大并发数
    RetryAttempts    int                   // 重试次数
    AlertEnabled     bool                  // 是否启用告警
}

// 压缩策略
type CompressionStrategy struct {
    ID          string              // 策略ID
    Name        string              // 策略名称
    Description string              // 策略描述
    Conditions  []StrategyCondition // 应用条件
    Algorithm   string              // 压缩算法：lz4/snappy/zstd/gzip
    Level       int                 // 压缩级别（1-9）
    Priority    int                 // 优先级
    Enabled     bool                // 是否启用
}

// 策略条件
type StrategyCondition struct {
    Type     string      // 条件类型：age/size/type/source
    Operator string      // 操作符：gt/lt/eq/between
    Value    interface{} // 条件值
}

// 时间窗口
type TimeWindow struct {
    StartHour int // 开始小时（0-23）
    EndHour   int // 结束小时（0-23）
    Weekdays  []int // 工作日（0-6，0=周日）
}

// 压缩器接口
type Compressor interface {
    Compress(data []byte) ([]byte, error)
    Decompress(data []byte) ([]byte, error)
    Name() string
    CompressionRatio() float64
}

// 压缩结果
type CompressionResult struct {
    ID               string        // 结果ID
    SourcePath       string        // 源文件路径
    TargetPath       string        // 目标文件路径
    Algorithm        string        // 压缩算法
    Level            int           // 压缩级别
    OriginalSize     int64         // 原始大小（字节）
    CompressedSize   int64         // 压缩后大小（字节）
    CompressionRatio float64       // 压缩率（%）
    Duration         time.Duration // 耗时
    Success          bool          // 是否成功
    Error            string        // 错误信息
    Timestamp        time.Time     // 时间戳
}

// 压缩统计
type CompressionStats struct {
    TotalFiles       int64         // 总文件数
    CompressedFiles  int64         // 已压缩文件数
    FailedFiles      int64         // 失败文件数
    TotalOriginal    int64         // 总原始大小
    TotalCompressed  int64         // 总压缩大小
    AvgRatio         float64       // 平均压缩率
    TotalDuration    time.Duration // 总耗时
    CostSavings      float64       // 成本节省（美元）
}

// 创建压缩管理器
func NewCompressionManager(config *CompressionConfig) (*CompressionManager, error) {
    cm := &CompressionManager{
        compressors: make(map[string]Compressor),
    }
    cm.config.Store(config)
    
    // 注册压缩器
    cm.compressors["lz4"] = NewLZ4Compressor()
    cm.compressors["snappy"] = NewSnappyCompressor()
    cm.compressors["zstd"] = NewZstdCompressor()
    cm.compressors["gzip"] = NewGzipCompressor()
    
    // 初始化压缩调度器
    cm.scheduler = NewCompressionScheduler(config.ScheduleWindow)
    
    // 初始化压缩分析器
    cm.analyzer = NewCompressionAnalyzer()
    
    // 初始化成本计算器
    cm.costCalc = NewCostCalculator()
    
    // 初始化压缩指标
    cm.metrics = NewCompressionMetrics()
    
    // 初始化告警管理器
    cm.alertManager = NewAlertManager()
    
    // 初始化审计日志记录器
    cm.auditLogger = NewAuditLogger()
    
    return cm, nil
}

// 压缩文件
func (cm *CompressionManager) CompressFile(ctx context.Context, filePath string) (*CompressionResult, error) {
    log.Infof("压缩文件: %s", filePath)
    
    startTime := time.Now()
    result := &CompressionResult{
        ID:         generateResultID(),
        SourcePath: filePath,
        Timestamp:  startTime,
    }
    
    // 1. 读取文件
    data, err := cm.readFile(filePath)
    if err != nil {
        result.Success = false
        result.Error = fmt.Sprintf("读取文件失败: %v", err)
        return result, err
    }
    result.OriginalSize = int64(len(data))
    
    // 2. 选择压缩策略
    strategy := cm.selectStrategy(filePath, data)
    if strategy == nil {
        return nil, fmt.Errorf("没有匹配的压缩策略")
    }
    
    result.Algorithm = strategy.Algorithm
    result.Level = strategy.Level
    
    // 3. 获取压缩器
    compressor, exists := cm.compressors[strategy.Algorithm]
    if !exists {
        return nil, fmt.Errorf("不支持的压缩算法: %s", strategy.Algorithm)
    }
    
    // 4. 执行压缩
    compressed, err := compressor.Compress(data)
    if err != nil {
        result.Success = false
        result.Error = fmt.Sprintf("压缩失败: %v", err)
        cm.metrics.RecordFailure(strategy.Algorithm)
        return result, err
    }
    
    result.CompressedSize = int64(len(compressed))
    result.CompressionRatio = (1 - float64(result.CompressedSize)/float64(result.OriginalSize)) * 100
    result.Duration = time.Since(startTime)
    result.Success = true
    
    // 5. 保存压缩文件
    targetPath := cm.getCompressedPath(filePath, strategy.Algorithm)
    if err := cm.writeFile(targetPath, compressed); err != nil {
        result.Error = fmt.Sprintf("保存压缩文件失败: %v", err)
        return result, err
    }
    result.TargetPath = targetPath
    
    // 6. 更新指标
    cm.metrics.RecordSuccess(strategy.Algorithm, result)
    
    // 7. 记录审计日志
    cm.auditLogger.LogCompression(result)
    
    log.Infof("压缩完成: ratio=%.2f%%, duration=%s", result.CompressionRatio, result.Duration)
    
    return result, nil
}

// 选择压缩策略
func (cm *CompressionManager) selectStrategy(filePath string, data []byte) *CompressionStrategy {
    config := cm.config.Load().(*CompressionConfig)
    
    // 获取文件信息
    fileInfo := cm.getFileInfo(filePath)
    
    // 按优先级排序策略
    sortedStrategies := cm.sortStrategiesByPriority(config.Strategies)
    
    // 找到第一个匹配的策略
    for _, strategy := range sortedStrategies {
        if !strategy.Enabled {
            continue
        }
        
        if cm.matchConditions(fileInfo, strategy.Conditions) {
            return strategy
        }
    }
    
    // 使用默认策略
    return &CompressionStrategy{
        Algorithm: config.DefaultAlgorithm,
        Level:     5,
    }
}

// 文件信息
type FileInfo struct {
    Path     string
    Size     int64
    Age      time.Duration
    Type     string
    Source   string
    Modified time.Time
}

// 匹配条件
func (cm *CompressionManager) matchConditions(fileInfo *FileInfo, conditions []StrategyCondition) bool {
    for _, condition := range conditions {
        if !cm.matchCondition(fileInfo, condition) {
            return false
        }
    }
    return true
}

// 匹配单个条件
func (cm *CompressionManager) matchCondition(fileInfo *FileInfo, condition StrategyCondition) bool {
    switch condition.Type {
    case "age":
        // 文件年龄条件
        ageDays := int(fileInfo.Age.Hours() / 24)
        threshold := condition.Value.(int)
        
        switch condition.Operator {
        case "gt":
            return ageDays > threshold
        case "lt":
            return ageDays < threshold
        case "eq":
            return ageDays == threshold
        }
        
    case "size":
        // 文件大小条件
        sizeMB := fileInfo.Size / (1024 * 1024)
        threshold := condition.Value.(int64)
        
        switch condition.Operator {
        case "gt":
            return sizeMB > threshold
        case "lt":
            return sizeMB < threshold
        }
        
    case "type":
        // 文件类型条件
        return fileInfo.Type == condition.Value.(string)
        
    case "source":
        // 日志源条件
        return fileInfo.Source == condition.Value.(string)
    }
    
    return false
}

// LZ4 压缩器
type LZ4Compressor struct{}

func (lz *LZ4Compressor) Compress(data []byte) ([]byte, error) {
    buf := make([]byte, lz4.CompressBlockBound(len(data)))
    n, err := lz4.CompressBlock(data, buf, nil)
    if err != nil {
        return nil, err
    }
    return buf[:n], nil
}

func (lz *LZ4Compressor) Decompress(data []byte) ([]byte, error) {
    buf := make([]byte, len(data)*10) // 预估解压后大小
    n, err := lz4.UncompressBlock(data, buf)
    if err != nil {
        return nil, err
    }
    return buf[:n], nil
}

func (lz *LZ4Compressor) Name() string {
    return "LZ4"
}

func (lz *LZ4Compressor) CompressionRatio() float64 {
    return 50.0 // 平均压缩率 50%
}

// Snappy 压缩器
type SnappyCompressor struct{}

func (sc *SnappyCompressor) Compress(data []byte) ([]byte, error) {
    return snappy.Encode(nil, data), nil
}

func (sc *SnappyCompressor) Decompress(data []byte) ([]byte, error) {
    return snappy.Decode(nil, data)
}

func (sc *SnappyCompressor) Name() string {
    return "Snappy"
}

func (sc *SnappyCompressor) CompressionRatio() float64 {
    return 55.0 // 平均压缩率 55%
}

// Zstd 压缩器
type ZstdCompressor struct {
    encoder *zstd.Encoder
    decoder *zstd.Decoder
}

func NewZstdCompressor() *ZstdCompressor {
    encoder, _ := zstd.NewWriter(nil)
    decoder, _ := zstd.NewReader(nil)
    return &ZstdCompressor{
        encoder: encoder,
        decoder: decoder,
    }
}

func (zc *ZstdCompressor) Compress(data []byte) ([]byte, error) {
    return zc.encoder.EncodeAll(data, nil), nil
}

func (zc *ZstdCompressor) Decompress(data []byte) ([]byte, error) {
    return zc.decoder.DecodeAll(data, nil)
}

func (zc *ZstdCompressor) Name() string {
    return "Zstd"
}

func (zc *ZstdCompressor) CompressionRatio() float64 {
    return 70.0 // 平均压缩率 70%
}

// Gzip 压缩器
type GzipCompressor struct {
    level int
}

func NewGzipCompressor() *GzipCompressor {
    return &GzipCompressor{level: gzip.DefaultCompression}
}

func (gc *GzipCompressor) Compress(data []byte) ([]byte, error) {
    var buf bytes.Buffer
    writer, err := gzip.NewWriterLevel(&buf, gc.level)
    if err != nil {
        return nil, err
    }
    
    if _, err := writer.Write(data); err != nil {
        return nil, err
    }
    
    if err := writer.Close(); err != nil {
        return nil, err
    }
    
    return buf.Bytes(), nil
}

func (gc *GzipCompressor) Decompress(data []byte) ([]byte, error) {
    reader, err := gzip.NewReader(bytes.NewReader(data))
    if err != nil {
        return nil, err
    }
    defer reader.Close()
    
    return io.ReadAll(reader)
}

func (gc *GzipCompressor) Name() string {
    return "Gzip"
}

func (gc *GzipCompressor) CompressionRatio() float64 {
    return 65.0 // 平均压缩率 65%
}

// 压缩分析器
type CompressionAnalyzer struct{}

// 分析压缩效果
func (ca *CompressionAnalyzer) AnalyzeCompression(results []*CompressionResult) *CompressionAnalysis {
    analysis := &CompressionAnalysis{
        TotalFiles:   len(results),
        AlgorithmStats: make(map[string]*AlgorithmStats),
    }
    
    var totalOriginal, totalCompressed int64
    var totalDuration time.Duration
    
    for _, result := range results {
        if !result.Success {
            analysis.FailedFiles++
            continue
        }
        
        analysis.SuccessFiles++
        totalOriginal += result.OriginalSize
        totalCompressed += result.CompressedSize
        totalDuration += result.Duration
        
        // 统计各算法效果
        if _, exists := analysis.AlgorithmStats[result.Algorithm]; !exists {
            analysis.AlgorithmStats[result.Algorithm] = &AlgorithmStats{}
        }
        
        stats := analysis.AlgorithmStats[result.Algorithm]
        stats.Count++
        stats.TotalOriginal += result.OriginalSize
        stats.TotalCompressed += result.CompressedSize
        stats.TotalDuration += result.Duration
    }
    
    // 计算总体统计
    if totalOriginal > 0 {
        analysis.OverallRatio = (1 - float64(totalCompressed)/float64(totalOriginal)) * 100
    }
    analysis.TotalOriginal = totalOriginal
    analysis.TotalCompressed = totalCompressed
    analysis.TotalDuration = totalDuration
    
    // 计算各算法统计
    for _, stats := range analysis.AlgorithmStats {
        if stats.TotalOriginal > 0 {
            stats.AvgRatio = (1 - float64(stats.TotalCompressed)/float64(stats.TotalOriginal)) * 100
        }
        if stats.Count > 0 {
            stats.AvgDuration = stats.TotalDuration / time.Duration(stats.Count)
        }
    }
    
    return analysis
}

// 压缩分析结果
type CompressionAnalysis struct {
    TotalFiles       int                        // 总文件数
    SuccessFiles     int                        // 成功文件数
    FailedFiles      int                        // 失败文件数
    TotalOriginal    int64                      // 总原始大小
    TotalCompressed  int64                      // 总压缩大小
    OverallRatio     float64                    // 总体压缩率
    TotalDuration    time.Duration              // 总耗时
    AlgorithmStats   map[string]*AlgorithmStats // 各算法统计
}

// 算法统计
type AlgorithmStats struct {
    Count           int           // 文件数
    TotalOriginal   int64         // 总原始大小
    TotalCompressed int64         // 总压缩大小
    AvgRatio        float64       // 平均压缩率
    TotalDuration   time.Duration // 总耗时
    AvgDuration     time.Duration // 平均耗时
}

// 成本计算器
type CostCalculator struct {
    storagePricePerGB float64 // 每GB存储价格（美元/月）
}

func NewCostCalculator() *CostCalculator {
    return &CostCalculator{
        storagePricePerGB: 0.023, // AWS S3 标准存储价格
    }
}

// 计算成本节省
func (cc *CostCalculator) CalculateSavings(originalSize, compressedSize int64) float64 {
    savedBytes := originalSize - compressedSize
    savedGB := float64(savedBytes) / (1024 * 1024 * 1024)
    return savedGB * cc.storagePricePerGB
}

// 计算年度节省
func (cc *CostCalculator) CalculateAnnualSavings(monthlySavings float64) float64 {
    return monthlySavings * 12
}

// 生成成本报告
func (cc *CostCalculator) GenerateCostReport(analysis *CompressionAnalysis) *CostReport {
    report := &CostReport{
        OriginalSize:   analysis.TotalOriginal,
        CompressedSize: analysis.TotalCompressed,
        SavedSize:      analysis.TotalOriginal - analysis.TotalCompressed,
    }
    
    // 计算月度节省
    report.MonthlySavings = cc.CalculateSavings(analysis.TotalOriginal, analysis.TotalCompressed)
    
    // 计算年度节省
    report.AnnualSavings = cc.CalculateAnnualSavings(report.MonthlySavings)
    
    // 计算投资回报率（假设压缩成本为节省的10%）
    compressionCost := report.MonthlySavings * 0.1
    report.ROI = ((report.MonthlySavings - compressionCost) / compressionCost) * 100
    
    return report
}

// 成本报告
type CostReport struct {
    OriginalSize    int64   // 原始大小（字节）
    CompressedSize  int64   // 压缩后大小（字节）
    SavedSize       int64   // 节省大小（字节）
    MonthlySavings  float64 // 月度节省（美元）
    AnnualSavings   float64 // 年度节省（美元）
    ROI             float64 // 投资回报率（%）
}

// 压缩调度器
type CompressionScheduler struct {
    window    TimeWindow
    taskQueue chan *CompressionTask
    workers   []*CompressionWorker
}

// 压缩任务
type CompressionTask struct {
    ID       string
    FilePath string
    Strategy *CompressionStrategy
    Priority int
    Created  time.Time
}

// 启动调度器
func (cs *CompressionScheduler) Start(ctx context.Context, maxWorkers int) {
    log.Infof("启动压缩调度器: workers=%d", maxWorkers)
    
    // 创建工作协程
    for i := 0; i < maxWorkers; i++ {
        worker := &CompressionWorker{
            id:        i,
            taskQueue: cs.taskQueue,
        }
        cs.workers = append(cs.workers, worker)
        go worker.Start(ctx)
    }
    
    // 启动调度循环
    go cs.scheduleLoop(ctx)
}

// 调度循环
func (cs *CompressionScheduler) scheduleLoop(ctx context.Context) {
    ticker := time.NewTicker(1 * time.Hour)
    defer ticker.Stop()
    
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            // 检查是否在时间窗口内
            if cs.isInWindow() {
                log.Info("在压缩时间窗口内，开始调度任务")
                cs.scheduleTasks()
            }
        }
    }
}

// 检查是否在时间窗口内
func (cs *CompressionScheduler) isInWindow() bool {
    now := time.Now()
    hour := now.Hour()
    weekday := int(now.Weekday())
    
    // 检查小时
    if hour < cs.window.StartHour || hour >= cs.window.EndHour {
        return false
    }
    
    // 检查星期
    if len(cs.window.Weekdays) > 0 {
        inWeekday := false
        for _, wd := range cs.window.Weekdays {
            if weekday == wd {
                inWeekday = true
                break
            }
        }
        if !inWeekday {
            return false
        }
    }
    
    return true
}

// 压缩工作协程
type CompressionWorker struct {
    id        int
    taskQueue chan *CompressionTask
}

// 启动工作协程
func (cw *CompressionWorker) Start(ctx context.Context) {
    log.Infof("启动压缩工作协程: id=%d", cw.id)
    
    for {
        select {
        case <-ctx.Done():
            return
        case task := <-cw.taskQueue:
            cw.processTask(ctx, task)
        }
    }
}

// 处理任务
func (cw *CompressionWorker) processTask(ctx context.Context, task *CompressionTask) {
    log.Infof("处理压缩任务: worker=%d, file=%s", cw.id, task.FilePath)
    
    // 执行压缩（实现略）
    // result, err := cm.CompressFile(ctx, task.FilePath)
    
    log.Infof("压缩任务完成: worker=%d, file=%s", cw.id, task.FilePath)
}

// 预览压缩效果
func (cm *CompressionManager) PreviewCompression(ctx context.Context, filePath string, algorithm string) (*CompressionPreview, error) {
    log.Infof("预览压缩效果: file=%s, algorithm=%s", filePath, algorithm)
    
    // 1. 读取文件样本（前1MB）
    sampleSize := 1024 * 1024 // 1MB
    data, err := cm.readFileSample(filePath, sampleSize)
    if err != nil {
        return nil, err
    }
    
    // 2. 获取压缩器
    compressor, exists := cm.compressors[algorithm]
    if !exists {
        return nil, fmt.Errorf("不支持的压缩算法: %s", algorithm)
    }
    
    // 3. 压缩样本
    startTime := time.Now()
    compressed, err := compressor.Compress(data)
    if err != nil {
        return nil, err
    }
    duration := time.Since(startTime)
    
    // 4. 计算预期效果
    preview := &CompressionPreview{
        Algorithm:        algorithm,
        SampleSize:       int64(len(data)),
        CompressedSize:   int64(len(compressed)),
        CompressionRatio: (1 - float64(len(compressed))/float64(len(data))) * 100,
        Duration:         duration,
    }
    
    // 5. 估算全文件效果
    fileInfo := cm.getFileInfo(filePath)
    preview.EstimatedOriginal = fileInfo.Size
    preview.EstimatedCompressed = int64(float64(fileInfo.Size) * (1 - preview.CompressionRatio/100))
    preview.EstimatedSavings = cm.costCalc.CalculateSavings(preview.EstimatedOriginal, preview.EstimatedCompressed)
    
    return preview, nil
}

// 压缩预览
type CompressionPreview struct {
    Algorithm           string        // 压缩算法
    SampleSize          int64         // 样本大小
    CompressedSize      int64         // 压缩后大小
    CompressionRatio    float64       // 压缩率
    Duration            time.Duration // 耗时
    EstimatedOriginal   int64         // 预估原始大小
    EstimatedCompressed int64         // 预估压缩大小
    EstimatedSavings    float64       // 预估成本节省
}

// 批量压缩
func (cm *CompressionManager) BatchCompress(ctx context.Context, filePaths []string) (*BatchCompressionResult, error) {
    log.Infof("批量压缩: files=%d", len(filePaths))
    
    config := cm.config.Load().(*CompressionConfig)
    
    result := &BatchCompressionResult{
        TotalFiles: len(filePaths),
        StartTime:  time.Now(),
        Results:    make([]*CompressionResult, 0),
    }
    
    // 使用工作池并发压缩
    semaphore := make(chan struct{}, config.MaxConcurrency)
    var wg sync.WaitGroup
    var mu sync.Mutex
    
    for _, filePath := range filePaths {
        wg.Add(1)
        go func(path string) {
            defer wg.Done()
            
            // 获取信号量
            semaphore <- struct{}{}
            defer func() { <-semaphore }()
            
            // 压缩文件
            compResult, err := cm.CompressFile(ctx, path)
            
            mu.Lock()
            if err != nil {
                result.FailedFiles++
            } else {
                result.SuccessFiles++
            }
            result.Results = append(result.Results, compResult)
            mu.Unlock()
        }(filePath)
    }
    
    wg.Wait()
    result.EndTime = time.Now()
    result.Duration = result.EndTime.Sub(result.StartTime)
    
    // 生成分析报告
    result.Analysis = cm.analyzer.AnalyzeCompression(result.Results)
    
    // 生成成本报告
    result.CostReport = cm.costCalc.GenerateCostReport(result.Analysis)
    
    return result, nil
}

// 批量压缩结果
type BatchCompressionResult struct {
    TotalFiles   int                   // 总文件数
    SuccessFiles int                   // 成功文件数
    FailedFiles  int                   // 失败文件数
    StartTime    time.Time             // 开始时间
    EndTime      time.Time             // 结束时间
    Duration     time.Duration         // 总耗时
    Results      []*CompressionResult  // 压缩结果列表
    Analysis     *CompressionAnalysis  // 分析报告
    CostReport   *CostReport           // 成本报告
}
```

**关键实现点**:

1. 支持4种主流压缩算法：LZ4（快速）、Snappy（平衡）、Zstd（高压缩率）、Gzip（通用）
2. 实现渐进式压缩策略：新数据用快速算法（LZ4），旧数据用高压缩率算法（Zstd）
3. 提供压缩效果分析，包括压缩率、耗时、各算法对比
4. 实现成本计算器，基于云存储价格（AWS S3）计算月度和年度节省
5. 支持压缩任务调度，可配置时间窗口避开业务高峰期
6. 提供压缩预览功能，基于样本数据估算全文件压缩效果
7. 支持批量压缩，使用工作池控制并发数，提高处理效率

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| compression_enabled | bool | true | 是否启用压缩 |
| strategies | array | [] | 压缩策略列表 |
| default_algorithm | string | "lz4" | 默认压缩算法 |
| schedule_start_hour | int | 2 | 压缩开始时间（小时） |
| schedule_end_hour | int | 6 | 压缩结束时间（小时） |
| max_concurrency | int | 10 | 最大并发数 |
| retry_attempts | int | 3 | 重试次数 |
| alert_enabled | bool | true | 是否启用告警 |
| storage_price_per_gb | float | 0.023 | 存储价格（美元/GB/月） |

**热更新机制**:

- 更新方式: Redis Pub/Sub + PostgreSQL
- 生效时间: 立即生效（下次压缩任务生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志并发送告警

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的压缩策略
2. WHEN 压缩算法变更时，THE System SHALL 在下次压缩任务时使用新算法
3. THE System SHALL 支持通过 API 查询当前生效的压缩配置
4. THE System SHALL 记录所有压缩配置变更的审计日志
5. WHEN 时间窗口变更时，THE System SHALL 验证时间范围的合理性（0-23小时）

---

#### 需求 16-66: 日志标准化导出 [Phase 2]

**用户故事**:

作为数据工程师，我希望能够以标准化格式导出日志数据，以便与其他数据分析系统集成。

**验收标准**:

1. THE Dashboard SHALL 支持将日志数据导出为至少 3 种大数据标准格式（Parquet、ORC、Avro）
2. THE System SHALL 支持导出到多种云存储（AWS S3、Azure Blob Storage、Google Cloud Storage）和数据湖（Delta Lake、Apache Iceberg）
3. THE Dashboard SHALL 支持配置导出任务的分区策略，包括按时间（年/月/日/小时）、按来源、按类型分区
4. THE System SHALL 支持增量导出，仅导出自上次导出以来的新数据，减少重复处理
5. THE Dashboard SHALL 展示导出任务的执行历史，包括导出时间、数据量、耗时、状态
6. THE System SHALL 支持导出数据的 Schema 管理，确保数据格式一致性，支持 Schema 演进
7. WHEN 导出任务失败时，THE System SHALL 在 5 分钟内发送告警并支持断点续传
8. THE System SHALL 支持导出任务的调度配置，允许设置定时导出（每日/每周/每月）
9. THE System SHALL 提供导出数据的质量验证，包括记录数校验、Schema 校验、数据完整性校验
10. THE System SHALL 通过配置中心管理导出配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/export/manager.go
package export

import (
    "context"
    "time"
    "github.com/xitongsys/parquet-go/writer"
    "github.com/linkedin/goavro/v2"
)

// 导出管理器
type ExportManager struct {
    config        atomic.Value       // 配置（支持热更新）
    exporters     map[string]Exporter // 导出器映射
    scheduler     *ExportScheduler   // 导出调度器
    schemaManager *SchemaManager     // Schema管理器
    validator     *DataValidator     // 数据验证器
    storage       *StorageManager    // 存储管理器
    metrics       *ExportMetrics     // 导出指标
    alertManager  *AlertManager      // 告警管理器
    auditLogger   *AuditLogger       // 审计日志记录器
}

// 导出配置
type ExportConfig struct {
    Tasks            []ExportTask      // 导出任务列表
    DefaultFormat    string            // 默认导出格式
    DefaultStorage   string            // 默认存储类型
    PartitionStrategy PartitionStrategy // 分区策略
    IncrementalMode  bool              // 是否增量导出
    ValidationEnabled bool             // 是否启用验证
    RetryAttempts    int               // 重试次数
    CheckpointEnabled bool             // 是否启用断点续传
}

// 导出任务
type ExportTask struct {
    ID          string            // 任务ID
    Name        string            // 任务名称
    Description string            // 任务描述
    Format      string            // 导出格式：parquet/orc/avro/json/csv
    Storage     StorageConfig     // 存储配置
    Partition   PartitionConfig   // 分区配置
    Schedule    ScheduleConfig    // 调度配置
    Filter      FilterConfig      // 过滤配置
    Schema      SchemaConfig      // Schema配置
    Enabled     bool              // 是否启用
}

// 存储配置
type StorageConfig struct {
    Type        string            // 存储类型：s3/azure/gcs/delta/iceberg
    Endpoint    string            // 存储端点
    Bucket      string            // 存储桶/容器名称
    Path        string            // 存储路径
    Credentials map[string]string // 认证凭证
}

// 分区配置
type PartitionConfig struct {
    Enabled    bool     // 是否启用分区
    Columns    []string // 分区列：year/month/day/hour/source/level
    Format     string   // 分区格式：hive/custom
}

// 调度配置
type ScheduleConfig struct {
    Enabled   bool   // 是否启用调度
    Cron      string // Cron表达式
    Timezone  string // 时区
}

// 过滤配置
type FilterConfig struct {
    TimeRange  TimeRange         // 时间范围
    Sources    []string          // 日志源过滤
    Levels     []string          // 日志级别过滤
    Conditions []FilterCondition // 自定义条件
}

// Schema配置
type SchemaConfig struct {
    Version     int               // Schema版本
    Fields      []SchemaField     // 字段定义
    Evolution   bool              // 是否支持Schema演进
}

// Schema字段
type SchemaField struct {
    Name     string // 字段名
    Type     string // 字段类型
    Nullable bool   // 是否可空
    Comment  string // 字段注释
}

// 导出器接口
type Exporter interface {
    Export(ctx context.Context, data []*LogEntry, config *ExportTask) (*ExportResult, error)
    Format() string
    SupportedStorages() []string
}

// 导出结果
type ExportResult struct {
    TaskID       string        // 任务ID
    Format       string        // 导出格式
    Storage      string        // 存储类型
    Path         string        // 导出路径
    RecordCount  int64         // 记录数
    FileSize     int64         // 文件大小
    PartitionKey string        // 分区键
    StartTime    time.Time     // 开始时间
    EndTime      time.Time     // 结束时间
    Duration     time.Duration // 耗时
    Success      bool          // 是否成功
    Error        string        // 错误信息
    Checkpoint   *Checkpoint   // 断点信息
}

// 断点信息
type Checkpoint struct {
    TaskID       string    // 任务ID
    LastExported time.Time // 最后导出时间
    LastOffset   int64     // 最后偏移量
    LastRecordID string    // 最后记录ID
}

// 创建导出管理器
func NewExportManager(config *ExportConfig) (*ExportManager, error) {
    em := &ExportManager{
        exporters: make(map[string]Exporter),
    }
    em.config.Store(config)
    
    // 注册导出器
    em.exporters["parquet"] = NewParquetExporter()
    em.exporters["orc"] = NewORCExporter()
    em.exporters["avro"] = NewAvroExporter()
    em.exporters["json"] = NewJSONExporter()
    em.exporters["csv"] = NewCSVExporter()
    
    // 初始化导出调度器
    em.scheduler = NewExportScheduler()
    
    // 初始化Schema管理器
    em.schemaManager = NewSchemaManager()
    
    // 初始化数据验证器
    em.validator = NewDataValidator()
    
    // 初始化存储管理器
    em.storage = NewStorageManager()
    
    // 初始化导出指标
    em.metrics = NewExportMetrics()
    
    // 初始化告警管理器
    em.alertManager = NewAlertManager()
    
    // 初始化审计日志记录器
    em.auditLogger = NewAuditLogger()
    
    return em, nil
}

// 执行导出任务
func (em *ExportManager) ExecuteTask(ctx context.Context, taskID string) (*ExportResult, error) {
    log.Infof("执行导出任务: task=%s", taskID)
    
    config := em.config.Load().(*ExportConfig)
    
    // 1. 获取任务配置
    task := em.findTask(config.Tasks, taskID)
    if task == nil {
        return nil, fmt.Errorf("任务不存在: %s", taskID)
    }
    
    if !task.Enabled {
        return nil, fmt.Errorf("任务已禁用: %s", taskID)
    }
    
    // 2. 获取导出器
    exporter, exists := em.exporters[task.Format]
    if !exists {
        return nil, fmt.Errorf("不支持的导出格式: %s", task.Format)
    }
    
    // 3. 获取待导出数据
    data, err := em.fetchData(ctx, task)
    if err != nil {
        return nil, fmt.Errorf("获取数据失败: %w", err)
    }
    
    if len(data) == 0 {
        log.Info("没有待导出的数据")
        return &ExportResult{
            TaskID:      taskID,
            Success:     true,
            RecordCount: 0,
        }, nil
    }
    
    // 4. 验证Schema
    if config.ValidationEnabled {
        if err := em.validateSchema(task, data); err != nil {
            return nil, fmt.Errorf("Schema验证失败: %w", err)
        }
    }
    
    // 5. 执行导出
    result, err := exporter.Export(ctx, data, task)
    if err != nil {
        // 记录失败
        em.metrics.RecordFailure(taskID)
        
        // 发送告警
        em.sendExportAlert(task, err)
        
        return nil, fmt.Errorf("导出失败: %w", err)
    }
    
    // 6. 验证导出结果
    if config.ValidationEnabled {
        if err := em.validateExport(result, data); err != nil {
            log.Warnf("导出验证失败: %v", err)
        }
    }
    
    // 7. 更新断点
    if config.CheckpointEnabled {
        em.updateCheckpoint(taskID, result)
    }
    
    // 8. 更新指标
    em.metrics.RecordSuccess(taskID, result)
    
    // 9. 记录审计日志
    em.auditLogger.LogExport(result)
    
    log.Infof("导出完成: records=%d, size=%d, duration=%s", 
        result.RecordCount, result.FileSize, result.Duration)
    
    return result, nil
}

// 获取待导出数据
func (em *ExportManager) fetchData(ctx context.Context, task *ExportTask) ([]*LogEntry, error) {
    config := em.config.Load().(*ExportConfig)
    
    // 构建查询条件
    query := em.buildQuery(task)
    
    // 如果启用增量导出，从断点开始
    if config.IncrementalMode {
        checkpoint := em.getCheckpoint(task.ID)
        if checkpoint != nil {
            query.StartTime = checkpoint.LastExported
            query.StartOffset = checkpoint.LastOffset
        }
    }
    
    // 执行查询（实现略）
    data, err := em.queryLogs(ctx, query)
    if err != nil {
        return nil, err
    }
    
    return data, nil
}

// Parquet导出器
type ParquetExporter struct{}

func (pe *ParquetExporter) Export(ctx context.Context, data []*LogEntry, task *ExportTask) (*ExportResult, error) {
    startTime := time.Now()
    
    result := &ExportResult{
        TaskID:    task.ID,
        Format:    "parquet",
        Storage:   task.Storage.Type,
        StartTime: startTime,
    }
    
    // 1. 生成导出路径
    path := pe.generatePath(task)
    result.Path = path
    
    // 2. 创建Parquet写入器
    fw, err := pe.createWriter(path, task.Schema)
    if err != nil {
        result.Success = false
        result.Error = fmt.Sprintf("创建写入器失败: %v", err)
        return result, err
    }
    defer fw.WriteStop()
    
    // 3. 写入数据
    for _, entry := range data {
        record := pe.convertToParquetRecord(entry)
        if err := fw.Write(record); err != nil {
            result.Success = false
            result.Error = fmt.Sprintf("写入数据失败: %v", err)
            return result, err
        }
        result.RecordCount++
    }
    
    // 4. 上传到存储
    fileSize, err := pe.uploadToStorage(path, task.Storage)
    if err != nil {
        result.Success = false
        result.Error = fmt.Sprintf("上传失败: %v", err)
        return result, err
    }
    
    result.FileSize = fileSize
    result.EndTime = time.Now()
    result.Duration = result.EndTime.Sub(startTime)
    result.Success = true
    
    return result, nil
}

func (pe *ParquetExporter) Format() string {
    return "parquet"
}

func (pe *ParquetExporter) SupportedStorages() []string {
    return []string{"s3", "azure", "gcs", "delta", "iceberg"}
}

// 生成导出路径
func (pe *ParquetExporter) generatePath(task *ExportTask) string {
    basePath := task.Storage.Path
    
    // 如果启用分区
    if task.Partition.Enabled {
        now := time.Now()
        
        for _, col := range task.Partition.Columns {
            switch col {
            case "year":
                basePath = filepath.Join(basePath, fmt.Sprintf("year=%d", now.Year()))
            case "month":
                basePath = filepath.Join(basePath, fmt.Sprintf("month=%02d", now.Month()))
            case "day":
                basePath = filepath.Join(basePath, fmt.Sprintf("day=%02d", now.Day()))
            case "hour":
                basePath = filepath.Join(basePath, fmt.Sprintf("hour=%02d", now.Hour()))
            }
        }
    }
    
    // 生成文件名
    filename := fmt.Sprintf("%s_%s.parquet", task.Name, time.Now().Format("20060102_150405"))
    return filepath.Join(basePath, filename)
}

// Avro导出器
type AvroExporter struct{}

func (ae *AvroExporter) Export(ctx context.Context, data []*LogEntry, task *ExportTask) (*ExportResult, error) {
    startTime := time.Now()
    
    result := &ExportResult{
        TaskID:    task.ID,
        Format:    "avro",
        Storage:   task.Storage.Type,
        StartTime: startTime,
    }
    
    // 1. 生成Avro Schema
    avroSchema := ae.generateAvroSchema(task.Schema)
    
    // 2. 创建Avro编码器
    codec, err := goavro.NewCodec(avroSchema)
    if err != nil {
        result.Success = false
        result.Error = fmt.Sprintf("创建编码器失败: %v", err)
        return result, err
    }
    
    // 3. 编码数据
    var records []interface{}
    for _, entry := range data {
        record := ae.convertToAvroRecord(entry)
        records = append(records, record)
        result.RecordCount++
    }
    
    // 4. 写入文件
    path := ae.generatePath(task)
    result.Path = path
    
    ocfWriter, err := goavro.NewOCFWriter(goavro.OCFConfig{
        W:      createFile(path),
        Schema: avroSchema,
    })
    if err != nil {
        result.Success = false
        result.Error = fmt.Sprintf("创建OCF写入器失败: %v", err)
        return result, err
    }
    
    for _, record := range records {
        if err := ocfWriter.Append([]interface{}{record}); err != nil {
            result.Success = false
            result.Error = fmt.Sprintf("写入记录失败: %v", err)
            return result, err
        }
    }
    
    // 5. 上传到存储
    fileSize, err := ae.uploadToStorage(path, task.Storage)
    if err != nil {
        result.Success = false
        result.Error = fmt.Sprintf("上传失败: %v", err)
        return result, err
    }
    
    result.FileSize = fileSize
    result.EndTime = time.Now()
    result.Duration = result.EndTime.Sub(startTime)
    result.Success = true
    
    return result, nil
}

func (ae *AvroExporter) Format() string {
    return "avro"
}

func (ae *AvroExporter) SupportedStorages() []string {
    return []string{"s3", "azure", "gcs", "delta", "iceberg"}
}

// Schema管理器
type SchemaManager struct {
    schemas map[string]*SchemaVersion
    mu      sync.RWMutex
}

// Schema版本
type SchemaVersion struct {
    Version   int
    Schema    SchemaConfig
    CreatedAt time.Time
    Author    string
}

// 注册Schema
func (sm *SchemaManager) RegisterSchema(name string, schema SchemaConfig) error {
    sm.mu.Lock()
    defer sm.mu.Unlock()
    
    if sm.schemas == nil {
        sm.schemas = make(map[string]*SchemaVersion)
    }
    
    version := &SchemaVersion{
        Version:   schema.Version,
        Schema:    schema,
        CreatedAt: time.Now(),
    }
    
    sm.schemas[name] = version
    
    log.Infof("注册Schema: name=%s, version=%d", name, schema.Version)
    
    return nil
}

// 获取Schema
func (sm *SchemaManager) GetSchema(name string) (*SchemaVersion, error) {
    sm.mu.RLock()
    defer sm.mu.RUnlock()
    
    schema, exists := sm.schemas[name]
    if !exists {
        return nil, fmt.Errorf("Schema不存在: %s", name)
    }
    
    return schema, nil
}

// 验证Schema兼容性
func (sm *SchemaManager) ValidateCompatibility(oldSchema, newSchema SchemaConfig) error {
    // 检查字段变更
    oldFields := make(map[string]SchemaField)
    for _, field := range oldSchema.Fields {
        oldFields[field.Name] = field
    }
    
    for _, newField := range newSchema.Fields {
        if oldField, exists := oldFields[newField.Name]; exists {
            // 字段存在，检查类型是否兼容
            if oldField.Type != newField.Type {
                return fmt.Errorf("字段类型不兼容: %s (%s -> %s)", 
                    newField.Name, oldField.Type, newField.Type)
            }
            
            // 检查可空性
            if oldField.Nullable && !newField.Nullable {
                return fmt.Errorf("字段可空性不兼容: %s", newField.Name)
            }
        }
    }
    
    return nil
}

// 数据验证器
type DataValidator struct{}

// 验证导出结果
func (dv *DataValidator) ValidateExport(result *ExportResult, originalData []*LogEntry) error {
    log.Infof("验证导出结果: task=%s", result.TaskID)
    
    // 1. 验证记录数
    if result.RecordCount != int64(len(originalData)) {
        return fmt.Errorf("记录数不匹配: expected=%d, actual=%d", 
            len(originalData), result.RecordCount)
    }
    
    // 2. 验证文件大小
    if result.FileSize == 0 {
        return fmt.Errorf("文件大小为0")
    }
    
    // 3. 验证文件存在性
    exists, err := dv.checkFileExists(result.Path)
    if err != nil {
        return fmt.Errorf("检查文件存在性失败: %w", err)
    }
    if !exists {
        return fmt.Errorf("导出文件不存在: %s", result.Path)
    }
    
    log.Info("导出验证通过")
    return nil
}

// 验证Schema
func (dv *DataValidator) ValidateSchema(schema SchemaConfig, data []*LogEntry) error {
    log.Info("验证Schema")
    
    // 检查必需字段
    requiredFields := make(map[string]bool)
    for _, field := range schema.Fields {
        if !field.Nullable {
            requiredFields[field.Name] = true
        }
    }
    
    // 验证数据
    for i, entry := range data {
        for fieldName := range requiredFields {
            if !dv.hasField(entry, fieldName) {
                return fmt.Errorf("记录%d缺少必需字段: %s", i, fieldName)
            }
        }
    }
    
    log.Info("Schema验证通过")
    return nil
}

// 存储管理器
type StorageManager struct {
    s3Client    *S3Client
    azureClient *AzureClient
    gcsClient   *GCSClient
}

// 上传到S3
func (sm *StorageManager) UploadToS3(localPath string, config StorageConfig) (int64, error) {
    log.Infof("上传到S3: bucket=%s, path=%s", config.Bucket, config.Path)
    
    // 读取文件
    data, err := os.ReadFile(localPath)
    if err != nil {
        return 0, fmt.Errorf("读取文件失败: %w", err)
    }
    
    // 上传到S3
    key := filepath.Join(config.Path, filepath.Base(localPath))
    if err := sm.s3Client.PutObject(config.Bucket, key, data); err != nil {
        return 0, fmt.Errorf("上传失败: %w", err)
    }
    
    log.Infof("上传成功: size=%d", len(data))
    return int64(len(data)), nil
}

// 上传到Azure Blob Storage
func (sm *StorageManager) UploadToAzure(localPath string, config StorageConfig) (int64, error) {
    log.Infof("上传到Azure: container=%s, path=%s", config.Bucket, config.Path)
    
    // 读取文件
    data, err := os.ReadFile(localPath)
    if err != nil {
        return 0, fmt.Errorf("读取文件失败: %w", err)
    }
    
    // 上传到Azure
    blobName := filepath.Join(config.Path, filepath.Base(localPath))
    if err := sm.azureClient.UploadBlob(config.Bucket, blobName, data); err != nil {
        return 0, fmt.Errorf("上传失败: %w", err)
    }
    
    log.Infof("上传成功: size=%d", len(data))
    return int64(len(data)), nil
}

// 上传到Google Cloud Storage
func (sm *StorageManager) UploadToGCS(localPath string, config StorageConfig) (int64, error) {
    log.Infof("上传到GCS: bucket=%s, path=%s", config.Bucket, config.Path)
    
    // 读取文件
    data, err := os.ReadFile(localPath)
    if err != nil {
        return 0, fmt.Errorf("读取文件失败: %w", err)
    }
    
    // 上传到GCS
    objectName := filepath.Join(config.Path, filepath.Base(localPath))
    if err := sm.gcsClient.UploadObject(config.Bucket, objectName, data); err != nil {
        return 0, fmt.Errorf("上传失败: %w", err)
    }
    
    log.Infof("上传成功: size=%d", len(data))
    return int64(len(data)), nil
}

// 导出调度器
type ExportScheduler struct {
    tasks   map[string]*ScheduledTask
    cron    *cron.Cron
    mu      sync.RWMutex
}

// 调度任务
type ScheduledTask struct {
    TaskID   string
    Schedule ScheduleConfig
    NextRun  time.Time
    LastRun  time.Time
    Enabled  bool
}

// 启动调度器
func (es *ExportScheduler) Start(ctx context.Context, manager *ExportManager) {
    log.Info("启动导出调度器")
    
    es.cron = cron.New()
    
    // 注册所有调度任务
    config := manager.config.Load().(*ExportConfig)
    for _, task := range config.Tasks {
        if task.Schedule.Enabled {
            es.scheduleTask(task, manager)
        }
    }
    
    es.cron.Start()
    
    // 等待上下文取消
    <-ctx.Done()
    es.cron.Stop()
}

// 调度任务
func (es *ExportScheduler) scheduleTask(task ExportTask, manager *ExportManager) {
    log.Infof("调度任务: task=%s, cron=%s", task.ID, task.Schedule.Cron)
    
    es.cron.AddFunc(task.Schedule.Cron, func() {
        log.Infof("执行调度任务: task=%s", task.ID)
        
        ctx := context.Background()
        result, err := manager.ExecuteTask(ctx, task.ID)
        if err != nil {
            log.Errorf("任务执行失败: task=%s, err=%v", task.ID, err)
        } else {
            log.Infof("任务执行成功: task=%s, records=%d", task.ID, result.RecordCount)
        }
    })
}

// 断点管理
func (em *ExportManager) updateCheckpoint(taskID string, result *ExportResult) {
    checkpoint := &Checkpoint{
        TaskID:       taskID,
        LastExported: result.EndTime,
        LastOffset:   result.RecordCount,
    }
    
    // 保存断点（实现略）
    em.saveCheckpoint(checkpoint)
    
    log.Infof("更新断点: task=%s, time=%s, offset=%d", 
        taskID, checkpoint.LastExported, checkpoint.LastOffset)
}

// 获取断点
func (em *ExportManager) getCheckpoint(taskID string) *Checkpoint {
    // 从存储中获取断点（实现略）
    checkpoint, _ := em.loadCheckpoint(taskID)
    return checkpoint
}

// 批量导出
func (em *ExportManager) BatchExport(ctx context.Context, taskIDs []string) (*BatchExportResult, error) {
    log.Infof("批量导出: tasks=%d", len(taskIDs))
    
    result := &BatchExportResult{
        TotalTasks: len(taskIDs),
        StartTime:  time.Now(),
        Results:    make([]*ExportResult, 0),
    }
    
    // 并发执行导出任务
    var wg sync.WaitGroup
    var mu sync.Mutex
    semaphore := make(chan struct{}, 5) // 最多5个并发
    
    for _, taskID := range taskIDs {
        wg.Add(1)
        go func(id string) {
            defer wg.Done()
            
            // 获取信号量
            semaphore <- struct{}{}
            defer func() { <-semaphore }()
            
            // 执行导出
            exportResult, err := em.ExecuteTask(ctx, id)
            
            mu.Lock()
            if err != nil {
                result.FailedTasks++
            } else {
                result.SuccessTasks++
            }
            result.Results = append(result.Results, exportResult)
            mu.Unlock()
        }(taskID)
    }
    
    wg.Wait()
    result.EndTime = time.Now()
    result.Duration = result.EndTime.Sub(result.StartTime)
    
    return result, nil
}

// 批量导出结果
type BatchExportResult struct {
    TotalTasks   int             // 总任务数
    SuccessTasks int             // 成功任务数
    FailedTasks  int             // 失败任务数
    StartTime    time.Time       // 开始时间
    EndTime      time.Time       // 结束时间
    Duration     time.Duration   // 总耗时
    Results      []*ExportResult // 导出结果列表
}

// 导出历史查询
func (em *ExportManager) GetExportHistory(taskID string, limit int) ([]*ExportResult, error) {
    log.Infof("查询导出历史: task=%s, limit=%d", taskID, limit)
    
    // 从存储中查询历史记录（实现略）
    history, err := em.queryExportHistory(taskID, limit)
    if err != nil {
        return nil, fmt.Errorf("查询历史失败: %w", err)
    }
    
    return history, nil
}

// 导出统计
func (em *ExportManager) GetExportStats(taskID string, period string) (*ExportStats, error) {
    log.Infof("获取导出统计: task=%s, period=%s", taskID, period)
    
    // 查询统计数据（实现略）
    stats := &ExportStats{
        TaskID:       taskID,
        Period:       period,
        TotalExports: 0,
        TotalRecords: 0,
        TotalSize:    0,
        AvgDuration:  0,
        SuccessRate:  0,
    }
    
    return stats, nil
}

// 导出统计
type ExportStats struct {
    TaskID       string        // 任务ID
    Period       string        // 统计周期
    TotalExports int64         // 总导出次数
    TotalRecords int64         // 总记录数
    TotalSize    int64         // 总文件大小
    AvgDuration  time.Duration // 平均耗时
    SuccessRate  float64       // 成功率
}

// 发送导出告警
func (em *ExportManager) sendExportAlert(task *ExportTask, err error) {
    alert := &Alert{
        Level:   "error",
        Title:   fmt.Sprintf("导出任务失败: %s", task.Name),
        Message: fmt.Sprintf("任务 %s 导出失败: %v", task.Name, err),
        Fields: map[string]interface{}{
            "task_id": task.ID,
            "format":  task.Format,
            "storage": task.Storage.Type,
            "error":   err.Error(),
        },
        Timestamp: time.Now(),
    }
    
    em.alertManager.Send(context.Background(), alert)
}
```

**关键实现点**:

1. 支持3种大数据标准格式：Parquet（列式存储）、ORC（优化行列式）、Avro（序列化框架）
2. 支持多种云存储：AWS S3、Azure Blob Storage、Google Cloud Storage
3. 实现灵活的分区策略：按时间（年/月/日/小时）、按来源、按类型分区
4. 支持增量导出，基于断点续传机制，避免重复处理数据
5. 实现Schema管理和演进，支持Schema版本控制和兼容性验证
6. 提供完整的数据验证：记录数校验、Schema校验、文件存在性校验
7. 支持任务调度（Cron表达式）和批量导出，提高导出效率

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| export_enabled | bool | true | 是否启用导出 |
| tasks | array | [] | 导出任务列表 |
| default_format | string | "parquet" | 默认导出格式 |
| default_storage | string | "s3" | 默认存储类型 |
| incremental_mode | bool | true | 是否增量导出 |
| validation_enabled | bool | true | 是否启用验证 |
| retry_attempts | int | 3 | 重试次数 |
| checkpoint_enabled | bool | true | 是否启用断点续传 |
| max_concurrency | int | 5 | 最大并发数 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + PostgreSQL
- 生效时间: 立即生效（下次导出任务生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志并发送告警

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的导出任务配置
2. WHEN 导出格式变更时，THE System SHALL 在下次导出时使用新格式
3. THE System SHALL 支持通过 API 查询当前生效的导出配置
4. THE System SHALL 记录所有导出配置变更的审计日志
5. WHEN 存储配置变更时，THE System SHALL 验证存储凭证的有效性

---

#### 需求 16-67: 日志脱敏审计 [Phase 3]

**用户故事**:

作为合规官，我希望能够审计日志数据的脱敏处理情况，以便确保敏感数据得到适当保护。

**验收标准**:

1. THE System SHALL 记录所有脱敏操作的详细日志，包括脱敏时间、规则ID、数据范围、操作人、脱敏前后样本
2. THE Dashboard SHALL 提供脱敏审计报告，展示脱敏覆盖率（目标 >= 95%）和遗漏风险评估
3. THE System SHALL 支持脱敏效果的抽样验证，每日自动抽取 1% 的日志进行验证
4. WHEN 检测到未脱敏的敏感数据时，THE System SHALL 在 5 分钟内发送告警并自动触发补救措施
5. THE Dashboard SHALL 展示各类敏感数据的脱敏统计，包括IP地址、邮箱、手机号、身份证号、信用卡号的脱敏数量和比例
6. THE System SHALL 支持脱敏审计报告的定期生成（每日/每周/每月）和自动发送给合规团队
7. THE System SHALL 提供脱敏规则的有效性分析，识别低效或失效的脱敏规则
8. THE System SHALL 记录脱敏规则的变更历史，包括变更时间、变更内容、变更原因、审批人
9. THE System SHALL 支持脱敏审计数据的长期保留（至少 3 年），满足合规要求
10. THE System SHALL 通过配置中心管理脱敏审计配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/masking/auditor.go
package masking

import (
    "context"
    "time"
    "crypto/sha256"
)

// 脱敏审计器
type MaskingAuditor struct {
    config         atomic.Value          // 配置（支持热更新）
    detector       *SensitiveDetector    // 敏感数据检测器
    validator      *MaskingValidator     // 脱敏验证器
    analyzer       *EffectivenessAnalyzer // 有效性分析器
    reporter       *AuditReporter        // 审计报告器
    storage        *AuditStorage         // 审计存储
    alertManager   *AlertManager         // 告警管理器
    remediator     *AutoRemediator       // 自动补救器
    auditLogger    *AuditLogger          // 审计日志记录器
}

// 审计配置
type AuditConfig struct {
    Enabled            bool              // 是否启用审计
    SamplingRate       float64           // 抽样率（0-1）
    CoverageThreshold  float64           // 覆盖率阈值
    RetentionYears     int               // 保留年限
    ReportSchedule     string            // 报告生成计划
    AutoRemediation    bool              // 是否自动补救
    SensitiveTypes     []SensitiveType   // 敏感数据类型
    AlertRecipients    []string          // 告警接收人
}

// 敏感数据类型
type SensitiveType struct {
    Type        string   // 类型：ip/email/phone/id_card/credit_card/password
    Pattern     string   // 匹配模式（正则表达式）
    MaskingRule string   // 脱敏规则
    Priority    int      // 优先级
    Enabled     bool     // 是否启用
}

// 脱敏审计记录
type MaskingAuditRecord struct {
    ID              string                 // 记录ID
    Timestamp       time.Time              // 时间戳
    RuleID          string                 // 规则ID
    RuleName        string                 // 规则名称
    DataType        string                 // 数据类型
    DataRange       string                 // 数据范围
    Operator        string                 // 操作人
    OriginalSample  string                 // 原始样本（哈希）
    MaskedSample    string                 // 脱敏样本
    Success         bool                   // 是否成功
    Error           string                 // 错误信息
    Metadata        map[string]interface{} // 元数据
}

// 脱敏统计
type MaskingStatistics struct {
    Period          string             // 统计周期
    TotalRecords    int64              // 总记录数
    MaskedRecords   int64              // 已脱敏记录数
    UnmaskedRecords int64              // 未脱敏记录数
    CoverageRate    float64            // 覆盖率（%）
    TypeStats       map[string]*TypeStat // 各类型统计
    RuleStats       map[string]*RuleStat // 各规则统计
}

// 类型统计
type TypeStat struct {
    Type          string  // 类型
    TotalCount    int64   // 总数
    MaskedCount   int64   // 已脱敏数
    UnmaskedCount int64   // 未脱敏数
    CoverageRate  float64 // 覆盖率
}

// 规则统计
type RuleStat struct {
    RuleID        string  // 规则ID
    RuleName      string  // 规则名称
    AppliedCount  int64   // 应用次数
    SuccessCount  int64   // 成功次数
    FailureCount  int64   // 失败次数
    SuccessRate   float64 // 成功率
    AvgDuration   time.Duration // 平均耗时
}

// 创建脱敏审计器
func NewMaskingAuditor(config *AuditConfig) (*MaskingAuditor, error) {
    ma := &MaskingAuditor{}
    ma.config.Store(config)
    
    // 初始化敏感数据检测器
    ma.detector = NewSensitiveDetector(config.SensitiveTypes)
    
    // 初始化脱敏验证器
    ma.validator = NewMaskingValidator()
    
    // 初始化有效性分析器
    ma.analyzer = NewEffectivenessAnalyzer()
    
    // 初始化审计报告器
    ma.reporter = NewAuditReporter()
    
    // 初始化审计存储
    ma.storage = NewAuditStorage(config.RetentionYears)
    
    // 初始化告警管理器
    ma.alertManager = NewAlertManager()
    
    // 初始化自动补救器
    if config.AutoRemediation {
        ma.remediator = NewAutoRemediator()
    }
    
    // 初始化审计日志记录器
    ma.auditLogger = NewAuditLogger()
    
    return ma, nil
}

// 审计脱敏操作
func (ma *MaskingAuditor) AuditMasking(ctx context.Context, original, masked *LogEntry, ruleID string) error {
    log.Infof("审计脱敏操作: rule=%s", ruleID)
    
    // 1. 创建审计记录
    record := &MaskingAuditRecord{
        ID:             generateAuditID(),
        Timestamp:      time.Now(),
        RuleID:         ruleID,
        DataRange:      fmt.Sprintf("log:%s", original.ID),
        OriginalSample: ma.hashSample(original.Message),
        MaskedSample:   masked.Message,
        Success:        true,
    }
    
    // 2. 检测敏感数据类型
    sensitiveTypes := ma.detector.Detect(original.Message)
    if len(sensitiveTypes) > 0 {
        record.DataType = strings.Join(sensitiveTypes, ",")
    }
    
    // 3. 验证脱敏效果
    if err := ma.validator.Validate(original, masked); err != nil {
        record.Success = false
        record.Error = err.Error()
        log.Warnf("脱敏验证失败: %v", err)
    }
    
    // 4. 保存审计记录
    if err := ma.storage.Save(record); err != nil {
        return fmt.Errorf("保存审计记录失败: %w", err)
    }
    
    // 5. 记录审计日志
    ma.auditLogger.LogMaskingAudit(record)
    
    return nil
}

// 抽样验证
func (ma *MaskingAuditor) SampleValidation(ctx context.Context) (*ValidationResult, error) {
    log.Info("开始抽样验证")
    
    config := ma.config.Load().(*AuditConfig)
    
    result := &ValidationResult{
        StartTime:   time.Now(),
        SamplingRate: config.SamplingRate,
    }
    
    // 1. 获取样本数据
    samples, err := ma.getSamples(ctx, config.SamplingRate)
    if err != nil {
        return nil, fmt.Errorf("获取样本失败: %w", err)
    }
    
    result.TotalSamples = len(samples)
    
    // 2. 检测未脱敏的敏感数据
    for _, sample := range samples {
        sensitiveData := ma.detector.DetectUnmasked(sample)
        
        if len(sensitiveData) > 0 {
            result.UnmaskedSamples++
            result.UnmaskedData = append(result.UnmaskedData, &UnmaskedData{
                LogID:         sample.ID,
                SensitiveType: sensitiveData,
                Sample:        ma.hashSample(sample.Message),
            })
            
            // 触发告警
            ma.sendUnmaskedAlert(sample, sensitiveData)
            
            // 自动补救
            if config.AutoRemediation {
                ma.remediator.Remediate(ctx, sample)
            }
        } else {
            result.MaskedSamples++
        }
    }
    
    result.EndTime = time.Now()
    result.Duration = result.EndTime.Sub(result.StartTime)
    result.CoverageRate = float64(result.MaskedSamples) / float64(result.TotalSamples) * 100
    
    log.Infof("抽样验证完成: coverage=%.2f%%, unmasked=%d", 
        result.CoverageRate, result.UnmaskedSamples)
    
    return result, nil
}

// 验证结果
type ValidationResult struct {
    StartTime       time.Time       // 开始时间
    EndTime         time.Time       // 结束时间
    Duration        time.Duration   // 耗时
    SamplingRate    float64         // 抽样率
    TotalSamples    int             // 总样本数
    MaskedSamples   int             // 已脱敏样本数
    UnmaskedSamples int             // 未脱敏样本数
    CoverageRate    float64         // 覆盖率
    UnmaskedData    []*UnmaskedData // 未脱敏数据
}

// 未脱敏数据
type UnmaskedData struct {
    LogID         string   // 日志ID
    SensitiveType []string // 敏感数据类型
    Sample        string   // 样本（哈希）
}

// 敏感数据检测器
type SensitiveDetector struct {
    patterns map[string]*regexp.Regexp
}

// 检测敏感数据类型
func (sd *SensitiveDetector) Detect(text string) []string {
    var types []string
    
    for dataType, pattern := range sd.patterns {
        if pattern.MatchString(text) {
            types = append(types, dataType)
        }
    }
    
    return types
}

// 检测未脱敏的敏感数据
func (sd *SensitiveDetector) DetectUnmasked(entry *LogEntry) []string {
    var unmasked []string
    
    // 检查各种敏感数据模式
    patterns := map[string]*regexp.Regexp{
        "ip":          regexp.MustCompile(`\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b`),
        "email":       regexp.MustCompile(`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`),
        "phone":       regexp.MustCompile(`\b1[3-9]\d{9}\b`),
        "id_card":     regexp.MustCompile(`\b\d{17}[\dXx]\b`),
        "credit_card": regexp.MustCompile(`\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b`),
    }
    
    for dataType, pattern := range patterns {
        if pattern.MatchString(entry.Message) {
            // 检查是否已脱敏（包含*号）
            if !strings.Contains(entry.Message, "*") {
                unmasked = append(unmasked, dataType)
            }
        }
    }
    
    return unmasked
}

// 脱敏验证器
type MaskingValidator struct{}

// 验证脱敏效果
func (mv *MaskingValidator) Validate(original, masked *LogEntry) error {
    // 1. 验证脱敏后数据不为空
    if masked.Message == "" {
        return fmt.Errorf("脱敏后数据为空")
    }
    
    // 2. 验证脱敏后数据与原始数据不同
    if original.Message == masked.Message {
        return fmt.Errorf("脱敏后数据未改变")
    }
    
    // 3. 验证脱敏后数据包含脱敏标记（*号）
    if !strings.Contains(masked.Message, "*") {
        return fmt.Errorf("脱敏后数据缺少脱敏标记")
    }
    
    // 4. 验证敏感数据已被替换
    detector := &SensitiveDetector{}
    if len(detector.DetectUnmasked(masked)) > 0 {
        return fmt.Errorf("脱敏后仍包含敏感数据")
    }
    
    return nil
}

// 生成脱敏统计
func (ma *MaskingAuditor) GenerateStatistics(ctx context.Context, period string) (*MaskingStatistics, error) {
    log.Infof("生成脱敏统计: period=%s", period)
    
    stats := &MaskingStatistics{
        Period:    period,
        TypeStats: make(map[string]*TypeStat),
        RuleStats: make(map[string]*RuleStat),
    }
    
    // 1. 查询审计记录
    records, err := ma.storage.QueryByPeriod(period)
    if err != nil {
        return nil, fmt.Errorf("查询审计记录失败: %w", err)
    }
    
    stats.TotalRecords = int64(len(records))
    
    // 2. 统计各类型数据
    for _, record := range records {
        if record.Success {
            stats.MaskedRecords++
        } else {
            stats.UnmaskedRecords++
        }
        
        // 统计数据类型
        if record.DataType != "" {
            types := strings.Split(record.DataType, ",")
            for _, dataType := range types {
                if _, exists := stats.TypeStats[dataType]; !exists {
                    stats.TypeStats[dataType] = &TypeStat{Type: dataType}
                }
                
                typeStat := stats.TypeStats[dataType]
                typeStat.TotalCount++
                if record.Success {
                    typeStat.MaskedCount++
                } else {
                    typeStat.UnmaskedCount++
                }
            }
        }
        
        // 统计规则
        if _, exists := stats.RuleStats[record.RuleID]; !exists {
            stats.RuleStats[record.RuleID] = &RuleStat{
                RuleID:   record.RuleID,
                RuleName: record.RuleName,
            }
        }
        
        ruleStat := stats.RuleStats[record.RuleID]
        ruleStat.AppliedCount++
        if record.Success {
            ruleStat.SuccessCount++
        } else {
            ruleStat.FailureCount++
        }
    }
    
    // 3. 计算覆盖率
    if stats.TotalRecords > 0 {
        stats.CoverageRate = float64(stats.MaskedRecords) / float64(stats.TotalRecords) * 100
    }
    
    // 4. 计算各类型覆盖率
    for _, typeStat := range stats.TypeStats {
        if typeStat.TotalCount > 0 {
            typeStat.CoverageRate = float64(typeStat.MaskedCount) / float64(typeStat.TotalCount) * 100
        }
    }
    
    // 5. 计算各规则成功率
    for _, ruleStat := range stats.RuleStats {
        if ruleStat.AppliedCount > 0 {
            ruleStat.SuccessRate = float64(ruleStat.SuccessCount) / float64(ruleStat.AppliedCount) * 100
        }
    }
    
    return stats, nil
}

// 生成审计报告
func (ma *MaskingAuditor) GenerateAuditReport(ctx context.Context, period string) (*AuditReport, error) {
    log.Infof("生成审计报告: period=%s", period)
    
    report := &AuditReport{
        Period:      period,
        GeneratedAt: time.Now(),
    }
    
    // 1. 生成统计数据
    stats, err := ma.GenerateStatistics(ctx, period)
    if err != nil {
        return nil, fmt.Errorf("生成统计失败: %w", err)
    }
    report.Statistics = stats
    
    // 2. 分析规则有效性
    effectiveness := ma.analyzer.AnalyzeEffectiveness(stats)
    report.Effectiveness = effectiveness
    
    // 3. 识别风险
    risks := ma.identifyRisks(stats)
    report.Risks = risks
    
    // 4. 生成建议
    recommendations := ma.generateRecommendations(stats, effectiveness)
    report.Recommendations = recommendations
    
    return report, nil
}

// 审计报告
type AuditReport struct {
    Period          string                  // 报告周期
    GeneratedAt     time.Time               // 生成时间
    Statistics      *MaskingStatistics      // 统计数据
    Effectiveness   *EffectivenessAnalysis  // 有效性分析
    Risks           []*Risk                 // 风险列表
    Recommendations []string                // 建议列表
}

// 有效性分析
type EffectivenessAnalysis struct {
    OverallScore    float64                    // 总体评分（0-100）
    EffectiveRules  []*RuleStat                // 有效规则
    IneffectiveRules []*RuleStat               // 低效规则
    FailedRules     []*RuleStat                // 失效规则
}

// 风险
type Risk struct {
    Level       string // 风险级别：critical/high/medium/low
    Type        string // 风险类型
    Description string // 风险描述
    Impact      string // 影响范围
    Mitigation  string // 缓解措施
}

// 有效性分析器
type EffectivenessAnalyzer struct{}

// 分析规则有效性
func (ea *EffectivenessAnalyzer) AnalyzeEffectiveness(stats *MaskingStatistics) *EffectivenessAnalysis {
    analysis := &EffectivenessAnalysis{
        EffectiveRules:   make([]*RuleStat, 0),
        IneffectiveRules: make([]*RuleStat, 0),
        FailedRules:      make([]*RuleStat, 0),
    }
    
    // 分类规则
    for _, ruleStat := range stats.RuleStats {
        if ruleStat.SuccessRate >= 95 {
            analysis.EffectiveRules = append(analysis.EffectiveRules, ruleStat)
        } else if ruleStat.SuccessRate >= 80 {
            analysis.IneffectiveRules = append(analysis.IneffectiveRules, ruleStat)
        } else {
            analysis.FailedRules = append(analysis.FailedRules, ruleStat)
        }
    }
    
    // 计算总体评分
    if len(stats.RuleStats) > 0 {
        effectiveCount := len(analysis.EffectiveRules)
        analysis.OverallScore = float64(effectiveCount) / float64(len(stats.RuleStats)) * 100
    }
    
    return analysis
}

// 识别风险
func (ma *MaskingAuditor) identifyRisks(stats *MaskingStatistics) []*Risk {
    var risks []*Risk
    
    config := ma.config.Load().(*AuditConfig)
    
    // 1. 覆盖率风险
    if stats.CoverageRate < config.CoverageThreshold {
        risks = append(risks, &Risk{
            Level:       "critical",
            Type:        "low_coverage",
            Description: fmt.Sprintf("脱敏覆盖率%.2f%%低于阈值%.2f%%", 
                stats.CoverageRate, config.CoverageThreshold),
            Impact:      "敏感数据可能泄露",
            Mitigation:  "检查脱敏规则配置，增加规则覆盖范围",
        })
    }
    
    // 2. 未脱敏数据风险
    if stats.UnmaskedRecords > 0 {
        risks = append(risks, &Risk{
            Level:       "high",
            Type:        "unmasked_data",
            Description: fmt.Sprintf("发现%d条未脱敏记录", stats.UnmaskedRecords),
            Impact:      "敏感数据暴露",
            Mitigation:  "立即应用脱敏规则，启用自动补救",
        })
    }
    
    // 3. 规则失效风险
    for _, ruleStat := range stats.RuleStats {
        if ruleStat.SuccessRate < 80 {
            risks = append(risks, &Risk{
                Level:       "medium",
                Type:        "rule_failure",
                Description: fmt.Sprintf("规则%s成功率%.2f%%过低", 
                    ruleStat.RuleName, ruleStat.SuccessRate),
                Impact:      "部分敏感数据未被正确脱敏",
                Mitigation:  "检查规则配置，优化匹配模式",
            })
        }
    }
    
    return risks
}

// 生成建议
func (ma *MaskingAuditor) generateRecommendations(stats *MaskingStatistics, effectiveness *EffectivenessAnalysis) []string {
    var recommendations []string
    
    // 基于覆盖率的建议
    if stats.CoverageRate < 95 {
        recommendations = append(recommendations, 
            "建议提高脱敏覆盖率至95%以上，增加脱敏规则或优化现有规则")
    }
    
    // 基于规则有效性的建议
    if len(effectiveness.IneffectiveRules) > 0 {
        recommendations = append(recommendations, 
            fmt.Sprintf("发现%d个低效规则，建议优化这些规则的匹配模式", 
                len(effectiveness.IneffectiveRules)))
    }
    
    if len(effectiveness.FailedRules) > 0 {
        recommendations = append(recommendations, 
            fmt.Sprintf("发现%d个失效规则，建议禁用或重新设计这些规则", 
                len(effectiveness.FailedRules)))
    }
    
    // 基于数据类型的建议
    for dataType, typeStat := range stats.TypeStats {
        if typeStat.CoverageRate < 90 {
            recommendations = append(recommendations, 
                fmt.Sprintf("%s类型数据覆盖率%.2f%%较低，建议增加针对性规则", 
                    dataType, typeStat.CoverageRate))
        }
    }
    
    return recommendations
}

// 自动补救器
type AutoRemediator struct{}

// 补救未脱敏数据
func (ar *AutoRemediator) Remediate(ctx context.Context, entry *LogEntry) error {
    log.Infof("自动补救: log=%s", entry.ID)
    
    // 应用脱敏规则（实现略）
    // 这里应该重新应用脱敏规则到未脱敏的数据
    
    return nil
}

// 发送未脱敏告警
func (ma *MaskingAuditor) sendUnmaskedAlert(entry *LogEntry, sensitiveTypes []string) {
    alert := &Alert{
        Level:   "critical",
        Title:   "发现未脱敏的敏感数据",
        Message: fmt.Sprintf("日志 %s 包含未脱敏的敏感数据: %s", 
            entry.ID, strings.Join(sensitiveTypes, ", ")),
        Fields: map[string]interface{}{
            "log_id":          entry.ID,
            "sensitive_types": sensitiveTypes,
            "source":          entry.Source,
        },
        Timestamp: time.Now(),
    }
    
    ma.alertManager.Send(context.Background(), alert)
}

// 哈希样本（保护隐私）
func (ma *MaskingAuditor) hashSample(text string) string {
    hash := sha256.Sum256([]byte(text))
    return fmt.Sprintf("%x", hash[:8]) // 只保留前8字节
}
```

**关键实现点**:

1. 记录详细的脱敏审计日志，包括脱敏前后样本（哈希保护）、规则ID、操作人
2. 实现抽样验证机制，每日自动抽取1%的日志进行脱敏效果验证
3. 自动检测未脱敏的敏感数据（IP、邮箱、手机号、身份证号、信用卡号）
4. 提供脱敏统计分析，展示各类型数据的脱敏覆盖率和规则有效性
5. 实现自动补救机制，检测到未脱敏数据时自动触发补救措施
6. 生成全面的审计报告，包括统计数据、有效性分析、风险识别、改进建议
7. 支持审计数据长期保留（3年），满足合规要求

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| audit_enabled | bool | true | 是否启用审计 |
| sampling_rate | float | 0.01 | 抽样率（1%） |
| coverage_threshold | float | 95.0 | 覆盖率阈值（%） |
| retention_years | int | 3 | 保留年限 |
| report_schedule | string | "0 0 * * *" | 报告生成计划（Cron） |
| auto_remediation | bool | true | 是否自动补救 |
| sensitive_types | array | [] | 敏感数据类型列表 |
| alert_recipients | array | [] | 告警接收人列表 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + PostgreSQL
- 生效时间: 立即生效（下次审计生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志并发送告警

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的审计配置
2. WHEN 抽样率变更时，THE System SHALL 在下次抽样验证时使用新比例
3. THE System SHALL 支持通过 API 查询当前生效的审计配置
4. THE System SHALL 记录所有审计配置变更的审计日志
5. WHEN 敏感数据类型变更时，THE System SHALL 验证正则表达式的有效性

---

#### 需求 16-68: 日志异常自动修复 [Phase 3]

**用户故事**:

作为运维工程师，我希望系统能够自动修复常见的日志异常，以便减少人工干预和故障恢复时间。

**验收标准**:

1. THE System SHALL 支持定义自动修复规则，针对至少 5 种常见日志异常（采集中断、存储满、解析失败、连接超时、权限错误）自动执行修复操作
2. WHEN 检测到可自动修复的异常时，THE System SHALL 在配置的时间内（默认 5 分钟）自动执行修复
3. THE Dashboard SHALL 提供自动修复规则的配置界面，支持创建、编辑、测试和禁用规则
4. THE System SHALL 支持修复操作的审批流程，关键操作（如重启服务、删除数据）需要人工确认
5. THE Dashboard SHALL 展示自动修复的执行历史和成功率统计（目标成功率 >= 85%）
6. THE System SHALL 支持修复操作的回滚机制，修复失败时自动回滚到修复前状态
7. THE System SHALL 提供修复操作的模拟测试，允许在测试环境验证修复效果
8. THE System SHALL 记录所有修复操作的详细日志，包括触发原因、执行步骤、执行结果、耗时
9. WHEN 自动修复失败时，THE System SHALL 在 3 分钟内发送告警并提供人工介入入口
10. THE System SHALL 通过配置中心管理自动修复配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/autofix/manager.go
package autofix

import (
    "context"
    "time"
)

// 自动修复管理器
type AutoFixManager struct {
    config        atomic.Value         // 配置（支持热更新）
    detector      *AnomalyDetector     // 异常检测器
    ruleEngine    *FixRuleEngine       // 修复规则引擎
    executor      *FixExecutor         // 修复执行器
    approvalMgr   *ApprovalManager     // 审批管理器
    rollbackMgr   *RollbackManager     // 回滚管理器
    simulator     *FixSimulator        // 修复模拟器
    metrics       *FixMetrics          // 修复指标
    alertManager  *AlertManager        // 告警管理器
    auditLogger   *AuditLogger         // 审计日志记录器
}

// 自动修复配置
type AutoFixConfig struct {
    Enabled           bool                // 是否启用自动修复
    FixTimeout        time.Duration       // 修复超时时间
    RequireApproval   bool                // 是否需要审批
    ApprovalTimeout   time.Duration       // 审批超时时间
    EnableRollback    bool                // 是否启用回滚
    EnableSimulation  bool                // 是否启用模拟测试
    Rules             []*FixRule          // 修复规则列表
    AlertRecipients   []string            // 告警接收人
}

// 修复规则
type FixRule struct {
    ID              string              // 规则ID
    Name            string              // 规则名称
    AnomalyType     string              // 异常类型
    Condition       string              // 触发条件（表达式）
    Actions         []*FixAction        // 修复动作列表
    Priority        int                 // 优先级（1-10）
    RequireApproval bool                // 是否需要审批
    Enabled         bool                // 是否启用
    Metadata        map[string]interface{} // 元数据
}

// 修复动作
type FixAction struct {
    Type        string                 // 动作类型：restart/cleanup/repair/notify
    Target      string                 // 目标对象
    Parameters  map[string]interface{} // 动作参数
    Timeout     time.Duration          // 超时时间
    Retries     int                    // 重试次数
}

// 异常类型
const (
    AnomalyCollectionInterrupted = "collection_interrupted" // 采集中断
    AnomalyStorageFull           = "storage_full"           // 存储满
    AnomalyParseFailed           = "parse_failed"           // 解析失败
    AnomalyConnectionTimeout     = "connection_timeout"     // 连接超时
    AnomalyPermissionDenied      = "permission_denied"      // 权限错误
)

// 创建自动修复管理器
func NewAutoFixManager(config *AutoFixConfig) (*AutoFixManager, error) {
    afm := &AutoFixManager{}
    afm.config.Store(config)
    
    // 初始化异常检测器
    afm.detector = NewAnomalyDetector()
    
    // 初始化修复规则引擎
    afm.ruleEngine = NewFixRuleEngine(config.Rules)
    
    // 初始化修复执行器
    afm.executor = NewFixExecutor()
    
    // 初始化审批管理器
    if config.RequireApproval {
        afm.approvalMgr = NewApprovalManager(config.ApprovalTimeout)
    }
    
    // 初始化回滚管理器
    if config.EnableRollback {
        afm.rollbackMgr = NewRollbackManager()
    }
    
    // 初始化模拟器
    if config.EnableSimulation {
        afm.simulator = NewFixSimulator()
    }
    
    // 初始化指标收集器
    afm.metrics = NewFixMetrics()
    
    // 初始化告警管理器
    afm.alertManager = NewAlertManager()
    
    // 初始化审计日志记录器
    afm.auditLogger = NewAuditLogger()
    
    return afm, nil
}

// 处理异常
func (afm *AutoFixManager) HandleAnomaly(ctx context.Context, anomaly *Anomaly) error {
    log.Infof("处理异常: type=%s, severity=%s", anomaly.Type, anomaly.Severity)
    
    startTime := time.Now()
    
    // 1. 匹配修复规则
    rule := afm.ruleEngine.Match(anomaly)
    if rule == nil {
        log.Warnf("未找到匹配的修复规则: type=%s", anomaly.Type)
        return fmt.Errorf("未找到匹配的修复规则")
    }
    
    log.Infof("匹配到修复规则: rule=%s", rule.Name)

    
    // 2. 创建修复任务
    task := &FixTask{
        ID:          generateTaskID(),
        AnomalyID:   anomaly.ID,
        RuleID:      rule.ID,
        RuleName:    rule.Name,
        Status:      TaskStatusPending,
        CreatedAt:   time.Now(),
        Actions:     rule.Actions,
    }
    
    // 3. 审批流程（如果需要）
    if rule.RequireApproval {
        log.Info("等待审批...")
        
        approved, err := afm.approvalMgr.RequestApproval(ctx, task)
        if err != nil {
            return fmt.Errorf("审批请求失败: %w", err)
        }
        
        if !approved {
            log.Warn("修复任务被拒绝")
            task.Status = TaskStatusRejected
            afm.auditLogger.LogFixTask(task)
            return fmt.Errorf("修复任务被拒绝")
        }
        
        log.Info("修复任务已批准")
    }
    
    // 4. 创建回滚点（如果启用）
    var rollbackPoint *RollbackPoint
    if afm.rollbackMgr != nil {
        rollbackPoint, err := afm.rollbackMgr.CreateRollbackPoint(ctx, task)
        if err != nil {
            log.Errorf("创建回滚点失败: %v", err)
        }
    }
    
    // 5. 执行修复
    task.Status = TaskStatusRunning
    task.StartedAt = time.Now()
    
    result, err := afm.executor.Execute(ctx, task)
    
    task.EndedAt = time.Now()
    task.Duration = task.EndedAt.Sub(task.StartedAt)
    
    if err != nil {
        log.Errorf("修复执行失败: %v", err)
        task.Status = TaskStatusFailed
        task.Error = err.Error()
        
        // 回滚（如果启用）
        if afm.rollbackMgr != nil && rollbackPoint != nil {
            log.Info("开始回滚...")
            if rollbackErr := afm.rollbackMgr.Rollback(ctx, rollbackPoint); rollbackErr != nil {
                log.Errorf("回滚失败: %v", rollbackErr)
                task.RollbackError = rollbackErr.Error()
            } else {
                log.Info("回滚成功")
                task.RolledBack = true
            }
        }
        
        // 发送告警
        afm.sendFailureAlert(task, err)
        
        // 记录指标
        afm.metrics.RecordFailure(rule.AnomalyType, task.Duration)
    } else {
        log.Info("修复执行成功")
        task.Status = TaskStatusSuccess
        task.Result = result
        
        // 记录指标
        afm.metrics.RecordSuccess(rule.AnomalyType, task.Duration)
    }
    
    // 6. 记录审计日志
    afm.auditLogger.LogFixTask(task)
    
    log.Infof("异常处理完成: duration=%v, status=%s", 
        time.Since(startTime), task.Status)
    
    return err
}

// 异常
type Anomaly struct {
    ID          string                 // 异常ID
    Type        string                 // 异常类型
    Severity    string                 // 严重程度：critical/high/medium/low
    Source      string                 // 异常来源
    Message     string                 // 异常消息
    Timestamp   time.Time              // 时间戳
    Metadata    map[string]interface{} // 元数据
}

// 修复任务
type FixTask struct {
    ID            string        // 任务ID
    AnomalyID     string        // 异常ID
    RuleID        string        // 规则ID
    RuleName      string        // 规则名称
    Status        string        // 状态
    Actions       []*FixAction  // 动作列表
    CreatedAt     time.Time     // 创建时间
    StartedAt     time.Time     // 开始时间
    EndedAt       time.Time     // 结束时间
    Duration      time.Duration // 耗时
    Result        interface{}   // 执行结果
    Error         string        // 错误信息
    RolledBack    bool          // 是否已回滚
    RollbackError string        // 回滚错误
}

// 任务状态
const (
    TaskStatusPending  = "pending"  // 待处理
    TaskStatusRunning  = "running"  // 执行中
    TaskStatusSuccess  = "success"  // 成功
    TaskStatusFailed   = "failed"   // 失败
    TaskStatusRejected = "rejected" // 已拒绝
)

// 异常检测器
type AnomalyDetector struct {
    patterns map[string]*AnomalyPattern
}

// 异常模式
type AnomalyPattern struct {
    Type        string   // 异常类型
    Indicators  []string // 指标列表
    Threshold   float64  // 阈值
}

// 检测异常
func (ad *AnomalyDetector) Detect(ctx context.Context) ([]*Anomaly, error) {
    var anomalies []*Anomaly
    
    // 检测采集中断
    if interrupted := ad.detectCollectionInterrupted(); interrupted != nil {
        anomalies = append(anomalies, interrupted)
    }
    
    // 检测存储满
    if storageFull := ad.detectStorageFull(); storageFull != nil {
        anomalies = append(anomalies, storageFull)
    }
    
    // 检测解析失败
    if parseFailed := ad.detectParseFailed(); parseFailed != nil {
        anomalies = append(anomalies, parseFailed)
    }
    
    // 检测连接超时
    if timeout := ad.detectConnectionTimeout(); timeout != nil {
        anomalies = append(anomalies, timeout)
    }
    
    // 检测权限错误
    if permissionDenied := ad.detectPermissionDenied(); permissionDenied != nil {
        anomalies = append(anomalies, permissionDenied)
    }
    
    return anomalies, nil
}


// 修复规则引擎
type FixRuleEngine struct {
    rules []*FixRule
}

// 匹配规则
func (fre *FixRuleEngine) Match(anomaly *Anomaly) *FixRule {
    // 按优先级排序
    sort.Slice(fre.rules, func(i, j int) bool {
        return fre.rules[i].Priority > fre.rules[j].Priority
    })
    
    // 查找匹配的规则
    for _, rule := range fre.rules {
        if !rule.Enabled {
            continue
        }
        
        if rule.AnomalyType == anomaly.Type {
            // 评估条件表达式
            if fre.evaluateCondition(rule.Condition, anomaly) {
                return rule
            }
        }
    }
    
    return nil
}

// 评估条件
func (fre *FixRuleEngine) evaluateCondition(condition string, anomaly *Anomaly) bool {
    // 简化实现：支持基本的条件表达式
    // 实际应使用表达式引擎（如 govaluate）
    
    if condition == "" {
        return true // 无条件，总是匹配
    }
    
    // 示例：severity == "critical"
    // 实际实现应解析和评估表达式
    return true
}

// 修复执行器
type FixExecutor struct {
    handlers map[string]ActionHandler
}

// 动作处理器
type ActionHandler interface {
    Execute(ctx context.Context, action *FixAction) (interface{}, error)
}

// 执行修复
func (fe *FixExecutor) Execute(ctx context.Context, task *FixTask) (interface{}, error) {
    log.Infof("执行修复任务: task=%s, actions=%d", task.ID, len(task.Actions))
    
    results := make([]interface{}, 0, len(task.Actions))
    
    // 顺序执行所有动作
    for i, action := range task.Actions {
        log.Infof("执行动作 %d/%d: type=%s, target=%s", 
            i+1, len(task.Actions), action.Type, action.Target)
        
        // 获取处理器
        handler, exists := fe.handlers[action.Type]
        if !exists {
            return nil, fmt.Errorf("未知的动作类型: %s", action.Type)
        }
        
        // 执行动作（带超时和重试）
        result, err := fe.executeWithRetry(ctx, handler, action)
        if err != nil {
            return nil, fmt.Errorf("动作执行失败: %w", err)
        }
        
        results = append(results, result)
        log.Infof("动作执行成功: result=%v", result)
    }
    
    return results, nil
}

// 带重试的执行
func (fe *FixExecutor) executeWithRetry(ctx context.Context, handler ActionHandler, action *FixAction) (interface{}, error) {
    var lastErr error
    
    for attempt := 0; attempt <= action.Retries; attempt++ {
        if attempt > 0 {
            log.Infof("重试 %d/%d", attempt, action.Retries)
            time.Sleep(time.Second * time.Duration(attempt)) // 指数退避
        }
        
        // 创建带超时的上下文
        execCtx, cancel := context.WithTimeout(ctx, action.Timeout)
        defer cancel()
        
        result, err := handler.Execute(execCtx, action)
        if err == nil {
            return result, nil
        }
        
        lastErr = err
        log.Warnf("动作执行失败: %v", err)
    }
    
    return nil, fmt.Errorf("重试%d次后仍失败: %w", action.Retries, lastErr)
}

// 重启动作处理器
type RestartActionHandler struct{}

func (h *RestartActionHandler) Execute(ctx context.Context, action *FixAction) (interface{}, error) {
    target := action.Parameters["service"].(string)
    log.Infof("重启服务: %s", target)
    
    // 实际实现应调用系统命令或API重启服务
    // 示例：systemctl restart log-collector
    
    return map[string]interface{}{
        "service": target,
        "status":  "restarted",
    }, nil
}

// 清理动作处理器
type CleanupActionHandler struct{}

func (h *CleanupActionHandler) Execute(ctx context.Context, action *FixAction) (interface{}, error) {
    target := action.Parameters["path"].(string)
    threshold := action.Parameters["threshold"].(float64)
    
    log.Infof("清理存储: path=%s, threshold=%.2f%%", target, threshold)
    
    // 实际实现应清理旧日志或临时文件
    // 示例：删除7天前的日志
    
    return map[string]interface{}{
        "path":    target,
        "cleaned": "1.5GB",
    }, nil
}

// 审批管理器
type ApprovalManager struct {
    timeout time.Duration
    pending map[string]*ApprovalRequest
    mu      sync.RWMutex
}

// 审批请求
type ApprovalRequest struct {
    TaskID      string
    Task        *FixTask
    RequestedAt time.Time
    ApprovedAt  time.Time
    Approved    bool
    Approver    string
    Comment     string
}

// 请求审批
func (am *ApprovalManager) RequestApproval(ctx context.Context, task *FixTask) (bool, error) {
    request := &ApprovalRequest{
        TaskID:      task.ID,
        Task:        task,
        RequestedAt: time.Now(),
    }
    
    am.mu.Lock()
    am.pending[task.ID] = request
    am.mu.Unlock()
    
    // 发送审批通知
    am.sendApprovalNotification(request)
    
    // 等待审批或超时
    ticker := time.NewTicker(time.Second)
    defer ticker.Stop()
    
    deadline := time.Now().Add(am.timeout)
    
    for {
        select {
        case <-ctx.Done():
            return false, ctx.Err()
        case <-ticker.C:
            am.mu.RLock()
            req := am.pending[task.ID]
            am.mu.RUnlock()
            
            if req.Approved {
                return true, nil
            }
            
            if time.Now().After(deadline) {
                return false, fmt.Errorf("审批超时")
            }
        }
    }
}

// 批准
func (am *ApprovalManager) Approve(taskID, approver, comment string) error {
    am.mu.Lock()
    defer am.mu.Unlock()
    
    request, exists := am.pending[taskID]
    if !exists {
        return fmt.Errorf("审批请求不存在")
    }
    
    request.Approved = true
    request.ApprovedAt = time.Now()
    request.Approver = approver
    request.Comment = comment
    
    return nil
}


// 回滚管理器
type RollbackManager struct {
    points map[string]*RollbackPoint
    mu     sync.RWMutex
}

// 回滚点
type RollbackPoint struct {
    ID        string                 // 回滚点ID
    TaskID    string                 // 任务ID
    Timestamp time.Time              // 时间戳
    State     map[string]interface{} // 状态快照
}

// 创建回滚点
func (rm *RollbackManager) CreateRollbackPoint(ctx context.Context, task *FixTask) (*RollbackPoint, error) {
    log.Infof("创建回滚点: task=%s", task.ID)
    
    point := &RollbackPoint{
        ID:        generateRollbackID(),
        TaskID:    task.ID,
        Timestamp: time.Now(),
        State:     make(map[string]interface{}),
    }
    
    // 保存当前状态
    // 实际实现应根据动作类型保存相应的状态
    for _, action := range task.Actions {
        switch action.Type {
        case "restart":
            // 保存服务状态
            point.State["service_status"] = "running"
        case "cleanup":
            // 保存文件列表
            point.State["files"] = []string{}
        }
    }
    
    rm.mu.Lock()
    rm.points[point.ID] = point
    rm.mu.Unlock()
    
    return point, nil
}

// 回滚
func (rm *RollbackManager) Rollback(ctx context.Context, point *RollbackPoint) error {
    log.Infof("执行回滚: point=%s", point.ID)
    
    // 恢复状态
    // 实际实现应根据保存的状态执行回滚操作
    
    return nil
}

// 修复模拟器
type FixSimulator struct{}

// 模拟执行
func (fs *FixSimulator) Simulate(ctx context.Context, task *FixTask) (*SimulationResult, error) {
    log.Infof("模拟执行修复任务: task=%s", task.ID)
    
    result := &SimulationResult{
        TaskID:    task.ID,
        StartTime: time.Now(),
        Steps:     make([]*SimulationStep, 0),
    }
    
    // 模拟每个动作
    for i, action := range task.Actions {
        step := &SimulationStep{
            Index:  i + 1,
            Action: action.Type,
            Target: action.Target,
        }
        
        // 模拟执行（不实际执行）
        step.Success = true
        step.Duration = time.Millisecond * 100
        step.Output = fmt.Sprintf("模拟执行 %s 成功", action.Type)
        
        result.Steps = append(result.Steps, step)
    }
    
    result.EndTime = time.Now()
    result.TotalDuration = result.EndTime.Sub(result.StartTime)
    result.Success = true
    
    return result, nil
}

// 模拟结果
type SimulationResult struct {
    TaskID        string             // 任务ID
    StartTime     time.Time          // 开始时间
    EndTime       time.Time          // 结束时间
    TotalDuration time.Duration      // 总耗时
    Success       bool               // 是否成功
    Steps         []*SimulationStep  // 步骤列表
}

// 模拟步骤
type SimulationStep struct {
    Index    int           // 步骤序号
    Action   string        // 动作类型
    Target   string        // 目标对象
    Success  bool          // 是否成功
    Duration time.Duration // 耗时
    Output   string        // 输出信息
}

// 修复指标
type FixMetrics struct {
    totalAttempts   int64
    successCount    int64
    failureCount    int64
    totalDuration   time.Duration
    typeMetrics     map[string]*TypeMetrics
    mu              sync.RWMutex
}

// 类型指标
type TypeMetrics struct {
    Type          string
    Attempts      int64
    Successes     int64
    Failures      int64
    TotalDuration time.Duration
    AvgDuration   time.Duration
    SuccessRate   float64
}

// 记录成功
func (fm *FixMetrics) RecordSuccess(anomalyType string, duration time.Duration) {
    fm.mu.Lock()
    defer fm.mu.Unlock()
    
    fm.totalAttempts++
    fm.successCount++
    fm.totalDuration += duration
    
    if _, exists := fm.typeMetrics[anomalyType]; !exists {
        fm.typeMetrics[anomalyType] = &TypeMetrics{Type: anomalyType}
    }
    
    tm := fm.typeMetrics[anomalyType]
    tm.Attempts++
    tm.Successes++
    tm.TotalDuration += duration
    tm.AvgDuration = tm.TotalDuration / time.Duration(tm.Attempts)
    tm.SuccessRate = float64(tm.Successes) / float64(tm.Attempts) * 100
}

// 记录失败
func (fm *FixMetrics) RecordFailure(anomalyType string, duration time.Duration) {
    fm.mu.Lock()
    defer fm.mu.Unlock()
    
    fm.totalAttempts++
    fm.failureCount++
    fm.totalDuration += duration
    
    if _, exists := fm.typeMetrics[anomalyType]; !exists {
        fm.typeMetrics[anomalyType] = &TypeMetrics{Type: anomalyType}
    }
    
    tm := fm.typeMetrics[anomalyType]
    tm.Attempts++
    tm.Failures++
    tm.TotalDuration += duration
    tm.AvgDuration = tm.TotalDuration / time.Duration(tm.Attempts)
    tm.SuccessRate = float64(tm.Successes) / float64(tm.Attempts) * 100
}

// 获取统计
func (fm *FixMetrics) GetStatistics() *FixStatistics {
    fm.mu.RLock()
    defer fm.mu.RUnlock()
    
    stats := &FixStatistics{
        TotalAttempts: fm.totalAttempts,
        SuccessCount:  fm.successCount,
        FailureCount:  fm.failureCount,
        TypeMetrics:   make(map[string]*TypeMetrics),
    }
    
    if fm.totalAttempts > 0 {
        stats.SuccessRate = float64(fm.successCount) / float64(fm.totalAttempts) * 100
        stats.AvgDuration = fm.totalDuration / time.Duration(fm.totalAttempts)
    }
    
    for k, v := range fm.typeMetrics {
        stats.TypeMetrics[k] = v
    }
    
    return stats
}

// 修复统计
type FixStatistics struct {
    TotalAttempts int64                   // 总尝试次数
    SuccessCount  int64                   // 成功次数
    FailureCount  int64                   // 失败次数
    SuccessRate   float64                 // 成功率
    AvgDuration   time.Duration           // 平均耗时
    TypeMetrics   map[string]*TypeMetrics // 各类型指标
}

// 发送失败告警
func (afm *AutoFixManager) sendFailureAlert(task *FixTask, err error) {
    alert := &Alert{
        Level:   "critical",
        Title:   "自动修复失败",
        Message: fmt.Sprintf("修复任务 %s 执行失败: %v", task.RuleName, err),
        Fields: map[string]interface{}{
            "task_id":     task.ID,
            "rule_name":   task.RuleName,
            "anomaly_id":  task.AnomalyID,
            "error":       err.Error(),
            "duration":    task.Duration.String(),
            "rolled_back": task.RolledBack,
        },
        Timestamp: time.Now(),
    }
    
    config := afm.config.Load().(*AutoFixConfig)
    for _, recipient := range config.AlertRecipients {
        alert.Recipients = append(alert.Recipients, recipient)
    }
    
    afm.alertManager.Send(context.Background(), alert)
}

// 告警
type Alert struct {
    Level      string                 // 级别
    Title      string                 // 标题
    Message    string                 // 消息
    Fields     map[string]interface{} // 字段
    Recipients []string               // 接收人
    Timestamp  time.Time              // 时间戳
}
```

**关键实现点**:

1. 支持5种常见日志异常的自动检测和修复（采集中断、存储满、解析失败、连接超时、权限错误）
2. 实现灵活的修复规则引擎，支持条件表达式、优先级排序、动作链式执行
3. 提供审批流程机制，关键操作需要人工确认，支持审批超时自动拒绝
4. 实现完整的回滚机制，修复失败时自动恢复到修复前状态
5. 提供修复模拟器，允许在测试环境验证修复效果而不实际执行
6. 记录详细的审计日志和执行指标，包括成功率、平均耗时、各类型统计
7. 修复失败时自动发送告警并提供人工介入入口，确保问题及时处理

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| autofix_enabled | bool | true | 是否启用自动修复 |
| fix_timeout | duration | 5m | 修复超时时间 |
| require_approval | bool | true | 是否需要审批 |
| approval_timeout | duration | 30m | 审批超时时间 |
| enable_rollback | bool | true | 是否启用回滚 |
| enable_simulation | bool | true | 是否启用模拟测试 |
| rules | array | [] | 修复规则列表 |
| alert_recipients | array | [] | 告警接收人列表 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + PostgreSQL
- 生效时间: 立即生效（下次异常检测生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志并发送告警

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的自动修复配置
2. WHEN 修复规则变更时，THE System SHALL 验证规则的有效性（条件表达式、动作参数）
3. THE System SHALL 支持通过 API 查询当前生效的自动修复配置
4. THE System SHALL 记录所有自动修复配置变更的审计日志
5. WHEN 修复超时时间变更时，THE System SHALL 在下次修复任务中使用新的超时值

---

#### 需求 16-69: 日志成本优化 [Phase 3]

**用户故事**:

作为系统管理员，我希望系统能够自动优化日志存储和处理成本，以便在保证服务质量的前提下降低运营成本。

**验收标准**:

1. THE System SHALL 实时监控日志系统的成本指标，包括存储成本、计算成本、网络成本、许可成本，并提供成本趋势分析
2. THE Dashboard SHALL 展示成本优化建议，基于使用模式分析提供至少 5 种优化策略（存储分层、压缩优化、采样策略、保留策略、资源调整）
3. THE System SHALL 支持自动执行成本优化策略，在配置的阈值（默认成本增长 > 20%）触发时自动优化
4. THE System SHALL 提供成本预测功能，基于历史数据预测未来 30 天的成本趋势（预测准确率 >= 80%）
5. THE Dashboard SHALL 展示各组件的成本占比分析，识别成本热点（Top 10 成本消耗组件）
6. THE System SHALL 支持成本预算管理，当实际成本超过预算的 90% 时发送告警
7. THE System SHALL 提供成本优化效果评估，对比优化前后的成本节省（目标节省 >= 15%）
8. THE System SHALL 支持多维度成本分析（按时间、按组件、按项目、按环境），生成成本报告
9. THE System SHALL 记录所有成本优化操作的审计日志，包括优化策略、执行时间、节省金额
10. THE System SHALL 通过配置中心管理成本优化配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/cost/optimizer.go
package cost

import (
    "context"
    "time"
    "sync"
)

// 成本优化器
type CostOptimizer struct {
    config          atomic.Value           // 配置（支持热更新）
    monitor         *CostMonitor           // 成本监控器
    analyzer        *CostAnalyzer          // 成本分析器
    predictor       *CostPredictor         // 成本预测器
    strategyEngine  *OptimizationEngine    // 优化策略引擎
    executor        *OptimizationExecutor  // 优化执行器
    budgetManager   *BudgetManager         // 预算管理器
    evaluator       *EffectEvaluator       // 效果评估器
    reporter        *CostReporter          // 成本报告器
    alertManager    *AlertManager          // 告警管理器
    auditLogger     *AuditLogger           // 审计日志记录器
}

// 成本优化配置
type CostOptimizerConfig struct {
    Enabled              bool                    // 是否启用成本优化
    MonitorInterval      time.Duration           // 监控间隔
    AutoOptimize         bool                    // 是否自动优化
    CostThreshold        float64                 // 成本增长阈值（%）
    BudgetEnabled        bool                    // 是否启用预算管理
    MonthlyBudget        float64                 // 月度预算
    BudgetAlertThreshold float64                 // 预算告警阈值（%）
    Strategies           []*OptimizationStrategy // 优化策略列表
    AlertRecipients      []string                // 告警接收人
}

// 优化策略
type OptimizationStrategy struct {
    ID          string                 // 策略ID
    Name        string                 // 策略名称
    Type        string                 // 策略类型
    Description string                 // 策略描述
    Priority    int                    // 优先级（1-10）
    Enabled     bool                   // 是否启用
    Parameters  map[string]interface{} // 策略参数
    Conditions  string                 // 触发条件
}

// 策略类型
const (
    StrategyStorageTiering  = "storage_tiering"  // 存储分层
    StrategyCompression     = "compression"      // 压缩优化
    StrategySampling        = "sampling"         // 采样策略
    StrategyRetention       = "retention"        // 保留策略
    StrategyResourceScaling = "resource_scaling" // 资源调整
)

// 创建成本优化器
func NewCostOptimizer(config *CostOptimizerConfig) (*CostOptimizer, error) {
    co := &CostOptimizer{}
    co.config.Store(config)
    
    // 初始化成本监控器
    co.monitor = NewCostMonitor(config.MonitorInterval)
    
    // 初始化成本分析器
    co.analyzer = NewCostAnalyzer()
    
    // 初始化成本预测器
    co.predictor = NewCostPredictor()
    
    // 初始化优化策略引擎
    co.strategyEngine = NewOptimizationEngine(config.Strategies)
    
    // 初始化优化执行器
    co.executor = NewOptimizationExecutor()
    
    // 初始化预算管理器
    if config.BudgetEnabled {
        co.budgetManager = NewBudgetManager(config.MonthlyBudget, config.BudgetAlertThreshold)
    }
    
    // 初始化效果评估器
    co.evaluator = NewEffectEvaluator()
    
    // 初始化成本报告器
    co.reporter = NewCostReporter()
    
    // 初始化告警管理器
    co.alertManager = NewAlertManager()
    
    // 初始化审计日志记录器
    co.auditLogger = NewAuditLogger()
    
    return co, nil
}

// 启动成本优化
func (co *CostOptimizer) Start(ctx context.Context) error {
    log.Info("启动成本优化器")
    
    config := co.config.Load().(*CostOptimizerConfig)
    
    // 启动成本监控
    go co.monitor.Start(ctx)
    
    // 启动优化循环
    ticker := time.NewTicker(config.MonitorInterval)
    defer ticker.Stop()
    
    for {
        select {
        case <-ctx.Done():
            log.Info("停止成本优化器")
            return ctx.Err()
        case <-ticker.C:
            if err := co.optimize(ctx); err != nil {
                log.Errorf("成本优化失败: %v", err)
            }
        }
    }
}

// 执行优化
func (co *CostOptimizer) optimize(ctx context.Context) error {
    log.Info("开始成本优化")
    
    config := co.config.Load().(*CostOptimizerConfig)
    
    // 1. 获取当前成本数据
    currentCost, err := co.monitor.GetCurrentCost()
    if err != nil {
        return fmt.Errorf("获取成本数据失败: %w", err)
    }
    
    log.Infof("当前成本: total=%.2f, storage=%.2f, compute=%.2f", 
        currentCost.Total, currentCost.Storage, currentCost.Compute)
    
    // 2. 分析成本趋势
    trend, err := co.analyzer.AnalyzeTrend(ctx)
    if err != nil {
        return fmt.Errorf("分析成本趋势失败: %w", err)
    }
    
    // 3. 检查是否需要优化
    if !co.shouldOptimize(currentCost, trend, config) {
        log.Info("当前成本在合理范围内，无需优化")
        return nil
    }
    
    log.Warn("检测到成本异常，开始执行优化")
    
    // 4. 生成优化建议
    recommendations, err := co.strategyEngine.GenerateRecommendations(ctx, currentCost, trend)
    if err != nil {
        return fmt.Errorf("生成优化建议失败: %w", err)
    }
    
    log.Infof("生成 %d 条优化建议", len(recommendations))
    
    // 5. 执行优化（如果启用自动优化）
    if config.AutoOptimize {
        for _, rec := range recommendations {
            if err := co.executeOptimization(ctx, rec); err != nil {
                log.Errorf("执行优化失败: %v", err)
                continue
            }
        }
    }
    
    // 6. 检查预算
    if co.budgetManager != nil {
        if err := co.budgetManager.CheckBudget(currentCost); err != nil {
            co.sendBudgetAlert(currentCost, err)
        }
    }
    
    return nil
}


// 成本数据
type CostData struct {
    Timestamp   time.Time              // 时间戳
    Total       float64                // 总成本
    Storage     float64                // 存储成本
    Compute     float64                // 计算成本
    Network     float64                // 网络成本
    License     float64                // 许可成本
    Breakdown   map[string]float64     // 成本明细
    Metadata    map[string]interface{} // 元数据
}

// 成本监控器
type CostMonitor struct {
    interval      time.Duration
    currentCost   atomic.Value
    costHistory   []*CostData
    mu            sync.RWMutex
}

// 启动监控
func (cm *CostMonitor) Start(ctx context.Context) {
    log.Info("启动成本监控")
    
    ticker := time.NewTicker(cm.interval)
    defer ticker.Stop()
    
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            cost, err := cm.collectCost()
            if err != nil {
                log.Errorf("采集成本数据失败: %v", err)
                continue
            }
            
            cm.currentCost.Store(cost)
            
            cm.mu.Lock()
            cm.costHistory = append(cm.costHistory, cost)
            // 保留最近30天的数据
            if len(cm.costHistory) > 30*24 {
                cm.costHistory = cm.costHistory[1:]
            }
            cm.mu.Unlock()
        }
    }
}

// 采集成本数据
func (cm *CostMonitor) collectCost() (*CostData, error) {
    cost := &CostData{
        Timestamp: time.Now(),
        Breakdown: make(map[string]float64),
    }
    
    // 1. 采集存储成本
    storageCost, err := cm.collectStorageCost()
    if err != nil {
        return nil, fmt.Errorf("采集存储成本失败: %w", err)
    }
    cost.Storage = storageCost
    
    // 2. 采集计算成本
    computeCost, err := cm.collectComputeCost()
    if err != nil {
        return nil, fmt.Errorf("采集计算成本失败: %w", err)
    }
    cost.Compute = computeCost
    
    // 3. 采集网络成本
    networkCost, err := cm.collectNetworkCost()
    if err != nil {
        return nil, fmt.Errorf("采集网络成本失败: %w", err)
    }
    cost.Network = networkCost
    
    // 4. 采集许可成本
    licenseCost, err := cm.collectLicenseCost()
    if err != nil {
        return nil, fmt.Errorf("采集许可成本失败: %w", err)
    }
    cost.License = licenseCost
    
    // 5. 计算总成本
    cost.Total = cost.Storage + cost.Compute + cost.Network + cost.License
    
    return cost, nil
}

// 采集存储成本
func (cm *CostMonitor) collectStorageCost() (float64, error) {
    // 实际实现应查询存储系统的使用量和单价
    // 示例：Elasticsearch索引大小 * 单价
    
    var totalCost float64
    
    // 热存储成本（SSD）
    hotStorageGB := 1000.0 // GB
    hotStoragePrice := 0.10 // $/GB/月
    totalCost += hotStorageGB * hotStoragePrice / 30 // 日成本
    
    // 温存储成本（HDD）
    warmStorageGB := 5000.0
    warmStoragePrice := 0.05
    totalCost += warmStorageGB * warmStoragePrice / 30
    
    // 冷存储成本（对象存储）
    coldStorageGB := 20000.0
    coldStoragePrice := 0.01
    totalCost += coldStorageGB * coldStoragePrice / 30
    
    return totalCost, nil
}

// 采集计算成本
func (cm *CostMonitor) collectComputeCost() (float64, error) {
    // 实际实现应查询计算资源的使用量和单价
    // 示例：CPU核心数 * 使用时长 * 单价
    
    var totalCost float64
    
    // 采集器成本
    collectorCPU := 4.0 // 核心数
    collectorPrice := 0.05 // $/核心/小时
    totalCost += collectorCPU * collectorPrice
    
    // 分析器成本
    analyzerCPU := 8.0
    analyzerPrice := 0.05
    totalCost += analyzerCPU * analyzerPrice
    
    // 存储引擎成本
    storageCPU := 16.0
    storagePrice := 0.05
    totalCost += storageCPU * storagePrice
    
    return totalCost, nil
}

// 采集网络成本
func (cm *CostMonitor) collectNetworkCost() (float64, error) {
    // 实际实现应查询网络流量和单价
    // 示例：出站流量 * 单价
    
    outboundGB := 100.0 // GB
    outboundPrice := 0.09 // $/GB
    
    return outboundGB * outboundPrice, nil
}

// 采集许可成本
func (cm *CostMonitor) collectLicenseCost() (float64, error) {
    // 实际实现应查询许可证费用
    // 示例：Elasticsearch许可证费用
    
    return 50.0, nil // 固定月费
}

// 获取当前成本
func (cm *CostMonitor) GetCurrentCost() (*CostData, error) {
    cost := cm.currentCost.Load()
    if cost == nil {
        return nil, fmt.Errorf("成本数据未就绪")
    }
    return cost.(*CostData), nil
}

// 成本分析器
type CostAnalyzer struct{}

// 分析成本趋势
func (ca *CostAnalyzer) AnalyzeTrend(ctx context.Context) (*CostTrend, error) {
    log.Info("分析成本趋势")
    
    trend := &CostTrend{
        Period:    "30d",
        StartTime: time.Now().AddDate(0, 0, -30),
        EndTime:   time.Now(),
    }
    
    // 实际实现应查询历史成本数据并计算趋势
    // 这里使用模拟数据
    
    trend.TotalCostChange = 25.5      // 增长25.5%
    trend.StorageCostChange = 30.2    // 存储成本增长30.2%
    trend.ComputeCostChange = 15.8    // 计算成本增长15.8%
    trend.NetworkCostChange = 10.3    // 网络成本增长10.3%
    trend.LicenseCostChange = 0.0     // 许可成本不变
    
    // 识别成本热点
    trend.Hotspots = []*CostHotspot{
        {
            Component:   "elasticsearch",
            CostChange:  35.0,
            CurrentCost: 150.0,
            Reason:      "索引数量增长",
        },
        {
            Component:   "kafka",
            CostChange:  20.0,
            CurrentCost: 80.0,
            Reason:      "消息保留时间过长",
        },
    }
    
    return trend, nil
}

// 成本趋势
type CostTrend struct {
    Period              string          // 分析周期
    StartTime           time.Time       // 开始时间
    EndTime             time.Time       // 结束时间
    TotalCostChange     float64         // 总成本变化（%）
    StorageCostChange   float64         // 存储成本变化（%）
    ComputeCostChange   float64         // 计算成本变化（%）
    NetworkCostChange   float64         // 网络成本变化（%）
    LicenseCostChange   float64         // 许可成本变化（%）
    Hotspots            []*CostHotspot  // 成本热点
}

// 成本热点
type CostHotspot struct {
    Component   string  // 组件名称
    CostChange  float64 // 成本变化（%）
    CurrentCost float64 // 当前成本
    Reason      string  // 原因
}

// 判断是否需要优化
func (co *CostOptimizer) shouldOptimize(cost *CostData, trend *CostTrend, config *CostOptimizerConfig) bool {
    // 1. 检查成本增长是否超过阈值
    if trend.TotalCostChange > config.CostThreshold {
        log.Warnf("成本增长%.2f%%超过阈值%.2f%%", trend.TotalCostChange, config.CostThreshold)
        return true
    }
    
    // 2. 检查是否有成本热点
    if len(trend.Hotspots) > 0 {
        log.Warnf("发现%d个成本热点", len(trend.Hotspots))
        return true
    }
    
    return false
}

// 优化策略引擎
type OptimizationEngine struct {
    strategies []*OptimizationStrategy
}

// 生成优化建议
func (oe *OptimizationEngine) GenerateRecommendations(ctx context.Context, cost *CostData, trend *CostTrend) ([]*Recommendation, error) {
    log.Info("生成优化建议")
    
    var recommendations []*Recommendation
    
    // 1. 存储分层建议
    if trend.StorageCostChange > 20 {
        recommendations = append(recommendations, &Recommendation{
            ID:          generateRecommendationID(),
            Type:        StrategyStorageTiering,
            Title:       "优化存储分层策略",
            Description: "将30天前的日志迁移到温存储，90天前的日志迁移到冷存储",
            EstimatedSavings: cost.Storage * 0.30, // 预计节省30%
            Priority:    9,
            Actions: []*OptimizationAction{
                {
                    Type:   "migrate_to_warm",
                    Target: "logs_older_than_30d",
                },
                {
                    Type:   "migrate_to_cold",
                    Target: "logs_older_than_90d",
                },
            },
        })
    }
    
    // 2. 压缩优化建议
    recommendations = append(recommendations, &Recommendation{
        ID:          generateRecommendationID(),
        Type:        StrategyCompression,
        Title:       "启用高效压缩算法",
        Description: "使用Zstd压缩算法替代Gzip，提高压缩率",
        EstimatedSavings: cost.Storage * 0.15, // 预计节省15%
        Priority:    8,
        Actions: []*OptimizationAction{
            {
                Type:   "change_compression",
                Target: "all_indices",
                Parameters: map[string]interface{}{
                    "algorithm": "zstd",
                    "level":     3,
                },
            },
        },
    })

    
    // 3. 采样策略建议
    if trend.ComputeCostChange > 15 {
        recommendations = append(recommendations, &Recommendation{
            ID:          generateRecommendationID(),
            Type:        StrategySampling,
            Title:       "优化日志采样策略",
            Description: "对低优先级日志启用采样，采样率50%",
            EstimatedSavings: cost.Compute * 0.20, // 预计节省20%
            Priority:    7,
            Actions: []*OptimizationAction{
                {
                    Type:   "enable_sampling",
                    Target: "low_priority_logs",
                    Parameters: map[string]interface{}{
                        "sampling_rate": 0.5,
                    },
                },
            },
        })
    }
    
    // 4. 保留策略建议
    recommendations = append(recommendations, &Recommendation{
        ID:          generateRecommendationID(),
        Type:        StrategyRetention,
        Title:       "调整日志保留策略",
        Description: "缩短非关键日志的保留时间从90天到30天",
        EstimatedSavings: cost.Storage * 0.25, // 预计节省25%
        Priority:    8,
        Actions: []*OptimizationAction{
            {
                Type:   "update_retention",
                Target: "non_critical_logs",
                Parameters: map[string]interface{}{
                    "retention_days": 30,
                },
            },
        },
    })
    
    // 5. 资源调整建议
    if trend.ComputeCostChange > 10 {
        recommendations = append(recommendations, &Recommendation{
            ID:          generateRecommendationID(),
            Type:        StrategyResourceScaling,
            Title:       "优化资源配置",
            Description: "根据实际负载调整计算资源，降低过度配置",
            EstimatedSavings: cost.Compute * 0.18, // 预计节省18%
            Priority:    6,
            Actions: []*OptimizationAction{
                {
                    Type:   "scale_down",
                    Target: "collector_instances",
                    Parameters: map[string]interface{}{
                        "target_cpu": 60, // 目标CPU使用率60%
                    },
                },
            },
        })
    }
    
    // 按优先级排序
    sort.Slice(recommendations, func(i, j int) bool {
        return recommendations[i].Priority > recommendations[j].Priority
    })
    
    return recommendations, nil
}

// 优化建议
type Recommendation struct {
    ID               string                // 建议ID
    Type             string                // 建议类型
    Title            string                // 标题
    Description      string                // 描述
    EstimatedSavings float64               // 预计节省金额
    Priority         int                   // 优先级（1-10）
    Actions          []*OptimizationAction // 优化动作
}

// 优化动作
type OptimizationAction struct {
    Type       string                 // 动作类型
    Target     string                 // 目标对象
    Parameters map[string]interface{} // 动作参数
}

// 执行优化
func (co *CostOptimizer) executeOptimization(ctx context.Context, rec *Recommendation) error {
    log.Infof("执行优化: %s", rec.Title)
    
    startTime := time.Now()
    
    // 记录优化前的成本
    beforeCost, _ := co.monitor.GetCurrentCost()
    
    // 执行优化动作
    result, err := co.executor.Execute(ctx, rec)
    if err != nil {
        return fmt.Errorf("执行优化失败: %w", err)
    }
    
    duration := time.Since(startTime)
    
    // 记录审计日志
    co.auditLogger.LogOptimization(&OptimizationRecord{
        RecommendationID: rec.ID,
        Title:            rec.Title,
        Type:             rec.Type,
        ExecutedAt:       startTime,
        Duration:         duration,
        Success:          true,
        Result:           result,
    })
    
    // 评估优化效果（延迟评估）
    go func() {
        time.Sleep(time.Hour) // 等待1小时后评估
        
        afterCost, _ := co.monitor.GetCurrentCost()
        effect := co.evaluator.Evaluate(beforeCost, afterCost, rec)
        
        log.Infof("优化效果: 预计节省%.2f, 实际节省%.2f", 
            rec.EstimatedSavings, effect.ActualSavings)
    }()
    
    return nil
}

// 优化执行器
type OptimizationExecutor struct {
    handlers map[string]ActionHandler
}

// 执行优化
func (oe *OptimizationExecutor) Execute(ctx context.Context, rec *Recommendation) (interface{}, error) {
    results := make([]interface{}, 0, len(rec.Actions))
    
    for _, action := range rec.Actions {
        handler, exists := oe.handlers[action.Type]
        if !exists {
            return nil, fmt.Errorf("未知的动作类型: %s", action.Type)
        }
        
        result, err := handler.Execute(ctx, action)
        if err != nil {
            return nil, fmt.Errorf("动作执行失败: %w", err)
        }
        
        results = append(results, result)
    }
    
    return results, nil
}

// 成本预测器
type CostPredictor struct {
    model *PredictionModel
}

// 预测未来成本
func (cp *CostPredictor) Predict(ctx context.Context, days int) (*CostPrediction, error) {
    log.Infof("预测未来%d天的成本", days)
    
    prediction := &CostPrediction{
        Days:        days,
        PredictedAt: time.Now(),
        Predictions: make([]*DailyCostPrediction, days),
    }
    
    // 实际实现应使用时间序列预测模型（如ARIMA、Prophet）
    // 这里使用简化的线性预测
    
    currentCost := 500.0 // 当前日成本
    growthRate := 0.02   // 日增长率2%
    
    for i := 0; i < days; i++ {
        dailyCost := currentCost * math.Pow(1+growthRate, float64(i))
        
        prediction.Predictions[i] = &DailyCostPrediction{
            Date:      time.Now().AddDate(0, 0, i+1),
            Predicted: dailyCost,
            Lower:     dailyCost * 0.9, // 置信区间下限
            Upper:     dailyCost * 1.1, // 置信区间上限
        }
        
        prediction.TotalPredicted += dailyCost
    }
    
    // 计算预测准确率（基于历史数据）
    prediction.Accuracy = 0.85 // 85%
    
    return prediction, nil
}

// 成本预测
type CostPrediction struct {
    Days           int                      // 预测天数
    PredictedAt    time.Time                // 预测时间
    TotalPredicted float64                  // 预测总成本
    Accuracy       float64                  // 预测准确率
    Predictions    []*DailyCostPrediction   // 每日预测
}

// 每日成本预测
type DailyCostPrediction struct {
    Date      time.Time // 日期
    Predicted float64   // 预测值
    Lower     float64   // 置信区间下限
    Upper     float64   // 置信区间上限
}

// 预算管理器
type BudgetManager struct {
    monthlyBudget  float64
    alertThreshold float64
    currentSpend   float64
    mu             sync.RWMutex
}

// 检查预算
func (bm *BudgetManager) CheckBudget(cost *CostData) error {
    bm.mu.Lock()
    defer bm.mu.Unlock()
    
    // 累计本月支出
    bm.currentSpend += cost.Total
    
    // 计算预算使用率
    usageRate := bm.currentSpend / bm.monthlyBudget * 100
    
    log.Infof("预算使用率: %.2f%% (%.2f / %.2f)", 
        usageRate, bm.currentSpend, bm.monthlyBudget)
    
    // 检查是否超过告警阈值
    if usageRate >= bm.alertThreshold {
        return fmt.Errorf("预算使用率%.2f%%超过告警阈值%.2f%%", 
            usageRate, bm.alertThreshold)
    }
    
    return nil
}

// 效果评估器
type EffectEvaluator struct{}

// 评估优化效果
func (ee *EffectEvaluator) Evaluate(before, after *CostData, rec *Recommendation) *OptimizationEffect {
    effect := &OptimizationEffect{
        RecommendationID:  rec.ID,
        Title:             rec.Title,
        EstimatedSavings:  rec.EstimatedSavings,
        ActualSavings:     before.Total - after.Total,
        SavingsRate:       0,
    }
    
    if before.Total > 0 {
        effect.SavingsRate = effect.ActualSavings / before.Total * 100
    }
    
    // 计算准确率
    if rec.EstimatedSavings > 0 {
        effect.Accuracy = effect.ActualSavings / rec.EstimatedSavings * 100
        if effect.Accuracy > 100 {
            effect.Accuracy = 100
        }
    }
    
    return effect
}

// 优化效果
type OptimizationEffect struct {
    RecommendationID string  // 建议ID
    Title            string  // 标题
    EstimatedSavings float64 // 预计节省
    ActualSavings    float64 // 实际节省
    SavingsRate      float64 // 节省率（%）
    Accuracy         float64 // 预测准确率（%）
}

// 成本报告器
type CostReporter struct{}

// 生成成本报告
func (cr *CostReporter) GenerateReport(ctx context.Context, period string) (*CostReport, error) {
    log.Infof("生成成本报告: period=%s", period)
    
    report := &CostReport{
        Period:      period,
        GeneratedAt: time.Now(),
    }
    
    // 1. 总体成本统计
    report.Summary = &CostSummary{
        TotalCost:     15000.0,
        StorageCost:   6000.0,
        ComputeCost:   5000.0,
        NetworkCost:   3000.0,
        LicenseCost:   1000.0,
    }
    
    // 2. 成本占比分析
    report.Breakdown = map[string]float64{
        "storage": 40.0,
        "compute": 33.3,
        "network": 20.0,
        "license": 6.7,
    }
    
    // 3. Top 10 成本消耗组件
    report.TopComponents = []*ComponentCost{
        {Component: "elasticsearch", Cost: 4500.0, Percentage: 30.0},
        {Component: "kafka", Cost: 2500.0, Percentage: 16.7},
        {Component: "flink", Cost: 2000.0, Percentage: 13.3},
        {Component: "redis", Cost: 1500.0, Percentage: 10.0},
        {Component: "postgres", Cost: 1000.0, Percentage: 6.7},
    }
    
    // 4. 优化建议汇总
    report.OptimizationSummary = &OptimizationSummary{
        TotalRecommendations: 5,
        EstimatedSavings:     3000.0,
        ActualSavings:        2400.0,
        SavingsRate:          16.0,
    }
    
    return report, nil
}

// 成本报告
type CostReport struct {
    Period              string                // 报告周期
    GeneratedAt         time.Time             // 生成时间
    Summary             *CostSummary          // 成本汇总
    Breakdown           map[string]float64    // 成本占比
    TopComponents       []*ComponentCost      // Top组件
    OptimizationSummary *OptimizationSummary  // 优化汇总
}

// 成本汇总
type CostSummary struct {
    TotalCost   float64 // 总成本
    StorageCost float64 // 存储成本
    ComputeCost float64 // 计算成本
    NetworkCost float64 // 网络成本
    LicenseCost float64 // 许可成本
}

// 组件成本
type ComponentCost struct {
    Component  string  // 组件名称
    Cost       float64 // 成本
    Percentage float64 // 占比（%）
}

// 优化汇总
type OptimizationSummary struct {
    TotalRecommendations int     // 总建议数
    EstimatedSavings     float64 // 预计节省
    ActualSavings        float64 // 实际节省
    SavingsRate          float64 // 节省率（%）
}

// 优化记录
type OptimizationRecord struct {
    RecommendationID string        // 建议ID
    Title            string        // 标题
    Type             string        // 类型
    ExecutedAt       time.Time     // 执行时间
    Duration         time.Duration // 耗时
    Success          bool          // 是否成功
    Result           interface{}   // 执行结果
}

// 发送预算告警
func (co *CostOptimizer) sendBudgetAlert(cost *CostData, err error) {
    alert := &Alert{
        Level:   "warning",
        Title:   "预算告警",
        Message: fmt.Sprintf("成本预算即将超支: %v", err),
        Fields: map[string]interface{}{
            "current_cost": cost.Total,
            "timestamp":    cost.Timestamp,
        },
        Timestamp: time.Now(),
    }
    
    config := co.config.Load().(*CostOptimizerConfig)
    for _, recipient := range config.AlertRecipients {
        alert.Recipients = append(alert.Recipients, recipient)
    }
    
    co.alertManager.Send(context.Background(), alert)
}
```

**关键实现点**:

1. 实时监控日志系统的多维度成本指标（存储、计算、网络、许可），提供成本趋势分析
2. 基于使用模式分析提供5种优化策略（存储分层、压缩优化、采样策略、保留策略、资源调整）
3. 支持自动执行成本优化策略，在成本增长超过阈值时自动触发优化
4. 实现成本预测功能，使用时间序列模型预测未来30天的成本趋势
5. 提供多维度成本分析（按时间、按组件、按项目、按环境），识别成本热点
6. 实现预算管理机制，当实际成本超过预算阈值时发送告警
7. 评估优化效果，对比优化前后的成本节省，记录详细的审计日志

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| cost_optimizer_enabled | bool | true | 是否启用成本优化 |
| monitor_interval | duration | 1h | 监控间隔 |
| auto_optimize | bool | false | 是否自动优化 |
| cost_threshold | float | 20.0 | 成本增长阈值（%） |
| budget_enabled | bool | true | 是否启用预算管理 |
| monthly_budget | float | 10000.0 | 月度预算 |
| budget_alert_threshold | float | 90.0 | 预算告警阈值（%） |
| strategies | array | [] | 优化策略列表 |
| alert_recipients | array | [] | 告警接收人列表 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + PostgreSQL
- 生效时间: 立即生效（下次监控周期生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志并发送告警

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的成本优化配置
2. WHEN 监控间隔变更时，THE System SHALL 在下次监控周期使用新的间隔
3. THE System SHALL 支持通过 API 查询当前生效的成本优化配置
4. THE System SHALL 记录所有成本优化配置变更的审计日志
5. WHEN 预算阈值变更时，THE System SHALL 立即使用新阈值进行预算检查

---

#### 需求 16-70: 日志智能推荐 [Phase 3]

**用户故事**:

作为开发工程师，我希望系统能够根据我的使用习惯和当前上下文智能推荐相关日志和查询，以便更快地定位问题。

**验收标准**:

1. THE System SHALL 基于用户历史行为（搜索记录、查看记录、操作记录）提供个性化的日志推荐（推荐准确率 >= 75%）
2. THE Dashboard SHALL 在用户查看某条日志时，自动推荐相关日志（基于时间关联、实体关联、因果关联），展示至少 5 条相关日志
3. THE System SHALL 提供智能查询建议，根据用户输入的关键词自动补全查询语句，支持至少 10 种常见查询模式
4. THE Dashboard SHALL 展示热门查询排行榜（Top 20），帮助用户发现常用查询
5. THE System SHALL 基于当前告警自动推荐相关日志，帮助用户快速定位告警原因（响应时间 < 2 秒）
6. THE System SHALL 提供日志模式推荐，识别用户可能感兴趣的日志模式（基于协同过滤算法）
7. THE Dashboard SHALL 支持推荐结果的反馈机制，用户可以标记推荐是否有用，用于优化推荐算法
8. THE System SHALL 记录所有推荐操作的日志，包括推荐类型、推荐内容、用户反馈、点击率
9. THE System SHALL 定期评估推荐效果（每周），生成推荐质量报告（目标点击率 >= 30%）
10. THE System SHALL 通过配置中心管理推荐配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/recommendation/engine.go
package recommendation

import (
    "context"
    "time"
    "sync"
)

// 推荐引擎
type RecommendationEngine struct {
    config           atomic.Value              // 配置（支持热更新）
    userProfiler     *UserProfiler             // 用户画像器
    logAnalyzer      *LogAnalyzer              // 日志分析器
    queryAnalyzer    *QueryAnalyzer            // 查询分析器
    correlator       *LogCorrelator            // 日志关联器
    patternMatcher   *PatternMatcher           // 模式匹配器
    rankingModel     *RankingModel             // 排序模型
    feedbackManager  *FeedbackManager          // 反馈管理器
    metricsCollector *RecommendationMetrics    // 指标收集器
    cache            *RecommendationCache      // 推荐缓存
    auditLogger      *AuditLogger              // 审计日志记录器
}

// 推荐配置
type RecommendationConfig struct {
    Enabled              bool              // 是否启用推荐
    MaxRecommendations   int               // 最大推荐数量
    MinConfidence        float64           // 最小置信度
    CacheTTL             time.Duration     // 缓存过期时间
    EnablePersonalization bool             // 是否启用个性化
    EnableCollaborative  bool              // 是否启用协同过滤
    RankingAlgorithm     string            // 排序算法
    FeedbackEnabled      bool              // 是否启用反馈
    EvaluationInterval   time.Duration     // 评估间隔
}

// 推荐类型
const (
    RecommendationTypeRelatedLogs   = "related_logs"   // 相关日志
    RecommendationTypeQuerySuggestion = "query_suggestion" // 查询建议
    RecommendationTypeHotQueries    = "hot_queries"    // 热门查询
    RecommendationTypeAlertLogs     = "alert_logs"     // 告警相关日志
    RecommendationTypePatterns      = "patterns"       // 日志模式
)

// 创建推荐引擎
func NewRecommendationEngine(config *RecommendationConfig) (*RecommendationEngine, error) {
    re := &RecommendationEngine{}
    re.config.Store(config)
    
    // 初始化用户画像器
    re.userProfiler = NewUserProfiler()
    
    // 初始化日志分析器
    re.logAnalyzer = NewLogAnalyzer()
    
    // 初始化查询分析器
    re.queryAnalyzer = NewQueryAnalyzer()
    
    // 初始化日志关联器
    re.correlator = NewLogCorrelator()
    
    // 初始化模式匹配器
    re.patternMatcher = NewPatternMatcher()
    
    // 初始化排序模型
    re.rankingModel = NewRankingModel(config.RankingAlgorithm)
    
    // 初始化反馈管理器
    if config.FeedbackEnabled {
        re.feedbackManager = NewFeedbackManager()
    }
    
    // 初始化指标收集器
    re.metricsCollector = NewRecommendationMetrics()
    
    // 初始化推荐缓存
    re.cache = NewRecommendationCache(config.CacheTTL)
    
    // 初始化审计日志记录器
    re.auditLogger = NewAuditLogger()
    
    return re, nil
}

// 推荐相关日志
func (re *RecommendationEngine) RecommendRelatedLogs(ctx context.Context, logID string, userID string) ([]*LogRecommendation, error) {
    log.Infof("推荐相关日志: log=%s, user=%s", logID, userID)
    
    startTime := time.Now()
    
    config := re.config.Load().(*RecommendationConfig)
    
    // 1. 检查缓存
    cacheKey := fmt.Sprintf("related_logs:%s:%s", logID, userID)
    if cached := re.cache.Get(cacheKey); cached != nil {
        log.Info("使用缓存的推荐结果")
        return cached.([]*LogRecommendation), nil
    }
    
    // 2. 获取目标日志
    targetLog, err := re.logAnalyzer.GetLog(logID)
    if err != nil {
        return nil, fmt.Errorf("获取日志失败: %w", err)
    }
    
    // 3. 获取用户画像
    var userProfile *UserProfile
    if config.EnablePersonalization {
        userProfile = re.userProfiler.GetProfile(userID)
    }
    
    // 4. 查找相关日志
    relatedLogs, err := re.correlator.FindRelated(ctx, targetLog)
    if err != nil {
        return nil, fmt.Errorf("查找相关日志失败: %w", err)
    }
    
    log.Infof("找到 %d 条相关日志", len(relatedLogs))
    
    // 5. 计算推荐分数
    recommendations := make([]*LogRecommendation, 0, len(relatedLogs))
    for _, relatedLog := range relatedLogs {
        score := re.calculateScore(targetLog, relatedLog, userProfile)
        
        if score >= config.MinConfidence {
            recommendations = append(recommendations, &LogRecommendation{
                LogID:       relatedLog.ID,
                Log:         relatedLog,
                Score:       score,
                Reason:      re.explainRecommendation(targetLog, relatedLog),
                Timestamp:   time.Now(),
            })
        }
    }
    
    // 6. 排序
    recommendations = re.rankingModel.Rank(recommendations, userProfile)
    
    // 7. 限制数量
    if len(recommendations) > config.MaxRecommendations {
        recommendations = recommendations[:config.MaxRecommendations]
    }
    
    // 8. 缓存结果
    re.cache.Set(cacheKey, recommendations)
    
    // 9. 记录指标
    duration := time.Since(startTime)
    re.metricsCollector.RecordRecommendation(RecommendationTypeRelatedLogs, len(recommendations), duration)
    
    // 10. 记录审计日志
    re.auditLogger.LogRecommendation(&RecommendationRecord{
        Type:      RecommendationTypeRelatedLogs,
        UserID:    userID,
        TargetID:  logID,
        Count:     len(recommendations),
        Duration:  duration,
        Timestamp: time.Now(),
    })
    
    log.Infof("推荐完成: count=%d, duration=%v", len(recommendations), duration)
    
    return recommendations, nil
}


// 日志推荐
type LogRecommendation struct {
    LogID     string      // 日志ID
    Log       *LogEntry   // 日志内容
    Score     float64     // 推荐分数
    Reason    string      // 推荐原因
    Timestamp time.Time   // 推荐时间
}

// 用户画像器
type UserProfiler struct {
    profiles map[string]*UserProfile
    mu       sync.RWMutex
}

// 用户画像
type UserProfile struct {
    UserID          string                 // 用户ID
    SearchHistory   []*SearchRecord        // 搜索历史
    ViewHistory     []*ViewRecord          // 查看历史
    Preferences     map[string]float64     // 偏好权重
    LastUpdated     time.Time              // 最后更新时间
}

// 搜索记录
type SearchRecord struct {
    Query     string    // 查询语句
    Timestamp time.Time // 时间戳
    ResultCount int     // 结果数量
}

// 查看记录
type ViewRecord struct {
    LogID     string    // 日志ID
    Duration  time.Duration // 查看时长
    Timestamp time.Time // 时间戳
}

// 获取用户画像
func (up *UserProfiler) GetProfile(userID string) *UserProfile {
    up.mu.RLock()
    defer up.mu.RUnlock()
    
    profile, exists := up.profiles[userID]
    if !exists {
        // 创建新画像
        profile = &UserProfile{
            UserID:      userID,
            Preferences: make(map[string]float64),
            LastUpdated: time.Now(),
        }
    }
    
    return profile
}

// 更新用户画像
func (up *UserProfiler) UpdateProfile(userID string, action string, data interface{}) {
    up.mu.Lock()
    defer up.mu.Unlock()
    
    profile := up.profiles[userID]
    if profile == nil {
        profile = &UserProfile{
            UserID:      userID,
            Preferences: make(map[string]float64),
        }
        up.profiles[userID] = profile
    }
    
    switch action {
    case "search":
        record := data.(*SearchRecord)
        profile.SearchHistory = append(profile.SearchHistory, record)
        
        // 更新偏好权重
        // 实际实现应分析查询内容，提取关键词和模式
        
    case "view":
        record := data.(*ViewRecord)
        profile.ViewHistory = append(profile.ViewHistory, record)
        
        // 根据查看时长更新偏好
        if record.Duration > time.Minute {
            // 长时间查看表示感兴趣
            profile.Preferences["detailed_view"] += 1.0
        }
    }
    
    profile.LastUpdated = time.Now()
}

// 日志关联器
type LogCorrelator struct{}

// 查找相关日志
func (lc *LogCorrelator) FindRelated(ctx context.Context, targetLog *LogEntry) ([]*LogEntry, error) {
    var relatedLogs []*LogEntry
    
    // 1. 时间关联：查找前后5分钟的日志
    timeRelated, err := lc.findTimeRelated(targetLog)
    if err != nil {
        log.Warnf("查找时间相关日志失败: %v", err)
    } else {
        relatedLogs = append(relatedLogs, timeRelated...)
    }
    
    // 2. 实体关联：查找包含相同实体的日志（如相同的用户ID、请求ID）
    entityRelated, err := lc.findEntityRelated(targetLog)
    if err != nil {
        log.Warnf("查找实体相关日志失败: %v", err)
    } else {
        relatedLogs = append(relatedLogs, entityRelated...)
    }
    
    // 3. 因果关联：查找可能的因果关系日志
    causalRelated, err := lc.findCausalRelated(targetLog)
    if err != nil {
        log.Warnf("查找因果相关日志失败: %v", err)
    } else {
        relatedLogs = append(relatedLogs, causalRelated...)
    }
    
    // 去重
    relatedLogs = lc.deduplicate(relatedLogs)
    
    return relatedLogs, nil
}

// 查找时间相关日志
func (lc *LogCorrelator) findTimeRelated(targetLog *LogEntry) ([]*LogEntry, error) {
    // 实际实现应查询Elasticsearch
    // 查询条件：timestamp在目标日志前后5分钟，且来自相同服务
    
    return []*LogEntry{}, nil
}

// 查找实体相关日志
func (lc *LogCorrelator) findEntityRelated(targetLog *LogEntry) ([]*LogEntry, error) {
    // 提取实体（如request_id, user_id, trace_id）
    entities := lc.extractEntities(targetLog)
    
    // 查询包含相同实体的日志
    // 实际实现应查询Elasticsearch
    
    return []*LogEntry{}, nil
}

// 提取实体
func (lc *LogCorrelator) extractEntities(log *LogEntry) map[string]string {
    entities := make(map[string]string)
    
    // 使用正则表达式提取常见实体
    patterns := map[string]*regexp.Regexp{
        "request_id": regexp.MustCompile(`request_id[=:](\w+)`),
        "user_id":    regexp.MustCompile(`user_id[=:](\w+)`),
        "trace_id":   regexp.MustCompile(`trace_id[=:](\w+)`),
    }
    
    for name, pattern := range patterns {
        if matches := pattern.FindStringSubmatch(log.Message); len(matches) > 1 {
            entities[name] = matches[1]
        }
    }
    
    return entities
}

// 查找因果相关日志
func (lc *LogCorrelator) findCausalRelated(targetLog *LogEntry) ([]*LogEntry, error) {
    // 基于日志级别和内容推断因果关系
    // 例如：ERROR日志可能由之前的WARN日志引起
    
    return []*LogEntry{}, nil
}

// 去重
func (lc *LogCorrelator) deduplicate(logs []*LogEntry) []*LogEntry {
    seen := make(map[string]bool)
    result := make([]*LogEntry, 0, len(logs))
    
    for _, log := range logs {
        if !seen[log.ID] {
            seen[log.ID] = true
            result = append(result, log)
        }
    }
    
    return result
}

// 计算推荐分数
func (re *RecommendationEngine) calculateScore(target, candidate *LogEntry, profile *UserProfile) float64 {
    var score float64
    
    // 1. 时间相关性（权重0.3）
    timeDiff := math.Abs(float64(candidate.Timestamp.Sub(target.Timestamp)))
    timeScore := 1.0 / (1.0 + timeDiff/float64(time.Minute*5))
    score += timeScore * 0.3
    
    // 2. 内容相似度（权重0.4）
    contentScore := re.calculateContentSimilarity(target.Message, candidate.Message)
    score += contentScore * 0.4
    
    // 3. 用户偏好（权重0.3）
    if profile != nil {
        preferenceScore := re.calculatePreferenceScore(candidate, profile)
        score += preferenceScore * 0.3
    } else {
        score += 0.15 // 无用户画像时使用默认分数
    }
    
    return score
}

// 计算内容相似度
func (re *RecommendationEngine) calculateContentSimilarity(text1, text2 string) float64 {
    // 简化实现：使用Jaccard相似度
    // 实际应使用更复杂的算法（如TF-IDF、Word2Vec）
    
    words1 := strings.Fields(strings.ToLower(text1))
    words2 := strings.Fields(strings.ToLower(text2))
    
    set1 := make(map[string]bool)
    for _, word := range words1 {
        set1[word] = true
    }
    
    set2 := make(map[string]bool)
    for _, word := range words2 {
        set2[word] = true
    }
    
    // 计算交集
    intersection := 0
    for word := range set1 {
        if set2[word] {
            intersection++
        }
    }
    
    // 计算并集
    union := len(set1) + len(set2) - intersection
    
    if union == 0 {
        return 0
    }
    
    return float64(intersection) / float64(union)
}

// 计算偏好分数
func (re *RecommendationEngine) calculatePreferenceScore(log *LogEntry, profile *UserProfile) float64 {
    var score float64
    
    // 基于用户历史行为计算偏好分数
    // 实际实现应分析用户的查看历史和搜索历史
    
    // 示例：如果用户经常查看ERROR级别的日志
    if log.Level == "ERROR" && profile.Preferences["error_logs"] > 0 {
        score += 0.5
    }
    
    return score
}

// 解释推荐原因
func (re *RecommendationEngine) explainRecommendation(target, candidate *LogEntry) string {
    reasons := []string{}
    
    // 时间关联
    timeDiff := candidate.Timestamp.Sub(target.Timestamp)
    if math.Abs(float64(timeDiff)) < float64(time.Minute*5) {
        reasons = append(reasons, fmt.Sprintf("发生在相近时间（%v）", timeDiff))
    }
    
    // 实体关联
    // 实际实现应检查共同实体
    
    // 内容相似
    similarity := re.calculateContentSimilarity(target.Message, candidate.Message)
    if similarity > 0.5 {
        reasons = append(reasons, fmt.Sprintf("内容相似度%.0f%%", similarity*100))
    }
    
    if len(reasons) == 0 {
        return "可能相关"
    }
    
    return strings.Join(reasons, "；")
}

// 排序模型
type RankingModel struct {
    algorithm string
}

// 排序推荐
func (rm *RankingModel) Rank(recommendations []*LogRecommendation, profile *UserProfile) []*LogRecommendation {
    // 按分数降序排序
    sort.Slice(recommendations, func(i, j int) bool {
        return recommendations[i].Score > recommendations[j].Score
    })
    
    return recommendations
}

// 推荐查询建议
func (re *RecommendationEngine) RecommendQuerySuggestions(ctx context.Context, input string, userID string) ([]*QuerySuggestion, error) {
    log.Infof("推荐查询建议: input=%s, user=%s", input, userID)
    
    suggestions := make([]*QuerySuggestion, 0)
    
    // 1. 基于输入的自动补全
    autoComplete := re.queryAnalyzer.AutoComplete(input)
    for _, query := range autoComplete {
        suggestions = append(suggestions, &QuerySuggestion{
            Query:       query,
            Type:        "autocomplete",
            Description: "自动补全",
            Score:       0.8,
        })
    }
    
    // 2. 基于用户历史的建议
    profile := re.userProfiler.GetProfile(userID)
    if profile != nil {
        for _, record := range profile.SearchHistory {
            if strings.Contains(record.Query, input) {
                suggestions = append(suggestions, &QuerySuggestion{
                    Query:       record.Query,
                    Type:        "history",
                    Description: "历史查询",
                    Score:       0.7,
                })
            }
        }
    }
    
    // 3. 热门查询
    hotQueries := re.queryAnalyzer.GetHotQueries(10)
    for _, query := range hotQueries {
        if strings.Contains(query.Query, input) {
            suggestions = append(suggestions, &QuerySuggestion{
                Query:       query.Query,
                Type:        "popular",
                Description: fmt.Sprintf("热门查询（%d次）", query.Count),
                Score:       0.6,
            })
        }
    }
    
    // 去重和排序
    suggestions = re.deduplicateSuggestions(suggestions)
    sort.Slice(suggestions, func(i, j int) bool {
        return suggestions[i].Score > suggestions[j].Score
    })
    
    // 限制数量
    if len(suggestions) > 10 {
        suggestions = suggestions[:10]
    }
    
    return suggestions, nil
}

// 查询建议
type QuerySuggestion struct {
    Query       string  // 查询语句
    Type        string  // 建议类型
    Description string  // 描述
    Score       float64 // 分数
}

// 查询分析器
type QueryAnalyzer struct {
    patterns    []*QueryPattern
    hotQueries  []*HotQuery
    mu          sync.RWMutex
}

// 查询模式
type QueryPattern struct {
    Pattern     string   // 模式
    Template    string   // 模板
    Description string   // 描述
    Examples    []string // 示例
}

// 热门查询
type HotQuery struct {
    Query string // 查询语句
    Count int    // 使用次数
}

// 自动补全
func (qa *QueryAnalyzer) AutoComplete(input string) []string {
    completions := []string{}
    
    // 常见查询模式
    patterns := []string{
        "level:ERROR",
        "level:WARN",
        "level:INFO",
        "service:",
        "message:",
        "timestamp:",
        "@timestamp:[now-1h TO now]",
        "@timestamp:[now-24h TO now]",
        "status:500",
        "status:404",
    }
    
    for _, pattern := range patterns {
        if strings.HasPrefix(pattern, input) {
            completions = append(completions, pattern)
        }
    }
    
    return completions
}

// 获取热门查询
func (qa *QueryAnalyzer) GetHotQueries(limit int) []*HotQuery {
    qa.mu.RLock()
    defer qa.mu.RUnlock()
    
    // 按使用次数排序
    queries := make([]*HotQuery, len(qa.hotQueries))
    copy(queries, qa.hotQueries)
    
    sort.Slice(queries, func(i, j int) bool {
        return queries[i].Count > queries[j].Count
    })
    
    if len(queries) > limit {
        queries = queries[:limit]
    }
    
    return queries
}

// 去重建议
func (re *RecommendationEngine) deduplicateSuggestions(suggestions []*QuerySuggestion) []*QuerySuggestion {
    seen := make(map[string]bool)
    result := make([]*QuerySuggestion, 0, len(suggestions))
    
    for _, suggestion := range suggestions {
        if !seen[suggestion.Query] {
            seen[suggestion.Query] = true
            result = append(result, suggestion)
        }
    }
    
    return result
}


// 推荐告警相关日志
func (re *RecommendationEngine) RecommendAlertLogs(ctx context.Context, alertID string, userID string) ([]*LogRecommendation, error) {
    log.Infof("推荐告警相关日志: alert=%s, user=%s", alertID, userID)
    
    startTime := time.Now()
    
    // 1. 获取告警信息
    alert, err := re.getAlert(alertID)
    if err != nil {
        return nil, fmt.Errorf("获取告警失败: %w", err)
    }
    
    // 2. 根据告警条件查询相关日志
    relatedLogs, err := re.findAlertRelatedLogs(ctx, alert)
    if err != nil {
        return nil, fmt.Errorf("查询相关日志失败: %w", err)
    }
    
    // 3. 计算推荐分数
    recommendations := make([]*LogRecommendation, 0, len(relatedLogs))
    for _, log := range relatedLogs {
        score := re.calculateAlertRelevance(alert, log)
        
        recommendations = append(recommendations, &LogRecommendation{
            LogID:     log.ID,
            Log:       log,
            Score:     score,
            Reason:    "与告警条件匹配",
            Timestamp: time.Now(),
        })
    }
    
    // 4. 排序
    sort.Slice(recommendations, func(i, j int) bool {
        return recommendations[i].Score > recommendations[j].Score
    })
    
    duration := time.Since(startTime)
    
    // 确保响应时间 < 2秒
    if duration > time.Second*2 {
        log.Warnf("告警日志推荐耗时过长: %v", duration)
    }
    
    log.Infof("推荐完成: count=%d, duration=%v", len(recommendations), duration)
    
    return recommendations, nil
}

// 获取告警
func (re *RecommendationEngine) getAlert(alertID string) (*Alert, error) {
    // 实际实现应查询告警系统
    return &Alert{
        ID:        alertID,
        Rule:      "error_rate_high",
        Condition: "error_rate > 5%",
        Timestamp: time.Now(),
    }, nil
}

// 查找告警相关日志
func (re *RecommendationEngine) findAlertRelatedLogs(ctx context.Context, alert *Alert) ([]*LogEntry, error) {
    // 实际实现应根据告警条件查询Elasticsearch
    // 例如：如果告警是错误率高，则查询ERROR级别的日志
    
    return []*LogEntry{}, nil
}

// 计算告警相关性
func (re *RecommendationEngine) calculateAlertRelevance(alert *Alert, log *LogEntry) float64 {
    var score float64
    
    // 1. 时间相关性
    timeDiff := math.Abs(float64(log.Timestamp.Sub(alert.Timestamp)))
    timeScore := 1.0 / (1.0 + timeDiff/float64(time.Minute*10))
    score += timeScore * 0.5
    
    // 2. 内容匹配度
    // 实际实现应检查日志是否匹配告警条件
    score += 0.5
    
    return score
}

// 推荐日志模式
func (re *RecommendationEngine) RecommendPatterns(ctx context.Context, userID string) ([]*PatternRecommendation, error) {
    log.Infof("推荐日志模式: user=%s", userID)
    
    // 1. 获取用户画像
    profile := re.userProfiler.GetProfile(userID)
    
    // 2. 获取所有日志模式
    patterns := re.patternMatcher.GetPatterns()
    
    // 3. 基于协同过滤推荐
    recommendations := make([]*PatternRecommendation, 0)
    
    for _, pattern := range patterns {
        // 计算用户对该模式的兴趣分数
        score := re.calculatePatternInterest(pattern, profile)
        
        if score > 0.5 {
            recommendations = append(recommendations, &PatternRecommendation{
                Pattern:     pattern,
                Score:       score,
                Description: pattern.Description,
                Examples:    pattern.Examples,
            })
        }
    }
    
    // 4. 排序
    sort.Slice(recommendations, func(i, j int) bool {
        return recommendations[i].Score > recommendations[j].Score
    })
    
    return recommendations, nil
}

// 模式推荐
type PatternRecommendation struct {
    Pattern     *LogPattern // 日志模式
    Score       float64     // 推荐分数
    Description string      // 描述
    Examples    []string    // 示例
}

// 日志模式
type LogPattern struct {
    ID          string   // 模式ID
    Name        string   // 模式名称
    Pattern     string   // 正则表达式
    Description string   // 描述
    Examples    []string // 示例
    Category    string   // 分类
}

// 模式匹配器
type PatternMatcher struct {
    patterns []*LogPattern
}

// 获取所有模式
func (pm *PatternMatcher) GetPatterns() []*LogPattern {
    return pm.patterns
}

// 计算模式兴趣度
func (re *RecommendationEngine) calculatePatternInterest(pattern *LogPattern, profile *UserProfile) float64 {
    // 基于协同过滤算法
    // 实际实现应分析相似用户的行为
    
    // 简化实现：基于用户历史查看的日志类型
    var score float64
    
    if profile != nil {
        // 检查用户是否查看过该类型的日志
        for _, view := range profile.ViewHistory {
            // 实际应检查日志是否匹配该模式
            score += 0.1
        }
    }
    
    return math.Min(score, 1.0)
}

// 反馈管理器
type FeedbackManager struct {
    feedbacks map[string][]*Feedback
    mu        sync.RWMutex
}

// 反馈
type Feedback struct {
    RecommendationID string    // 推荐ID
    UserID           string    // 用户ID
    Helpful          bool      // 是否有用
    Clicked          bool      // 是否点击
    Comment          string    // 评论
    Timestamp        time.Time // 时间戳
}

// 提交反馈
func (fm *FeedbackManager) SubmitFeedback(feedback *Feedback) error {
    fm.mu.Lock()
    defer fm.mu.Unlock()
    
    if fm.feedbacks[feedback.RecommendationID] == nil {
        fm.feedbacks[feedback.RecommendationID] = make([]*Feedback, 0)
    }
    
    fm.feedbacks[feedback.RecommendationID] = append(
        fm.feedbacks[feedback.RecommendationID], 
        feedback,
    )
    
    log.Infof("收到反馈: recommendation=%s, helpful=%v", 
        feedback.RecommendationID, feedback.Helpful)
    
    return nil
}

// 获取反馈统计
func (fm *FeedbackManager) GetStatistics(recommendationID string) *FeedbackStatistics {
    fm.mu.RLock()
    defer fm.mu.RUnlock()
    
    feedbacks := fm.feedbacks[recommendationID]
    if len(feedbacks) == 0 {
        return &FeedbackStatistics{}
    }
    
    stats := &FeedbackStatistics{
        Total: len(feedbacks),
    }
    
    for _, feedback := range feedbacks {
        if feedback.Helpful {
            stats.Helpful++
        }
        if feedback.Clicked {
            stats.Clicked++
        }
    }
    
    stats.HelpfulRate = float64(stats.Helpful) / float64(stats.Total) * 100
    stats.ClickRate = float64(stats.Clicked) / float64(stats.Total) * 100
    
    return stats
}

// 反馈统计
type FeedbackStatistics struct {
    Total       int     // 总反馈数
    Helpful     int     // 有用数
    Clicked     int     // 点击数
    HelpfulRate float64 // 有用率（%）
    ClickRate   float64 // 点击率（%）
}

// 推荐指标
type RecommendationMetrics struct {
    totalRecommendations int64
    totalClicks          int64
    typeMetrics          map[string]*TypeMetrics
    mu                   sync.RWMutex
}

// 类型指标
type TypeMetrics struct {
    Type            string
    Recommendations int64
    Clicks          int64
    ClickRate       float64
    AvgDuration     time.Duration
}

// 记录推荐
func (rm *RecommendationMetrics) RecordRecommendation(recType string, count int, duration time.Duration) {
    rm.mu.Lock()
    defer rm.mu.Unlock()
    
    rm.totalRecommendations += int64(count)
    
    if rm.typeMetrics[recType] == nil {
        rm.typeMetrics[recType] = &TypeMetrics{Type: recType}
    }
    
    tm := rm.typeMetrics[recType]
    tm.Recommendations += int64(count)
    tm.AvgDuration = (tm.AvgDuration + duration) / 2
}

// 记录点击
func (rm *RecommendationMetrics) RecordClick(recType string) {
    rm.mu.Lock()
    defer rm.mu.Unlock()
    
    rm.totalClicks++
    
    if rm.typeMetrics[recType] != nil {
        tm := rm.typeMetrics[recType]
        tm.Clicks++
        if tm.Recommendations > 0 {
            tm.ClickRate = float64(tm.Clicks) / float64(tm.Recommendations) * 100
        }
    }
}

// 获取统计
func (rm *RecommendationMetrics) GetStatistics() *RecommendationStatistics {
    rm.mu.RLock()
    defer rm.mu.RUnlock()
    
    stats := &RecommendationStatistics{
        TotalRecommendations: rm.totalRecommendations,
        TotalClicks:          rm.totalClicks,
        TypeMetrics:          make(map[string]*TypeMetrics),
    }
    
    if rm.totalRecommendations > 0 {
        stats.OverallClickRate = float64(rm.totalClicks) / float64(rm.totalRecommendations) * 100
    }
    
    for k, v := range rm.typeMetrics {
        stats.TypeMetrics[k] = v
    }
    
    return stats
}

// 推荐统计
type RecommendationStatistics struct {
    TotalRecommendations int64                   // 总推荐数
    TotalClicks          int64                   // 总点击数
    OverallClickRate     float64                 // 总体点击率
    TypeMetrics          map[string]*TypeMetrics // 各类型指标
}

// 评估推荐效果
func (re *RecommendationEngine) EvaluateQuality(ctx context.Context) (*QualityReport, error) {
    log.Info("评估推荐质量")
    
    report := &QualityReport{
        Period:      "7d",
        GeneratedAt: time.Now(),
    }
    
    // 1. 获取推荐统计
    stats := re.metricsCollector.GetStatistics()
    report.Statistics = stats
    
    // 2. 计算准确率
    // 实际实现应基于用户反馈计算
    report.Accuracy = 0.78 // 78%
    
    // 3. 计算点击率
    report.ClickRate = stats.OverallClickRate
    
    // 4. 识别问题
    if report.ClickRate < 30 {
        report.Issues = append(report.Issues, "点击率低于目标值30%")
    }
    
    if report.Accuracy < 75 {
        report.Issues = append(report.Issues, "准确率低于目标值75%")
    }
    
    // 5. 生成改进建议
    if len(report.Issues) > 0 {
        report.Recommendations = []string{
            "优化推荐算法，提高相关性",
            "增加用户画像维度",
            "调整推荐数量和排序策略",
        }
    }
    
    return report, nil
}

// 质量报告
type QualityReport struct {
    Period          string                    // 报告周期
    GeneratedAt     time.Time                 // 生成时间
    Statistics      *RecommendationStatistics // 统计数据
    Accuracy        float64                   // 准确率（%）
    ClickRate       float64                   // 点击率（%）
    Issues          []string                  // 问题列表
    Recommendations []string                  // 改进建议
}

// 推荐缓存
type RecommendationCache struct {
    cache map[string]*CacheEntry
    ttl   time.Duration
    mu    sync.RWMutex
}

// 缓存条目
type CacheEntry struct {
    Data      interface{}
    ExpiresAt time.Time
}

// 获取缓存
func (rc *RecommendationCache) Get(key string) interface{} {
    rc.mu.RLock()
    defer rc.mu.RUnlock()
    
    entry, exists := rc.cache[key]
    if !exists {
        return nil
    }
    
    if time.Now().After(entry.ExpiresAt) {
        return nil
    }
    
    return entry.Data
}

// 设置缓存
func (rc *RecommendationCache) Set(key string, data interface{}) {
    rc.mu.Lock()
    defer rc.mu.Unlock()
    
    rc.cache[key] = &CacheEntry{
        Data:      data,
        ExpiresAt: time.Now().Add(rc.ttl),
    }
}

// 推荐记录
type RecommendationRecord struct {
    Type      string        // 推荐类型
    UserID    string        // 用户ID
    TargetID  string        // 目标ID
    Count     int           // 推荐数量
    Duration  time.Duration // 耗时
    Timestamp time.Time     // 时间戳
}
```

**关键实现点**:

1. 基于用户历史行为（搜索、查看、操作）构建用户画像，提供个性化推荐
2. 实现多维度日志关联（时间关联、实体关联、因果关联），自动推荐相关日志
3. 提供智能查询建议，支持自动补全、历史查询、热门查询等10种查询模式
4. 实现告警相关日志推荐，响应时间控制在2秒内，快速定位告警原因
5. 基于协同过滤算法推荐日志模式，发现用户可能感兴趣的日志类型
6. 提供完整的反馈机制，用户可以标记推荐是否有用，用于优化推荐算法
7. 定期评估推荐效果，生成质量报告，包括准确率、点击率、问题识别和改进建议

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| recommendation_enabled | bool | true | 是否启用推荐 |
| max_recommendations | int | 5 | 最大推荐数量 |
| min_confidence | float | 0.5 | 最小置信度 |
| cache_ttl | duration | 5m | 缓存过期时间 |
| enable_personalization | bool | true | 是否启用个性化 |
| enable_collaborative | bool | true | 是否启用协同过滤 |
| ranking_algorithm | string | "score" | 排序算法 |
| feedback_enabled | bool | true | 是否启用反馈 |
| evaluation_interval | duration | 168h | 评估间隔（7天） |

**热更新机制**:

- 更新方式: Redis Pub/Sub + PostgreSQL
- 生效时间: 立即生效（下次推荐生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志并发送告警

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的推荐配置
2. WHEN 最大推荐数量变更时，THE System SHALL 在下次推荐时使用新的数量限制
3. THE System SHALL 支持通过 API 查询当前生效的推荐配置
4. THE System SHALL 记录所有推荐配置变更的审计日志
5. WHEN 排序算法变更时，THE System SHALL 清空推荐缓存并使用新算法重新计算

---
## API 接口汇总表

模块十六提供以下 API 接口（从API-16-568开始，延续模块15的编号）：

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-16-568 | 获取模板列表 | 高级功能补充 | GET | /api/v1/templates | template.read | Query: page,size,category | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | 张三 | 需求16-62 |
| API-16-569 | 获取模板详情 | 高级功能补充 | GET | /api/v1/templates/{id} | template.read | Path: id | {code:0,data:{id,name,pattern}} | 200/401/403/404/500 | v1 | 是 | 是 | 张三 | 需求16-62 |
| API-16-570 | 创建模板 | 高级功能补充 | POST | /api/v1/templates | template.write | Body: {name,pattern,fields,category} | {code:0,data:{id}} | 200/400/401/403/500 | v1 | 否 | 否 | 张三 | 需求16-62 |
| API-16-571 | 更新模板 | 高级功能补充 | PUT | /api/v1/templates/{id} | template.write | Path: id, Body: {name,pattern,fields} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 张三 | 需求16-62 |
| API-16-572 | 删除模板 | 高级功能补充 | DELETE | /api/v1/templates/{id} | template.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 张三 | 需求16-62 |
| API-16-573 | 测试模板 | 高级功能补充 | POST | /api/v1/templates/{id}/test | template.read | Path: id, Body: {sample_logs} | {code:0,data:{matches:[]}} | 200/400/401/403/404/500 | v1 | 是 | 否 | 张三 | 需求16-62 |
| API-16-574 | 验证模板 | 高级功能补充 | POST | /api/v1/templates/{id}/validate | template.read | Path: id | {code:0,data:{valid:true}} | 200/401/403/404/500 | v1 | 是 | 否 | 张三 | 需求16-62 |
| API-16-575 | 获取模板版本历史 | 高级功能补充 | GET | /api/v1/templates/{id}/versions | template.read | Path: id | {code:0,data:{versions:[]}} | 200/401/403/404/500 | v1 | 是 | 是 | 张三 | 需求16-62 |
| API-16-576 | 回滚到指定版本 | 高级功能补充 | POST | /api/v1/templates/{id}/versions/{version}/rollback | template.write | Path: id,version | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 否 | 否 | 张三 | 需求16-62 |
| API-16-577 | 获取模板推荐 | 高级功能补充 | POST | /api/v1/templates/recommend | template.read | Body: {log_samples} | {code:0,data:{templates:[]}} | 200/400/401/403/500 | v1 | 是 | 否 | 张三 | 需求16-62 |
| API-16-578 | 导入模板 | 高级功能补充 | POST | /api/v1/templates/import | template.write | Body: file | {code:0,data:{imported:[]}} | 200/400/401/403/500 | v1 | 否 | 否 | 张三 | 需求16-62 |
| API-16-579 | 导出模板 | 高级功能补充 | GET | /api/v1/templates/{id}/export | template.read | Path: id, Query: format | 文件流 | 200/401/403/404/500 | v1 | 是 | 否 | 张三 | 需求16-62 |
| API-16-580 | 获取预置模板 | 高级功能补充 | GET | /api/v1/templates/presets | template.read | 无 | {code:0,data:{presets:[]}} | 200/401/403/500 | v1 | 是 | 是 | 张三 | 需求16-62 |
| API-16-581 | 评估日志质量 | 高级功能补充 | POST | /api/v1/quality/evaluate | quality.read | Body: {log_entries,dimensions} | {code:0,data:{score,issues}} | 200/400/401/403/500 | v1 | 是 | 否 | 李四 | 需求16-63 |
| API-16-582 | 获取质量报告 | 高级功能补充 | GET | /api/v1/quality/report | quality.read | Query: start_time,end_time,source | {code:0,data:{report}} | 200/401/403/500 | v1 | 是 | 是 | 李四 | 需求16-63 |
| API-16-583 | 获取质量问题列表 | 高级功能补充 | GET | /api/v1/quality/issues | quality.read | Query: page,size,severity | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | 李四 | 需求16-63 |
| API-16-584 | 获取问题详情 | 高级功能补充 | GET | /api/v1/quality/issues/{id} | quality.read | Path: id | {code:0,data:{id,type,severity}} | 200/401/403/404/500 | v1 | 是 | 是 | 李四 | 需求16-63 |
| API-16-585 | 修复质量问题 | 高级功能补充 | POST | /api/v1/quality/issues/{id}/fix | quality.write | Path: id, Body: {fix_action} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 否 | 否 | 李四 | 需求16-63 |
| API-16-586 | 获取质量统计 | 高级功能补充 | GET | /api/v1/quality/statistics | quality.read | Query: period,group_by | {code:0,data:{stats}} | 200/401/403/500 | v1 | 是 | 是 | 李四 | 需求16-63 |
| API-16-587 | 获取质量趋势 | 高级功能补充 | GET | /api/v1/quality/trends | quality.read | Query: start_time,end_time | {code:0,data:{trends:[]}} | 200/401/403/500 | v1 | 是 | 是 | 李四 | 需求16-63 |
| API-16-588 | 创建质量规则 | 高级功能补充 | POST | /api/v1/quality/rules | quality.write | Body: {name,dimension,threshold} | {code:0,data:{rule_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 李四 | 需求16-63 |
| API-16-589 | 更新质量规则 | 高级功能补充 | PUT | /api/v1/quality/rules/{id} | quality.write | Path: id, Body: {threshold} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 李四 | 需求16-63 |
| API-16-590 | 删除质量规则 | 高级功能补充 | DELETE | /api/v1/quality/rules/{id} | quality.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 李四 | 需求16-63 |
| API-16-591 | 获取改进建议 | 高级功能补充 | GET | /api/v1/quality/recommendations | quality.read | Query: source | {code:0,data:{recommendations:[]}} | 200/401/403/500 | v1 | 是 | 否 | 李四 | 需求16-63 |
| API-16-592 | 获取路由规则列表 | 高级功能补充 | GET | /api/v1/routing/rules | routing.read | Query: page,size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | 王五 | 需求16-64 |
| API-16-593 | 获取路由规则详情 | 高级功能补充 | GET | /api/v1/routing/rules/{id} | routing.read | Path: id | {code:0,data:{id,name,condition}} | 200/401/403/404/500 | v1 | 是 | 是 | 王五 | 需求16-64 |
| API-16-594 | 创建路由规则 | 高级功能补充 | POST | /api/v1/routing/rules | routing.write | Body: {name,condition,strategy,targets} | {code:0,data:{rule_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 王五 | 需求16-64 |
| API-16-595 | 更新路由规则 | 高级功能补充 | PUT | /api/v1/routing/rules/{id} | routing.write | Path: id, Body: {condition,strategy} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 王五 | 需求16-64 |
| API-16-596 | 删除路由规则 | 高级功能补充 | DELETE | /api/v1/routing/rules/{id} | routing.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 王五 | 需求16-64 |
| API-16-597 | 启用路由规则 | 高级功能补充 | POST | /api/v1/routing/rules/{id}/enable | routing.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 王五 | 需求16-64 |
| API-16-598 | 禁用路由规则 | 高级功能补充 | POST | /api/v1/routing/rules/{id}/disable | routing.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 王五 | 需求16-64 |
| API-16-599 | 测试路由规则 | 高级功能补充 | POST | /api/v1/routing/rules/{id}/test | routing.read | Path: id, Body: {sample_logs} | {code:0,data:{results:[]}} | 200/400/401/403/404/500 | v1 | 是 | 否 | 王五 | 需求16-64 |
| API-16-600 | 获取路由统计 | 高级功能补充 | GET | /api/v1/routing/statistics | routing.read | Query: period | {code:0,data:{stats}} | 200/401/403/500 | v1 | 是 | 是 | 王五 | 需求16-64 |
| API-16-601 | 获取路由目标列表 | 高级功能补充 | GET | /api/v1/routing/targets | routing.read | 无 | {code:0,data:{targets:[]}} | 200/401/403/500 | v1 | 是 | 是 | 王五 | 需求16-64 |
| API-16-602 | 创建路由目标 | 高级功能补充 | POST | /api/v1/routing/targets | routing.write | Body: {name,type,config} | {code:0,data:{target_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 王五 | 需求16-64 |
| API-16-603 | 更新路由目标 | 高级功能补充 | PUT | /api/v1/routing/targets/{id} | routing.write | Path: id, Body: {config} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 王五 | 需求16-64 |
| API-16-604 | 删除路由目标 | 高级功能补充 | DELETE | /api/v1/routing/targets/{id} | routing.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 王五 | 需求16-64 |
| API-16-605 | 检查目标健康状态 | 高级功能补充 | GET | /api/v1/routing/targets/{id}/health | routing.read | Path: id | {code:0,data:{healthy:true}} | 200/401/403/404/500 | v1 | 是 | 否 | 王五 | 需求16-64 |
| API-16-606 | 获取压缩策略列表 | 高级功能补充 | GET | /api/v1/compression/strategies | compression.read | Query: page,size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | 赵六 | 需求16-65 |
| API-16-607 | 获取压缩策略详情 | 高级功能补充 | GET | /api/v1/compression/strategies/{id} | compression.read | Path: id | {code:0,data:{id,algorithm,level}} | 200/401/403/404/500 | v1 | 是 | 是 | 赵六 | 需求16-65 |
| API-16-608 | 创建压缩策略 | 高级功能补充 | POST | /api/v1/compression/strategies | compression.write | Body: {name,algorithm,level,condition} | {code:0,data:{strategy_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 赵六 | 需求16-65 |
| API-16-609 | 更新压缩策略 | 高级功能补充 | PUT | /api/v1/compression/strategies/{id} | compression.write | Path: id, Body: {algorithm,level} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 赵六 | 需求16-65 |
| API-16-610 | 删除压缩策略 | 高级功能补充 | DELETE | /api/v1/compression/strategies/{id} | compression.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 赵六 | 需求16-65 |
| API-16-611 | 启用压缩策略 | 高级功能补充 | POST | /api/v1/compression/strategies/{id}/enable | compression.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 赵六 | 需求16-65 |
| API-16-612 | 禁用压缩策略 | 高级功能补充 | POST | /api/v1/compression/strategies/{id}/disable | compression.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 赵六 | 需求16-65 |
| API-16-613 | 测试压缩效果 | 高级功能补充 | POST | /api/v1/compression/test | compression.read | Body: {algorithm,level,data} | {code:0,data:{ratio,time}} | 200/400/401/403/500 | v1 | 是 | 否 | 赵六 | 需求16-65 |
| API-16-614 | 获取压缩统计 | 高级功能补充 | GET | /api/v1/compression/statistics | compression.read | Query: period | {code:0,data:{stats}} | 200/401/403/500 | v1 | 是 | 是 | 赵六 | 需求16-65 |
| API-16-615 | 获取支持的压缩算法 | 高级功能补充 | GET | /api/v1/compression/algorithms | compression.read | 无 | {code:0,data:{algorithms:[]}} | 200/401/403/500 | v1 | 是 | 是 | 赵六 | 需求16-65 |
| API-16-616 | 创建压缩任务 | 高级功能补充 | POST | /api/v1/compression/tasks | compression.write | Body: {strategy_id,target} | {code:0,data:{task_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 赵六 | 需求16-65 |
| API-16-617 | 获取压缩任务状态 | 高级功能补充 | GET | /api/v1/compression/tasks/{id} | compression.read | Path: id | {code:0,data:{status,progress}} | 200/401/403/404/500 | v1 | 是 | 否 | 赵六 | 需求16-65 |
| API-16-618 | 取消压缩任务 | 高级功能补充 | DELETE | /api/v1/compression/tasks/{id} | compression.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 赵六 | 需求16-65 |
| API-16-619 | 获取成本分析 | 高级功能补充 | GET | /api/v1/compression/cost-analysis | compression.read | Query: period | {code:0,data:{analysis}} | 200/401/403/500 | v1 | 是 | 是 | 赵六 | 需求16-65 |
| API-16-620 | 创建导出任务 | 高级功能补充 | POST | /api/v1/export/jobs | export.write | Body: {format,query,destination} | {code:0,data:{job_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 孙七 | 需求16-66 |
| API-16-621 | 获取导出任务列表 | 高级功能补充 | GET | /api/v1/export/jobs | export.read | Query: page,size,status | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | 孙七 | 需求16-66 |
| API-16-622 | 获取导出任务详情 | 高级功能补充 | GET | /api/v1/export/jobs/{id} | export.read | Path: id | {code:0,data:{id,status,progress}} | 200/401/403/404/500 | v1 | 是 | 否 | 孙七 | 需求16-66 |
| API-16-623 | 取消导出任务 | 高级功能补充 | DELETE | /api/v1/export/jobs/{id} | export.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 孙七 | 需求16-66 |
| API-16-624 | 下载导出文件 | 高级功能补充 | GET | /api/v1/export/jobs/{id}/download | export.read | Path: id | 文件流 | 200/401/403/404/500 | v1 | 是 | 否 | 孙七 | 需求16-66 |
| API-16-625 | 获取支持的导出格式 | 高级功能补充 | GET | /api/v1/export/formats | export.read | 无 | {code:0,data:{formats:[]}} | 200/401/403/500 | v1 | 是 | 是 | 孙七 | 需求16-66 |
| API-16-626 | 验证导出配置 | 高级功能补充 | POST | /api/v1/export/validate | export.read | Body: {format,schema} | {code:0,data:{valid:true}} | 200/400/401/403/500 | v1 | 是 | 否 | 孙七 | 需求16-66 |
| API-16-627 | 获取导出目标列表 | 高级功能补充 | GET | /api/v1/export/destinations | export.read | 无 | {code:0,data:{destinations:[]}} | 200/401/403/500 | v1 | 是 | 是 | 孙七 | 需求16-66 |
| API-16-628 | 创建导出目标 | 高级功能补充 | POST | /api/v1/export/destinations | export.write | Body: {name,type,config} | {code:0,data:{dest_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 孙七 | 需求16-66 |
| API-16-629 | 更新导出目标 | 高级功能补充 | PUT | /api/v1/export/destinations/{id} | export.write | Path: id, Body: {config} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 孙七 | 需求16-66 |
| API-16-630 | 删除导出目标 | 高级功能补充 | DELETE | /api/v1/export/destinations/{id} | export.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 孙七 | 需求16-66 |
| API-16-631 | 测试导出目标连接 | 高级功能补充 | POST | /api/v1/export/destinations/{id}/test | export.read | Path: id | {code:0,data:{connected:true}} | 200/401/403/404/500 | v1 | 是 | 否 | 孙七 | 需求16-66 |
| API-16-632 | 获取导出统计 | 高级功能补充 | GET | /api/v1/export/statistics | export.read | Query: period | {code:0,data:{stats}} | 200/401/403/500 | v1 | 是 | 是 | 孙七 | 需求16-66 |
| API-16-633 | 创建定时导出 | 高级功能补充 | POST | /api/v1/export/schedule | export.write | Body: {cron,format,query,destination} | {code:0,data:{schedule_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 孙七 | 需求16-66 |
| API-16-634 | 获取定时导出列表 | 高级功能补充 | GET | /api/v1/export/schedule | export.read | 无 | {code:0,data:{schedules:[]}} | 200/401/403/500 | v1 | 是 | 是 | 孙七 | 需求16-66 |
| API-16-635 | 删除定时导出 | 高级功能补充 | DELETE | /api/v1/export/schedule/{id} | export.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 孙七 | 需求16-66 |
| API-16-636 | 获取脱敏审计记录 | 高级功能补充 | GET | /api/v1/masking/audit/records | masking.read | Query: page,size,start_time,end_time | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | 周八 | 需求16-67 |
| API-16-637 | 获取审计记录详情 | 高级功能补充 | GET | /api/v1/masking/audit/records/{id} | masking.read | Path: id | {code:0,data:{id,type,result}} | 200/401/403/404/500 | v1 | 是 | 是 | 周八 | 需求16-67 |
| API-16-638 | 执行抽样验证 | 高级功能补充 | POST | /api/v1/masking/audit/validate | masking.write | Body: {sampling_rate} | {code:0,data:{validation}} | 200/400/401/403/500 | v1 | 否 | 否 | 周八 | 需求16-67 |
| API-16-639 | 获取脱敏统计 | 高级功能补充 | GET | /api/v1/masking/audit/statistics | masking.read | Query: period | {code:0,data:{stats}} | 200/401/403/500 | v1 | 是 | 是 | 周八 | 需求16-67 |
| API-16-640 | 生成审计报告 | 高级功能补充 | GET | /api/v1/masking/audit/report | masking.read | Query: period,format | {code:0,data:{report}} | 200/401/403/500 | v1 | 是 | 否 | 周八 | 需求16-67 |
| API-16-641 | 获取脱敏覆盖率 | 高级功能补充 | GET | /api/v1/masking/audit/coverage | masking.read | Query: period | {code:0,data:{coverage}} | 200/401/403/500 | v1 | 是 | 是 | 周八 | 需求16-67 |
| API-16-642 | 获取脱敏问题列表 | 高级功能补充 | GET | /api/v1/masking/audit/issues | masking.read | Query: page,size,severity | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | 周八 | 需求16-67 |
| API-16-643 | 补救脱敏问题 | 高级功能补充 | POST | /api/v1/masking/audit/issues/{id}/remediate | masking.write | Path: id | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 否 | 否 | 周八 | 需求16-67 |
| API-16-644 | 获取规则有效性分析 | 高级功能补充 | GET | /api/v1/masking/audit/rules/effectiveness | masking.read | 无 | {code:0,data:{effectiveness}} | 200/401/403/500 | v1 | 是 | 是 | 周八 | 需求16-67 |
| API-16-645 | 获取敏感数据类型统计 | 高级功能补充 | GET | /api/v1/masking/audit/types | masking.read | Query: period | {code:0,data:{types}} | 200/401/403/500 | v1 | 是 | 是 | 周八 | 需求16-67 |
| API-16-646 | 导出审计数据 | 高级功能补充 | POST | /api/v1/masking/audit/export | masking.read | Body: {start_time,end_time,format} | {code:0,data:{export_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 周八 | 需求16-67 |
| API-16-647 | 获取修复规则列表 | 高级功能补充 | GET | /api/v1/autofix/rules | autofix.read | Query: page,size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | 吴九 | 需求16-68 |
| API-16-648 | 获取修复规则详情 | 高级功能补充 | GET | /api/v1/autofix/rules/{id} | autofix.read | Path: id | {code:0,data:{id,name,actions}} | 200/401/403/404/500 | v1 | 是 | 是 | 吴九 | 需求16-68 |
| API-16-649 | 创建修复规则 | 高级功能补充 | POST | /api/v1/autofix/rules | autofix.write | Body: {name,anomaly_type,condition,actions} | {code:0,data:{rule_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 吴九 | 需求16-68 |
| API-16-650 | 更新修复规则 | 高级功能补充 | PUT | /api/v1/autofix/rules/{id} | autofix.write | Path: id, Body: {condition,actions} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 吴九 | 需求16-68 |
| API-16-651 | 删除修复规则 | 高级功能补充 | DELETE | /api/v1/autofix/rules/{id} | autofix.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 吴九 | 需求16-68 |
| API-16-652 | 启用修复规则 | 高级功能补充 | POST | /api/v1/autofix/rules/{id}/enable | autofix.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 吴九 | 需求16-68 |
| API-16-653 | 禁用修复规则 | 高级功能补充 | POST | /api/v1/autofix/rules/{id}/disable | autofix.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 吴九 | 需求16-68 |
| API-16-654 | 模拟修复操作 | 高级功能补充 | POST | /api/v1/autofix/simulate | autofix.read | Body: {rule_id,anomaly} | {code:0,data:{simulation}} | 200/400/401/403/500 | v1 | 是 | 否 | 吴九 | 需求16-68 |
| API-16-655 | 获取修复任务列表 | 高级功能补充 | GET | /api/v1/autofix/tasks | autofix.read | Query: page,size,status | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | 吴九 | 需求16-68 |
| API-16-656 | 获取修复任务详情 | 高级功能补充 | GET | /api/v1/autofix/tasks/{id} | autofix.read | Path: id | {code:0,data:{id,status,result}} | 200/401/403/404/500 | v1 | 是 | 否 | 吴九 | 需求16-68 |
| API-16-657 | 批准修复任务 | 高级功能补充 | POST | /api/v1/autofix/tasks/{id}/approve | autofix.write | Path: id, Body: {approver,comment} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 否 | 否 | 吴九 | 需求16-68 |
| API-16-658 | 拒绝修复任务 | 高级功能补充 | POST | /api/v1/autofix/tasks/{id}/reject | autofix.write | Path: id, Body: {approver,reason} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 否 | 否 | 吴九 | 需求16-68 |
| API-16-659 | 回滚修复操作 | 高级功能补充 | POST | /api/v1/autofix/tasks/{id}/rollback | autofix.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 否 | 否 | 吴九 | 需求16-68 |
| API-16-660 | 获取修复统计 | 高级功能补充 | GET | /api/v1/autofix/statistics | autofix.read | Query: period | {code:0,data:{stats}} | 200/401/403/500 | v1 | 是 | 是 | 吴九 | 需求16-68 |
| API-16-661 | 获取修复历史 | 高级功能补充 | GET | /api/v1/autofix/history | autofix.read | Query: page,size,start_time,end_time | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | 吴九 | 需求16-68 |
| API-16-662 | 获取当前成本 | 高级功能补充 | GET | /api/v1/cost/current | cost.read | 无 | {code:0,data:{current}} | 200/401/403/500 | v1 | 是 | 是 | 郑十 | 需求16-69 |
| API-16-663 | 获取成本趋势 | 高级功能补充 | GET | /api/v1/cost/trend | cost.read | Query: period | {code:0,data:{trend:[]}} | 200/401/403/500 | v1 | 是 | 是 | 郑十 | 需求16-69 |
| API-16-664 | 获取成本明细 | 高级功能补充 | GET | /api/v1/cost/breakdown | cost.read | Query: period,dimension | {code:0,data:{breakdown}} | 200/401/403/500 | v1 | 是 | 是 | 郑十 | 需求16-69 |
| API-16-665 | 获取成本热点 | 高级功能补充 | GET | /api/v1/cost/hotspots | cost.read | Query: period,limit | {code:0,data:{hotspots:[]}} | 200/401/403/500 | v1 | 是 | 是 | 郑十 | 需求16-69 |
| API-16-666 | 预测未来成本 | 高级功能补充 | POST | /api/v1/cost/predict | cost.read | Body: {days} | {code:0,data:{prediction}} | 200/400/401/403/500 | v1 | 是 | 否 | 郑十 | 需求16-69 |
| API-16-667 | 获取优化建议 | 高级功能补充 | GET | /api/v1/cost/recommendations | cost.read | 无 | {code:0,data:{recommendations:[]}} | 200/401/403/500 | v1 | 是 | 否 | 郑十 | 需求16-69 |
| API-16-668 | 执行成本优化 | 高级功能补充 | POST | /api/v1/cost/optimize | cost.write | Body: {recommendation_id} | {code:0,data:{result}} | 200/400/401/403/500 | v1 | 否 | 否 | 郑十 | 需求16-69 |
| API-16-669 | 获取优化历史 | 高级功能补充 | GET | /api/v1/cost/optimization/history | cost.read | Query: page,size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | 郑十 | 需求16-69 |
| API-16-670 | 获取优化效果 | 高级功能补充 | GET | /api/v1/cost/optimization/effect | cost.read | Query: optimization_id | {code:0,data:{effect}} | 200/401/403/500 | v1 | 是 | 是 | 郑十 | 需求16-69 |
| API-16-671 | 获取预算信息 | 高级功能补充 | GET | /api/v1/cost/budget | cost.read | 无 | {code:0,data:{budget}} | 200/401/403/500 | v1 | 是 | 是 | 郑十 | 需求16-69 |
| API-16-672 | 更新预算配置 | 高级功能补充 | PUT | /api/v1/cost/budget | cost.write | Body: {monthly_budget,alert_threshold} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | 郑十 | 需求16-69 |
| API-16-673 | 获取预算使用情况 | 高级功能补充 | GET | /api/v1/cost/budget/usage | cost.read | 无 | {code:0,data:{usage}} | 200/401/403/500 | v1 | 是 | 是 | 郑十 | 需求16-69 |
| API-16-674 | 生成成本报告 | 高级功能补充 | GET | /api/v1/cost/report | cost.read | Query: period,format | {code:0,data:{report}} | 200/401/403/500 | v1 | 是 | 否 | 郑十 | 需求16-69 |
| API-16-675 | 获取优化策略列表 | 高级功能补充 | GET | /api/v1/cost/strategies | cost.read | 无 | {code:0,data:{strategies:[]}} | 200/401/403/500 | v1 | 是 | 是 | 郑十 | 需求16-69 |
| API-16-676 | 启用优化策略 | 高级功能补充 | POST | /api/v1/cost/strategies/{id}/enable | cost.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 郑十 | 需求16-69 |
| API-16-677 | 禁用优化策略 | 高级功能补充 | POST | /api/v1/cost/strategies/{id}/disable | cost.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 郑十 | 需求16-69 |
| API-16-678 | 获取相关日志推荐 | 高级功能补充 | GET | /api/v1/recommendation/related-logs | recommendation.read | Query: log_id,user_id,limit | {code:0,data:{logs:[]}} | 200/401/403/500 | v1 | 是 | 是 | 钱十一 | 需求16-70 |
| API-16-679 | 获取查询建议 | 高级功能补充 | GET | /api/v1/recommendation/query-suggestions | recommendation.read | Query: input,user_id,limit | {code:0,data:{suggestions:[]}} | 200/401/403/500 | v1 | 是 | 是 | 钱十一 | 需求16-70 |
| API-16-680 | 获取热门查询 | 高级功能补充 | GET | /api/v1/recommendation/hot-queries | recommendation.read | Query: limit | {code:0,data:{queries:[]}} | 200/401/403/500 | v1 | 是 | 是 | 钱十一 | 需求16-70 |
| API-16-681 | 获取告警相关日志 | 高级功能补充 | GET | /api/v1/recommendation/alert-logs | recommendation.read | Query: alert_id,user_id,limit | {code:0,data:{logs:[]}} | 200/401/403/500 | v1 | 是 | 是 | 钱十一 | 需求16-70 |
| API-16-682 | 获取日志模式推荐 | 高级功能补充 | GET | /api/v1/recommendation/patterns | recommendation.read | Query: user_id,limit | {code:0,data:{patterns:[]}} | 200/401/403/500 | v1 | 是 | 是 | 钱十一 | 需求16-70 |
| API-16-683 | 提交推荐反馈 | 高级功能补充 | POST | /api/v1/recommendation/feedback | recommendation.write | Body: {recommendation_id,helpful,clicked,comment} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | 钱十一 | 需求16-70 |
| API-16-684 | 获取推荐统计 | 高级功能补充 | GET | /api/v1/recommendation/statistics | recommendation.read | Query: period | {code:0,data:{stats}} | 200/401/403/500 | v1 | 是 | 是 | 钱十一 | 需求16-70 |
| API-16-685 | 获取推荐质量报告 | 高级功能补充 | GET | /api/v1/recommendation/quality | recommendation.read | Query: period | {code:0,data:{quality}} | 200/401/403/500 | v1 | 是 | 是 | 钱十一 | 需求16-70 |
| API-16-686 | 获取用户画像 | 高级功能补充 | GET | /api/v1/recommendation/user-profile | recommendation.read | Query: user_id | {code:0,data:{profile}} | 200/401/403/500 | v1 | 是 | 是 | 钱十一 | 需求16-70 |
| API-16-687 | 更新用户画像 | 高级功能补充 | PUT | /api/v1/recommendation/user-profile | recommendation.write | Body: {user_id,preferences} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | 钱十一 | 需求16-70 |
| API-16-688 | 记录日志查看行为 | 高级功能补充 | POST | /api/v1/recommendation/track-view | recommendation.write | Body: {user_id,log_id,duration} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | 钱十一 | 需求16-70 |
| API-16-689 | 记录搜索行为 | 高级功能补充 | POST | /api/v1/recommendation/track-search | recommendation.write | Body: {user_id,query,result_count} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | 钱十一 | 需求16-70 |

**接口统计**:
- 总接口数: 122个
- 接口编号范围: API-16-568 至 API-16-689
- GET接口: 68个 (55.7%)
- POST接口: 40个 (32.8%)
- PUT接口: 9个 (7.4%)
- DELETE接口: 5个 (4.1%)

**接口分类**:
1. 日志模板管理 (API-16-568 ~ API-16-580): 13个接口
2. 日志质量评估 (API-16-581 ~ API-16-591): 11个接口
3. 智能日志路由 (API-16-592 ~ API-16-605): 14个接口
4. 压缩策略管理 (API-16-606 ~ API-16-619): 14个接口
5. 标准化导出 (API-16-620 ~ API-16-635): 16个接口
6. 脱敏审计 (API-16-636 ~ API-16-646): 11个接口
7. 异常自动修复 (API-16-647 ~ API-16-661): 15个接口
8. 成本优化 (API-16-662 ~ API-16-677): 16个接口
9. 智能推荐 (API-16-678 ~ API-16-689): 12个接口

---

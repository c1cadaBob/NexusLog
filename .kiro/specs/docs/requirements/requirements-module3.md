# 模块三：日志分析

> **文档版本**: v1.0  
> **创建日期**: 2026-01-29  
> **所属模块**: 模块三：日志分析
> **需求编号**: 

---

**模块概述**: 

负责日志数据的实时分析和智能查询，支持模式匹配、统计聚合、全文搜索、自然语言查询、机器学习异常检测和智能聚类等高级分析能力。

**模块技术栈**:
- 实时分析引擎：Apache Flink 1.18 (流式处理、CEP)
- 搜索引擎：Elasticsearch 8.x (全文检索、聚合分析)
- 机器学习：Python 3.11 + scikit-learn 1.3 (离线训练)
- 在线推理：Go + ONNX Runtime 1.16 (生产环境推理)
- NLP 引擎：OpenAI API / 本地 BERT (自然语言查询)
- 配置管理：PostgreSQL + Redis 配置中心（热配置）

**模块架构**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                日志分析模块整体架构                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            配置中心（控制面）                                          │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ PostgreSQL   │───▶│    Redis     │───▶│   Pub/Sub    │                           │ │
│  │  │ (分析规则/   │    │ (当前规则)   │    │ (规则变更)   │                           │ │
│  │  │  ML模型)     │    │              │    │              │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────┬───────┘                           │ │
│  └────────────────────────────────────────────────────┼─────────────────────────────────┘ │
│                                                       │                                   │
│                                                       ▼                                   │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                        实时分析层 (Apache Flink)                                       │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │                        流式处理引擎                                          │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 模式匹配     │    │ 统计聚合     │    │ 事件关联     │                 │     │ │
│  │  │  │ (Regex/Grok) │───▶│ (Count/Sum)  │───▶│   (CEP)      │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  │  处理延迟: < 2s  |  吞吐量: 100万/秒  |  准确率: 100%                      │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │                        复杂事件处理 (CEP)                                    │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 事件序列     │───▶│ 模式检测     │───▶│ 告警触发     │                 │     │ │
│  │  │  │ (Sequence)   │    │ (Pattern)    │    │ (Alert)      │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                        查询分析层 (Elasticsearch)                                     │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │                        基础查询引擎                                          │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 全文搜索     │    │ 字段过滤     │    │ 时间范围     │                 │     │ │
│  │  │  │ (Full-Text)  │───▶│  (Filter)    │───▶│  (Range)     │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  │  响应时间: < 500ms  |  QPS: 1万  |  准确率: 95%                             │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │                        高级查询引擎                                          │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │  SQL 查询    │    │  聚合分析    │    │  高级查询    │                 │     │ │
│  │  │  │ (SQL API)    │───▶│ (Aggregation)│───▶│  (DSL)       │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │                        查询优化层                                            │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 查询缓存     │    │ 查询重写     │    │ 查询模板     │                 │     │ │
│  │  │  │ (Redis)      │    │ (Optimizer)  │    │ (Template)   │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                        智能分析层 (ML/NLP)                                            │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │                        自然语言处理 (NLP)                                    │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 意图识别     │───▶│ 实体提取     │───▶│ 查询生成     │                 │     │ │
│  │  │  │ (Intent)     │    │ (NER)        │    │ (Query Gen)  │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  │  支持语言: 中文/英文  |  准确率: 85%  |  响应时间: < 2s                    │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │                        机器学习引擎                                          │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 异常检测     │    │ 日志聚类     │    │ 模式识别     │                 │     │ │
│  │  │  │(Isolation F) │───▶│  (K-means)   │───▶│  (Pattern)   │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  │  检测率: 90%  |  误报率: < 5%  |  处理延迟: < 1s                            │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │                        模型管理                                              │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 模型训练     │    │ 在线推理     │    │ 模型更新     │                 │     │ │
│  │  │  │ (Python/ML)  │───▶│ (Go/ONNX)    │───▶│ (Hot Reload) │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            监控与优化                                              │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                       │ │
│  │  │ 查询性能监控  │    │ 分析任务监控  │    │ 模型性能监控  │                       │ │
│  │  │ (响应时间)   │    │ (处理延迟)   │    │ (准确率)     │                       │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                       │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**架构说明**:

1. **配置中心层**: 使用 PostgreSQL 存储分析规则和 ML 模型配置，Redis 分发当前生效规则
2. **实时分析层**: 使用 Apache Flink 进行流式处理，支持模式匹配、统计聚合、复杂事件处理
3. **查询分析层**: 使用 Elasticsearch 提供全文搜索、SQL 查询、聚合分析能力
4. **智能分析层**: 集成 NLP 和 ML 能力，支持自然语言查询、异常检测、日志聚类
5. **监控层**: 实时监控查询性能、分析任务、模型准确率

**分析能力矩阵**:

| 分析类型 | 技术方案 | 延迟 | 吞吐量 | 准确率 |
|----------|----------|------|--------|--------|
| 实时模式匹配 | Flink CEP | < 2s | 100万/秒 | 100% |
| 统计聚合 | Flink + ES | < 1s | 100万/秒 | 100% |
| 全文搜索 | Elasticsearch | < 500ms | 1万QPS | 95% |
| 异常检测 | Isolation Forest | < 1s | 10万/秒 | 90% |
| 日志聚类 | K-means | < 5s | 1万/秒 | 85% |
| 自然语言查询 | NLP + 规则 | < 2s | 100QPS | 85% |

**数据流向**:

```
日志流 → Flink 实时分析 → 模式匹配/聚合 → Elasticsearch 索引
         ↓                                    ↓
      CEP 事件关联                        全文搜索/SQL查询
         ↓                                    ↓
      告警触发                            查询结果
         
日志数据 → NLP 引擎 → 意图识别 → 查询生成 → Elasticsearch
         ↓
      ML 引擎 → 异常检测/聚类 → 分析结果
```

**需求列表**:
- 需求 3-9：实时日志分析 [MVP]
- 需求 3-10：高级日志查询与筛选 [MVP]
- 需求 3-11：自然语言查询 [Phase 2]
- 需求 3-12：机器学习异常检测 [Phase 2]
- 需求 3-13：智能日志聚类与摘要 [Phase 2]

---



#### 需求 3-9：实时日志分析 [MVP]

**用户故事**: 

作为安全分析师，我希望能够实时分析日志数据，以便及时发现异常行为和安全威胁。

**验收标准**:

1. THE Analysis_Engine SHALL 以低于 2 秒的端到端延迟处理传入的日志流
2. THE Analysis_Engine SHALL 支持模式匹配（正则表达式、Grok）、统计聚合（计数、求和、平均、百分位）
3. THE Analysis_Engine SHALL 关联来自多个数据源的日志，识别跨系统的事件模式
4. THE Analysis_Engine SHALL 能够处理每秒至少 100 万条日志数据
5. THE Query_Interface SHALL 支持全文搜索、字段过滤和时间范围查询，响应时间 ≤ 1 秒
6. THE Analysis_Engine SHALL 通过配置中心管理分析规则，支持热更新
7. WHEN 检测到匹配的模式时，THE Analysis_Engine SHALL 在 5 秒内生成分析结果

**实现方向**:

**实现方式**:

```go
// 实时分析引擎（基于 Flink）
type AnalysisEngine struct {
    flinkClient *flink.Client        // Flink 客户端
    rules       atomic.Value         // 分析规则（支持热更新）
    aggregator  *StreamAggregator    // 流式聚合器
    matcher     *PatternMatcher      // 模式匹配器
    correlator  *EventCorrelator     // 事件关联器
    config      atomic.Value         // 配置（支持热更新）
}

// 分析规则
type AnalysisRule struct {
    ID          string              // 规则 ID
    Name        string              // 规则名称
    Type        string              // 规则类型：pattern/aggregation/correlation
    Enabled     bool                // 是否启用
    Pattern     string              // 匹配模式（正则或 Grok）
    Aggregation AggregationConfig   // 聚合配置
    Correlation CorrelationConfig   // 关联配置
    Actions     []RuleAction        // 触发动作
}

// 聚合配置
type AggregationConfig struct {
    Function    string              // 聚合函数：count/sum/avg/min/max/percentile
    Field       string              // 聚合字段
    GroupBy     []string            // 分组字段
    Window      WindowConfig        // 时间窗口
    Threshold   float64             // 阈值
}

// 时间窗口配置
type WindowConfig struct {
    Type        string              // 窗口类型：tumbling/sliding/session
    Size        time.Duration       // 窗口大小
    Slide       time.Duration       // 滑动间隔（仅 sliding 窗口）
    Gap         time.Duration       // 会话间隔（仅 session 窗口）
}

// 关联配置
type CorrelationConfig struct {
    Sources     []string            // 数据源列表
    JoinKey     string              // 关联键
    TimeWindow  time.Duration       // 时间窗口
    Conditions  []CorrelationCondition // 关联条件
}

// 关联条件
type CorrelationCondition struct {
    Field       string              // 字段名
    Operator    string              // 操作符：eq/ne/gt/lt/contains
    Value       interface{}         // 比较值
}

// Flink 流式处理任务
func (ae *AnalysisEngine) StartStreamProcessing(ctx context.Context) error {
    log.Info("启动实时分析引擎")
    
    // 1. 创建 Flink 流环境
    env := flink.NewStreamExecutionEnvironment()
    env.SetParallelism(10) // 设置并行度
    
    // 2. 从 Kafka 读取日志流
    kafkaSource := kafka.NewSource(
        kafka.SourceConfig{
            Brokers: []string{"kafka:9092"},
            Topics:  []string{"logs"},
            GroupID: "analysis-engine",
        },
    )
    
    stream := env.AddSource(kafkaSource)
    
    // 3. 解析日志
    parsedStream := stream.Map(func(record []byte) (*LogEntry, error) {
        var entry LogEntry
        if err := json.Unmarshal(record, &entry); err != nil {
            return nil, err
        }
        return &entry, nil
    })
    
    // 4. 应用分析规则
    rules := ae.rules.Load().([]*AnalysisRule)
    
    for _, rule := range rules {
        if !rule.Enabled {
            continue
        }
        
        switch rule.Type {
        case "pattern":
            // 模式匹配
            ae.applyPatternMatching(parsedStream, rule)
            
        case "aggregation":
            // 统计聚合
            ae.applyAggregation(parsedStream, rule)
            
        case "correlation":
            // 事件关联
            ae.applyCorrelation(parsedStream, rule)
        }
    }
    
    // 5. 执行 Flink 任务
    if err := env.Execute("log-analysis"); err != nil {
        return fmt.Errorf("执行 Flink 任务失败: %w", err)
    }
    
    return nil
}

// 应用模式匹配
func (ae *AnalysisEngine) applyPatternMatching(stream *flink.DataStream, rule *AnalysisRule) {
    // 编译正则表达式或 Grok 模式
    pattern, err := ae.matcher.CompilePattern(rule.Pattern)
    if err != nil {
        log.Error("编译模式失败", "rule_id", rule.ID, "error", err)
        return
    }
    
    // 过滤匹配的日志
    matchedStream := stream.Filter(func(entry *LogEntry) bool {
        return pattern.Match(entry.Message)
    })
    
    // 执行动作
    matchedStream.Process(func(entry *LogEntry) {
        log.Info("检测到匹配模式", "rule_id", rule.ID, "entry", entry)
        
        // 执行规则动作
        for _, action := range rule.Actions {
            ae.executeAction(action, entry)
        }
    })
}

// 应用统计聚合
func (ae *AnalysisEngine) applyAggregation(stream *flink.DataStream, rule *AnalysisRule) {
    agg := rule.Aggregation
    
    // 按分组字段分组
    keyedStream := stream.KeyBy(func(entry *LogEntry) string {
        keys := make([]string, len(agg.GroupBy))
        for i, field := range agg.GroupBy {
            keys[i] = entry.GetField(field)
        }
        return strings.Join(keys, "|")
    })
    
    // 应用时间窗口
    var windowedStream *flink.WindowedStream
    
    switch agg.Window.Type {
    case "tumbling":
        // 滚动窗口
        windowedStream = keyedStream.TimeWindow(agg.Window.Size)
        
    case "sliding":
        // 滑动窗口
        windowedStream = keyedStream.SlidingTimeWindow(agg.Window.Size, agg.Window.Slide)
        
    case "session":
        // 会话窗口
        windowedStream = keyedStream.SessionWindow(agg.Window.Gap)
    }
    
    // 应用聚合函数
    aggregatedStream := windowedStream.Aggregate(func(entries []*LogEntry) *AggregationResult {
        result := &AggregationResult{
            RuleID:    rule.ID,
            Timestamp: time.Now(),
            GroupKey:  entries[0].GetGroupKey(agg.GroupBy),
            Count:     len(entries),
        }
        
        switch agg.Function {
        case "count":
            result.Value = float64(len(entries))
            
        case "sum":
            sum := 0.0
            for _, entry := range entries {
                sum += entry.GetFieldFloat(agg.Field)
            }
            result.Value = sum
            
        case "avg":
            sum := 0.0
            for _, entry := range entries {
                sum += entry.GetFieldFloat(agg.Field)
            }
            result.Value = sum / float64(len(entries))
            
        case "min":
            min := math.MaxFloat64
            for _, entry := range entries {
                val := entry.GetFieldFloat(agg.Field)
                if val < min {
                    min = val
                }
            }
            result.Value = min
            
        case "max":
            max := -math.MaxFloat64
            for _, entry := range entries {
                val := entry.GetFieldFloat(agg.Field)
                if val > max {
                    max = val
                }
            }
            result.Value = max
            
        case "percentile":
            // 计算百分位数
            values := make([]float64, len(entries))
            for i, entry := range entries {
                values[i] = entry.GetFieldFloat(agg.Field)
            }
            sort.Float64s(values)
            
            p := int(float64(len(values)) * 0.95) // P95
            result.Value = values[p]
        }
        
        return result
    })
    
    // 检查阈值并触发动作
    aggregatedStream.Process(func(result *AggregationResult) {
        if result.Value > agg.Threshold {
            log.Warn("聚合值超过阈值",
                "rule_id", rule.ID,
                "group_key", result.GroupKey,
                "value", result.Value,
                "threshold", agg.Threshold)
            
            // 执行规则动作
            for _, action := range rule.Actions {
                ae.executeAction(action, result)
            }
        }
    })
}

// 应用事件关联
func (ae *AnalysisEngine) applyCorrelation(stream *flink.DataStream, rule *AnalysisRule) {
    corr := rule.Correlation
    
    // 创建多流关联
    streams := make([]*flink.DataStream, len(corr.Sources))
    
    for i, source := range corr.Sources {
        // 过滤特定数据源的日志
        streams[i] = stream.Filter(func(entry *LogEntry) bool {
            return entry.Source == source
        })
    }
    
    // 使用 CEP (Complex Event Processing) 进行关联
    pattern := flink.Pattern().
        Begin("first").Where(func(entry *LogEntry) bool {
            return entry.Source == corr.Sources[0]
        }).
        FollowedBy("second").Where(func(entry *LogEntry) bool {
            return entry.Source == corr.Sources[1]
        }).
        Within(corr.TimeWindow)
    
    // 应用 CEP 模式
    patternStream := flink.CEP(stream, pattern)
    
    // 选择匹配的事件序列
    patternStream.Select(func(events map[string][]*LogEntry) *CorrelationResult {
        first := events["first"][0]
        second := events["second"][0]
        
        // 检查关联条件
        if !ae.checkCorrelationConditions(first, second, corr.Conditions) {
            return nil
        }
        
        return &CorrelationResult{
            RuleID:    rule.ID,
            Timestamp: time.Now(),
            Events:    []*LogEntry{first, second},
            JoinKey:   first.GetField(corr.JoinKey),
        }
    }).Process(func(result *CorrelationResult) {
        if result != nil {
            log.Info("检测到关联事件", "rule_id", rule.ID, "join_key", result.JoinKey)
            
            // 执行规则动作
            for _, action := range rule.Actions {
                ae.executeAction(action, result)
            }
        }
    })
}

// 检查关联条件
func (ae *AnalysisEngine) checkCorrelationConditions(first, second *LogEntry, conditions []CorrelationCondition) bool {
    for _, cond := range conditions {
        val1 := first.GetField(cond.Field)
        val2 := second.GetField(cond.Field)
        
        switch cond.Operator {
        case "eq":
            if val1 != val2 {
                return false
            }
        case "ne":
            if val1 == val2 {
                return false
            }
        case "contains":
            if !strings.Contains(val1, cond.Value.(string)) {
                return false
            }
        }
    }
    
    return true
}

// 模式匹配器
type PatternMatcher struct {
    grokPatterns map[string]*grok.Pattern
}

// 编译模式
func (pm *PatternMatcher) CompilePattern(pattern string) (*CompiledPattern, error) {
    // 检查是否是 Grok 模式
    if strings.HasPrefix(pattern, "%{") {
        // Grok 模式
        grokPattern, err := grok.NewPattern(pattern)
        if err != nil {
            return nil, fmt.Errorf("编译 Grok 模式失败: %w", err)
        }
        
        return &CompiledPattern{
            Type:    "grok",
            Grok:    grokPattern,
        }, nil
    }
    
    // 正则表达式
    regex, err := regexp.Compile(pattern)
    if err != nil {
        return nil, fmt.Errorf("编译正则表达式失败: %w", err)
    }
    
    return &CompiledPattern{
        Type:  "regex",
        Regex: regex,
    }, nil
}

// 编译后的模式
type CompiledPattern struct {
    Type  string
    Regex *regexp.Regexp
    Grok  *grok.Pattern
}

// 匹配
func (cp *CompiledPattern) Match(text string) bool {
    switch cp.Type {
    case "regex":
        return cp.Regex.MatchString(text)
    case "grok":
        _, err := cp.Grok.Parse(text)
        return err == nil
    }
    return false
}

// 执行动作
func (ae *AnalysisEngine) executeAction(action RuleAction, data interface{}) {
    switch action.Type {
    case "alert":
        // 发送告警
        ae.sendAlert(action, data)
        
    case "log":
        // 记录日志
        log.Info("规则触发", "action", action, "data", data)
        
    case "webhook":
        // 调用 Webhook
        ae.callWebhook(action, data)
        
    case "store":
        // 存储结果
        ae.storeResult(action, data)
    }
}
```

**关键实现点**:

1. 使用 Apache Flink 实现流式处理，支持每秒 100 万条日志的实时分析
2. 支持滚动窗口、滑动窗口、会话窗口三种时间窗口类型
3. 使用 Flink CEP 实现复杂事件处理，支持跨数据源的事件关联
4. 支持正则表达式和 Grok 模式两种模式匹配方式
5. 实现多种聚合函数：count/sum/avg/min/max/percentile

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| analysis_rules | array | [] | 分析规则列表 |
| flink_parallelism | int | 10 | Flink 并行度 |
| window_size_seconds | int | 60 | 默认窗口大小（秒） |
| aggregation_threshold | float | 100.0 | 默认聚合阈值 |
| correlation_window_seconds | int | 300 | 关联时间窗口（秒） |
| pattern_cache_size | int | 1000 | 模式缓存大小 |
| max_rules_per_stream | int | 100 | 每个流最大规则数 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一批数据处理）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值和分析统计
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN 分析规则变更时，THE System SHALL 验证规则的有效性（模式、阈值等）
6. THE System SHALL 支持规则的试运行模式，评估影响后再正式启用

---


#### 需求 3-10：高级日志查询与筛选 [MVP]

**用户故事**: 

作为运维工程师，我希望能够使用多种方式查询和筛选日志，以便快速定位问题和分析日志数据。

**验收标准**:

1. THE Query_Interface SHALL 支持按时间范围、日志级别、服务类型、地域、日志来源进行多维度过滤
2. THE Query_Interface SHALL 支持 AND/OR 组合条件查询，允许最多 10 个筛选条件组合
3. THE Query_Interface SHALL 提供全文检索功能，支持关键词搜索、模糊搜索和正则表达式搜索
4. THE Query_Interface SHALL 支持 SQL 风格的查询语法（SELECT、WHERE、GROUP BY、ORDER BY、LIMIT）
5. THE Search_Box SHALL 提供自动补全和智能提示功能，响应时间 ≤ 200ms
6. THE Query_Interface SHALL 支持实时筛选，在用户选择筛选条件时即时更新数据列表（≤ 500ms）
7. THE System SHALL 保存用户最近 100 条搜索历史记录
8. THE Query_Interface SHALL 支持查询结果导出（JSON、CSV、Excel），单次导出最多 100 万条
9. THE System SHALL 支持保存常用查询为模板，方便快速调用
10. THE Query_Interface SHALL 通过配置中心管理查询限制和权限，支持热更新

**实现方向**:

**实现方式**:

```go
// 查询接口
type QueryInterface struct {
    esClient    *elasticsearch.Client  // Elasticsearch 客户端
    sqlParser   *SQLParser             // SQL 解析器
    cache       *QueryCache            // 查询缓存
    history     *SearchHistory         // 搜索历史
    templates   *QueryTemplates        // 查询模板
    config      atomic.Value           // 配置（支持热更新）
}

// 查询请求
type QueryRequest struct {
    Query       string                 // 查询字符串
    Filters     []Filter               // 过滤条件
    TimeRange   TimeRange              // 时间范围
    Sort        []SortField            // 排序字段
    Pagination  Pagination             // 分页
    Aggregations []Aggregation         // 聚合
}

// 过滤条件
type Filter struct {
    Field    string      // 字段名
    Operator string      // 操作符：eq/ne/gt/lt/gte/lte/in/contains/regex
    Value    interface{} // 值
    LogicalOp string     // 逻辑操作符：AND/OR
}

// 时间范围
type TimeRange struct {
    From string // 开始时间，支持相对时间：now-1h, now-1d
    To   string // 结束时间
}

// 排序字段
type SortField struct {
    Field string // 字段名
    Order string // 排序方向：asc/desc
}

// 分页
type Pagination struct {
    Page int // 页码（从 1 开始）
    Size int // 每页大小
}

// 执行查询
func (qi *QueryInterface) ExecuteQuery(ctx context.Context, req *QueryRequest) (*QueryResult, error) {
    log.Info("执行查询", "query", req.Query)
    
    // 1. 检查查询缓存
    cacheKey := qi.generateCacheKey(req)
    if cached, ok := qi.cache.Get(cacheKey); ok {
        log.Debug("命中查询缓存", "cache_key", cacheKey)
        return cached.(*QueryResult), nil
    }
    
    // 2. 构建 Elasticsearch 查询
    esQuery, err := qi.buildESQuery(req)
    if err != nil {
        return nil, fmt.Errorf("构建查询失败: %w", err)
    }
    
    // 3. 执行查询
    startTime := time.Now()
    
    res, err := qi.esClient.Search(
        qi.esClient.Search.WithContext(ctx),
        qi.esClient.Search.WithIndex("logs-*"),
        qi.esClient.Search.WithBody(esQuery),
        qi.esClient.Search.WithTrackTotalHits(true),
    )
    if err != nil {
        return nil, fmt.Errorf("执行查询失败: %w", err)
    }
    defer res.Body.Close()
    
    // 4. 解析结果
    result, err := qi.parseESResponse(res)
    if err != nil {
        return nil, fmt.Errorf("解析结果失败: %w", err)
    }
    
    // 5. 记录查询时间
    result.QueryTime = time.Since(startTime)
    
    // 6. 缓存结果
    qi.cache.Set(cacheKey, result, 5*time.Minute)
    
    // 7. 保存搜索历史
    qi.history.Add(ctx, req)
    
    log.Info("查询完成",
        "total", result.Total,
        "query_time", result.QueryTime)
    
    return result, nil
}

// 构建 Elasticsearch 查询
func (qi *QueryInterface) buildESQuery(req *QueryRequest) (io.Reader, error) {
    query := map[string]interface{}{
        "query": map[string]interface{}{
            "bool": map[string]interface{}{
                "must": []interface{}{},
            },
        },
        "from": (req.Pagination.Page - 1) * req.Pagination.Size,
        "size": req.Pagination.Size,
    }
    
    mustClauses := query["query"].(map[string]interface{})["bool"].(map[string]interface{})["must"].([]interface{})
    
    // 1. 添加全文搜索
    if req.Query != "" {
        if strings.HasPrefix(req.Query, "/") && strings.HasSuffix(req.Query, "/") {
            // 正则表达式搜索
            regex := strings.Trim(req.Query, "/")
            mustClauses = append(mustClauses, map[string]interface{}{
                "regexp": map[string]interface{}{
                    "message": regex,
                },
            })
        } else if strings.Contains(req.Query, "*") || strings.Contains(req.Query, "?") {
            // 通配符搜索
            mustClauses = append(mustClauses, map[string]interface{}{
                "wildcard": map[string]interface{}{
                    "message": req.Query,
                },
            })
        } else {
            // 全文搜索
            mustClauses = append(mustClauses, map[string]interface{}{
                "match": map[string]interface{}{
                    "message": req.Query,
                },
            })
        }
    }
    
    // 2. 添加过滤条件
    for _, filter := range req.Filters {
        clause := qi.buildFilterClause(filter)
        
        if filter.LogicalOp == "OR" {
            // OR 条件放入 should 子句
            if _, ok := query["query"].(map[string]interface{})["bool"].(map[string]interface{})["should"]; !ok {
                query["query"].(map[string]interface{})["bool"].(map[string]interface{})["should"] = []interface{}{}
            }
            shouldClauses := query["query"].(map[string]interface{})["bool"].(map[string]interface{})["should"].([]interface{})
            shouldClauses = append(shouldClauses, clause)
            query["query"].(map[string]interface{})["bool"].(map[string]interface{})["should"] = shouldClauses
        } else {
            // AND 条件放入 must 子句
            mustClauses = append(mustClauses, clause)
        }
    }
    
    query["query"].(map[string]interface{})["bool"].(map[string]interface{})["must"] = mustClauses
    
    // 3. 添加时间范围
    if req.TimeRange.From != "" || req.TimeRange.To != "" {
        timeRange := map[string]interface{}{
            "range": map[string]interface{}{
                "@timestamp": map[string]interface{}{},
            },
        }
        
        if req.TimeRange.From != "" {
            timeRange["range"].(map[string]interface{})["@timestamp"].(map[string]interface{})["gte"] = req.TimeRange.From
        }
        if req.TimeRange.To != "" {
            timeRange["range"].(map[string]interface{})["@timestamp"].(map[string]interface{})["lte"] = req.TimeRange.To
        }
        
        mustClauses = append(mustClauses, timeRange)
        query["query"].(map[string]interface{})["bool"].(map[string]interface{})["must"] = mustClauses
    }
    
    // 4. 添加排序
    if len(req.Sort) > 0 {
        sort := make([]interface{}, len(req.Sort))
        for i, s := range req.Sort {
            sort[i] = map[string]interface{}{
                s.Field: map[string]interface{}{
                    "order": s.Order,
                },
            }
        }
        query["sort"] = sort
    }
    
    // 5. 添加聚合
    if len(req.Aggregations) > 0 {
        aggs := make(map[string]interface{})
        for _, agg := range req.Aggregations {
            aggs[agg.Name] = qi.buildAggregation(agg)
        }
        query["aggs"] = aggs
    }
    
    // 转换为 JSON
    return esutil.NewJSONReader(query), nil
}

// 构建过滤子句
func (qi *QueryInterface) buildFilterClause(filter Filter) map[string]interface{} {
    switch filter.Operator {
    case "eq":
        return map[string]interface{}{
            "term": map[string]interface{}{
                filter.Field: filter.Value,
            },
        }
    case "ne":
        return map[string]interface{}{
            "bool": map[string]interface{}{
                "must_not": map[string]interface{}{
                    "term": map[string]interface{}{
                        filter.Field: filter.Value,
                    },
                },
            },
        }
    case "gt":
        return map[string]interface{}{
            "range": map[string]interface{}{
                filter.Field: map[string]interface{}{
                    "gt": filter.Value,
                },
            },
        }
    case "gte":
        return map[string]interface{}{
            "range": map[string]interface{}{
                filter.Field: map[string]interface{}{
                    "gte": filter.Value,
                },
            },
        }
    case "lt":
        return map[string]interface{}{
            "range": map[string]interface{}{
                filter.Field: map[string]interface{}{
                    "lt": filter.Value,
                },
            },
        }
    case "lte":
        return map[string]interface{}{
            "range": map[string]interface{}{
                filter.Field: map[string]interface{}{
                    "lte": filter.Value,
                },
            },
        }
    case "in":
        return map[string]interface{}{
            "terms": map[string]interface{}{
                filter.Field: filter.Value,
            },
        }
    case "contains":
        return map[string]interface{}{
            "wildcard": map[string]interface{}{
                filter.Field: fmt.Sprintf("*%s*", filter.Value),
            },
        }
    case "regex":
        return map[string]interface{}{
            "regexp": map[string]interface{}{
                filter.Field: filter.Value,
            },
        }
    default:
        return map[string]interface{}{}
    }
}

// SQL 解析器
type SQLParser struct{}

// 解析 SQL 查询
func (sp *SQLParser) Parse(sql string) (*QueryRequest, error) {
    // 使用 SQL 解析库解析 SQL
    // 示例：SELECT * FROM logs WHERE level='ERROR' AND @timestamp > 'now-1h' ORDER BY @timestamp DESC LIMIT 100
    
    stmt, err := sqlparser.Parse(sql)
    if err != nil {
        return nil, fmt.Errorf("解析 SQL 失败: %w", err)
    }
    
    selectStmt, ok := stmt.(*sqlparser.Select)
    if !ok {
        return nil, fmt.Errorf("不支持的 SQL 语句类型")
    }
    
    req := &QueryRequest{
        Filters: []Filter{},
        Sort:    []SortField{},
    }
    
    // 解析 WHERE 子句
    if selectStmt.Where != nil {
        filters, err := sp.parseWhereClause(selectStmt.Where)
        if err != nil {
            return nil, err
        }
        req.Filters = filters
    }
    
    // 解析 ORDER BY 子句
    if len(selectStmt.OrderBy) > 0 {
        for _, order := range selectStmt.OrderBy {
            req.Sort = append(req.Sort, SortField{
                Field: order.Expr.String(),
                Order: order.Direction,
            })
        }
    }
    
    // 解析 LIMIT 子句
    if selectStmt.Limit != nil {
        limit, _ := strconv.Atoi(selectStmt.Limit.Rowcount.String())
        req.Pagination.Size = limit
        req.Pagination.Page = 1
    }
    
    return req, nil
}

// 自动补全
type AutoComplete struct {
    cache *lru.Cache
}

// 获取字段建议
func (ac *AutoComplete) GetFieldSuggestions(ctx context.Context, prefix string) ([]string, error) {
    // 从缓存获取
    if cached, ok := ac.cache.Get("fields"); ok {
        fields := cached.([]string)
        return ac.filterByPrefix(fields, prefix), nil
    }
    
    // 从 Elasticsearch 获取字段映射
    fields := []string{
        "@timestamp",
        "level",
        "message",
        "source",
        "host",
        "service",
        "region",
        "user_id",
        "request_id",
        "duration",
        "status_code",
    }
    
    // 缓存字段列表
    ac.cache.Add("fields", fields)
    
    return ac.filterByPrefix(fields, prefix), nil
}

// 获取值建议
func (ac *AutoComplete) GetValueSuggestions(ctx context.Context, field, prefix string) ([]string, error) {
    // 对于枚举类型字段，返回预定义的值
    switch field {
    case "level":
        return ac.filterByPrefix([]string{"DEBUG", "INFO", "WARN", "ERROR", "FATAL"}, prefix), nil
    case "service":
        // 从 Elasticsearch 聚合获取服务列表
        return ac.getTopValues(ctx, field, prefix, 10)
    default:
        return []string{}, nil
    }
}

// 查询缓存
type QueryCache struct {
    cache *lru.Cache
}

// 生成缓存键
func (qi *QueryInterface) generateCacheKey(req *QueryRequest) string {
    data, _ := json.Marshal(req)
    hash := sha256.Sum256(data)
    return hex.EncodeToString(hash[:])
}

// 搜索历史
type SearchHistory struct {
    storage Storage
}

// 添加搜索历史
func (sh *SearchHistory) Add(ctx context.Context, req *QueryRequest) error {
    history := &SearchHistoryEntry{
        Query:     req.Query,
        Filters:   req.Filters,
        TimeRange: req.TimeRange,
        Timestamp: time.Now(),
    }
    
    return sh.storage.SaveSearchHistory(ctx, history)
}

// 获取搜索历史
func (sh *SearchHistory) Get(ctx context.Context, userID string, limit int) ([]*SearchHistoryEntry, error) {
    return sh.storage.GetSearchHistory(ctx, userID, limit)
}

// 查询模板
type QueryTemplates struct {
    storage Storage
}

// 保存查询模板
func (qt *QueryTemplates) Save(ctx context.Context, template *QueryTemplate) error {
    return qt.storage.SaveQueryTemplate(ctx, template)
}

// 获取查询模板
func (qt *QueryTemplates) Get(ctx context.Context, userID string) ([]*QueryTemplate, error) {
    return qt.storage.GetQueryTemplates(ctx, userID)
}

// 查询模板
type QueryTemplate struct {
    ID          string       // 模板 ID
    Name        string       // 模板名称
    Description string       // 模板描述
    Query       QueryRequest // 查询请求
    UserID      string       // 用户 ID
    CreatedAt   time.Time    // 创建时间
}

// 导出查询结果
func (qi *QueryInterface) ExportResults(ctx context.Context, req *QueryRequest, format string) ([]byte, error) {
    log.Info("导出查询结果", "format", format)
    
    // 1. 执行查询（不分页，最多 100 万条）
    req.Pagination.Page = 1
    req.Pagination.Size = 1000000
    
    result, err := qi.ExecuteQuery(ctx, req)
    if err != nil {
        return nil, err
    }
    
    // 2. 根据格式导出
    switch format {
    case "json":
        return json.MarshalIndent(result.Hits, "", "  ")
        
    case "csv":
        return qi.exportCSV(result.Hits)
        
    case "excel":
        return qi.exportExcel(result.Hits)
        
    default:
        return nil, fmt.Errorf("不支持的导出格式: %s", format)
    }
}

// 导出 CSV
func (qi *QueryInterface) exportCSV(hits []*LogEntry) ([]byte, error) {
    var buf bytes.Buffer
    writer := csv.NewWriter(&buf)
    
    // 写入表头
    headers := []string{"timestamp", "level", "source", "message"}
    writer.Write(headers)
    
    // 写入数据
    for _, hit := range hits {
        record := []string{
            hit.Timestamp,
            hit.Level,
            hit.Source,
            hit.Message,
        }
        writer.Write(record)
    }
    
    writer.Flush()
    return buf.Bytes(), writer.Error()
}
```

**关键实现点**:

1. 支持多维度过滤：时间范围、日志级别、服务类型、地域、来源等
2. 支持 AND/OR 组合条件查询，最多 10 个筛选条件
3. 实现 SQL 解析器，支持 SQL 风格的查询语法
4. 使用 LRU 缓存查询结果，提升响应速度
5. 实现自动补全功能，提供字段和值的智能提示

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| max_filters_per_query | int | 10 | 每个查询最大过滤条件数 |
| max_page_size | int | 10000 | 最大分页大小 |
| default_page_size | int | 100 | 默认分页大小 |
| query_timeout_seconds | int | 30 | 查询超时时间（秒） |
| cache_ttl_seconds | int | 300 | 缓存过期时间（秒） |
| cache_size | int | 1000 | 缓存大小 |
| history_limit | int | 100 | 搜索历史保留数量 |
| export_max_rows | int | 1000000 | 导出最大行数 |
| autocomplete_enabled | bool | true | 是否启用自动补全 |
| autocomplete_min_chars | int | 2 | 自动补全最小字符数 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一次查询）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值和查询统计
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN 查询限制变更时，THE System SHALL 验证限制的合理性
6. THE System SHALL 支持按用户或角色设置不同的查询限制

---


#### 需求 3-11：自然语言查询 [Phase 2]

**用户故事**: 

作为非技术用户，我希望能够使用自然语言查询日志，以便无需学习复杂的查询语法就能快速找到所需信息。

**验收标准**:

1. THE NLP_Engine SHALL 支持基于自然语言处理的智能日志查询
2. WHEN 用户输入自然语言查询时，THE NLP_Engine SHALL 将其转换为结构化查询并返回相关结果，准确率 ≥ 85%
3. THE NLP_Engine SHALL 支持中文和英文的自然语言查询
4. THE NLP_Engine SHALL 学习用户的查询历史以提供个性化的查询建议
5. THE UI SHALL 显示 NLP 查询的解析结果，允许用户确认或修改
6. THE NLP_Engine SHALL 支持时间表达式解析（昨天、上周、最近1小时、今天凌晨）
7. THE NLP_Engine SHALL 支持日志级别识别（错误、警告、信息）
8. THE NLP_Engine SHALL 支持服务名称和关键词识别
9. THE System SHALL 提供查询示例和引导，帮助用户学习自然语言查询
10. THE NLP_Engine SHALL 通过配置中心管理 NLP 模型和规则，支持热更新

**实现方向**:

**实现方式**:

```go
// NLP 查询引擎
type NLPEngine struct {
    intentClassifier *IntentClassifier    // 意图分类器
    nerExtractor     *NERExtractor        // 命名实体识别
    timeParser       *TimeParser          // 时间解析器
    queryGenerator   *QueryGenerator      // 查询生成器
    learner          *QueryLearner        // 查询学习器
    config           atomic.Value         // 配置（支持热更新）
}

// 处理自然语言查询
func (nlp *NLPEngine) ProcessNaturalLanguage(ctx context.Context, input string, userID string) (*NLPResult, error) {
    log.Info("处理自然语言查询", "input", input, "user_id", userID)
    
    // 1. 意图识别
    intent, confidence := nlp.intentClassifier.Classify(input)
    log.Debug("意图识别", "intent", intent, "confidence", confidence)
    
    if confidence < 0.7 {
        return nil, fmt.Errorf("无法理解查询意图，置信度过低: %.2f", confidence)
    }
    
    // 2. 命名实体识别
    entities := nlp.nerExtractor.Extract(input)
    log.Debug("实体识别", "entities", entities)
    
    // 3. 时间表达式解析
    timeRange, err := nlp.timeParser.Parse(input)
    if err != nil {
        log.Warn("时间解析失败", "error", err)
        // 使用默认时间范围
        timeRange = &TimeRange{
            From: "now-1h",
            To:   "now",
        }
    }
    
    // 4. 生成结构化查询
    query, err := nlp.queryGenerator.Generate(intent, entities, timeRange)
    if err != nil {
        return nil, fmt.Errorf("生成查询失败: %w", err)
    }
    
    // 5. 学习用户查询模式
    nlp.learner.Learn(ctx, userID, input, query)
    
    // 6. 构建结果
    result := &NLPResult{
        Input:      input,
        Intent:     intent,
        Confidence: confidence,
        Entities:   entities,
        TimeRange:  timeRange,
        Query:      query,
        Explanation: nlp.generateExplanation(intent, entities, timeRange),
    }
    
    log.Info("自然语言查询处理完成", "query", query.Query)
    return result, nil
}

// 意图分类器
type IntentClassifier struct {
    model *onnx.Model // ONNX 模型
    vocab map[string]int
}

// 分类意图
func (ic *IntentClassifier) Classify(input string) (string, float64) {
    // 1. 文本预处理
    tokens := ic.tokenize(input)
    
    // 2. 转换为向量
    vector := ic.vectorize(tokens)
    
    // 3. 模型推理
    output := ic.model.Predict(vector)
    
    // 4. 获取最高置信度的意图
    intents := []string{
        "search_logs",      // 搜索日志
        "filter_by_level",  // 按级别过滤
        "filter_by_service",// 按服务过滤
        "filter_by_time",   // 按时间过滤
        "aggregate_stats",  // 统计聚合
        "find_errors",      // 查找错误
    }
    
    maxIdx := 0
    maxScore := output[0]
    for i, score := range output {
        if score > maxScore {
            maxScore = score
            maxIdx = i
        }
    }
    
    return intents[maxIdx], maxScore
}

// 分词
func (ic *IntentClassifier) tokenize(text string) []string {
    // 中文分词使用 jieba
    // 英文分词使用空格分割
    if ic.isChinese(text) {
        return jieba.Cut(text, true)
    }
    return strings.Fields(strings.ToLower(text))
}

// 命名实体识别
type NERExtractor struct {
    patterns map[string]*regexp.Regexp
}

// 提取实体
func (ner *NERExtractor) Extract(input string) map[string][]string {
    entities := make(map[string][]string)
    
    // 1. 日志级别识别
    levelPatterns := []string{
        "错误", "error", "ERROR",
        "警告", "warn", "warning", "WARN",
        "信息", "info", "INFO",
        "调试", "debug", "DEBUG",
    }
    
    for _, pattern := range levelPatterns {
        if strings.Contains(strings.ToLower(input), strings.ToLower(pattern)) {
            level := ner.normalizeLevel(pattern)
            entities["level"] = append(entities["level"], level)
        }
    }
    
    // 2. 服务名称识别
    servicePattern := regexp.MustCompile(`(?:服务|service)[：:]\s*([a-zA-Z0-9_-]+)`)
    if matches := servicePattern.FindStringSubmatch(input); len(matches) > 1 {
        entities["service"] = append(entities["service"], matches[1])
    }
    
    // 3. 关键词识别
    keywordPattern := regexp.MustCompile(`(?:包含|contains?)[：:]\s*([^\s]+)`)
    if matches := keywordPattern.FindStringSubmatch(input); len(matches) > 1 {
        entities["keyword"] = append(entities["keyword"], matches[1])
    }
    
    // 4. 用户 ID 识别
    userIDPattern := regexp.MustCompile(`(?:用户|user)[：:]\s*([a-zA-Z0-9_-]+)`)
    if matches := userIDPattern.FindStringSubmatch(input); len(matches) > 1 {
        entities["user_id"] = append(entities["user_id"], matches[1])
    }
    
    // 5. IP 地址识别
    ipPattern := regexp.MustCompile(`\b(?:\d{1,3}\.){3}\d{1,3}\b`)
    if matches := ipPattern.FindAllString(input, -1); len(matches) > 0 {
        entities["ip"] = matches
    }
    
    return entities
}

// 标准化日志级别
func (ner *NERExtractor) normalizeLevel(level string) string {
    level = strings.ToUpper(level)
    switch level {
    case "错误", "ERROR":
        return "ERROR"
    case "警告", "WARN", "WARNING":
        return "WARN"
    case "信息", "INFO":
        return "INFO"
    case "调试", "DEBUG":
        return "DEBUG"
    default:
        return level
    }
}

// 时间解析器
type TimeParser struct {
    patterns map[string]*TimePattern
}

// 时间模式
type TimePattern struct {
    Regex   *regexp.Regexp
    Handler func(matches []string) (*TimeRange, error)
}

// 解析时间表达式
func (tp *TimeParser) Parse(input string) (*TimeRange, error) {
    // 定义时间模式
    patterns := map[string]*TimePattern{
        "最近N小时": {
            Regex: regexp.MustCompile(`最近\s*(\d+)\s*(?:小时|hour)`),
            Handler: func(matches []string) (*TimeRange, error) {
                hours, _ := strconv.Atoi(matches[1])
                return &TimeRange{
                    From: fmt.Sprintf("now-%dh", hours),
                    To:   "now",
                }, nil
            },
        },
        "最近N天": {
            Regex: regexp.MustCompile(`最近\s*(\d+)\s*(?:天|day)`),
            Handler: func(matches []string) (*TimeRange, error) {
                days, _ := strconv.Atoi(matches[1])
                return &TimeRange{
                    From: fmt.Sprintf("now-%dd", days),
                    To:   "now",
                }, nil
            },
        },
        "昨天": {
            Regex: regexp.MustCompile(`昨天|yesterday`),
            Handler: func(matches []string) (*TimeRange, error) {
                return &TimeRange{
                    From: "now-1d/d",
                    To:   "now-1d/d+1d",
                }, nil
            },
        },
        "今天": {
            Regex: regexp.MustCompile(`今天|today`),
            Handler: func(matches []string) (*TimeRange, error) {
                return &TimeRange{
                    From: "now/d",
                    To:   "now",
                }, nil
            },
        },
        "今天凌晨": {
            Regex: regexp.MustCompile(`今天凌晨|early\s+morning`),
            Handler: func(matches []string) (*TimeRange, error) {
                return &TimeRange{
                    From: "now/d",
                    To:   "now/d+6h",
                }, nil
            },
        },
        "上周": {
            Regex: regexp.MustCompile(`上周|last\s+week`),
            Handler: func(matches []string) (*TimeRange, error) {
                return &TimeRange{
                    From: "now-1w/w",
                    To:   "now-1w/w+1w",
                }, nil
            },
        },
    }
    
    // 尝试匹配所有模式
    for _, pattern := range patterns {
        if matches := pattern.Regex.FindStringSubmatch(input); len(matches) > 0 {
            return pattern.Handler(matches)
        }
    }
    
    return nil, fmt.Errorf("无法解析时间表达式")
}

// 查询生成器
type QueryGenerator struct{}

// 生成结构化查询
func (qg *QueryGenerator) Generate(intent string, entities map[string][]string, timeRange *TimeRange) (*QueryRequest, error) {
    req := &QueryRequest{
        Filters:   []Filter{},
        TimeRange: *timeRange,
        Pagination: Pagination{
            Page: 1,
            Size: 100,
        },
    }
    
    // 根据意图生成查询
    switch intent {
    case "search_logs":
        // 搜索日志
        if keywords, ok := entities["keyword"]; ok && len(keywords) > 0 {
            req.Query = keywords[0]
        }
        
    case "filter_by_level":
        // 按级别过滤
        if levels, ok := entities["level"]; ok && len(levels) > 0 {
            req.Filters = append(req.Filters, Filter{
                Field:    "level",
                Operator: "eq",
                Value:    levels[0],
            })
        }
        
    case "filter_by_service":
        // 按服务过滤
        if services, ok := entities["service"]; ok && len(services) > 0 {
            req.Filters = append(req.Filters, Filter{
                Field:    "service",
                Operator: "eq",
                Value:    services[0],
            })
        }
        
    case "find_errors":
        // 查找错误
        req.Filters = append(req.Filters, Filter{
            Field:    "level",
            Operator: "eq",
            Value:    "ERROR",
        })
    }
    
    // 添加其他实体作为过滤条件
    for entityType, values := range entities {
        if len(values) == 0 {
            continue
        }
        
        switch entityType {
        case "user_id":
            req.Filters = append(req.Filters, Filter{
                Field:    "user_id",
                Operator: "eq",
                Value:    values[0],
            })
        case "ip":
            req.Filters = append(req.Filters, Filter{
                Field:    "ip",
                Operator: "eq",
                Value:    values[0],
            })
        }
    }
    
    return req, nil
}

// 生成解释
func (nlp *NLPEngine) generateExplanation(intent string, entities map[string][]string, timeRange *TimeRange) string {
    parts := []string{}
    
    // 时间范围
    parts = append(parts, fmt.Sprintf("时间范围：%s 到 %s", timeRange.From, timeRange.To))
    
    // 意图
    intentDesc := map[string]string{
        "search_logs":      "搜索日志",
        "filter_by_level":  "按日志级别过滤",
        "filter_by_service": "按服务过滤",
        "find_errors":      "查找错误日志",
    }
    if desc, ok := intentDesc[intent]; ok {
        parts = append(parts, fmt.Sprintf("操作：%s", desc))
    }
    
    // 实体
    for entityType, values := range entities {
        if len(values) > 0 {
            parts = append(parts, fmt.Sprintf("%s：%s", entityType, strings.Join(values, ", ")))
        }
    }
    
    return strings.Join(parts, " | ")
}

// 查询学习器
type QueryLearner struct {
    storage Storage
}

// 学习用户查询模式
func (ql *QueryLearner) Learn(ctx context.Context, userID, input string, query *QueryRequest) error {
    // 保存用户查询记录
    record := &QueryLearningRecord{
        UserID:    userID,
        Input:     input,
        Query:     query,
        Timestamp: time.Now(),
    }
    
    return ql.storage.SaveQueryLearningRecord(ctx, record)
}

// 获取个性化建议
func (ql *QueryLearner) GetSuggestions(ctx context.Context, userID string, input string) ([]string, error) {
    // 获取用户历史查询
    records, err := ql.storage.GetQueryLearningRecords(ctx, userID, 100)
    if err != nil {
        return nil, err
    }
    
    // 查找相似的查询
    suggestions := []string{}
    for _, record := range records {
        if ql.isSimilar(input, record.Input) {
            suggestions = append(suggestions, record.Input)
        }
    }
    
    return suggestions, nil
}

// 判断查询是否相似
func (ql *QueryLearner) isSimilar(input1, input2 string) bool {
    // 使用编辑距离或余弦相似度判断
    distance := levenshtein.Distance(input1, input2)
    maxLen := math.Max(float64(len(input1)), float64(len(input2)))
    similarity := 1.0 - float64(distance)/maxLen
    
    return similarity > 0.7
}

// NLP 结果
type NLPResult struct {
    Input       string                 // 原始输入
    Intent      string                 // 识别的意图
    Confidence  float64                // 置信度
    Entities    map[string][]string    // 提取的实体
    TimeRange   *TimeRange             // 时间范围
    Query       *QueryRequest          // 生成的查询
    Explanation string                 // 查询解释
}

// 自然语言查询示例
var NLQueryExamples = []struct {
    Input  string
    Output string
}{
    {
        Input:  "最近1小时的错误日志",
        Output: `level:ERROR AND @timestamp:[now-1h TO now]`,
    },
    {
        Input:  "昨天支付服务的警告",
        Output: `service:payment AND level:WARN AND @timestamp:[now-1d/d TO now-1d/d+1d]`,
    },
    {
        Input:  "包含超时的日志",
        Output: `message:*timeout*`,
    },
    {
        Input:  "今天凌晨的数据库错误",
        Output: `service:database AND level:ERROR AND @timestamp:[now/d TO now/d+6h]`,
    },
    {
        Input:  "用户 user123 的所有日志",
        Output: `user_id:user123`,
    },
    {
        Input:  "IP 192.168.1.100 的访问日志",
        Output: `ip:192.168.1.100`,
    },
}
```

**关键实现点**:

1. 使用 ONNX Runtime 进行意图分类，支持中英文双语
2. 实现命名实体识别（NER），提取日志级别、服务名称、关键词、用户 ID、IP 地址等
3. 支持多种时间表达式解析：相对时间（最近N小时/天）、绝对时间（昨天、今天、上周）
4. 实现查询学习器，根据用户历史查询提供个性化建议
5. 生成查询解释，让用户理解 NLP 引擎的解析结果

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| nlp_enabled | bool | true | 是否启用 NLP 查询 |
| nlp_model_path | string | "/models/nlp" | NLP 模型路径 |
| intent_confidence_threshold | float | 0.7 | 意图识别置信度阈值 |
| supported_languages | array | ["zh","en"] | 支持的语言列表 |
| learning_enabled | bool | true | 是否启用查询学习 |
| suggestion_similarity_threshold | float | 0.7 | 建议相似度阈值 |
| max_suggestions | int | 5 | 最大建议数量 |
| time_parser_patterns | object | {} | 时间解析模式 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一次 NLP 查询）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值和 NLP 统计
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN NLP 模型变更时，THE System SHALL 验证模型的有效性和兼容性
6. THE System SHALL 支持 NLP 模型的热加载，无需重启服务

---


#### 需求 3-12：机器学习异常检测 [Phase 2]

**用户故事**: 

作为安全分析师，我希望系统能够使用多种机器学习算法检测异常，以便自动发现潜在的安全威胁和系统问题。

**验收标准**:

1. THE ML_Engine SHALL 支持 K-means 聚类算法进行日志模式分类和异常检测
2. THE ML_Engine SHALL 支持 Isolation Forest 算法检测日志数据中的离群点，检测率 ≥ 90%，误报率 ≤ 5%
3. THE ML_Engine SHALL 支持基于 LSTM 的时序异常检测，提前 5 分钟预测异常
4. WHEN 用户标记某个告警为误报时，THE ML_Engine SHALL 学习并在 24 小时内减少类似误报 50%
5. THE ML_Engine SHALL 支持模型的在线更新，无需停机即可更新异常检测模型
6. THE UI SHALL 展示异常检测模型的准确率、召回率、F1 分数等性能指标
7. THE ML_Engine SHALL 支持多维度异常检测（日志量、错误率、响应时间、资源使用）
8. THE ML_Engine SHALL 提供异常评分（0-100），帮助用户判断异常严重程度
9. THE ML_Engine SHALL 支持异常根因分析，自动关联相关日志
10. THE ML_Engine SHALL 通过配置中心管理 ML 模型和参数，支持热更新

**实现方向**:

**实现方式**:

```go
// 机器学习引擎
type MLEngine struct {
    models      map[string]MLModel     // ML 模型映射
    trainer     *ModelTrainer          // 模型训练器
    predictor   *ModelPredictor        // 模型预测器
    feedback    *FeedbackLearner       // 反馈学习器
    evaluator   *ModelEvaluator        // 模型评估器
    config      atomic.Value           // 配置（支持热更新）
}

// ML 模型接口
type MLModel interface {
    Train(data []TrainingData) error
    Predict(input []float64) (float64, error)
    Update(data []TrainingData) error
    GetMetrics() *ModelMetrics
    Save(path string) error
    Load(path string) error
}

// Isolation Forest 异常检测
type IsolationForest struct {
    trees       []*IsolationTree       // 隔离树集合
    numTrees    int                    // 树的数量
    sampleSize  int                    // 采样大小
    threshold   float64                // 异常阈值
}

// 训练 Isolation Forest
func (iforest *IsolationForest) Train(data []TrainingData) error {
    log.Info("开始训练 Isolation Forest", "num_samples", len(data))
    
    // 1. 初始化隔离树
    iforest.trees = make([]*IsolationTree, iforest.numTrees)
    
    // 2. 并行训练每棵树
    var wg sync.WaitGroup
    for i := 0; i < iforest.numTrees; i++ {
        wg.Add(1)
        go func(idx int) {
            defer wg.Done()
            
            // 随机采样
            sample := iforest.randomSample(data, iforest.sampleSize)
            
            // 构建隔离树
            tree := NewIsolationTree(sample, 0, iforest.maxDepth())
            iforest.trees[idx] = tree
        }(i)
    }
    
    wg.Wait()
    
    log.Info("Isolation Forest 训练完成")
    return nil
}

// 预测异常分数
func (iforest *IsolationForest) Predict(input []float64) (float64, error) {
    // 1. 计算每棵树的路径长度
    pathLengths := make([]float64, iforest.numTrees)
    
    for i, tree := range iforest.trees {
        pathLengths[i] = tree.PathLength(input)
    }
    
    // 2. 计算平均路径长度
    avgPathLength := 0.0
    for _, length := range pathLengths {
        avgPathLength += length
    }
    avgPathLength /= float64(iforest.numTrees)
    
    // 3. 计算异常分数（0-1，越接近1越异常）
    c := iforest.averagePathLength(iforest.sampleSize)
    anomalyScore := math.Pow(2, -avgPathLength/c)
    
    // 4. 转换为 0-100 分数
    score := anomalyScore * 100
    
    return score, nil
}

// K-means 聚类
type KMeans struct {
    k          int                    // 聚类数量
    centroids  [][]float64            // 聚类中心
    maxIter    int                    // 最大迭代次数
    tolerance  float64                // 收敛容差
}

// 训练 K-means
func (km *KMeans) Train(data []TrainingData) error {
    log.Info("开始训练 K-means", "k", km.k, "num_samples", len(data))
    
    // 1. 随机初始化聚类中心
    km.centroids = km.initializeCentroids(data, km.k)
    
    // 2. 迭代优化
    for iter := 0; iter < km.maxIter; iter++ {
        // 2.1 分配样本到最近的聚类中心
        clusters := make([][]int, km.k)
        for i, sample := range data {
            nearestCluster := km.findNearestCluster(sample.Features)
            clusters[nearestCluster] = append(clusters[nearestCluster], i)
        }
        
        // 2.2 更新聚类中心
        oldCentroids := km.centroids
        km.centroids = make([][]float64, km.k)
        
        for c := 0; c < km.k; c++ {
            if len(clusters[c]) == 0 {
                // 空聚类，保持原中心
                km.centroids[c] = oldCentroids[c]
                continue
            }
            
            // 计算新中心（平均值）
            newCentroid := make([]float64, len(data[0].Features))
            for _, idx := range clusters[c] {
                for j, val := range data[idx].Features {
                    newCentroid[j] += val
                }
            }
            
            for j := range newCentroid {
                newCentroid[j] /= float64(len(clusters[c]))
            }
            
            km.centroids[c] = newCentroid
        }
        
        // 2.3 检查收敛
        if km.hasConverged(oldCentroids, km.centroids) {
            log.Info("K-means 收敛", "iterations", iter+1)
            break
        }
    }
    
    log.Info("K-means 训练完成")
    return nil
}

// 预测聚类
func (km *KMeans) Predict(input []float64) (float64, error) {
    // 找到最近的聚类中心
    nearestCluster := km.findNearestCluster(input)
    
    // 计算到聚类中心的距离（作为异常分数）
    distance := km.euclideanDistance(input, km.centroids[nearestCluster])
    
    // 标准化距离为 0-100 分数
    // 距离越大，异常分数越高
    maxDistance := 10.0 // 假设最大距离
    score := math.Min(distance/maxDistance*100, 100)
    
    return score, nil
}

// LSTM 时序异常检测
type LSTMDetector struct {
    model       *onnx.Model            // ONNX 模型
    windowSize  int                    // 时间窗口大小
    scaler      *StandardScaler        // 数据标准化
    threshold   float64                // 异常阈值
}

// 预测时序异常
func (lstm *LSTMDetector) Predict(input []float64) (float64, error) {
    // 1. 数据标准化
    normalized := lstm.scaler.Transform(input)
    
    // 2. 构造时间窗口
    window := make([][]float64, lstm.windowSize)
    for i := 0; i < lstm.windowSize; i++ {
        window[i] = normalized[i : i+len(normalized)/lstm.windowSize]
    }
    
    // 3. LSTM 模型预测
    prediction := lstm.model.Predict(window)
    
    // 4. 计算重构误差
    reconstructionError := 0.0
    for i, pred := range prediction {
        actual := normalized[i]
        reconstructionError += math.Pow(pred-actual, 2)
    }
    reconstructionError = math.Sqrt(reconstructionError / float64(len(prediction)))
    
    // 5. 转换为异常分数
    score := math.Min(reconstructionError/lstm.threshold*100, 100)
    
    return score, nil
}

// 模型预测器
type ModelPredictor struct {
    engine *MLEngine
}

// 执行异常检测
func (mp *ModelPredictor) DetectAnomaly(ctx context.Context, entry *LogEntry) (*AnomalyResult, error) {
    // 1. 特征提取
    features := mp.extractFeatures(entry)
    
    // 2. 使用多个模型进行预测
    scores := make(map[string]float64)
    
    for modelName, model := range mp.engine.models {
        score, err := model.Predict(features)
        if err != nil {
            log.Error("模型预测失败", "model", modelName, "error", err)
            continue
        }
        scores[modelName] = score
    }
    
    // 3. 集成多个模型的结果（加权平均）
    weights := map[string]float64{
        "isolation_forest": 0.4,
        "kmeans":          0.3,
        "lstm":            0.3,
    }
    
    finalScore := 0.0
    totalWeight := 0.0
    
    for modelName, score := range scores {
        if weight, ok := weights[modelName]; ok {
            finalScore += score * weight
            totalWeight += weight
        }
    }
    
    if totalWeight > 0 {
        finalScore /= totalWeight
    }
    
    // 4. 判断是否异常
    isAnomaly := finalScore > 70.0 // 阈值
    
    // 5. 异常根因分析
    var rootCause string
    if isAnomaly {
        rootCause = mp.analyzeRootCause(entry, scores)
    }
    
    result := &AnomalyResult{
        Entry:      entry,
        IsAnomaly:  isAnomaly,
        Score:      finalScore,
        ModelScores: scores,
        RootCause:  rootCause,
        Timestamp:  time.Now(),
    }
    
    return result, nil
}

// 特征提取
func (mp *ModelPredictor) extractFeatures(entry *LogEntry) []float64 {
    features := []float64{
        // 1. 日志级别（数值化）
        mp.levelToNumber(entry.Level),
        
        // 2. 消息长度
        float64(len(entry.Message)),
        
        // 3. 时间特征（小时）
        float64(entry.GetTimestamp().Hour()),
        
        // 4. 错误关键词数量
        float64(mp.countErrorKeywords(entry.Message)),
        
        // 5. 数字特征（提取消息中的数字）
        mp.extractNumericFeatures(entry.Message),
    }
    
    return features
}

// 根因分析
func (mp *ModelPredictor) analyzeRootCause(entry *LogEntry, scores map[string]float64) string {
    reasons := []string{}
    
    // 分析各个模型的贡献
    if score, ok := scores["isolation_forest"]; ok && score > 80 {
        reasons = append(reasons, "日志模式异常（离群点）")
    }
    
    if score, ok := scores["kmeans"]; ok && score > 80 {
        reasons = append(reasons, "与正常日志聚类差异大")
    }
    
    if score, ok := scores["lstm"]; ok && score > 80 {
        reasons = append(reasons, "时序模式异常")
    }
    
    // 分析日志内容
    if strings.Contains(strings.ToLower(entry.Message), "timeout") {
        reasons = append(reasons, "包含超时关键词")
    }
    
    if strings.Contains(strings.ToLower(entry.Message), "error") {
        reasons = append(reasons, "包含错误关键词")
    }
    
    if entry.Level == "ERROR" || entry.Level == "FATAL" {
        reasons = append(reasons, "错误级别日志")
    }
    
    return strings.Join(reasons, "; ")
}

// 反馈学习器
type FeedbackLearner struct {
    storage Storage
}

// 学习用户反馈
func (fl *FeedbackLearner) LearnFromFeedback(ctx context.Context, anomalyID string, isFalsePositive bool) error {
    log.Info("学习用户反馈", "anomaly_id", anomalyID, "false_positive", isFalsePositive)
    
    // 1. 获取异常记录
    anomaly, err := fl.storage.GetAnomaly(ctx, anomalyID)
    if err != nil {
        return fmt.Errorf("获取异常记录失败: %w", err)
    }
    
    // 2. 保存反馈
    feedback := &UserFeedback{
        AnomalyID:       anomalyID,
        IsFalsePositive: isFalsePositive,
        Timestamp:       time.Now(),
    }
    
    if err := fl.storage.SaveFeedback(ctx, feedback); err != nil {
        return fmt.Errorf("保存反馈失败: %w", err)
    }
    
    // 3. 如果是误报，调整模型
    if isFalsePositive {
        // 提取特征
        features := extractFeatures(anomaly.Entry)
        
        // 添加到负样本集
        negativeSample := &TrainingData{
            Features: features,
            Label:    0, // 0 表示正常
        }
        
        // 在线更新模型
        if err := fl.updateModels(ctx, []*TrainingData{negativeSample}); err != nil {
            return fmt.Errorf("更新模型失败: %w", err)
        }
    }
    
    log.Info("反馈学习完成")
    return nil
}

// 模型评估器
type ModelEvaluator struct{}

// 评估模型性能
func (me *ModelEvaluator) Evaluate(model MLModel, testData []TrainingData) (*ModelMetrics, error) {
    log.Info("开始评估模型", "test_samples", len(testData))
    
    // 1. 预测测试数据
    predictions := make([]float64, len(testData))
    actuals := make([]float64, len(testData))
    
    for i, data := range testData {
        pred, err := model.Predict(data.Features)
        if err != nil {
            return nil, err
        }
        
        predictions[i] = pred
        actuals[i] = data.Label
    }
    
    // 2. 计算混淆矩阵
    threshold := 70.0 // 异常阈值
    tp, fp, tn, fn := 0, 0, 0, 0
    
    for i := range predictions {
        predicted := predictions[i] > threshold
        actual := actuals[i] > 0.5
        
        if predicted && actual {
            tp++ // 真阳性
        } else if predicted && !actual {
            fp++ // 假阳性
        } else if !predicted && !actual {
            tn++ // 真阴性
        } else {
            fn++ // 假阴性
        }
    }
    
    // 3. 计算指标
    precision := float64(tp) / float64(tp+fp)
    recall := float64(tp) / float64(tp+fn)
    f1Score := 2 * precision * recall / (precision + recall)
    accuracy := float64(tp+tn) / float64(tp+fp+tn+fn)
    fpr := float64(fp) / float64(fp+tn) // 误报率
    
    metrics := &ModelMetrics{
        Accuracy:  accuracy,
        Precision: precision,
        Recall:    recall,
        F1Score:   f1Score,
        FPR:       fpr,
        TP:        tp,
        FP:        fp,
        TN:        tn,
        FN:        fn,
    }
    
    log.Info("模型评估完成",
        "accuracy", accuracy,
        "precision", precision,
        "recall", recall,
        "f1_score", f1Score,
        "fpr", fpr)
    
    return metrics, nil
}

// 模型指标
type ModelMetrics struct {
    Accuracy  float64 // 准确率
    Precision float64 // 精确率
    Recall    float64 // 召回率
    F1Score   float64 // F1 分数
    FPR       float64 // 误报率
    TP        int     // 真阳性
    FP        int     // 假阳性
    TN        int     // 真阴性
    FN        int     // 假阴性
}

// 异常检测算法对比
var AnomalyDetectionAlgorithms = []struct {
    Name        string
    UseCase     string
    Pros        string
    Cons        string
    Accuracy    float64
}{
    {
        Name:     "Isolation Forest",
        UseCase:  "离群点检测",
        Pros:     "快速、无需标注",
        Cons:     "对正常数据敏感",
        Accuracy: 0.90,
    },
    {
        Name:     "K-means",
        UseCase:  "模式分类",
        Pros:     "简单、可解释",
        Cons:     "需要预设类别数",
        Accuracy: 0.85,
    },
    {
        Name:     "LSTM",
        UseCase:  "时序预测",
        Pros:     "捕获时间依赖",
        Cons:     "训练成本高",
        Accuracy: 0.88,
    },
    {
        Name:     "Autoencoder",
        UseCase:  "重构误差",
        Pros:     "无监督学习",
        Cons:     "计算复杂",
        Accuracy: 0.87,
    },
}
```

**关键实现点**:

1. 实现 Isolation Forest、K-means、LSTM 三种异常检测算法
2. 使用集成学习方法，结合多个模型的预测结果
3. 支持用户反馈学习，根据误报标记在线更新模型
4. 实现异常根因分析，自动关联相关日志和特征
5. 提供完整的模型评估指标：准确率、精确率、召回率、F1 分数、误报率

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| ml_enabled | bool | true | 是否启用机器学习 |
| models | array | [] | 启用的模型列表 |
| anomaly_threshold | float | 70.0 | 异常分数阈值 |
| isolation_forest_trees | int | 100 | Isolation Forest 树数量 |
| isolation_forest_sample_size | int | 256 | Isolation Forest 采样大小 |
| kmeans_k | int | 5 | K-means 聚类数量 |
| kmeans_max_iter | int | 100 | K-means 最大迭代次数 |
| lstm_window_size | int | 10 | LSTM 时间窗口大小 |
| model_weights | object | {} | 模型权重配置 |
| feedback_learning_enabled | bool | true | 是否启用反馈学习 |
| model_update_interval | string | "24h" | 模型更新间隔 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一次异常检测）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值和模型指标
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN ML 模型变更时，THE System SHALL 验证模型的有效性和兼容性
6. THE System SHALL 支持 ML 模型的热加载，无需重启服务
7. THE System SHALL 支持模型版本管理，可回滚到历史版本

---


#### 需求 3-13：智能日志聚类与摘要 [Phase 2]

**用户故事**: 

作为运维工程师，我希望系统能够自动对相似日志进行聚类并生成摘要，以便快速了解日志的整体情况和主要问题。

**验收标准**:

1. THE Clustering_Engine SHALL 基于日志内容的相似性（余弦相似度 ≥ 0.8）自动进行聚类分析
2. WHEN 展示聚类结果时，THE UI SHALL 显示每个聚类的代表性日志、日志数量和时间分布
3. THE Clustering_Engine SHALL 为每个日志聚类自动生成不超过 100 字的摘要
4. THE Clustering_Engine SHALL 支持增量聚类，实时将新日志归入已有聚类或创建新聚类，延迟 ≤ 5 秒
5. THE Clustering_Engine SHALL 支持多种聚类算法（K-means、DBSCAN、层次聚类）
6. THE UI SHALL 提供聚类可视化，展示聚类分布和关系
7. THE Clustering_Engine SHALL 自动识别日志模板，提取变量部分
8. THE Clustering_Engine SHALL 支持聚类导出和分享
9. THE Clustering_Engine SHALL 提供聚类趋势分析，展示聚类随时间的变化
10. THE Clustering_Engine SHALL 通过配置中心管理聚类参数，支持热更新

**实现方向**:

**实现方式**:

```go
// 聚类引擎
type ClusteringEngine struct {
    algorithm   ClusteringAlgorithm    // 聚类算法
    vectorizer  *TextVectorizer        // 文本向量化
    summarizer  *LogSummarizer         // 日志摘要生成器
    template    *TemplateExtractor     // 模板提取器
    visualizer  *ClusterVisualizer     // 聚类可视化
    config      atomic.Value           // 配置（支持热更新）
}

// 聚类算法接口
type ClusteringAlgorithm interface {
    Fit(data [][]float64) error
    Predict(input []float64) int
    GetClusters() []*Cluster
    Update(data [][]float64) error // 增量更新
}

// 聚类
type Cluster struct {
    ID              int                // 聚类 ID
    Centroid        []float64          // 聚类中心
    Members         []*LogEntry        // 成员日志
    Representative  *LogEntry          // 代表性日志
    Template        string             // 日志模板
    Summary         string             // 聚类摘要
    TimeDistribution map[string]int    // 时间分布
    CreatedAt       time.Time          // 创建时间
    UpdatedAt       time.Time          // 更新时间
}

// 执行聚类分析
func (ce *ClusteringEngine) PerformClustering(ctx context.Context, logs []*LogEntry) ([]*Cluster, error) {
    log.Info("开始聚类分析", "log_count", len(logs))
    
    // 1. 文本向量化
    vectors := make([][]float64, len(logs))
    for i, entry := range logs {
        vector, err := ce.vectorizer.Vectorize(entry.Message)
        if err != nil {
            return nil, fmt.Errorf("向量化失败: %w", err)
        }
        vectors[i] = vector
    }
    
    // 2. 执行聚类
    if err := ce.algorithm.Fit(vectors); err != nil {
        return nil, fmt.Errorf("聚类失败: %w", err)
    }
    
    // 3. 获取聚类结果
    clusters := ce.algorithm.GetClusters()
    
    // 4. 为每个聚类分配日志
    for i, entry := range logs {
        clusterID := ce.algorithm.Predict(vectors[i])
        if clusterID >= 0 && clusterID < len(clusters) {
            clusters[clusterID].Members = append(clusters[clusterID].Members, entry)
        }
    }
    
    // 5. 处理每个聚类
    for _, cluster := range clusters {
        // 5.1 选择代表性日志
        cluster.Representative = ce.selectRepresentative(cluster)
        
        // 5.2 提取日志模板
        cluster.Template = ce.template.Extract(cluster.Members)
        
        // 5.3 生成摘要
        cluster.Summary = ce.summarizer.Generate(cluster)
        
        // 5.4 计算时间分布
        cluster.TimeDistribution = ce.calculateTimeDistribution(cluster.Members)
    }
    
    log.Info("聚类分析完成", "cluster_count", len(clusters))
    return clusters, nil
}

// DBSCAN 聚类算法
type DBSCAN struct {
    epsilon     float64                // 邻域半径
    minPoints   int                    // 最小点数
    clusters    []*Cluster             // 聚类结果
}

// 训练 DBSCAN
func (db *DBSCAN) Fit(data [][]float64) error {
    log.Info("开始 DBSCAN 聚类", "epsilon", db.epsilon, "min_points", db.minPoints)
    
    n := len(data)
    visited := make([]bool, n)
    labels := make([]int, n)
    
    // 初始化所有点为噪声点
    for i := range labels {
        labels[i] = -1
    }
    
    clusterID := 0
    
    // 遍历所有点
    for i := 0; i < n; i++ {
        if visited[i] {
            continue
        }
        
        visited[i] = true
        
        // 找到邻域内的点
        neighbors := db.findNeighbors(data, i, data)
        
        if len(neighbors) < db.minPoints {
            // 噪声点
            labels[i] = -1
            continue
        }
        
        // 创建新聚类
        labels[i] = clusterID
        
        // 扩展聚类
        db.expandCluster(data, i, neighbors, clusterID, visited, labels)
        
        clusterID++
    }
    
    // 构建聚类结果
    db.clusters = make([]*Cluster, clusterID)
    for i := 0; i < clusterID; i++ {
        db.clusters[i] = &Cluster{
            ID:      i,
            Members: []*LogEntry{},
        }
    }
    
    log.Info("DBSCAN 聚类完成", "cluster_count", clusterID)
    return nil
}

// 找到邻域内的点
func (db *DBSCAN) findNeighbors(data [][]float64, pointIdx int, allData [][]float64) []int {
    neighbors := []int{}
    
    for i, point := range allData {
        distance := db.euclideanDistance(data[pointIdx], point)
        if distance <= db.epsilon {
            neighbors = append(neighbors, i)
        }
    }
    
    return neighbors
}

// 扩展聚类
func (db *DBSCAN) expandCluster(data [][]float64, pointIdx int, neighbors []int, clusterID int, visited []bool, labels []int) {
    queue := neighbors
    
    for len(queue) > 0 {
        // 取出队首元素
        current := queue[0]
        queue = queue[1:]
        
        if visited[current] {
            continue
        }
        
        visited[current] = true
        labels[current] = clusterID
        
        // 找到当前点的邻域
        currentNeighbors := db.findNeighbors(data, current, data)
        
        if len(currentNeighbors) >= db.minPoints {
            // 将邻域点加入队列
            queue = append(queue, currentNeighbors...)
        }
    }
}

// 层次聚类
type HierarchicalClustering struct {
    linkage     string                 // 链接方式：single/complete/average
    threshold   float64                // 距离阈值
    clusters    []*Cluster             // 聚类结果
}

// 训练层次聚类
func (hc *HierarchicalClustering) Fit(data [][]float64) error {
    log.Info("开始层次聚类", "linkage", hc.linkage, "threshold", hc.threshold)
    
    n := len(data)
    
    // 1. 初始化：每个点是一个聚类
    clusters := make([][]*int, n)
    for i := 0; i < n; i++ {
        clusters[i] = []*int{&i}
    }
    
    // 2. 计算距离矩阵
    distMatrix := hc.computeDistanceMatrix(data)
    
    // 3. 迭代合并聚类
    for len(clusters) > 1 {
        // 找到最近的两个聚类
        minDist := math.MaxFloat64
        minI, minJ := -1, -1
        
        for i := 0; i < len(clusters); i++ {
            for j := i + 1; j < len(clusters); j++ {
                dist := hc.clusterDistance(clusters[i], clusters[j], distMatrix)
                if dist < minDist {
                    minDist = dist
                    minI, minJ = i, j
                }
            }
        }
        
        // 如果最小距离超过阈值，停止合并
        if minDist > hc.threshold {
            break
        }
        
        // 合并聚类
        clusters[minI] = append(clusters[minI], clusters[minJ]...)
        clusters = append(clusters[:minJ], clusters[minJ+1:]...)
    }
    
    // 4. 构建聚类结果
    hc.clusters = make([]*Cluster, len(clusters))
    for i, cluster := range clusters {
        hc.clusters[i] = &Cluster{
            ID:      i,
            Members: []*LogEntry{},
        }
    }
    
    log.Info("层次聚类完成", "cluster_count", len(clusters))
    return nil
}

// 文本向量化
type TextVectorizer struct {
    method      string                 // 向量化方法：tfidf/word2vec/bert
    vocabulary  map[string]int         // 词汇表
    idf         map[string]float64     // IDF 值
}

// TF-IDF 向量化
func (tv *TextVectorizer) Vectorize(text string) ([]float64, error) {
    // 1. 分词
    tokens := tv.tokenize(text)
    
    // 2. 计算 TF（词频）
    tf := make(map[string]float64)
    for _, token := range tokens {
        tf[token]++
    }
    
    // 标准化 TF
    for token := range tf {
        tf[token] /= float64(len(tokens))
    }
    
    // 3. 计算 TF-IDF
    vector := make([]float64, len(tv.vocabulary))
    for token, freq := range tf {
        if idx, ok := tv.vocabulary[token]; ok {
            idf := tv.idf[token]
            vector[idx] = freq * idf
        }
    }
    
    // 4. L2 标准化
    norm := 0.0
    for _, val := range vector {
        norm += val * val
    }
    norm = math.Sqrt(norm)
    
    if norm > 0 {
        for i := range vector {
            vector[i] /= norm
        }
    }
    
    return vector, nil
}

// 日志摘要生成器
type LogSummarizer struct {
    maxLength int // 最大摘要长度
}

// 生成聚类摘要
func (ls *LogSummarizer) Generate(cluster *Cluster) string {
    if len(cluster.Members) == 0 {
        return ""
    }
    
    // 1. 提取关键信息
    errorCount := 0
    services := make(map[string]int)
    keywords := make(map[string]int)
    
    for _, entry := range cluster.Members {
        // 统计错误数量
        if entry.Level == "ERROR" || entry.Level == "FATAL" {
            errorCount++
        }
        
        // 统计服务
        services[entry.Source]++
        
        // 提取关键词
        words := ls.extractKeywords(entry.Message)
        for _, word := range words {
            keywords[word]++
        }
    }
    
    // 2. 找到最频繁的服务
    topService := ""
    maxCount := 0
    for service, count := range services {
        if count > maxCount {
            maxCount = count
            topService = service
        }
    }
    
    // 3. 找到最频繁的关键词
    topKeywords := ls.getTopKeywords(keywords, 3)
    
    // 4. 生成摘要
    summary := fmt.Sprintf("%s 相关日志，共 %d 条", cluster.Template, len(cluster.Members))
    
    if errorCount > 0 {
        summary += fmt.Sprintf("，其中 %d 条错误", errorCount)
    }
    
    if topService != "" {
        summary += fmt.Sprintf("，主要来自 %s 服务", topService)
    }
    
    if len(topKeywords) > 0 {
        summary += fmt.Sprintf("，关键词：%s", strings.Join(topKeywords, "、"))
    }
    
    // 5. 添加时间分布信息
    peakHour := ls.findPeakHour(cluster.TimeDistribution)
    if peakHour != "" {
        summary += fmt.Sprintf("，主要发生在 %s", peakHour)
    }
    
    // 6. 限制长度
    if len(summary) > ls.maxLength {
        summary = summary[:ls.maxLength-3] + "..."
    }
    
    return summary
}

// 模板提取器
type TemplateExtractor struct{}

// 提取日志模板
func (te *TemplateExtractor) Extract(logs []*LogEntry) string {
    if len(logs) == 0 {
        return ""
    }
    
    // 1. 分词所有日志
    tokensList := make([][]string, len(logs))
    for i, entry := range logs {
        tokensList[i] = te.tokenize(entry.Message)
    }
    
    // 2. 找到公共部分和变量部分
    template := []string{}
    maxLen := len(tokensList[0])
    
    for i := 0; i < maxLen; i++ {
        // 检查所有日志在位置 i 的 token 是否相同
        allSame := true
        firstToken := tokensList[0][i]
        
        for j := 1; j < len(tokensList); j++ {
            if i >= len(tokensList[j]) || tokensList[j][i] != firstToken {
                allSame = false
                break
            }
        }
        
        if allSame {
            // 公共部分
            template = append(template, firstToken)
        } else {
            // 变量部分
            if te.isNumeric(firstToken) {
                template = append(template, "<NUM>")
            } else if te.isTimestamp(firstToken) {
                template = append(template, "<TIME>")
            } else if te.isID(firstToken) {
                template = append(template, "<ID>")
            } else {
                template = append(template, "<VAR>")
            }
        }
    }
    
    return strings.Join(template, " ")
}

// 判断是否是数字
func (te *TemplateExtractor) isNumeric(token string) bool {
    _, err := strconv.ParseFloat(token, 64)
    return err == nil
}

// 判断是否是时间戳
func (te *TemplateExtractor) isTimestamp(token string) bool {
    // 尝试解析常见的时间格式
    formats := []string{
        time.RFC3339,
        "2006-01-02 15:04:05",
        "2006/01/02 15:04:05",
    }
    
    for _, format := range formats {
        if _, err := time.Parse(format, token); err == nil {
            return true
        }
    }
    
    return false
}

// 判断是否是 ID
func (te *TemplateExtractor) isID(token string) bool {
    // 检查是否是 UUID 或类似格式
    uuidPattern := regexp.MustCompile(`^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$`)
    return uuidPattern.MatchString(token)
}

// 增量聚类
func (ce *ClusteringEngine) IncrementalClustering(ctx context.Context, newLog *LogEntry) (*Cluster, error) {
    // 1. 向量化新日志
    vector, err := ce.vectorizer.Vectorize(newLog.Message)
    if err != nil {
        return nil, fmt.Errorf("向量化失败: %w", err)
    }
    
    // 2. 找到最相似的聚类
    clusters := ce.algorithm.GetClusters()
    maxSimilarity := 0.0
    bestCluster := -1
    
    for i, cluster := range clusters {
        similarity := ce.cosineSimilarity(vector, cluster.Centroid)
        if similarity > maxSimilarity {
            maxSimilarity = similarity
            bestCluster = i
        }
    }
    
    // 3. 判断是否加入现有聚类
    similarityThreshold := 0.8
    
    if maxSimilarity >= similarityThreshold && bestCluster >= 0 {
        // 加入现有聚类
        cluster := clusters[bestCluster]
        cluster.Members = append(cluster.Members, newLog)
        cluster.UpdatedAt = time.Now()
        
        // 更新聚类中心
        ce.updateCentroid(cluster, vector)
        
        log.Debug("日志加入现有聚类", "cluster_id", cluster.ID, "similarity", maxSimilarity)
        return cluster, nil
    }
    
    // 4. 创建新聚类
    newCluster := &Cluster{
        ID:        len(clusters),
        Centroid:  vector,
        Members:   []*LogEntry{newLog},
        CreatedAt: time.Now(),
        UpdatedAt: time.Now(),
    }
    
    // 更新算法
    ce.algorithm.Update([][]float64{vector})
    
    log.Debug("创建新聚类", "cluster_id", newCluster.ID)
    return newCluster, nil
}

// 余弦相似度
func (ce *ClusteringEngine) cosineSimilarity(vec1, vec2 []float64) float64 {
    if len(vec1) != len(vec2) {
        return 0.0
    }
    
    dotProduct := 0.0
    norm1 := 0.0
    norm2 := 0.0
    
    for i := range vec1 {
        dotProduct += vec1[i] * vec2[i]
        norm1 += vec1[i] * vec1[i]
        norm2 += vec2[i] * vec2[i]
    }
    
    if norm1 == 0 || norm2 == 0 {
        return 0.0
    }
    
    return dotProduct / (math.Sqrt(norm1) * math.Sqrt(norm2))
}

// 聚类可视化
type ClusterVisualizer struct{}

// 生成可视化数据
func (cv *ClusterVisualizer) Visualize(clusters []*Cluster) *VisualizationData {
    // 使用 t-SNE 降维到 2D
    points := cv.reduceDimensions(clusters)
    
    // 构建可视化数据
    data := &VisualizationData{
        Clusters: make([]ClusterVisualization, len(clusters)),
    }
    
    for i, cluster := range clusters {
        data.Clusters[i] = ClusterVisualization{
            ID:      cluster.ID,
            Center:  points[i],
            Size:    len(cluster.Members),
            Summary: cluster.Summary,
        }
    }
    
    return data
}

// 聚类示例
var ClusteringExamples = []struct {
    ClusterID   int
    Template    string
    Count       int
    Summary     string
    TimePattern string
}{
    {
        ClusterID:   1,
        Template:    "Database connection timeout after <NUM>s",
        Count:       1234,
        Summary:     "数据库连接超时问题，主要发生在高峰期，影响支付和订单服务",
        TimePattern: "主要集中在 10:00-12:00 和 18:00-20:00",
    },
    {
        ClusterID:   2,
        Template:    "API /api/<VAR> response time <NUM>s exceeds threshold",
        Count:       856,
        Summary:     "用户API响应时间超过阈值，可能与数据库查询优化有关",
        TimePattern: "持续发生，无明显时间规律",
    },
}
```

**关键实现点**:

1. 支持 K-means、DBSCAN、层次聚类三种聚类算法
2. 使用 TF-IDF 进行文本向量化，计算余弦相似度
3. 实现日志模板提取，自动识别变量部分（数字、时间、ID）
4. 实现增量聚类，实时将新日志归入已有聚类或创建新聚类
5. 自动生成聚类摘要，包含日志数量、错误统计、服务分布、关键词、时间分布

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| clustering_enabled | bool | true | 是否启用聚类 |
| clustering_algorithm | string | "dbscan" | 聚类算法：kmeans/dbscan/hierarchical |
| similarity_threshold | float | 0.8 | 相似度阈值 |
| dbscan_epsilon | float | 0.5 | DBSCAN 邻域半径 |
| dbscan_min_points | int | 5 | DBSCAN 最小点数 |
| kmeans_k | int | 10 | K-means 聚类数量 |
| hierarchical_threshold | float | 1.0 | 层次聚类距离阈值 |
| summary_max_length | int | 100 | 摘要最大长度 |
| incremental_clustering_enabled | bool | true | 是否启用增量聚类 |
| template_extraction_enabled | bool | true | 是否启用模板提取 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一次聚类分析）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值和聚类统计
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN 聚类算法变更时，THE System SHALL 验证算法的有效性
6. THE System SHALL 支持聚类参数的动态调整，无需重新训练

---


### 模块三 API 接口汇总

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-3-66 | 获取分析规则列表 | Analysis | GET | /api/v1/analysis/rules | analysis.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-3-67 | 创建分析规则 | Analysis | POST | /api/v1/analysis/rules | analysis.write | Body: rule_config | {code:0,data:{id:"rule-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-3-68 | 更新分析规则 | Analysis | PUT | /api/v1/analysis/rules/{id} | analysis.write | Body: rule_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-3-69 | 删除分析规则 | Analysis | DELETE | /api/v1/analysis/rules/{id} | analysis.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-3-70 | 启用分析规则 | Analysis | POST | /api/v1/analysis/rules/{id}/enable | analysis.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-3-71 | 禁用分析规则 | Analysis | POST | /api/v1/analysis/rules/{id}/disable | analysis.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-3-72 | 获取流处理状态 | Analysis | GET | /api/v1/analysis/stream/status | analysis.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-3-73 | 获取聚合统计 | Analysis | GET | /api/v1/analysis/aggregations | analysis.read | Query: time_range, group_by | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-3-74 | 执行日志查询 | Query | POST | /api/v1/query/search | query.read | Body: query_request | {code:0,data:{items:[],total:0}} | 200/400/401/403/500 | v1 | 是 | 是 | - | - |
| API-3-75 | 执行SQL查询 | Query | POST | /api/v1/query/sql | query.read | Body: {sql} | {code:0,data:{...}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-3-76 | 获取字段自动补全 | Query | GET | /api/v1/query/autocomplete/fields | query.read | Query: prefix | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-3-77 | 获取值自动补全 | Query | GET | /api/v1/query/autocomplete/values | query.read | Query: field, prefix | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-3-78 | 获取搜索历史 | Query | GET | /api/v1/query/history | query.read | Query: limit | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-3-79 | 获取查询模板列表 | Query | GET | /api/v1/query/templates | query.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-3-80 | 保存查询模板 | Query | POST | /api/v1/query/templates | query.write | Body: template | {code:0,data:{id:"tpl-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-3-81 | 删除查询模板 | Query | DELETE | /api/v1/query/templates/{id} | query.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-3-82 | 导出查询结果 | Query | POST | /api/v1/query/export | query.read | Body: {query_request,format} | Binary | 200/400/401/403/500 | v1 | 是 | 否 | - | 返回二进制数据 |
| API-3-83 | 自然语言查询 | NLP | POST | /api/v1/nlp/query | query.read | Body: {input,user_id} | {code:0,data:{...}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-3-84 | 获取查询建议 | NLP | GET | /api/v1/nlp/suggestions | query.read | Query: input, user_id | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-3-85 | 获取查询示例 | NLP | GET | /api/v1/nlp/examples | query.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-3-86 | 检测异常 | ML | POST | /api/v1/ml/anomaly/detect | ml.read | Body: log_entry | {code:0,data:{is_anomaly:false}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-3-87 | 获取异常列表 | ML | GET | /api/v1/ml/anomaly/list | ml.read | Query: time_range, page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-3-88 | 提交异常反馈 | ML | POST | /api/v1/ml/anomaly/{id}/feedback | ml.write | Body: {is_false_positive} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-3-89 | 获取模型列表 | ML | GET | /api/v1/ml/models | ml.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-3-90 | 获取模型指标 | ML | GET | /api/v1/ml/models/{name}/metrics | ml.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-3-91 | 更新模型 | ML | POST | /api/v1/ml/models/{name}/update | ml.write | Body: training_data | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-3-92 | 执行聚类分析 | Clustering | POST | /api/v1/clustering/analyze | ml.write | Body: {logs,algorithm} | {code:0,data:{...}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-3-93 | 增量聚类 | Clustering | POST | /api/v1/clustering/incremental | ml.write | Body: log_entry | {code:0,data:{cluster_id:1}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-3-94 | 获取聚类列表 | Clustering | GET | /api/v1/clustering/list | ml.read | Query: time_range | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-3-95 | 获取聚类详情 | Clustering | GET | /api/v1/clustering/{id} | ml.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-3-96 | 获取聚类摘要 | Clustering | GET | /api/v1/clustering/{id}/summary | ml.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-3-97 | 获取聚类可视化数据 | Clustering | GET | /api/v1/clustering/visualize | ml.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-3-98 | 获取聚类趋势 | Clustering | GET | /api/v1/clustering/trends | ml.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-3-99 | 触发配置热更新 | Analysis | POST | /api/v1/analysis/config/reload | analysis.admin | Body: {component} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | 仅管理员 |
| API-3-100 | 健康检查 | Analysis | GET | /api/v1/analysis/health | 无 | 无 | {code:0,data:{status:"healthy"}} | 200/500 | v1 | 是 | 否 | - | 公开接口 |
| API-3-101 | 获取分析指标 | Analysis | GET | /api/v1/analysis/metrics | analysis.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |

---



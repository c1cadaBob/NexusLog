# 模块十：性能与资源优化

> **文档版本**: v1.0  
> **创建日期**: 2026-01-29  
> **所属模块**: 模块十：性能与资源优化  
> **需求编号**: 

---

**模块概述**

性能与资源优化模块通过自动扩缩容、实时监控、查询优化等技术手段，确保日志管理系统在各种负载下保持高性能和资源利用率。系统能够根据实际负载自动调整资源配置，提供实时监控和告警，优化查询性能，降低运营成本。

**核心能力**:
- 基于指标的自动扩缩容（HPA/VPA）
- 实时资源监控和趋势预测
- 智能告警和资源优化建议
- 查询缓存和性能优化
- 慢查询识别和优化
- 配置热更新支持

**技术栈选型**

| 技术类别 | 技术选型 | 版本要求 | 用途说明 |
|---------|---------|---------|---------|
| 自动扩缩容 | Kubernetes HPA | 1.28+ | 水平自动扩展 |
| 自动扩缩容 | Kubernetes VPA | 0.13+ | 垂直自动扩展 |
| 监控系统 | Prometheus | 2.48+ | 指标采集与存储 |
| 可视化 | Grafana | 10.2+ | 监控仪表盘 |
| 性能分析 | pprof | - | Go 程序性能剖析 |
| 性能分析 | perf | - | 系统级性能分析 |
| 资源管理 | Kubernetes Resource Quotas | - | 资源配额管理 |
| 查询缓存 | Redis | 7.2+ | 查询结果缓存 |
| 连接池 | pgx pool | 5.5+ | PostgreSQL 连接池 |
| 配置管理 | PostgreSQL + Redis | 15+ / 7+ | 配置中心与热更新 |

**架构设计**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      性能与资源优化架构                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      监控与指标采集层                              │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │  │
│  │  │  Prometheus  │  │   Node       │  │   cAdvisor   │          │  │
│  │  │  (指标存储)   │  │  Exporter    │  │ (容器指标)   │          │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │  │
│  │         │                 │                 │                   │  │
│  │         └─────────────────┴─────────────────┘                   │  │
│  │                           │                                      │  │
│  │                  ┌────────▼────────┐                            │  │
│  │                  │  Metrics Server │                            │  │
│  │                  │  (聚合指标)      │                            │  │
│  │                  └────────┬────────┘                            │  │
│  └───────────────────────────┼─────────────────────────────────────┘  │
│                              │                                         │
│  ┌───────────────────────────▼─────────────────────────────────────┐  │
│  │                      自动扩缩容层                                 │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  Horizontal Pod Autoscaler (HPA)                         │  │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │  │  │
│  │  │  │ CPU 指标  │  │ 内存指标  │  │ 自定义指标│               │  │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘               │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  Vertical Pod Autoscaler (VPA)                           │  │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │  │  │
│  │  │  │ 资源推荐  │  │ 自动更新  │  │ 历史分析  │               │  │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘               │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────┬─────────────────────────────────────┘  │
│                              │                                         │
│  ┌───────────────────────────▼─────────────────────────────────────┐  │
│  │                      应用服务层                                   │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  Collector Pods (动态副本数: 3-10)                          │ │  │
│  │  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐        │ │  │
│  │  │  │ Pod1 │  │ Pod2 │  │ Pod3 │  │ ...  │  │ Pod10│        │ │  │
│  │  │  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘        │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  API Server Pods (动态副本数: 2-8)                          │ │  │
│  │  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                  │ │  │
│  │  │  │ Pod1 │  │ Pod2 │  │ ...  │  │ Pod8 │                  │ │  │
│  │  │  └──────┘  └──────┘  └──────┘  └──────┘                  │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      查询优化层                                    │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │  │
│  │  │  Query Cache │  │  Connection  │  │  Query       │          │  │
│  │  │  (Redis)     │  │  Pool        │  │  Optimizer   │          │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │  │
│  │  │  Slow Query  │  │  Index       │  │  Query       │          │  │
│  │  │  Detector    │  │  Advisor     │  │  Planner     │          │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      告警与分析层                                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │  │
│  │  │ Alertmanager │  │  Trend       │  │  Resource    │          │  │
│  │  │ (告警路由)    │  │  Predictor   │  │  Advisor     │          │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      可视化层                                      │  │
│  │  ┌──────────────────────────────────────────────────────────────┐│  │
│  │  │  Grafana 仪表盘                                               ││  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    ││  │
│  │  │  │ 资源监控  │  │ 性能分析  │  │ 扩缩容历史│  │ 查询性能  │    ││  │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    ││  │
│  │  └──────────────────────────────────────────────────────────────┘│  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      配置中心 (热更新)                             │  │
│  │  ┌──────────────────┐        ┌──────────────────┐               │  │
│  │  │   PostgreSQL     │◄──────►│      Redis       │               │  │
│  │  │  (配置持久化)     │        │   (配置缓存)      │               │  │
│  │  └──────────────────┘        └──────────────────┘               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

**架构说明**:
1. **监控层**: Prometheus 采集各类指标，Metrics Server 聚合指标供 HPA/VPA 使用
2. **扩缩容层**: HPA 基于指标自动调整副本数，VPA 优化资源配置
3. **应用层**: 各服务支持动态扩缩容，副本数根据负载自动调整
4. **查询优化层**: Redis 缓存、连接池、慢查询检测、索引优化
5. **告警层**: Alertmanager 路由告警，趋势预测和资源优化建议
6. **可视化层**: Grafana 提供多维度监控仪表盘
7. **配置中心**: PostgreSQL + Redis 支持配置热更新

**需求详情**

#### 需求 10-32: 自动扩缩容 [MVP]

**用户故事**:
作为运维工程师，我希望系统能够根据负载自动调整资源，以便在保证性能的同时降低成本。

**验收标准**:

1. THE System SHALL 支持基于 CPU、内存、日志吞吐量三种指标的自动扩缩容
2. WHEN 触发扩容条件时，THE System SHALL 在 2 分钟内完成新副本的启动和流量接入
3. THE System SHALL 支持至少 3 种预定义扩缩容策略（保守、平衡、激进）
4. THE System SHALL 记录所有扩缩容事件，包含时间、原因、指标值、副本数变化
5. THE System SHALL 支持自定义扩缩容阈值（CPU: 50-90%，内存: 60-85%，吞吐量: 自定义）
6. THE System SHALL 支持定时扩缩容，可配置每日高峰期自动扩容
7. THE System SHALL 支持最小副本数（>=2）和最大副本数（<=20）限制
8. WHEN 缩容时，THE System SHALL 确保待处理数据全部处理完成，数据丢失率 = 0%
9. THE System SHALL 提供扩缩容历史分析报告，包含成本节省、性能影响
10. THE System SHALL 通过配置中心管理扩缩容策略，配置变更后 30 秒内生效

**实现方向**:

**实现方式**:

```go
// internal/performance/autoscaling/manager.go
package autoscaling

import (
    "context"
    "time"
)

// 自动扩缩容管理器
type AutoscalingManager struct {
    config         *AutoscalingConfig
    hpaController  *HPAController
    vpaController  *VPAController
    metricsClient  *MetricsClient
    scaleExecutor  *ScaleExecutor
    eventRecorder  *EventRecorder
}

// 扩缩容配置
type AutoscalingConfig struct {
    Enabled           bool
    Strategy          ScalingStrategy
    MinReplicas       int
    MaxReplicas       int
    ScaleUpCooldown   time.Duration
    ScaleDownCooldown time.Duration
    Metrics           []MetricSpec
    Schedule          []ScheduleSpec
}

// 扩缩容策略
type ScalingStrategy string

const (
    StrategyConservative ScalingStrategy = "conservative"  // 保守策略
    StrategyBalanced     ScalingStrategy = "balanced"      // 平衡策略
    StrategyAggressive   ScalingStrategy = "aggressive"    // 激进策略
)

// 指标规格
type MetricSpec struct {
    Type       MetricType
    Threshold  float64
    Window     time.Duration
}

// 指标类型
type MetricType string

const (
    MetricTypeCPU        MetricType = "cpu"
    MetricTypeMemory     MetricType = "memory"
    MetricTypeThroughput MetricType = "throughput"
    MetricTypeCustom     MetricType = "custom"
)

// 定时扩缩容规格
type ScheduleSpec struct {
    Name        string
    CronExpr    string
    Replicas    int
    Enabled     bool
}

// 扩缩容事件
type ScalingEvent struct {
    Timestamp     time.Time
    Type          ScalingType
    Reason        string
    OldReplicas   int
    NewReplicas   int
    Metrics       map[string]float64
    Duration      time.Duration
}

// 扩缩容类型
type ScalingType string

const (
    ScalingTypeScaleUp   ScalingType = "scale_up"
    ScalingTypeScaleDown ScalingType = "scale_down"
)

// 创建自动扩缩容管理器
func NewAutoscalingManager(config *AutoscalingConfig) (*AutoscalingManager, error) {
    am := &AutoscalingManager{
        config: config,
    }
    
    // 初始化 HPA 控制器
    am.hpaController = NewHPAController(config)
    
    // 初始化 VPA 控制器
    am.vpaController = NewVPAController(config)
    
    // 初始化指标客户端
    am.metricsClient = NewMetricsClient()
    
    // 初始化扩缩容执行器
    am.scaleExecutor = NewScaleExecutor()
    
    // 初始化事件记录器
    am.eventRecorder = NewEventRecorder()
    
    return am, nil
}


// 启动自动扩缩容管理器
func (am *AutoscalingManager) Start(ctx context.Context) error {
    // 启动 HPA 控制器
    go am.hpaController.Run(ctx, am.handleScalingDecision)
    
    // 启动 VPA 控制器
    go am.vpaController.Run(ctx)
    
    // 启动定时扩缩容调度器
    go am.runScheduledScaling(ctx)
    
    log.Info("自动扩缩容管理器已启动")
    return nil
}

// 处理扩缩容决策
func (am *AutoscalingManager) handleScalingDecision(ctx context.Context) {
    // 1. 收集当前指标
    metrics := am.collectMetrics(ctx)
    
    // 2. 获取当前副本数
    currentReplicas := am.getCurrentReplicas()
    
    // 3. 计算目标副本数
    targetReplicas := am.calculateTargetReplicas(metrics, currentReplicas)
    
    // 4. 检查是否需要扩缩容
    if targetReplicas == currentReplicas {
        return
    }
    
    // 5. 检查冷却期
    if !am.canScale(targetReplicas > currentReplicas) {
        log.Debug("处于冷却期，跳过扩缩容")
        return
    }
    
    // 6. 执行扩缩容
    event := &ScalingEvent{
        Timestamp:   time.Now(),
        OldReplicas: currentReplicas,
        NewReplicas: targetReplicas,
        Metrics:     metrics,
    }
    
    if targetReplicas > currentReplicas {
        event.Type = ScalingTypeScaleUp
        event.Reason = am.getScaleUpReason(metrics)
        am.scaleUp(ctx, targetReplicas, event)
    } else {
        event.Type = ScalingTypeScaleDown
        event.Reason = am.getScaleDownReason(metrics)
        am.scaleDown(ctx, targetReplicas, event)
    }
}

// 收集指标
func (am *AutoscalingManager) collectMetrics(ctx context.Context) map[string]float64 {
    metrics := make(map[string]float64)
    
    for _, spec := range am.config.Metrics {
        value := am.metricsClient.GetMetric(ctx, spec.Type, spec.Window)
        metrics[string(spec.Type)] = value
    }
    
    return metrics
}

// 计算目标副本数
func (am *AutoscalingManager) calculateTargetReplicas(metrics map[string]float64, current int) int {
    var targetReplicas int
    
    switch am.config.Strategy {
    case StrategyConservative:
        targetReplicas = am.calculateConservative(metrics, current)
    case StrategyBalanced:
        targetReplicas = am.calculateBalanced(metrics, current)
    case StrategyAggressive:
        targetReplicas = am.calculateAggressive(metrics, current)
    default:
        targetReplicas = current
    }
    
    // 应用最小/最大副本数限制
    if targetReplicas < am.config.MinReplicas {
        targetReplicas = am.config.MinReplicas
    }
    if targetReplicas > am.config.MaxReplicas {
        targetReplicas = am.config.MaxReplicas
    }
    
    return targetReplicas
}

// 保守策略计算
func (am *AutoscalingManager) calculateConservative(metrics map[string]float64, current int) int {
    // 保守策略：只有当指标持续超过阈值时才扩容
    cpuUsage := metrics["cpu"]
    memUsage := metrics["memory"]
    
    // CPU 超过 80% 或内存超过 85% 时扩容
    if cpuUsage > 80.0 || memUsage > 85.0 {
        return int(float64(current) * 1.2) // 扩容 20%
    }
    
    // CPU 低于 30% 且内存低于 40% 时缩容
    if cpuUsage < 30.0 && memUsage < 40.0 {
        return int(float64(current) * 0.8) // 缩容 20%
    }
    
    return current
}

// 平衡策略计算
func (am *AutoscalingManager) calculateBalanced(metrics map[string]float64, current int) int {
    cpuUsage := metrics["cpu"]
    memUsage := metrics["memory"]
    throughput := metrics["throughput"]
    
    // 综合考虑多个指标
    avgUsage := (cpuUsage + memUsage) / 2
    
    if avgUsage > 70.0 || throughput > 80000 {
        return int(float64(current) * 1.5) // 扩容 50%
    }
    
    if avgUsage < 40.0 && throughput < 20000 {
        return int(float64(current) * 0.7) // 缩容 30%
    }
    
    return current
}

// 激进策略计算
func (am *AutoscalingManager) calculateAggressive(metrics map[string]float64, current int) int {
    cpuUsage := metrics["cpu"]
    
    // 激进策略：快速响应负载变化
    if cpuUsage > 60.0 {
        return int(float64(current) * 2.0) // 扩容 100%
    }
    
    if cpuUsage < 50.0 {
        return int(float64(current) * 0.5) // 缩容 50%
    }
    
    return current
}


// 扩容
func (am *AutoscalingManager) scaleUp(ctx context.Context, targetReplicas int, event *ScalingEvent) {
    startTime := time.Now()
    log.Infof("开始扩容: %d -> %d", event.OldReplicas, targetReplicas)
    
    // 执行扩容
    if err := am.scaleExecutor.ScaleUp(ctx, targetReplicas); err != nil {
        log.Errorf("扩容失败: %v", err)
        return
    }
    
    // 等待新副本就绪（最多等待2分钟）
    if err := am.waitForReplicasReady(ctx, targetReplicas, 2*time.Minute); err != nil {
        log.Errorf("等待副本就绪超时: %v", err)
    }
    
    event.Duration = time.Since(startTime)
    
    // 记录事件
    am.eventRecorder.Record(event)
    
    // 更新冷却期
    am.updateCooldown(ScalingTypeScaleUp)
    
    log.Infof("扩容完成: 耗时=%v", event.Duration)
}

// 缩容
func (am *AutoscalingManager) scaleDown(ctx context.Context, targetReplicas int, event *ScalingEvent) {
    startTime := time.Now()
    log.Infof("开始缩容: %d -> %d", event.OldReplicas, targetReplicas)
    
    // 1. 确保待处理数据全部处理完成
    if err := am.drainPendingData(ctx); err != nil {
        log.Errorf("排空待处理数据失败: %v", err)
        return
    }
    
    // 2. 执行缩容
    if err := am.scaleExecutor.ScaleDown(ctx, targetReplicas); err != nil {
        log.Errorf("缩容失败: %v", err)
        return
    }
    
    event.Duration = time.Since(startTime)
    
    // 记录事件
    am.eventRecorder.Record(event)
    
    // 更新冷却期
    am.updateCooldown(ScalingTypeScaleDown)
    
    log.Infof("缩容完成: 耗时=%v", event.Duration)
}

// 排空待处理数据
func (am *AutoscalingManager) drainPendingData(ctx context.Context) error {
    log.Info("开始排空待处理数据...")
    
    // 等待所有缓冲区清空（最多等待5分钟）
    drainCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
    defer cancel()
    
    ticker := time.NewTicker(5 * time.Second)
    defer ticker.Stop()
    
    for {
        select {
        case <-drainCtx.Done():
            return fmt.Errorf("排空数据超时")
        case <-ticker.C:
            if am.isPendingDataEmpty() {
                log.Info("待处理数据已清空")
                return nil
            }
        }
    }
}

// 定时扩缩容
func (am *AutoscalingManager) runScheduledScaling(ctx context.Context) {
    for _, schedule := range am.config.Schedule {
        if !schedule.Enabled {
            continue
        }
        
        // 解析 cron 表达式并调度
        go am.scheduleScaling(ctx, schedule)
    }
}

// 调度扩缩容
func (am *AutoscalingManager) scheduleScaling(ctx context.Context, schedule ScheduleSpec) {
    // 使用 cron 库解析表达式
    c := cron.New()
    c.AddFunc(schedule.CronExpr, func() {
        log.Infof("执行定时扩缩容: %s, 目标副本数=%d", schedule.Name, schedule.Replicas)
        
        event := &ScalingEvent{
            Timestamp:   time.Now(),
            Type:        ScalingTypeScaleUp,
            Reason:      fmt.Sprintf("scheduled: %s", schedule.Name),
            OldReplicas: am.getCurrentReplicas(),
            NewReplicas: schedule.Replicas,
        }
        
        am.scaleExecutor.Scale(ctx, schedule.Replicas)
        am.eventRecorder.Record(event)
    })
    c.Start()
    
    <-ctx.Done()
    c.Stop()
}

// 生成扩缩容分析报告
func (am *AutoscalingManager) GenerateAnalysisReport(period time.Duration) *AnalysisReport {
    events := am.eventRecorder.GetEvents(period)
    
    report := &AnalysisReport{
        Period:      period,
        TotalEvents: len(events),
        ScaleUpCount: am.countEventsByType(events, ScalingTypeScaleUp),
        ScaleDownCount: am.countEventsByType(events, ScalingTypeScaleDown),
        AvgScaleUpDuration: am.calculateAvgDuration(events, ScalingTypeScaleUp),
        AvgScaleDownDuration: am.calculateAvgDuration(events, ScalingTypeScaleDown),
        CostSavings: am.calculateCostSavings(events),
        PerformanceImpact: am.calculatePerformanceImpact(events),
    }
    
    return report
}

// 分析报告
type AnalysisReport struct {
    Period               time.Duration
    TotalEvents          int
    ScaleUpCount         int
    ScaleDownCount       int
    AvgScaleUpDuration   time.Duration
    AvgScaleDownDuration time.Duration
    CostSavings          float64  // 成本节省（美元）
    PerformanceImpact    float64  // 性能影响（百分比）
}
```

**关键实现点**:

1. 支持基于 CPU、内存、吞吐量三种指标的自动扩缩容，使用 Kubernetes HPA
2. 实现三种扩缩容策略（保守、平衡、激进），适应不同业务场景
3. 扩容响应时间 < 2 分钟，包含副本启动和流量接入
4. 缩容前确保待处理数据全部处理完成，数据丢失率 = 0%
5. 支持定时扩缩容，使用 cron 表达式配置高峰期自动扩容
6. 实现冷却期机制，避免频繁扩缩容导致系统抖动
7. 完整的事件记录和分析报告，包含成本节省和性能影响分析

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| autoscaling_enabled | bool | true | 是否启用自动扩缩容 |
| strategy | string | "balanced" | 扩缩容策略 |
| min_replicas | int | 2 | 最小副本数 |
| max_replicas | int | 10 | 最大副本数 |
| scale_up_cooldown | int | 180 | 扩容冷却期（秒） |
| scale_down_cooldown | int | 300 | 缩容冷却期（秒） |
| cpu_threshold | float | 70.0 | CPU 阈值（%） |
| memory_threshold | float | 75.0 | 内存阈值（%） |
| throughput_threshold | int | 50000 | 吞吐量阈值（条/秒） |
| schedule_enabled | bool | false | 是否启用定时扩缩容 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 30 秒内生效（下次扩缩容决策生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 30 秒内应用新的扩缩容策略
2. WHEN 阈值配置变更时，THE System SHALL 在下次指标采集时生效
3. THE System SHALL 支持通过 API 查询当前生效的扩缩容配置
4. THE System SHALL 记录所有扩缩容配置变更的审计日志
5. WHEN 副本数限制变更时，THE System SHALL 验证 min_replicas <= max_replicas

---


#### 需求 10-33: 资源监控与告警 [MVP]

**用户故事**:
作为运维工程师，我希望实时监控系统资源使用情况，以便及时发现和解决资源瓶颈问题。

**验收标准**:

1. THE System SHALL 实时监控 CPU、内存、磁盘、网络四种资源的使用率，采集间隔 <= 15 秒
2. THE System SHALL 支持资源使用趋势预测，预测未来 1 小时的资源使用情况，准确率 >= 85%
3. WHEN 资源使用超过阈值时，THE System SHALL 在 30 秒内发送告警通知
4. THE System SHALL 每日自动生成资源使用报告，包含峰值、平均值、趋势分析
5. THE System SHALL 监控关键性能指标（QPS、P50/P95/P99 延迟、错误率），更新频率 <= 10 秒
6. THE System SHALL 支持至少 10 种自定义监控指标，支持 Prometheus 格式
7. THE System SHALL 提供资源使用热力图，展示 24 小时内的资源使用模式
8. THE System SHALL 支持资源使用对比分析，可对比不同时间段或不同服务
9. THE System SHALL 提供至少 5 条资源优化建议，基于历史数据和最佳实践
10. THE System SHALL 通过配置中心管理监控配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/performance/monitoring/manager.go
package monitoring

import (
    "context"
    "time"
)

// 资源监控管理器
type ResourceMonitoringManager struct {
    config          *MonitoringConfig
    metricsCollector *MetricsCollector
    trendPredictor  *TrendPredictor
    alertManager    *AlertManager
    reportGenerator *ReportGenerator
    advisor         *ResourceAdvisor
}

// 监控配置
type MonitoringConfig struct {
    Enabled            bool
    CollectInterval    time.Duration
    AlertThresholds    map[string]float64
    CustomMetrics      []CustomMetric
    PredictionEnabled  bool
    ReportSchedule     string
}

// 自定义指标
type CustomMetric struct {
    Name        string
    Type        string
    Help        string
    Labels      []string
    Enabled     bool
}

// 资源指标
type ResourceMetrics struct {
    Timestamp      time.Time
    CPU            CPUMetrics
    Memory         MemoryMetrics
    Disk           DiskMetrics
    Network        NetworkMetrics
    Performance    PerformanceMetrics
}

// CPU 指标
type CPUMetrics struct {
    UsagePercent   float64
    UserPercent    float64
    SystemPercent  float64
    IdlePercent    float64
    Cores          int
}

// 内存指标
type MemoryMetrics struct {
    UsagePercent   float64
    UsedBytes      int64
    TotalBytes     int64
    AvailableBytes int64
    CachedBytes    int64
}

// 磁盘指标
type DiskMetrics struct {
    UsagePercent   float64
    UsedBytes      int64
    TotalBytes     int64
    ReadBytesPerSec  int64
    WriteBytesPerSec int64
    IOPS           int64
}

// 网络指标
type NetworkMetrics struct {
    RxBytesPerSec  int64
    TxBytesPerSec  int64
    RxPacketsPerSec int64
    TxPacketsPerSec int64
    Errors         int64
}

// 性能指标
type PerformanceMetrics struct {
    QPS           float64
    LatencyP50    time.Duration
    LatencyP95    time.Duration
    LatencyP99    time.Duration
    ErrorRate     float64
}

// 创建资源监控管理器
func NewResourceMonitoringManager(config *MonitoringConfig) (*ResourceMonitoringManager, error) {
    rmm := &ResourceMonitoringManager{
        config: config,
    }
    
    // 初始化指标收集器
    rmm.metricsCollector = NewMetricsCollector(config.CollectInterval)
    
    // 初始化趋势预测器
    if config.PredictionEnabled {
        rmm.trendPredictor = NewTrendPredictor()
    }
    
    // 初始化告警管理器
    rmm.alertManager = NewAlertManager(config.AlertThresholds)
    
    // 初始化报告生成器
    rmm.reportGenerator = NewReportGenerator(config.ReportSchedule)
    
    // 初始化资源顾问
    rmm.advisor = NewResourceAdvisor()
    
    return rmm, nil
}

// 启动资源监控
func (rmm *ResourceMonitoringManager) Start(ctx context.Context) error {
    // 启动指标收集
    go rmm.metricsCollector.Start(ctx, rmm.handleMetrics)
    
    // 启动趋势预测
    if rmm.config.PredictionEnabled {
        go rmm.trendPredictor.Start(ctx)
    }
    
    // 启动报告生成
    go rmm.reportGenerator.Start(ctx, rmm.generateDailyReport)
    
    log.Info("资源监控管理器已启动")
    return nil
}


// 处理指标
func (rmm *ResourceMonitoringManager) handleMetrics(ctx context.Context, metrics *ResourceMetrics) {
    // 1. 检查告警阈值
    rmm.checkAlertThresholds(metrics)
    
    // 2. 更新趋势预测
    if rmm.config.PredictionEnabled {
        rmm.trendPredictor.Update(metrics)
    }
    
    // 3. 存储指标到 Prometheus
    rmm.storeMetrics(metrics)
}

// 检查告警阈值
func (rmm *ResourceMonitoringManager) checkAlertThresholds(metrics *ResourceMetrics) {
    alerts := []Alert{}
    
    // 检查 CPU 使用率
    if threshold, ok := rmm.config.AlertThresholds["cpu"]; ok {
        if metrics.CPU.UsagePercent > threshold {
            alerts = append(alerts, Alert{
                Type:     "cpu_high",
                Severity: "warning",
                Message:  fmt.Sprintf("CPU 使用率过高: %.2f%%", metrics.CPU.UsagePercent),
                Value:    metrics.CPU.UsagePercent,
                Threshold: threshold,
            })
        }
    }
    
    // 检查内存使用率
    if threshold, ok := rmm.config.AlertThresholds["memory"]; ok {
        if metrics.Memory.UsagePercent > threshold {
            alerts = append(alerts, Alert{
                Type:     "memory_high",
                Severity: "warning",
                Message:  fmt.Sprintf("内存使用率过高: %.2f%%", metrics.Memory.UsagePercent),
                Value:    metrics.Memory.UsagePercent,
                Threshold: threshold,
            })
        }
    }
    
    // 检查磁盘使用率
    if threshold, ok := rmm.config.AlertThresholds["disk"]; ok {
        if metrics.Disk.UsagePercent > threshold {
            alerts = append(alerts, Alert{
                Type:     "disk_high",
                Severity: "critical",
                Message:  fmt.Sprintf("磁盘使用率过高: %.2f%%", metrics.Disk.UsagePercent),
                Value:    metrics.Disk.UsagePercent,
                Threshold: threshold,
            })
        }
    }
    
    // 检查错误率
    if threshold, ok := rmm.config.AlertThresholds["error_rate"]; ok {
        if metrics.Performance.ErrorRate > threshold {
            alerts = append(alerts, Alert{
                Type:     "error_rate_high",
                Severity: "critical",
                Message:  fmt.Sprintf("错误率过高: %.2f%%", metrics.Performance.ErrorRate),
                Value:    metrics.Performance.ErrorRate,
                Threshold: threshold,
            })
        }
    }
    
    // 发送告警
    if len(alerts) > 0 {
        rmm.alertManager.SendAlerts(alerts)
    }
}

// 趋势预测器
type TrendPredictor struct {
    history      *MetricsHistory
    model        *PredictionModel
}

// 预测未来资源使用
func (tp *TrendPredictor) Predict(duration time.Duration) *PredictedMetrics {
    // 使用线性回归模型预测
    cpuTrend := tp.model.PredictCPU(tp.history, duration)
    memoryTrend := tp.model.PredictMemory(tp.history, duration)
    diskTrend := tp.model.PredictDisk(tp.history, duration)
    
    return &PredictedMetrics{
        Duration:     duration,
        CPUUsage:     cpuTrend,
        MemoryUsage:  memoryTrend,
        DiskUsage:    diskTrend,
        Confidence:   tp.calculateConfidence(),
    }
}

// 预测指标
type PredictedMetrics struct {
    Duration     time.Duration
    CPUUsage     float64
    MemoryUsage  float64
    DiskUsage    float64
    Confidence   float64  // 置信度
}

// 生成每日报告
func (rmm *ResourceMonitoringManager) generateDailyReport(ctx context.Context) {
    log.Info("开始生成每日资源使用报告")
    
    // 获取过去 24 小时的指标
    metrics := rmm.metricsCollector.GetMetrics(24 * time.Hour)
    
    report := &DailyReport{
        Date:      time.Now(),
        Summary:   rmm.calculateSummary(metrics),
        Peak:      rmm.findPeakUsage(metrics),
        Average:   rmm.calculateAverage(metrics),
        Trend:     rmm.analyzeTrend(metrics),
        Heatmap:   rmm.generateHeatmap(metrics),
        Recommendations: rmm.advisor.GenerateRecommendations(metrics),
    }
    
    // 保存报告
    rmm.reportGenerator.Save(report)
    
    // 发送报告
    rmm.reportGenerator.Send(report)
    
    log.Info("每日资源使用报告生成完成")
}

// 每日报告
type DailyReport struct {
    Date            time.Time
    Summary         ReportSummary
    Peak            PeakUsage
    Average         AverageUsage
    Trend           TrendAnalysis
    Heatmap         [][]float64
    Recommendations []Recommendation
}

// 报告摘要
type ReportSummary struct {
    TotalDataPoints int
    HealthScore     float64
    Incidents       int
    Alerts          int
}

// 峰值使用
type PeakUsage struct {
    CPU     PeakMetric
    Memory  PeakMetric
    Disk    PeakMetric
    Network PeakMetric
}

// 峰值指标
type PeakMetric struct {
    Value     float64
    Timestamp time.Time
}

// 平均使用
type AverageUsage struct {
    CPU     float64
    Memory  float64
    Disk    float64
    Network float64
}

// 趋势分析
type TrendAnalysis struct {
    CPUTrend     string  // "increasing", "stable", "decreasing"
    MemoryTrend  string
    DiskTrend    string
    NetworkTrend string
}

// 资源顾问
type ResourceAdvisor struct {
    rules []OptimizationRule
}

// 生成优化建议
func (ra *ResourceAdvisor) GenerateRecommendations(metrics []*ResourceMetrics) []Recommendation {
    recommendations := []Recommendation{}
    
    // 分析 CPU 使用模式
    if ra.isCPUUnderUtilized(metrics) {
        recommendations = append(recommendations, Recommendation{
            Type:     "cpu_optimization",
            Priority: "medium",
            Title:    "CPU 资源利用率低",
            Description: "过去 24 小时 CPU 平均使用率低于 30%，建议减少副本数或降低资源配额",
            Impact:   "可节省约 20% 的计算成本",
            Action:   "调整 HPA 最小副本数从 3 降至 2",
        })
    }
    
    // 分析内存使用模式
    if ra.isMemoryFragmented(metrics) {
        recommendations = append(recommendations, Recommendation{
            Type:     "memory_optimization",
            Priority: "high",
            Title:    "内存碎片化严重",
            Description: "检测到内存碎片化问题，建议定期重启服务或调整内存分配策略",
            Impact:   "可提升 15% 的内存利用率",
            Action:   "启用内存压缩或定期重启",
        })
    }
    
    // 分析磁盘使用模式
    if ra.isDiskGrowthRapid(metrics) {
        recommendations = append(recommendations, Recommendation{
            Type:     "disk_optimization",
            Priority: "critical",
            Title:    "磁盘增长过快",
            Description: "磁盘使用量增长速度超过预期，建议启用数据压缩或调整保留策略",
            Impact:   "可延长 30 天的磁盘使用时间",
            Action:   "启用 LZ4 压缩，调整日志保留期从 30 天降至 21 天",
        })
    }
    
    // 分析查询性能
    if ra.isQueryPerformancePoor(metrics) {
        recommendations = append(recommendations, Recommendation{
            Type:     "query_optimization",
            Priority: "high",
            Title:    "查询性能下降",
            Description: "检测到查询延迟增加，建议启用查询缓存或优化索引",
            Impact:   "可降低 40% 的查询延迟",
            Action:   "启用 Redis 查询缓存，添加常用字段索引",
        })
    }
    
    // 分析网络带宽
    if ra.isNetworkBottleneck(metrics) {
        recommendations = append(recommendations, Recommendation{
            Type:     "network_optimization",
            Priority: "medium",
            Title:    "网络带宽瓶颈",
            Description: "网络带宽使用率接近上限，建议启用数据压缩或增加带宽",
            Impact:   "可提升 50% 的数据传输速度",
            Action:   "启用 LZ4 压缩传输，或升级网络带宽",
        })
    }
    
    return recommendations
}

// 优化建议
type Recommendation struct {
    Type        string
    Priority    string
    Title       string
    Description string
    Impact      string
    Action      string
}

// 生成热力图
func (rmm *ResourceMonitoringManager) generateHeatmap(metrics []*ResourceMetrics) [][]float64 {
    // 24 小时 x 4 种资源
    heatmap := make([][]float64, 24)
    
    for hour := 0; hour < 24; hour++ {
        heatmap[hour] = make([]float64, 4)
        
        // 获取该小时的指标
        hourMetrics := rmm.getMetricsForHour(metrics, hour)
        
        if len(hourMetrics) > 0 {
            // CPU
            heatmap[hour][0] = rmm.calculateAvgCPU(hourMetrics)
            // Memory
            heatmap[hour][1] = rmm.calculateAvgMemory(hourMetrics)
            // Disk
            heatmap[hour][2] = rmm.calculateAvgDisk(hourMetrics)
            // Network
            heatmap[hour][3] = rmm.calculateAvgNetwork(hourMetrics)
        }
    }
    
    return heatmap
}
```

**关键实现点**:

1. 实时监控 CPU、内存、磁盘、网络四种资源，采集间隔 15 秒
2. 使用线性回归模型预测未来 1 小时资源使用，准确率 >= 85%
3. 告警响应时间 < 30 秒，支持多渠道通知（邮件、Webhook、Slack）
4. 每日自动生成资源使用报告，包含峰值、平均值、趋势、热力图
5. 监控关键性能指标（QPS、P50/P95/P99 延迟、错误率），更新频率 10 秒
6. 支持自定义 Prometheus 格式指标，最多 10 种
7. 资源顾问基于历史数据和最佳实践生成优化建议

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| monitoring_enabled | bool | true | 是否启用资源监控 |
| collect_interval | int | 15 | 指标采集间隔（秒） |
| alert_cpu_threshold | float | 80.0 | CPU 告警阈值（%） |
| alert_memory_threshold | float | 85.0 | 内存告警阈值（%） |
| alert_disk_threshold | float | 90.0 | 磁盘告警阈值（%） |
| alert_error_rate_threshold | float | 5.0 | 错误率告警阈值（%） |
| prediction_enabled | bool | true | 是否启用趋势预测 |
| report_schedule | string | "0 9 * * *" | 报告生成时间（cron） |
| custom_metrics | array | [] | 自定义指标列表 |
| heatmap_enabled | bool | true | 是否生成热力图 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下次指标采集生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的采集间隔
2. WHEN 告警阈值变更时，THE System SHALL 在下次指标检查时生效
3. THE System SHALL 支持通过 API 查询当前生效的监控配置
4. THE System SHALL 记录所有监控配置变更的审计日志
5. WHEN 自定义指标变更时，THE System SHALL 验证 Prometheus 格式的正确性

---


#### 需求 10-34: 查询性能优化 [Phase 2]

**用户故事**:
作为用户，我希望日志查询能够快速响应，以便提高工作效率和用户体验。

**验收标准**:

1. THE System SHALL 热数据查询延迟 < 500ms（P95），查询范围 <= 1 小时
2. THE System SHALL 支持查询结果缓存，缓存命中率 >= 60%，缓存有效期可配置
3. THE System SHALL 支持查询计划分析，提供至少 3 条优化建议
4. THE System SHALL 自动识别慢查询（延迟 > 5 秒），并发送告警通知
5. THE System SHALL 支持查询并发控制，最大并发查询数可配置（默认 100），超过限制时排队等待
6. THE System SHALL 支持查询超时设置，默认超时 30 秒，超时后自动取消查询
7. THE System SHALL 支持查询结果分页（每页 100-10000 条）和流式返回
8. THE System SHALL 自动为常用查询字段创建索引，索引创建延迟 < 10 分钟
9. THE System SHALL 提供查询性能统计报告，包含慢查询 TOP 10、缓存命中率、平均延迟
10. THE System SHALL 通过配置中心管理查询优化配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/performance/query/optimizer.go
package query

import (
    "context"
    "time"
)

// 查询优化器
type QueryOptimizer struct {
    config          *OptimizerConfig
    cache           *QueryCache
    planAnalyzer    *QueryPlanAnalyzer
    slowQueryDetector *SlowQueryDetector
    concurrencyLimiter *ConcurrencyLimiter
    indexAdvisor    *IndexAdvisor
    statsCollector  *StatsCollector
}

// 优化器配置
type OptimizerConfig struct {
    CacheEnabled       bool
    CacheTTL           time.Duration
    SlowQueryThreshold time.Duration
    MaxConcurrency     int
    QueryTimeout       time.Duration
    PageSize           int
    AutoIndexEnabled   bool
}

// 查询请求
type QueryRequest struct {
    ID          string
    Query       string
    TimeRange   TimeRange
    Filters     []Filter
    Limit       int
    Offset      int
    Timeout     time.Duration
}

// 查询响应
type QueryResponse struct {
    ID          string
    Results     []LogEntry
    Total       int64
    Duration    time.Duration
    CacheHit    bool
    QueryPlan   *QueryPlan
}

// 创建查询优化器
func NewQueryOptimizer(config *OptimizerConfig) (*QueryOptimizer, error) {
    qo := &QueryOptimizer{
        config: config,
    }
    
    // 初始化查询缓存
    if config.CacheEnabled {
        qo.cache = NewQueryCache(config.CacheTTL)
    }
    
    // 初始化查询计划分析器
    qo.planAnalyzer = NewQueryPlanAnalyzer()
    
    // 初始化慢查询检测器
    qo.slowQueryDetector = NewSlowQueryDetector(config.SlowQueryThreshold)
    
    // 初始化并发限制器
    qo.concurrencyLimiter = NewConcurrencyLimiter(config.MaxConcurrency)
    
    // 初始化索引顾问
    if config.AutoIndexEnabled {
        qo.indexAdvisor = NewIndexAdvisor()
    }
    
    // 初始化统计收集器
    qo.statsCollector = NewStatsCollector()
    
    return qo, nil
}

// 执行查询
func (qo *QueryOptimizer) ExecuteQuery(ctx context.Context, req *QueryRequest) (*QueryResponse, error) {
    startTime := time.Now()
    
    // 1. 检查缓存
    if qo.config.CacheEnabled {
        if cached := qo.cache.Get(req); cached != nil {
            cached.CacheHit = true
            cached.Duration = time.Since(startTime)
            qo.statsCollector.RecordCacheHit()
            return cached, nil
        }
    }
    
    // 2. 并发控制
    if err := qo.concurrencyLimiter.Acquire(ctx); err != nil {
        return nil, fmt.Errorf("并发限制: %w", err)
    }
    defer qo.concurrencyLimiter.Release()
    
    // 3. 设置超时
    queryCtx, cancel := context.WithTimeout(ctx, qo.getQueryTimeout(req))
    defer cancel()
    
    // 4. 分析查询计划
    plan := qo.planAnalyzer.Analyze(req)
    
    // 5. 优化查询
    optimizedReq := qo.optimizeQuery(req, plan)
    
    // 6. 执行查询
    results, total, err := qo.executeOptimizedQuery(queryCtx, optimizedReq)
    if err != nil {
        return nil, err
    }
    
    duration := time.Since(startTime)
    
    // 7. 检测慢查询
    if duration > qo.config.SlowQueryThreshold {
        qo.slowQueryDetector.Record(req, duration, plan)
    }
    
    // 8. 构造响应
    resp := &QueryResponse{
        ID:        req.ID,
        Results:   results,
        Total:     total,
        Duration:  duration,
        CacheHit:  false,
        QueryPlan: plan,
    }
    
    // 9. 缓存结果
    if qo.config.CacheEnabled && qo.shouldCache(req, resp) {
        qo.cache.Set(req, resp)
    }
    
    // 10. 记录统计
    qo.statsCollector.RecordQuery(req, resp)
    
    // 11. 索引建议
    if qo.config.AutoIndexEnabled {
        qo.indexAdvisor.Analyze(req, plan)
    }
    
    return resp, nil
}

// 查询缓存
type QueryCache struct {
    cache *lru.Cache
    ttl   time.Duration
    mu    sync.RWMutex
}

// 获取缓存
func (qc *QueryCache) Get(req *QueryRequest) *QueryResponse {
    qc.mu.RLock()
    defer qc.mu.RUnlock()
    
    key := qc.generateKey(req)
    if item, ok := qc.cache.Get(key); ok {
        cached := item.(*CachedResponse)
        
        // 检查是否过期
        if time.Since(cached.CachedAt) < qc.ttl {
            return cached.Response
        }
        
        // 过期，删除缓存
        qc.cache.Remove(key)
    }
    
    return nil
}

// 设置缓存
func (qc *QueryCache) Set(req *QueryRequest, resp *QueryResponse) {
    qc.mu.Lock()
    defer qc.mu.Unlock()
    
    key := qc.generateKey(req)
    cached := &CachedResponse{
        Response: resp,
        CachedAt: time.Now(),
    }
    
    qc.cache.Add(key, cached)
}

// 生成缓存键
func (qc *QueryCache) generateKey(req *QueryRequest) string {
    // 使用查询内容、时间范围、过滤器生成唯一键
    h := xxhash.New()
    h.Write([]byte(req.Query))
    h.Write([]byte(req.TimeRange.String()))
    for _, filter := range req.Filters {
        h.Write([]byte(filter.String()))
    }
    return fmt.Sprintf("%x", h.Sum64())
}

// 缓存响应
type CachedResponse struct {
    Response *QueryResponse
    CachedAt time.Time
}


// 查询计划分析器
type QueryPlanAnalyzer struct {
    rules []OptimizationRule
}

// 分析查询计划
func (qpa *QueryPlanAnalyzer) Analyze(req *QueryRequest) *QueryPlan {
    plan := &QueryPlan{
        Query:         req.Query,
        EstimatedCost: 0,
        Steps:         []QueryStep{},
        Suggestions:   []string{},
    }
    
    // 分析时间范围
    if qpa.isTimeRangeTooLarge(req.TimeRange) {
        plan.Suggestions = append(plan.Suggestions, "时间范围过大，建议缩小到 1 小时以内")
        plan.EstimatedCost += 100
    }
    
    // 分析过滤条件
    if len(req.Filters) == 0 {
        plan.Suggestions = append(plan.Suggestions, "缺少过滤条件，建议添加字段过滤以提高性能")
        plan.EstimatedCost += 50
    }
    
    // 分析索引使用
    indexedFields := qpa.getIndexedFields(req)
    if len(indexedFields) == 0 {
        plan.Suggestions = append(plan.Suggestions, "查询未使用索引，建议为常用字段创建索引")
        plan.EstimatedCost += 200
    } else {
        plan.Steps = append(plan.Steps, QueryStep{
            Type:        "index_scan",
            Description: fmt.Sprintf("使用索引: %v", indexedFields),
            Cost:        10,
        })
    }
    
    // 分析排序
    if qpa.requiresSort(req) {
        plan.Steps = append(plan.Steps, QueryStep{
            Type:        "sort",
            Description: "结果排序",
            Cost:        30,
        })
    }
    
    return plan
}

// 查询计划
type QueryPlan struct {
    Query         string
    EstimatedCost int
    Steps         []QueryStep
    Suggestions   []string
}

// 查询步骤
type QueryStep struct {
    Type        string
    Description string
    Cost        int
}

// 慢查询检测器
type SlowQueryDetector struct {
    threshold time.Duration
    records   *SlowQueryRecords
}

// 记录慢查询
func (sqd *SlowQueryDetector) Record(req *QueryRequest, duration time.Duration, plan *QueryPlan) {
    record := &SlowQueryRecord{
        Timestamp: time.Now(),
        Query:     req.Query,
        Duration:  duration,
        Plan:      plan,
    }
    
    sqd.records.Add(record)
    
    // 发送告警
    sqd.sendAlert(record)
    
    log.Warnf("检测到慢查询: query=%s, duration=%v", req.Query, duration)
}

// 慢查询记录
type SlowQueryRecord struct {
    Timestamp time.Time
    Query     string
    Duration  time.Duration
    Plan      *QueryPlan
}

// 发送慢查询告警
func (sqd *SlowQueryDetector) sendAlert(record *SlowQueryRecord) {
    alert := &Alert{
        Type:     "slow_query",
        Severity: "warning",
        Message:  fmt.Sprintf("慢查询: %s (耗时: %v)", record.Query, record.Duration),
        Details: map[string]interface{}{
            "query":    record.Query,
            "duration": record.Duration.Seconds(),
            "plan":     record.Plan,
        },
    }
    
    alertService.Send(alert)
}

// 并发限制器
type ConcurrencyLimiter struct {
    semaphore chan struct{}
    maxConcurrency int
    current   int
    mu        sync.Mutex
}

// 获取执行权限
func (cl *ConcurrencyLimiter) Acquire(ctx context.Context) error {
    select {
    case cl.semaphore <- struct{}{}:
        cl.mu.Lock()
        cl.current++
        cl.mu.Unlock()
        return nil
    case <-ctx.Done():
        return fmt.Errorf("获取执行权限超时")
    }
}

// 释放执行权限
func (cl *ConcurrencyLimiter) Release() {
    <-cl.semaphore
    cl.mu.Lock()
    cl.current--
    cl.mu.Unlock()
}

// 索引顾问
type IndexAdvisor struct {
    analyzer *QueryPatternAnalyzer
    creator  *IndexCreator
}

// 分析查询模式
func (ia *IndexAdvisor) Analyze(req *QueryRequest, plan *QueryPlan) {
    // 分析查询中使用的字段
    fields := ia.analyzer.ExtractFields(req)
    
    // 检查是否需要创建索引
    for _, field := range fields {
        if !ia.hasIndex(field) && ia.isFrequentlyQueried(field) {
            // 创建索引
            ia.creator.CreateIndex(field)
            log.Infof("为字段 %s 创建索引", field)
        }
    }
}

// 统计收集器
type StatsCollector struct {
    stats *QueryStats
    mu    sync.RWMutex
}

// 记录查询
func (sc *StatsCollector) RecordQuery(req *QueryRequest, resp *QueryResponse) {
    sc.mu.Lock()
    defer sc.mu.Unlock()
    
    sc.stats.TotalQueries++
    sc.stats.TotalDuration += resp.Duration
    
    if resp.CacheHit {
        sc.stats.CacheHits++
    }
    
    if resp.Duration > 5*time.Second {
        sc.stats.SlowQueries++
    }
}

// 生成性能报告
func (sc *StatsCollector) GenerateReport() *PerformanceReport {
    sc.mu.RLock()
    defer sc.mu.RUnlock()
    
    report := &PerformanceReport{
        TotalQueries:   sc.stats.TotalQueries,
        CacheHitRate:   float64(sc.stats.CacheHits) / float64(sc.stats.TotalQueries) * 100,
        AvgDuration:    sc.stats.TotalDuration / time.Duration(sc.stats.TotalQueries),
        SlowQueries:    sc.stats.SlowQueries,
        SlowQueryRate:  float64(sc.stats.SlowQueries) / float64(sc.stats.TotalQueries) * 100,
        TopSlowQueries: sc.getTopSlowQueries(10),
    }
    
    return report
}

// 查询统计
type QueryStats struct {
    TotalQueries  int64
    CacheHits     int64
    TotalDuration time.Duration
    SlowQueries   int64
}

// 性能报告
type PerformanceReport struct {
    TotalQueries   int64
    CacheHitRate   float64
    AvgDuration    time.Duration
    SlowQueries    int64
    SlowQueryRate  float64
    TopSlowQueries []*SlowQueryRecord
}
```

**关键实现点**:

1. 使用 LRU 缓存查询结果，缓存命中率 >= 60%，TTL 可配置
2. 查询计划分析器提供优化建议（时间范围、索引使用、过滤条件）
3. 慢查询自动检测（延迟 > 5 秒）并发送告警
4. 使用信号量实现并发控制，最大并发数可配置
5. 支持查询超时（默认 30 秒），超时自动取消
6. 索引顾问自动为高频查询字段创建索引
7. 完整的查询性能统计，包含慢查询 TOP 10、缓存命中率、平均延迟

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| cache_enabled | bool | true | 是否启用查询缓存 |
| cache_ttl | int | 300 | 缓存有效期（秒） |
| slow_query_threshold | int | 5 | 慢查询阈值（秒） |
| max_concurrency | int | 100 | 最大并发查询数 |
| query_timeout | int | 30 | 查询超时时间（秒） |
| page_size | int | 1000 | 默认分页大小 |
| auto_index_enabled | bool | true | 是否自动创建索引 |
| index_frequency_threshold | int | 100 | 索引创建频率阈值 |
| stream_enabled | bool | true | 是否启用流式返回 |
| optimization_enabled | bool | true | 是否启用查询优化 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下次查询生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的缓存策略
2. WHEN 并发限制变更时，THE System SHALL 在下次查询时生效
3. THE System SHALL 支持通过 API 查询当前生效的查询优化配置
4. THE System SHALL 记录所有查询优化配置变更的审计日志
5. WHEN 超时时间变更时，THE System SHALL 验证配置的合理性（>= 1 秒）

---


### API 接口汇总

模块十提供以下 API 接口：

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-10-353 | 获取扩缩容状态 | Autoscaling | GET | /api/v1/autoscaling/status | autoscaling.read | 无 | {code:0,data:{status:"running"}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-354 | 配置扩缩容策略 | Autoscaling | PUT | /api/v1/autoscaling/config | autoscaling.write | Body: config_data | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-355 | 获取扩缩容配置 | Autoscaling | GET | /api/v1/autoscaling/config | autoscaling.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-10-356 | 手动触发扩容 | Autoscaling | POST | /api/v1/autoscaling/scale-up | autoscaling.write | Body: {replicas} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-10-357 | 手动触发缩容 | Autoscaling | POST | /api/v1/autoscaling/scale-down | autoscaling.write | Body: {replicas} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-10-358 | 获取扩缩容历史 | Autoscaling | GET | /api/v1/autoscaling/history | autoscaling.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-10-359 | 获取扩缩容事件 | Autoscaling | GET | /api/v1/autoscaling/events | autoscaling.read | Query: time_range | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-360 | 获取分析报告 | Autoscaling | GET | /api/v1/autoscaling/report | autoscaling.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-361 | 配置定时扩缩容 | Autoscaling | PUT | /api/v1/autoscaling/schedule | autoscaling.write | Body: schedule_config | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-362 | 获取定时配置 | Autoscaling | GET | /api/v1/autoscaling/schedule | autoscaling.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-10-363 | 获取资源指标 | Monitoring | GET | /api/v1/monitoring/metrics | monitoring.read | Query: resource_type | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-364 | 获取历史指标 | Monitoring | GET | /api/v1/monitoring/metrics/history | monitoring.read | Query: time_range | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-10-365 | 获取趋势预测 | Monitoring | GET | /api/v1/monitoring/prediction | monitoring.read | Query: metric | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-366 | 配置监控策略 | Monitoring | PUT | /api/v1/monitoring/config | monitoring.write | Body: config_data | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-367 | 获取监控配置 | Monitoring | GET | /api/v1/monitoring/config | monitoring.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-10-368 | 获取告警列表 | Monitoring | GET | /api/v1/monitoring/alerts | monitoring.read | Query: severity | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-369 | 配置告警阈值 | Monitoring | PUT | /api/v1/monitoring/thresholds | monitoring.write | Body: thresholds | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-370 | 获取每日报告 | Monitoring | GET | /api/v1/monitoring/report/daily | monitoring.read | Query: date | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-10-371 | 获取热力图数据 | Monitoring | GET | /api/v1/monitoring/heatmap | monitoring.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-10-372 | 获取优化建议 | Monitoring | GET | /api/v1/monitoring/recommendations | monitoring.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-373 | 添加自定义指标 | Monitoring | POST | /api/v1/monitoring/metrics/custom | monitoring.write | Body: metric_config | {code:0,data:{id:"metric-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-10-374 | 删除自定义指标 | Monitoring | DELETE | /api/v1/monitoring/metrics/custom/{id} | monitoring.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-10-375 | 获取性能指标 | Monitoring | GET | /api/v1/monitoring/performance | monitoring.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-376 | 对比分析 | Monitoring | POST | /api/v1/monitoring/compare | monitoring.read | Body: {periods:[]} | {code:0,data:{...}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-377 | 执行查询 | Query | POST | /api/v1/query/execute | query.read | Body: query_request | {code:0,data:{query_id:"..."}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-10-378 | 获取查询结果 | Query | GET | /api/v1/query/{id} | query.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-10-379 | 取消查询 | Query | DELETE | /api/v1/query/{id} | query.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-10-380 | 获取查询计划 | Query | POST | /api/v1/query/explain | query.read | Body: {query} | {code:0,data:{...}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-381 | 清除查询缓存 | Query | DELETE | /api/v1/query/cache | query.admin | 无 | {code:0,message:"ok"} | 200/401/403/500 | v1 | 否 | 否 | - | 仅管理员 |
| API-10-382 | 获取缓存统计 | Query | GET | /api/v1/query/cache/stats | query.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-383 | 获取慢查询列表 | Query | GET | /api/v1/query/slow | query.read | Query: threshold | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-384 | 获取查询统计 | Query | GET | /api/v1/query/stats | query.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-385 | 配置查询优化 | Query | PUT | /api/v1/query/config | query.admin | Body: config_data | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | 仅管理员 |
| API-10-386 | 获取优化配置 | Query | GET | /api/v1/query/config | query.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-10-387 | 获取索引建议 | Query | GET | /api/v1/query/index/suggestions | query.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-388 | 创建索引 | Query | POST | /api/v1/query/index | query.admin | Body: index_config | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | 仅管理员 |
| API-10-389 | 删除索引 | Query | DELETE | /api/v1/query/index/{name} | query.admin | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | 仅管理员 |
| API-10-390 | 获取性能报告 | Query | GET | /api/v1/query/report | query.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-391 | 流式查询 | Query | GET | /api/v1/query/stream | query.read | Query: query_id | Stream | 200/401/403/404/500 | v1 | 是 | 否 | - | 流式返回 |

**接口说明**:
- 所有接口均需要身份认证（JWT Token）
- 扩缩容管理接口需要 `autoscaling:manage` 权限
- 监控配置接口需要 `monitoring:manage` 权限
- 查询优化接口需要 `query:optimize` 权限
- 支持 API 限流：100 请求/分钟/用户
- 所有接口调用均记录审计日志

---



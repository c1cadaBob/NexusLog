# 模块四：告警与响应

> **文档版本**: v1.0  
> **创建日期**: 2026-01-29  
> **所属模块**: 模块四：告警与响应 
> **需求编号**: 

---

**模块概述**: 

负责智能告警生成、告警管理和自动化响应，支持多渠道通知、告警聚合抑制、值班排班管理和自动化修复能力。

**模块技术栈**:
- 告警引擎：Go 1.21+ + 规则引擎 (高性能、低延迟)
- 规则引擎：expr-lang / govaluate (表达式求值)
- 通知系统：多渠道适配器 (邮件、短信、Webhook、IM)
- 值班管理：PostgreSQL (排班数据存储)
- 消息队列：Redis Streams (告警消息队列)
- 配置管理：PostgreSQL + Redis 配置中心（热配置）

**模块架构**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                告警与响应模块整体架构                                        │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            配置中心（控制面）                                          │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ PostgreSQL   │───▶│    Redis     │───▶│   Pub/Sub    │                           │ │
│  │  │ (告警规则/   │    │ (当前规则)   │    │ (规则变更)   │                           │ │
│  │  │  通知配置)   │    │              │    │              │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────┬───────┘                           │ │
│  └────────────────────────────────────────────────────┼─────────────────────────────────┘ │
│                                                       │                                   │
│                                                       ▼                                   │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            告警检测层（Alert Detection）                               │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  规则引擎 (Rule Engine)                                                      │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 阈值检测     │    │ 模式匹配     │    │ 异常检测     │                 │     │ │
│  │  │  │ (Threshold)  │───▶│ (Pattern)    │───▶│ (ML)         │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  告警聚合与抑制 (Aggregation & Suppression)                                 │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 时间窗口聚合  │    │ 相似度合并   │    │ 静默规则     │                 │     │ │
│  │  │  │ (5分钟窗口)  │───▶│ (去重)       │───▶│ (Silence)    │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  └────────────────────────────────────────┼──────────────────────────────────────────┘ │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            告警处理层（Alert Processing）                              │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  告警队列 (Redis Streams)                                                    │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ P0 队列      │    │ P1 队列      │    │ P2/P3 队列   │                 │     │ │
│  │  │  │ (严重告警)   │    │ (高优先级)   │    │ (中低优先级) │                 │     │ │
│  │  │  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                 │     │ │
│  │  │         └──────────────────┴──────────────────┘                             │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  告警路由 (Alert Routing)                                                    │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 值班路由     │    │ 升级策略     │    │ 通知渠道选择  │                 │     │ │
│  │  │  │ (On-Call)    │───▶│ (Escalation) │───▶│ (Channel)    │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  └────────────────────────────────────────┼──────────────────────────────────────────┘ │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            通知分发层（Notification）                                  │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  多渠道适配器 (Multi-Channel Adapters)                                       │     │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │     │ │
│  │  │  │ 邮件 (SMTP)  │  │ 短信 (SMS)   │  │ 电话 (Voice) │  │ Webhook      │   │     │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │     │ │
│  │  │                                                                              │     │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │     │ │
│  │  │  │ Slack        │  │ 企业微信     │  │ 钉钉         │  │ 飞书         │   │     │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            自动响应层（Auto Response）                                 │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ 服务重启     │    │ 配置回滚     │    │ 自动扩容     │                           │ │
│  │  │ (Restart)    │───▶│ (Rollback)   │───▶│ (Scale)      │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  │                                                                                        │ │
│  │  ┌──────────────┐    ┌──────────────┐                                                │ │
│  │  │ 审批流程     │    │ 执行审计     │                                                │ │
│  │  │ (Approval)   │───▶│ (Audit Log)  │                                                │ │
│  │  └──────────────┘    └──────────────┘                                                │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            监控与统计                                              │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                       │ │
│  │  │ 告警统计     │    │ 响应时间     │    │ 通知成功率   │                       │ │
│  │  │ (Metrics)    │    │ (MTTR)       │    │ (Delivery)   │                       │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                       │ │
│  └───────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**架构说明**:

1. **配置中心层**: 使用 PostgreSQL 存储告警规则和通知配置，Redis 分发当前生效规则
2. **告警检测层**: 规则引擎支持阈值、模式匹配、异常检测，告警聚合与抑制防止告警风暴
3. **告警处理层**: Redis Streams 实现优先级队列，支持值班路由和升级策略
4. **通知分发层**: 多渠道适配器支持邮件、短信、IM、Webhook 等多种通知方式
5. **自动响应层**: 支持服务重启、配置回滚、自动扩容等自动化修复操作
6. **监控层**: 实时统计告警指标、响应时间、通知成功率

**告警级别定义**:

| 级别 | 名称 | 响应时间 | 通知方式 | 升级策略 | 示例 |
|------|------|----------|----------|----------|------|
| P0 | 严重 (Critical) | < 5min | 电话 + 短信 + IM | 10min 升级 | 服务宕机、数据丢失 |
| P1 | 高 (High) | < 15min | 短信 + IM | 30min 升级 | 错误率 > 10%、响应超时 |
| P2 | 中 (Medium) | < 1h | IM + 邮件 | 2h 升级 | 错误率 > 5%、磁盘使用 > 80% |
| P3 | 低 (Low) | < 4h | 邮件 | 不升级 | 警告日志增多、性能下降 |

**通知渠道支持**:

| 渠道 | 协议 | 优先级 | 延迟 | 可靠性 | 成本 |
|------|------|--------|------|--------|------|
| 电话 | Voice API | P0 | < 10s | 99.9% | 高 |
| 短信 | SMS API | P0-P1 | < 30s | 99.5% | 中 |
| 企业微信 | Webhook | P1-P2 | < 5s | 99% | 低 |
| 钉钉 | Webhook | P1-P2 | < 5s | 99% | 低 |
| Slack | Webhook | P1-P2 | < 5s | 99% | 低 |
| 邮件 | SMTP | P2-P3 | < 1min | 98% | 低 |
| Webhook | HTTP | 全部 | < 2s | 95% | 低 |

**数据流向**:

```
日志/指标 → 规则引擎 → 告警检测 → 聚合抑制 → 优先级队列 → 值班路由 → 通知分发 → 自动响应
            ↑                                                              ↓
            └──────────────── 配置中心（热更新）─────────────────────────────┘
```

**需求列表**:
- 需求 4-14：智能告警生成 [MVP]
- 需求 4-15：告警抑制与静默管理 [MVP]
- 需求 4-16：自动化响应与修复 [Phase 2]
- 需求 4-17：告警值班与排班管理 [Phase 2]

---



#### 需求 4-14：智能告警生成 [MVP]

**用户故事**: 

作为运维工程师，我希望收到智能化的告警通知，以便及时发现和处理系统问题。

**验收标准**:

1. WHEN 检测到异常时，THE Alert_Engine SHALL 在 10 秒内生成告警
2. THE Alert_Engine SHALL 支持告警严重级别（严重 P0、高 P1、中 P2、低 P3），并提供可配置的阈值
3. WHEN 多个相关告警在 5 分钟窗口内发生时，THE Alert_Engine SHALL 将它们合并为单个事件以防止告警风暴
4. THE Alert_Engine SHALL 支持多种通知渠道（邮件、短信、Webhook、Slack、企业微信、钉钉、飞书）
5. WHEN 告警在配置的时间内（默认 15 分钟）未被确认时，THE Alert_Engine SHALL 升级到下一级响应人员
6. THE System SHALL 提供详细的告警历史记录，保留至少 1 年
7. THE Alert_Engine SHALL 支持告警模板自定义，包括标题、内容、格式
8. THE Alert_Engine SHALL 自动添加告警上下文（相关日志、指标、追踪链路）
9. THE Alert_Engine SHALL 支持告警优先级动态调整（基于业务影响）
10. THE Alert_Engine SHALL 通过配置中心管理告警规则，支持热更新

**实现方向**:

**实现方式**:

```go
// 告警引擎
type AlertEngine struct {
    ruleEngine    *RuleEngine          // 规则引擎
    aggregator    *AlertAggregator     // 告警聚合器
    router        *AlertRouter         // 告警路由器
    notifier      *NotificationManager // 通知管理器
    queue         *RedisStreamQueue    // 告警队列
    config        atomic.Value         // 配置（支持热更新）
    metrics       *AlertMetrics        // 告警指标
}

// 告警规则配置
type AlertRule struct {
    ID          string              // 规则 ID
    Name        string              // 规则名称
    Enabled     bool                // 是否启用
    Severity    string              // 严重级别：P0/P1/P2/P3
    Condition   string              // 告警条件表达式
    Duration    time.Duration       // 持续时间
    Labels      map[string]string   // 标签
    Annotations map[string]string   // 注释
    Template    AlertTemplate       // 告警模板
}

// 告警模板
type AlertTemplate struct {
    Title       string   // 标题模板
    Content     string   // 内容模板
    Format      string   // 格式：text/html/markdown
    ContextKeys []string // 需要包含的上下文键
}

// 告警对象
type Alert struct {
    ID          string              // 告警 ID
    RuleID      string              // 规则 ID
    Severity    string              // 严重级别
    Status      string              // 状态：firing/resolved
    StartsAt    time.Time           // 开始时间
    EndsAt      time.Time           // 结束时间
    Labels      map[string]string   // 标签
    Annotations map[string]string   // 注释
    Context     AlertContext        // 告警上下文
    Fingerprint string              // 指纹（用于去重）
}

// 告警上下文
type AlertContext struct {
    Logs    []LogEntry    // 相关日志
    Metrics []Metric      // 相关指标
    Traces  []Trace       // 相关追踪
    Events  []Event       // 相关事件
}

// 评估告警规则
func (ae *AlertEngine) EvaluateRule(ctx context.Context, rule *AlertRule) ([]*Alert, error) {
    // 1. 执行规则条件表达式
    result, err := ae.ruleEngine.Evaluate(rule.Condition)
    if err != nil {
        return nil, fmt.Errorf("规则评估失败: %w", err)
    }
    
    // 2. 检查是否触发告警
    if !result.IsTriggered {
        return nil, nil
    }
    
    // 3. 创建告警对象
    alert := &Alert{
        ID:       generateAlertID(),
        RuleID:   rule.ID,
        Severity: rule.Severity,
        Status:   "firing",
        StartsAt: time.Now(),
        Labels:   rule.Labels,
        Annotations: rule.Annotations,
        Fingerprint: ae.calculateFingerprint(rule, result),
    }
    
    // 4. 收集告警上下文
    alert.Context = ae.collectContext(ctx, rule, result)
    
    // 5. 应用告警模板
    if err := ae.applyTemplate(alert, rule.Template); err != nil {
        log.Warn("应用模板失败", "error", err)
    }
    
    return []*Alert{alert}, nil
}

// 收集告警上下文
func (ae *AlertEngine) collectContext(ctx context.Context, rule *AlertRule, result *EvalResult) AlertContext {
    context := AlertContext{}
    
    // 1. 收集相关日志（最近 5 分钟）
    logs, err := ae.queryLogs(ctx, result.Query, time.Now().Add(-5*time.Minute), time.Now())
    if err == nil {
        context.Logs = logs
    }
    
    // 2. 收集相关指标
    metrics, err := ae.queryMetrics(ctx, result.MetricNames, time.Now().Add(-15*time.Minute), time.Now())
    if err == nil {
        context.Metrics = metrics
    }
    
    // 3. 收集相关追踪（如果有 trace_id）
    if traceID := result.Labels["trace_id"]; traceID != "" {
        traces, err := ae.queryTraces(ctx, traceID)
        if err == nil {
            context.Traces = traces
        }
    }
    
    return context
}

// 应用告警模板
func (ae *AlertEngine) applyTemplate(alert *Alert, template AlertTemplate) error {
    // 准备模板数据
    data := map[string]interface{}{
        "alert":      alert,
        "severity":   alert.Severity,
        "labels":     alert.Labels,
        "annotations": alert.Annotations,
        "context":    alert.Context,
        "starts_at":  alert.StartsAt.Format(time.RFC3339),
    }
    
    // 渲染标题
    title, err := ae.renderTemplate(template.Title, data)
    if err != nil {
        return fmt.Errorf("渲染标题失败: %w", err)
    }
    alert.Annotations["title"] = title
    
    // 渲染内容
    content, err := ae.renderTemplate(template.Content, data)
    if err != nil {
        return fmt.Errorf("渲染内容失败: %w", err)
    }
    alert.Annotations["content"] = content
    
    return nil
}

// 告警聚合器
type AlertAggregator struct {
    window    time.Duration         // 聚合时间窗口
    groups    map[string]*AlertGroup // 告警分组
    mu        sync.RWMutex
}

// 告警分组
type AlertGroup struct {
    Key       string    // 分组键
    Alerts    []*Alert  // 告警列表
    FirstSeen time.Time // 首次出现时间
    LastSeen  time.Time // 最后出现时间
    Count     int       // 告警数量
}

// 聚合告警
func (aa *AlertAggregator) Aggregate(alert *Alert) (*AlertGroup, bool) {
    aa.mu.Lock()
    defer aa.mu.Unlock()
    
    // 1. 计算分组键（基于标签）
    groupKey := aa.calculateGroupKey(alert)
    
    // 2. 查找现有分组
    group, exists := aa.groups[groupKey]
    if !exists {
        // 创建新分组
        group = &AlertGroup{
            Key:       groupKey,
            Alerts:    []*Alert{alert},
            FirstSeen: alert.StartsAt,
            LastSeen:  alert.StartsAt,
            Count:     1,
        }
        aa.groups[groupKey] = group
        return group, false // 新分组，不聚合
    }
    
    // 3. 检查时间窗口
    if time.Since(group.LastSeen) > aa.window {
        // 超出时间窗口，创建新分组
        group = &AlertGroup{
            Key:       groupKey,
            Alerts:    []*Alert{alert},
            FirstSeen: alert.StartsAt,
            LastSeen:  alert.StartsAt,
            Count:     1,
        }
        aa.groups[groupKey] = group
        return group, false
    }
    
    // 4. 添加到现有分组
    group.Alerts = append(group.Alerts, alert)
    group.LastSeen = alert.StartsAt
    group.Count++
    
    return group, true // 已聚合
}

// 通知管理器
type NotificationManager struct {
    channels map[string]NotificationChannel // 通知渠道
    config   atomic.Value                   // 配置（支持热更新）
}

// 通知渠道接口
type NotificationChannel interface {
    Send(ctx context.Context, alert *Alert) error
    Name() string
    Priority() string // P0/P1/P2/P3
}

// 发送通知
func (nm *NotificationManager) Send(ctx context.Context, alert *Alert) error {
    config := nm.config.Load().(*NotificationConfig)
    
    // 1. 根据告警级别选择通知渠道
    channels := nm.selectChannels(alert.Severity)
    
    // 2. 并发发送到所有渠道
    var wg sync.WaitGroup
    errChan := make(chan error, len(channels))
    
    for _, channel := range channels {
        wg.Add(1)
        go func(ch NotificationChannel) {
            defer wg.Done()
            
            // 发送通知
            if err := ch.Send(ctx, alert); err != nil {
                errChan <- fmt.Errorf("发送到 %s 失败: %w", ch.Name(), err)
                return
            }
            
            log.Info("通知已发送", "channel", ch.Name(), "alert_id", alert.ID)
        }(channel)
    }
    
    wg.Wait()
    close(errChan)
    
    // 3. 收集错误
    var errors []error
    for err := range errChan {
        errors = append(errors, err)
    }
    
    if len(errors) > 0 {
        return fmt.Errorf("部分通知发送失败: %v", errors)
    }
    
    return nil
}

// 企业微信通知渠道
type WeChatChannel struct {
    webhookURL string
    client     *http.Client
}

func (wc *WeChatChannel) Send(ctx context.Context, alert *Alert) error {
    // 构造企业微信消息
    message := map[string]interface{}{
        "msgtype": "markdown",
        "markdown": map[string]string{
            "content": wc.formatMessage(alert),
        },
    }
    
    // 发送 HTTP 请求
    body, _ := json.Marshal(message)
    req, _ := http.NewRequestWithContext(ctx, "POST", wc.webhookURL, bytes.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    
    resp, err := wc.client.Do(req)
    if err != nil {
        return fmt.Errorf("发送请求失败: %w", err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != 200 {
        return fmt.Errorf("发送失败，状态码: %d", resp.StatusCode)
    }
    
    return nil
}

func (wc *WeChatChannel) formatMessage(alert *Alert) string {
    // 格式化为 Markdown
    return fmt.Sprintf(`## 🚨 告警通知

**级别**: <font color="warning">%s</font>
**规则**: %s
**时间**: %s

**详情**:
%s

**相关日志**: %d 条
**相关指标**: %d 个

[查看详情](https://log-system.example.com/alerts/%s)
`,
        alert.Severity,
        alert.Annotations["title"],
        alert.StartsAt.Format("2006-01-02 15:04:05"),
        alert.Annotations["content"],
        len(alert.Context.Logs),
        len(alert.Context.Metrics),
        alert.ID,
    )
}

func (wc *WeChatChannel) Name() string {
    return "wechat"
}

func (wc *WeChatChannel) Priority() string {
    return "P1-P2"
}

// 告警升级管理器
type EscalationManager struct {
    policies map[string]*EscalationPolicy // 升级策略
    timers   map[string]*time.Timer       // 升级定时器
    mu       sync.RWMutex
}

// 升级策略
type EscalationPolicy struct {
    Levels []EscalationLevel // 升级级别
}

// 升级级别
type EscalationLevel struct {
    Delay      time.Duration // 延迟时间
    Recipients []string      // 接收人列表
    Channels   []string      // 通知渠道
}

// 启动升级流程
func (em *EscalationManager) Start(ctx context.Context, alert *Alert) {
    policy, ok := em.policies[alert.Severity]
    if !ok {
        return // 无升级策略
    }
    
    // 为每个升级级别设置定时器
    for i, level := range policy.Levels {
        timer := time.AfterFunc(level.Delay, func() {
            em.escalate(ctx, alert, i, level)
        })
        
        em.mu.Lock()
        em.timers[fmt.Sprintf("%s-%d", alert.ID, i)] = timer
        em.mu.Unlock()
    }
}

// 执行升级
func (em *EscalationManager) escalate(ctx context.Context, alert *Alert, level int, config EscalationLevel) {
    log.Warn("告警升级", "alert_id", alert.ID, "level", level)
    
    // 更新告警注释
    alert.Annotations["escalation_level"] = fmt.Sprintf("%d", level)
    alert.Annotations["escalated_at"] = time.Now().Format(time.RFC3339)
    
    // 发送升级通知
    // TODO: 实现升级通知逻辑
}

// 取消升级
func (em *EscalationManager) Cancel(alertID string) {
    em.mu.Lock()
    defer em.mu.Unlock()
    
    // 取消所有相关定时器
    for key, timer := range em.timers {
        if strings.HasPrefix(key, alertID) {
            timer.Stop()
            delete(em.timers, key)
        }
    }
}
```

**关键实现点**:

1. 使用规则引擎评估告警条件，支持复杂表达式（阈值、模式、异常）
2. 实现时间窗口聚合，5 分钟内相同告警合并为一个事件
3. 自动收集告警上下文（日志、指标、追踪），提供完整的问题视图
4. 支持多渠道并发通知，提高通知送达率
5. 实现告警升级机制，未确认告警自动升级到下一级响应人员

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| alert_rules | array | [] | 告警规则列表 |
| aggregation_window | int | 300 | 聚合时间窗口（秒） |
| notification_channels | array | [] | 通知渠道配置 |
| escalation_policies | object | {} | 升级策略配置 |
| default_escalation_delay | int | 900 | 默认升级延迟（秒，15分钟） |
| alert_retention_days | int | 365 | 告警历史保留天数 |
| context_log_limit | int | 100 | 上下文日志数量限制 |
| context_metric_limit | int | 20 | 上下文指标数量限制 |
| template_format | string | "markdown" | 模板格式 |
| enable_auto_escalation | bool | true | 是否启用自动升级 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一次告警评估）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值和告警统计
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN 告警规则变更时，THE System SHALL 验证规则表达式的有效性
6. THE System SHALL 支持告警规则的灰度发布，先应用到部分数据源验证后再全量发布

---



#### 需求 4-15：告警抑制与静默管理 [MVP]

**用户故事**: 

作为运维工程师，我希望能够配置告警抑制和静默规则，以便在维护期间或已知问题时避免收到重复告警。

**验收标准**:

1. THE Alert_Engine SHALL 支持配置告警抑制规则，同一问题在 5 分钟内不重复产生告警
2. THE Alert_Engine SHALL 支持设置告警静默时间窗口（最长 7 天）
3. WHEN 创建静默规则时，THE UI SHALL 支持设置静默的开始时间、结束时间和影响范围
4. THE Alert_Engine SHALL 支持基于告警标签、来源、级别的精细化抑制规则
5. THE UI SHALL 展示当前生效的静默规则列表和剩余时间
6. THE System SHALL 记录所有被抑制和静默的告警，便于事后审计
7. THE Alert_Engine SHALL 支持临时静默（维护窗口）和永久抑制（已知问题）
8. THE Alert_Engine SHALL 支持静默规则的优先级，高优先级规则优先生效
9. WHEN 静默规则即将到期时（提前 1 小时），THE System SHALL 发送提醒通知
10. THE Alert_Engine SHALL 通过配置中心管理静默规则，支持热更新

**实现方向**:

**实现方式**:

```go
// 抑制管理器
type SuppressionManager struct {
    rules      map[string]*SuppressionRule // 抑制规则
    silences   map[string]*Silence         // 静默规则
    history    *SuppressionHistory         // 抑制历史
    config     atomic.Value                // 配置（支持热更新）
    mu         sync.RWMutex
}

// 抑制规则
type SuppressionRule struct {
    ID          string              // 规则 ID
    Name        string              // 规则名称
    Enabled     bool                // 是否启用
    Type        string              // 类型：temporary/permanent
    Matchers    []Matcher           // 匹配器列表
    Window      time.Duration       // 抑制时间窗口
    Priority    int                 // 优先级（数字越大优先级越高）
    CreatedAt   time.Time           // 创建时间
    CreatedBy   string              // 创建人
    Comment     string              // 备注
}

// 静默规则
type Silence struct {
    ID          string              // 静默 ID
    Name        string              // 静默名称
    Enabled     bool                // 是否启用
    StartTime   time.Time           // 开始时间
    EndTime     time.Time           // 结束时间
    Matchers    []Matcher           // 匹配器列表
    Priority    int                 // 优先级
    CreatedAt   time.Time           // 创建时间
    CreatedBy   string              // 创建人
    Comment     string              // 备注
    NotifyBefore time.Duration      // 到期前通知时间
}

// 匹配器
type Matcher struct {
    Label    string   // 标签名称
    Operator string   // 操作符：=, !=, =~, !~
    Value    string   // 匹配值（支持正则表达式）
}

// 抑制历史记录
type SuppressionHistory struct {
    AlertID      string    // 告警 ID
    RuleID       string    // 规则 ID
    Type         string    // 类型：suppression/silence
    Reason       string    // 原因
    SuppressedAt time.Time // 抑制时间
}

// 检查告警是否应该被抑制
func (sm *SuppressionManager) ShouldSuppress(alert *Alert) (bool, string) {
    sm.mu.RLock()
    defer sm.mu.RUnlock()
    
    // 1. 检查静默规则（优先级更高）
    if suppressed, reason := sm.checkSilences(alert); suppressed {
        sm.recordHistory(alert, "", "silence", reason)
        return true, reason
    }
    
    // 2. 检查抑制规则
    if suppressed, reason := sm.checkSuppressionRules(alert); suppressed {
        sm.recordHistory(alert, "", "suppression", reason)
        return true, reason
    }
    
    return false, ""
}

// 检查静默规则
func (sm *SuppressionManager) checkSilences(alert *Alert) (bool, string) {
    now := time.Now()
    
    // 按优先级排序
    silences := sm.getSortedSilences()
    
    for _, silence := range silences {
        if !silence.Enabled {
            continue
        }
        
        // 检查时间范围
        if now.Before(silence.StartTime) || now.After(silence.EndTime) {
            continue
        }
        
        // 检查匹配器
        if sm.matchAlert(alert, silence.Matchers) {
            reason := fmt.Sprintf("静默规则: %s (%s)", silence.Name, silence.Comment)
            log.Info("告警被静默", "alert_id", alert.ID, "silence_id", silence.ID)
            return true, reason
        }
    }
    
    return false, ""
}

// 检查抑制规则
func (sm *SuppressionManager) checkSuppressionRules(alert *Alert) (bool, string) {
    // 按优先级排序
    rules := sm.getSortedRules()
    
    for _, rule := range rules {
        if !rule.Enabled {
            continue
        }
        
        // 检查匹配器
        if !sm.matchAlert(alert, rule.Matchers) {
            continue
        }
        
        // 检查时间窗口内是否已有相同告警
        if sm.hasSimilarAlertInWindow(alert, rule.Window) {
            reason := fmt.Sprintf("抑制规则: %s (时间窗口: %v)", rule.Name, rule.Window)
            log.Info("告警被抑制", "alert_id", alert.ID, "rule_id", rule.ID)
            return true, reason
        }
    }
    
    return false, ""
}

// 匹配告警
func (sm *SuppressionManager) matchAlert(alert *Alert, matchers []Matcher) bool {
    for _, matcher := range matchers {
        value, ok := alert.Labels[matcher.Label]
        if !ok {
            return false
        }
        
        matched := false
        switch matcher.Operator {
        case "=":
            matched = value == matcher.Value
        case "!=":
            matched = value != matcher.Value
        case "=~":
            // 正则表达式匹配
            re, err := regexp.Compile(matcher.Value)
            if err != nil {
                log.Error("正则表达式编译失败", "pattern", matcher.Value, "error", err)
                return false
            }
            matched = re.MatchString(value)
        case "!~":
            // 正则表达式不匹配
            re, err := regexp.Compile(matcher.Value)
            if err != nil {
                log.Error("正则表达式编译失败", "pattern", matcher.Value, "error", err)
                return false
            }
            matched = !re.MatchString(value)
        default:
            log.Warn("未知的操作符", "operator", matcher.Operator)
            return false
        }
        
        if !matched {
            return false
        }
    }
    
    return true
}

// 检查时间窗口内是否有相似告警
func (sm *SuppressionManager) hasSimilarAlertInWindow(alert *Alert, window time.Duration) bool {
    // 计算告警指纹
    fingerprint := sm.calculateFingerprint(alert)
    
    // 查询历史记录
    cutoff := time.Now().Add(-window)
    
    // 从历史中查找相同指纹的告警
    for _, record := range sm.history.GetRecent(cutoff) {
        if record.AlertID == fingerprint {
            return true
        }
    }
    
    return false
}

// 创建静默规则
func (sm *SuppressionManager) CreateSilence(silence *Silence) error {
    sm.mu.Lock()
    defer sm.mu.Unlock()
    
    // 1. 验证静默规则
    if err := sm.validateSilence(silence); err != nil {
        return fmt.Errorf("静默规则验证失败: %w", err)
    }
    
    // 2. 生成 ID
    if silence.ID == "" {
        silence.ID = generateSilenceID()
    }
    
    // 3. 设置创建时间
    silence.CreatedAt = time.Now()
    
    // 4. 保存到存储
    sm.silences[silence.ID] = silence
    
    // 5. 设置到期提醒
    if silence.NotifyBefore > 0 {
        sm.scheduleExpiryNotification(silence)
    }
    
    log.Info("静默规则已创建",
        "silence_id", silence.ID,
        "name", silence.Name,
        "start_time", silence.StartTime,
        "end_time", silence.EndTime)
    
    return nil
}

// 验证静默规则
func (sm *SuppressionManager) validateSilence(silence *Silence) error {
    // 1. 检查时间范围
    if silence.EndTime.Before(silence.StartTime) {
        return fmt.Errorf("结束时间不能早于开始时间")
    }
    
    // 2. 检查最长时间限制（7 天）
    maxDuration := 7 * 24 * time.Hour
    if silence.EndTime.Sub(silence.StartTime) > maxDuration {
        return fmt.Errorf("静默时间不能超过 7 天")
    }
    
    // 3. 检查匹配器
    if len(silence.Matchers) == 0 {
        return fmt.Errorf("至少需要一个匹配器")
    }
    
    // 4. 验证正则表达式
    for _, matcher := range silence.Matchers {
        if matcher.Operator == "=~" || matcher.Operator == "!~" {
            if _, err := regexp.Compile(matcher.Value); err != nil {
                return fmt.Errorf("无效的正则表达式: %s", matcher.Value)
            }
        }
    }
    
    return nil
}

// 设置到期提醒
func (sm *SuppressionManager) scheduleExpiryNotification(silence *Silence) {
    notifyAt := silence.EndTime.Add(-silence.NotifyBefore)
    
    // 如果提醒时间已过，不设置提醒
    if notifyAt.Before(time.Now()) {
        return
    }
    
    // 计算延迟时间
    delay := time.Until(notifyAt)
    
    // 设置定时器
    time.AfterFunc(delay, func() {
        sm.sendExpiryNotification(silence)
    })
    
    log.Info("已设置到期提醒",
        "silence_id", silence.ID,
        "notify_at", notifyAt.Format(time.RFC3339))
}

// 发送到期提醒
func (sm *SuppressionManager) sendExpiryNotification(silence *Silence) {
    log.Info("静默规则即将到期", "silence_id", silence.ID, "name", silence.Name)
    
    // 构造提醒消息
    message := fmt.Sprintf(`静默规则即将到期

规则名称: %s
结束时间: %s
剩余时间: %s
创建人: %s
备注: %s

请确认是否需要延长静默时间。
`,
        silence.Name,
        silence.EndTime.Format("2006-01-02 15:04:05"),
        time.Until(silence.EndTime).String(),
        silence.CreatedBy,
        silence.Comment,
    )
    
    // 发送通知（发送给创建人）
    // TODO: 实现通知发送逻辑
    _ = message
}

// 获取当前生效的静默规则
func (sm *SuppressionManager) GetActiveSilences() []*Silence {
    sm.mu.RLock()
    defer sm.mu.RUnlock()
    
    now := time.Now()
    var active []*Silence
    
    for _, silence := range sm.silences {
        if !silence.Enabled {
            continue
        }
        
        // 检查是否在时间范围内
        if now.After(silence.StartTime) && now.Before(silence.EndTime) {
            active = append(active, silence)
        }
    }
    
    // 按优先级排序
    sort.Slice(active, func(i, j int) bool {
        return active[i].Priority > active[j].Priority
    })
    
    return active
}

// 删除静默规则
func (sm *SuppressionManager) DeleteSilence(silenceID string) error {
    sm.mu.Lock()
    defer sm.mu.Unlock()
    
    silence, ok := sm.silences[silenceID]
    if !ok {
        return fmt.Errorf("静默规则不存在: %s", silenceID)
    }
    
    delete(sm.silences, silenceID)
    
    log.Info("静默规则已删除", "silence_id", silenceID, "name", silence.Name)
    
    return nil
}

// 更新静默规则
func (sm *SuppressionManager) UpdateSilence(silence *Silence) error {
    sm.mu.Lock()
    defer sm.mu.Unlock()
    
    // 验证规则
    if err := sm.validateSilence(silence); err != nil {
        return fmt.Errorf("静默规则验证失败: %w", err)
    }
    
    // 检查是否存在
    if _, ok := sm.silences[silence.ID]; !ok {
        return fmt.Errorf("静默规则不存在: %s", silence.ID)
    }
    
    // 更新规则
    sm.silences[silence.ID] = silence
    
    // 重新设置到期提醒
    if silence.NotifyBefore > 0 {
        sm.scheduleExpiryNotification(silence)
    }
    
    log.Info("静默规则已更新", "silence_id", silence.ID, "name", silence.Name)
    
    return nil
}

// 记录抑制历史
func (sm *SuppressionManager) recordHistory(alert *Alert, ruleID, typ, reason string) {
    record := &SuppressionHistory{
        AlertID:      alert.ID,
        RuleID:       ruleID,
        Type:         typ,
        Reason:       reason,
        SuppressedAt: time.Now(),
    }
    
    sm.history.Add(record)
}

// 获取抑制历史
func (sm *SuppressionManager) GetHistory(startTime, endTime time.Time) []*SuppressionHistory {
    return sm.history.GetRange(startTime, endTime)
}

// 按优先级排序静默规则
func (sm *SuppressionManager) getSortedSilences() []*Silence {
    silences := make([]*Silence, 0, len(sm.silences))
    for _, silence := range sm.silences {
        silences = append(silences, silence)
    }
    
    sort.Slice(silences, func(i, j int) bool {
        return silences[i].Priority > silences[j].Priority
    })
    
    return silences
}

// 按优先级排序抑制规则
func (sm *SuppressionManager) getSortedRules() []*SuppressionRule {
    rules := make([]*SuppressionRule, 0, len(sm.rules))
    for _, rule := range sm.rules {
        rules = append(rules, rule)
    }
    
    sort.Slice(rules, func(i, j int) bool {
        return rules[i].Priority > rules[j].Priority
    })
    
    return rules
}

// 计算告警指纹
func (sm *SuppressionManager) calculateFingerprint(alert *Alert) string {
    // 基于标签计算指纹
    keys := make([]string, 0, len(alert.Labels))
    for k := range alert.Labels {
        keys = append(keys, k)
    }
    sort.Strings(keys)
    
    var parts []string
    for _, k := range keys {
        parts = append(parts, fmt.Sprintf("%s=%s", k, alert.Labels[k]))
    }
    
    fingerprint := strings.Join(parts, ",")
    
    // 使用 SHA256 哈希
    h := sha256.New()
    h.Write([]byte(fingerprint))
    return hex.EncodeToString(h.Sum(nil))
}
```

**关键实现点**:

1. 实现基于匹配器的灵活抑制规则，支持标签、来源、级别等多维度匹配
2. 支持正则表达式匹配（=~ 和 !~），提供强大的模式匹配能力
3. 实现优先级机制，高优先级规则优先生效，避免规则冲突
4. 实现时间窗口抑制，防止短时间内重复告警
5. 自动记录抑制历史，便于事后审计和问题追溯

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| suppression_rules | array | [] | 抑制规则列表 |
| silences | array | [] | 静默规则列表 |
| default_suppression_window | int | 300 | 默认抑制时间窗口（秒） |
| max_silence_duration | int | 604800 | 最大静默时长（秒，7天） |
| expiry_notify_before | int | 3600 | 到期前通知时间（秒，1小时） |
| enable_suppression | bool | true | 是否启用抑制 |
| enable_silence | bool | true | 是否启用静默 |
| history_retention_days | int | 90 | 历史记录保留天数 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一次告警检查）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值和抑制统计
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN 静默规则变更时，THE System SHALL 验证时间范围和匹配器的有效性
6. THE System SHALL 支持静默规则的批量导入和导出

---



#### 需求 4-16：自动化响应与修复 [Phase 2]

**用户故事**: 

作为运维工程师，我希望系统能够根据告警自动触发修复操作，以便快速恢复服务并减少人工干预。

**验收标准**:

1. WHEN 配置了自动修复时，THE Alert_Engine SHALL 触发预定义的修复操作（服务重启、配置回滚、扩容）
2. THE Alert_Engine SHALL 支持配置告警级联响应规则，根据告警级别触发不同的响应动作
3. THE Alert_Engine SHALL 支持告警响应的审批流程，关键操作需要授权确认
4. THE UI SHALL 展示自动修复的执行历史和成功率（目标 ≥ 80%）
5. WHEN 自动修复失败时，THE System SHALL 自动升级到人工处理并发送告警
6. THE Alert_Engine SHALL 支持回滚已执行的自动响应操作
7. THE Alert_Engine SHALL 支持多步骤响应流程（检查 → 修复 → 验证）
8. THE Alert_Engine SHALL 记录所有自动响应操作的审计日志
9. THE Alert_Engine SHALL 支持响应操作的模拟执行（Dry Run）
10. THE Alert_Engine SHALL 通过配置中心管理响应规则，支持热更新

**实现方向**:

**实现方式**:

```go
// 自动响应管理器
type AutoResponseManager struct {
    actions    map[string]ResponseAction  // 响应动作映射
    workflows  map[string]*Workflow       // 工作流定义
    executor   *ActionExecutor            // 动作执行器
    approver   *ApprovalManager           // 审批管理器
    auditor    *AuditLogger               // 审计日志
    config     atomic.Value               // 配置（支持热更新）
    metrics    *ResponseMetrics           // 响应指标
}

// 响应规则
type ResponseRule struct {
    ID          string              // 规则 ID
    Name        string              // 规则名称
    Enabled     bool                // 是否启用
    Matchers    []Matcher           // 告警匹配器
    Actions     []string            // 动作列表
    Workflow    string              // 工作流 ID
    RequireApproval bool            // 是否需要审批
    AutoRollback bool               // 失败时是否自动回滚
    Timeout     time.Duration       // 超时时间
    RetryCount  int                 // 重试次数
}

// 响应动作接口
type ResponseAction interface {
    Execute(ctx context.Context, alert *Alert) (*ActionResult, error)
    Rollback(ctx context.Context, result *ActionResult) error
    Validate(ctx context.Context, alert *Alert) error
    Name() string
    RequiresApproval() bool
}

// 动作结果
type ActionResult struct {
    ActionName  string              // 动作名称
    Status      string              // 状态：success/failed/pending
    StartTime   time.Time           // 开始时间
    EndTime     time.Time           // 结束时间
    Duration    time.Duration       // 执行时长
    Output      string              // 输出信息
    Error       string              // 错误信息
    RollbackData map[string]interface{} // 回滚数据
}

// 工作流
type Workflow struct {
    ID          string              // 工作流 ID
    Name        string              // 工作流名称
    Steps       []WorkflowStep      // 工作流步骤
    OnFailure   string              // 失败时的处理：stop/continue/rollback
}

// 工作流步骤
type WorkflowStep struct {
    Name        string              // 步骤名称
    Action      string              // 动作名称
    Condition   string              // 执行条件（表达式）
    Timeout     time.Duration       // 超时时间
    OnError     string              // 错误处理：retry/skip/fail
    RetryCount  int                 // 重试次数
}

// 处理告警响应
func (arm *AutoResponseManager) HandleAlert(ctx context.Context, alert *Alert) error {
    // 1. 查找匹配的响应规则
    rule := arm.findMatchingRule(alert)
    if rule == nil {
        log.Debug("未找到匹配的响应规则", "alert_id", alert.ID)
        return nil
    }
    
    if !rule.Enabled {
        log.Debug("响应规则已禁用", "rule_id", rule.ID)
        return nil
    }
    
    log.Info("触发自动响应", "alert_id", alert.ID, "rule_id", rule.ID)
    
    // 2. 检查是否需要审批
    if rule.RequireApproval {
        approved, err := arm.approver.RequestApproval(ctx, alert, rule)
        if err != nil {
            return fmt.Errorf("审批请求失败: %w", err)
        }
        if !approved {
            log.Info("响应操作未获批准", "alert_id", alert.ID)
            return nil
        }
    }
    
    // 3. 执行响应工作流
    var results []*ActionResult
    var err error
    
    if rule.Workflow != "" {
        // 执行工作流
        results, err = arm.executeWorkflow(ctx, alert, rule.Workflow)
    } else {
        // 执行单个动作列表
        results, err = arm.executeActions(ctx, alert, rule.Actions)
    }
    
    // 4. 处理执行结果
    if err != nil {
        log.Error("自动响应执行失败", "alert_id", alert.ID, "error", err)
        
        // 自动回滚
        if rule.AutoRollback {
            arm.rollbackActions(ctx, results)
        }
        
        // 升级到人工处理
        arm.escalateToManual(ctx, alert, err)
        
        return err
    }
    
    // 5. 记录审计日志
    arm.auditor.LogResponse(alert, rule, results)
    
    // 6. 更新指标
    arm.metrics.RecordResponse(rule.ID, results)
    
    log.Info("自动响应执行成功", "alert_id", alert.ID, "rule_id", rule.ID)
    
    return nil
}

// 执行工作流
func (arm *AutoResponseManager) executeWorkflow(ctx context.Context, alert *Alert, workflowID string) ([]*ActionResult, error) {
    workflow, ok := arm.workflows[workflowID]
    if !ok {
        return nil, fmt.Errorf("工作流不存在: %s", workflowID)
    }
    
    log.Info("开始执行工作流", "workflow_id", workflowID, "steps", len(workflow.Steps))
    
    var results []*ActionResult
    
    for i, step := range workflow.Steps {
        log.Info("执行工作流步骤", "step", i+1, "name", step.Name)
        
        // 1. 检查执行条件
        if step.Condition != "" {
            shouldExecute, err := arm.evaluateCondition(step.Condition, alert, results)
            if err != nil {
                log.Error("条件评估失败", "condition", step.Condition, "error", err)
                return results, err
            }
            if !shouldExecute {
                log.Info("跳过步骤（条件不满足）", "step", step.Name)
                continue
            }
        }
        
        // 2. 获取动作
        action, ok := arm.actions[step.Action]
        if !ok {
            return results, fmt.Errorf("动作不存在: %s", step.Action)
        }
        
        // 3. 执行动作（带重试）
        var result *ActionResult
        var err error
        
        for retry := 0; retry <= step.RetryCount; retry++ {
            if retry > 0 {
                log.Info("重试执行", "step", step.Name, "retry", retry)
                time.Sleep(time.Duration(retry) * time.Second) // 指数退避
            }
            
            // 设置超时
            stepCtx, cancel := context.WithTimeout(ctx, step.Timeout)
            result, err = action.Execute(stepCtx, alert)
            cancel()
            
            if err == nil {
                break // 成功，退出重试
            }
        }
        
        results = append(results, result)
        
        // 4. 处理错误
        if err != nil {
            log.Error("步骤执行失败", "step", step.Name, "error", err)
            
            switch step.OnError {
            case "retry":
                // 已经重试过了，继续失败处理
                fallthrough
            case "fail":
                // 失败，停止工作流
                if workflow.OnFailure == "rollback" {
                    arm.rollbackActions(ctx, results)
                }
                return results, fmt.Errorf("步骤 %s 执行失败: %w", step.Name, err)
            case "skip":
                // 跳过错误，继续下一步
                log.Warn("跳过失败的步骤", "step", step.Name)
                continue
            }
        }
        
        log.Info("步骤执行成功", "step", step.Name, "duration", result.Duration)
    }
    
    log.Info("工作流执行完成", "workflow_id", workflowID)
    
    return results, nil
}

// 执行动作列表
func (arm *AutoResponseManager) executeActions(ctx context.Context, alert *Alert, actionNames []string) ([]*ActionResult, error) {
    var results []*ActionResult
    
    for _, actionName := range actionNames {
        action, ok := arm.actions[actionName]
        if !ok {
            return results, fmt.Errorf("动作不存在: %s", actionName)
        }
        
        result, err := action.Execute(ctx, alert)
        results = append(results, result)
        
        if err != nil {
            return results, fmt.Errorf("动作 %s 执行失败: %w", actionName, err)
        }
    }
    
    return results, nil
}

// 回滚动作
func (arm *AutoResponseManager) rollbackActions(ctx context.Context, results []*ActionResult) {
    log.Info("开始回滚操作", "actions", len(results))
    
    // 按相反顺序回滚
    for i := len(results) - 1; i >= 0; i-- {
        result := results[i]
        
        if result.Status != "success" {
            continue // 跳过失败的动作
        }
        
        action, ok := arm.actions[result.ActionName]
        if !ok {
            log.Error("回滚失败：动作不存在", "action", result.ActionName)
            continue
        }
        
        log.Info("回滚动作", "action", result.ActionName)
        
        if err := action.Rollback(ctx, result); err != nil {
            log.Error("回滚失败", "action", result.ActionName, "error", err)
        } else {
            log.Info("回滚成功", "action", result.ActionName)
        }
    }
}

// 升级到人工处理
func (arm *AutoResponseManager) escalateToManual(ctx context.Context, alert *Alert, err error) {
    log.Warn("自动响应失败，升级到人工处理", "alert_id", alert.ID, "error", err)
    
    // 创建人工处理告警
    manualAlert := &Alert{
        ID:       generateAlertID(),
        RuleID:   "manual-intervention",
        Severity: "P1",
        Status:   "firing",
        StartsAt: time.Now(),
        Labels: map[string]string{
            "type":           "manual_intervention",
            "original_alert": alert.ID,
        },
        Annotations: map[string]string{
            "title":   "自动响应失败，需要人工介入",
            "content": fmt.Sprintf("原始告警: %s\n错误: %s", alert.ID, err.Error()),
        },
    }
    
    // 发送人工处理告警
    // TODO: 发送到告警队列
    _ = manualAlert
}

// 服务重启动作
type RestartServiceAction struct {
    k8sClient *kubernetes.Clientset
}

func (rsa *RestartServiceAction) Execute(ctx context.Context, alert *Alert) (*ActionResult, error) {
    result := &ActionResult{
        ActionName: "restart_service",
        StartTime:  time.Now(),
        Status:     "pending",
    }
    
    // 1. 从告警标签获取服务信息
    namespace := alert.Labels["namespace"]
    deployment := alert.Labels["deployment"]
    
    if namespace == "" || deployment == "" {
        result.Status = "failed"
        result.Error = "缺少必要的标签: namespace 或 deployment"
        return result, fmt.Errorf(result.Error)
    }
    
    log.Info("重启服务", "namespace", namespace, "deployment", deployment)
    
    // 2. 获取 Deployment
    deploymentsClient := rsa.k8sClient.AppsV1().Deployments(namespace)
    deploy, err := deploymentsClient.Get(ctx, deployment, metav1.GetOptions{})
    if err != nil {
        result.Status = "failed"
        result.Error = fmt.Sprintf("获取 Deployment 失败: %v", err)
        return result, err
    }
    
    // 3. 保存回滚数据
    result.RollbackData = map[string]interface{}{
        "namespace":  namespace,
        "deployment": deployment,
        "replicas":   *deploy.Spec.Replicas,
    }
    
    // 4. 触发滚动重启（通过更新注解）
    if deploy.Spec.Template.Annotations == nil {
        deploy.Spec.Template.Annotations = make(map[string]string)
    }
    deploy.Spec.Template.Annotations["kubectl.kubernetes.io/restartedAt"] = time.Now().Format(time.RFC3339)
    
    _, err = deploymentsClient.Update(ctx, deploy, metav1.UpdateOptions{})
    if err != nil {
        result.Status = "failed"
        result.Error = fmt.Sprintf("更新 Deployment 失败: %v", err)
        return result, err
    }
    
    // 5. 等待 Pod 重启完成
    err = rsa.waitForRollout(ctx, namespace, deployment, 5*time.Minute)
    if err != nil {
        result.Status = "failed"
        result.Error = fmt.Sprintf("等待重启完成失败: %v", err)
        return result, err
    }
    
    result.EndTime = time.Now()
    result.Duration = result.EndTime.Sub(result.StartTime)
    result.Status = "success"
    result.Output = fmt.Sprintf("服务 %s/%s 重启成功", namespace, deployment)
    
    log.Info("服务重启成功", "namespace", namespace, "deployment", deployment, "duration", result.Duration)
    
    return result, nil
}

func (rsa *RestartServiceAction) Rollback(ctx context.Context, result *ActionResult) error {
    // 服务重启通常不需要回滚
    log.Info("服务重启动作无需回滚")
    return nil
}

func (rsa *RestartServiceAction) Validate(ctx context.Context, alert *Alert) error {
    // 验证必要的标签是否存在
    if alert.Labels["namespace"] == "" || alert.Labels["deployment"] == "" {
        return fmt.Errorf("缺少必要的标签: namespace 或 deployment")
    }
    return nil
}

func (rsa *RestartServiceAction) Name() string {
    return "restart_service"
}

func (rsa *RestartServiceAction) RequiresApproval() bool {
    return false // 服务重启不需要审批
}

func (rsa *RestartServiceAction) waitForRollout(ctx context.Context, namespace, deployment string, timeout time.Duration) error {
    // 等待 Deployment 滚动更新完成
    // TODO: 实现等待逻辑
    return nil
}

// 配置回滚动作
type RollbackConfigAction struct {
    configStore ConfigStore
}

func (rca *RollbackConfigAction) Execute(ctx context.Context, alert *Alert) (*ActionResult, error) {
    result := &ActionResult{
        ActionName: "rollback_config",
        StartTime:  time.Now(),
        Status:     "pending",
    }
    
    // 1. 从告警标签获取配置信息
    configKey := alert.Labels["config_key"]
    if configKey == "" {
        result.Status = "failed"
        result.Error = "缺少必要的标签: config_key"
        return result, fmt.Errorf(result.Error)
    }
    
    log.Info("回滚配置", "config_key", configKey)
    
    // 2. 获取当前配置版本
    currentVersion, err := rca.configStore.GetCurrentVersion(ctx, configKey)
    if err != nil {
        result.Status = "failed"
        result.Error = fmt.Sprintf("获取当前版本失败: %v", err)
        return result, err
    }
    
    // 3. 保存回滚数据
    result.RollbackData = map[string]interface{}{
        "config_key":      configKey,
        "current_version": currentVersion,
    }
    
    // 4. 获取上一个版本
    previousVersion, err := rca.configStore.GetPreviousVersion(ctx, configKey, currentVersion)
    if err != nil {
        result.Status = "failed"
        result.Error = fmt.Sprintf("获取上一版本失败: %v", err)
        return result, err
    }
    
    // 5. 执行回滚
    err = rca.configStore.Rollback(ctx, configKey, previousVersion)
    if err != nil {
        result.Status = "failed"
        result.Error = fmt.Sprintf("回滚失败: %v", err)
        return result, err
    }
    
    result.EndTime = time.Now()
    result.Duration = result.EndTime.Sub(result.StartTime)
    result.Status = "success"
    result.Output = fmt.Sprintf("配置 %s 已回滚到版本 %s", configKey, previousVersion)
    
    log.Info("配置回滚成功", "config_key", configKey, "version", previousVersion)
    
    return result, nil
}

func (rca *RollbackConfigAction) Rollback(ctx context.Context, result *ActionResult) error {
    // 回滚配置回滚操作（恢复到原版本）
    configKey := result.RollbackData["config_key"].(string)
    currentVersion := result.RollbackData["current_version"].(string)
    
    log.Info("恢复配置", "config_key", configKey, "version", currentVersion)
    
    return rca.configStore.Rollback(ctx, configKey, currentVersion)
}

func (rca *RollbackConfigAction) Validate(ctx context.Context, alert *Alert) error {
    if alert.Labels["config_key"] == "" {
        return fmt.Errorf("缺少必要的标签: config_key")
    }
    return nil
}

func (rca *RollbackConfigAction) Name() string {
    return "rollback_config"
}

func (rca *RollbackConfigAction) RequiresApproval() bool {
    return true // 配置回滚需要审批
}

// 自动扩容动作
type AutoScaleAction struct {
    k8sClient *kubernetes.Clientset
}

func (asa *AutoScaleAction) Execute(ctx context.Context, alert *Alert) (*ActionResult, error) {
    result := &ActionResult{
        ActionName: "auto_scale",
        StartTime:  time.Now(),
        Status:     "pending",
    }
    
    // 1. 从告警标签获取扩容信息
    namespace := alert.Labels["namespace"]
    deployment := alert.Labels["deployment"]
    scaleType := alert.Labels["scale_type"] // scale_up/scale_down
    
    if namespace == "" || deployment == "" {
        result.Status = "failed"
        result.Error = "缺少必要的标签: namespace 或 deployment"
        return result, fmt.Errorf(result.Error)
    }
    
    log.Info("自动扩容", "namespace", namespace, "deployment", deployment, "type", scaleType)
    
    // 2. 获取当前副本数
    deploymentsClient := asa.k8sClient.AppsV1().Deployments(namespace)
    deploy, err := deploymentsClient.Get(ctx, deployment, metav1.GetOptions{})
    if err != nil {
        result.Status = "failed"
        result.Error = fmt.Sprintf("获取 Deployment 失败: %v", err)
        return result, err
    }
    
    currentReplicas := *deploy.Spec.Replicas
    
    // 3. 计算新的副本数
    var newReplicas int32
    if scaleType == "scale_up" {
        newReplicas = currentReplicas + int32(currentReplicas/2) // 增加 50%
        if newReplicas > 100 {
            newReplicas = 100 // 最大 100 个副本
        }
    } else {
        newReplicas = currentReplicas - int32(currentReplicas/4) // 减少 25%
        if newReplicas < 1 {
            newReplicas = 1 // 最小 1 个副本
        }
    }
    
    // 4. 保存回滚数据
    result.RollbackData = map[string]interface{}{
        "namespace":        namespace,
        "deployment":       deployment,
        "original_replicas": currentReplicas,
    }
    
    // 5. 执行扩容
    deploy.Spec.Replicas = &newReplicas
    _, err = deploymentsClient.Update(ctx, deploy, metav1.UpdateOptions{})
    if err != nil {
        result.Status = "failed"
        result.Error = fmt.Sprintf("更新副本数失败: %v", err)
        return result, err
    }
    
    result.EndTime = time.Now()
    result.Duration = result.EndTime.Sub(result.StartTime)
    result.Status = "success"
    result.Output = fmt.Sprintf("服务 %s/%s 副本数从 %d 调整为 %d", namespace, deployment, currentReplicas, newReplicas)
    
    log.Info("自动扩容成功", "namespace", namespace, "deployment", deployment, 
        "from", currentReplicas, "to", newReplicas)
    
    return result, nil
}

func (asa *AutoScaleAction) Rollback(ctx context.Context, result *ActionResult) error {
    // 恢复原始副本数
    namespace := result.RollbackData["namespace"].(string)
    deployment := result.RollbackData["deployment"].(string)
    originalReplicas := result.RollbackData["original_replicas"].(int32)
    
    log.Info("恢复副本数", "namespace", namespace, "deployment", deployment, "replicas", originalReplicas)
    
    deploymentsClient := asa.k8sClient.AppsV1().Deployments(namespace)
    deploy, err := deploymentsClient.Get(context.Background(), deployment, metav1.GetOptions{})
    if err != nil {
        return err
    }
    
    deploy.Spec.Replicas = &originalReplicas
    _, err = deploymentsClient.Update(context.Background(), deploy, metav1.UpdateOptions{})
    
    return err
}

func (asa *AutoScaleAction) Validate(ctx context.Context, alert *Alert) error {
    if alert.Labels["namespace"] == "" || alert.Labels["deployment"] == "" {
        return fmt.Errorf("缺少必要的标签: namespace 或 deployment")
    }
    return nil
}

func (asa *AutoScaleAction) Name() string {
    return "auto_scale"
}

func (asa *AutoScaleAction) RequiresApproval() bool {
    return false // 自动扩容不需要审批
}

// 审批管理器
type ApprovalManager struct {
    approvers map[string][]string // 审批人映射
    requests  map[string]*ApprovalRequest
    mu        sync.RWMutex
}

// 审批请求
type ApprovalRequest struct {
    ID          string
    Alert       *Alert
    Rule        *ResponseRule
    RequestedAt time.Time
    Status      string // pending/approved/rejected
    Approver    string
    ApprovedAt  time.Time
    Comment     string
}

// 请求审批
func (am *ApprovalManager) RequestApproval(ctx context.Context, alert *Alert, rule *ResponseRule) (bool, error) {
    request := &ApprovalRequest{
        ID:          generateRequestID(),
        Alert:       alert,
        Rule:        rule,
        RequestedAt: time.Now(),
        Status:      "pending",
    }
    
    am.mu.Lock()
    am.requests[request.ID] = request
    am.mu.Unlock()
    
    log.Info("创建审批请求", "request_id", request.ID, "rule", rule.Name)
    
    // 发送审批通知
    // TODO: 发送通知给审批人
    
    // 等待审批结果（带超时）
    timeout := 30 * time.Minute
    ticker := time.NewTicker(5 * time.Second)
    defer ticker.Stop()
    
    deadline := time.Now().Add(timeout)
    
    for {
        select {
        case <-ctx.Done():
            return false, ctx.Err()
        case <-ticker.C:
            am.mu.RLock()
            status := request.Status
            am.mu.RUnlock()
            
            if status == "approved" {
                log.Info("审批通过", "request_id", request.ID)
                return true, nil
            }
            if status == "rejected" {
                log.Info("审批拒绝", "request_id", request.ID)
                return false, nil
            }
            
            if time.Now().After(deadline) {
                log.Warn("审批超时", "request_id", request.ID)
                return false, fmt.Errorf("审批超时")
            }
        }
    }
}

// 模拟执行（Dry Run）
func (arm *AutoResponseManager) DryRun(ctx context.Context, alert *Alert, ruleID string) ([]*ActionResult, error) {
    log.Info("开始模拟执行", "alert_id", alert.ID, "rule_id", ruleID)
    
    // 查找规则
    rule, ok := arm.config.Load().(*ResponseConfig).Rules[ruleID]
    if !ok {
        return nil, fmt.Errorf("规则不存在: %s", ruleID)
    }
    
    var results []*ActionResult
    
    // 模拟执行每个动作
    for _, actionName := range rule.Actions {
        action, ok := arm.actions[actionName]
        if !ok {
            return results, fmt.Errorf("动作不存在: %s", actionName)
        }
        
        // 验证动作
        if err := action.Validate(ctx, alert); err != nil {
            result := &ActionResult{
                ActionName: actionName,
                Status:     "failed",
                Error:      fmt.Sprintf("验证失败: %v", err),
            }
            results = append(results, result)
            continue
        }
        
        // 模拟成功
        result := &ActionResult{
            ActionName: actionName,
            Status:     "success",
            Output:     fmt.Sprintf("[DRY RUN] 动作 %s 将被执行", actionName),
        }
        results = append(results, result)
    }
    
    log.Info("模拟执行完成", "alert_id", alert.ID, "actions", len(results))
    
    return results, nil
}
```

**关键实现点**:

1. 实现工作流引擎，支持多步骤响应流程（检查 → 修复 → 验证）
2. 支持动作回滚机制，失败时自动恢复到原始状态
3. 实现审批流程，关键操作需要人工确认后才能执行
4. 支持模拟执行（Dry Run），验证响应操作的正确性
5. 自动记录审计日志，包含执行时间、结果、回滚数据等完整信息

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| response_rules | array | [] | 响应规则列表 |
| workflows | array | [] | 工作流定义列表 |
| actions | array | [] | 可用动作列表 |
| approval_timeout | int | 1800 | 审批超时时间（秒，30分钟） |
| action_timeout | int | 300 | 动作执行超时时间（秒） |
| enable_auto_rollback | bool | true | 是否启用自动回滚 |
| max_retry_count | int | 3 | 最大重试次数 |
| enable_dry_run | bool | true | 是否启用模拟执行 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一次告警响应）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值和响应统计
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN 响应规则变更时，THE System SHALL 验证工作流和动作的有效性
6. THE System SHALL 支持响应规则的灰度发布，先应用到测试环境验证后再生产发布

---



#### 需求 4-17：告警值班与排班管理 [Phase 2]

**用户故事**: 

作为运维团队负责人，我希望能够管理告警值班排班，以便确保告警能够及时被正确的人员处理。

**验收标准**:

1. THE UI SHALL 提供值班排班管理界面，支持创建和管理值班计划
2. THE Alert_Engine SHALL 根据当前值班人员自动路由告警通知
3. THE System SHALL 支持多种排班模式（轮班、固定班次、按需排班）
4. WHEN 值班人员在 10 分钟内无法响应时，THE Alert_Engine SHALL 自动升级到备用值班人员
5. THE UI SHALL 展示值班日历视图，显示每天的值班安排
6. THE System SHALL 提供值班统计报告，展示各值班人员的告警处理情况
7. THE System SHALL 支持值班交接记录和交接清单
8. THE System SHALL 支持值班人员临时调整和代班
9. THE System SHALL 在值班开始前 1 小时发送提醒通知
10. THE System SHALL 通过配置中心管理排班规则，支持热更新

**实现方向**:

**实现方式**:

```go
// 值班管理器
type OnCallManager struct {
    schedules  map[string]*OnCallSchedule // 值班计划
    shifts     map[string]*Shift          // 班次定义
    rotations  map[string]*Rotation       // 轮班规则
    overrides  map[string]*Override       // 临时调整
    handoffs   []*Handoff                 // 交接记录
    config     atomic.Value               // 配置（支持热更新）
    notifier   *NotificationManager       // 通知管理器
}

// 值班计划
type OnCallSchedule struct {
    ID          string              // 计划 ID
    Name        string              // 计划名称
    Enabled     bool                // 是否启用
    Type        string              // 类型：rotation/fixed/on_demand
    Timezone    string              // 时区
    Rotation    *Rotation           // 轮班规则
    FixedShifts []FixedShift        // 固定班次
    OnDemand    *OnDemandConfig     // 按需排班配置
    CreatedAt   time.Time           // 创建时间
    CreatedBy   string              // 创建人
}

// 轮班规则
type Rotation struct {
    ID          string              // 轮班 ID
    Name        string              // 轮班名称
    Type        string              // 类型：daily/weekly/custom
    StartDate   time.Time           // 开始日期
    Participants []string           // 参与人员列表
    ShiftLength time.Duration       // 班次时长
    HandoffTime string              // 交接时间（如 "09:00"）
}

// 固定班次
type FixedShift struct {
    Name        string              // 班次名称
    DayOfWeek   []int               // 星期几（0-6，0=周日）
    StartTime   string              // 开始时间（如 "09:00"）
    EndTime     string              // 结束时间（如 "18:00"）
    Assignee    string              // 值班人员
    Backup      string              // 备用人员
}

// 按需排班配置
type OnDemandConfig struct {
    Rules       []OnDemandRule      // 按需规则
    DefaultTeam string              // 默认团队
}

// 按需规则
type OnDemandRule struct {
    Matchers    []Matcher           // 告警匹配器
    Team        string              // 负责团队
    Priority    int                 // 优先级
}

// 临时调整
type Override struct {
    ID          string              // 调整 ID
    ScheduleID  string              // 值班计划 ID
    StartTime   time.Time           // 开始时间
    EndTime     time.Time           // 结束时间
    Original    string              // 原值班人员
    Replacement string              // 替换人员
    Reason      string              // 调整原因
    CreatedAt   time.Time           // 创建时间
    CreatedBy   string              // 创建人
}

// 交接记录
type Handoff struct {
    ID          string              // 交接 ID
    ScheduleID  string              // 值班计划 ID
    FromUser    string              // 交接人
    ToUser      string              // 接班人
    HandoffTime time.Time           // 交接时间
    Checklist   []ChecklistItem     // 交接清单
    Notes       string              // 交接备注
    Status      string              // 状态：pending/completed
}

// 交接清单项
type ChecklistItem struct {
    Item        string              // 清单项
    Completed   bool                // 是否完成
    CompletedAt time.Time           // 完成时间
    Notes       string              // 备注
}

// 获取当前值班人员
func (ocm *OnCallManager) GetCurrentOnCall(scheduleID string) (string, error) {
    schedule, ok := ocm.schedules[scheduleID]
    if !ok {
        return "", fmt.Errorf("值班计划不存在: %s", scheduleID)
    }
    
    if !schedule.Enabled {
        return "", fmt.Errorf("值班计划已禁用: %s", scheduleID)
    }
    
    now := time.Now()
    
    // 1. 检查临时调整
    if override := ocm.findActiveOverride(scheduleID, now); override != nil {
        log.Info("使用临时调整的值班人员", 
            "schedule", scheduleID, 
            "user", override.Replacement,
            "reason", override.Reason)
        return override.Replacement, nil
    }
    
    // 2. 根据排班类型获取值班人员
    switch schedule.Type {
    case "rotation":
        return ocm.getRotationOnCall(schedule.Rotation, now)
    case "fixed":
        return ocm.getFixedShiftOnCall(schedule.FixedShifts, now)
    case "on_demand":
        return schedule.OnDemand.DefaultTeam, nil
    default:
        return "", fmt.Errorf("未知的排班类型: %s", schedule.Type)
    }
}

// 获取轮班值班人员
func (ocm *OnCallManager) getRotationOnCall(rotation *Rotation, now time.Time) (string, error) {
    if len(rotation.Participants) == 0 {
        return "", fmt.Errorf("轮班人员列表为空")
    }
    
    // 计算从开始日期到现在经过了多少个班次
    elapsed := now.Sub(rotation.StartDate)
    shiftsPassed := int(elapsed / rotation.ShiftLength)
    
    // 计算当前值班人员索引
    index := shiftsPassed % len(rotation.Participants)
    
    currentUser := rotation.Participants[index]
    
    log.Info("轮班值班人员", 
        "rotation", rotation.Name,
        "user", currentUser,
        "shift", shiftsPassed,
        "index", index)
    
    return currentUser, nil
}

// 获取固定班次值班人员
func (ocm *OnCallManager) getFixedShiftOnCall(shifts []FixedShift, now time.Time) (string, error) {
    // 获取当前星期几和时间
    weekday := int(now.Weekday())
    currentTime := now.Format("15:04")
    
    // 查找匹配的班次
    for _, shift := range shifts {
        // 检查星期几
        matched := false
        for _, day := range shift.DayOfWeek {
            if day == weekday {
                matched = true
                break
            }
        }
        if !matched {
            continue
        }
        
        // 检查时间范围
        if currentTime >= shift.StartTime && currentTime < shift.EndTime {
            log.Info("固定班次值班人员",
                "shift", shift.Name,
                "user", shift.Assignee,
                "time", currentTime)
            return shift.Assignee, nil
        }
    }
    
    return "", fmt.Errorf("未找到匹配的班次")
}

// 查找生效的临时调整
func (ocm *OnCallManager) findActiveOverride(scheduleID string, now time.Time) *Override {
    for _, override := range ocm.overrides {
        if override.ScheduleID != scheduleID {
            continue
        }
        
        // 检查时间范围
        if now.After(override.StartTime) && now.Before(override.EndTime) {
            return override
        }
    }
    
    return nil
}

// 路由告警到值班人员
func (ocm *OnCallManager) RouteAlert(alert *Alert) ([]string, error) {
    var recipients []string
    
    // 1. 根据告警标签确定值班计划
    scheduleID := alert.Labels["on_call_schedule"]
    if scheduleID == "" {
        scheduleID = "default" // 使用默认值班计划
    }
    
    // 2. 获取当前值班人员
    onCallUser, err := ocm.GetCurrentOnCall(scheduleID)
    if err != nil {
        log.Error("获取值班人员失败", "schedule", scheduleID, "error", err)
        return nil, err
    }
    
    recipients = append(recipients, onCallUser)
    
    // 3. 如果是高优先级告警，同时通知备用人员
    if alert.Severity == "P0" || alert.Severity == "P1" {
        schedule := ocm.schedules[scheduleID]
        if schedule != nil && schedule.Type == "fixed" {
            // 查找备用人员
            for _, shift := range schedule.FixedShifts {
                if shift.Assignee == onCallUser && shift.Backup != "" {
                    recipients = append(recipients, shift.Backup)
                    break
                }
            }
        }
    }
    
    log.Info("告警已路由到值班人员", 
        "alert_id", alert.ID,
        "schedule", scheduleID,
        "recipients", recipients)
    
    return recipients, nil
}

// 发送值班提醒
func (ocm *OnCallManager) SendOnCallReminders() {
    log.Info("检查值班提醒")
    
    now := time.Now()
    reminderTime := now.Add(1 * time.Hour) // 提前 1 小时提醒
    
    for _, schedule := range ocm.schedules {
        if !schedule.Enabled {
            continue
        }
        
        // 获取提醒时间的值班人员
        nextOnCall, err := ocm.getOnCallAtTime(schedule, reminderTime)
        if err != nil {
            log.Error("获取值班人员失败", "schedule", schedule.ID, "error", err)
            continue
        }
        
        // 获取当前值班人员
        currentOnCall, _ := ocm.GetCurrentOnCall(schedule.ID)
        
        // 如果值班人员发生变化，发送提醒
        if nextOnCall != currentOnCall {
            ocm.sendReminder(schedule, nextOnCall, reminderTime)
        }
    }
}

// 发送提醒通知
func (ocm *OnCallManager) sendReminder(schedule *OnCallSchedule, user string, startTime time.Time) {
    log.Info("发送值班提醒", "schedule", schedule.Name, "user", user, "start_time", startTime)
    
    message := fmt.Sprintf(`值班提醒

您将在 1 小时后开始值班：

值班计划: %s
开始时间: %s
时区: %s

请确保您能够及时响应告警。
`,
        schedule.Name,
        startTime.Format("2006-01-02 15:04:05"),
        schedule.Timezone,
    )
    
    // 发送通知
    // TODO: 调用通知管理器发送
    _ = message
}

// 获取指定时间的值班人员
func (ocm *OnCallManager) getOnCallAtTime(schedule *OnCallSchedule, t time.Time) (string, error) {
    // 检查临时调整
    if override := ocm.findActiveOverride(schedule.ID, t); override != nil {
        return override.Replacement, nil
    }
    
    // 根据排班类型获取
    switch schedule.Type {
    case "rotation":
        return ocm.getRotationOnCall(schedule.Rotation, t)
    case "fixed":
        return ocm.getFixedShiftOnCall(schedule.FixedShifts, t)
    case "on_demand":
        return schedule.OnDemand.DefaultTeam, nil
    default:
        return "", fmt.Errorf("未知的排班类型: %s", schedule.Type)
    }
}

// 创建临时调整
func (ocm *OnCallManager) CreateOverride(override *Override) error {
    // 验证调整
    if err := ocm.validateOverride(override); err != nil {
        return fmt.Errorf("临时调整验证失败: %w", err)
    }
    
    // 生成 ID
    if override.ID == "" {
        override.ID = generateOverrideID()
    }
    
    override.CreatedAt = time.Now()
    
    // 保存调整
    ocm.overrides[override.ID] = override
    
    log.Info("临时调整已创建",
        "override_id", override.ID,
        "schedule", override.ScheduleID,
        "original", override.Original,
        "replacement", override.Replacement,
        "reason", override.Reason)
    
    // 发送通知给相关人员
    ocm.notifyOverride(override)
    
    return nil
}

// 验证临时调整
func (ocm *OnCallManager) validateOverride(override *Override) error {
    // 检查值班计划是否存在
    if _, ok := ocm.schedules[override.ScheduleID]; !ok {
        return fmt.Errorf("值班计划不存在: %s", override.ScheduleID)
    }
    
    // 检查时间范围
    if override.EndTime.Before(override.StartTime) {
        return fmt.Errorf("结束时间不能早于开始时间")
    }
    
    // 检查是否有冲突的调整
    for _, existing := range ocm.overrides {
        if existing.ScheduleID != override.ScheduleID {
            continue
        }
        
        // 检查时间重叠
        if override.StartTime.Before(existing.EndTime) && override.EndTime.After(existing.StartTime) {
            return fmt.Errorf("与现有调整冲突: %s", existing.ID)
        }
    }
    
    return nil
}

// 通知临时调整
func (ocm *OnCallManager) notifyOverride(override *Override) {
    message := fmt.Sprintf(`值班调整通知

值班计划: %s
时间范围: %s - %s
原值班人员: %s
替换人员: %s
调整原因: %s
`,
        override.ScheduleID,
        override.StartTime.Format("2006-01-02 15:04"),
        override.EndTime.Format("2006-01-02 15:04"),
        override.Original,
        override.Replacement,
        override.Reason,
    )
    
    // 通知原值班人员和替换人员
    // TODO: 发送通知
    _ = message
}

// 创建交接记录
func (ocm *OnCallManager) CreateHandoff(handoff *Handoff) error {
    // 生成 ID
    if handoff.ID == "" {
        handoff.ID = generateHandoffID()
    }
    
    handoff.Status = "pending"
    
    // 保存交接记录
    ocm.handoffs = append(ocm.handoffs, handoff)
    
    log.Info("交接记录已创建",
        "handoff_id", handoff.ID,
        "from", handoff.FromUser,
        "to", handoff.ToUser)
    
    // 发送交接通知
    ocm.notifyHandoff(handoff)
    
    return nil
}

// 通知交接
func (ocm *OnCallManager) notifyHandoff(handoff *Handoff) {
    message := fmt.Sprintf(`值班交接通知

交接时间: %s
交接人: %s
接班人: %s

交接清单:
`,
        handoff.HandoffTime.Format("2006-01-02 15:04:05"),
        handoff.FromUser,
        handoff.ToUser,
    )
    
    for i, item := range handoff.Checklist {
        status := "[ ]"
        if item.Completed {
            status = "[✓]"
        }
        message += fmt.Sprintf("%d. %s %s\n", i+1, status, item.Item)
    }
    
    if handoff.Notes != "" {
        message += fmt.Sprintf("\n备注: %s\n", handoff.Notes)
    }
    
    // 发送通知给交接人和接班人
    // TODO: 发送通知
    _ = message
}

// 完成交接
func (ocm *OnCallManager) CompleteHandoff(handoffID string) error {
    var handoff *Handoff
    for _, h := range ocm.handoffs {
        if h.ID == handoffID {
            handoff = h
            break
        }
    }
    
    if handoff == nil {
        return fmt.Errorf("交接记录不存在: %s", handoffID)
    }
    
    // 检查清单是否全部完成
    allCompleted := true
    for _, item := range handoff.Checklist {
        if !item.Completed {
            allCompleted = false
            break
        }
    }
    
    if !allCompleted {
        return fmt.Errorf("交接清单未全部完成")
    }
    
    handoff.Status = "completed"
    
    log.Info("交接已完成", "handoff_id", handoffID)
    
    return nil
}

// 获取值班日历
func (ocm *OnCallManager) GetCalendar(scheduleID string, startDate, endDate time.Time) ([]CalendarEntry, error) {
    schedule, ok := ocm.schedules[scheduleID]
    if !ok {
        return nil, fmt.Errorf("值班计划不存在: %s", scheduleID)
    }
    
    var calendar []CalendarEntry
    
    // 按天遍历日期范围
    current := startDate
    for current.Before(endDate) || current.Equal(endDate) {
        // 获取当天的值班人员
        onCallUser, err := ocm.getOnCallAtTime(schedule, current)
        if err != nil {
            log.Warn("获取值班人员失败", "date", current, "error", err)
            current = current.AddDate(0, 0, 1)
            continue
        }
        
        entry := CalendarEntry{
            Date:     current,
            User:     onCallUser,
            Schedule: schedule.Name,
        }
        
        // 检查是否有临时调整
        if override := ocm.findActiveOverride(scheduleID, current); override != nil {
            entry.IsOverride = true
            entry.OverrideReason = override.Reason
        }
        
        calendar = append(calendar, entry)
        
        current = current.AddDate(0, 0, 1)
    }
    
    return calendar, nil
}

// 日历条目
type CalendarEntry struct {
    Date           time.Time
    User           string
    Schedule       string
    IsOverride     bool
    OverrideReason string
}

// 获取值班统计
func (ocm *OnCallManager) GetStatistics(startDate, endDate time.Time) (*OnCallStatistics, error) {
    stats := &OnCallStatistics{
        StartDate: startDate,
        EndDate:   endDate,
        UserStats: make(map[string]*UserStatistics),
    }
    
    // 统计每个用户的值班情况
    // TODO: 从告警历史中统计
    
    return stats, nil
}

// 值班统计
type OnCallStatistics struct {
    StartDate time.Time
    EndDate   time.Time
    UserStats map[string]*UserStatistics
}

// 用户统计
type UserStatistics struct {
    User              string
    OnCallDays        int     // 值班天数
    AlertsReceived    int     // 收到告警数
    AlertsAcknowledged int    // 确认告警数
    AlertsResolved    int     // 解决告警数
    AvgResponseTime   float64 // 平均响应时间（分钟）
    AvgResolutionTime float64 // 平均解决时间（分钟）
}

// 检查值班人员响应
func (ocm *OnCallManager) CheckResponse(alert *Alert, timeout time.Duration) error {
    // 等待值班人员响应
    ticker := time.NewTicker(30 * time.Second)
    defer ticker.Stop()
    
    deadline := time.Now().Add(timeout)
    
    for {
        select {
        case <-ticker.C:
            // 检查告警是否已被确认
            if alert.Status == "acknowledged" {
                log.Info("值班人员已响应", "alert_id", alert.ID)
                return nil
            }
            
            // 检查是否超时
            if time.Now().After(deadline) {
                log.Warn("值班人员响应超时", "alert_id", alert.ID, "timeout", timeout)
                
                // 升级到备用人员
                return ocm.escalateToBackup(alert)
            }
        }
    }
}

// 升级到备用人员
func (ocm *OnCallManager) escalateToBackup(alert *Alert) error {
    log.Info("升级到备用值班人员", "alert_id", alert.ID)
    
    // 获取备用人员
    scheduleID := alert.Labels["on_call_schedule"]
    if scheduleID == "" {
        scheduleID = "default"
    }
    
    schedule := ocm.schedules[scheduleID]
    if schedule == nil {
        return fmt.Errorf("值班计划不存在: %s", scheduleID)
    }
    
    // 查找备用人员
    var backupUser string
    if schedule.Type == "fixed" {
        now := time.Now()
        for _, shift := range schedule.FixedShifts {
            weekday := int(now.Weekday())
            currentTime := now.Format("15:04")
            
            // 检查是否匹配当前班次
            matched := false
            for _, day := range shift.DayOfWeek {
                if day == weekday {
                    matched = true
                    break
                }
            }
            
            if matched && currentTime >= shift.StartTime && currentTime < shift.EndTime {
                backupUser = shift.Backup
                break
            }
        }
    }
    
    if backupUser == "" {
        return fmt.Errorf("未找到备用值班人员")
    }
    
    // 发送升级通知
    log.Info("通知备用值班人员", "user", backupUser, "alert_id", alert.ID)
    
    // TODO: 发送通知
    
    return nil
}
```

**关键实现点**:

1. 支持多种排班模式（轮班、固定班次、按需排班），满足不同团队的需求
2. 实现自动值班路由，根据当前值班人员和告警级别智能分配
3. 支持临时调整和代班，灵活应对突发情况
4. 实现值班提醒机制，提前 1 小时通知值班人员
5. 提供完整的交接管理，包括交接清单和交接记录

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| on_call_schedules | array | [] | 值班计划列表 |
| rotations | array | [] | 轮班规则列表 |
| fixed_shifts | array | [] | 固定班次列表 |
| reminder_before_minutes | int | 60 | 提前提醒时间（分钟） |
| response_timeout_minutes | int | 10 | 响应超时时间（分钟） |
| enable_auto_escalation | bool | true | 是否启用自动升级 |
| handoff_checklist_template | array | [] | 交接清单模板 |
| calendar_timezone | string | "UTC" | 日历时区 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一次值班路由）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值和值班统计
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN 值班计划变更时，THE System SHALL 验证时间范围和人员列表的有效性
6. THE System SHALL 支持值班计划的导入和导出，便于团队间共享

---



### 模块四 API 接口汇总

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-4-102 | 获取告警规则列表 | Alert | GET | /api/v1/alert/rules | alert.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-4-103 | 创建告警规则 | Alert | POST | /api/v1/alert/rules | alert.write | Body: rule_config | {code:0,data:{id:"rule-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-4-104 | 更新告警规则 | Alert | PUT | /api/v1/alert/rules/{id} | alert.write | Body: rule_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-105 | 删除告警规则 | Alert | DELETE | /api/v1/alert/rules/{id} | alert.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-106 | 启用告警规则 | Alert | POST | /api/v1/alert/rules/{id}/enable | alert.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-107 | 禁用告警规则 | Alert | POST | /api/v1/alert/rules/{id}/disable | alert.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-108 | 获取告警列表 | Alert | GET | /api/v1/alert/list | alert.read | Query: time_range, severity, status | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-4-109 | 获取告警详情 | Alert | GET | /api/v1/alert/{id} | alert.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-4-110 | 确认告警 | Alert | POST | /api/v1/alert/{id}/acknowledge | alert.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-111 | 解决告警 | Alert | POST | /api/v1/alert/{id}/resolve | alert.write | Body: {resolution} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-112 | 获取告警历史 | Alert | GET | /api/v1/alert/history | alert.read | Query: time_range, page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-4-113 | 获取告警统计 | Alert | GET | /api/v1/alert/statistics | alert.read | Query: time_range, group_by | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-4-114 | 获取抑制规则列表 | Suppression | GET | /api/v1/suppression/rules | alert.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-4-115 | 创建抑制规则 | Suppression | POST | /api/v1/suppression/rules | alert.write | Body: rule_config | {code:0,data:{id:"sup-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-4-116 | 更新抑制规则 | Suppression | PUT | /api/v1/suppression/rules/{id} | alert.write | Body: rule_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-117 | 删除抑制规则 | Suppression | DELETE | /api/v1/suppression/rules/{id} | alert.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-118 | 获取静默规则列表 | Silence | GET | /api/v1/silence/list | alert.read | Query: status | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-4-119 | 创建静默规则 | Silence | POST | /api/v1/silence | alert.write | Body: silence_config | {code:0,data:{id:"sil-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-4-120 | 更新静默规则 | Silence | PUT | /api/v1/silence/{id} | alert.write | Body: silence_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-121 | 删除静默规则 | Silence | DELETE | /api/v1/silence/{id} | alert.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-122 | 获取当前生效的静默规则 | Silence | GET | /api/v1/silence/active | alert.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-4-123 | 获取抑制历史 | Suppression | GET | /api/v1/suppression/history | alert.read | Query: time_range | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-4-124 | 获取响应规则列表 | Response | GET | /api/v1/response/rules | response.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-4-125 | 创建响应规则 | Response | POST | /api/v1/response/rules | response.write | Body: rule_config | {code:0,data:{id:"resp-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-4-126 | 更新响应规则 | Response | PUT | /api/v1/response/rules/{id} | response.write | Body: rule_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-127 | 删除响应规则 | Response | DELETE | /api/v1/response/rules/{id} | response.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-128 | 获取可用动作列表 | Response | GET | /api/v1/response/actions | response.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-4-129 | 获取工作流列表 | Response | GET | /api/v1/response/workflows | response.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-4-130 | 创建工作流 | Response | POST | /api/v1/response/workflows | response.write | Body: workflow_config | {code:0,data:{id:"wf-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-4-131 | 获取响应历史 | Response | GET | /api/v1/response/history | response.read | Query: time_range | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-4-132 | 模拟执行响应 | Response | POST | /api/v1/response/dry-run | response.write | Body: {alert,rule_id} | {code:0,data:{...}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-4-133 | 回滚响应操作 | Response | POST | /api/v1/response/rollback/{id} | response.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-4-134 | 获取审批请求列表 | Approval | GET | /api/v1/approval/requests | approval.read | Query: status | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-4-135 | 批准审批请求 | Approval | POST | /api/v1/approval/{id}/approve | approval.write | Body: {comment} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-136 | 拒绝审批请求 | Approval | POST | /api/v1/approval/{id}/reject | approval.write | Body: {comment} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-137 | 获取值班计划列表 | OnCall | GET | /api/v1/oncall/schedules | oncall.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-4-138 | 创建值班计划 | OnCall | POST | /api/v1/oncall/schedules | oncall.write | Body: schedule_config | {code:0,data:{id:"sch-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-4-139 | 更新值班计划 | OnCall | PUT | /api/v1/oncall/schedules/{id} | oncall.write | Body: schedule_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-140 | 删除值班计划 | OnCall | DELETE | /api/v1/oncall/schedules/{id} | oncall.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-141 | 获取当前值班人员 | OnCall | GET | /api/v1/oncall/current | oncall.read | Query: schedule_id | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-4-142 | 获取值班日历 | OnCall | GET | /api/v1/oncall/calendar | oncall.read | Query: schedule_id, start_date, end_date | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-4-143 | 获取临时调整列表 | OnCall | GET | /api/v1/oncall/overrides | oncall.read | Query: schedule_id | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-4-144 | 创建临时调整 | OnCall | POST | /api/v1/oncall/overrides | oncall.write | Body: override_config | {code:0,data:{id:"ovr-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-4-145 | 删除临时调整 | OnCall | DELETE | /api/v1/oncall/overrides/{id} | oncall.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-146 | 获取交接记录列表 | OnCall | GET | /api/v1/oncall/handoffs | oncall.read | Query: schedule_id | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-4-147 | 创建交接记录 | OnCall | POST | /api/v1/oncall/handoffs | oncall.write | Body: handoff_config | {code:0,data:{id:"hnd-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-4-148 | 完成交接 | OnCall | POST | /api/v1/oncall/handoffs/{id}/complete | oncall.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-149 | 获取值班统计 | OnCall | GET | /api/v1/oncall/statistics | oncall.read | Query: start_date, end_date | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-4-150 | 获取通知渠道列表 | Notification | GET | /api/v1/notification/channels | notification.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-4-151 | 测试通知渠道 | Notification | POST | /api/v1/notification/channels/{name}/test | notification.write | Body: {test_message} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-4-152 | 触发配置热更新 | Alert | POST | /api/v1/alert/config/reload | alert.admin | Body: {component} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | 仅管理员 |
| API-4-153 | 健康检查 | Alert | GET | /api/v1/alert/health | 无 | 无 | {code:0,data:{status:"healthy"}} | 200/500 | v1 | 是 | 否 | - | 公开接口 |
| API-4-154 | 获取告警指标 | Alert | GET | /api/v1/alert/metrics | alert.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |

---




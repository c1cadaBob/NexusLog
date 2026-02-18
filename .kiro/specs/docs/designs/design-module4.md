# 模块四：告警与响应 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-01-31  
> **状态**: 已发布  
> **相关需求**: [requirements-module4.md](../requirements/requirements-module4.md)

---

## 1. 文档信息

### 1.1 版本历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-01-31 | 系统架构团队 | 初稿，完整设计方案 |

### 1.2 相关文档

- [需求文档](../requirements/requirements-module4.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)
- [模块3设计](./design-module3.md)

---

## 2. 总体架构

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    告警与响应模块架构                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  告警规则引擎 (Drools)                               │      │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │      │
│  │  │ 规则匹配    │  │ 阈值检测    │  │ 模式识别    │     │      │
│  │  │ (实时)     │  │ (统计)     │  │ (ML)       │     │      │
│  │  └────────────┘  └────────────┘  └────────────┘     │      │
│  └──────────────────────────────────────────────────────┘      │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  告警处理引擎                                         │      │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │      │
│  │  │ 告警聚合    │  │ 告警抑制    │  │ 告警静默    │     │      │
│  │  │ (去重)     │  │ (降噪)     │  │ (维护窗口)  │     │      │
│  │  └────────────┘  └────────────┘  └────────────┘     │      │
│  └──────────────────────────────────────────────────────┘      │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  通知分发引擎                                         │      │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │      │
│  │  │ 邮件通知    │  │ 短信通知    │  │ IM通知      │     │      │
│  │  │ (SMTP)     │  │ (阿里云)   │  │ (钉钉/微信)  │     │      │
│  │  └────────────┘  └────────────┘  └────────────┘     │      │
│  └──────────────────────────────────────────────────────┘      │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  自动响应引擎 (Temporal)                              │      │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │      │
│  │  │ 工作流执行  │  │ 脚本执行    │  │ API调用     │     │      │
│  │  │ (审批)     │  │ (自动修复)  │  │ (集成)     │     │      │
│  │  └────────────┘  └────────────┘  └────────────┘     │      │
│  └──────────────────────────────────────────────────────┘      │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  值班管理系统                                         │      │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │      │
│  │  │ 值班计划    │  │ 轮换管理    │  │ 升级策略    │     │      │
│  │  │ (排班)     │  │ (交接)     │  │ (逐级)     │     │      │
│  │  └────────────┘  └────────────┘  └────────────┘     │      │
│  └──────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分

| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| 规则引擎 | 告警规则匹配 | 实时匹配、阈值检测、模式识别 |
| 告警处理 | 告警降噪 | 聚合、抑制、静默、去重 |
| 通知分发 | 多渠道通知 | 邮件、短信、IM、电话、Webhook |
| 自动响应 | 自动化处理 | 工作流、脚本执行、API调用 |
| 值班管理 | 值班调度 | 排班、轮换、升级、交接 |

### 2.3 关键路径

```
事件触发 → 规则匹配(50ms) → 告警生成(10ms) → 告警处理(100ms)
  → 通知分发(500ms) → 自动响应(2s) → 状态更新
```

---

## 3. 技术选型

### 3.1 核心技术栈

| 技术 | 版本 | 选择理由 |
|------|------|----------|
| Drools | 8.x | 规则引擎、高性能、易扩展 |
| Temporal | 1.22+ | 工作流引擎、可靠性高 |
| Alertmanager | 0.26+ | 告警管理、成熟稳定 |
| Go | 1.21+ | 高性能、并发友好 |
| Redis | 7.2+ | 缓存、消息队列 |

### 3.2 通知渠道对比

| 渠道 | 延迟 | 成本 | 可靠性 | 适用场景 |
|------|------|------|--------|----------|
| 邮件 | 秒级 | 低 | 高 | 非紧急告警 |
| 短信 | 秒级 | 中 | 高 | 紧急告警 |
| 钉钉/企业微信 | 毫秒级 | 低 | 高 | 日常告警 |
| 电话 | 秒级 | 高 | 高 | 严重告警 |
| Webhook | 毫秒级 | 低 | 中 | 系统集成 |

---

## 4. 关键流程设计

### 4.1 告警生成流程

```
1. 分析引擎检测到异常事件
2. 触发告警规则引擎
3. 规则匹配(Drools):
   - 阈值规则: CPU > 80%
   - 模式规则: 连续3次失败
   - 复合规则: 多条件组合
4. 生成告警事件:
   - 告警ID
   - 告警级别(Critical/Warning/Info)
   - 告警内容
   - 关联日志
5. 写入告警队列(Redis)
6. 记录告警历史(ES)
```

### 4.2 告警处理流程

```
1. 从告警队列获取告警
2. 告警聚合:
   - 相同来源5分钟内聚合
   - 生成聚合告警
3. 告警抑制:
   - 检查抑制规则
   - 父告警抑制子告警
4. 告警静默:
   - 检查静默规则
   - 维护窗口内静默
5. 告警去重:
   - 检查是否重复
   - 更新计数器
6. 确定通知对象:
   - 查询值班计划
   - 获取当前值班人
7. 发送通知
```

### 4.3 自动响应流程

```
1. 告警触发自动响应规则
2. 检查是否需要审批:
   - 高风险操作需要审批
   - 低风险操作自动执行
3. 创建Temporal工作流:
   - 定义执行步骤
   - 设置超时时间
   - 配置重试策略
4. 执行响应动作:
   - 重启服务
   - 扩容资源
   - 执行脚本
   - 调用API
5. 验证执行结果
6. 更新告警状态
7. 记录执行日志
```

### 4.4 值班轮换流程

```
1. 定时任务检查值班计划
2. 判断是否需要轮换:
   - 到达轮换时间
   - 手动触发轮换
3. 生成交接记录:
   - 当前值班人
   - 下一值班人
   - 交接时间
   - 待处理告警
4. 发送交接通知
5. 更新值班状态
6. 记录交接历史
```

---

## 5. 接口设计

### 5.1 API列表

详见 [API设计文档](./api-design.md) 模块4部分，共53个接口:

- 告警规则管理: 增删改查、启用禁用
- 告警管理: 列表查询、详情、确认、解决
- 抑制规则管理: 增删改查
- 静默规则管理: 增删改查、当前生效
- 响应规则管理: 增删改查、可用动作、工作流
- 审批管理: 请求列表、批准、拒绝
- 值班管理: 计划管理、当前值班、日历、临时调整
- 通知渠道管理: 配置、测试、统计

### 5.2 Drools规则示例

```java
// 告警规则定义
rule "CPU使用率过高"
when
    $metric: Metric(name == "cpu_usage", value > 80)
    $count: Number(intValue >= 3) from accumulate(
        $m: Metric(name == "cpu_usage", value > 80) 
            over window:time(5m),
        count($m)
    )
then
    Alert alert = new Alert();
    alert.setLevel("CRITICAL");
    alert.setTitle("CPU使用率持续过高");
    alert.setMessage("CPU使用率连续5分钟超过80%");
    alert.setSource($metric.getSource());
    insert(alert);
end
```

### 5.3 Temporal工作流示例

```go
// 自动响应工作流
func AutoRestartWorkflow(ctx workflow.Context, alert *Alert) error {
    // 1. 检查是否需要审批
    if alert.RequiresApproval() {
        var approved bool
        err := workflow.ExecuteActivity(ctx, 
            RequestApproval, alert).Get(ctx, &approved)
        if err != nil || !approved {
            return err
        }
    }
    
    // 2. 执行重启操作
    var result string
    err := workflow.ExecuteActivity(ctx, 
        RestartService, alert.Service).Get(ctx, &result)
    if err != nil {
        return err
    }
    
    // 3. 验证服务状态
    err = workflow.ExecuteActivity(ctx, 
        VerifyServiceHealth, alert.Service).Get(ctx, nil)
    if err != nil {
        // 重启失败，发送告警
        workflow.ExecuteActivity(ctx, SendAlert, alert)
        return err
    }
    
    // 4. 更新告警状态
    workflow.ExecuteActivity(ctx, 
        UpdateAlertStatus, alert.ID, "RESOLVED")
    
    return nil
}
```

---

## 6. 数据设计

### 6.1 数据模型

```go
// 告警实体
type Alert struct {
    ID          string                 // 告警ID
    Level       string                 // 级别: CRITICAL/WARNING/INFO
    Title       string                 // 标题
    Message     string                 // 消息
    Source      string                 // 来源
    Labels      map[string]string      // 标签
    Annotations map[string]string      // 注释
    StartsAt    time.Time              // 开始时间
    EndsAt      *time.Time             // 结束时间
    Status      string                 // 状态: FIRING/RESOLVED
    Fingerprint string                 // 指纹(用于去重)
    GroupKey    string                 // 分组键(用于聚合)
}

// 告警规则
type AlertRule struct {
    ID          string                 // 规则ID
    Name        string                 // 规则名称
    Expr        string                 // 表达式
    Duration    time.Duration          // 持续时间
    Labels      map[string]string      // 标签
    Annotations map[string]string      // 注释
    Enabled     bool                   // 是否启用
}

// 值班计划
type OnCallSchedule struct {
    ID          string                 // 计划ID
    Name        string                 // 计划名称
    TimeZone    string                 // 时区
    Layers      []OnCallLayer          // 值班层级
    Overrides   []OnCallOverride       // 临时调整
}

// 值班层级
type OnCallLayer struct {
    Start       time.Time              // 开始时间
    End         time.Time              // 结束时间
    Users       []string               // 值班人员
    Rotation    string                 // 轮换方式: daily/weekly
}
```

### 6.2 数据库设计

**告警表 (alerts)**:

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(64) PK | 告警ID |
| level | VARCHAR(20) | 级别 |
| title | VARCHAR(255) | 标题 |
| message | TEXT | 消息 |
| source | VARCHAR(255) | 来源 |
| labels | JSONB | 标签 |
| status | VARCHAR(20) | 状态 |
| fingerprint | VARCHAR(64) | 指纹 |
| starts_at | TIMESTAMP | 开始时间 |
| ends_at | TIMESTAMP | 结束时间 |
| created_at | TIMESTAMP | 创建时间 |

**索引**:
- idx_alerts_status (status)
- idx_alerts_fingerprint (fingerprint)
- idx_alerts_starts_at (starts_at)

### 6.3 缓存设计

**Redis缓存**:

```
# 告警队列
alert:queue:pending -> List<AlertID>

# 告警去重
alert:dedup:{fingerprint} -> AlertID (TTL: 5min)

# 当前值班人
oncall:current:{schedule_id} -> UserID (TTL: 1h)

# 静默规则
silence:active -> Set<SilenceID>

# 通知限流
notify:ratelimit:{user_id} -> Counter (TTL: 1min)
```

---

## 7. 安全设计

### 7.1 告警安全

- 告警数据加密存储
- 敏感信息脱敏(密码、密钥)
- 告警访问权限控制
- 告警操作审计

### 7.2 自动响应安全

- 高风险操作需要审批
- 操作权限严格控制
- 操作日志完整记录
- 支持操作回滚

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 规则匹配延迟 | <50ms | Drools metrics |
| 告警生成延迟 | <100ms | 端到端监控 |
| 通知发送延迟 | <500ms | 通知渠道统计 |
| 自动响应延迟 | <2s | Temporal metrics |
| 告警吞吐量 | 10万条/秒 | 压测统计 |

### 8.2 优化策略

**规则引擎优化**:
- 规则预编译
- 规则缓存
- 并行匹配
- 索引优化

**告警处理优化**:
- 批量处理(100条/批)
- 异步处理
- 去重优化(布隆过滤器)
- 聚合窗口优化

**通知优化**:
- 通知合并(相同用户5分钟内合并)
- 通知限流(每用户每分钟最多10条)
- 异步发送
- 失败重试

---

## 9. 部署方案

### 9.1 部署架构

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alert-engine
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: alert-engine
        image: alert-engine:v1.0
        resources:
          requests:
            cpu: 2
            memory: 4Gi
          limits:
            cpu: 4
            memory: 8Gi
        env:
        - name: DROOLS_RULES_PATH
          value: /etc/rules
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: url
```

### 9.2 资源配置

| 组件 | 副本数 | CPU | 内存 | 存储 |
|------|--------|-----|------|------|
| Alert Engine | 3 | 2核 | 4GB | - |
| Temporal Server | 3 | 4核 | 8GB | - |
| Temporal Worker | 5 | 2核 | 4GB | - |
| Notification Service | 3 | 1核 | 2GB | - |

---

## 10. 监控与运维

### 10.1 监控指标

```
# 告警指标
alert_rules_total
alert_rules_matched_total
alert_generated_total{level="critical|warning|info"}
alert_processing_duration_seconds

# 通知指标
notification_sent_total{channel="email|sms|im",status="success|failed"}
notification_duration_seconds{channel="email|sms|im"}
notification_ratelimit_exceeded_total

# 响应指标
response_workflow_executed_total{status="success|failed"}
response_workflow_duration_seconds
response_approval_pending_total

# 值班指标
oncall_rotation_total
oncall_handoff_total
oncall_override_total
```

### 10.2 告警规则

| 告警 | 条件 | 级别 | 处理 |
|------|------|------|------|
| 告警处理延迟高 | >1s | Warning | 检查队列积压 |
| 通知发送失败率高 | >5% | Critical | 检查通知渠道 |
| 规则匹配失败 | 任意失败 | Warning | 检查规则语法 |
| 自动响应失败 | 连续3次 | Critical | 人工介入 |

---

## 11. 配置热更新详细设计

### 11.1 配置分层说明

模块4的配置分为三个层次，热更新支持情况如下：

**基础设施层（❌ 不支持热更新）**:
- Kubernetes部署配置（副本数、资源限制）
- Temporal Server配置（集群配置）
- Drools引擎配置（内存限制）
- 原因：需要重启服务，影响正在处理的告警

**连接层（⚠️ 不推荐热更新）**:
- Redis连接配置（地址、密码）
- PostgreSQL连接配置（连接池）
- SMTP服务器配置（邮件发送）
- 短信服务配置（阿里云API）
- 原因：需要重建连接池，可能导致告警丢失

**应用层（✅ 推荐热更新）**:
- 告警规则配置
- 抑制规则配置
- 静默规则配置
- 通知渠道配置
- 自动响应规则配置
- 值班计划配置
- 聚合窗口配置
- 通知限流配置
- 原因：不影响底层连接，可以平滑切换

### 11.2 可热更新配置项

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|---------|----------|---------------|
| alert_rules | array | [] | 告警规则列表 | Redis Pub/Sub | 下次规则匹配 | ✅ 推荐 |
| suppression_rules | array | [] | 抑制规则列表 | Redis Pub/Sub | 立即生效 | ✅ 推荐 |
| silence_rules | array | [] | 静默规则列表 | Redis Pub/Sub | 立即生效 | ✅ 推荐 |
| notification_channels | array | [] | 通知渠道配置 | Redis Pub/Sub | 下次通知 | ✅ 推荐 |
| aggregation_window | int | 300 | 聚合窗口(秒) | Redis Pub/Sub | 新窗口生效 | ✅ 推荐 |
| notification_ratelimit | int | 10 | 通知限流(条/分钟) | Redis Pub/Sub | 立即生效 | ✅ 推荐 |
| auto_response_enabled | bool | true | 是否启用自动响应 | Redis Pub/Sub | 立即生效 | ✅ 推荐 |
| response_rules | array | [] | 自动响应规则 | Redis Pub/Sub | 下次响应 | ✅ 推荐 |
| oncall_schedules | array | [] | 值班计划 | Redis Pub/Sub | 立即生效 | ✅ 推荐 |
| alert_templates | array | [] | 告警模板 | Redis Pub/Sub | 下次告警 | ✅ 推荐 |
| alertmanager_url | string | "" | Alertmanager地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重建HTTP客户端) |
| webhook_urls | array | [] | Webhook地址列表 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重建HTTP客户端) |
| smtp_host | string | "" | SMTP服务器地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重建SMTP连接) |
| kafka_brokers | array | [] | Kafka broker地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重建生产者) |

### 11.3 不可热更新配置项（需要重启）

**Kubernetes部署配置** (❌ 不支持热更新):

```yaml
# deploy/kubernetes/alert-engine-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alert-engine
spec:
  replicas: 3  # ❌ 不支持热更新，需要重启
  template:
    spec:
      containers:
      - name: alert-engine
        resources:
          requests:
            cpu: 2      # ❌ 不支持热更新，需要重启
            memory: 4Gi # ❌ 不支持热更新，需要重启
```

**原因**: 这些是Kubernetes资源配置，修改后需要重新部署Pod。

**连接配置** (⚠️ 不推荐热更新):

```yaml
# configs/alert-engine.yaml
redis:
  address: "redis:6379"     # ⚠️ 不推荐热更新，需要重建连接
  password: "secret"        # ⚠️ 不推荐热更新，需要重建连接
  db: 0                     # ⚠️ 不推荐热更新，需要重建连接

postgresql:
  host: "postgres"          # ⚠️ 不推荐热更新，需要重建连接池
  port: 5432                # ⚠️ 不推荐热更新，需要重建连接池
  database: "alerts"        # ⚠️ 不推荐热更新，需要重建连接池
  max_connections: 100      # ⚠️ 不推荐热更新，需要重建连接池

smtp:
  host: "smtp.example.com"  # ⚠️ 不推荐热更新，需要重建SMTP客户端
  port: 587                 # ⚠️ 不推荐热更新，需要重建SMTP客户端
```

**原因**: 修改连接配置需要重建连接池和客户端，可能导致告警丢失。建议通过滚动重启更新。

### 11.4 热更新实现

**配置管理器**:

```go
// internal/alert/config/manager.go
package config

import (
    "context"
    "encoding/json"
    "sync/atomic"
    "time"
)

// 告警引擎配置管理器
type AlertConfigManager struct {
    // 使用atomic.Value实现无锁读取
    alertRules        atomic.Value  // []AlertRule
    suppressionRules  atomic.Value  // []SuppressionRule
    silenceRules      atomic.Value  // []SilenceRule
    notificationChannels atomic.Value  // []NotificationChannel
    responseRules     atomic.Value  // []ResponseRule
    oncallSchedules   atomic.Value  // []OnCallSchedule
    alertTemplates    atomic.Value  // []AlertTemplate
    generalConfig     atomic.Value  // *GeneralConfig
    
    db     *PostgreSQL
    redis  *Redis
    pubsub *redis.PubSub
    drools *DroolsEngine
}

// 告警规则
type AlertRule struct {
    ID          string                 `json:"id"`
    Name        string                 `json:"name"`
    Enabled     bool                   `json:"enabled"`
    Expr        string                 `json:"expr"`
    Duration    string                 `json:"duration"`
    Labels      map[string]string      `json:"labels"`
    Annotations map[string]string      `json:"annotations"`
    Priority    int                    `json:"priority"`
    CreatedAt   time.Time              `json:"created_at"`
    UpdatedAt   time.Time              `json:"updated_at"`
}

// 抑制规则
type SuppressionRule struct {
    ID          string                 `json:"id"`
    Name        string                 `json:"name"`
    Enabled     bool                   `json:"enabled"`
    SourceMatch map[string]string      `json:"source_match"`
    TargetMatch map[string]string      `json:"target_match"`
    Equal       []string               `json:"equal"`
    CreatedAt   time.Time              `json:"created_at"`
    UpdatedAt   time.Time              `json:"updated_at"`
}

// 静默规则
type SilenceRule struct {
    ID          string                 `json:"id"`
    Matchers    []Matcher              `json:"matchers"`
    StartsAt    time.Time              `json:"starts_at"`
    EndsAt      time.Time              `json:"ends_at"`
    CreatedBy   string                 `json:"created_by"`
    Comment     string                 `json:"comment"`
    CreatedAt   time.Time              `json:"created_at"`
}

// 通知渠道
type NotificationChannel struct {
    ID          string                 `json:"id"`
    Name        string                 `json:"name"`
    Type        string                 `json:"type"`  // email/sms/webhook/dingtalk
    Enabled     bool                   `json:"enabled"`
    Config      map[string]interface{} `json:"config"`
    CreatedAt   time.Time              `json:"created_at"`
    UpdatedAt   time.Time              `json:"updated_at"`
}

// 自动响应规则
type ResponseRule struct {
    ID          string                 `json:"id"`
    Name        string                 `json:"name"`
    Enabled     bool                   `json:"enabled"`
    Trigger     string                 `json:"trigger"`
    Actions     []ResponseAction       `json:"actions"`
    RequiresApproval bool              `json:"requires_approval"`
    CreatedAt   time.Time              `json:"created_at"`
    UpdatedAt   time.Time              `json:"updated_at"`
}

// 值班计划
type OnCallSchedule struct {
    ID          string                 `json:"id"`
    Name        string                 `json:"name"`
    TimeZone    string                 `json:"time_zone"`
    Layers      []OnCallLayer          `json:"layers"`
    Overrides   []OnCallOverride       `json:"overrides"`
    CreatedAt   time.Time              `json:"created_at"`
    UpdatedAt   time.Time              `json:"updated_at"`
}

// 告警模板
type AlertTemplate struct {
    ID          string                 `json:"id"`
    Name        string                 `json:"name"`
    Type        string                 `json:"type"`  // email/sms/webhook
    Subject     string                 `json:"subject"`
    Body        string                 `json:"body"`
    CreatedAt   time.Time              `json:"created_at"`
    UpdatedAt   time.Time              `json:"updated_at"`
}

// 通用配置
type GeneralConfig struct {
    AggregationWindow      int  `json:"aggregation_window"`
    NotificationRatelimit  int  `json:"notification_ratelimit"`
    AutoResponseEnabled    bool `json:"auto_response_enabled"`
    UpdatedAt              time.Time `json:"updated_at"`
}

// 创建配置管理器
func NewAlertConfigManager(db *PostgreSQL, redis *Redis, drools *DroolsEngine) (*AlertConfigManager, error) {
    acm := &AlertConfigManager{
        db:     db,
        redis:  redis,
        drools: drools,
    }
    
    // 从数据库加载初始配置
    if err := acm.loadInitialConfig(); err != nil {
        return nil, err
    }
    
    // 订阅配置变更通知
    acm.pubsub = redis.Subscribe("config:alert:reload")
    
    return acm, nil
}

// 启动配置热更新监听
func (acm *AlertConfigManager) Start(ctx context.Context) error {
    go acm.watchConfigChanges(ctx)
    log.Info("告警引擎配置热更新监听已启动")
    return nil
}

// 监听配置变更
func (acm *AlertConfigManager) watchConfigChanges(ctx context.Context) {
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
func (acm *AlertConfigManager) handleConfigChange(msg *redis.Message) {
    log.Infof("收到告警配置变更通知: %s", msg.Payload)
    
    // 解析变更类型
    var change ConfigChange
    if err := json.Unmarshal([]byte(msg.Payload), &change); err != nil {
        log.Errorf("解析配置变更失败: %v", err)
        return
    }
    
    // 根据配置类型重新加载
    switch change.Type {
    case "alert_rules":
        acm.reloadAlertRules()
    case "suppression_rules":
        acm.reloadSuppressionRules()
    case "silence_rules":
        acm.reloadSilenceRules()
    case "notification_channels":
        acm.reloadNotificationChannels()
    case "response_rules":
        acm.reloadResponseRules()
    case "oncall_schedules":
        acm.reloadOnCallSchedules()
    case "alert_templates":
        acm.reloadAlertTemplates()
    case "general":
        acm.reloadGeneralConfig()
    case "all":
        acm.reloadAllConfig()
    }
}

// 重新加载告警规则
func (acm *AlertConfigManager) reloadAlertRules() {
    log.Info("开始重新加载告警规则")
    
    // 1. 从Redis加载规则
    rulesJSON, err := acm.redis.Get("config:alert:rules")
    if err != nil {
        log.Errorf("从Redis加载告警规则失败: %v", err)
        return
    }
    
    // 2. 解析规则
    var newRules []AlertRule
    if err := json.Unmarshal([]byte(rulesJSON), &newRules); err != nil {
        log.Errorf("解析告警规则失败: %v", err)
        return
    }
    
    // 3. 验证规则
    for _, rule := range newRules {
        if err := acm.validateAlertRule(&rule); err != nil {
            log.Errorf("告警规则验证失败: %v", err)
            return
        }
    }
    
    // 4. 编译Drools规则
    if err := acm.compileDroolsRules(newRules); err != nil {
        log.Errorf("编译Drools规则失败: %v", err)
        return
    }
    
    // 5. 原子更新规则
    acm.alertRules.Store(newRules)
    
    // 6. 记录审计日志
    acm.logConfigChange("alert_rules", newRules)
    
    log.Infof("告警规则重新加载完成，共%d条规则", len(newRules))
}

// 编译Drools规则
func (acm *AlertConfigManager) compileDroolsRules(rules []AlertRule) error {
    // 生成Drools规则文件
    var droolsRules string
    for _, rule := range rules {
        if !rule.Enabled {
            continue
        }
        
        droolsRules += fmt.Sprintf(`
rule "%s"
when
    %s
then
    Alert alert = new Alert();
    alert.setName("%s");
    alert.setLabels(%v);
    alert.setAnnotations(%v);
    insert(alert);
end
`, rule.Name, rule.Expr, rule.Name, rule.Labels, rule.Annotations)
    }
    
    // 编译规则
    if err := acm.drools.CompileRules(droolsRules); err != nil {
        return fmt.Errorf("编译Drools规则失败: %w", err)
    }
    
    return nil
}

// 验证告警规则
func (acm *AlertConfigManager) validateAlertRule(rule *AlertRule) error {
    if rule.Name == "" {
        return fmt.Errorf("规则名称不能为空")
    }
    
    if rule.Expr == "" {
        return fmt.Errorf("规则表达式不能为空")
    }
    
    if rule.Duration != "" {
        if _, err := time.ParseDuration(rule.Duration); err != nil {
            return fmt.Errorf("持续时间格式错误: %w", err)
        }
    }
    
    return nil
}

// 获取告警规则（无锁读取）
func (acm *AlertConfigManager) GetAlertRules() []AlertRule {
    rules := acm.alertRules.Load()
    if rules == nil {
        return []AlertRule{}
    }
    return rules.([]AlertRule)
}

// 获取抑制规则（无锁读取）
func (acm *AlertConfigManager) GetSuppressionRules() []SuppressionRule {
    rules := acm.suppressionRules.Load()
    if rules == nil {
        return []SuppressionRule{}
    }
    return rules.([]SuppressionRule)
}

// 获取静默规则（无锁读取）
func (acm *AlertConfigManager) GetSilenceRules() []SilenceRule {
    rules := acm.silenceRules.Load()
    if rules == nil {
        return []SilenceRule{}
    }
    return rules.([]SilenceRule)
}

// 获取通知渠道（无锁读取）
func (acm *AlertConfigManager) GetNotificationChannels() []NotificationChannel {
    channels := acm.notificationChannels.Load()
    if channels == nil {
        return []NotificationChannel{}
    }
    return channels.([]NotificationChannel)
}

// 获取自动响应规则（无锁读取）
func (acm *AlertConfigManager) GetResponseRules() []ResponseRule {
    rules := acm.responseRules.Load()
    if rules == nil {
        return []ResponseRule{}
    }
    return rules.([]ResponseRule)
}

// 获取值班计划（无锁读取）
func (acm *AlertConfigManager) GetOnCallSchedules() []OnCallSchedule {
    schedules := acm.oncallSchedules.Load()
    if schedules == nil {
        return []OnCallSchedule{}
    }
    return schedules.([]OnCallSchedule)
}

// 获取告警模板（无锁读取）
func (acm *AlertConfigManager) GetAlertTemplates() []AlertTemplate {
    templates := acm.alertTemplates.Load()
    if templates == nil {
        return []AlertTemplate{}
    }
    return templates.([]AlertTemplate)
}

// 获取通用配置（无锁读取）
func (acm *AlertConfigManager) GetGeneralConfig() *GeneralConfig {
    config := acm.generalConfig.Load()
    if config == nil {
        return &GeneralConfig{}
    }
    return config.(*GeneralConfig)
}

// 记录配置变更审计日志
func (acm *AlertConfigManager) logConfigChange(configType string, config interface{}) {
    auditLog := AuditLog{
        EventType:    "config_change",
        ResourceType: "alert_" + configType,
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
func (acm *AlertConfigManager) loadInitialConfig() error {
    // 加载告警规则
    alertRules, err := acm.db.GetAlertRules()
    if err != nil {
        return fmt.Errorf("加载告警规则失败: %w", err)
    }
    acm.alertRules.Store(alertRules)
    
    // 加载抑制规则
    suppressionRules, err := acm.db.GetSuppressionRules()
    if err != nil {
        return fmt.Errorf("加载抑制规则失败: %w", err)
    }
    acm.suppressionRules.Store(suppressionRules)
    
    // 加载静默规则
    silenceRules, err := acm.db.GetSilenceRules()
    if err != nil {
        return fmt.Errorf("加载静默规则失败: %w", err)
    }
    acm.silenceRules.Store(silenceRules)
    
    // 加载通知渠道
    notificationChannels, err := acm.db.GetNotificationChannels()
    if err != nil {
        return fmt.Errorf("加载通知渠道失败: %w", err)
    }
    acm.notificationChannels.Store(notificationChannels)
    
    // 加载自动响应规则
    responseRules, err := acm.db.GetResponseRules()
    if err != nil {
        return fmt.Errorf("加载自动响应规则失败: %w", err)
    }
    acm.responseRules.Store(responseRules)
    
    // 加载值班计划
    oncallSchedules, err := acm.db.GetOnCallSchedules()
    if err != nil {
        return fmt.Errorf("加载值班计划失败: %w", err)
    }
    acm.oncallSchedules.Store(oncallSchedules)
    
    // 加载告警模板
    alertTemplates, err := acm.db.GetAlertTemplates()
    if err != nil {
        return fmt.Errorf("加载告警模板失败: %w", err)
    }
    acm.alertTemplates.Store(alertTemplates)
    
    // 加载通用配置
    generalConfig, err := acm.db.GetGeneralConfig()
    if err != nil {
        return fmt.Errorf("加载通用配置失败: %w", err)
    }
    acm.generalConfig.Store(generalConfig)
    
    log.Info("初始配置加载完成")
    return nil
}

// 重新加载所有配置
func (acm *AlertConfigManager) reloadAllConfig() {
    log.Info("开始重新加载所有配置")
    
    acm.reloadAlertRules()
    acm.reloadSuppressionRules()
    acm.reloadSilenceRules()
    acm.reloadNotificationChannels()
    acm.reloadResponseRules()
    acm.reloadOnCallSchedules()
    acm.reloadAlertTemplates()
    acm.reloadGeneralConfig()
    
    log.Info("所有配置重新加载完成")
}
```

### 11.5 配置更新API

**更新告警规则**:

```http
POST /api/v1/alert/rules
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "CPU使用率过高",
  "enabled": true,
  "expr": "cpu_usage > 80",
  "duration": "5m",
  "labels": {
    "severity": "warning"
  },
  "annotations": {
    "summary": "CPU使用率持续过高"
  },
  "priority": 1
}

Response:
{
  "code": 0,
  "data": {
    "id": "rule-123456",
    "message": "告警规则已创建并生效"
  }
}
```

**更新通知渠道**:

```http
POST /api/v1/alert/notification-channels
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "钉钉通知",
  "type": "dingtalk",
  "enabled": true,
  "config": {
    "webhook_url": "https://oapi.dingtalk.com/robot/send?access_token=xxx",
    "secret": "xxx"
  }
}

Response:
{
  "code": 0,
  "data": {
    "id": "channel-123456",
    "message": "通知渠道已创建并生效"
  }
}
```

**更新值班计划**:

```http
POST /api/v1/alert/oncall-schedules
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "运维值班",
  "time_zone": "Asia/Shanghai",
  "layers": [
    {
      "start": "2026-02-01T00:00:00Z",
      "end": "2026-02-08T00:00:00Z",
      "users": ["user-001", "user-002"],
      "rotation": "daily"
    }
  ]
}

Response:
{
  "code": 0,
  "data": {
    "id": "schedule-123456",
    "message": "值班计划已创建并生效"
  }
}
```

### 11.6 YAML配置备用方案

当热更新机制不可用时，可以通过修改YAML配置文件并重启服务来更新配置：

```yaml
# configs/alert_rules.yaml
# ✅ 支持热更新，也可以通过YAML文件更新
alert_rules:
  - id: "rule-001"
    name: "CPU使用率过高"
    enabled: true
    expr: "cpu_usage > 80"
    duration: "5m"
    labels:
      severity: "warning"
    annotations:
      summary: "CPU使用率持续过高"
    priority: 1

# ✅ 支持热更新，也可以通过YAML文件更新
suppression_rules:
  - id: "suppression-001"
    name: "主机告警抑制服务告警"
    enabled: true
    source_match:
      alertname: "HostDown"
    target_match:
      alertname: "ServiceDown"
    equal: ["instance"]

# ✅ 支持热更新，也可以通过YAML文件更新
notification_channels:
  - id: "channel-001"
    name: "钉钉通知"
    type: "dingtalk"
    enabled: true
    config:
      webhook_url: "https://oapi.dingtalk.com/robot/send?access_token=xxx"

# ✅ 支持热更新，也可以通过YAML文件更新
general_config:
  aggregation_window: 300
  notification_ratelimit: 10
  auto_response_enabled: true
```

**更新流程**:
1. 修改YAML配置文件
2. 通过ConfigMap更新Kubernetes配置
3. 滚动重启服务
4. 新配置生效

```bash
# 更新ConfigMap
kubectl create configmap alert-config \
  --from-file=configs/alert_rules.yaml \
  --dry-run=client -o yaml | kubectl apply -f -

# 滚动重启服务
kubectl rollout restart deployment/alert-engine -n log-management
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
func (acm *AlertConfigManager) RegisterHook(hook ConfigHook) {
    acm.hooks = append(acm.hooks, hook)
}

// 规则验证器接口
type RuleValidator interface {
    // 验证规则
    Validate(rule *AlertRule) error
}

// 注册规则验证器
func (acm *AlertConfigManager) RegisterRuleValidator(validator RuleValidator) {
    acm.ruleValidators = append(acm.ruleValidators, validator)
}

// 通知渠道插件接口
type NotificationPlugin interface {
    // 发送通知
    Send(channel *NotificationChannel, alert *Alert) error
    
    // 验证配置
    ValidateConfig(config map[string]interface{}) error
}

// 注册通知渠道插件
func (acm *AlertConfigManager) RegisterNotificationPlugin(pluginType string, plugin NotificationPlugin) {
    acm.notificationPlugins[pluginType] = plugin
}
```

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 告警风暴 | 中 | 高 | 聚合、限流、静默 |
| 通知失败 | 中 | 高 | 多渠道、重试 |
| 误报 | 中 | 中 | 规则优化、反馈机制 |
| 自动响应失败 | 低 | 高 | 审批机制、回滚 |

### 12.2 回滚方案

**规则回滚**:
1. 检测到误报率>20%
2. 从PostgreSQL获取上一版本规则
3. 通过Redis Pub/Sub下发回滚通知
4. 自动应用旧规则
5. 验证回滚成功

**自动响应回滚**:
1. 检测到响应失败
2. 执行回滚脚本
3. 恢复原始状态
4. 发送回滚通知
5. 记录回滚日志

---

## 13. 附录

### 13.1 术语表

| 术语 | 说明 |
|------|------|
| Drools | 业务规则管理系统 |
| Temporal | 分布式工作流引擎 |
| Alertmanager | Prometheus告警管理器 |
| Fingerprint | 告警指纹，用于去重 |

### 13.2 参考文档

- [Drools文档](https://docs.drools.org/)
- [Temporal文档](https://docs.temporal.io/)
- [Alertmanager文档](https://prometheus.io/docs/alerting/latest/alertmanager/)

### 13.3 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-01-31 | v1.0 | 初稿，完整设计方案 | 系统架构团队 |

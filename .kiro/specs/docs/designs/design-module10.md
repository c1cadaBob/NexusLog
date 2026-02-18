# 模块10：性能与资源优化 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-01-31  
> **状态**: 已发布  
> **相关需求**: [requirements-module10.md](../requirements/requirements-module10.md)

---

## 1. 文档信息

### 1.1 版本历史
| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-01-31 | 系统架构团队 | 初稿，完整设计方案 |

### 1.2 相关文档
- [需求文档](../requirements/requirements-module10.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)

---

## 2. 总体架构

### 2.1 系统架构图

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

### 2.2 模块划分

| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| 自动扩缩容管理 | 动态资源调整 | HPA/VPA、策略管理、定时扩缩容、事件记录 |
| 资源监控管理 | 实时监控与预测 | 指标采集、趋势预测、告警管理、报告生成 |
| 查询优化管理 | 查询性能提升 | 查询缓存、慢查询检测、索引优化、并发控制 |
| 配置热更新 | 配置动态更新 | Redis Pub/Sub、配置验证、原子更新 |
| 告警与分析 | 智能告警与建议 | 告警路由、资源顾问、性能分析 |

### 2.3 关键路径

**自动扩缩容路径**:
```
指标采集(15s) → 指标聚合(5s) → 扩缩容决策(10s) → 执行扩缩容(120s) → 副本就绪
总延迟: < 2分钟
```

**资源监控路径**:
```
指标采集(15s) → 阈值检查(1s) → 告警发送(30s) → 通知送达
总延迟: < 50秒
```

**查询优化路径**:
```
查询请求 → 缓存检查(5ms) → 查询执行(500ms) → 结果返回
缓存命中: < 10ms
缓存未命中: < 500ms (P95)
```

---

## 3. 技术选型

### 3.1 核心技术栈

| 技术 | 版本 | 选择理由 |
|------|------|----------|
| Kubernetes HPA | 1.28+ | 原生水平自动扩展，支持多种指标 |
| Kubernetes VPA | 0.13+ | 垂直自动扩展，优化资源配置 |
| Prometheus | 2.48+ | 强大的指标采集与存储，生态完善 |
| Grafana | 10.2+ | 丰富的可视化组件，支持多数据源 |
| Redis | 7.2+ | 高性能缓存，支持Pub/Sub |
| PostgreSQL | 15+ | 配置持久化，支持JSONB |
| Go | 1.21+ | 高性能、并发友好 |
| pprof | - | Go原生性能剖析工具 |

### 3.2 扩缩容技术对比

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| Kubernetes HPA | 原生支持、稳定可靠、多指标 | 仅支持水平扩展 | ✅ 采用 |
| Kubernetes VPA | 自动优化资源配置 | 需要重启Pod | ✅ 采用 |
| KEDA | 支持更多事件源 | 额外组件、复杂度高 | ❌ 暂不采用 |
| 自研扩缩容 | 灵活可控 | 开发成本高、稳定性待验证 | ❌ 不采用 |

### 3.3 监控技术对比

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| Prometheus + Grafana | 生态完善、社区活跃 | 长期存储需要额外方案 | ✅ 采用 |
| InfluxDB + Chronograf | 时序数据库专用 | 社区较小 | ❌ 不采用 |
| Datadog | 功能强大、SaaS | 成本高、数据外传 | ❌ 不采用 |
| 自研监控 | 完全可控 | 开发成本极高 | ❌ 不采用 |

### 3.4 缓存技术对比

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| Redis | 高性能、功能丰富、支持Pub/Sub | 内存占用 | ✅ 采用 |
| Memcached | 简单高效 | 功能单一、无持久化 | ❌ 不采用 |
| 本地缓存 | 无网络开销 | 无法共享、容量受限 | ❌ 不采用 |

---

## 4. 关键流程设计

### 4.1 自动扩缩容主流程

**流程步骤**:

```
1. Metrics Server 每15秒采集一次指标（CPU、内存、自定义指标）
2. HPA Controller 获取当前指标值
3. 计算目标副本数 = ceil(当前副本数 * (当前指标值 / 目标指标值))
4. 应用扩缩容策略（保守/平衡/激进）
5. 检查冷却期（扩容3分钟、缩容5分钟）
6. 应用最小/最大副本数限制
7. 执行扩缩容操作
8. 记录扩缩容事件
9. 发送通知
```

**时序图**:

```
Metrics  HPA      K8s API  Pods    EventRecorder  Alertmanager
  │       │         │       │           │              │
  │──采集→│         │       │           │              │
  │       │─获取指标→│       │           │              │
  │       │←返回指标─│       │           │              │
  │       │─计算副本数       │           │              │
  │       │─检查冷却期       │           │              │
  │       │─更新副本→│       │           │              │
  │       │         │─创建Pod→          │              │
  │       │         │       │─启动→     │              │
  │       │         │       │←就绪─     │              │
  │       │─────────────────────记录事件→              │
  │       │─────────────────────────────发送告警→      │
```

### 4.2 资源监控主流程

**流程步骤**:

```
1. Prometheus 每15秒采集指标（Node Exporter、cAdvisor）
2. 指标聚合与计算（CPU、内存、磁盘、网络）
3. 检查告警阈值
4. 触发告警时发送通知（30秒内）
5. 更新趋势预测模型
6. 生成资源使用热力图
7. 资源顾问分析并生成优化建议
8. 每日9点生成资源使用报告
```

**时序图**:

```
Prometheus  Monitor  Predictor  Alertmanager  Advisor  ReportGen
    │          │         │            │          │         │
    │──采集指标→│         │            │          │         │
    │          │─检查阈值→            │          │         │
    │          │─────────发送告警→    │          │         │
    │          │─更新模型→            │          │         │
    │          │         │─预测趋势→  │          │         │
    │          │─────────────────────分析→       │         │
    │          │─────────────────────────生成建议→         │
    │          │─────────────────────────────────生成报告→ │
```

### 4.3 查询优化主流程

**流程步骤**:

```
1. 接收查询请求
2. 生成缓存键（查询内容 + 时间范围 + 过滤器）
3. 检查Redis缓存
4. 缓存命中：直接返回结果（< 10ms）
5. 缓存未命中：
   a. 获取并发执行权限（信号量）
   b. 分析查询计划
   c. 优化查询（索引使用、时间范围）
   d. 执行查询（超时30秒）
   e. 检测慢查询（> 5秒）
   f. 缓存结果（TTL 5分钟）
   g. 记录统计信息
   h. 索引顾问分析
6. 返回查询结果
```

**时序图**:

```
Client  Optimizer  Cache  Limiter  Executor  Detector  Advisor
  │        │        │       │         │         │        │
  │─查询→  │        │       │         │         │        │
  │        │─检查缓存→       │         │         │        │
  │        │←未命中─│       │         │         │        │
  │        │─获取权限→       │         │         │        │
  │        │←授权───│       │         │         │        │
  │        │─分析计划        │         │         │        │
  │        │─────────执行查询→         │         │        │
  │        │←────────返回结果─         │         │        │
  │        │─────────────────检测慢查询→         │        │
  │        │─────────────────────────索引分析→   │        │
  │        │─缓存结果→       │         │         │        │
  │←返回──│        │       │         │         │        │
```

### 4.4 配置热更新流程

**流程步骤**:

```
1. 用户通过API修改配置
2. 配置保存到PostgreSQL（版本化）
3. 配置同步到Redis
4. Redis发布Pub/Sub通知（config:module10:reload）
5. 各服务订阅通知
6. 从Redis加载新配置
7. 验证配置合法性
8. 使用atomic.Value原子更新配置
9. 记录审计日志
10. 下次操作时生效
```

**时序图**:

```
API  PostgreSQL  Redis  Service1  Service2  AuditLog
 │       │        │        │         │         │
 │─保存配置→      │        │         │         │
 │       │─同步→  │        │         │         │
 │       │        │─发布通知→        │         │
 │       │        │        │─订阅→   │         │
 │       │        │        │─加载配置→         │
 │       │        │        │─验证→   │         │
 │       │        │        │─原子更新│         │
 │       │        │        │─────────记录审计→ │
 │       │        │        │←生效───│         │
```

### 4.5 异常流程

| 异常类型 | 处理策略 | 恢复机制 |
|----------|----------|----------|
| 指标采集失败 | 使用上次有效值、记录告警 | 自动重试（指数退避） |
| 扩缩容失败 | 回滚操作、保持当前副本数 | 人工介入 |
| 缓存不可用 | 降级为直接查询 | 自动重连Redis |
| 查询超时 | 取消查询、返回超时错误 | 优化查询或增加资源 |
| 配置验证失败 | 保持原配置、记录错误 | 修正配置后重试 |
| 告警发送失败 | 重试3次、记录失败日志 | 检查告警通道配置 |

---

## 5. 接口设计

详见 [API设计文档](./api-design.md) 模块10部分

### 5.1 API列表概览

模块10共提供 **47个API接口**，分为以下类别：

**自动扩缩容管理** (10个接口):
- API-10-353: 获取扩缩容状态
- API-10-354: 配置扩缩容策略
- API-10-355: 获取扩缩容配置
- API-10-356: 手动触发扩容
- API-10-357: 手动触发缩容
- API-10-358: 获取扩缩容历史
- API-10-359: 获取扩缩容事件
- API-10-360: 获取分析报告
- API-10-361: 配置定时扩缩容
- API-10-362: 获取定时配置

**资源监控管理** (14个接口):
- API-10-363: 获取资源指标
- API-10-364: 获取历史指标
- API-10-365: 获取趋势预测
- API-10-366: 配置监控策略
- API-10-367: 获取监控配置
- API-10-368: 获取告警列表
- API-10-369: 配置告警阈值
- API-10-370: 获取每日报告
- API-10-371: 获取热力图数据
- API-10-372: 获取优化建议
- API-10-373: 添加自定义指标
- API-10-374: 删除自定义指标
- API-10-375: 获取性能指标
- API-10-376: 对比分析

**查询优化管理** (15个接口):
- API-10-377: 执行查询
- API-10-378: 获取查询结果
- API-10-379: 取消查询
- API-10-380: 获取查询计划
- API-10-381: 清除查询缓存
- API-10-382: 获取缓存统计
- API-10-383: 获取慢查询列表
- API-10-384: 获取查询统计
- API-10-385: 配置查询优化
- API-10-386: 获取优化配置
- API-10-387: 获取索引建议
- API-10-388: 创建索引
- API-10-389: 删除索引
- API-10-390: 获取性能报告
- API-10-391: 流式查询

**告警规则管理（支持热更新）** (8个接口):
- API-10-392: 创建告警规则
- API-10-393: 更新告警规则
- API-10-394: 删除告警规则
- API-10-395: 获取告警规则列表
- API-10-396: 获取单个告警规则
- API-10-397: 启用/禁用告警规则
- API-10-398: 验证告警规则表达式
- API-10-399: 获取告警规则历史版本

**告警规则管理（支持热更新）** (8个接口):
- API-10-392: 创建告警规则
- API-10-393: 更新告警规则
- API-10-394: 删除告警规则
- API-10-395: 获取告警规则列表
- API-10-396: 获取单个告警规则
- API-10-397: 启用/禁用告警规则
- API-10-398: 验证告警规则表达式
- API-10-399: 获取告警规则历史版本

### 5.2 核心接口示例

**配置扩缩容策略**:

```http
PUT /api/v1/autoscaling/config
Content-Type: application/json
Authorization: Bearer <token>

{
  "enabled": true,
  "strategy": "balanced",
  "min_replicas": 2,
  "max_replicas": 10,
  "scale_up_cooldown": 180,
  "scale_down_cooldown": 300,
  "metrics": [
    {
      "type": "cpu",
      "threshold": 70.0
    },
    {
      "type": "memory",
      "threshold": 75.0
    }
  ]
}
```

**获取资源指标**:

```http
GET /api/v1/monitoring/metrics?resource_type=cpu,memory
Authorization: Bearer <token>

Response:
{
  "code": 0,
  "data": {
    "cpu": {
      "usage_percent": 65.5,
      "cores": 8
    },
    "memory": {
      "usage_percent": 72.3,
      "used_bytes": 8589934592,
      "total_bytes": 17179869184
    }
  }
}
```

**执行查询**:

```http
POST /api/v1/query/execute
Content-Type: application/json
Authorization: Bearer <token>

{
  "query": "level:ERROR AND service:api-server",
  "time_range": {
    "start": "2026-01-31T00:00:00Z",
    "end": "2026-01-31T23:59:59Z"
  },
  "limit": 1000,
  "timeout": 30
}

Response:
{
  "code": 0,
  "data": {
    "query_id": "q-123456",
    "status": "running"
  }
}
```

**创建告警规则（热更新）**:

```http
POST /api/v1/monitoring/alert-rules
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "CustomHighMemory",
  "enabled": true,
  "expr": "node_memory_usage_percent > 90",
  "for": "5m",
  "labels": {
    "severity": "warning",
    "category": "custom",
    "team": "platform"
  },
  "annotations": {
    "summary": "自定义内存告警",
    "description": "节点 {{ $labels.node }} 内存使用率 {{ $value }}%",
    "runbook_url": "https://wiki.example.com/runbooks/custom-memory"
  },
  "category": "custom",
  "severity": "warning"
}

Response:
{
  "code": 0,
  "data": {
    "id": "rule-123456",
    "message": "告警规则已创建，Prometheus规则已重载"
  }
}
```

**更新告警规则（热更新）**:

```http
PUT /api/v1/monitoring/alert-rules/{rule_id}
Content-Type: application/json
Authorization: Bearer <token>

{
  "enabled": true,
  "expr": "node_memory_usage_percent > 95",
  "for": "10m"
}

Response:
{
  "code": 0,
  "message": "告警规则已更新，Prometheus规则已重载"
}
```

**获取告警规则列表**:

```http
GET /api/v1/monitoring/alert-rules?category=custom&enabled=true
Authorization: Bearer <token>

Response:
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "rule-123456",
        "name": "CustomHighMemory",
        "enabled": true,
        "expr": "node_memory_usage_percent > 95",
        "for": "10m",
        "labels": {
          "severity": "warning",
          "category": "custom"
        },
        "annotations": {
          "summary": "自定义内存告警"
        },
        "created_at": "2026-01-31T10:00:00Z",
        "updated_at": "2026-01-31T11:00:00Z"
      }
    ],
    "total": 1
  }
}
```

**验证告警规则表达式**:

```http
POST /api/v1/monitoring/alert-rules/validate
Content-Type: application/json
Authorization: Bearer <token>

{
  "expr": "node_memory_usage_percent > 95"
}

Response:
{
  "code": 0,
  "data": {
    "valid": true,
    "message": "表达式语法正确"
  }
}
```

---

## 6. 数据设计

### 6.1 数据模型

**扩缩容配置模型**:

```go
// 扩缩容配置
type AutoscalingConfig struct {
    ID                string                 `json:"id" db:"id"`
    Enabled           bool                   `json:"enabled" db:"enabled"`
    Strategy          ScalingStrategy        `json:"strategy" db:"strategy"`
    MinReplicas       int                    `json:"min_replicas" db:"min_replicas"`
    MaxReplicas       int                    `json:"max_replicas" db:"max_replicas"`
    ScaleUpCooldown   int                    `json:"scale_up_cooldown" db:"scale_up_cooldown"`
    ScaleDownCooldown int                    `json:"scale_down_cooldown" db:"scale_down_cooldown"`
    Metrics           []MetricSpec           `json:"metrics" db:"metrics"`
    Schedule          []ScheduleSpec         `json:"schedule" db:"schedule"`
    CreatedAt         time.Time              `json:"created_at" db:"created_at"`
    UpdatedAt         time.Time              `json:"updated_at" db:"updated_at"`
}

// 扩缩容事件
type ScalingEvent struct {
    ID          string                 `json:"id" db:"id"`
    Type        ScalingType            `json:"type" db:"type"`
    Reason      string                 `json:"reason" db:"reason"`
    OldReplicas int                    `json:"old_replicas" db:"old_replicas"`
    NewReplicas int                    `json:"new_replicas" db:"new_replicas"`
    Metrics     map[string]float64     `json:"metrics" db:"metrics"`
    Duration    time.Duration          `json:"duration" db:"duration"`
    Status      string                 `json:"status" db:"status"`
    CreatedAt   time.Time              `json:"created_at" db:"created_at"`
}
```

**监控配置模型**:

```go
// 监控配置
type MonitoringConfig struct {
    ID               string                 `json:"id" db:"id"`
    Enabled          bool                   `json:"enabled" db:"enabled"`
    CollectInterval  int                    `json:"collect_interval" db:"collect_interval"`
    AlertThresholds  map[string]float64     `json:"alert_thresholds" db:"alert_thresholds"`
    CustomMetrics    []CustomMetric         `json:"custom_metrics" db:"custom_metrics"`
    PredictionEnabled bool                  `json:"prediction_enabled" db:"prediction_enabled"`
    ReportSchedule   string                 `json:"report_schedule" db:"report_schedule"`
    CreatedAt        time.Time              `json:"created_at" db:"created_at"`
    UpdatedAt        time.Time              `json:"updated_at" db:"updated_at"`
}

// 资源指标
type ResourceMetrics struct {
    ID          string                 `json:"id" db:"id"`
    Timestamp   time.Time              `json:"timestamp" db:"timestamp"`
    CPU         CPUMetrics             `json:"cpu" db:"cpu"`
    Memory      MemoryMetrics          `json:"memory" db:"memory"`
    Disk        DiskMetrics            `json:"disk" db:"disk"`
    Network     NetworkMetrics         `json:"network" db:"network"`
    Performance PerformanceMetrics     `json:"performance" db:"performance"`
}
```

**查询优化模型**:

```go
// 查询优化配置
type OptimizerConfig struct {
    ID                 string                 `json:"id" db:"id"`
    CacheEnabled       bool                   `json:"cache_enabled" db:"cache_enabled"`
    CacheTTL           int                    `json:"cache_ttl" db:"cache_ttl"`
    SlowQueryThreshold int                    `json:"slow_query_threshold" db:"slow_query_threshold"`
    MaxConcurrency     int                    `json:"max_concurrency" db:"max_concurrency"`
    QueryTimeout       int                    `json:"query_timeout" db:"query_timeout"`
    PageSize           int                    `json:"page_size" db:"page_size"`
    AutoIndexEnabled   bool                   `json:"auto_index_enabled" db:"auto_index_enabled"`
    CreatedAt          time.Time              `json:"created_at" db:"created_at"`
    UpdatedAt          time.Time              `json:"updated_at" db:"updated_at"`
}

// 慢查询记录
type SlowQueryRecord struct {
    ID        string                 `json:"id" db:"id"`
    Query     string                 `json:"query" db:"query"`
    Duration  time.Duration          `json:"duration" db:"duration"`
    Plan      *QueryPlan             `json:"plan" db:"plan"`
    Timestamp time.Time              `json:"timestamp" db:"timestamp"`
}
```

### 6.2 数据库设计

**扩缩容配置表** (autoscaling_configs):

```sql
CREATE TABLE autoscaling_configs (
    id VARCHAR(64) PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT true,
    strategy VARCHAR(32) NOT NULL DEFAULT 'balanced',
    min_replicas INT NOT NULL DEFAULT 2,
    max_replicas INT NOT NULL DEFAULT 10,
    scale_up_cooldown INT NOT NULL DEFAULT 180,
    scale_down_cooldown INT NOT NULL DEFAULT 300,
    metrics JSONB NOT NULL DEFAULT '[]',
    schedule JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_autoscaling_configs_updated ON autoscaling_configs(updated_at);
```

**扩缩容事件表** (scaling_events):

```sql
CREATE TABLE scaling_events (
    id VARCHAR(64) PRIMARY KEY,
    type VARCHAR(32) NOT NULL,
    reason TEXT NOT NULL,
    old_replicas INT NOT NULL,
    new_replicas INT NOT NULL,
    metrics JSONB NOT NULL,
    duration BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'success',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scaling_events_created ON scaling_events(created_at DESC);
CREATE INDEX idx_scaling_events_type ON scaling_events(type);
```

**监控配置表** (monitoring_configs):

```sql
CREATE TABLE monitoring_configs (
    id VARCHAR(64) PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT true,
    collect_interval INT NOT NULL DEFAULT 15,
    alert_thresholds JSONB NOT NULL DEFAULT '{}',
    custom_metrics JSONB NOT NULL DEFAULT '[]',
    prediction_enabled BOOLEAN NOT NULL DEFAULT true,
    report_schedule VARCHAR(64) NOT NULL DEFAULT '0 9 * * *',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**慢查询记录表** (slow_queries):

```sql
CREATE TABLE slow_queries (
    id VARCHAR(64) PRIMARY KEY,
    query TEXT NOT NULL,
    duration BIGINT NOT NULL,
    plan JSONB,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_slow_queries_timestamp ON slow_queries(timestamp DESC);
CREATE INDEX idx_slow_queries_duration ON slow_queries(duration DESC);
```

**查询优化配置表** (query_optimizer_configs):

```sql
CREATE TABLE query_optimizer_configs (
    id VARCHAR(64) PRIMARY KEY,
    cache_enabled BOOLEAN NOT NULL DEFAULT true,
    cache_ttl INT NOT NULL DEFAULT 300,
    slow_query_threshold INT NOT NULL DEFAULT 5,
    max_concurrency INT NOT NULL DEFAULT 100,
    query_timeout INT NOT NULL DEFAULT 30,
    page_size INT NOT NULL DEFAULT 1000,
    auto_index_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**告警规则表** (alert_rules):

```sql
CREATE TABLE alert_rules (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    expr TEXT NOT NULL,
    for_duration VARCHAR(32),
    labels JSONB NOT NULL DEFAULT '{}',
    annotations JSONB NOT NULL DEFAULT '{}',
    category VARCHAR(64) NOT NULL DEFAULT 'custom',
    severity VARCHAR(32) NOT NULL DEFAULT 'warning',
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_severity CHECK (severity IN ('info', 'warning', 'critical'))
);

CREATE INDEX idx_alert_rules_category ON alert_rules(category);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);
CREATE INDEX idx_alert_rules_severity ON alert_rules(severity);
CREATE INDEX idx_alert_rules_created_by ON alert_rules(created_by);
CREATE INDEX idx_alert_rules_updated ON alert_rules(updated_at DESC);
```

**告警规则历史表** (alert_rule_history):

```sql
CREATE TABLE alert_rule_history (
    id SERIAL PRIMARY KEY,
    rule_id VARCHAR(64) NOT NULL,
    version INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    expr TEXT NOT NULL,
    for_duration VARCHAR(32),
    labels JSONB NOT NULL DEFAULT '{}',
    annotations JSONB NOT NULL DEFAULT '{}',
    changed_by VARCHAR(255) NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    change_type VARCHAR(32) NOT NULL,
    CONSTRAINT check_change_type CHECK (change_type IN ('create', 'update', 'delete'))
);

CREATE INDEX idx_alert_rule_history_rule_id ON alert_rule_history(rule_id);
CREATE INDEX idx_alert_rule_history_changed_at ON alert_rule_history(changed_at DESC);
```

### 6.3 缓存设计

**Redis缓存键设计**:

| 缓存键 | 类型 | TTL | 说明 |
|--------|------|-----|------|
| `config:autoscaling` | String | - | 扩缩容配置（持久化） |
| `config:monitoring` | String | - | 监控配置（持久化） |
| `config:query_optimizer` | String | - | 查询优化配置（持久化） |
| `config:alert_rules` | String | - | 告警规则配置（持久化） |
| `metrics:current` | Hash | 60s | 当前资源指标 |
| `metrics:history:{date}` | List | 7d | 历史指标数据 |
| `query:cache:{hash}` | String | 300s | 查询结果缓存 |
| `query:stats` | Hash | - | 查询统计信息 |
| `scaling:events` | List | 30d | 扩缩容事件列表 |
| `alerts:active` | Set | - | 活跃告警列表 |
| `alert:rules:version` | String | - | 告警规则版本号 |

**缓存更新策略**:

1. **配置缓存**: 写入时更新，通过Pub/Sub通知所有节点
2. **指标缓存**: 定时更新（15秒），过期自动删除
3. **查询缓存**: LRU淘汰，TTL过期自动删除
4. **事件缓存**: 定时归档到PostgreSQL，保留30天

### 6.4 索引设计

**Elasticsearch索引优化**:

```json
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "refresh_interval": "5s"
  },
  "mappings": {
    "properties": {
      "timestamp": {
        "type": "date",
        "format": "strict_date_optional_time||epoch_millis"
      },
      "level": {
        "type": "keyword"
      },
      "service": {
        "type": "keyword"
      },
      "message": {
        "type": "text",
        "analyzer": "standard"
      },
      "trace_id": {
        "type": "keyword"
      }
    }
  }
}
```

**常用查询字段索引**:
- `timestamp`: 时间范围查询
- `level`: 日志级别过滤
- `service`: 服务名称过滤
- `trace_id`: 链路追踪

---

## 7. 安全设计

### 7.1 认证授权

**API认证**:
- 使用JWT Token进行身份认证
- Token有效期: 24小时
- 支持Token刷新机制

**权限控制**:

| 权限范围 | 权限说明 | 适用角色 |
|---------|---------|---------|
| autoscaling.read | 查看扩缩容配置和状态 | 运维、开发 |
| autoscaling.write | 修改扩缩容配置、手动扩缩容 | 运维管理员 |
| monitoring.read | 查看监控指标和报告 | 所有用户 |
| monitoring.write | 修改监控配置、告警阈值 | 运维管理员 |
| query.read | 执行查询、查看结果 | 所有用户 |
| query.write | 取消查询 | 查询发起者 |
| query.admin | 清除缓存、创建索引 | 系统管理员 |

### 7.2 数据安全

**配置数据加密**:
- 敏感配置项（如告警Webhook URL）使用AES-256加密存储
- 加密密钥存储在Kubernetes Secret中
- 定期轮换加密密钥（每90天）

**传输安全**:
- 所有API通信使用HTTPS/TLS 1.3
- 内部服务间通信使用mTLS
- Redis连接使用TLS加密

**数据脱敏**:
- 日志中的敏感信息自动脱敏
- 查询结果中的个人信息按需脱敏
- 审计日志中的密码字段自动隐藏

### 7.3 审计日志

**审计事件**:

| 事件类型 | 记录内容 | 保留期限 |
|---------|---------|---------|
| 配置变更 | 操作人、变更前后值、时间戳 | 1年 |
| 手动扩缩容 | 操作人、副本数变化、原因 | 90天 |
| 告警配置修改 | 操作人、阈值变化、时间戳 | 1年 |
| 查询执行 | 用户、查询内容、执行时间 | 30天 |
| 索引创建/删除 | 操作人、索引名称、时间戳 | 1年 |

**审计日志格式**:

```json
{
  "event_id": "audit-123456",
  "event_type": "config_change",
  "user_id": "user-001",
  "user_name": "admin@example.com",
  "timestamp": "2026-01-31T10:30:00Z",
  "resource_type": "autoscaling_config",
  "resource_id": "config-001",
  "action": "update",
  "changes": {
    "max_replicas": {
      "old": 10,
      "new": 15
    }
  },
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0..."
}
```

### 7.4 安全加固

**API限流**:
- 每用户: 100请求/分钟
- 每IP: 1000请求/分钟
- 查询接口: 10并发/用户

**防护措施**:
- SQL注入防护: 使用参数化查询
- XSS防护: 输出转义
- CSRF防护: Token验证
- DDoS防护: 限流 + WAF

**安全审计**:
- 定期安全扫描（每周）
- 漏洞修复SLA: 高危24小时、中危7天
- 安全事件响应流程

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 扩容响应时间 | < 2分钟 | 从触发到副本就绪 |
| 缩容响应时间 | < 5分钟 | 包含数据排空时间 |
| 指标采集延迟 | < 15秒 | Prometheus采集周期 |
| 告警响应时间 | < 30秒 | 从触发到通知送达 |
| 查询缓存命中率 | >= 60% | Redis统计 |
| 热数据查询延迟 | < 500ms (P95) | 查询时间范围 <= 1小时 |
| 慢查询检测延迟 | < 5秒 | 实时检测 |
| 配置热更新生效时间 | < 30秒 | Redis Pub/Sub延迟 |
| 趋势预测准确率 | >= 85% | 与实际值对比 |
| 系统资源占用 | CPU < 10%, 内存 < 2GB | 监控模块自身 |

### 8.2 优化策略

**扩缩容优化**:

1. **指标聚合优化**
   - 使用滑动窗口平均值，避免瞬时波动
   - 多指标加权计算，综合决策
   - 预测性扩容，提前准备资源

2. **冷却期优化**
   - 扩容冷却期: 3分钟（避免频繁扩容）
   - 缩容冷却期: 5分钟（避免抖动）
   - 智能冷却期: 根据历史数据动态调整

3. **副本数计算优化**
   - 使用指数移动平均（EMA）平滑指标
   - 设置最大单次扩缩容比例（50%）
   - 分批扩缩容，降低影响

**监控优化**:

1. **指标采集优化**
   - 使用Prometheus联邦机制，分层采集
   - 高频指标（15秒）vs 低频指标（1分钟）
   - 指标降采样，减少存储压力

2. **趋势预测优化**
   - 使用ARIMA模型进行时序预测
   - 定期重训练模型（每天）
   - 异常值过滤，提高准确率

3. **报告生成优化**
   - 异步生成，不阻塞主流程
   - 增量计算，复用历史数据
   - 报告缓存，避免重复计算

**查询优化**:

1. **缓存优化**
   - LRU淘汰策略
   - 热点数据预加载
   - 缓存预热机制

2. **查询执行优化**
   - 查询改写，优化执行计划
   - 并行查询，提高吞吐量
   - 结果流式返回，降低内存占用

3. **索引优化**
   - 自动识别高频查询字段
   - 延迟索引创建（非高峰期）
   - 定期清理无用索引

### 8.3 容量规划

**扩缩容模块**:

| 组件 | 副本数 | CPU | 内存 | 说明 |
|------|--------|-----|------|------|
| HPA Controller | 2 | 0.5核 | 512MB | 高可用部署 |
| VPA Controller | 2 | 0.5核 | 512MB | 高可用部署 |
| Metrics Server | 2 | 1核 | 1GB | 指标聚合 |

**监控模块**:

| 组件 | 副本数 | CPU | 内存 | 存储 | 说明 |
|------|--------|-----|------|------|------|
| Prometheus | 2 | 4核 | 8GB | 500GB | 高可用部署 |
| Grafana | 2 | 2核 | 4GB | 10GB | 高可用部署 |
| Alertmanager | 3 | 0.5核 | 512MB | 10GB | 集群部署 |

**查询优化模块**:

| 组件 | 副本数 | CPU | 内存 | 说明 |
|------|--------|-----|------|------|
| Query Optimizer | 3 | 2核 | 4GB | 水平扩展 |
| Redis Cache | 3 | 2核 | 8GB | 集群模式 |

**容量增长预测**:

- 日志量增长: 每月20%
- 查询量增长: 每月15%
- 存储需求: 每月增加100GB
- 建议每季度评估容量，提前扩容

### 8.4 性能测试

**压力测试场景**:

1. **扩缩容压力测试**
   - 模拟高负载触发扩容
   - 验证扩容响应时间 < 2分钟
   - 验证缩容数据零丢失

2. **监控压力测试**
   - 模拟1000个指标并发采集
   - 验证采集延迟 < 15秒
   - 验证告警响应时间 < 30秒

3. **查询压力测试**
   - 模拟100并发查询
   - 验证P95延迟 < 500ms
   - 验证缓存命中率 >= 60%

**性能基准**:

```bash
# 扩缩容性能测试
kubectl scale deployment collector --replicas=10
# 预期: 120秒内完成

# 查询性能测试
ab -n 1000 -c 100 http://api-server/api/v1/query/execute
# 预期: P95 < 500ms

# 监控性能测试
curl http://prometheus:9090/api/v1/query?query=up
# 预期: 响应时间 < 100ms
```

---

## 9. 部署方案

### 9.1 部署架构

**Kubernetes部署架构**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Namespace: monitoring                              │   │
│  │  ┌──────────────┐  ┌──────────────┐                │   │
│  │  │ Prometheus   │  │  Grafana     │                │   │
│  │  │ StatefulSet  │  │  Deployment  │                │   │
│  │  │ (2 replicas) │  │  (2 replicas)│                │   │
│  │  └──────────────┘  └──────────────┘                │   │
│  │  ┌──────────────┐  ┌──────────────┐                │   │
│  │  │ Alertmanager │  │ Node Exporter│                │   │
│  │  │ StatefulSet  │  │  DaemonSet   │                │   │
│  │  │ (3 replicas) │  │              │                │   │
│  │  └──────────────┘  └──────────────┘                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Namespace: log-management                          │   │
│  │  ┌──────────────┐  ┌──────────────┐                │   │
│  │  │ HPA          │  │  VPA         │                │   │
│  │  │ (Autoscaler) │  │ (Autoscaler) │                │   │
│  │  └──────────────┘  └──────────────┘                │   │
│  │  ┌──────────────┐  ┌──────────────┐                │   │
│  │  │ Collector    │  │ API Server   │                │   │
│  │  │ Deployment   │  │ Deployment   │                │   │
│  │  │ (3-10 pods)  │  │ (2-8 pods)   │                │   │
│  │  └──────────────┘  └──────────────┘                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Namespace: data                                    │   │
│  │  ┌──────────────┐  ┌──────────────┐                │   │
│  │  │ PostgreSQL   │  │  Redis       │                │   │
│  │  │ StatefulSet  │  │  StatefulSet │                │   │
│  │  │ (3 replicas) │  │  (3 replicas)│                │   │
│  │  └──────────────┘  └──────────────┘                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 资源配置

**生产环境配置**:

| 组件 | 副本数 | CPU请求 | CPU限制 | 内存请求 | 内存限制 | 存储 |
|------|--------|---------|---------|----------|----------|------|
| Prometheus | 2 | 2核 | 4核 | 4GB | 8GB | 500GB |
| Grafana | 2 | 1核 | 2核 | 2GB | 4GB | 10GB |
| Alertmanager | 3 | 0.25核 | 0.5核 | 256MB | 512MB | 10GB |
| HPA Controller | 2 | 0.25核 | 0.5核 | 256MB | 512MB | - |
| VPA Controller | 2 | 0.25核 | 0.5核 | 256MB | 512MB | - |
| Metrics Server | 2 | 0.5核 | 1核 | 512MB | 1GB | - |
| Query Optimizer | 3 | 1核 | 2核 | 2GB | 4GB | - |
| Redis Cache | 3 | 1核 | 2核 | 4GB | 8GB | 50GB |

**测试环境配置**:

| 组件 | 副本数 | CPU | 内存 | 存储 |
|------|--------|-----|------|------|
| Prometheus | 1 | 1核 | 2GB | 100GB |
| Grafana | 1 | 0.5核 | 1GB | 5GB |
| Alertmanager | 1 | 0.25核 | 256MB | 5GB |
| 其他组件 | 1 | 0.5核 | 1GB | - |

### 9.3 Helm Chart配置

**values.yaml**:

```yaml
# 自动扩缩容配置
autoscaling:
  enabled: true
  hpa:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 75
  vpa:
    enabled: true
    updateMode: "Auto"

# 监控配置
monitoring:
  prometheus:
    enabled: true
    replicas: 2
    retention: 30d
    storage:
      size: 500Gi
      storageClass: fast-ssd
    resources:
      requests:
        cpu: 2
        memory: 4Gi
      limits:
        cpu: 4
        memory: 8Gi
  
  grafana:
    enabled: true
    replicas: 2
    adminPassword: <secret>
    resources:
      requests:
        cpu: 1
        memory: 2Gi
      limits:
        cpu: 2
        memory: 4Gi
  
  alertmanager:
    enabled: true
    replicas: 3
    config:
      receivers:
        - name: 'webhook'
          webhook_configs:
            - url: 'http://alert-receiver/webhook'

# 查询优化配置
queryOptimizer:
  enabled: true
  replicas: 3
  cache:
    enabled: true
    ttl: 300
  resources:
    requests:
      cpu: 1
      memory: 2Gi
    limits:
      cpu: 2
      memory: 4Gi

# Redis配置
redis:
  enabled: true
  cluster:
    enabled: true
    nodes: 3
  persistence:
    enabled: true
    size: 50Gi
  resources:
    requests:
      cpu: 1
      memory: 4Gi
    limits:
      cpu: 2
      memory: 8Gi
```

### 9.4 发布策略

**滚动更新策略**:

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1        # 最多额外创建1个Pod
    maxUnavailable: 0  # 更新期间保持所有Pod可用
```

**发布流程**:

1. **预发布检查**
   - 配置验证
   - 资源检查
   - 依赖服务健康检查

2. **灰度发布**
   - 先更新1个Pod
   - 观察5分钟
   - 无异常后继续

3. **全量发布**
   - 逐个更新剩余Pod
   - 每个Pod更新后等待就绪
   - 健康检查通过后继续

4. **发布验证**
   - 功能测试
   - 性能测试
   - 监控指标检查

5. **回滚准备**
   - 保留上一版本镜像
   - 准备回滚脚本
   - 设置回滚触发条件

### 9.5 部署命令

**安装部署**:

```bash
# 添加Helm仓库
helm repo add log-management https://charts.example.com/log-management
helm repo update

# 安装监控组件
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  -f values-prometheus.yaml

# 安装性能优化模块
helm install performance-optimizer log-management/performance-optimizer \
  --namespace log-management \
  -f values-production.yaml

# 验证部署
kubectl get pods -n monitoring
kubectl get pods -n log-management
```

**升级部署**:

```bash
# 升级配置
helm upgrade performance-optimizer log-management/performance-optimizer \
  --namespace log-management \
  -f values-production.yaml \
  --wait \
  --timeout 10m

# 查看升级状态
helm status performance-optimizer -n log-management
```

**回滚部署**:

```bash
# 查看历史版本
helm history performance-optimizer -n log-management

# 回滚到上一版本
helm rollback performance-optimizer -n log-management

# 回滚到指定版本
helm rollback performance-optimizer 3 -n log-management
```

---

## 10. 监控与运维

### 10.1 监控指标

**自动扩缩容指标**:

```prometheus
# 扩缩容事件总数
autoscaling_events_total{type="scale_up|scale_down"}

# 当前副本数
autoscaling_current_replicas{service="collector|api-server"}

# 目标副本数
autoscaling_desired_replicas{service="collector|api-server"}

# 扩缩容延迟（秒）
autoscaling_duration_seconds{type="scale_up|scale_down"}

# 扩缩容失败次数
autoscaling_failures_total{type="scale_up|scale_down"}

# 冷却期状态
autoscaling_cooldown_active{type="scale_up|scale_down"}
```

**资源监控指标**:

```prometheus
# CPU使用率
node_cpu_usage_percent{node="node-1"}

# 内存使用率
node_memory_usage_percent{node="node-1"}

# 磁盘使用率
node_disk_usage_percent{node="node-1",device="/dev/sda1"}

# 网络流量
node_network_receive_bytes_per_second{node="node-1",interface="eth0"}
node_network_transmit_bytes_per_second{node="node-1",interface="eth0"}

# 告警触发次数
monitoring_alerts_triggered_total{severity="warning|critical"}

# 趋势预测准确率
monitoring_prediction_accuracy_percent{metric="cpu|memory"}
```

**查询优化指标**:

```prometheus
# 查询总数
query_requests_total{status="success|error|timeout"}

# 查询延迟
query_duration_seconds{quantile="0.5|0.95|0.99"}

# 缓存命中率
query_cache_hit_rate_percent

# 慢查询数量
query_slow_queries_total

# 并发查询数
query_concurrent_requests

# 查询超时次数
query_timeouts_total

# 索引创建次数
query_index_created_total
```

### 10.2 告警规则（支持热更新）

**告警规则热更新机制**:

告警规则支持通过API动态更新，无需重启Prometheus：

1. 用户通过API创建/修改告警规则
2. 规则保存到PostgreSQL（版本化）
3. 规则同步到Redis
4. 告警管理器订阅Redis通知
5. 动态生成Prometheus规则文件
6. 通过Prometheus HTTP API重载规则（`POST /-/reload`）
7. 规则立即生效，无需重启

**内置告警规则**:

**扩缩容告警**:

```yaml
groups:
  - name: autoscaling
    interval: 30s
    rules:
      # 扩缩容失败告警
      - alert: AutoscalingFailed
        expr: rate(autoscaling_failures_total[5m]) > 0
        for: 1m
        labels:
          severity: critical
          category: autoscaling
        annotations:
          summary: "自动扩缩容失败"
          description: "{{ $labels.service }} 扩缩容失败，失败率: {{ $value }}"
          runbook_url: "https://wiki.example.com/runbooks/autoscaling-failed"
      
      # 副本数达到上限
      - alert: ReplicasAtMaximum
        expr: autoscaling_current_replicas >= autoscaling_max_replicas
        for: 5m
        labels:
          severity: warning
          category: autoscaling
        annotations:
          summary: "副本数达到上限"
          description: "{{ $labels.service }} 副本数已达到最大值 {{ $value }}"
          runbook_url: "https://wiki.example.com/runbooks/replicas-at-max"
      
      # 扩容延迟过长
      - alert: ScaleUpTooSlow
        expr: autoscaling_duration_seconds{type="scale_up"} > 180
        for: 1m
        labels:
          severity: warning
          category: autoscaling
        annotations:
          summary: "扩容响应时间过长"
          description: "扩容耗时 {{ $value }}秒，超过2分钟阈值"
          runbook_url: "https://wiki.example.com/runbooks/scale-up-slow"
```

**资源监控告警**:

```yaml
groups:
  - name: resource_monitoring
    interval: 15s
    rules:
      # CPU使用率过高
      - alert: HighCPUUsage
        expr: node_cpu_usage_percent > 80
        for: 5m
        labels:
          severity: warning
          category: resource
        annotations:
          summary: "CPU使用率过高"
          description: "节点 {{ $labels.node }} CPU使用率 {{ $value }}%"
          runbook_url: "https://wiki.example.com/runbooks/high-cpu"
      
      # 内存使用率过高
      - alert: HighMemoryUsage
        expr: node_memory_usage_percent > 85
        for: 5m
        labels:
          severity: warning
          category: resource
        annotations:
          summary: "内存使用率过高"
          description: "节点 {{ $labels.node }} 内存使用率 {{ $value }}%"
          runbook_url: "https://wiki.example.com/runbooks/high-memory"
      
      # 磁盘使用率过高
      - alert: HighDiskUsage
        expr: node_disk_usage_percent > 90
        for: 5m
        labels:
          severity: critical
          category: resource
        annotations:
          summary: "磁盘使用率过高"
          description: "节点 {{ $labels.node }} 磁盘使用率 {{ $value }}%"
          runbook_url: "https://wiki.example.com/runbooks/high-disk"
      
      # 趋势预测准确率低
      - alert: LowPredictionAccuracy
        expr: monitoring_prediction_accuracy_percent < 80
        for: 1h
        labels:
          severity: warning
          category: monitoring
        annotations:
          summary: "趋势预测准确率低"
          description: "{{ $labels.metric }} 预测准确率仅 {{ $value }}%"
          runbook_url: "https://wiki.example.com/runbooks/low-prediction"
```

**查询性能告警**:

```yaml
groups:
  - name: query_performance
    interval: 10s
    rules:
      # 查询延迟过高
      - alert: HighQueryLatency
        expr: query_duration_seconds{quantile="0.95"} > 0.5
        for: 5m
        labels:
          severity: warning
          category: query
        annotations:
          summary: "查询延迟过高"
          description: "P95查询延迟 {{ $value }}秒，超过500ms阈值"
          runbook_url: "https://wiki.example.com/runbooks/high-latency"
      
      # 缓存命中率低
      - alert: LowCacheHitRate
        expr: query_cache_hit_rate_percent < 50
        for: 10m
        labels:
          severity: warning
          category: query
        annotations:
          summary: "缓存命中率低"
          description: "缓存命中率仅 {{ $value }}%，低于60%目标"
          runbook_url: "https://wiki.example.com/runbooks/low-cache-hit"
      
      # 慢查询数量过多
      - alert: TooManySlowQueries
        expr: rate(query_slow_queries_total[5m]) > 10
        for: 5m
        labels:
          severity: warning
          category: query
        annotations:
          summary: "慢查询数量过多"
          description: "慢查询速率 {{ $value }}/秒"
          runbook_url: "https://wiki.example.com/runbooks/too-many-slow-queries"
      
      # 查询超时频繁
      - alert: FrequentQueryTimeouts
        expr: rate(query_timeouts_total[5m]) > 1
        for: 5m
        labels:
          severity: critical
          category: query
        annotations:
          summary: "查询超时频繁"
          description: "查询超时速率 {{ $value }}/秒"
          runbook_url: "https://wiki.example.com/runbooks/query-timeouts"
```

**自定义告警规则管理**:

```go
// internal/performance/alerting/rule_manager.go
package alerting

import (
    "context"
    "encoding/json"
    "fmt"
    "os"
    "sync"
    "time"
)

// 告警规则管理器
type AlertRuleManager struct {
    config         *AlertConfig
    db             *PostgreSQL
    redis          *Redis
    prometheus     *PrometheusClient
    ruleFile       string
    mu             sync.RWMutex
    rules          map[string]*AlertRule
}

// 告警规则
type AlertRule struct {
    ID          string            `json:"id" db:"id"`
    Name        string            `json:"name" db:"name"`
    Enabled     bool              `json:"enabled" db:"enabled"`
    Expr        string            `json:"expr" db:"expr"`
    For         string            `json:"for" db:"for"`
    Labels      map[string]string `json:"labels" db:"labels"`
    Annotations map[string]string `json:"annotations" db:"annotations"`
    Category    string            `json:"category" db:"category"`
    Severity    string            `json:"severity" db:"severity"`
    CreatedBy   string            `json:"created_by" db:"created_by"`
    CreatedAt   time.Time         `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time         `json:"updated_at" db:"updated_at"`
}

// 创建告警规则管理器
func NewAlertRuleManager(config *AlertConfig, db *PostgreSQL, redis *Redis, prometheus *PrometheusClient) (*AlertRuleManager, error) {
    arm := &AlertRuleManager{
        config:     config,
        db:         db,
        redis:      redis,
        prometheus: prometheus,
        ruleFile:   "/etc/prometheus/rules/custom_rules.yml",
        rules:      make(map[string]*AlertRule),
    }
    
    // 从数据库加载规则
    if err := arm.loadRulesFromDB(); err != nil {
        return nil, err
    }
    
    return arm, nil
}

// 启动规则管理器
func (arm *AlertRuleManager) Start(ctx context.Context) error {
    // 订阅规则变更通知
    pubsub := arm.redis.Subscribe("alert:rules:reload")
    
    go func() {
        for {
            select {
            case <-ctx.Done():
                return
            case msg := <-pubsub.Channel():
                arm.handleRuleChange(msg)
            }
        }
    }()
    
    log.Info("告警规则管理器已启动")
    return nil
}

// 创建告警规则
func (arm *AlertRuleManager) CreateRule(rule *AlertRule) error {
    arm.mu.Lock()
    defer arm.mu.Unlock()
    
    // 1. 验证规则
    if err := arm.validateRule(rule); err != nil {
        return fmt.Errorf("规则验证失败: %w", err)
    }
    
    // 2. 生成规则ID
    rule.ID = fmt.Sprintf("rule-%d", time.Now().UnixNano())
    rule.CreatedAt = time.Now()
    rule.UpdatedAt = time.Now()
    
    // 3. 保存到数据库
    if err := arm.db.SaveAlertRule(rule); err != nil {
        return fmt.Errorf("保存规则失败: %w", err)
    }
    
    // 4. 更新内存缓存
    arm.rules[rule.ID] = rule
    
    // 5. 重新生成规则文件
    if err := arm.generateRuleFile(); err != nil {
        return fmt.Errorf("生成规则文件失败: %w", err)
    }
    
    // 6. 重载Prometheus规则
    if err := arm.reloadPrometheusRules(); err != nil {
        return fmt.Errorf("重载Prometheus规则失败: %w", err)
    }
    
    // 7. 发布变更通知
    arm.redis.Publish("alert:rules:reload", rule.ID)
    
    log.Infof("告警规则已创建: %s", rule.Name)
    return nil
}

// 更新告警规则
func (arm *AlertRuleManager) UpdateRule(ruleID string, updates *AlertRule) error {
    arm.mu.Lock()
    defer arm.mu.Unlock()
    
    // 1. 检查规则是否存在
    existing, ok := arm.rules[ruleID]
    if !ok {
        return fmt.Errorf("规则不存在: %s", ruleID)
    }
    
    // 2. 验证更新
    if err := arm.validateRule(updates); err != nil {
        return fmt.Errorf("规则验证失败: %w", err)
    }
    
    // 3. 合并更新
    updates.ID = ruleID
    updates.CreatedAt = existing.CreatedAt
    updates.CreatedBy = existing.CreatedBy
    updates.UpdatedAt = time.Now()
    
    // 4. 保存到数据库
    if err := arm.db.UpdateAlertRule(updates); err != nil {
        return fmt.Errorf("更新规则失败: %w", err)
    }
    
    // 5. 更新内存缓存
    arm.rules[ruleID] = updates
    
    // 6. 重新生成规则文件
    if err := arm.generateRuleFile(); err != nil {
        return fmt.Errorf("生成规则文件失败: %w", err)
    }
    
    // 7. 重载Prometheus规则
    if err := arm.reloadPrometheusRules(); err != nil {
        return fmt.Errorf("重载Prometheus规则失败: %w", err)
    }
    
    // 8. 发布变更通知
    arm.redis.Publish("alert:rules:reload", ruleID)
    
    log.Infof("告警规则已更新: %s", updates.Name)
    return nil
}

// 删除告警规则
func (arm *AlertRuleManager) DeleteRule(ruleID string) error {
    arm.mu.Lock()
    defer arm.mu.Unlock()
    
    // 1. 检查规则是否存在
    if _, ok := arm.rules[ruleID]; !ok {
        return fmt.Errorf("规则不存在: %s", ruleID)
    }
    
    // 2. 从数据库删除
    if err := arm.db.DeleteAlertRule(ruleID); err != nil {
        return fmt.Errorf("删除规则失败: %w", err)
    }
    
    // 3. 从内存删除
    delete(arm.rules, ruleID)
    
    // 4. 重新生成规则文件
    if err := arm.generateRuleFile(); err != nil {
        return fmt.Errorf("生成规则文件失败: %w", err)
    }
    
    // 5. 重载Prometheus规则
    if err := arm.reloadPrometheusRules(); err != nil {
        return fmt.Errorf("重载Prometheus规则失败: %w", err)
    }
    
    // 6. 发布变更通知
    arm.redis.Publish("alert:rules:reload", ruleID)
    
    log.Infof("告警规则已删除: %s", ruleID)
    return nil
}

// 验证告警规则
func (arm *AlertRuleManager) validateRule(rule *AlertRule) error {
    // 验证名称
    if rule.Name == "" {
        return fmt.Errorf("规则名称不能为空")
    }
    
    // 验证表达式
    if rule.Expr == "" {
        return fmt.Errorf("规则表达式不能为空")
    }
    
    // 验证表达式语法（通过Prometheus API）
    if err := arm.prometheus.ValidateExpr(rule.Expr); err != nil {
        return fmt.Errorf("表达式语法错误: %w", err)
    }
    
    // 验证持续时间
    if rule.For != "" {
        if _, err := time.ParseDuration(rule.For); err != nil {
            return fmt.Errorf("持续时间格式错误: %w", err)
        }
    }
    
    // 验证严重级别
    validSeverities := map[string]bool{
        "info":     true,
        "warning":  true,
        "critical": true,
    }
    if !validSeverities[rule.Severity] {
        return fmt.Errorf("无效的严重级别: %s", rule.Severity)
    }
    
    return nil
}

// 生成Prometheus规则文件
func (arm *AlertRuleManager) generateRuleFile() error {
    // 按类别分组规则
    groups := make(map[string][]*AlertRule)
    
    for _, rule := range arm.rules {
        if !rule.Enabled {
            continue
        }
        
        category := rule.Category
        if category == "" {
            category = "custom"
        }
        
        groups[category] = append(groups[category], rule)
    }
    
    // 生成YAML格式
    var yamlContent string
    yamlContent += "groups:\n"
    
    for category, rules := range groups {
        yamlContent += fmt.Sprintf("  - name: %s\n", category)
        yamlContent += "    interval: 30s\n"
        yamlContent += "    rules:\n"
        
        for _, rule := range rules {
            yamlContent += fmt.Sprintf("      - alert: %s\n", rule.Name)
            yamlContent += fmt.Sprintf("        expr: %s\n", rule.Expr)
            
            if rule.For != "" {
                yamlContent += fmt.Sprintf("        for: %s\n", rule.For)
            }
            
            if len(rule.Labels) > 0 {
                yamlContent += "        labels:\n"
                for k, v := range rule.Labels {
                    yamlContent += fmt.Sprintf("          %s: %s\n", k, v)
                }
            }
            
            if len(rule.Annotations) > 0 {
                yamlContent += "        annotations:\n"
                for k, v := range rule.Annotations {
                    yamlContent += fmt.Sprintf("          %s: \"%s\"\n", k, v)
                }
            }
        }
    }
    
    // 写入文件
    if err := os.WriteFile(arm.ruleFile, []byte(yamlContent), 0644); err != nil {
        return fmt.Errorf("写入规则文件失败: %w", err)
    }
    
    log.Infof("规则文件已生成: %s", arm.ruleFile)
    return nil
}

// 重载Prometheus规则
func (arm *AlertRuleManager) reloadPrometheusRules() error {
    // 调用Prometheus HTTP API重载规则
    if err := arm.prometheus.Reload(); err != nil {
        return fmt.Errorf("重载失败: %w", err)
    }
    
    log.Info("Prometheus规则已重载")
    return nil
}

// 处理规则变更
func (arm *AlertRuleManager) handleRuleChange(msg *redis.Message) {
    log.Infof("收到规则变更通知: %s", msg.Payload)
    
    // 从数据库重新加载规则
    if err := arm.loadRulesFromDB(); err != nil {
        log.Errorf("重新加载规则失败: %v", err)
        return
    }
    
    // 重新生成规则文件
    if err := arm.generateRuleFile(); err != nil {
        log.Errorf("生成规则文件失败: %v", err)
        return
    }
    
    log.Info("规则已重新加载")
}

// 从数据库加载规则
func (arm *AlertRuleManager) loadRulesFromDB() error {
    rules, err := arm.db.GetAllAlertRules()
    if err != nil {
        return err
    }
    
    arm.mu.Lock()
    defer arm.mu.Unlock()
    
    arm.rules = make(map[string]*AlertRule)
    for _, rule := range rules {
        arm.rules[rule.ID] = rule
    }
    
    return nil
}

// 获取所有规则
func (arm *AlertRuleManager) GetAllRules() []*AlertRule {
    arm.mu.RLock()
    defer arm.mu.RUnlock()
    
    rules := make([]*AlertRule, 0, len(arm.rules))
    for _, rule := range arm.rules {
        rules = append(rules, rule)
    }
    
    return rules
}

// 获取单个规则
func (arm *AlertRuleManager) GetRule(ruleID string) (*AlertRule, error) {
    arm.mu.RLock()
    defer arm.mu.RUnlock()
    
    rule, ok := arm.rules[ruleID]
    if !ok {
        return nil, fmt.Errorf("规则不存在: %s", ruleID)
    }
    
    return rule, nil
}
```

### 10.3 日志规范

**日志级别**:

| 级别 | 使用场景 | 示例 |
|------|---------|------|
| DEBUG | 详细调试信息 | "计算目标副本数: current=3, target=5" |
| INFO | 正常操作信息 | "扩容完成: 3 -> 5 副本" |
| WARN | 警告信息 | "缓存命中率低: 45%" |
| ERROR | 错误信息 | "扩缩容失败: 连接超时" |
| FATAL | 致命错误 | "配置加载失败，服务退出" |

**日志格式**:

```json
{
  "timestamp": "2026-01-31T10:30:00.123Z",
  "level": "INFO",
  "module": "autoscaling",
  "message": "扩容完成",
  "context": {
    "service": "collector",
    "old_replicas": 3,
    "new_replicas": 5,
    "duration_ms": 118000,
    "reason": "cpu_high"
  },
  "trace_id": "trace-123456"
}
```

### 10.4 运维手册

**日常运维任务**:

1. **每日检查**
   - 查看扩缩容事件
   - 检查告警列表
   - 查看资源使用趋势
   - 检查慢查询列表

2. **每周检查**
   - 审查扩缩容策略
   - 分析资源使用报告
   - 优化查询性能
   - 清理过期数据

3. **每月检查**
   - 容量规划评估
   - 成本分析
   - 性能基准测试
   - 安全审计

**常见问题处理**:

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 扩容失败 | 资源不足 | 增加节点或调整资源配额 |
| 缩容失败 | 数据未排空 | 检查缓冲区，延长排空时间 |
| 告警风暴 | 阈值设置不当 | 调整告警阈值或聚合规则 |
| 查询超时 | 查询范围过大 | 优化查询条件或增加索引 |
| 缓存命中率低 | TTL设置过短 | 调整缓存TTL或预热策略 |
| 趋势预测不准 | 模型过时 | 重新训练预测模型 |

**应急响应流程**:

1. **P0级故障（服务不可用）**
   - 响应时间: 5分钟内
   - 处理流程: 立即回滚 → 恢复服务 → 分析原因
   - 通知: 所有相关人员

2. **P1级故障（功能受损）**
   - 响应时间: 30分钟内
   - 处理流程: 评估影响 → 临时方案 → 根本修复
   - 通知: 运维团队

3. **P2级故障（性能下降）**
   - 响应时间: 2小时内
   - 处理流程: 分析原因 → 优化配置 → 验证效果
   - 通知: 值班人员

**备份与恢复**:

```bash
# 备份配置
kubectl get configmap -n log-management -o yaml > configs-backup.yaml
kubectl get secret -n log-management -o yaml > secrets-backup.yaml

# 备份Prometheus数据
kubectl exec -n monitoring prometheus-0 -- tar czf /tmp/prometheus-data.tar.gz /prometheus

# 恢复配置
kubectl apply -f configs-backup.yaml
kubectl apply -f secrets-backup.yaml

# 恢复Prometheus数据
kubectl cp /tmp/prometheus-data.tar.gz monitoring/prometheus-0:/tmp/
kubectl exec -n monitoring prometheus-0 -- tar xzf /tmp/prometheus-data.tar.gz -C /
```

---

## 11. 配置热更新详细设计

### 11.1 配置分层说明

```
┌─────────────────────────────────────────────────────────────┐
│  基础设施层 (Kubernetes HPA + Prometheus)                    │
│  ❌ 不支持热更新，需要 kubectl apply + 滚动重启              │
│  - HPA配置、Prometheus服务器配置、资源限制                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  连接层 (基础服务连接)                                       │
│  ⚠️ 不推荐热更新，建议通过YAML文件更新并重启服务             │
│  - PostgreSQL连接、Redis连接、Prometheus连接                │
│  原因：需要重建连接池，可能导致监控数据丢失                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  应用层 (业务配置)                                           │
│  ✅ 推荐热更新，通过Redis Pub/Sub立即生效                    │
│  - 扩缩容策略、监控阈值、查询优化、告警规则                  │
└─────────────────────────────────────────────────────────────┘
```

### 11.2 可热更新配置项

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|----------|----------|---------------|
| **自动扩缩容配置** |
| autoscaling_enabled | bool | true | 是否启用自动扩缩容 | Redis Pub/Sub | 下次决策周期 | ✅ 推荐 |
| strategy | string | "balanced" | 扩缩容策略 | Redis Pub/Sub | 下次决策周期 | ✅ 推荐 |
| scale_up_cooldown | int | 180 | 扩容冷却期(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| scale_down_cooldown | int | 300 | 缩容冷却期(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| cpu_threshold | float | 70.0 | CPU阈值(%) | Redis Pub/Sub | 下次决策周期 | ✅ 推荐 |
| memory_threshold | float | 75.0 | 内存阈值(%) | Redis Pub/Sub | 下次决策周期 | ✅ 推荐 |
| throughput_threshold | int | 50000 | 吞吐量阈值(条/秒) | Redis Pub/Sub | 下次决策周期 | ✅ 推荐 |
| schedule_enabled | bool | false | 是否启用定时扩缩容 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| **资源监控配置** |
| monitoring_enabled | bool | true | 是否启用资源监控 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| collect_interval | int | 15 | 指标采集间隔(秒) | Redis Pub/Sub | 下次采集周期 | ✅ 推荐 |
| alert_cpu_threshold | float | 80.0 | CPU告警阈值(%) | Redis Pub/Sub | 下次检查周期 | ✅ 推荐 |
| alert_memory_threshold | float | 85.0 | 内存告警阈值(%) | Redis Pub/Sub | 下次检查周期 | ✅ 推荐 |
| alert_disk_threshold | float | 90.0 | 磁盘告警阈值(%) | Redis Pub/Sub | 下次检查周期 | ✅ 推荐 |
| alert_error_rate_threshold | float | 5.0 | 错误率告警阈值(%) | Redis Pub/Sub | 下次检查周期 | ✅ 推荐 |
| prediction_enabled | bool | true | 是否启用趋势预测 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| report_schedule | string | "0 9 * * *" | 报告生成时间(cron) | Redis Pub/Sub | 下次调度时间 | ✅ 推荐 |
| custom_metrics | array | [] | 自定义指标列表 | Redis Pub/Sub | 下次采集周期 | ✅ 推荐 |
| heatmap_enabled | bool | true | 是否生成热力图 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| **查询优化配置** |
| cache_enabled | bool | true | 是否启用查询缓存 | Redis Pub/Sub | 下次查询 | ✅ 推荐 |
| cache_ttl | int | 300 | 缓存有效期(秒) | Redis Pub/Sub | 下次缓存写入 | ✅ 推荐 |
| slow_query_threshold | int | 5 | 慢查询阈值(秒) | Redis Pub/Sub | 下次查询 | ✅ 推荐 |
| max_concurrency | int | 100 | 最大并发查询数 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| query_timeout | int | 30 | 查询超时时间(秒) | Redis Pub/Sub | 下次查询 | ✅ 推荐 |
| page_size | int | 1000 | 默认分页大小 | Redis Pub/Sub | 下次查询 | ✅ 推荐 |
| auto_index_enabled | bool | true | 是否自动创建索引 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| index_frequency_threshold | int | 100 | 索引创建频率阈值 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| stream_enabled | bool | true | 是否启用流式返回 | Redis Pub/Sub | 下次查询 | ✅ 推荐 |
| optimization_enabled | bool | true | 是否启用查询优化 | Redis Pub/Sub | 下次查询 | ✅ 推荐 |
| **告警规则配置** |
| alert_rules | array | [] | 自定义告警规则列表 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| alert_enabled | bool | true | 是否启用告警 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| alert_notification_channels | array | [] | 告警通知渠道配置 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| **集群配置(不推荐热更新)** |
| min_replicas | int | 2 | 最小副本数 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| max_replicas | int | 10 | 最大副本数 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| alert_evaluation_interval | int | 30 | 告警评估间隔(秒) | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| **连接配置(不推荐热更新)** |
| postgresql_host | string | "postgres" | PostgreSQL主机 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| postgresql_port | int | 5432 | PostgreSQL端口 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| redis_address | string | "redis:6379" | Redis地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| prometheus_url | string | "http://prometheus:9090" | Prometheus地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |

**不推荐热更新的原因说明**:

1. **副本数配置** (min_replicas, max_replicas):
   - 这些是Kubernetes HPA的配置
   - 需要通过kubectl更新HPA资源
   - 建议：通过Kubernetes API或kubectl更新

2. **告警评估间隔** (alert_evaluation_interval):
   - 这是Prometheus服务器级别的配置
   - 需要重启Prometheus服务
   - 建议：通过YAML文件更新并重启Prometheus

3. **数据库连接配置**:
   - 需要重建数据库连接池
   - 可能导致正在进行的监控数据写入失败
   - 建议：通过YAML文件更新并滚动重启

4. **Prometheus连接配置**:
   - 需要重新初始化Prometheus客户端
   - 可能导致监控数据采集中断
   - 建议：通过YAML文件更新并滚动重启

**备用更新方式**:
- 如果Redis不可用，支持通过YAML配置文件更新，需要重启服务
- 配置文件路径: `/etc/performance-manager/config.yaml`
- 重启命令: `kubectl rollout restart deployment/performance-service`

### 11.2 热更新实现

**配置管理器**:

```go
// internal/performance/config/manager.go
package config

import (
    "context"
    "encoding/json"
    "sync/atomic"
    "time"
)

// 配置管理器
type ConfigManager struct {
    // 使用atomic.Value实现无锁读取
    autoscalingConfig atomic.Value  // *AutoscalingConfig
    monitoringConfig  atomic.Value  // *MonitoringConfig
    queryConfig       atomic.Value  // *OptimizerConfig
    
    db     *PostgreSQL
    redis  *Redis
    pubsub *redis.PubSub
}

// 创建配置管理器
func NewConfigManager(db *PostgreSQL, redis *Redis) (*ConfigManager, error) {
    cm := &ConfigManager{
        db:    db,
        redis: redis,
    }
    
    // 从数据库加载初始配置
    if err := cm.loadInitialConfig(); err != nil {
        return nil, err
    }
    
    // 订阅配置变更通知
    cm.pubsub = redis.Subscribe("config:module10:reload")
    
    return cm, nil
}

// 启动配置热更新监听
func (cm *ConfigManager) Start(ctx context.Context) error {
    go cm.watchConfigChanges(ctx)
    log.Info("配置热更新监听已启动")
    return nil
}

// 监听配置变更
func (cm *ConfigManager) watchConfigChanges(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():
            return
        case msg := <-cm.pubsub.Channel():
            cm.handleConfigChange(msg)
        }
    }
}

// 处理配置变更
func (cm *ConfigManager) handleConfigChange(msg *redis.Message) {
    log.Infof("收到配置变更通知: %s", msg.Payload)
    
    // 解析变更类型
    var change ConfigChange
    if err := json.Unmarshal([]byte(msg.Payload), &change); err != nil {
        log.Errorf("解析配置变更失败: %v", err)
        return
    }
    
    // 根据配置类型加载新配置
    switch change.Type {
    case "autoscaling":
        cm.reloadAutoscalingConfig()
    case "monitoring":
        cm.reloadMonitoringConfig()
    case "query_optimizer":
        cm.reloadQueryConfig()
    case "all":
        cm.reloadAllConfig()
    }
}

// 重新加载扩缩容配置
func (cm *ConfigManager) reloadAutoscalingConfig() {
    log.Info("开始重新加载扩缩容配置")
    
    // 1. 从Redis加载配置
    configJSON, err := cm.redis.Get("config:autoscaling")
    if err != nil {
        log.Errorf("从Redis加载配置失败: %v", err)
        return
    }
    
    // 2. 解析配置
    var newConfig AutoscalingConfig
    if err := json.Unmarshal([]byte(configJSON), &newConfig); err != nil {
        log.Errorf("解析配置失败: %v", err)
        return
    }
    
    // 3. 验证配置
    if err := cm.validateAutoscalingConfig(&newConfig); err != nil {
        log.Errorf("配置验证失败: %v", err)
        return
    }
    
    // 4. 原子更新配置
    cm.autoscalingConfig.Store(&newConfig)
    
    // 5. 记录审计日志
    cm.logConfigChange("autoscaling", &newConfig)
    
    log.Info("扩缩容配置重新加载完成")
}

// 验证扩缩容配置
func (cm *ConfigManager) validateAutoscalingConfig(config *AutoscalingConfig) error {
    // 验证副本数限制
    if config.MinReplicas < 1 {
        return fmt.Errorf("min_replicas必须 >= 1")
    }
    if config.MaxReplicas < config.MinReplicas {
        return fmt.Errorf("max_replicas必须 >= min_replicas")
    }
    if config.MaxReplicas > 50 {
        return fmt.Errorf("max_replicas不能超过50")
    }
    
    // 验证冷却期
    if config.ScaleUpCooldown < 60 {
        return fmt.Errorf("scale_up_cooldown必须 >= 60秒")
    }
    if config.ScaleDownCooldown < 60 {
        return fmt.Errorf("scale_down_cooldown必须 >= 60秒")
    }
    
    // 验证阈值
    for _, metric := range config.Metrics {
        if metric.Threshold < 0 || metric.Threshold > 100 {
            return fmt.Errorf("阈值必须在0-100之间")
        }
    }
    
    // 验证策略
    validStrategies := map[string]bool{
        "conservative": true,
        "balanced":     true,
        "aggressive":   true,
    }
    if !validStrategies[string(config.Strategy)] {
        return fmt.Errorf("无效的扩缩容策略: %s", config.Strategy)
    }
    
    return nil
}

// 获取当前扩缩容配置
func (cm *ConfigManager) GetAutoscalingConfig() *AutoscalingConfig {
    return cm.autoscalingConfig.Load().(*AutoscalingConfig)
}

// 更新扩缩容配置（API调用）
func (cm *ConfigManager) UpdateAutoscalingConfig(config *AutoscalingConfig) error {
    // 1. 验证配置
    if err := cm.validateAutoscalingConfig(config); err != nil {
        return err
    }
    
    // 2. 保存到PostgreSQL（版本化）
    if err := cm.db.SaveConfig("autoscaling", config); err != nil {
        return fmt.Errorf("保存配置到数据库失败: %w", err)
    }
    
    // 3. 同步到Redis
    configJSON, _ := json.Marshal(config)
    if err := cm.redis.Set("config:autoscaling", string(configJSON)); err != nil {
        return fmt.Errorf("同步配置到Redis失败: %w", err)
    }
    
    // 4. 发布变更通知
    change := ConfigChange{
        Type:      "autoscaling",
        Timestamp: time.Now(),
    }
    changeJSON, _ := json.Marshal(change)
    cm.redis.Publish("config:module10:reload", string(changeJSON))
    
    log.Info("扩缩容配置已更新并通知所有节点")
    return nil
}

// 配置变更记录
type ConfigChange struct {
    Type      string    `json:"type"`
    Timestamp time.Time `json:"timestamp"`
}

// 记录配置变更审计日志
func (cm *ConfigManager) logConfigChange(configType string, config interface{}) {
    auditLog := AuditLog{
        EventType:    "config_change",
        ResourceType: configType,
        Action:       "update",
        Timestamp:    time.Now(),
        NewValue:     config,
    }
    
    cm.db.SaveAuditLog(&auditLog)
}
```

### 11.3 热更新验收标准

**自动扩缩容配置热更新**:

1. ✅ THE System SHALL 在配置变更后30秒内应用新的扩缩容策略
2. ✅ WHEN 阈值配置变更时，THE System SHALL 在下次指标采集时生效
3. ✅ THE System SHALL 支持通过API查询当前生效的扩缩容配置
4. ✅ THE System SHALL 记录所有扩缩容配置变更的审计日志
5. ✅ WHEN 副本数限制变更时，THE System SHALL 验证 min_replicas <= max_replicas

**资源监控配置热更新**:

1. ✅ THE System SHALL 在配置变更后立即应用新的采集间隔
2. ✅ WHEN 告警阈值变更时，THE System SHALL 在下次指标检查时生效
3. ✅ THE System SHALL 支持通过API查询当前生效的监控配置
4. ✅ THE System SHALL 记录所有监控配置变更的审计日志
5. ✅ WHEN 自定义指标变更时，THE System SHALL 验证Prometheus格式的正确性

**查询优化配置热更新**:

1. ✅ THE System SHALL 在配置变更后立即应用新的缓存策略
2. ✅ WHEN 并发限制变更时，THE System SHALL 在下次查询时生效
3. ✅ THE System SHALL 支持通过API查询当前生效的查询优化配置
4. ✅ THE System SHALL 记录所有查询优化配置变更的审计日志
5. ✅ WHEN 超时时间变更时，THE System SHALL 验证配置的合理性（>= 1秒）

**告警规则配置热更新**:

1. ✅ THE System SHALL 在告警规则创建/更新后立即重载Prometheus规则
2. ✅ WHEN 告警规则变更时，THE System SHALL 在30秒内生效
3. ✅ THE System SHALL 验证告警规则表达式的PromQL语法正确性
4. ✅ THE System SHALL 支持通过API查询所有告警规则（包括内置和自定义）
5. ✅ THE System SHALL 记录所有告警规则变更的历史版本
6. ✅ WHEN 告警规则删除时，THE System SHALL 自动从Prometheus移除该规则
7. ✅ THE System SHALL 支持启用/禁用告警规则，无需删除规则
8. ✅ THE System SHALL 在Prometheus重载失败时回滚规则变更

### 11.4 热更新测试

**测试场景**:

```bash
# 1. 测试扩缩容配置热更新
curl -X PUT http://api-server/api/v1/autoscaling/config \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "max_replicas": 15,
    "cpu_threshold": 75.0
  }'

# 等待30秒
sleep 30

# 验证配置已生效
curl http://api-server/api/v1/autoscaling/config \
  -H "Authorization: Bearer $TOKEN"

# 2. 测试监控配置热更新
curl -X PUT http://api-server/api/v1/monitoring/config \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "alert_cpu_threshold": 85.0,
    "collect_interval": 10
  }'

# 验证下次采集使用新间隔
# 查看Prometheus采集日志

# 3. 测试查询配置热更新
curl -X PUT http://api-server/api/v1/query/config \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "cache_ttl": 600,
    "max_concurrency": 150
  }'

# 执行查询验证新配置
curl -X POST http://api-server/api/v1/query/execute \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "level:ERROR",
    "limit": 100
  }'

# 4. 测试告警规则热更新
# 创建自定义告警规则
curl -X POST http://api-server/api/v1/monitoring/alert-rules \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "TestHighCPU",
    "enabled": true,
    "expr": "node_cpu_usage_percent > 95",
    "for": "5m",
    "labels": {
      "severity": "critical",
      "category": "test"
    },
    "annotations": {
      "summary": "测试CPU告警",
      "description": "CPU使用率超过95%"
    }
  }'

# 等待30秒，验证Prometheus规则已重载
sleep 30

# 查询Prometheus规则
curl http://prometheus:9090/api/v1/rules | jq '.data.groups[] | select(.name=="test")'

# 更新告警规则
curl -X PUT http://api-server/api/v1/monitoring/alert-rules/rule-123456 \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "expr": "node_cpu_usage_percent > 98",
    "for": "10m"
  }'

# 验证规则已更新
curl http://api-server/api/v1/monitoring/alert-rules/rule-123456 \
  -H "Authorization: Bearer $TOKEN"

# 禁用告警规则
curl -X PUT http://api-server/api/v1/monitoring/alert-rules/rule-123456 \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "enabled": false
  }'

# 验证规则已从Prometheus移除
curl http://prometheus:9090/api/v1/rules | jq '.data.groups[] | select(.name=="test")'

# 删除告警规则
curl -X DELETE http://api-server/api/v1/monitoring/alert-rules/rule-123456 \
  -H "Authorization: Bearer $TOKEN"

# 5. 测试告警规则表达式验证
curl -X POST http://api-server/api/v1/monitoring/alert-rules/validate \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "expr": "invalid_metric > 100"
  }'

# 应该返回验证失败
```

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 扩缩容过于频繁导致系统抖动 | 中 | 高 | 设置合理的冷却期（扩容3分钟、缩容5分钟） |
| 缩容时数据丢失 | 低 | 严重 | 缩容前强制排空缓冲区，验证数据完整性 |
| 监控指标采集失败 | 中 | 中 | 使用上次有效值，设置告警 |
| 查询缓存雪崩 | 低 | 高 | 使用缓存预热、设置随机TTL |
| 配置热更新失败 | 低 | 中 | 配置验证、保持原配置、记录错误 |
| Prometheus存储空间不足 | 中 | 高 | 设置保留期限、定期清理、监控磁盘使用 |
| Redis内存溢出 | 中 | 高 | 设置最大内存、LRU淘汰策略 |
| 慢查询影响系统性能 | 中 | 中 | 查询超时控制、并发限制 |
| 趋势预测不准确 | 中 | 低 | 定期重训练模型、人工审核 |
| 告警风暴 | 中 | 中 | 告警聚合、抑制规则、分级通知 |

### 12.2 回滚方案

**配置回滚**:

```bash
# 1. 查看配置历史版本
curl http://api-server/api/v1/autoscaling/config/history \
  -H "Authorization: Bearer $TOKEN"

# 2. 回滚到指定版本
curl -X POST http://api-server/api/v1/autoscaling/config/rollback \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "version": "v1.2.3"
  }'

# 3. 验证回滚结果
curl http://api-server/api/v1/autoscaling/config \
  -H "Authorization: Bearer $TOKEN"
```

**服务回滚**:

```bash
# 1. 查看部署历史
helm history performance-optimizer -n log-management

# 2. 回滚到上一版本
helm rollback performance-optimizer -n log-management

# 3. 验证回滚状态
kubectl get pods -n log-management
kubectl logs -n log-management deployment/performance-optimizer

# 4. 验证功能
curl http://api-server/health
```

**数据回滚**:

```bash
# 1. 停止服务
kubectl scale deployment performance-optimizer --replicas=0 -n log-management

# 2. 恢复PostgreSQL数据
kubectl exec -n data postgresql-0 -- psql -U postgres -d logdb \
  -c "RESTORE DATABASE logdb FROM '/backup/logdb-20260131.dump'"

# 3. 恢复Redis数据
kubectl exec -n data redis-0 -- redis-cli --rdb /backup/redis-20260131.rdb

# 4. 重启服务
kubectl scale deployment performance-optimizer --replicas=3 -n log-management

# 5. 验证数据
curl http://api-server/api/v1/autoscaling/config
```

### 12.3 应急预案

**扩缩容失败应急**:

1. **现象**: 扩容触发但副本数未增加
2. **排查步骤**:
   ```bash
   # 检查HPA状态
   kubectl describe hpa collector-hpa -n log-management
   
   # 检查资源配额
   kubectl describe resourcequota -n log-management
   
   # 检查节点资源
   kubectl top nodes
   ```
3. **应急措施**:
   - 手动扩容: `kubectl scale deployment collector --replicas=10`
   - 增加节点资源
   - 调整资源配额

**监控数据丢失应急**:

1. **现象**: Prometheus数据采集中断
2. **排查步骤**:
   ```bash
   # 检查Prometheus状态
   kubectl logs -n monitoring prometheus-0
   
   # 检查存储空间
   kubectl exec -n monitoring prometheus-0 -- df -h
   
   # 检查网络连接
   kubectl exec -n monitoring prometheus-0 -- nc -zv node-exporter 9100
   ```
3. **应急措施**:
   - 清理过期数据
   - 扩展存储空间
   - 重启Prometheus

**查询性能下降应急**:

1. **现象**: 查询延迟突然增加
2. **排查步骤**:
   ```bash
   # 检查慢查询
   curl http://api-server/api/v1/query/slow
   
   # 检查缓存状态
   curl http://api-server/api/v1/query/cache/stats
   
   # 检查并发数
   curl http://api-server/api/v1/query/stats
   ```
3. **应急措施**:
   - 清除查询缓存
   - 降低并发限制
   - 优化慢查询
   - 增加查询服务副本数

**配置热更新失败应急**:

1. **现象**: 配置更新后服务异常
2. **排查步骤**:
   ```bash
   # 检查配置验证日志
   kubectl logs -n log-management deployment/performance-optimizer | grep "config"
   
   # 检查Redis连接
   kubectl exec -n data redis-0 -- redis-cli ping
   
   # 检查配置内容
   kubectl exec -n data redis-0 -- redis-cli get "config:autoscaling"
   ```
3. **应急措施**:
   - 回滚配置到上一版本
   - 修正配置错误
   - 重启服务

### 12.4 灾难恢复

**RTO/RPO目标**:

| 场景 | RTO | RPO | 恢复策略 |
|------|-----|-----|----------|
| 配置数据丢失 | 1小时 | 0 | PostgreSQL主从复制 + 每日备份 |
| 监控数据丢失 | 4小时 | 15分钟 | Prometheus远程存储 + 本地备份 |
| 缓存数据丢失 | 30分钟 | 5分钟 | Redis持久化 + 主从复制 |
| 整个集群故障 | 4小时 | 1小时 | 跨区域备份 + 灾备集群 |

**灾难恢复流程**:

1. **评估影响范围**
   - 确定受影响的组件
   - 评估数据丢失情况
   - 估算恢复时间

2. **启动应急响应**
   - 通知相关人员
   - 切换到灾备集群（如有）
   - 停止受影响服务

3. **数据恢复**
   - 从备份恢复配置数据
   - 从远程存储恢复监控数据
   - 重建缓存数据

4. **服务恢复**
   - 重新部署服务
   - 验证配置正确性
   - 逐步恢复流量

5. **验证与监控**
   - 功能测试
   - 性能测试
   - 持续监控24小时

6. **事后分析**
   - 根因分析
   - 改进措施
   - 更新应急预案

---

## 13. 附录

### 13.1 术语表

| 术语 | 说明 |
|------|------|
| HPA | Horizontal Pod Autoscaler，Kubernetes水平自动扩缩容 |
| VPA | Vertical Pod Autoscaler，Kubernetes垂直自动扩缩容 |
| Metrics Server | Kubernetes指标服务器，聚合资源指标 |
| Prometheus | 开源监控系统，用于指标采集和存储 |
| Grafana | 开源可视化平台，用于监控仪表盘 |
| Alertmanager | Prometheus告警管理器，处理告警路由和通知 |
| P50/P95/P99 | 百分位延迟，表示50%/95%/99%的请求延迟 |
| QPS | Queries Per Second，每秒查询数 |
| LRU | Least Recently Used，最近最少使用缓存淘汰策略 |
| TTL | Time To Live，缓存有效期 |
| 冷却期 | 扩缩容操作之间的最小时间间隔 |
| 慢查询 | 执行时间超过阈值的查询 |
| 热数据 | 最近时间范围内的数据（如最近1小时） |
| 缓存命中率 | 从缓存中获取数据的请求占总请求的比例 |
| 趋势预测 | 基于历史数据预测未来资源使用情况 |
| 配置热更新 | 不重启服务即可更新配置 |
| 原子操作 | 不可分割的操作，要么全部成功要么全部失败 |
| 背压 | 当下游处理速度慢于上游时的流量控制机制 |
| 雪崩效应 | 缓存大量失效导致请求直接打到数据库 |

### 13.2 参考文档

**Kubernetes文档**:
- [Horizontal Pod Autoscaler](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Vertical Pod Autoscaler](https://github.com/kubernetes/autoscaler/tree/master/vertical-pod-autoscaler)
- [Metrics Server](https://github.com/kubernetes-sigs/metrics-server)

**Prometheus文档**:
- [Prometheus官方文档](https://prometheus.io/docs/)
- [PromQL查询语言](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [告警规则配置](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/)

**Grafana文档**:
- [Grafana官方文档](https://grafana.com/docs/)
- [仪表盘最佳实践](https://grafana.com/docs/grafana/latest/best-practices/)

**Redis文档**:
- [Redis官方文档](https://redis.io/documentation)
- [Redis Pub/Sub](https://redis.io/docs/manual/pubsub/)
- [Redis持久化](https://redis.io/docs/manual/persistence/)

**性能优化**:
- [Go性能优化指南](https://github.com/dgryski/go-perfbook)
- [Elasticsearch查询优化](https://www.elastic.co/guide/en/elasticsearch/reference/current/tune-for-search-speed.html)

### 13.3 配置示例

**HPA配置示例**:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: collector-hpa
  namespace: log-management
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: collector
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 75
  - type: Pods
    pods:
      metric:
        name: log_throughput
      target:
        type: AverageValue
        averageValue: "50000"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 180
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 20
        periodSeconds: 60
```

**Prometheus告警规则示例**:

```yaml
groups:
  - name: performance_alerts
    interval: 30s
    rules:
      - alert: HighCPUUsage
        expr: node_cpu_usage_percent > 80
        for: 5m
        labels:
          severity: warning
          component: performance
        annotations:
          summary: "CPU使用率过高"
          description: "节点 {{ $labels.node }} CPU使用率 {{ $value }}%，持续5分钟"
          runbook_url: "https://wiki.example.com/runbooks/high-cpu"
      
      - alert: HighQueryLatency
        expr: query_duration_seconds{quantile="0.95"} > 0.5
        for: 5m
        labels:
          severity: warning
          component: query
        annotations:
          summary: "查询延迟过高"
          description: "P95查询延迟 {{ $value }}秒，超过500ms阈值"
          runbook_url: "https://wiki.example.com/runbooks/high-latency"
```

**Grafana仪表盘JSON示例**:

```json
{
  "dashboard": {
    "title": "性能与资源优化监控",
    "panels": [
      {
        "title": "副本数变化",
        "type": "graph",
        "targets": [
          {
            "expr": "autoscaling_current_replicas{service=\"collector\"}",
            "legendFormat": "当前副本数"
          },
          {
            "expr": "autoscaling_desired_replicas{service=\"collector\"}",
            "legendFormat": "目标副本数"
          }
        ]
      },
      {
        "title": "资源使用率",
        "type": "graph",
        "targets": [
          {
            "expr": "node_cpu_usage_percent",
            "legendFormat": "CPU使用率"
          },
          {
            "expr": "node_memory_usage_percent",
            "legendFormat": "内存使用率"
          }
        ]
      },
      {
        "title": "查询性能",
        "type": "graph",
        "targets": [
          {
            "expr": "query_duration_seconds{quantile=\"0.95\"}",
            "legendFormat": "P95延迟"
          },
          {
            "expr": "query_cache_hit_rate_percent",
            "legendFormat": "缓存命中率"
          }
        ]
      }
    ]
  }
}
```

### 13.4 故障排查清单

**扩缩容问题**:

- [ ] 检查HPA/VPA状态: `kubectl describe hpa/vpa`
- [ ] 检查Metrics Server: `kubectl top nodes/pods`
- [ ] 检查资源配额: `kubectl describe resourcequota`
- [ ] 检查节点资源: `kubectl describe nodes`
- [ ] 检查扩缩容事件: `kubectl get events`
- [ ] 检查配置正确性: 阈值、副本数限制
- [ ] 检查冷却期设置

**监控问题**:

- [ ] 检查Prometheus状态: `kubectl logs prometheus-0`
- [ ] 检查指标采集: `curl prometheus:9090/api/v1/targets`
- [ ] 检查存储空间: `df -h`
- [ ] 检查告警规则: `curl prometheus:9090/api/v1/rules`
- [ ] 检查Alertmanager: `kubectl logs alertmanager-0`
- [ ] 检查网络连接: `nc -zv exporter 9100`

**查询性能问题**:

- [ ] 检查慢查询列表: API `/api/v1/query/slow`
- [ ] 检查缓存统计: API `/api/v1/query/cache/stats`
- [ ] 检查并发数: API `/api/v1/query/stats`
- [ ] 检查Redis状态: `redis-cli info`
- [ ] 检查Elasticsearch状态: `curl es:9200/_cluster/health`
- [ ] 检查索引: `curl es:9200/_cat/indices`
- [ ] 分析查询计划: API `/api/v1/query/explain`

**配置热更新问题**:

- [ ] 检查Redis连接: `redis-cli ping`
- [ ] 检查Pub/Sub订阅: `redis-cli pubsub channels`
- [ ] 检查配置内容: `redis-cli get config:*`
- [ ] 检查PostgreSQL连接: `psql -U postgres -c "SELECT 1"`
- [ ] 检查配置版本: API `/api/v1/*/config`
- [ ] 检查审计日志: 查询audit_logs表
- [ ] 检查服务日志: `kubectl logs deployment/*`

### 13.5 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-01-31 | v1.0 | 初稿，完整设计方案 | 系统架构团队 |

---

**文档结束**


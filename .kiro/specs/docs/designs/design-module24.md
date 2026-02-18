# 模块24：成本管理 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-01-31  
> **状态**: 已发布  
> **相关需求**: [requirements-module24.md](../requirements/requirements-module24.md)

---

## 1. 文档信息

### 1.1 版本历史
| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-01-31 | 系统架构团队 | 初稿，完整设计方案 |

### 1.2 文档状态
- **当前状态**: 已发布
- **评审状态**: 已通过
- **实施阶段**: Phase 3

### 1.3 相关文档
- [需求文档](../requirements/requirements-module24.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)
- [模块2设计文档](./design-module2.md) - 日志存储
- [模块22设计文档](./design-module22.md) - 多租户架构

---

## 2. 总体架构

### 2.1 系统架构图
```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                            成本管理系统架构                                                  │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  配置中心 (PostgreSQL + Redis)                                                              │
│       ↓ (定价规则、预算配置、优化策略)                                                       │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            用量采集层（Usage Collector）                               │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  存储用量采集                                                                  │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │   │ │
│  │  │  │ ES索引   │  │ MinIO桶  │  │ S3存储   │  │ Glacier  │                      │   │ │
│  │  │  │ 大小统计  │  │ 对象统计  │  │ 容量统计  │  │ 归档统计  │                      │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                      │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘   │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  计算用量采集                                                                  │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │   │ │
│  │  │  │ 查询次数  │  │ 扫描数据量│  │ CPU时间  │  │ 分析任务  │                      │   │ │
│  │  │  │ 按用户   │  │ 按查询   │  │ 按服务   │  │ 按项目   │                      │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                      │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘   │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  网络用量采集                                                                  │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │   │ │
│  │  │  │ 日志摄入  │  │ 查询导出  │  │ 备份传输  │  │ 跨区复制  │                      │   │ │
│  │  │  │ 流量统计  │  │ 流量统计  │  │ 流量统计  │  │ 流量统计  │                      │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                      │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘   │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  索引用量采集                                                                  │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │   │ │
│  │  │  │ 索引字段数│  │ 索引大小  │  │ 分片数量  │  │ 副本数量  │                      │   │ │
│  │  │  │ 按索引   │  │ 按租户   │  │ 按索引   │  │ 按索引   │                      │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                      │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
│                                          │                                                 │
│                                          ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            成本计算层（Cost Calculator）                               │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  定价引擎                                                                      │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │   │ │
│  │  │  │ 按量计费  │  │ 阶梯定价  │  │ 包年包月  │  │ 自定义   │                      │   │ │
│  │  │  │ 实时计算  │  │ 分段计算  │  │ 固定费用  │  │ 规则引擎  │                      │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                      │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘   │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  成本聚合                                                                      │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │   │ │
│  │  │  │ 按租户   │  │ 按项目   │  │ 按服务   │  │ 按时间   │                      │   │ │
│  │  │  │ 汇总     │  │ 汇总     │  │ 汇总     │  │ 汇总     │                      │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                      │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘   │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  成本预测                                                                      │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │   │ │
│  │  │  │ 趋势分析  │  │ 线性回归  │  │ 季节性   │  │ 异常检测  │                      │   │ │
│  │  │  │ 历史数据  │  │ 预测模型  │  │ 周期性   │  │ 突增预警  │                      │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                      │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
│                                          │                                                 │
│         ┌────────────────────────────────┼────────────────────────────────┐               │
│         ▼                                ▼                                ▼               │
│  ┌────────────────┐            ┌────────────────┐            ┌────────────────┐          │
│  │  预算管理      │            │  成本优化      │            │  报告生成      │          │
│  │  Budget Mgmt   │            │  Optimization  │            │  Reporting     │          │
│  │  ┌──────────┐  │            │  ┌──────────┐  │            │  ┌──────────┐  │          │
│  │  │ 预算设置  │  │            │  │ 优化建议  │  │            │  │ 成本报告  │  │          │
│  │  │ 月度/年度 │  │            │  │ 存储层级  │  │            │  │ 日/周/月 │  │          │
│  │  └──────────┘  │            │  └──────────┘  │            │  └──────────┘  │          │
│  │  ┌──────────┐  │            │  ┌──────────┐  │            │  ┌──────────┐  │          │
│  │  │ 进度追踪  │  │            │  │ 保留策略  │  │            │  │ 趋势分析  │  │          │
│  │  │ 实时监控  │  │            │  │ 优化     │  │            │  │ 图表生成  │  │          │
│  │  └──────────┘  │            │  └──────────┘  │            │  └──────────┘  │          │
│  │  ┌──────────┐  │            │  ┌──────────┐  │            │  ┌──────────┐  │          │
│  │  │ 预算告警  │  │            │  │ 索引策略  │  │            │  │ 导出功能  │  │          │
│  │  │ 50%/80%  │  │            │  │ 优化     │  │            │  │ PDF/Excel│  │          │
│  │  └──────────┘  │            │  └──────────┘  │            │  └──────────┘  │          │
│  │  ┌──────────┐  │            │  ┌──────────┐  │            │  ┌──────────┐  │          │
│  │  │ 历史记录  │  │            │  │ 节省预估  │  │            │  │ 邮件发送  │  │          │
│  │  │ 调整记录  │  │            │  │ ROI计算  │  │            │  │ 定时任务  │  │          │
│  │  └──────────┘  │            │  └──────────┘  │            │  └──────────┘  │          │
│  └────────────────┘            └────────────────┘            └────────────────┘          │
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            数据存储层（PostgreSQL）                                    │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │ │
│  │  │ 用量指标表  │  │ 成本记录表  │  │ 预算配置表  │  │ 定价规则表  │  │ 优化建议表  │     │ │
│  │  │usage_metrics│  │cost_records│  │budgets     │  │pricing_rules│  │recommendations│ │ │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            缓存层（Redis）                                             │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐                      │ │
│  │  │ 实时用量    │  │ 定价规则    │  │ 预算状态    │  │ 配置热更新  │                      │ │
│  │  │ 缓存       │  │ 缓存       │  │ 缓存       │  │ Pub/Sub    │                      │ │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘                      │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            对外接口层（API）                                           │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐                      │ │
│  │  │ 用量查询API │  │ 成本查询API │  │ 预算管理API │  │ 优化建议API │                      │ │
│  │  │ REST/gRPC  │  │ REST/gRPC  │  │ REST/gRPC  │  │ REST/gRPC  │                      │ │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘                      │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分
| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| 用量采集器 | 多维度资源用量采集 | 存储用量、计算用量、网络用量、索引用量采集 |
| 成本计算器 | 成本计算与聚合 | 定价引擎、成本聚合、成本预测、多币种支持 |
| 预算管理器 | 预算设置与监控 | 预算配置、进度追踪、预算告警、历史记录 |
| 优化引擎 | 成本优化建议 | 存储层级优化、保留策略优化、索引策略优化、节省预估 |
| 报告生成器 | 成本报告生成 | 报告生成、趋势分析、图表生成、导出功能 |
| 配置管理器 | 定价规则管理 | 定价规则配置、规则验证、热更新、版本管理 |

### 2.3 关键路径

**用量采集流程**:
```
定时任务触发(每小时) → 采集ES索引大小(100ms) → 采集MinIO桶大小(200ms) 
  → 采集查询统计(50ms) → 采集网络流量(50ms) → 写入PostgreSQL(100ms) 
  → 更新Redis缓存(20ms)

总时长: < 500ms
```

**成本计算流程**:
```
获取用量数据(50ms) → 加载定价规则(10ms) → 按量计费计算(20ms) 
  → 阶梯定价计算(30ms) → 成本聚合(40ms) → 写入成本记录(50ms) 
  → 更新预算进度(30ms) → 检查预算告警(20ms)

总时长: < 250ms
```

**配置热更新流程**:
```
用户修改定价规则 → 保存到PostgreSQL(50ms) → 验证规则(20ms) 
  → 发布Redis Pub/Sub(10ms) → 成本计算器订阅(5ms) → 原子更新配置(5ms) 
  → 记录审计日志(20ms)

配置生效时间: < 100ms
```

---

## 3. 技术选型

### 3.1 核心技术栈
| 技术 | 版本 | 选择理由 |
|------|------|----------|
| Go | 1.21+ | 高性能、并发友好、适合后台任务 |
| PostgreSQL | 15+ | 关系型数据库、支持复杂查询、事务保证 |
| Redis | 7.2+ | 高性能缓存、Pub/Sub配置热更新 |
| Elasticsearch API | 8.11+ | 获取索引统计信息 |
| MinIO SDK | - | 获取对象存储统计信息 |
| AWS SDK | - | 获取S3/Glacier统计信息 |

### 3.2 定价模型对比

| 定价模型 | 适用场景 | 优点 | 缺点 | 实现复杂度 |
|----------|----------|------|------|------------|
| 按量计费 | 用量波动大 | 灵活、公平 | 成本不可预测 | 低 |
| 阶梯定价 | 用量稳定增长 | 鼓励使用、成本递减 | 计算复杂 | 中 |
| 包年包月 | 用量稳定 | 成本可预测、折扣大 | 灵活性差 | 低 |
| 混合模式 | 企业客户 | 兼顾灵活性和成本 | 最复杂 | 高 |

**选择**: 支持所有模型，默认使用按量计费+阶梯定价组合

### 3.3 成本预测算法对比

| 算法 | 准确度 | 计算复杂度 | 适用场景 |
|------|--------|------------|----------|
| 线性回归 | 中 | 低 | 稳定增长 |
| 移动平均 | 中 | 低 | 平稳波动 |
| ARIMA | 高 | 高 | 季节性波动 |
| Prophet | 高 | 中 | 多种模式 |

**选择**: 使用移动平均作为基础，Prophet作为高级选项

---

## 4. 关键流程设计

### 4.1 用量采集流程

**主流程**:
```
1. 定时任务触发(Cron: 0 * * * * - 每小时)
2. 并发采集各类用量:
   a. 采集ES索引用量
      - 调用ES Cat API获取索引列表
      - 获取每个索引的大小、文档数
      - 按租户ID聚合
   b. 采集MinIO用量
      - 遍历所有桶
      - 统计对象数量和总大小
      - 按租户ID聚合
   c. 采集查询用量
      - 从Prometheus获取查询指标
      - 统计查询次数、扫描数据量
      - 按用户/项目聚合
   d. 采集网络用量
      - 从Kafka获取摄入流量
      - 从API Gateway获取导出流量
      - 按租户ID聚合
3. 写入PostgreSQL usage_metrics表
4. 更新Redis缓存(实时用量)
5. 记录采集日志
```

**时序图**:
```
定时器  采集器  ES    MinIO  Prometheus  PostgreSQL  Redis
  │      │     │      │        │           │          │
  │─触发→│     │      │        │           │          │
  │      │─查询→│      │        │           │          │
  │      │←返回─│      │        │           │          │
  │      │─查询────────→│        │           │          │
  │      │←返回─────────│        │           │          │
  │      │─查询────────────────→│           │          │
  │      │←返回─────────────────│           │          │
  │      │─写入────────────────────────────→│          │
  │      │─更新────────────────────────────────────────→│
  │      │←完成─────────────────────────────────────────│
```

### 4.2 成本计算流程

**主流程**:
```
1. 定时任务触发(每天凌晨1点)
2. 获取昨日用量数据
3. 加载定价规则(从Redis缓存)
4. 按租户计算成本:
   a. 存储成本计算
      - 热存储: 用量(GB) × 热存储单价
      - 温存储: 用量(GB) × 温存储单价
      - 冷存储: 用量(GB) × 冷存储单价
   b. 摄入成本计算(阶梯定价)
      - 0-100GB: 用量 × 0.50
      - 100-1000GB: 用量 × 0.40
      - 1000GB+: 用量 × 0.30
   c. 查询成本计算
      - 扫描数据量(GB) × 查询单价
   d. 网络成本计算
      - 流量(GB) × 网络单价
5. 成本聚合(按租户/项目/服务)
6. 写入cost_records表
7. 更新预算进度
8. 检查预算告警阈值
9. 发送告警通知(如需要)
```

**阶梯定价计算示例**:
```go
func calculateTieredCost(usage float64, tiers []PriceTier) float64 {
    var cost float64
    remaining := usage
    
    for _, tier := range tiers {
        if remaining <= 0 {
            break
        }
        
        var tierUsage float64
        if tier.UpTo == nil {
            // 最后一档，无上限
            tierUsage = remaining
        } else {
            tierUsage = math.Min(remaining, *tier.UpTo)
        }
        
        cost += tierUsage * tier.Price
        remaining -= tierUsage
    }
    
    return cost
}
```

### 4.3 预算告警流程

```
1. 成本计算完成后触发
2. 查询租户预算配置
3. 计算预算使用率 = 当前成本 / 预算金额
4. 检查告警阈值:
   - 50%: 发送提醒通知
   - 80%: 发送警告通知
   - 100%: 发送严重告警
   - 120%: 触发自动限流(可选)
5. 记录告警历史
6. 发送通知(邮件/钉钉/企业微信)
```

### 4.4 成本优化建议生成流程

```
1. 定时任务触发(每周一次)
2. 分析历史用量数据(过去30天)
3. 识别优化机会:
   a. 存储层级优化
      - 查找访问频率低的热存储数据
      - 计算迁移到温/冷存储的节省
   b. 保留策略优化
      - 查找低价值日志(DEBUG级别)
      - 计算缩短保留期的节省
   c. 索引策略优化
      - 查找未使用的索引字段
      - 计算减少索引的节省
   d. 压缩策略优化
      - 查找未压缩或低压缩率数据
      - 计算提高压缩率的节省
4. 生成优化建议
5. 计算ROI(投资回报率)
6. 写入recommendations表
7. 发送优化报告
```

### 4.5 异常流程

| 异常类型 | 处理策略 | 恢复机制 |
|----------|----------|----------|
| ES不可用 | 跳过本次采集，记录错误 | 下次采集时补采 |
| MinIO不可用 | 跳过本次采集，记录错误 | 下次采集时补采 |
| 数据库写入失败 | 重试3次，指数退避 | 写入失败队列，人工处理 |
| 定价规则缺失 | 使用默认定价规则 | 告警通知管理员 |
| 预算配置错误 | 跳过预算检查 | 告警通知管理员 |
| 成本计算异常 | 记录错误，继续处理其他租户 | 人工审核异常数据 |

### 4.6 配置热更新流程

```
1. 用户在Web Console修改定价规则
2. 后端API验证规则格式
3. 保存到PostgreSQL pricing_rules表
4. 更新Redis缓存
5. 发布Redis Pub/Sub消息(channel: config:cost:reload)
6. 成本计算器订阅消息
7. 重新加载定价规则(atomic.Value原子更新)
8. 记录配置变更审计日志
9. 返回成功响应
```

**热更新代码示例**:
```go
type CostCalculator struct {
    pricingRules atomic.Value // *PricingRules
    redis        *redis.Client
}

func (c *CostCalculator) subscribeConfigChanges() {
    pubsub := c.redis.Subscribe("config:cost:reload")
    
    for msg := range pubsub.Channel() {
        log.Info("收到配置更新通知", "message", msg.Payload)
        
        // 从Redis加载新配置
        newRules, err := c.loadPricingRulesFromRedis()
        if err != nil {
            log.Error("加载定价规则失败", "error", err)
            continue
        }
        
        // 验证配置
        if err := newRules.Validate(); err != nil {
            log.Error("定价规则验证失败", "error", err)
            continue
        }
        
        // 原子更新
        c.pricingRules.Store(newRules)
        
        log.Info("定价规则已更新", "version", newRules.Version)
    }
}

func (c *CostCalculator) GetPricingRules() *PricingRules {
    return c.pricingRules.Load().(*PricingRules)
}
```

---

## 5. 接口设计

详见 [API设计文档](./api-design.md) 模块24部分

### 5.1 API列表概览

**用量管理接口**:
- `GET /api/v1/cost/usage` - 查询用量数据
- `GET /api/v1/cost/usage/trend` - 查询用量趋势
- `GET /api/v1/cost/usage/export` - 导出用量数据

**成本管理接口**:
- `GET /api/v1/cost/records` - 查询成本记录
- `GET /api/v1/cost/summary` - 查询成本汇总
- `GET /api/v1/cost/forecast` - 查询成本预测
- `GET /api/v1/cost/breakdown` - 查询成本分解

**预算管理接口**:
- `POST /api/v1/cost/budgets` - 创建预算
- `PUT /api/v1/cost/budgets/:id` - 更新预算
- `GET /api/v1/cost/budgets` - 查询预算列表
- `GET /api/v1/cost/budgets/:id/progress` - 查询预算进度
- `GET /api/v1/cost/budgets/:id/alerts` - 查询预算告警

**定价规则接口**:
- `POST /api/v1/cost/pricing-rules` - 创建定价规则
- `PUT /api/v1/cost/pricing-rules/:id` - 更新定价规则
- `GET /api/v1/cost/pricing-rules` - 查询定价规则
- `DELETE /api/v1/cost/pricing-rules/:id` - 删除定价规则

**告警规则接口（热更新）**:
- `POST /api/v1/cost/config/alert-rules` - 创建告警规则
- `PUT /api/v1/cost/config/alert-rules/:id` - 更新告警规则
- `DELETE /api/v1/cost/config/alert-rules/:id` - 删除告警规则
- `GET /api/v1/cost/config/alert-rules` - 查询告警规则列表
- `GET /api/v1/cost/config/alert-rules/:id` - 查询告警规则详情
- `POST /api/v1/cost/config/alert-rules/:id/toggle` - 启用/禁用告警规则
- `POST /api/v1/cost/config/alert-rules/:id/test` - 测试告警规则
- `GET /api/v1/cost/alerts/history` - 查询告警历史

**告警通道接口（热更新）**:
- `POST /api/v1/cost/config/alert-channels` - 更新告警通道配置
- `GET /api/v1/cost/config/alert-channels` - 查询告警通道配置
- `POST /api/v1/cost/config/alert-channels/test` - 测试告警通道

**优化建议接口**:
- `GET /api/v1/cost/recommendations` - 查询优化建议
- `POST /api/v1/cost/recommendations/:id/apply` - 应用优化建议
- `POST /api/v1/cost/recommendations/:id/dismiss` - 忽略优化建议

**配置热更新接口**:
- `POST /api/v1/cost/config/reload` - 触发配置重载
- `GET /api/v1/cost/config/version` - 查询配置版本
- `POST /api/v1/cost/config/pricing-rules` - 更新定价规则（热更新）
- `POST /api/v1/cost/config/budget-thresholds` - 更新预算阈值（热更新）

### 5.2 内部接口

**用量采集器接口**:
```go
// 用量采集器接口
type UsageCollector interface {
    // 采集存储用量
    CollectStorageUsage(ctx context.Context) error
    
    // 采集计算用量
    CollectComputeUsage(ctx context.Context) error
    
    // 采集网络用量
    CollectNetworkUsage(ctx context.Context) error
    
    // 采集索引用量
    CollectIndexUsage(ctx context.Context) error
    
    // 记录用量指标
    RecordUsage(ctx context.Context, metric *UsageMetric) error
}

// 用量指标
type UsageMetric struct {
    TenantID       string    `json:"tenant_id"`
    MetricType     string    `json:"metric_type"`     // storage, ingestion, query, export
    Dimension      string    `json:"dimension"`       // project, service, user
    DimensionValue string    `json:"dimension_value"`
    Value          float64   `json:"value"`
    Unit           string    `json:"unit"`            // bytes, count, seconds
    RecordedAt     time.Time `json:"recorded_at"`
}
```

**成本计算器接口**:
```go
// 成本计算器接口
type CostCalculator interface {
    // 计算月度成本
    CalculateMonthlyCost(ctx context.Context, tenantID string, month time.Time) (*CostReport, error)
    
    // 计算日成本
    CalculateDailyCost(ctx context.Context, tenantID string, date time.Time) (*CostReport, error)
    
    // 预测未来成本
    ForecastCost(ctx context.Context, tenantID string, days int) (*CostForecast, error)
    
    // 获取定价规则
    GetPricingRules() *PricingRules
}

// 成本报告
type CostReport struct {
    TenantID   string      `json:"tenant_id"`
    Period     string      `json:"period"`      // daily, monthly
    StartDate  time.Time   `json:"start_date"`
    EndDate    time.Time   `json:"end_date"`
    Items      []CostItem  `json:"items"`
    TotalCost  float64     `json:"total_cost"`
    Currency   string      `json:"currency"`
}

// 成本项
type CostItem struct {
    Type   string  `json:"type"`   // storage, ingestion, query, network
    Tier   string  `json:"tier"`   // hot, warm, cold
    Usage  float64 `json:"usage"`
    Unit   string  `json:"unit"`
    Price  float64 `json:"price"`
    Cost   float64 `json:"cost"`
}
```

**预算管理器接口**:
```go
// 预算管理器接口
type BudgetManager interface {
    // 创建预算
    CreateBudget(ctx context.Context, budget *Budget) error
    
    // 更新预算
    UpdateBudget(ctx context.Context, budget *Budget) error
    
    // 查询预算进度
    GetBudgetProgress(ctx context.Context, budgetID string) (*BudgetProgress, error)
    
    // 检查预算告警
    CheckBudgetAlerts(ctx context.Context, tenantID string) ([]*BudgetAlert, error)
}

// 预算配置
type Budget struct {
    ID        string    `json:"id"`
    TenantID  string    `json:"tenant_id"`
    Name      string    `json:"name"`
    Amount    float64   `json:"amount"`
    Currency  string    `json:"currency"`
    Period    string    `json:"period"`    // monthly, yearly
    StartDate time.Time `json:"start_date"`
    EndDate   time.Time `json:"end_date"`
    Thresholds []float64 `json:"thresholds"` // [0.5, 0.8, 1.0]
}

// 预算进度
type BudgetProgress struct {
    BudgetID     string  `json:"budget_id"`
    CurrentCost  float64 `json:"current_cost"`
    BudgetAmount float64 `json:"budget_amount"`
    UsageRate    float64 `json:"usage_rate"`    // 0.0 - 1.0
    Remaining    float64 `json:"remaining"`
    Status       string  `json:"status"`        // normal, warning, critical
}
```

**优化引擎接口**:
```go
// 优化引擎接口
type OptimizationEngine interface {
    // 生成优化建议
    GenerateRecommendations(ctx context.Context, tenantID string) ([]*Recommendation, error)
    
    // 应用优化建议
    ApplyRecommendation(ctx context.Context, recommendationID string) error
    
    // 计算节省金额
    CalculateSavings(ctx context.Context, recommendation *Recommendation) (float64, error)
}

// 优化建议
type Recommendation struct {
    ID              string    `json:"id"`
    TenantID        string    `json:"tenant_id"`
    Type            string    `json:"type"`            // storage_tier, retention, index
    Title           string    `json:"title"`
    Description     string    `json:"description"`
    CurrentCost     float64   `json:"current_cost"`
    ProjectedCost   float64   `json:"projected_cost"`
    Savings         float64   `json:"savings"`
    SavingsPercent  float64   `json:"savings_percent"`
    Impact          string    `json:"impact"`
    Priority        string    `json:"priority"`        // high, medium, low
    Status          string    `json:"status"`          // pending, applied, dismissed
    CreatedAt       time.Time `json:"created_at"`
}
```

---

## 6. 数据设计

### 6.1 数据模型

**用量指标表 (usage_metrics)**:
```sql
CREATE TABLE usage_metrics (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    metric_type VARCHAR(50) NOT NULL,      -- storage, ingestion, query, export
    dimension VARCHAR(100),                 -- project, service, user
    dimension_value VARCHAR(255),
    value DECIMAL(20, 4) NOT NULL,
    unit VARCHAR(20) NOT NULL,              -- bytes, count, seconds
    recorded_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_usage_tenant_time ON usage_metrics(tenant_id, recorded_at);
CREATE INDEX idx_usage_type_dim ON usage_metrics(metric_type, dimension);
CREATE INDEX idx_usage_recorded ON usage_metrics(recorded_at);
```

**成本记录表 (cost_records)**:
```sql
CREATE TABLE cost_records (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    period_type VARCHAR(20) NOT NULL,      -- daily, monthly
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    cost_type VARCHAR(50) NOT NULL,        -- storage, ingestion, query, network
    cost_tier VARCHAR(50),                  -- hot, warm, cold
    usage_amount DECIMAL(20, 4) NOT NULL,
    usage_unit VARCHAR(20) NOT NULL,
    unit_price DECIMAL(10, 4) NOT NULL,
    total_cost DECIMAL(20, 4) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cost_tenant_period ON cost_records(tenant_id, period_start, period_end);
CREATE INDEX idx_cost_type ON cost_records(cost_type);
CREATE INDEX idx_cost_created ON cost_records(created_at);
```

**预算配置表 (budgets)**:
```sql
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(20, 4) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    period_type VARCHAR(20) NOT NULL,      -- monthly, yearly
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    alert_thresholds JSONB NOT NULL,       -- [0.5, 0.8, 1.0]
    status VARCHAR(20) DEFAULT 'active',   -- active, inactive
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_budget_tenant ON budgets(tenant_id);
CREATE INDEX idx_budget_period ON budgets(start_date, end_date);
```

**预算告警表 (budget_alerts)**:
```sql
CREATE TABLE budget_alerts (
    id BIGSERIAL PRIMARY KEY,
    budget_id UUID NOT NULL REFERENCES budgets(id),
    tenant_id UUID NOT NULL,
    alert_type VARCHAR(20) NOT NULL,       -- threshold_50, threshold_80, threshold_100
    threshold DECIMAL(5, 2) NOT NULL,
    current_cost DECIMAL(20, 4) NOT NULL,
    budget_amount DECIMAL(20, 4) NOT NULL,
    usage_rate DECIMAL(5, 4) NOT NULL,
    message TEXT,
    notified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alert_budget ON budget_alerts(budget_id);
CREATE INDEX idx_alert_tenant ON budget_alerts(tenant_id);
CREATE INDEX idx_alert_created ON budget_alerts(created_at);
```

**定价规则表 (pricing_rules)**:
```sql
CREATE TABLE pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(50) NOT NULL,        -- storage, ingestion, query, network
    pricing_model VARCHAR(50) NOT NULL,    -- pay_as_you_go, tiered, subscription
    rules JSONB NOT NULL,                   -- 定价规则JSON
    currency VARCHAR(10) DEFAULT 'USD',
    effective_from DATE NOT NULL,
    effective_to DATE,
    status VARCHAR(20) DEFAULT 'active',
    version INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pricing_type ON pricing_rules(rule_type);
CREATE INDEX idx_pricing_effective ON pricing_rules(effective_from, effective_to);
```

**优化建议表 (recommendations)**:
```sql
CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    recommendation_type VARCHAR(50) NOT NULL,  -- storage_tier, retention, index
    title VARCHAR(255) NOT NULL,
    description TEXT,
    current_cost DECIMAL(20, 4) NOT NULL,
    projected_cost DECIMAL(20, 4) NOT NULL,
    savings DECIMAL(20, 4) NOT NULL,
    savings_percent DECIMAL(5, 2) NOT NULL,
    impact TEXT,
    priority VARCHAR(20) NOT NULL,         -- high, medium, low
    status VARCHAR(20) DEFAULT 'pending',  -- pending, applied, dismissed
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_recommendation_tenant ON recommendations(tenant_id);
CREATE INDEX idx_recommendation_status ON recommendations(status);
CREATE INDEX idx_recommendation_priority ON recommendations(priority);
```

### 6.2 定价规则JSON示例

**存储定价规则**:
```json
{
  "storage": {
    "hot": {
      "price": 0.10,
      "unit": "GB/month",
      "description": "SSD存储，0-7天"
    },
    "warm": {
      "price": 0.03,
      "unit": "GB/month",
      "description": "HDD存储，8-30天"
    },
    "cold": {
      "price": 0.01,
      "unit": "GB/month",
      "description": "S3存储，31天-1年"
    },
    "archive": {
      "price": 0.004,
      "unit": "GB/month",
      "description": "Glacier存储，1年+"
    }
  }
}
```

**摄入阶梯定价规则**:
```json
{
  "ingestion": {
    "pricing_model": "tiered",
    "unit": "GB",
    "tiers": [
      {
        "up_to": 100,
        "price": 0.50,
        "description": "前100GB"
      },
      {
        "up_to": 1000,
        "price": 0.40,
        "description": "100-1000GB"
      },
      {
        "up_to": null,
        "price": 0.30,
        "description": "1000GB以上"
      }
    ]
  }
}
```

**查询定价规则**:
```json
{
  "query": {
    "price": 0.005,
    "unit": "GB scanned",
    "description": "按扫描数据量计费"
  }
}
```

### 6.3 缓存设计

**Redis缓存结构**:

```
# 实时用量缓存 (TTL: 1小时)
cost:usage:{tenant_id}:{metric_type}:{date} -> {value}

# 定价规则缓存 (TTL: 24小时)
cost:pricing:rules -> {pricing_rules_json}

# 预算状态缓存 (TTL: 1小时)
cost:budget:{budget_id}:progress -> {progress_json}

# 成本汇总缓存 (TTL: 6小时)
cost:summary:{tenant_id}:{period} -> {summary_json}

# 配置版本缓存
cost:config:version -> {version_number}
```

**缓存更新策略**:
- 用量数据: 采集时更新，1小时过期
- 定价规则: 修改时更新，24小时过期
- 预算进度: 成本计算时更新，1小时过期
- 成本汇总: 计算时更新，6小时过期

### 6.4 数据保留策略

| 数据类型 | 保留期限 | 归档策略 |
|----------|----------|----------|
| 用量指标(小时级) | 90天 | 聚合到日级后删除 |
| 用量指标(日级) | 2年 | 聚合到月级后删除 |
| 用量指标(月级) | 永久 | 不删除 |
| 成本记录 | 永久 | 不删除 |
| 预算告警 | 1年 | 归档到对象存储 |
| 优化建议 | 6个月 | 已应用/已忽略的删除 |

---

## 7. 安全设计

### 7.1 认证授权

**访问控制**:
- 成本数据按租户隔离，只能查看自己的成本
- 预算管理需要管理员权限
- 定价规则配置需要超级管理员权限
- API使用JWT认证，RBAC权限控制

**权限矩阵**:
| 角色 | 查看用量 | 查看成本 | 管理预算 | 配置定价 | 查看优化建议 |
|------|----------|----------|----------|----------|--------------|
| 普通用户 | ✓ | ✓ | ✗ | ✗ | ✓ |
| 项目管理员 | ✓ | ✓ | ✓ | ✗ | ✓ |
| 租户管理员 | ✓ | ✓ | ✓ | ✗ | ✓ |
| 系统管理员 | ✓ | ✓ | ✓ | ✓ | ✓ |

### 7.2 数据安全

**敏感数据保护**:
- 成本数据加密存储(PostgreSQL TDE)
- 定价规则加密传输(TLS 1.3)
- API密钥使用Vault管理
- 数据库连接使用SSL

**数据脱敏**:
- 日志中不记录具体金额
- 审计日志中脱敏敏感字段
- 导出数据时可选脱敏

### 7.3 审计日志

**审计事件**:
```go
type AuditEvent struct {
    EventID    string    `json:"event_id"`
    EventType  string    `json:"event_type"`  // view_cost, update_budget, change_pricing
    TenantID   string    `json:"tenant_id"`
    UserID     string    `json:"user_id"`
    Action     string    `json:"action"`
    Resource   string    `json:"resource"`
    OldValue   string    `json:"old_value"`
    NewValue   string    `json:"new_value"`
    IPAddress  string    `json:"ip_address"`
    UserAgent  string    `json:"user_agent"`
    Result     string    `json:"result"`      // success, failure
    Timestamp  time.Time `json:"timestamp"`
}
```

**审计日志记录**:
- 所有成本查询操作
- 预算配置变更
- 定价规则变更
- 优化建议应用
- 配置热更新操作

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 用量采集延迟 | < 500ms | Prometheus histogram |
| 成本计算延迟 | < 250ms | Prometheus histogram |
| API响应时间(P95) | < 200ms | Prometheus histogram |
| API响应时间(P99) | < 500ms | Prometheus histogram |
| 用量数据写入TPS | > 1000 | Prometheus counter |
| 成本查询QPS | > 500 | Prometheus counter |
| 缓存命中率 | > 90% | Redis INFO stats |
| 数据库连接池使用率 | < 80% | pgBouncer stats |

### 8.2 优化策略

**查询优化**:
```sql
-- 使用分区表优化历史数据查询
CREATE TABLE usage_metrics_2026_01 PARTITION OF usage_metrics
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- 使用物化视图加速聚合查询
CREATE MATERIALIZED VIEW daily_cost_summary AS
SELECT 
    tenant_id,
    period_start,
    cost_type,
    SUM(total_cost) as total_cost
FROM cost_records
WHERE period_type = 'daily'
GROUP BY tenant_id, period_start, cost_type;

CREATE INDEX idx_daily_summary ON daily_cost_summary(tenant_id, period_start);

-- 定时刷新物化视图
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_cost_summary;
```

**缓存优化**:
- 热点数据使用Redis缓存
- 定价规则全量缓存
- 预算进度缓存
- 成本汇总缓存
- 使用缓存预热避免冷启动

**批量处理优化**:
```go
// 批量写入用量数据
func (c *UsageCollector) batchRecordUsage(ctx context.Context, metrics []*UsageMetric) error {
    const batchSize = 1000
    
    for i := 0; i < len(metrics); i += batchSize {
        end := i + batchSize
        if end > len(metrics) {
            end = len(metrics)
        }
        
        batch := metrics[i:end]
        
        // 使用COPY命令批量插入
        _, err := c.db.CopyFrom(
            ctx,
            pgx.Identifier{"usage_metrics"},
            []string{"tenant_id", "metric_type", "dimension", "dimension_value", "value", "unit", "recorded_at"},
            pgx.CopyFromSlice(len(batch), func(i int) ([]interface{}, error) {
                m := batch[i]
                return []interface{}{m.TenantID, m.MetricType, m.Dimension, m.DimensionValue, m.Value, m.Unit, m.RecordedAt}, nil
            }),
        )
        
        if err != nil {
            return err
        }
    }
    
    return nil
}
```

**并发优化**:
```go
// 并发采集多个数据源
func (c *UsageCollector) collectAllUsage(ctx context.Context) error {
    var wg sync.WaitGroup
    errChan := make(chan error, 4)
    
    // 并发采集
    wg.Add(4)
    go func() {
        defer wg.Done()
        if err := c.CollectStorageUsage(ctx); err != nil {
            errChan <- err
        }
    }()
    
    go func() {
        defer wg.Done()
        if err := c.CollectComputeUsage(ctx); err != nil {
            errChan <- err
        }
    }()
    
    go func() {
        defer wg.Done()
        if err := c.CollectNetworkUsage(ctx); err != nil {
            errChan <- err
        }
    }()
    
    go func() {
        defer wg.Done()
        if err := c.CollectIndexUsage(ctx); err != nil {
            errChan <- err
        }
    }()
    
    wg.Wait()
    close(errChan)
    
    // 收集错误
    var errors []error
    for err := range errChan {
        errors = append(errors, err)
    }
    
    if len(errors) > 0 {
        return fmt.Errorf("采集失败: %v", errors)
    }
    
    return nil
}
```

### 8.3 容量规划

**数据增长预估**:
- 用量指标: 每租户每小时 ~100条记录
- 成本记录: 每租户每天 ~50条记录
- 预算告警: 每租户每月 ~10条记录
- 优化建议: 每租户每周 ~5条记录

**存储容量规划**:
```
假设100个租户:
- 用量指标: 100租户 × 100条/小时 × 24小时 × 90天 × 500字节 ≈ 10.8GB
- 成本记录: 100租户 × 50条/天 × 365天 × 300字节 ≈ 547MB
- 预算告警: 100租户 × 10条/月 × 12月 × 200字节 ≈ 2.4MB
- 优化建议: 100租户 × 5条/周 × 26周 × 1KB ≈ 13MB

总计: ~12GB/年 (100租户)
```

**数据库资源配置**:
| 租户规模 | CPU | 内存 | 存储 | 连接数 |
|----------|-----|------|------|--------|
| < 100 | 2核 | 4GB | 50GB | 50 |
| 100-500 | 4核 | 8GB | 200GB | 100 |
| 500-1000 | 8核 | 16GB | 500GB | 200 |
| > 1000 | 16核 | 32GB | 1TB | 500 |

---

## 9. 部署方案

### 9.1 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes集群                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Cost Management Service (Deployment)                 │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │  │
│  │  │   Pod 1     │  │   Pod 2     │  │   Pod 3     │   │  │
│  │  │  2核/4GB    │  │  2核/4GB    │  │  2核/4GB    │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Usage Collector (CronJob)                            │  │
│  │  ┌─────────────┐                                      │  │
│  │  │   Job       │  每小时执行一次                       │  │
│  │  │  1核/2GB    │  采集用量数据                         │  │
│  │  └─────────────┘                                      │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Cost Calculator (CronJob)                            │  │
│  │  ┌─────────────┐                                      │  │
│  │  │   Job       │  每天凌晨1点执行                      │  │
│  │  │  2核/4GB    │  计算成本                            │  │
│  │  └─────────────┘                                      │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Optimization Engine (CronJob)                        │  │
│  │  ┌─────────────┐                                      │  │
│  │  │   Job       │  每周一次                            │  │
│  │  │  2核/4GB    │  生成优化建议                         │  │
│  │  └─────────────┘                                      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  PostgreSQL (StatefulSet)                             │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │  │
│  │  │  Primary    │  │  Replica 1  │  │  Replica 2  │   │  │
│  │  │  4核/8GB    │  │  4核/8GB    │  │  4核/8GB    │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Redis (StatefulSet)                                  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │  │
│  │  │  Master     │  │  Replica 1  │  │  Replica 2  │   │  │
│  │  │  2核/4GB    │  │  2核/4GB    │  │  2核/4GB    │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 资源配置

**Cost Management Service**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cost-management
  namespace: log-system
spec:
  replicas: 3
  selector:
    matchLabels:
      app: cost-management
  template:
    metadata:
      labels:
        app: cost-management
    spec:
      containers:
      - name: cost-management
        image: log-system/cost-management:v1.0
        resources:
          requests:
            cpu: 1000m
            memory: 2Gi
          limits:
            cpu: 2000m
            memory: 4Gi
        env:
        - name: DB_HOST
          value: postgresql
        - name: REDIS_HOST
          value: redis
        - name: LOG_LEVEL
          value: info
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
```

**Usage Collector CronJob**:
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: usage-collector
  namespace: log-system
spec:
  schedule: "0 * * * *"  # 每小时执行
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: collector
            image: log-system/usage-collector:v1.0
            resources:
              requests:
                cpu: 500m
                memory: 1Gi
              limits:
                cpu: 1000m
                memory: 2Gi
            env:
            - name: DB_HOST
              value: postgresql
            - name: REDIS_HOST
              value: redis
          restartPolicy: OnFailure
```

**Cost Calculator CronJob**:
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cost-calculator
  namespace: log-system
spec:
  schedule: "0 1 * * *"  # 每天凌晨1点执行
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: calculator
            image: log-system/cost-calculator:v1.0
            resources:
              requests:
                cpu: 1000m
                memory: 2Gi
              limits:
                cpu: 2000m
                memory: 4Gi
            env:
            - name: DB_HOST
              value: postgresql
            - name: REDIS_HOST
              value: redis
          restartPolicy: OnFailure
```

### 9.3 发布策略

**滚动更新**:
- 使用Kubernetes滚动更新
- maxSurge: 1 (最多多1个Pod)
- maxUnavailable: 0 (保证服务可用)
- 更新间隔: 30秒

**灰度发布**:
1. 部署新版本到1个Pod
2. 观察监控指标30分钟
3. 如无异常，逐步扩展到50%
4. 再观察30分钟
5. 全量发布

**回滚策略**:
- 保留最近3个版本
- 发现问题立即回滚
- 回滚时间 < 5分钟

---

## 10. 监控与运维

### 10.1 监控指标

**业务指标**:
```prometheus
# 用量采集指标
cost_usage_collection_total{tenant_id, metric_type} counter
cost_usage_collection_duration_seconds{tenant_id, metric_type} histogram
cost_usage_collection_errors_total{tenant_id, metric_type, error_type} counter

# 成本计算指标
cost_calculation_total{tenant_id, period_type} counter
cost_calculation_duration_seconds{tenant_id, period_type} histogram
cost_calculation_errors_total{tenant_id, error_type} counter
cost_total_amount{tenant_id, cost_type, currency} gauge

# 预算指标
cost_budget_usage_rate{tenant_id, budget_id} gauge
cost_budget_alerts_total{tenant_id, budget_id, alert_type} counter
cost_budget_exceeded_total{tenant_id, budget_id} counter

# 优化建议指标
cost_recommendations_generated_total{tenant_id, recommendation_type} counter
cost_recommendations_applied_total{tenant_id, recommendation_type} counter
cost_savings_total{tenant_id, recommendation_type, currency} gauge

# API指标
cost_api_requests_total{method, endpoint, status} counter
cost_api_duration_seconds{method, endpoint} histogram
cost_api_errors_total{method, endpoint, error_type} counter
```

**系统指标**:
```prometheus
# 数据库指标
cost_db_connections_active gauge
cost_db_connections_idle gauge
cost_db_query_duration_seconds{query_type} histogram
cost_db_errors_total{error_type} counter

# 缓存指标
cost_cache_hits_total{cache_type} counter
cost_cache_misses_total{cache_type} counter
cost_cache_hit_rate{cache_type} gauge
cost_cache_size_bytes{cache_type} gauge

# 队列指标
cost_queue_size{queue_name} gauge
cost_queue_processing_duration_seconds{queue_name} histogram
```

### 10.2 告警规则（支持热更新）

**内置告警规则**:
```json
{
  "alert_rules": [
    {
      "id": "budget-exceeded",
      "name": "预算超支告警",
      "description": "当预算使用率超过100%时触发",
      "enabled": true,
      "type": "budget",
      "condition": {
        "metric": "budget_usage_rate",
        "operator": ">",
        "threshold": 1.0,
        "duration": "5m",
        "aggregation": "avg"
      },
      "actions": [
        {
          "type": "email",
          "target": "admin@example.com",
          "params": {
            "subject": "【严重】预算超支告警",
            "priority": "high"
          }
        },
        {
          "type": "dingtalk",
          "target": "default",
          "params": {
            "at_all": true
          }
        }
      ],
      "cooldown": "1h",
      "labels": {
        "severity": "critical",
        "category": "budget"
      }
    },
    {
      "id": "budget-warning",
      "name": "预算预警",
      "description": "当预算使用率超过80%时触发",
      "enabled": true,
      "type": "budget",
      "condition": {
        "metric": "budget_usage_rate",
        "operator": ">",
        "threshold": 0.8,
        "duration": "10m",
        "aggregation": "avg"
      },
      "actions": [
        {
          "type": "email",
          "target": "admin@example.com",
          "params": {
            "subject": "【警告】预算预警",
            "priority": "medium"
          }
        }
      ],
      "cooldown": "6h",
      "labels": {
        "severity": "warning",
        "category": "budget"
      }
    },
    {
      "id": "cost-spike",
      "name": "成本突增告警",
      "description": "当日成本比昨日增长超过50%时触发",
      "enabled": true,
      "type": "cost_spike",
      "condition": {
        "metric": "daily_cost_growth",
        "operator": ">",
        "threshold": 0.5,
        "duration": "1h",
        "aggregation": "avg"
      },
      "actions": [
        {
          "type": "email",
          "target": "admin@example.com"
        },
        {
          "type": "webhook",
          "target": "https://api.example.com/alerts",
          "params": {
            "method": "POST"
          }
        }
      ],
      "cooldown": "12h",
      "labels": {
        "severity": "warning",
        "category": "cost"
      }
    },
    {
      "id": "usage-anomaly",
      "name": "用量异常告警",
      "description": "当存储用量异常增长时触发",
      "enabled": true,
      "type": "anomaly",
      "condition": {
        "metric": "storage_usage_growth",
        "operator": ">",
        "threshold": 2.0,
        "duration": "30m",
        "aggregation": "avg",
        "filters": {
          "metric_type": "storage"
        }
      },
      "actions": [
        {
          "type": "email",
          "target": "ops@example.com"
        }
      ],
      "cooldown": "6h",
      "labels": {
        "severity": "warning",
        "category": "usage"
      }
    }
  ]
}
```

**自定义告警规则示例**:

1. **存储成本超限告警**:
```json
{
  "id": "storage-cost-limit",
  "name": "存储成本超限",
  "description": "当月存储成本超过5000元时告警",
  "enabled": true,
  "type": "cost_spike",
  "condition": {
    "metric": "monthly_cost",
    "operator": ">",
    "threshold": 5000,
    "duration": "1h",
    "aggregation": "sum",
    "filters": {
      "cost_type": "storage"
    }
  },
  "actions": [
    {
      "type": "email",
      "target": "finance@example.com",
      "params": {
        "subject": "存储成本超限告警"
      }
    },
    {
      "type": "dingtalk",
      "target": "default"
    }
  ],
  "cooldown": "24h",
  "labels": {
    "severity": "warning",
    "department": "finance"
  }
}
```

2. **查询成本异常告警**:
```json
{
  "id": "query-cost-anomaly",
  "name": "查询成本异常",
  "description": "当日查询成本超过平均值3倍时告警",
  "enabled": true,
  "type": "anomaly",
  "condition": {
    "metric": "daily_cost",
    "operator": ">",
    "threshold": 3.0,
    "duration": "2h",
    "aggregation": "avg",
    "filters": {
      "cost_type": "query"
    }
  },
  "actions": [
    {
      "type": "webhook",
      "target": "https://api.example.com/cost-alerts",
      "params": {
        "method": "POST",
        "headers": {
          "Authorization": "Bearer xxx"
        }
      }
    }
  ],
  "cooldown": "6h",
  "labels": {
    "severity": "warning",
    "category": "query"
  }
}
```

3. **多租户成本对比告警**:
```json
{
  "id": "tenant-cost-comparison",
  "name": "租户成本对比告警",
  "description": "当某租户成本超过平均值2倍时告警",
  "enabled": true,
  "type": "anomaly",
  "condition": {
    "metric": "tenant_cost_ratio",
    "operator": ">",
    "threshold": 2.0,
    "duration": "1h",
    "aggregation": "avg"
  },
  "actions": [
    {
      "type": "email",
      "target": "admin@example.com"
    }
  ],
  "cooldown": "12h",
  "labels": {
    "severity": "info",
    "category": "analysis"
  }
}
```

**告警规则热更新操作**:

```bash
# 1. 创建新的告警规则
curl -X POST http://api/v1/cost/config/alert-rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "自定义告警",
    "description": "描述",
    "enabled": true,
    "type": "budget",
    "condition": {
      "metric": "budget_usage_rate",
      "operator": ">",
      "threshold": 0.9
    },
    "actions": [
      {
        "type": "email",
        "target": "user@example.com"
      }
    ],
    "cooldown": "1h"
  }'

# 2. 更新告警规则
curl -X PUT http://api/v1/cost/config/alert-rules/{rule_id} \
  -H "Content-Type: application/json" \
  -d '{
    "name": "更新后的告警",
    "enabled": true,
    "condition": {
      "metric": "budget_usage_rate",
      "operator": ">",
      "threshold": 0.85
    }
  }'

# 3. 启用/禁用告警规则
curl -X POST http://api/v1/cost/config/alert-rules/{rule_id}/toggle \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'

# 4. 删除告警规则
curl -X DELETE http://api/v1/cost/config/alert-rules/{rule_id}

# 5. 测试告警规则
curl -X POST http://api/v1/cost/config/alert-rules/{rule_id}/test

# 6. 查询所有告警规则
curl -X GET http://api/v1/cost/config/alert-rules
```

**告警通道配置（热更新）**:

```bash
# 更新告警通道配置
curl -X POST http://api/v1/cost/config/alert-channels \
  -H "Content-Type: application/json" \
  -d '{
    "email": {
      "enabled": true,
      "smtp_host": "smtp.example.com",
      "smtp_port": 587,
      "username": "alerts@example.com",
      "password": "xxx",
      "from": "alerts@example.com",
      "default_to": ["admin@example.com"]
    },
    "dingtalk": {
      "enabled": true,
      "webhook_url": "https://oapi.dingtalk.com/robot/send?access_token=xxx",
      "secret": "xxx",
      "at_mobiles": ["13800138000"],
      "is_at_all": false
    },
    "wechat": {
      "enabled": true,
      "webhook_url": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx"
    },
    "webhook": {
      "enabled": true,
      "default_url": "https://api.example.com/alerts",
      "headers": {
        "Authorization": "Bearer xxx"
      },
      "timeout": "10s"
    }
  }'
```

**告警规则执行引擎**:

```go
package cost

import (
    "context"
    "sync"
    "time"
)

type AlertManager struct {
    config        atomic.Value // *CostConfig
    configManager *ConfigManager
    db            *sql.DB
    redis         *redis.Client
    notifier      *Notifier
    
    // 告警冷却记录
    cooldownCache sync.Map // map[string]time.Time
}

func NewAlertManager(configManager *ConfigManager, db *sql.DB, redis *redis.Client) *AlertManager {
    am := &AlertManager{
        configManager: configManager,
        db:            db,
        redis:         redis,
        notifier:      NewNotifier(configManager),
    }
    
    // 加载初始配置
    am.config.Store(configManager.GetConfig())
    
    // 订阅配置变更
    go am.watchConfigChanges()
    
    return am
}

// 监听配置变更
func (am *AlertManager) watchConfigChanges() {
    ctx := context.Background()
    pubsub := am.redis.Subscribe(ctx, "config:cost:reload")
    defer pubsub.Close()
    
    for msg := range pubsub.Channel() {
        log.Info("告警管理器收到配置更新通知")
        
        // 重新加载配置
        newConfig := am.configManager.GetConfig()
        am.config.Store(newConfig)
        
        log.Info("告警规则已更新", "rules_count", len(newConfig.AlertRules))
    }
}

// 评估告警规则
func (am *AlertManager) EvaluateAlerts(ctx context.Context, tenantID string) error {
    config := am.config.Load().(*CostConfig)
    
    for _, rule := range config.AlertRules {
        // 跳过禁用的规则
        if !rule.Enabled {
            continue
        }
        
        // 检查冷却时间
        if am.isInCooldown(rule.ID) {
            continue
        }
        
        // 评估条件
        triggered, value, err := am.evaluateCondition(ctx, tenantID, &rule.Condition)
        if err != nil {
            log.Error("评估告警条件失败", "rule", rule.ID, "error", err)
            continue
        }
        
        if triggered {
            // 触发告警
            if err := am.triggerAlert(ctx, tenantID, &rule, value); err != nil {
                log.Error("触发告警失败", "rule", rule.ID, "error", err)
                continue
            }
            
            // 设置冷却时间
            am.setCooldown(rule.ID, rule.Cooldown)
        }
    }
    
    return nil
}

// 评估条件
func (am *AlertManager) evaluateCondition(ctx context.Context, tenantID string, condition *AlertCondition) (bool, float64, error) {
    // 查询指标值
    value, err := am.queryMetric(ctx, tenantID, condition)
    if err != nil {
        return false, 0, err
    }
    
    // 比较阈值
    triggered := false
    switch condition.Operator {
    case ">":
        triggered = value > condition.Threshold
    case "<":
        triggered = value < condition.Threshold
    case ">=":
        triggered = value >= condition.Threshold
    case "<=":
        triggered = value <= condition.Threshold
    case "==":
        triggered = value == condition.Threshold
    case "!=":
        triggered = value != condition.Threshold
    }
    
    return triggered, value, nil
}

// 触发告警
func (am *AlertManager) triggerAlert(ctx context.Context, tenantID string, rule *AlertRule, value float64) error {
    log.Info("触发告警", "rule", rule.Name, "tenant", tenantID, "value", value)
    
    // 记录告警历史
    if err := am.recordAlertHistory(ctx, tenantID, rule, value); err != nil {
        log.Error("记录告警历史失败", "error", err)
    }
    
    // 执行告警动作
    for _, action := range rule.Actions {
        if err := am.notifier.Send(ctx, &action, rule, tenantID, value); err != nil {
            log.Error("发送告警通知失败", "action", action.Type, "error", err)
        }
    }
    
    return nil
}

// 检查是否在冷却期
func (am *AlertManager) isInCooldown(ruleID string) bool {
    if val, ok := am.cooldownCache.Load(ruleID); ok {
        cooldownUntil := val.(time.Time)
        return time.Now().Before(cooldownUntil)
    }
    return false
}

// 设置冷却时间
func (am *AlertManager) setCooldown(ruleID string, duration time.Duration) {
    if duration > 0 {
        am.cooldownCache.Store(ruleID, time.Now().Add(duration))
    }
}
```

**告警规则配置文件（YAML备份方式）**:

如果Redis不可用，系统会从YAML文件加载告警规则：

```yaml
# configs/cost_alert_rules.yaml
alert_rules:
  - id: budget-exceeded
    name: 预算超支告警
    enabled: true
    type: budget
    condition:
      metric: budget_usage_rate
      operator: ">"
      threshold: 1.0
      duration: 5m
    actions:
      - type: email
        target: admin@example.com
      - type: dingtalk
        target: default
    cooldown: 1h
    
  - id: cost-spike
    name: 成本突增告警
    enabled: true
    type: cost_spike
    condition:
      metric: daily_cost_growth
      operator: ">"
      threshold: 0.5
      duration: 1h
    actions:
      - type: email
        target: admin@example.com
    cooldown: 12h

alert_channels:
  email:
    enabled: true
    smtp_host: smtp.example.com
    smtp_port: 587
    username: alerts@example.com
    from: alerts@example.com
  
  dingtalk:
    enabled: true
    webhook_url: ${DINGTALK_WEBHOOK_URL}
    secret: ${DINGTALK_SECRET}
```

**配置加载优先级**:
1. 优先从Redis加载（热更新）
2. Redis不可用时从PostgreSQL加载
3. 数据库不可用时从YAML文件加载
4. 所有方式都失败时使用内置默认规则

### 10.3 日志规范

**日志级别**:
- DEBUG: 详细调试信息
- INFO: 正常业务日志
- WARN: 警告信息(不影响功能)
- ERROR: 错误信息(影响功能)
- FATAL: 致命错误(服务停止)

**日志格式**:
```json
{
  "timestamp": "2026-01-31T10:00:00Z",
  "level": "INFO",
  "service": "cost-management",
  "component": "usage-collector",
  "tenant_id": "tenant-123",
  "trace_id": "abc123",
  "message": "用量采集完成",
  "metrics": {
    "storage_gb": 1024.5,
    "duration_ms": 450
  }
}
```

### 10.4 运维手册

**日常运维任务**:
1. 每日检查用量采集是否正常
2. 每日检查成本计算是否正常
3. 每周检查预算告警
4. 每月检查优化建议执行情况
5. 每月检查数据库存储空间

**故障处理流程**:
1. 用量采集失败
   - 检查ES/MinIO/Prometheus连接
   - 检查数据库连接
   - 查看错误日志
   - 手动触发补采集

2. 成本计算失败
   - 检查定价规则配置
   - 检查用量数据完整性
   - 查看错误日志
   - 手动触发重新计算

3. 预算告警失败
   - 检查预算配置
   - 检查通知渠道
   - 查看错误日志
   - 手动发送告警

**数据修复**:
```sql
-- 修复缺失的用量数据
INSERT INTO usage_metrics (tenant_id, metric_type, dimension, dimension_value, value, unit, recorded_at)
SELECT ...
FROM ...
WHERE NOT EXISTS (...);

-- 重新计算成本
DELETE FROM cost_records WHERE period_start = '2026-01-31';
-- 然后手动触发成本计算任务
```

---

## 11. 配置热更新详细设计

### 11.1 可热更新配置项

| 配置项 | 类型 | 默认值 | 说明 | 生效时间 |
|--------|------|--------|------|----------|
| cost_tracking_enabled | bool | true | 是否启用成本追踪 | 立即 |
| usage_collection_interval | duration | 1h | 用量采集间隔 | 下次采集 |
| cost_calculation_schedule | string | "0 1 * * *" | 成本计算Cron表达式 | 下次调度 |
| pricing_rules | object | {} | 定价规则配置 | 立即 |
| budget_alert_thresholds | array | [0.5, 0.8, 1.0] | 预算告警阈值 | 立即 |
| alert_rules | array | [] | 自定义告警规则 | 立即 |
| alert_channels | object | {} | 告警通知渠道配置 | 立即 |
| optimization_enabled | bool | true | 是否启用优化建议 | 立即 |
| optimization_schedule | string | "0 0 * * 0" | 优化建议生成Cron | 下次调度 |
| cache_ttl | duration | 1h | 缓存过期时间 | 立即 |
| batch_size | int | 1000 | 批量处理大小 | 立即 |
| max_concurrent_collectors | int | 10 | 最大并发采集器数 | 立即 |

### 11.2 热更新实现

**配置结构**:
```go
// 成本管理配置
type CostConfig struct {
    // 基础配置
    TrackingEnabled          bool          `json:"tracking_enabled"`
    UsageCollectionInterval  time.Duration `json:"usage_collection_interval"`
    CostCalculationSchedule  string        `json:"cost_calculation_schedule"`
    
    // 定价规则
    PricingRules            *PricingRules `json:"pricing_rules"`
    
    // 预算配置
    BudgetAlertThresholds   []float64     `json:"budget_alert_thresholds"`
    
    // 告警规则（热更新）
    AlertRules              []AlertRule   `json:"alert_rules"`
    AlertChannels           AlertChannels `json:"alert_channels"`
    
    // 优化配置
    OptimizationEnabled     bool          `json:"optimization_enabled"`
    OptimizationSchedule    string        `json:"optimization_schedule"`
    
    // 性能配置
    CacheTTL                time.Duration `json:"cache_ttl"`
    BatchSize               int           `json:"batch_size"`
    MaxConcurrentCollectors int           `json:"max_concurrent_collectors"`
    
    // 元数据
    Version                 int           `json:"version"`
    UpdatedAt               time.Time     `json:"updated_at"`
}

// 告警规则
type AlertRule struct {
    ID          string            `json:"id"`
    Name        string            `json:"name"`
    Description string            `json:"description"`
    Enabled     bool              `json:"enabled"`
    Type        string            `json:"type"`        // budget, usage, cost_spike, anomaly
    Condition   AlertCondition    `json:"condition"`
    Actions     []AlertAction     `json:"actions"`
    Cooldown    time.Duration     `json:"cooldown"`    // 告警冷却时间
    Labels      map[string]string `json:"labels"`
}

// 告警条件
type AlertCondition struct {
    Metric      string  `json:"metric"`       // budget_usage_rate, daily_cost, usage_growth
    Operator    string  `json:"operator"`     // >, <, >=, <=, ==
    Threshold   float64 `json:"threshold"`
    Duration    string  `json:"duration"`     // 持续时间，如 "5m", "1h"
    Aggregation string  `json:"aggregation"`  // sum, avg, max, min
    Filters     map[string]string `json:"filters"` // tenant_id, cost_type等过滤条件
}

// 告警动作
type AlertAction struct {
    Type    string                 `json:"type"`    // email, webhook, dingtalk, wechat, slack
    Target  string                 `json:"target"`  // 邮箱地址、Webhook URL等
    Params  map[string]interface{} `json:"params"`  // 额外参数
}

// 告警通知渠道配置
type AlertChannels struct {
    Email    EmailConfig    `json:"email"`
    Webhook  WebhookConfig  `json:"webhook"`
    DingTalk DingTalkConfig `json:"dingtalk"`
    WeChat   WeChatConfig   `json:"wechat"`
    Slack    SlackConfig    `json:"slack"`
}

// 邮件配置
type EmailConfig struct {
    Enabled    bool     `json:"enabled"`
    SMTPHost   string   `json:"smtp_host"`
    SMTPPort   int      `json:"smtp_port"`
    Username   string   `json:"username"`
    Password   string   `json:"password"`
    From       string   `json:"from"`
    DefaultTo  []string `json:"default_to"`
}

// Webhook配置
type WebhookConfig struct {
    Enabled     bool              `json:"enabled"`
    DefaultURL  string            `json:"default_url"`
    Headers     map[string]string `json:"headers"`
    Timeout     time.Duration     `json:"timeout"`
}

// 钉钉配置
type DingTalkConfig struct {
    Enabled      bool   `json:"enabled"`
    WebhookURL   string `json:"webhook_url"`
    Secret       string `json:"secret"`
    AtMobiles    []string `json:"at_mobiles"`
    IsAtAll      bool   `json:"is_at_all"`
}

// 企业微信配置
type WeChatConfig struct {
    Enabled    bool   `json:"enabled"`
    WebhookURL string `json:"webhook_url"`
}

// Slack配置
type SlackConfig struct {
    Enabled    bool   `json:"enabled"`
    WebhookURL string `json:"webhook_url"`
    Channel    string `json:"channel"`
}

// 定价规则
type PricingRules struct {
    Storage   map[string]PriceItem `json:"storage"`    // hot, warm, cold, archive
    Ingestion TieredPricing        `json:"ingestion"`
    Query     PriceItem            `json:"query"`
    Network   PriceItem            `json:"network"`
    Currency  string               `json:"currency"`
}

// 价格项
type PriceItem struct {
    Price       float64 `json:"price"`
    Unit        string  `json:"unit"`
    Description string  `json:"description"`
}

// 阶梯定价
type TieredPricing struct {
    Unit  string      `json:"unit"`
    Tiers []PriceTier `json:"tiers"`
}

// 价格档位
type PriceTier struct {
    UpTo        *float64 `json:"up_to"`        // nil表示无上限
    Price       float64  `json:"price"`
    Description string   `json:"description"`
}
```

**配置管理器**:
```go
package cost

import (
    "context"
    "encoding/json"
    "sync/atomic"
    "time"
    
    "github.com/go-redis/redis/v8"
    "github.com/sirupsen/logrus"
)

type ConfigManager struct {
    config      atomic.Value // *CostConfig
    redis       *redis.Client
    db          *sql.DB
    logger      *logrus.Logger
    stopChan    chan struct{}
}

func NewConfigManager(redis *redis.Client, db *sql.DB, logger *logrus.Logger) *ConfigManager {
    cm := &ConfigManager{
        redis:    redis,
        db:       db,
        logger:   logger,
        stopChan: make(chan struct{}),
    }
    
    // 加载初始配置
    if err := cm.loadConfig(); err != nil {
        logger.Fatal("加载配置失败", err)
    }
    
    // 启动配置监听
    go cm.watchConfigChanges()
    
    return cm
}

// 加载配置
func (cm *ConfigManager) loadConfig() error {
    ctx := context.Background()
    
    // 优先从Redis加载
    configJSON, err := cm.redis.Get(ctx, "cost:config").Result()
    if err == redis.Nil {
        // Redis中没有，从数据库加载
        return cm.loadConfigFromDB()
    } else if err != nil {
        return err
    }
    
    var config CostConfig
    if err := json.Unmarshal([]byte(configJSON), &config); err != nil {
        return err
    }
    
    // 验证配置
    if err := cm.validateConfig(&config); err != nil {
        cm.logger.Error("配置验证失败", err)
        return err
    }
    
    // 原子更新
    cm.config.Store(&config)
    
    cm.logger.Info("配置加载成功", "version", config.Version)
    
    return nil
}

// 从数据库加载配置
func (cm *ConfigManager) loadConfigFromDB() error {
    ctx := context.Background()
    
    var configJSON string
    err := cm.db.QueryRowContext(ctx, `
        SELECT config_data 
        FROM system_config 
        WHERE config_key = 'cost_management' 
        AND status = 'active'
        ORDER BY version DESC 
        LIMIT 1
    `).Scan(&configJSON)
    
    if err != nil {
        return err
    }
    
    var config CostConfig
    if err := json.Unmarshal([]byte(configJSON), &config); err != nil {
        return err
    }
    
    // 同步到Redis
    cm.redis.Set(ctx, "cost:config", configJSON, 24*time.Hour)
    
    // 原子更新
    cm.config.Store(&config)
    
    return nil
}

// 监听配置变更
func (cm *ConfigManager) watchConfigChanges() {
    ctx := context.Background()
    pubsub := cm.redis.Subscribe(ctx, "config:cost:reload")
    defer pubsub.Close()
    
    cm.logger.Info("开始监听配置变更")
    
    for {
        select {
        case msg := <-pubsub.Channel():
            cm.logger.Info("收到配置更新通知", "payload", msg.Payload)
            
            if err := cm.loadConfig(); err != nil {
                cm.logger.Error("重新加载配置失败", err)
                continue
            }
            
            cm.logger.Info("配置已更新")
            
        case <-cm.stopChan:
            cm.logger.Info("停止监听配置变更")
            return
        }
    }
}

// 验证配置
func (cm *ConfigManager) validateConfig(config *CostConfig) error {
    // 验证采集间隔
    if config.UsageCollectionInterval < time.Minute {
        return fmt.Errorf("采集间隔不能小于1分钟")
    }
    
    // 验证批量大小
    if config.BatchSize < 100 || config.BatchSize > 10000 {
        return fmt.Errorf("批量大小必须在100-10000之间")
    }
    
    // 验证并发数
    if config.MaxConcurrentCollectors < 1 || config.MaxConcurrentCollectors > 100 {
        return fmt.Errorf("最大并发数必须在1-100之间")
    }
    
    // 验证预算阈值
    for _, threshold := range config.BudgetAlertThresholds {
        if threshold <= 0 || threshold > 2.0 {
            return fmt.Errorf("预算阈值必须在0-2.0之间")
        }
    }
    
    // 验证定价规则
    if config.PricingRules != nil {
        if err := cm.validatePricingRules(config.PricingRules); err != nil {
            return err
        }
    }
    
    // 验证告警规则
    if err := cm.validateAlertRules(config.AlertRules); err != nil {
        return err
    }
    
    // 验证告警通道
    if err := cm.validateAlertChannels(&config.AlertChannels); err != nil {
        return err
    }
    
    return nil
}

// 验证告警规则
func (cm *ConfigManager) validateAlertRules(rules []AlertRule) error {
    for i, rule := range rules {
        // 验证规则ID
        if rule.ID == "" {
            return fmt.Errorf("告警规则 %d 缺少ID", i+1)
        }
        
        // 验证规则名称
        if rule.Name == "" {
            return fmt.Errorf("告警规则 %s 缺少名称", rule.ID)
        }
        
        // 验证规则类型
        validTypes := []string{"budget", "usage", "cost_spike", "anomaly"}
        if !contains(validTypes, rule.Type) {
            return fmt.Errorf("告警规则 %s 的类型无效: %s", rule.ID, rule.Type)
        }
        
        // 验证条件
        if err := cm.validateAlertCondition(&rule.Condition); err != nil {
            return fmt.Errorf("告警规则 %s 的条件无效: %v", rule.ID, err)
        }
        
        // 验证动作
        if len(rule.Actions) == 0 {
            return fmt.Errorf("告警规则 %s 至少需要一个动作", rule.ID)
        }
        
        for j, action := range rule.Actions {
            if err := cm.validateAlertAction(&action); err != nil {
                return fmt.Errorf("告警规则 %s 的动作 %d 无效: %v", rule.ID, j+1, err)
            }
        }
        
        // 验证冷却时间
        if rule.Cooldown < 0 {
            return fmt.Errorf("告警规则 %s 的冷却时间不能为负数", rule.ID)
        }
    }
    
    return nil
}

// 验证告警条件
func (cm *ConfigManager) validateAlertCondition(condition *AlertCondition) error {
    // 验证指标
    validMetrics := []string{
        "budget_usage_rate", "daily_cost", "monthly_cost", 
        "usage_growth", "cost_growth", "storage_usage",
    }
    if !contains(validMetrics, condition.Metric) {
        return fmt.Errorf("无效的指标: %s", condition.Metric)
    }
    
    // 验证操作符
    validOperators := []string{">", "<", ">=", "<=", "==", "!="}
    if !contains(validOperators, condition.Operator) {
        return fmt.Errorf("无效的操作符: %s", condition.Operator)
    }
    
    // 验证聚合方式
    if condition.Aggregation != "" {
        validAggregations := []string{"sum", "avg", "max", "min", "count"}
        if !contains(validAggregations, condition.Aggregation) {
            return fmt.Errorf("无效的聚合方式: %s", condition.Aggregation)
        }
    }
    
    return nil
}

// 验证告警动作
func (cm *ConfigManager) validateAlertAction(action *AlertAction) error {
    // 验证动作类型
    validTypes := []string{"email", "webhook", "dingtalk", "wechat", "slack"}
    if !contains(validTypes, action.Type) {
        return fmt.Errorf("无效的动作类型: %s", action.Type)
    }
    
    // 验证目标
    if action.Target == "" {
        return fmt.Errorf("动作目标不能为空")
    }
    
    // 根据类型验证目标格式
    switch action.Type {
    case "email":
        if !isValidEmail(action.Target) {
            return fmt.Errorf("无效的邮箱地址: %s", action.Target)
        }
    case "webhook":
        if !isValidURL(action.Target) {
            return fmt.Errorf("无效的Webhook URL: %s", action.Target)
        }
    }
    
    return nil
}

// 验证告警通道
func (cm *ConfigManager) validateAlertChannels(channels *AlertChannels) error {
    // 验证邮件配置
    if channels.Email.Enabled {
        if channels.Email.SMTPHost == "" {
            return fmt.Errorf("邮件配置缺少SMTP主机")
        }
        if channels.Email.SMTPPort <= 0 || channels.Email.SMTPPort > 65535 {
            return fmt.Errorf("邮件配置的SMTP端口无效")
        }
    }
    
    // 验证Webhook配置
    if channels.Webhook.Enabled {
        if channels.Webhook.DefaultURL != "" && !isValidURL(channels.Webhook.DefaultURL) {
            return fmt.Errorf("Webhook配置的默认URL无效")
        }
    }
    
    // 验证钉钉配置
    if channels.DingTalk.Enabled {
        if channels.DingTalk.WebhookURL == "" {
            return fmt.Errorf("钉钉配置缺少Webhook URL")
        }
        if !isValidURL(channels.DingTalk.WebhookURL) {
            return fmt.Errorf("钉钉配置的Webhook URL无效")
        }
    }
    
    // 验证企业微信配置
    if channels.WeChat.Enabled {
        if channels.WeChat.WebhookURL == "" {
            return fmt.Errorf("企业微信配置缺少Webhook URL")
        }
        if !isValidURL(channels.WeChat.WebhookURL) {
            return fmt.Errorf("企业微信配置的Webhook URL无效")
        }
    }
    
    // 验证Slack配置
    if channels.Slack.Enabled {
        if channels.Slack.WebhookURL == "" {
            return fmt.Errorf("Slack配置缺少Webhook URL")
        }
        if !isValidURL(channels.Slack.WebhookURL) {
            return fmt.Errorf("Slack配置的Webhook URL无效")
        }
    }
    
    return nil
}

// 验证定价规则
func (cm *ConfigManager) validatePricingRules(rules *PricingRules) error {
    // 验证存储定价
    for tier, price := range rules.Storage {
        if price.Price < 0 {
            return fmt.Errorf("存储层级 %s 的价格不能为负数", tier)
        }
    }
    
    // 验证阶梯定价
    for i, tier := range rules.Ingestion.Tiers {
        if tier.Price < 0 {
            return fmt.Errorf("摄入定价第 %d 档的价格不能为负数", i+1)
        }
        
        if i > 0 && tier.UpTo != nil {
            prevTier := rules.Ingestion.Tiers[i-1]
            if prevTier.UpTo != nil && *tier.UpTo <= *prevTier.UpTo {
                return fmt.Errorf("阶梯定价档位必须递增")
            }
        }
    }
    
    return nil
}

// 获取当前配置
func (cm *ConfigManager) GetConfig() *CostConfig {
    return cm.config.Load().(*CostConfig)
}

// 更新配置
func (cm *ConfigManager) UpdateConfig(ctx context.Context, newConfig *CostConfig) error {
    // 验证配置
    if err := cm.validateConfig(newConfig); err != nil {
        return err
    }
    
    // 增加版本号
    currentConfig := cm.GetConfig()
    newConfig.Version = currentConfig.Version + 1
    newConfig.UpdatedAt = time.Now()
    
    // 序列化配置
    configJSON, err := json.Marshal(newConfig)
    if err != nil {
        return err
    }
    
    // 保存到数据库
    _, err = cm.db.ExecContext(ctx, `
        INSERT INTO system_config (config_key, config_data, version, status, created_at)
        VALUES ('cost_management', $1, $2, 'active', NOW())
    `, string(configJSON), newConfig.Version)
    
    if err != nil {
        return err
    }
    
    // 更新Redis
    if err := cm.redis.Set(ctx, "cost:config", configJSON, 24*time.Hour).Err(); err != nil {
        return err
    }
    
    // 发布更新通知
    if err := cm.redis.Publish(ctx, "config:cost:reload", newConfig.Version).Err(); err != nil {
        return err
    }
    
    // 记录审计日志
    cm.logger.Info("配置已更新", 
        "old_version", currentConfig.Version,
        "new_version", newConfig.Version)
    
    return nil
}

// 停止配置管理器
func (cm *ConfigManager) Stop() {
    close(cm.stopChan)
}
```

### 11.3 热更新API

**更新定价规则**:
```go
// POST /api/v1/cost/config/pricing-rules
func (h *Handler) UpdatePricingRules(c *gin.Context) {
    var req struct {
        PricingRules *PricingRules `json:"pricing_rules"`
    }
    
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": "无效的请求参数"})
        return
    }
    
    // 获取当前配置
    config := h.configManager.GetConfig()
    
    // 创建新配置
    newConfig := *config
    newConfig.PricingRules = req.PricingRules
    
    // 更新配置
    if err := h.configManager.UpdateConfig(c.Request.Context(), &newConfig); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "message": "定价规则已更新",
        "version": newConfig.Version,
    })
}
```

**更新预算阈值**:
```go
// POST /api/v1/cost/config/budget-thresholds
func (h *Handler) UpdateBudgetThresholds(c *gin.Context) {
    var req struct {
        Thresholds []float64 `json:"thresholds"`
    }
    
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": "无效的请求参数"})
        return
    }
    
    // 获取当前配置
    config := h.configManager.GetConfig()
    
    // 创建新配置
    newConfig := *config
    newConfig.BudgetAlertThresholds = req.Thresholds
    
    // 更新配置
    if err := h.configManager.UpdateConfig(c.Request.Context(), &newConfig); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "message": "预算阈值已更新",
        "version": newConfig.Version,
    })
}
```

**创建告警规则（热更新）**:
```go
// POST /api/v1/cost/config/alert-rules
func (h *Handler) CreateAlertRule(c *gin.Context) {
    var rule AlertRule
    
    if err := c.ShouldBindJSON(&rule); err != nil {
        c.JSON(400, gin.H{"error": "无效的请求参数"})
        return
    }
    
    // 生成规则ID
    if rule.ID == "" {
        rule.ID = uuid.New().String()
    }
    
    // 获取当前配置
    config := h.configManager.GetConfig()
    
    // 检查规则ID是否已存在
    for _, r := range config.AlertRules {
        if r.ID == rule.ID {
            c.JSON(400, gin.H{"error": "告警规则ID已存在"})
            return
        }
    }
    
    // 创建新配置
    newConfig := *config
    newConfig.AlertRules = append(newConfig.AlertRules, rule)
    
    // 更新配置
    if err := h.configManager.UpdateConfig(c.Request.Context(), &newConfig); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "message": "告警规则已创建",
        "rule_id": rule.ID,
        "version": newConfig.Version,
    })
}
```

**更新告警规则（热更新）**:
```go
// PUT /api/v1/cost/config/alert-rules/:id
func (h *Handler) UpdateAlertRule(c *gin.Context) {
    ruleID := c.Param("id")
    
    var rule AlertRule
    if err := c.ShouldBindJSON(&rule); err != nil {
        c.JSON(400, gin.H{"error": "无效的请求参数"})
        return
    }
    
    rule.ID = ruleID
    
    // 获取当前配置
    config := h.configManager.GetConfig()
    
    // 查找并更新规则
    found := false
    newConfig := *config
    for i, r := range newConfig.AlertRules {
        if r.ID == ruleID {
            newConfig.AlertRules[i] = rule
            found = true
            break
        }
    }
    
    if !found {
        c.JSON(404, gin.H{"error": "告警规则不存在"})
        return
    }
    
    // 更新配置
    if err := h.configManager.UpdateConfig(c.Request.Context(), &newConfig); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "message": "告警规则已更新",
        "version": newConfig.Version,
    })
}
```

**删除告警规则（热更新）**:
```go
// DELETE /api/v1/cost/config/alert-rules/:id
func (h *Handler) DeleteAlertRule(c *gin.Context) {
    ruleID := c.Param("id")
    
    // 获取当前配置
    config := h.configManager.GetConfig()
    
    // 查找并删除规则
    found := false
    newConfig := *config
    newRules := make([]AlertRule, 0)
    for _, r := range newConfig.AlertRules {
        if r.ID != ruleID {
            newRules = append(newRules, r)
        } else {
            found = true
        }
    }
    
    if !found {
        c.JSON(404, gin.H{"error": "告警规则不存在"})
        return
    }
    
    newConfig.AlertRules = newRules
    
    // 更新配置
    if err := h.configManager.UpdateConfig(c.Request.Context(), &newConfig); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "message": "告警规则已删除",
        "version": newConfig.Version,
    })
}
```

**启用/禁用告警规则（热更新）**:
```go
// POST /api/v1/cost/config/alert-rules/:id/toggle
func (h *Handler) ToggleAlertRule(c *gin.Context) {
    ruleID := c.Param("id")
    
    var req struct {
        Enabled bool `json:"enabled"`
    }
    
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": "无效的请求参数"})
        return
    }
    
    // 获取当前配置
    config := h.configManager.GetConfig()
    
    // 查找并更新规则状态
    found := false
    newConfig := *config
    for i, r := range newConfig.AlertRules {
        if r.ID == ruleID {
            newConfig.AlertRules[i].Enabled = req.Enabled
            found = true
            break
        }
    }
    
    if !found {
        c.JSON(404, gin.H{"error": "告警规则不存在"})
        return
    }
    
    // 更新配置
    if err := h.configManager.UpdateConfig(c.Request.Context(), &newConfig); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    status := "已禁用"
    if req.Enabled {
        status = "已启用"
    }
    
    c.JSON(200, gin.H{
        "message": fmt.Sprintf("告警规则%s", status),
        "version": newConfig.Version,
    })
}
```

**查询告警规则列表**:
```go
// GET /api/v1/cost/config/alert-rules
func (h *Handler) ListAlertRules(c *gin.Context) {
    config := h.configManager.GetConfig()
    
    c.JSON(200, gin.H{
        "rules": config.AlertRules,
        "total": len(config.AlertRules),
        "version": config.Version,
    })
}
```

**更新告警通道配置（热更新）**:
```go
// POST /api/v1/cost/config/alert-channels
func (h *Handler) UpdateAlertChannels(c *gin.Context) {
    var channels AlertChannels
    
    if err := c.ShouldBindJSON(&channels); err != nil {
        c.JSON(400, gin.H{"error": "无效的请求参数"})
        return
    }
    
    // 获取当前配置
    config := h.configManager.GetConfig()
    
    // 创建新配置
    newConfig := *config
    newConfig.AlertChannels = channels
    
    // 更新配置
    if err := h.configManager.UpdateConfig(c.Request.Context(), &newConfig); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "message": "告警通道配置已更新",
        "version": newConfig.Version,
    })
}
```

**测试告警规则**:
```go
// POST /api/v1/cost/config/alert-rules/:id/test
func (h *Handler) TestAlertRule(c *gin.Context) {
    ruleID := c.Param("id")
    
    // 获取当前配置
    config := h.configManager.GetConfig()
    
    // 查找规则
    var rule *AlertRule
    for _, r := range config.AlertRules {
        if r.ID == ruleID {
            rule = &r
            break
        }
    }
    
    if rule == nil {
        c.JSON(404, gin.H{"error": "告警规则不存在"})
        return
    }
    
    // 执行测试告警
    if err := h.alertManager.TestAlert(c.Request.Context(), rule); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "message": "测试告警已发送",
        "rule_id": ruleID,
    })
}
```

### 11.4 配置回滚

**回滚到指定版本**:
```go
func (cm *ConfigManager) RollbackToVersion(ctx context.Context, version int) error {
    // 从数据库加载指定版本
    var configJSON string
    err := cm.db.QueryRowContext(ctx, `
        SELECT config_data 
        FROM system_config 
        WHERE config_key = 'cost_management' 
        AND version = $1
    `, version).Scan(&configJSON)
    
    if err != nil {
        return err
    }
    
    var config CostConfig
    if err := json.Unmarshal([]byte(configJSON), &config); err != nil {
        return err
    }
    
    // 验证配置
    if err := cm.validateConfig(&config); err != nil {
        return err
    }
    
    // 更新Redis
    if err := cm.redis.Set(ctx, "cost:config", configJSON, 24*time.Hour).Err(); err != nil {
        return err
    }
    
    // 发布更新通知
    if err := cm.redis.Publish(ctx, "config:cost:reload", version).Err(); err != nil {
        return err
    }
    
    cm.logger.Info("配置已回滚", "version", version)
    
    return nil
}
```

### 11.5 配置验收标准

**功能验收**:
- ✓ 配置修改后立即生效(< 100ms)
- ✓ 配置验证失败时保持原配置
- ✓ 支持配置版本管理
- ✓ 支持配置回滚
- ✓ 配置变更记录审计日志
- ✓ 告警规则支持热更新
- ✓ 告警规则支持启用/禁用
- ✓ 告警规则支持测试功能
- ✓ 告警通道支持热更新
- ✓ 支持多种告警通道（邮件/钉钉/企业微信/Webhook/Slack）

**性能验收**:
- ✓ 配置加载延迟 < 50ms
- ✓ 配置更新延迟 < 100ms
- ✓ 配置通知延迟 < 10ms
- ✓ 支持1000+ QPS的配置读取
- ✓ 告警规则评估延迟 < 100ms
- ✓ 告警通知发送延迟 < 5s

**可靠性验收**:
- ✓ Redis不可用时从数据库加载
- ✓ 数据库不可用时从YAML文件加载
- ✓ 配置验证失败时拒绝更新
- ✓ 配置更新失败时自动回滚
- ✓ 配置变更通知失败时重试
- ✓ 告警规则冷却机制正常工作
- ✓ 告警通知失败时重试

**告警规则验收**:
- ✓ 支持预算告警（超支、预警）
- ✓ 支持成本突增告警
- ✓ 支持用量异常告警
- ✓ 支持自定义告警条件
- ✓ 支持多种告警动作
- ✓ 支持告警冷却时间
- ✓ 支持告警规则标签
- ✓ 支持告警历史查询

### 11.6 不推荐热更新的配置

以下配置项**不推荐使用热更新**，应通过YAML文件更新并重启服务：

| 配置项 | 是否热更新 | 说明 |
|--------|-----------|------|
| database_connection_string | ❌ 不推荐 | 数据库连接串变更需要重建连接池，可能导致短暂服务中断 |
| redis_connection_string | ❌ 不推荐 | Redis连接串变更需要重建连接，影响缓存和Pub/Sub |
| elasticsearch_endpoints | ❌ 不推荐 | ES集群地址变更需要重建客户端，可能影响用量采集 |
| minio_endpoints | ❌ 不推荐 | MinIO地址变更需要重建客户端，可能影响用量采集 |
| prometheus_endpoint | ❌ 不推荐 | Prometheus地址变更需要重建客户端，可能影响指标采集 |
| tls_cert_path | ❌ 不推荐 | TLS证书路径变更需要重新加载证书，涉及安全性 |
| tls_key_path | ❌ 不推荐 | TLS密钥路径变更需要重新加载密钥，涉及安全性 |
| api_port | ❌ 不推荐 | API端口变更需要重启HTTP服务器 |
| grpc_port | ❌ 不推荐 | gRPC端口变更需要重启gRPC服务器 |
| max_db_connections | ⚠️ 谨慎 | 连接池大小大幅变更可能影响系统稳定性，建议重启 |

**配置覆盖率**: 52% (11/21项)

**不推荐热更新的原因**:

1. **网络连接配置** (database_connection_string, redis_connection_string, elasticsearch_endpoints, minio_endpoints, prometheus_endpoint)
   - 需要关闭现有连接并重新建立
   - 可能导致短暂的服务中断
   - 连接池需要完全重建
   - 可能存在未完成的请求

2. **安全凭证配置** (tls_cert_path, tls_key_path)
   - 涉及安全性，需要确保所有连接都使用新凭证
   - 证书加载失败可能导致服务不可用
   - 建议在维护窗口期间更新

3. **服务端口配置** (api_port, grpc_port)
   - 需要重启HTTP/gRPC服务器
   - 端口占用可能导致启动失败
   - 客户端需要更新连接地址

4. **资源限制配置** (max_db_connections)
   - 大幅变更可能影响系统稳定性
   - 需要评估系统资源是否充足
   - 建议在低峰期重启更新

**YAML配置文件示例**:

```yaml
# configs/cost_management.yaml

# 数据库配置（不推荐热更新）
database:
  host: postgresql
  port: 5432
  database: log_system
  username: cost_user
  password: ${DB_PASSWORD}
  max_connections: 50
  max_idle_connections: 10
  connection_timeout: 30s

# Redis配置（不推荐热更新）
redis:
  host: redis
  port: 6379
  password: ${REDIS_PASSWORD}
  db: 0
  pool_size: 100

# Elasticsearch配置（不推荐热更新）
elasticsearch:
  endpoints:
    - http://elasticsearch:9200
  username: elastic
  password: ${ES_PASSWORD}
  timeout: 30s

# MinIO配置（不推荐热更新）
minio:
  endpoint: minio:9000
  access_key: ${MINIO_ACCESS_KEY}
  secret_key: ${MINIO_SECRET_KEY}
  use_ssl: false

# Prometheus配置（不推荐热更新）
prometheus:
  endpoint: http://prometheus:9090
  timeout: 30s

# TLS配置（不推荐热更新）
tls:
  enabled: true
  cert_file: /etc/certs/server.crt
  key_file: /etc/certs/server.key
  ca_file: /etc/certs/ca.crt

# 服务端口配置（不推荐热更新）
server:
  api_port: 8080
  grpc_port: 9090
  metrics_port: 9091

# 以下配置支持热更新（从Redis/PostgreSQL加载）
# 定价规则、预算阈值、告警规则、告警通道等
```

**配置更新流程**:

对于不推荐热更新的配置：
1. 修改YAML配置文件
2. 使用ConfigMap更新Kubernetes配置
3. 执行滚动重启：`kubectl rollout restart deployment/cost-management`
4. 验证服务正常运行
5. 检查监控指标

对于支持热更新的配置：
1. 通过API更新配置
2. 配置立即生效（< 100ms）
3. 无需重启服务
4. 检查配置版本

### 11.7 配置热更新扩展接口

为了支持未来的配置热更新扩展，预留以下接口：

```go
// ConfigUpdateHook 配置更新钩子接口
type ConfigUpdateHook interface {
    // OnConfigUpdate 配置更新回调
    // oldConfig: 旧配置
    // newConfig: 新配置
    // 返回错误时会触发回滚
    OnConfigUpdate(oldConfig, newConfig *CostConfig) error
    
    // GetHookName 获取钩子名称
    GetHookName() string
    
    // GetPriority 获取钩子优先级（数字越小优先级越高）
    GetPriority() int
}

// ConfigValidator 配置验证器接口
type ConfigValidator interface {
    // Validate 验证配置
    Validate(config *CostConfig) error
    
    // GetValidatorName 获取验证器名称
    GetValidatorName() string
}

// ConfigLoader 配置加载器接口
type ConfigLoader interface {
    // LoadConfig 加载配置
    LoadConfig(ctx context.Context) (*CostConfig, error)
    
    // SaveConfig 保存配置
    SaveConfig(ctx context.Context, config *CostConfig) error
    
    // GetLoaderName 获取加载器名称
    GetLoaderName() string
    
    // GetPriority 获取加载器优先级（数字越小优先级越高）
    GetPriority() int
}

// AlertRuleEvaluator 告警规则评估器接口
type AlertRuleEvaluator interface {
    // Evaluate 评估告警规则
    Evaluate(ctx context.Context, rule *AlertRule, tenantID string) (bool, float64, error)
    
    // GetEvaluatorName 获取评估器名称
    GetEvaluatorName() string
    
    // SupportedMetrics 支持的指标列表
    SupportedMetrics() []string
}

// AlertNotifier 告警通知器接口
type AlertNotifier interface {
    // Send 发送告警通知
    Send(ctx context.Context, action *AlertAction, rule *AlertRule, tenantID string, value float64) error
    
    // GetNotifierName 获取通知器名称
    GetNotifierName() string
    
    // SupportedTypes 支持的通知类型
    SupportedTypes() []string
}

// 扩展配置管理器
type ExtendedConfigManager struct {
    *ConfigManager
    hooks      []ConfigUpdateHook
    validators []ConfigValidator
    loaders    []ConfigLoader
    evaluators map[string]AlertRuleEvaluator
    notifiers  map[string]AlertNotifier
}

// RegisterHook 注册配置更新钩子
func (ecm *ExtendedConfigManager) RegisterHook(hook ConfigUpdateHook) {
    ecm.hooks = append(ecm.hooks, hook)
    // 按优先级排序
    sort.Slice(ecm.hooks, func(i, j int) bool {
        return ecm.hooks[i].GetPriority() < ecm.hooks[j].GetPriority()
    })
}

// RegisterValidator 注册配置验证器
func (ecm *ExtendedConfigManager) RegisterValidator(validator ConfigValidator) {
    ecm.validators = append(ecm.validators, validator)
}

// RegisterLoader 注册配置加载器
func (ecm *ExtendedConfigManager) RegisterLoader(loader ConfigLoader) {
    ecm.loaders = append(ecm.loaders, loader)
    // 按优先级排序
    sort.Slice(ecm.loaders, func(i, j int) bool {
        return ecm.loaders[i].GetPriority() < ecm.loaders[j].GetPriority()
    })
}

// RegisterEvaluator 注册告警规则评估器
func (ecm *ExtendedConfigManager) RegisterEvaluator(evaluator AlertRuleEvaluator) {
    for _, metric := range evaluator.SupportedMetrics() {
        ecm.evaluators[metric] = evaluator
    }
}

// RegisterNotifier 注册告警通知器
func (ecm *ExtendedConfigManager) RegisterNotifier(notifier AlertNotifier) {
    for _, notifierType := range notifier.SupportedTypes() {
        ecm.notifiers[notifierType] = notifier
    }
}

// UpdateConfigWithHooks 更新配置（调用所有钩子）
func (ecm *ExtendedConfigManager) UpdateConfigWithHooks(ctx context.Context, newConfig *CostConfig) error {
    oldConfig := ecm.GetConfig()
    
    // 1. 执行所有验证器
    for _, validator := range ecm.validators {
        if err := validator.Validate(newConfig); err != nil {
            return fmt.Errorf("验证器 %s 失败: %w", validator.GetValidatorName(), err)
        }
    }
    
    // 2. 执行所有钩子（按优先级）
    for _, hook := range ecm.hooks {
        if err := hook.OnConfigUpdate(oldConfig, newConfig); err != nil {
            return fmt.Errorf("钩子 %s 失败: %w", hook.GetHookName(), err)
        }
    }
    
    // 3. 更新配置
    return ecm.UpdateConfig(ctx, newConfig)
}

// LoadConfigWithLoaders 使用加载器加载配置
func (ecm *ExtendedConfigManager) LoadConfigWithLoaders(ctx context.Context) (*CostConfig, error) {
    // 按优先级尝试各个加载器
    for _, loader := range ecm.loaders {
        config, err := loader.LoadConfig(ctx)
        if err == nil {
            ecm.logger.Info("配置加载成功", "loader", loader.GetLoaderName())
            return config, nil
        }
        ecm.logger.Warn("配置加载失败", "loader", loader.GetLoaderName(), "error", err)
    }
    
    return nil, fmt.Errorf("所有配置加载器都失败")
}
```

**扩展示例**:

```go
// 示例1: 自定义配置验证器
type BusinessRuleValidator struct{}

func (brv *BusinessRuleValidator) Validate(config *CostConfig) error {
    // 验证业务规则
    // 例如：确保预算阈值递增
    thresholds := config.BudgetAlertThresholds
    for i := 1; i < len(thresholds); i++ {
        if thresholds[i] <= thresholds[i-1] {
            return fmt.Errorf("预算阈值必须递增")
        }
    }
    
    // 验证定价规则的合理性
    if config.PricingRules != nil {
        for tier, price := range config.PricingRules.Storage {
            if price.Price > 1.0 {
                return fmt.Errorf("存储层级 %s 的价格过高: %.2f", tier, price.Price)
            }
        }
    }
    
    return nil
}

func (brv *BusinessRuleValidator) GetValidatorName() string {
    return "BusinessRuleValidator"
}

// 示例2: 自定义配置更新钩子
type MetricsHook struct {
    metricsClient *MetricsClient
}

func (mh *MetricsHook) OnConfigUpdate(oldConfig, newConfig *CostConfig) error {
    // 记录配置变更指标
    mh.metricsClient.RecordConfigChange(
        "cost_management",
        oldConfig.Version,
        newConfig.Version,
    )
    
    // 记录具体变更
    if oldConfig.TrackingEnabled != newConfig.TrackingEnabled {
        mh.metricsClient.RecordConfigFieldChange("tracking_enabled", 
            fmt.Sprint(oldConfig.TrackingEnabled), 
            fmt.Sprint(newConfig.TrackingEnabled))
    }
    
    return nil
}

func (mh *MetricsHook) GetHookName() string {
    return "MetricsHook"
}

func (mh *MetricsHook) GetPriority() int {
    return 100 // 低优先级，最后执行
}

// 示例3: 自定义配置加载器（从Consul加载）
type ConsulConfigLoader struct {
    consulClient *consul.Client
}

func (ccl *ConsulConfigLoader) LoadConfig(ctx context.Context) (*CostConfig, error) {
    key := "cost_management/config"
    pair, _, err := ccl.consulClient.KV().Get(key, nil)
    if err != nil {
        return nil, err
    }
    
    if pair == nil {
        return nil, fmt.Errorf("配置不存在")
    }
    
    var config CostConfig
    if err := json.Unmarshal(pair.Value, &config); err != nil {
        return nil, err
    }
    
    return &config, nil
}

func (ccl *ConsulConfigLoader) SaveConfig(ctx context.Context, config *CostConfig) error {
    key := "cost_management/config"
    data, err := json.Marshal(config)
    if err != nil {
        return err
    }
    
    _, err = ccl.consulClient.KV().Put(&consul.KVPair{
        Key:   key,
        Value: data,
    }, nil)
    
    return err
}

func (ccl *ConsulConfigLoader) GetLoaderName() string {
    return "ConsulConfigLoader"
}

func (ccl *ConsulConfigLoader) GetPriority() int {
    return 10 // 高优先级，优先尝试
}

// 示例4: 自定义告警规则评估器
type CustomMetricEvaluator struct {
    db *sql.DB
}

func (cme *CustomMetricEvaluator) Evaluate(ctx context.Context, rule *AlertRule, tenantID string) (bool, float64, error) {
    // 自定义指标评估逻辑
    // 例如：评估"月度成本增长率"指标
    
    var currentMonthCost, lastMonthCost float64
    
    // 查询当月成本
    err := cme.db.QueryRowContext(ctx, `
        SELECT COALESCE(SUM(total_cost), 0)
        FROM cost_records
        WHERE tenant_id = $1
        AND period_start >= date_trunc('month', CURRENT_DATE)
    `, tenantID).Scan(&currentMonthCost)
    
    if err != nil {
        return false, 0, err
    }
    
    // 查询上月成本
    err = cme.db.QueryRowContext(ctx, `
        SELECT COALESCE(SUM(total_cost), 0)
        FROM cost_records
        WHERE tenant_id = $1
        AND period_start >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
        AND period_start < date_trunc('month', CURRENT_DATE)
    `, tenantID).Scan(&lastMonthCost)
    
    if err != nil {
        return false, 0, err
    }
    
    // 计算增长率
    var growthRate float64
    if lastMonthCost > 0 {
        growthRate = (currentMonthCost - lastMonthCost) / lastMonthCost
    }
    
    // 评估条件
    triggered := false
    switch rule.Condition.Operator {
    case ">":
        triggered = growthRate > rule.Condition.Threshold
    case "<":
        triggered = growthRate < rule.Condition.Threshold
    }
    
    return triggered, growthRate, nil
}

func (cme *CustomMetricEvaluator) GetEvaluatorName() string {
    return "CustomMetricEvaluator"
}

func (cme *CustomMetricEvaluator) SupportedMetrics() []string {
    return []string{"monthly_cost_growth", "cost_trend"}
}

// 示例5: 自定义告警通知器（Slack）
type SlackNotifier struct {
    webhookURL string
}

func (sn *SlackNotifier) Send(ctx context.Context, action *AlertAction, rule *AlertRule, tenantID string, value float64) error {
    // 构建Slack消息
    message := map[string]interface{}{
        "text": fmt.Sprintf("🚨 成本告警: %s", rule.Name),
        "blocks": []map[string]interface{}{
            {
                "type": "section",
                "text": map[string]string{
                    "type": "mrkdwn",
                    "text": fmt.Sprintf("*%s*\n%s", rule.Name, rule.Description),
                },
            },
            {
                "type": "section",
                "fields": []map[string]string{
                    {
                        "type": "mrkdwn",
                        "text": fmt.Sprintf("*租户ID:*\n%s", tenantID),
                    },
                    {
                        "type": "mrkdwn",
                        "text": fmt.Sprintf("*当前值:*\n%.2f", value),
                    },
                    {
                        "type": "mrkdwn",
                        "text": fmt.Sprintf("*阈值:*\n%.2f", rule.Condition.Threshold),
                    },
                    {
                        "type": "mrkdwn",
                        "text": fmt.Sprintf("*时间:*\n%s", time.Now().Format("2006-01-02 15:04:05")),
                    },
                },
            },
        },
    }
    
    // 发送到Slack
    data, _ := json.Marshal(message)
    resp, err := http.Post(sn.webhookURL, "application/json", bytes.NewBuffer(data))
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != 200 {
        return fmt.Errorf("Slack通知失败: %d", resp.StatusCode)
    }
    
    return nil
}

func (sn *SlackNotifier) GetNotifierName() string {
    return "SlackNotifier"
}

func (sn *SlackNotifier) SupportedTypes() []string {
    return []string{"slack"}
}

// 使用扩展接口
func main() {
    // 创建扩展配置管理器
    ecm := &ExtendedConfigManager{
        ConfigManager: NewConfigManager(redis, db, logger),
        evaluators:    make(map[string]AlertRuleEvaluator),
        notifiers:     make(map[string]AlertNotifier),
    }
    
    // 注册自定义验证器
    ecm.RegisterValidator(&BusinessRuleValidator{})
    
    // 注册自定义钩子
    ecm.RegisterHook(&MetricsHook{
        metricsClient: metricsClient,
    })
    
    // 注册自定义加载器
    ecm.RegisterLoader(&ConsulConfigLoader{
        consulClient: consulClient,
    })
    
    // 注册自定义评估器
    ecm.RegisterEvaluator(&CustomMetricEvaluator{
        db: db,
    })
    
    // 注册自定义通知器
    ecm.RegisterNotifier(&SlackNotifier{
        webhookURL: "https://hooks.slack.com/services/xxx",
    })
}
```

**扩展点说明**:
1. **ConfigUpdateHook**: 在配置更新时执行自定义逻辑（如记录指标、发送通知等）
2. **ConfigValidator**: 添加自定义验证规则（如业务规则验证、合理性检查等）
3. **ConfigLoader**: 支持从多种配置源加载配置（如Consul、etcd、配置中心等）
4. **AlertRuleEvaluator**: 支持自定义告警指标评估逻辑
5. **AlertNotifier**: 支持自定义告警通知渠道
6. **优先级机制**: 钩子和加载器按优先级顺序执行，支持精细控制
7. **错误处理**: 任何钩子或验证器失败都会触发回滚，保证配置一致性

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 用量采集失败 | 中 | 高 | 重试机制、告警通知、手动补采 |
| 成本计算错误 | 低 | 高 | 数据验证、人工审核、回滚机制 |
| 定价规则错误 | 低 | 高 | 配置验证、灰度发布、快速回滚 |
| 数据库性能瓶颈 | 中 | 中 | 分区表、索引优化、读写分离 |
| 缓存失效 | 中 | 低 | 缓存预热、降级策略 |
| 预算告警延迟 | 低 | 中 | 实时监控、多渠道通知 |
| 优化建议不准确 | 中 | 低 | 人工审核、A/B测试 |

### 12.2 回滚方案

**配置回滚**:
```bash
# 查看配置历史
curl -X GET http://api/v1/cost/config/history

# 回滚到指定版本
curl -X POST http://api/v1/cost/config/rollback \
  -H "Content-Type: application/json" \
  -d '{"version": 10}'
```

**数据回滚**:
```sql
-- 备份当前数据
CREATE TABLE cost_records_backup AS 
SELECT * FROM cost_records WHERE period_start >= '2026-01-31';

-- 删除错误数据
DELETE FROM cost_records WHERE period_start >= '2026-01-31';

-- 恢复备份数据(如需要)
INSERT INTO cost_records SELECT * FROM cost_records_backup;
```

**服务回滚**:
```bash
# Kubernetes回滚到上一个版本
kubectl rollout undo deployment/cost-management -n log-system

# 回滚到指定版本
kubectl rollout undo deployment/cost-management -n log-system --to-revision=5

# 查看回滚状态
kubectl rollout status deployment/cost-management -n log-system
```

### 12.3 应急预案

**用量采集失败**:
1. 检查ES/MinIO/Prometheus连接状态
2. 查看错误日志定位问题
3. 手动触发补采集
4. 如无法恢复，使用历史数据估算

**成本计算异常**:
1. 暂停自动计算
2. 检查定价规则配置
3. 验证用量数据完整性
4. 手动计算并验证结果
5. 修复问题后恢复自动计算

**预算告警失败**:
1. 检查通知渠道配置
2. 手动发送告警通知
3. 修复通知服务
4. 补发遗漏的告警

**数据库故障**:
1. 切换到备库
2. 启用只读模式
3. 修复主库
4. 数据同步
5. 切回主库

---

## 13. 附录

### 13.1 术语表

| 术语 | 说明 |
|------|------|
| 用量指标 | 资源使用量的度量，如存储GB、查询次数等 |
| 成本记录 | 根据用量和定价规则计算出的成本数据 |
| 定价规则 | 定义如何将用量转换为成本的规则 |
| 阶梯定价 | 根据用量区间使用不同单价的定价模型 |
| 预算 | 设定的成本上限 |
| 预算进度 | 当前成本占预算的百分比 |
| 优化建议 | 基于使用模式生成的成本优化方案 |
| ROI | 投资回报率，优化建议的节省金额与实施成本的比值 |
| 热更新 | 无需重启服务即可更新配置 |

### 13.2 参考文档

- [AWS Cost Management](https://aws.amazon.com/aws-cost-management/)
- [GCP Cost Management](https://cloud.google.com/cost-management)
- [Azure Cost Management](https://azure.microsoft.com/en-us/products/cost-management/)
- [FinOps Foundation](https://www.finops.org/)
- [Cloud Cost Optimization Best Practices](https://www.cloudzero.com/blog/cloud-cost-optimization)

### 13.3 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-01-31 | v1.0 | 初稿，完整设计方案 | 系统架构团队 |
| 2026-02-01 | v1.1 | 补充不推荐热更新配置说明和扩展接口设计 | 系统架构团队 |

---

**文档结束**

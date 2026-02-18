# 模块二十四：成本管理

> **文档版本**: v1.0  
> **创建日期**: 2026-01-31  
> **所属模块**: 模块二十四：成本管理  
> **实施阶段**: Phase 3

---

## 模块概述

提供成本追踪和优化功能，帮助用户了解和控制日志管理的成本。

**成本构成分析**:

| 成本类型 | 计量单位 | 影响因素 |
|----------|----------|----------|
| 存储成本 | GB/月 | 日志量、保留期、压缩率 |
| 计算成本 | CPU 小时 | 查询量、分析任务 |
| 网络成本 | GB | 日志摄入、查询导出 |
| 索引成本 | GB | 索引字段数、索引策略 |

**模块架构**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Cost Management System                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   Usage Collector                     │   │
│  │  - 存储用量采集 (ES/MinIO)                           │   │
│  │  - 计算用量采集 (查询/分析)                          │   │
│  │  - 网络用量采集 (摄入/导出)                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   Cost Calculator                     │   │
│  │  - 按租户/项目/服务计算                              │   │
│  │  - 按时间维度聚合                                    │   │
│  │  - 成本预测                                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│         ┌────────────────┼────────────────┐                 │
│         ▼                ▼                ▼                 │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐          │
│  │  Dashboard │   │   Alerts   │   │  Reports   │          │
│  │  成本仪表盘 │   │  预算告警  │   │  成本报告  │          │
│  └────────────┘   └────────────┘   └────────────┘          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 需求 24-1：用量追踪 [Phase 3]

**用户故事**: 

作为技术经理，我希望能够实时追踪各维度的资源使用量，以便了解成本构成。

**验收标准**:

1. THE System SHALL 按租户追踪存储用量
2. THE System SHALL 按项目/服务追踪日志摄入量
3. THE System SHALL 按用户追踪查询量
4. THE System SHALL 支持历史用量查询
5. THE System SHALL 支持用量趋势分析

**数据模型**:

```sql
CREATE TABLE usage_metrics (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    metric_type VARCHAR(50) NOT NULL,  -- storage, ingestion, query, export
    dimension VARCHAR(100),             -- project, service, user
    dimension_value VARCHAR(255),
    value DECIMAL(20, 4) NOT NULL,
    unit VARCHAR(20) NOT NULL,          -- bytes, count, seconds
    recorded_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_usage_tenant_time ON usage_metrics(tenant_id, recorded_at);
CREATE INDEX idx_usage_type_dim ON usage_metrics(metric_type, dimension);
```

**实现方向**:

```go
// 用量采集器
package cost

type UsageCollector struct {
    esClient    *elasticsearch.Client
    minioClient *minio.Client
    db          *sql.DB
}

func (c *UsageCollector) CollectStorageUsage(ctx context.Context) error {
    // 采集 ES 索引大小
    indices, err := c.esClient.Cat.Indices(
        c.esClient.Cat.Indices.WithFormat("json"),
    )
    if err != nil {
        return err
    }

    for _, idx := range indices {
        tenantID := extractTenantID(idx.Index)
        c.recordUsage(ctx, tenantID, "storage", "es_index",
            idx.Index, idx.StoreSize, "bytes")
    }

    // 采集 MinIO 桶大小
    buckets, _ := c.minioClient.ListBuckets(ctx)
    for _, bucket := range buckets {
        size := c.calculateBucketSize(ctx, bucket.Name)
        tenantID := extractTenantID(bucket.Name)
        c.recordUsage(ctx, tenantID, "storage", "minio_bucket",
            bucket.Name, size, "bytes")
    }

    return nil
}

func (c *UsageCollector) recordUsage(ctx context.Context,
    tenantID, metricType, dimension, dimValue string,
    value float64, unit string) error {

    _, err := c.db.ExecContext(ctx, `
        INSERT INTO usage_metrics
        (tenant_id, metric_type, dimension, dimension_value, value, unit, recorded_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, tenantID, metricType, dimension, dimValue, value, unit)

    return err
}
```

---

## 需求 24-2：成本计算 [Phase 3]

**用户故事**: 

作为财务人员，我希望系统能够根据用量和定价规则自动计算成本。

**验收标准**:

1. THE System SHALL 支持多种定价模型（按量、阶梯、包年包月）
2. THE System SHALL 支持自定义定价规则
3. THE System SHALL 支持成本分摊（按项目/部门）
4. THE System SHALL 支持多币种

**定价配置示例**:

```json
{
  "pricing_rules": {
    "storage": {
      "hot": {"price": 0.10, "unit": "GB/月"},
      "warm": {"price": 0.03, "unit": "GB/月"},
      "cold": {"price": 0.01, "unit": "GB/月"}
    },
    "ingestion": {
      "price": 0.50,
      "unit": "GB",
      "tiers": [
        {"up_to": 100, "price": 0.50},
        {"up_to": 1000, "price": 0.40},
        {"up_to": null, "price": 0.30}
      ]
    },
    "query": {
      "price": 0.005,
      "unit": "GB scanned"
    }
  }
}
```

**实现方向**:

```go
// 成本计算器
package cost

type CostCalculator struct {
    db           *sql.DB
    pricingRules *PricingRules
}

func (c *CostCalculator) CalculateMonthlyCost(
    ctx context.Context, tenantID string, month time.Time,
) (*CostReport, error) {

    report := &CostReport{
        TenantID: tenantID,
        Month:    month,
        Items:    make([]CostItem, 0),
    }

    // 计算存储成本
    storageUsage, _ := c.getMonthlyUsage(ctx, tenantID, "storage", month)
    for tier, usage := range storageUsage {
        price := c.pricingRules.Storage[tier].Price
        cost := usage * price
        report.Items = append(report.Items, CostItem{
            Type:   "storage",
            Tier:   tier,
            Usage:  usage,
            Unit:   "GB",
            Price:  price,
            Cost:   cost,
        })
        report.TotalCost += cost
    }

    // 计算摄入成本（阶梯定价）
    ingestionGB, _ := c.getMonthlyUsage(ctx, tenantID, "ingestion", month)
    ingestionCost := c.calculateTieredCost(ingestionGB["total"],
        c.pricingRules.Ingestion.Tiers)
    report.Items = append(report.Items, CostItem{
        Type:  "ingestion",
        Usage: ingestionGB["total"],
        Unit:  "GB",
        Cost:  ingestionCost,
    })
    report.TotalCost += ingestionCost

    return report, nil
}
```

---

## 需求 24-3：预算管理 [Phase 3]

**用户故事**: 

作为技术经理，我希望能够设置和监控成本预算，避免超支。

**验收标准**:

1. THE System SHALL 支持按租户/项目设置月度预算
2. THE System SHALL 追踪预算使用进度
3. THE System SHALL 在预算使用达到 50%/80%/100% 时发送预警
4. THE System SHALL 支持预算调整历史

**实现方向**:

使用 PostgreSQL 存储预算配置，定时任务检查预算使用情况并发送告警。

---

## 需求 24-4：成本优化建议 [Phase 3]

**用户故事**: 

作为技术经理，我希望系统能够基于使用模式提供成本优化建议。

**验收标准**:

1. THE System SHALL 识别低使用率资源
2. THE System SHALL 推荐存储层级调整
3. THE System SHALL 推荐保留策略优化
4. THE System SHALL 推荐索引策略优化
5. THE System SHALL 预估优化后节省金额

**优化建议示例**:

```json
{
  "recommendations": [
    {
      "type": "storage_tier",
      "description": "将 30 天前的日志从热存储迁移到温存储",
      "current_cost": 150.00,
      "projected_cost": 45.00,
      "savings": 105.00,
      "impact": "查询延迟增加 ~500ms"
    },
    {
      "type": "retention",
      "description": "DEBUG 级别日志保留期从 90 天缩短到 30 天",
      "current_cost": 80.00,
      "projected_cost": 27.00,
      "savings": 53.00,
      "impact": "无法查询 30 天前的 DEBUG 日志"
    }
  ]
}
```

**实现方向**:

使用机器学习分析历史使用模式，识别优化机会并生成建议。

---

## 配置热更新

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| cost_tracking_enabled | bool | false | 是否启用成本追踪 |
| pricing_rules | object | {} | 定价规则配置 |
| budget_alert_thresholds | array | [0.5, 0.8, 1.0] | 预算告警阈值 |

**热更新机制**:
- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效
- 回滚策略: 配置验证失败时保持原配置

---

## 相关需求

- 需求 55: 成本追踪和优化

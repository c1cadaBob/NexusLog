# 模块二十二：多租户架构

> **文档版本**: v1.0  
> **创建日期**: 2026-01-31  
> **所属模块**: 模块二十二：多租户架构  
> **实施阶段**: MVP

---

## 模块概述

提供多租户 SaaS 部署能力，实现租户间的数据隔离、资源隔离和配置隔离。

**隔离策略**:

| 层级 | 隔离方式 | 说明 |
|------|----------|------|
| 数据库 | PostgreSQL RLS | 行级安全策略 |
| 搜索引擎 | ES 索引前缀 | `{tenant_id}_logs_*` |
| 对象存储 | MinIO 桶隔离 | `tenant-{id}/` |
| 缓存 | Redis key 前缀 | `{tenant_id}:` |
| 消息队列 | Kafka topic 前缀 | `{tenant_id}.logs` |
| API | JWT tenant_id | 请求级隔离 |

**模块架构**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Multi-Tenant Architecture                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    API Gateway                        │   │
│  │  - JWT 验证 (tenant_id 提取)                          │   │
│  │  - 租户路由                                           │   │
│  │  - 限流 (per tenant)                                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│         ┌────────────────┼────────────────┐                 │
│         ▼                ▼                ▼                 │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐          │
│  │  Tenant A  │   │  Tenant B  │   │  Tenant C  │          │
│  ├────────────┤   ├────────────┤   ├────────────┤          │
│  │ ES: a_*    │   │ ES: b_*    │   │ ES: c_*    │          │
│  │ MinIO: a/  │   │ MinIO: b/  │   │ MinIO: c/  │          │
│  │ Redis: a:  │   │ Redis: b:  │   │ Redis: c:  │          │
│  │ Kafka: a.  │   │ Kafka: b.  │   │ Kafka: c.  │          │
│  └────────────┘   └────────────┘   └────────────┘          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 需求 22-1：租户管理 [MVP]

**用户故事**: 

作为平台管理员，我希望能够管理所有租户的生命周期，包括创建、激活、暂停和删除。

**验收标准**:

1. THE System SHALL 支持租户创建/激活/暂停/删除
2. THE System SHALL 支持租户配置管理（配额、功能开关）
3. THE System SHALL 支持租户计费信息管理
4. THE System SHALL 支持租户管理员账号管理

**数据模型**:

```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(63) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    plan VARCHAR(50) DEFAULT 'free',
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- RLS 策略
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON logs
    USING (tenant_id = current_setting('app.tenant_id')::UUID);
```

**实现方向**:

```go
// JWT Claims
type TenantClaims struct {
    jwt.StandardClaims
    TenantID   string   `json:"tenant_id"`
    TenantSlug string   `json:"tenant_slug"`
    Roles      []string `json:"roles"`
}

// 中间件
func TenantMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        claims := c.MustGet("claims").(*TenantClaims)
        c.Set("tenant_id", claims.TenantID)

        // 设置数据库上下文
        db.Exec("SET app.tenant_id = ?", claims.TenantID)

        c.Next()
    }
}
```

---

## 需求 22-2：资源配额 [MVP]

**用户故事**: 

作为平台管理员，我希望能够为每个租户设置资源使用配额，以便控制成本和防止滥用。

**验收标准**:

1. THE System SHALL 支持存储配额（GB）
2. THE System SHALL 支持日志摄入配额（条/天）
3. THE System SHALL 支持 API 调用配额（次/分钟）
4. THE System SHALL 支持用户数配额
5. THE System SHALL 支持告警规则数配额

**配额配置示例**:

```json
{
  "plan": "professional",
  "quotas": {
    "storage_gb": 100,
    "ingestion_per_day": 10000000,
    "api_calls_per_minute": 1000,
    "users": 50,
    "alert_rules": 100,
    "retention_days": 90
  }
}
```

**实现方向**:

使用 Redis 实时追踪配额使用情况，超过配额时拒绝请求并发送告警。

---

## 需求 22-3：租户隔离验证 [MVP]

**用户故事**: 

作为安全工程师，我希望确保租户间数据完全隔离，防止数据泄露。

**验收标准**:

1. THE System SHALL 确保租户 A 无法访问租户 B 的数据
2. THE System SHALL 确保租户 A 的查询不会返回租户 B 的结果
3. THE System SHALL 在租户删除后完全清除数据
4. THE System SHALL 通过安全审计

**实现方向**:

```go
// ES 索引隔离
func GetTenantIndex(tenantID, indexType string) string {
    return fmt.Sprintf("%s_%s_%s", tenantID, indexType,
        time.Now().Format("2006.01.02"))
}

// 查询时自动添加租户过滤
func BuildTenantQuery(tenantID string, query map[string]interface{}) map[string]interface{} {
    return map[string]interface{}{
        "query": map[string]interface{}{
            "bool": map[string]interface{}{
                "must": []interface{}{
                    query["query"],
                },
                "filter": map[string]interface{}{
                    "term": map[string]interface{}{
                        "tenant_id": tenantID,
                    },
                },
            },
        },
    }
}
```

---

## 配置热更新

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| multi_tenant_enabled | bool | false | 是否启用多租户 |
| default_plan | string | free | 默认套餐 |
| quota_check_enabled | bool | true | 是否启用配额检查 |

**热更新机制**:
- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效
- 回滚策略: 配置验证失败时保持原配置

---

## 相关需求

- 需求 51: 多租户 SaaS 部署

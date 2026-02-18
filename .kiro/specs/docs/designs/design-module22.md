# 模块22：多租户架构 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-01-31  
> **状态**: 已发布  
> **相关需求**: [requirements-module22.md](../requirements/requirements-module22.md)

---

## 1. 文档信息

### 1.1 版本历史
| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-01-31 | 系统架构团队 | 初稿，完整设计方案 |

### 1.2 文档状态

- **当前状态**: 已发布
- **评审状态**: 已通过
- **实施阶段**: MVP

### 1.3 相关文档
- [需求文档](../requirements/requirements-module22.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)

---

## 2. 总体架构

### 2.1 系统架构图
```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                多租户架构整体设计                                            │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            API网关层 (租户识别)                                        │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  JWT验证 → 租户ID提取 → 租户状态检查 → 配额预检查 → 请求路由                  │  │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
│                                         │                                                   │
│                    ┌────────────────────┼────────────────────┐                             │
│                    ▼                    ▼                    ▼                             │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │    租户 A 空间       │  │    租户 B 空间       │  │    租户 C 空间       │            │
│  ├──────────────────────┤  ├──────────────────────┤  ├──────────────────────┤            │
│  │ • ES: tenant_a_*     │  │ • ES: tenant_b_*     │  │ • ES: tenant_c_*     │            │
│  │ • MinIO: tenant-a/   │  │ • MinIO: tenant-b/   │  │ • MinIO: tenant-c/   │            │
│  │ • Redis: a:*         │  │ • Redis: b:*         │  │ • Redis: c:*         │            │
│  │ • Kafka: a.logs      │  │ • Kafka: b.logs      │  │ • Kafka: c.logs      │            │
│  │ • PG: RLS策略        │  │ • PG: RLS策略        │  │ • PG: RLS策略        │            │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────────┘            │
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            数据隔离层                                                  │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  PostgreSQL (行级安全 RLS)                                                     │  │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                        │  │ │
│  │  │  │ 租户A数据    │  │ 租户B数据    │  │ 租户C数据    │                        │  │ │
│  │  │  │ tenant_id=A  │  │ tenant_id=B  │  │ tenant_id=C  │                        │  │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘                        │  │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                                       │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  Elasticsearch (索引前缀隔离)                                                  │  │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                        │  │ │
│  │  │  │ tenant_a_*   │  │ tenant_b_*   │  │ tenant_c_*   │                        │  │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘                        │  │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                                       │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  MinIO (桶隔离)                                                                │  │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                        │  │ │
│  │  │  │ tenant-a/    │  │ tenant-b/    │  │ tenant-c/    │                        │  │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘                        │  │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                                       │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  Redis (Key前缀隔离)                                                           │  │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                        │  │ │
│  │  │  │ a:*          │  │ b:*          │  │ c:*          │                        │  │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘                        │  │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                                       │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  Kafka (Topic前缀隔离)                                                         │  │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                        │  │ │
│  │  │  │ a.logs       │  │ b.logs       │  │ c.logs       │                        │  │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘                        │  │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            资源配额管理层                                              │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  配额监控器 (Redis实时追踪)                                                    │  │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                        │  │ │
│  │  │  │ 存储配额     │  │ 摄入配额     │  │ API配额      │                        │  │ │
│  │  │  │ (GB)         │  │ (条/天)      │  │ (次/分钟)    │                        │  │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘                        │  │ │
│  │  │                                                                                │  │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                        │  │ │
│  │  │  │ 用户数配额   │  │ 告警规则配额 │  │ 保留期配额   │                        │  │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘                        │  │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                                       │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  配额执行器                                                                    │  │ │
│  │  │  • 超限拒绝请求                                                                │  │ │
│  │  │  • 发送告警通知                                                                │  │ │
│  │  │  • 自动降级服务                                                                │  │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            租户管理层                                                  │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  租户生命周期管理                                                              │  │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │  │ │
│  │  │  │ 创建租户     │  │ 激活租户     │  │ 暂停租户     │  │ 删除租户     │    │  │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │  │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                                       │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  租户配置管理                                                                  │  │ │
│  │  │  • 套餐管理 (Free/Professional/Enterprise)                                    │  │ │
│  │  │  • 功能开关                                                                    │  │ │
│  │  │  • 计费信息                                                                    │  │ │
│  │  │  • 管理员账号                                                                  │  │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分
| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| 租户管理 | 租户生命周期管理 | 创建、激活、暂停、删除租户；套餐管理；功能开关 |
| 数据隔离 | 多层次数据隔离 | PostgreSQL RLS、ES索引前缀、MinIO桶隔离、Redis Key前缀、Kafka Topic前缀 |
| 资源配额 | 配额管理与执行 | 配额设置、实时追踪、超限拒绝、告警通知 |
| 租户识别 | 请求级租户识别 | JWT解析、租户验证、上下文注入 |
| 隔离验证 | 安全审计与验证 | 跨租户访问检测、数据泄露防护、安全审计 |

### 2.3 关键路径

**租户创建关键路径**:
```
创建请求 → 参数验证(10ms) → 生成租户ID(5ms) → 创建数据库记录(50ms) 
  → 初始化ES索引模板(100ms) → 创建MinIO桶(50ms) → 初始化Redis空间(20ms) 
  → 创建Kafka Topic(100ms) → 设置配额(30ms) → 返回结果

总时长: < 500ms
```

**请求处理关键路径**:
```
API请求 → JWT验证(5ms) → 租户ID提取(1ms) → 租户状态检查(2ms) 
  → 配额预检查(3ms) → 设置数据库上下文(5ms) → 业务处理 → 更新配额(5ms)

租户识别延迟: < 20ms
```

**配额检查关键路径**:
```
请求到达 → Redis获取当前使用量(2ms) → 对比配额限制(1ms) 
  → 判断是否超限(1ms) → 允许/拒绝请求

配额检查延迟: < 5ms
```

---

## 3. 技术选型

### 3.1 核心技术栈
| 技术 | 版本 | 选择理由 |
|------|------|----------|
| PostgreSQL RLS | 15+ | 行级安全策略、原生支持、性能优秀 |
| Elasticsearch | 8.11+ | 索引前缀隔离、高性能搜索、成熟稳定 |
| MinIO | RELEASE.2024+ | 对象存储、桶隔离、S3兼容 |
| Redis | 7.2+ | Key前缀隔离、高性能缓存、Pub/Sub支持 |
| Kafka | 3.6+ | Topic前缀隔离、高吞吐、持久化 |
| JWT | - | 无状态认证、租户信息携带、标准化 |
| Go | 1.21+ | 高性能、并发友好、类型安全 |

### 3.2 隔离策略对比

**数据库隔离方案对比**:

| 方案 | 隔离级别 | 性能 | 成本 | 复杂度 | 选择 |
|------|---------|------|------|--------|------|
| 共享表+应用层过滤 | 低 | 高 | 低 | 低 | ❌ 安全风险高 |
| 共享表+RLS | 中 | 高 | 低 | 中 | ✅ MVP方案 |
| 独立Schema | 高 | 中 | 中 | 中 | ✅ 中大租户 |
| 独立数据库实例 | 最高 | 低 | 高 | 高 | ✅ 大租户 |

**选择策略**:
- 小租户（< 1GB）: 共享表 + RLS
- 中租户（1-10GB）: 独立Schema
- 大租户（> 10GB）: 独立数据库实例

**Elasticsearch隔离方案对比**:

| 方案 | 隔离级别 | 性能 | 成本 | 选择 |
|------|---------|------|------|------|
| 共享索引+过滤 | 低 | 高 | 低 | ❌ |
| 索引前缀隔离 | 中 | 高 | 低 | ✅ |
| 独立集群 | 最高 | 中 | 高 | ✅ 大租户 |

**选择理由**: 索引前缀隔离提供良好的隔离性和性能平衡，成本可控

### 3.3 配额管理技术选型

| 方案 | 实时性 | 性能 | 准确性 | 选择 |
|------|--------|------|--------|------|
| 数据库计数 | 低 | 低 | 高 | ❌ |
| Redis计数器 | 高 | 高 | 高 | ✅ |
| 内存计数器 | 最高 | 最高 | 中 | ⚠️ 辅助方案 |

**选择理由**: Redis提供高性能的原子操作，支持分布式环境，实时性好

---

## 4. 关键流程设计

### 4.1 租户创建流程

```
1. 接收租户创建请求
   - 租户名称、slug、套餐类型
   - 初始配额配置
   - 管理员账号信息

2. 参数验证
   - 租户名称唯一性检查
   - slug格式验证（小写字母、数字、连字符）
   - 套餐类型有效性验证

3. 生成租户ID
   - UUID v4格式
   - 确保全局唯一

4. 创建数据库记录
   - 插入tenants表
   - 设置初始状态为'active'
   - 记录创建时间和创建人

5. 初始化数据隔离
   a. PostgreSQL:
      - 创建RLS策略（如果使用共享表）
      - 或创建独立Schema（中大租户）
   
   b. Elasticsearch:
      - 创建索引模板: {tenant_id}_logs_*
      - 设置索引生命周期策略
      - 配置分片和副本数
   
   c. MinIO:
      - 创建租户专属桶: tenant-{id}
      - 设置访问策略
      - 配置生命周期规则
   
   d. Redis:
      - 初始化配额计数器: {tenant_id}:quota:*
      - 设置配置缓存空间
   
   e. Kafka:
      - 创建租户Topic: {tenant_id}.logs
      - 设置分区数和副本数
      - 配置保留策略

6. 初始化配额
   - 根据套餐设置配额限制
   - 初始化使用量为0
   - 启动配额监控

7. 创建管理员账号
   - 生成管理员用户
   - 分配租户管理员角色
   - 发送欢迎邮件

8. 记录审计日志
   - 记录租户创建事件
   - 包含操作人、时间、配置

9. 返回租户信息
   - 租户ID、访问凭证
   - 管理控制台URL
   - 初始配置信息

总耗时: < 500ms
```

**时序图**:

```
用户  API  验证器  DB  ES  MinIO  Redis  Kafka  审计
 │     │     │     │   │    │      │      │      │
 │─创建→│     │     │   │    │      │      │      │
 │     │─验证→│     │   │    │      │      │      │
 │     │     │─OK─→│   │    │      │      │      │
 │     │     │     │─写入→   │      │      │      │
 │     │     │     │   │─模板→     │      │      │
 │     │     │     │   │    │─桶─→│      │      │
 │     │     │     │   │    │      │─初始化→    │
 │     │     │     │   │    │      │      │─Topic→
 │     │     │     │   │    │      │      │      │─记录→
 │     │◄────────────────────────────────完成────│
```

### 4.2 请求处理流程（租户识别）

```
1. API请求到达网关
   - 提取Authorization Header
   - 或提取X-Tenant-ID Header

2. JWT验证
   - 验证签名
   - 检查过期时间
   - 提取Claims

3. 租户ID提取
   - 从JWT Claims获取tenant_id
   - 或从Header获取
   - 验证租户ID格式

4. 租户状态检查
   - 从Redis缓存获取租户状态
   - 如果缓存未命中，从PostgreSQL查询
   - 检查租户是否active
   - 如果suspended或deleted，拒绝请求

5. 配额预检查
   - 检查API调用配额
   - 使用Redis INCR原子操作
   - 如果超限，返回429 Too Many Requests

6. 设置请求上下文
   - 注入tenant_id到context
   - 设置数据库会话变量: SET app.tenant_id = ?
   - 设置日志上下文

7. 业务处理
   - 所有数据库查询自动应用RLS
   - 所有ES查询自动添加索引前缀
   - 所有MinIO操作自动路由到租户桶
   - 所有Redis操作自动添加Key前缀

8. 更新配额使用量
   - 更新存储使用量（如有写入）
   - 更新日志摄入量
   - 更新API调用计数

9. 返回响应
   - 添加租户相关Header
   - 记录访问日志

租户识别延迟: < 20ms
```

### 4.3 配额检查与执行流程

```
1. 配额检查触发
   - API请求前检查
   - 数据写入前检查
   - 定时批量检查

2. 获取当前使用量
   - Redis获取实时计数
   - Key格式: {tenant_id}:quota:{resource_type}:usage
   - 支持的资源类型:
     * storage_gb: 存储使用量
     * ingestion_count: 日志摄入量
     * api_calls: API调用次数
     * users: 用户数
     * alert_rules: 告警规则数

3. 获取配额限制
   - Redis获取配额配置
   - Key格式: {tenant_id}:quota:{resource_type}:limit
   - 如果缓存未命中，从PostgreSQL查询

4. 对比判断
   - 计算使用率: usage / limit * 100%
   - 判断是否超限

5. 执行策略
   a. 未超限（< 80%）:
      - 允许请求
      - 更新使用量
   
   b. 接近超限（80-100%）:
      - 允许请求
      - 更新使用量
      - 发送警告通知
   
   c. 已超限（>= 100%）:
      - 拒绝请求
      - 返回403 Quota Exceeded
      - 发送超限告警
      - 记录超限事件

6. 配额重置
   - 按周期重置（每日/每月）
   - 使用Redis过期时间自动重置
   - 或使用定时任务批量重置

配额检查延迟: < 5ms
```

### 4.4 租户数据隔离验证流程

```
1. 定期安全审计
   - 每日执行一次
   - 检查所有租户数据

2. PostgreSQL RLS验证
   - 尝试跨租户查询
   - 验证RLS策略生效
   - 检查是否有数据泄露

3. Elasticsearch隔离验证
   - 验证索引前缀正确性
   - 尝试跨租户搜索
   - 检查搜索结果隔离

4. MinIO隔离验证
   - 验证桶访问策略
   - 尝试跨租户访问
   - 检查权限控制

5. Redis隔离验证
   - 验证Key前缀正确性
   - 检查Key命名规范
   - 验证访问隔离

6. Kafka隔离验证
   - 验证Topic命名
   - 检查消费者组隔离
   - 验证ACL配置

7. 生成审计报告
   - 记录验证结果
   - 标记异常项
   - 发送告警（如有问题）

8. 自动修复
   - 修复发现的隔离问题
   - 记录修复操作
   - 通知管理员

审计周期: 每日一次
```

### 4.5 租户删除流程

```
1. 接收删除请求
   - 验证操作权限
   - 确认删除意图（二次确认）

2. 标记租户状态
   - 更新状态为'deleting'
   - 阻止新的请求

3. 数据备份（可选）
   - 导出租户数据
   - 保存到归档存储
   - 生成备份清单

4. 清理数据
   a. PostgreSQL:
      - 删除租户相关记录
      - 或删除独立Schema
   
   b. Elasticsearch:
      - 删除租户索引: {tenant_id}_logs_*
      - 等待删除完成
   
   c. MinIO:
      - 删除租户桶: tenant-{id}
      - 递归删除所有对象
   
   d. Redis:
      - 删除租户Key: {tenant_id}:*
      - 批量删除
   
   e. Kafka:
      - 删除租户Topic: {tenant_id}.logs
      - 清理消费者组

5. 清理配额记录
   - 删除配额配置
   - 删除使用量统计

6. 清理用户账号
   - 删除租户用户
   - 撤销访问权限

7. 更新租户状态
   - 更新状态为'deleted'
   - 记录删除时间

8. 记录审计日志
   - 记录删除操作
   - 包含操作人、时间、原因

9. 发送通知
   - 通知租户管理员
   - 确认删除完成

删除耗时: 根据数据量，5分钟-1小时
```

### 4.6 异常流程

| 异常类型 | 处理策略 | 恢复机制 |
|----------|----------|----------|
| 租户不存在 | 返回404 Not Found | 提示创建租户 |
| 租户已暂停 | 返回403 Forbidden | 提示联系管理员 |
| 配额超限 | 返回429 Quota Exceeded | 提示升级套餐或清理数据 |
| 数据库连接失败 | 返回503 Service Unavailable | 自动重试，降级到只读模式 |
| Redis不可用 | 降级到数据库查询 | 自动重连，恢复后切回 |
| ES索引创建失败 | 重试3次 | 记录错误，人工介入 |
| MinIO桶创建失败 | 重试3次 | 记录错误，人工介入 |
| Kafka Topic创建失败 | 重试3次 | 记录错误，人工介入 |

### 4.7 配置热更新流程

```
1. 用户修改租户配置
   - 通过API或Web Console
   - 修改配额、功能开关等

2. 配置验证
   - 验证配额值合法性
   - 验证功能开关有效性
   - 检查是否会导致服务中断

3. 保存到PostgreSQL
   - 更新tenants表
   - 版本号+1
   - 记录变更时间和操作人

4. 同步到Redis
   - 更新配额缓存
   - 更新配置缓存
   - 设置合理的TTL

5. 发布Pub/Sub通知
   - 频道: config:tenant:{tenant_id}:reload
   - 消息: 配置版本号

6. 所有节点订阅通知
   - 接收配置变更通知
   - 从Redis加载最新配置
   - 使用atomic.Value原子更新

7. 验证配置生效
   - 检查各节点配置版本
   - 确认配置一致性

8. 记录审计日志
   - 记录配置变更
   - 包含变更前后对比

9. 发送通知
   - 通知租户管理员
   - 确认配置已更新

生效时间: < 10秒
```

---

## 5. 接口设计

### 5.1 API列表

详见 [API设计文档](./api-design.md) 模块22部分，主要接口包括:

**租户管理接口**:
- POST /api/v1/tenants - 创建租户
- GET /api/v1/tenants - 获取租户列表
- GET /api/v1/tenants/{id} - 获取租户详情
- PUT /api/v1/tenants/{id} - 更新租户配置
- DELETE /api/v1/tenants/{id} - 删除租户
- PUT /api/v1/tenants/{id}/suspend - 暂停租户
- PUT /api/v1/tenants/{id}/resume - 恢复租户

**配额管理接口**:
- GET /api/v1/tenants/{id}/quota - 获取配额使用情况
- PUT /api/v1/tenants/{id}/quota - 更新租户配额
- GET /api/v1/tenants/{id}/quota/history - 获取配额使用历史

**告警规则管理接口（支持热更新）**:
- POST /api/v1/tenants/{tenant_id}/alert-rules - 创建自定义告警规则
- GET /api/v1/tenants/{tenant_id}/alert-rules - 获取租户告警规则列表
- GET /api/v1/tenants/{tenant_id}/alert-rules/{rule_id} - 获取告警规则详情
- PUT /api/v1/tenants/{tenant_id}/alert-rules/{rule_id} - 更新告警规则（热更新）
- DELETE /api/v1/tenants/{tenant_id}/alert-rules/{rule_id} - 删除告警规则（热更新）
- PUT /api/v1/tenants/{tenant_id}/alert-rules/{rule_id}/toggle - 启用/禁用告警规则（热更新）
- GET /api/v1/alert-rules/system - 获取系统级告警规则列表
- POST /api/v1/alert-rules/system - 创建系统级告警规则（需管理员权限）

**隔离验证接口**:
- POST /api/v1/tenants/validate-isolation - 验证租户隔离
- GET /api/v1/tenants/audit-report - 获取安全审计报告

**配置管理接口（支持热更新）**:
- GET /api/v1/config/multi-tenant - 获取多租户配置
- PUT /api/v1/config/multi-tenant - 更新多租户配置（热更新）
- GET /api/v1/config/version - 获取配置版本
- POST /api/v1/config/rollback - 回滚配置到指定版本

### 5.2 内部接口

**租户管理器接口**:

```go
// 租户管理器接口
type TenantManager interface {
    // 创建租户
    CreateTenant(ctx context.Context, req *CreateTenantRequest) (*Tenant, error)
    
    // 获取租户
    GetTenant(ctx context.Context, tenantID string) (*Tenant, error)
    
    // 更新租户
    UpdateTenant(ctx context.Context, tenantID string, updates map[string]interface{}) error
    
    // 删除租户
    DeleteTenant(ctx context.Context, tenantID string) error
    
    // 暂停租户
    SuspendTenant(ctx context.Context, tenantID string, reason string) error
    
    // 恢复租户
    ResumeTenant(ctx context.Context, tenantID string) error
    
    // 列出租户
    ListTenants(ctx context.Context, filter *TenantFilter) ([]*Tenant, error)
}

// 创建租户请求
type CreateTenantRequest struct {
    Name        string            `json:"name" binding:"required"`
    Slug        string            `json:"slug" binding:"required,lowercase,alphanum"`
    Plan        string            `json:"plan" binding:"required,oneof=free professional enterprise"`
    AdminEmail  string            `json:"admin_email" binding:"required,email"`
    Config      map[string]interface{} `json:"config"`
}

// 租户模型
type Tenant struct {
    ID          string                 `json:"id"`
    Name        string                 `json:"name"`
    Slug        string                 `json:"slug"`
    Status      TenantStatus           `json:"status"`
    Plan        string                 `json:"plan"`
    Config      map[string]interface{} `json:"config"`
    CreatedAt   time.Time              `json:"created_at"`
    UpdatedAt   time.Time              `json:"updated_at"`
}

// 租户状态
type TenantStatus string

const (
    TenantStatusActive    TenantStatus = "active"
    TenantStatusSuspended TenantStatus = "suspended"
    TenantStatusDeleted   TenantStatus = "deleted"
)
```

**配额管理器接口**:

```go
// 配额管理器接口
type QuotaManager interface {
    // 检查配额
    CheckQuota(ctx context.Context, tenantID string, resourceType ResourceType, amount int64) error
    
    // 更新配额使用量
    UpdateUsage(ctx context.Context, tenantID string, resourceType ResourceType, delta int64) error
    
    // 获取配额信息
    GetQuota(ctx context.Context, tenantID string) (*QuotaInfo, error)
    
    // 设置配额限制
    SetQuotaLimit(ctx context.Context, tenantID string, resourceType ResourceType, limit int64) error
    
    // 重置配额
    ResetQuota(ctx context.Context, tenantID string, resourceType ResourceType) error
    
    // 获取配额使用历史
    GetQuotaHistory(ctx context.Context, tenantID string, timeRange TimeRange) ([]*QuotaUsage, error)
}

// 资源类型
type ResourceType string

const (
    ResourceTypeStorage      ResourceType = "storage_gb"
    ResourceTypeIngestion    ResourceType = "ingestion_count"
    ResourceTypeAPICall      ResourceType = "api_calls"
    ResourceTypeUsers        ResourceType = "users"
    ResourceTypeAlertRules   ResourceType = "alert_rules"
    ResourceTypeRetentionDays ResourceType = "retention_days"
)

// 配额信息
type QuotaInfo struct {
    TenantID  string                    `json:"tenant_id"`
    Plan      string                    `json:"plan"`
    Quotas    map[ResourceType]*Quota   `json:"quotas"`
    UpdatedAt time.Time                 `json:"updated_at"`
}

// 配额
type Quota struct {
    Limit      int64   `json:"limit"`
    Used       int64   `json:"used"`
    Percentage float64 `json:"percentage"`
    Status     string  `json:"status"` // normal, warning, exceeded
}

// 配额使用记录
type QuotaUsage struct {
    TenantID     string       `json:"tenant_id"`
    ResourceType ResourceType `json:"resource_type"`
    Amount       int64        `json:"amount"`
    Timestamp    time.Time    `json:"timestamp"`
}
```

**租户识别中间件**:

```go
// 租户识别中间件
func TenantMiddleware(tenantMgr TenantManager, quotaMgr QuotaManager) gin.HandlerFunc {
    return func(c *gin.Context) {
        // 1. 提取租户ID
        tenantID := extractTenantID(c)
        if tenantID == "" {
            c.JSON(401, gin.H{"error": "租户ID缺失"})
            c.Abort()
            return
        }
        
        // 2. 验证租户
        tenant, err := tenantMgr.GetTenant(c.Request.Context(), tenantID)
        if err != nil {
            c.JSON(404, gin.H{"error": "租户不存在"})
            c.Abort()
            return
        }
        
        // 3. 检查租户状态
        if tenant.Status != TenantStatusActive {
            c.JSON(403, gin.H{"error": "租户已暂停"})
            c.Abort()
            return
        }
        
        // 4. 配额预检查（API调用）
        err = quotaMgr.CheckQuota(c.Request.Context(), tenantID, ResourceTypeAPICall, 1)
        if err != nil {
            c.JSON(429, gin.H{"error": "API调用配额已超限"})
            c.Abort()
            return
        }
        
        // 5. 设置上下文
        c.Set("tenant_id", tenantID)
        c.Set("tenant", tenant)
        
        // 6. 设置数据库会话变量
        db := c.MustGet("db").(*sql.DB)
        _, err = db.Exec("SET app.tenant_id = $1", tenantID)
        if err != nil {
            log.Error("设置数据库上下文失败", "error", err)
        }
        
        // 7. 继续处理
        c.Next()
        
        // 8. 更新配额使用量
        _ = quotaMgr.UpdateUsage(c.Request.Context(), tenantID, ResourceTypeAPICall, 1)
    }
}

// 提取租户ID
func extractTenantID(c *gin.Context) string {
    // 优先从JWT Claims提取
    if claims, exists := c.Get("claims"); exists {
        if jwtClaims, ok := claims.(*jwt.StandardClaims); ok {
            if tenantID, ok := jwtClaims.Subject.(string); ok {
                return tenantID
            }
        }
    }
    
    // 其次从Header提取
    if tenantID := c.GetHeader("X-Tenant-ID"); tenantID != "" {
        return tenantID
    }
    
    // 最后从Query参数提取（不推荐）
    return c.Query("tenant_id")
}
```

**数据隔离助手**:

```go
// 数据隔离助手
type IsolationHelper struct {
    tenantID string
}

// 创建隔离助手
func NewIsolationHelper(tenantID string) *IsolationHelper {
    return &IsolationHelper{tenantID: tenantID}
}

// 获取ES索引名
func (h *IsolationHelper) GetESIndex(indexType string) string {
    return fmt.Sprintf("%s_%s_%s", h.tenantID, indexType, time.Now().Format("2006.01.02"))
}

// 获取ES索引模式
func (h *IsolationHelper) GetESIndexPattern(indexType string) string {
    return fmt.Sprintf("%s_%s_*", h.tenantID, indexType)
}

// 获取MinIO桶名
func (h *IsolationHelper) GetMinioBucket() string {
    return fmt.Sprintf("tenant-%s", h.tenantID)
}

// 获取MinIO对象路径
func (h *IsolationHelper) GetMinioPath(objectKey string) string {
    return fmt.Sprintf("tenant-%s/%s", h.tenantID, objectKey)
}

// 获取Redis Key
func (h *IsolationHelper) GetRedisKey(key string) string {
    return fmt.Sprintf("%s:%s", h.tenantID, key)
}

// 获取Kafka Topic
func (h *IsolationHelper) GetKafkaTopic(topicType string) string {
    return fmt.Sprintf("%s.%s", h.tenantID, topicType)
}

// 添加ES查询过滤
func (h *IsolationHelper) AddESFilter(query map[string]interface{}) map[string]interface{} {
    // 确保查询中包含租户过滤
    if query["query"] == nil {
        query["query"] = make(map[string]interface{})
    }
    
    q := query["query"].(map[string]interface{})
    if q["bool"] == nil {
        q["bool"] = make(map[string]interface{})
    }
    
    boolQuery := q["bool"].(map[string]interface{})
    if boolQuery["filter"] == nil {
        boolQuery["filter"] = []interface{}{}
    }
    
    filters := boolQuery["filter"].([]interface{})
    filters = append(filters, map[string]interface{}{
        "term": map[string]interface{}{
            "tenant_id": h.tenantID,
        },
    })
    boolQuery["filter"] = filters
    
    return query
}
```

### 5.3 数据格式

**租户创建请求**:

```json
{
  "name": "示例公司",
  "slug": "example-company",
  "plan": "professional",
  "admin_email": "admin@example.com",
  "config": {
    "features": {
      "advanced_analytics": true,
      "custom_retention": true,
      "api_access": true
    },
    "branding": {
      "logo_url": "https://example.com/logo.png",
      "primary_color": "#1890ff"
    }
  }
}
```

**租户信息响应**:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "示例公司",
  "slug": "example-company",
  "status": "active",
  "plan": "professional",
  "quota": {
    "storage_gb": {
      "limit": 100,
      "used": 45.6,
      "percentage": 45.6,
      "status": "normal"
    },
    "ingestion_count": {
      "limit": 10000000,
      "used": 3500000,
      "percentage": 35.0,
      "status": "normal"
    },
    "api_calls": {
      "limit": 1000,
      "used": 234,
      "percentage": 23.4,
      "status": "normal"
    }
  },
  "config": {
    "features": {
      "advanced_analytics": true,
      "custom_retention": true,
      "api_access": true
    }
  },
  "created_at": "2026-01-31T10:00:00Z",
  "updated_at": "2026-01-31T12:00:00Z"
}
```

**配额更新请求**:

```json
{
  "quotas": {
    "storage_gb": 200,
    "ingestion_count": 20000000,
    "api_calls": 2000,
    "users": 100,
    "alert_rules": 200,
    "retention_days": 180
  }
}
```

---

## 6. 数据设计

### 6.1 数据模型

**租户模型**:

```go
// 租户
type Tenant struct {
    ID          string                 `json:"id" db:"id"`
    Name        string                 `json:"name" db:"name"`
    Slug        string                 `json:"slug" db:"slug"`
    Status      TenantStatus           `json:"status" db:"status"`
    Plan        string                 `json:"plan" db:"plan"`
    Config      map[string]interface{} `json:"config" db:"config"`
    CreatedAt   time.Time              `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time              `json:"updated_at" db:"updated_at"`
    CreatedBy   string                 `json:"created_by" db:"created_by"`
    UpdatedBy   string                 `json:"updated_by" db:"updated_by"`
}

// 租户配额
type TenantQuota struct {
    TenantID         string    `json:"tenant_id" db:"tenant_id"`
    ResourceType     string    `json:"resource_type" db:"resource_type"`
    Limit            int64     `json:"limit" db:"limit"`
    Used             int64     `json:"used" db:"used"`
    ResetPeriod      string    `json:"reset_period" db:"reset_period"` // daily, monthly
    LastResetAt      time.Time `json:"last_reset_at" db:"last_reset_at"`
    UpdatedAt        time.Time `json:"updated_at" db:"updated_at"`
}

// 租户配额历史
type TenantQuotaHistory struct {
    ID           int64     `json:"id" db:"id"`
    TenantID     string    `json:"tenant_id" db:"tenant_id"`
    ResourceType string    `json:"resource_type" db:"resource_type"`
    Amount       int64     `json:"amount" db:"amount"`
    Operation    string    `json:"operation" db:"operation"` // increase, decrease, reset
    Timestamp    time.Time `json:"timestamp" db:"timestamp"`
    Metadata     string    `json:"metadata" db:"metadata"`
}
```

**日志条目扩展**（支持租户隔离）:

```go
// 日志条目（添加租户字段）
type LogEntry struct {
    ID        string                 `json:"id"`
    TenantID  string                 `json:"tenant_id"`  // 租户ID
    Timestamp time.Time              `json:"timestamp"`
    Level     string                 `json:"level"`
    Source    string                 `json:"source"`
    Host      string                 `json:"host"`
    Message   string                 `json:"message"`
    Fields    map[string]interface{} `json:"fields"`
    Metadata  map[string]string      `json:"metadata"`
}
```

### 6.2 数据库设计

**租户表**:

```sql
-- 租户表
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(63) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    plan VARCHAR(50) NOT NULL DEFAULT 'free',
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    
    CONSTRAINT chk_status CHECK (status IN ('active', 'suspended', 'deleted')),
    CONSTRAINT chk_plan CHECK (plan IN ('free', 'professional', 'enterprise'))
);

CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_created_at ON tenants(created_at DESC);

-- 租户配额表
CREATE TABLE tenant_quotas (
    tenant_id UUID NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    limit_value BIGINT NOT NULL,
    used_value BIGINT NOT NULL DEFAULT 0,
    reset_period VARCHAR(20) NOT NULL DEFAULT 'monthly',
    last_reset_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (tenant_id, resource_type),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT chk_resource_type CHECK (resource_type IN (
        'storage_gb', 'ingestion_count', 'api_calls', 
        'users', 'alert_rules', 'retention_days'
    )),
    CONSTRAINT chk_reset_period CHECK (reset_period IN ('daily', 'monthly', 'yearly'))
);

CREATE INDEX idx_tenant_quotas_tenant_id ON tenant_quotas(tenant_id);
CREATE INDEX idx_tenant_quotas_resource_type ON tenant_quotas(resource_type);

-- 租户配额历史表（保留90天）
CREATE TABLE tenant_quota_history (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    amount BIGINT NOT NULL,
    operation VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata JSONB,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT chk_operation CHECK (operation IN ('increase', 'decrease', 'reset'))
);

CREATE INDEX idx_tenant_quota_history_tenant_id ON tenant_quota_history(tenant_id);
CREATE INDEX idx_tenant_quota_history_timestamp ON tenant_quota_history(timestamp DESC);

-- 自动清理90天前的历史记录
CREATE OR REPLACE FUNCTION cleanup_old_quota_history()
RETURNS void AS $$
BEGIN
    DELETE FROM tenant_quota_history 
    WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- 定时任务：每天清理一次
-- SELECT cron.schedule('cleanup-quota-history', '0 2 * * *', 'SELECT cleanup_old_quota_history()');
```

**行级安全策略（RLS）**:

```sql
-- 启用RLS
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY tenant_isolation_policy ON logs
    USING (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- 允许系统管理员查看所有数据
CREATE POLICY admin_access_policy ON logs
    USING (current_setting('app.is_admin', true)::BOOLEAN = true);

-- 示例：设置租户上下文
-- SET app.tenant_id = '550e8400-e29b-41d4-a716-446655440000';
-- SET app.is_admin = false;
```

**租户审计日志表**:

```sql
-- 租户审计日志表
CREATE TABLE tenant_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    operator VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    request_data JSONB,
    response_status INT,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_tenant_audit_logs_tenant_id ON tenant_audit_logs(tenant_id);
CREATE INDEX idx_tenant_audit_logs_action ON tenant_audit_logs(action);
CREATE INDEX idx_tenant_audit_logs_timestamp ON tenant_audit_logs(timestamp DESC);
CREATE INDEX idx_tenant_audit_logs_operator ON tenant_audit_logs(operator);
```

### 6.3 Elasticsearch索引设计

**索引模板**:

```json
{
  "index_patterns": ["{tenant_id}_logs_*"],
  "template": {
    "settings": {
      "number_of_shards": 3,
      "number_of_replicas": 1,
      "index.lifecycle.name": "logs-policy",
      "index.lifecycle.rollover_alias": "{tenant_id}_logs"
    },
    "mappings": {
      "properties": {
        "tenant_id": {
          "type": "keyword"
        },
        "timestamp": {
          "type": "date"
        },
        "level": {
          "type": "keyword"
        },
        "source": {
          "type": "keyword"
        },
        "host": {
          "type": "keyword"
        },
        "message": {
          "type": "text",
          "analyzer": "standard"
        },
        "fields": {
          "type": "object",
          "dynamic": true
        }
      }
    }
  }
}
```

**索引生命周期策略**:

```json
{
  "policy": "logs-policy",
  "phases": {
    "hot": {
      "min_age": "0ms",
      "actions": {
        "rollover": {
          "max_size": "50GB",
          "max_age": "1d"
        },
        "set_priority": {
          "priority": 100
        }
      }
    },
    "warm": {
      "min_age": "7d",
      "actions": {
        "forcemerge": {
          "max_num_segments": 1
        },
        "shrink": {
          "number_of_shards": 1
        },
        "set_priority": {
          "priority": 50
        }
      }
    },
    "cold": {
      "min_age": "30d",
      "actions": {
        "freeze": {},
        "set_priority": {
          "priority": 0
        }
      }
    },
    "delete": {
      "min_age": "90d",
      "actions": {
        "delete": {}
      }
    }
  }
}
```

### 6.4 Redis缓存设计

**缓存Key设计**:

| Key模式 | 类型 | TTL | 说明 |
|---------|------|-----|------|
| `tenant:{id}:info` | Hash | 1小时 | 租户基本信息 |
| `tenant:{id}:status` | String | 5分钟 | 租户状态 |
| `tenant:{id}:quota:{type}:limit` | String | 永久 | 配额限制 |
| `tenant:{id}:quota:{type}:used` | String | 永久 | 配额使用量 |
| `tenant:{id}:config` | Hash | 1小时 | 租户配置 |
| `tenant:{id}:api_calls:{minute}` | String | 2分钟 | API调用计数（滑动窗口） |

**配额计数器实现**:

```lua
-- Lua脚本：原子检查并增加配额
local tenant_id = KEYS[1]
local resource_type = KEYS[2]
local delta = tonumber(ARGV[1])

local limit_key = "tenant:" .. tenant_id .. ":quota:" .. resource_type .. ":limit"
local used_key = "tenant:" .. tenant_id .. ":quota:" .. resource_type .. ":used"

local limit = tonumber(redis.call("GET", limit_key))
local used = tonumber(redis.call("GET", used_key)) or 0

if limit == nil then
    return {err = "配额未设置"}
end

if used + delta > limit then
    return {err = "配额已超限"}
end

redis.call("INCRBY", used_key, delta)
return {ok = "成功"}
```

**Redis Pub/Sub频道**:

| 频道名 | 用途 | 消息格式 |
|--------|------|----------|
| `config:tenant:{id}:reload` | 租户配置变更通知 | JSON格式的配置版本号 |
| `quota:tenant:{id}:alert` | 配额告警通知 | JSON格式的告警信息 |
| `tenant:{id}:status` | 租户状态变更通知 | 新状态值 |

### 6.5 MinIO存储设计

**桶命名规范**:
- 格式: `tenant-{tenant_id}`
- 示例: `tenant-550e8400-e29b-41d4-a716-446655440000`

**对象路径规范**:
```
tenant-{tenant_id}/
├── logs/
│   ├── 2026/
│   │   ├── 01/
│   │   │   ├── 31/
│   │   │   │   ├── logs-00001.json.gz
│   │   │   │   └── logs-00002.json.gz
├── backups/
│   ├── full/
│   │   └── backup-20260131.tar.gz
│   └── incremental/
│       └── backup-20260131-001.tar.gz
└── exports/
    └── export-20260131.csv
```

**桶策略**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": ["arn:aws:iam::tenant-{tenant_id}:user/*"]
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": ["arn:aws:s3:::tenant-{tenant_id}/*"]
    }
  ]
}
```

### 6.6 Kafka Topic设计

**Topic命名规范**:
- 格式: `{tenant_id}.{topic_type}`
- 示例: `550e8400-e29b-41d4-a716-446655440000.logs`

**Topic配置**:

```properties
# 分区数（根据租户规模）
num.partitions=3

# 副本数
replication.factor=2

# 保留时间（7天）
retention.ms=604800000

# 压缩策略
compression.type=lz4

# 最大消息大小（10MB）
max.message.bytes=10485760
```

**ACL配置**:

```bash
# 允许租户生产者写入
kafka-acls --add \
  --allow-principal User:tenant-{tenant_id}-producer \
  --operation Write \
  --topic {tenant_id}.logs

# 允许租户消费者读取
kafka-acls --add \
  --allow-principal User:tenant-{tenant_id}-consumer \
  --operation Read \
  --topic {tenant_id}.logs \
  --group {tenant_id}-consumer-group
```

---

## 7. 安全设计

### 7.1 认证授权

**租户级别RBAC**:

| 角色 | 权限范围 | 可执行操作 |
|------|----------|------------|
| 租户管理员 | 租户内所有资源 | 管理用户、配置、查看所有日志、管理告警 |
| 租户开发者 | 租户内开发资源 | 查看日志、创建告警、查看仪表盘 |
| 租户查看者 | 租户内只读 | 查看日志、查看仪表盘 |

**JWT Claims结构**:

```go
type TenantClaims struct {
    jwt.StandardClaims
    TenantID   string   `json:"tenant_id"`
    TenantSlug string   `json:"tenant_slug"`
    UserID     string   `json:"user_id"`
    Roles      []string `json:"roles"`
    Permissions []string `json:"permissions"`
}
```

**权限检查**:

```go
// 权限检查中间件
func RequireTenantPermission(permission string) gin.HandlerFunc {
    return func(c *gin.Context) {
        claims := c.MustGet("claims").(*TenantClaims)
        
        // 检查是否有权限
        if !hasPermission(claims.Permissions, permission) {
            c.JSON(403, gin.H{"error": "权限不足"})
            c.Abort()
            return
        }
        
        c.Next()
    }
}

func hasPermission(permissions []string, required string) bool {
    for _, p := range permissions {
        if p == required || p == "*" {
            return true
        }
    }
    return false
}
```

### 7.2 数据安全

**多层次隔离**:

1. **网络层隔离**:
   - 租户间网络隔离（Kubernetes Network Policy）
   - 租户专属Ingress规则
   - 租户专属域名（可选）

2. **应用层隔离**:
   - JWT租户ID验证
   - 请求上下文租户ID注入
   - 所有查询自动添加租户过滤

3. **数据层隔离**:
   - PostgreSQL RLS策略
   - Elasticsearch索引前缀
   - MinIO桶隔离
   - Redis Key前缀
   - Kafka Topic前缀

**敏感数据加密**:

```go
// 租户敏感配置加密
type EncryptedConfig struct {
    Key       string `json:"key"`
    Value     string `json:"value"`      // 明文
    Encrypted string `json:"encrypted"`  // 密文
    IV        string `json:"iv"`         // 初始化向量
}

// 加密配置
func EncryptConfig(key, value string, masterKey []byte) (*EncryptedConfig, error) {
    // 使用AES-256-GCM加密
    block, err := aes.NewCipher(masterKey)
    if err != nil {
        return nil, err
    }
    
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return nil, err
    }
    
    nonce := make([]byte, gcm.NonceSize())
    if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
        return nil, err
    }
    
    ciphertext := gcm.Seal(nonce, nonce, []byte(value), nil)
    
    return &EncryptedConfig{
        Key:       key,
        Encrypted: base64.StdEncoding.EncodeToString(ciphertext),
        IV:        base64.StdEncoding.EncodeToString(nonce),
    }, nil
}
```

### 7.3 审计日志

**审计事件类型**:

| 事件类型 | 说明 | 记录内容 |
|----------|------|----------|
| tenant.created | 租户创建 | 租户信息、创建人、配额配置 |
| tenant.updated | 租户更新 | 变更前后对比、更新人 |
| tenant.suspended | 租户暂停 | 暂停原因、操作人 |
| tenant.resumed | 租户恢复 | 恢复原因、操作人 |
| tenant.deleted | 租户删除 | 删除原因、操作人、数据备份信息 |
| quota.exceeded | 配额超限 | 资源类型、超限量、时间 |
| quota.updated | 配额更新 | 变更前后对比、更新人 |
| isolation.violation | 隔离违规 | 违规类型、涉及租户、详情 |

**审计日志记录**:

```go
// 审计日志记录器
type AuditLogger struct {
    db *sql.DB
}

// 记录审计日志
func (l *AuditLogger) Log(ctx context.Context, event *AuditEvent) error {
    query := `
        INSERT INTO tenant_audit_logs 
        (tenant_id, action, resource_type, resource_id, operator, 
         ip_address, user_agent, request_data, response_status, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `
    
    _, err := l.db.ExecContext(ctx, query,
        event.TenantID,
        event.Action,
        event.ResourceType,
        event.ResourceID,
        event.Operator,
        event.IPAddress,
        event.UserAgent,
        event.RequestData,
        event.ResponseStatus,
        event.Timestamp,
    )
    
    return err
}

// 审计事件
type AuditEvent struct {
    TenantID       string
    Action         string
    ResourceType   string
    ResourceID     string
    Operator       string
    IPAddress      string
    UserAgent      string
    RequestData    string
    ResponseStatus int
    Timestamp      time.Time
}
```

### 7.4 安全加固

**防止跨租户访问**:

```go
// 跨租户访问检测中间件
func CrossTenantAccessDetector() gin.HandlerFunc {
    return func(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        
        // 检查请求参数中的租户相关ID
        if resourceTenantID := c.Query("tenant_id"); resourceTenantID != "" {
            if resourceTenantID != tenantID {
                log.Warn("检测到跨租户访问尝试",
                    "request_tenant", tenantID,
                    "resource_tenant", resourceTenantID,
                    "ip", c.ClientIP(),
                    "path", c.Request.URL.Path,
                )
                
                c.JSON(403, gin.H{"error": "禁止跨租户访问"})
                c.Abort()
                return
            }
        }
        
        c.Next()
    }
}
```

**配额防护**:

```go
// 配额防护器
type QuotaGuard struct {
    quotaMgr QuotaManager
    redis    *redis.Client
}

// 检查并扣减配额
func (g *QuotaGuard) CheckAndDeduct(ctx context.Context, tenantID string, 
    resourceType ResourceType, amount int64) error {
    
    // 使用Lua脚本原子操作
    script := `
        local limit_key = KEYS[1]
        local used_key = KEYS[2]
        local delta = tonumber(ARGV[1])
        
        local limit = tonumber(redis.call("GET", limit_key))
        local used = tonumber(redis.call("GET", used_key)) or 0
        
        if limit == nil then
            return redis.error_reply("配额未设置")
        end
        
        if used + delta > limit then
            return redis.error_reply("配额已超限")
        end
        
        redis.call("INCRBY", used_key, delta)
        return used + delta
    `
    
    limitKey := fmt.Sprintf("tenant:%s:quota:%s:limit", tenantID, resourceType)
    usedKey := fmt.Sprintf("tenant:%s:quota:%s:used", tenantID, resourceType)
    
    _, err := g.redis.Eval(ctx, script, []string{limitKey, usedKey}, amount).Result()
    if err != nil {
        // 发送配额超限告警
        g.sendQuotaAlert(ctx, tenantID, resourceType)
        return fmt.Errorf("配额检查失败: %w", err)
    }
    
    return nil
}
```

**数据泄露防护**:

```go
// 数据脱敏
func MaskSensitiveData(data map[string]interface{}, tenantID string) map[string]interface{} {
    masked := make(map[string]interface{})
    
    for key, value := range data {
        // 检查是否为敏感字段
        if isSensitiveField(key) {
            masked[key] = maskValue(value)
        } else {
            masked[key] = value
        }
    }
    
    // 确保包含租户ID
    masked["tenant_id"] = tenantID
    
    return masked
}

func isSensitiveField(field string) bool {
    sensitiveFields := []string{
        "password", "secret", "token", "api_key",
        "credit_card", "ssn", "phone", "email",
    }
    
    field = strings.ToLower(field)
    for _, sf := range sensitiveFields {
        if strings.Contains(field, sf) {
            return true
        }
    }
    
    return false
}

func maskValue(value interface{}) string {
    str := fmt.Sprintf("%v", value)
    if len(str) <= 4 {
        return "****"
    }
    return str[:2] + "****" + str[len(str)-2:]
}
```

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 租户创建时间 | < 500ms | 从请求到完成的总时长 |
| 租户识别延迟 | < 20ms | JWT验证+状态检查+配额预检查 |
| 配额检查延迟 | < 5ms | Redis原子操作 |
| 数据库查询延迟 | < 50ms | RLS策略应用后的查询时间 |
| ES查询延迟 | < 100ms | 索引前缀过滤后的查询时间 |
| 并发租户数 | 1000+ | 系统支持的活跃租户数 |
| 单租户QPS | 1000+ | 单个租户的请求处理能力 |

### 8.2 优化策略

**缓存优化**:

```go
// 多级缓存
type TenantCache struct {
    local  *sync.Map           // L1: 本地缓存
    redis  *redis.Client       // L2: Redis缓存
    db     *sql.DB             // L3: 数据库
}

// 获取租户信息（多级缓存）
func (c *TenantCache) GetTenant(ctx context.Context, tenantID string) (*Tenant, error) {
    // L1: 本地缓存
    if value, ok := c.local.Load(tenantID); ok {
        return value.(*Tenant), nil
    }
    
    // L2: Redis缓存
    key := fmt.Sprintf("tenant:%s:info", tenantID)
    data, err := c.redis.HGetAll(ctx, key).Result()
    if err == nil && len(data) > 0 {
        tenant := &Tenant{}
        // 反序列化
        if err := mapToStruct(data, tenant); err == nil {
            // 写入L1缓存
            c.local.Store(tenantID, tenant)
            return tenant, nil
        }
    }
    
    // L3: 数据库
    tenant, err := c.getTenantFromDB(ctx, tenantID)
    if err != nil {
        return nil, err
    }
    
    // 写入L2缓存
    c.redis.HSet(ctx, key, structToMap(tenant))
    c.redis.Expire(ctx, key, time.Hour)
    
    // 写入L1缓存
    c.local.Store(tenantID, tenant)
    
    return tenant, nil
}
```

**批量操作优化**:

```go
// 批量检查配额
func (g *QuotaGuard) BatchCheckQuota(ctx context.Context, 
    checks []QuotaCheck) ([]QuotaCheckResult, error) {
    
    // 使用Pipeline批量执行
    pipe := g.redis.Pipeline()
    
    for _, check := range checks {
        limitKey := fmt.Sprintf("tenant:%s:quota:%s:limit", 
            check.TenantID, check.ResourceType)
        usedKey := fmt.Sprintf("tenant:%s:quota:%s:used", 
            check.TenantID, check.ResourceType)
        
        pipe.Get(ctx, limitKey)
        pipe.Get(ctx, usedKey)
    }
    
    cmds, err := pipe.Exec(ctx)
    if err != nil {
        return nil, err
    }
    
    // 处理结果
    results := make([]QuotaCheckResult, len(checks))
    for i, check := range checks {
        limit, _ := cmds[i*2].(*redis.StringCmd).Int64()
        used, _ := cmds[i*2+1].(*redis.StringCmd).Int64()
        
        results[i] = QuotaCheckResult{
            TenantID:     check.TenantID,
            ResourceType: check.ResourceType,
            Allowed:      used+check.Amount <= limit,
            Remaining:    limit - used,
        }
    }
    
    return results, nil
}
```

**连接池优化**:

```go
// 数据库连接池配置
func ConfigureDBPool(db *sql.DB) {
    // 最大打开连接数
    db.SetMaxOpenConns(100)
    
    // 最大空闲连接数
    db.SetMaxIdleConns(20)
    
    // 连接最大生命周期
    db.SetConnMaxLifetime(time.Hour)
    
    // 连接最大空闲时间
    db.SetConnMaxIdleTime(10 * time.Minute)
}

// Redis连接池配置
func ConfigureRedisPool() *redis.Client {
    return redis.NewClient(&redis.Options{
        Addr:         "localhost:6379",
        PoolSize:     100,
        MinIdleConns: 20,
        MaxRetries:   3,
        DialTimeout:  5 * time.Second,
        ReadTimeout:  3 * time.Second,
        WriteTimeout: 3 * time.Second,
        PoolTimeout:  4 * time.Second,
    })
}
```

**查询优化**:

```sql
-- 为租户相关查询创建复合索引
CREATE INDEX idx_logs_tenant_timestamp ON logs(tenant_id, timestamp DESC);
CREATE INDEX idx_logs_tenant_level ON logs(tenant_id, level);
CREATE INDEX idx_logs_tenant_source ON logs(tenant_id, source);

-- 使用分区表（按租户分区）
CREATE TABLE logs (
    id BIGSERIAL,
    tenant_id UUID NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    level VARCHAR(20),
    message TEXT,
    ...
) PARTITION BY LIST (tenant_id);

-- 为大租户创建专属分区
CREATE TABLE logs_tenant_a PARTITION OF logs
    FOR VALUES IN ('550e8400-e29b-41d4-a716-446655440000');
```

### 8.3 容量规划

**租户规模估算**:

| 租户规模 | 日志量/天 | 存储需求 | 资源配置 |
|----------|-----------|----------|----------|
| 小租户 | < 100万条 | < 1GB | 共享资源 |
| 中租户 | 100万-1000万条 | 1-10GB | 独立Schema |
| 大租户 | > 1000万条 | > 10GB | 独立实例 |

**资源分配策略**:

```go
// 根据租户规模动态分配资源
func AllocateResources(tenant *Tenant) *ResourceAllocation {
    dailyLogCount := estimateDailyLogCount(tenant)
    
    if dailyLogCount < 1000000 {
        // 小租户：共享资源
        return &ResourceAllocation{
            DatabaseType:  "shared",
            ESShards:      1,
            ESReplicas:    1,
            KafkaPartitions: 1,
            MinIOBucket:   fmt.Sprintf("tenant-%s", tenant.ID),
        }
    } else if dailyLogCount < 10000000 {
        // 中租户：独立Schema
        return &ResourceAllocation{
            DatabaseType:  "dedicated_schema",
            ESShards:      3,
            ESReplicas:    1,
            KafkaPartitions: 3,
            MinIOBucket:   fmt.Sprintf("tenant-%s", tenant.ID),
        }
    } else {
        // 大租户：独立实例
        return &ResourceAllocation{
            DatabaseType:  "dedicated_instance",
            ESShards:      5,
            ESReplicas:    2,
            KafkaPartitions: 5,
            MinIOBucket:   fmt.Sprintf("tenant-%s", tenant.ID),
        }
    }
}
```

---

## 9. 部署方案

### 9.1 部署架构

**Kubernetes部署**:

```yaml
# 租户管理服务部署
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tenant-manager
  namespace: log-management
spec:
  replicas: 3
  selector:
    matchLabels:
      app: tenant-manager
  template:
    metadata:
      labels:
        app: tenant-manager
    spec:
      containers:
      - name: tenant-manager
        image: log-management/tenant-manager:v1.0
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: url
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi
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

**服务配置**:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: tenant-manager
  namespace: log-management
spec:
  selector:
    app: tenant-manager
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
  type: ClusterIP
```

### 9.2 资源配置

| 组件 | 副本数 | CPU | 内存 | 存储 | 说明 |
|------|--------|-----|------|------|------|
| 租户管理服务 | 3 | 2核 | 2GB | - | 无状态服务 |
| PostgreSQL | 1主2从 | 4核 | 8GB | 500GB SSD | 租户元数据 |
| Redis | 3节点集群 | 2核 | 4GB | 50GB SSD | 配额缓存 |
| Elasticsearch | 3节点 | 8核 | 16GB | 1TB SSD | 日志存储 |
| MinIO | 4节点 | 4核 | 8GB | 2TB HDD | 对象存储 |
| Kafka | 3节点 | 4核 | 8GB | 500GB SSD | 消息队列 |

### 9.3 环境配置

**开发环境**:
```yaml
# config/dev.yaml
multi_tenant:
  enabled: true
  default_plan: free
  max_tenants: 10
  
database:
  isolation_mode: shared  # 共享数据库+RLS
  
elasticsearch:
  isolation_mode: index_prefix  # 索引前缀隔离
  
quota:
  check_enabled: true
  enforcement_mode: soft  # 软限制，仅告警
```

**生产环境**:
```yaml
# config/prod.yaml
multi_tenant:
  enabled: true
  default_plan: professional
  max_tenants: 1000
  
database:
  isolation_mode: auto  # 自动选择（小租户共享，大租户独立）
  
elasticsearch:
  isolation_mode: index_prefix
  
quota:
  check_enabled: true
  enforcement_mode: hard  # 硬限制，拒绝请求
```

---

## 10. 监控与运维

### 10.1 监控指标

**Prometheus指标**:

```
# 租户指标
tenant_total{status="active|suspended|deleted"}
tenant_created_total
tenant_deleted_total

# 配额指标
tenant_quota_usage{tenant_id, resource_type}
tenant_quota_limit{tenant_id, resource_type}
tenant_quota_percentage{tenant_id, resource_type}
tenant_quota_exceeded_total{tenant_id, resource_type}

# 性能指标
tenant_creation_duration_seconds
tenant_identification_duration_seconds
quota_check_duration_seconds

# 隔离验证指标
tenant_isolation_violations_total{type}
tenant_cross_access_attempts_total
```

**Grafana仪表盘**:

```json
{
  "dashboard": {
    "title": "多租户监控",
    "panels": [
      {
        "title": "活跃租户数",
        "targets": [
          {
            "expr": "tenant_total{status=\"active\"}"
          }
        ]
      },
      {
        "title": "配额使用率 Top 10",
        "targets": [
          {
            "expr": "topk(10, tenant_quota_percentage)"
          }
        ]
      },
      {
        "title": "配额超限事件",
        "targets": [
          {
            "expr": "rate(tenant_quota_exceeded_total[5m])"
          }
        ]
      },
      {
        "title": "跨租户访问尝试",
        "targets": [
          {
            "expr": "rate(tenant_cross_access_attempts_total[5m])"
          }
        ]
      }
    ]
  }
}
```

### 10.2 告警规则（支持热更新）

**告警规则数据模型**:

```go
// 告警规则
type AlertRule struct {
    ID          string                 `json:"id" db:"id"`
    TenantID    string                 `json:"tenant_id" db:"tenant_id"` // 空表示系统级告警
    Name        string                 `json:"name" db:"name"`
    Type        string                 `json:"type" db:"type"` // quota, isolation, performance, custom
    Enabled     bool                   `json:"enabled" db:"enabled"`
    Severity    string                 `json:"severity" db:"severity"` // info, warning, critical
    Condition   AlertCondition         `json:"condition" db:"condition"`
    Threshold   float64                `json:"threshold" db:"threshold"`
    Duration    int                    `json:"duration" db:"duration"` // 秒
    Actions     []AlertAction          `json:"actions" db:"actions"`
    Labels      map[string]string      `json:"labels" db:"labels"`
    Annotations map[string]string      `json:"annotations" db:"annotations"`
    CreatedAt   time.Time              `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time              `json:"updated_at" db:"updated_at"`
}

// 告警条件
type AlertCondition struct {
    Metric      string  `json:"metric"`      // tenant_quota_percentage
    Operator    string  `json:"operator"`    // >, <, >=, <=, ==, !=
    Value       float64 `json:"value"`       // 阈值
    Aggregation string  `json:"aggregation"` // avg, max, min, sum
    TimeWindow  string  `json:"time_window"` // 5m, 1h
}

// 告警动作
type AlertAction struct {
    Type   string                 `json:"type"`   // email, webhook, sms, dingtalk
    Target string                 `json:"target"` // 目标地址
    Config map[string]interface{} `json:"config"` // 额外配置
}
```

**告警规则表设计**:

```sql
-- 告警规则表
CREATE TABLE alert_rules (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id UUID,  -- NULL表示系统级告警
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    severity VARCHAR(20) NOT NULL,
    condition JSONB NOT NULL,
    threshold DECIMAL(10,2) NOT NULL,
    duration INT NOT NULL DEFAULT 60,
    actions JSONB NOT NULL,
    labels JSONB,
    annotations JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT chk_type CHECK (type IN ('quota', 'isolation', 'performance', 'custom')),
    CONSTRAINT chk_severity CHECK (severity IN ('info', 'warning', 'critical'))
);

CREATE INDEX idx_alert_rules_tenant_id ON alert_rules(tenant_id);
CREATE INDEX idx_alert_rules_type ON alert_rules(type);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);
```

**预定义告警规则**:

```yaml
# config/alert-rules.yaml (默认规则，可通过热更新覆盖)
system_rules:
  # 配额告警
  - id: quota-warning
    name: 租户配额警告
    type: quota
    enabled: true
    severity: warning
    condition:
      metric: tenant_quota_percentage
      operator: ">"
      value: 80
      aggregation: max
      time_window: 5m
    threshold: 80
    duration: 300
    actions:
      - type: email
        target: admin@example.com
      - type: webhook
        target: https://hooks.example.com/alerts
    annotations:
      summary: "租户 {{ .tenant_id }} 配额使用率超过80%"
      description: "资源类型: {{ .resource_type }}, 使用率: {{ .value }}%"
  
  - id: quota-exceeded
    name: 租户配额超限
    type: quota
    enabled: true
    severity: critical
    condition:
      metric: tenant_quota_percentage
      operator: ">="
      value: 100
      aggregation: max
      time_window: 1m
    threshold: 100
    duration: 60
    actions:
      - type: email
        target: admin@example.com
      - type: sms
        target: "+86-138****5678"
    annotations:
      summary: "租户 {{ .tenant_id }} 配额已超限"
      description: "资源类型: {{ .resource_type }}, 使用率: {{ .value }}%"
  
  # 隔离违规告警
  - id: isolation-violation
    name: 租户隔离违规
    type: isolation
    enabled: true
    severity: critical
    condition:
      metric: tenant_isolation_violations_total
      operator: ">"
      value: 0
      aggregation: rate
      time_window: 5m
    threshold: 0
    duration: 60
    actions:
      - type: email
        target: security@example.com
      - type: webhook
        target: https://security.example.com/alerts
    annotations:
      summary: "检测到租户隔离违规"
      description: "违规类型: {{ .type }}, 速率: {{ .value }}/s"
  
  # 跨租户访问告警
  - id: cross-tenant-access
    name: 跨租户访问尝试
    type: isolation
    enabled: true
    severity: warning
    condition:
      metric: tenant_cross_access_attempts_total
      operator: ">"
      value: 1
      aggregation: rate
      time_window: 5m
    threshold: 1
    duration: 300
    actions:
      - type: email
        target: security@example.com
    annotations:
      summary: "检测到跨租户访问尝试"
      description: "速率: {{ .value }}/s"
  
  # 性能告警
  - id: tenant-creation-slow
    name: 租户创建速度慢
    type: performance
    enabled: true
    severity: warning
    condition:
      metric: tenant_creation_duration_seconds
      operator: ">"
      value: 1
      aggregation: p95
      time_window: 5m
    threshold: 1
    duration: 600
    actions:
      - type: email
        target: ops@example.com
    annotations:
      summary: "租户创建速度慢"
      description: "P95延迟: {{ .value }}s"
```

**告警规则管理器（支持热更新）**:

```go
// 告警规则管理器
type AlertRuleManager struct {
    rules  atomic.Value  // 存储map[string]*AlertRule
    db     *sql.DB
    redis  *redis.Client
    evaluator *AlertEvaluator
}

// 初始化
func NewAlertRuleManager(db *sql.DB, redis *redis.Client) *AlertRuleManager {
    mgr := &AlertRuleManager{
        db:     db,
        redis:  redis,
        evaluator: NewAlertEvaluator(),
    }
    
    // 加载初始规则
    rules, _ := mgr.loadRulesFromDB(context.Background())
    mgr.rules.Store(rules)
    
    // 订阅规则变更
    go mgr.subscribeRuleChanges()
    
    // 启动规则评估器
    go mgr.startEvaluator()
    
    return mgr
}

// 订阅规则变更（热更新）
func (m *AlertRuleManager) subscribeRuleChanges() {
    pubsub := m.redis.Subscribe("config:alert_rules:reload")
    
    for msg := range pubsub.Channel() {
        log.Info("收到告警规则变更通知", "version", msg.Payload)
        
        // 从数据库重新加载规则
        rules, err := m.loadRulesFromDB(context.Background())
        if err != nil {
            log.Error("加载告警规则失败", "error", err)
            continue
        }
        
        // 原子更新规则
        m.rules.Store(rules)
        
        log.Info("告警规则已更新", "count", len(rules))
    }
}

// 创建告警规则（热更新）
func (m *AlertRuleManager) CreateRule(ctx context.Context, rule *AlertRule) error {
    // 1. 验证规则
    if err := rule.Validate(); err != nil {
        return fmt.Errorf("规则验证失败: %w", err)
    }
    
    // 2. 保存到数据库
    query := `
        INSERT INTO alert_rules 
        (id, tenant_id, name, type, enabled, severity, condition, 
         threshold, duration, actions, labels, annotations, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `
    
    _, err := m.db.ExecContext(ctx, query,
        rule.ID, rule.TenantID, rule.Name, rule.Type, rule.Enabled,
        rule.Severity, rule.Condition, rule.Threshold, rule.Duration,
        rule.Actions, rule.Labels, rule.Annotations,
        rule.CreatedAt, rule.UpdatedAt,
    )
    if err != nil {
        return fmt.Errorf("保存规则失败: %w", err)
    }
    
    // 3. 同步到Redis
    key := fmt.Sprintf("alert_rule:%s", rule.ID)
    data, _ := json.Marshal(rule)
    m.redis.Set(ctx, key, data, time.Hour)
    
    // 4. 发布变更通知（触发热更新）
    m.redis.Publish(ctx, "config:alert_rules:reload", rule.ID)
    
    log.Info("告警规则已创建", "id", rule.ID, "name", rule.Name)
    
    return nil
}

// 更新告警规则（热更新）
func (m *AlertRuleManager) UpdateRule(ctx context.Context, ruleID string, 
    updates map[string]interface{}) error {
    
    // 1. 获取当前规则
    currentRule, err := m.GetRule(ctx, ruleID)
    if err != nil {
        return err
    }
    
    // 2. 应用更新
    if err := applyUpdates(currentRule, updates); err != nil {
        return err
    }
    currentRule.UpdatedAt = time.Now()
    
    // 3. 验证规则
    if err := currentRule.Validate(); err != nil {
        return fmt.Errorf("规则验证失败: %w", err)
    }
    
    // 4. 更新数据库
    query := `
        UPDATE alert_rules 
        SET name=$1, type=$2, enabled=$3, severity=$4, condition=$5,
            threshold=$6, duration=$7, actions=$8, labels=$9, 
            annotations=$10, updated_at=$11
        WHERE id=$12
    `
    
    _, err = m.db.ExecContext(ctx, query,
        currentRule.Name, currentRule.Type, currentRule.Enabled,
        currentRule.Severity, currentRule.Condition, currentRule.Threshold,
        currentRule.Duration, currentRule.Actions, currentRule.Labels,
        currentRule.Annotations, currentRule.UpdatedAt, ruleID,
    )
    if err != nil {
        return fmt.Errorf("更新规则失败: %w", err)
    }
    
    // 5. 同步到Redis
    key := fmt.Sprintf("alert_rule:%s", ruleID)
    data, _ := json.Marshal(currentRule)
    m.redis.Set(ctx, key, data, time.Hour)
    
    // 6. 发布变更通知（触发热更新）
    m.redis.Publish(ctx, "config:alert_rules:reload", ruleID)
    
    log.Info("告警规则已更新", "id", ruleID)
    
    return nil
}

// 删除告警规则（热更新）
func (m *AlertRuleManager) DeleteRule(ctx context.Context, ruleID string) error {
    // 1. 删除数据库记录
    _, err := m.db.ExecContext(ctx, "DELETE FROM alert_rules WHERE id=$1", ruleID)
    if err != nil {
        return fmt.Errorf("删除规则失败: %w", err)
    }
    
    // 2. 删除Redis缓存
    key := fmt.Sprintf("alert_rule:%s", ruleID)
    m.redis.Del(ctx, key)
    
    // 3. 发布变更通知（触发热更新）
    m.redis.Publish(ctx, "config:alert_rules:reload", ruleID)
    
    log.Info("告警规则已删除", "id", ruleID)
    
    return nil
}

// 启用/禁用告警规则（热更新）
func (m *AlertRuleManager) ToggleRule(ctx context.Context, ruleID string, enabled bool) error {
    // 1. 更新数据库
    _, err := m.db.ExecContext(ctx, 
        "UPDATE alert_rules SET enabled=$1, updated_at=$2 WHERE id=$3",
        enabled, time.Now(), ruleID)
    if err != nil {
        return fmt.Errorf("更新规则状态失败: %w", err)
    }
    
    // 2. 更新Redis缓存
    key := fmt.Sprintf("alert_rule:%s", ruleID)
    m.redis.HSet(ctx, key, "enabled", enabled)
    
    // 3. 发布变更通知（触发热更新）
    m.redis.Publish(ctx, "config:alert_rules:reload", ruleID)
    
    log.Info("告警规则状态已更新", "id", ruleID, "enabled", enabled)
    
    return nil
}

// 获取当前规则（无锁）
func (m *AlertRuleManager) GetRules() map[string]*AlertRule {
    return m.rules.Load().(map[string]*AlertRule)
}

// 规则评估器
func (m *AlertRuleManager) startEvaluator() {
    ticker := time.NewTicker(10 * time.Second)
    defer ticker.Stop()
    
    for range ticker.C {
        rules := m.GetRules()
        
        for _, rule := range rules {
            if !rule.Enabled {
                continue
            }
            
            // 评估规则
            if m.evaluator.Evaluate(rule) {
                // 触发告警
                m.triggerAlert(rule)
            }
        }
    }
}
```

**自定义告警API**:

```go
// 创建自定义告警规则
// POST /api/v1/tenants/{tenant_id}/alert-rules
func CreateCustomAlertRule(c *gin.Context) {
    tenantID := c.Param("tenant_id")
    
    var req struct {
        Name        string                 `json:"name" binding:"required"`
        Type        string                 `json:"type" binding:"required"`
        Severity    string                 `json:"severity" binding:"required"`
        Condition   AlertCondition         `json:"condition" binding:"required"`
        Threshold   float64                `json:"threshold" binding:"required"`
        Duration    int                    `json:"duration"`
        Actions     []AlertAction          `json:"actions" binding:"required"`
        Labels      map[string]string      `json:"labels"`
        Annotations map[string]string      `json:"annotations"`
    }
    
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    rule := &AlertRule{
        ID:          uuid.New().String(),
        TenantID:    tenantID,
        Name:        req.Name,
        Type:        req.Type,
        Enabled:     true,
        Severity:    req.Severity,
        Condition:   req.Condition,
        Threshold:   req.Threshold,
        Duration:    req.Duration,
        Actions:     req.Actions,
        Labels:      req.Labels,
        Annotations: req.Annotations,
        CreatedAt:   time.Now(),
        UpdatedAt:   time.Now(),
    }
    
    mgr := c.MustGet("alert_rule_manager").(*AlertRuleManager)
    if err := mgr.CreateRule(c.Request.Context(), rule); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, rule)
}

// 获取租户告警规则列表
// GET /api/v1/tenants/{tenant_id}/alert-rules
func ListTenantAlertRules(c *gin.Context) {
    tenantID := c.Param("tenant_id")
    
    mgr := c.MustGet("alert_rule_manager").(*AlertRuleManager)
    allRules := mgr.GetRules()
    
    // 过滤租户规则
    tenantRules := make([]*AlertRule, 0)
    for _, rule := range allRules {
        if rule.TenantID == tenantID {
            tenantRules = append(tenantRules, rule)
        }
    }
    
    c.JSON(200, tenantRules)
}

// 更新告警规则
// PUT /api/v1/tenants/{tenant_id}/alert-rules/{rule_id}
func UpdateAlertRule(c *gin.Context) {
    ruleID := c.Param("rule_id")
    
    var updates map[string]interface{}
    if err := c.ShouldBindJSON(&updates); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    mgr := c.MustGet("alert_rule_manager").(*AlertRuleManager)
    if err := mgr.UpdateRule(c.Request.Context(), ruleID, updates); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{"message": "告警规则已更新"})
}

// 删除告警规则
// DELETE /api/v1/tenants/{tenant_id}/alert-rules/{rule_id}
func DeleteAlertRule(c *gin.Context) {
    ruleID := c.Param("rule_id")
    
    mgr := c.MustGet("alert_rule_manager").(*AlertRuleManager)
    if err := mgr.DeleteRule(c.Request.Context(), ruleID); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{"message": "告警规则已删除"})
}

// 启用/禁用告警规则
// PUT /api/v1/tenants/{tenant_id}/alert-rules/{rule_id}/toggle
func ToggleAlertRule(c *gin.Context) {
    ruleID := c.Param("rule_id")
    
    var req struct {
        Enabled bool `json:"enabled"`
    }
    
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    mgr := c.MustGet("alert_rule_manager").(*AlertRuleManager)
    if err := mgr.ToggleRule(c.Request.Context(), ruleID, req.Enabled); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{"message": "告警规则状态已更新"})
}
```

**热更新生效时间**: < 10秒

### 10.3 日志规范

**日志格式**:

```json
{
  "timestamp": "2026-01-31T12:00:00Z",
  "level": "INFO",
  "component": "tenant-manager",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "action": "create_tenant",
  "operator": "admin@example.com",
  "duration_ms": 345,
  "status": "success",
  "message": "租户创建成功"
}
```

### 10.4 运维手册

**常见问题处理**:

1. **租户配额超限**:
   ```bash
   # 查看配额使用情况
   redis-cli GET "tenant:{tenant_id}:quota:storage_gb:used"
   redis-cli GET "tenant:{tenant_id}:quota:storage_gb:limit"
   
   # 临时提升配额
   redis-cli SET "tenant:{tenant_id}:quota:storage_gb:limit" 200
   
   # 永久更新配额（通过API）
   curl -X PUT /api/v1/tenants/{tenant_id}/quota \
     -H "Content-Type: application/json" \
     -d '{"storage_gb": 200}'
   ```

2. **租户数据清理**:
   ```bash
   # 删除ES索引
   curl -X DELETE "http://localhost:9200/{tenant_id}_logs_*"
   
   # 删除MinIO桶
   mc rb --force minio/tenant-{tenant_id}
   
   # 删除Kafka Topic
   kafka-topics --delete --topic {tenant_id}.logs
   
   # 删除Redis数据
   redis-cli --scan --pattern "{tenant_id}:*" | xargs redis-cli DEL
   ```

3. **隔离验证**:
   ```bash
   # 运行隔离验证脚本
   ./scripts/validate-tenant-isolation.sh {tenant_id}
   
   # 查看审计日志
   psql -c "SELECT * FROM tenant_audit_logs 
            WHERE tenant_id = '{tenant_id}' 
            ORDER BY timestamp DESC LIMIT 100"
   ```

---

## 11. 配置热更新详细设计

### 11.1 可热更新配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| multi_tenant_enabled | bool | false | 是否启用多租户 |
| default_plan | string | free | 默认套餐 |
| quota_check_enabled | bool | true | 是否启用配额检查 |
| quota_enforcement_mode | string | hard | 配额执行模式（soft/hard） |
| isolation_mode | string | auto | 隔离模式（shared/dedicated_schema/dedicated_instance/auto） |
| max_tenants | int | 1000 | 最大租户数 |
| tenant_creation_rate_limit | int | 10 | 租户创建速率限制（次/分钟） |
| **alert_rules** | **array** | **[]** | **告警规则列表（支持热更新）** |

**告警规则配置项**:

| 配置项 | 类型 | 说明 |
|--------|------|------|
| id | string | 规则唯一标识 |
| tenant_id | string | 租户ID（空表示系统级） |
| name | string | 规则名称 |
| type | string | 规则类型（quota/isolation/performance/custom） |
| enabled | bool | 是否启用 |
| severity | string | 严重级别（info/warning/critical） |
| condition | object | 告警条件 |
| threshold | float | 阈值 |
| duration | int | 持续时间（秒） |
| actions | array | 告警动作列表 |
| labels | object | 标签 |
| annotations | object | 注解 |

### 11.2 热更新实现

```go
// 配置管理器
type ConfigManager struct {
    config atomic.Value  // 存储*MultiTenantConfig
    redis  *redis.Client
    db     *sql.DB
}

// 多租户配置
type MultiTenantConfig struct {
    Enabled              bool   `json:"enabled"`
    DefaultPlan          string `json:"default_plan"`
    QuotaCheckEnabled    bool   `json:"quota_check_enabled"`
    QuotaEnforcementMode string `json:"quota_enforcement_mode"`
    IsolationMode        string `json:"isolation_mode"`
    MaxTenants           int    `json:"max_tenants"`
    TenantCreationRateLimit int `json:"tenant_creation_rate_limit"`
    Version              int    `json:"version"`
}

// 订阅配置变更
func (m *ConfigManager) subscribeConfigChanges() {
    pubsub := m.redis.Subscribe("config:multi_tenant:reload")
    
    for msg := range pubsub.Channel() {
        log.Info("收到配置变更通知", "version", msg.Payload)
        
        // 从Redis加载最新配置
        newConfig, err := m.loadConfigFromRedis()
        if err != nil {
            log.Error("加载配置失败", "error", err)
            continue
        }
        
        // 验证配置
        if err := newConfig.Validate(); err != nil {
            log.Error("配置验证失败", "error", err)
            continue
        }
        
        // 原子更新配置
        m.config.Store(newConfig)
        
        log.Info("配置已更新", 
            "version", newConfig.Version,
            "enabled", newConfig.Enabled,
            "default_plan", newConfig.DefaultPlan,
        )
        
        // 触发配置变更回调
        m.onConfigChanged(newConfig)
    }
}

// 获取当前配置（无锁）
func (m *ConfigManager) GetConfig() *MultiTenantConfig {
    return m.config.Load().(*MultiTenantConfig)
}

// 更新配置
func (m *ConfigManager) UpdateConfig(ctx context.Context, updates map[string]interface{}) error {
    // 1. 加载当前配置
    currentConfig := m.GetConfig()
    
    // 2. 应用更新
    newConfig := *currentConfig
    if err := applyUpdates(&newConfig, updates); err != nil {
        return err
    }
    newConfig.Version++
    
    // 3. 验证新配置
    if err := newConfig.Validate(); err != nil {
        return fmt.Errorf("配置验证失败: %w", err)
    }
    
    // 4. 保存到PostgreSQL
    if err := m.saveConfigToDB(ctx, &newConfig); err != nil {
        return fmt.Errorf("保存配置失败: %w", err)
    }
    
    // 5. 同步到Redis
    if err := m.saveConfigToRedis(ctx, &newConfig); err != nil {
        return fmt.Errorf("同步配置失败: %w", err)
    }
    
    // 6. 发布变更通知
    if err := m.redis.Publish(ctx, "config:multi_tenant:reload", 
        fmt.Sprintf("%d", newConfig.Version)).Err(); err != nil {
        return fmt.Errorf("发布通知失败: %w", err)
    }
    
    // 7. 记录审计日志
    m.logConfigChange(ctx, currentConfig, &newConfig)
    
    return nil
}

// 配置验证
func (c *MultiTenantConfig) Validate() error {
    if c.DefaultPlan != "free" && c.DefaultPlan != "professional" && 
       c.DefaultPlan != "enterprise" {
        return fmt.Errorf("无效的默认套餐: %s", c.DefaultPlan)
    }
    
    if c.QuotaEnforcementMode != "soft" && c.QuotaEnforcementMode != "hard" {
        return fmt.Errorf("无效的配额执行模式: %s", c.QuotaEnforcementMode)
    }
    
    if c.IsolationMode != "shared" && c.IsolationMode != "dedicated_schema" && 
       c.IsolationMode != "dedicated_instance" && c.IsolationMode != "auto" {
        return fmt.Errorf("无效的隔离模式: %s", c.IsolationMode)
    }
    
    if c.MaxTenants <= 0 {
        return fmt.Errorf("最大租户数必须大于0")
    }
    
    if c.TenantCreationRateLimit <= 0 {
        return fmt.Errorf("租户创建速率限制必须大于0")
    }
    
    return nil
}
```

### 11.3 验收标准

**配置热更新验收标准**:

1. ✅ 配置变更后10秒内所有节点生效
2. ✅ 配置验证失败时保持原配置不变
3. ✅ 支持通过API查询当前配置版本
4. ✅ 记录所有配置变更的审计日志
5. ✅ 配置回滚功能正常工作
6. ✅ 配置变更不影响现有租户服务

**告警规则热更新验收标准**:

1. ✅ 告警规则创建后10秒内生效
2. ✅ 告警规则更新后10秒内生效
3. ✅ 告警规则删除后10秒内停止评估
4. ✅ 告警规则启用/禁用立即生效
5. ✅ 支持租户自定义告警规则
6. ✅ 系统级告警规则和租户级告警规则隔离
7. ✅ 告警规则验证失败时拒绝创建/更新
8. ✅ 记录所有告警规则变更的审计日志
9. ✅ 支持多种告警动作（邮件、短信、Webhook、钉钉）
10. ✅ 告警规则支持模板变量（租户ID、资源类型、阈值等）

**YAML文件更新机制（备用方案）**:

当热更新机制不可用时（如Redis故障），系统支持通过YAML文件更新配置：

```yaml
# config/multi-tenant.yaml
multi_tenant:
  enabled: true
  default_plan: professional
  quota_check_enabled: true
  quota_enforcement_mode: hard
  isolation_mode: auto
  max_tenants: 1000
  tenant_creation_rate_limit: 10

# config/alert-rules.yaml
alert_rules:
  - id: quota-warning
    name: 租户配额警告
    type: quota
    enabled: true
    severity: warning
    condition:
      metric: tenant_quota_percentage
      operator: ">"
      value: 80
      aggregation: max
      time_window: 5m
    threshold: 80
    duration: 300
    actions:
      - type: email
        target: admin@example.com
    annotations:
      summary: "租户 {{ .tenant_id }} 配额使用率超过80%"
```

**YAML文件更新流程**:

1. 修改YAML配置文件
2. 执行配置验证: `./bin/validate-config config/`
3. 重启服务: `kubectl rollout restart deployment/tenant-manager`
4. 验证配置生效: `curl /api/v1/config/version`

**更新优先级**: 热更新（优先） > YAML文件重启更新（备用）

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 数据泄露 | 低 | 极高 | 多层隔离、定期审计、加密存储 |
| 配额绕过 | 中 | 高 | Redis原子操作、双重验证 |
| 性能下降 | 中 | 中 | 多级缓存、连接池、查询优化 |
| 租户删除失败 | 低 | 中 | 事务保护、数据备份、重试机制 |
| 配额计数不准 | 中 | 中 | 定期校准、审计日志对账 |
| 跨租户访问 | 低 | 极高 | 访问检测、自动告警、审计日志 |

### 12.2 回滚方案

**配置回滚**:

```go
// 配置回滚
func (m *ConfigManager) RollbackConfig(ctx context.Context, targetVersion int) error {
    // 1. 从数据库获取目标版本配置
    targetConfig, err := m.getConfigVersion(ctx, targetVersion)
    if err != nil {
        return fmt.Errorf("获取目标版本失败: %w", err)
    }
    
    // 2. 验证目标配置
    if err := targetConfig.Validate(); err != nil {
        return fmt.Errorf("目标配置无效: %w", err)
    }
    
    // 3. 同步到Redis
    if err := m.saveConfigToRedis(ctx, targetConfig); err != nil {
        return fmt.Errorf("同步配置失败: %w", err)
    }
    
    // 4. 发布回滚通知
    if err := m.redis.Publish(ctx, "config:multi_tenant:reload", 
        fmt.Sprintf("%d", targetConfig.Version)).Err(); err != nil {
        return fmt.Errorf("发布通知失败: %w", err)
    }
    
    // 5. 记录回滚操作
    m.logConfigRollback(ctx, targetVersion)
    
    log.Info("配置已回滚", "target_version", targetVersion)
    
    return nil
}
```

**租户数据回滚**:

```bash
#!/bin/bash
# 租户数据回滚脚本

TENANT_ID=$1
BACKUP_DATE=$2

echo "开始回滚租户 $TENANT_ID 到 $BACKUP_DATE 的备份..."

# 1. 停止租户服务
echo "暂停租户服务..."
curl -X PUT /api/v1/tenants/$TENANT_ID/suspend

# 2. 恢复PostgreSQL数据
echo "恢复数据库..."
pg_restore -d logdb -t "logs WHERE tenant_id='$TENANT_ID'" \
  backups/tenant-$TENANT_ID-$BACKUP_DATE.dump

# 3. 恢复Elasticsearch索引
echo "恢复ES索引..."
curl -X POST "localhost:9200/_snapshot/backup/tenant-$TENANT_ID-$BACKUP_DATE/_restore" \
  -H 'Content-Type: application/json' \
  -d "{\"indices\": \"${TENANT_ID}_logs_*\"}"

# 4. 恢复MinIO数据
echo "恢复对象存储..."
mc mirror backups/minio/tenant-$TENANT_ID-$BACKUP_DATE/ \
  minio/tenant-$TENANT_ID/

# 5. 重置配额计数
echo "重置配额..."
redis-cli DEL "${TENANT_ID}:quota:*:used"

# 6. 恢复租户服务
echo "恢复租户服务..."
curl -X PUT /api/v1/tenants/$TENANT_ID/resume

echo "回滚完成！"
```

### 12.3 应急预案

**数据泄露应急**:

1. 立即暂停受影响租户
2. 隔离受影响系统
3. 分析泄露范围和原因
4. 通知受影响租户
5. 修复安全漏洞
6. 恢复服务并加强监控

**配额系统故障**:

1. 切换到降级模式（不检查配额）
2. 记录所有请求用于事后对账
3. 修复配额系统
4. 重新计算配额使用量
5. 恢复正常模式

**隔离失效**:

1. 立即暂停所有租户服务
2. 分析隔离失效原因
3. 修复隔离机制
4. 验证隔离有效性
5. 逐步恢复租户服务

---

## 13. 附录

### 13.1 术语表

| 术语 | 说明 |
|------|------|
| RLS | Row Level Security，PostgreSQL行级安全策略 |
| 租户隔离 | 确保租户间数据和资源完全隔离 |
| 配额 | 租户可使用的资源限制 |
| 软限制 | 超限时仅告警，不拒绝请求 |
| 硬限制 | 超限时拒绝请求 |
| 多租户 | 单个系统实例服务多个租户 |
| SaaS | Software as a Service，软件即服务 |

### 13.2 参考文档

- [PostgreSQL RLS文档](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Elasticsearch索引管理](https://www.elastic.co/guide/en/elasticsearch/reference/current/indices.html)
- [MinIO多租户最佳实践](https://min.io/docs/minio/linux/administration/identity-access-management/minio-user-management.html)
- [Kafka多租户设计](https://www.confluent.io/blog/multi-tenant-kafka-clusters/)
- [JWT最佳实践](https://tools.ietf.org/html/rfc8725)

### 13.3 不推荐热更新的配置说明

虽然模块22的大部分配置都支持热更新，但以下配置不推荐使用热更新：

| 配置项 | 不推荐原因 | 推荐更新方式 |
|--------|-----------|-------------|
| isolation_mode | 隔离模式变更涉及数据迁移和架构重构 | YAML文件 + 服务重启 + 数据迁移 |
| max_tenants | 可能需要调整底层资源配置 | YAML文件 + 服务重启 |

**详细说明**：

1. **isolation_mode（隔离模式）**
   - **不推荐原因**：从共享表切换到独立Schema或独立数据库实例需要：
     - 数据迁移（可能需要数小时）
     - 数据库架构重构
     - 连接池重新配置
     - 可能导致服务中断
   - **推荐方式**：
     1. 修改YAML配置文件
     2. 执行数据迁移脚本
     3. 验证数据完整性
     4. 重启服务
     5. 验证隔离有效性

2. **max_tenants（最大租户数）**
   - **不推荐原因**：大幅增加最大租户数可能需要：
     - 调整数据库连接池大小
     - 调整ES集群分片配置
     - 调整Kafka分区数
     - 增加系统资源（CPU/内存）
   - **推荐方式**：
     1. 评估资源需求
     2. 调整基础设施配置
     3. 修改YAML配置文件
     4. 重启服务
     5. 监控系统性能

**其他配置均支持热更新**：
- default_plan（默认套餐）
- quota_check_enabled（配额检查开关）
- quota_enforcement_mode（配额执行模式）
- tenant_creation_rate_limit（租户创建速率限制）
- alert_rules（告警规则）

### 13.4 配置热更新扩展接口

**扩展接口定义**:

```go
// ConfigHook 配置变更钩子接口
type ConfigHook interface {
    // OnConfigChange 配置变更时调用
    OnConfigChange(oldConfig, newConfig *MultiTenantConfig) error
    
    // OnConfigValidate 配置验证时调用
    OnConfigValidate(config *MultiTenantConfig) error
    
    // OnConfigRollback 配置回滚时调用
    OnConfigRollback(config *MultiTenantConfig) error
}

// TenantLifecycleHook 租户生命周期钩子接口
type TenantLifecycleHook interface {
    // OnTenantCreated 租户创建后调用
    OnTenantCreated(ctx context.Context, tenant *Tenant) error
    
    // OnTenantUpdated 租户更新后调用
    OnTenantUpdated(ctx context.Context, oldTenant, newTenant *Tenant) error
    
    // OnTenantDeleted 租户删除后调用
    OnTenantDeleted(ctx context.Context, tenant *Tenant) error
    
    // OnTenantSuspended 租户暂停后调用
    OnTenantSuspended(ctx context.Context, tenant *Tenant, reason string) error
    
    // OnTenantResumed 租户恢复后调用
    OnTenantResumed(ctx context.Context, tenant *Tenant) error
}

// QuotaHook 配额钩子接口
type QuotaHook interface {
    // OnQuotaExceeded 配额超限时调用
    OnQuotaExceeded(ctx context.Context, tenantID string, resourceType ResourceType, usage, limit int64) error
    
    // OnQuotaWarning 配额警告时调用（80%）
    OnQuotaWarning(ctx context.Context, tenantID string, resourceType ResourceType, usage, limit int64) error
    
    // OnQuotaReset 配额重置时调用
    OnQuotaReset(ctx context.Context, tenantID string, resourceType ResourceType) error
}

// IsolationValidator 隔离验证器接口
type IsolationValidator interface {
    // ValidatePostgreSQLIsolation 验证PostgreSQL隔离
    ValidatePostgreSQLIsolation(ctx context.Context, tenantID string) error
    
    // ValidateElasticsearchIsolation 验证Elasticsearch隔离
    ValidateElasticsearchIsolation(ctx context.Context, tenantID string) error
    
    // ValidateMinIOIsolation 验证MinIO隔离
    ValidateMinIOIsolation(ctx context.Context, tenantID string) error
    
    // ValidateRedisIsolation 验证Redis隔离
    ValidateRedisIsolation(ctx context.Context, tenantID string) error
    
    // ValidateKafkaIsolation 验证Kafka隔离
    ValidateKafkaIsolation(ctx context.Context, tenantID string) error
}

// 注册扩展接口
type ExtensionRegistry struct {
    configHooks          []ConfigHook
    lifecycleHooks       []TenantLifecycleHook
    quotaHooks           []QuotaHook
    isolationValidators  []IsolationValidator
}

// RegisterConfigHook 注册配置钩子
func (r *ExtensionRegistry) RegisterConfigHook(hook ConfigHook) {
    r.configHooks = append(r.configHooks, hook)
}

// RegisterLifecycleHook 注册生命周期钩子
func (r *ExtensionRegistry) RegisterLifecycleHook(hook TenantLifecycleHook) {
    r.lifecycleHooks = append(r.lifecycleHooks, hook)
}

// RegisterQuotaHook 注册配额钩子
func (r *ExtensionRegistry) RegisterQuotaHook(hook QuotaHook) {
    r.quotaHooks = append(r.quotaHooks, hook)
}

// RegisterIsolationValidator 注册隔离验证器
func (r *ExtensionRegistry) RegisterIsolationValidator(validator IsolationValidator) {
    r.isolationValidators = append(r.isolationValidators, validator)
}
```

**扩展使用示例**:

```go
// 示例1: 自定义配额超限处理
type CustomQuotaHandler struct {
    notifier *NotificationService
}

func (h *CustomQuotaHandler) OnQuotaExceeded(ctx context.Context, tenantID string, 
    resourceType ResourceType, usage, limit int64) error {
    
    // 发送自定义通知
    return h.notifier.SendQuotaAlert(tenantID, resourceType, usage, limit)
}

func (h *CustomQuotaHandler) OnQuotaWarning(ctx context.Context, tenantID string, 
    resourceType ResourceType, usage, limit int64) error {
    
    // 发送警告通知
    return h.notifier.SendQuotaWarning(tenantID, resourceType, usage, limit)
}

func (h *CustomQuotaHandler) OnQuotaReset(ctx context.Context, tenantID string, 
    resourceType ResourceType) error {
    
    log.Info("配额已重置", "tenant_id", tenantID, "resource_type", resourceType)
    return nil
}

// 示例2: 租户创建后自动初始化
type TenantInitializer struct {
    emailService *EmailService
    slackService *SlackService
}

func (h *TenantInitializer) OnTenantCreated(ctx context.Context, tenant *Tenant) error {
    // 发送欢迎邮件
    if err := h.emailService.SendWelcomeEmail(tenant); err != nil {
        log.Error("发送欢迎邮件失败", "error", err)
    }
    
    // 通知Slack
    if err := h.slackService.NotifyNewTenant(tenant); err != nil {
        log.Error("Slack通知失败", "error", err)
    }
    
    // 创建默认仪表盘
    if err := h.createDefaultDashboard(ctx, tenant.ID); err != nil {
        return fmt.Errorf("创建默认仪表盘失败: %w", err)
    }
    
    return nil
}

// 示例3: 自定义隔离验证
type CustomIsolationValidator struct {
    db *sql.DB
    es *elasticsearch.Client
}

func (v *CustomIsolationValidator) ValidatePostgreSQLIsolation(ctx context.Context, 
    tenantID string) error {
    
    // 尝试跨租户查询
    var count int
    err := v.db.QueryRowContext(ctx, `
        SELECT COUNT(*) FROM logs 
        WHERE tenant_id != $1
    `, tenantID).Scan(&count)
    
    if err != nil {
        return fmt.Errorf("查询失败: %w", err)
    }
    
    if count > 0 {
        return fmt.Errorf("检测到跨租户数据访问: %d条记录", count)
    }
    
    return nil
}

// 注册扩展
func RegisterExtensions(registry *ExtensionRegistry) {
    // 注册配额处理器
    registry.RegisterQuotaHook(&CustomQuotaHandler{
        notifier: notificationService,
    })
    
    // 注册租户初始化器
    registry.RegisterLifecycleHook(&TenantInitializer{
        emailService: emailService,
        slackService: slackService,
    })
    
    // 注册隔离验证器
    registry.RegisterIsolationValidator(&CustomIsolationValidator{
        db: database,
        es: esClient,
    })
}
```

**扩展点说明**:

| 扩展点 | 用途 | 使用场景 |
|--------|------|----------|
| ConfigHook | 配置变更钩子 | 配置变更时的自定义处理、验证、通知 |
| TenantLifecycleHook | 租户生命周期钩子 | 租户创建/更新/删除时的自动化操作 |
| QuotaHook | 配额钩子 | 配额超限/警告时的自定义处理 |
| IsolationValidator | 隔离验证器 | 自定义隔离验证逻辑、安全审计 |

### 13.5 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-01-31 | v1.0 | 初稿，完整设计方案 | 系统架构团队 |
| 2026-02-01 | v1.1 | 补充配置热更新扩展接口、不推荐热更新配置说明 | 系统架构团队 |

---

**文档结束**

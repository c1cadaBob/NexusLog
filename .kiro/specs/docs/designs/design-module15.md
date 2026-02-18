# 模块十五：企业级功能 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-01-31  
> **状态**: 已发布  
> **相关需求**: [requirements-module15.md](../requirements/requirements-module15.md)

---

## 1. 文档信息

### 1.1 版本历史
| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-01-31 | 系统架构团队 | 初稿，完整设计方案 |

### 1.2 文档状态

- **当前状态**: 已发布
- **评审状态**: 已通过
- **实施阶段**: Phase 2 (需求53), Phase 3 (需求51, 52, 54, 55)

### 1.3 相关文档
- [需求文档](../requirements/requirements-module15.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)

---

## 2. 总体架构

### 2.1 系统架构图
```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                企业级功能模块整体架构                                        │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            多租户管理层                                                │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ 租户管理     │    │ 资源配额     │    │ 数据隔离     │                           │ │
│  │  │ (Tenant Mgr) │    │ (Quota Mgr)  │    │ (Isolation)  │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            跨云管理层                                                  │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ AWS 适配器   │    │ Azure 适配器 │    │ GCP 适配器   │                           │ │
│  │  │ (CloudWatch) │    │ (Monitor)    │    │ (Logging)    │                           │ │
│  │  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                           │ │
│  │         └──────────────────┬──────────────────┘                                      │ │
│  │                            ▼                                                          │ │
│  │                  ┌──────────────────┐                                                │ │
│  │                  │ 统一日志接口     │                                                │ │
│  │                  │ (Unified API)    │                                                │ │
│  │                  └──────────────────┘                                                │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            容器化支持层                                                │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                        Kubernetes 集成                                       │    │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                      │    │ │
│  │  │  │ Pod 日志采集 │  │ 服务发现     │  │ 标签路由     │                      │    │ │
│  │  │  │ (DaemonSet)  │  │ (K8s API)    │  │ (Labels)     │                      │    │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘                      │    │ │
│  │  │                                                                              │    │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                      │    │ │
│  │  │  │ Service Mesh │  │ Helm Chart   │  │ Operator     │                      │    │ │
│  │  │  │ (Istio)      │  │ (部署)       │  │ (自动化)     │                      │    │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘                      │    │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘    │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            IoT 设备管理层                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                        设备管理                                              │    │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                      │    │ │
│  │  │  │ 设备发现     │  │ 设备注册     │  │ 设备监控     │                      │    │ │
│  │  │  │ (mDNS/SSDP)  │  │ (Auto Config)│  │ (Health)     │                      │    │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘                      │    │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘    │ │
│  │                                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                        边缘节点                                              │    │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                      │    │ │
│  │  │  │ 本地预处理   │  │ 数据压缩     │  │ 离线缓存     │                      │    │ │
│  │  │  │ (Filter)     │  │ (LZ4)        │  │ (SQLite)     │                      │    │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘                      │    │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘    │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            成本管理层                                                  │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ 成本采集     │    │ 成本分析     │    │ 成本优化     │                           │ │
│  │  │ (Metrics)    │───▶│ (Analytics)  │───▶│ (Advisor)    │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  │                                                                                       │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ 成本分摊     │    │ 预算管理     │    │ 成本告警     │                           │ │
│  │  │ (Allocation) │    │ (Budget)     │    │ (Alert)      │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分
| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| 多租户管理 | 提供租户隔离和资源配额管理 | 租户创建、配额管理、数据隔离、网络隔离、品牌定制 |
| 跨云管理 | 统一管理多云平台日志 | 云平台适配、跨云同步、智能路由、健康检查、成本对比 |
| 容器化支持 | Kubernetes深度集成 | Pod日志采集、Service Mesh集成、CRD管理、Helm部署、Operator |
| IoT设备管理 | 边缘设备自动发现和管理 | 设备发现、自动配置、边缘处理、离线缓存、健康监控 |
| 成本管理 | 成本采集、分析和优化 | 成本采集、成本分摊、优化建议、预算管理、成本预测 |

### 2.3 关键路径

**多租户数据隔离路径**:
```
API请求 → 租户识别(JWT/Header) → 租户验证 → 数据库路由(租户Schema) 
  → Elasticsearch索引路由(租户前缀) → Redis缓存隔离(租户Key前缀)

隔离延迟: < 10ms
```

**跨云日志同步路径**:
```
源云平台 → 云适配器采集(100ms) → 数据转换(50ms) → 过滤规则(20ms) 
  → 压缩(30ms) → 目标云平台写入(200ms)

同步延迟: < 5秒 (P95)
```

**Kubernetes日志采集路径**:
```
Pod日志 → DaemonSet采集(50ms) → 多行合并(20ms) → 元数据enrichment(30ms) 
  → Kafka发送(100ms)

采集延迟: < 200ms (P95)
```

**IoT设备发现路径**:
```
设备上线 → mDNS/MQTT广播 → 设备发现(30秒) → 自动配置(120秒) 
  → 开始采集

发现到采集: < 2分钟
```

**成本分析路径**:
```
云平台成本API → 成本采集(1小时) → 成本分摊计算(5分钟) 
  → 优化机会识别(10分钟) → Dashboard展示

数据更新延迟: < 1小时
```

---

## 3. 技术选型

### 3.1 核心技术栈
| 技术 | 版本 | 选择理由 |
|------|------|----------|
| Kubernetes | 1.28+ | 容器编排、多租户隔离、资源配额管理、服务发现 |
| Kubernetes Network Policy | - | 租户间网络隔离、安全策略实施 |
| Helm | 3.x | 应用打包部署、配置管理、版本控制 |
| Kubernetes Operator | - | 自动化运维、CRD管理、声明式配置 |
| Istio | 1.20+ | Service Mesh、流量管理、可观测性、安全通信 |
| Terraform | 1.6+ | 跨云基础设施管理、资源编排、状态管理 |
| AWS SDK for Go | 1.48+ | AWS服务集成、CloudWatch日志采集、Cost Explorer |
| Azure SDK for Go | 1.9+ | Azure服务集成、Monitor日志采集、Cost Management |
| Google Cloud SDK | 0.110+ | GCP服务集成、Cloud Logging、Billing API |
| MQTT (Paho) | 1.4+ | IoT设备通信、消息发布订阅、QoS保证 |
| CoAP | - | 轻量级IoT协议、资源受限设备、低功耗通信 |
| mDNS (Zeroconf) | - | 本地网络设备发现、零配置网络、服务广播 |
| BoltDB | 1.3+ | 边缘节点离线缓存、嵌入式KV存储、无需外部依赖 |
| FinOps工具链 | - | 成本管理、资源优化、预算控制 |

### 3.2 多租户隔离技术对比

| 方案 | 隔离级别 | 性能 | 成本 | 复杂度 | 选择 |
|------|---------|------|------|--------|------|
| 共享数据库+行级隔离 | 低 | 高 | 低 | 低 | ❌ |
| 独立Schema | 中 | 中 | 中 | 中 | ✅ |
| 独立数据库实例 | 高 | 低 | 高 | 高 | ✅ (大租户) |
| Kubernetes Namespace | 高 | 中 | 中 | 中 | ✅ |

**选择策略**:
- 小租户（< 10GB）: 共享数据库 + 独立Schema + Namespace隔离
- 中租户（10-100GB）: 独立Schema + 独立Namespace + Network Policy
- 大租户（> 100GB）: 独立数据库实例 + 独立Namespace + 专用节点

### 3.3 跨云管理技术对比

| 方案 | 统一性 | 灵活性 | 维护成本 | 选择 |
|------|--------|--------|----------|------|
| 直接调用云平台API | 低 | 高 | 高 | ❌ |
| 统一抽象层 | 高 | 中 | 中 | ✅ |
| 第三方工具(Terraform) | 中 | 高 | 低 | ✅ (基础设施) |
| 云原生工具(Crossplane) | 高 | 中 | 中 | ⚠️ (未来考虑) |

**选择理由**:
1. 统一抽象层提供一致的API接口，简化上层应用开发
2. Terraform管理跨云基础设施，支持多云部署和迁移
3. 为每个云平台实现专用适配器，封装原生API差异
4. 保留直接调用原生API的能力，支持特殊功能

### 3.4 IoT协议选型

| 协议 | 特点 | 适用场景 | 选择 |
|------|------|---------|------|
| MQTT | 轻量级、Pub/Sub、QoS | 通用IoT设备、实时通信 | ✅ |
| CoAP | 超轻量、RESTful、UDP | 资源受限设备、低功耗 | ✅ |
| LwM2M | 设备管理、OMA标准 | 设备生命周期管理 | ✅ |
| HTTP/HTTPS | 通用、易用 | 边缘网关、高性能设备 | ✅ |
| LoRaWAN | 长距离、低功耗 | 远程传感器 | ⚠️ (可选) |

**选择策略**:
- 通用设备: MQTT (主要)
- 低功耗设备: CoAP
- 设备管理: LwM2M
- 边缘网关: HTTP/HTTPS

---

## 4. 关键流程设计

### 4.1 多租户创建流程

```
1. 用户提交租户创建请求（名称、配额、品牌定制）
2. 生成唯一租户ID
3. 创建Kubernetes Namespace（tenant-{id}）
4. 应用Network Policy（租户间网络隔离）
5. 创建独立数据库Schema或实例
6. 创建Elasticsearch索引模板（tenant-{id}-logs-*）
7. 初始化Redis缓存空间（tenant:{id}:*）
8. 配置资源配额（CPU、内存、存储）
9. 启动配额监控
10. 返回租户信息

总耗时: < 30秒
```

### 4.2 跨云日志同步流程

```
实时同步模式:
1. 源云平台日志流 → 云适配器
2. 应用过滤规则（减少数据量）
3. 数据格式转换（统一格式）
4. 批量缓冲（1000条或5秒）
5. LZ4压缩（可选）
6. 目标云平台批量写入
7. 重试机制（最多3次）
8. 记录同步指标

同步延迟: < 5秒 (P95)
```

### 4.3 Kubernetes日志采集流程

```
1. Pod Informer监听Pod变化
2. 检查是否需要采集（Namespace、Label、Annotation过滤）
3. 为每个容器创建日志流
4. 读取日志并解析时间戳
5. 多行日志合并（Java堆栈、Python Traceback）
6. 添加Kubernetes元数据（Pod名称、Namespace、Labels等）
7. 发送到Kafka
8. 记录采集指标

采集延迟: < 200ms (P95)
```

### 4.4 IoT设备发现和配置流程

```
设备发现:
1. 设备上线并广播（mDNS/MQTT）
2. 发现服务接收广播
3. 解析设备信息（类型、能力、IP）
4. 注册到设备注册表
5. 触发自动配置流程

自动配置:
1. 根据设备类型选择配置模板
2. 生成设备专属配置
3. 通过MQTT/HTTP推送配置
4. 设备应用配置并确认
5. 开始日志采集
6. 启动健康监控

发现到采集: < 2分钟
```

### 4.5 成本优化执行流程

```
1. 成本分析器识别优化机会
2. 计算预期节省金额
3. 生成优化建议
4. 用户审批（如需要）
5. 执行优化操作:
   - 降低采样率
   - 调整保留期
   - 启用压缩
   - 迁移存储层级
6. 验证优化效果
7. 记录实际节省金额
8. 更新成本报告

执行时间: 根据操作类型，5分钟-24小时
```

### 4.6 异常流程

| 异常类型 | 处理策略 | 恢复机制 |
|----------|----------|----------|
| 租户配额超限 | 限流拒绝新请求 | 扩容配额或清理数据 |
| 云平台不可用 | 自动故障转移 | 健康检查恢复后切回 |
| Kubernetes节点故障 | Pod自动重调度 | DaemonSet保证覆盖 |
| IoT设备离线 | 本地缓存 | 上线后自动同步 |
| 成本超预算 | 发送告警 | 应用成本控制策略 |

### 4.7 配置热更新流程

```
1. 用户在Web Console修改配置
2. 配置保存到PostgreSQL（版本化）
3. 配置同步到Redis
4. Redis发布Pub/Sub通知（config:module15:reload）
5. 所有实例订阅到通知
6. 重新加载配置并验证
7. 使用atomic.Value原子更新
8. 记录审计日志
9. 返回更新成功响应

生效时间: < 5秒
```

---

## 5. 接口设计

### 5.1 API列表

详见 [API设计文档](./api-design.md) 模块15部分，共69个接口（API-15-503 ~ API-15-571）:

**多租户管理接口** (API-15-503 ~ API-15-515): 13个接口
- POST /api/v1/tenants - 创建租户
- GET /api/v1/tenants - 获取租户列表
- GET /api/v1/tenants/{id} - 获取租户详情
- PUT /api/v1/tenants/{id} - 更新租户配置
- DELETE /api/v1/tenants/{id} - 删除租户
- GET /api/v1/tenants/{id}/quota - 获取配额使用情况
- PUT /api/v1/tenants/{id}/quota - 更新租户配额
- PUT /api/v1/tenants/{id}/suspend - 暂停租户
- PUT /api/v1/tenants/{id}/resume - 恢复租户
- PUT /api/v1/tenants/{id}/branding - 更新品牌定制
- PUT /api/v1/tenants/{id}/features - 更新功能开关
- POST /api/v1/tenants/{id}/backup - 备份租户数据
- POST /api/v1/tenants/{id}/restore - 恢复租户数据

**跨云管理接口** (API-15-516 ~ API-15-526): 11个接口  
- GET /api/v1/cloud-providers - 获取云平台列表
- GET /api/v1/cloud-providers/{id} - 获取云平台详情
- GET /api/v1/cloud-providers/{id}/logs - 从云平台采集日志
- POST /api/v1/cloud-sync/rules - 创建跨云同步规则
- GET /api/v1/cloud-sync/rules - 获取同步规则列表
- PUT /api/v1/cloud-sync/rules/{id} - 更新同步规则
- DELETE /api/v1/cloud-sync/rules/{id} - 删除同步规则
- GET /api/v1/cloud-sync/status - 获取同步状态
- GET /api/v1/cloud-health - 获取云平台健康状态
- GET /api/v1/cloud-costs - 获取跨云成本对比
- GET /api/v1/cloud-topology - 获取跨云拓扑视图

**Kubernetes集成接口** (API-15-527 ~ API-15-535): 9个接口
- GET /api/v1/kubernetes/namespaces - 获取Namespace列表
- GET /api/v1/kubernetes/pods - 获取Pod列表
- GET /api/v1/kubernetes/pods/{name}/logs - 获取Pod日志
- POST /api/v1/kubernetes/collection-rules - 创建日志采集规则(CRD)
- GET /api/v1/kubernetes/collection-rules - 获取采集规则列表
- PUT /api/v1/kubernetes/collection-rules/{id} - 更新采集规则
- DELETE /api/v1/kubernetes/collection-rules/{id} - 删除采集规则
- GET /api/v1/kubernetes/service-mesh/logs - 获取Service Mesh日志
- GET /api/v1/kubernetes/cluster-view - 获取集群视图

**IoT设备管理接口** (API-15-536 ~ API-15-550): 15个接口
- GET /api/v1/iot/devices - 获取IoT设备列表
- GET /api/v1/iot/devices/{id} - 获取设备详情
- PUT /api/v1/iot/devices/{id} - 更新设备配置
- DELETE /api/v1/iot/devices/{id} - 删除设备
- POST /api/v1/iot/devices/discover - 手动触发设备发现
- POST /api/v1/iot/devices/{id}/provision - 配置设备
- GET /api/v1/iot/devices/{id}/health - 获取设备健康状态
- GET /api/v1/iot/devices/{id}/logs - 获取设备日志
- POST /api/v1/iot/groups - 创建设备分组
- GET /api/v1/iot/groups - 获取设备分组列表
- PUT /api/v1/iot/groups/{id} - 更新设备分组
- DELETE /api/v1/iot/groups/{id} - 删除设备分组
- GET /api/v1/iot/topology - 获取设备拓扑视图
- GET /api/v1/iot/edge-nodes/{id}/cache - 获取边缘节点缓存状态
- POST /api/v1/iot/edge-nodes/{id}/sync - 同步边缘节点缓存

**成本管理接口** (API-15-551 ~ API-15-565): 15个接口
- GET /api/v1/costs/dashboard - 获取成本仪表盘数据
- GET /api/v1/costs/breakdown - 获取成本分类明细
- GET /api/v1/costs/allocation - 获取成本分摊数据
- POST /api/v1/costs/allocation/rules - 创建成本分摊规则
- GET /api/v1/costs/allocation/rules - 获取分摊规则列表
- PUT /api/v1/costs/allocation/rules/{id} - 更新分摊规则
- DELETE /api/v1/costs/allocation/rules/{id} - 删除分摊规则
- GET /api/v1/costs/opportunities - 获取成本优化机会
- POST /api/v1/costs/optimize - 执行成本优化
- POST /api/v1/costs/budgets - 创建预算
- GET /api/v1/costs/budgets - 获取预算列表
- GET /api/v1/costs/budgets/{id} - 获取预算详情
- PUT /api/v1/costs/budgets/{id} - 更新预算
- DELETE /api/v1/costs/budgets/{id} - 删除预算
- GET /api/v1/costs/forecast - 获取成本预测

**告警规则管理接口** (API-15-566 ~ API-15-571): 6个接口
- POST /api/v1/alert-rules - 创建告警规则
- GET /api/v1/alert-rules - 获取告警规则列表
- GET /api/v1/alert-rules/{id} - 获取告警规则详情
- PUT /api/v1/alert-rules/{id} - 更新告警规则
- DELETE /api/v1/alert-rules/{id} - 删除告警规则
- PUT /api/v1/alert-rules/{id}/toggle - 启用/禁用告警规则

### 5.2 内部接口

**租户管理器接口**:

```go
type TenantManager interface {
    // 创建租户
    CreateTenant(ctx context.Context, req *CreateTenantRequest) (*Tenant, error)
    
    // 获取租户
    GetTenant(ctx context.Context, tenantID string) (*Tenant, error)
    
    // 更新租户
    UpdateTenant(ctx context.Context, tenantID string, updates map[string]interface{}) error
    
    // 删除租户
    DeleteTenant(ctx context.Context, tenantID string) error
    
    // 检查配额
    CheckQuota(ctx context.Context, tenantID string, resourceType string, amount int64) error
    
    // 更新配额使用量
    UpdateQuotaUsage(ctx context.Context, tenantID string, resourceType string, amount int64) error
}
```

**云平台适配器接口**:

```go
type CloudProvider interface {
    // 基础信息
    Name() string
    Region() string
    
    // 日志采集
    CollectLogs(ctx context.Context, query *LogQuery) ([]*LogEntry, error)
    StreamLogs(ctx context.Context, query *LogQuery) (<-chan *LogEntry, error)
    
    // 日志写入
    WriteLogs(ctx context.Context, logs []*LogEntry) error
    
    // 资源管理
    ListResources(ctx context.Context) ([]*CloudResource, error)
    GetMetrics(ctx context.Context, resource string) (*CloudMetrics, error)
    
    // 成本信息
    GetCostInfo(ctx context.Context, timeRange TimeRange) (*CostInfo, error)
}
```

**Kubernetes采集器接口**:

```go
type KubernetesCollector interface {
    // 启动采集
    Start(ctx context.Context) error
    
    // 停止采集
    Stop(ctx context.Context) error
    
    // 判断是否需要采集
    ShouldCollect(pod *corev1.Pod) bool
    
    // 采集容器日志
    CollectContainerLogs(ctx context.Context, pod *corev1.Pod, containerName string) error
}
```

**IoT设备管理器接口**:

```go
type IoTDeviceManager interface {
    // 启动设备发现
    StartDiscovery(ctx context.Context) error
    
    // 注册设备
    RegisterDevice(ctx context.Context, device *IoTDevice) error
    
    // 配置设备
    ProvisionDevice(ctx context.Context, deviceID string, config *DeviceConfig) error
    
    // 获取设备健康状态
    GetDeviceHealth(ctx context.Context, deviceID string) (*DeviceHealth, error)
    
    // 同步离线缓存
    SyncOfflineCache(ctx context.Context, deviceID string) error
}
```

**成本管理器接口**:

```go
type CostManager interface {
    // 采集成本数据
    CollectCost(ctx context.Context, period TimePeriod) (*CostData, error)
    
    // 成本分摊
    AllocateCost(ctx context.Context, costData *CostData) (map[string]float64, error)
    
    // 识别优化机会
    IdentifyOpportunities(ctx context.Context, period TimePeriod) ([]OptimizationOpportunity, error)
    
    // 执行优化
    ExecuteOptimization(ctx context.Context, opportunity OptimizationOpportunity) (*OptimizationResult, error)
    
    // 检查预算
    CheckBudget(ctx context.Context, budgetID string) error
    
    // 预测成本
    ForecastCost(ctx context.Context, months int) (*CostForecast, error)
}
```

---

## 6. 数据设计

### 6.1 核心数据模型

**租户模型**:

```go
type Tenant struct {
    ID          string                 `json:"id" db:"id"`
    Name        string                 `json:"name" db:"name"`
    Status      TenantStatus           `json:"status" db:"status"` // active, suspended, deleted
    CreatedAt   time.Time              `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time              `json:"updated_at" db:"updated_at"`
    
    // 资源配额
    Quota       TenantQuota            `json:"quota" db:"quota"`
    
    // 自定义配置
    Branding    TenantBranding         `json:"branding" db:"branding"`
    Features    map[string]bool        `json:"features" db:"features"`
    
    // 隔离配置
    Namespace   string                 `json:"namespace" db:"namespace"`   // Kubernetes namespace
    DatabaseID  string                 `json:"database_id" db:"database_id"` // 独立数据库实例
    IndexPrefix string                 `json:"index_prefix" db:"index_prefix"` // ES 索引前缀
}

type TenantQuota struct {
    StorageQuotaGB      int64   `json:"storage_quota_gb"`
    StorageUsedGB       float64 `json:"storage_used_gb"`
    LogCountQuota       int64   `json:"log_count_quota"`
    LogCountUsed        int64   `json:"log_count_used"`
    APICallQuota        int64   `json:"api_call_quota"`
    APICallUsed         int64   `json:"api_call_used"`
    CPULimit            string  `json:"cpu_limit"`
    MemoryLimit         string  `json:"memory_limit"`
    BandwidthLimitMbps  int     `json:"bandwidth_limit_mbps"`
}

type TenantBranding struct {
    LogoURL      string `json:"logo_url"`
    PrimaryColor string `json:"primary_color"`
    Theme        string `json:"theme"`
    CustomCSS    string `json:"custom_css"`
    CustomDomain string `json:"custom_domain"`
}
```

**IoT设备模型**:

```go
type IoTDevice struct {
    ID           string                 `json:"id" db:"id"`
    Name         string                 `json:"name" db:"name"`
    Type         string                 `json:"type" db:"type"` // sensor, gateway, edge_node
    Status       DeviceStatus           `json:"status" db:"status"` // online, offline, error
    IPAddress    string                 `json:"ip_address" db:"ip_address"`
    MACAddress   string                 `json:"mac_address" db:"mac_address"`
    Location     *GeoLocation           `json:"location" db:"location"`
    Metadata     map[string]interface{} `json:"metadata" db:"metadata"`
    Capabilities DeviceCapabilities     `json:"capabilities" db:"capabilities"`
    Protocol     string                 `json:"protocol" db:"protocol"` // mqtt, coap, lwm2m, http
    LastSeen     time.Time              `json:"last_seen" db:"last_seen"`
    Resources    DeviceResources        `json:"resources" db:"resources"`
    HealthScore  float64                `json:"health_score" db:"health_score"`
    Groups       []string               `json:"groups" db:"groups"`
    CreatedAt    time.Time              `json:"created_at" db:"created_at"`
    UpdatedAt    time.Time              `json:"updated_at" db:"updated_at"`
}

type DeviceCapabilities struct {
    LogCollection    bool    `json:"log_collection"`
    LocalProcessing  bool    `json:"local_processing"`
    OfflineCache     bool    `json:"offline_cache"`
    Compression      bool    `json:"compression"`
    Encryption       bool    `json:"encryption"`
    MaxCPUPercent    float64 `json:"max_cpu_percent"`
    MaxMemoryMB      int     `json:"max_memory_mb"`
    MaxStorageGB     int     `json:"max_storage_gb"`
    MaxBandwidthKbps int     `json:"max_bandwidth_kbps"`
}
```

**成本数据模型**:

```go
type CostData struct {
    ID          int64                  `json:"id" db:"id"`
    Period      TimePeriod             `json:"period" db:"period"`
    TotalCost   float64                `json:"total_cost" db:"total_cost"`
    Currency    string                 `json:"currency" db:"currency"` // USD, CNY
    Breakdown   CostBreakdown          `json:"breakdown" db:"breakdown"`
    Allocation  map[string]float64     `json:"allocation" db:"allocation"`
    CreatedAt   time.Time              `json:"created_at" db:"created_at"`
}

type CostBreakdown struct {
    Storage StorageCost `json:"storage"`
    Compute ComputeCost `json:"compute"`
    Network NetworkCost `json:"network"`
    License float64     `json:"license"`
    Support float64     `json:"support"`
    Other   float64     `json:"other"`
}

type StorageCost struct {
    HotStorage  float64 `json:"hot_storage"`
    WarmStorage float64 `json:"warm_storage"`
    ColdStorage float64 `json:"cold_storage"`
    Backup      float64 `json:"backup"`
    Total       float64 `json:"total"`
}
```

**预算模型**:

```go
type Budget struct {
    ID           string            `json:"id" db:"id"`
    Name         string            `json:"name" db:"name"`
    Period       string            `json:"period" db:"period"` // monthly, quarterly, yearly
    Amount       float64           `json:"amount" db:"amount"`
    Currency     string            `json:"currency" db:"currency"`
    Thresholds   []BudgetThreshold `json:"thresholds" db:"thresholds"`
    CurrentSpend float64           `json:"current_spend" db:"current_spend"`
    Percentage   float64           `json:"percentage" db:"percentage"`
    Scope        BudgetScope       `json:"scope" db:"scope"`
    CreatedAt    time.Time         `json:"created_at" db:"created_at"`
    UpdatedAt    time.Time         `json:"updated_at" db:"updated_at"`
}

type BudgetThreshold struct {
    Percentage float64 `json:"percentage"` // 80, 100
    Action     string  `json:"action"`     // alert, notify, restrict
}
```

### 6.2 数据库设计

**租户表 (tenants)**:

```sql
CREATE TABLE tenants (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, suspended, deleted
    namespace VARCHAR(100) NOT NULL UNIQUE,
    database_id VARCHAR(100),
    index_prefix VARCHAR(100),
    quota JSONB NOT NULL,
    branding JSONB,
    features JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_status (status),
    INDEX idx_namespace (namespace),
    INDEX idx_created_at (created_at)
);

-- 租户配额历史表
CREATE TABLE tenant_quota_history (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    resource_type VARCHAR(50) NOT NULL, -- storage, log_count, api_call
    quota_before INT64,
    quota_after INT64,
    used_before INT64,
    used_after INT64,
    changed_by VARCHAR(36),
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_resource_type (resource_type),
    INDEX idx_changed_at (changed_at),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
```

**IoT设备表 (iot_devices)**:

```sql
CREATE TABLE iot_devices (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- sensor, gateway, edge_node
    status VARCHAR(20) NOT NULL DEFAULT 'offline', -- online, offline, error
    ip_address VARCHAR(45),
    mac_address VARCHAR(17),
    location JSONB,
    protocol VARCHAR(20), -- mqtt, coap, lwm2m, http
    capabilities JSONB,
    metadata JSONB,
    last_seen TIMESTAMP,
    health_score DECIMAL(5,2) DEFAULT 100.0,
    groups TEXT[],
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_status (status),
    INDEX idx_type (type),
    INDEX idx_last_seen (last_seen),
    INDEX idx_health_score (health_score),
    INDEX idx_groups USING GIN (groups)
);

-- 设备分组表
CREATE TABLE device_groups (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- location, function, type
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_type (type),
    INDEX idx_name (name)
);

-- 设备拓扑关系表
CREATE TABLE device_topology (
    id BIGSERIAL PRIMARY KEY,
    source_device_id VARCHAR(36) NOT NULL,
    target_device_id VARCHAR(36) NOT NULL,
    edge_type VARCHAR(50) NOT NULL, -- parent, peer, gateway
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_source (source_device_id),
    INDEX idx_target (target_device_id),
    INDEX idx_edge_type (edge_type),
    FOREIGN KEY (source_device_id) REFERENCES iot_devices(id) ON DELETE CASCADE,
    FOREIGN KEY (target_device_id) REFERENCES iot_devices(id) ON DELETE CASCADE,
    UNIQUE (source_device_id, target_device_id, edge_type)
);
```

**成本数据表 (cost_data)**:

```sql
CREATE TABLE cost_data (
    id BIGSERIAL PRIMARY KEY,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_cost DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    breakdown JSONB NOT NULL,
    allocation JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_period (period_start, period_end),
    INDEX idx_total_cost (total_cost),
    INDEX idx_created_at (created_at),
    UNIQUE (period_start, period_end, currency)
);

-- 成本分摊规则表
CREATE TABLE cost_allocation_rules (
    id VARCHAR(36) PRIMARY KEY,
    dimension VARCHAR(50) NOT NULL, -- department, project, application, environment
    method VARCHAR(50) NOT NULL, -- proportional, fixed, custom
    weights JSONB,
    tags JSONB,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_dimension (dimension),
    INDEX idx_enabled (enabled)
);

-- 预算表
CREATE TABLE budgets (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    period VARCHAR(20) NOT NULL, -- monthly, quarterly, yearly
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    thresholds JSONB NOT NULL,
    current_spend DECIMAL(15,2) DEFAULT 0,
    percentage DECIMAL(5,2) DEFAULT 0,
    scope JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_period (period),
    INDEX idx_percentage (percentage),
    INDEX idx_name (name)
);

-- 成本优化机会表
CREATE TABLE cost_optimization_opportunities (
    id VARCHAR(36) PRIMARY KEY,
    type VARCHAR(50) NOT NULL, -- low_value_logs, over_retention, compression, tiering
    description TEXT NOT NULL,
    savings DECIMAL(15,2) NOT NULL,
    impact VARCHAR(20) NOT NULL, -- low, medium, high
    actions JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected, executed
    executed_at TIMESTAMP,
    actual_savings DECIMAL(15,2),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_type (type),
    INDEX idx_status (status),
    INDEX idx_savings (savings DESC),
    INDEX idx_created_at (created_at)
);
```

**跨云同步规则表 (cloud_sync_rules)**:

```sql
CREATE TABLE cloud_sync_rules (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    source JSONB NOT NULL, -- {provider, region, config}
    destination JSONB NOT NULL,
    filter TEXT,
    transform TEXT,
    schedule VARCHAR(100), -- cron expression
    sync_mode VARCHAR(20) NOT NULL, -- realtime, batch
    last_sync_at TIMESTAMP,
    sync_count BIGINT DEFAULT 0,
    error_count BIGINT DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_enabled (enabled),
    INDEX idx_sync_mode (sync_mode),
    INDEX idx_last_sync_at (last_sync_at)
);
```

**Kubernetes采集规则表 (k8s_collection_rules)**:

```sql
CREATE TABLE k8s_collection_rules (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    selector JSONB NOT NULL, -- {namespaces, labelSelector, podNamePattern}
    collection JSONB NOT NULL, -- {follow, tailLines, multilinePattern}
    processing JSONB,
    output JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, paused, error
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_enabled (enabled),
    INDEX idx_status (status),
    INDEX idx_name (name)
);
```

### 6.3 缓存设计

**租户缓存**:
- Key格式: `tenant:{tenant_id}`
- 数据: Tenant JSON
- TTL: 1小时
- 更新策略: Write-Through（写入时同步更新缓存）

**租户配额缓存**:
- Key格式: `tenant:{tenant_id}:quota:{resource_type}`
- 数据: 配额使用量（整数）
- TTL: 永久（手动失效）
- 更新策略: 使用Redis INCRBY原子操作

**设备状态缓存**:
- Key格式: `device:{device_id}:status`
- 数据: DeviceStatus JSON
- TTL: 5分钟（自动过期表示离线）
- 更新策略: 设备活动时更新

**设备在线列表缓存**:
- Key格式: `devices:online`
- 数据: Set of device IDs
- TTL: 永久（手动维护）
- 更新策略: 设备上线时SADD，离线时SREM

**成本数据缓存**:
- Key格式: `cost:{period_start}:{period_end}:{dimension}`
- 数据: CostData JSON
- TTL: 1小时
- 更新策略: Cache-Aside（查询时缓存）

**预算状态缓存**:
- Key格式: `budget:{budget_id}:status`
- 数据: Budget JSON
- TTL: 6小时
- 更新策略: 预算检查时更新

**云平台健康状态缓存**:
- Key格式: `cloud:health:{provider_name}`
- 数据: HealthStatus JSON
- TTL: 30秒
- 更新策略: 健康检查时更新

**配置缓存**:
- Key格式: `config:module15:{component}`
- 数据: 配置JSON
- TTL: 永久（Pub/Sub更新）
- 更新策略: Pub/Sub通知

### 6.4 Elasticsearch索引设计

**跨云日志索引 (cloud-logs-*)**:

```json
{
  "mappings": {
    "properties": {
      "timestamp": {"type": "date"},
      "message": {"type": "text", "analyzer": "standard"},
      "level": {"type": "keyword"},
      "source_provider": {"type": "keyword"},
      "source_region": {"type": "keyword"},
      "destination_provider": {"type": "keyword"},
      "sync_rule_id": {"type": "keyword"},
      "metadata": {"type": "object", "enabled": false}
    }
  },
  "settings": {
    "number_of_shards": 5,
    "number_of_replicas": 1,
    "refresh_interval": "5s"
  }
}
```

**IoT设备日志索引 (iot-logs-*)**:

```json
{
  "mappings": {
    "properties": {
      "timestamp": {"type": "date"},
      "device_id": {"type": "keyword"},
      "device_name": {"type": "keyword"},
      "device_type": {"type": "keyword"},
      "message": {"type": "text"},
      "level": {"type": "keyword"},
      "location": {"type": "geo_point"},
      "metadata": {"type": "object", "enabled": false}
    }
  }
}
```

---

## 7. 安全设计

### 7.1 多租户安全隔离

1. **网络隔离**: Kubernetes Network Policy
2. **数据隔离**: 独立Schema/数据库实例
3. **API隔离**: JWT中包含租户ID，中间件验证
4. **资源隔离**: Kubernetes ResourceQuota

### 7.2 跨云安全

1. **凭证管理**: HashiCorp Vault存储云平台凭证
2. **传输加密**: TLS 1.3
3. **访问控制**: IAM角色最小权限原则

### 7.3 IoT设备安全

1. **设备认证**: 证书认证或预共享密钥
2. **通信加密**: MQTT over TLS
3. **固件验证**: 数字签名验证

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 租户创建延迟 | < 30秒 | API响应时间 |
| 跨云同步延迟 | < 5秒 (P95) | 时间戳差值 |
| K8s日志采集延迟 | < 200ms (P95) | 时间戳差值 |
| IoT设备发现时间 | < 30秒 | 发现到注册时间 |
| 成本数据更新延迟 | < 1小时 | 数据时效性 |
| 并发租户数 | 1000+ | 压力测试 |
| 并发IoT设备数 | 10000+ | 压力测试 |

### 8.2 优化策略

1. **多租户优化**: 连接池复用、查询缓存、索引优化
2. **跨云优化**: 批量同步、压缩传输、智能路由
3. **K8s优化**: Informer缓存、批量处理、异步写入
4. **IoT优化**: 边缘预处理、离线缓存、低功耗模式
5. **成本优化**: 定时采集、增量计算、结果缓存

---

## 9. 部署方案

### 9.1 部署架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Kubernetes 集群（多租户隔离）                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Ingress Controller (Nginx)                                           │ │
│  │  - TLS 终止                                                           │ │
│  │  - 租户路由（基于域名/Header）                                         │ │
│  │  - 跨云负载均衡                                                        │ │
│  └────────────────────────┬──────────────────────────────────────────────┘ │
│                           │                                                 │
│  ┌────────────────────────▼──────────────────────────────────────────────┐ │
│  │  共享服务层 (Namespace: shared-services)                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │ │
│  │  │ 租户管理服务  │  │ 跨云管理服务  │  │ 成本管理服务  │               │ │
│  │  │ (3 replicas) │  │ (2 replicas) │  │ (2 replicas) │               │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │ │
│  │                                                                        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │ │
│  │  │ K8s采集服务   │  │ IoT管理服务   │  │ API Gateway  │               │ │
│  │  │ (DaemonSet)  │  │ (2 replicas) │  │ (3 replicas) │               │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  租户隔离层 (每个租户独立 Namespace)                                   │ │
│  │                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────┐    │ │
│  │  │  Namespace: tenant-001                                        │    │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │    │ │
│  │  │  │ 日志采集  │  │ 日志处理  │  │ 日志查询  │                   │    │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘                   │    │ │
│  │  │  Network Policy: 租户间网络隔离                               │    │ │
│  │  │  ResourceQuota: CPU/内存/存储配额                             │    │ │
│  │  └──────────────────────────────────────────────────────────────┘    │ │
│  │                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────┐    │ │
│  │  │  Namespace: tenant-002                                        │    │ │
│  │  │  ...                                                          │    │ │
│  │  └──────────────────────────────────────────────────────────────┘    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  数据层 (StatefulSet)                                                 │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │ │
│  │  │ PostgreSQL   │  │ Redis Cluster│  │ Elasticsearch│               │ │
│  │  │ (1主2从)     │  │ (6节点)      │  │ (3节点)      │               │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │ │
│  │                                                                        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │ │
│  │  │ Kafka        │  │ MinIO        │  │ Temporal     │               │ │
│  │  │ (3节点)      │  │ (4节点)      │  │ (2节点)      │               │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  边缘节点层 (IoT设备)                                                  │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │ │
│  │  │ 边缘Agent    │  │ 边缘Agent    │  │ 边缘Agent    │               │ │
│  │  │ (设备1)      │  │ (设备2)      │  │ (设备N)      │               │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         跨云部署（多云架构）                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐             │
│  │  AWS Region  │      │ Azure Region │      │  GCP Region  │             │
│  │              │      │              │      │              │             │
│  │  K8s Cluster │◄────►│  K8s Cluster │◄────►│  K8s Cluster │             │
│  │              │      │              │      │              │             │
│  │  - 主集群    │      │  - 备份集群  │      │  - 灾备集群  │             │
│  │  - 实时同步  │      │  - 异步同步  │      │  - 冷备份    │             │
│  └──────────────┘      └──────────────┘      └──────────────┘             │
│         │                      │                      │                     │
│         └──────────────────────┼──────────────────────┘                     │
│                                │                                            │
│                    ┌───────────▼───────────┐                               │
│                    │  跨云同步协调器        │                               │
│                    │  - 数据同步            │                               │
│                    │  - 故障转移            │                               │
│                    │  - 负载均衡            │                               │
│                    └───────────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 资源配置

**共享服务层**:

| 组件 | 副本数 | CPU | 内存 | 存储 | 说明 |
|------|--------|-----|------|------|------|
| 租户管理服务 | 3 | 2核 | 4GB | - | 处理租户CRUD、配额管理 |
| 跨云管理服务 | 2 | 4核 | 8GB | - | 跨云日志同步、健康检查 |
| K8s采集服务 | N(节点数) | 500m | 512MB | - | DaemonSet，每节点一个 |
| IoT管理服务 | 2 | 2核 | 4GB | - | 设备发现、配置、监控 |
| 成本管理服务 | 2 | 2核 | 4GB | - | 成本采集、分析、优化 |
| API Gateway | 3 | 2核 | 4GB | - | 统一API入口、认证授权 |

**租户隔离层（每个租户）**:

| 组件 | 副本数 | CPU | 内存 | 存储 | 说明 |
|------|--------|-----|------|------|------|
| 日志采集 | 1 | 1核 | 2GB | - | 租户专属采集器 |
| 日志处理 | 1 | 2核 | 4GB | - | 租户专属处理器 |
| 日志查询 | 1 | 1核 | 2GB | - | 租户专属查询服务 |

**数据层**:

| 组件 | 副本数 | CPU | 内存 | 存储 | 说明 |
|------|--------|-----|------|------|------|
| PostgreSQL | 1主2从 | 8核 | 16GB | 500GB SSD | 主数据库 |
| Redis Cluster | 6节点 | 2核 | 8GB | 100GB SSD | 缓存和Pub/Sub |
| Elasticsearch | 3节点 | 4核 | 16GB | 1TB SSD | 搜索引擎 |
| Kafka | 3节点 | 4核 | 8GB | 500GB SSD | 消息队列 |
| MinIO | 4节点 | 2核 | 4GB | 2TB HDD | 对象存储 |
| Temporal | 2节点 | 4核 | 8GB | 100GB SSD | 工作流引擎 |

**边缘节点（IoT设备）**:

| 组件 | CPU | 内存 | 存储 | 说明 |
|------|-----|------|------|------|
| 边缘Agent | < 2% | < 50MB | 10GB | 低功耗模式 |
| 离线缓存 | - | - | 可配置 | BoltDB本地存储 |

### 9.3 Helm Chart 部署

**配置热更新说明**:

模块15支持两种配置更新方式：

1. **热更新（推荐）**: 通过API动态更新配置，无需重启Pod，3-5秒内生效
   - 适用于：业务配置、功能开关、阈值参数等
   - 实现方式：Redis Pub/Sub + atomic.Value
   - 详细设计见第11节"配置热更新详细设计"

2. **Helm升级（备选）**: 修改values.yaml后通过Helm升级，需要滚动重启Pod
   - 适用于：资源配额、镜像版本、基础设施配置等
   - 实现方式：`helm upgrade`命令

**values.yaml 配置示例**:

```yaml
# 全局配置
global:
  imageRegistry: registry.example.com
  imagePullSecrets:
    - name: registry-secret
  storageClass: fast-ssd

# 多租户配置（支持热更新）
multiTenant:
  enabled: true  # 热更新：功能开关
  defaultQuota:  # 热更新：新租户配额
    storageGB: 100
    logCount: 10000000
    apiCalls: 1000000
  networkIsolation: true  # 需要重启：网络策略变更
  
# 跨云配置（支持热更新）
multiCloud:
  enabled: true  # 热更新：功能开关
  providers:  # 热更新：云平台列表
    - name: aws
      region: us-east-1
      enabled: true
    - name: azure
      region: eastus
      enabled: true
    - name: gcp
      region: us-central1
      enabled: false
  syncMode: realtime  # 热更新：同步模式
  
# Kubernetes集成（部分支持热更新）
kubernetes:
  enabled: true  # 热更新：功能开关
  daemonset:
    enabled: true  # 需要重启：DaemonSet启停
    resources:  # 需要重启：资源配额变更
      limits:
        cpu: 500m
        memory: 512Mi
      requests:
        cpu: 100m
        memory: 128Mi
  multiline:
    enabled: true  # 热更新：多行合并开关
    patterns:  # 热更新：合并模式
      java: '^\d{4}-\d{2}-\d{2}'
      python: '^Traceback'
      go: '^panic:'
      
# IoT设备管理（支持热更新）
iot:
  enabled: true  # 热更新：功能开关
  discovery:
    protocols:  # 热更新：发现协议列表
      - mdns
      - mqtt
      - ssdp
  edgeProcessing:
    enabled: true  # 热更新：边缘处理开关
    compression: true  # 热更新：压缩开关
    aggregation: true  # 热更新：聚合开关
  offlineCache:
    enabled: true  # 热更新：离线缓存开关
    maxSizeGB: 10  # 热更新：缓存大小限制
    retentionDays: 7  # 热更新：保留天数
    
# 成本管理（支持热更新）
costManagement:
  enabled: true  # 热更新：功能开关
  collectionInterval: 1h  # 热更新：采集间隔
  providers:  # 热更新：成本数据源
    - aws
    - azure
    - gcp
  optimization:
    autoExecute: false  # 热更新：自动执行开关
    approvalRequired: true  # 热更新：审批要求
    
# 数据库配置（不支持热更新，需要重启）
postgresql:
  enabled: true
  architecture: replication
  primary:
    resources:
      limits:
        cpu: 8
        memory: 16Gi
      requests:
        cpu: 4
        memory: 8Gi
    persistence:
      size: 500Gi
      storageClass: fast-ssd
  readReplicas:
    replicaCount: 2
    
# Redis配置（不支持热更新，需要重启）
redis:
  enabled: true
  architecture: cluster
  cluster:
    nodes: 6
  master:
    resources:
      limits:
        cpu: 2
        memory: 8Gi
      requests:
        cpu: 1
        memory: 4Gi
    persistence:
      size: 100Gi
      
# Elasticsearch配置（不支持热更新，需要重启）
elasticsearch:
  enabled: true
  replicas: 3
  resources:
    limits:
      cpu: 4
      memory: 16Gi
    requests:
      cpu: 2
      memory: 8Gi
  volumeClaimTemplate:
    resources:
      requests:
        storage: 1Ti
        
# 监控配置
monitoring:
  enabled: true
  prometheus:
    enabled: true
  grafana:
    enabled: true
    dashboards:
      - tenant-overview
      - multi-cloud
      - iot-devices
      - cost-analysis
```

**配置更新方式对比**:

| 配置类型 | 热更新 | Helm升级 | 推荐方式 | 生效时间 |
|---------|--------|----------|---------|---------|
| 功能开关 | ✅ | ✅ | 热更新 | 3-5秒 |
| 业务参数 | ✅ | ✅ | 热更新 | 3-5秒 |
| 资源配额 | ❌ | ✅ | Helm升级 | 滚动重启 |
| 镜像版本 | ❌ | ✅ | Helm升级 | 滚动重启 |
| 数据库连接 | ❌ | ✅ | Helm升级 | 滚动重启 |
| 网络策略 | ❌ | ✅ | Helm升级 | 立即生效 |

### 9.4 部署步骤

**1. 准备环境**:

```bash
# 创建命名空间
kubectl create namespace log-management
kubectl create namespace shared-services

# 创建镜像拉取密钥
kubectl create secret docker-registry registry-secret \
  --docker-server=registry.example.com \
  --docker-username=admin \
  --docker-password=password \
  -n log-management
```

**2. 部署基础设施**:

```bash
# 添加Helm仓库
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# 部署PostgreSQL
helm install postgresql bitnami/postgresql \
  -f values-postgresql.yaml \
  -n log-management

# 部署Redis
helm install redis bitnami/redis-cluster \
  -f values-redis.yaml \
  -n log-management

# 部署Elasticsearch
helm install elasticsearch elastic/elasticsearch \
  -f values-elasticsearch.yaml \
  -n log-management
```

**3. 部署应用**:

```bash
# 部署日志管理系统
helm install log-management ./deploy/helm/log-management \
  -f values.yaml \
  -n log-management

# 验证部署
kubectl get pods -n log-management
kubectl get svc -n log-management
```

**4. 配置多租户**:

```bash
# 创建第一个租户
curl -X POST http://api.example.com/api/v1/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "tenant-001",
    "quota": {
      "storage_quota_gb": 100,
      "log_count_quota": 10000000
    }
  }'
```

**5. 配置跨云同步**:

```bash
# 创建跨云同步规则
curl -X POST http://api.example.com/api/v1/cloud-sync/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "aws-to-azure-sync",
    "source": {"provider": "aws", "region": "us-east-1"},
    "destination": {"provider": "azure", "region": "eastus"},
    "sync_mode": "realtime"
  }'
```

### 9.5 滚动更新策略

**滚动更新与热更新的关系**:

模块15采用分层更新策略：

1. **应用层配置（热更新）**: 业务配置通过Redis Pub/Sub热更新，无需重启Pod
2. **容器层配置（滚动更新）**: 镜像版本、资源配额等通过Kubernetes滚动更新
3. **基础设施层（灾备切换）**: 数据库、缓存等通过主从切换或集群扩缩容

**Kubernetes滚动更新配置**:

```yaml
# Deployment更新策略（应用服务）
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1        # 最多额外创建1个Pod
    maxUnavailable: 0  # 更新期间保持所有Pod可用，确保服务不中断

# DaemonSet更新策略（日志采集Agent）
updateStrategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 1  # 每次最多1个节点的Pod不可用

# StatefulSet更新策略（有状态服务）
updateStrategy:
  type: RollingUpdate
  partition: 0  # 从第0个Pod开始更新（默认从最后一个开始）
```

**滚动更新流程**:

```bash
# 1. 更新Helm Chart配置
vim values.yaml

# 2. 执行Helm升级（自动触发滚动更新）
helm upgrade log-management ./deploy/helm/log-management \
  -f values.yaml \
  -n log-management \
  --wait \
  --timeout 10m

# 3. 监控滚动更新进度
kubectl rollout status deployment/tenant-manager -n log-management
kubectl rollout status deployment/cloud-sync-manager -n log-management
kubectl rollout status daemonset/k8s-log-collector -n log-management

# 4. 验证更新结果
kubectl get pods -n log-management
kubectl logs -f deployment/tenant-manager -n log-management

# 5. 如果更新失败，快速回滚
helm rollback log-management -n log-management
```

**滚动更新最佳实践**:

1. **健康检查**: 确保配置了正确的livenessProbe和readinessProbe
   ```yaml
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

2. **优雅关闭**: 设置合理的terminationGracePeriodSeconds
   ```yaml
   terminationGracePeriodSeconds: 30  # 给Pod 30秒时间完成清理
   ```

3. **预停止钩子**: 在Pod终止前执行清理操作
   ```yaml
   lifecycle:
     preStop:
       exec:
         command: ["/bin/sh", "-c", "sleep 5"]  # 等待5秒让负载均衡器移除Pod
   ```

4. **分阶段更新**: 对于大规模集群，使用金丝雀发布
   ```yaml
   # 第一阶段：更新10%的Pod
   helm upgrade log-management ./deploy/helm/log-management \
     --set replicaCount=10 \
     --set canary.enabled=true \
     --set canary.weight=10
   
   # 验证无问题后，第二阶段：更新所有Pod
   helm upgrade log-management ./deploy/helm/log-management \
     --set canary.enabled=false
   ```

**不同更新方式的选择**:

| 更新内容 | 更新方式 | 是否重启Pod | 生效时间 | 风险等级 |
|---------|---------|------------|---------|---------|
| 功能开关 | 热更新 | ❌ | 3-5秒 | 低 |
| 业务阈值 | 热更新 | ❌ | 3-5秒 | 低 |
| 告警规则 | 热更新 | ❌ | 3-5秒 | 低 |
| 镜像版本 | 滚动更新 | ✅ | 5-10分钟 | 中 |
| 资源配额 | 滚动更新 | ✅ | 5-10分钟 | 中 |
| 环境变量 | 滚动更新 | ✅ | 5-10分钟 | 中 |
| 数据库连接 | 滚动更新 | ✅ | 5-10分钟 | 高 |
| 网络策略 | kubectl apply | ❌ | 立即 | 高 |
| Service配置 | kubectl apply | ❌ | 10秒内 | 低 |

**热更新优先原则**:

对于可以热更新的配置，优先使用热更新方式，原因：
- ✅ 无需重启Pod，服务不中断
- ✅ 生效速度快（3-5秒）
- ✅ 回滚简单（直接修改配置）
- ✅ 风险低（不涉及Pod重建）
- ✅ 支持配置版本管理和审计

对于必须重启的配置（如镜像版本、资源配额），使用滚动更新：
- ✅ 零停机更新
- ✅ 自动健康检查
- ✅ 失败自动回滚
- ✅ 支持金丝雀发布

### 9.6 灾备方案

**跨云灾备**:
- 主集群: AWS us-east-1
- 备份集群: Azure eastus（实时同步）
- 灾备集群: GCP us-central1（每日备份）

**RTO/RPO目标**:
- RTO: 15分钟（自动故障转移）
- RPO: 5分钟（实时同步延迟）

**故障转移流程**:
1. 健康检查检测到主集群不可用
2. 自动切换DNS到备份集群
3. 激活备份集群的写入能力
4. 通知运维团队
5. 主集群恢复后自动同步数据

---

## 10. 监控与运维

### 10.1 监控指标

**多租户指标**:

```prometheus
# 租户总数
tenant_count_total

# 租户状态分布
tenant_status_count{status="active|suspended|deleted"}

# 租户配额使用率
tenant_quota_usage_percent{tenant_id, resource_type="storage|log_count|api_call"}

# 租户API请求量
tenant_api_requests_total{tenant_id, method, path, status}

# 租户API延迟
tenant_api_request_duration_seconds{tenant_id, method, path}

# 租户数据量
tenant_data_size_bytes{tenant_id}

# 租户日志条数
tenant_log_count_total{tenant_id}
```

**跨云指标**:

```prometheus
# 云平台健康状态
cloud_provider_health{provider, region}

# 跨云同步延迟
cloud_sync_latency_seconds{source_provider, source_region, dest_provider, dest_region}

# 跨云同步速率
cloud_sync_rate_logs_per_second{rule_id}

# 跨云同步失败率
cloud_sync_error_rate{rule_id}

# 云平台成本
cloud_provider_cost_total{provider, region, currency}

# 云平台API调用次数
cloud_provider_api_calls_total{provider, api_name, status}
```

**Kubernetes指标**:

```prometheus
# 采集的Pod数量
k8s_pods_collected_total{namespace, cluster}

# 采集的容器数量
k8s_containers_collected_total{namespace, cluster}

# 日志采集延迟
k8s_log_collection_latency_seconds{namespace, pod}

# 日志采集速率
k8s_log_collection_rate_lines_per_second{namespace}

# DaemonSet覆盖率
k8s_daemonset_coverage_percent{cluster}

# CRD规则数量
k8s_collection_rules_total{status="active|paused|error"}
```

**IoT设备指标**:

```prometheus
# 设备总数
iot_devices_total{type="sensor|gateway|edge_node"}

# 在线设备数
iot_devices_online_total{type}

# 设备健康评分
iot_device_health_score{device_id, device_type}

# 设备离线时长
iot_device_offline_duration_seconds{device_id}

# 边缘缓存大小
iot_edge_cache_size_bytes{device_id}

# 边缘缓存条数
iot_edge_cache_count{device_id}

# 设备日志采集速率
iot_device_log_rate_lines_per_second{device_id}

# 设备资源使用
iot_device_cpu_percent{device_id}
iot_device_memory_percent{device_id}
```

**成本管理指标**:

```prometheus
# 总成本
cost_total{currency, period}

# 成本分类
cost_by_category{category="storage|compute|network|license", currency}

# 成本分摊
cost_allocation{dimension, dimension_value, currency}

# 成本优化机会数量
cost_optimization_opportunities_total{type, impact}

# 成本优化节省金额
cost_optimization_savings_total{type, currency}

# 预算使用率
budget_usage_percent{budget_id, budget_name}

# 预算超支告警
budget_alert_triggered_total{budget_id, threshold}
```

### 10.2 告警规则（支持热更新）

告警规则存储在数据库中，支持通过API动态创建、修改、删除，实现热更新。同时保留YAML文件作为备选更新方式（需要重启）。

#### 10.2.1 告警规则数据模型

```go
// 告警规则
type AlertRule struct {
    ID          string                 `json:"id" db:"id"`
    Name        string                 `json:"name" db:"name"`
    Category    string                 `json:"category" db:"category"` // multi_tenant, multi_cloud, kubernetes, iot, cost
    Expr        string                 `json:"expr" db:"expr"`         // PromQL表达式
    For         string                 `json:"for" db:"for"`           // 持续时间，如"5m"
    Severity    string                 `json:"severity" db:"severity"` // critical, warning, info
    Enabled     bool                   `json:"enabled" db:"enabled"`
    Labels      map[string]string      `json:"labels" db:"labels"`
    Annotations map[string]string      `json:"annotations" db:"annotations"`
    Actions     []AlertAction          `json:"actions" db:"actions"`   // 告警动作
    CreatedAt   time.Time              `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time              `json:"updated_at" db:"updated_at"`
    CreatedBy   string                 `json:"created_by" db:"created_by"`
}

// 告警动作
type AlertAction struct {
    Type   string                 `json:"type"`   // email, slack, webhook, dingtalk
    Config map[string]interface{} `json:"config"` // 动作配置
}
```

#### 10.2.2 告警规则数据库设计

```sql
CREATE TABLE alert_rules (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL, -- multi_tenant, multi_cloud, kubernetes, iot, cost
    expr TEXT NOT NULL,
    for_duration VARCHAR(20) NOT NULL DEFAULT '5m',
    severity VARCHAR(20) NOT NULL DEFAULT 'warning',
    enabled BOOLEAN NOT NULL DEFAULT true,
    labels JSONB,
    annotations JSONB NOT NULL,
    actions JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(36),
    
    INDEX idx_category (category),
    INDEX idx_enabled (enabled),
    INDEX idx_severity (severity),
    INDEX idx_name (name)
);

-- 告警规则变更历史
CREATE TABLE alert_rule_history (
    id BIGSERIAL PRIMARY KEY,
    rule_id VARCHAR(36) NOT NULL,
    action VARCHAR(20) NOT NULL, -- created, updated, deleted, enabled, disabled
    old_value JSONB,
    new_value JSONB,
    changed_by VARCHAR(36),
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_rule_id (rule_id),
    INDEX idx_action (action),
    INDEX idx_changed_at (changed_at),
    FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
);
```

#### 10.2.3 告警规则管理器

```go
type AlertRuleManager struct {
    db          *sql.DB
    cache       *redis.Client
    prometheus  *prometheus.Client
    rules       atomic.Value // 当前生效的规则列表
    mu          sync.RWMutex
}

// 加载告警规则
func (m *AlertRuleManager) LoadRules(ctx context.Context) ([]*AlertRule, error) {
    // 1. 尝试从缓存读取
    cacheKey := "alert:rules:module15"
    cached, err := m.cache.Get(ctx, cacheKey).Result()
    if err == nil {
        var rules []*AlertRule
        if err := json.Unmarshal([]byte(cached), &rules); err == nil {
            return rules, nil
        }
    }
    
    // 2. 从数据库读取
    rows, err := m.db.QueryContext(ctx, `
        SELECT id, name, category, expr, for_duration, severity, enabled,
               labels, annotations, actions, created_at, updated_at, created_by
        FROM alert_rules
        WHERE enabled = true
        ORDER BY category, severity DESC
    `)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    
    var rules []*AlertRule
    for rows.Next() {
        rule := &AlertRule{}
        var labelsJSON, annotationsJSON, actionsJSON []byte
        
        err := rows.Scan(
            &rule.ID, &rule.Name, &rule.Category, &rule.Expr, &rule.For,
            &rule.Severity, &rule.Enabled, &labelsJSON, &annotationsJSON,
            &actionsJSON, &rule.CreatedAt, &rule.UpdatedAt, &rule.CreatedBy,
        )
        if err != nil {
            log.Error("扫描告警规则失败", "error", err)
            continue
        }
        
        // 解析JSON字段
        json.Unmarshal(labelsJSON, &rule.Labels)
        json.Unmarshal(annotationsJSON, &rule.Annotations)
        json.Unmarshal(actionsJSON, &rule.Actions)
        
        rules = append(rules, rule)
    }
    
    // 3. 写入缓存
    rulesJSON, _ := json.Marshal(rules)
    m.cache.Set(ctx, cacheKey, rulesJSON, 5*time.Minute)
    
    return rules, nil
}

// 创建告警规则
func (m *AlertRuleManager) CreateRule(ctx context.Context, rule *AlertRule) error {
    m.mu.Lock()
    defer m.mu.Unlock()
    
    // 1. 验证规则
    if err := m.validateRule(rule); err != nil {
        return fmt.Errorf("规则验证失败: %w", err)
    }
    
    // 2. 生成ID
    rule.ID = uuid.New().String()
    rule.CreatedAt = time.Now()
    rule.UpdatedAt = time.Now()
    
    // 3. 保存到数据库
    labelsJSON, _ := json.Marshal(rule.Labels)
    annotationsJSON, _ := json.Marshal(rule.Annotations)
    actionsJSON, _ := json.Marshal(rule.Actions)
    
    _, err := m.db.ExecContext(ctx, `
        INSERT INTO alert_rules (
            id, name, category, expr, for_duration, severity, enabled,
            labels, annotations, actions, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, rule.ID, rule.Name, rule.Category, rule.Expr, rule.For, rule.Severity,
        rule.Enabled, labelsJSON, annotationsJSON, actionsJSON, rule.CreatedBy)
    
    if err != nil {
        return err
    }
    
    // 4. 记录历史
    m.recordRuleHistory(ctx, rule.ID, "created", nil, rule, rule.CreatedBy)
    
    // 5. 清除缓存
    m.cache.Del(ctx, "alert:rules:module15")
    
    // 6. 发布Pub/Sub通知
    m.publishRuleChange(ctx, "created", rule)
    
    // 7. 同步到Prometheus
    if err := m.syncToPrometheus(ctx); err != nil {
        log.Error("同步告警规则到Prometheus失败", "error", err)
    }
    
    log.Info("告警规则创建成功", "rule_id", rule.ID, "name", rule.Name)
    return nil
}

// 更新告警规则
func (m *AlertRuleManager) UpdateRule(ctx context.Context, ruleID string, updates map[string]interface{}) error {
    m.mu.Lock()
    defer m.mu.Unlock()
    
    // 1. 获取旧规则
    oldRule, err := m.GetRule(ctx, ruleID)
    if err != nil {
        return err
    }
    
    // 2. 应用更新
    newRule := *oldRule
    if name, ok := updates["name"].(string); ok {
        newRule.Name = name
    }
    if expr, ok := updates["expr"].(string); ok {
        newRule.Expr = expr
    }
    if forDuration, ok := updates["for"].(string); ok {
        newRule.For = forDuration
    }
    if severity, ok := updates["severity"].(string); ok {
        newRule.Severity = severity
    }
    if enabled, ok := updates["enabled"].(bool); ok {
        newRule.Enabled = enabled
    }
    if labels, ok := updates["labels"].(map[string]string); ok {
        newRule.Labels = labels
    }
    if annotations, ok := updates["annotations"].(map[string]string); ok {
        newRule.Annotations = annotations
    }
    if actions, ok := updates["actions"].([]AlertAction); ok {
        newRule.Actions = actions
    }
    
    // 3. 验证新规则
    if err := m.validateRule(&newRule); err != nil {
        return fmt.Errorf("规则验证失败: %w", err)
    }
    
    // 4. 更新数据库
    newRule.UpdatedAt = time.Now()
    labelsJSON, _ := json.Marshal(newRule.Labels)
    annotationsJSON, _ := json.Marshal(newRule.Annotations)
    actionsJSON, _ := json.Marshal(newRule.Actions)
    
    _, err = m.db.ExecContext(ctx, `
        UPDATE alert_rules SET
            name = $1, expr = $2, for_duration = $3, severity = $4,
            enabled = $5, labels = $6, annotations = $7, actions = $8,
            updated_at = $9
        WHERE id = $10
    `, newRule.Name, newRule.Expr, newRule.For, newRule.Severity,
        newRule.Enabled, labelsJSON, annotationsJSON, actionsJSON,
        newRule.UpdatedAt, ruleID)
    
    if err != nil {
        return err
    }
    
    // 5. 记录历史
    m.recordRuleHistory(ctx, ruleID, "updated", oldRule, &newRule, newRule.CreatedBy)
    
    // 6. 清除缓存
    m.cache.Del(ctx, "alert:rules:module15")
    
    // 7. 发布Pub/Sub通知
    m.publishRuleChange(ctx, "updated", &newRule)
    
    // 8. 同步到Prometheus
    if err := m.syncToPrometheus(ctx); err != nil {
        log.Error("同步告警规则到Prometheus失败", "error", err)
    }
    
    log.Info("告警规则更新成功", "rule_id", ruleID)
    return nil
}

// 删除告警规则
func (m *AlertRuleManager) DeleteRule(ctx context.Context, ruleID string, deletedBy string) error {
    m.mu.Lock()
    defer m.mu.Unlock()
    
    // 1. 获取规则
    rule, err := m.GetRule(ctx, ruleID)
    if err != nil {
        return err
    }
    
    // 2. 删除数据库记录
    _, err = m.db.ExecContext(ctx, "DELETE FROM alert_rules WHERE id = $1", ruleID)
    if err != nil {
        return err
    }
    
    // 3. 记录历史
    m.recordRuleHistory(ctx, ruleID, "deleted", rule, nil, deletedBy)
    
    // 4. 清除缓存
    m.cache.Del(ctx, "alert:rules:module15")
    
    // 5. 发布Pub/Sub通知
    m.publishRuleChange(ctx, "deleted", rule)
    
    // 6. 同步到Prometheus
    if err := m.syncToPrometheus(ctx); err != nil {
        log.Error("同步告警规则到Prometheus失败", "error", err)
    }
    
    log.Info("告警规则删除成功", "rule_id", ruleID)
    return nil
}

// 验证告警规则
func (m *AlertRuleManager) validateRule(rule *AlertRule) error {
    // 1. 验证必填字段
    if rule.Name == "" {
        return fmt.Errorf("规则名称不能为空")
    }
    if rule.Category == "" {
        return fmt.Errorf("规则分类不能为空")
    }
    if rule.Expr == "" {
        return fmt.Errorf("PromQL表达式不能为空")
    }
    
    // 2. 验证分类
    validCategories := []string{"multi_tenant", "multi_cloud", "kubernetes", "iot", "cost"}
    if !contains(validCategories, rule.Category) {
        return fmt.Errorf("无效的规则分类: %s", rule.Category)
    }
    
    // 3. 验证严重级别
    validSeverities := []string{"critical", "warning", "info"}
    if !contains(validSeverities, rule.Severity) {
        return fmt.Errorf("无效的严重级别: %s", rule.Severity)
    }
    
    // 4. 验证持续时间格式
    if _, err := time.ParseDuration(rule.For); err != nil {
        return fmt.Errorf("无效的持续时间格式: %s", rule.For)
    }
    
    // 5. 验证PromQL表达式（可选，需要Prometheus客户端）
    // if err := m.prometheus.ValidateExpr(rule.Expr); err != nil {
    //     return fmt.Errorf("无效的PromQL表达式: %w", err)
    // }
    
    return nil
}

// 同步到Prometheus
func (m *AlertRuleManager) syncToPrometheus(ctx context.Context) error {
    // 1. 加载所有启用的规则
    rules, err := m.LoadRules(ctx)
    if err != nil {
        return err
    }
    
    // 2. 生成Prometheus告警规则文件
    ruleFile := m.generatePrometheusRuleFile(rules)
    
    // 3. 写入文件或通过API更新
    // 方式1: 写入文件（需要Prometheus重新加载配置）
    if err := m.writeRuleFile(ruleFile); err != nil {
        return err
    }
    
    // 方式2: 通过Prometheus API更新（如果支持）
    // if err := m.prometheus.UpdateRules(ruleFile); err != nil {
    //     return err
    // }
    
    // 4. 触发Prometheus重新加载配置
    if err := m.prometheus.Reload(); err != nil {
        log.Warn("触发Prometheus重新加载失败", "error", err)
    }
    
    return nil
}

// 订阅规则变更
func (m *AlertRuleManager) SubscribeRuleChanges(ctx context.Context) {
    pubsub := m.cache.Subscribe(ctx, "alert:rules:module15:change")
    defer pubsub.Close()
    
    ch := pubsub.Channel()
    
    for {
        select {
        case msg := <-ch:
            var change struct {
                Action string     `json:"action"`
                Rule   *AlertRule `json:"rule"`
            }
            
            if err := json.Unmarshal([]byte(msg.Payload), &change); err != nil {
                log.Error("解析规则变更消息失败", "error", err)
                continue
            }
            
            // 重新加载规则
            rules, err := m.LoadRules(ctx)
            if err != nil {
                log.Error("重新加载告警规则失败", "error", err)
                continue
            }
            
            // 原子更新规则
            m.rules.Store(rules)
            
            log.Info("告警规则已重新加载",
                "action", change.Action,
                "rule_name", change.Rule.Name,
                "total_rules", len(rules))
            
        case <-ctx.Done():
            return
        }
    }
}
```

#### 10.2.4 告警规则API接口

```go
// 创建告警规则
// POST /api/v1/alert-rules
func CreateAlertRule(c *gin.Context) {
    var rule AlertRule
    if err := c.ShouldBindJSON(&rule); err != nil {
        c.JSON(400, gin.H{"error": "无效的请求"})
        return
    }
    
    rule.CreatedBy = c.GetString("user_id")
    
    if err := alertRuleManager.CreateRule(c.Request.Context(), &rule); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "code": 0,
        "data": gin.H{"rule_id": rule.ID},
    })
}

// 获取告警规则列表
// GET /api/v1/alert-rules
func GetAlertRules(c *gin.Context) {
    category := c.Query("category")
    enabled := c.Query("enabled")
    
    rules, err := alertRuleManager.GetRules(c.Request.Context(), category, enabled)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "code": 0,
        "data": gin.H{
            "items": rules,
            "total": len(rules),
        },
    })
}

// 获取告警规则详情
// GET /api/v1/alert-rules/{id}
func GetAlertRule(c *gin.Context) {
    ruleID := c.Param("id")
    
    rule, err := alertRuleManager.GetRule(c.Request.Context(), ruleID)
    if err != nil {
        c.JSON(404, gin.H{"error": "规则不存在"})
        return
    }
    
    c.JSON(200, gin.H{
        "code": 0,
        "data": rule,
    })
}

// 更新告警规则
// PUT /api/v1/alert-rules/{id}
func UpdateAlertRule(c *gin.Context) {
    ruleID := c.Param("id")
    
    var updates map[string]interface{}
    if err := c.ShouldBindJSON(&updates); err != nil {
        c.JSON(400, gin.H{"error": "无效的请求"})
        return
    }
    
    if err := alertRuleManager.UpdateRule(c.Request.Context(), ruleID, updates); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "code":    0,
        "message": "规则更新成功",
    })
}

// 删除告警规则
// DELETE /api/v1/alert-rules/{id}
func DeleteAlertRule(c *gin.Context) {
    ruleID := c.Param("id")
    userID := c.GetString("user_id")
    
    if err := alertRuleManager.DeleteRule(c.Request.Context(), ruleID, userID); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "code":    0,
        "message": "规则删除成功",
    })
}

// 启用/禁用告警规则
// PUT /api/v1/alert-rules/{id}/toggle
func ToggleAlertRule(c *gin.Context) {
    ruleID := c.Param("id")
    
    var req struct {
        Enabled bool `json:"enabled"`
    }
    
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": "无效的请求"})
        return
    }
    
    updates := map[string]interface{}{
        "enabled": req.Enabled,
    }
    
    if err := alertRuleManager.UpdateRule(c.Request.Context(), ruleID, updates); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "code":    0,
        "message": "规则状态更新成功",
    })
}
```

#### 10.2.5 内置告警规则

系统启动时自动创建以下内置告警规则：

**多租户告警** (2条):
- tenant_quota_high: 租户配额使用率 > 90%
- tenant_quota_exceeded: 租户配额已满 >= 100%

**跨云告警** (3条):
- cloud_provider_down: 云平台不可用
- cloud_sync_latency_high: 跨云同步延迟 > 10秒
- cloud_sync_error_rate_high: 同步错误率 > 10%

**IoT设备告警** (3条):
- iot_device_offline: 设备离线 > 5分钟
- iot_device_health_low: 设备健康评分 < 60
- iot_edge_cache_full: 边缘缓存使用率 > 90%

**成本管理告警** (3条):
- budget_threshold_80: 预算使用率 > 80%
- budget_exceeded: 预算已超支 >= 100%
- cost_spike_detected: 成本异常增长

#### 10.2.6 YAML文件备选方式

如果热更新机制不可用，可以通过修改YAML文件并重启服务来更新告警规则：

**配置文件路径**: `configs/alert_rules_module15.yaml`

```yaml
# 模块15告警规则配置
groups:
  - name: multi_tenant_alerts
    interval: 30s
    rules:
      - alert: TenantQuotaHigh
        expr: tenant_quota_usage_percent > 90
        for: 5m
        labels:
          severity: warning
          category: multi_tenant
        annotations:
          summary: "租户配额使用率过高"
          description: "租户 {{ $labels.tenant_id }} 的 {{ $labels.resource_type }} 配额使用率达到 {{ $value }}%"
        actions:
          - type: email
            config:
              to: ["admin@example.com"]
          - type: slack
            config:
              channel: "#alerts"
      
      - alert: TenantQuotaExceeded
        expr: tenant_quota_usage_percent >= 100
        for: 1m
        labels:
          severity: critical
          category: multi_tenant
        annotations:
          summary: "租户配额已满"
          description: "租户 {{ $labels.tenant_id }} 的 {{ $labels.resource_type }} 配额已满"
  
  - name: multi_cloud_alerts
    interval: 30s
    rules:
      - alert: CloudProviderDown
        expr: cloud_provider_health == 0
        for: 2m
        labels:
          severity: critical
          category: multi_cloud
        annotations:
          summary: "云平台不可用"
          description: "云平台 {{ $labels.provider }} ({{ $labels.region }}) 不可用"
  
  - name: iot_alerts
    interval: 30s
    rules:
      - alert: IoTDeviceOffline
        expr: iot_device_offline_duration_seconds > 300
        for: 1m
        labels:
          severity: warning
          category: iot
        annotations:
          summary: "IoT设备离线"
          description: "设备 {{ $labels.device_id }} 已离线"
  
  - name: cost_alerts
    interval: 1h
    rules:
      - alert: BudgetExceeded
        expr: budget_usage_percent >= 100
        for: 1m
        labels:
          severity: critical
          category: cost
        annotations:
          summary: "预算已超支"
          description: "预算 {{ $labels.budget_name }} 已超支"
```

#### 10.2.7 热更新验收标准

1. THE System SHALL 在告警规则创建/修改/删除后5秒内生效
2. THE System SHALL 支持通过API动态管理告警规则，无需重启服务
3. THE System SHALL 记录所有告警规则变更的审计日志
4. THE System SHALL 支持按分类、严重级别、启用状态查询告警规则
5. THE System SHALL 在规则验证失败时返回详细的错误信息
6. THE System SHALL 自动同步告警规则到Prometheus
7. WHEN 热更新机制不可用时，THE System SHALL 支持通过YAML文件更新规则（需要重启）
8. THE System SHALL 支持自定义告警动作（邮件、Slack、Webhook、钉钉等）

### 10.3 Grafana 仪表盘

**多租户概览仪表盘**:
- 租户总数和状态分布
- 租户配额使用率Top 10
- 租户API请求量趋势
- 租户数据量分布
- 租户创建/删除趋势

**跨云管理仪表盘**:
- 云平台健康状态
- 跨云同步延迟热力图
- 跨云同步速率趋势
- 云平台成本对比
- 跨云拓扑视图

**IoT设备仪表盘**:
- 设备在线/离线统计
- 设备健康评分分布
- 设备地理位置分布（地图）
- 边缘缓存使用情况
- 设备日志采集速率

**成本分析仪表盘**:
- 总成本趋势
- 成本分类饼图
- 成本分摊柱状图
- 预算使用率仪表盘
- 成本优化机会列表
- 成本预测曲线

### 10.4 日志规范

**日志级别**:
- DEBUG: 详细的调试信息
- INFO: 一般信息，如操作成功
- WARN: 警告信息，如配额接近上限
- ERROR: 错误信息，如操作失败
- FATAL: 致命错误，服务无法继续运行

**日志格式**:

```json
{
  "timestamp": "2026-01-31T10:30:00Z",
  "level": "INFO",
  "module": "tenant-manager",
  "message": "租户创建成功",
  "tenant_id": "tenant-001",
  "operator_id": "user-123",
  "duration_ms": 150,
  "trace_id": "abc123",
  "span_id": "def456"
}
```

**关键操作日志**:
- 租户创建/删除/暂停/恢复
- 配额变更
- 跨云同步规则创建/修改/删除
- IoT设备发现/配置
- 成本优化执行
- 预算告警触发

### 10.5 运维手册

**日常运维任务**:

1. **租户管理**:
   - 每日检查租户配额使用情况
   - 处理租户配额调整请求
   - 清理已删除租户的数据（30天后）

2. **跨云同步**:
   - 每小时检查同步延迟
   - 处理同步失败的日志
   - 定期测试故障转移

3. **IoT设备管理**:
   - 每日检查离线设备
   - 处理设备健康评分低的设备
   - 定期同步边缘缓存

4. **成本管理**:
   - 每日更新成本数据
   - 每周生成成本报告
   - 每月执行成本优化

**故障处理流程**:

1. **租户配额超限**:
   - 检查配额使用情况
   - 联系租户确认是否需要扩容
   - 调整配额或启用限流

2. **跨云同步失败**:
   - 检查云平台健康状态
   - 检查网络连接
   - 重试失败的同步任务
   - 必要时切换到备用云平台

3. **IoT设备离线**:
   - 检查设备网络连接
   - 检查设备健康状态
   - 尝试远程重启设备
   - 必要时派遣现场人员

4. **成本超预算**:
   - 分析成本增长原因
   - 识别成本优化机会
   - 执行成本优化措施
   - 调整预算或限制资源使用

**备份与恢复**:

1. **租户数据备份**:
   - 每日全量备份
   - 每小时增量备份
   - 保留30天备份

2. **配置备份**:
   - 每次配置变更后自动备份
   - 保留最近10个版本

3. **数据恢复**:
   - 从备份恢复租户数据
   - 验证数据完整性
   - 通知租户恢复完成

**性能优化**:

1. **数据库优化**:
   - 定期分析慢查询
   - 优化索引
   - 清理过期数据

2. **缓存优化**:
   - 监控缓存命中率
   - 调整缓存TTL
   - 预热热点数据

3. **网络优化**:
   - 优化跨云传输路径
   - 启用数据压缩
   - 使用CDN加速

### 10.6 容量规划

**租户容量**:
- 当前支持: 1000个租户
- 扩容阈值: 800个租户（80%）
- 扩容方案: 增加Kubernetes节点，扩展数据库

**IoT设备容量**:
- 当前支持: 10000个设备
- 扩容阈值: 8000个设备（80%）
- 扩容方案: 增加IoT管理服务副本，扩展Redis集群

**存储容量**:
- 当前容量: 10TB
- 扩容阈值: 8TB（80%）
- 扩容方案: 增加Elasticsearch节点，启用冷热分离

**网络带宽**:
- 当前带宽: 10Gbps
- 扩容阈值: 8Gbps（80%）
- 扩容方案: 升级网络设备，启用流量压缩

---

## 11. 配置热更新详细设计

### 11.1 可热更新配置项汇总

**多租户配置** (10项):

| 配置项 | 类型 | 默认值 | 说明 | 生效范围 |
|--------|------|--------|------|----------|
| multi_tenant_enabled | bool | true | 是否启用多租户功能 | 全局 |
| default_storage_quota_gb | int | 100 | 默认存储配额（GB） | 新租户 |
| default_log_count_quota | int | 10000000 | 默认日志条数配额 | 新租户 |
| default_api_call_quota | int | 1000000 | 默认API调用配额 | 新租户 |
| quota_alert_threshold | float | 90.0 | 配额告警阈值（%） | 全局 |
| quota_limit_threshold | float | 100.0 | 配额限流阈值（%） | 全局 |
| enable_network_isolation | bool | true | 是否启用网络隔离 | 新租户 |
| enable_custom_branding | bool | true | 是否启用品牌定制 | 全局 |
| tenant_idle_timeout_days | int | 90 | 租户闲置超时天数 | 全局 |
| max_tenants_per_cluster | int | 1000 | 每个集群最大租户数 | 全局 |

**跨云配置** (12项):

| 配置项 | 类型 | 默认值 | 说明 | 生效范围 |
|--------|------|--------|------|----------|
| multi_cloud_enabled | bool | true | 是否启用跨云功能 | 全局 |
| enabled_providers | array | ["aws","azure","gcp"] | 启用的云平台列表 | 全局 |
| sync_mode | string | "realtime" | 同步模式（realtime/batch） | 新规则 |
| sync_batch_size | int | 1000 | 批量同步大小 | 全局 |
| sync_interval_seconds | int | 5 | 同步间隔（秒） | 全局 |
| health_check_interval_seconds | int | 30 | 健康检查间隔（秒） | 全局 |
| health_check_timeout_ms | int | 5000 | 健康检查超时（毫秒） | 全局 |
| auto_failover_enabled | bool | true | 是否启用自动故障转移 | 全局 |
| failover_threshold | float | 0.8 | 故障转移阈值（可用性） | 全局 |
| load_balance_strategy | string | "least_latency" | 负载均衡策略 | 全局 |
| cost_analysis_enabled | bool | true | 是否启用成本分析 | 全局 |
| max_sync_retries | int | 3 | 最大同步重试次数 | 全局 |

**Kubernetes配置** (12项):

| 配置项 | 类型 | 默认值 | 说明 | 生效范围 |
|--------|------|--------|------|----------|
| kubernetes_enabled | bool | true | 是否启用Kubernetes集成 | 全局 |
| include_namespaces | array | [] | 包含的Namespace列表 | 全局 |
| exclude_namespaces | array | ["kube-system","kube-public"] | 排除的Namespace列表 | 全局 |
| label_selector | string | "" | 标签选择器 | 全局 |
| tail_lines | int | 100 | 初始读取行数 | 全局 |
| follow_logs | bool | true | 是否跟随日志流 | 全局 |
| multiline_enabled | bool | true | 是否启用多行合并 | 全局 |
| multiline_patterns | map | {} | 多行合并模式 | 全局 |
| service_mesh_enabled | bool | false | 是否启用Service Mesh集成 | 全局 |
| service_mesh_type | string | "istio" | Service Mesh类型 | 全局 |
| collect_container_metadata | bool | true | 是否采集容器元数据 | 全局 |
| buffer_size_mb | int | 64 | 日志缓冲区大小（MB） | 全局 |

**IoT配置** (14项):

| 配置项 | 类型 | 默认值 | 说明 | 生效范围 |
|--------|------|--------|------|----------|
| iot_enabled | bool | false | 是否启用IoT功能 | 全局 |
| discovery_protocols | array | ["mdns","mqtt"] | 启用的发现协议 | 全局 |
| auto_provision_enabled | bool | true | 是否启用自动配置 | 全局 |
| provision_timeout_seconds | int | 120 | 配置超时时间（秒） | 全局 |
| offline_cache_enabled | bool | true | 是否启用离线缓存 | 全局 |
| offline_cache_max_size_gb | int | 10 | 离线缓存最大大小（GB） | 边缘节点 |
| offline_cache_retention_days | int | 7 | 离线缓存保留天数 | 边缘节点 |
| device_offline_threshold_minutes | int | 5 | 设备离线阈值（分钟） | 全局 |
| health_check_interval_seconds | int | 30 | 健康检查间隔（秒） | 全局 |
| low_power_mode_enabled | bool | false | 是否启用低功耗模式 | 边缘节点 |
| edge_processing_enabled | bool | true | 是否启用边缘处理 | 边缘节点 |
| compression_enabled | bool | true | 是否启用压缩 | 边缘节点 |
| aggregation_enabled | bool | true | 是否启用聚合 | 边缘节点 |
| aggregation_window_seconds | int | 60 | 聚合时间窗口（秒） | 边缘节点 |

**成本管理配置** (13项):

| 配置项 | 类型 | 默认值 | 说明 | 生效范围 |
|--------|------|--------|------|----------|
| cost_management_enabled | bool | true | 是否启用成本管理 | 全局 |
| cost_collection_interval_hours | int | 1 | 成本采集间隔（小时） | 全局 |
| enabled_cost_providers | array | ["aws","azure","gcp"] | 启用的成本数据源 | 全局 |
| allocation_rules | array | [] | 成本分摊规则列表 | 全局 |
| budget_check_interval_hours | int | 6 | 预算检查间隔（小时） | 全局 |
| optimization_auto_execute | bool | false | 是否自动执行优化 | 全局 |
| optimization_approval_required | bool | true | 优化是否需要审批 | 全局 |
| forecast_months | int | 3 | 成本预测月数 | 全局 |
| low_value_threshold_access_per_month | int | 1 | 低价值日志阈值 | 全局 |
| over_retention_check_enabled | bool | true | 是否检查过度保留 | 全局 |
| compression_recommendation_enabled | bool | true | 是否推荐压缩 | 全局 |
| report_generation_enabled | bool | true | 是否启用报告生成 | 全局 |
| currency | string | "USD" | 货币单位 | 全局 |

### 11.2 热更新实现机制

采用与模块14相同的热更新机制：

**1. 配置存储**:

```sql
CREATE TABLE module15_config (
    id BIGSERIAL PRIMARY KEY,
    component VARCHAR(50) NOT NULL, -- multi_tenant, multi_cloud, kubernetes, iot, cost
    config_key VARCHAR(100) NOT NULL,
    config_value TEXT NOT NULL,
    value_type VARCHAR(20) NOT NULL, -- string, int, float, bool, array, map
    description TEXT,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(36),
    
    UNIQUE (component, config_key),
    INDEX idx_component (component),
    INDEX idx_updated_at (updated_at)
);

-- 配置变更历史
CREATE TABLE module15_config_history (
    id BIGSERIAL PRIMARY KEY,
    config_id BIGINT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by VARCHAR(36),
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_config_id (config_id),
    INDEX idx_changed_at (changed_at),
    FOREIGN KEY (config_id) REFERENCES module15_config(id)
);
```

**2. 配置管理器**:

```go
type ConfigManager struct {
    db      *sql.DB
    cache   *redis.Client
    config  atomic.Value // 当前配置
    mu      sync.RWMutex
}

// 加载配置
func (m *ConfigManager) LoadConfig(ctx context.Context, component string) (*ComponentConfig, error) {
    // 1. 尝试从缓存读取
    cacheKey := fmt.Sprintf("config:module15:%s", component)
    cached, err := m.cache.Get(ctx, cacheKey).Result()
    if err == nil {
        var config ComponentConfig
        if err := json.Unmarshal([]byte(cached), &config); err == nil {
            return &config, nil
        }
    }
    
    // 2. 从数据库读取
    rows, err := m.db.QueryContext(ctx, `
        SELECT config_key, config_value, value_type
        FROM module15_config
        WHERE component = $1
    `, component)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    
    config := &ComponentConfig{
        Component: component,
        Values:    make(map[string]interface{}),
    }
    
    for rows.Next() {
        var key, value, valueType string
        if err := rows.Scan(&key, &value, &valueType); err != nil {
            return nil, err
        }
        
        // 根据类型解析值
        parsedValue, err := m.parseValue(value, valueType)
        if err != nil {
            log.Error("解析配置值失败", "key", key, "error", err)
            continue
        }
        
        config.Values[key] = parsedValue
    }
    
    // 3. 写入缓存
    configJSON, _ := json.Marshal(config)
    m.cache.Set(ctx, cacheKey, configJSON, 0) // 永久缓存
    
    return config, nil
}

// 更新配置
func (m *ConfigManager) UpdateConfig(ctx context.Context, component, key string, value interface{}, updatedBy string) error {
    m.mu.Lock()
    defer m.mu.Unlock()
    
    // 1. 验证配置
    if err := m.validateConfig(component, key, value); err != nil {
        return fmt.Errorf("配置验证失败: %w", err)
    }
    
    // 2. 获取旧值
    var oldValue string
    err := m.db.QueryRowContext(ctx, `
        SELECT config_value FROM module15_config
        WHERE component = $1 AND config_key = $2
    `, component, key).Scan(&oldValue)
    
    // 3. 更新数据库
    valueStr := m.serializeValue(value)
    valueType := m.getValueType(value)
    
    _, err = m.db.ExecContext(ctx, `
        INSERT INTO module15_config (component, config_key, config_value, value_type, updated_by)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (component, config_key)
        DO UPDATE SET
            config_value = EXCLUDED.config_value,
            value_type = EXCLUDED.value_type,
            version = module15_config.version + 1,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = EXCLUDED.updated_by
    `, component, key, valueStr, valueType, updatedBy)
    
    if err != nil {
        return err
    }
    
    // 4. 记录变更历史
    m.recordConfigHistory(ctx, component, key, oldValue, valueStr, updatedBy)
    
    // 5. 清除缓存
    cacheKey := fmt.Sprintf("config:module15:%s", component)
    m.cache.Del(ctx, cacheKey)
    
    // 6. 发布Pub/Sub通知
    message := ConfigChangeMessage{
        Component: component,
        Key:       key,
        Value:     value,
        UpdatedBy: updatedBy,
        Timestamp: time.Now(),
    }
    
    messageJSON, _ := json.Marshal(message)
    m.cache.Publish(ctx, "config:module15:reload", messageJSON)
    
    log.Info("配置更新成功",
        "component", component,
        "key", key,
        "updated_by", updatedBy)
    
    return nil
}

// 订阅配置变更
func (m *ConfigManager) SubscribeConfigChanges(ctx context.Context) {
    pubsub := m.cache.Subscribe(ctx, "config:module15:reload")
    defer pubsub.Close()
    
    ch := pubsub.Channel()
    
    for {
        select {
        case msg := <-ch:
            var change ConfigChangeMessage
            if err := json.Unmarshal([]byte(msg.Payload), &change); err != nil {
                log.Error("解析配置变更消息失败", "error", err)
                continue
            }
            
            // 重新加载配置
            config, err := m.LoadConfig(ctx, change.Component)
            if err != nil {
                log.Error("重新加载配置失败", "component", change.Component, "error", err)
                continue
            }
            
            // 原子更新配置
            m.config.Store(config)
            
            log.Info("配置已重新加载",
                "component", change.Component,
                "key", change.Key)
            
        case <-ctx.Done():
            return
        }
    }
}
```

**3. 配置验证**:

```go
func (m *ConfigManager) validateConfig(component, key string, value interface{}) error {
    switch component {
    case "multi_tenant":
        return m.validateMultiTenantConfig(key, value)
    case "multi_cloud":
        return m.validateMultiCloudConfig(key, value)
    case "kubernetes":
        return m.validateKubernetesConfig(key, value)
    case "iot":
        return m.validateIoTConfig(key, value)
    case "cost":
        return m.validateCostConfig(key, value)
    default:
        return fmt.Errorf("未知的组件: %s", component)
    }
}

func (m *ConfigManager) validateMultiTenantConfig(key string, value interface{}) error {
    switch key {
    case "default_storage_quota_gb":
        v, ok := value.(int)
        if !ok || v <= 0 {
            return fmt.Errorf("存储配额必须大于0")
        }
    case "quota_alert_threshold":
        v, ok := value.(float64)
        if !ok || v < 0 || v > 100 {
            return fmt.Errorf("告警阈值必须在0-100之间")
        }
    case "max_tenants_per_cluster":
        v, ok := value.(int)
        if !ok || v <= 0 {
            return fmt.Errorf("最大租户数必须大于0")
        }
    }
    return nil
}
```

### 11.3 热更新API接口

```go
// 获取配置
// GET /api/v1/config/module15/{component}
func GetConfig(c *gin.Context) {
    component := c.Param("component")
    
    config, err := configManager.LoadConfig(c.Request.Context(), component)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "code": 0,
        "data": config,
    })
}

// 更新配置
// PUT /api/v1/config/module15/{component}/{key}
func UpdateConfig(c *gin.Context) {
    component := c.Param("component")
    key := c.Param("key")
    
    var req struct {
        Value interface{} `json:"value"`
    }
    
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": "无效的请求"})
        return
    }
    
    userID := c.GetString("user_id")
    
    err := configManager.UpdateConfig(c.Request.Context(), component, key, req.Value, userID)
    if err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "code":    0,
        "message": "配置更新成功",
    })
}

// 获取配置历史
// GET /api/v1/config/module15/{component}/{key}/history
func GetConfigHistory(c *gin.Context) {
    component := c.Param("component")
    key := c.Param("key")
    
    history, err := configManager.GetConfigHistory(c.Request.Context(), component, key)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "code": 0,
        "data": history,
    })
}

// 回滚配置
// POST /api/v1/config/module15/{component}/{key}/rollback
func RollbackConfig(c *gin.Context) {
    component := c.Param("component")
    key := c.Param("key")
    
    var req struct {
        Version int `json:"version"`
    }
    
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": "无效的请求"})
        return
    }
    
    userID := c.GetString("user_id")
    
    err := configManager.RollbackConfig(c.Request.Context(), component, key, req.Version, userID)
    if err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "code":    0,
        "message": "配置回滚成功",
    })
}
```

### 11.4 热更新验收标准

**通用验收标准**:

1. THE System SHALL 在配置变更后3-5秒内应用新配置（对新请求生效）
2. THE System SHALL 支持通过API查询当前生效的配置
3. THE System SHALL 记录所有配置变更的审计日志
4. THE System SHALL 支持配置回滚到历史版本
5. WHEN 配置验证失败时，THE System SHALL 保持原配置并返回错误信息
6. THE System SHALL 在配置变更时发送通知给相关管理员

**多租户配置验收标准**:

1. WHEN 配额阈值变更时，THE System SHALL 重新评估所有租户的配额状态
2. WHEN 多租户功能禁用时，THE System SHALL 切换到单租户模式
3. WHEN 网络隔离配置变更时，THE System SHALL 自动更新Kubernetes Network Policy

**跨云配置验收标准**:

1. WHEN 云平台列表变更时，THE System SHALL 自动初始化或停止相应的云平台适配器
2. WHEN 同步模式变更时，THE System SHALL 平滑切换，不丢失数据
3. WHEN 自动故障转移禁用时，THE System SHALL 停止健康检查和自动切换

**Kubernetes配置验收标准**:

1. WHEN Namespace过滤规则变更时，THE System SHALL 自动调整采集范围
2. WHEN 多行合并模式变更时，THE System SHALL 对新日志流生效
3. WHEN Service Mesh集成禁用时，THE System SHALL 停止采集Envoy日志

**IoT配置验收标准**:

1. WHEN 发现协议变更时，THE System SHALL 自动启动或停止相应的发现服务
2. WHEN 离线缓存大小变更时，THE System SHALL 自动调整缓存空间
3. WHEN 低功耗模式启用时，THE System SHALL 降低采集频率和处理强度

**成本管理配置验收标准**:

1. WHEN 分摊规则变更时，THE System SHALL 重新计算所有维度的成本分摊
2. WHEN 自动执行优化启用时，THE System SHALL 在执行前验证操作安全性
3. WHEN 预算阈值变更时，THE System SHALL 立即重新评估所有预算的告警状态

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 租户数据泄露 | 低 | 高 | Network Policy隔离、审计日志、加密存储 |
| 跨云同步失败 | 中 | 中 | 重试机制、降级策略、告警通知 |
| K8s集群故障 | 低 | 高 | 多集群部署、自动故障转移 |
| IoT设备大量离线 | 中 | 中 | 离线缓存、批量同步、告警 |
| 成本超预算 | 中 | 中 | 预算告警、自动优化、限流 |

### 12.2 回滚方案

1. **配置回滚**: 通过API回滚到历史版本
2. **租户回滚**: 从备份恢复租户数据
3. **应用回滚**: Kubernetes滚动更新回滚
4. **数据回滚**: 数据库PITR恢复

---

## 13. 附录

### 13.1 术语表

| 术语 | 说明 |
|------|------|
| 多租户 (Multi-Tenancy) | 单个系统实例服务多个租户，数据和资源隔离 |
| 跨云 (Multi-Cloud) | 同时使用多个云服务提供商的基础设施 |
| DaemonSet | Kubernetes工作负载，确保每个节点运行一个Pod副本 |
| CRD | Custom Resource Definition，Kubernetes自定义资源定义 |
| Service Mesh | 服务网格，管理微服务间通信的基础设施层 |
| mDNS | Multicast DNS，本地网络服务发现协议 |
| MQTT | Message Queuing Telemetry Transport，轻量级消息协议 |
| CoAP | Constrained Application Protocol，受限应用协议 |
| FinOps | Financial Operations，云财务管理实践 |

### 13.2 参考文档

- [Kubernetes官方文档](https://kubernetes.io/docs/)
- [Istio官方文档](https://istio.io/latest/docs/)
- [AWS SDK文档](https://aws.amazon.com/sdk-for-go/)
- [Azure SDK文档](https://docs.microsoft.com/en-us/azure/developer/go/)
- [MQTT协议规范](https://mqtt.org/mqtt-specification/)
- [FinOps Foundation](https://www.finops.org/)

### 13.3 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-01-31 | v1.0 | 初稿，完整设计方案 | 系统架构团队 |

---

**文档结束**

# 模块十一：自动化运维 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-01-31  
> **状态**: 已发布  
> **相关需求**: [requirements-module11.md](../requirements/requirements-module11.md)

---

## 1. 文档信息

### 1.1 版本历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-01-31 | 系统架构团队 | 初稿，完整设计方案 |

### 1.2 文档状态

- **当前状态**: 已发布
- **评审状态**: 已通过
- **实施阶段**: MVP + Phase 2

### 1.3 相关文档

- [需求文档](../requirements/requirements-module11.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)

---

## 2. 总体架构

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        自动化运维架构                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      GitOps 层                                    │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │  │
│  │  │  Git Repo    │  │   ArgoCD     │  │   Webhook    │          │  │
│  │  │ (配置源)      │─▶│ (同步引擎)    │─▶│  (通知)      │          │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
│                                 │                                      │
│  ┌──────────────────────────────▼───────────────────────────────────┐  │
│  │                      部署管理层                                    │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  Helm Charts                                                │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │  │
│  │  │  │ Collector│  │API Server│  │ Storage  │  │ Monitor  │  │ │  │
│  │  │  │  Chart   │  │  Chart   │  │  Chart   │  │  Chart   │  │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  部署策略                                                    │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                │ │  │
│  │  │  │ 滚动升级  │  │ 蓝绿部署  │  │ 金丝雀   │                │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘                │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      配置管理层                                    │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  配置中心                                                    │ │  │
│  │  │  ┌──────────────────┐        ┌──────────────────┐         │ │  │
│  │  │  │   PostgreSQL     │◄──────►│      Redis       │         │ │  │
│  │  │  │  (版本化存储)     │        │   (实时分发)      │         │ │  │
│  │  │  └──────────────────┘        └──────────────────┘         │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  配置管理功能                                                │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │  │
│  │  │  │ 版本控制  │  │ 变更审计  │  │ 热更新   │  │ 加密存储  │  │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      健康检查与自愈层                              │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  健康检查                                                    │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                │ │  │
│  │  │  │ Liveness │  │ Readiness│  │  Startup │                │ │  │
│  │  │  │  Probe   │  │  Probe   │  │  Probe   │                │ │  │
│  │  │  └────┬─────┘  └────┬─────┘  └────┬─────┘                │ │  │
│  │  │       └─────────────┴─────────────┘                       │ │  │
│  │  │                     │                                      │ │  │
│  │  │          ┌──────────▼──────────┐                          │ │  │
│  │  │          │  Health Monitor     │                          │ │  │
│  │  │          │  (健康状态聚合)      │                          │ │  │
│  │  │          └──────────┬──────────┘                          │ │  │
│  │  └─────────────────────┼─────────────────────────────────────┘ │  │
│  │                        │                                        │  │
│  │  ┌─────────────────────▼─────────────────────────────────────┐ │  │
│  │  │  自愈引擎                                                  │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │ │  │
│  │  │  │ 重启服务  │  │ 扩容副本  │  │ 清理缓存  │  │ 切换流量  │ │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      监控与告警层                                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │  │
│  │  │  Prometheus  │  │ Alertmanager │  │   Grafana    │          │  │
│  │  │  (指标采集)   │─▶│  (告警路由)   │─▶│  (可视化)    │          │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      审计日志层                                    │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  审计日志记录                                                │ │  │
│  │  │  • 部署操作日志                                              │ │  │
│  │  │  • 配置变更日志                                              │ │  │
│  │  │  • 自愈操作日志                                              │ │  │
│  │  │  • 健康检查日志                                              │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分

| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| GitOps层 | 声明式部署 | Git配置源、ArgoCD同步、Webhook通知 |
| 部署管理层 | 自动化部署 | Helm Charts、滚动升级、蓝绿部署、金丝雀发布 |
| 配置管理层 | 配置中心 | 版本控制、热更新、加密存储、变更审计 |
| 健康检查层 | 健康监控 | 存活性检查、就绪性检查、启动探针 |
| 自愈层 | 故障自愈 | 重启服务、扩容副本、清理缓存、切换流量、降级服务 |
| 监控告警层 | 运维监控 | Prometheus指标、Alertmanager告警、Grafana可视化 |
| 审计日志层 | 操作审计 | 部署日志、配置变更日志、自愈日志 |

### 2.3 关键路径

**部署流程关键路径**:
```
配置变更 → Git提交(1s) → ArgoCD同步(5s) → Helm部署(60s) 
  → 健康检查(30s) → 部署完成

总时长: < 10分钟 (包含测试和验证)
```

**配置热更新关键路径**:
```
配置变更 → PostgreSQL保存(100ms) → Redis发布(50ms) 
  → 节点订阅(1s) → 原子更新(10ms) → 生效

总延迟: < 10秒
```

**自愈流程关键路径**:
```
健康检查失败(10s) → 连续3次确认(30s) → 触发自愈(5s) 
  → 执行修复(30s) → 验证恢复(30s)

总时长: < 2分钟
```

---

## 3. 技术选型

### 3.1 核心技术栈

| 技术 | 版本 | 选择理由 |
|------|------|----------|
| Helm | 3.13+ | Kubernetes包管理标准、模板化配置、版本管理 |
| ArgoCD | 2.9+ | GitOps最佳实践、自动同步、回滚支持 |
| Terraform | 1.6+ | 基础设施即代码、多云支持、状态管理 |
| Ansible | 2.15+ | 配置自动化、幂等性、无Agent架构 |
| GitLab CI | 16.x | CI/CD集成、Pipeline管理、容器化构建 |
| GitHub Actions | - | 轻量级CI/CD、社区生态丰富 |
| Kubernetes Probes | - | 原生健康检查、多层次探测 |
| Prometheus | 2.48+ | 指标采集标准、强大的查询语言 |
| Alertmanager | 0.26+ | 告警路由、分组、抑制 |
| PostgreSQL | 15+ | 配置版本化存储、ACID保证 |
| Redis | 7+ | 配置实时分发、Pub/Sub通知 |
| Go | 1.21+ | 高性能、并发友好、跨平台 |

### 3.2 技术对比

**部署工具对比**:

| 特性 | Helm | Kustomize | Operator |
|------|------|-----------|----------|
| 学习曲线 | 中等 | 简单 | 复杂 |
| 模板能力 | 强 | 弱 | 强 |
| 版本管理 | 支持 | 不支持 | 支持 |
| 社区生态 | 丰富 | 一般 | 一般 |
| 选择理由 | ✅ 功能完整、生态成熟 | - | - |

**GitOps工具对比**:

| 特性 | ArgoCD | Flux | Jenkins X |
|------|--------|------|-----------|
| UI界面 | 优秀 | 无 | 一般 |
| 多集群 | 支持 | 支持 | 支持 |
| 回滚能力 | 强 | 中 | 弱 |
| 社区活跃度 | 高 | 高 | 中 |
| 选择理由 | ✅ UI友好、功能强大 | - | - |

**配置中心对比**:

| 特性 | PostgreSQL+Redis | Consul | etcd |
|------|------------------|--------|------|
| 版本控制 | 支持 | 不支持 | 不支持 |
| 热更新 | 支持 | 支持 | 支持 |
| 加密存储 | 支持 | 支持 | 支持 |
| 运维成本 | 低 | 中 | 中 |
| 选择理由 | ✅ 已有基础设施、功能满足 | - | - |

### 3.3 版本选择说明

- **Helm 3.13+**: 支持OCI registry、改进的依赖管理
- **ArgoCD 2.9+**: 支持多源应用、改进的RBAC
- **PostgreSQL 15+**: 性能提升、JSON支持增强
- **Redis 7+**: Redis Functions、ACL增强
- **Prometheus 2.48+**: 原生直方图、性能优化

---

## 4. 关键流程设计

### 4.1 自动化部署流程

**滚动升级流程**:

```
1. 用户触发部署请求
2. 验证部署配置(版本号、环境、组件)
3. 执行部署前测试
4. 逐个升级组件:
   a. 使用Helm升级组件
   b. 等待新Pod就绪
   c. 健康检查通过
   d. 继续下一个组件
5. 执行部署后测试
6. 部署完成，记录审计日志
```

**蓝绿部署流程**:

```
1. 部署绿色环境(新版本)
2. 等待绿色环境就绪
3. 执行健康检查和测试
4. 切换流量到绿色环境
5. 验证流量切换成功
6. 删除蓝色环境(旧版本)
7. 重命名绿色环境为蓝色环境
```

**金丝雀发布流程**:

```
1. 部署金丝雀版本
2. 切换10%流量到金丝雀
3. 监控金丝雀指标(5分钟)
4. 如果正常，增加到50%流量
5. 继续监控(5分钟)
6. 如果正常，切换100%流量
7. 删除旧版本
```

**时序图**:

```
用户  API  验证器  Helm  K8s  健康检查  测试器  审计
 │     │     │      │     │      │       │      │
 │─部署→│     │      │     │      │       │      │
 │     │─验证→│      │     │      │       │      │
 │     │     │─OK──→│     │      │       │      │
 │     │     │      │─升级→│      │       │      │
 │     │     │      │     │─就绪→│       │      │
 │     │     │      │     │      │─检查→│       │
 │     │     │      │     │      │      │─测试→│
 │     │     │      │     │      │      │      │─记录→
 │     │◄────────────────────────────────完成────│
```

### 4.2 配置热更新流程

**配置变更流程**:

```
1. 用户通过API/UI修改配置
2. 配置验证(语法、语义、范围)
3. 保存到PostgreSQL(版本化)
4. 发布到Redis Pub/Sub(config:环境名)
5. 所有节点订阅并接收通知
6. 节点使用atomic.Value原子更新配置
7. 记录审计日志(变更人、时间、内容)
8. 配置生效(10秒内)
```

**配置回滚流程**:

```
1. 用户选择目标版本
2. 从PostgreSQL获取历史版本
3. 验证历史版本配置
4. 应用历史版本配置
5. 通过Redis Pub/Sub分发
6. 所有节点更新配置
7. 记录回滚审计日志
8. 回滚完成(< 30秒)
```

### 4.3 健康检查与自愈流程

**健康检查流程**:

```
1. 定时执行健康检查(10秒间隔)
2. 并发检查所有服务:
   - 存活性检查(Liveness Probe)
   - 就绪性检查(Readiness Probe)
   - 启动探针(Startup Probe)
3. 记录检查结果
4. 如果失败，增加失败计数
5. 连续3次失败，触发自愈
```

**自愈流程**:

```
1. 检测到服务不健康(连续3次失败)
2. 检查熔断器状态
3. 如果熔断器未打开:
   a. 选择自愈策略(重启/扩容/清理缓存/切换流量/降级)
   b. 执行自愈操作
   c. 等待服务恢复(30秒)
   d. 验证健康状态
4. 如果自愈成功:
   - 重置失败计数
   - 重置熔断器
   - 记录成功日志
5. 如果自愈失败:
   - 增加重试计数
   - 更新熔断器
   - 发送告警通知
   - 记录失败日志
```

**熔断器状态机**:

```
     失败次数<5
  ┌──────────────┐
  │   Closed     │
  │  (正常状态)   │
  └──────┬───────┘
         │ 失败次数>=5
         ▼
  ┌──────────────┐
  │    Open      │
  │  (熔断打开)   │
  └──────┬───────┘
         │ 5分钟后
         ▼
  ┌──────────────┐
  │  Half-Open   │
  │  (半开状态)   │
  └──────┬───────┘
         │ 成功
         ▼
  ┌──────────────┐
  │   Closed     │
  └──────────────┘
```

### 4.4 异常流程

| 异常类型 | 处理策略 | 恢复机制 |
|----------|----------|----------|
| 部署失败 | 自动回滚到上一版本 | 5分钟内完成回滚 |
| 配置验证失败 | 阻止变更、保持原配置 | 记录错误日志、通知用户 |
| 健康检查超时 | 标记为不健康、增加失败计数 | 连续3次失败触发自愈 |
| 自愈失败 | 发送告警、记录日志 | 人工介入处理 |
| 熔断器打开 | 跳过自愈、等待恢复 | 5分钟后尝试半开状态 |
| Redis不可用 | 配置更新失败、保持原配置 | 自动重连、记录错误 |
| PostgreSQL不可用 | 配置读取失败、使用缓存 | 自动重连、降级服务 |

---

## 5. 接口设计

### 5.1 API列表

详见 [API设计文档](./api-design.md) 模块11部分，共20个接口:

**部署管理接口** (5个):
- API-11-392: 执行部署 - POST /api/v1/deployment/deploy
- API-11-393: 查询部署状态 - GET /api/v1/deployment/status/{id}
- API-11-394: 回滚部署 - POST /api/v1/deployment/rollback
- API-11-395: 查询部署历史 - GET /api/v1/deployment/history
- API-11-396: 验证部署配置 - POST /api/v1/deployment/validate

**配置管理接口** (8个):
- API-11-397: 获取配置 - GET /api/v1/config/get
- API-11-398: 设置配置 - POST /api/v1/config/set
- API-11-399: 删除配置 - DELETE /api/v1/config/delete
- API-11-400: 查询配置版本 - GET /api/v1/config/versions
- API-11-401: 对比配置版本 - GET /api/v1/config/compare
- API-11-402: 回滚配置 - POST /api/v1/config/rollback
- API-11-403: 导出配置 - GET /api/v1/config/export
- API-11-404: 导入配置 - POST /api/v1/config/import

**健康检查与自愈接口** (7个):
- API-11-405: 查询健康状态 - GET /api/v1/health/status
- API-11-406: 查询健康检查器列表 - GET /api/v1/health/checkers
- API-11-407: 查询健康检查器详情 - GET /api/v1/health/checkers/{name}
- API-11-408: 查询自愈器列表 - GET /api/v1/health/healers
- API-11-409: 查询自愈器详情 - GET /api/v1/health/healers/{name}
- API-11-410: 手动触发自愈 - POST /api/v1/health/heal
- API-11-411: 查询健康检查历史 - GET /api/v1/health/history

### 5.2 内部接口

**部署管理器接口**:

```go
// 部署管理器接口
type DeploymentManager interface {
    // 执行部署
    Deploy(ctx context.Context, req *DeploymentRequest) (*DeploymentResponse, error)
    
    // 回滚部署
    Rollback(ctx context.Context, deploymentID string) error
    
    // 查询部署状态
    GetStatus(ctx context.Context, deploymentID string) (*DeploymentStatus, error)
    
    // 验证配置
    ValidateConfig(ctx context.Context, config *DeploymentConfig) error
}

// Helm客户端接口
type HelmClient interface {
    // 安装Chart
    Install(ctx context.Context, name, version, namespace string, values map[string]interface{}) error
    
    // 升级Chart
    Upgrade(ctx context.Context, name, version string, values map[string]interface{}) error
    
    // 卸载Chart
    Uninstall(ctx context.Context, name, namespace string) error
    
    // 回滚Release
    Rollback(ctx context.Context, name string, revision int) error
}
```

**配置管理器接口**:

```go
// 配置管理器接口
type ConfigManager interface {
    // 获取配置
    Get(ctx context.Context, key, environment string) (*ConfigItem, error)
    
    // 设置配置
    Set(ctx context.Context, item *ConfigItem) error
    
    // 删除配置
    Delete(ctx context.Context, key, environment string) error
    
    // 对比版本
    Compare(ctx context.Context, version1, version2 int) ([]*ConfigChange, error)
    
    // 回滚配置
    Rollback(ctx context.Context, environment string, version int) error
    
    // 导出配置
    Export(ctx context.Context, environment, format string) ([]byte, error)
    
    // 导入配置
    Import(ctx context.Context, environment, format string, data []byte) error
}

// 配置分发器接口
type ConfigDistributor interface {
    // 发布配置变更
    Publish(ctx context.Context, item *ConfigItem) error
    
    // 订阅配置变更
    Subscribe(ctx context.Context, environment string, handler func(*ConfigItem)) error
}
```

**健康监控器接口**:

```go
// 健康监控器接口
type HealthMonitor interface {
    // 启动监控
    Start(ctx context.Context) error
    
    // 停止监控
    Stop(ctx context.Context) error
    
    // 添加检查器
    AddChecker(checker *HealthChecker) error
    
    // 移除检查器
    RemoveChecker(name string) error
    
    // 获取健康状态
    GetStatus(ctx context.Context) (*HealthStatus, error)
}

// 自愈器接口
type SelfHealer interface {
    // 执行自愈
    Heal(ctx context.Context, target string, strategy HealStrategy) (*HealResult, error)
    
    // 获取自愈历史
    GetHistory(ctx context.Context, target string) ([]*HealResult, error)
}
```

### 5.3 数据格式

**部署请求格式**:

```json
{
  "id": "deploy-20260131-001",
  "version": "v1.2.3",
  "strategy": "rolling",
  "environment": "prod",
  "components": ["collector", "api-server", "storage"],
  "config": {
    "replicas": 3,
    "resources": {
      "cpu": "2",
      "memory": "4Gi"
    }
  },
  "dry_run": false
}
```

**配置项格式**:

```json
{
  "id": "cfg-001",
  "key": "collector.buffer_size",
  "value": 10000,
  "environment": "prod",
  "version": 5,
  "encrypted": false,
  "created_at": "2026-01-31T10:00:00Z",
  "created_by": "admin",
  "updated_at": "2026-01-31T12:00:00Z",
  "updated_by": "admin",
  "description": "采集器缓冲区大小",
  "tags": ["collector", "performance"]
}
```

**健康检查结果格式**:

```json
{
  "checker_name": "api-server-liveness",
  "status": "healthy",
  "message": "健康检查通过",
  "timestamp": "2026-01-31T12:00:00Z",
  "duration": "50ms"
}
```

---

## 6. 数据设计

### 6.1 数据模型

**部署记录模型**:

```go
// 部署记录
type Deployment struct {
    ID          string                 `json:"id" db:"id"`
    Version     string                 `json:"version" db:"version"`
    Strategy    DeploymentStrategy     `json:"strategy" db:"strategy"`
    Environment string                 `json:"environment" db:"environment"`
    Components  []string               `json:"components" db:"components"`
    Config      map[string]interface{} `json:"config" db:"config"`
    Status      DeploymentStatus       `json:"status" db:"status"`
    StartTime   time.Time              `json:"start_time" db:"start_time"`
    EndTime     *time.Time             `json:"end_time,omitempty" db:"end_time"`
    Duration    time.Duration          `json:"duration" db:"duration"`
    CreatedBy   string                 `json:"created_by" db:"created_by"`
    Logs        []string               `json:"logs" db:"logs"`
    Error       string                 `json:"error,omitempty" db:"error"`
}

// 部署历史
type DeploymentHistory struct {
    ID           string    `json:"id" db:"id"`
    DeploymentID string    `json:"deployment_id" db:"deployment_id"`
    Action       string    `json:"action" db:"action"` // deploy, rollback
    Status       string    `json:"status" db:"status"`
    Timestamp    time.Time `json:"timestamp" db:"timestamp"`
    Operator     string    `json:"operator" db:"operator"`
    Message      string    `json:"message" db:"message"`
}
```

**配置项模型**:

```go
// 配置项
type ConfigItem struct {
    ID          string                 `json:"id" db:"id"`
    Key         string                 `json:"key" db:"key"`
    Value       interface{}            `json:"value" db:"value"`
    Environment string                 `json:"environment" db:"environment"`
    Version     int                    `json:"version" db:"version"`
    Encrypted   bool                   `json:"encrypted" db:"encrypted"`
    CreatedAt   time.Time              `json:"created_at" db:"created_at"`
    CreatedBy   string                 `json:"created_by" db:"created_by"`
    UpdatedAt   time.Time              `json:"updated_at" db:"updated_at"`
    UpdatedBy   string                 `json:"updated_by" db:"updated_by"`
    Description string                 `json:"description" db:"description"`
    Tags        []string               `json:"tags" db:"tags"`
}

// 配置版本
type ConfigVersion struct {
    ID        string          `json:"id" db:"id"`
    Version   int             `json:"version" db:"version"`
    Timestamp time.Time       `json:"timestamp" db:"timestamp"`
    Author    string          `json:"author" db:"author"`
    Message   string          `json:"message" db:"message"`
    Changes   []*ConfigChange `json:"changes" db:"changes"`
    Checksum  string          `json:"checksum" db:"checksum"`
}

// 配置变更
type ConfigChange struct {
    Type     ChangeType  `json:"type"`
    Key      string      `json:"key"`
    OldValue interface{} `json:"old_value,omitempty"`
    NewValue interface{} `json:"new_value,omitempty"`
}
```

**健康检查模型**:

```go
// 健康检查器
type HealthChecker struct {
    Name         string       `json:"name" db:"name"`
    Type         CheckType    `json:"type" db:"type"`
    Target       string       `json:"target" db:"target"`
    Interval     int          `json:"interval" db:"interval"` // 秒
    Timeout      int          `json:"timeout" db:"timeout"`   // 秒
    Status       HealthStatus `json:"status" db:"status"`
    LastCheck    time.Time    `json:"last_check" db:"last_check"`
    FailureCount int          `json:"failure_count" db:"failure_count"`
    Enabled      bool         `json:"enabled" db:"enabled"`
}

// 健康检查结果
type HealthCheckResult struct {
    ID          string       `json:"id" db:"id"`
    CheckerName string       `json:"checker_name" db:"checker_name"`
    Status      HealthStatus `json:"status" db:"status"`
    Message     string       `json:"message" db:"message"`
    Timestamp   time.Time    `json:"timestamp" db:"timestamp"`
    Duration    int64        `json:"duration" db:"duration"` // 毫秒
}

// 自愈器
type SelfHealer struct {
    Name       string       `json:"name" db:"name"`
    Strategy   HealStrategy `json:"strategy" db:"strategy"`
    Enabled    bool         `json:"enabled" db:"enabled"`
    MaxRetries int          `json:"max_retries" db:"max_retries"`
    RetryCount int          `json:"retry_count" db:"retry_count"`
    LastHeal   *time.Time   `json:"last_heal,omitempty" db:"last_heal"`
}

// 自愈结果
type HealResult struct {
    ID         string       `json:"id" db:"id"`
    HealerName string       `json:"healer_name" db:"healer_name"`
    Strategy   HealStrategy `json:"strategy" db:"strategy"`
    Success    bool         `json:"success" db:"success"`
    Message    string       `json:"message" db:"message"`
    Timestamp  time.Time    `json:"timestamp" db:"timestamp"`
    Duration   int64        `json:"duration" db:"duration"` // 毫秒
}
```

### 6.2 数据库设计

**部署相关表**:

```sql
-- 部署记录表
CREATE TABLE deployments (
    id VARCHAR(64) PRIMARY KEY,
    version VARCHAR(32) NOT NULL,
    strategy VARCHAR(32) NOT NULL,
    environment VARCHAR(32) NOT NULL,
    components JSONB NOT NULL,
    config JSONB NOT NULL,
    status VARCHAR(32) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration BIGINT,
    created_by VARCHAR(64) NOT NULL,
    logs JSONB,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deployments_environment ON deployments(environment);
CREATE INDEX idx_deployments_status ON deployments(status);
CREATE INDEX idx_deployments_start_time ON deployments(start_time DESC);

-- 部署历史表
CREATE TABLE deployment_history (
    id VARCHAR(64) PRIMARY KEY,
    deployment_id VARCHAR(64) NOT NULL,
    action VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    operator VARCHAR(64) NOT NULL,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deployment_id) REFERENCES deployments(id)
);

CREATE INDEX idx_deployment_history_deployment_id ON deployment_history(deployment_id);
CREATE INDEX idx_deployment_history_timestamp ON deployment_history(timestamp DESC);
```

**配置相关表**:

```sql
-- 配置项表
CREATE TABLE config_items (
    id VARCHAR(64) PRIMARY KEY,
    key VARCHAR(255) NOT NULL,
    value JSONB NOT NULL,
    environment VARCHAR(32) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    encrypted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL,
    created_by VARCHAR(64) NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    updated_by VARCHAR(64) NOT NULL,
    description TEXT,
    tags JSONB,
    UNIQUE(key, environment)
);

CREATE INDEX idx_config_items_key ON config_items(key);
CREATE INDEX idx_config_items_environment ON config_items(environment);
CREATE INDEX idx_config_items_updated_at ON config_items(updated_at DESC);

-- 配置版本表
CREATE TABLE config_versions (
    id VARCHAR(64) PRIMARY KEY,
    version INT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    author VARCHAR(64) NOT NULL,
    message TEXT,
    changes JSONB NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_config_versions_version ON config_versions(version DESC);
CREATE INDEX idx_config_versions_timestamp ON config_versions(timestamp DESC);

-- 配置审计日志表
CREATE TABLE config_audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    config_id VARCHAR(64) NOT NULL,
    action VARCHAR(32) NOT NULL, -- create, update, delete, rollback
    old_value JSONB,
    new_value JSONB,
    operator VARCHAR(64) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_config_audit_logs_config_id ON config_audit_logs(config_id);
CREATE INDEX idx_config_audit_logs_timestamp ON config_audit_logs(timestamp DESC);
```

**健康检查相关表**:

```sql
-- 健康检查器表
CREATE TABLE health_checkers (
    name VARCHAR(64) PRIMARY KEY,
    type VARCHAR(32) NOT NULL,
    target VARCHAR(255) NOT NULL,
    interval INT NOT NULL DEFAULT 10,
    timeout INT NOT NULL DEFAULT 5,
    status VARCHAR(32) NOT NULL,
    last_check TIMESTAMP,
    failure_count INT DEFAULT 0,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_health_checkers_status ON health_checkers(status);
CREATE INDEX idx_health_checkers_enabled ON health_checkers(enabled);

-- 健康检查结果表（保留90天）
CREATE TABLE health_check_results (
    id VARCHAR(64) PRIMARY KEY,
    checker_name VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    message TEXT,
    timestamp TIMESTAMP NOT NULL,
    duration BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_health_check_results_checker_name ON health_check_results(checker_name);
CREATE INDEX idx_health_check_results_timestamp ON health_check_results(timestamp DESC);
CREATE INDEX idx_health_check_results_status ON health_check_results(status);

-- 自愈器表
CREATE TABLE self_healers (
    name VARCHAR(64) PRIMARY KEY,
    strategy VARCHAR(32) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    max_retries INT DEFAULT 3,
    retry_count INT DEFAULT 0,
    last_heal TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 自愈结果表（保留90天）
CREATE TABLE heal_results (
    id VARCHAR(64) PRIMARY KEY,
    healer_name VARCHAR(64) NOT NULL,
    strategy VARCHAR(32) NOT NULL,
    success BOOLEAN NOT NULL,
    message TEXT,
    timestamp TIMESTAMP NOT NULL,
    duration BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_heal_results_healer_name ON heal_results(healer_name);
CREATE INDEX idx_heal_results_timestamp ON heal_results(timestamp DESC);
CREATE INDEX idx_heal_results_success ON heal_results(success);
```

### 6.3 缓存设计

**Redis缓存策略**:

| 缓存键 | 数据类型 | TTL | 用途 |
|--------|----------|-----|------|
| `config:{env}:{key}` | String | 1小时 | 配置项缓存 |
| `config:version:{env}` | String | 永久 | 当前配置版本号 |
| `deployment:status:{id}` | Hash | 1天 | 部署状态缓存 |
| `health:status:{name}` | Hash | 30秒 | 健康状态缓存 |
| `health:checker:{name}` | Hash | 5分钟 | 检查器配置缓存 |
| `circuit:state:{name}` | Hash | 永久 | 熔断器状态 |

**Redis Pub/Sub频道**:

| 频道名 | 用途 | 消息格式 |
|--------|------|----------|
| `config:{env}` | 配置变更通知 | JSON格式的ConfigItem |
| `config:reload` | 全局配置重载 | 环境名 |
| `deployment:status` | 部署状态变更 | JSON格式的DeploymentStatus |
| `health:alert` | 健康告警通知 | JSON格式的HealthAlert |

**缓存更新策略**:

1. **配置缓存**: 
   - 写入时同时更新PostgreSQL和Redis
   - 通过Pub/Sub通知所有节点更新本地缓存
   - 使用atomic.Value实现无锁读取

2. **部署状态缓存**:
   - 部署过程中实时更新Redis
   - 完成后持久化到PostgreSQL
   - 1天后自动过期

3. **健康状态缓存**:
   - 每次检查后更新Redis
   - 30秒TTL，确保数据新鲜度
   - 不持久化到PostgreSQL（仅保留历史记录）

4. **熔断器状态**:
   - 状态变更时立即更新Redis
   - 永久保存，手动重置
   - 定期同步到PostgreSQL备份

---

## 7. 安全设计

### 7.1 认证授权

**RBAC权限模型**:

| 角色 | 权限范围 | 可执行操作 |
|------|----------|------------|
| 系统管理员 | 全部环境 | 部署、配置管理、健康检查、自愈操作 |
| 运维工程师 | 指定环境 | 部署、配置查看、健康检查查看、手动触发自愈 |
| 开发工程师 | 开发/测试环境 | 部署、配置查看 |
| 只读用户 | 全部环境 | 查看部署状态、配置、健康状态 |

**权限控制**:

```go
// 权限定义
const (
    PermissionDeploymentRead  = "deployment.read"
    PermissionDeploymentWrite = "deployment.write"
    PermissionConfigRead      = "config.read"
    PermissionConfigWrite     = "config.write"
    PermissionHealthRead      = "health.read"
    PermissionHealthWrite     = "health.write"
)

// 权限检查中间件
func RequirePermission(permission string) gin.HandlerFunc {
    return func(c *gin.Context) {
        user := c.MustGet("user").(*User)
        
        if !user.HasPermission(permission) {
            c.JSON(403, gin.H{"error": "权限不足"})
            c.Abort()
            return
        }
        
        c.Next()
    }
}
```

### 7.2 数据加密

**配置加密**:

- 算法: AES-256-GCM
- 密钥管理: 环境变量 + HashiCorp Vault
- 加密范围: 敏感配置项（密码、密钥、Token）
- 密钥轮换: 每季度轮换一次

**传输加密**:

- API通信: TLS 1.3
- Redis通信: TLS + 密码认证
- PostgreSQL通信: SSL连接
- Kubernetes API: mTLS

**静态数据加密**:

- PostgreSQL: 透明数据加密(TDE)
- Redis: RDB/AOF文件加密
- 备份文件: AES-256加密

### 7.3 审计日志

**审计日志内容**:

```go
// 审计日志结构
type AuditLog struct {
    ID        string                 `json:"id"`
    Module    string                 `json:"module"`    // deployment, config, health
    Action    string                 `json:"action"`    // create, update, delete, rollback
    Resource  string                 `json:"resource"`  // 资源标识
    Operator  string                 `json:"operator"`  // 操作人
    IP        string                 `json:"ip"`        // 来源IP
    Timestamp time.Time              `json:"timestamp"` // 操作时间
    Before    map[string]interface{} `json:"before"`    // 变更前
    After     map[string]interface{} `json:"after"`     // 变更后
    Result    string                 `json:"result"`    // success, failed
    Error     string                 `json:"error"`     // 错误信息
    Duration  int64                  `json:"duration"`  // 执行时长(ms)
}
```

**审计日志记录范围**:

1. **部署操作**:
   - 部署请求、部署完成、部署失败
   - 回滚操作、配置验证
   - 部署策略变更

2. **配置操作**:
   - 配置创建、更新、删除
   - 配置导入、导出
   - 配置回滚、版本对比

3. **健康检查操作**:
   - 检查器创建、更新、删除
   - 手动触发自愈
   - 熔断器状态变更

4. **权限操作**:
   - 登录、登出
   - 权限变更
   - 角色分配

**审计日志存储**:

- 存储位置: PostgreSQL + Elasticsearch
- 保留期限: 1年（部署）、1年（配置）、90天（健康检查）
- 查询接口: 支持时间范围、操作人、模块、操作类型过滤
- 导出功能: 支持CSV、JSON格式导出

### 7.4 安全加固

**API安全**:

- 请求限流: 100 req/min/user
- 请求签名: HMAC-SHA256
- 防重放攻击: Nonce + 时间戳
- SQL注入防护: 参数化查询
- XSS防护: 输入验证 + 输出转义

**配置安全**:

- 敏感配置自动检测和加密
- 配置变更需要审批流程（生产环境）
- 配置回滚需要二次确认
- 配置导出需要额外权限

**部署安全**:

- 生产环境部署需要审批
- 部署前自动安全扫描
- 回滚操作需要二次确认
- 部署窗口限制（生产环境）

**网络安全**:

- 内部服务间通信使用mTLS
- API网关限流和熔断
- DDoS防护
- 网络隔离（不同环境）

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 部署时间 | < 10分钟 | 从触发到完成的总时长 |
| 配置热更新延迟 | < 10秒 | 从变更到所有节点生效 |
| 健康检查间隔 | 10秒 | 定时检查周期 |
| 自愈响应时间 | < 30秒 | 从检测到执行修复 |
| API响应时间(P95) | < 200ms | Prometheus监控 |
| API响应时间(P99) | < 500ms | Prometheus监控 |
| 配置查询QPS | > 1000 | 压测结果 |
| 部署并发数 | 10 | 同时进行的部署任务 |
| 配置版本数 | 100 | 每个配置项保留的版本数 |
| 审计日志保留期 | 1年 | 部署和配置日志 |

### 8.2 优化策略

**部署性能优化**:

1. **并行部署**:
   - 无依赖的组件并行部署
   - 使用Goroutine并发执行
   - 控制并发数避免资源耗尽

2. **镜像预拉取**:
   - 部署前预拉取镜像到所有节点
   - 使用DaemonSet预热镜像
   - 减少部署时的镜像拉取时间

3. **健康检查优化**:
   - 合理设置initialDelaySeconds
   - 使用Startup Probe加速启动
   - 避免过于频繁的检查

**配置性能优化**:

1. **缓存策略**:
   - 使用Redis缓存热点配置
   - 本地内存缓存 + atomic.Value
   - 减少数据库查询

2. **批量操作**:
   - 配置批量导入
   - 批量更新通知
   - 减少网络往返

3. **索引优化**:
   - 为常用查询字段建立索引
   - 使用复合索引优化多条件查询
   - 定期分析和优化索引

**健康检查性能优化**:

1. **并发检查**:
   - 使用Goroutine并发检查所有服务
   - 控制并发数避免资源耗尽
   - 使用超时控制避免阻塞

2. **检查频率优化**:
   - 根据服务重要性调整检查频率
   - 健康服务降低检查频率
   - 不健康服务提高检查频率

3. **结果缓存**:
   - 缓存最近的检查结果
   - 避免重复检查
   - 减少目标服务压力

### 8.3 容量规划

**部署管理器**:

- CPU: 2核（基础）+ 0.5核/并发部署
- 内存: 2GB（基础）+ 500MB/并发部署
- 存储: 10GB（日志和临时文件）
- 网络: 100Mbps

**配置管理器**:

- CPU: 2核
- 内存: 4GB（包含本地缓存）
- 存储: 20GB（配置和版本历史）
- 网络: 100Mbps

**健康监控器**:

- CPU: 1核（基础）+ 0.1核/100个检查器
- 内存: 1GB（基础）+ 100MB/100个检查器
- 存储: 5GB（检查历史）
- 网络: 50Mbps

**PostgreSQL**:

- CPU: 4核
- 内存: 8GB
- 存储: 100GB（SSD）
- 连接数: 200

**Redis**:

- CPU: 2核
- 内存: 4GB
- 存储: 10GB
- 连接数: 1000

### 8.4 性能监控

**关键指标监控**:

```yaml
# Prometheus监控指标
- deployment_duration_seconds: 部署耗时
- deployment_total: 部署总数
- deployment_failed_total: 部署失败数
- config_update_duration_seconds: 配置更新耗时
- config_sync_delay_seconds: 配置同步延迟
- health_check_duration_seconds: 健康检查耗时
- health_check_failed_total: 健康检查失败数
- self_healing_duration_seconds: 自愈耗时
- self_healing_success_total: 自愈成功数
- self_healing_failed_total: 自愈失败数
- api_request_duration_seconds: API请求耗时
- api_request_total: API请求总数
```

**性能告警规则**:

```yaml
# 部署性能告警
- alert: DeploymentTooSlow
  expr: deployment_duration_seconds > 600
  for: 1m
  annotations:
    summary: "部署时间超过10分钟"

# 配置同步告警
- alert: ConfigSyncDelayHigh
  expr: config_sync_delay_seconds > 10
  for: 1m
  annotations:
    summary: "配置同步延迟超过10秒"

# 健康检查告警
- alert: HealthCheckTooSlow
  expr: health_check_duration_seconds > 5
  for: 5m
  annotations:
    summary: "健康检查耗时超过5秒"

# API性能告警
- alert: APIResponseTimeTooHigh
  expr: histogram_quantile(0.95, api_request_duration_seconds) > 0.2
  for: 5m
  annotations:
    summary: "API P95响应时间超过200ms"
```

---

## 9. 部署方案

### 9.1 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes 集群                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Namespace: automation                               │   │
│  │                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │   │
│  │  │ Deployment   │  │   Config     │  │  Health  │  │   │
│  │  │  Manager     │  │   Manager    │  │ Monitor  │  │   │
│  │  │  (3 replicas)│  │ (3 replicas) │  │(2 replicas)│  │   │
│  │  └──────────────┘  └──────────────┘  └──────────┘  │   │
│  │                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │  PostgreSQL  │  │    Redis     │               │   │
│  │  │  (StatefulSet)│  │(StatefulSet) │               │   │
│  │  └──────────────┘  └──────────────┘               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Namespace: argocd                                   │   │
│  │                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │   │
│  │  │ ArgoCD       │  │  ArgoCD      │  │ ArgoCD   │  │   │
│  │  │ Server       │  │  Repo Server │  │ App Ctrl │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 资源配置

**部署管理器**:

| 组件 | 副本数 | CPU请求 | CPU限制 | 内存请求 | 内存限制 | 存储 |
|------|--------|---------|---------|----------|----------|------|
| Deployment Manager | 3 | 1核 | 2核 | 2GB | 4GB | 10GB |

**配置管理器**:

| 组件 | 副本数 | CPU请求 | CPU限制 | 内存请求 | 内存限制 | 存储 |
|------|--------|---------|---------|----------|----------|------|
| Config Manager | 3 | 1核 | 2核 | 2GB | 4GB | 20GB |

**健康监控器**:

| 组件 | 副本数 | CPU请求 | CPU限制 | 内存请求 | 内存限制 | 存储 |
|------|--------|---------|---------|----------|----------|------|
| Health Monitor | 2 | 500m | 1核 | 1GB | 2GB | 5GB |

**数据存储**:

| 组件 | 副本数 | CPU请求 | CPU限制 | 内存请求 | 内存限制 | 存储 |
|------|--------|---------|---------|----------|----------|------|
| PostgreSQL | 1 | 2核 | 4核 | 4GB | 8GB | 100GB(SSD) |
| Redis | 1 | 1核 | 2核 | 2GB | 4GB | 10GB |

**ArgoCD**:

| 组件 | 副本数 | CPU请求 | CPU限制 | 内存请求 | 内存限制 | 存储 |
|------|--------|---------|---------|----------|----------|------|
| ArgoCD Server | 2 | 500m | 1核 | 512MB | 1GB | - |
| ArgoCD Repo Server | 2 | 500m | 1核 | 512MB | 1GB | 10GB |
| ArgoCD App Controller | 1 | 1核 | 2核 | 1GB | 2GB | - |

### 9.3 Helm Chart配置

**values.yaml示例**:

```yaml
# 部署管理器配置
deploymentManager:
  enabled: true
  replicaCount: 3
  image:
    repository: log-management/deployment-manager
    tag: v1.0.0
    pullPolicy: IfNotPresent
  
  resources:
    requests:
      cpu: 1000m
      memory: 2Gi
    limits:
      cpu: 2000m
      memory: 4Gi
  
  config:
    strategy: rolling
    timeout: 600
    autoRollback: true
    healthCheckDelay: 30

# 配置管理器配置
configManager:
  enabled: true
  replicaCount: 3
  image:
    repository: log-management/config-manager
    tag: v1.0.0
  
  resources:
    requests:
      cpu: 1000m
      memory: 2Gi
    limits:
      cpu: 2000m
      memory: 4Gi
  
  config:
    maxVersions: 100
    encryptionEnabled: true
    hotReloadEnabled: true

# 健康监控器配置
healthMonitor:
  enabled: true
  replicaCount: 2
  image:
    repository: log-management/health-monitor
    tag: v1.0.0
  
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 1000m
      memory: 2Gi
  
  config:
    checkInterval: 10
    failureThreshold: 3
    circuitBreakerEnabled: true

# PostgreSQL配置
postgresql:
  enabled: true
  auth:
    username: automation
    password: <secret>
    database: automation
  
  primary:
    resources:
      requests:
        cpu: 2000m
        memory: 4Gi
      limits:
        cpu: 4000m
        memory: 8Gi
    
    persistence:
      enabled: true
      size: 100Gi
      storageClass: ssd

# Redis配置
redis:
  enabled: true
  auth:
    enabled: true
    password: <secret>
  
  master:
    resources:
      requests:
        cpu: 1000m
        memory: 2Gi
      limits:
        cpu: 2000m
        memory: 4Gi
    
    persistence:
      enabled: true
      size: 10Gi

# ArgoCD配置
argocd:
  enabled: true
  server:
    replicaCount: 2
  repoServer:
    replicaCount: 2
```

### 9.4 发布策略

**滚动升级配置**:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: deployment-manager
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # 最多额外创建1个Pod
      maxUnavailable: 1  # 最多1个Pod不可用
  template:
    spec:
      containers:
      - name: deployment-manager
        image: log-management/deployment-manager:v1.0.0
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
```

**HPA自动扩缩容**:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: deployment-manager-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: deployment-manager
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
        averageUtilization: 80
```

**PDB Pod中断预算**:

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: deployment-manager-pdb
spec:
  minAvailable: 2  # 至少保持2个Pod可用
  selector:
    matchLabels:
      app: deployment-manager
```

### 9.5 部署流程

**初始部署**:

```bash
# 1. 创建命名空间
kubectl create namespace automation

# 2. 创建Secret
kubectl create secret generic automation-secrets \
  --from-literal=postgres-password=<password> \
  --from-literal=redis-password=<password> \
  --from-literal=encryption-key=<key> \
  -n automation

# 3. 安装Helm Chart
helm install automation ./helm/automation \
  -n automation \
  -f values-production.yaml

# 4. 验证部署
kubectl get pods -n automation
kubectl get svc -n automation

# 5. 安装ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 6. 配置ArgoCD应用
kubectl apply -f argocd-application.yaml
```

**升级部署**:

```bash
# 1. 更新Helm Chart
helm upgrade automation ./helm/automation \
  -n automation \
  -f values-production.yaml

# 2. 监控升级过程
kubectl rollout status deployment/deployment-manager -n automation

# 3. 验证升级
kubectl get pods -n automation
```

**回滚部署**:

```bash
# 1. 查看历史版本
helm history automation -n automation

# 2. 回滚到指定版本
helm rollback automation <revision> -n automation

# 3. 验证回滚
kubectl get pods -n automation
```

---

## 10. 监控与运维

### 10.1 监控指标

**部署监控指标**:

```yaml
# 部署相关指标
- deployment_total: 部署总数
  labels: [environment, strategy, status]

- deployment_duration_seconds: 部署耗时
  labels: [environment, strategy]
  
- deployment_failed_total: 部署失败数
  labels: [environment, reason]

- deployment_rollback_total: 回滚次数
  labels: [environment, reason]

- deployment_active: 当前活跃部署数
  labels: [environment]
```

**配置监控指标**:

```yaml
# 配置相关指标
- config_items_total: 配置项总数
  labels: [environment]

- config_versions_total: 配置版本总数
  labels: [environment]

- config_update_total: 配置更新次数
  labels: [environment, key]

- config_sync_delay_seconds: 配置同步延迟
  labels: [environment, node]

- config_rollback_total: 配置回滚次数
  labels: [environment, key]
```

**健康检查监控指标**:

```yaml
# 健康检查相关指标
- health_check_total: 健康检查总数
  labels: [checker_name, type, status]

- health_check_duration_seconds: 健康检查耗时
  labels: [checker_name, type]

- health_check_failed_total: 健康检查失败数
  labels: [checker_name, type]

- health_status: 健康状态
  labels: [checker_name, type]
  values: [0=unhealthy, 1=healthy]

- self_healing_total: 自愈总数
  labels: [healer_name, strategy, result]

- self_healing_duration_seconds: 自愈耗时
  labels: [healer_name, strategy]

- circuit_breaker_state: 熔断器状态
  labels: [name]
  values: [0=closed, 1=open, 2=half_open]
```

**系统监控指标**:

```yaml
# 系统资源指标
- process_cpu_usage: CPU使用率
- process_memory_usage_bytes: 内存使用量
- process_open_fds: 打开的文件描述符数
- go_goroutines: Goroutine数量
- go_memstats_alloc_bytes: 内存分配量
```

### 10.2 告警规则（支持热更新）

**告警规则数据模型**:

```go
// 告警规则
type AlertRule struct {
    ID          string                 `json:"id" db:"id"`
    Name        string                 `json:"name" db:"name"`
    Group       string                 `json:"group" db:"group"`
    Expr        string                 `json:"expr" db:"expr"`
    For         string                 `json:"for" db:"for"`
    Severity    string                 `json:"severity" db:"severity"`
    Summary     string                 `json:"summary" db:"summary"`
    Description string                 `json:"description" db:"description"`
    Labels      map[string]string      `json:"labels" db:"labels"`
    Annotations map[string]string      `json:"annotations" db:"annotations"`
    Enabled     bool                   `json:"enabled" db:"enabled"`
    CreatedAt   time.Time              `json:"created_at" db:"created_at"`
    CreatedBy   string                 `json:"created_by" db:"created_by"`
    UpdatedAt   time.Time              `json:"updated_at" db:"updated_at"`
    UpdatedBy   string                 `json:"updated_by" db:"updated_by"`
}

// 告警规则管理器
type AlertRuleManager struct {
    rules          atomic.Value // 存储 map[string]*AlertRule
    redis          *redis.Client
    store          *AlertRuleStore
    prometheusAPI  *PrometheusAPI
    auditLogger    *AuditLogger
}
```

**告警规则热更新实现**:

```go
// 订阅告警规则变更
func (arm *AlertRuleManager) subscribeRuleChanges(ctx context.Context) {
    pubsub := arm.redis.Subscribe(ctx, "config:alert:rules:reload")
    defer pubsub.Close()
    
    for {
        select {
        case <-ctx.Done():
            return
        case msg := <-pubsub.Channel():
            log.Info("收到告警规则变更通知")
            
            // 从PostgreSQL加载新规则
            newRules, err := arm.store.LoadAllRules(ctx)
            if err != nil {
                log.Errorf("加载告警规则失败: %v", err)
                continue
            }
            
            // 验证规则
            if err := arm.validateRules(newRules); err != nil {
                log.Errorf("告警规则验证失败: %v", err)
                continue
            }
            
            // 原子更新规则
            rulesMap := make(map[string]*AlertRule)
            for _, rule := range newRules {
                if rule.Enabled {
                    rulesMap[rule.ID] = rule
                }
            }
            arm.rules.Store(rulesMap)
            
            // 更新Prometheus告警规则
            if err := arm.updatePrometheusRules(ctx, newRules); err != nil {
                log.Errorf("更新Prometheus告警规则失败: %v", err)
                continue
            }
            
            log.Info("告警规则已更新")
            
            // 记录审计日志
            arm.auditLogger.LogAlertRuleUpdate(newRules)
        }
    }
}

// 更新Prometheus告警规则
func (arm *AlertRuleManager) updatePrometheusRules(ctx context.Context, rules []*AlertRule) error {
    // 生成Prometheus规则文件
    ruleFile := arm.generatePrometheusRuleFile(rules)
    
    // 通过Prometheus API更新规则
    if err := arm.prometheusAPI.ReloadConfig(ctx); err != nil {
        return fmt.Errorf("重载Prometheus配置失败: %w", err)
    }
    
    return nil
}

// 生成Prometheus规则文件
func (arm *AlertRuleManager) generatePrometheusRuleFile(rules []*AlertRule) string {
    // 按组分组规则
    groups := make(map[string][]*AlertRule)
    for _, rule := range rules {
        if rule.Enabled {
            groups[rule.Group] = append(groups[rule.Group], rule)
        }
    }
    
    // 生成YAML格式
    var buf bytes.Buffer
    buf.WriteString("groups:\n")
    
    for groupName, groupRules := range groups {
        buf.WriteString(fmt.Sprintf("- name: %s\n", groupName))
        buf.WriteString("  rules:\n")
        
        for _, rule := range groupRules {
            buf.WriteString(fmt.Sprintf("  - alert: %s\n", rule.Name))
            buf.WriteString(fmt.Sprintf("    expr: %s\n", rule.Expr))
            buf.WriteString(fmt.Sprintf("    for: %s\n", rule.For))
            buf.WriteString("    labels:\n")
            buf.WriteString(fmt.Sprintf("      severity: %s\n", rule.Severity))
            for k, v := range rule.Labels {
                buf.WriteString(fmt.Sprintf("      %s: %s\n", k, v))
            }
            buf.WriteString("    annotations:\n")
            buf.WriteString(fmt.Sprintf("      summary: \"%s\"\n", rule.Summary))
            buf.WriteString(fmt.Sprintf("      description: \"%s\"\n", rule.Description))
            for k, v := range rule.Annotations {
                buf.WriteString(fmt.Sprintf("      %s: \"%s\"\n", k, v))
            }
        }
    }
    
    return buf.String()
}

// 创建告警规则
func (arm *AlertRuleManager) CreateRule(ctx context.Context, rule *AlertRule) error {
    // 验证规则
    if err := arm.validateRule(rule); err != nil {
        return fmt.Errorf("规则验证失败: %w", err)
    }
    
    // 保存到PostgreSQL
    if err := arm.store.CreateRule(ctx, rule); err != nil {
        return fmt.Errorf("保存规则失败: %w", err)
    }
    
    // 发布变更通知
    if err := arm.redis.Publish(ctx, "config:alert:rules:reload", "update").Err(); err != nil {
        log.Errorf("发布告警规则变更通知失败: %v", err)
    }
    
    // 记录审计日志
    arm.auditLogger.LogAlertRuleCreate(rule)
    
    return nil
}

// 更新告警规则
func (arm *AlertRuleManager) UpdateRule(ctx context.Context, rule *AlertRule) error {
    // 验证规则
    if err := arm.validateRule(rule); err != nil {
        return fmt.Errorf("规则验证失败: %w", err)
    }
    
    // 更新到PostgreSQL
    if err := arm.store.UpdateRule(ctx, rule); err != nil {
        return fmt.Errorf("更新规则失败: %w", err)
    }
    
    // 发布变更通知
    if err := arm.redis.Publish(ctx, "config:alert:rules:reload", "update").Err(); err != nil {
        log.Errorf("发布告警规则变更通知失败: %v", err)
    }
    
    // 记录审计日志
    arm.auditLogger.LogAlertRuleUpdate(rule)
    
    return nil
}

// 删除告警规则
func (arm *AlertRuleManager) DeleteRule(ctx context.Context, ruleID string) error {
    // 从PostgreSQL删除
    if err := arm.store.DeleteRule(ctx, ruleID); err != nil {
        return fmt.Errorf("删除规则失败: %w", err)
    }
    
    // 发布变更通知
    if err := arm.redis.Publish(ctx, "config:alert:rules:reload", "update").Err(); err != nil {
        log.Errorf("发布告警规则变更通知失败: %v", err)
    }
    
    // 记录审计日志
    arm.auditLogger.LogAlertRuleDelete(ruleID)
    
    return nil
}

// 验证告警规则
func (arm *AlertRuleManager) validateRule(rule *AlertRule) error {
    if rule.Name == "" {
        return fmt.Errorf("规则名称不能为空")
    }
    
    if rule.Expr == "" {
        return fmt.Errorf("规则表达式不能为空")
    }
    
    // 验证PromQL表达式语法
    if err := arm.validatePromQL(rule.Expr); err != nil {
        return fmt.Errorf("PromQL表达式无效: %w", err)
    }
    
    // 验证持续时间格式
    if rule.For != "" {
        if _, err := time.ParseDuration(rule.For); err != nil {
            return fmt.Errorf("持续时间格式无效: %w", err)
        }
    }
    
    // 验证严重级别
    validSeverities := []string{"critical", "warning", "info"}
    if !contains(validSeverities, rule.Severity) {
        return fmt.Errorf("无效的严重级别: %s", rule.Severity)
    }
    
    return nil
}
```

**数据库表设计**:

```sql
-- 告警规则表
CREATE TABLE alert_rules (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    group_name VARCHAR(64) NOT NULL,
    expr TEXT NOT NULL,
    for_duration VARCHAR(32),
    severity VARCHAR(32) NOT NULL,
    summary TEXT NOT NULL,
    description TEXT NOT NULL,
    labels JSONB,
    annotations JSONB,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL,
    created_by VARCHAR(64) NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    updated_by VARCHAR(64) NOT NULL
);

CREATE INDEX idx_alert_rules_group ON alert_rules(group_name);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);
CREATE INDEX idx_alert_rules_updated_at ON alert_rules(updated_at DESC);

-- 告警规则审计日志表
CREATE TABLE alert_rule_audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    rule_id VARCHAR(64) NOT NULL,
    action VARCHAR(32) NOT NULL, -- create, update, delete, enable, disable
    old_value JSONB,
    new_value JSONB,
    operator VARCHAR(64) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alert_rule_audit_logs_rule_id ON alert_rule_audit_logs(rule_id);
CREATE INDEX idx_alert_rule_audit_logs_timestamp ON alert_rule_audit_logs(timestamp DESC);
```

**内置告警规则（可自定义修改）**:

**部署告警**:

```json
[
  {
    "id": "alert-deploy-001",
    "name": "DeploymentFailed",
    "group": "deployment_alerts",
    "expr": "increase(deployment_failed_total[5m]) > 0",
    "for": "1m",
    "severity": "critical",
    "summary": "部署失败",
    "description": "环境 {{ $labels.environment }} 部署失败，原因: {{ $labels.reason }}",
    "enabled": true
  },
  {
    "id": "alert-deploy-002",
    "name": "DeploymentTooSlow",
    "group": "deployment_alerts",
    "expr": "deployment_duration_seconds > 600",
    "for": "1m",
    "severity": "warning",
    "summary": "部署耗时过长",
    "description": "环境 {{ $labels.environment }} 部署耗时超过10分钟",
    "enabled": true
  },
  {
    "id": "alert-deploy-003",
    "name": "FrequentRollback",
    "group": "deployment_alerts",
    "expr": "increase(deployment_rollback_total[1h]) > 3",
    "for": "5m",
    "severity": "warning",
    "summary": "频繁回滚",
    "description": "环境 {{ $labels.environment }} 1小时内回滚超过3次",
    "enabled": true
  }
]
```

**配置告警**:

```json
[
  {
    "id": "alert-config-001",
    "name": "ConfigSyncDelayHigh",
    "group": "config_alerts",
    "expr": "config_sync_delay_seconds > 10",
    "for": "1m",
    "severity": "warning",
    "summary": "配置同步延迟过高",
    "description": "节点 {{ $labels.node }} 配置同步延迟超过10秒",
    "enabled": true
  },
  {
    "id": "alert-config-002",
    "name": "FrequentConfigRollback",
    "group": "config_alerts",
    "expr": "increase(config_rollback_total[1h]) > 5",
    "for": "5m",
    "severity": "warning",
    "summary": "频繁配置回滚",
    "description": "配置项 {{ $labels.key }} 1小时内回滚超过5次",
    "enabled": true
  }
]
```

**健康检查告警**:

```json
[
  {
    "id": "alert-health-001",
    "name": "ServiceUnhealthy",
    "group": "health_alerts",
    "expr": "health_status == 0",
    "for": "1m",
    "severity": "critical",
    "summary": "服务不健康",
    "description": "检查器 {{ $labels.checker_name }} 检测到服务不健康",
    "enabled": true
  },
  {
    "id": "alert-health-002",
    "name": "HealthCheckFailed",
    "group": "health_alerts",
    "expr": "increase(health_check_failed_total[5m]) > 3",
    "for": "1m",
    "severity": "warning",
    "summary": "健康检查频繁失败",
    "description": "检查器 {{ $labels.checker_name }} 5分钟内失败超过3次",
    "enabled": true
  },
  {
    "id": "alert-health-003",
    "name": "SelfHealingFailed",
    "group": "health_alerts",
    "expr": "increase(self_healing_total{result=\"failed\"}[5m]) > 0",
    "for": "1m",
    "severity": "critical",
    "summary": "自愈失败",
    "description": "自愈器 {{ $labels.healer_name }} 执行失败，策略: {{ $labels.strategy }}",
    "enabled": true
  },
  {
    "id": "alert-health-004",
    "name": "CircuitBreakerOpen",
    "group": "health_alerts",
    "expr": "circuit_breaker_state == 1",
    "for": "1m",
    "severity": "warning",
    "summary": "熔断器打开",
    "description": "熔断器 {{ $labels.name }} 已打开，自愈功能暂停",
    "enabled": true
  }
]
```

**自定义告警规则API**:

```go
// API接口
// 创建告警规则
// POST /api/v1/alert/rules
func CreateAlertRule(c *gin.Context) {
    var rule AlertRule
    if err := c.ShouldBindJSON(&rule); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    rule.ID = generateID()
    rule.CreatedAt = time.Now()
    rule.CreatedBy = c.GetString("user")
    rule.UpdatedAt = time.Now()
    rule.UpdatedBy = c.GetString("user")
    
    if err := alertRuleManager.CreateRule(c.Request.Context(), &rule); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{"code": 0, "data": rule})
}

// 更新告警规则
// PUT /api/v1/alert/rules/:id
func UpdateAlertRule(c *gin.Context) {
    ruleID := c.Param("id")
    
    var rule AlertRule
    if err := c.ShouldBindJSON(&rule); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    rule.ID = ruleID
    rule.UpdatedAt = time.Now()
    rule.UpdatedBy = c.GetString("user")
    
    if err := alertRuleManager.UpdateRule(c.Request.Context(), &rule); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{"code": 0, "message": "ok"})
}

// 删除告警规则
// DELETE /api/v1/alert/rules/:id
func DeleteAlertRule(c *gin.Context) {
    ruleID := c.Param("id")
    
    if err := alertRuleManager.DeleteRule(c.Request.Context(), ruleID); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{"code": 0, "message": "ok"})
}

// 查询告警规则列表
// GET /api/v1/alert/rules
func ListAlertRules(c *gin.Context) {
    group := c.Query("group")
    enabled := c.Query("enabled")
    
    rules, err := alertRuleManager.ListRules(c.Request.Context(), group, enabled)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{"code": 0, "data": rules})
}

// 查询告警规则详情
// GET /api/v1/alert/rules/:id
func GetAlertRule(c *gin.Context) {
    ruleID := c.Param("id")
    
    rule, err := alertRuleManager.GetRule(c.Request.Context(), ruleID)
    if err != nil {
        c.JSON(404, gin.H{"error": "规则不存在"})
        return
    }
    
    c.JSON(200, gin.H{"code": 0, "data": rule})
}

// 启用/禁用告警规则
// POST /api/v1/alert/rules/:id/toggle
func ToggleAlertRule(c *gin.Context) {
    ruleID := c.Param("id")
    
    var req struct {
        Enabled bool `json:"enabled"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    if err := alertRuleManager.ToggleRule(c.Request.Context(), ruleID, req.Enabled); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{"code": 0, "message": "ok"})
}

// 测试告警规则
// POST /api/v1/alert/rules/test
func TestAlertRule(c *gin.Context) {
    var rule AlertRule
    if err := c.ShouldBindJSON(&rule); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    result, err := alertRuleManager.TestRule(c.Request.Context(), &rule)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{"code": 0, "data": result})
}
```

**告警规则热更新验收标准**:

1. ✅ 告警规则变更后30秒内生效（Prometheus重载配置）
2. ✅ 支持通过API创建、更新、删除自定义告警规则
3. ✅ 告警规则支持启用/禁用，无需删除
4. ✅ 支持测试告警规则，验证PromQL表达式正确性
5. ✅ 记录所有告警规则变更的审计日志
6. ✅ 告警规则验证失败时，保持原规则不变并记录错误
7. ✅ 支持按组、状态查询告警规则
8. ✅ 支持导出/导入告警规则配置

### 10.3 日志规范

**日志级别**:

- **DEBUG**: 详细的调试信息
- **INFO**: 一般信息，如操作开始、完成
- **WARN**: 警告信息，如配置验证失败、重试
- **ERROR**: 错误信息，如部署失败、自愈失败
- **FATAL**: 致命错误，导致服务停止

**日志格式**:

```json
{
  "timestamp": "2026-01-31T12:00:00Z",
  "level": "INFO",
  "module": "deployment",
  "message": "部署开始",
  "deployment_id": "deploy-001",
  "environment": "prod",
  "version": "v1.2.3",
  "operator": "admin",
  "trace_id": "abc123"
}
```

**日志内容规范**:

1. **部署日志**:
   - 部署开始、完成、失败
   - 每个组件的部署状态
   - 健康检查结果
   - 测试结果
   - 回滚操作

2. **配置日志**:
   - 配置变更（包含变更前后值）
   - 配置同步状态
   - 配置验证结果
   - 配置回滚操作

3. **健康检查日志**:
   - 检查结果（成功/失败）
   - 检查耗时
   - 失败原因
   - 自愈触发
   - 自愈结果

### 10.4 运维手册

**日常运维任务**:

1. **监控检查**:
   - 每日检查Grafana仪表盘
   - 查看告警通知
   - 检查服务健康状态
   - 查看资源使用情况

2. **配置管理**:
   - 定期审查配置变更
   - 清理过期配置版本
   - 备份重要配置
   - 验证配置加密

3. **部署管理**:
   - 审查部署历史
   - 清理失败的部署记录
   - 验证回滚机制
   - 更新部署策略

4. **健康检查**:
   - 审查健康检查配置
   - 调整检查频率
   - 验证自愈策略
   - 重置熔断器

**故障处理流程**:

1. **部署失败**:
   ```bash
   # 1. 查看部署日志
   kubectl logs -n automation deployment/deployment-manager
   
   # 2. 查看部署状态
   curl http://api/v1/deployment/status/{id}
   
   # 3. 手动回滚
   curl -X POST http://api/v1/deployment/rollback \
     -d '{"deployment_id":"xxx","version":"v1.2.2"}'
   
   # 4. 验证回滚结果
   kubectl get pods -n log-management
   ```

2. **配置同步失败**:
   ```bash
   # 1. 检查Redis连接
   redis-cli -h redis-host ping
   
   # 2. 检查PostgreSQL连接
   psql -h postgres-host -U automation -d automation
   
   # 3. 手动触发配置同步
   curl -X POST http://api/v1/config/reload
   
   # 4. 验证配置生效
   curl http://api/v1/config/get?key=xxx
   ```

3. **自愈失败**:
   ```bash
   # 1. 查看自愈日志
   kubectl logs -n automation deployment/health-monitor
   
   # 2. 检查熔断器状态
   curl http://api/v1/health/circuit-breaker
   
   # 3. 手动触发自愈
   curl -X POST http://api/v1/health/heal \
     -d '{"target":"api-server","strategy":"restart"}'
   
   # 4. 重置熔断器
   curl -X POST http://api/v1/health/circuit-breaker/reset
   ```

**应急预案**:

1. **PostgreSQL故障**:
   - 切换到备用数据库
   - 使用Redis缓存的配置
   - 限制配置变更操作
   - 恢复数据库服务

2. **Redis故障**:
   - 配置热更新暂停
   - 使用PostgreSQL直接读取
   - 重启Redis服务
   - 恢复Pub/Sub订阅

3. **ArgoCD故障**:
   - 切换到手动部署模式
   - 使用Helm直接部署
   - 恢复ArgoCD服务
   - 同步Git配置

4. **大规模服务故障**:
   - 触发全局熔断
   - 暂停自动部署
   - 启用降级模式
   - 人工介入处理

---

## 11. 配置热更新详细设计

### 11.1 配置分层说明

```
┌─────────────────────────────────────────────────────────────┐
│  基础设施层 (Kubernetes + Ansible + Terraform)              │
│  ❌ 不支持热更新，需要 kubectl apply + 滚动重启              │
│  - Kubernetes部署配置、Ansible Playbook、Terraform状态      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  连接层 (基础服务连接)                                       │
│  ⚠️ 不推荐热更新，建议通过YAML文件更新并重启服务             │
│  - PostgreSQL连接、Redis连接、Git仓库连接                   │
│  原因：需要重建连接池，可能导致运维操作中断                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  应用层 (业务配置)                                           │
│  ✅ 推荐热更新，通过Redis Pub/Sub立即生效                    │
│  - 部署策略、健康检查、自愈策略、告警规则                    │
└─────────────────────────────────────────────────────────────┘
```

### 11.2 可热更新配置项

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|----------|----------|---------------|
| **部署管理配置** |
| deployment_enabled | bool | true | 是否启用自动化部署 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| strategy | string | "rolling" | 默认部署策略 | Redis Pub/Sub | 下次部署 | ✅ 推荐 |
| timeout | int | 600 | 部署超时时间(秒) | Redis Pub/Sub | 下次部署 | ✅ 推荐 |
| health_check_delay | int | 30 | 健康检查延迟(秒) | Redis Pub/Sub | 下次部署 | ✅ 推荐 |
| auto_rollback | bool | true | 是否自动回滚 | Redis Pub/Sub | 下次部署 | ✅ 推荐 |
| pre_deploy_tests | array | [] | 部署前测试列表 | Redis Pub/Sub | 下次部署 | ✅ 推荐 |
| post_deploy_tests | array | [] | 部署后测试列表 | Redis Pub/Sub | 下次部署 | ✅ 推荐 |
| canary_traffic_steps | array | [10,50,100] | 金丝雀流量步骤(%) | Redis Pub/Sub | 下次金丝雀部署 | ✅ 推荐 |
| canary_monitor_duration | int | 300 | 金丝雀监控时长(秒) | Redis Pub/Sub | 下次金丝雀部署 | ✅ 推荐 |
| rollback_timeout | int | 300 | 回滚超时时间(秒) | Redis Pub/Sub | 下次回滚 | ✅ 推荐 |
| max_concurrent_deployments | int | 10 | 最大并发部署数 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| **配置管理配置** |
| config_enabled | bool | true | 是否启用配置管理 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| max_versions | int | 100 | 最大版本数 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| encryption_enabled | bool | true | 是否启用加密 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| hot_reload_enabled | bool | true | 是否启用热更新 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| validation_enabled | bool | true | 是否启用验证 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| export_formats | array | ["json","yaml","toml"] | 支持的导出格式 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| rollback_timeout | int | 30 | 回滚超时时间(秒) | Redis Pub/Sub | 下次回滚 | ✅ 推荐 |
| audit_retention_days | int | 365 | 审计日志保留天数 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| redis_channel_prefix | string | "config" | Redis频道前缀 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| sync_interval | int | 10 | 配置同步间隔(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| **健康检查配置** |
| health_check_enabled | bool | true | 是否启用健康检查 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| check_interval | int | 10 | 健康检查间隔(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| failure_threshold | int | 3 | 失败阈值(次) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| success_threshold | int | 1 | 成功阈值(次) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| timeout | int | 5 | 健康检查超时(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| circuit_breaker_enabled | bool | true | 是否启用熔断器 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| circuit_breaker_threshold | int | 5 | 熔断器阈值(次) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| circuit_breaker_timeout | int | 300 | 熔断器超时(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| alert_enabled | bool | true | 是否启用告警 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| self_healing_enabled | bool | true | 是否启用自愈 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| max_retries | int | 3 | 最大重试次数 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| heal_strategies | array | ["restart","scale"] | 启用的自愈策略 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| **连接配置(不推荐热更新)** |
| postgresql_host | string | "postgres" | PostgreSQL主机 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| postgresql_port | int | 5432 | PostgreSQL端口 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| redis_address | string | "redis:6379" | Redis地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| git_repository_url | string | "" | Git仓库地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| ansible_inventory_path | string | "" | Ansible清单路径 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |

**不推荐热更新的原因说明**:

1. **数据库连接配置**:
   - 需要重建数据库连接池
   - 可能导致正在进行的部署操作失败
   - 建议：通过YAML文件更新并滚动重启

2. **Redis连接配置**:
   - 需要重建Redis客户端连接
   - 可能导致配置分发中断
   - 建议：通过YAML文件更新并滚动重启

3. **Git仓库配置**:
   - 需要重新初始化Git客户端
   - 涉及认证信息变更
   - 建议：通过YAML文件更新并滚动重启

4. **Ansible配置**:
   - 需要重新加载Ansible清单
   - 可能影响正在进行的自动化任务
   - 建议：通过YAML文件更新并滚动重启

**备用更新方式**:
- 如果Redis不可用，支持通过YAML配置文件更新，需要重启服务
- 配置文件路径: `/etc/automation-manager/config.yaml`
- 重启命令: `kubectl rollout restart deployment/automation-service`

### 11.3 热更新实现

由于模块11包含多个子系统，这里提供核心实现框架。

**核心配置管理器**:

| 配置项 | 类型 | 默认值 | 说明 | 验证规则 |
|--------|------|--------|------|----------|
| deployment_enabled | bool | true | 是否启用自动化部署 | - |
| strategy | string | "rolling" | 默认部署策略 | rolling/blue_green/canary |
| timeout | int | 600 | 部署超时时间（秒） | >= 60 |
| health_check_delay | int | 30 | 健康检查延迟（秒） | >= 10 |
| auto_rollback | bool | true | 是否自动回滚 | - |
| pre_deploy_tests | array | [] | 部署前测试列表 | - |
| post_deploy_tests | array | [] | 部署后测试列表 | - |
| canary_traffic_steps | array | [10,50,100] | 金丝雀流量步骤（%） | 每项 1-100 |
| canary_monitor_duration | int | 300 | 金丝雀监控时长（秒） | >= 60 |
| rollback_timeout | int | 300 | 回滚超时时间（秒） | >= 60 |
| max_concurrent_deployments | int | 10 | 最大并发部署数 | >= 1 |

**热更新实现**:

```go
// 部署管理器配置热更新
type DeploymentManager struct {
    config atomic.Value // 存储 *DeploymentConfig
    redis  *redis.Client
}

// 订阅配置变更
func (dm *DeploymentManager) subscribeConfigChanges(ctx context.Context) {
    pubsub := dm.redis.Subscribe(ctx, "config:deployment:reload")
    defer pubsub.Close()
    
    for {
        select {
        case <-ctx.Done():
            return
        case msg := <-pubsub.Channel():
            log.Info("收到部署配置变更通知")
            
            // 从Redis加载新配置
            newConfig, err := dm.loadConfigFromRedis(ctx)
            if err != nil {
                log.Errorf("加载配置失败: %v", err)
                continue
            }
            
            // 验证配置
            if err := dm.validateConfig(newConfig); err != nil {
                log.Errorf("配置验证失败: %v", err)
                continue
            }
            
            // 原子更新配置
            dm.config.Store(newConfig)
            
            log.Info("部署配置已更新")
            
            // 记录审计日志
            dm.auditLogger.LogConfigUpdate("deployment", newConfig)
        }
    }
}

// 获取当前配置（无锁读取）
func (dm *DeploymentManager) GetConfig() *DeploymentConfig {
    return dm.config.Load().(*DeploymentConfig)
}

// 验证配置
func (dm *DeploymentManager) validateConfig(config *DeploymentConfig) error {
    if config.Timeout < 60 {
        return fmt.Errorf("timeout必须 >= 60秒")
    }
    
    if config.HealthCheckDelay < 10 {
        return fmt.Errorf("health_check_delay必须 >= 10秒")
    }
    
    validStrategies := []string{"rolling", "blue_green", "canary", "recreate"}
    if !contains(validStrategies, string(config.Strategy)) {
        return fmt.Errorf("无效的部署策略: %s", config.Strategy)
    }
    
    for _, step := range config.CanaryTrafficSteps {
        if step < 1 || step > 100 {
            return fmt.Errorf("金丝雀流量步骤必须在1-100之间")
        }
    }
    
    return nil
}
```

**热更新验收标准**:

1. ✅ 配置变更后立即应用新的部署策略（下次部署生效）
2. ✅ 测试列表变更时，下次部署时生效
3. ✅ 支持通过API查询当前生效的部署配置
4. ✅ 记录所有部署配置变更的审计日志
5. ✅ 超时时间变更时，验证配置合理性（>= 60秒）

### 11.3 热更新实现

由于模块11包含多个子系统，这里提供核心实现框架。

**核心配置管理器**:

```go
// AutomationConfigManager 自动化运维配置管理器
type AutomationConfigManager struct {
    // 使用atomic.Value实现无锁读取
    deploymentConfig atomic.Value  // *DeploymentConfig
    configMgrConfig  atomic.Value  // *ConfigManagerConfig
    healthConfig     atomic.Value  // *HealthCheckConfig
    
    db     *PostgreSQL
    redis  *Redis
    pubsub *redis.PubSub
    
    // 扩展接口
    configHooks  []ConfigHook  // 配置变更钩子
    validators   []ConfigValidator  // 配置验证器
}

// ConfigHook 配置变更钩子接口(扩展点)
type ConfigHook interface {
    OnConfigChange(configType string, oldConfig, newConfig interface{}) error
    Name() string
}

// ConfigValidator 配置验证器接口(扩展点)
type ConfigValidator interface {
    Validate(configType string, config interface{}) error
    Name() string
}
```

**配置结构定义**:

```go
// DeploymentConfig 部署配置
type DeploymentConfig struct {
    Enabled                  bool     `json:"enabled"`
    Strategy                 string   `json:"strategy"`
    Timeout                  int      `json:"timeout"`
    HealthCheckDelay         int      `json:"health_check_delay"`
    AutoRollback             bool     `json:"auto_rollback"`
    PreDeployTests           []string `json:"pre_deploy_tests"`
    PostDeployTests          []string `json:"post_deploy_tests"`
    CanaryTrafficSteps       []int    `json:"canary_traffic_steps"`
    CanaryMonitorDuration    int      `json:"canary_monitor_duration"`
    RollbackTimeout          int      `json:"rollback_timeout"`
    MaxConcurrentDeployments int      `json:"max_concurrent_deployments"`
    UpdatedAt                time.Time `json:"updated_at"`
}

// HealthCheckConfig 健康检查配置
type HealthCheckConfig struct {
    Enabled                bool     `json:"enabled"`
    CheckInterval          int      `json:"check_interval"`
    FailureThreshold       int      `json:"failure_threshold"`
    SuccessThreshold       int      `json:"success_threshold"`
    Timeout                int      `json:"timeout"`
    CircuitBreakerEnabled  bool     `json:"circuit_breaker_enabled"`
    CircuitBreakerThreshold int     `json:"circuit_breaker_threshold"`
    CircuitBreakerTimeout  int      `json:"circuit_breaker_timeout"`
    AlertEnabled           bool     `json:"alert_enabled"`
    SelfHealingEnabled     bool     `json:"self_healing_enabled"`
    MaxRetries             int      `json:"max_retries"`
    HealStrategies         []string `json:"heal_strategies"`
    UpdatedAt              time.Time `json:"updated_at"`
}
```

**配置热更新流程**:

```go
// Start 启动配置热更新监听
func (acm *AutomationConfigManager) Start(ctx context.Context) error {
    go acm.watchConfigChanges(ctx)
    log.Info("自动化运维配置热更新监听已启动")
    return nil
}

// watchConfigChanges 监听配置变更
func (acm *AutomationConfigManager) watchConfigChanges(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():
            return
        case msg := <-acm.pubsub.Channel():
            acm.handleConfigChange(msg)
        }
    }
}

// handleConfigChange 处理配置变更
func (acm *AutomationConfigManager) handleConfigChange(msg *redis.Message) {
    log.Infof("收到自动化运维配置变更通知: %s", msg.Payload)
    
    var change ConfigChange
    if err := json.Unmarshal([]byte(msg.Payload), &change); err != nil {
        log.Errorf("解析配置变更失败: %v", err)
        return
    }
    
    // 根据配置类型重新加载
    switch change.Type {
    case "deployment":
        acm.reloadDeploymentConfig()
    case "health":
        acm.reloadHealthConfig()
    case "config_manager":
        acm.reloadConfigManagerConfig()
    case "all":
        acm.reloadAllConfig()
    }
}

// reloadDeploymentConfig 重新加载部署配置
func (acm *AutomationConfigManager) reloadDeploymentConfig() {
    log.Info("开始重新加载部署配置")
    
    configJSON, err := acm.redis.Get("config:automation:deployment")
    if err != nil {
        log.Errorf("从Redis加载部署配置失败: %v", err)
        return
    }
    
    var newConfig DeploymentConfig
    if err := json.Unmarshal([]byte(configJSON), &newConfig); err != nil {
        log.Errorf("解析部署配置失败: %v", err)
        return
    }
    
    if err := acm.validateDeploymentConfig(&newConfig); err != nil {
        log.Errorf("部署配置验证失败: %v", err)
        return
    }
    
    oldConfig := acm.GetDeploymentConfig()
    
    for _, hook := range acm.configHooks {
        if err := hook.OnConfigChange("deployment", oldConfig, &newConfig); err != nil {
            log.Errorf("配置钩子执行失败: %s, error: %v", hook.Name(), err)
            return
        }
    }
    
    acm.deploymentConfig.Store(&newConfig)
    acm.logConfigChange("deployment", &newConfig)
    
    log.Info("部署配置重新加载完成")
}
```

**配置验证**:

```go
// validateDeploymentConfig 验证部署配置
func (acm *AutomationConfigManager) validateDeploymentConfig(config *DeploymentConfig) error {
    if config.Timeout < 60 {
        return fmt.Errorf("timeout必须 >= 60秒")
    }
    
    if config.HealthCheckDelay < 10 {
        return fmt.Errorf("health_check_delay必须 >= 10秒")
    }
    
    validStrategies := map[string]bool{"rolling": true, "blue_green": true, "canary": true, "recreate": true}
    if !validStrategies[config.Strategy] {
        return fmt.Errorf("无效的部署策略: %s", config.Strategy)
    }
    
    for _, step := range config.CanaryTrafficSteps {
        if step < 1 || step > 100 {
            return fmt.Errorf("金丝雀流量步骤必须在1-100之间")
        }
    }
    
    return nil
}

// validateHealthConfig 验证健康检查配置
func (acm *AutomationConfigManager) validateHealthConfig(config *HealthCheckConfig) error {
    if config.CheckInterval < 5 {
        return fmt.Errorf("check_interval必须 >= 5秒")
    }
    
    if config.Timeout >= config.CheckInterval {
        return fmt.Errorf("timeout必须小于check_interval")
    }
    
    if config.FailureThreshold < 1 {
        return fmt.Errorf("failure_threshold必须 >= 1")
    }
    
    return nil
}
```

**配置获取方法（无锁读取）**:

```go
func (acm *AutomationConfigManager) GetDeploymentConfig() *DeploymentConfig {
    if config := acm.deploymentConfig.Load(); config != nil {
        return config.(*DeploymentConfig)
    }
    return &DeploymentConfig{}
}

func (acm *AutomationConfigManager) GetHealthConfig() *HealthCheckConfig {
    if config := acm.healthConfig.Load(); config != nil {
        return config.(*HealthCheckConfig)
    }
    return &HealthCheckConfig{}
}
```

### 11.4 YAML配置文件备用方案

**配置文件结构** (`/etc/automation-manager/config.yaml`):

```yaml
# 自动化运维管理器配置文件
# 注意: 此配置文件仅在Redis不可用时使用，需要重启服务生效

# 部署管理配置 (✅ 支持热更新)
deployment:
  enabled: true
  strategy: "rolling"  # rolling/blue_green/canary/recreate
  timeout: 600  # 秒
  health_check_delay: 30
  auto_rollback: true
  pre_deploy_tests:
    - unit_tests
    - integration_tests
  post_deploy_tests:
    - smoke_tests
    - health_check
  canary_traffic_steps: [10, 50, 100]
  canary_monitor_duration: 300
  rollback_timeout: 300
  max_concurrent_deployments: 10

# 配置管理配置 (✅ 支持热更新)
config_manager:
  enabled: true
  max_versions: 100
  encryption_enabled: true
  hot_reload_enabled: true
  validation_enabled: true
  export_formats: [json, yaml, toml]
  rollback_timeout: 30
  audit_retention_days: 365
  redis_channel_prefix: "config"
  sync_interval: 10

# 健康检查配置 (✅ 支持热更新)
health_check:
  enabled: true
  check_interval: 10  # 秒
  failure_threshold: 3
  success_threshold: 1
  timeout: 5
  circuit_breaker_enabled: true
  circuit_breaker_threshold: 5
  circuit_breaker_timeout: 300
  alert_enabled: true
  self_healing_enabled: true
  max_retries: 3
  heal_strategies:
    - restart
    - scale
    - recreate

# PostgreSQL连接配置 (⚠️ 不推荐热更新)
postgresql:
  host: "postgres"
  port: 5432
  database: "logdb"
  username: "admin"
  password: "${POSTGRES_PASSWORD}"
  max_connections: 100

# Redis连接配置 (⚠️ 不推荐热更新)
redis:
  address: "redis:6379"
  password: "${REDIS_PASSWORD}"
  db: 0
  pool_size: 100

# Git仓库配置 (⚠️ 不推荐热更新)
git:
  repository_url: "https://github.com/example/configs.git"
  branch: "main"
  username: "${GIT_USERNAME}"
  token: "${GIT_TOKEN}"

# Ansible配置 (⚠️ 不推荐热更新)
ansible:
  inventory_path: "/etc/ansible/inventory"
  playbook_dir: "/etc/ansible/playbooks"
  vault_password_file: "/etc/ansible/vault_pass"
```

### 11.5 热更新验收标准

1. ✅ **配置变更后3秒内生效**: 通过Redis Pub/Sub实现，延迟< 1秒
2. ✅ **配置无效时保持原配置**: 验证失败时不更新atomic.Value
3. ✅ **支持API查询当前配置**: 提供GET /api/v1/automation/config接口
4. ✅ **记录配置变更审计日志**: 所有变更记录到audit_logs表
5. ✅ **部署策略变更立即生效**: 下次部署时使用新策略
6. ✅ **健康检查间隔变更立即生效**: 下次健康检查时使用新间隔
7. ✅ **自愈策略变更立即生效**: 下次自愈时使用新策略
8. ✅ **金丝雀流量步骤变更立即生效**: 下次金丝雀部署时使用新步骤
9. ✅ **熔断器配置变更立即生效**: 下次熔断判断时使用新配置
10. ✅ **支持扩展接口**: 提供ConfigHook和ConfigValidator扩展点



| 配置项 | 类型 | 默认值 | 说明 | 验证规则 |
|--------|------|--------|------|----------|
| config_enabled | bool | true | 是否启用配置管理 | - |
| max_versions | int | 100 | 最大版本数 | >= 10 |
| encryption_enabled | bool | true | 是否启用加密 | - |
| hot_reload_enabled | bool | true | 是否启用热更新 | - |
| validation_enabled | bool | true | 是否启用验证 | - |
| export_formats | array | ["json","yaml","toml"] | 支持的导出格式 | - |
| rollback_timeout | int | 30 | 回滚超时时间（秒） | >= 10 |
| audit_retention_days | int | 365 | 审计日志保留天数 | >= 30 |
| redis_channel_prefix | string | "config" | Redis频道前缀 | - |
| sync_interval | int | 10 | 配置同步间隔（秒） | >= 1 |

**热更新实现**:

```go
// 配置管理器配置热更新
type ConfigManager struct {
    config atomic.Value // 存储 *ManagerConfig
    redis  *redis.Client
}

// 订阅配置变更
func (cm *ConfigManager) subscribeConfigChanges(ctx context.Context) {
    pubsub := cm.redis.Subscribe(ctx, "config:manager:reload")
    defer pubsub.Close()
    
    for {
        select {
        case <-ctx.Done():
            return
        case msg := <-pubsub.Channel():
            log.Info("收到配置管理器配置变更通知")
            
            // 从Redis加载新配置
            newConfig, err := cm.loadConfigFromRedis(ctx)
            if err != nil {
                log.Errorf("加载配置失败: %v", err)
                continue
            }
            
            // 验证配置
            if err := cm.validateConfig(newConfig); err != nil {
                log.Errorf("配置验证失败: %v", err)
                continue
            }
            
            // 原子更新配置
            cm.config.Store(newConfig)
            
            log.Info("配置管理器配置已更新")
        }
    }
}
```

**热更新验收标准**:

1. ✅ 配置变更后10秒内通过Redis Pub/Sub分发到所有节点
2. ✅ 配置验证失败时，保持原配置不变并记录错误日志
3. ✅ 支持通过API查询当前生效的配置和版本号
4. ✅ 记录所有配置热更新的审计日志，包含生效时间和节点信息
5. ✅ 加密配置变更时，自动重新加密并分发到所有节点

### 11.3 健康检查配置热更新

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 | 验证规则 |
|--------|------|--------|------|----------|
| health_check_enabled | bool | true | 是否启用健康检查 | - |
| check_interval | int | 10 | 健康检查间隔（秒） | >= 5 |
| failure_threshold | int | 3 | 失败阈值（次） | >= 1 |
| success_threshold | int | 1 | 成功阈值（次） | >= 1 |
| timeout | int | 5 | 健康检查超时（秒） | >= 1 |
| circuit_breaker_enabled | bool | true | 是否启用熔断器 | - |
| circuit_breaker_threshold | int | 5 | 熔断器阈值（次） | >= 1 |
| circuit_breaker_timeout | int | 300 | 熔断器超时（秒） | >= 60 |
| alert_enabled | bool | true | 是否启用告警 | - |
| self_healing_enabled | bool | true | 是否启用自愈 | - |
| max_retries | int | 3 | 最大重试次数 | >= 1 |
| heal_strategies | array | ["restart","scale"] | 启用的自愈策略 | - |
| audit_retention_days | int | 90 | 审计日志保留天数 | >= 30 |

**热更新实现**:

```go
// 健康监控器配置热更新
type HealthMonitor struct {
    config atomic.Value // 存储 *MonitorConfig
    redis  *redis.Client
}

// 订阅配置变更
func (hm *HealthMonitor) subscribeConfigChanges(ctx context.Context) {
    pubsub := hm.redis.Subscribe(ctx, "config:health:reload")
    defer pubsub.Close()
    
    for {
        select {
        case <-ctx.Done():
            return
        case msg := <-pubsub.Channel():
            log.Info("收到健康检查配置变更通知")
            
            // 从Redis加载新配置
            newConfig, err := hm.loadConfigFromRedis(ctx)
            if err != nil {
                log.Errorf("加载配置失败: %v", err)
                continue
            }
            
            // 验证配置
            if err := hm.validateConfig(newConfig); err != nil {
                log.Errorf("配置验证失败: %v", err)
                continue
            }
            
            // 原子更新配置
            hm.config.Store(newConfig)
            
            // 更新检查器配置
            hm.updateCheckersConfig(newConfig)
            
            log.Info("健康检查配置已更新")
        }
    }
}

// 更新检查器配置
func (hm *HealthMonitor) updateCheckersConfig(config *MonitorConfig) {
    for _, checker := range hm.checkers {
        checker.Interval = time.Duration(config.CheckInterval) * time.Second
        checker.Timeout = time.Duration(config.Timeout) * time.Second
    }
}
```

**热更新验收标准**:

1. ✅ 配置变更后立即应用新的健康检查间隔和阈值
2. ✅ 自愈策略变更时，下次自愈时生效
3. ✅ 支持通过API查询当前生效的健康检查配置
4. ✅ 记录所有健康检查配置变更的审计日志
5. ✅ 熔断器配置变更时，验证配置合理性（阈值 >= 1）

### 11.4 配置热更新流程图

```
┌─────────────────────────────────────────────────────────────┐
│                    配置热更新流程                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 用户修改配置                                            │
│     │                                                       │
│     ▼                                                       │
│  2. API接收请求                                             │
│     │                                                       │
│     ▼                                                       │
│  3. 配置验证                                                │
│     │                                                       │
│     ├─验证失败─→ 返回错误，保持原配置                       │
│     │                                                       │
│     ▼                                                       │
│  4. 保存到PostgreSQL（版本化）                              │
│     │                                                       │
│     ▼                                                       │
│  5. 发布到Redis Pub/Sub                                     │
│     │                                                       │
│     ▼                                                       │
│  6. 所有节点订阅并接收                                      │
│     │                                                       │
│     ▼                                                       │
│  7. 节点验证配置                                            │
│     │                                                       │
│     ├─验证失败─→ 记录错误日志，保持原配置                   │
│     │                                                       │
│     ▼                                                       │
│  8. atomic.Value原子更新                                    │
│     │                                                       │
│     ▼                                                       │
│  9. 配置生效（< 10秒）                                      │
│     │                                                       │
│     ▼                                                       │
│  10. 记录审计日志                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 部署失败导致服务中断 | 中 | 高 | 自动回滚、蓝绿部署、金丝雀发布 |
| 配置错误导致服务异常 | 中 | 高 | 配置验证、版本控制、快速回滚 |
| 健康检查误判触发不必要的自愈 | 低 | 中 | 连续3次失败才触发、熔断器保护 |
| 自愈操作失败导致服务恶化 | 低 | 高 | 重试机制、熔断器、人工介入 |
| PostgreSQL故障导致配置不可用 | 低 | 高 | Redis缓存、主从复制、自动故障转移 |
| Redis故障导致配置无法热更新 | 低 | 中 | 自动重连、降级到手动更新 |
| ArgoCD故障导致无法自动部署 | 低 | 中 | 切换到Helm手动部署 |
| 网络分区导致配置不一致 | 低 | 中 | 配置版本号校验、定期同步 |
| 并发部署导致资源竞争 | 中 | 中 | 部署队列、并发数限制 |
| 配置加密密钥泄露 | 低 | 高 | 密钥轮换、访问控制、审计日志 |

### 12.2 回滚方案

**部署回滚**:

```go
// 部署回滚流程
func (dm *DeploymentManager) Rollback(ctx context.Context, deploymentID string) error {
    log.Infof("开始回滚部署: %s", deploymentID)
    
    // 1. 获取部署记录
    deployment, err := dm.store.GetDeployment(ctx, deploymentID)
    if err != nil {
        return fmt.Errorf("获取部署记录失败: %w", err)
    }
    
    // 2. 获取上一个稳定版本
    lastStable, err := dm.historyStore.GetLastStable(ctx, deployment.Environment)
    if err != nil {
        return fmt.Errorf("获取上一个稳定版本失败: %w", err)
    }
    
    // 3. 创建回滚请求
    rollbackReq := &DeploymentRequest{
        ID:          generateID(),
        Version:     lastStable.Version,
        Strategy:    StrategyRolling, // 回滚使用滚动升级
        Environment: deployment.Environment,
        Components:  deployment.Components,
        Config:      lastStable.Config,
    }
    
    // 4. 执行回滚部署
    resp, err := dm.Deploy(ctx, rollbackReq)
    if err != nil {
        return fmt.Errorf("回滚部署失败: %w", err)
    }
    
    // 5. 记录回滚历史
    dm.historyStore.RecordRollback(ctx, deploymentID, rollbackReq.ID)
    
    log.Infof("回滚部署完成: %s -> %s", deployment.Version, lastStable.Version)
    return nil
}
```

**回滚时间要求**:

- 部署回滚: < 5分钟
- 配置回滚: < 30秒
- 健康检查配置回滚: 立即生效

**回滚验证**:

1. 回滚后自动执行健康检查
2. 回滚后自动执行冒烟测试
3. 验证服务可用性
4. 验证关键功能正常

**配置回滚**:

```go
// 配置回滚流程
func (cm *ConfigManager) Rollback(ctx context.Context, environment string, version int) error {
    log.Infof("开始回滚配置: env=%s, version=%d", environment, version)
    
    startTime := time.Now()
    
    // 1. 获取目标版本
    targetVersion, err := cm.versionControl.GetVersion(version)
    if err != nil {
        return fmt.Errorf("获取版本失败: %w", err)
    }
    
    // 2. 验证目标版本
    if err := cm.validateVersion(targetVersion); err != nil {
        return fmt.Errorf("版本验证失败: %w", err)
    }
    
    // 3. 应用配置变更
    for _, change := range targetVersion.Changes {
        item := &ConfigItem{
            Key:         change.Key,
            Value:       change.NewValue,
            Environment: environment,
            UpdatedBy:   "system",
            UpdatedAt:   time.Now(),
        }
        
        switch change.Type {
        case ChangeTypeAdd, ChangeTypeUpdate:
            if err := cm.Set(ctx, item); err != nil {
                log.Errorf("回滚配置失败: key=%s, err=%v", change.Key, err)
            }
        case ChangeTypeDelete:
            if err := cm.Delete(ctx, change.Key, environment); err != nil {
                log.Errorf("删除配置失败: key=%s, err=%v", change.Key, err)
            }
        }
    }
    
    duration := time.Since(startTime)
    
    // 4. 验证回滚结果
    if duration > 30*time.Second {
        log.Warnf("配置回滚耗时超过30秒: %v", duration)
    }
    
    log.Infof("配置回滚完成: env=%s, version=%d, duration=%v", environment, version, duration)
    return nil
}
```

### 12.3 应急预案

**场景1: 部署失败导致服务不可用**:

1. **检测**: 健康检查连续失败、告警触发
2. **响应**: 
   - 自动回滚到上一个稳定版本
   - 如果自动回滚失败，手动执行回滚
   - 通知运维团队
3. **恢复**: 
   - 验证服务恢复正常
   - 分析失败原因
   - 修复问题后重新部署
4. **预防**: 
   - 加强部署前测试
   - 使用金丝雀发布降低风险
   - 完善健康检查

**场景2: 配置错误导致服务异常**:

1. **检测**: 服务异常、错误日志增加、告警触发
2. **响应**:
   - 立即回滚到上一个稳定配置版本
   - 如果无法确定问题配置，逐个回滚最近的配置变更
   - 通知相关人员
3. **恢复**:
   - 验证服务恢复正常
   - 分析配置错误原因
   - 修复配置后重新应用
4. **预防**:
   - 加强配置验证规则
   - 生产环境配置变更需要审批
   - 配置变更前在测试环境验证

**场景3: 数据库故障**:

1. **PostgreSQL故障**:
   - 自动切换到从库
   - 使用Redis缓存的配置
   - 限制配置变更操作
   - 恢复主库服务
   - 数据同步验证

2. **Redis故障**:
   - 配置热更新暂停
   - 使用PostgreSQL直接读取配置
   - 重启Redis服务
   - 恢复Pub/Sub订阅
   - 验证配置同步

**场景4: 自愈失败导致服务持续不可用**:

1. **检测**: 自愈操作连续失败、熔断器打开
2. **响应**:
   - 停止自动自愈
   - 发送紧急告警
   - 人工介入处理
3. **恢复**:
   - 手动诊断问题
   - 执行人工修复
   - 验证服务恢复
   - 重置熔断器
4. **预防**:
   - 完善自愈策略
   - 增加自愈前的检查
   - 定期演练应急流程

**场景5: 大规模服务故障**:

1. **检测**: 多个服务同时不健康、大量告警
2. **响应**:
   - 触发全局熔断，停止自动操作
   - 暂停所有自动部署
   - 启用降级模式
   - 召集应急团队
3. **恢复**:
   - 分析故障范围和原因
   - 制定恢复计划
   - 分批恢复服务
   - 验证系统稳定
4. **预防**:
   - 定期进行故障演练
   - 完善监控和告警
   - 建立应急响应流程

### 12.4 回滚测试

**定期回滚演练**:

1. **每月演练**: 在测试环境进行部署回滚演练
2. **季度演练**: 在预生产环境进行配置回滚演练
3. **年度演练**: 进行全系统故障恢复演练

**回滚测试清单**:

- [ ] 部署回滚功能正常
- [ ] 配置回滚功能正常
- [ ] 自动回滚触发条件正确
- [ ] 回滚时间满足要求
- [ ] 回滚后服务正常
- [ ] 回滚审计日志完整
- [ ] 告警通知及时
- [ ] 应急预案有效

---

## 13. 附录

### 13.1 术语表

| 术语 | 说明 |
|------|------|
| GitOps | 使用Git作为单一事实来源的运维模式，通过Git管理基础设施和应用配置 |
| Helm | Kubernetes的包管理工具，用于定义、安装和升级Kubernetes应用 |
| ArgoCD | 声明式GitOps持续交付工具，自动同步Git仓库中的配置到Kubernetes集群 |
| 滚动升级 | 逐步替换旧版本Pod的部署策略，保证服务持续可用 |
| 蓝绿部署 | 同时运行两个版本的环境，通过切换流量实现零停机部署 |
| 金丝雀发布 | 逐步增加新版本流量的部署策略，降低发布风险 |
| 配置热更新 | 在不重启服务的情况下更新配置并使其生效 |
| 存活性检查 | Liveness Probe，检查容器是否存活，失败时重启容器 |
| 就绪性检查 | Readiness Probe，检查容器是否就绪，失败时停止流量 |
| 启动探针 | Startup Probe，检查容器是否启动完成，用于慢启动容器 |
| 自愈 | 系统自动检测故障并执行修复操作的能力 |
| 熔断器 | Circuit Breaker，防止故障扩散的保护机制 |
| HPA | Horizontal Pod Autoscaler，水平Pod自动扩缩容 |
| PDB | Pod Disruption Budget，Pod中断预算，保证最小可用副本数 |
| StatefulSet | Kubernetes有状态应用控制器，用于部署有状态服务 |
| ConfigMap | Kubernetes配置管理对象，存储非敏感配置 |
| Secret | Kubernetes密钥管理对象，存储敏感配置 |
| Pub/Sub | 发布/订阅消息模式，用于配置变更通知 |
| atomic.Value | Go语言的原子值类型，支持无锁并发读写 |
| RBAC | Role-Based Access Control，基于角色的访问控制 |
| mTLS | Mutual TLS，双向TLS认证 |
| AES-256-GCM | 高级加密标准，256位密钥，GCM模式 |

### 13.2 参考文档

**官方文档**:

- [Kubernetes官方文档](https://kubernetes.io/docs/)
- [Helm官方文档](https://helm.sh/docs/)
- [ArgoCD官方文档](https://argo-cd.readthedocs.io/)
- [Terraform官方文档](https://www.terraform.io/docs/)
- [Ansible官方文档](https://docs.ansible.com/)
- [Prometheus官方文档](https://prometheus.io/docs/)
- [PostgreSQL官方文档](https://www.postgresql.org/docs/)
- [Redis官方文档](https://redis.io/documentation)

**最佳实践**:

- [GitOps最佳实践](https://www.gitops.tech/)
- [Kubernetes部署最佳实践](https://kubernetes.io/docs/concepts/cluster-administration/manage-deployment/)
- [配置管理最佳实践](https://12factor.net/config)
- [健康检查最佳实践](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)

**相关项目**:

- [Flux CD](https://fluxcd.io/) - 另一个GitOps工具
- [Kustomize](https://kustomize.io/) - Kubernetes配置管理工具
- [Consul](https://www.consul.io/) - 服务网格和配置中心
- [Vault](https://www.vaultproject.io/) - 密钥管理工具

### 13.3 配置示例

**Helm values.yaml完整示例**:

```yaml
# 全局配置
global:
  imageRegistry: registry.example.com
  imagePullSecrets:
    - name: registry-secret
  storageClass: ssd

# 部署管理器
deploymentManager:
  enabled: true
  replicaCount: 3
  image:
    repository: log-management/deployment-manager
    tag: v1.0.0
    pullPolicy: IfNotPresent
  
  resources:
    requests:
      cpu: 1000m
      memory: 2Gi
    limits:
      cpu: 2000m
      memory: 4Gi
  
  config:
    enabled: true
    strategy: rolling
    timeout: 600
    healthCheckDelay: 30
    autoRollback: true
    preDeployTests: []
    postDeployTests: []
    canaryTrafficSteps: [10, 50, 100]
    canaryMonitorDuration: 300
    rollbackTimeout: 300
    maxConcurrentDeployments: 10
  
  service:
    type: ClusterIP
    port: 8080
  
  ingress:
    enabled: true
    className: nginx
    hosts:
      - host: deployment.example.com
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: deployment-tls
        hosts:
          - deployment.example.com

# 配置管理器
configManager:
  enabled: true
  replicaCount: 3
  image:
    repository: log-management/config-manager
    tag: v1.0.0
  
  resources:
    requests:
      cpu: 1000m
      memory: 2Gi
    limits:
      cpu: 2000m
      memory: 4Gi
  
  config:
    enabled: true
    maxVersions: 100
    encryptionEnabled: true
    encryptionKey: <base64-encoded-key>
    hotReloadEnabled: true
    validationEnabled: true
    exportFormats: ["json", "yaml", "toml"]
    rollbackTimeout: 30
    auditRetentionDays: 365
    redisChannelPrefix: config
    syncInterval: 10
  
  service:
    type: ClusterIP
    port: 8081

# 健康监控器
healthMonitor:
  enabled: true
  replicaCount: 2
  image:
    repository: log-management/health-monitor
    tag: v1.0.0
  
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 1000m
      memory: 2Gi
  
  config:
    enabled: true
    checkInterval: 10
    failureThreshold: 3
    successThreshold: 1
    timeout: 5
    circuitBreakerEnabled: true
    circuitBreakerThreshold: 5
    circuitBreakerTimeout: 300
    alertEnabled: true
    selfHealingEnabled: true
    maxRetries: 3
    healStrategies: ["restart", "scale", "clear_cache", "switch_traffic", "degrade"]
    auditRetentionDays: 90
  
  service:
    type: ClusterIP
    port: 8082

# PostgreSQL
postgresql:
  enabled: true
  auth:
    username: automation
    password: <secret>
    database: automation
  
  primary:
    resources:
      requests:
        cpu: 2000m
        memory: 4Gi
      limits:
        cpu: 4000m
        memory: 8Gi
    
    persistence:
      enabled: true
      size: 100Gi
      storageClass: ssd
    
    initdb:
      scripts:
        init.sql: |
          -- 初始化脚本
          CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

# Redis
redis:
  enabled: true
  auth:
    enabled: true
    password: <secret>
  
  master:
    resources:
      requests:
        cpu: 1000m
        memory: 2Gi
      limits:
        cpu: 2000m
        memory: 4Gi
    
    persistence:
      enabled: true
      size: 10Gi
  
  replica:
    replicaCount: 2
    resources:
      requests:
        cpu: 500m
        memory: 1Gi
      limits:
        cpu: 1000m
        memory: 2Gi

# Prometheus监控
prometheus:
  enabled: true
  serviceMonitor:
    enabled: true
    interval: 30s

# Grafana仪表盘
grafana:
  enabled: true
  dashboards:
    enabled: true
```

### 13.4 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-01-31 | v1.0 | 初稿，完整设计方案 | 系统架构团队 |

---

**文档结束**

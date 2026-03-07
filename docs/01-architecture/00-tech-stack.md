# NexusLog 技术栈总览

## 1. 概述

NexusLog 是基于业务域 + 平台域分层的 Monorepo 全栈日志管理系统。本文档汇总项目所有技术组件的版本、职责、变更级别和配置策略。

## 2. 技术栈全景

| 层级 | 技术选型 | 版本 | 变更级别 | 配置策略 | 推荐生效时间 |
|------|----------|------|----------|----------|-------------|
| 入口层 / API 网关 | OpenResty (Nginx+Lua) | 1.25+ | `cab` | 热更新优先；核心参数滚动 | 分钟级 |
| 身份认证 | Keycloak | 24+ | `cab` | Realm/策略热更；SPI 重启 | 分钟级 |
| 策略控制 | OPA | 0.6x+ | `cab` | Policy Bundle 热更新 | 秒级 |
| 采集层 | Go Agent + 插件 | Go 1.22+ | `normal` | 规则热更；插件升级重启 | 分钟级 |
| 消息传输层 | Kafka | 3.7+ | `cab` | 动态配置 + 核心参数重启 | 发布窗口 |
| 消息治理 | Schema Registry | 2.5+ / 7.x+ | `cab` | Schema/兼容策略热更 | 分钟级 |
| 实时计算层 | Flink (SQL+CEP) | 1.19+ | `cab` | 参数热更；作业 Savepoint 发布 | 发布窗口 |
| 检索存储 | Elasticsearch | 8.13+ | `cab` | ILM 热更；节点参数重启 | 发布窗口 |
| 冷存储 | MinIO / S3 | 稳定版 | `normal` | 生命周期策略热更 | 分钟级 |
| 元数据 DB | PostgreSQL | 16+ | `cab` | 业务配置热生效；核心参数重启 | 发布窗口 |
| PG 高可用 | Patroni + etcd | 稳定版 | `cab` | 拓扑变更维护窗口 | 发布窗口 |
| 连接池 | PgBouncer | 1.2x+ | `normal` | reload 优先 | 分钟级 |
| 缓存层 | Redis Cluster | 7.2+ | `cab` | TTL 热更；拓扑变更重启 | 分钟级 |
| 控制面服务 | Go (Gin) + gRPC | Go 1.22+ | `normal` | 参数热更；镜像滚动 | 分钟级 |
| 健康检测层 | Go health-worker | Go 1.22+ | `none` | 目标/阈值热更 | 分钟级 |
| API 层 | Go (Gin) | Go 1.22+ | `normal` | 开关热更；版本滚动 | 分钟级 |
| Node.js 层（可选） | NestJS (BFF) | Node 20 LTS | `normal` | 配置热更；升级重启 | 分钟级 |
| 前端层 | React + TypeScript + Ant Design | React 19 / TS 5.x | `normal` | 远程配置热更；其余发版 | 发布窗口 |
| 可视化 | ECharts | 5.x | `none` | 图表配置热更 | 秒级 |
| 前端状态管理 | Zustand | 4.x | `none` | 运行时热更新 | 秒级 |
| 密钥管理 | Vault | 1.15+ | `cab` | Secret 热更；后端变更重启 | 分钟级 |
| 容器编排 | Kubernetes | 1.28+ | `cab` | 声明式变更 + 滚动 | 发布窗口 |
| 包管理 | Helm | 3.13+ | `normal` | YAML 主通道 | 发布窗口 |
| GitOps | Argo CD | 2.1x+ | `normal` | Git 为准，防配置漂移 | 发布窗口 |
| 指标监控 | Prometheus | 2.48+ | `none` | 规则/目标 reload | 分钟级 |
| 告警中心 | Alertmanager | 0.27+ | `none` | 配置热重载 | 秒级 |
| 可视化监控 | Grafana | 10.2+ | `none` | Dashboard/规则热更 | 秒级 |
| 链路追踪 | Jaeger + OTel Collector | Jaeger 1.50+ / OTel 0.9x+ | `normal` | 采样热更；结构变更滚动 | 分钟级 |
| 日志聚合 | Loki | 稳定版 | `none` | 配置热重载 | 分钟级 |
| CI/CD | GitHub Actions | - | `normal` | Pipeline 即代码 | 分钟级 |
| 制品仓库 | Harbor | 2.10+ | `normal` | 策略热更 | 分钟级 |
| 安全扫描 | Trivy + SAST | 稳定版 | `none` | 规则库热更 | 分钟级 |
| 镜像签名 | Cosign | 稳定版 | `normal` | 策略更新 | 分钟级 |
| 服务网格 | Istio | 稳定版 | `cab` | VirtualService/DestinationRule 热更 | 分钟级 |
| ML（可选） | Python + sklearn + PyTorch + ONNX + MLflow | Py 3.11+ | `normal` | 模型热切换；服务滚动 | 分钟级 |
| NLP（可选） | LLM API + 规则引擎 | - | `normal` | Prompt/规则热更 | 秒级 |
| 向量检索（可选） | pgvector | 0.6+ | `cab` | 索引分阶段；扩展升级窗口 | 发布窗口 |
| 边缘计算（可选） | MQTT 5.0 + SQLite / BoltDB | - | `normal` | 规则热更；分批升级 | 分钟级 |

## 3. 分层架构说明

### 3.1 入口层（gateway/）

OpenResty 作为统一 API 网关，负责流量路由、认证校验（JWT/OIDC）、限流和日志记录。Lua 脚本实现灵活的请求处理逻辑。

### 3.2 IAM 安全层（iam/）

- Keycloak：身份认证与单点登录（SSO），管理用户、角色、客户端
- OPA：基于 Rego 策略的细粒度授权控制（RBAC/ABAC）
- Vault：密钥、证书、敏感配置的安全存储与分发

### 3.3 应用层（apps/）

- frontend-console：React 19 + TypeScript + Ant Design 5.x + ECharts 5.x + Zustand 4.x，pnpm 管理依赖
- bff-service（可选）：NestJS BFF 层，聚合后端接口

### 3.4 微服务层（services/）

- control-plane：控制面服务，Go Gin + gRPC，负责系统配置和编排
- health-worker：健康检测服务，定期探测各组件状态
- data-services：数据服务集合（query-api、audit-api、export-api）
- api-service：对外 API 服务，Go Gin 实现

### 3.5 采集层（agents/）

Go 实现的日志采集代理，支持 gRPC 和 WASM 插件扩展，负责日志采集、预处理和转发。

### 3.6 消息层（messaging/）

- Kafka：高吞吐消息传输，支持日志流的可靠投递
- Schema Registry：消息契约管理，确保 Schema 兼容性
- DLQ + Retry：死信队列和重试机制，保障消息不丢失

### 3.7 流计算层（stream/）

Flink SQL + CEP 实现实时日志聚合、异常检测和告警触发。

### 3.8 存储层（storage/）

- Elasticsearch：日志检索和全文搜索
- PostgreSQL + Patroni：元数据存储，高可用集群
- Redis Cluster：缓存和会话管理
- MinIO / S3：日志冷存储和备份
- Glacier：归档存储策略

### 3.9 可观测性（observability/）

- Prometheus + Alertmanager：指标采集和告警
- Grafana：可视化监控面板
- Jaeger + OTel Collector：分布式链路追踪
- Loki：日志聚合查询

### 3.10 平台治理（platform/）

- Kubernetes：容器编排和服务调度
- Helm：应用包管理和版本化部署
- Argo CD：GitOps 持续交付
- Istio：服务网格，流量管理和安全通信
- CI/CD：GitHub Actions 自动化流水线
- 安全扫描：Trivy 镜像扫描 + SAST 静态分析 + Cosign 镜像签名

### 3.11 基础设施即代码（infra/）

- Terraform：云资源声明式管理（网络、K8s 集群、存储、可观测性）
- Ansible：服务器配置管理和应用部署自动化

### 3.12 可选域

- ML：机器学习模型训练、推理和管理（MLflow）
- NLP：LLM API 集成和规则引擎
- Edge：边缘计算（MQTT + 本地存储）

## 4. 前端技术栈详情

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | React | 19.x | UI 框架 |
| 语言 | TypeScript | 5.x | 类型安全 |
| UI 组件库 | Ant Design | 5.x | 企业级 UI 组件 |
| 图表库 | ECharts | 5.x | 数据可视化 |
| 状态管理 | Zustand | 4.x | 全局状态管理 |
| 路由 | react-router-dom | 6.x | 客户端路由（HashRouter） |
| 构建工具 | Vite | 6.x | 开发服务器和生产构建 |
| 包管理 | pnpm | 最新稳定版 | 依赖管理 |
| 单元测试 | Vitest | 最新稳定版 | 单元测试框架 |
| 属性测试 | fast-check | 最新稳定版 | 属性测试库 |

## 5. 后端技术栈详情

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 语言 | Go | 1.22+ | 微服务开发 |
| HTTP 框架 | Gin | 最新稳定版 | REST API |
| RPC 框架 | gRPC | 最新稳定版 | 服务间通信 |
| 多模块管理 | go.work | Go 1.22+ | Monorepo 多模块工作区 |

## 6. 契约定义（contracts/）

| 格式 | 用途 |
|------|------|
| Avro | Kafka 消息序列化（log-raw、log-parsed、alert-event） |
| Protobuf | gRPC 服务间通信（log、alert） |
| JSON Schema | REST API 请求/响应校验（log-raw、alert-event） |

所有 Schema 变更必须通过 CI 兼容性校验，不兼容变更触发 CAB 审批。

## 7. 变更管理

所有组件配置变更遵循三级审批体系（`none` / `normal` / `cab`），详见 [变更管理规范](./change-management.md)。

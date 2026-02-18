# 需求文档：NexusLog 项目总体规划

## 简介

NexusLog 是一个基于 Monorepo 架构的企业级全栈日志管理系统。本文档定义项目总体规划的需求，按 MVP（最小可行产品）、P1（生产就绪）、P2（增强功能）三个阶段分期交付。

项目采用业务域+平台域分层架构，涵盖前端控制台、Go 微服务集群、API 网关、IAM 安全体系、消息传输、流计算、多级存储、可观测性、平台治理等完整域。所有组件配置变更遵循三级审批体系（none/normal/cab）。

## 阶段划分与依赖关系

### MVP（最小可行产品）
目标：搭建 Monorepo 骨架，完成前端迁移，建立后端微服务骨架，实现基础部署和 CI/CD。
交付物：可运行的前端控制台 + 后端服务骨架 + 本地开发环境 + 基础 CI 流水线 + 基础文档体系。

### P1（生产就绪）
前置依赖：MVP 阶段全部完成。
目标：补齐生产环境所需的安全、存储、消息、可观测性、变更管理等基础设施，实现完整的 GitOps 发布流程。
交付物：完整的 API 网关 + IAM 安全体系 + 日志采集代理 + 消息传输 + 存储层 + 可观测性 + 变更管理规范 + 完整测试体系 + 基础设施即代码 + GitOps 配置。

### P2（增强功能）
前置依赖：P1 阶段核心组件（存储层、消息传输、可观测性）完成。
目标：引入机器学习、边缘计算、服务网格等高级能力，完善性能测试和安全扫描。
交付物：ML/NLP 集成 + 边缘计算支持 + Istio 服务网格 + 性能/混沌测试 + 高级安全扫描 + 完善文档体系。

## 关联 Spec

| Spec 名称 | 路径 | 说明 |
|-----------|------|------|
| 前端迁移与 Monorepo 搭建 | `.kiro/specs/frontend-migration/` | 前端控制台迁移的详细需求、设计和任务，覆盖本文档需求 1-7 的具体实现 |

## 术语表

- **NexusLog**: 目标全栈日志管理系统，基于 Monorepo 架构
- **Source_Project**: 源项目 `logscale-pro-recreated`，基于 React 19 + Tailwind CSS + Recharts 的前端日志管理系统
- **Frontend_Console**: 前端控制台，位于 `apps/frontend-console/`，React 19 + TypeScript + Ant Design + ECharts + Zustand
- **Control_Plane**: 控制面服务，位于 `services/control-plane/`，Go Gin + gRPC
- **Health_Worker**: 健康检测服务，位于 `services/health-worker/`，Go 实现
- **Data_Services**: 数据服务集合，位于 `services/data-services/`，包含 query-api、audit-api、export-api
- **API_Service**: API 服务，位于 `services/api-service/`，Go Gin 实现
- **BFF_Service**: 可选的 BFF 层，位于 `apps/bff-service/`，NestJS 实现
- **Gateway**: API 网关，位于 `gateway/openresty/`，基于 OpenResty（Nginx+Lua）
- **IAM**: 身份认证与授权域，位于 `iam/`，包含 Keycloak、OPA、Vault
- **Collector_Agent**: 日志采集代理，位于 `agents/collector-agent/`，Go 实现
- **Stream_Engine**: 流计算引擎，基于 Flink SQL+CEP
- **Observability_Stack**: 可观测性技术栈，包含 Prometheus、Alertmanager、Grafana、Jaeger、OTel Collector、Loki
- **Platform_Layer**: 平台治理层，包含 Kubernetes、Helm、Argo CD、Istio
- **Migration_Engine**: 迁移过程中负责将 Source_Project 组件适配到新技术栈的转换逻辑
- **Ant_Design**: Ant Design 5.x UI 组件库，替代 Tailwind CSS 提供企业级 UI 组件
- **ECharts**: Apache ECharts 5.x 图表库，替代 Recharts 提供数据可视化能力
- **Zustand**: Zustand 4.x 轻量级状态管理库，替代 React Context API
- **Route_Structure**: 源项目中基于 react-router-dom 的 HashRouter 路由配置，包含 15 个模块、50+ 页面
- **Lazy_Loading**: 基于 React.lazy 和 Suspense 的按需加载机制
- **Hot_Reload**: 配置文件热更新机制，支持运行时修改配置无需重启服务
- **CAB**: Change Advisory Board，高危变更审批委员会
- **change_level**: 变更级别字段，取值 `none`（无需审批）/ `normal`（常规审批）/ `cab`（高危变更）

## 技术栈总览（严格生产版）

| 层级 | 技术选型 | 版本 | 审批级别 | 配置策略 | 生效时间 | 阶段 |
|------|----------|------|----------|----------|----------|------|
| 前端层 | React + TS + AntD | React19/TS5.x | 常规 | 远程配置热更；其余发版 | 发布窗口 | MVP |
| 可视化 | ECharts | 5.x | 无需审批 | 图表配置热更 | 秒级 | MVP |
| 前端状态管理 | Zustand | 4.x | 无需审批 | 运行时热更新 | 秒级 | MVP |
| 前端构建 | Vite + pnpm | 6.x | 无需审批 | - | - | MVP |
| 前端测试 | Vitest + fast-check | - | 无需审批 | - | - | MVP |
| 控制面服务 | Go (Gin)+gRPC | Go 1.22+ | 常规 | 参数热更；镜像滚动 | 分钟级 | MVP |
| API层 | Go (Gin) | Go 1.22+ | 常规 | 开关热更；版本滚动 | 分钟级 | MVP |
| 健康检测层 | Go health-worker | Go 1.22+ | 无需审批 | 目标/阈值热更 | 分钟级 | MVP |
| 容器编排 | Kubernetes | 1.28+ | CAB | 声明式变更+滚动 | 发布窗口 | MVP |
| CI/CD | GitHub Actions | - | 常规 | Pipeline 即代码 | 分钟级 | MVP |
| 入口层/API网关 | OpenResty (Nginx+Lua) | 1.25+ | CAB | 热更新优先；核心参数滚动 | 分钟级 | P1 |
| 身份认证 | Keycloak | 24+ | CAB | Realm/策略热更；SPI重启 | 分钟级 | P1 |
| 策略控制 | OPA | 0.6x+ | CAB | Policy Bundle 热更新 | 秒级 | P1 |
| 密钥管理 | Vault | 1.15+ | CAB | Secret热更；后端变更重启 | 分钟级 | P1 |
| 采集层 | Go Agent + 插件 | Go 1.22+ | 常规 | 规则热更；插件升级重启 | 分钟级 | P1 |
| 消息传输层 | Kafka | 3.7+ | CAB | 动态配置+核心参数重启 | 发布窗口 | P1 |
| 消息治理 | Schema Registry | 2.5+/7.x+ | CAB | Schema/兼容策略热更 | 分钟级 | P1 |
| 实时计算层 | Flink (SQL+CEP) | 1.19+ | CAB | 参数热更；作业 Savepoint 发布 | 发布窗口 | P1 |
| 检索存储 | Elasticsearch | 8.13+ | CAB | ILM热更；节点参数重启 | 发布窗口 | P1 |
| 元数据DB | PostgreSQL | 16+ | CAB | 业务配置热生效；核心参数重启 | 发布窗口 | P1 |
| PG高可用 | Patroni + etcd | 稳定版 | CAB | 拓扑变更维护窗口 | 发布窗口 | P1 |
| 连接池 | PgBouncer | 1.2x+ | 常规 | reload优先 | 分钟级 | P1 |
| 缓存层 | Redis Cluster | 7.2+ | CAB | TTL热更；拓扑变更重启 | 分钟级 | P1 |
| 冷存储 | MinIO/S3 | 稳定版 | 常规 | 生命周期策略热更 | 分钟级 | P1 |
| 指标监控 | Prometheus | 2.48+ | 无需审批 | 规则/目标 reload | 分钟级 | P1 |
| 告警中心 | Alertmanager | 0.27+ | 无需审批 | 配置热重载 | 秒级 | P1 |
| 可视化监控 | Grafana | 10.2+ | 无需审批 | Dashboard/规则热更 | 秒级 | P1 |
| 链路追踪 | Jaeger + OTel Collector | Jaeger1.50+/OTel0.9x+ | 常规 | 采样热更；结构变更滚动 | 分钟级 | P1 |
| 日志聚合 | Loki | 稳定版 | 常规 | 配置热更 | 分钟级 | P1 |
| GitOps | Argo CD | 2.1x+ | 常规 | Git为准，防配置漂移 | 发布窗口 | P1 |
| 包管理 | Helm | 3.13+ | 常规 | YAML主通道 | 发布窗口 | P1 |
| 安全扫描 | Trivy + SAST | 稳定版 | 无需审批 | 规则库热更 | 分钟级 | P1 |
| Node.js层(可选) | NestJS (BFF) | Node 20 LTS | 常规 | 配置热更；升级重启 | 分钟级 | P1 |
| 制品仓库 | Harbor | 2.10+ | 常规 | 策略热更 | 分钟级 | P1 |
| ML(可选) | Python+sklearn+PyTorch+ONNX+MLflow | Py3.11+ | 常规 | 模型热切换；服务滚动 | 分钟级 | P2 |
| NLP(可选) | LLM API + 规则引擎 | - | 常规 | Prompt/规则热更 | 秒级 | P2 |
| 向量检索(可选) | pgvector | 0.6+ | CAB | 索引分阶段；扩展升级窗口 | 发布窗口 | P2 |
| 边缘计算(可选) | MQTT 5.0 + SQLite/BoltDB | - | 常规 | 规则热更；分批升级 | 分钟级 | P2 |
| 服务网格(可选) | Istio | 稳定版 | CAB | 流量策略热更 | 分钟级 | P2 |

## 需求

---

### MVP 阶段：最小可行产品

---

### 需求 1：Monorepo 骨架搭建

**用户故事：** 作为开发者，我希望 NexusLog 采用业务域+平台域分层的 Monorepo 架构，以便各域可以独立开发、测试和部署。

#### 验收标准

1. THE NexusLog SHALL 包含完整的顶层目录结构：`apps/`、`services/`、`gateway/`、`iam/`、`agents/`、`stream/`、`messaging/`、`contracts/`、`storage/`、`observability/`、`platform/`、`infra/`、`ml/`、`edge/`、`configs/`、`docs/`、`scripts/`、`tests/`
2. THE NexusLog SHALL 在根目录包含 `go.work` 文件管理多个 Go 模块的工作区
3. THE NexusLog SHALL 在根目录包含 `Makefile` 作为统一构建和测试命令入口
4. THE NexusLog SHALL 在根目录包含 `package.json` 管理 pnpm workspace
5. THE NexusLog SHALL 在 `configs/` 目录下包含 `common/`、`dev/`、`staging/`、`prod/` 环境配置，且三个环境目录结构完全一致
6. THE NexusLog SHALL 在根目录包含统一的 `README.md` 描述 Monorepo 结构、各域职责和技术选型

### 需求 2：前端控制台迁移

**用户故事：** 作为前端开发者，我希望将 logscale-pro-recreated 项目的前端迁移到 NexusLog Monorepo 中，完成技术栈替换并保留全部功能。

#### 验收标准

1. THE Frontend_Console SHALL 使用 React 19 + TypeScript 5.x + Ant Design 5.x + ECharts 5.x + Zustand 4.x 技术栈
2. THE Frontend_Console SHALL 迁移源项目全部 15 个路由模块和 50+ 页面
3. THE Frontend_Console SHALL 将 Tailwind CSS 样式替换为 Ant Design 组件和主题配置
4. THE Frontend_Console SHALL 将 Recharts 图表替换为 ECharts 实现
5. THE Frontend_Console SHALL 将 Context API 状态管理替换为 Zustand Store
6. THE Frontend_Console SHALL 配置 Vitest 单元测试框架和 fast-check 属性测试库
7. THE Frontend_Console SHALL 配置 Vite 构建工具，支持代码分割、压缩和环境隔离

> **详细实现计划参见：** `.kiro/specs/frontend-migration/`

### 需求 3：后端微服务骨架

**用户故事：** 作为后端开发者，我希望 NexusLog 后端采用多服务架构，各服务拥有清晰的 Go 项目结构，以便独立开发和部署。

#### 验收标准

1. THE Control_Plane SHALL 包含标准 Go 项目结构：`cmd/api/`、`internal/`（app/domain/service/repository/transport/）、`api/`（openapi/proto/）、`configs/`、`tests/`、`Dockerfile`
2. THE Health_Worker SHALL 包含 `cmd/worker/`、`internal/`（checker/scheduler/reporter/）、`configs/`、`tests/`、`Dockerfile`
3. THE Data_Services SHALL 包含 `query-api/`、`audit-api/`、`export-api/`、`shared/` 子目录
4. THE API_Service SHALL 包含 `cmd/api/`、`internal/`、`api/openapi/`、`configs/`、`Dockerfile`
5. WHEN 新增 Go 服务时，THE NexusLog SHALL 遵循相同的目录结构约定

### 需求 4：基础部署配置

**用户故事：** 作为运维工程师，我希望项目包含基础的容器化和部署配置，以便在开发环境中快速启动服务。

#### 验收标准

1. THE NexusLog SHALL 为每个可部署服务提供独立的 Dockerfile
2. THE NexusLog SHALL 在根目录提供 `docker-compose.yml` 用于本地开发环境的一键启动
3. THE NexusLog SHALL 在 `platform/kubernetes/base/` 下提供基础 Kubernetes 部署清单
4. THE Frontend_Console SHALL 提供多阶段构建 Dockerfile（pnpm install → build → nginx 静态服务）

### 需求 5：基础 CI/CD

**用户故事：** 作为 DevOps 工程师，我希望项目包含基础的 CI/CD 流水线，以便实现自动化构建和测试。

#### 验收标准

1. THE NexusLog SHALL 包含 GitHub Actions 工作流配置，定义前端构建测试流水线
2. THE NexusLog SHALL 包含 GitHub Actions 工作流配置，定义后端构建测试流水线
3. THE NexusLog SHALL 包含 GitHub Actions 工作流配置，定义镜像构建推送流水线
4. WHEN CI 流水线执行时，THE NexusLog SHALL 运行单元测试和类型检查

### 需求 6：项目文档体系基础

**用户故事：** 作为团队成员，我希望项目从 MVP 阶段就包含基础的架构文档和决策记录，以便新成员快速了解项目结构。

#### 验收标准

1. THE NexusLog SHALL 在 `docs/architecture/` 下包含系统上下文和逻辑架构文档模板
2. THE NexusLog SHALL 在 `docs/adr/` 下包含 ADR-0001-monorepo 架构决策记录，说明 Monorepo 选型理由
3. THE NexusLog SHALL 在 `docs/` 下包含变更管理规范文档，定义三级审批体系（none/normal/cab）和 CAB 判定规则
4. THE NexusLog SHALL 在根目录 `README.md` 中包含快速开始指南、目录结构说明和开发规范链接

### 需求 7：配置热更新机制

**用户故事：** 作为运维工程师，我希望 NexusLog 的配置支持热更新，以便在不重启服务的情况下修改运行时配置。

#### 验收标准

1. THE Frontend_Console SHALL 通过运行时配置文件（`/config/app-config.json`）支持配置热更新
2. THE Control_Plane SHALL 在配置模板中预留文件监听（file watcher）机制的接口定义
3. WHEN 运行时配置文件发生变化时，THE Frontend_Console SHALL 在下次页面刷新时加载最新配置
4. THE NexusLog SHALL 在后端配置模板中为每个组件标注 `change_level` 字段（none/normal/cab）和推荐生效时间

---

### P1 阶段：生产就绪

---

### 需求 8：API 网关完整配置

**用户故事：** 作为架构师，我希望 NexusLog 包含完整的 API 网关配置，以便统一管理流量入口、路由、限流和安全策略。

#### 验收标准

1. THE Gateway SHALL 包含完整的反向代理配置，将 API 请求路由到对应后端服务
2. THE Gateway SHALL 包含 Lua 脚本实现 JWT 认证校验
3. THE Gateway SHALL 包含 Lua 脚本实现请求限流策略
4. THE Gateway SHALL 包含 Lua 脚本实现请求日志记录
5. THE Gateway SHALL 支持多租户路由配置
6. IF Gateway 配置变更涉及全局流量策略，THEN THE NexusLog SHALL 将该变更标记为 CAB 级别

### 需求 9：IAM 安全体系集成

**用户故事：** 作为安全工程师，我希望 NexusLog 集成完整的 IAM 安全体系，以便实现统一认证、细粒度授权和密钥管理。

#### 验收标准

1. THE IAM SHALL 配置 Keycloak Realm，包含用户注册、登录、Token 刷新、SSO 集成
2. THE IAM SHALL 配置 OPA RBAC 授权策略，支持基于角色的 API 访问控制
3. THE IAM SHALL 配置 Vault 密钥管理，支持数据库凭证、API 密钥的动态生成和轮换
4. WHEN Frontend_Console 发起 API 请求时，THE Gateway SHALL 通过 Keycloak 验证 JWT Token 有效性
5. WHEN 用户访问受保护资源时，THE OPA SHALL 根据用户角色和策略决定是否允许访问
6. IF IAM 配置变更涉及认证鉴权链路，THEN THE NexusLog SHALL 将该变更标记为 CAB 级别

### 需求 10：日志采集代理

**用户故事：** 作为架构师，我希望 NexusLog 包含可扩展的日志采集代理，以便从多种数据源采集日志并发送到消息传输层。

#### 验收标准

1. THE Collector_Agent SHALL 位于 `agents/collector-agent/` 目录下，包含标准 Go 项目结构（cmd/agent/ + internal/ + plugins/ + configs/ + tests/ + Dockerfile）
2. THE Collector_Agent SHALL 支持插件化架构，通过 gRPC 和 WASM 插件扩展采集能力
3. THE Collector_Agent SHALL 实现 checkpoint 机制，确保日志采集的 at-least-once 语义
4. THE Collector_Agent SHALL 实现重试策略，在下游不可用时缓存日志数据
5. THE Collector_Agent SHALL 将采集到的日志数据发送到 Kafka Topic

### 需求 11：消息传输和流计算

**用户故事：** 作为架构师，我希望 NexusLog 具备可靠的异步消息传输和实时流计算能力，以便处理大规模日志数据的采集、传输和实时分析。

#### 验收标准

1. THE NexusLog SHALL 配置 Kafka Topic 定义，包含日志采集、告警事件、审计日志等核心 Topic
2. THE NexusLog SHALL 配置 Schema Registry，定义日志消息的 Avro/Protobuf Schema 和兼容性规则
3. THE NexusLog SHALL 配置死信队列（DLQ）和重试策略
4. THE Stream_Engine SHALL 配置 Flink SQL 作业，实现日志数据的实时聚合和告警规则匹配
5. THE Stream_Engine SHALL 配置 Flink CEP 作业，实现复杂事件模式检测
6. THE NexusLog SHALL 在 `contracts/schema-contracts/` 下定义 Avro/Protobuf/JSON Schema 契约，CI 校验兼容性
7. IF 消息传输配置变更涉及 Kafka 集群拓扑，THEN THE NexusLog SHALL 将该变更标记为 CAB 级别

### 需求 12：存储层完整配置

**用户故事：** 作为运维工程师，我希望 NexusLog 的存储层包含完整的配置和管理策略，以便实现数据的高效存储、检索和生命周期管理。

#### 验收标准

1. THE NexusLog SHALL 配置 Elasticsearch 索引模板，定义日志数据的映射和分片策略
2. THE NexusLog SHALL 配置 Elasticsearch ILM 策略，实现日志数据的热温冷归档生命周期管理
3. THE NexusLog SHALL 配置 PostgreSQL 数据库迁移脚本，定义元数据表结构
4. THE NexusLog SHALL 配置 PostgreSQL RLS 策略，实现行级安全控制
5. THE NexusLog SHALL 配置 Patroni + etcd 实现 PostgreSQL 高可用
6. THE NexusLog SHALL 配置 Redis Cluster，定义缓存策略和 TTL 规则
7. THE NexusLog SHALL 配置 MinIO 存储桶和生命周期策略，用于日志冷存储
8. IF 存储配置变更涉及集群拓扑或分片策略，THEN THE NexusLog SHALL 将该变更标记为 CAB 级别

### 需求 13：可观测性体系

**用户故事：** 作为 SRE，我希望 NexusLog 具备完整的可观测性体系，以便实时监控系统健康状态、快速定位问题。

#### 验收标准

1. THE Observability_Stack SHALL 配置 Prometheus 服务发现和抓取规则，覆盖所有微服务的指标端点
2. THE Observability_Stack SHALL 配置 Alertmanager 告警路由和通知渠道（邮件、Webhook、企业微信/钉钉）
3. THE Observability_Stack SHALL 配置 Grafana Dashboard，包含系统概览、各服务详情、存储层监控面板
4. THE Observability_Stack SHALL 配置 Jaeger + OTel Collector，实现分布式链路追踪
5. THE Observability_Stack SHALL 配置 Loki，实现日志聚合和查询
6. WHEN 服务指标超过预设阈值时，THE Alertmanager SHALL 触发告警通知

### 需求 14：变更管理体系

**用户故事：** 作为运维工程师和开发者，我希望 NexusLog 内置完整的变更管理规范，以便所有变更遵循统一的审批和回滚流程。

#### 验收标准

1. THE NexusLog SHALL 定义三级审批体系：无需审批（none）、常规审批（normal）、高危变更（cab）
2. THE NexusLog SHALL 定义 CAB 判定规则表，包含 7 条硬规则（涉及认证链路、存储拓扑、入口流量、密钥证书、不可逆数据、跨机房切换、5分钟不可回滚）
3. THE NexusLog SHALL 定义风险评分矩阵（影响范围、业务关键性、复杂度、可回滚性、可观测性，各 0-3 分），总分 ≤5 无需审批、6-10 常规、≥11 CAB
4. THE NexusLog SHALL 定义回滚 SLA：T+5分钟回滚决策、T+15分钟核心恢复、T+30分钟根因初判、T+24小时复盘报告
5. THE NexusLog SHALL 为每个组件配置模板标注 `change_level` 字段和推荐生效时间
6. THE NexusLog SHALL 提供变更单模板，含风险评分自动计算规则、CAB 自动路由逻辑、非窗口发布判定规则

### 需求 15：完整测试体系

**用户故事：** 作为开发者，我希望 NexusLog 具备完整的测试体系，以便保障代码质量和系统可靠性。

#### 验收标准

1. THE NexusLog SHALL 配置前端单元测试（Vitest）和属性测试（fast-check）
2. THE NexusLog SHALL 配置后端单元测试（Go testing + testify）
3. THE NexusLog SHALL 在 `tests/integration/` 下配置集成测试框架
4. THE NexusLog SHALL 在 `tests/e2e/` 下配置端到端测试框架（Playwright）
5. THE NexusLog SHALL 在 CI 流水线中集成 Trivy 镜像安全扫描
6. WHEN CI 流水线执行时，THE NexusLog SHALL 运行单元测试、集成测试和安全扫描

### 需求 16：基础设施即代码

**用户故事：** 作为 DevOps 工程师，我希望项目包含 Terraform 和 Ansible 的基础设施代码结构，以便实现基础设施的声明式管理。

#### 验收标准

1. THE NexusLog SHALL 在 `infra/terraform/` 目录下包含 `modules/` 和 `envs/`（含 dev/、staging/、prod/）子目录
2. THE NexusLog SHALL 在 `infra/ansible/` 目录下包含 `inventories/`、`roles/` 子目录
3. THE NexusLog SHALL 在 Terraform 模块中定义 Kubernetes 集群、网络、存储等基础设施资源
4. THE NexusLog SHALL 在 Ansible 角色中定义服务器初始化、安全加固等运维自动化任务

### 需求 17：GitOps 和高级 CI/CD

**用户故事：** 作为 DevOps 工程师，我希望项目采用 GitOps 模式管理部署，以便实现声明式发布和配置漂移检测。

#### 验收标准

1. THE NexusLog SHALL 在 `platform/gitops/argocd/` 下包含 Argo CD Application 配置模板
2. THE NexusLog SHALL 在 `platform/gitops/apps/` 下包含各系统的 GitOps 应用定义（ingress-system、iam-system、control-plane、data-plane、storage-system、observability）
3. THE NexusLog SHALL 在 `platform/gitops/clusters/` 下包含 dev/staging/prod 集群配置
4. THE NexusLog SHALL 在 `platform/helm/` 下包含完整的 Helm Chart（nexuslog-gateway、nexuslog-control-plane、nexuslog-data-plane、nexuslog-storage、nexuslog-observability）
5. THE NexusLog SHALL 在 CI 流水线中集成 Trivy 镜像安全扫描和 Harbor 制品仓库推送

### 需求 18：BFF 服务层（可选）

**用户故事：** 作为前端开发者，我希望在前端和后端微服务之间有一个 BFF 层，以便聚合多个后端 API 并提供前端友好的数据格式。

#### 验收标准

1. WHERE BFF 功能启用，THE BFF_Service SHALL 位于 `apps/bff-service/` 目录下，使用 NestJS + Node 20 LTS
2. WHERE BFF 功能启用，THE BFF_Service SHALL 聚合 Control_Plane、API_Service、Data_Services 的 API 响应
3. WHERE BFF 功能启用，THE BFF_Service SHALL 实现请求缓存和数据转换逻辑
4. WHERE BFF 功能启用，THE Gateway SHALL 将前端 API 请求路由到 BFF_Service


---

### P2 阶段：增强功能

---

### 需求 19：机器学习和 NLP 集成

**用户故事：** 作为数据工程师，我希望 NexusLog 集成机器学习和 NLP 能力，以便实现日志异常检测、智能分类和自然语言查询。

#### 验收标准

1. THE NexusLog SHALL 在 `ml/anomaly-detection/` 下包含异常检测模型训练和推理服务代码结构（Python 3.11+ + sklearn + PyTorch）
2. THE NexusLog SHALL 在 `ml/log-classifier/` 下包含日志分类模型代码结构
3. THE NexusLog SHALL 在 `ml/nlp-query/` 下包含自然语言查询解析服务代码结构（LLM API + 规则引擎）
4. THE NexusLog SHALL 配置 MLflow 实验跟踪和模型注册表
5. THE NexusLog SHALL 配置 ONNX Runtime 模型推理服务，支持模型热切换
6. WHERE NLP 查询功能启用，THE Frontend_Console SHALL 提供自然语言搜索输入框，将用户查询转换为结构化日志查询

### 需求 20：边缘计算支持

**用户故事：** 作为架构师，我希望 NexusLog 支持边缘计算场景，以便在网络受限环境中实现本地日志采集、预处理和离线缓存。

#### 验收标准

1. THE NexusLog SHALL 在 `edge/edge-agent/` 下包含边缘采集代理代码结构（Go 实现 + MQTT 5.0 协议）
2. THE NexusLog SHALL 在 `edge/edge-gateway/` 下包含边缘网关代码结构，支持本地日志预处理和过滤
3. THE NexusLog SHALL 在 `edge/edge-store/` 下包含本地存储适配层（SQLite/BoltDB），支持离线缓存和断点续传
4. WHEN 边缘节点恢复网络连接时，THE edge-agent SHALL 自动将缓存的日志数据同步到中心 Kafka 集群
5. THE NexusLog SHALL 支持边缘节点的远程配置下发和固件升级

### 需求 21：高级平台治理

**用户故事：** 作为平台工程师，我希望 NexusLog 集成 Istio 服务网格和高级平台治理能力，以便实现细粒度的流量管理、安全策略和可观测性增强。

#### 验收标准

1. THE NexusLog SHALL 在 `platform/istio/` 下包含 Istio 服务网格配置（VirtualService、DestinationRule、AuthorizationPolicy）
2. THE NexusLog SHALL 配置 Istio 流量管理策略，支持金丝雀发布、蓝绿部署和流量镜像
3. THE NexusLog SHALL 配置 Istio mTLS，实现服务间通信加密
4. THE NexusLog SHALL 配置 pgvector 扩展，支持日志向量化存储和语义检索
5. IF 服务网格配置变更涉及全局流量策略，THEN THE NexusLog SHALL 将该变更标记为 CAB 级别

### 需求 22：性能优化和混沌测试

**用户故事：** 作为 SRE，我希望 NexusLog 具备完整的性能测试和混沌工程能力，以便验证系统在高负载和故障场景下的表现。

#### 验收标准

1. THE NexusLog SHALL 在 `tests/performance/` 下包含性能测试脚本（k6/Locust），覆盖 API 响应时间、吞吐量、并发连接数
2. THE NexusLog SHALL 在 `tests/chaos/` 下包含混沌测试场景定义（Chaos Mesh/Litmus），覆盖网络分区、Pod 故障、存储故障
3. THE NexusLog SHALL 定义性能基线指标：API P99 < 200ms、日志写入吞吐 > 10K EPS、查询响应 P95 < 500ms
4. THE NexusLog SHALL 在 CI 流水线中集成性能回归测试，当指标劣化超过 10% 时阻断发布

### 需求 23：高级安全扫描

**用户故事：** 作为安全工程师，我希望 NexusLog 具备全面的安全扫描能力，以便在开发和部署阶段发现安全漏洞。

#### 验收标准

1. THE NexusLog SHALL 在 CI 流水线中集成 SAST（静态应用安全测试）扫描
2. THE NexusLog SHALL 在 CI 流水线中集成 DAST（动态应用安全测试）扫描
3. THE NexusLog SHALL 在 CI 流水线中集成依赖漏洞扫描（Trivy + Snyk/Dependabot）
4. THE NexusLog SHALL 在 CI 流水线中集成容器镜像安全扫描
5. THE NexusLog SHALL 定义安全扫描策略：Critical/High 漏洞阻断发布，Medium 漏洞生成工单，Low 漏洞记录日志

### 需求 24：文档体系完善

**用户故事：** 作为团队成员，我希望 NexusLog 具备完善的文档体系，以便支撑项目的长期维护和团队协作。

#### 验收标准

1. THE NexusLog SHALL 在 `docs/architecture/` 下完善全部 5 篇架构文档（系统上下文、逻辑架构、部署架构、数据流、安全架构）
2. THE NexusLog SHALL 在 `docs/runbooks/` 下包含至少 10 个运维手册（覆盖 Kafka、ES、PostgreSQL、Redis、Flink 等核心组件的常见故障处理）
3. THE NexusLog SHALL 在 `docs/oncall/` 下包含值班手册和升级流程
4. THE NexusLog SHALL 在 `docs/sla-slo/` 下包含 SLA/SLO 定义文档
5. THE NexusLog SHALL 在 `docs/security/` 下包含安全规范和合规检查清单
6. THE NexusLog SHALL 配置文档站点生成工具（MkDocs/Docusaurus），支持从 Markdown 生成可浏览的文档站点

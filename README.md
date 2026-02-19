# NexusLog

企业级日志管理系统 — 基于业务域+平台域分层的 Monorepo 全栈架构。

## 项目概述

NexusLog 是一个面向企业的统一日志管理平台，覆盖日志采集、传输、存储、检索、分析、告警、审计的完整生命周期。项目采用 Monorepo 组织，前端控制台与多个 Go 微服务、API 网关、安全体系等共存于同一仓库，通过 pnpm workspace + Go workspace 实现多语言协同开发。

## 技术栈

| 层级 | 技术选型 | 版本 |
|------|----------|------|
| 前端框架 | React + TypeScript | React 19 / TS 5.7 |
| UI 组件库 | Ant Design | 5.22+ |
| 图表 | Apache ECharts | 5.5+ |
| 状态管理 | Zustand | 5.x |
| 构建工具 | Vite | 6.x |
| 测试 | Vitest + fast-check | Vitest 3.2 / fast-check 3.23 |
| API 网关 | OpenResty (Nginx + Lua) | 1.25+ |
| 微服务 | Go (Gin + gRPC) | Go 1.22+ |
| 消息队列 | Kafka | 3.7+ |
| 流计算 | Flink (SQL + CEP) | 1.19+ |
| 搜索存储 | Elasticsearch | 8.13+ |
| 关系数据库 | PostgreSQL + Patroni | PG 16+ |
| 缓存 | Redis Cluster | 7.2+ |
| 对象存储 | MinIO / S3 | — |
| 身份认证 | Keycloak | 24+ |
| 策略控制 | OPA | 0.6x+ |
| 密钥管理 | Vault | 1.15+ |
| 容器编排 | Kubernetes + Helm | K8s 1.28+ |
| GitOps | Argo CD | 2.1x+ |
| 监控 | Prometheus + Grafana + Alertmanager | — |
| 链路追踪 | Jaeger + OTel Collector | — |
| 包管理 | pnpm (前端) / Go workspace (后端) | pnpm 9.x |

## 目录结构

```
NexusLog/
├── apps/                        # 应用层
│   └── frontend-console/        # 前端控制台 (React 19 + TS + AntD + ECharts + Zustand)
│       ├── src/
│       │   ├── components/      # 组件 (charts/ common/ layout/ auth/ search/)
│       │   ├── pages/           # 页面 (15 个功能模块，50+ 页面)
│       │   ├── stores/          # Zustand Store (auth, theme, notification, cache, offline)
│       │   ├── hooks/           # 自定义 Hooks (25+)
│       │   ├── services/        # API 服务层 + WebSocket + 监控
│       │   ├── routes/          # 路由配置 (HashRouter + 懒加载)
│       │   ├── types/           # TypeScript 类型定义
│       │   ├── utils/           # 工具函数
│       │   ├── constants/       # 常量定义
│       │   └── config/          # 运行时配置 + Ant Design 主题
│       ├── public/config/       # 运行时配置文件 (app-config.json)
│       ├── vite.config.ts       # Vite 构建配置 (代码分割 + 压缩)
│       ├── vitest.config.ts     # 测试配置
│       └── Dockerfile           # 多阶段构建 (pnpm → build → nginx)
│
├── services/                    # 微服务层
│   ├── control-plane/           # 控制面服务 (Go Gin + gRPC, /api/v1/health)
│   ├── health-worker/           # 健康检测服务
│   ├── data-services/           # 数据服务集合 (query-api, audit-api, export-api)
│   └── api-service/             # API 服务
│
├── gateway/                     # API 网关
│   └── openresty/               # OpenResty 配置
│       ├── nginx.conf           # 反向代理 + 路由 + WebSocket
│       ├── lua/                 # Lua 脚本 (认证校验, 限流, 日志)
│       ├── conf.d/              # 扩展配置
│       ├── tenants/             # 租户配置
│       ├── policies/            # 策略配置
│       ├── tests/               # 网关测试
│       └── Dockerfile
│
├── configs/                     # 公共配置 (环境隔离)
│   ├── common/                  # 通用配置
│   ├── dev/                     # 开发环境
│   ├── staging/                 # 预发布环境
│   └── prod/                    # 生产环境
│
├── docs/                        # 项目文档
│   ├── architecture/            # 架构文档 (系统上下文, 逻辑架构, 部署, 数据流, 安全)
│   ├── adr/                     # 架构决策记录
│   ├── runbooks/                # 运维手册 (Kafka 延迟, ES 写入拒绝, 回滚)
│   ├── oncall/                  # 值班手册
│   ├── security/                # 安全文档
│   └── sla-slo/                 # SLA/SLO 定义
│
├── scripts/                     # 脚本工具
│   ├── bootstrap.sh             # 项目初始化
│   ├── lint.sh                  # 代码检查
│   ├── test.sh                  # 测试运行
│   ├── build.sh                 # 构建
│   ├── release.sh               # 发布
│   └── rollback.sh              # 回滚
│
├── tests/                       # 集成 / E2E / 性能 / 混沌测试
│   ├── e2e/
│   ├── integration/
│   ├── performance/
│   └── chaos/
│
├── go.work                      # Go 多模块工作区
├── package.json                 # pnpm workspace 配置
├── pnpm-workspace.yaml          # pnpm workspace 定义
├── Makefile                     # 统一构建/测试命令入口
├── .editorconfig                # 编辑器配置
├── CHANGELOG.md                 # 变更日志
└── LICENSE                      # MIT 许可证
```

### 待搭建目录（按路线图推进）

| 目录 | 用途 | 状态 |
|------|------|------|
| `iam/` | 身份认证与授权 (Keycloak + OPA + Vault) | 待搭建 |
| `agents/` | 采集代理 (Go Collector Agent) | 待搭建 |
| `stream/` | 流计算 (Flink SQL + CEP) | 待搭建 |
| `messaging/` | 消息传输 (Kafka + Schema Registry) | 待搭建 |
| `contracts/` | 契约定义 (Avro / Protobuf / JSON Schema) | 待搭建 |
| `storage/` | 存储配置 (ES + PG + Redis + MinIO) | 待搭建 |
| `observability/` | 可观测性 (Prometheus + Grafana + Jaeger) | 待搭建 |
| `platform/` | 平台治理 (K8s + Helm + GitOps + Istio) | 待搭建 |
| `infra/` | 基础设施即代码 (Terraform + Ansible) | 待搭建 |
| `ml/` | 机器学习 (可选) | 待搭建 |
| `edge/` | 边缘计算 (可选) | 待搭建 |

## 快速开始

### 前置条件

- Node.js 20 LTS
- pnpm 9.x (`corepack enable && corepack prepare pnpm@9 --activate`)
- Go 1.22+
- Docker & Docker Compose

### 安装依赖

```bash
# 一键初始化（安装前端依赖 + 同步 Go 模块）
make bootstrap

# 或手动执行
pnpm install              # 前端依赖
go work sync              # Go 模块同步
```

### 常用命令

```bash
# 开发
cd apps/frontend-console && pnpm dev     # 启动前端开发服务器 (Vite HMR)

# 测试
make test                                # 运行全部测试
make frontend-test                       # 仅前端测试 (Vitest)
make backend-test                        # 仅后端测试

# 构建
make build                               # 构建全部
make frontend-build                      # 仅构建前端

# 代码检查
make lint                                # 全部 lint

# Docker
make docker-build                        # 构建镜像
make docker-push                         # 推送镜像

# 清理
make clean                               # 清理构建产物

# 帮助
make help                                # 查看所有可用命令
```

### 前端开发

```bash
cd apps/frontend-console

pnpm dev                  # 启动开发服务器 (默认 http://localhost:5173)
pnpm build                # 生产构建 (代码分割: React / AntD / ECharts 独立 chunk)
pnpm test                 # 运行测试 (单元测试 + 属性测试)
pnpm test:watch           # 测试监听模式
pnpm test:coverage        # 测试覆盖率
pnpm preview              # 预览生产构建
```

前端包含 15 个功能模块：Dashboard、日志检索、日志分析、告警中心、采集接入、解析字段、索引存储、性能高可用、分布式追踪、报表中心、安全审计、集成平台、成本管理、系统设置、帮助中心。

## 架构概览

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Browser    │────▶│  OpenResty 网关   │────▶│   Go 微服务      │
│  (React 19)  │     │  (Lua 认证/限流)  │     │  (Gin + gRPC)   │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                       │
                    ┌──────────────────┐               │
                    │    Keycloak      │◀──────────────┤
                    │  (OIDC / JWT)    │               │
                    └──────────────────┘               │
                                                       ▼
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Collector   │────▶│     Kafka        │────▶│     Flink       │
│   Agent      │     │  (消息传输)       │     │  (流计算)        │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                       │
                    ┌──────────────────┐               ▼
                    │   PostgreSQL     │     ┌─────────────────┐
                    │  (元数据 + 审计)  │     │ Elasticsearch   │
                    └──────────────────┘     │  (日志检索)      │
                                             └─────────────────┘
```

## 变更管理

所有配置变更遵循三级审批体系：

| 级别 | 字段值 | 审批要求 | 适用场景 |
|------|--------|----------|----------|
| 无需审批 | `none` | 值班负责人备案 | 监控规则、Dashboard、健康检测阈值 |
| 常规审批 | `normal` | 技术负责人审批 | 服务配置、API 变更、前端发版 |
| 高危变更 | `cab` | CAB 委员会审批 | 认证链路、存储拓扑、网关策略、密钥证书 |

详见 [变更管理规范](docs/change-management.md)

## 文档

| 文档 | 说明 |
|------|------|
| [系统上下文](docs/architecture/01-system-context.md) | 系统边界与外部交互 |
| [逻辑架构](docs/architecture/02-logical-architecture.md) | 分层架构与模块划分 |
| [部署架构](docs/architecture/03-deployment-architecture.md) | K8s 部署拓扑 |
| [数据流](docs/architecture/04-dataflow.md) | 日志数据流转路径 |
| [安全架构](docs/architecture/05-security-architecture.md) | 认证授权与安全策略 |
| [ADR-0001](docs/adr/ADR-0001-monorepo.md) | Monorepo 架构决策 |
| [Kafka 延迟处理](docs/runbooks/kafka-lag-high.md) | 运维手册 |
| [ES 写入拒绝](docs/runbooks/es-write-reject.md) | 运维手册 |
| [回滚操作手册](docs/runbooks/rollback-playbook.md) | 运维手册 |

## 许可证

[MIT License](LICENSE)

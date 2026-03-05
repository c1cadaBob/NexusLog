# NexusLog

企业级日志管理系统 — 基于业务域+平台域分层的 Monorepo 全栈架构。

## 项目概述

NexusLog 是一个面向企业的统一日志管理平台，覆盖日志采集、传输、存储、检索、分析、告警、审计的完整生命周期。项目采用 Monorepo 组织，前端控制台与多个 Go 微服务、API 网关、安全体系等共存于同一仓库，通过 pnpm workspace + Go workspace 实现多语言协同开发。

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

## 系统架构

### 整体分层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户层 (Users)                            │
│  浏览器 / CLI / 边缘节点 / 第三方系统                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    入口层 (Gateway)                               │
│  OpenResty (Nginx+Lua) — JWT校验 / 限流 / 路由 / 日志            │
│  [P1] Istio Sidecar — mTLS / 流量管理                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    应用层 (Apps)                                  │
│  ┌─────────────────┐  ┌──────────────┐                          │
│  │ Frontend Console│  │ BFF Service  │ (可选, NestJS)            │
│  │ React19+AntD    │  │ Node 20 LTS  │                          │
│  └─────────────────┘  └──────────────┘                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    服务层 (Services)                              │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────┐ │
│  │ Control Plane│ │ API Service  │ │Data Services│ │Health    │ │
│  │ Go Gin+gRPC  │ │ Go Gin       │ │query/audit/ │ │Worker    │ │
│  │              │ │              │ │export       │ │Go        │ │
│  └──────────────┘ └──────────────┘ └────────────┘ └──────────┘ │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    安全层 (IAM)                                   │
│  Keycloak (认证) + OPA (授权) + Vault (密钥)                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    数据层 (Data Pipeline)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐      │
│  │Collector │→ │  Kafka   │→ │ Flink (SQL+CEP)          │      │
│  │Agent     │  │+ Schema  │  │ 实时聚合 / 告警匹配       │      │
│  └──────────┘  │Registry  │  └──────────────────────────┘      │
│                └──────────┘                                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    存储层 (Storage)                               │
│  ┌──────────────┐ ┌──────────────┐ ┌────────┐ ┌──────────────┐ │
│  │Elasticsearch │ │ PostgreSQL   │ │ Redis  │ │ MinIO/S3     │ │
│  │(热/温/冷)    │ │+Patroni+etcd │ │Cluster │ │ (冷存储)     │ │
│  └──────────────┘ └──────────────┘ └────────┘ └──────────────┘ │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    可观测性层 (Observability)                     │
│  Prometheus + Alertmanager + Grafana + Jaeger + OTel + Loki     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    平台层 (Platform)                              │
│  Kubernetes + Helm + Argo CD + [P2] Istio                       │
│  Terraform + Ansible (IaC)                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Monorepo 项目结构

```
NexusLog/
├── README.md
├── LICENSE
├── CHANGELOG.md
├── .gitignore
├── .editorconfig
├── Makefile                     # 统一构建/测试命令入口
├── go.work                      # Go 多模块工作区
├── package.json                 # pnpm workspace 配置
├── docs/                        # 项目文档
│   ├── architecture/            # 架构文档（系统上下文、逻辑架构、部署架构、数据流、安全架构）
│   ├── adr/                     # 架构决策记录
│   ├── runbooks/                # 运维手册
│   ├── oncall/
│   ├── security/
│   └── sla-slo/
├── configs/                     # 公共配置（环境隔离）
│   ├── common/
│   ├── dev/
│   ├── staging/
│   └── prod/
├── apps/                        # 应用层
│   ├── frontend-console/        # 前端控制台（React 19 + TS + AntD + ECharts + Zustand）
│   │   ├── src/
│   │   │   ├── components/      # 组件
│   │   │   │   ├── charts/      # ECharts 图表组件
│   │   │   │   ├── common/      # 通用组件（基于 Ant Design 封装）
│   │   │   │   ├── layout/      # 布局组件（Layout, Sidebar, Header）
│   │   │   │   └── auth/        # 认证组件
│   │   │   ├── pages/           # 页面（按模块分目录）
│   │   │   ├── stores/          # Zustand Store
│   │   │   ├── hooks/           # 自定义 Hooks
│   │   │   ├── services/        # API 服务层
│   │   │   ├── types/           # TypeScript 类型定义
│   │   │   ├── utils/           # 工具函数
│   │   │   ├── constants/       # 常量定义
│   │   │   ├── config/          # 运行时配置
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── public/
│   │   │   └── config/
│   │   │       └── app-config.json
│   │   ├── tests/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── package.json
│   │   └── Dockerfile
│   └── bff-service/             # BFF 层（NestJS，可选）
│       ├── src/
│       ├── test/
│       ├── package.json
│       └── Dockerfile
├── gateway/                     # API 网关
│   └── openresty/
│       ├── nginx.conf
│       ├── conf.d/
│       ├── lua/
│       ├── tenants/
│       ├── policies/
│       ├── tests/
│       └── Dockerfile
├── iam/                         # 身份认证与授权
│   ├── keycloak/
│   │   ├── realms/
│   │   ├── clients/
│   │   ├── roles/
│   │   └── mappers/
│   ├── opa/
│   │   ├── policies/
│   │   ├── bundles/
│   │   └── tests/
│   └── vault/
│       ├── policies/
│       ├── auth/
│       └── engines/
├── services/                    # 微服务层
│   ├── control-plane/           # 控制面服务（Go Gin + gRPC）
│   │   ├── cmd/api/
│   │   ├── internal/
│   │   │   ├── app/
│   │   │   ├── domain/
│   │   │   ├── service/
│   │   │   ├── repository/
│   │   │   └── transport/
│   │   │       ├── http/
│   │   │       └── grpc/
│   │   ├── api/
│   │   │   ├── openapi/
│   │   │   └── proto/
│   │   ├── configs/
│   │   ├── tests/
│   │   └── Dockerfile
│   ├── health-worker/           # 健康检测服务
│   │   ├── cmd/worker/
│   │   ├── internal/
│   │   │   ├── checker/
│   │   │   ├── scheduler/
│   │   │   └── reporter/
│   │   ├── configs/
│   │   ├── tests/
│   │   └── Dockerfile
│   ├── data-services/           # 数据服务集合
│   │   ├── query-api/
│   │   ├── audit-api/
│   │   ├── export-api/
│   │   ├── shared/
│   │   └── Dockerfile
│   └── api-service/             # API 服务
│       ├── cmd/api/
│       ├── internal/
│       ├── api/openapi/
│       ├── configs/
│       └── Dockerfile
├── agents/                      # 采集代理
│   └── collector-agent/
│       ├── cmd/agent/
│       ├── internal/
│       │   ├── collector/
│       │   ├── pipeline/
│       │   ├── checkpoint/
│       │   └── retry/
│       ├── plugins/
│       │   ├── grpc/
│       │   └── wasm/
│       ├── configs/
│       ├── tests/
│       └── Dockerfile
├── stream/                      # 流计算
│   └── flink/
│       ├── jobs/
│       │   ├── sql/
│       │   └── cep/
│       ├── udf/
│       ├── libs/
│       ├── savepoints/
│       ├── configs/
│       └── tests/
├── messaging/                   # 消息传输
│   ├── kafka/
│   │   ├── topics/
│   │   ├── quotas/
│   │   └── broker-config/
│   ├── schema-registry/
│   │   ├── config/
│   │   └── compatibility-rules/
│   └── dlq-retry/
│       ├── retry-policies/
│       └── consumer-config/
├── contracts/                   # 契约定义
│   └── schema-contracts/
│       ├── avro/
│       ├── protobuf/
│       ├── jsonschema/
│       ├── compatibility/
│       └── tests/
├── storage/                     # 存储配置
│   ├── elasticsearch/
│   │   ├── index-templates/
│   │   ├── ilm-policies/
│   │   ├── ingest-pipelines/
│   │   └── snapshots/
│   ├── postgresql/
│   │   ├── migrations/
│   │   ├── seeds/
│   │   ├── rls-policies/
│   │   ├── patroni/
│   │   ├── etcd/
│   │   └── pgbouncer/
│   ├── redis/
│   │   ├── cluster-config/
│   │   └── lua-scripts/
│   ├── minio/
│   │   ├── buckets/
│   │   └── lifecycle/
│   └── glacier/
│       └── archive-policies/
├── observability/               # 可观测性
│   ├── prometheus/
│   │   ├── prometheus.yml
│   │   ├── rules/
│   │   └── targets/
│   ├── alertmanager/
│   │   ├── alertmanager.yml
│   │   └── templates/
│   ├── grafana/
│   │   ├── dashboards/
│   │   └── datasources/
│   ├── jaeger/
│   │   └── config/
│   ├── otel-collector/
│   │   └── config/
│   └── loki/
│       └── config/
├── ml/                          # 机器学习（可选）
│   ├── training/
│   ├── inference/
│   ├── models/
│   ├── mlflow/
│   └── nlp/
│       ├── prompts/
│       └── rules/
├── edge/                        # 边缘计算（可选）
│   ├── mqtt/
│   ├── sqlite/
│   └── boltdb/
├── platform/                    # 平台治理
│   ├── kubernetes/
│   │   ├── base/
│   │   ├── namespaces/
│   │   ├── rbac/
│   │   ├── network-policies/
│   │   └── storageclasses/
│   ├── helm/
│   │   ├── nexuslog-gateway/
│   │   ├── nexuslog-control-plane/
│   │   ├── nexuslog-data-plane/
│   │   ├── nexuslog-storage/
│   │   └── nexuslog-observability/
│   ├── gitops/
│   │   ├── argocd/
│   │   │   ├── projects/
│   │   │   └── applicationsets/
│   │   ├── apps/
│   │   │   ├── ingress-system/
│   │   │   ├── iam-system/
│   │   │   ├── control-plane/
│   │   │   ├── data-plane/
│   │   │   ├── storage-system/
│   │   │   └── observability/
│   │   └── clusters/
│   │       ├── dev/
│   │       ├── staging/
│   │       └── prod/
│   ├── ci/
│   │   ├── templates/
│   │   └── scripts/
│   ├── security/
│   │   ├── trivy/
│   │   ├── sast/
│   │   └── image-sign/
│   └── istio/
│       ├── gateways/
│       ├── virtualservices/
│       └── destinationrules/
├── infra/                       # 基础设施即代码
│   ├── terraform/
│   │   ├── modules/
│   │   └── envs/
│   │       ├── dev/
│   │       ├── staging/
│   │       └── prod/
│   └── ansible/
│       ├── inventories/
│       └── roles/
├── scripts/                     # 脚本工具
│   ├── bootstrap.sh
│   ├── lint.sh
│   ├── test.sh
│   ├── build.sh
│   ├── release.sh
│   └── rollback.sh
├── tests/                       # 集成/E2E/性能/混沌测试
│   ├── e2e/
│   ├── integration/
│   ├── performance/
│   └── chaos/
└── .github/
    └── workflows/               # CI/CD 流水线
```

### 路线图进度（截至 2026-02-27）

- 已完成：18 / 24（MVP 与 P1 阶段任务已完成）
- 待开始：6 / 24（任务 19-24：ML/NLP、边缘计算、高级治理、性能与混沌、安全扫描、文档体系完善）

### 模块建设状态（按路线图）

| 目录 | 用途 | 当前状态 |
|------|------|----------|
| `iam/` | 身份认证与授权 (Keycloak + OPA + Vault) | 已完成（P1-8） |
| `agents/` | 采集代理 (Go Collector Agent) | 已完成（P1-9） |
| `stream/` | 流计算 (Flink SQL + CEP) | 已完成（P1-10） |
| `messaging/` | 消息传输 (Kafka + Schema Registry) | 已完成（P1-10） |
| `contracts/` | 契约定义 (Avro / Protobuf / JSON Schema) | 已完成（P1-10） |
| `storage/` | 存储配置 (ES + PG + Redis + MinIO) | 已完成（P1-11） |
| `observability/` | 可观测性 (Prometheus + Grafana + Jaeger) | 已完成（P1-12） |
| `platform/` | 平台治理 (K8s + Helm + GitOps + Istio) | P1 核心完成；高级治理待 P2（任务 21） |
| `infra/` | 基础设施即代码 (Terraform + Ansible) | 已完成（P1-15） |
| `ml/` | 机器学习与 NLP (可选) | P2 规划中（任务 19，已建立目录骨架） |
| `edge/` | 边缘计算 (可选) | P2 规划中（任务 20，已建立目录骨架） |

## 快速开始

### 前置条件

- Node.js 20 LTS
- pnpm 9.x (`corepack enable && corepack prepare pnpm@9 --activate`)
- Go 1.22+
- Docker & Docker Compose

### Docker 一键启动（推荐）

```bash
# 1) 加载并导出镜像源配置
set -a && source .env.mirrors && set +a

# 2) 启动全部服务
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.override.yml"
$COMPOSE pull
$COMPOSE up -d

# 3) 查看运行状态
$COMPOSE ps
```

也可以直接使用默认入口（会自动加载 `docker-compose.override.yml`）：

```bash
set -a && source .env.mirrors && set +a && docker compose up -d
set -a && source .env.mirrors && set +a && docker compose ps
```

如需清理并重建（会删除持久化数据卷）：

```bash
set -a && source .env.mirrors && set +a
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.override.yml"
$COMPOSE down --volumes --remove-orphans
$COMPOSE pull
$COMPOSE build
$COMPOSE up -d
```

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

### 数据库迁移（单一入口）

运行时迁移唯一目录：`storage/postgresql/migrations`  
统一执行入口：`make db-migrate-*`（底层调用 `scripts/db-migrate.sh`）

```bash
# 设置数据库连接（优先 DB_DSN，兼容 DATABASE_URL）
export DB_DSN="postgres://nexuslog:nexuslog_dev@localhost:5432/nexuslog?sslmode=disable"

# 查看当前迁移版本
make db-migrate-version

# 执行迁移
make db-migrate-up

# 回滚 1 个版本
make db-migrate-down STEPS=1

# 创建新迁移（只会生成到 storage/postgresql/migrations）
make db-migrate-create NAME=add_xxx
```

说明：`docs/NexusLog/database/sql` 下文件属于设计/历史参考，不作为运行时迁移入口。
执行态基线：见 `docs/NexusLog/process/17-migration-execution-state-baseline.md`（区分“文件存在态”与“环境执行态”）。

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

## 前端测试准备（用户手动执行）

### 前端调试强制规则

- 任何涉及前端页面内容的任务（页面渲染、交互行为、路由跳转、接口联调、控制台报错）都必须使用 `chrome-devtools` MCP 工具进行调试与验证。
- 未通过 `chrome-devtools` MCP 复现并采集证据（至少包含 URL、Console、Network）的结论，视为无效结论。
- 交付结果中应明确记录调试页面地址、复现步骤、关键请求与控制台信息。

Claude 提示用户启动 Chrome 调试模式：
```bash
# 启动 Chrome（带远程调试）
google-chrome --remote-debugging-port=9222 --disable-gpu \
    --no-sandbox --user-data-dir=/tmp/chrome-debug http://localhost:3000/ &

# 或使用 headless 模式
google-chrome --headless --remote-debugging-port=9222 --disable-gpu \
    --no-sandbox --user-data-dir=/tmp/chrome-debug http://localhost:3000/ &
```

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

# NexusLog

企业级日志管理系统 - 基于业务域+平台域分层的 Monorepo 全栈架构

## 项目概述

NexusLog 是一个企业级日志管理平台，采用 Monorepo 架构组织代码，包含前端控制台、多个 Go 微服务、API 网关、IAM 安全体系、消息传输、流计算、存储层、可观测性、平台治理等完整域。

## 技术栈

| 层级 | 技术选型 |
|------|----------|
| 前端 | React 19 + TypeScript + Ant Design 5.x + ECharts 5.x + Zustand 4.x |
| API 网关 | OpenResty (Nginx + Lua) |
| 微服务 | Go 1.22+ (Gin + gRPC) |
| 消息队列 | Kafka 3.7+ |
| 流计算 | Flink 1.19+ |
| 搜索存储 | Elasticsearch 8.13+ |
| 关系数据库 | PostgreSQL 16+ (Patroni HA) |
| 缓存 | Redis Cluster 7.2+ |
| 对象存储 | MinIO / S3 |
| 身份认证 | Keycloak 24+ |
| 策略控制 | OPA 0.6x+ |
| 密钥管理 | Vault 1.15+ |
| 容器编排 | Kubernetes 1.28+ |
| GitOps | Argo CD 2.1x+ |
| 监控 | Prometheus + Grafana + Alertmanager |
| 链路追踪 | Jaeger + OTel Collector |

## 目录结构

```
NexusLog/
├── apps/                    # 应用层
│   ├── frontend-console/    # 前端控制台 (React + TS + AntD)
│   └── bff-service/         # BFF 层 (NestJS, 可选)
├── services/                # 微服务层
│   ├── control-plane/       # 控制面服务 (Go Gin + gRPC)
│   ├── health-worker/       # 健康检测服务
│   ├── data-services/       # 数据服务集合
│   └── api-service/         # API 服务
├── gateway/                 # API 网关 (OpenResty)
├── iam/                     # 身份认证与授权
│   ├── keycloak/            # Keycloak 配置
│   ├── opa/                 # OPA 策略
│   └── vault/               # Vault 配置
├── agents/                  # 采集代理
│   └── collector-agent/     # 日志采集代理
├── stream/                  # 流计算 (Flink)
├── messaging/               # 消息传输 (Kafka)
├── contracts/               # 契约定义 (Schema)
├── storage/                 # 存储配置
├── observability/           # 可观测性
├── platform/                # 平台治理
├── infra/                   # 基础设施即代码
├── ml/                      # 机器学习 (可选)
├── edge/                    # 边缘计算 (可选)
├── configs/                 # 公共配置
│   ├── common/              # 通用配置
│   ├── dev/                 # 开发环境
│   ├── staging/             # 预发布环境
│   └── prod/                # 生产环境
├── docs/                    # 项目文档
├── scripts/                 # 脚本工具
└── tests/                   # 集成/E2E/性能/混沌测试
```

## 快速开始

### 前置条件

- Node.js 20 LTS
- pnpm 9.x
- Go 1.22+
- Docker & Docker Compose

### 安装依赖

```bash
# 初始化项目
make bootstrap

# 或手动安装
pnpm install              # 前端依赖
go work sync              # Go 模块同步
```

### 开发命令

```bash
# 代码检查
make lint

# 运行测试
make test

# 构建项目
make build

# 发布
make release
```

## 变更管理

所有配置变更遵循三级审批体系：

| 级别 | 审批要求 | 适用场景 |
|------|----------|----------|
| none | 值班负责人备案 | 监控规则、Dashboard、健康检测阈值 |
| normal | 技术负责人审批 | 服务配置、API 变更、前端发版 |
| cab | CAB 委员会审批 | 认证链路、存储拓扑、网关策略、密钥证书 |

详见 [变更管理规范](docs/change-management.md)

## 文档

- [系统架构](docs/architecture/)
- [架构决策记录](docs/adr/)
- [运维手册](docs/runbooks/)
- [SLA/SLO](docs/sla-slo/)

## 许可证

[MIT License](LICENSE)

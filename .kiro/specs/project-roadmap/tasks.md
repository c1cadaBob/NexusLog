# 实施计划：NexusLog 项目总体规划

## 概述

按 MVP → P1 → P2 三阶段递进交付。MVP 阶段的前端迁移详细任务由 `.kiro/specs/frontend-migration/tasks.md` 承载，本文档聚焦项目级骨架搭建和 P1/P2 阶段的基础设施配置任务。

## 任务

---

### MVP 阶段

---

- [x] 1. Monorepo 骨架和前端迁移（详见 frontend-migration spec）
  - [x] 1.1 创建 Monorepo 根目录结构和根配置文件
    - 创建 `README.md`、`LICENSE`、`CHANGELOG.md`、`.gitignore`、`.editorconfig`
    - 创建 `Makefile`（统一构建/测试命令入口）
    - 创建 `go.work`（引用 services/ 和 agents/ 下的 Go 模块）
    - 创建 `package.json`（pnpm workspace，引用 apps/ 下的前端项目）
    - 创建 `configs/common/`、`configs/dev/`、`configs/staging/`、`configs/prod/`（三环境目录结构一致）
    - _需求: 1_
  - [x] 1.2 创建项目文档体系目录结构
    - 创建 `docs/architecture/`（含 5 篇架构文档模板）
    - 创建 `docs/adr/ADR-0001-monorepo.md`
    - 创建 `docs/runbooks/`、`docs/oncall/`、`docs/security/`、`docs/sla-slo/` 目录
    - 创建变更管理规范文档（三级审批体系 + CAB 判定规则 + 风险评分矩阵）
    - _需求: 6_
  - [x] 1.3 创建脚本和测试目录
    - 创建 `scripts/`（bootstrap.sh、lint.sh、test.sh、build.sh、release.sh、rollback.sh）
    - 创建 `tests/e2e/`、`tests/integration/`、`tests/performance/`、`tests/chaos/` 目录
    - _需求: 1_
  - [x] 1.4 前端控制台迁移（由 frontend-migration spec 承载）
    - 参见 `.kiro/specs/frontend-migration/tasks.md` 中的任务 2-11
    - 包含：项目初始化、技术栈配置、组件迁移、页面迁移、状态管理、路由配置
    - _需求: 2_

- [ ] 2. 后端微服务骨架搭建
  - [x] 2.1 创建 Control Plane 服务骨架
    - 创建 `services/control-plane/` 目录结构：`cmd/api/main.go`、`internal/`（app/domain/service/repository/transport/）、`api/`（openapi/proto/）、`configs/`、`tests/`
    - 创建 `Dockerfile`（多阶段构建）
    - 创建 `go.mod`（模块名 `github.com/nexuslog/control-plane`）
    - 实现基础 Gin HTTP Server 和健康检查端点 `/healthz`
    - _需求: 3_
  - [x] 2.2 创建 Health Worker 服务骨架
    - 创建 `services/health-worker/` 目录结构：`cmd/worker/main.go`、`internal/`（checker/scheduler/reporter/）、`configs/`、`tests/`
    - 创建 `Dockerfile` 和 `go.mod`
    - 实现基础 Worker 启动框架和健康检查端点
    - _需求: 3_
  - [x] 2.3 创建 Data Services 服务骨架
    - 创建 `services/data-services/` 目录结构：`query-api/`、`audit-api/`、`export-api/`、`shared/`
    - 每个子服务包含 `cmd/`、`internal/`、`configs/`、`tests/`、`Dockerfile`、`go.mod`
    - 实现各子服务的基础 HTTP Server 和健康检查端点
    - _需求: 3_
  - [x] 2.4 创建 API Service 服务骨架
    - 创建 `services/api-service/` 目录结构：`cmd/api/main.go`、`internal/`、`api/openapi/`、`configs/`
    - 创建 `Dockerfile` 和 `go.mod`
    - 实现基础 Gin HTTP Server 和健康检查端点
    - _需求: 3_

- [x] 3. 基础部署配置
  - [x] 3.1 创建 docker-compose.yml 本地开发环境
    - 定义前端、后端服务、PostgreSQL、Redis、Elasticsearch、Kafka 等容器
    - 配置网络、卷挂载和环境变量
    - _需求: 4_
  - [x] 3.2 创建基础 Kubernetes 部署清单
    - 在 `platform/kubernetes/base/` 下创建各服务的 Deployment、Service、ConfigMap
    - 创建 Namespace 和 RBAC 基础配置
    - _需求: 4_
  - [x] 3.3 创建前端多阶段构建 Dockerfile
    - 阶段 1：pnpm install + build
    - 阶段 2：nginx 静态服务
    - 配置 nginx.conf 支持 SPA 路由
    - _需求: 4_

- [x] 4. 基础 CI/CD 流水线
  - [x] 4.1 创建前端 CI 工作流
    - `.github/workflows/frontend-ci.yml`
    - 步骤：pnpm install → 类型检查 → lint → 单元测试 → 构建
    - _需求: 5_
  - [x] 4.2 创建后端 CI 工作流
    - `.github/workflows/backend-ci.yml`
    - 步骤：Go mod download → lint → 单元测试 → 构建
    - _需求: 5_
  - [x] 4.3 创建镜像构建推送工作流
    - `.github/workflows/docker-build.yml`
    - 步骤：构建各服务镜像 → 推送到 Harbor/GHCR
    - _需求: 5_

- [x] 5. 配置热更新机制
  - [x] 5.1 实现前端运行时配置加载
    - 创建 `public/config/app-config.json` 配置文件
    - 实现 `src/config/runtime-config.ts` 配置加载器
    - 页面刷新时自动加载最新配置
    - _需求: 7_
  - [x] 5.2 创建后端配置模板和 file watcher 接口
    - 在各服务 `configs/` 下创建配置模板，标注 `change_level` 字段
    - 定义 file watcher 接口（`internal/config/watcher.go`）
    - _需求: 7_

- [x] 6. MVP 阶段属性测试
  - [x] 6.1 属性测试：Monorepo 结构完整性（CP-1）
    - 验证所有必需顶层目录存在且包含预期子目录
    - 工具：Go testing + rapid 或 shell 脚本验证
    - _需求: 1_
  - [x] 6.2 属性测试：环境配置对称性（CP-4）
    - 验证 dev/staging/prod 三环境目录文件结构一致
    - _需求: 1_
  - [x] 6.3 属性测试：Go 服务目录规范性（CP-6）
    - 验证每个 Go 服务包含 cmd/、internal/、configs/、tests/、Dockerfile
    - _需求: 3_

---

### P1 阶段

---

- [x] 7. API 网关配置
  - [x] 7.1 创建 OpenResty 基础配置
    - 创建 `gateway/openresty/` 目录结构：`conf/`、`lua/`、`Dockerfile`
    - 配置 nginx.conf 反向代理路由规则
    - _需求: 8_
  - [x] 7.2 实现 Lua 认证和限流脚本
    - 创建 JWT 认证校验 Lua 脚本
    - 创建请求限流 Lua 脚本
    - 创建请求日志记录 Lua 脚本
    - _需求: 8_
  - [x] 7.3 配置多租户路由
    - 实现基于 Header/Path 的多租户路由策略
    - _需求: 8_

- [x] 8. IAM 安全体系
  - [x] 8.1 配置 Keycloak
    - 创建 `iam/keycloak/` 目录：realm-config/、themes/、Dockerfile
    - 定义 Realm 配置（用户注册、登录、Token 刷新、SSO）
    - _需求: 9_
  - [x] 8.2 配置 OPA 授权策略
    - 创建 `iam/opa/` 目录：policies/、bundles/、Dockerfile
    - 定义 RBAC 授权策略（Rego 语言）
    - _需求: 9_
  - [x] 8.3 配置 Vault 密钥管理
    - 创建 `iam/vault/` 目录：config/、policies/、Dockerfile
    - 定义数据库凭证和 API 密钥的动态生成策略
    - _需求: 9_

- [x] 9. 日志采集代理
  - [x] 9.1 创建 Collector Agent 项目结构
    - 创建 `agents/collector-agent/` 目录：cmd/agent/、internal/、plugins/、configs/、tests/、Dockerfile
    - 创建 `go.mod`
    - _需求: 10_
  - [x] 9.2 实现采集代理核心框架
    - 实现插件化架构（gRPC + WASM 插件接口）
    - 实现 checkpoint 机制（at-least-once 语义）
    - 实现重试策略和本地缓存
    - 实现 Kafka Producer 发送逻辑
    - _需求: 10_

- [x] 10. 消息传输和流计算配置
  - [x] 10.1 配置 Kafka 和 Schema Registry
    - 创建 `messaging/kafka/` 目录：topics/、configs/、Dockerfile
    - 定义核心 Topic（日志采集、告警事件、审计日志）
    - 创建 `messaging/schema-registry/` 配置
    - 配置死信队列和重试策略
    - _需求: 11_
  - [x] 10.2 配置 Schema 契约
    - 创建 `contracts/schema-contracts/` 目录
    - 定义 Avro/Protobuf Schema
    - 配置 CI 兼容性校验
    - _需求: 11_
  - [x] 10.3 配置 Flink 流计算作业
    - 创建 `stream/flink-jobs/` 目录：sql/、cep/、configs/、Dockerfile
    - 定义 Flink SQL 聚合作业
    - 定义 Flink CEP 模式检测作业
    - _需求: 11_

- [x] 11. 存储层配置
  - [x] 11.1 配置 Elasticsearch
    - 创建 `storage/elasticsearch/` 目录：templates/、ilm/、configs/
    - 定义索引模板和映射
    - 定义 ILM 策略（热温冷归档）
    - _需求: 12_
  - [x] 11.2 配置 PostgreSQL
    - 创建 `storage/postgresql/` 目录：migrations/、rls/、configs/
    - 定义数据库迁移脚本（元数据表结构）
    - 定义 RLS 策略
    - 配置 Patroni + etcd 高可用
    - _需求: 12_
  - [x] 11.3 配置 Redis 和 MinIO
    - 创建 `storage/redis/` 配置（Cluster 模式、TTL 规则）
    - 创建 `storage/minio/` 配置（存储桶、生命周期策略）
    - _需求: 12_

- [x] 12. 可观测性体系配置
  - [x] 12.1 配置 Prometheus 和 Alertmanager
    - 创建 `observability/prometheus/` 配置（服务发现、抓取规则）
    - 创建 `observability/alertmanager/` 配置（告警路由、通知渠道）
    - _需求: 13_
  - [x] 12.2 配置 Grafana Dashboard
    - 创建 `observability/grafana/` 配置
    - 定义系统概览、各服务详情、存储层监控面板
    - _需求: 13_
  - [x] 12.3 配置链路追踪和日志聚合
    - 创建 `observability/jaeger/` 和 `observability/otel-collector/` 配置
    - 创建 `observability/loki/` 配置
    - _需求: 13_

- [x] 13. 变更管理体系
  - [x] 13.1 创建变更管理规范文档
    - 定义三级审批体系详细规则
    - 定义 CAB 判定规则表（7 条硬规则）
    - 定义风险评分矩阵（5 维度 0-3 分）
    - 定义回滚 SLA
    - _需求: 14_
  - [x] 13.2 创建变更单模板
    - 包含风险评分自动计算规则
    - 包含 CAB 自动路由逻辑
    - 包含非窗口发布判定规则
    - _需求: 14_

- [x] 14. 完整测试体系
  - [x] 14.1 配置集成测试框架
    - 在 `tests/integration/` 下创建测试框架配置
    - 配置 docker-compose 测试环境
    - _需求: 15_
  - [x] 14.2 配置 E2E 测试框架
    - 在 `tests/e2e/` 下配置 Playwright
    - 创建基础测试用例模板
    - _需求: 15_
  - [x] 14.3 集成安全扫描到 CI
    - 在 CI 流水线中添加 Trivy 镜像扫描步骤
    - _需求: 15_

- [x] 15. 基础设施即代码
  - [x] 15.1 创建 Terraform 模块结构
    - 创建 `infra/terraform/modules/`（kubernetes、network、storage 模块）
    - 创建 `infra/terraform/envs/`（dev/、staging/、prod/）
    - _需求: 16_
  - [x] 15.2 创建 Ansible 角色结构
    - 创建 `infra/ansible/inventories/`（dev、staging、prod）
    - 创建 `infra/ansible/roles/`（server-init、security-hardening）
    - _需求: 16_

- [x] 16. GitOps 和 Helm Charts
  - [x] 16.1 创建 Argo CD 配置
    - 创建 `platform/gitops/argocd/` Application 配置模板
    - 创建 `platform/gitops/apps/` 各系统应用定义
    - 创建 `platform/gitops/clusters/` 集群配置（dev/staging/prod）
    - _需求: 17_
  - [x] 16.2 创建 Helm Charts
    - 创建 `platform/helm/` 下的 Charts：nexuslog-gateway、nexuslog-control-plane、nexuslog-data-plane、nexuslog-storage、nexuslog-observability
    - _需求: 17_
  - [x] 16.3 集成 Harbor 制品仓库
    - 在 CI 流水线中添加 Harbor 推送步骤
    - _需求: 17_

- [ ] 17. BFF 服务层（可选）
  - [ ] 17.1 创建 BFF Service 项目结构
    - 创建 `apps/bff-service/` 目录：src/、configs/、tests/、Dockerfile、package.json
    - 安装 NestJS + Node 20 LTS 依赖
    - _需求: 18_
  - [ ] 17.2 实现 BFF 聚合逻辑
    - 实现 API 聚合（Control Plane + API Service + Data Services）
    - 实现请求缓存和数据转换
    - 配置 Gateway 路由到 BFF
    - _需求: 18_

- [ ] 18. P1 阶段属性测试
  - [ ] 18.1 属性测试：变更级别标注完整性（CP-9）
    - 验证所有组件配置模板包含 change_level 字段且取值合法
    - _需求: 7, 14_
  - [ ] 18.2 属性测试：Schema 契约兼容性（CP-10）
    - 验证 Schema 定义通过向后兼容性校验
    - _需求: 11_
  - [ ] 18.3 属性测试：CI 流水线覆盖性（CP-8）
    - 验证 GitHub Actions 工作流覆盖前端、后端、镜像三条流水线
    - _需求: 5_

---

### P2 阶段

---

- [ ] 19. 机器学习和 NLP 集成
  - [ ] 19.1 创建 ML 项目结构
    - 创建 `ml/anomaly-detection/`、`ml/log-classifier/`、`ml/nlp-query/` 目录结构
    - 配置 Python 虚拟环境和依赖（sklearn、PyTorch、ONNX）
    - _需求: 19_
  - [ ] 19.2 配置 MLflow 和 ONNX Runtime
    - 配置 MLflow 实验跟踪和模型注册表
    - 配置 ONNX Runtime 推理服务
    - _需求: 19_

- [ ] 20. 边缘计算支持
  - [ ] 20.1 创建边缘计算项目结构
    - 创建 `edge/edge-agent/`、`edge/edge-gateway/`、`edge/edge-store/` 目录结构
    - _需求: 20_
  - [ ] 20.2 实现边缘代理核心功能
    - 实现 MQTT 5.0 协议通信
    - 实现本地存储适配层（SQLite/BoltDB）
    - 实现断点续传和自动同步
    - _需求: 20_

- [ ] 21. 高级平台治理
  - [ ] 21.1 配置 Istio 服务网格
    - 创建 `platform/istio/` 配置（VirtualService、DestinationRule、AuthorizationPolicy）
    - 配置 mTLS 和流量管理策略
    - _需求: 21_
  - [ ] 21.2 配置 pgvector 向量检索
    - 配置 PostgreSQL pgvector 扩展
    - 定义向量索引和语义检索接口
    - _需求: 21_

- [ ] 22. 性能优化和混沌测试
  - [ ] 22.1 创建性能测试脚本
    - 在 `tests/performance/` 下创建 k6/Locust 测试脚本
    - 定义性能基线指标
    - _需求: 22_
  - [ ] 22.2 创建混沌测试场景
    - 在 `tests/chaos/` 下创建 Chaos Mesh 场景定义
    - 覆盖网络分区、Pod 故障、存储故障
    - _需求: 22_
  - [ ] 22.3 集成性能回归测试到 CI
    - 在 CI 流水线中添加性能回归检测
    - 配置 10% 劣化阈值阻断规则
    - _需求: 22_

- [ ] 23. 高级安全扫描
  - [ ] 23.1 集成 SAST 和 DAST 扫描
    - 在 CI 流水线中添加 SAST 扫描步骤
    - 在 CI 流水线中添加 DAST 扫描步骤
    - _需求: 23_
  - [ ] 23.2 配置安全扫描策略
    - 定义漏洞分级处理规则（Critical/High 阻断、Medium 工单、Low 记录）
    - 集成依赖漏洞扫描和容器镜像扫描
    - _需求: 23_

- [ ] 24. 文档体系完善
  - [ ] 24.1 完善架构文档
    - 完善 `docs/architecture/` 下全部 5 篇架构文档
    - _需求: 24_
  - [ ] 24.2 创建运维手册和规范文档
    - 创建 `docs/runbooks/` 下至少 10 个运维手册
    - 创建 `docs/oncall/` 值班手册
    - 创建 `docs/sla-slo/` SLA/SLO 定义
    - 创建 `docs/security/` 安全规范
    - _需求: 24_
  - [ ] 24.3 配置文档站点生成
    - 配置 MkDocs/Docusaurus
    - 支持从 Markdown 生成可浏览文档站点
    - _需求: 24_

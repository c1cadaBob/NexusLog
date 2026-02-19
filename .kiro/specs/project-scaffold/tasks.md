# 实现计划：NexusLog 项目目录结构补全

## 概述

按照架构文档逐模块创建缺失的目录结构、配置模板和代码骨架。每个任务对应一个业务域模块，任务之间相互独立，可按顺序执行。

## 任务

- [x] 1. 创建 IAM（身份认证与授权）目录结构
  - 创建 `iam/keycloak/` 下的 `realms/`、`clients/`、`roles/`、`mappers/` 目录及 `.gitkeep`
  - 创建 `iam/opa/` 下的 `policies/`、`bundles/`、`tests/` 目录及 `.gitkeep`
  - 创建 `iam/vault/` 下的 `policies/`、`auth/`、`engines/` 目录及 `.gitkeep`
  - _需求: 1.1, 1.2, 1.3_

- [x] 2. 创建采集代理目录结构和代码骨架
  - [x] 2.1 创建 `agents/collector-agent/` 目录结构
    - 创建 `cmd/agent/`、`internal/collector/`、`internal/pipeline/`、`internal/checkpoint/`、`internal/retry/` 目录
    - 创建 `plugins/grpc/`、`plugins/wasm/` 目录
    - 创建 `configs/`、`tests/` 目录
    - 所有叶子目录放置 `.gitkeep`
    - _需求: 2.1, 2.2, 2.3_
  - [x] 2.2 生成采集代理的代码骨架文件
    - 创建 `agents/collector-agent/go.mod`（module 声明为 `github.com/nexuslog/collector-agent`，Go 1.23）
    - 创建 `agents/collector-agent/cmd/agent/main.go`（package main 基础入口）
    - 创建 `agents/collector-agent/Dockerfile`（Go 多阶段构建模板）
    - _需求: 2.4, 2.5_

- [x] 3. 创建流计算目录结构
  - 创建 `stream/flink/` 下的 `jobs/sql/`、`jobs/cep/`、`udf/`、`libs/`、`savepoints/`、`configs/`、`tests/` 目录及 `.gitkeep`
  - _需求: 3.1_

- [x] 4. 创建消息传输目录结构
  - 创建 `messaging/kafka/` 下的 `topics/`、`quotas/`、`broker-config/` 目录及 `.gitkeep`
  - 创建 `messaging/schema-registry/` 下的 `config/`、`compatibility-rules/` 目录及 `.gitkeep`
  - 创建 `messaging/dlq-retry/` 下的 `retry-policies/`、`consumer-config/` 目录及 `.gitkeep`
  - _需求: 4.1, 4.2, 4.3_

- [x] 5. 创建契约定义目录结构
  - 创建 `contracts/schema-contracts/` 下的 `avro/`、`protobuf/`、`jsonschema/`、`compatibility/`、`tests/` 目录及 `.gitkeep`
  - _需求: 5.1_

- [x] 6. 创建存储配置目录结构
  - 创建 `storage/elasticsearch/` 下的 `index-templates/`、`ilm-policies/`、`ingest-pipelines/`、`snapshots/` 目录及 `.gitkeep`
  - 创建 `storage/postgresql/` 下的 `migrations/`、`seeds/`、`rls-policies/`、`patroni/`、`etcd/`、`pgbouncer/` 目录及 `.gitkeep`
  - 创建 `storage/redis/` 下的 `cluster-config/`、`lua-scripts/` 目录及 `.gitkeep`
  - 创建 `storage/minio/` 下的 `buckets/`、`lifecycle/` 目录及 `.gitkeep`
  - 创建 `storage/glacier/` 下的 `archive-policies/` 目录及 `.gitkeep`
  - _需求: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 7. 创建可观测性目录结构和配置模板
  - [x] 7.1 创建可观测性子目录结构
    - 创建 `observability/prometheus/rules/`、`observability/prometheus/targets/` 目录及 `.gitkeep`
    - 创建 `observability/grafana/dashboards/`、`observability/grafana/datasources/` 目录及 `.gitkeep`
    - 创建 `observability/jaeger/config/`、`observability/otel-collector/config/`、`observability/loki/config/` 目录及 `.gitkeep`
    - 创建 `observability/alertmanager/templates/` 目录及 `.gitkeep`
    - _需求: 7.3, 7.4, 7.5, 7.6_
  - [x] 7.2 生成可观测性配置模板文件
    - 创建 `observability/prometheus/prometheus.yml`（带中文注释的 Prometheus 配置模板）
    - 创建 `observability/alertmanager/alertmanager.yml`（带中文注释的 Alertmanager 配置模板）
    - _需求: 7.1, 7.2_

- [x] 8. 检查点 - 确认核心基础设施目录已创建
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 9. 创建 ML 和边缘计算目录结构（可选模块）
  - 创建 `ml/` 下的 `training/`、`inference/`、`models/`、`mlflow/`、`nlp/prompts/`、`nlp/rules/` 目录及 `.gitkeep`
  - 创建 `edge/` 下的 `mqtt/`、`sqlite/`、`boltdb/` 目录及 `.gitkeep`
  - _需求: 8.1, 8.2_

- [x] 10. 创建平台治理目录结构
  - [x] 10.1 创建 Kubernetes 和 Helm 目录
    - 创建 `platform/kubernetes/` 下的 `base/`、`namespaces/`、`rbac/`、`network-policies/`、`storageclasses/` 目录及 `.gitkeep`
    - 创建 `platform/helm/` 下的 `nexuslog-gateway/`、`nexuslog-control-plane/`、`nexuslog-data-plane/`、`nexuslog-storage/`、`nexuslog-observability/` 目录及 `.gitkeep`
    - _需求: 9.1, 9.2_
  - [x] 10.2 创建 GitOps 目录
    - 创建 `platform/gitops/argocd/projects/`、`platform/gitops/argocd/applicationsets/` 目录及 `.gitkeep`
    - 创建 `platform/gitops/apps/` 下的 `ingress-system/`、`iam-system/`、`control-plane/`、`data-plane/`、`storage-system/`、`observability/` 目录及 `.gitkeep`
    - 创建 `platform/gitops/clusters/` 下的 `dev/`、`staging/`、`prod/` 目录及 `.gitkeep`
    - _需求: 9.3, 9.4_
  - [x] 10.3 创建 CI、安全和 Istio 目录
    - 创建 `platform/ci/templates/`、`platform/ci/scripts/` 目录及 `.gitkeep`
    - 创建 `platform/security/trivy/`、`platform/security/sast/`、`platform/security/image-sign/` 目录及 `.gitkeep`
    - 创建 `platform/istio/gateways/`、`platform/istio/virtualservices/`、`platform/istio/destinationrules/` 目录及 `.gitkeep`
    - _需求: 9.5, 9.6, 9.7_

- [x] 11. 创建基础设施即代码和 CI/CD 目录结构
  - 创建 `infra/terraform/modules/`、`infra/terraform/envs/dev/`、`infra/terraform/envs/staging/`、`infra/terraform/envs/prod/` 目录及 `.gitkeep`
  - 创建 `infra/ansible/inventories/`、`infra/ansible/roles/` 目录及 `.gitkeep`
  - 创建 `.github/workflows/` 目录及 `.gitkeep`
  - _需求: 10.1, 10.2, 11.1_

- [x] 12. 创建 BFF 服务目录结构和代码骨架
  - 创建 `apps/bff-service/src/`、`apps/bff-service/test/` 目录及 `.gitkeep`
  - 创建 `apps/bff-service/package.json`（NestJS 基础配置）
  - 创建 `apps/bff-service/Dockerfile`（Node.js 多阶段构建模板）
  - _需求: 12.1, 12.2_

- [x] 13. 补全现有服务内部目录结构
  - [x] 13.1 补全 control-plane 服务
    - 在 `services/control-plane/internal/transport/` 下创建 `http/`、`grpc/` 目录及 `.gitkeep`
    - 确保 `services/control-plane/api/openapi/`、`services/control-plane/api/proto/` 包含 `.gitkeep`
    - _需求: 13.1, 13.2_
  - [x] 13.2 补全 health-worker 服务
    - 确保 `services/health-worker/internal/checker/`、`services/health-worker/internal/scheduler/`、`services/health-worker/internal/reporter/` 包含 `.gitkeep`
    - _需求: 13.3_
  - [x] 13.3 补全 data-services 各子服务
    - 在 `services/data-services/audit-api/` 下创建 `cmd/`、`internal/`、`configs/` 目录及 `.gitkeep`
    - 在 `services/data-services/export-api/` 下创建 `cmd/`、`internal/`、`configs/` 目录及 `.gitkeep`
    - 在 `services/data-services/query-api/` 下创建 `cmd/`、`internal/`、`configs/` 目录及 `.gitkeep`
    - _需求: 13.4_

- [x] 14. 最终检查点 - 验证目录结构完整性
  - 确保所有测试通过，如有问题请向用户确认。

## 备注

- 所有空目录使用 `.gitkeep` 文件占位以确保 Git 追踪
- 配置模板文件包含中文注释说明
- Go 服务骨架确保可通过 `go build` 编译
- 不覆盖任何已存在的文件或目录
- 每个任务完成后需 git commit

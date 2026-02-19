# 需求文档：NexusLog 项目目录结构补全

## 简介

根据 NexusLog 架构文档，当前项目仓库缺少多个关键目录和配置文件。本需求旨在补全所有缺失的目录结构，包括 IAM、采集代理、流计算、消息传输、契约定义、存储配置、可观测性、平台治理、基础设施即代码等模块，使项目仓库结构与架构设计完全对齐。

## 术语表

- **Scaffold_Tool**: 用于创建目录和文件的脚本或代码生成工具
- **Directory_Creator**: 负责创建目录结构并放置占位文件的组件
- **Template_Generator**: 负责生成配置文件模板的组件
- **Structure_Validator**: 负责验证目录结构完整性的组件

## 需求

### 需求 1：IAM（身份认证与授权）目录结构

**用户故事：** 作为平台工程师，我希望项目中包含完整的 IAM 目录结构，以便管理 Keycloak、OPA 和 Vault 的配置文件。

#### 验收标准

1. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `iam/keycloak/` 下创建 `realms/`、`clients/`、`roles/`、`mappers/` 目录，每个目录包含 `.gitkeep` 文件
2. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `iam/opa/` 下创建 `policies/`、`bundles/`、`tests/` 目录，每个目录包含 `.gitkeep` 文件
3. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `iam/vault/` 下创建 `policies/`、`auth/`、`engines/` 目录，每个目录包含 `.gitkeep` 文件

### 需求 2：采集代理目录结构

**用户故事：** 作为平台工程师，我希望项目中包含采集代理的完整目录结构，以便开发和管理日志采集组件。

#### 验收标准

1. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `agents/collector-agent/` 下创建 `cmd/agent/`、`internal/collector/`、`internal/pipeline/`、`internal/checkpoint/`、`internal/retry/` 目录
2. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `agents/collector-agent/` 下创建 `plugins/grpc/`、`plugins/wasm/` 目录
3. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `agents/collector-agent/` 下创建 `configs/`、`tests/` 目录
4. WHEN Scaffold_Tool 执行完成, THE Template_Generator SHALL 在 `agents/collector-agent/` 下生成基础 `Dockerfile` 和 `go.mod` 文件
5. WHEN Scaffold_Tool 执行完成, THE Template_Generator SHALL 在 `agents/collector-agent/cmd/agent/` 下生成基础 `main.go` 入口文件

### 需求 3：流计算目录结构

**用户故事：** 作为数据工程师，我希望项目中包含 Flink 流计算的目录结构，以便管理流处理作业和 UDF。

#### 验收标准

1. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `stream/flink/` 下创建 `jobs/sql/`、`jobs/cep/`、`udf/`、`libs/`、`savepoints/`、`configs/`、`tests/` 目录，每个目录包含 `.gitkeep` 文件

### 需求 4：消息传输目录结构

**用户故事：** 作为平台工程师，我希望项目中包含消息传输相关的目录结构，以便管理 Kafka、Schema Registry 和死信队列的配置。

#### 验收标准

1. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `messaging/kafka/` 下创建 `topics/`、`quotas/`、`broker-config/` 目录，每个目录包含 `.gitkeep` 文件
2. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `messaging/schema-registry/` 下创建 `config/`、`compatibility-rules/` 目录，每个目录包含 `.gitkeep` 文件
3. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `messaging/dlq-retry/` 下创建 `retry-policies/`、`consumer-config/` 目录，每个目录包含 `.gitkeep` 文件

### 需求 5：契约定义目录结构

**用户故事：** 作为开发人员，我希望项目中包含契约定义的目录结构，以便管理 Avro、Protobuf、JSON Schema 等契约文件。

#### 验收标准

1. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `contracts/schema-contracts/` 下创建 `avro/`、`protobuf/`、`jsonschema/`、`compatibility/`、`tests/` 目录，每个目录包含 `.gitkeep` 文件

### 需求 6：存储配置目录结构

**用户故事：** 作为平台工程师，我希望项目中包含各存储组件的配置目录结构，以便管理 Elasticsearch、PostgreSQL、Redis、MinIO 和 Glacier 的配置。

#### 验收标准

1. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `storage/elasticsearch/` 下创建 `index-templates/`、`ilm-policies/`、`ingest-pipelines/`、`snapshots/` 目录，每个目录包含 `.gitkeep` 文件
2. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `storage/postgresql/` 下创建 `migrations/`、`seeds/`、`rls-policies/`、`patroni/`、`etcd/`、`pgbouncer/` 目录，每个目录包含 `.gitkeep` 文件
3. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `storage/redis/` 下创建 `cluster-config/`、`lua-scripts/` 目录，每个目录包含 `.gitkeep` 文件
4. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `storage/minio/` 下创建 `buckets/`、`lifecycle/` 目录，每个目录包含 `.gitkeep` 文件
5. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `storage/glacier/` 下创建 `archive-policies/` 目录，包含 `.gitkeep` 文件

### 需求 7：可观测性目录结构

**用户故事：** 作为 SRE 工程师，我希望项目中包含完整的可观测性目录结构和配置模板，以便管理监控、告警、追踪等组件。

#### 验收标准

1. WHEN Scaffold_Tool 执行完成, THE Template_Generator SHALL 在 `observability/prometheus/` 下生成带注释的 `prometheus.yml` 模板文件，并创建 `rules/`、`targets/` 目录
2. WHEN Scaffold_Tool 执行完成, THE Template_Generator SHALL 在 `observability/alertmanager/` 下生成带注释的 `alertmanager.yml` 模板文件，并创建 `templates/` 目录
3. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `observability/grafana/` 下创建 `dashboards/`、`datasources/` 目录，每个目录包含 `.gitkeep` 文件
4. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `observability/jaeger/` 下创建 `config/` 目录，包含 `.gitkeep` 文件
5. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `observability/otel-collector/` 下创建 `config/` 目录，包含 `.gitkeep` 文件
6. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `observability/loki/` 下创建 `config/` 目录，包含 `.gitkeep` 文件

### 需求 8：ML 和边缘计算目录结构（可选模块）

**用户故事：** 作为数据科学家，我希望项目中预留 ML 和边缘计算的目录结构，以便未来扩展智能分析和边缘采集能力。

#### 验收标准

1. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `ml/` 下创建 `training/`、`inference/`、`models/`、`mlflow/`、`nlp/prompts/`、`nlp/rules/` 目录，每个目录包含 `.gitkeep` 文件
2. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `edge/` 下创建 `mqtt/`、`sqlite/`、`boltdb/` 目录，每个目录包含 `.gitkeep` 文件

### 需求 9：平台治理目录结构

**用户故事：** 作为 DevOps 工程师，我希望项目中包含完整的平台治理目录结构，以便管理 Kubernetes、Helm、GitOps、CI、安全扫描和 Istio 配置。

#### 验收标准

1. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `platform/kubernetes/` 下创建 `base/`、`namespaces/`、`rbac/`、`network-policies/`、`storageclasses/` 目录，每个目录包含 `.gitkeep` 文件
2. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `platform/helm/` 下创建 `nexuslog-gateway/`、`nexuslog-control-plane/`、`nexuslog-data-plane/`、`nexuslog-storage/`、`nexuslog-observability/` 目录，每个目录包含 `.gitkeep` 文件
3. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `platform/gitops/argocd/` 下创建 `projects/`、`applicationsets/` 目录，并在 `platform/gitops/apps/` 下创建 `ingress-system/`、`iam-system/`、`control-plane/`、`data-plane/`、`storage-system/`、`observability/` 目录
4. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `platform/gitops/clusters/` 下创建 `dev/`、`staging/`、`prod/` 目录，每个目录包含 `.gitkeep` 文件
5. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `platform/ci/` 下创建 `templates/`、`scripts/` 目录，每个目录包含 `.gitkeep` 文件
6. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `platform/security/` 下创建 `trivy/`、`sast/`、`image-sign/` 目录，每个目录包含 `.gitkeep` 文件
7. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `platform/istio/` 下创建 `gateways/`、`virtualservices/`、`destinationrules/` 目录，每个目录包含 `.gitkeep` 文件

### 需求 10：基础设施即代码目录结构

**用户故事：** 作为基础设施工程师，我希望项目中包含 Terraform 和 Ansible 的目录结构，以便管理基础设施自动化配置。

#### 验收标准

1. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `infra/terraform/` 下创建 `modules/`、`envs/dev/`、`envs/staging/`、`envs/prod/` 目录，每个目录包含 `.gitkeep` 文件
2. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `infra/ansible/` 下创建 `inventories/`、`roles/` 目录，每个目录包含 `.gitkeep` 文件

### 需求 11：CI/CD 流水线目录结构

**用户故事：** 作为 DevOps 工程师，我希望项目中包含 GitHub Actions 工作流目录，以便管理 CI/CD 流水线配置。

#### 验收标准

1. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 创建 `.github/workflows/` 目录，包含 `.gitkeep` 文件

### 需求 12：BFF 服务目录结构（可选模块）

**用户故事：** 作为前端开发人员，我希望项目中预留 BFF 层的目录结构，以便未来实现前端聚合网关。

#### 验收标准

1. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `apps/bff-service/` 下创建 `src/`、`test/` 目录
2. WHEN Scaffold_Tool 执行完成, THE Template_Generator SHALL 在 `apps/bff-service/` 下生成基础 `package.json` 和 `Dockerfile` 文件

### 需求 13：现有服务内部结构补全

**用户故事：** 作为后端开发人员，我希望现有服务的内部目录结构与架构设计对齐，以便按照标准分层架构进行开发。

#### 验收标准

1. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `services/control-plane/internal/transport/` 下创建 `http/`、`grpc/` 目录，每个目录包含 `.gitkeep` 文件
2. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 确保 `services/control-plane/api/openapi/` 和 `services/control-plane/api/proto/` 目录存在并包含 `.gitkeep` 文件
3. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 确保 `services/health-worker/internal/checker/`、`services/health-worker/internal/scheduler/`、`services/health-worker/internal/reporter/` 目录存在并包含 `.gitkeep` 文件
4. WHEN Scaffold_Tool 执行完成, THE Directory_Creator SHALL 在 `services/data-services/` 的各子服务（`audit-api/`、`export-api/`、`query-api/`）下创建 `cmd/`、`internal/`、`configs/` 目录

### 需求 14：目录结构完整性验证

**用户故事：** 作为项目负责人，我希望能够验证目录结构的完整性，以确保所有架构文档中定义的目录都已正确创建。

#### 验收标准

1. THE Structure_Validator SHALL 验证所有必需目录均已创建，且空目录包含 `.gitkeep` 文件
2. THE Structure_Validator SHALL 验证所有配置模板文件（如 `prometheus.yml`、`alertmanager.yml`）均包含中文注释说明
3. THE Structure_Validator SHALL 验证所有 Go 服务目录包含有效的 `go.mod` 文件
4. THE Structure_Validator SHALL 验证所有 Dockerfile 模板包含基础构建阶段定义

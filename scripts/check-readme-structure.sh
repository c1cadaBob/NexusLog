#!/bin/bash
# 对比 README.md 中 Monorepo 项目结构与实际文件系统
# 基于 README 中的目录树逐项检查

SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(realpath "$SCRIPT_DIR/..")"
cd "$PROJECT_ROOT"

MISSING=0
FOUND=0

check() {
    local path="$1"
    local type="$2"  # d=目录, f=文件
    if [ "$type" = "d" ]; then
        if [ -d "$path" ]; then
            FOUND=$((FOUND + 1))
        else
            echo "  ✗ 目录缺失: $path"
            MISSING=$((MISSING + 1))
        fi
    else
        if [ -f "$path" ]; then
            FOUND=$((FOUND + 1))
        else
            echo "  ✗ 文件缺失: $path"
            MISSING=$((MISSING + 1))
        fi
    fi
}

echo "=========================================="
echo "README Monorepo 结构 vs 实际文件系统"
echo "=========================================="

echo ""
echo "--- 根目录文件 ---"
for f in README.md LICENSE CHANGELOG.md .gitignore .editorconfig Makefile go.work package.json; do
    check "$f" f
done

echo ""
echo "--- docs/ ---"
check "docs/architecture" d
check "docs/adr" d
check "docs/runbooks" d
check "docs/oncall" d
check "docs/security" d
check "docs/sla-slo" d

echo ""
echo "--- configs/ ---"
check "configs" d
check "configs/common" d
check "configs/dev" d
check "configs/staging" d
check "configs/prod" d

echo ""
echo "--- apps/frontend-console/ ---"
check "apps/frontend-console/src" d
check "apps/frontend-console/src/components" d
check "apps/frontend-console/src/components/charts" d
check "apps/frontend-console/src/components/common" d
check "apps/frontend-console/src/components/layout" d
check "apps/frontend-console/src/components/auth" d
check "apps/frontend-console/src/pages" d
check "apps/frontend-console/src/stores" d
check "apps/frontend-console/src/hooks" d
check "apps/frontend-console/src/services" d
check "apps/frontend-console/src/types" d
check "apps/frontend-console/src/utils" d
check "apps/frontend-console/src/constants" d
check "apps/frontend-console/src/config" d
check "apps/frontend-console/src/App.tsx" f
check "apps/frontend-console/src/main.tsx" f
check "apps/frontend-console/public" d
check "apps/frontend-console/public/config/app-config.json" f
check "apps/frontend-console/tests" d
check "apps/frontend-console/index.html" f
check "apps/frontend-console/vite.config.ts" f
check "apps/frontend-console/tsconfig.json" f
check "apps/frontend-console/package.json" f
check "apps/frontend-console/Dockerfile" f

echo ""
echo "--- apps/bff-service/ ---"
check "apps/bff-service/src" d
check "apps/bff-service/test" d
check "apps/bff-service/package.json" f
check "apps/bff-service/Dockerfile" f

echo ""
echo "--- gateway/openresty/ ---"
check "gateway/openresty/nginx.conf" f
check "gateway/openresty/conf.d" d
check "gateway/openresty/lua" d
check "gateway/openresty/tenants" d
check "gateway/openresty/policies" d
check "gateway/openresty/tests" d
check "gateway/openresty/Dockerfile" f

echo ""
echo "--- iam/ ---"
check "iam/keycloak/realms" d
check "iam/keycloak/clients" d
check "iam/keycloak/roles" d
check "iam/keycloak/mappers" d
check "iam/opa/policies" d
check "iam/opa/bundles" d
check "iam/opa/tests" d
check "iam/vault/policies" d
check "iam/vault/auth" d
check "iam/vault/engines" d

echo ""
echo "--- services/control-plane/ ---"
check "services/control-plane/cmd/api" d
check "services/control-plane/internal/app" d
check "services/control-plane/internal/domain" d
check "services/control-plane/internal/service" d
check "services/control-plane/internal/repository" d
check "services/control-plane/internal/transport/http" d
check "services/control-plane/internal/transport/grpc" d
check "services/control-plane/api/openapi" d
check "services/control-plane/api/proto" d
check "services/control-plane/configs" d
check "services/control-plane/tests" d
check "services/control-plane/Dockerfile" f

echo ""
echo "--- services/health-worker/ ---"
check "services/health-worker/cmd/worker" d
check "services/health-worker/internal/checker" d
check "services/health-worker/internal/scheduler" d
check "services/health-worker/internal/reporter" d
check "services/health-worker/configs" d
check "services/health-worker/tests" d
check "services/health-worker/Dockerfile" f

echo ""
echo "--- services/data-services/ ---"
check "services/data-services/query-api" d
check "services/data-services/audit-api" d
check "services/data-services/export-api" d
check "services/data-services/shared" d
check "services/data-services/Dockerfile" f

echo ""
echo "--- services/api-service/ ---"
check "services/api-service/cmd/api" d
check "services/api-service/internal" d
check "services/api-service/api/openapi" d
check "services/api-service/configs" d
check "services/api-service/Dockerfile" f

echo ""
echo "--- agents/collector-agent/ ---"
check "agents/collector-agent/cmd/agent" d
check "agents/collector-agent/internal/collector" d
check "agents/collector-agent/internal/pipeline" d
check "agents/collector-agent/internal/checkpoint" d
check "agents/collector-agent/internal/retry" d
check "agents/collector-agent/plugins/grpc" d
check "agents/collector-agent/plugins/wasm" d
check "agents/collector-agent/configs" d
check "agents/collector-agent/tests" d
check "agents/collector-agent/Dockerfile" f

echo ""
echo "--- stream/flink/ ---"
check "stream/flink/jobs/sql" d
check "stream/flink/jobs/cep" d
check "stream/flink/udf" d
check "stream/flink/libs" d
check "stream/flink/savepoints" d
check "stream/flink/configs" d
check "stream/flink/tests" d

echo ""
echo "--- messaging/ ---"
check "messaging/kafka/topics" d
check "messaging/kafka/quotas" d
check "messaging/kafka/broker-config" d
check "messaging/schema-registry/config" d
check "messaging/schema-registry/compatibility-rules" d
check "messaging/dlq-retry/retry-policies" d
check "messaging/dlq-retry/consumer-config" d

echo ""
echo "--- contracts/ ---"
check "contracts/schema-contracts/avro" d
check "contracts/schema-contracts/protobuf" d
check "contracts/schema-contracts/jsonschema" d
check "contracts/schema-contracts/compatibility" d
check "contracts/schema-contracts/tests" d

echo ""
echo "--- storage/ ---"
check "storage/elasticsearch/index-templates" d
check "storage/elasticsearch/ilm-policies" d
check "storage/elasticsearch/ingest-pipelines" d
check "storage/elasticsearch/snapshots" d
check "storage/postgresql/migrations" d
check "storage/postgresql/seeds" d
check "storage/postgresql/rls-policies" d
check "storage/postgresql/patroni" d
check "storage/postgresql/etcd" d
check "storage/postgresql/pgbouncer" d
check "storage/redis/cluster-config" d
check "storage/redis/lua-scripts" d
check "storage/minio/buckets" d
check "storage/minio/lifecycle" d
check "storage/glacier/archive-policies" d

echo ""
echo "--- observability/ ---"
check "observability/prometheus/prometheus.yml" f
check "observability/prometheus/rules" d
check "observability/prometheus/targets" d
check "observability/alertmanager/alertmanager.yml" f
check "observability/alertmanager/templates" d
check "observability/grafana/dashboards" d
check "observability/grafana/datasources" d
check "observability/jaeger/config" d
check "observability/otel-collector/config" d
check "observability/loki/config" d

echo ""
echo "--- ml/ ---"
check "ml/training" d
check "ml/inference" d
check "ml/models" d
check "ml/mlflow" d
check "ml/nlp/prompts" d
check "ml/nlp/rules" d

echo ""
echo "--- edge/ ---"
check "edge/mqtt" d
check "edge/sqlite" d
check "edge/boltdb" d

echo ""
echo "--- platform/ ---"
check "platform/kubernetes/base" d
check "platform/kubernetes/namespaces" d
check "platform/kubernetes/rbac" d
check "platform/kubernetes/network-policies" d
check "platform/kubernetes/storageclasses" d
check "platform/helm/nexuslog-gateway" d
check "platform/helm/nexuslog-control-plane" d
check "platform/helm/nexuslog-data-plane" d
check "platform/helm/nexuslog-storage" d
check "platform/helm/nexuslog-observability" d
check "platform/gitops/argocd/projects" d
check "platform/gitops/argocd/applicationsets" d
check "platform/gitops/apps/ingress-system" d
check "platform/gitops/apps/iam-system" d
check "platform/gitops/apps/control-plane" d
check "platform/gitops/apps/data-plane" d
check "platform/gitops/apps/storage-system" d
check "platform/gitops/apps/observability" d
check "platform/gitops/clusters/dev" d
check "platform/gitops/clusters/staging" d
check "platform/gitops/clusters/prod" d
check "platform/ci/templates" d
check "platform/ci/scripts" d
check "platform/security/trivy" d
check "platform/security/sast" d
check "platform/security/image-sign" d
check "platform/istio/gateways" d
check "platform/istio/virtualservices" d
check "platform/istio/destinationrules" d

echo ""
echo "--- infra/ ---"
check "infra/terraform/modules" d
check "infra/terraform/envs/dev" d
check "infra/terraform/envs/staging" d
check "infra/terraform/envs/prod" d
check "infra/ansible/inventories" d
check "infra/ansible/roles" d

echo ""
echo "--- scripts/ ---"
check "scripts/bootstrap.sh" f
check "scripts/lint.sh" f
check "scripts/test.sh" f
check "scripts/build.sh" f
check "scripts/release.sh" f
check "scripts/rollback.sh" f

echo ""
echo "--- tests/ ---"
check "tests/e2e" d
check "tests/integration" d
check "tests/performance" d
check "tests/chaos" d

echo ""
echo "--- .github/ ---"
check ".github/workflows" d

echo ""
echo "=========================================="
echo "检查完成: 已存在 $FOUND 项, 缺失 $MISSING 项"
echo "=========================================="
exit $MISSING

#!/bin/bash
# NexusLog 目录结构完整性验证脚本
cd "$(dirname "$0")/.."

ERRORS=0

check_dir() {
    if [ -d "$1" ]; then
        echo "  ✓ 目录: $1"
    else
        echo "  ✗ 目录缺失: $1"
        ERRORS=$((ERRORS + 1))
    fi
}

check_gitkeep() {
    if [ -f "$1/.gitkeep" ]; then
        true
    else
        echo "  ✗ .gitkeep 缺失: $1/"
        ERRORS=$((ERRORS + 1))
    fi
}

check_file() {
    if [ -f "$1" ]; then
        echo "  ✓ 文件: $1"
    else
        echo "  ✗ 文件缺失: $1"
        ERRORS=$((ERRORS + 1))
    fi
}

check_dir_gk() {
    check_dir "$1"
    check_gitkeep "$1"
}

echo "=========================================="
echo "NexusLog 目录结构完整性验证"
echo "=========================================="

echo ""
echo "--- 需求 1: IAM ---"
for d in iam/keycloak/realms iam/keycloak/clients iam/keycloak/roles iam/keycloak/mappers \
         iam/opa/policies iam/opa/bundles iam/opa/tests \
         iam/vault/policies iam/vault/auth iam/vault/engines; do
    check_dir_gk "$d"
done

echo ""
echo "--- 需求 2: 采集代理 ---"
for d in agents/collector-agent/cmd/agent agents/collector-agent/internal/collector \
         agents/collector-agent/internal/pipeline agents/collector-agent/internal/checkpoint \
         agents/collector-agent/internal/retry; do
    check_dir "$d"
done
for d in agents/collector-agent/plugins/grpc agents/collector-agent/plugins/wasm \
         agents/collector-agent/configs agents/collector-agent/tests; do
    check_dir_gk "$d"
done
check_file "agents/collector-agent/go.mod"
check_file "agents/collector-agent/cmd/agent/main.go"
check_file "agents/collector-agent/Dockerfile"

echo ""
echo "--- 需求 3: 流计算 ---"
for d in stream/flink/jobs/sql stream/flink/jobs/cep stream/flink/udf stream/flink/libs \
         stream/flink/savepoints stream/flink/configs stream/flink/tests; do
    check_dir_gk "$d"
done

echo ""
echo "--- 需求 4: 消息传输 ---"
for d in messaging/kafka/topics messaging/kafka/quotas messaging/kafka/broker-config \
         messaging/schema-registry/config messaging/schema-registry/compatibility-rules \
         messaging/dlq-retry/retry-policies messaging/dlq-retry/consumer-config; do
    check_dir_gk "$d"
done

echo ""
echo "--- 需求 5: 契约定义 ---"
for d in contracts/schema-contracts/avro contracts/schema-contracts/protobuf \
         contracts/schema-contracts/jsonschema contracts/schema-contracts/compatibility \
         contracts/schema-contracts/tests; do
    check_dir_gk "$d"
done

echo ""
echo "--- 需求 6: 存储配置 ---"
for d in storage/elasticsearch/index-templates storage/elasticsearch/ilm-policies \
         storage/elasticsearch/ingest-pipelines storage/elasticsearch/snapshots \
         storage/postgresql/migrations storage/postgresql/seeds storage/postgresql/rls-policies \
         storage/postgresql/patroni storage/postgresql/etcd storage/postgresql/pgbouncer \
         storage/redis/cluster-config storage/redis/lua-scripts \
         storage/minio/buckets storage/minio/lifecycle \
         storage/glacier/archive-policies; do
    check_dir_gk "$d"
done

echo ""
echo "--- 需求 7: 可观测性 ---"
for d in observability/prometheus/rules observability/prometheus/targets \
         observability/grafana/dashboards observability/grafana/datasources \
         observability/jaeger/config observability/otel-collector/config \
         observability/loki/config observability/alertmanager/templates; do
    check_dir_gk "$d"
done
check_file "observability/prometheus/prometheus.yml"
check_file "observability/alertmanager/alertmanager.yml"

echo ""
echo "--- 需求 8: ML 和边缘计算 ---"
for d in ml/training ml/inference ml/models ml/mlflow ml/nlp/prompts ml/nlp/rules \
         edge/mqtt edge/sqlite edge/boltdb; do
    check_dir_gk "$d"
done

echo ""
echo "--- 需求 9: 平台治理 ---"
for d in platform/kubernetes/base platform/kubernetes/namespaces platform/kubernetes/rbac \
         platform/kubernetes/network-policies platform/kubernetes/storageclasses \
         platform/helm/nexuslog-gateway platform/helm/nexuslog-control-plane \
         platform/helm/nexuslog-data-plane platform/helm/nexuslog-storage \
         platform/helm/nexuslog-observability \
         platform/gitops/argocd/projects platform/gitops/argocd/applicationsets \
         platform/gitops/apps/ingress-system platform/gitops/apps/iam-system \
         platform/gitops/apps/control-plane platform/gitops/apps/data-plane \
         platform/gitops/apps/storage-system platform/gitops/apps/observability \
         platform/gitops/clusters/dev platform/gitops/clusters/staging platform/gitops/clusters/prod \
         platform/ci/templates platform/ci/scripts \
         platform/security/trivy platform/security/sast platform/security/image-sign \
         platform/istio/gateways platform/istio/virtualservices platform/istio/destinationrules; do
    check_dir_gk "$d"
done

echo ""
echo "--- 需求 10: 基础设施即代码 ---"
for d in infra/terraform/modules infra/terraform/envs/dev infra/terraform/envs/staging \
         infra/terraform/envs/prod infra/ansible/inventories infra/ansible/roles; do
    check_dir_gk "$d"
done

echo ""
echo "--- 需求 11: CI/CD ---"
check_dir_gk ".github/workflows"

echo ""
echo "--- 需求 12: BFF 服务 ---"
check_dir "apps/bff-service/src"
check_dir "apps/bff-service/test"
check_file "apps/bff-service/package.json"
check_file "apps/bff-service/Dockerfile"

echo ""
echo "--- 需求 13: 现有服务补全 ---"
for d in services/control-plane/internal/transport/http services/control-plane/internal/transport/grpc \
         services/control-plane/api/openapi services/control-plane/api/proto \
         services/health-worker/internal/checker services/health-worker/internal/scheduler \
         services/health-worker/internal/reporter; do
    check_dir_gk "$d"
done
for svc in audit-api export-api query-api; do
    for sub in cmd internal configs; do
        check_dir_gk "services/data-services/$svc/$sub"
    done
done

echo ""
echo "=========================================="
echo "验证结果: 错误 $ERRORS 个"
echo "=========================================="
exit $ERRORS

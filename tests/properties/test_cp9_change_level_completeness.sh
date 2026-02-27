#!/bin/bash
# CP-9: 变更级别标注完整性属性测试
# 验证组件配置模板包含 change_level 标注且取值合法（none/normal/cab）
# 需求: 7, 14

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

ROOT_DIR="${PROJECT_ROOT:-.}"
FAILED=0
TOTAL=0

# 代表性配置模板白名单（覆盖核心组件）
TEMPLATE_FILES=(
  "services/control-plane/configs/config.yaml"
  "services/api-service/configs/config.yaml"
  "services/health-worker/configs/config.yaml"
  "services/data-services/query-api/configs/config.yaml"
  "services/data-services/audit-api/configs/config.yaml"
  "services/data-services/export-api/configs/config.yaml"
  "apps/bff-service/configs/config.yaml"
  "gateway/openresty/nginx.conf"
  "gateway/openresty/conf.d/upstream.conf"
  "gateway/openresty/conf.d/ssl.conf.template"
  "gateway/openresty/policies/global-traffic.json"
  "iam/keycloak/roles/realm-roles.json"
  "iam/opa/policies/rbac.rego"
  "iam/vault/config/vault.hcl"
  "iam/vault/config/vault-dev.hcl"
  "messaging/kafka/broker-config/server.properties.yaml"
  "messaging/kafka/topics/nexuslog-topics.yaml"
  "messaging/schema-registry/config/schema-registry.yaml"
  "storage/elasticsearch/configs/elasticsearch.yml"
  "storage/postgresql/configs/postgresql.conf"
  "storage/redis/cluster-config/redis-cluster.yaml"
  "storage/minio/lifecycle/lifecycle-rules.yaml"
  "observability/prometheus/prometheus.yml"
  "observability/alertmanager/alertmanager.yml"
  "observability/otel-collector/config/otel-collector.yml"
  "platform/helm/nexuslog-gateway/values.yaml"
  "contracts/schema-contracts/compatibility/compatibility-policy.yaml"
)

echo "🔍 CP-9: 变更级别标注完整性验证"
echo ""

for file in "${TEMPLATE_FILES[@]}"; do
  TOTAL=$((TOTAL + 1))
  full_path="$ROOT_DIR/$file"

  if [ ! -f "$full_path" ]; then
    echo -e "  ${RED}✗${NC} $file — 文件不存在"
    FAILED=1
    continue
  fi

  # 允许两类标注键：
  # 1) change_level: none|normal|cab
  # 2) 变更级别: none|normal|cab（历史模板兼容）
  if grep -Eiq '(change_level|变更级别).*(none|normal|cab)' "$full_path"; then
    echo -e "  ${GREEN}✓${NC} $file"
  else
    echo -e "  ${RED}✗${NC} $file — 缺少合法 change_level 标注"
    FAILED=1
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ CP-9 通过: 全部 $TOTAL 项检查通过${NC}"
  exit 0
else
  echo -e "${RED}❌ CP-9 失败: 存在配置模板缺少或包含非法变更级别标注（共 $TOTAL 项）${NC}"
  exit 1
fi

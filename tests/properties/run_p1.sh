#!/bin/bash
# P1 阶段属性测试统一入口
# 运行 CP-8、CP-9、CP-10

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TOTAL=0
PASSED=0
FAILED_TESTS=()

run_test() {
  local script="$1"
  local name="$2"
  TOTAL=$((TOTAL + 1))
  echo "════════════════════════════════════════"
  echo "运行: $name"
  echo "════════════════════════════════════════"
  echo ""

  if bash "$SCRIPT_DIR/$script"; then
    PASSED=$((PASSED + 1))
  else
    FAILED_TESTS+=("$name")
  fi
  echo ""
}

echo ""
echo "🧪 NexusLog P1 阶段属性测试"
echo ""

run_test "test_cp8_ci_pipeline_coverage.sh" "CP-8: CI 流水线覆盖性"
run_test "test_cp9_change_level_completeness.sh" "CP-9: 变更级别标注完整性"
run_test "test_cp10_schema_compatibility.sh" "CP-10: Schema 契约兼容性"

echo "════════════════════════════════════════"
echo "📊 属性测试汇总: $PASSED/$TOTAL 通过"
echo "════════════════════════════════════════"

if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
  echo -e "${GREEN}✅ 全部属性测试通过${NC}"
  exit 0
else
  echo -e "${RED}❌ 以下属性测试失败:${NC}"
  for t in "${FAILED_TESTS[@]}"; do
    echo -e "  ${RED}• $t${NC}"
  done
  exit 1
fi

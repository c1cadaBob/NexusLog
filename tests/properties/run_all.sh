#!/bin/bash
# MVP 阶段属性测试统一入口
# 运行 CP-1、CP-4、CP-6 全部属性测试

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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
echo "🧪 NexusLog MVP 阶段属性测试"
echo ""

run_test "test_cp1_monorepo_structure.sh" "CP-1: Monorepo 结构完整性"
run_test "test_cp4_env_config_symmetry.sh" "CP-4: 环境配置对称性"
run_test "test_cp6_go_service_structure.sh" "CP-6: Go 服务目录规范性"

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

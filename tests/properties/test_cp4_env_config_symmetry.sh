#!/bin/bash
# CP-4: 环境配置对称性属性测试
# 验证 dev/staging/prod 三环境目录文件结构一致
# 需求: 1

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

ROOT_DIR="${PROJECT_ROOT:-.}"

FAILED=0

echo "🔍 CP-4: 环境配置对称性验证"
echo ""

ENV_DIRS=("dev" "staging" "prod")

# 检查三个环境目录是否都存在
for env in "${ENV_DIRS[@]}"; do
    if [ ! -d "$ROOT_DIR/configs/$env" ]; then
        echo -e "${RED}✗${NC} configs/$env 目录不存在"
        FAILED=1
    fi
done

if [ $FAILED -eq 1 ]; then
    echo -e "${RED}❌ CP-4 失败: 环境目录缺失${NC}"
    exit 1
fi

# 获取每个环境目录的相对文件结构（排除 .gitkeep）
get_structure() {
    local env_dir="$1"
    # 列出所有文件和目录的相对路径，排除 .gitkeep
    (cd "$ROOT_DIR/configs/$env_dir" && find . -not -name '.gitkeep' -not -path '.' | sort)
}

DEV_STRUCTURE=$(get_structure "dev")
STAGING_STRUCTURE=$(get_structure "staging")
PROD_STRUCTURE=$(get_structure "prod")

echo "📂 各环境目录结构:"
echo ""

echo "  dev/:"
if [ -z "$DEV_STRUCTURE" ]; then
    echo "    (空目录)"
else
    echo "$DEV_STRUCTURE" | sed 's/^/    /'
fi

echo "  staging/:"
if [ -z "$STAGING_STRUCTURE" ]; then
    echo "    (空目录)"
else
    echo "$STAGING_STRUCTURE" | sed 's/^/    /'
fi

echo "  prod/:"
if [ -z "$PROD_STRUCTURE" ]; then
    echo "    (空目录)"
else
    echo "$PROD_STRUCTURE" | sed 's/^/    /'
fi

echo ""

# 比较结构是否一致
echo "🔄 比较环境目录结构..."

if [ "$DEV_STRUCTURE" != "$STAGING_STRUCTURE" ]; then
    echo -e "  ${RED}✗${NC} dev/ 与 staging/ 结构不一致"
    echo "    差异:"
    diff <(echo "$DEV_STRUCTURE") <(echo "$STAGING_STRUCTURE") | sed 's/^/      /' || true
    FAILED=1
else
    echo -e "  ${GREEN}✓${NC} dev/ 与 staging/ 结构一致"
fi

if [ "$DEV_STRUCTURE" != "$PROD_STRUCTURE" ]; then
    echo -e "  ${RED}✗${NC} dev/ 与 prod/ 结构不一致"
    echo "    差异:"
    diff <(echo "$DEV_STRUCTURE") <(echo "$PROD_STRUCTURE") | sed 's/^/      /' || true
    FAILED=1
else
    echo -e "  ${GREEN}✓${NC} dev/ 与 prod/ 结构一致"
fi

if [ "$STAGING_STRUCTURE" != "$PROD_STRUCTURE" ]; then
    echo -e "  ${RED}✗${NC} staging/ 与 prod/ 结构不一致"
    echo "    差异:"
    diff <(echo "$STAGING_STRUCTURE") <(echo "$PROD_STRUCTURE") | sed 's/^/      /' || true
    FAILED=1
else
    echo -e "  ${GREEN}✓${NC} staging/ 与 prod/ 结构一致"
fi

echo ""

# ── 结果 ──
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ CP-4 通过: 三环境目录结构完全一致${NC}"
    exit 0
else
    echo -e "${RED}❌ CP-4 失败: 环境目录结构不一致${NC}"
    exit 1
fi

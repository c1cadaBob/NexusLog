#!/bin/bash
# CP-6: Go 服务目录规范性属性测试
# 验证每个 Go 服务包含 cmd/、internal/、configs/、tests/、Dockerfile
# 需求: 3

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

ROOT_DIR="${PROJECT_ROOT:-.}"

FAILED=0
TOTAL=0

# 需要检查的 Go 服务列表
# 顶层服务直接检查标准结构
# data-services 的子服务单独检查
GO_SERVICES=(
    "services/control-plane:控制面服务"
    "services/health-worker:健康检测服务"
    "services/api-service:API 服务"
)

# data-services 子服务（每个子服务也需要标准结构）
DATA_SUB_SERVICES=(
    "services/data-services/query-api:查询 API"
    "services/data-services/audit-api:审计 API"
    "services/data-services/export-api:导出 API"
)

# 每个 Go 服务必须包含的目录和文件
REQUIRED_DIRS=("cmd" "internal" "configs" "tests")
REQUIRED_FILES=("Dockerfile")

check_service() {
    local svc_path="$1"
    local svc_name="$2"
    local svc_failed=0

    echo "  📦 $svc_name ($svc_path)"

    # 检查服务目录是否存在
    if [ ! -d "$ROOT_DIR/$svc_path" ]; then
        echo -e "    ${RED}✗${NC} 服务目录不存在"
        FAILED=1
        return
    fi

    # 检查 go.mod
    TOTAL=$((TOTAL + 1))
    if [ -f "$ROOT_DIR/$svc_path/go.mod" ]; then
        echo -e "    ${GREEN}✓${NC} go.mod"
    else
        echo -e "    ${RED}✗${NC} go.mod — 缺失"
        svc_failed=1
    fi

    # 检查必需目录
    for dir in "${REQUIRED_DIRS[@]}"; do
        TOTAL=$((TOTAL + 1))
        if [ -d "$ROOT_DIR/$svc_path/$dir" ]; then
            echo -e "    ${GREEN}✓${NC} $dir/"
        else
            echo -e "    ${RED}✗${NC} $dir/ — 缺失"
            svc_failed=1
        fi
    done

    # 检查必需文件
    for file in "${REQUIRED_FILES[@]}"; do
        TOTAL=$((TOTAL + 1))
        if [ -f "$ROOT_DIR/$svc_path/$file" ]; then
            echo -e "    ${GREEN}✓${NC} $file"
        else
            echo -e "    ${RED}✗${NC} $file — 缺失"
            svc_failed=1
        fi
    done

    if [ $svc_failed -eq 1 ]; then
        FAILED=1
    fi
    echo ""
}

echo "🔍 CP-6: Go 服务目录规范性验证"
echo ""

echo "📋 检查顶层 Go 服务..."
echo ""
for entry in "${GO_SERVICES[@]}"; do
    svc_path="${entry%%:*}"
    svc_name="${entry##*:}"
    check_service "$svc_path" "$svc_name"
done

echo "📋 检查 Data Services 子服务..."
echo ""
for entry in "${DATA_SUB_SERVICES[@]}"; do
    svc_path="${entry%%:*}"
    svc_name="${entry##*:}"
    check_service "$svc_path" "$svc_name"
done

# 额外检查：data-services 顶层也需要 Dockerfile
TOTAL=$((TOTAL + 1))
echo "📋 检查 Data Services 顶层..."
if [ -f "$ROOT_DIR/services/data-services/Dockerfile" ]; then
    echo -e "  ${GREEN}✓${NC} services/data-services/Dockerfile"
else
    echo -e "  ${RED}✗${NC} services/data-services/Dockerfile — 缺失"
    FAILED=1
fi

echo ""

# ── 结果 ──
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ CP-6 通过: 全部 $TOTAL 项检查通过${NC}"
    exit 0
else
    echo -e "${RED}❌ CP-6 失败: 部分 Go 服务目录结构不规范（共 $TOTAL 项）${NC}"
    exit 1
fi

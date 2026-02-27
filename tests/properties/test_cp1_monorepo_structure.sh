#!/bin/bash
# CP-1: Monorepo 结构完整性属性测试
# 验证所有必需顶层目录存在且包含预期子目录
# 需求: 1

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# 项目根目录（脚本从项目根目录运行）
ROOT_DIR="${PROJECT_ROOT:-.}"

FAILED=0
TOTAL=0

check_dir() {
    local dir="$1"
    local desc="$2"
    TOTAL=$((TOTAL + 1))
    if [ -d "$ROOT_DIR/$dir" ]; then
        echo -e "  ${GREEN}✓${NC} $dir ($desc)"
    else
        echo -e "  ${RED}✗${NC} $dir ($desc) — 目录不存在"
        FAILED=1
    fi
}

check_file() {
    local file="$1"
    local desc="$2"
    TOTAL=$((TOTAL + 1))
    if [ -f "$ROOT_DIR/$file" ]; then
        echo -e "  ${GREEN}✓${NC} $file ($desc)"
    else
        echo -e "  ${RED}✗${NC} $file ($desc) — 文件不存在"
        FAILED=1
    fi
}

echo "🔍 CP-1: Monorepo 结构完整性验证"
echo ""

# ── 1. 必需顶层目录 ──
echo "📁 验证必需顶层目录..."

REQUIRED_DIRS=(
    "apps:应用层"
    "services:微服务层"
    "gateway:API 网关"
    "iam:身份认证与授权"
    "agents:采集代理"
    "stream:流计算"
    "messaging:消息传输"
    "contracts:契约定义"
    "storage:存储配置"
    "observability:可观测性"
    "platform:平台治理"
    "infra:基础设施即代码"
    "configs:公共配置"
    "docs:项目文档"
    "scripts:脚本工具"
    "tests:测试"
)

for entry in "${REQUIRED_DIRS[@]}"; do
    dir="${entry%%:*}"
    desc="${entry##*:}"
    check_dir "$dir" "$desc"
done

echo ""

# ── 2. 必需根文件 ──
echo "📄 验证必需根文件..."

REQUIRED_FILES=(
    "README.md:项目说明"
    "LICENSE:许可证"
    "CHANGELOG.md:变更日志"
    ".gitignore:Git 忽略规则"
    ".editorconfig:编辑器配置"
    "Makefile:统一构建入口"
    "go.work:Go 多模块工作区"
    "package.json:pnpm workspace"
)

for entry in "${REQUIRED_FILES[@]}"; do
    file="${entry%%:*}"
    desc="${entry##*:}"
    check_file "$file" "$desc"
done

echo ""

# ── 3. 关键子目录结构 ──
echo "📂 验证关键子目录结构..."

# configs 环境目录
check_dir "configs/common" "公共配置"
check_dir "configs/dev" "开发环境配置"
check_dir "configs/staging" "预发布环境配置"
check_dir "configs/prod" "生产环境配置"

# docs 子目录
check_dir "docs/architecture" "架构文档"
check_dir "docs/adr" "架构决策记录"
check_dir "docs/runbooks" "运维手册"
check_dir "docs/oncall" "值班手册"
check_dir "docs/security" "安全规范"
check_dir "docs/sla-slo" "SLA/SLO 定义"

# tests 子目录
check_dir "tests/e2e" "端到端测试"
check_dir "tests/integration" "集成测试"
check_dir "tests/performance" "性能测试"
check_dir "tests/chaos" "混沌测试"

# apps 子目录
check_dir "apps/frontend-console" "前端控制台"

# services 子目录
check_dir "services/control-plane" "控制面服务"
check_dir "services/health-worker" "健康检测服务"
check_dir "services/data-services" "数据服务集合"
check_dir "services/api-service" "API 服务"

echo ""

# ── 结果 ──
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ CP-1 通过: 全部 $TOTAL 项检查通过${NC}"
    exit 0
else
    echo -e "${RED}❌ CP-1 失败: 部分检查未通过（共 $TOTAL 项）${NC}"
    exit 1
fi

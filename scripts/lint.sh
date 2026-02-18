#!/bin/bash
# NexusLog 代码检查脚本
# 运行所有后端代码的 lint 检查

set -e

echo "🔍 开始代码检查..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查 golangci-lint 是否安装
if ! command -v golangci-lint &> /dev/null; then
    echo -e "${YELLOW}⚠ golangci-lint 未安装，尝试安装...${NC}"
    go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
fi

# Go 代码检查
echo ""
echo "📋 检查 Go 代码..."

GO_MODULES=(
    "services/control-plane"
    "services/health-worker"
    "services/api-service"
    "agents/collector-agent"
)

LINT_FAILED=0

for module in "${GO_MODULES[@]}"; do
    if [ -d "$module" ] && [ -f "$module/go.mod" ]; then
        echo "  检查 $module..."
        cd "$module"
        if golangci-lint run ./... 2>/dev/null; then
            echo -e "  ${GREEN}✓ $module 检查通过${NC}"
        else
            echo -e "  ${RED}✗ $module 检查失败${NC}"
            LINT_FAILED=1
        fi
        cd - > /dev/null
    else
        echo -e "  ${YELLOW}⚠ $module 不存在或无 go.mod，跳过${NC}"
    fi
done

# Shell 脚本检查
echo ""
echo "📋 检查 Shell 脚本..."
if command -v shellcheck &> /dev/null; then
    for script in scripts/*.sh; do
        if [ -f "$script" ]; then
            if shellcheck "$script" 2>/dev/null; then
                echo -e "  ${GREEN}✓ $script 检查通过${NC}"
            else
                echo -e "  ${YELLOW}⚠ $script 有警告${NC}"
            fi
        fi
    done
else
    echo -e "  ${YELLOW}⚠ shellcheck 未安装，跳过 Shell 脚本检查${NC}"
fi

echo ""
if [ $LINT_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ 所有代码检查通过${NC}"
else
    echo -e "${RED}❌ 部分代码检查失败${NC}"
    exit 1
fi

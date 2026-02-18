#!/bin/bash
# NexusLog 项目初始化脚本
# 用于安装所有依赖并初始化开发环境

set -e

echo "🚀 开始初始化 NexusLog 项目..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查必要工具
check_tool() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ 未找到 $1，请先安装${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ $1 已安装${NC}"
}

echo ""
echo "📋 检查必要工具..."
check_tool "node"
check_tool "pnpm"
check_tool "go"

# 检查 Node.js 版本
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}❌ Node.js 版本需要 >= 20，当前版本: $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js 版本检查通过: $(node -v)${NC}"

# 检查 Go 版本
GO_VERSION=$(go version | grep -oP 'go\K[0-9]+\.[0-9]+')
GO_MAJOR=$(echo $GO_VERSION | cut -d'.' -f1)
GO_MINOR=$(echo $GO_VERSION | cut -d'.' -f2)
if [ "$GO_MAJOR" -lt 1 ] || ([ "$GO_MAJOR" -eq 1 ] && [ "$GO_MINOR" -lt 22 ]); then
    echo -e "${RED}❌ Go 版本需要 >= 1.22，当前版本: $GO_VERSION${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Go 版本检查通过: $GO_VERSION${NC}"

# 安装前端依赖
echo ""
echo "📦 安装前端依赖..."
if [ -d "apps/frontend-console" ]; then
    pnpm install
    echo -e "${GREEN}✓ 前端依赖安装完成${NC}"
else
    echo -e "${YELLOW}⚠ apps/frontend-console 目录不存在，跳过前端依赖安装${NC}"
fi

# 同步 Go 模块
echo ""
echo "📦 同步 Go 模块..."
if [ -f "go.work" ]; then
    go work sync
    echo -e "${GREEN}✓ Go 模块同步完成${NC}"
else
    echo -e "${YELLOW}⚠ go.work 文件不存在，跳过 Go 模块同步${NC}"
fi

# 创建必要的目录
echo ""
echo "📁 创建必要目录..."
mkdir -p bin
mkdir -p dist
echo -e "${GREEN}✓ 目录创建完成${NC}"

echo ""
echo -e "${GREEN}🎉 NexusLog 项目初始化完成！${NC}"
echo ""
echo "可用命令:"
echo "  make lint    - 运行代码检查"
echo "  make test    - 运行测试"
echo "  make build   - 构建项目"
echo "  make help    - 查看所有命令"

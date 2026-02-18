#!/bin/bash
# NexusLog 发布脚本
# 创建新版本发布

set -e

echo "📦 开始发布流程..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查 git 状态
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}❌ 工作目录有未提交的更改，请先提交或暂存${NC}"
    exit 1
fi

# 获取当前版本
CURRENT_VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
echo "当前版本: $CURRENT_VERSION"

# 解析版本号
VERSION_REGEX="^v([0-9]+)\.([0-9]+)\.([0-9]+)$"
if [[ $CURRENT_VERSION =~ $VERSION_REGEX ]]; then
    MAJOR="${BASH_REMATCH[1]}"
    MINOR="${BASH_REMATCH[2]}"
    PATCH="${BASH_REMATCH[3]}"
else
    MAJOR=0
    MINOR=0
    PATCH=0
fi

# 选择版本类型
echo ""
echo "选择发布类型:"
echo "  1) patch - 补丁版本 (v$MAJOR.$MINOR.$((PATCH+1)))"
echo "  2) minor - 次版本 (v$MAJOR.$((MINOR+1)).0)"
echo "  3) major - 主版本 (v$((MAJOR+1)).0.0)"
echo "  4) 自定义版本"
echo ""
read -p "请选择 [1-4]: " choice

case $choice in
    1)
        NEW_VERSION="v$MAJOR.$MINOR.$((PATCH+1))"
        ;;
    2)
        NEW_VERSION="v$MAJOR.$((MINOR+1)).0"
        ;;
    3)
        NEW_VERSION="v$((MAJOR+1)).0.0"
        ;;
    4)
        read -p "输入版本号 (格式: vX.Y.Z): " NEW_VERSION
        if [[ ! $NEW_VERSION =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo -e "${RED}❌ 版本号格式错误${NC}"
            exit 1
        fi
        ;;
    *)
        echo -e "${RED}❌ 无效选择${NC}"
        exit 1
        ;;
esac

echo ""
echo "新版本: $NEW_VERSION"
read -p "确认发布? [y/N]: " confirm
if [[ ! $confirm =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 0
fi

# 运行测试
echo ""
echo "🧪 运行测试..."
make test || {
    echo -e "${RED}❌ 测试失败，中止发布${NC}"
    exit 1
}

# 运行代码检查
echo ""
echo "🔍 运行代码检查..."
make lint || {
    echo -e "${RED}❌ 代码检查失败，中止发布${NC}"
    exit 1
}

# 更新 CHANGELOG
echo ""
echo "📝 更新 CHANGELOG..."
DATE=$(date +%Y-%m-%d)
sed -i "s/## \[Unreleased\]/## [Unreleased]\n\n## [$NEW_VERSION] - $DATE/" CHANGELOG.md

# 提交更改
git add CHANGELOG.md
git commit -m "chore: release $NEW_VERSION"

# 创建标签
echo ""
echo "🏷️ 创建标签..."
git tag -a "$NEW_VERSION" -m "Release $NEW_VERSION"

# 推送
echo ""
echo "🚀 推送到远程仓库..."
git push origin main
git push origin "$NEW_VERSION"

# 构建并推送 Docker 镜像
echo ""
echo "🐳 构建并推送 Docker 镜像..."
VERSION=$NEW_VERSION ./scripts/build.sh docker
VERSION=$NEW_VERSION ./scripts/build.sh push

echo ""
echo -e "${GREEN}✅ 发布完成: $NEW_VERSION${NC}"
echo ""
echo "后续步骤:"
echo "  1. 在 GitHub 创建 Release"
echo "  2. 更新部署环境"
echo "  3. 通知相关人员"

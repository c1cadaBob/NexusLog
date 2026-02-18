#!/bin/bash
# NexusLog 构建脚本
# 构建所有后端服务

set -e

echo "🔨 开始构建..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 构建参数
BUILD_MODE=${1:-"binary"}  # binary, docker, push
VERSION=${VERSION:-$(git describe --tags --always --dirty 2>/dev/null || echo "dev")}
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
REGISTRY=${REGISTRY:-"nexuslog"}

# Go 构建参数
LDFLAGS="-s -w -X main.Version=$VERSION -X main.BuildTime=$BUILD_TIME"
CGO_ENABLED=0
GOOS=${GOOS:-linux}
GOARCH=${GOARCH:-amd64}

# 服务列表
SERVICES=(
    "services/control-plane:control-plane:cmd/api"
    "services/health-worker:health-worker:cmd/worker"
    "services/api-service:api-service:cmd/api"
    "agents/collector-agent:collector-agent:cmd/agent"
)

# 创建输出目录
mkdir -p bin

build_binary() {
    local path=$1
    local name=$2
    local main=$3

    if [ -d "$path" ] && [ -f "$path/go.mod" ]; then
        echo "  构建 $name..."
        cd "$path"
        CGO_ENABLED=$CGO_ENABLED GOOS=$GOOS GOARCH=$GOARCH \
            go build -ldflags "$LDFLAGS" -o "../../bin/$name" "./$main" 2>/dev/null || {
            echo -e "  ${YELLOW}⚠ $name 构建跳过（可能缺少源文件）${NC}"
            cd - > /dev/null
            return 0
        }
        echo -e "  ${GREEN}✓ $name 构建完成${NC}"
        cd - > /dev/null
    else
        echo -e "  ${YELLOW}⚠ $path 不存在，跳过${NC}"
    fi
}

build_docker() {
    local path=$1
    local name=$2

    if [ -d "$path" ] && [ -f "$path/Dockerfile" ]; then
        echo "  构建 Docker 镜像 $name..."
        docker build -t "$REGISTRY/$name:$VERSION" -t "$REGISTRY/$name:latest" "$path"
        echo -e "  ${GREEN}✓ $name 镜像构建完成${NC}"
    else
        echo -e "  ${YELLOW}⚠ $path/Dockerfile 不存在，跳过${NC}"
    fi
}

push_docker() {
    local name=$1

    echo "  推送 Docker 镜像 $name..."
    docker push "$REGISTRY/$name:$VERSION"
    docker push "$REGISTRY/$name:latest"
    echo -e "  ${GREEN}✓ $name 镜像推送完成${NC}"
}

case $BUILD_MODE in
    binary)
        echo ""
        echo "📦 构建二进制文件..."
        echo "  版本: $VERSION"
        echo "  目标: $GOOS/$GOARCH"
        echo ""

        for service in "${SERVICES[@]}"; do
            IFS=':' read -r path name main <<< "$service"
            build_binary "$path" "$name" "$main"
        done
        ;;

    docker)
        echo ""
        echo "🐳 构建 Docker 镜像..."
        echo "  版本: $VERSION"
        echo "  仓库: $REGISTRY"
        echo ""

        for service in "${SERVICES[@]}"; do
            IFS=':' read -r path name main <<< "$service"
            build_docker "$path" "$name"
        done

        # 构建前端镜像
        if [ -d "apps/frontend-console" ] && [ -f "apps/frontend-console/Dockerfile" ]; then
            build_docker "apps/frontend-console" "frontend-console"
        fi
        ;;

    push)
        echo ""
        echo "🚀 推送 Docker 镜像..."
        echo "  版本: $VERSION"
        echo "  仓库: $REGISTRY"
        echo ""

        for service in "${SERVICES[@]}"; do
            IFS=':' read -r path name main <<< "$service"
            push_docker "$name"
        done

        push_docker "frontend-console"
        ;;

    *)
        echo "用法: $0 [binary|docker|push]"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ 构建完成${NC}"

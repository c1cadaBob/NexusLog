#!/usr/bin/env bash
# NexusLog CI 脚本 - 统一构建入口
set -euo pipefail

SERVICE=${1:-"all"}
TAG=${2:-"latest"}
REGISTRY=${REGISTRY:-"registry.nexuslog.io"}

echo "=== NexusLog 构建脚本 ==="
echo "服务: ${SERVICE}"
echo "标签: ${TAG}"

build_go_service() {
  local svc=$1
  local svc_path=$2
  echo "--- 构建 Go 服务: ${svc} ---"
  cd "${svc_path}"
  go test ./...
  CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o "bin/${svc}" ./cmd/*/
  cd -
}

build_frontend() {
  echo "--- 构建前端 ---"
  cd apps/frontend-console
  pnpm install --frozen-lockfile
  pnpm build
  cd -
}

case "${SERVICE}" in
  control-plane)
    build_go_service "control-plane" "services/control-plane"
    ;;
  health-worker)
    build_go_service "health-worker" "services/health-worker"
    ;;
  api-service)
    build_go_service "api-service" "services/api-service"
    ;;
  collector-agent)
    build_go_service "collector-agent" "agents/collector-agent"
    ;;
  frontend)
    build_frontend
    ;;
  all)
    build_go_service "control-plane" "services/control-plane"
    build_go_service "health-worker" "services/health-worker"
    build_go_service "api-service" "services/api-service"
    build_go_service "collector-agent" "agents/collector-agent"
    build_frontend
    ;;
  *)
    echo "未知服务: ${SERVICE}"
    exit 1
    ;;
esac

echo "=== 构建完成 ==="

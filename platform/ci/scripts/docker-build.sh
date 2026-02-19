#!/usr/bin/env bash
# NexusLog CI 脚本 - Docker 镜像构建与推送
set -euo pipefail

SERVICE=${1:-""}
TAG=${2:-"latest"}
REGISTRY=${REGISTRY:-"registry.nexuslog.io"}

if [ -z "${SERVICE}" ]; then
  echo "用法: docker-build.sh <服务名> [标签]"
  exit 1
fi

echo "=== Docker 镜像构建 ==="
echo "服务: ${SERVICE}"
echo "标签: ${TAG}"
echo "仓库: ${REGISTRY}"

IMAGE="${REGISTRY}/nexuslog-${SERVICE}:${TAG}"

# 根据服务名确定 Dockerfile 路径
case "${SERVICE}" in
  control-plane|health-worker|api-service)
    DOCKERFILE="services/${SERVICE}/Dockerfile"
    CONTEXT="services/${SERVICE}"
    ;;
  collector-agent)
    DOCKERFILE="agents/${SERVICE}/Dockerfile"
    CONTEXT="agents/${SERVICE}"
    ;;
  frontend)
    DOCKERFILE="apps/frontend-console/Dockerfile"
    CONTEXT="apps/frontend-console"
    ;;
  gateway)
    DOCKERFILE="gateway/openresty/Dockerfile"
    CONTEXT="gateway/openresty"
    ;;
  *)
    echo "未知服务: ${SERVICE}"
    exit 1
    ;;
esac

docker build -t "${IMAGE}" -f "${DOCKERFILE}" "${CONTEXT}"
echo "镜像构建成功: ${IMAGE}"

# Trivy 安全扫描
echo "--- 运行 Trivy 安全扫描 ---"
trivy image --severity HIGH,CRITICAL --exit-code 1 "${IMAGE}" || {
  echo "警告: 发现高危漏洞，请检查扫描报告"
  exit 1
}

docker push "${IMAGE}"
echo "镜像推送成功: ${IMAGE}"

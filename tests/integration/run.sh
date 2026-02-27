#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.test.yml"

cleanup() {
  docker compose -f "${COMPOSE_FILE}" down -v --remove-orphans >/dev/null 2>&1 || true
}

trap cleanup EXIT

echo "🧪 启动集成测试依赖环境..."
cleanup
docker compose -f "${COMPOSE_FILE}" up -d --wait --wait-timeout 120

echo "🔎 验证 PostgreSQL 可用性..."
docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  psql -U nexuslog -d nexuslog_test -c "SELECT 1;" >/dev/null

echo "🔎 验证 Redis 可用性..."
REDIS_PONG="$(docker compose -f "${COMPOSE_FILE}" exec -T redis redis-cli ping | tr -d '\r')"
if [[ "${REDIS_PONG}" != "PONG" ]]; then
  echo "❌ Redis 健康检查失败: ${REDIS_PONG}"
  exit 1
fi

echo "✅ 集成测试环境就绪，基础连通性验证通过。"

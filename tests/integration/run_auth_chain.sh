#!/usr/bin/env bash
set -euo pipefail

# 认证链路自动化测试（任务 5.1）
# 目标：一键完成测试环境启动、数据库迁移、认证成功/失败链路集成测试执行。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.test.yml"

TEST_DB_DSN="${TEST_DB_DSN:-postgres://nexuslog:nexuslog@localhost:15432/nexuslog_test?sslmode=disable}"
TEST_REGEX="${TEST_REGEX:-Test(Register|Login|Refresh|Logout|PasswordResetRequest|PasswordResetConfirm|AuthStorageWriteAndVerify)Integration}"
KEEP_ENV="${KEEP_ENV:-0}"

cleanup() {
  # 默认清理测试容器；调试时可设置 KEEP_ENV=1 保留环境。
  if [[ "${KEEP_ENV}" != "1" ]]; then
    docker compose -f "${COMPOSE_FILE}" down -v --remove-orphans >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

echo "🧪 [5.1] 启动认证链路测试依赖环境..."
docker compose -f "${COMPOSE_FILE}" down -v --remove-orphans >/dev/null 2>&1 || true
docker compose -f "${COMPOSE_FILE}" up -d --wait --wait-timeout 180

echo "🗃️ [5.1] 执行测试数据库迁移..."
DB_DSN="${TEST_DB_DSN}" "${REPO_ROOT}/scripts/db-migrate.sh" up

echo "🔍 [5.1] 运行认证链路集成测试（成功/失败）..."
(
  cd "${REPO_ROOT}/services/api-service"
  TEST_DB_DSN="${TEST_DB_DSN}" go test ./tests -run "${TEST_REGEX}" -v
)

echo "✅ [5.1] 认证链路自动化测试通过。"

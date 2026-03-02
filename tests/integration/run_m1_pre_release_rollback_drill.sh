#!/usr/bin/env bash
set -euo pipefail

# 任务 5.3：M1 发布前回滚演练（服务与配置）
# 目标：在非生产环境验证服务回滚与配置回滚都可一次成功执行。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.gateway-smoke.yml"
GATEWAY_BASE_URL="${GATEWAY_BASE_URL:-http://localhost:18080}"
KEEP_ENV="${KEEP_ENV:-0}"

TMP_DIR="$(mktemp -d)"
RESP_STATUS=""
RESP_HEADERS_FILE=""
RESP_BODY_FILE=""

cleanup() {
  rm -rf "${TMP_DIR}" >/dev/null 2>&1 || true
  # 默认清理演练环境；调试时可通过 KEEP_ENV=1 保留。
  if [[ "${KEEP_ENV}" != "1" ]]; then
    docker compose -f "${COMPOSE_FILE}" down -v --remove-orphans >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# base64url 编码工具：用于拼装测试 JWT。
base64url_encode() {
  printf '%s' "$1" | openssl base64 -A | tr '+/' '-_' | tr -d '='
}

# 构造演练用 JWT（网关会走 claims 校验 + 签名降级逻辑）。
build_smoke_token() {
  local now exp header payload
  now="$(date +%s)"
  exp="$((now + 3600))"
  header='{"alg":"HS256","typ":"JWT"}'
  payload='{"sub":"rollback-user","preferred_username":"rollback-user","email":"rollback@example.com","tenant_id":"demo","exp":'"${exp}"',"iat":'"${now}"'}'
  printf '%s.%s.%s' "$(base64url_encode "${header}")" "$(base64url_encode "${payload}")" "rollback-signature"
}

# 发起请求并缓存响应头/响应体。
request() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local token="${4:-}"

  RESP_HEADERS_FILE="${TMP_DIR}/headers.$RANDOM.txt"
  RESP_BODY_FILE="${TMP_DIR}/body.$RANDOM.txt"

  local -a args
  args=(
    --noproxy '*'
    -sS
    -X "${method}"
    -D "${RESP_HEADERS_FILE}"
    -o "${RESP_BODY_FILE}"
    --max-time 10
    "${GATEWAY_BASE_URL}${path}"
  )

  if [[ -n "${body}" ]]; then
    args+=(-H "Content-Type: application/json" --data "${body}")
  fi
  if [[ -n "${token}" ]]; then
    args+=(-H "Authorization: Bearer ${token}")
  fi

  RESP_STATUS="$(curl "${args[@]}" -w '%{http_code}')"
}

# 单状态码断言。
assert_status() {
  local expected="$1"
  if [[ "${RESP_STATUS}" != "${expected}" ]]; then
    echo "❌ 期望状态码 ${expected}，实际 ${RESP_STATUS}"
    echo "响应头："
    cat "${RESP_HEADERS_FILE}"
    echo "响应体："
    cat "${RESP_BODY_FILE}"
    exit 1
  fi
}

# 多状态码断言（用于网关上游不可达阶段的 5xx 差异）。
assert_status_in() {
  local actual="${RESP_STATUS}"
  shift
  local expected
  for expected in "$@"; do
    if [[ "${actual}" == "${expected}" ]]; then
      return 0
    fi
  done
  echo "❌ 期望状态码属于 [$*]，实际 ${actual}"
  echo "响应头："
  cat "${RESP_HEADERS_FILE}"
  echo "响应体："
  cat "${RESP_BODY_FILE}"
  exit 1
}

# 响应体关键词断言。
assert_body_contains() {
  local expected="$1"
  if ! grep -Fq "${expected}" "${RESP_BODY_FILE}"; then
    echo "❌ 响应体未包含预期内容: ${expected}"
    echo "实际响应体："
    cat "${RESP_BODY_FILE}"
    exit 1
  fi
}

# 等待网关就绪，避免刚启动时瞬时失败。
wait_gateway_ready() {
  for _ in $(seq 1 120); do
    if curl --noproxy '*' -fsS "${GATEWAY_BASE_URL}/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "❌ 网关未在预期时间内就绪: ${GATEWAY_BASE_URL}/health"
  return 1
}

# 等待 query 路由恢复为 200。
wait_query_recovered() {
  local token="$1"
  for _ in $(seq 1 60); do
    request POST "/api/v1/query/logs" '{"keyword":"rollback"}' "${token}"
    if [[ "${RESP_STATUS}" == "200" ]]; then
      return 0
    fi
    sleep 1
  done
  echo "❌ query 路由在预期时间内未恢复为 200"
  return 1
}

# 等待 query 路由（无 Token）达到指定状态与响应内容，规避 reload 生效瞬时抖动。
wait_no_token_query_state() {
  local expected_status="$1"
  local expected_body="$2"
  for _ in $(seq 1 60); do
    request POST "/api/v1/query/logs" '{"keyword":"config-reload"}'
    if [[ "${RESP_STATUS}" == "${expected_status}" ]] && grep -Fq "${expected_body}" "${RESP_BODY_FILE}"; then
      return 0
    fi
    sleep 1
  done
  echo "❌ 无 Token 的 query 路由未达到预期状态: status=${expected_status}, body~=${expected_body}"
  echo "最后一次响应头："
  cat "${RESP_HEADERS_FILE}"
  echo "最后一次响应体："
  cat "${RESP_BODY_FILE}"
  return 1
}

# 在 gateway 容器中执行命令，用于配置修改与回滚。
gateway_exec() {
  local cmd="$1"
  docker compose -f "${COMPOSE_FILE}" exec -T gateway sh -lc "${cmd}"
}

SMOKE_TOKEN="$(build_smoke_token)"

echo "🧪 [5.3] 启动非生产回滚演练环境..."
docker compose -f "${COMPOSE_FILE}" down -v --remove-orphans >/dev/null 2>&1 || true
docker compose -f "${COMPOSE_FILE}" up -d --build --wait --wait-timeout 240
wait_gateway_ready

echo "🔍 [5.3] 基线检查：query 路由可用..."
request POST "/api/v1/query/logs" '{"keyword":"baseline"}' "${SMOKE_TOKEN}"
assert_status 200
assert_body_contains "\"service\":\"query-api\""

echo "🔄 [5.3] 服务回滚演练：停止 query-api（模拟发布异常）..."
docker compose -f "${COMPOSE_FILE}" stop query-api >/dev/null
request POST "/api/v1/query/logs" '{"keyword":"service-down"}' "${SMOKE_TOKEN}"
assert_status_in 500 502 503 504

echo "🔁 [5.3] 服务回滚演练：恢复 query-api（执行回滚）..."
docker compose -f "${COMPOSE_FILE}" start query-api >/dev/null
wait_query_recovered "${SMOKE_TOKEN}"
assert_body_contains "\"service\":\"query-api\""

echo "🔍 [5.3] 基线检查：query 路由在无 Token 下应被鉴权拦截..."
request POST "/api/v1/query/logs" '{"keyword":"no-token-baseline"}'
assert_status 401
assert_body_contains "\"code\":\"AUTH_MISSING_TOKEN\""

echo "🔄 [5.3] 配置回滚演练：错误放开 /api/v1/query/ 白名单并 reload（模拟错误配置）..."
gateway_exec "cp /etc/openresty/lua/auth_check.lua /tmp/auth_check.lua.bak && sed -i 's#\"/auth/\",#\"/api/v1/query/\", \"/auth/\",#' /etc/openresty/lua/auth_check.lua && /usr/local/openresty/bin/openresty -t && /usr/local/openresty/bin/openresty -s reload"
wait_no_token_query_state 200 "\"service\":\"query-api\""

echo "🔁 [5.3] 配置回滚演练：恢复 auth_check.lua 并 reload（执行回滚）..."
gateway_exec "cp /tmp/auth_check.lua.bak /etc/openresty/lua/auth_check.lua && /usr/local/openresty/bin/openresty -t && /usr/local/openresty/bin/openresty -s reload"
wait_no_token_query_state 401 "\"code\":\"AUTH_MISSING_TOKEN\""

echo "✅ [5.3] M1 发布前回滚演练通过（服务与配置）。"

#!/usr/bin/env bash
set -euo pipefail

# 任务 5.2：网关路由与鉴权冒烟测试
# 目标：验证关键路由前缀转发正确、鉴权错误体统一且包含 request_id。

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
  # 默认清理环境；调试时可设置 KEEP_ENV=1 保留容器。
  if [[ "${KEEP_ENV}" != "1" ]]; then
    docker compose -f "${COMPOSE_FILE}" down -v --remove-orphans >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# base64url 编码工具：用于拼装测试 JWT。
base64url_encode() {
  printf '%s' "$1" | openssl base64 -A | tr '+/' '-_' | tr -d '='
}

# 构造用于冒烟的 JWT（网关会走 claims 校验 + 签名降级逻辑）。
build_smoke_token() {
  local now exp header payload
  now="$(date +%s)"
  exp="$((now + 3600))"
  header='{"alg":"HS256","typ":"JWT"}'
  payload='{"sub":"smoke-user","preferred_username":"smoke-user","email":"smoke@example.com","tenant_id":"demo","exp":'"${exp}"',"iat":'"${now}"'}'
  printf '%s.%s.%s' "$(base64url_encode "${header}")" "$(base64url_encode "${payload}")" "smoke-signature"
}

# 发起请求并缓存响应头/响应体，供后续断言复用。
request() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local token="${4:-}"
  local request_id="${5:-}"

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
  if [[ -n "${request_id}" ]]; then
    args+=(-H "X-Request-ID: ${request_id}")
  fi

  RESP_STATUS="$(curl "${args[@]}" -w '%{http_code}')"
}

# 状态码断言。
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

# 从简单 JSON 字符串响应中提取字段值（仅用于 code/request_id 这类字符串字段）。
json_field() {
  local key="$1"
  sed -n "s/.*\"${key}\":\"\\([^\"]*\\)\".*/\\1/p" "${RESP_BODY_FILE}" | head -n 1
}

# JSON 字段值等值断言。
assert_json_field_equals() {
  local key="$1"
  local expected="$2"
  local actual
  actual="$(json_field "${key}")"
  if [[ "${actual}" != "${expected}" ]]; then
    echo "❌ JSON 字段 ${key} 期望 ${expected}，实际 ${actual:-<empty>}"
    echo "实际响应体："
    cat "${RESP_BODY_FILE}"
    exit 1
  fi
}

# JSON 字段非空断言。
assert_json_field_not_empty() {
  local key="$1"
  local actual
  actual="$(json_field "${key}")"
  if [[ -z "${actual}" ]]; then
    echo "❌ JSON 字段 ${key} 为空"
    echo "实际响应体："
    cat "${RESP_BODY_FILE}"
    exit 1
  fi
}

# 响应头字段非空断言。
assert_header_not_empty() {
  local key="$1"
  local actual
  actual="$(grep -i "^${key}:" "${RESP_HEADERS_FILE}" | tail -n 1 | cut -d ':' -f 2- | tr -d '\r' | sed 's/^ *//')"
  if [[ -z "${actual}" ]]; then
    echo "❌ 响应头 ${key} 为空"
    echo "实际响应头："
    cat "${RESP_HEADERS_FILE}"
    exit 1
  fi
}

# 等待网关健康检查可访问，避免刚启动时的瞬时失败。
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

echo "🧪 [5.2] 启动网关路由与鉴权冒烟环境..."
docker compose -f "${COMPOSE_FILE}" down -v --remove-orphans >/dev/null 2>&1 || true
docker compose -f "${COMPOSE_FILE}" up -d --build --wait --wait-timeout 240
wait_gateway_ready

echo "🔍 [5.2] 校验网关健康端点..."
request GET "/health"
assert_status 200
assert_body_contains "\"service\":\"nexuslog-gateway\""

echo "🔍 [5.2] 校验认证白名单路径（无需 Authorization）..."
request POST "/api/v1/auth/password/reset-request" '{"email_or_username":"smoke-user"}'
assert_status 200
assert_body_contains "\"service\":\"api-service\""

echo "🔍 [5.2] 校验受保护路径 401 错误体与 request_id..."
request GET "/api/v1/query/logs" "" "" "gw-smoke-401"
assert_status 401
assert_json_field_equals "code" "AUTH_MISSING_TOKEN"
assert_json_field_not_empty "request_id"
assert_header_not_empty "X-Request-ID"

echo "🔍 [5.2] 校验 403 错误体与 request_id（多租户路由拒绝）..."
request GET "/t/demo/api/foo" "" "" "gw-smoke-403"
assert_status 403
assert_json_field_equals "code" "AUTH_FORBIDDEN"
assert_json_field_not_empty "request_id"
assert_header_not_empty "X-Request-ID"

SMOKE_TOKEN="$(build_smoke_token)"

echo "🔍 [5.2] 校验 query/audit/export/bff 路由转发（带有效格式 Bearer Token）..."
request POST "/api/v1/query/logs" '{"keyword":"error"}' "${SMOKE_TOKEN}" "gw-route-query"
assert_status 200
assert_body_contains "\"service\":\"query-api\""
assert_header_not_empty "X-Request-ID"

request GET "/api/v1/audit/logs" "" "${SMOKE_TOKEN}" "gw-route-audit"
assert_status 200
assert_body_contains "\"service\":\"audit-api\""
assert_header_not_empty "X-Request-ID"

request POST "/api/v1/export/jobs" '{"format":"csv"}' "${SMOKE_TOKEN}" "gw-route-export"
assert_status 200
assert_body_contains "\"service\":\"export-api\""
assert_header_not_empty "X-Request-ID"

request GET "/api/v1/bff/overview" "" "${SMOKE_TOKEN}" "gw-route-bff"
assert_status 200
assert_body_contains "\"service\":\"bff-service\""
assert_header_not_empty "X-Request-ID"

echo "✅ [5.2] 网关路由与鉴权冒烟测试通过。"

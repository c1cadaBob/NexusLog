#!/usr/bin/env bash
set -euo pipefail

# 任务 5.5：容器热更新门禁（frontend + api-service）。
# 目标：验证开发容器内改动可自动生效，并确认不影响生产 compose 路径。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_BASE="${ROOT_DIR}/docker-compose.yml"
COMPOSE_OVERRIDE="${ROOT_DIR}/docker-compose.override.yml"
MIRROR_ENV_FILE="${ROOT_DIR}/.env.mirrors"

KEEP_ENV="${KEEP_ENV:-0}"
REPORT_FILE="${REPORT_FILE:-}"
DEV_START_TIMEOUT_SEC="${DEV_START_TIMEOUT_SEC:-300}"
HOT_RELOAD_TIMEOUT_SEC="${HOT_RELOAD_TIMEOUT_SEC:-120}"
POLL_INTERVAL_SEC="${POLL_INTERVAL_SEC:-2}"

FRONTEND_FILE="${ROOT_DIR}/apps/frontend-console/src/App.tsx"
API_FILE="${ROOT_DIR}/services/api-service/cmd/api/main.go"

TMP_DIR="$(mktemp -d)"
FRONTEND_MARKER_TOKEN="HOT_RELOAD_GATE_FRONTEND_$(date +%s)_${RANDOM}"
API_MARKER_TOKEN="HOT_RELOAD_GATE_API_$(date +%s)_${RANDOM}"
FRONTEND_MARKER_VAR="__hotReloadGateFrontend${RANDOM}"
FRONTEND_MARKER_LINE="const ${FRONTEND_MARKER_VAR} = \"${FRONTEND_MARKER_TOKEN}\";"
API_MARKER_LINE="// ${API_MARKER_TOKEN}"

LAST_MATCH_LINE=""
LAST_MATCH_SECONDS=0

FRONTEND_RESULT="FAIL"
FRONTEND_LOG_HIT="N/A"
FRONTEND_DETECT_SECONDS="N/A"

API_RESULT="FAIL"
API_LOG_HIT="N/A"
API_DETECT_SECONDS="N/A"

COMPOSE_ISOLATION_RESULT="FAIL"

STARTED_AT=""
ENDED_AT=""
DURATION_SEC=0

# 统一输出失败信息并退出，便于 CI/本地快速定位问题。
fail() {
  echo "❌ [5.5] $1"
  exit 1
}

# 删除探针标记行，避免测试中断时污染业务文件。
remove_marker() {
  local file_path="$1"
  local token="$2"
  if [[ -f "${file_path}" ]] && grep -Fq "${token}" "${file_path}"; then
    sed -i "\|${token}|d" "${file_path}"
  fi
}

# 清理临时目录与开发环境；默认收尾后关闭 dev 容器。
cleanup() {
  remove_marker "${FRONTEND_FILE}" "${FRONTEND_MARKER_TOKEN}" || true
  remove_marker "${API_FILE}" "${API_MARKER_TOKEN}" || true

  if [[ "${KEEP_ENV}" != "1" ]]; then
    docker compose -f "${COMPOSE_BASE}" -f "${COMPOSE_OVERRIDE}" down --remove-orphans >/dev/null 2>&1 || true
  fi

  rm -rf "${TMP_DIR}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# 加载镜像镜像源环境变量，保证 docker compose 行为与 make dev-* 一致。
load_mirror_env() {
  if [[ -f "${MIRROR_ENV_FILE}" ]]; then
    set -a
    # shellcheck disable=SC1090
    . "${MIRROR_ENV_FILE}"
    set +a
  fi
}

# dev 路径 compose 封装，统一使用 base + override。
dc_dev() {
  docker compose -f "${COMPOSE_BASE}" -f "${COMPOSE_OVERRIDE}" "$@"
}

# prod 路径 compose 封装，仅使用生产式 compose 文件。
dc_prod() {
  docker compose -f "${COMPOSE_BASE}" "$@"
}

# 校验关键文件存在，避免执行时才出现路径错误。
require_file() {
  local file_path="$1"
  if [[ ! -f "${file_path}" ]]; then
    fail "文件不存在: ${file_path}"
  fi
}

# 向目标文件追加探针标记，触发 watcher/HMR。
append_marker() {
  local file_path="$1"
  local marker_line="$2"
  printf '\n%s\n' "${marker_line}" >> "${file_path}"
}

# 等待 HTTP 端点返回 2xx，验证服务可用。
wait_http_ready() {
  local name="$1"
  local url="$2"
  local timeout_sec="$3"
  local start_epoch now elapsed

  start_epoch="$(date +%s)"
  while true; do
    if curl --noproxy '*' -fsS --max-time 5 "${url}" >/dev/null 2>&1; then
      return 0
    fi

    now="$(date +%s)"
    elapsed="$((now - start_epoch))"
    if (( elapsed >= timeout_sec )); then
      fail "${name} 未在 ${timeout_sec}s 内就绪: ${url}"
    fi
    sleep 1
  done
}

# 轮询 HTTP 响应体是否包含指定关键字，并记录命中耗时。
wait_http_body_contains() {
  local name="$1"
  local url="$2"
  local pattern="$3"
  local timeout_sec="$4"
  local start_epoch now elapsed body

  start_epoch="$(date +%s)"
  while true; do
    body="$(curl --noproxy '*' -sS --max-time 5 "${url}" 2>/dev/null || true)"
    if printf '%s\n' "${body}" | grep -Fq "${pattern}"; then
      now="$(date +%s)"
      LAST_MATCH_SECONDS="$((now - start_epoch))"
      LAST_MATCH_LINE="response body contains ${pattern}"
      return 0
    fi

    now="$(date +%s)"
    elapsed="$((now - start_epoch))"
    if (( elapsed >= timeout_sec )); then
      fail "${name} 未在 ${timeout_sec}s 内返回预期关键字: ${pattern}"
    fi
    sleep "${POLL_INTERVAL_SEC}"
  done
}

# 轮询容器日志直到出现指定关键字，并记录命中行与耗时。
wait_log_contains() {
  local service="$1"
  local since_ts="$2"
  local pattern="$3"
  local timeout_sec="$4"
  local start_epoch now elapsed logs

  start_epoch="$(date +%s)"
  while true; do
    logs="$(dc_dev logs --since "${since_ts}" "${service}" 2>/dev/null | tr -d '\r')"
    if printf '%s\n' "${logs}" | grep -Fq "${pattern}"; then
      LAST_MATCH_LINE="$(printf '%s\n' "${logs}" | grep -F "${pattern}" | head -n 1 || true)"
      now="$(date +%s)"
      LAST_MATCH_SECONDS="$((now - start_epoch))"
      return 0
    fi

    now="$(date +%s)"
    elapsed="$((now - start_epoch))"
    if (( elapsed >= timeout_sec )); then
      return 1
    fi
    sleep "${POLL_INTERVAL_SEC}"
  done
}

# 验证 dev/prod compose 隔离：dev 含热更新命令，prod 不应含 dev watcher 命令。
verify_compose_isolation() {
  local dev_cfg="${TMP_DIR}/compose-dev.yaml"
  local prod_cfg="${TMP_DIR}/compose-prod.yaml"

  dc_dev config > "${dev_cfg}"
  dc_prod config > "${prod_cfg}"

  if ! grep -Fq "pnpm --dir apps/frontend-console dev --host 0.0.0.0 --port 3000" "${dev_cfg}"; then
    fail "dev compose 未检测到 frontend HMR 命令"
  fi
  if ! grep -Fq "air --build.cmd" "${dev_cfg}" || ! grep -Fq "/tmp/api-service" "${dev_cfg}"; then
    fail "dev compose 未检测到 api-service air watcher 配置"
  fi
  if grep -Fq "pnpm --dir apps/frontend-console dev --host 0.0.0.0 --port 3000" "${prod_cfg}"; then
    fail "prod compose 意外包含 frontend HMR 命令"
  fi
  if grep -Fq "air --build.cmd" "${prod_cfg}"; then
    fail "prod compose 意外包含 air watcher 命令"
  fi

  COMPOSE_ISOLATION_RESULT="PASS"
}

# 输出 5.5 门禁报告，沉淀可审计验收证据。
write_report() {
  local report_path="$1"

  cat > "${report_path}" <<EOF
# Task 5.5 容器热更新门禁报告

- 日期：$(date '+%Y-%m-%d')
- 观测窗口：${STARTED_AT} ~ ${ENDED_AT}
- 执行时长（秒）：${DURATION_SEC}
- dev compose：\`docker-compose.yml + docker-compose.override.yml\`
- prod compose：\`docker-compose.yml\`

## 门禁结果

| 检查项 | 结果 | 说明 |
|---|---|---|
| frontend 热更新生效 | ${FRONTEND_RESULT} | 通过修改 \`apps/frontend-console/src/App.tsx\` 并验证 dev 响应已生效 |
| api-service 热更新生效 | ${API_RESULT} | 通过修改 \`services/api-service/cmd/api/main.go\` 触发 air 重编译 |
| dev/prod compose 路径隔离 | ${COMPOSE_ISOLATION_RESULT} | dev 含 watcher，prod 不含 dev watcher 命令 |

## 关键证据

1. frontend 探针命中耗时：${FRONTEND_DETECT_SECONDS}s  
   日志：\`${FRONTEND_LOG_HIT}\`
2. api-service 探针命中耗时：${API_DETECT_SECONDS}s  
   日志：\`${API_LOG_HIT}\`
3. 可用性检查：
   - frontend: \`GET http://127.0.0.1:3000\`（探针前后 2xx）
   - api-service: \`GET http://127.0.0.1:8085/healthz\`（探针前后 2xx）

## 结论

- frontend 与 api-service 在 dev 容器路径下均可自动热更新生效。
- 生产式 compose 路径未包含 dev watcher 配置，满足“热更新门禁通过且不影响生产式 compose 路径”。

## 附件

- 执行命令：\`make m1-hot-reload-gate\`
- 脚本路径：\`tests/integration/run_m1_hot_reload_gate.sh\`

EOF
}

require_file "${FRONTEND_FILE}"
require_file "${API_FILE}"
require_file "${COMPOSE_BASE}"
require_file "${COMPOSE_OVERRIDE}"

if ! [[ "${DEV_START_TIMEOUT_SEC}" =~ ^[0-9]+$ ]] || ! [[ "${HOT_RELOAD_TIMEOUT_SEC}" =~ ^[0-9]+$ ]] || ! [[ "${POLL_INTERVAL_SEC}" =~ ^[0-9]+$ ]]; then
  fail "参数非法：DEV_START_TIMEOUT_SEC/HOT_RELOAD_TIMEOUT_SEC/POLL_INTERVAL_SEC 必须为正整数"
fi
if (( DEV_START_TIMEOUT_SEC <= 0 || HOT_RELOAD_TIMEOUT_SEC <= 0 || POLL_INTERVAL_SEC <= 0 )); then
  fail "参数非法：超时与轮询间隔必须大于 0"
fi

load_mirror_env

STARTED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
start_epoch="$(date +%s)"

echo "🧪 [5.5] 启动 dev 轻量热更新环境..."
dc_dev down --remove-orphans >/dev/null 2>&1 || true
dc_dev up -d postgres redis control-plane api-service bff-service frontend-console

echo "⏳ [5.5] 等待 frontend/api-service 就绪..."
wait_http_ready "frontend-console" "http://127.0.0.1:3000" "${DEV_START_TIMEOUT_SEC}"
wait_http_ready "api-service" "http://127.0.0.1:8085/healthz" "${DEV_START_TIMEOUT_SEC}"

echo "🔍 [5.5] 前端热更新探针：修改 App.tsx 并校验 dev 模块响应..."
frontend_since="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
append_marker "${FRONTEND_FILE}" "${FRONTEND_MARKER_LINE}"
wait_http_body_contains "frontend-module" "http://127.0.0.1:3000/src/App.tsx" "${FRONTEND_MARKER_TOKEN}" "${HOT_RELOAD_TIMEOUT_SEC}"
FRONTEND_RESULT="PASS"
FRONTEND_DETECT_SECONDS="${LAST_MATCH_SECONDS}"
FRONTEND_LOG_HIT="$(dc_dev logs --since "${frontend_since}" frontend-console 2>/dev/null | tr -d '\r' | grep -F "App.tsx" | head -n 1 || true)"
if [[ -z "${FRONTEND_LOG_HIT}" ]]; then
  FRONTEND_LOG_HIT="${LAST_MATCH_LINE}"
fi
remove_marker "${FRONTEND_FILE}" "${FRONTEND_MARKER_TOKEN}"
wait_http_ready "frontend-console" "http://127.0.0.1:3000" "${HOT_RELOAD_TIMEOUT_SEC}"

echo "🔍 [5.5] 后端热更新探针：修改 main.go 并监听 air 日志..."
api_since="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
append_marker "${API_FILE}" "${API_MARKER_LINE}"
if wait_log_contains "api-service" "${api_since}" "cmd/api/main.go has changed" "${HOT_RELOAD_TIMEOUT_SEC}"; then
  API_RESULT="PASS"
  API_LOG_HIT="${LAST_MATCH_LINE}"
  API_DETECT_SECONDS="${LAST_MATCH_SECONDS}"
else
  fail "api-service 热更新未在 ${HOT_RELOAD_TIMEOUT_SEC}s 内命中日志"
fi
remove_marker "${API_FILE}" "${API_MARKER_TOKEN}"
wait_http_ready "api-service" "http://127.0.0.1:8085/healthz" "${HOT_RELOAD_TIMEOUT_SEC}"

echo "🔒 [5.5] 校验 dev/prod compose 路径隔离..."
verify_compose_isolation

ENDED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
end_epoch="$(date +%s)"
DURATION_SEC="$((end_epoch - start_epoch))"

if [[ -z "${REPORT_FILE}" ]]; then
  report_date="$(date +%Y%m%d)"
  REPORT_FILE="docs/NexusLog/process/evidence/task-5.5-hot-reload-gate-${report_date}.md"
fi
mkdir -p "$(dirname "${REPORT_FILE}")"
write_report "${REPORT_FILE}"

echo "✅ [5.5] 容器热更新门禁通过。"
echo "📄 报告文件: ${REPORT_FILE}"
echo "📊 关键结果: frontend=${FRONTEND_RESULT}(${FRONTEND_DETECT_SECONDS}s) api-service=${API_RESULT}(${API_DETECT_SECONDS}s) compose_isolation=${COMPOSE_ISOLATION_RESULT}"

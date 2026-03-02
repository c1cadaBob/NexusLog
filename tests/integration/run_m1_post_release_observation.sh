#!/usr/bin/env bash
set -euo pipefail

# 任务 5.4：发布后观察 30 分钟并记录关键指标。
# 指标范围：错误率、延迟（均值/P95/P99）、登录成功率。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.gateway-smoke.yml"
GATEWAY_BASE_URL="${GATEWAY_BASE_URL:-http://localhost:18080}"
OBSERVE_MINUTES="${OBSERVE_MINUTES:-30}"
SAMPLE_INTERVAL_SEC="${SAMPLE_INTERVAL_SEC:-10}"
KEEP_ENV="${KEEP_ENV:-0}"
REPORT_FILE="${REPORT_FILE:-}"

TMP_DIR="$(mktemp -d)"
RAW_CSV="${TMP_DIR}/observation_raw.csv"

cleanup() {
  # 如果用户未显式保留环境，结束后自动清理容器。
  if [[ "${KEEP_ENV}" != "1" ]]; then
    docker compose -f "${COMPOSE_FILE}" down -v --remove-orphans >/dev/null 2>&1 || true
  fi
  rm -rf "${TMP_DIR}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# base64url 编码工具：用于拼装观察期 Bearer Token。
base64url_encode() {
  printf '%s' "$1" | openssl base64 -A | tr '+/' '-_' | tr -d '='
}

# 构造观察用 JWT（网关按 claims 校验并允许降级签名验证）。
build_smoke_token() {
  local now exp header payload
  now="$(date +%s)"
  exp="$((now + 3600))"
  header='{"alg":"HS256","typ":"JWT"}'
  payload='{"sub":"observe-user","preferred_username":"observe-user","email":"observe@example.com","tenant_id":"demo","exp":'"${exp}"',"iat":'"${now}"'}'
  printf '%s.%s.%s' "$(base64url_encode "${header}")" "$(base64url_encode "${payload}")" "observe-signature"
}

# 等待网关健康可用，避免冷启动期间采样污染统计。
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

# 采样一个请求并记录到 CSV：timestamp,name,status,latency_ms,category
sample_request() {
  local ts="$1"
  local name="$2"
  local method="$3"
  local path="$4"
  local body="$5"
  local token="$6"
  local category="$7"

  local body_file="${TMP_DIR}/body.$RANDOM.txt"
  local header_file="${TMP_DIR}/headers.$RANDOM.txt"
  local out status latency_s latency_ms

  local -a args
  args=(
    --noproxy '*'
    -sS
    -X "${method}"
    -D "${header_file}"
    -o "${body_file}"
    --max-time 10
    "${GATEWAY_BASE_URL}${path}"
    -w 'STATUS:%{http_code} TIME:%{time_total}'
  )

  if [[ -n "${body}" ]]; then
    args+=(-H "Content-Type: application/json" --data "${body}")
  fi
  if [[ -n "${token}" ]]; then
    args+=(-H "Authorization: Bearer ${token}")
  fi

  # 采样请求允许偶发失败，避免单点网络抖动中断整段观察窗口。
  out="$(curl "${args[@]}" 2>/dev/null || true)"
  status="$(printf '%s' "${out}" | sed -n 's/.*STATUS:\([0-9][0-9][0-9]\).*/\1/p')"
  latency_s="$(printf '%s' "${out}" | sed -n 's/.*TIME:\([0-9.]\+\).*/\1/p')"
  latency_ms="$(awk -v t="${latency_s:-0}" 'BEGIN {printf "%.3f", t * 1000}')"

  if [[ -z "${status}" ]]; then
    status="000"
  fi

  printf '%s,%s,%s,%s,%s\n' "${ts}" "${name}" "${status:-000}" "${latency_ms}" "${category}" >> "${RAW_CSV}"
}

# 计算百分位延迟（单位 ms）。
calc_percentile_ms() {
  local percentile="$1"
  awk -F',' '$5=="success_slo" {print $4}' "${RAW_CSV}" \
    | sort -n \
    | awk -v p="${percentile}" '
      {a[++n]=$1}
      END{
        if(n==0){print "NA"; exit}
        idx=int((p/100)*n)
        if((p/100)*n > idx){idx=idx+1}
        if(idx < 1){idx=1}
        if(idx > n){idx=n}
        printf "%.3f", a[idx]
      }'
}

# 计算平均延迟（单位 ms）。
calc_mean_ms() {
  awk -F',' '$5=="success_slo" {sum+=$4; n++} END {if(n==0){print "NA"} else {printf "%.3f", sum/n}}' "${RAW_CSV}"
}

# 计算百分比（两位小数）。
calc_rate_percent() {
  local numerator="$1"
  local denominator="$2"
  awk -v n="${numerator}" -v d="${denominator}" 'BEGIN {if(d==0){print "0.00"} else {printf "%.2f", (n*100)/d}}'
}

# 生成 Markdown 观察报告。
write_report() {
  local report_path="$1"
  local started_at="$2"
  local ended_at="$3"
  local duration_sec="$4"
  local total_requests="$5"
  local server_5xx="$6"
  local server_error_rate="$7"
  local mean_latency="$8"
  local p95_latency="$9"
  local p99_latency="${10}"
  local login_total="${11}"
  local login_success="${12}"
  local login_success_rate="${13}"
  local slo_total="${14}"
  local slo_non_2xx="${15}"
  local slo_error_rate="${16}"

  cat > "${report_path}" <<EOF
# Task 5.4 发布后 30 分钟观察报告

- 日期：$(date '+%Y-%m-%d')
- 观察窗口：${started_at} ~ ${ended_at}
- 观察时长（秒）：${duration_sec}
- 采样间隔（秒）：${SAMPLE_INTERVAL_SEC}
- 网关地址：${GATEWAY_BASE_URL}

## 指标结果

| 指标 | 数值 | 说明 |
|---|---:|---|
| 总请求数 | ${total_requests} | 30 分钟窗口内采样总量 |
| 5xx 数量 | ${server_5xx} | 服务端错误计数 |
| 错误率（5xx/总请求） | ${server_error_rate}% | 发布观察核心错误率 |
| 延迟均值（ms） | ${mean_latency} | success_slo 请求集合 |
| 延迟 P95（ms） | ${p95_latency} | success_slo 请求集合 |
| 延迟 P99（ms） | ${p99_latency} | success_slo 请求集合 |
| 登录请求数 | ${login_total} | \`POST /api/v1/auth/login\` |
| 登录成功数 | ${login_success} | HTTP 2xx 计为成功 |
| 登录成功率 | ${login_success_rate}% | 成功数 / 登录请求数 |
| 业务路径异常率（非 2xx） | ${slo_error_rate}% | success_slo 请求中非 2xx 占比 |

## 口径说明

1. \`success_slo\` 包含三类请求：登录、带 Token 的 query、带 Token 的 bff。
2. 错误率按 5xx 计算；401 鉴权拒绝不计入 5xx 错误率。
3. 延迟统计口径为 \`success_slo\` 请求的 \`curl time_total\`（毫秒）。

## 结论

- 30 分钟观察窗口已完成。
- 若错误率（5xx）维持低位、延迟无异常抬升且登录成功率稳定，可判定本次发布观察通过。

## 附件

- 原始采样 CSV（临时路径，脚本结束后会清理）：${RAW_CSV}
- 执行命令：\`make m1-post-release-observe\`

EOF
}

if ! [[ "${OBSERVE_MINUTES}" =~ ^[0-9]+$ ]] || ! [[ "${SAMPLE_INTERVAL_SEC}" =~ ^[0-9]+$ ]] || [[ "${SAMPLE_INTERVAL_SEC}" -le 0 ]]; then
  echo "❌ 参数非法：OBSERVE_MINUTES 和 SAMPLE_INTERVAL_SEC 必须为正整数"
  exit 1
fi

cycles=$((OBSERVE_MINUTES * 60 / SAMPLE_INTERVAL_SEC))
if [[ "${cycles}" -le 0 ]]; then
  echo "❌ 采样轮数为 0，请检查 OBSERVE_MINUTES 与 SAMPLE_INTERVAL_SEC"
  exit 1
fi

mkdir -p "$(dirname "${RAW_CSV}")"
echo "timestamp,name,status,latency_ms,category" > "${RAW_CSV}"

echo "🧪 [5.4] 启动发布后观察环境..."
docker compose -f "${COMPOSE_FILE}" down -v --remove-orphans >/dev/null 2>&1 || true
docker compose -f "${COMPOSE_FILE}" up -d --build --wait --wait-timeout 240
wait_gateway_ready

token="$(build_smoke_token)"
started_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
start_epoch="$(date +%s)"

echo "📈 [5.4] 开始 30 分钟观察：共 ${cycles} 轮，每轮间隔 ${SAMPLE_INTERVAL_SEC}s..."
for i in $(seq 1 "${cycles}"); do
  ts="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

  if (( i == 1 || i % 10 == 0 || i == cycles )); then
    echo "⏱️ [5.4] 采样进度: ${i}/${cycles}"
  fi

  # 关键指标采样：登录成功率（login）、业务请求延迟/错误率（query+bff）。
  sample_request "${ts}" "login" "POST" "/api/v1/auth/login" '{"username":"observe-user","password":"Password123"}' "" "success_slo"
  sample_request "${ts}" "query_auth" "POST" "/api/v1/query/logs" '{"keyword":"observe"}' "${token}" "success_slo"
  sample_request "${ts}" "bff_auth" "GET" "/api/v1/bff/overview" "" "${token}" "success_slo"

  # 受保护路径无 Token 采样：验证鉴权拒绝路径稳定，不纳入 success_slo。
  sample_request "${ts}" "query_no_token" "POST" "/api/v1/query/logs" '{"keyword":"observe-no-token"}' "" "auth_guard"

  if (( i < cycles )); then
    sleep "${SAMPLE_INTERVAL_SEC}"
  fi
done

ended_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
end_epoch="$(date +%s)"
duration_sec=$((end_epoch - start_epoch))

total_requests="$(awk -F',' 'NR>1 {c++} END {print c+0}' "${RAW_CSV}")"
server_5xx="$(awk -F',' 'NR>1 && $3 ~ /^5/ {c++} END {print c+0}' "${RAW_CSV}")"
server_error_rate="$(calc_rate_percent "${server_5xx}" "${total_requests}")"

slo_total="$(awk -F',' 'NR>1 && $5=="success_slo" {c++} END {print c+0}' "${RAW_CSV}")"
slo_non_2xx="$(awk -F',' 'NR>1 && $5=="success_slo" && $3 !~ /^2/ {c++} END {print c+0}' "${RAW_CSV}")"
slo_error_rate="$(calc_rate_percent "${slo_non_2xx}" "${slo_total}")"

login_total="$(awk -F',' 'NR>1 && $2=="login" {c++} END {print c+0}' "${RAW_CSV}")"
login_success="$(awk -F',' 'NR>1 && $2=="login" && $3 ~ /^2/ {c++} END {print c+0}' "${RAW_CSV}")"
login_success_rate="$(calc_rate_percent "${login_success}" "${login_total}")"

mean_latency="$(calc_mean_ms)"
p95_latency="$(calc_percentile_ms 95)"
p99_latency="$(calc_percentile_ms 99)"

if [[ -z "${REPORT_FILE}" ]]; then
  report_date="$(date +%Y%m%d)"
  REPORT_FILE="docs/NexusLog/process/evidence/task-5.4-post-release-observation-${report_date}.md"
fi

mkdir -p "$(dirname "${REPORT_FILE}")"
write_report "${REPORT_FILE}" "${started_at}" "${ended_at}" "${duration_sec}" "${total_requests}" "${server_5xx}" "${server_error_rate}" "${mean_latency}" "${p95_latency}" "${p99_latency}" "${login_total}" "${login_success}" "${login_success_rate}" "${slo_total}" "${slo_non_2xx}" "${slo_error_rate}"

echo "✅ [5.4] 发布后观察完成。"
echo "📄 报告文件: ${REPORT_FILE}"
echo "📊 关键指标: error_rate_5xx=${server_error_rate}% p95=${p95_latency}ms p99=${p99_latency}ms login_success_rate=${login_success_rate}%"

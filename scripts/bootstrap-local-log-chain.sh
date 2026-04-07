#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

LOCAL_TENANT_CONFIG_SCRIPT="${LOCAL_TENANT_CONFIG_SCRIPT:-$ROOT_DIR/scripts/local/ensure-local-tenant-config.sh}"
LOCAL_TENANT_ID_FILE="${LOCAL_TENANT_ID_FILE:-$ROOT_DIR/.runtime/tenant/local-tenant-id}"
CONTROL_PLANE_URL="${CONTROL_PLANE_URL:-http://localhost:8080}"
API_SERVICE_URL="${API_SERVICE_URL:-http://localhost:8085}"
QUERY_API_URL="${QUERY_API_URL:-http://localhost:8082}"
SCHEMA_REGISTRY_URL="${SCHEMA_REGISTRY_URL:-http://localhost:18081}"
FLINK_REST_URL="${FLINK_REST_URL:-http://localhost:8088}"
ALERTMANAGER_URL="${ALERTMANAGER_URL:-http://localhost:19093}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3002}"
TENANT_ID="${TENANT_ID:-}"
ACCESS_TOKEN="${ACCESS_TOKEN:-}"
LOCAL_BOOTSTRAP_USERNAME="${LOCAL_BOOTSTRAP_USERNAME:-sys-superadmin}"
LOCAL_BOOTSTRAP_PASSWORD="${LOCAL_BOOTSTRAP_PASSWORD:-Demo@2026}"
LOCAL_BOOTSTRAP_REMEMBER_ME="${LOCAL_BOOTSTRAP_REMEMBER_ME:-true}"
LEGACY_LOCAL_PULL_SOURCE_NAME="${LOCAL_PULL_SOURCE_NAME:-}"
LEGACY_LOCAL_PULL_SOURCE_PATH="${LOCAL_PULL_SOURCE_PATH:-}"
LEGACY_LOCAL_PULL_SOURCE_PULL_INTERVAL_SEC="${LOCAL_PULL_SOURCE_PULL_INTERVAL_SEC:-}"
LEGACY_LOCAL_PULL_SOURCE_PULL_TIMEOUT_SEC="${LOCAL_PULL_SOURCE_PULL_TIMEOUT_SEC:-}"
LOCAL_PULL_SOURCE_HOST_NAME="${LOCAL_PULL_SOURCE_HOST_NAME:-${LEGACY_LOCAL_PULL_SOURCE_NAME:-local-host-buffered-logs}}"
LOCAL_PULL_SOURCE_HOST_PATH="${LOCAL_PULL_SOURCE_HOST_PATH:-${LEGACY_LOCAL_PULL_SOURCE_PATH:-/var/log/*.log,/var/log/messages,/var/log/secure,/var/log/cron,/var/log/maillog,/var/log/spooler,/var/log/boot.log,/var/log/command_audit.log,/var/log/kdump.log,/var/log/*/*.log,/var/log/*/*_log}}"
LOCAL_PULL_SOURCE_DOCKER_NAME="${LOCAL_PULL_SOURCE_DOCKER_NAME:-local-docker-buffered-logs}"
LOCAL_PULL_SOURCE_DOCKER_PATH="${LOCAL_PULL_SOURCE_DOCKER_PATH:-/host-docker-containers/*/*-json.log}"
LOCAL_PULL_SOURCE_AGENT_BASE_URL="${LOCAL_PULL_SOURCE_AGENT_BASE_URL:-http://collector-agent:9091}"
LOCAL_PULL_SOURCE_HOST="${LOCAL_PULL_SOURCE_HOST:-collector-agent}"
LOCAL_PULL_SOURCE_PORT="${LOCAL_PULL_SOURCE_PORT:-9091}"
LOCAL_PULL_SOURCE_PROTOCOL="${LOCAL_PULL_SOURCE_PROTOCOL:-http}"
LOCAL_PULL_SOURCE_AUTH="${LOCAL_PULL_SOURCE_AUTH:-agent-key}"
LOCAL_PULL_SOURCE_KEY_REF="${LOCAL_PULL_SOURCE_KEY_REF:-active}"
LOCAL_PULL_SOURCE_HOST_PULL_INTERVAL_SEC="${LOCAL_PULL_SOURCE_HOST_PULL_INTERVAL_SEC:-${LEGACY_LOCAL_PULL_SOURCE_PULL_INTERVAL_SEC:-2}}"
LOCAL_PULL_SOURCE_DOCKER_PULL_INTERVAL_SEC="${LOCAL_PULL_SOURCE_DOCKER_PULL_INTERVAL_SEC:-${LEGACY_LOCAL_PULL_SOURCE_PULL_INTERVAL_SEC:-2}}"
LOCAL_PULL_SOURCE_HOST_PULL_TIMEOUT_SEC="${LOCAL_PULL_SOURCE_HOST_PULL_TIMEOUT_SEC:-${LEGACY_LOCAL_PULL_SOURCE_PULL_TIMEOUT_SEC:-15}}"
LOCAL_PULL_SOURCE_DOCKER_PULL_TIMEOUT_SEC="${LOCAL_PULL_SOURCE_DOCKER_PULL_TIMEOUT_SEC:-${LEGACY_LOCAL_PULL_SOURCE_PULL_TIMEOUT_SEC:-15}}"
LOCAL_ALERT_RULE_NAME="${LOCAL_ALERT_RULE_NAME:-local-host-token-alert}"
LOCAL_ALERT_RULE_KEYWORD="${LOCAL_ALERT_RULE_KEYWORD:-NEXUSLOG_LOCAL_ALERT_TEST}"
LOCAL_ALERT_RULE_WINDOW_SECONDS="${LOCAL_ALERT_RULE_WINDOW_SECONDS:-900}"
WAIT_RETRIES="${WAIT_RETRIES:-120}"
WAIT_INTERVAL_SEC="${WAIT_INTERVAL_SEC:-2}"
LOCAL_BOOTSTRAP_RESET_SUBJECTS="${LOCAL_BOOTSTRAP_RESET_SUBJECTS:-false}"
LOCAL_BOOTSTRAP_CANCEL_STALE_TASKS="${LOCAL_BOOTSTRAP_CANCEL_STALE_TASKS:-true}"
LOCAL_BOOTSTRAP_STALE_TASK_MAX_AGE_MINUTES="${LOCAL_BOOTSTRAP_STALE_TASK_MAX_AGE_MINUTES:-15}"
LOCAL_BOOTSTRAP_TRIGGER_PULL_RUN="${LOCAL_BOOTSTRAP_TRIGGER_PULL_RUN:-true}"
LOCAL_BOOTSTRAP_RESTART_CONTROL_PLANE_ON_TENANT_SYNC="${LOCAL_BOOTSTRAP_RESTART_CONTROL_PLANE_ON_TENANT_SYNC:-true}"
LOCAL_BOOTSTRAP_INSTALL_SNAPSHOT_REPOSITORY="${LOCAL_BOOTSTRAP_INSTALL_SNAPSHOT_REPOSITORY:-true}"
LOCAL_BOOTSTRAP_INSTALL_SNAPSHOT_POLICY="${LOCAL_BOOTSTRAP_INSTALL_SNAPSHOT_POLICY:-true}"
PREVIOUS_TENANT_ID=""
TENANT_ID_RESYNC_REQUIRED="false"

info() {
  echo "[local-bootstrap] $*" >&2
}

error() {
  echo "[local-bootstrap] ERROR: $*" >&2
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    error "required command not found: $1"
    exit 1
  fi
}

normalize_uuid() {
  printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]'
}

read_current_tenant_file() {
  if [[ ! -f "$LOCAL_TENANT_ID_FILE" ]]; then
    return 0
  fi
  normalize_uuid "$(cat "$LOCAL_TENANT_ID_FILE")"
}

resolve_local_tenant_id() {
  if [[ ! -f "$LOCAL_TENANT_CONFIG_SCRIPT" ]]; then
    error "local tenant helper script not found: $LOCAL_TENANT_CONFIG_SCRIPT"
    exit 1
  fi

  if [[ -n "$TENANT_ID" ]]; then
    TENANT_ID="$TENANT_ID" bash "$LOCAL_TENANT_CONFIG_SCRIPT"
    return 0
  fi

  bash "$LOCAL_TENANT_CONFIG_SCRIPT"
}

ensure_bootstrap_tenant_seed() {
  info "ensuring bootstrap identities for tenant: $TENANT_ID"
  TENANT_ID="$TENANT_ID" bash "$ROOT_DIR/scripts/seed-demo.sh"
}

wait_for_url() {
  local url="$1"
  local name="$2"
  local attempt
  for attempt in $(seq 1 "$WAIT_RETRIES"); do
    if curl --noproxy '*' -fsS "$url" >/dev/null 2>&1; then
      info "$name is ready: $url"
      return 0
    fi
    sleep "$WAIT_INTERVAL_SEC"
  done
  error "$name not ready: $url"
  exit 1
}

restart_control_plane_if_tenant_resynced() {
  if [[ "$TENANT_ID_RESYNC_REQUIRED" != "true" ]]; then
    return 0
  fi
  if [[ "$LOCAL_BOOTSTRAP_RESTART_CONTROL_PLANE_ON_TENANT_SYNC" != "true" ]]; then
    info "tenant file changed to $TENANT_ID but control-plane auto-restart is disabled"
    return 0
  fi

  require_cmd docker
  info "tenant file changed from ${PREVIOUS_TENANT_ID:-<empty>} to $TENANT_ID, restarting control-plane to reload tenant-scoped runtime"
  docker compose restart control-plane >/dev/null
  wait_for_url "$CONTROL_PLANE_URL/healthz" "control-plane"
}

ensure_access_token() {
  local payload response

  if [[ -n "$ACCESS_TOKEN" ]]; then
    info "using ACCESS_TOKEN from environment"
    return 0
  fi

  payload="$(jq -n \
    --arg username "$LOCAL_BOOTSTRAP_USERNAME" \
    --arg password "$LOCAL_BOOTSTRAP_PASSWORD" \
    --argjson remember_me "$LOCAL_BOOTSTRAP_REMEMBER_ME" \
    '{username:$username,password:$password,remember_me:$remember_me}')"

  response="$(curl -fsS -X POST "$API_SERVICE_URL/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -H "X-Tenant-ID: $TENANT_ID" \
    -d "$payload")"
  ACCESS_TOKEN="$(echo "$response" | jq -r '.data.access_token')"
  if [[ -z "$ACCESS_TOKEN" || "$ACCESS_TOKEN" == "null" ]]; then
    error "failed to obtain ACCESS_TOKEN from api-service login"
    exit 1
  fi

  info "obtained bootstrap access token via api-service"
}

control_plane_api() {
  curl -fsS \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "X-Tenant-ID: $TENANT_ID" \
    "$@"
}

find_pull_source_id() {
  local response="$1"
  local name="$2"
  local path="$3"
  {
    echo "$response" | jq -r --arg name "$name" '.data.items[]? | select(.name == $name) | .source_id'
    echo "$response" | jq -r --arg base "$LOCAL_PULL_SOURCE_AGENT_BASE_URL" --arg path "$path" '.data.items[]? | select(.agent_base_url == $base and .path == $path) | .source_id'
  } | awk 'NF {print; exit}'
}

ensure_pull_source() {
  local name="$1"
  local path="$2"
  local pull_interval_sec="$3"
  local pull_timeout_sec="$4"
  local response source_id payload
  response="$(control_plane_api "$CONTROL_PLANE_URL/api/v1/ingest/pull-sources?page=1&page_size=200")"
  source_id="$(find_pull_source_id "$response" "$name" "$path")"

  payload="$(jq -n \
    --arg name "$name" \
    --arg host "$LOCAL_PULL_SOURCE_HOST" \
    --argjson port "$LOCAL_PULL_SOURCE_PORT" \
    --arg protocol "$LOCAL_PULL_SOURCE_PROTOCOL" \
    --arg path "$path" \
    --arg auth "$LOCAL_PULL_SOURCE_AUTH" \
    --arg agent_base_url "$LOCAL_PULL_SOURCE_AGENT_BASE_URL" \
    --argjson pull_interval_sec "$pull_interval_sec" \
    --argjson pull_timeout_sec "$pull_timeout_sec" \
    --arg key_ref "$LOCAL_PULL_SOURCE_KEY_REF" \
    --arg status "active" \
    '{name:$name,host:$host,port:$port,protocol:$protocol,path:$path,auth:$auth,agent_base_url:$agent_base_url,pull_interval_sec:$pull_interval_sec,pull_timeout_sec:$pull_timeout_sec,key_ref:$key_ref,status:$status}')"

  if [[ -n "$source_id" ]]; then
    info "reusing pull source [$name]: $source_id"
    control_plane_api -X PUT "$CONTROL_PLANE_URL/api/v1/ingest/pull-sources" \
      -H 'Content-Type: application/json' \
      -d "$(echo "$payload" | jq --arg source_id "$source_id" '. + {source_id:$source_id}')" >/dev/null
    echo "$source_id"
    return 0
  fi

  source_id="$(control_plane_api -X POST "$CONTROL_PLANE_URL/api/v1/ingest/pull-sources" \
    -H 'Content-Type: application/json' \
    -d "$payload" | jq -r '.data.source_id')"
  if [[ -z "$source_id" || "$source_id" == "null" ]]; then
    error "failed to create local pull source [$name]"
    exit 1
  fi
  info "created pull source [$name]: $source_id"
  echo "$source_id"
}

cancel_stale_pull_tasks() {
  local source_id="$1"
  local name="$2"
  local affected

  if [[ "$LOCAL_BOOTSTRAP_CANCEL_STALE_TASKS" != "true" ]]; then
    return 0
  fi

  affected="$(docker compose exec -T postgres psql -U nexuslog -d nexuslog -At -c "WITH updated AS (
    UPDATE ingest_pull_tasks
    SET status = 'canceled',
        error_code = COALESCE(NULLIF(error_code, ''), 'BOOTSTRAP_STALE_TASK_CANCELED'),
        error_message = COALESCE(NULLIF(error_message, ''), 'canceled by bootstrap stale task cleanup'),
        finished_at = COALESCE(finished_at, NOW()),
        updated_at = NOW()
    WHERE source_id = '$source_id'::uuid
      AND status IN ('pending', 'running')
      AND updated_at < NOW() - INTERVAL '$LOCAL_BOOTSTRAP_STALE_TASK_MAX_AGE_MINUTES minutes'
    RETURNING 1
  )
  SELECT count(*) FROM updated;" | tr -d '[:space:]')"

  if [[ -n "$affected" && "$affected" != "0" ]]; then
    info "canceled stale in-flight tasks [$name]: $affected"
  fi
}

trigger_pull_source() {
  local source_id="$1"
  local name="$2"
  local timeout_sec="$3"

  if [[ "$LOCAL_BOOTSTRAP_TRIGGER_PULL_RUN" != "true" ]]; then
    return 0
  fi

  control_plane_api -X POST "$CONTROL_PLANE_URL/api/v1/ingest/pull-tasks/run" \
    -H 'Content-Type: application/json' \
    -d "$(jq -n --arg source_id "$source_id" --argjson timeout_ms "$((timeout_sec * 1000))" '{source_id:$source_id,trigger_type:"manual",options:{timeout_ms:$timeout_ms}}')" >/dev/null
  info "triggered manual pull [$name]: $source_id"
}

ensure_alert_rule() {
  local response rule_id payload
  response="$(control_plane_api "$CONTROL_PLANE_URL/api/v1/alert/rules?page=1&page_size=200")"
  rule_id="$(echo "$response" | jq -r --arg name "$LOCAL_ALERT_RULE_NAME" '.data.items[]? | select(.name == $name) | .id' | awk 'NF {print; exit}')"

  if [[ -n "$rule_id" ]]; then
    info "reusing alert rule: $rule_id"
    echo "$rule_id"
    return 0
  fi

  payload="$(jq -n \
    --arg name "$LOCAL_ALERT_RULE_NAME" \
    --arg description "Deterministic local alert rule for bootstrap token $LOCAL_ALERT_RULE_KEYWORD" \
    --arg keyword "$LOCAL_ALERT_RULE_KEYWORD" \
    --argjson window_seconds "$LOCAL_ALERT_RULE_WINDOW_SECONDS" \
    '{name:$name,description:$description,severity:"critical",enabled:true,notification_channels:[],condition:{type:"keyword",field:"message",keyword:$keyword,window_seconds:$window_seconds}}')"

  rule_id="$(control_plane_api -X POST "$CONTROL_PLANE_URL/api/v1/alert/rules" \
    -H 'Content-Type: application/json' \
    -d "$payload" | jq -r '.data.id')"
  if [[ -z "$rule_id" || "$rule_id" == "null" ]]; then
    error "failed to create local alert rule"
    exit 1
  fi
  info "created alert rule: $rule_id"
  echo "$rule_id"
}

require_cmd curl
require_cmd jq
if [[ "$LOCAL_BOOTSTRAP_CANCEL_STALE_TASKS" == "true" || "$LOCAL_BOOTSTRAP_TRIGGER_PULL_RUN" == "true" ]]; then
  require_cmd docker
fi

PREVIOUS_TENANT_ID="$(read_current_tenant_file)"
TENANT_ID="$(resolve_local_tenant_id)"
if [[ -n "$PREVIOUS_TENANT_ID" && "$PREVIOUS_TENANT_ID" != "$TENANT_ID" ]]; then
  TENANT_ID_RESYNC_REQUIRED="true"
fi
info "using bootstrap tenant: $TENANT_ID"

wait_for_url "$CONTROL_PLANE_URL/healthz" "control-plane"
restart_control_plane_if_tenant_resynced
wait_for_url "$API_SERVICE_URL/healthz" "api-service"
wait_for_url "$QUERY_API_URL/healthz" "query-api"
wait_for_url "$SCHEMA_REGISTRY_URL/subjects" "schema-registry"
wait_for_url "$FLINK_REST_URL/overview" "flink-rest"
wait_for_url "$ALERTMANAGER_URL/-/ready" "alertmanager"
wait_for_url "$GRAFANA_URL/api/health" "grafana"

SCHEMA_REGISTRY_RESET_SUBJECTS="$LOCAL_BOOTSTRAP_RESET_SUBJECTS" \
REGISTER_PARSED_SUBJECT=false \
SCHEMA_FILE_LOG_RAW="${SCHEMA_FILE_LOG_RAW:-$ROOT_DIR/stream/flink/contracts/local/log-raw.avsc}" \
SCHEMA_FILE_LOG_PARSED="${SCHEMA_FILE_LOG_PARSED:-$ROOT_DIR/stream/flink/contracts/local/log-parsed.avsc}" \
SCHEMA_REGISTRY_URL="$SCHEMA_REGISTRY_URL" \
  bash "$ROOT_DIR/scripts/register-schema-registry-subjects.sh"

ES_HOST="${ES_HOST:-http://localhost:9200}" bash "$ROOT_DIR/scripts/install-es-v2-template.sh"
ES_HOST="${ES_HOST:-http://localhost:9200}" bash "$ROOT_DIR/scripts/install-es-log-aliases.sh"
if [[ "$LOCAL_BOOTSTRAP_INSTALL_SNAPSHOT_REPOSITORY" == "true" ]]; then
  ES_HOST="${ES_HOST:-http://localhost:9200}" bash "$ROOT_DIR/scripts/install-es-snapshot-repository.sh"
fi
if [[ "$LOCAL_BOOTSTRAP_INSTALL_SNAPSHOT_POLICY" == "true" ]]; then
  ES_HOST="${ES_HOST:-http://localhost:9200}" bash "$ROOT_DIR/scripts/install-es-snapshot-policy.sh"
fi

ensure_bootstrap_tenant_seed
ensure_access_token

HOST_SOURCE_ID="$(ensure_pull_source "$LOCAL_PULL_SOURCE_HOST_NAME" "$LOCAL_PULL_SOURCE_HOST_PATH" "$LOCAL_PULL_SOURCE_HOST_PULL_INTERVAL_SEC" "$LOCAL_PULL_SOURCE_HOST_PULL_TIMEOUT_SEC")"
DOCKER_SOURCE_ID="$(ensure_pull_source "$LOCAL_PULL_SOURCE_DOCKER_NAME" "$LOCAL_PULL_SOURCE_DOCKER_PATH" "$LOCAL_PULL_SOURCE_DOCKER_PULL_INTERVAL_SEC" "$LOCAL_PULL_SOURCE_DOCKER_PULL_TIMEOUT_SEC")"
cancel_stale_pull_tasks "$HOST_SOURCE_ID" "$LOCAL_PULL_SOURCE_HOST_NAME"
cancel_stale_pull_tasks "$DOCKER_SOURCE_ID" "$LOCAL_PULL_SOURCE_DOCKER_NAME"
trigger_pull_source "$HOST_SOURCE_ID" "$LOCAL_PULL_SOURCE_HOST_NAME" "$LOCAL_PULL_SOURCE_HOST_PULL_TIMEOUT_SEC"
trigger_pull_source "$DOCKER_SOURCE_ID" "$LOCAL_PULL_SOURCE_DOCKER_NAME" "$LOCAL_PULL_SOURCE_DOCKER_PULL_TIMEOUT_SEC"
RULE_ID="$(ensure_alert_rule)"

cat <<EOF
[local-bootstrap] OK
[local-bootstrap] pull_source_id=$HOST_SOURCE_ID
[local-bootstrap] pull_source_host_id=$HOST_SOURCE_ID
[local-bootstrap] pull_source_docker_id=$DOCKER_SOURCE_ID
[local-bootstrap] alert_rule_id=$RULE_ID
[local-bootstrap] test_token=$LOCAL_ALERT_RULE_KEYWORD
[local-bootstrap] test_log_cmd=printf '%s level=ERROR service=nexuslog-local token=%s message="local alert test"\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$LOCAL_ALERT_RULE_KEYWORD" | sudo tee -a /var/log/nexuslog-local.log
EOF

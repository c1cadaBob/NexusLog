#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
RUNTIME_DIR="${NEXUSLOG_LOCAL_TENANT_DIR:-${ROOT_DIR}/.runtime/tenant}"
TENANT_ID_FILE="${NEXUSLOG_LOCAL_TENANT_ID_FILE:-${RUNTIME_DIR}/local-tenant-id}"
FRONTEND_OVERRIDE_PATH="${NEXUSLOG_FRONTEND_TENANT_OVERRIDE_PATH:-${ROOT_DIR}/apps/frontend-console/public/config/app-config.local.json}"
LEGACY_COMPAT_TENANT_ID="00000000-0000-0000-0000-000000000001"
LOCAL_TENANT_COMPAT_MODE="${LOCAL_TENANT_COMPAT_MODE:-false}"
LOCAL_TENANT_DB_SYNC_MODE="${LOCAL_TENANT_DB_SYNC_MODE:-auto}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-nexuslog}"
DB_USER="${DB_USER:-nexuslog}"
DB_PASSWORD="${DB_PASSWORD:-nexuslog_dev}"
PG_CONTAINER="${PG_CONTAINER:-nexuslog-postgres-1}"

info() {
  echo "[local-tenant] $*" >&2
}

error() {
  echo "[local-tenant] ERROR: $*" >&2
}

is_uuid() {
  local value="${1:-}"
  [[ "$value" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]
}

is_truthy() {
  local value
  value="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
  [[ "$value" == "1" || "$value" == "true" || "$value" == "yes" || "$value" == "on" ]]
}

normalize_uuid() {
  printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]'
}

db_sync_disabled() {
  local mode
  mode="$(printf '%s' "$LOCAL_TENANT_DB_SYNC_MODE" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
  [[ "$mode" == "0" || "$mode" == "false" || "$mode" == "no" || "$mode" == "off" || "$mode" == "disabled" ]]
}

generate_uuid() {
  if command -v uuidgen >/dev/null 2>&1; then
    uuidgen | tr '[:upper:]' '[:lower:]'
    return 0
  fi
  if [[ -r /proc/sys/kernel/random/uuid ]]; then
    tr '[:upper:]' '[:lower:]' < /proc/sys/kernel/random/uuid
    return 0
  fi
  error "unable to generate UUID: install uuidgen or provide TENANT_ID/LOCAL_TENANT_ID explicitly"
  exit 1
}

sync_frontend_override() {
  local tenant_id="$1"
  local override_dir

  if ! command -v jq >/dev/null 2>&1; then
    error "required command not found: jq"
    exit 1
  fi

  override_dir="$(dirname "$FRONTEND_OVERRIDE_PATH")"
  mkdir -p "$override_dir"
  jq -n --arg tenant_id "$tenant_id" '{tenantId:$tenant_id}' > "$FRONTEND_OVERRIDE_PATH"
  info "synced frontend tenant override: $FRONTEND_OVERRIDE_PATH"
}

load_persisted_tenant_id() {
  local candidate=""

  if [[ ! -f "$TENANT_ID_FILE" ]]; then
    return 0
  fi

  candidate="$(normalize_uuid "$(cat "$TENANT_ID_FILE")")"
  if ! is_uuid "$candidate"; then
    error "stored local tenant id is invalid: $candidate"
    exit 1
  fi

  printf '%s\n' "$candidate"
}

can_query_local_psql() {
  command -v psql >/dev/null 2>&1 || return 1
  PGPASSWORD="$DB_PASSWORD" PGCONNECT_TIMEOUT=2 \
    psql -X -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -Atqc 'SELECT 1' >/dev/null 2>&1
}

can_query_docker_psql() {
  command -v docker >/dev/null 2>&1 || return 1
  docker inspect -f '{{.State.Running}}' "$PG_CONTAINER" 2>/dev/null | grep -Fqx 'true' || return 1
  docker exec -i "$PG_CONTAINER" psql -X -U "$DB_USER" -d "$DB_NAME" -Atqc 'SELECT 1' >/dev/null 2>&1
}

run_sql() {
  local sql="$1"

  if can_query_local_psql; then
    PGPASSWORD="$DB_PASSWORD" PGCONNECT_TIMEOUT=2 \
      psql -X -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -Atqc "$sql"
    return 0
  fi

  if can_query_docker_psql; then
    docker exec -i "$PG_CONTAINER" psql -X -U "$DB_USER" -d "$DB_NAME" -Atqc "$sql"
    return 0
  fi

  return 1
}

find_db_bootstrap_tenant_id() {
  local persisted_candidate="${1:-}"
  local candidates=""
  local query="
SELECT t.id::text
FROM obs.tenant t
WHERE t.status = 'active'
  AND t.display_name = 'Local Bootstrap Tenant'
  AND t.name LIKE 'local-%'
  AND EXISTS (
    SELECT 1
    FROM users u
    WHERE u.tenant_id = t.id
      AND u.username = 'sys-superadmin'
      AND u.status = 'active'
  )
  AND EXISTS (
    SELECT 1
    FROM users u
    WHERE u.tenant_id = t.id
      AND u.username = 'system-automation'
      AND u.status = 'active'
  )
ORDER BY COALESCE(t.updated_at, t.created_at) DESC, t.created_at DESC, t.id DESC;
"

  if db_sync_disabled; then
    return 0
  fi

  if ! candidates="$(run_sql "$query" 2>/dev/null)"; then
    return 0
  fi

  candidates="$(printf '%s\n' "$candidates" | awk 'NF')"
  if [[ -z "$candidates" ]]; then
    return 0
  fi

  if [[ -n "$persisted_candidate" ]] && printf '%s\n' "$candidates" | grep -Fqx "$persisted_candidate"; then
    printf '%s\n' "$persisted_candidate"
    return 0
  fi

  printf '%s\n' "$candidates" | awk 'NF { print; exit }'
}

resolve_tenant_id() {
  local explicit_candidate="${LOCAL_TENANT_ID:-${TENANT_ID:-}}"
  local persisted_candidate=""
  local db_candidate=""
  local candidate=""

  if [[ -n "$explicit_candidate" ]]; then
    candidate="$(normalize_uuid "$explicit_candidate")"
    if ! is_uuid "$candidate"; then
      error "TENANT_ID/LOCAL_TENANT_ID is not a valid UUID: $candidate"
      exit 1
    fi
    info "using explicit local tenant id override: $candidate"
    printf '%s\n' "$candidate"
    return 0
  fi

  if is_truthy "$LOCAL_TENANT_COMPAT_MODE"; then
    info "compatibility mode enabled, using legacy local tenant id: $LEGACY_COMPAT_TENANT_ID"
    printf '%s\n' "$LEGACY_COMPAT_TENANT_ID"
    return 0
  fi

  persisted_candidate="$(load_persisted_tenant_id)"
  db_candidate="$(find_db_bootstrap_tenant_id "$persisted_candidate")"

  if [[ -n "$db_candidate" ]]; then
    if [[ -n "$persisted_candidate" && "$persisted_candidate" != "$db_candidate" ]]; then
      info "detected stale local tenant id [$persisted_candidate], synced to existing bootstrap tenant [$db_candidate]"
    elif [[ -n "$persisted_candidate" ]]; then
      info "reusing persisted local tenant id: $db_candidate"
    else
      info "reusing existing bootstrap tenant from database: $db_candidate"
    fi
    printf '%s\n' "$db_candidate"
    return 0
  fi

  if [[ -n "$persisted_candidate" ]]; then
    info "reusing persisted local tenant id: $persisted_candidate"
    printf '%s\n' "$persisted_candidate"
    return 0
  fi

  candidate="$(generate_uuid)"
  info "generated new local tenant id: $candidate"
  printf '%s\n' "$candidate"
}

main() {
  local tenant_id

  mkdir -p "$RUNTIME_DIR"
  tenant_id="$(resolve_tenant_id)"
  printf '%s\n' "$tenant_id" > "$TENANT_ID_FILE"
  sync_frontend_override "$tenant_id"
  info "local tenant id ready: $tenant_id"
  printf '%s\n' "$tenant_id"
}

main "$@"

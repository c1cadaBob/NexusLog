#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
RUNTIME_DIR="${NEXUSLOG_LOCAL_TENANT_DIR:-${ROOT_DIR}/.runtime/tenant}"
TENANT_ID_FILE="${NEXUSLOG_LOCAL_TENANT_ID_FILE:-${RUNTIME_DIR}/local-tenant-id}"
FRONTEND_OVERRIDE_PATH="${NEXUSLOG_FRONTEND_TENANT_OVERRIDE_PATH:-${ROOT_DIR}/apps/frontend-console/public/config/app-config.local.json}"

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

generate_uuid() {
  if command -v uuidgen >/dev/null 2>&1; then
    uuidgen | tr '[:upper:]' '[:lower:]'
    return 0
  fi

  if [[ -r /proc/sys/kernel/random/uuid ]]; then
    tr '[:upper:]' '[:lower:]' < /proc/sys/kernel/random/uuid
    return 0
  fi

  if command -v openssl >/dev/null 2>&1; then
    local raw
    raw="$(openssl rand -hex 16)"
    printf '%s-%s-%s-%s-%s\n' "${raw:0:8}" "${raw:8:4}" "${raw:12:4}" "${raw:16:4}" "${raw:20:12}"
    return 0
  fi

  error "unable to generate UUID: uuidgen, /proc/sys/kernel/random/uuid, and openssl are all unavailable"
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

resolve_tenant_id() {
  local candidate="${TENANT_ID:-}"

  if [[ -n "$candidate" ]]; then
    candidate="$(printf '%s' "$candidate" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
    if ! is_uuid "$candidate"; then
      error "TENANT_ID is not a valid UUID: $candidate"
      exit 1
    fi
    printf '%s\n' "$candidate"
    return 0
  fi

  if [[ -f "$TENANT_ID_FILE" ]]; then
    candidate="$(tr -d '[:space:]' < "$TENANT_ID_FILE" | tr '[:upper:]' '[:lower:]')"
    if is_uuid "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
    info "ignoring invalid tenant id file: $TENANT_ID_FILE"
  fi

  generate_uuid
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

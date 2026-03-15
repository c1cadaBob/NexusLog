#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
RUNTIME_DIR="${NEXUSLOG_LOCAL_TENANT_DIR:-${ROOT_DIR}/.runtime/tenant}"
TENANT_ID_FILE="${NEXUSLOG_LOCAL_TENANT_ID_FILE:-${RUNTIME_DIR}/local-tenant-id}"
FRONTEND_OVERRIDE_PATH="${NEXUSLOG_FRONTEND_TENANT_OVERRIDE_PATH:-${ROOT_DIR}/apps/frontend-console/public/config/app-config.local.json}"
LEGACY_COMPAT_TENANT_ID="00000000-0000-0000-0000-000000000001"
LOCAL_TENANT_COMPAT_MODE="${LOCAL_TENANT_COMPAT_MODE:-false}"

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

resolve_tenant_id() {
  local candidate="${LOCAL_TENANT_ID:-${TENANT_ID:-}}"

  if [[ -n "$candidate" ]]; then
    candidate="$(normalize_uuid "$candidate")"
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

  if [[ -f "$TENANT_ID_FILE" ]]; then
    candidate="$(normalize_uuid "$(cat "$TENANT_ID_FILE")")"
    if ! is_uuid "$candidate"; then
      error "stored local tenant id is invalid: $candidate"
      exit 1
    fi
    info "reusing persisted local tenant id: $candidate"
    printf '%s\n' "$candidate"
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

#!/usr/bin/env bash
# Install a NexusLog Elasticsearch ILM policy and index template.

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

ES_HOST="${ES_HOST:-http://localhost:9200}"
ILM_POLICY_NAME="${ILM_POLICY_NAME:?ILM_POLICY_NAME is required}"
ILM_POLICY_FILE="${ILM_POLICY_FILE:?ILM_POLICY_FILE is required}"
INDEX_TEMPLATE_NAME="${INDEX_TEMPLATE_NAME:?INDEX_TEMPLATE_NAME is required}"
INDEX_TEMPLATE_FILE="${INDEX_TEMPLATE_FILE:?INDEX_TEMPLATE_FILE is required}"
BOOTSTRAP_WRITE_ALIAS="${BOOTSTRAP_WRITE_ALIAS:-}"
BOOTSTRAP_FIRST_INDEX="${BOOTSTRAP_FIRST_INDEX:-}"
WAIT_RETRIES="${WAIT_RETRIES:-30}"
WAIT_INTERVAL_SEC="${WAIT_INTERVAL_SEC:-2}"

info() {
  echo "INFO: $*"
}

error() {
  echo "ERROR: $*" >&2
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    error "required command not found: $1"
    exit 1
  fi
}

require_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    error "required file not found: $path"
    exit 1
  fi
}

wait_for_elasticsearch() {
  local attempt
  for attempt in $(seq 1 "$WAIT_RETRIES"); do
    if curl -fsS "$ES_HOST" >/dev/null 2>&1; then
      info "Elasticsearch is ready: $ES_HOST"
      return 0
    fi
    info "waiting for Elasticsearch ($attempt/$WAIT_RETRIES)"
    sleep "$WAIT_INTERVAL_SEC"
  done
  error "Elasticsearch not ready: $ES_HOST"
  exit 1
}

ensure_bootstrap_index() {
  local alias_name="$1"
  local first_index="$2"

  if [[ -z "$alias_name" || -z "$first_index" ]]; then
    return 0
  fi

  if curl -fsS "$ES_HOST/_alias/$alias_name" >/dev/null 2>&1; then
    info "write alias already exists: $alias_name"
    return 0
  fi

  if curl -fsS "$ES_HOST/$first_index" >/dev/null 2>&1; then
    info "bootstrap index already exists: $first_index"
    return 0
  fi

  info "creating bootstrap index: $first_index (alias=$alias_name)"
  curl -fsS \
    -X PUT "$ES_HOST/$first_index" \
    -H 'Content-Type: application/json' \
    -d "{\"aliases\":{\"$alias_name\":{\"is_write_index\":true}}}" >/dev/null
}

require_cmd curl
require_file "$ILM_POLICY_FILE"
require_file "$INDEX_TEMPLATE_FILE"
wait_for_elasticsearch

info "installing ILM policy: $ILM_POLICY_NAME"
curl -fsS \
  -X PUT "$ES_HOST/_ilm/policy/$ILM_POLICY_NAME" \
  -H 'Content-Type: application/json' \
  --data-binary @"$ILM_POLICY_FILE" >/dev/null

info "installing index template: $INDEX_TEMPLATE_NAME"
curl -fsS \
  -X PUT "$ES_HOST/_index_template/$INDEX_TEMPLATE_NAME" \
  -H 'Content-Type: application/json' \
  --data-binary @"$INDEX_TEMPLATE_FILE" >/dev/null

ensure_bootstrap_index "$BOOTSTRAP_WRITE_ALIAS" "$BOOTSTRAP_FIRST_INDEX"

info "installed Elasticsearch index template successfully"
echo "OK: ILM=$ILM_POLICY_NAME TEMPLATE=$INDEX_TEMPLATE_NAME ES_HOST=$ES_HOST"

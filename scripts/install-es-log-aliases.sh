#!/usr/bin/env bash
# Install NexusLog log aliases for read / pull-write / stream-write.

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

ES_HOST="${ES_HOST:-http://localhost:9200}"
DATA_STREAM_NAME="${DATA_STREAM_NAME:-nexuslog-logs-v2-pull}"
READ_ALIAS_NAME="${READ_ALIAS_NAME:-nexuslog-logs-read}"
PULL_WRITE_ALIAS_NAME="${PULL_WRITE_ALIAS_NAME:-nexuslog-logs-write-pull}"
STREAM_WRITE_ALIAS_NAME="${STREAM_WRITE_ALIAS_NAME:-nexuslog-logs-write-stream}"
PULL_DATA_STREAM="${PULL_DATA_STREAM:-nexuslog-logs-v2-pull}"
STREAM_WRITE_INDEX="${STREAM_WRITE_INDEX:-nexuslog-logs-stream-canary-v2}"
STREAM_INDEX_TEMPLATE_FILE="${STREAM_INDEX_TEMPLATE_FILE:-storage/elasticsearch/templates/nexuslog-logs-v2.json}"
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

ensure_data_stream() {
  local name="$1"
  if [[ -z "$name" ]]; then
    return 0
  fi
  if curl -fsS "$ES_HOST/_data_stream/$name" >/dev/null 2>&1; then
    info "data stream exists: $name"
    return 0
  fi
  info "creating data stream: $name"
  curl -fsS -X PUT "$ES_HOST/_data_stream/$name" >/dev/null
}

ensure_index() {
  local name="$1"
  local template_file="${2:-}"
  if [[ -z "$name" ]]; then
    return 0
  fi
  if curl -fsS "$ES_HOST/$name" >/dev/null 2>&1; then
    info "index exists: $name"
    return 0
  fi
  if [[ -n "$template_file" ]]; then
    info "creating index: $name using template body: $template_file"
    jq '.template' "$template_file" | \
      curl -fsS -X PUT "$ES_HOST/$name" -H 'Content-Type: application/json' --data-binary @- >/dev/null
    return 0
  fi
  info "creating index: $name"
  curl -fsS -X PUT "$ES_HOST/$name" >/dev/null
}

upsert_alias() {
  local alias_name="$1"
  local target="$2"
  local write_flag="$3"
  local payload_file
  payload_file="$(mktemp)"
  trap 'rm -f "$payload_file"' RETURN

  if [[ "$write_flag" == "true" ]]; then
    cat > "$payload_file" <<EOF
{"actions":[{"remove":{"index":"*","alias":"$alias_name","must_exist":false}},{"add":{"index":"$target","alias":"$alias_name","is_write_index":true}}]}
EOF
  else
    cat > "$payload_file" <<EOF
{"actions":[{"remove":{"index":"*","alias":"$alias_name","must_exist":false}},{"add":{"index":"$target","alias":"$alias_name"}}]}
EOF
  fi

  info "upserting alias $alias_name -> $target (write=$write_flag)"
  curl -fsS -X POST "$ES_HOST/_aliases" -H 'Content-Type: application/json' --data-binary @"$payload_file" >/dev/null

  rm -f "$payload_file"
  trap - RETURN
}

require_cmd curl
require_cmd jq
if [[ -n "$STREAM_INDEX_TEMPLATE_FILE" && ! -f "$STREAM_INDEX_TEMPLATE_FILE" ]]; then
  error "stream index template file not found: $STREAM_INDEX_TEMPLATE_FILE"
  exit 1
fi
wait_for_elasticsearch

ensure_data_stream "$DATA_STREAM_NAME"
ensure_data_stream "$PULL_DATA_STREAM"
ensure_index "$STREAM_WRITE_INDEX" "$STREAM_INDEX_TEMPLATE_FILE"

upsert_alias "$READ_ALIAS_NAME" "$DATA_STREAM_NAME" false
upsert_alias "$PULL_WRITE_ALIAS_NAME" "$PULL_DATA_STREAM" true
upsert_alias "$STREAM_WRITE_ALIAS_NAME" "$STREAM_WRITE_INDEX" true

info "installed log aliases successfully"
echo "OK: read=$READ_ALIAS_NAME pull_write=$PULL_WRITE_ALIAS_NAME stream_write=$STREAM_WRITE_ALIAS_NAME ES_HOST=$ES_HOST"

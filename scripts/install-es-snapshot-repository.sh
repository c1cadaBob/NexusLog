#!/usr/bin/env bash
# Install NexusLog Elasticsearch snapshot repository.

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

ES_HOST="${ES_HOST:-http://localhost:9200}"
SNAPSHOT_REPOSITORY_NAME="${SNAPSHOT_REPOSITORY_NAME:-nexuslog-snapshots}"
SNAPSHOT_REPOSITORY_TYPE="${SNAPSHOT_REPOSITORY_TYPE:-fs}"
SNAPSHOT_REPOSITORY_LOCATION="${SNAPSHOT_REPOSITORY_LOCATION:-/usr/share/elasticsearch/snapshots}"
SNAPSHOT_REPOSITORY_COMPRESS="${SNAPSHOT_REPOSITORY_COMPRESS:-true}"
SNAPSHOT_REPOSITORY_CHUNK_SIZE="${SNAPSHOT_REPOSITORY_CHUNK_SIZE:-1gb}"
SNAPSHOT_REPOSITORY_VERIFY="${SNAPSHOT_REPOSITORY_VERIFY:-true}"
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

normalize_bool() {
  case "${1:-}" in
    true|TRUE|True|1|yes|YES|on|ON)
      printf 'true'
      ;;
    false|FALSE|False|0|no|NO|off|OFF)
      printf 'false'
      ;;
    *)
      error "invalid boolean value: $1"
      exit 1
      ;;
  esac
}

build_fs_repository_payload() {
  local payload_file="$1"
  local compress_json
  compress_json="$(normalize_bool "$SNAPSHOT_REPOSITORY_COMPRESS")"

  jq -n \
    --arg location "$SNAPSHOT_REPOSITORY_LOCATION" \
    --arg chunk_size "$SNAPSHOT_REPOSITORY_CHUNK_SIZE" \
    --argjson compress "$compress_json" \
    '
      {
        type: "fs",
        settings: {
          location: $location,
          compress: $compress
        }
      }
      | if $chunk_size == "" then . else .settings.chunk_size = $chunk_size | . end
    ' > "$payload_file"
}

require_cmd curl
require_cmd jq
wait_for_elasticsearch

if [[ "$SNAPSHOT_REPOSITORY_TYPE" != "fs" ]]; then
  error "unsupported repository type for this script: $SNAPSHOT_REPOSITORY_TYPE (expected: fs)"
  exit 1
fi

payload_file="$(mktemp)"
trap 'rm -f "$payload_file"' EXIT
build_fs_repository_payload "$payload_file"

info "installing snapshot repository: $SNAPSHOT_REPOSITORY_NAME"
curl -fsS \
  -X PUT "$ES_HOST/_snapshot/$SNAPSHOT_REPOSITORY_NAME" \
  -H 'Content-Type: application/json' \
  --data-binary @"$payload_file" >/dev/null

if [[ "$(normalize_bool "$SNAPSHOT_REPOSITORY_VERIFY")" == "true" ]]; then
  info "verifying snapshot repository: $SNAPSHOT_REPOSITORY_NAME"
  curl -fsS -X POST "$ES_HOST/_snapshot/$SNAPSHOT_REPOSITORY_NAME/_verify" >/dev/null
fi

info "installed snapshot repository successfully"
echo "OK: repository=$SNAPSHOT_REPOSITORY_NAME type=$SNAPSHOT_REPOSITORY_TYPE location=$SNAPSHOT_REPOSITORY_LOCATION ES_HOST=$ES_HOST"

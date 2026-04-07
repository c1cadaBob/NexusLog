#!/usr/bin/env bash
# Install NexusLog Elasticsearch SLM snapshot policy.

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

ES_HOST="${ES_HOST:-http://localhost:9200}"
SNAPSHOT_POLICY_FILE="${SNAPSHOT_POLICY_FILE:-storage/elasticsearch/snapshots/snapshot-policy.json}"
SNAPSHOT_POLICY_NAME="${SNAPSHOT_POLICY_NAME:-}"
SNAPSHOT_NAME_TEMPLATE="${SNAPSHOT_NAME_TEMPLATE:-}"
SNAPSHOT_POLICY_SCHEDULE="${SNAPSHOT_POLICY_SCHEDULE:-}"
SNAPSHOT_POLICY_REPOSITORY="${SNAPSHOT_POLICY_REPOSITORY:-}"
SNAPSHOT_POLICY_EXECUTE_NOW="${SNAPSHOT_POLICY_EXECUTE_NOW:-false}"
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

require_cmd curl
require_cmd jq

if [[ ! -f "$SNAPSHOT_POLICY_FILE" ]]; then
  error "snapshot policy file not found: $SNAPSHOT_POLICY_FILE"
  exit 1
fi

wait_for_elasticsearch

policy_name="$SNAPSHOT_POLICY_NAME"
if [[ -z "$policy_name" ]]; then
  policy_name="$(jq -r '.policy_id // .policy_name // empty' "$SNAPSHOT_POLICY_FILE")"
fi
if [[ -z "$policy_name" ]]; then
  policy_name="$(jq -r '.name // empty' "$SNAPSHOT_POLICY_FILE")"
fi
if [[ -z "$policy_name" ]]; then
  error "snapshot policy name is empty"
  exit 1
fi

snapshot_name_template="$SNAPSHOT_NAME_TEMPLATE"
if [[ -z "$snapshot_name_template" ]]; then
  snapshot_name_template="$(jq -r '.snapshot_name // .name_template // .name // empty' "$SNAPSHOT_POLICY_FILE")"
fi
if [[ -z "$snapshot_name_template" ]]; then
  error "snapshot name template is empty"
  exit 1
fi

policy_schedule="$SNAPSHOT_POLICY_SCHEDULE"
if [[ -z "$policy_schedule" ]]; then
  policy_schedule="$(jq -r '.schedule // empty' "$SNAPSHOT_POLICY_FILE")"
fi
if [[ -z "$policy_schedule" ]]; then
  error "snapshot policy schedule is empty"
  exit 1
fi

policy_repository="$SNAPSHOT_POLICY_REPOSITORY"
if [[ -z "$policy_repository" ]]; then
  policy_repository="$(jq -r '.repository // empty' "$SNAPSHOT_POLICY_FILE")"
fi
if [[ -z "$policy_repository" ]]; then
  error "snapshot policy repository is empty"
  exit 1
fi

payload_file="$(mktemp)"
trap 'rm -f "$payload_file"' EXIT
jq \
  --arg name "$snapshot_name_template" \
  --arg schedule "$policy_schedule" \
  --arg repository "$policy_repository" \
  '{
    name: $name,
    schedule: $schedule,
    repository: $repository,
    config: (.config // {}),
    retention: (.retention // {})
  }' \
  "$SNAPSHOT_POLICY_FILE" > "$payload_file"

info "starting snapshot lifecycle management"
curl -fsS -X POST "$ES_HOST/_slm/start" >/dev/null || true

info "installing snapshot policy: $policy_name"
curl -fsS \
  -X PUT "$ES_HOST/_slm/policy/$policy_name" \
  -H 'Content-Type: application/json' \
  --data-binary @"$payload_file" >/dev/null

if [[ "$(normalize_bool "$SNAPSHOT_POLICY_EXECUTE_NOW")" == "true" ]]; then
  info "executing snapshot policy immediately: $policy_name"
  curl -fsS -X POST "$ES_HOST/_slm/policy/$policy_name/_execute" >/dev/null
fi

info "installed snapshot policy successfully"
echo "OK: policy=$policy_name snapshot_name=$snapshot_name_template repository=$policy_repository schedule=$policy_schedule ES_HOST=$ES_HOST"

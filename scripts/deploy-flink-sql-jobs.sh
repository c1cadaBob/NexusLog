#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

JOBS_RAW="${FLINK_SQL_JOBS:-log-parser.sql}"
FLINK_REST_URL="${FLINK_REST_URL:-http://127.0.0.1:8088}"
SCHEMA_REGISTRY_URL="${SCHEMA_REGISTRY_URL:-http://127.0.0.1:18081}"
WAIT_RETRIES="${WAIT_RETRIES:-30}"
WAIT_INTERVAL_SEC="${WAIT_INTERVAL_SEC:-3}"
IFS=',' read -r -a JOBS <<< "$JOBS_RAW"

COMPOSE_ARGS=(-f docker-compose.yml -f docker-compose.override.yml)

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: required command not found: $1" >&2
    exit 1
  fi
}

wait_for_url() {
  local target_url="$1"
  local name="$2"
  local attempt
  for attempt in $(seq 1 "$WAIT_RETRIES"); do
    if curl -fsS "$target_url" >/dev/null 2>&1; then
      echo "INFO: $name is ready: $target_url"
      return 0
    fi
    echo "INFO: waiting for $name ($attempt/$WAIT_RETRIES)"
    sleep "$WAIT_INTERVAL_SEC"
  done
  echo "ERROR: $name not ready: $target_url" >&2
  exit 1
}

require_cmd curl
require_cmd docker
wait_for_url "$FLINK_REST_URL/overview" "flink-rest"
wait_for_url "$SCHEMA_REGISTRY_URL/subjects" "schema-registry"

for raw_job in "${JOBS[@]}"; do
  job="$(echo "$raw_job" | xargs)"
  [[ -z "$job" ]] && continue
  local_path="stream/flink/jobs/sql/${job}"
  remote_path="/opt/flink/jobs/sql/${job}"

  if [[ ! -f "$local_path" ]]; then
    echo "ERROR: SQL job file not found: $local_path" >&2
    exit 1
  fi

  echo "INFO: submitting Flink SQL job ${job}"
  docker compose "${COMPOSE_ARGS[@]}" exec -T flink-jobmanager \
    /opt/flink/bin/sql-client.sh -f "$remote_path"
done

echo "OK: deployed Flink SQL jobs: ${JOBS_RAW}"

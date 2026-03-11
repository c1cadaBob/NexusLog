#!/usr/bin/env bash

set -euo pipefail

FLINK_REST_URL="${FLINK_REST_URL:-http://flink-jobmanager:8081}"
SCHEMA_REGISTRY_URL="${SCHEMA_REGISTRY_URL:-http://schema-registry:8081}"
WAIT_RETRIES="${WAIT_RETRIES:-30}"
WAIT_INTERVAL_SEC="${WAIT_INTERVAL_SEC:-3}"
FLINK_SQL_JOBS_RAW="${FLINK_SQL_JOBS:-log-parser.sql}"
IFS=',' read -r -a JOB_NAMES <<< "$FLINK_SQL_JOBS_RAW"
JOB_FILES=()
for job_name in "${JOB_NAMES[@]}"; do
  trimmed="$(echo "$job_name" | xargs)"
  [[ -z "$trimmed" ]] && continue
  JOB_FILES+=("/opt/flink/jobs/sql/$trimmed")
done

log() {
  echo "[flink-sql-init] $*"
}

wait_for_url() {
  local target_url="$1"
  local name="$2"
  local attempt
  for attempt in $(seq 1 "$WAIT_RETRIES"); do
    if wget -q -O /dev/null "$target_url"; then
      log "$name is ready: $target_url"
      return 0
    fi
    log "waiting for $name ($attempt/$WAIT_RETRIES)"
    sleep "$WAIT_INTERVAL_SEC"
  done
  echo "$name not ready: $target_url" >&2
  exit 1
}

wait_for_url "$FLINK_REST_URL/overview" "flink-rest"
wait_for_url "$SCHEMA_REGISTRY_URL/subjects" "schema-registry"

for job_file in "${JOB_FILES[@]}"; do
  if [[ ! -f "$job_file" ]]; then
    echo "job file not found: $job_file" >&2
    exit 1
  fi
  log "submitting sql job: $job_file"
  output="$('/opt/flink/bin/sql-client.sh' -f "$job_file" 2>&1)"
  printf '%s\n' "$output"
  if printf '%s\n' "$output" | grep -Eq 'Could not execute SQL statement|Command failed|Exception'; then
    echo "sql job submission failed: $job_file" >&2
    exit 1
  fi
done

log "submitted sql jobs successfully"

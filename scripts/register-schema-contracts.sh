#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

SCHEMA_REGISTRY_URL="${SCHEMA_REGISTRY_URL:-http://schema-registry:8081}"
WAIT_RETRIES="${WAIT_RETRIES:-30}"
WAIT_INTERVAL_SEC="${WAIT_INTERVAL_SEC:-2}"
SCHEMA_REGISTRY_RESET_SUBJECTS="${SCHEMA_REGISTRY_RESET_SUBJECTS:-false}"
SCHEMA_FILE_LOG_RAW="${SCHEMA_FILE_LOG_RAW:-contracts/schema-contracts/avro/log-raw.avsc}"
SCHEMA_FILE_LOG_PARSED="${SCHEMA_FILE_LOG_PARSED:-contracts/schema-contracts/avro/log-parsed.avsc}"
SCHEMA_FILE_ALERT_EVENT="${SCHEMA_FILE_ALERT_EVENT:-contracts/schema-contracts/avro/alert-event.avsc}"
SCHEMA_FILE_METRICS_AGGREGATED="${SCHEMA_FILE_METRICS_AGGREGATED:-contracts/schema-contracts/avro/metrics-aggregated.avsc}"
REGISTER_RAW_SUBJECT="${REGISTER_RAW_SUBJECT:-true}"
REGISTER_PARSED_SUBJECT="${REGISTER_PARSED_SUBJECT:-true}"
REGISTER_ALERT_EVENT_SUBJECT="${REGISTER_ALERT_EVENT_SUBJECT:-true}"
REGISTER_METRICS_AGGREGATED_SUBJECT="${REGISTER_METRICS_AGGREGATED_SUBJECT:-true}"

log() {
  echo "[schema-registry-init] $*"
}

require_file() {
  local file_path="$1"
  if [[ ! -f "$file_path" ]]; then
    echo "required file not found: $file_path" >&2
    exit 1
  fi
}

wait_for_schema_registry() {
  local attempt
  for attempt in $(seq 1 "$WAIT_RETRIES"); do
    if curl -fsS "$SCHEMA_REGISTRY_URL/subjects" >/dev/null 2>&1; then
      log "schema registry is ready: $SCHEMA_REGISTRY_URL"
      return 0
    fi
    log "waiting for schema registry ($attempt/$WAIT_RETRIES)"
    sleep "$WAIT_INTERVAL_SEC"
  done
  echo "schema registry not ready: $SCHEMA_REGISTRY_URL" >&2
  exit 1
}

json_escape_file() {
  local file_path="$1"
  tr -d '\n' < "$file_path" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

apply_compatibility() {
  local subject="$1"
  local compatibility="$2"
  curl -fsS \
    -X PUT "$SCHEMA_REGISTRY_URL/config/$subject" \
    -H 'Content-Type: application/vnd.schemaregistry.v1+json' \
    --data "{\"compatibility\":\"$compatibility\"}" >/dev/null
}

delete_subject_if_requested() {
  local subject="$1"
  if [[ "$SCHEMA_REGISTRY_RESET_SUBJECTS" != "true" ]]; then
    return 0
  fi

  curl -sS -X DELETE "$SCHEMA_REGISTRY_URL/subjects/$subject" >/dev/null 2>&1 || true
  curl -sS -X DELETE "$SCHEMA_REGISTRY_URL/subjects/$subject?permanent=true" >/dev/null 2>&1 || true
  log "reset subject=$subject"
}

register_subject() {
  local subject="$1"
  local schema_file="$2"
  local compatibility="$3"
  local schema_payload

  require_file "$schema_file"
  delete_subject_if_requested "$subject"
  schema_payload="$(json_escape_file "$schema_file")"

  apply_compatibility "$subject" "$compatibility"
  curl -fsS \
    -X POST "$SCHEMA_REGISTRY_URL/subjects/$subject/versions" \
    -H 'Content-Type: application/vnd.schemaregistry.v1+json' \
    --data "{\"schema\":\"$schema_payload\",\"schemaType\":\"AVRO\"}" >/dev/null

  log "registered subject=$subject compatibility=$compatibility schema=$schema_file"
}

wait_for_schema_registry

if [[ "$REGISTER_RAW_SUBJECT" == "true" ]]; then
  register_subject "nexuslog.logs.raw-value" "$SCHEMA_FILE_LOG_RAW" "BACKWARD"
else
  delete_subject_if_requested "nexuslog.logs.raw-value"
fi

if [[ "$REGISTER_PARSED_SUBJECT" == "true" ]]; then
  register_subject "nexuslog.logs.parsed-value" "$SCHEMA_FILE_LOG_PARSED" "BACKWARD_TRANSITIVE"
else
  delete_subject_if_requested "nexuslog.logs.parsed-value"
fi

if [[ "$REGISTER_ALERT_EVENT_SUBJECT" == "true" ]]; then
  register_subject "nexuslog.alerts.events-value" "$SCHEMA_FILE_ALERT_EVENT" "FULL"
else
  delete_subject_if_requested "nexuslog.alerts.events-value"
fi

if [[ "$REGISTER_METRICS_AGGREGATED_SUBJECT" == "true" ]]; then
  register_subject "nexuslog.metrics.aggregated-value" "$SCHEMA_FILE_METRICS_AGGREGATED" "BACKWARD"
else
  delete_subject_if_requested "nexuslog.metrics.aggregated-value"
fi

log "all schema contracts registered successfully"

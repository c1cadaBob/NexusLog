#!/usr/bin/env bash
# Install NexusLog v2 Elasticsearch ILM policy and index template.

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

ES_HOST="${ES_HOST:-http://localhost:9200}"
ILM_POLICY_NAME="${ILM_POLICY_NAME:-nexuslog-logs-ilm}"
ILM_POLICY_FILE="${ILM_POLICY_FILE:-storage/elasticsearch/ilm-policies/nexuslog-logs-ilm.json}"
INDEX_TEMPLATE_NAME="${INDEX_TEMPLATE_NAME:-nexuslog-logs-v2}"
INDEX_TEMPLATE_FILE="${INDEX_TEMPLATE_FILE:-storage/elasticsearch/index-templates/nexuslog-logs-v2.json}"

info() {
  echo "INFO: $*"
}

error() {
  echo "ERROR: $*" >&2
}

require_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    error "required file not found: $path"
    exit 1
  fi
}

require_file "$ILM_POLICY_FILE"
require_file "$INDEX_TEMPLATE_FILE"

if ! command -v jq >/dev/null 2>&1; then
  error "required command not found: jq"
  exit 1
fi

TMP_ILM_POLICY="$(mktemp)"
TMP_INDEX_TEMPLATE="$(mktemp)"
cleanup() {
  rm -f "$TMP_ILM_POLICY" "$TMP_INDEX_TEMPLATE"
}
trap cleanup EXIT

jq 'walk(if type == "object" then with_entries(select(.key != "_comment" and .key != "_description")) else . end)' "$ILM_POLICY_FILE" > "$TMP_ILM_POLICY"
jq 'walk(if type == "object" then with_entries(select(.key != "_comment" and .key != "_description")) else . end)' "$INDEX_TEMPLATE_FILE" > "$TMP_INDEX_TEMPLATE"

info "checking Elasticsearch connectivity: $ES_HOST"
curl -fsS "$ES_HOST" >/dev/null

info "installing ILM policy: $ILM_POLICY_NAME"
curl -fsS \
  -X PUT "$ES_HOST/_ilm/policy/$ILM_POLICY_NAME" \
  -H 'Content-Type: application/json' \
  --data-binary "@$TMP_ILM_POLICY" >/dev/null

info "installing index template: $INDEX_TEMPLATE_NAME"
curl -fsS \
  -X PUT "$ES_HOST/_index_template/$INDEX_TEMPLATE_NAME" \
  -H 'Content-Type: application/json' \
  --data-binary "@$TMP_INDEX_TEMPLATE" >/dev/null

info "installed Elasticsearch v2 template successfully"
echo "OK: ILM=$ILM_POLICY_NAME TEMPLATE=$INDEX_TEMPLATE_NAME ES_HOST=$ES_HOST"

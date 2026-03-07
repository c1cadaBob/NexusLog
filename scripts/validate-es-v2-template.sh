#!/usr/bin/env bash
# Validate NexusLog v2 Elasticsearch template installation and effective mapping.

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

ES_HOST="${ES_HOST:-http://localhost:9200}"
INDEX_TEMPLATE_NAME="${INDEX_TEMPLATE_NAME:-nexuslog-logs-v2}"
INDEX_NAME="${INDEX_NAME:-nexuslog-logs-v2}"

info() {
  echo "INFO: $*"
}

error() {
  echo "ERROR: $*" >&2
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    error "required command not found: $cmd"
    exit 1
  fi
}

require_cmd curl
require_cmd python3

TMP_TEMPLATE="$(mktemp)"
TMP_SIMULATE="$(mktemp)"
cleanup() {
  rm -f "$TMP_TEMPLATE" "$TMP_SIMULATE"
}
trap cleanup EXIT

info "checking Elasticsearch connectivity: $ES_HOST"
curl -fsS "$ES_HOST" >/dev/null

info "fetching installed template: $INDEX_TEMPLATE_NAME"
curl -fsS "$ES_HOST/_index_template/$INDEX_TEMPLATE_NAME" > "$TMP_TEMPLATE"

python3 - "$TMP_TEMPLATE" "$INDEX_TEMPLATE_NAME" "$INDEX_NAME" <<'PY'
import json
import sys

path, template_name, index_name = sys.argv[1:4]
with open(path, 'r', encoding='utf-8') as fh:
    payload = json.load(fh)

items = payload.get('index_templates') or []
if not items:
    raise SystemExit(f"template not found: {template_name}")

definition = items[0].get('index_template') or {}
patterns = definition.get('index_patterns') or []
if index_name not in patterns and f"{index_name}-*" not in patterns:
    raise SystemExit(f"template patterns do not cover {index_name}: {patterns}")
if 'template' not in definition:
    raise SystemExit('template definition missing nested template object')
print(f"OK: installed template patterns cover {index_name}: {patterns}")
PY

info "simulating effective template for index: $INDEX_NAME"
curl -fsS -X POST "$ES_HOST/_index_template/_simulate_index/$INDEX_NAME" > "$TMP_SIMULATE"

python3 - "$TMP_SIMULATE" "$INDEX_NAME" <<'PY'
import json
import sys

path, index_name = sys.argv[1:3]
with open(path, 'r', encoding='utf-8') as fh:
    payload = json.load(fh)

template = payload.get('template') or {}
settings = template.get('settings') or {}
index_settings = settings.get('index') or {}
lifecycle = index_settings.get('lifecycle') or {}
rollover_alias = lifecycle.get('rollover_alias')
if rollover_alias != index_name:
    raise SystemExit(f"unexpected rollover alias: {rollover_alias!r}, want {index_name!r}")

properties = ((template.get('mappings') or {}).get('properties') or {})
checks = {
    '@timestamp': properties.get('@timestamp'),
    'message': properties.get('message'),
    'event.id': (((properties.get('event') or {}).get('properties') or {}).get('id')),
    'log.level': (((properties.get('log') or {}).get('properties') or {}).get('level')),
    'service.name': (((properties.get('service') or {}).get('properties') or {}).get('name')),
    'nexuslog.ingest.schema_version': (((((properties.get('nexuslog') or {}).get('properties') or {}).get('ingest') or {}).get('properties') or {}).get('schema_version')),
}
missing = [name for name, value in checks.items() if not value]
if missing:
    raise SystemExit(f"missing expected simulated fields: {', '.join(missing)}")

if 'data_stream' not in payload:
    print('WARN: simulate response does not include data_stream metadata; verify cluster version if needed')

print(f"OK: simulate_index for {index_name} exposes expected v2 fields")
PY

echo "OK: Elasticsearch v2 template validation passed for $INDEX_NAME on $ES_HOST"

#!/usr/bin/env bash
set -euo pipefail

ES_HOST="${ES_HOST:-http://127.0.0.1:9200}"
PULL_INDEX="${PULL_INDEX:-nexuslog-logs-write-pull}"
STREAM_INDEX="${STREAM_INDEX:-nexuslog-logs-write-stream}"
SINCE_MINUTES="${SINCE_MINUTES:-60}"
SAMPLE_SIZE="${SAMPLE_SIZE:-500}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: required command not found: $1" >&2
    exit 1
  fi
}

collect_docs() {
  local index_name="$1"
  local out_file="$2"
  local query
  query="$(jq -n --arg gte "now-${SINCE_MINUTES}m" --argjson size "$SAMPLE_SIZE" '{size:$size,_source:["event.id","event_id","log.level","service.name","nexuslog.ingest.schema_version","schema_version","source_collect_path","@timestamp","nexuslog.ingest.received_at"],sort:[{"@timestamp":{"order":"desc"}}],query:{range:{"@timestamp":{gte:$gte}}}}')"

  curl -fsS -X POST "${ES_HOST}/${index_name}/_search" \
    -H 'Content-Type: application/json' \
    -d "$query" | jq -r '
      def present($value):
        if $value == null then 0
        elif ($value | type) == "string" then (if ($value | length) > 0 then 1 else 0 end)
        elif ($value | type) == "array" then (if ($value | length) > 0 then 1 else 0 end)
        elif ($value | type) == "object" then (if ($value | length) > 0 then 1 else 0 end)
        else 1
        end;
      .hits.hits[]._source as $source |
      ($source.event.id // $source.event_id // empty) as $event_id |
      select(($event_id | tostring | length) > 0) |
      [
        $event_id,
        (present($source.log.level) | tostring),
        (present($source.service.name) | tostring),
        (present($source.nexuslog.ingest.schema_version // $source.schema_version) | tostring),
        (present($source.source_collect_path) | tostring),
        (
          ($source.nexuslog.ingest.received_at // $source["@timestamp"] // empty) as $ts |
          if $ts == null or $ts == "" then ""
          elif ($ts | type) == "number" then (($ts | floor) | tostring)
          else (((try ($ts | fromdateiso8601 * 1000 | floor) catch empty) // "") | tostring)
          end
        )
      ] | @tsv
    ' | awk -F '\t' '!seen[$1]++' > "$out_file"
}

load_docs() {
  local prefix="$1"
  local file_path="$2"
  while IFS=$'\t' read -r event_id has_level has_service has_schema has_source_path ts_ms; do
    [[ -z "$event_id" ]] && continue
    case "$prefix" in
      pull)
        pull_level["$event_id"]="$has_level"
        pull_service["$event_id"]="$has_service"
        pull_schema["$event_id"]="$has_schema"
        pull_source_path["$event_id"]="$has_source_path"
        pull_ts["$event_id"]="$ts_ms"
        ;;
      stream)
        stream_level["$event_id"]="$has_level"
        stream_service["$event_id"]="$has_service"
        stream_schema["$event_id"]="$has_schema"
        stream_source_path["$event_id"]="$has_source_path"
        stream_ts["$event_id"]="$ts_ms"
        ;;
    esac
  done < "$file_path"
}

percent() {
  local numerator="$1"
  local denominator="$2"
  if [[ "$denominator" -eq 0 ]]; then
    echo "0.00"
    return 0
  fi
  awk -v n="$numerator" -v d="$denominator" 'BEGIN { printf "%.2f", (n/d)*100 }'
}

emit_field_stats() {
  local field_name="$1"
  local pull_name="$2"
  local stream_name="$3"
  local shared_total="$4"
  local pull_present=0
  local stream_present=0
  local matched_present=0
  declare -n pull_ref="$pull_name"
  declare -n stream_ref="$stream_name"

  while IFS= read -r event_id; do
    [[ -z "$event_id" ]] && continue
    local pull_value="${pull_ref[$event_id]:-0}"
    local stream_value="${stream_ref[$event_id]:-0}"
    [[ "$pull_value" == "1" ]] && pull_present=$((pull_present + 1))
    [[ "$stream_value" == "1" ]] && stream_present=$((stream_present + 1))
    if [[ "$pull_value" == "1" && "$stream_value" == "1" ]]; then
      matched_present=$((matched_present + 1))
    fi
  done < "$shared_ids"

  local slug="${field_name//./_}"
  echo "field_${slug}_pull_present=${pull_present}/${shared_total}"
  echo "field_${slug}_stream_present=${stream_present}/${shared_total}"
  echo "field_${slug}_match_rate_shared=$(percent "$matched_present" "$shared_total")%"
}

require_cmd curl
require_cmd jq
require_cmd comm
require_cmd awk

declare -A pull_level pull_service pull_schema pull_source_path pull_ts
declare -A stream_level stream_service stream_schema stream_source_path stream_ts

pull_docs="$(mktemp)"
stream_docs="$(mktemp)"
pull_ids="$(mktemp)"
stream_ids="$(mktemp)"
shared_ids="$(mktemp)"
latency_deltas="$(mktemp)"
trap 'rm -f "$pull_docs" "$stream_docs" "$pull_ids" "$stream_ids" "$shared_ids" "$latency_deltas"' EXIT

collect_docs "$PULL_INDEX" "$pull_docs"
collect_docs "$STREAM_INDEX" "$stream_docs"

cut -f1 "$pull_docs" | sort -u > "$pull_ids"
cut -f1 "$stream_docs" | sort -u > "$stream_ids"
comm -12 "$pull_ids" "$stream_ids" > "$shared_ids"

load_docs pull "$pull_docs"
load_docs stream "$stream_docs"

pull_count="$(wc -l < "$pull_ids" | tr -d ' ')"
stream_count="$(wc -l < "$stream_ids" | tr -d ' ')"
shared_count="$(wc -l < "$shared_ids" | tr -d ' ')"

echo "pull_count=${pull_count}"
echo "stream_count=${stream_count}"
echo "shared_count=${shared_count}"
echo "pull_match_rate=$(percent "$shared_count" "$pull_count")%"
echo "stream_match_rate=$(percent "$shared_count" "$stream_count")%"

emit_field_stats "log.level" pull_level stream_level "$shared_count"
emit_field_stats "service.name" pull_service stream_service "$shared_count"
emit_field_stats "nexuslog.ingest.schema_version" pull_schema stream_schema "$shared_count"
emit_field_stats "source_collect_path" pull_source_path stream_source_path "$shared_count"

while IFS= read -r event_id; do
  [[ -z "$event_id" ]] && continue
  pull_ts_ms="${pull_ts[$event_id]:-}"
  stream_ts_ms="${stream_ts[$event_id]:-}"
  if [[ -n "$pull_ts_ms" && -n "$stream_ts_ms" ]]; then
    delta_ms=$((stream_ts_ms - pull_ts_ms))
    abs_delta_ms=${delta_ms#-}
    echo "$abs_delta_ms" >> "$latency_deltas"
  fi
done < "$shared_ids"

latency_pairs="$(wc -l < "$latency_deltas" | tr -d ' ')"
echo "latency_pairs=${latency_pairs}"
if [[ "$latency_pairs" -gt 0 ]]; then
  sort -n "$latency_deltas" -o "$latency_deltas"
  p50_line=$(( (latency_pairs + 1) / 2 ))
  p95_line=$(( (latency_pairs * 95 + 99) / 100 ))
  p50_value="$(sed -n "${p50_line}p" "$latency_deltas")"
  p95_value="$(sed -n "${p95_line}p" "$latency_deltas")"
  max_value="$(tail -n 1 "$latency_deltas")"
  avg_value="$(awk '{sum += $1} END { if (NR == 0) { print 0 } else { printf "%.2f", sum / NR } }' "$latency_deltas")"
  echo "latency_delta_ms_p50=${p50_value}"
  echo "latency_delta_ms_p95=${p95_value}"
  echo "latency_delta_ms_max=${max_value}"
  echo "latency_delta_ms_avg=${avg_value}"
else
  echo "latency_delta_ms_p50=NA"
  echo "latency_delta_ms_p95=NA"
  echo "latency_delta_ms_max=NA"
  echo "latency_delta_ms_avg=NA"
fi

if [[ "$shared_count" -eq 0 ]]; then
  echo "WARN: no shared event_id samples found between ${PULL_INDEX} and ${STREAM_INDEX}" >&2
fi

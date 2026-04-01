#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-nexuslog}"
DB_USER="${DB_USER:-nexuslog}"
DB_PASSWORD="${DB_PASSWORD:-nexuslog_dev}"
PG_CONTAINER="${PG_CONTAINER:-nexuslog-postgres-1}"

MATCH_SQL="(username LIKE 'e2e_login_%' OR username LIKE 'e2e_reg_%' OR username LIKE 'e2e_reset_%')"

usage() {
  cat <<'EOF'
Usage:
  scripts/cleanup-e2e-users.sh --dry-run
  scripts/cleanup-e2e-users.sh --apply

Environment overrides:
  DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD PG_CONTAINER
EOF
}

run_sql() {
  local sql="$1"
  if command -v psql >/dev/null 2>&1; then
    PGPASSWORD="$DB_PASSWORD" PGCONNECT_TIMEOUT=2 \
      psql -X -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -AtF '|' -qc "$sql"
    return
  fi

  if command -v docker >/dev/null 2>&1 && docker inspect -f '{{.State.Running}}' "$PG_CONTAINER" 2>/dev/null | grep -qi '^true$'; then
    docker exec -i "$PG_CONTAINER" \
      psql -X -U "$DB_USER" -d "$DB_NAME" -AtF '|' -qc "$sql"
    return
  fi

  echo "unable to connect to postgres via local psql or docker container: $PG_CONTAINER" >&2
  exit 1
}

preview() {
  run_sql "
SELECT username, status, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS')
FROM users
WHERE ${MATCH_SQL}
ORDER BY created_at DESC;
"
}

count_rows() {
  run_sql "SELECT count(*) FROM users WHERE ${MATCH_SQL};"
}

case "$MODE" in
  --dry-run)
    echo "[dry-run] matched users: $(count_rows)"
    preview
    ;;
  --apply)
    before_count="$(count_rows)"
    echo "[apply] matched users before cleanup: ${before_count}"
    if [[ "$before_count" == "0" ]]; then
      exit 0
    fi

    run_sql "
BEGIN;
UPDATE audit_logs
SET user_id = NULL
WHERE user_id IN (
  SELECT id FROM users WHERE ${MATCH_SQL}
);
DELETE FROM users
WHERE ${MATCH_SQL};
COMMIT;
"

    echo "[apply] matched users after cleanup: $(count_rows)"
    ;;
  -h|--help)
    usage
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac

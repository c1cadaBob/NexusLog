#!/usr/bin/env bash
# Unified database migration entrypoint for NexusLog.
# Runtime migration source is fixed to storage/postgresql/migrations.

set -euo pipefail

MIGRATIONS_DIR="storage/postgresql/migrations"

usage() {
  cat <<'EOF'
Usage:
  scripts/db-migrate.sh up [N]
  scripts/db-migrate.sh down [N]
  scripts/db-migrate.sh version
  scripts/db-migrate.sh goto <version>
  scripts/db-migrate.sh create <name>

Environment:
  DB_DSN         Database DSN (preferred)
  DATABASE_URL   Database DSN (fallback)

Examples:
  DB_DSN='postgres://user:pass@localhost:5432/nexuslog?sslmode=disable' scripts/db-migrate.sh up
  DB_DSN='postgres://user:pass@localhost:5432/nexuslog?sslmode=disable' scripts/db-migrate.sh down 1
  scripts/db-migrate.sh create add_login_attempt_index
EOF
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "missing command '$1'. Install golang-migrate first: https://github.com/golang-migrate/migrate"
  fi
}

db_dsn() {
  local dsn="${DB_DSN:-${DATABASE_URL:-}}"
  if [[ -z "$dsn" ]]; then
    fail "DB_DSN is not set (or DATABASE_URL fallback)."
  fi
  printf '%s' "$dsn"
}

run_migrate() {
  local dsn
  dsn="$(db_dsn)"
  migrate -path "$MIGRATIONS_DIR" -database "$dsn" "$@"
}

sanitize_name() {
  local input="$1"
  local normalized
  normalized="$(printf '%s' "$input" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/_/g; s/^_+//; s/_+$//; s/_+/_/g')"
  if [[ -z "$normalized" ]]; then
    fail "invalid migration name '$input'"
  fi
  printf '%s' "$normalized"
}

next_version() {
  local current_max
  current_max="$(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.up.sql' -printf '%f\n' \
    | sed -nE 's/^([0-9]{6})_.*\.up\.sql$/\1/p' \
    | sort | tail -n1)"

  if [[ -z "$current_max" ]]; then
    printf '000001'
    return
  fi

  printf '%06d' "$((10#$current_max + 1))"
}

cmd="${1:-}"
if [[ -z "$cmd" ]]; then
  usage
  exit 1
fi
shift || true

case "$cmd" in
  up)
    require_cmd migrate
    steps="${1:-}"
    if [[ -n "$steps" ]]; then
      [[ "$steps" =~ ^[0-9]+$ ]] || fail "up steps must be an integer"
      run_migrate up "$steps"
    else
      run_migrate up
    fi
    ;;

  down)
    require_cmd migrate
    steps="${1:-}"
    if [[ -n "$steps" ]]; then
      [[ "$steps" =~ ^[0-9]+$ ]] || fail "down steps must be an integer"
      run_migrate down "$steps"
    else
      run_migrate down
    fi
    ;;

  version)
    require_cmd migrate
    set +e
    output="$(run_migrate version 2>&1)"
    rc=$?
    set -e
    if [[ $rc -ne 0 ]]; then
      if printf '%s' "$output" | grep -qi "nil version"; then
        echo "version: none"
        exit 0
      fi
      printf '%s\n' "$output" >&2
      exit "$rc"
    fi
    printf '%s\n' "$output"
    ;;

  goto)
    require_cmd migrate
    target="${1:-}"
    [[ -n "$target" ]] || fail "goto requires <version>"
    [[ "$target" =~ ^[0-9]+$ ]] || fail "goto <version> must be an integer"
    echo "forcing migration version to $target, then running up"
    run_migrate force "$target"
    run_migrate up
    ;;

  create)
    name="${1:-}"
    [[ -n "$name" ]] || fail "create requires <name>"
    sanitized_name="$(sanitize_name "$name")"
    version="$(next_version)"
    up_file="$MIGRATIONS_DIR/${version}_${sanitized_name}.up.sql"
    down_file="$MIGRATIONS_DIR/${version}_${sanitized_name}.down.sql"

    [[ -e "$up_file" ]] && fail "file already exists: $up_file"
    [[ -e "$down_file" ]] && fail "file already exists: $down_file"

    cat >"$up_file" <<EOF
-- Migration: ${version}_${sanitized_name}
-- Created at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
-- TODO: add forward migration SQL

EOF

    cat >"$down_file" <<EOF
-- Rollback: ${version}_${sanitized_name}
-- Created at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
-- TODO: add rollback SQL

EOF

    echo "created:"
    echo "  $up_file"
    echo "  $down_file"
    ;;

  help|-h|--help)
    usage
    ;;

  *)
    usage
    fail "unknown command '$cmd'"
    ;;
esac

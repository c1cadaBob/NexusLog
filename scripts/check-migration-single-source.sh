#!/usr/bin/env bash
# Guard script to ensure runtime DB migrations use a single source of truth.

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

MIGRATIONS_DIR="storage/postgresql/migrations"
HAS_ERROR=0

error() {
  echo "ERROR: $*" >&2
  HAS_ERROR=1
}

info() {
  echo "INFO: $*"
}

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  error "missing migrations directory: $MIGRATIONS_DIR"
fi

info "checking runtime migration files are only under $MIGRATIONS_DIR"
while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  if [[ "$path" != "$MIGRATIONS_DIR/"* ]]; then
    error "runtime migration file outside single source: $path"
  fi
done < <(git ls-files '*.up.sql' '*.down.sql')

declare -a versions=()

info "checking migration naming and up/down pairing"
while IFS= read -r file; do
  base="$(basename "$file")"
  if [[ ! "$base" =~ ^([0-9]{6})_[a-z0-9_]+\.up\.sql$ ]]; then
    error "invalid up migration filename format: $base"
    continue
  fi

  version="${BASH_REMATCH[1]}"
  body="${base%.up.sql}"
  down_file="$MIGRATIONS_DIR/${body}.down.sql"
  if [[ ! -f "$down_file" ]]; then
    error "missing down migration pair for: $base"
  fi

  versions+=("$((10#$version))")
done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.up.sql' | sort)

while IFS= read -r file; do
  base="$(basename "$file")"
  if [[ ! "$base" =~ ^([0-9]{6})_[a-z0-9_]+\.down\.sql$ ]]; then
    error "invalid down migration filename format: $base"
    continue
  fi
  body="${base%.down.sql}"
  up_file="$MIGRATIONS_DIR/${body}.up.sql"
  if [[ ! -f "$up_file" ]]; then
    error "orphan down migration without up pair: $base"
  fi
done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.down.sql' | sort)

if [[ ${#versions[@]} -eq 0 ]]; then
  error "no up migration files found in $MIGRATIONS_DIR"
fi

if [[ ${#versions[@]} -gt 0 ]]; then
  mapfile -t sorted_unique_versions < <(printf '%s\n' "${versions[@]}" | sort -n | awk '!seen[$0]++')

  if [[ ${#sorted_unique_versions[@]} -ne ${#versions[@]} ]]; then
    error "duplicate migration version detected"
  fi

  # Current repository keeps 000001 as baseline and starts active increment stream at 000012.
  # Enforce continuity for the active stream (> 1).
  mapfile -t active_versions < <(printf '%s\n' "${sorted_unique_versions[@]}" | awk '$1 > 1')
  if [[ ${#active_versions[@]} -gt 0 ]]; then
    start="${active_versions[0]}"
    end="${active_versions[${#active_versions[@]}-1]}"
    for ((v=start; v<=end; v++)); do
      found=0
      for existing in "${active_versions[@]}"; do
        if [[ "$existing" -eq "$v" ]]; then
          found=1
          break
        fi
      done
      if [[ "$found" -eq 0 ]]; then
        error "missing migration version in active stream: $(printf '%06d' "$v")"
      fi
    done
  fi
fi

info "checking runtime migration entry declaration consistency"
if ! grep -q "scripts/db-migrate.sh" Makefile; then
  error "Makefile must declare scripts/db-migrate.sh as migration entry"
fi
if ! grep -q "db-migrate-up" Makefile; then
  error "Makefile missing db-migrate-up target"
fi
if ! grep -Eq "make db-migrate-|scripts/db-migrate.sh" docs/runbooks/rollback-playbook.md; then
  error "rollback runbook must reference unified migration command"
fi
if grep -Eq '^[[:space:]]*migrate[[:space:]]+-path' docs/runbooks/rollback-playbook.md; then
  error "rollback runbook still contains raw migrate -path command"
fi

if [[ "$HAS_ERROR" -ne 0 ]]; then
  echo "FAILED: migration single-source guard checks did not pass." >&2
  exit 1
fi

echo "PASSED: migration single-source guard checks passed."

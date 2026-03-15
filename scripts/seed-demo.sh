#!/usr/bin/env bash
# seed-demo.sh — Create minimal bootstrap users for dev environment.
# Idempotent: safe to run repeatedly.
#
# Usage:
#   ./scripts/seed-demo.sh              # auto-detect: docker exec if psql not found
#   ./scripts/seed-demo.sh --docker     # force docker exec
#   ./scripts/seed-demo.sh --local      # force local psql
#
# Environment variables:
#   DB_HOST              (default: localhost)    — ignored in docker mode
#   DB_PORT              (default: 5432)         — ignored in docker mode
#   DB_NAME              (default: nexuslog)
#   DB_USER              (default: nexuslog)
#   DB_PASSWORD          (default: nexuslog_dev)
#   PG_CONTAINER         (default: nexuslog-postgres-1)
#   TENANT_ID            (default: read from .runtime/tenant/local-tenant-id)
#   TENANT_NAME          (default: local-<tenant_id>)
#   TENANT_DISPLAY_NAME  (default: Local Bootstrap Tenant)

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
LOCAL_TENANT_ID_FILE="${LOCAL_TENANT_ID_FILE:-${ROOT_DIR}/.runtime/tenant/local-tenant-id}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-nexuslog}"
DB_USER="${DB_USER:-nexuslog}"
DB_PASSWORD="${DB_PASSWORD:-nexuslog_dev}"
PG_CONTAINER="${PG_CONTAINER:-nexuslog-postgres-1}"
TENANT_ID="${TENANT_ID:-}"

if [[ -z "$TENANT_ID" && -f "$LOCAL_TENANT_ID_FILE" ]]; then
  TENANT_ID="$(tr -d '[:space:]' < "$LOCAL_TENANT_ID_FILE" | tr '[:upper:]' '[:lower:]')"
fi

TENANT_NAME="${TENANT_NAME:-local-${TENANT_ID}}"
TENANT_DISPLAY_NAME="${TENANT_DISPLAY_NAME:-Local Bootstrap Tenant}"

MODE="${1:-auto}"

is_uuid() {
  local value="${1:-}"
  [[ "$value" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]
}

run_sql() {
  if [[ "$MODE" == "--docker" ]] || { [[ "$MODE" == "auto" ]] && ! command -v psql &>/dev/null; }; then
    docker exec -i "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 "$@"
  else
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 "$@"
  fi
}

if [[ -z "$TENANT_ID" ]]; then
  echo "ERROR: TENANT_ID is required. Run ./scripts/local/ensure-local-tenant-config.sh first, or set TENANT_ID explicitly." >&2
  exit 1
fi

if ! is_uuid "$TENANT_ID"; then
  echo "ERROR: TENANT_ID is not a valid UUID: $TENANT_ID" >&2
  exit 1
fi

echo "=== NexusLog Bootstrap Seed ==="
echo "Tenant ID: $TENANT_ID"
echo "Tenant Name: $TENANT_NAME"

run_sql \
  -v tenant_id="$TENANT_ID" \
  -v tenant_name="$TENANT_NAME" \
  -v tenant_display_name="$TENANT_DISPLAY_NAME" <<'EOSQL'
BEGIN;

INSERT INTO obs.tenant (id, name, display_name, status)
VALUES (CAST(:'tenant_id' AS uuid), :'tenant_name', :'tenant_display_name', 'active')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    display_name = EXCLUDED.display_name,
    status = 'active',
    updated_at = NOW();

INSERT INTO roles (tenant_id, name, description, permissions)
VALUES
  (
    CAST(:'tenant_id' AS uuid),
    'system_admin',
    'System administrator with user, audit, alert, incident, and monitoring management permissions',
    '["users:read","users:write","logs:read","logs:export","alerts:read","alerts:write","incidents:read","incidents:write","metrics:read","dashboards:read","audit:read"]'::jsonb
  ),
  (
    CAST(:'tenant_id' AS uuid),
    'operator',
    'Operational access: log search, alert management, incident handling, monitoring',
    '["logs:read","logs:export","alerts:read","alerts:write","incidents:read","incidents:write","metrics:read","dashboards:read","audit:read"]'::jsonb
  ),
  (
    CAST(:'tenant_id' AS uuid),
    'viewer',
    'Read-only access: view logs, dashboards, and monitoring data',
    '["logs:read","dashboards:read","metrics:read"]'::jsonb
  ),
  (
    CAST(:'tenant_id' AS uuid),
    'super_admin',
    'Reserved super administrator role. Only one bootstrap user may hold this role.',
    '["*"]'::jsonb
  ),
  (
    CAST(:'tenant_id' AS uuid),
    'system_automation',
    'Reserved system account role for automated operation and audit attribution.',
    '["audit:write"]'::jsonb
  )
ON CONFLICT (tenant_id, name) DO UPDATE
SET description = EXCLUDED.description,
    permissions = EXCLUDED.permissions;

INSERT INTO users (tenant_id, username, email, display_name, status)
VALUES
  (
    CAST(:'tenant_id' AS uuid),
    'sys-superadmin',
    'superadmin@nexuslog.dev',
    'System Super Admin',
    'active'
  ),
  (
    CAST(:'tenant_id' AS uuid),
    'system-automation',
    'system-automation@nexuslog.dev',
    'System Automation',
    'active'
  )
ON CONFLICT (tenant_id, username) DO UPDATE
SET email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    status = 'active',
    updated_at = NOW();

INSERT INTO user_credentials (tenant_id, user_id, password_hash, password_algo, password_cost)
SELECT
  CAST(:'tenant_id' AS uuid),
  u.id,
  '$2a$12$Grb472rXmEStVJprIfaFwONirfpwc7iouq/IS1SPYX9kVUVCe188i',
  'bcrypt',
  12
FROM users u
WHERE u.tenant_id = CAST(:'tenant_id' AS uuid)
  AND u.username = 'sys-superadmin'
ON CONFLICT (user_id) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    password_algo = EXCLUDED.password_algo,
    password_cost = EXCLUDED.password_cost,
    password_updated_at = NOW(),
    updated_at = NOW();

DELETE FROM user_credentials
WHERE user_id IN (
  SELECT id
  FROM users
  WHERE tenant_id = CAST(:'tenant_id' AS uuid)
    AND username = 'system-automation'
);

DELETE FROM user_roles
WHERE user_id IN (
  SELECT id
  FROM users
  WHERE tenant_id = CAST(:'tenant_id' AS uuid)
    AND username IN ('sys-superadmin', 'system-automation')
);

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.tenant_id = u.tenant_id
WHERE u.tenant_id = CAST(:'tenant_id' AS uuid)
  AND (
    (u.username = 'sys-superadmin' AND lower(r.name) = 'super_admin')
    OR (u.username = 'system-automation' AND lower(r.name) = 'system_automation')
  )
ON CONFLICT (user_id, role_id) DO NOTHING;

UPDATE alert_rules
SET created_by = NULL
WHERE tenant_id = CAST(:'tenant_id' AS uuid)
  AND created_by IN (
      SELECT id FROM users
      WHERE tenant_id = CAST(:'tenant_id' AS uuid)
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

UPDATE audit_logs
SET user_id = NULL
WHERE tenant_id = CAST(:'tenant_id' AS uuid)
  AND user_id IN (
      SELECT id FROM users
      WHERE tenant_id = CAST(:'tenant_id' AS uuid)
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

UPDATE notification_channels
SET created_by = NULL
WHERE tenant_id = CAST(:'tenant_id' AS uuid)
  AND created_by IN (
      SELECT id FROM users
      WHERE tenant_id = CAST(:'tenant_id' AS uuid)
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

UPDATE incidents
SET assigned_to = NULL
WHERE tenant_id = CAST(:'tenant_id' AS uuid)
  AND assigned_to IN (
      SELECT id FROM users
      WHERE tenant_id = CAST(:'tenant_id' AS uuid)
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

UPDATE incidents
SET created_by = NULL
WHERE tenant_id = CAST(:'tenant_id' AS uuid)
  AND created_by IN (
      SELECT id FROM users
      WHERE tenant_id = CAST(:'tenant_id' AS uuid)
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

UPDATE incident_timeline
SET actor_id = NULL
WHERE actor_id IN (
    SELECT id FROM users
    WHERE tenant_id = CAST(:'tenant_id' AS uuid)
      AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
);

UPDATE resource_thresholds
SET created_by = NULL
WHERE tenant_id = CAST(:'tenant_id' AS uuid)
  AND created_by IN (
      SELECT id FROM users
      WHERE tenant_id = CAST(:'tenant_id' AS uuid)
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

UPDATE export_jobs
SET created_by = NULL
WHERE tenant_id = CAST(:'tenant_id' AS uuid)
  AND created_by IN (
      SELECT id FROM users
      WHERE tenant_id = CAST(:'tenant_id' AS uuid)
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

UPDATE alert_silences
SET created_by = NULL
WHERE tenant_id = CAST(:'tenant_id' AS uuid)
  AND created_by IN (
      SELECT id FROM users
      WHERE tenant_id = CAST(:'tenant_id' AS uuid)
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

DELETE FROM users
WHERE tenant_id = CAST(:'tenant_id' AS uuid)
  AND username IN ('demo-admin', 'demo-operator', 'demo-viewer');

COMMIT;

SELECT u.username, r.name AS role, u.email
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE u.tenant_id = CAST(:'tenant_id' AS uuid)
  AND u.username IN ('sys-superadmin', 'system-automation')
ORDER BY u.username;
EOSQL

echo ""
echo "Bootstrap tenant: $TENANT_ID"
echo "Bootstrap username: sys-superadmin"
echo "Bootstrap password: Demo@2026"
echo "=== Done ==="

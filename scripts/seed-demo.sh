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
#   DB_HOST     (default: localhost)    — ignored in docker mode
#   DB_PORT     (default: 5432)        — ignored in docker mode
#   DB_NAME     (default: nexuslog)
#   DB_USER     (default: nexuslog)
#   DB_PASSWORD (default: nexuslog_dev)
#   PG_CONTAINER (default: nexuslog-postgres-1)

set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-nexuslog}"
DB_USER="${DB_USER:-nexuslog}"
DB_PASSWORD="${DB_PASSWORD:-nexuslog_dev}"
PG_CONTAINER="${PG_CONTAINER:-nexuslog-postgres-1}"

MODE="${1:-auto}"

run_sql() {
  if [[ "$MODE" == "--docker" ]] || { [[ "$MODE" == "auto" ]] && ! command -v psql &>/dev/null; }; then
    docker exec -i "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1
  else
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1
  fi
}

echo "=== NexusLog Bootstrap Seed ==="

run_sql <<'EOSQL'
BEGIN;

-- Ensure default tenant exists
INSERT INTO obs.tenant (id, name, display_name, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'default', 'Default Tenant', 'active')
ON CONFLICT (name) DO NOTHING;

-- Ensure built-in roles exist
INSERT INTO roles (id, tenant_id, name, description, permissions)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'system_admin', 'System administrator with user, audit, alert, incident, and monitoring management permissions',
   '["users:read","users:write","logs:read","logs:export","alerts:read","alerts:write","incidents:read","incidents:write","metrics:read","dashboards:read","audit:read"]'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'operator', 'Operational access: log search, alert management, incident handling, monitoring',
   '["logs:read","logs:export","alerts:read","alerts:write","incidents:read","incidents:write","metrics:read","dashboards:read","audit:read"]'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   'viewer', 'Read-only access: view logs, dashboards, and monitoring data',
   '["logs:read","dashboards:read","metrics:read"]'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
   'super_admin', 'Reserved super administrator role. Only one bootstrap user may hold this role.', '["*"]'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
   'system_automation', 'Reserved system account role for automated operation and audit attribution.', '["audit:write"]')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Create reserved bootstrap users (password: Demo@2026 only for sys-superadmin)
INSERT INTO users (id, tenant_id, username, email, display_name, status)
VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'sys-superadmin', 'superadmin@nexuslog.dev', 'System Super Admin', 'active'),
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
   'system-automation', 'system-automation@nexuslog.dev', 'System Automation', 'active')
ON CONFLICT (tenant_id, username) DO UPDATE
SET email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    status = 'active',
    updated_at = NOW();

-- Credentials (bcrypt hash of "Demo@2026", cost=12)
INSERT INTO user_credentials (tenant_id, user_id, password_hash, password_algo, password_cost)
VALUES
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   '$2a$12$Grb472rXmEStVJprIfaFwONirfpwc7iouq/IS1SPYX9kVUVCe188i', 'bcrypt', 12)
ON CONFLICT (user_id) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    password_algo = EXCLUDED.password_algo,
    password_cost = EXCLUDED.password_cost,
    password_updated_at = NOW(),
    updated_at = NOW();

DELETE FROM user_credentials
WHERE user_id = '20000000-0000-0000-0000-000000000005';

DELETE FROM user_roles
WHERE user_id IN ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005');

-- Assign roles to users
INSERT INTO user_roles (user_id, role_id)
VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005')
ON CONFLICT (user_id, role_id) DO NOTHING;

UPDATE alert_rules
SET created_by = NULL
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND created_by IN (
      SELECT id FROM users
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

UPDATE audit_logs
SET user_id = NULL
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND user_id IN (
      SELECT id FROM users
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

UPDATE notification_channels
SET created_by = NULL
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND created_by IN (
      SELECT id FROM users
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

UPDATE incidents
SET assigned_to = NULL
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND assigned_to IN (
      SELECT id FROM users
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

UPDATE incidents
SET created_by = NULL
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND created_by IN (
      SELECT id FROM users
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

UPDATE incident_timeline
SET actor_id = NULL
WHERE actor_id IN (
    SELECT id FROM users
    WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
      AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
);

UPDATE resource_thresholds
SET created_by = NULL
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND created_by IN (
      SELECT id FROM users
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

UPDATE export_jobs
SET created_by = NULL
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND created_by IN (
      SELECT id FROM users
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

UPDATE alert_silences
SET created_by = NULL
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND created_by IN (
      SELECT id FROM users
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

DELETE FROM users
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND username IN ('demo-admin', 'demo-operator', 'demo-viewer');

COMMIT;

-- Show results
SELECT u.username, r.name AS role, u.email
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE u.username IN ('sys-superadmin', 'system-automation')
ORDER BY u.username;
EOSQL

echo ""
echo "Bootstrap username: sys-superadmin"
echo "Bootstrap password: Demo@2026"
echo "=== Done ==="

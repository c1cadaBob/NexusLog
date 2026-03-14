#!/usr/bin/env bash
# seed-demo.sh — Create demo users (admin/operator/viewer) for dev environment.
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

echo "=== NexusLog Demo Seed ==="

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
   'admin', 'Full system access including user management and system settings', '["*"]'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'operator', 'Operational access: log search, alert management, incident handling, monitoring',
   '["logs:read","logs:export","alerts:read","alerts:write","incidents:read","incidents:write","metrics:read","dashboards:read","audit:read"]'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   'viewer', 'Read-only access: view logs, dashboards, and monitoring data',
   '["logs:read","dashboards:read","metrics:read"]')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Create 3 demo users (password: Demo@2026)
INSERT INTO users (id, tenant_id, username, email, display_name, status)
VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'demo-admin', 'admin@nexuslog.dev', 'Demo Admin', 'active'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'demo-operator', 'operator@nexuslog.dev', 'Demo Operator', 'active'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   'demo-viewer', 'viewer@nexuslog.dev', 'Demo Viewer', 'active')
ON CONFLICT (tenant_id, username) DO NOTHING;

-- Credentials (bcrypt hash of "Demo@2026", cost=12)
INSERT INTO user_credentials (tenant_id, user_id, password_hash, password_algo, password_cost)
VALUES
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   '$2a$12$Grb472rXmEStVJprIfaFwONirfpwc7iouq/IS1SPYX9kVUVCe188i', 'bcrypt', 12),
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
   '$2a$12$Grb472rXmEStVJprIfaFwONirfpwc7iouq/IS1SPYX9kVUVCe188i', 'bcrypt', 12),
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003',
   '$2a$12$Grb472rXmEStVJprIfaFwONirfpwc7iouq/IS1SPYX9kVUVCe188i', 'bcrypt', 12)
ON CONFLICT (user_id) DO NOTHING;

-- Assign roles to users
INSERT INTO user_roles (user_id, role_id)
VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003')
ON CONFLICT (user_id, role_id) DO NOTHING;

COMMIT;

-- Show results
SELECT u.username, r.name AS role, u.email
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE u.username LIKE 'demo-%'
ORDER BY u.username;
EOSQL

echo ""
echo "Demo password: Demo@2026"
echo "=== Done ==="

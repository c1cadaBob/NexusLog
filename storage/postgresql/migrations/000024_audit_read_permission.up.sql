-- 000024: 为内置 operator 角色补充 audit:read 权限
-- change_level: normal

BEGIN;

UPDATE roles
SET permissions = COALESCE(permissions, '[]'::jsonb) || '["audit:read"]'::jsonb
WHERE lower(name) = 'operator'
  AND NOT COALESCE(permissions, '[]'::jsonb) ? 'audit:read';

COMMIT;

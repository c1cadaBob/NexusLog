-- 回滚 000024：移除内置 operator 角色的 audit:read 权限
-- change_level: normal

BEGIN;

UPDATE roles
SET permissions = (
    SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
    FROM jsonb_array_elements_text(COALESCE(roles.permissions, '[]'::jsonb)) AS value
    WHERE value <> 'audit:read'
)
WHERE lower(name) = 'operator'
  AND COALESCE(permissions, '[]'::jsonb) ? 'audit:read';

COMMIT;

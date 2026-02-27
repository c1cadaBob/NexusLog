SET lock_timeout = '3s';
SET statement_timeout = '5min';

-- =========================================================
-- 1) 角色（建议用“组角色”）
-- =========================================================
DO $$
BEGIN
  CREATE ROLE obs_app_rw NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE ROLE obs_app_ro NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE ROLE obs_audit_ro NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE ROLE obs_ops_admin NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 可选：若你能用超级权限，给运维角色绕过 RLS
-- ALTER ROLE obs_ops_admin BYPASSRLS;

-- =========================================================
-- 2) 基础权限
-- =========================================================
REVOKE ALL ON SCHEMA obs FROM PUBLIC;
GRANT USAGE ON SCHEMA obs TO obs_app_rw, obs_app_ro, obs_audit_ro, obs_ops_admin;

-- 先收紧再按规则发放
REVOKE ALL ON ALL TABLES IN SCHEMA obs FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA obs FROM obs_app_rw, obs_app_ro, obs_audit_ro, obs_ops_admin;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA obs TO obs_app_rw, obs_ops_admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA obs TO obs_app_rw, obs_app_ro, obs_audit_ro, obs_ops_admin;

-- 默认权限（后续新表）
ALTER DEFAULT PRIVILEGES IN SCHEMA obs REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA obs GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO obs_app_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA obs GRANT SELECT ON TABLES TO obs_app_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA obs GRANT SELECT ON TABLES TO obs_audit_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA obs GRANT ALL ON TABLES TO obs_ops_admin;

-- =========================================================
-- 3) 会话上下文函数（从 GUC 取租户/项目）
--    用法：SET LOCAL app.tenant_id='...'; SET LOCAL app.project_id='...';
-- =========================================================
CREATE OR REPLACE FUNCTION obs.app_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION obs.app_project_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.project_id', true), '')::uuid
$$;

-- =========================================================
-- 4) 自动应用 RLS（仅对含 tenant_id 的表）
--    - 含 tenant_id + project_id: 双条件
--    - 仅 tenant_id: 单条件
--    - 不含 tenant_id: 不给 app/audit 直接权限（避免越权）
-- =========================================================
CREATE OR REPLACE FUNCTION obs.apply_rls_to_obs_tables()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
  v_using text;
BEGIN
  FOR r IN
    SELECT t.table_name,
           EXISTS (
             SELECT 1 FROM information_schema.columns c
             WHERE c.table_schema='obs' AND c.table_name=t.table_name AND c.column_name='tenant_id'
           ) AS has_tenant,
           EXISTS (
             SELECT 1 FROM information_schema.columns c
             WHERE c.table_schema='obs' AND c.table_name=t.table_name AND c.column_name='project_id'
           ) AS has_project
    FROM information_schema.tables t
    WHERE t.table_schema='obs'
      AND t.table_type='BASE TABLE'
  LOOP
    -- 统一给 ops_admin
    EXECUTE format('GRANT ALL ON TABLE obs.%I TO obs_ops_admin', r.table_name);

    IF r.has_tenant THEN
      -- 发放业务角色权限
      EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE obs.%I TO obs_app_rw', r.table_name);
      EXECUTE format('GRANT SELECT ON TABLE obs.%I TO obs_app_ro, obs_audit_ro', r.table_name);

      v_using := 'tenant_id = obs.app_tenant_id()';
      IF r.has_project THEN
        v_using := v_using || ' AND (obs.app_project_id() IS NULL OR project_id = obs.app_project_id())';
      END IF;

      EXECUTE format('ALTER TABLE obs.%I ENABLE ROW LEVEL SECURITY', r.table_name);
      EXECUTE format('ALTER TABLE obs.%I FORCE ROW LEVEL SECURITY', r.table_name);

      EXECUTE format('DROP POLICY IF EXISTS p_app_rw ON obs.%I', r.table_name);
      EXECUTE format('DROP POLICY IF EXISTS p_app_ro ON obs.%I', r.table_name);
      EXECUTE format('DROP POLICY IF EXISTS p_audit_ro ON obs.%I', r.table_name);
      EXECUTE format('DROP POLICY IF EXISTS p_ops_admin ON obs.%I', r.table_name);

      EXECUTE format(
        'CREATE POLICY p_app_rw ON obs.%I FOR ALL TO obs_app_rw USING (%s) WITH CHECK (%s)',
        r.table_name, v_using, v_using
      );
      EXECUTE format(
        'CREATE POLICY p_app_ro ON obs.%I FOR SELECT TO obs_app_ro USING (%s)',
        r.table_name, v_using
      );
      EXECUTE format(
        'CREATE POLICY p_audit_ro ON obs.%I FOR SELECT TO obs_audit_ro USING (%s)',
        r.table_name, v_using
      );
      EXECUTE format(
        'CREATE POLICY p_ops_admin ON obs.%I FOR ALL TO obs_ops_admin USING (true) WITH CHECK (true)',
        r.table_name
      );
    ELSE
      -- 无 tenant_id 的表：禁止 app/audit 直接访问（需走服务层或后续补 tenant_id）
      EXECUTE format('REVOKE ALL ON TABLE obs.%I FROM obs_app_rw, obs_app_ro, obs_audit_ro', r.table_name);

      -- 如之前启过RLS，可保留；这里不强制设置策略
    END IF;
  END LOOP;
END;
$$;

SELECT obs.apply_rls_to_obs_tables();

-- =========================================================
-- 5) 验收（可手工执行）
-- =========================================================
-- A. 查看哪些表启用了 RLS
-- SELECT schemaname, tablename, rowsecurity, forcerowsecurity
-- FROM pg_tables
-- WHERE schemaname='obs'
-- ORDER BY tablename;

-- B. 查看策略
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname='obs'
-- ORDER BY tablename, policyname;

-- =========================================================
-- 应用侧必须配合（关键）
-- 每个事务都带上下文（尤其用了 PgBouncer 事务池时）：
-- =========================================================
-- BEGIN;
-- SET LOCAL app.tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- SET LOCAL app.project_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'; -- 可选
-- 你的业务SQL
-- COMMIT;
太好了，继续推进。下面给你 **V8：审计不可篡改增强**（可直接落 Flyway）。

> 文件名建议：`V8__immutable_audit_and_row_change_trigger.sql`

```sql
SET lock_timeout = '3s';
SET statement_timeout = '5min';

-- =========================================================
-- 1) 审计表：记录行级变更（before/after + trace_id）
-- =========================================================
CREATE TABLE IF NOT EXISTS obs.data_change_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_at      timestamptz NOT NULL DEFAULT now(),
  source_txid     bigint NOT NULL DEFAULT txid_current(),

  tenant_id       uuid,
  project_id      uuid,
  env_id          uuid,

  table_schema    text NOT NULL,
  table_name      text NOT NULL,
  operation       varchar(8) NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  row_pk          jsonb NOT NULL DEFAULT '{}'::jsonb,

  before_data     jsonb,
  after_data      jsonb,

  trace_id        varchar(128),
  actor_type      varchar(32),
  actor_id        varchar(128),
  app_name        text DEFAULT current_setting('application_name', true),
  client_addr     inet DEFAULT inet_client_addr()
);

CREATE INDEX IF NOT EXISTS idx_dca_tenant_time
  ON obs.data_change_audit (tenant_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_dca_table_time
  ON obs.data_change_audit (table_schema, table_name, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_dca_trace
  ON obs.data_change_audit (trace_id);

CREATE INDEX IF NOT EXISTS idx_dca_rowpk_gin
  ON obs.data_change_audit USING gin (row_pk);

-- =========================================================
-- 2) Append-only 防篡改：禁止 UPDATE/DELETE
-- =========================================================
CREATE OR REPLACE FUNCTION obs.fn_guard_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'obs.data_change_audit is append-only; % is not allowed', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_dca_append_only ON obs.data_change_audit;
CREATE TRIGGER trg_dca_append_only
BEFORE UPDATE OR DELETE ON obs.data_change_audit
FOR EACH ROW
EXECUTE FUNCTION obs.fn_guard_append_only();

-- =========================================================
-- 3) 通用审计触发器函数（自动抓 before/after + trace_id）
--    说明：
--    - 从 GUC 读取上下文：
--      app.tenant_id / app.project_id / app.env_id / app.trace_id / app.user_id / app.actor_type
-- =========================================================
CREATE OR REPLACE FUNCTION obs.fn_capture_row_change_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = obs, pg_catalog
AS $$
DECLARE
  v_before     jsonb := NULL;
  v_after      jsonb := NULL;
  v_row_data   jsonb := '{}'::jsonb;
  v_row_pk     jsonb := '{}'::jsonb;
  v_col        text;
  i            int;

  v_tenant_id  uuid;
  v_project_id uuid;
  v_env_id     uuid;

  v_trace_id   text;
  v_actor_id   text;
  v_actor_type text;
BEGIN
  -- 防递归
  IF TG_TABLE_SCHEMA = 'obs' AND TG_TABLE_NAME = 'data_change_audit' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_before := to_jsonb(OLD);
  END IF;

  v_row_data := COALESCE(v_after, v_before, '{}'::jsonb);

  -- 主键提取：优先用触发器参数（如 'id'），否则尝试 id
  IF TG_NARGS > 0 THEN
    FOR i IN 0..TG_NARGS-1 LOOP
      v_col := TG_ARGV[i];
      v_row_pk := v_row_pk || jsonb_build_object(v_col, v_row_data -> v_col);
    END LOOP;
  ELSIF v_row_data ? 'id' THEN
    v_row_pk := jsonb_build_object('id', v_row_data -> 'id');
  END IF;

  -- 业务上下文（优先取行内字段，其次取会话 GUC）
  v_tenant_id  := NULLIF(COALESCE(v_after->>'tenant_id',  v_before->>'tenant_id',  current_setting('app.tenant_id', true)), '')::uuid;
  v_project_id := NULLIF(COALESCE(v_after->>'project_id', v_before->>'project_id', current_setting('app.project_id', true)), '')::uuid;
  v_env_id     := NULLIF(COALESCE(v_after->>'env_id',     v_before->>'env_id',     current_setting('app.env_id', true)), '')::uuid;

  v_trace_id   := NULLIF(current_setting('app.trace_id', true), '');
  v_actor_id   := NULLIF(current_setting('app.user_id', true), '');
  v_actor_type := COALESCE(NULLIF(current_setting('app.actor_type', true), ''), 'USER');

  INSERT INTO obs.data_change_audit(
    tenant_id, project_id, env_id,
    table_schema, table_name, operation, row_pk,
    before_data, after_data,
    trace_id, actor_type, actor_id
  )
  VALUES (
    v_tenant_id, v_project_id, v_env_id,
    TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP, v_row_pk,
    v_before, v_after,
    v_trace_id, v_actor_type, v_actor_id
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- =========================================================
-- 4) 挂载工具：给指定表开启审计触发器
-- =========================================================
CREATE OR REPLACE FUNCTION obs.enable_data_change_audit(
  p_table regclass,
  p_pk_cols text[] DEFAULT ARRAY['id']
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_schema text;
  v_table  text;
  v_args   text;
BEGIN
  SELECT n.nspname, c.relname
    INTO v_schema, v_table
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.oid = p_table;

  IF v_table IS NULL THEN
    RAISE EXCEPTION 'table not found: %', p_table;
  END IF;

  SELECT string_agg(quote_literal(x), ',')
    INTO v_args
  FROM unnest(COALESCE(p_pk_cols, ARRAY[]::text[])) AS t(x);

  EXECUTE format('DROP TRIGGER IF EXISTS trg_data_change_audit ON %I.%I', v_schema, v_table);

  EXECUTE format(
    'CREATE TRIGGER trg_data_change_audit
     AFTER INSERT OR UPDATE OR DELETE ON %I.%I
     FOR EACH ROW EXECUTE FUNCTION obs.fn_capture_row_change_audit(%s)',
    v_schema, v_table, COALESCE(v_args, '')
  );
END;
$$;

-- 批量挂载：默认对 obs schema 下“含 tenant_id 且非分区子表”的业务表生效
CREATE OR REPLACE FUNCTION obs.apply_data_change_audit(
  p_exclude_tables text[] DEFAULT ARRAY[
    'data_change_audit',      -- 审计表本身
    'operation_audit_log',    -- 已有专用审计日志（可按需单独处理）
    'health_check_result',    -- 高频监测表，通常不做行级审计
    'incident_timeline'       -- 事件流水表，通常本身即审计线
  ]
)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
  v_has_id boolean;
  v_count int := 0;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, c.oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'obs'
      AND c.relkind IN ('r','p')
      AND c.relname <> ALL (p_exclude_tables)
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = c.oid
          AND a.attname = 'tenant_id'
          AND a.attnum > 0
          AND NOT a.attisdropped
      )
      -- 排除分区子表（只在父表挂）
      AND NOT EXISTS (SELECT 1 FROM pg_inherits i WHERE i.inhrelid = c.oid)
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = r.oid
        AND a.attname = 'id'
        AND a.attnum > 0
        AND NOT a.attisdropped
    ) INTO v_has_id;

    IF v_has_id THEN
      PERFORM obs.enable_data_change_audit(format('%I.%I', r.schema_name, r.table_name)::regclass, ARRAY['id']);
    ELSE
      PERFORM obs.enable_data_change_audit(format('%I.%I', r.schema_name, r.table_name)::regclass, ARRAY[]::text[]);
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

SELECT obs.apply_data_change_audit();

-- =========================================================
-- 5) 权限收敛（按角色存在与否发放）
-- =========================================================
REVOKE ALL ON TABLE obs.data_change_audit FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE obs.data_change_audit FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='obs_app_rw') THEN
    EXECUTE 'GRANT SELECT ON obs.data_change_audit TO obs_app_rw';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON obs.data_change_audit FROM obs_app_rw';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='obs_app_ro') THEN
    EXECUTE 'REVOKE ALL ON obs.data_change_audit FROM obs_app_ro';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='obs_audit_ro') THEN
    EXECUTE 'GRANT SELECT ON obs.data_change_audit TO obs_audit_ro';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='obs_ops_admin') THEN
    EXECUTE 'GRANT SELECT ON obs.data_change_audit TO obs_ops_admin';
    EXECUTE 'REVOKE UPDATE, DELETE, TRUNCATE ON obs.data_change_audit FROM obs_ops_admin';
  END IF;
END $$;
```

---

### 应用侧调用规范（必须）
每个事务加上下文（尤其 PgBouncer 事务池）：

```sql
BEGIN;
SET LOCAL app.tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SET LOCAL app.project_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SET LOCAL app.user_id = 'u_12345';
SET LOCAL app.actor_type = 'USER';
SET LOCAL app.trace_id = 'trace-20260219-xyz';
-- 业务SQL...
COMMIT;
```

如果你点头，我下一步给你 `V9__audit_verify_and_export.sql`：
- 审计校验视图（按 trace_id 还原完整变更链）
- 审计导出任务表（推送到对象存储/WORM）
- 每日完整性检查任务（防“静默篡改”）。
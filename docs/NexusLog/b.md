非常好，我们把这两块一次性补齐。你现在这套就已经接近“可审计、可运维、可持续演进”的生产级了。

---

## 一、Flyway 回滚/前向兼容规范模板（可直接纳入团队规范）

## 1) 版本与目录

```text
sql/
  V1__baseline_75_tables.sql
  V2__...
  V3__...
  R__views.sql
  R__functions.sql
```

- `V`：一次性、严格递增。
- `R`：可重复（视图、函数、SP、权限等）。

---

## 2) 变更原则（强制）

1. **前向兼容优先**（Expand/Contract）
   - 先“加”（可空列、新表、新索引），再“切流”，最后“删”。
2. **禁止一步破坏性变更**
   - 不允许直接 `DROP COLUMN` / 改类型导致旧代码崩。
3. **DDL 最小锁时间**
   - 每个脚本开头设置 `lock_timeout`、`statement_timeout`。
4. **大表变更拆三步**
   - `加列(可空)` → `分批回填` → `加约束/非空`。
5. **索引并发创建**
   - `CREATE INDEX CONCURRENTLY`（该 migration 需 `executeInTransaction=false`）。
6. **回滚以“前向修复”为主**
   - 线上不依赖手工回滚，使用 `Vx_hotfix` 修复。
7. **每个 migration 必带验收 SQL**
   - 至少一段 post-check。
8. **变更单必须包含影响评估**
   - 影响表、锁风险、预计时长、回滚策略、告警预案。

---

## 3) Migration 脚本模板（复制即用）

```sql
-- VXX__change_xxx.sql
-- purpose: ...
-- risk: low/medium/high
-- rollback: forward-fix with VXX_1__...

SET lock_timeout = '3s';
SET statement_timeout = '5min';

-- pre-check
DO $$
BEGIN
  -- 示例：防重复
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='obs' AND table_name='incident' AND column_name='xxx'
  ) THEN
    RAISE NOTICE 'column already exists, skip';
  END IF;
END$$;

-- change
ALTER TABLE obs.incident ADD COLUMN IF NOT EXISTS xxx varchar(64);

-- post-check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='obs' AND table_name='incident' AND column_name='xxx'
  ) THEN
    RAISE EXCEPTION 'post-check failed: column xxx not found';
  END IF;
END$$;
```

---

## 4) 回滚策略矩阵（建议写进发布SOP）

- **可逆小变更**：可以做 `UXX__...`（Flyway Teams）
- **生产标准**：统一“前向修复”
  - 例：`V35`出问题，不回退 DB，发 `V36__hotfix_revert_logic.sql`
- **不可逆变更（删列/删表）**：必须延后至少一个发布周期，且完成数据归档后再执行。

---

## 二、Incident SLA 自动计算触发器（可执行 SQL）

> 文件名建议：`V6__incident_sla_policy_and_trigger.sql`

```sql
-- 1) SLA 策略表（可配置）
CREATE TABLE IF NOT EXISTS obs.incident_sla_policy (
  severity         varchar(16) PRIMARY KEY CHECK (severity IN ('P1','P2','P3','P4')),
  ack_minutes      int NOT NULL CHECK (ack_minutes > 0),
  resolve_minutes  int NOT NULL CHECK (resolve_minutes > 0),
  enabled          boolean NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- 默认策略（可按你们SRE标准调整）
INSERT INTO obs.incident_sla_policy(severity, ack_minutes, resolve_minutes)
VALUES
('P1', 5, 120),
('P2', 10, 240),
('P3', 30, 480),
('P4', 60, 1440)
ON CONFLICT (severity) DO UPDATE
SET ack_minutes = EXCLUDED.ack_minutes,
    resolve_minutes = EXCLUDED.resolve_minutes,
    enabled = true,
    updated_at = now();

-- 2) 自动计算函数
CREATE OR REPLACE FUNCTION obs.fn_incident_sla_sync()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_ack_min int;
  v_resolve_min int;
  v_base_time timestamptz;
  v_ack_deadline timestamptz;
  v_resolve_deadline timestamptz;
  v_mtta int;
  v_mttr int;
  v_ack_breached boolean;
  v_resolve_breached boolean;
BEGIN
  -- 按严重级别读取策略（失败时给兜底）
  SELECT ack_minutes, resolve_minutes
    INTO v_ack_min, v_resolve_min
  FROM obs.incident_sla_policy
  WHERE severity = NEW.severity
    AND enabled = true;

  IF v_ack_min IS NULL OR v_resolve_min IS NULL THEN
    CASE NEW.severity
      WHEN 'P1' THEN v_ack_min := 5;   v_resolve_min := 120;
      WHEN 'P2' THEN v_ack_min := 10;  v_resolve_min := 240;
      WHEN 'P3' THEN v_ack_min := 30;  v_resolve_min := 480;
      ELSE          v_ack_min := 60;  v_resolve_min := 1440;
    END CASE;
  END IF;

  -- 以 alerted_at 优先作为SLA起点，没有则用 detected_at
  v_base_time := COALESCE(NEW.alerted_at, NEW.detected_at, now());

  v_ack_deadline := v_base_time + make_interval(mins => v_ack_min);
  v_resolve_deadline := v_base_time + make_interval(mins => v_resolve_min);

  -- MTTA: acked_at - alerted_at(优先) / detected_at
  IF NEW.acked_at IS NOT NULL THEN
    v_mtta := EXTRACT(EPOCH FROM (NEW.acked_at - COALESCE(NEW.alerted_at, NEW.detected_at)))::int;
    IF v_mtta < 0 THEN v_mtta := NULL; END IF;
  ELSE
    v_mtta := NULL;
  END IF;

  -- MTTR: resolved_at - detected_at
  IF NEW.resolved_at IS NOT NULL THEN
    v_mttr := EXTRACT(EPOCH FROM (NEW.resolved_at - NEW.detected_at))::int;
    IF v_mttr < 0 THEN v_mttr := NULL; END IF;
  ELSE
    v_mttr := NULL;
  END IF;

  -- breach 判定
  v_ack_breached :=
    CASE
      WHEN NEW.acked_at IS NULL THEN now() > v_ack_deadline
      ELSE NEW.acked_at > v_ack_deadline
    END;

  v_resolve_breached :=
    CASE
      WHEN NEW.resolved_at IS NULL THEN now() > v_resolve_deadline
      ELSE NEW.resolved_at > v_resolve_deadline
    END;

  INSERT INTO obs.incident_response_sla (
    id, incident_id, ack_deadline_at, resolve_deadline_at,
    mtta_seconds, mttr_seconds,
    is_ack_breached, is_resolve_breached,
    calculated_at, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(), NEW.id, v_ack_deadline, v_resolve_deadline,
    v_mtta, v_mttr, v_ack_breached, v_resolve_breached,
    now(), now(), now()
  )
  ON CONFLICT (incident_id) DO UPDATE
  SET ack_deadline_at     = EXCLUDED.ack_deadline_at,
      resolve_deadline_at = EXCLUDED.resolve_deadline_at,
      mtta_seconds        = EXCLUDED.mtta_seconds,
      mttr_seconds        = EXCLUDED.mttr_seconds,
      is_ack_breached     = EXCLUDED.is_ack_breached,
      is_resolve_breached = EXCLUDED.is_resolve_breached,
      calculated_at       = now(),
      updated_at          = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incident_sla_sync ON obs.incident;
CREATE TRIGGER trg_incident_sla_sync
AFTER INSERT OR UPDATE OF severity, detected_at, alerted_at, acked_at, resolved_at, status
ON obs.incident
FOR EACH ROW
EXECUTE FUNCTION obs.fn_incident_sla_sync();

-- 3) 可选：定时刷新“未更新但已超时”的工单
CREATE OR REPLACE FUNCTION obs.refresh_incident_sla_breach()
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE obs.incident_response_sla s
  SET is_ack_breached = CASE
        WHEN i.acked_at IS NULL THEN now() > s.ack_deadline_at
        ELSE i.acked_at > s.ack_deadline_at
      END,
      is_resolve_breached = CASE
        WHEN i.resolved_at IS NULL THEN now() > s.resolve_deadline_at
        ELSE i.resolved_at > s.resolve_deadline_at
      END,
      updated_at = now(),
      calculated_at = now()
  FROM obs.incident i
  WHERE s.incident_id = i.id
    AND i.status NOT IN ('CLOSED','ARCHIVED');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
```

---

如果你愿意，我下一步可以直接给你 **V7（RLS 多租户策略）**：
- 按 `tenant_id / project_id` 自动隔离；
- 应用账号、审计账号、运维账号三套权限脚本（可直接上线）。
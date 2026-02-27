-- 创建某月分区（命名: 表名_YYYYMM）
CREATE OR REPLACE FUNCTION obs.create_month_partition(p_parent regclass, p_month date)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_start        timestamptz := date_trunc('month', p_month)::timestamptz;
  v_end          timestamptz := (date_trunc('month', p_month) + interval '1 month')::timestamptz;
  v_schema_name  text;
  v_table_name   text;
  v_child_name   text;
BEGIN
  SELECT n.nspname, c.relname
    INTO v_schema_name, v_table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.oid = p_parent;

  IF v_table_name IS NULL THEN
    RAISE EXCEPTION 'parent table not found: %', p_parent;
  END IF;

  v_child_name := format('%s_%s', v_table_name, to_char(v_start, 'YYYYMM'));

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I.%I PARTITION OF %I.%I FOR VALUES FROM (%L) TO (%L)',
    v_schema_name, v_child_name, v_schema_name, v_table_name, v_start, v_end
  );
END;
$$;

-- 预创建未来 N 个月分区
CREATE OR REPLACE FUNCTION obs.ensure_future_partitions(p_months_ahead int DEFAULT 3)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  i int;
  v_month date;
BEGIN
  FOR i IN 0..p_months_ahead LOOP
    v_month := (date_trunc('month', now()) + make_interval(months => i))::date;

    PERFORM obs.create_month_partition('obs.operation_audit_log'::regclass, v_month);
    PERFORM obs.create_month_partition('obs.health_check_result'::regclass, v_month);
    PERFORM obs.create_month_partition('obs.incident_timeline'::regclass, v_month);
  END LOOP;
END;
$$;

-- 按命名规则清理老分区（保留近 keep_months 月）
CREATE OR REPLACE FUNCTION obs.drop_old_month_partitions(p_parent regclass, p_keep_months int)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
  v_cutoff date := (date_trunc('month', now()) - make_interval(months => p_keep_months))::date;
  v_part_month date;
  v_drop_count int := 0;
BEGIN
  FOR r IN
    SELECT ns.nspname AS schema_name, c.relname AS part_name
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE i.inhparent = p_parent
      AND c.relname ~ '.*_[0-9]{6}$'
  LOOP
    v_part_month := to_date(right(r.part_name, 6), 'YYYYMM');
    IF v_part_month < v_cutoff THEN
      EXECUTE format('DROP TABLE IF EXISTS %I.%I', r.schema_name, r.part_name);
      v_drop_count := v_drop_count + 1;
    END IF;
  END LOOP;

  RETURN v_drop_count;
END;
$$;

-- 初始化执行一次
SELECT obs.ensure_future_partitions(6);
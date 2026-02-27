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
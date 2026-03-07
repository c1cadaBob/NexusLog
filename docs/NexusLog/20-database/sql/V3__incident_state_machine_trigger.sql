CREATE OR REPLACE FUNCTION obs.fn_incident_status_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- 只在状态变化时检查
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT EXISTS (
      SELECT 1
      FROM obs.incident_status_transition t
      WHERE t.from_status = OLD.status
        AND t.to_status   = NEW.status
    ) THEN
      RAISE EXCEPTION '非法状态迁移: % -> % (incident_no=%)', OLD.status, NEW.status, OLD.incident_no;
    END IF;

    -- 自动打时间戳
    IF NEW.status = 'ALERTED' AND NEW.alerted_at IS NULL THEN
      NEW.alerted_at := now();
    ELSIF NEW.status = 'ACKED' AND NEW.acked_at IS NULL THEN
      NEW.acked_at := now();
    ELSIF NEW.status = 'MITIGATED' AND NEW.mitigated_at IS NULL THEN
      NEW.mitigated_at := now();
    ELSIF NEW.status = 'RESOLVED' AND NEW.resolved_at IS NULL THEN
      NEW.resolved_at := now();
    ELSIF NEW.status = 'ARCHIVED' AND NEW.archived_at IS NULL THEN
      NEW.archived_at := now();
    END IF;
  END IF;

  -- 基础时间一致性校验
  IF NEW.alerted_at IS NOT NULL AND NEW.detected_at IS NOT NULL AND NEW.alerted_at < NEW.detected_at THEN
    RAISE EXCEPTION '时间错误: alerted_at < detected_at (incident_no=%)', NEW.incident_no;
  END IF;
  IF NEW.acked_at IS NOT NULL AND NEW.alerted_at IS NOT NULL AND NEW.acked_at < NEW.alerted_at THEN
    RAISE EXCEPTION '时间错误: acked_at < alerted_at (incident_no=%)', NEW.incident_no;
  END IF;
  IF NEW.resolved_at IS NOT NULL AND NEW.alerted_at IS NOT NULL AND NEW.resolved_at < NEW.alerted_at THEN
    RAISE EXCEPTION '时间错误: resolved_at < alerted_at (incident_no=%)', NEW.incident_no;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incident_status_guard ON obs.incident;
CREATE TRIGGER trg_incident_status_guard
BEFORE UPDATE OF status, alerted_at, acked_at, mitigated_at, resolved_at, archived_at
ON obs.incident
FOR EACH ROW
EXECUTE FUNCTION obs.fn_incident_status_guard();
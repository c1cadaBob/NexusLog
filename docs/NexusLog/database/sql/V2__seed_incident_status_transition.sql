-- Incident 合法状态迁移表
CREATE TABLE IF NOT EXISTS obs.incident_status_transition (
  from_status varchar(16) NOT NULL,
  to_status   varchar(16) NOT NULL,
  PRIMARY KEY (from_status, to_status)
);

-- 清空并重灌（可选）
TRUNCATE TABLE obs.incident_status_transition;

INSERT INTO obs.incident_status_transition(from_status, to_status) VALUES
-- 主路径
('NEW','ALERTED'),
('ALERTED','ACKED'),
('ACKED','MITIGATING'),
('MITIGATING','MITIGATED'),
('MITIGATED','RESOLVED'),
('RESOLVED','POSTMORTEM'),
('POSTMORTEM','ARCHIVED'),

-- 异常/终止路径
('NEW','CLOSED'),
('ALERTED','ESCALATED'),
('ALERTED','CLOSED'),
('ACKED','ESCALATED'),
('ACKED','CLOSED'),
('MITIGATING','ESCALATED'),
('MITIGATED','ESCALATED'),
('ESCALATED','ACKED'),
('ESCALATED','MITIGATING'),
('ESCALATED','RESOLVED'),
('ESCALATED','CLOSED'),
('RESOLVED','CLOSED');
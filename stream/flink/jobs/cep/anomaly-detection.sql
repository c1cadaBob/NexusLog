-- NexusLog Flink CEP 作业：异常检测
-- 使用 MATCH_RECOGNIZE 进行复杂事件处理，检测日志异常模式

-- 定义 Kafka 源表
CREATE TABLE log_events (
    log_id STRING,
    source STRING,
    level STRING,
    message STRING,
    timestamp_ms BIGINT,
    event_time AS TO_TIMESTAMP_LTZ(timestamp_ms, 3),
    WATERMARK FOR event_time AS event_time - INTERVAL '10' SECOND
) WITH (
    'connector' = 'kafka',
    'topic' = 'nexuslog-raw-logs',
    'properties.bootstrap.servers' = 'kafka:9092',
    'properties.group.id' = 'flink-cep-anomaly',
    'format' = 'json',
    'scan.startup.mode' = 'latest-offset'
);

-- 定义告警输出表
CREATE TABLE anomaly_alerts (
    alert_id STRING,
    source STRING,
    pattern_type STRING,
    first_error_time TIMESTAMP(3),
    last_error_time TIMESTAMP(3),
    error_count BIGINT,
    detected_at TIMESTAMP(3),
    PRIMARY KEY (alert_id) NOT ENFORCED
) WITH (
    'connector' = 'kafka',
    'topic' = 'nexuslog-anomaly-alerts',
    'properties.bootstrap.servers' = 'kafka:9092',
    'format' = 'json'
);

-- CEP 模式：5 分钟内同一来源连续出现 5 次以上 ERROR 级别日志
INSERT INTO anomaly_alerts
SELECT *
FROM log_events
MATCH_RECOGNIZE (
    PARTITION BY source
    ORDER BY event_time
    MEASURES
        UUID() AS alert_id,
        A.source AS source,
        'consecutive_errors' AS pattern_type,
        FIRST(A.event_time) AS first_error_time,
        LAST(A.event_time) AS last_error_time,
        COUNT(A.log_id) AS error_count,
        CURRENT_TIMESTAMP AS detected_at
    ONE ROW PER MATCH
    AFTER MATCH SKIP PAST LAST ROW
    PATTERN (A{5,}) WITHIN INTERVAL '5' MINUTE
    DEFINE
        A AS A.level = 'ERROR'
) AS T;

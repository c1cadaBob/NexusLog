-- NexusLog Flink CEP 作业：错误突增检测
-- 检测短时间内错误日志突然增多的异常模式

-- 定义 Kafka 源表
CREATE TABLE log_stream (
    log_id STRING,
    source STRING,
    service STRING,
    `level` STRING,
    message STRING,
    `timestamp` BIGINT,
    tenant_id STRING,
    event_time AS TO_TIMESTAMP_LTZ(`timestamp`, 3),
    WATERMARK FOR event_time AS event_time - INTERVAL '10' SECOND
) WITH (
    'connector' = 'kafka',
    'topic' = 'nexuslog.logs.parsed',
    'properties.bootstrap.servers' = 'kafka:9092',
    'properties.group.id' = 'flink-cep-error-burst',
    'format' = 'avro-confluent',
    'avro-confluent.url' = 'http://schema-registry:8081',
    'scan.startup.mode' = 'latest-offset'
);

-- 定义告警输出表
CREATE TABLE burst_alerts (
    alert_id STRING,
    source STRING,
    service STRING,
    pattern_type STRING,
    first_error_time TIMESTAMP(3),
    last_error_time TIMESTAMP(3),
    error_count BIGINT,
    detected_at TIMESTAMP(3),
    tenant_id STRING,
    PRIMARY KEY (alert_id) NOT ENFORCED
) WITH (
    'connector' = 'kafka',
    'topic' = 'nexuslog.alerts.events',
    'properties.bootstrap.servers' = 'kafka:9092',
    'format' = 'json'
);

-- CEP 模式：3 分钟内同一服务连续出现 10 次以上 ERROR/FATAL 日志
INSERT INTO burst_alerts
SELECT *
FROM log_stream
MATCH_RECOGNIZE (
    PARTITION BY service
    ORDER BY event_time
    MEASURES
        UUID() AS alert_id,
        FIRST(A.source) AS source,
        A.service AS service,
        'error_burst' AS pattern_type,
        FIRST(A.event_time) AS first_error_time,
        LAST(A.event_time) AS last_error_time,
        COUNT(A.log_id) AS error_count,
        CURRENT_TIMESTAMP AS detected_at,
        FIRST(A.tenant_id) AS tenant_id
    ONE ROW PER MATCH
    AFTER MATCH SKIP PAST LAST ROW
    PATTERN (A{10,}) WITHIN INTERVAL '3' MINUTE
    DEFINE
        A AS A.`level` IN ('ERROR', 'FATAL')
) AS T;

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
    tenant_id STRING
) WITH (
    'connector' = 'kafka',
    'topic' = 'nexuslog.alerts.events',
    'properties.bootstrap.servers' = 'kafka:9092',
    'format' = 'json'
);

-- 错误突增检测：3 分钟内同一服务出现 10 次以上 ERROR/FATAL 日志
INSERT INTO burst_alerts
SELECT
    UUID() AS alert_id,
    source,
    service,
    'error_burst' AS pattern_type,
    window_start AS first_error_time,
    window_end AS last_error_time,
    error_count,
    CURRENT_TIMESTAMP AS detected_at,
    tenant_id
FROM (
    SELECT
        source,
        service,
        tenant_id,
        TUMBLE_START(event_time, INTERVAL '3' MINUTE) AS window_start,
        TUMBLE_END(event_time, INTERVAL '3' MINUTE) AS window_end,
        COUNT(*) AS error_count
    FROM log_stream
    WHERE `level` IN ('ERROR', 'FATAL')
    GROUP BY
        TUMBLE(event_time, INTERVAL '3' MINUTE),
        source,
        service,
        tenant_id
) sub
WHERE error_count >= 10;

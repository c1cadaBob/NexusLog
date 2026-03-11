SET 'table.local-time-zone' = 'UTC';
SET 'table.dml-sync' = 'false';
SET 'pipeline.name' = 'nexuslog-stream-cep-anomaly';

CREATE TABLE log_events (
    id STRING,
    event_id STRING,
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
    'properties.group.id' = 'flink-cep-anomaly',
    'format' = 'avro-confluent',
    'avro-confluent.url' = 'http://schema-registry:8081',
    'scan.startup.mode' = 'latest-offset'
);

CREATE TABLE anomaly_alerts (
    id STRING,
    rule_id STRING,
    rule_name STRING,
    severity STRING,
    status STRING,
    triggered_at BIGINT,
    message STRING,
    fingerprint STRING,
    generator STRING,
    labels MAP<STRING, STRING>,
    annotations MAP<STRING, STRING>,
    source_logs ARRAY<STRING>,
    resolved_at BIGINT,
    tenant_id STRING
) WITH (
    'connector' = 'kafka',
    'topic' = 'nexuslog.alerts.events',
    'properties.bootstrap.servers' = 'kafka:9092',
    'format' = 'avro-confluent',
    'avro-confluent.url' = 'http://schema-registry:8081'
);

INSERT INTO anomaly_alerts
SELECT
    UUID() AS id,
    'cep-consecutive-errors' AS rule_id,
    '连续错误异常' AS rule_name,
    'WARNING' AS severity,
    'FIRING' AS status,
    CAST(UNIX_TIMESTAMP() * 1000 AS BIGINT) AS triggered_at,
    CONCAT('来源 ', source, ' 在 5 分钟内出现 ', CAST(error_count AS STRING), ' 次 ERROR 日志') AS message,
    CONCAT('cep-consecutive-errors:', source, ':', CAST(window_start_ms AS STRING)) AS fingerprint,
    'flink.cep.anomaly-detection' AS generator,
    MAP['source', source] AS labels,
    MAP['summary', '连续错误异常', 'pattern_type', 'consecutive_errors'] AS annotations,
    CAST(ARRAY[''] AS ARRAY<STRING>) AS source_logs,
    CAST(NULL AS BIGINT) AS resolved_at,
    tenant_id
FROM (
    SELECT
        source,
        tenant_id,
        CAST(UNIX_TIMESTAMP(CAST(TUMBLE_START(event_time, INTERVAL '5' MINUTE) AS STRING)) * 1000 AS BIGINT) AS window_start_ms,
        COUNT(*) AS error_count
    FROM log_events
    WHERE `level` = 'ERROR'
    GROUP BY
        TUMBLE(event_time, INTERVAL '5' MINUTE),
        source,
        tenant_id
) t
WHERE error_count >= 5;

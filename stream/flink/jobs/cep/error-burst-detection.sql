SET 'table.local-time-zone' = 'UTC';
SET 'table.dml-sync' = 'false';
SET 'pipeline.name' = 'nexuslog-stream-cep-error-burst';

CREATE TABLE log_stream (
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
    'properties.group.id' = 'flink-cep-error-burst',
    'format' = 'avro-confluent',
    'avro-confluent.url' = 'http://schema-registry:8081',
    'scan.startup.mode' = 'latest-offset'
);

CREATE TABLE burst_alerts (
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

INSERT INTO burst_alerts
SELECT
    UUID() AS id,
    'cep-error-burst' AS rule_id,
    '错误突增检测' AS rule_name,
    'WARNING' AS severity,
    'FIRING' AS status,
    CAST(UNIX_TIMESTAMP() * 1000 AS BIGINT) AS triggered_at,
    CONCAT('服务 ', COALESCE(service, 'unknown'), ' 在 3 分钟内出现 ', CAST(error_count AS STRING), ' 条 ERROR/FATAL 日志') AS message,
    CONCAT('cep-error-burst:', source, ':', COALESCE(service, 'unknown'), ':', CAST(window_start_ms AS STRING)) AS fingerprint,
    'flink.cep.error-burst' AS generator,
    MAP['source', source, 'service', COALESCE(service, 'unknown')] AS labels,
    MAP['summary', '错误突增检测', 'pattern_type', 'error_burst'] AS annotations,
    CAST(ARRAY[''] AS ARRAY<STRING>) AS source_logs,
    CAST(NULL AS BIGINT) AS resolved_at,
    tenant_id
FROM (
    SELECT
        source,
        service,
        tenant_id,
        CAST(UNIX_TIMESTAMP(CAST(TUMBLE_START(event_time, INTERVAL '3' MINUTE) AS STRING)) * 1000 AS BIGINT) AS window_start_ms,
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

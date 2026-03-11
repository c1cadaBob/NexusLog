SET 'table.local-time-zone' = 'UTC';
SET 'table.dml-sync' = 'false';
SET 'pipeline.name' = 'nexuslog-stream-alert-rules';

CREATE TABLE parsed_logs (
    id STRING,
    event_id STRING,
    `timestamp` BIGINT,
    ingested_at BIGINT,
    `level` STRING,
    source STRING,
    service STRING,
    `stream` STRING,
    message STRING,
    fields MAP<STRING, STRING>,
    attributes MAP<STRING, STRING>,
    tags MAP<STRING, STRING>,
    schema_version STRING,
    parse_status STRING,
    trace_id STRING,
    span_id STRING,
    tenant_id STRING,
    event_time AS TO_TIMESTAMP_LTZ(`timestamp`, 3),
    WATERMARK FOR event_time AS event_time - INTERVAL '10' SECOND
) WITH (
    'connector' = 'kafka',
    'topic' = 'nexuslog.logs.parsed',
    'properties.bootstrap.servers' = 'kafka:9092',
    'properties.group.id' = 'flink-alert-matching',
    'format' = 'avro-confluent',
    'avro-confluent.url' = 'http://schema-registry:8081',
    'scan.startup.mode' = 'latest-offset'
);

CREATE TABLE alert_events (
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

INSERT INTO alert_events
SELECT
    UUID() AS id,
    'rule-error-rate-high' AS rule_id,
    '错误率过高' AS rule_name,
    'WARNING' AS severity,
    'FIRING' AS status,
    CAST(UNIX_TIMESTAMP() * 1000 AS BIGINT) AS triggered_at,
    CONCAT('服务 ', COALESCE(service, 'unknown'), ' 在 1 分钟内产生 ', CAST(error_count AS STRING), ' 条 ERROR 日志') AS message,
    CONCAT('rule-error-rate-high:', COALESCE(service, 'unknown'), ':', source, ':', CAST(window_start_ms AS STRING)) AS fingerprint,
    'flink.alert-rule-matching' AS generator,
    MAP['service', COALESCE(service, 'unknown'), 'source', source] AS labels,
    MAP['summary', '错误率过高', 'runbook', 'stream/flink/jobs/sql/alert-rule-matching.sql'] AS annotations,
    CAST(ARRAY[''] AS ARRAY<STRING>) AS source_logs,
    CAST(NULL AS BIGINT) AS resolved_at,
    tenant_id
FROM (
    SELECT
        service,
        source,
        tenant_id,
        CAST(UNIX_TIMESTAMP(CAST(TUMBLE_START(event_time, INTERVAL '1' MINUTE) AS STRING)) * 1000 AS BIGINT) AS window_start_ms,
        COUNT(*) AS error_count
    FROM parsed_logs
    WHERE `level` = 'ERROR'
    GROUP BY
        TUMBLE(event_time, INTERVAL '1' MINUTE),
        service,
        source,
        tenant_id
    HAVING COUNT(*) > 50
);

INSERT INTO alert_events
SELECT
    UUID() AS id,
    'rule-fatal-detected' AS rule_id,
    '致命错误检测' AS rule_name,
    'CRITICAL' AS severity,
    'FIRING' AS status,
    CAST(UNIX_TIMESTAMP() * 1000 AS BIGINT) AS triggered_at,
    CONCAT('服务 ', COALESCE(service, 'unknown'), ' 检测到 FATAL 日志: ', SUBSTRING(message, 1, 200)) AS message,
    CONCAT('rule-fatal-detected:', COALESCE(event_id, id)) AS fingerprint,
    'flink.alert-rule-matching' AS generator,
    MAP['service', COALESCE(service, 'unknown'), 'source', source, 'log_id', COALESCE(event_id, id)] AS labels,
    MAP['summary', '致命错误检测', 'runbook', 'stream/flink/jobs/sql/alert-rule-matching.sql'] AS annotations,
    ARRAY[COALESCE(event_id, id)] AS source_logs,
    CAST(NULL AS BIGINT) AS resolved_at,
    tenant_id
FROM parsed_logs
WHERE `level` = 'FATAL';

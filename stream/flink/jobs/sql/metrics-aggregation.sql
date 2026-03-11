SET 'table.local-time-zone' = 'UTC';
SET 'table.dml-sync' = 'false';
SET 'pipeline.name' = 'nexuslog-stream-metrics-aggregation';

CREATE TABLE parsed_log_source (
    id STRING,
    event_id STRING,
    `timestamp` BIGINT,
    `level` STRING,
    source STRING,
    service STRING,
    tenant_id STRING,
    event_time AS TO_TIMESTAMP_LTZ(`timestamp`, 3),
    WATERMARK FOR event_time AS event_time - INTERVAL '5' SECOND
) WITH (
    'connector' = 'kafka',
    'topic' = 'nexuslog.logs.parsed',
    'properties.bootstrap.servers' = 'kafka:9092',
    'properties.group.id' = 'flink-metrics-aggregation',
    'format' = 'avro-confluent',
    'avro-confluent.url' = 'http://schema-registry:8081',
    'scan.startup.mode' = 'latest-offset'
);

CREATE TABLE metrics_sink (
    window_start BIGINT,
    window_end BIGINT,
    source STRING,
    `level` STRING,
    log_count BIGINT,
    error_rate DOUBLE,
    tenant_id STRING
) WITH (
    'connector' = 'kafka',
    'topic' = 'nexuslog.metrics.aggregated',
    'properties.bootstrap.servers' = 'kafka:9092',
    'format' = 'avro-confluent',
    'avro-confluent.url' = 'http://schema-registry:8081'
);

INSERT INTO metrics_sink
SELECT
    CAST(UNIX_TIMESTAMP(CAST(TUMBLE_START(event_time, INTERVAL '1' MINUTE) AS STRING)) * 1000 AS BIGINT) AS window_start,
    CAST(UNIX_TIMESTAMP(CAST(TUMBLE_END(event_time, INTERVAL '1' MINUTE) AS STRING)) * 1000 AS BIGINT) AS window_end,
    source,
    `level`,
    COUNT(*) AS log_count,
    CAST(SUM(CASE WHEN `level` IN ('ERROR', 'FATAL') THEN 1 ELSE 0 END) AS DOUBLE) / COUNT(*) AS error_rate,
    tenant_id
FROM parsed_log_source
GROUP BY
    TUMBLE(event_time, INTERVAL '1' MINUTE),
    source,
    `level`,
    tenant_id;

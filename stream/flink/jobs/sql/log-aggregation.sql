SET 'table.local-time-zone' = 'UTC';
SET 'table.dml-sync' = 'false';
SET 'pipeline.name' = 'nexuslog-stream-log-aggregation';

CREATE TABLE log_source (
    id STRING,
    event_id STRING,
    source STRING,
    `level` STRING,
    message STRING,
    `timestamp` BIGINT,
    service STRING,
    tags MAP<STRING, STRING>,
    tenant_id STRING,
    event_time AS TO_TIMESTAMP_LTZ(`timestamp`, 3),
    WATERMARK FOR event_time AS event_time - INTERVAL '5' SECOND
) WITH (
    'connector' = 'kafka',
    'topic' = 'nexuslog.logs.parsed',
    'properties.bootstrap.servers' = 'kafka:9092',
    'properties.group.id' = 'flink-log-aggregation',
    'format' = 'avro-confluent',
    'avro-confluent.url' = 'http://schema-registry:8081',
    'scan.startup.mode' = 'latest-offset'
);

CREATE TABLE log_aggregation_sink (
    window_start TIMESTAMP(3),
    window_end TIMESTAMP(3),
    source STRING,
    `level` STRING,
    service STRING,
    log_count BIGINT,
    tenant_id STRING,
    PRIMARY KEY (window_start, source, `level`) NOT ENFORCED
) WITH (
    'connector' = 'elasticsearch-7',
    'hosts' = 'http://elasticsearch:9200',
    'index' = 'nexuslog-log-aggregation'
);

INSERT INTO log_aggregation_sink
SELECT
    TUMBLE_START(event_time, INTERVAL '1' MINUTE) AS window_start,
    TUMBLE_END(event_time, INTERVAL '1' MINUTE) AS window_end,
    source,
    `level`,
    service,
    COUNT(*) AS log_count,
    tenant_id
FROM log_source
GROUP BY
    TUMBLE(event_time, INTERVAL '1' MINUTE),
    source,
    `level`,
    service,
    tenant_id;

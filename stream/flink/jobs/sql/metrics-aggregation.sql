-- NexusLog Flink SQL 作业：指标聚合
-- 按多维度聚合日志指标，输出到 nexuslog.metrics.aggregated Topic

-- 定义 Kafka 源表（解析后日志）
CREATE TABLE parsed_log_source (
    log_id STRING,
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

-- 定义指标聚合输出表
CREATE TABLE metrics_sink (
    window_start BIGINT,
    window_end BIGINT,
    source STRING,
    `level` STRING,
    log_count BIGINT,
    error_rate DOUBLE,
    tenant_id STRING,
    PRIMARY KEY (window_start, source, `level`) NOT ENFORCED
) WITH (
    'connector' = 'kafka',
    'topic' = 'nexuslog.metrics.aggregated',
    'properties.bootstrap.servers' = 'kafka:9092',
    'format' = 'avro-confluent',
    'avro-confluent.url' = 'http://schema-registry:8081'
);

-- 按 1 分钟窗口、来源、级别聚合，并计算错误率
INSERT INTO metrics_sink
SELECT
    UNIX_TIMESTAMP(CAST(TUMBLE_START(event_time, INTERVAL '1' MINUTE) AS STRING)) * 1000 AS window_start,
    UNIX_TIMESTAMP(CAST(TUMBLE_END(event_time, INTERVAL '1' MINUTE) AS STRING)) * 1000 AS window_end,
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

-- NexusLog Flink SQL 作业：日志聚合
-- 实时聚合日志数据，按时间窗口统计日志量、错误率等指标
-- 数据源: nexuslog.logs.parsed (解析后日志)
-- 输出: Elasticsearch 索引 nexuslog-log-aggregation

-- 定义 Kafka 源表（使用 Schema Registry 的 Avro 格式）
CREATE TABLE log_source (
    log_id STRING,
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

-- 定义 Elasticsearch 结果表
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

-- 按 1 分钟滚动窗口聚合，按来源、级别、服务分组
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

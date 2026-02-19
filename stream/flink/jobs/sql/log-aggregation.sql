-- NexusLog Flink SQL 作业：日志聚合
-- 实时聚合日志数据，按时间窗口统计日志量、错误率等指标

-- 定义 Kafka 源表
CREATE TABLE log_source (
    log_id STRING,
    source STRING,
    level STRING,
    message STRING,
    timestamp_ms BIGINT,
    tags MAP<STRING, STRING>,
    event_time AS TO_TIMESTAMP_LTZ(timestamp_ms, 3),
    WATERMARK FOR event_time AS event_time - INTERVAL '5' SECOND
) WITH (
    'connector' = 'kafka',
    'topic' = 'nexuslog-raw-logs',
    'properties.bootstrap.servers' = 'kafka:9092',
    'properties.group.id' = 'flink-log-aggregation',
    'format' = 'json',
    'scan.startup.mode' = 'latest-offset'
);

-- 定义 Elasticsearch 结果表
CREATE TABLE log_aggregation_sink (
    window_start TIMESTAMP(3),
    window_end TIMESTAMP(3),
    source STRING,
    level STRING,
    log_count BIGINT,
    PRIMARY KEY (window_start, source, level) NOT ENFORCED
) WITH (
    'connector' = 'elasticsearch-7',
    'hosts' = 'http://elasticsearch:9200',
    'index' = 'nexuslog-log-aggregation'
);

-- 按 1 分钟滚动窗口聚合
INSERT INTO log_aggregation_sink
SELECT
    TUMBLE_START(event_time, INTERVAL '1' MINUTE) AS window_start,
    TUMBLE_END(event_time, INTERVAL '1' MINUTE) AS window_end,
    source,
    level,
    COUNT(*) AS log_count
FROM log_source
GROUP BY
    TUMBLE(event_time, INTERVAL '1' MINUTE),
    source,
    level;

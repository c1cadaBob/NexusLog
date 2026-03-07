-- NexusLog Flink SQL 作业：日志聚合（直接从原始日志读取）
-- 实时聚合日志数据，按时间窗口统计日志量、错误率等指标
-- 数据源: nexuslog.logs.raw (原始文本)
-- 输出: Elasticsearch 索引 nexuslog-logs-v2

-- 定义 Kafka 源表（原始日志，使用 JSON 格式解析）
CREATE TABLE raw_log_source (
    message STRING,
    `timestamp` STRING
) WITH (
    'connector' = 'kafka',
    'topic' = 'nexuslog.logs.raw',
    'properties.bootstrap.servers' = 'kafka:9092',
    'properties.group.id' = 'flink-log-aggregation',
    'format' = 'csv',
    'csv.field-delimiter' = '|',
    'csv.ignore-parse-errors' = 'true',
    'scan.startup.mode' = 'earliest-offset'
);

-- 定义 Elasticsearch 结果表（直接写入主索引）
CREATE TABLE es_log_sink (
    log_id STRING,
    `timestamp` TIMESTAMP(3),
    ingested_at BIGINT,
    `level` STRING,
    source STRING,
    service STRING,
    message STRING,
    raw_log STRING,
    tenant_id STRING,
    PRIMARY KEY (log_id) NOT ENFORCED
) WITH (
    'connector' = 'elasticsearch-7',
    'hosts' = 'http://elasticsearch:9200',
    'index' = 'nexuslog-logs-v2'
);

-- 解析原始日志并写入 ES
-- 原始格式示例: 2025-12-21 12:53:27 /usr/bin/kdumpctl@675: message
INSERT INTO es_log_sink
SELECT
    MD5(CONCAT(CAST(NOW() AS STRING), message)) AS log_id,
    CURRENT_TIMESTAMP AS `timestamp`,
    UNIX_TIMESTAMP() * 1000 AS ingested_at,
    CASE
        WHEN UPPER(message) LIKE '%FATAL%' THEN 'FATAL'
        WHEN UPPER(message) LIKE '%ERROR%' THEN 'ERROR'
        WHEN UPPER(message) LIKE '%WARN%' THEN 'WARNING'
        WHEN UPPER(message) LIKE '%INFO%' THEN 'INFO'
        WHEN UPPER(message) LIKE '%DEBUG%' THEN 'DEBUG'
        ELSE 'INFO'
    END AS `level`,
    'collector-agent' AS source,
    'unknown' AS service,
    SUBSTRING(message, 1, 5000) AS message,
    message AS raw_log,
    'default' AS tenant_id
FROM raw_log_source;

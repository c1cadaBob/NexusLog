-- NexusLog Flink SQL 作业：日志解析
-- 将原始文本日志解析为结构化 JSON 数据
-- 数据源: nexuslog.logs.raw (原始文本)
-- 输出: nexuslog.logs.parsed (JSON 格式)

-- 定义 Kafka 源表（原始文本日志）
CREATE TABLE raw_log_source (
    message STRING
) WITH (
    'connector' = 'kafka',
    'topic' = 'nexuslog.logs.raw',
    'properties.bootstrap.servers' = 'kafka:9092',
    'properties.group.id' = 'flink-log-parser',
    'format' = 'raw',
    'scan.startup.mode' = 'earliest-offset'
);

-- 定义解析后日志输出表（使用 JSON 格式）
CREATE TABLE parsed_log_sink (
    log_id STRING,
    `timestamp` BIGINT,
    ingested_at BIGINT,
    `level` STRING,
    source STRING,
    service STRING,
    message STRING,
    raw_log STRING,
    fields MAP<STRING, STRING>,
    tags MAP<STRING, STRING>,
    trace_id STRING,
    tenant_id STRING
) WITH (
    'connector' = 'kafka',
    'topic' = 'nexuslog.logs.parsed',
    'properties.bootstrap.servers' = 'kafka:9092',
    'format' = 'json',
    'json.fail-on-missing-field' = 'false',
    'json.ignore-parse-errors' = 'true'
);

-- 日志解析逻辑
-- 支持格式: 2026-03-07 14:46:26 [ERROR] message 或 2026-03-07T14:46:26Z ERROR message
INSERT INTO parsed_log_sink
SELECT
    MD5(CONCAT(CAST(NOW() AS STRING), CAST(RAND() * 10000 AS STRING))) AS log_id,
    UNIX_TIMESTAMP() * 1000 AS `timestamp`,
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
    message AS message,
    message AS raw_log,
    MAP[] AS fields,
    MAP[] AS tags,
    '' AS trace_id,
    'default' AS tenant_id
FROM raw_log_source;

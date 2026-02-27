-- NexusLog Flink SQL 作业：告警规则匹配
-- 基于解析后的日志数据，匹配预定义的告警规则并生成告警事件

-- 定义 Kafka 源表（解析后日志）
CREATE TABLE parsed_logs (
    log_id STRING,
    `timestamp` BIGINT,
    ingested_at BIGINT,
    `level` STRING,
    source STRING,
    service STRING,
    message STRING,
    fields MAP<STRING, STRING>,
    tags MAP<STRING, STRING>,
    trace_id STRING,
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

-- 定义告警事件输出表
CREATE TABLE alert_events (
    id STRING,
    rule_id STRING,
    rule_name STRING,
    severity STRING,
    status STRING,
    triggered_at BIGINT,
    message STRING,
    labels MAP<STRING, STRING>,
    source_logs ARRAY<STRING>,
    tenant_id STRING,
    PRIMARY KEY (id) NOT ENFORCED
) WITH (
    'connector' = 'kafka',
    'topic' = 'nexuslog.alerts.events',
    'properties.bootstrap.servers' = 'kafka:9092',
    'format' = 'avro-confluent',
    'avro-confluent.url' = 'http://schema-registry:8081'
);

-- 规则 1: 1 分钟内 ERROR 日志超过 50 条触发 WARNING 告警
INSERT INTO alert_events
SELECT
    UUID() AS id,
    'rule-error-rate-high' AS rule_id,
    '错误率过高' AS rule_name,
    'WARNING' AS severity,
    'FIRING' AS status,
    UNIX_TIMESTAMP() * 1000 AS triggered_at,
    CONCAT('服务 ', service, ' 在 1 分钟内产生 ', CAST(error_count AS STRING), ' 条 ERROR 日志') AS message,
    MAP['service', service, 'source', source] AS labels,
    ARRAY[''] AS source_logs,
    tenant_id
FROM (
    SELECT
        service,
        source,
        tenant_id,
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

-- 规则 2: 1 分钟内 FATAL 日志出现即触发 CRITICAL 告警
INSERT INTO alert_events
SELECT
    UUID() AS id,
    'rule-fatal-detected' AS rule_id,
    '致命错误检测' AS rule_name,
    'CRITICAL' AS severity,
    'FIRING' AS status,
    UNIX_TIMESTAMP() * 1000 AS triggered_at,
    CONCAT('服务 ', COALESCE(service, 'unknown'), ' 检测到 FATAL 日志: ', SUBSTRING(message, 1, 200)) AS message,
    MAP['service', COALESCE(service, 'unknown'), 'source', source, 'log_id', log_id] AS labels,
    ARRAY[log_id] AS source_logs,
    tenant_id
FROM parsed_logs
WHERE `level` = 'FATAL';

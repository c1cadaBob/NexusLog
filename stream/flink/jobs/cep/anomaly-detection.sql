-- NexusLog Flink CEP 作业：异常检测
-- 使用 MATCH_RECOGNIZE 进行复杂事件处理，检测日志异常模式
-- 数据源: nexuslog.logs.parsed (解析后日志)
-- 输出: nexuslog.alerts.events (告警事件 Topic)

-- 定义 Kafka 源表（使用 Schema Registry 的 Avro 格式）
CREATE TABLE log_events (
    log_id STRING,
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
    'properties.group.id' = 'flink-cep-anomaly',
    'format' = 'avro-confluent',
    'avro-confluent.url' = 'http://schema-registry:8081',
    'scan.startup.mode' = 'latest-offset'
);

-- 定义告警输出表（写入告警事件 Topic）
CREATE TABLE anomaly_alerts (
    alert_id STRING,
    source STRING,
    pattern_type STRING,
    first_error_time TIMESTAMP(3),
    last_error_time TIMESTAMP(3),
    error_count BIGINT,
    detected_at TIMESTAMP(3),
    tenant_id STRING,
    PRIMARY KEY (alert_id) NOT ENFORCED
) WITH (
    'connector' = 'kafka',
    'topic' = 'nexuslog.alerts.events',
    'properties.bootstrap.servers' = 'kafka:9092',
    'format' = 'json'
);

-- CEP 模式：5 分钟内同一来源连续出现 5 次以上 ERROR 级别日志
INSERT INTO anomaly_alerts
SELECT *
FROM log_events
MATCH_RECOGNIZE (
    PARTITION BY source
    ORDER BY event_time
    MEASURES
        UUID() AS alert_id,
        A.source AS source,
        'consecutive_errors' AS pattern_type,
        FIRST(A.event_time) AS first_error_time,
        LAST(A.event_time) AS last_error_time,
        COUNT(A.log_id) AS error_count,
        CURRENT_TIMESTAMP AS detected_at,
        FIRST(A.tenant_id) AS tenant_id
    ONE ROW PER MATCH
    AFTER MATCH SKIP PAST LAST ROW
    PATTERN (A{5,}) WITHIN INTERVAL '5' MINUTE
    DEFINE
        A AS A.`level` = 'ERROR'
) AS T;

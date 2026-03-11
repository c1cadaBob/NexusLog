-- NexusLog Flink SQL 作业：日志解析
-- 数据源: nexuslog.logs.raw (Avro / Confluent Schema Registry)
-- 输出: nexuslog.logs.parsed (Avro / Confluent Schema Registry)

SET 'table.dml-sync' = 'false';
SET 'pipeline.name' = 'nexuslog-stream-log-parser';

CREATE TABLE raw_log_source (
    id STRING,
    `timestamp` BIGINT,
    source STRING,
    source_type STRING NOT NULL,
    content STRING,
    tags MAP<STRING, STRING>,
    agent_id STRING,
    event_id STRING,
    dedupe_key STRING,
    source_path STRING,
    source_collect_path STRING,
    `offset` BIGINT,
    file_inode BIGINT,
    file_dev BIGINT,
    host STRING,
    host_ip STRING,
    agent_ip STRING,
    server_id STRING,
    batch_id STRING,
    tenant_id STRING,
    event_time AS TO_TIMESTAMP_LTZ(`timestamp`, 3),
    WATERMARK FOR event_time AS event_time - INTERVAL '5' SECOND
) WITH (
    'connector' = 'kafka',
    'topic' = 'nexuslog.logs.raw',
    'properties.bootstrap.servers' = 'kafka:9092',
    'properties.group.id' = 'flink-log-parser-v8',
    'scan.startup.mode' = 'latest-offset',
    'format' = 'avro-confluent',
    'avro-confluent.url' = 'http://schema-registry:8081'
);

CREATE TABLE parsed_log_sink (
    id STRING,
    event_id STRING,
    `timestamp` BIGINT,
    ingested_at BIGINT,
    `level` STRING NOT NULL,
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
    tenant_id STRING
) WITH (
    'connector' = 'kafka',
    'topic' = 'nexuslog.logs.parsed',
    'properties.bootstrap.servers' = 'kafka:9092',
    'format' = 'avro-confluent',
    'avro-confluent.url' = 'http://schema-registry:8081'
);

INSERT INTO parsed_log_sink
SELECT
    COALESCE(event_id, id) AS id,
    event_id,
    `timestamp`,
    CAST(UNIX_TIMESTAMP(CAST(CURRENT_TIMESTAMP AS STRING)) * 1000 AS BIGINT) AS ingested_at,
    CASE
        WHEN UPPER(COALESCE(tags['level'], content)) LIKE '%FATAL%' THEN 'FATAL'
        WHEN UPPER(COALESCE(tags['level'], content)) LIKE '%ERROR%' THEN 'ERROR'
        WHEN UPPER(COALESCE(tags['level'], content)) LIKE '%WARN%' THEN 'WARN'
        WHEN UPPER(COALESCE(tags['level'], content)) LIKE '%DEBUG%' THEN 'DEBUG'
        WHEN UPPER(COALESCE(tags['level'], content)) LIKE '%TRACE%' THEN 'TRACE'
        ELSE 'INFO'
    END AS `level`,
    source,
    NULLIF(COALESCE(tags['service.name'], tags['service'], tags['service_name'], ''), '') AS service,
    NULLIF(COALESCE(tags['stream'], tags['source.stream'], tags['transport.channel'], ''), '') AS `stream`,
    content AS message,
    MAP[
        'source_type', COALESCE(source_type, ''),
        'agent_id', COALESCE(agent_id, ''),
        'source_path', COALESCE(source_path, ''),
        'source_collect_path', COALESCE(source_collect_path, ''),
        'batch_id', COALESCE(batch_id, ''),
        'host_ip', COALESCE(host_ip, '')
    ] AS fields,
    MAP[
        'agent_id', COALESCE(agent_id, ''),
        'source_type', COALESCE(source_type, ''),
        'source_path', COALESCE(source_path, ''),
        'source_collect_path', COALESCE(source_collect_path, ''),
        'offset', COALESCE(CAST(`offset` AS STRING), ''),
        'file_inode', COALESCE(CAST(file_inode AS STRING), ''),
        'file_dev', COALESCE(CAST(file_dev AS STRING), ''),
        'host', COALESCE(host, ''),
        'host.ip', COALESCE(host_ip, ''),
        'agent.ip', COALESCE(agent_ip, ''),
        'server_id', COALESCE(server_id, ''),
        'batch_id', COALESCE(batch_id, ''),
        'dedupe_key', COALESCE(dedupe_key, ''),
        'delivery.mode', COALESCE(tags['delivery.mode'], ''),
        'transport.channel', COALESCE(tags['transport.channel'], ''),
        'schema_version', 'log-raw/v1'
    ] AS attributes,
    tags,
    'log-parsed/v1' AS schema_version,
    'parsed' AS parse_status,
    NULLIF(COALESCE(tags['trace.id'], tags['trace_id'], ''), '') AS trace_id,
    NULLIF(COALESCE(tags['span.id'], tags['span_id'], ''), '') AS span_id,
    tenant_id
FROM raw_log_source;

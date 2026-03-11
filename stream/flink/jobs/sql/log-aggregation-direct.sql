-- NexusLog Flink SQL 作业：日志入库（Stream canary）
-- 数据源: nexuslog.logs.parsed (Avro / Confluent Schema Registry)
-- 输出: Elasticsearch alias nexuslog-logs-write-stream

SET 'table.dml-sync' = 'false';
SET 'pipeline.name' = 'nexuslog-stream-log-aggregation-direct';

CREATE TABLE parsed_log_source (
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
    tenant_id STRING,
    event_time AS TO_TIMESTAMP_LTZ(`timestamp`, 3),
    WATERMARK FOR event_time AS event_time - INTERVAL '5' SECOND
) WITH (
    'connector' = 'kafka',
    'topic' = 'nexuslog.logs.parsed',
    'properties.bootstrap.servers' = 'kafka:9092',
    'properties.group.id' = 'flink-log-stream-canary-v8',
    'scan.startup.mode' = 'latest-offset',
    'format' = 'avro-confluent',
    'avro-confluent.url' = 'http://schema-registry:8081'
);

CREATE TABLE es_log_sink (
    event_id STRING,
    source_collect_path STRING,
    batch_id STRING,
    schema_version STRING,
    tenant_id STRING,
    `@timestamp` TIMESTAMP(3),
    message STRING,
    event ROW<id STRING, record_id STRING, sequence BIGINT, original STRING, kind STRING, category ARRAY<STRING>, type ARRAY<STRING>, severity INT>,
    log ROW<level STRING, `offset` BIGINT, file ROW<path STRING, name STRING, directory STRING>>,
    source ROW<kind STRING, path STRING, `stream` STRING>,
    agent ROW<id STRING, version STRING, hostname STRING, ip STRING>,
    service ROW<name STRING, instance ROW<id STRING>, version STRING, environment STRING>,
    host ROW<name STRING, ip STRING>,
    trace ROW<id STRING>,
    span ROW<id STRING>,
    nexuslog ROW<
        transport ROW<batch_id STRING, channel STRING, compressed BOOLEAN, encrypted BOOLEAN>,
        ingest ROW<received_at TIMESTAMP(3), schema_version STRING, pipeline_version STRING, parse_status STRING, parse_rule STRING, retry_count INT>,
        governance ROW<tenant_id STRING, retention_policy STRING, pii_masked BOOLEAN, classification STRING>
    >,
    labels MAP<STRING, STRING>
) WITH (
    'connector' = 'elasticsearch-7',
    'hosts' = 'http://es-compat-proxy:9200',
    'index' = 'nexuslog-logs-write-stream'
);

INSERT INTO es_log_sink
SELECT
    COALESCE(event_id, id) AS event_id,
    NULLIF(COALESCE(attributes['source_collect_path'], fields['source_collect_path'], ''), '') AS source_collect_path,
    NULLIF(COALESCE(attributes['batch_id'], fields['batch_id'], ''), '') AS batch_id,
    COALESCE(schema_version, 'log-parsed/v1') AS schema_version,
    tenant_id,
    TO_TIMESTAMP_LTZ(`timestamp`, 3) AS `@timestamp`,
    message,
    ROW(
        COALESCE(event_id, id),
        id,
        CAST(0 AS BIGINT),
        message,
        'event',
        ARRAY['application'],
        ARRAY['log'],
        CASE
            WHEN UPPER(`level`) = 'TRACE' THEN 1
            WHEN UPPER(`level`) = 'DEBUG' THEN 3
            WHEN UPPER(`level`) = 'INFO' THEN 6
            WHEN UPPER(`level`) = 'WARN' THEN 9
            WHEN UPPER(`level`) = 'ERROR' THEN 13
            ELSE 17
        END
    ) AS event,
    ROW(
        LOWER(COALESCE(`level`, 'INFO')),
        COALESCE(TRY_CAST(attributes['offset'] AS BIGINT), CAST(0 AS BIGINT)),
        ROW(
            NULLIF(COALESCE(attributes['source_path'], source, ''), ''),
            CAST(NULL AS STRING),
            CAST(NULL AS STRING)
        )
    ) AS log,
    ROW(
        LOWER(COALESCE(attributes['source_type'], 'FILE')),
        NULLIF(COALESCE(attributes['source_path'], source, ''), ''),
        `stream`
    ) AS source,
    ROW(
        NULLIF(COALESCE(attributes['agent_id'], tags['agent_id'], ''), ''),
        CAST(NULL AS STRING),
        NULLIF(COALESCE(attributes['agent.hostname'], tags['agent.hostname'], attributes['host'], tags['host'], ''), ''),
        NULLIF(COALESCE(attributes['agent.ip'], tags['agent.ip'], ''), '')
    ) AS agent,
    ROW(
        service,
        ROW(CAST(NULL AS STRING)),
        CAST(NULL AS STRING),
        NULLIF(COALESCE(tags['env'], tags['service.environment'], ''), '')
    ) AS service,
    ROW(
        NULLIF(COALESCE(tags['host.name'], attributes['host'], tags['host'], ''), ''),
        NULLIF(COALESCE(attributes['host.ip'], fields['host_ip'], tags['host.ip'], attributes['agent.ip'], tags['agent.ip'], ''), '')
    ) AS host,
    ROW(trace_id) AS trace,
    ROW(span_id) AS span,
    ROW(
        ROW(
            NULLIF(COALESCE(attributes['batch_id'], fields['batch_id'], ''), ''),
            NULLIF(COALESCE(attributes['transport.channel'], tags['transport.channel'], ''), ''),
            FALSE,
            FALSE
        ),
        ROW(
            TO_TIMESTAMP_LTZ(ingested_at, 3),
            COALESCE(schema_version, 'log-parsed/v1'),
            'stream/flink/v1',
            COALESCE(parse_status, 'parsed'),
            CAST(NULL AS STRING),
            CAST(0 AS INT)
        ),
        ROW(
            tenant_id,
            CAST(NULL AS STRING),
            FALSE,
            CAST(NULL AS STRING)
        )
    ) AS nexuslog,
    tags AS labels
FROM parsed_log_source;

export interface RealtimeLogFields {
  event_id?: string;
  level?: string;
  timestamp?: string;
  source?: string;
  source_path?: string;
  source_internal?: string;
  agent_id?: string;
  batch_id?: string;
  collect_time?: string;
  sequence?: string | number;
  ingested_at?: string;
  schema_version?: string;
  pipeline_version?: string;
  tenant_id?: string;
  retention_policy?: string;
  pii_masked?: boolean | string;
  host?: string;
  host_ip?: string;
  server_id?: string;
  env?: string;
  region?: string;
  method?: string;
  statusCode?: number | string;
  traceId?: string;
  spanId?: string;
  service_name?: string;
  service_instance_id?: string;
  container_name?: string;
  error_type?: string;
  error_message?: string;
  raw_message?: string;
  raw_log?: string;
  userAgent?: string;
  message?: string;
}

export interface AggregatedLogEntryDetail {
  id: string;
  timestamp: string;
  message: string;
  rawLog?: string;
}

export interface AggregatedLogGroup {
  kind: 'image_asset_burst';
  count: number;
  summary: string;
  samplePaths: string[];
  entries: AggregatedLogEntryDetail[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  service: string;
  host: string;
  hostIp: string;
  message: string;
  fields?: RealtimeLogFields & Record<string, unknown>;
  /** 原始日志文本 */
  rawLog?: string;
  /** 前端展示层聚合结果，仅用于改善可读性 */
  aggregated?: AggregatedLogGroup;
}

export interface SavedQuery {
  id: string;
  name: string;
  query: string;
  tags: string[];
  createdAt: string;
}

export interface QueryHistory {
  id: string;
  query: string;
  executedAt: string;
  duration: number;
  resultCount: number;
}

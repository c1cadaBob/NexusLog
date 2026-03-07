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

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  service: string;
  message: string;
  fields?: RealtimeLogFields & Record<string, unknown>;
  /** 原始日志文本 */
  rawLog?: string;
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

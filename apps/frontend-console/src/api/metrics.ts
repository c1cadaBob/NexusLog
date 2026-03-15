/**
 * API functions for metrics and resource thresholds.
 * Uses same auth pattern as alert.ts (getRuntimeConfig, buildAuthHeaders with tenant/token).
 */

import { getRuntimeConfig } from '../config/runtime-config';
import { getAuthStorageItem } from '../utils/authStorage';

const TENANT_ID_KEY = 'nexuslog-tenant-id';

interface RuntimeConfigWithTenant {
  apiBaseUrl: string;
  tenantId?: string;
  tenantID?: string;
}

interface ApiEnvelope<TData> {
  code?: string;
  message?: string;
  data?: TData;
  meta?: Record<string, unknown>;
}

/** Time series point from metrics API */
export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

/** Server metrics response: map of metric name to time series */
export interface ServerMetricsData {
  cpu_usage_pct?: TimeSeriesPoint[];
  memory_usage_pct?: TimeSeriesPoint[];
  disk_usage_pct?: TimeSeriesPoint[];
}

/** Response from GET /api/v1/metrics/servers/:agent_id */
export interface FetchServerMetricsResponse {
  data: ServerMetricsData;
  from: string;
  to: string;
  range: string;
}

export interface MetricsOverviewSnapshot {
  agent_id: string;
  server_id: string;
  cpu_usage_pct: number;
  memory_usage_pct: number;
  disk_usage_pct: number;
  disk_io_read_bytes: number;
  disk_io_write_bytes: number;
  net_in_bytes: number;
  net_out_bytes: number;
  collected_at: string;
}

export interface MetricsOverviewTrendPoint {
  timestamp: string;
  active_agents: number;
  avg_cpu_usage_pct: number;
  avg_memory_usage_pct: number;
  avg_disk_usage_pct: number;
  total_net_in_bytes: number;
  total_net_out_bytes: number;
  net_in_delta_bytes: number;
  net_out_delta_bytes: number;
}

export interface MetricsOverviewData {
  active_agents: number;
  latest_collected_at: string;
  avg_cpu_usage_pct: number;
  avg_memory_usage_pct: number;
  avg_disk_usage_pct: number;
  total_disk_io_read_bytes: number;
  total_disk_io_write_bytes: number;
  total_net_in_bytes: number;
  total_net_out_bytes: number;
  latest_net_in_delta_bytes: number;
  latest_net_out_delta_bytes: number;
  snapshots: MetricsOverviewSnapshot[];
  trend: MetricsOverviewTrendPoint[];
}

export interface FetchMetricsOverviewResponse {
  data: MetricsOverviewData;
  from: string;
  to: string;
  range: string;
}

/** Report metrics payload for POST /api/v1/metrics/report */
export interface ReportMetricsPayload {
  agent_id: string;
  server_id: string;
  metrics: {
    cpu_usage_pct: number;
    memory_usage_pct: number;
    disk_usage_pct: number;
    disk_io_read_bytes?: number;
    disk_io_write_bytes?: number;
    net_in_bytes?: number;
    net_out_bytes?: number;
    collected_at?: string;
  };
}

/** Resource threshold from API */
export interface ResourceThreshold {
  id: string;
  tenant_id: string;
  agent_id?: string | null;
  metric_name: string;
  threshold_value: number;
  comparison: string;
  alert_severity: string;
  enabled: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  notification_channels?: unknown;
}

/** Create threshold payload */
export interface CreateResourceThresholdPayload {
  agent_id?: string | null;
  metric_name: string;
  threshold_value: number;
  comparison: '>' | '>=' | '<' | '<=';
  alert_severity?: string;
  enabled?: boolean;
  notification_channels?: unknown;
}

/** Update threshold payload (partial) */
export interface UpdateResourceThresholdPayload {
  agent_id?: string | null;
  metric_name?: string;
  threshold_value?: number;
  comparison?: '>' | '>=' | '<' | '<=';
  alert_severity?: string;
  enabled?: boolean;
  notification_channels?: unknown;
}

function normalizeApiBaseUrl(rawBaseUrl: string): string {
  const normalized = (rawBaseUrl || '/api/v1').trim();
  if (!normalized) return '/api/v1';
  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function resolveTenantId(config: RuntimeConfigWithTenant): string {
  const localTenant = window.localStorage.getItem(TENANT_ID_KEY)?.trim();
  if (localTenant) return localTenant;
  return (config.tenantId ?? config.tenantID ?? '').trim();
}

function resolveAccessToken(): string {
  return getAuthStorageItem('nexuslog-access-token')?.trim() ?? '';
}

function buildAuthHeaders(accessToken: string): Record<string, string> {
  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  const tenantId = resolveTenantId(runtimeConfig);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

function getMetricsBasePath(): string {
  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  const apiBaseUrl = normalizeApiBaseUrl(runtimeConfig.apiBaseUrl || '/api/v1');
  return `${apiBaseUrl}/metrics`;
}

function getResourceBasePath(): string {
  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  const apiBaseUrl = normalizeApiBaseUrl(runtimeConfig.apiBaseUrl || '/api/v1');
  return `${apiBaseUrl}/resource`;
}

async function requestMetricsApi<TData>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<TData> {
  const accessToken = resolveAccessToken();
  const basePath = getMetricsBasePath();
  const url = new URL(`${basePath}${path}`, window.location.origin);
  const query = options.query ?? {};
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });

  const response = await fetch(url.pathname + url.search, {
    method: options.method ?? 'GET',
    headers: buildAuthHeaders(accessToken),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const json = (await response.json().catch(() => null)) as TData | { code?: string; message?: string } | null;
  if (!response.ok) {
    const errMsg = (json && typeof json === 'object' && 'message' in json && json.message)
      ? String(json.message)
      : `metrics api request failed: HTTP ${response.status}`;
    const err = new Error(errMsg);
    (err as Error & { status?: number }).status = response.status;
    throw err;
  }
  return json as TData;
}

async function requestResourceApi<TData>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<ApiEnvelope<TData>> {
  const accessToken = resolveAccessToken();
  const basePath = getResourceBasePath();
  const url = new URL(`${basePath}${path}`, window.location.origin);
  const query = options.query ?? {};
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });

  const response = await fetch(url.pathname + url.search, {
    method: options.method ?? 'GET',
    headers: buildAuthHeaders(accessToken),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const envelope = (await response.json().catch(() => null)) as ApiEnvelope<TData> | null;
  if (!response.ok) {
    const err = new Error(envelope?.message ?? `resource api request failed: HTTP ${response.status}`);
    (err as Error & { status?: number; code?: string }).status = response.status;
    (err as Error & { status?: number; code?: string }).code = envelope?.code ?? 'RESOURCE_API_REQUEST_FAILED';
    throw err;
  }
  return envelope ?? { code: 'OK', message: 'success', data: undefined, meta: {} };
}

/** Fetch server metrics for an agent */
export async function fetchServerMetrics(
  agentId: string,
  range?: '1h' | '6h' | '24h' | '7d',
  metricName?: string,
): Promise<FetchServerMetricsResponse> {
  const query: Record<string, string> = {};
  if (range) query.range = range;
  if (metricName) query.metric_name = metricName;
  return requestMetricsApi<FetchServerMetricsResponse>(`/servers/${encodeURIComponent(agentId)}`, {
    method: 'GET',
    query,
  });
}

/** Fetch dashboard metrics overview */
export async function fetchMetricsOverview(
  range: '1h' | '6h' | '24h' | '7d' = '24h',
  limit = 4,
): Promise<FetchMetricsOverviewResponse> {
  return requestMetricsApi<FetchMetricsOverviewResponse>('/overview', {
    method: 'GET',
    query: { range, limit },
  });
}

/** Report metrics (agent-side) */
export async function reportMetrics(data: ReportMetricsPayload): Promise<void> {
  await requestMetricsApi<{ accepted?: boolean }>('/report', {
    method: 'POST',
    body: data,
  });
}

/** Fetch resource thresholds (paginated) */
export async function fetchResourceThresholds(params?: {
  agent_id?: string;
  page?: number;
  page_size?: number;
}): Promise<{ items: ResourceThreshold[]; total: number }> {
  const envelope = await requestResourceApi<{ items: ResourceThreshold[] }>('/thresholds', {
    method: 'GET',
    query: {
      agent_id: params?.agent_id ?? '',
      page: params?.page ?? 1,
      page_size: params?.page_size ?? 200,
    },
  });

  const items = envelope.data?.items ?? [];
  const total = Number(envelope.meta?.total ?? items.length);
  return { items, total };
}

/** Create resource threshold */
export async function createResourceThreshold(data: CreateResourceThresholdPayload): Promise<ResourceThreshold> {
  const envelope = await requestResourceApi<{ id: string }>('/thresholds', {
    method: 'POST',
    body: {
      agent_id: data.agent_id ?? null,
      metric_name: data.metric_name,
      threshold_value: data.threshold_value,
      comparison: data.comparison,
      alert_severity: data.alert_severity ?? 'warning',
      enabled: data.enabled ?? true,
      notification_channels: data.notification_channels ?? [],
    },
  });

  const id = envelope.data?.id;
  if (!id) {
    throw new Error('创建成功但未返回阈值 ID');
  }

  const result = await fetchResourceThresholds({ page_size: 200 });
  const created = result.items.find((t) => t.id === id);
  if (!created) {
    throw new Error('创建成功但无法获取阈值详情');
  }
  return created;
}

/** Update resource threshold */
export async function updateResourceThreshold(
  id: string,
  data: UpdateResourceThresholdPayload,
): Promise<ResourceThreshold> {
  await requestResourceApi<{ updated: boolean }>(`/thresholds/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: {
      ...(data.agent_id !== undefined && { agent_id: data.agent_id }),
      ...(data.metric_name !== undefined && { metric_name: data.metric_name }),
      ...(data.threshold_value !== undefined && { threshold_value: data.threshold_value }),
      ...(data.comparison !== undefined && { comparison: data.comparison }),
      ...(data.alert_severity !== undefined && { alert_severity: data.alert_severity }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
      ...(data.notification_channels !== undefined && { notification_channels: data.notification_channels }),
    },
  });

  const result = await fetchResourceThresholds({ page_size: 200 });
  const updated = result.items.find((t) => t.id === id);
  if (!updated) {
    throw new Error('更新成功但无法获取阈值详情');
  }
  return updated;
}

/** Delete resource threshold */
export async function deleteResourceThreshold(id: string): Promise<void> {
  await requestResourceApi<{ deleted: boolean }>(`/thresholds/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

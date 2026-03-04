import { getRuntimeConfig } from '../config/runtime-config';
import type { LogEntry, QueryHistory, SavedQuery } from '../types/log';

const ACCESS_TOKEN_KEY = 'nexuslog-access-token';
const TENANT_ID_KEY = 'nexuslog-tenant-id';

interface RuntimeConfigWithTenant {
  apiBaseUrl: string;
  tenantId?: string;
  tenantID?: string;
}

interface ApiEnvelope<TData> {
  code: string;
  message: string;
  request_id?: string;
  data?: TData;
  meta?: Record<string, unknown>;
}

interface QueryLogsApiHit {
  id?: string;
  timestamp?: string;
  level?: string;
  service?: string;
  message?: string;
  raw_log?: string;
  fields?: Record<string, unknown>;
}

interface QueryLogsApiData {
  hits?: QueryLogsApiHit[];
  aggregations?: Record<string, unknown>;
}

interface QueryHistoryApiItem {
  id?: string;
  query?: string;
  executed_at?: string;
  duration_ms?: number;
  result_count?: number;
}

interface SavedQueryApiItem {
  id?: string;
  name?: string;
  query?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  run_count?: number;
}

interface ListData<TItem> {
  items?: TItem[];
}

interface QueryLogsPayload {
  keywords: string;
  page: number;
  pageSize: number;
  filters?: Record<string, unknown>;
  timeRange?: {
    from?: string;
    to?: string;
  };
}

export interface QueryLogsResult {
  hits: LogEntry[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  queryTimeMS: number;
  timedOut: boolean;
  aggregations: Record<string, unknown>;
}

export interface QueryHistoryListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  from?: string;
  to?: string;
}

export interface QueryHistoryListResult {
  items: QueryHistory[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

export interface SavedQueryListParams {
  page: number;
  pageSize: number;
  tag?: string;
  keyword?: string;
}

export interface SavedQueryListResult {
  items: SavedQuery[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

export interface SavedQueryUpsertPayload {
  name: string;
  query: string;
  tags: string[];
  description?: string;
  filters?: Record<string, unknown>;
}

function normalizeApiBaseUrl(rawBaseUrl: string): string {
  const normalized = (rawBaseUrl || '/api/v1').trim();
  if (!normalized) {
    return '/api/v1';
  }
  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function resolveTenantId(config: RuntimeConfigWithTenant): string {
  const localTenant = window.localStorage.getItem(TENANT_ID_KEY)?.trim();
  if (localTenant) {
    return localTenant;
  }
  return (config.tenantId ?? config.tenantID ?? '').trim();
}

function normalizeLevel(rawLevel: unknown, message: unknown): LogEntry['level'] {
  const level = String(rawLevel ?? '').trim().toLowerCase();
  if (level === 'error') return 'error';
  if (level === 'warn' || level === 'warning') return 'warn';
  if (level === 'debug') return 'debug';
  if (level === 'info') return 'info';

  const text = String(message ?? '').toLowerCase();
  if (text.includes('error') || text.includes('panic') || text.includes('fatal') || text.includes('fail')) {
    return 'error';
  }
  if (text.includes('warn')) {
    return 'warn';
  }
  if (text.includes('debug')) {
    return 'debug';
  }
  return 'info';
}

function normalizeHit(hit: QueryLogsApiHit, index: number): LogEntry {
  const timestamp = String(hit.timestamp ?? '').trim() || new Date().toISOString();
  const message = String(hit.message ?? '').trim() || '(empty message)';
  const fields = hit.fields ?? {};
  const service = String(hit.service ?? fields['service'] ?? fields['agent_id'] ?? fields['source_id'] ?? 'unknown').trim() || 'unknown';

  return {
    id: String(hit.id ?? fields['record_id'] ?? `log-${index + 1}`).trim() || `log-${index + 1}`,
    timestamp,
    level: normalizeLevel(hit.level, message),
    service,
    message,
    rawLog: String(hit.raw_log ?? fields['raw_log'] ?? fields['data'] ?? message),
    fields,
  };
}

function normalizeQueryHistory(item: QueryHistoryApiItem, index: number): QueryHistory {
  return {
    id: String(item.id ?? `query-history-${index + 1}`),
    query: String(item.query ?? ''),
    executedAt: String(item.executed_at ?? new Date().toISOString()),
    duration: Number(item.duration_ms ?? 0),
    resultCount: Number(item.result_count ?? 0),
  };
}

function normalizeSavedQuery(item: SavedQueryApiItem, index: number): SavedQuery {
  const tags = Array.isArray(item.tags)
    ? item.tags
      .map((tag) => String(tag).trim())
      .filter(Boolean)
    : [];
  return {
    id: String(item.id ?? `saved-query-${index + 1}`),
    name: String(item.name ?? '未命名查询'),
    query: String(item.query ?? ''),
    tags,
    createdAt: String(item.created_at ?? new Date().toISOString()),
  };
}

function toPositiveNumber(raw: unknown, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function getQueryApiBasePath(): string {
  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  const apiBaseUrl = normalizeApiBaseUrl(runtimeConfig.apiBaseUrl || '/api/v1');
  return `${apiBaseUrl}/query`;
}

function buildAuthHeaders(): Record<string, string> {
  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  const tenantId = resolveTenantId(runtimeConfig);
  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY)?.trim();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

async function requestQueryApi<TData>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<ApiEnvelope<TData>> {
  const url = new URL(`${getQueryApiBasePath()}${path}`, window.location.origin);
  const query = options.query ?? {};
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    url.searchParams.set(key, String(value));
  });

  const response = await fetch(url.pathname + url.search, {
    method: options.method ?? 'GET',
    headers: buildAuthHeaders(),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const envelope = (await response.json().catch(() => null)) as ApiEnvelope<TData> | null;
  if (!response.ok) {
    throw new Error(envelope?.message ?? `query api request failed: HTTP ${response.status}`);
  }
  return envelope ?? {
    code: 'OK',
    message: 'success',
    data: undefined,
    meta: {},
  };
}

export async function queryRealtimeLogs(payload: QueryLogsPayload): Promise<QueryLogsResult> {
  const envelope = await requestQueryApi<QueryLogsApiData>('/logs', {
    method: 'POST',
    body: {
      keywords: payload.keywords.trim(),
      page: payload.page,
      page_size: payload.pageSize,
      filters: payload.filters ?? {},
      time_range: {
        from: payload.timeRange?.from ?? '',
        to: payload.timeRange?.to ?? '',
      },
      sort: [{ field: '@timestamp', order: 'desc' }],
    },
  });

  const hits = (envelope.data?.hits ?? []).map(normalizeHit);
  const total = Number(envelope.meta?.total ?? hits.length);
  const page = Number(envelope.meta?.page ?? payload.page);
  const pageSize = Number(envelope.meta?.page_size ?? payload.pageSize);
  const hasNext = Boolean(envelope.meta?.has_next ?? page * pageSize < total);
  const queryTimeMS = Number(envelope.meta?.query_time_ms ?? 0);
  const timedOut = Boolean(envelope.meta?.timed_out ?? false);

  return {
    hits,
    total: Number.isFinite(total) ? total : hits.length,
    page: Number.isFinite(page) ? page : payload.page,
    pageSize: Number.isFinite(pageSize) ? pageSize : payload.pageSize,
    hasNext,
    queryTimeMS: Number.isFinite(queryTimeMS) ? queryTimeMS : 0,
    timedOut,
    aggregations: envelope.data?.aggregations ?? {},
  };
}

export async function fetchQueryHistory(params: QueryHistoryListParams): Promise<QueryHistoryListResult> {
  const envelope = await requestQueryApi<ListData<QueryHistoryApiItem>>('/history', {
    method: 'GET',
    query: {
      page: params.page,
      page_size: params.pageSize,
      keyword: params.keyword?.trim(),
      from: params.from,
      to: params.to,
    },
  });
  const items = (envelope.data?.items ?? []).map(normalizeQueryHistory);
  const total = toPositiveNumber(envelope.meta?.total, items.length);
  const page = toPositiveNumber(envelope.meta?.page, params.page);
  const pageSize = toPositiveNumber(envelope.meta?.page_size, params.pageSize);
  return {
    items,
    total,
    page,
    pageSize,
    hasNext: Boolean(envelope.meta?.has_next ?? page * pageSize < total),
  };
}

export async function deleteQueryHistory(historyID: string): Promise<boolean> {
  const envelope = await requestQueryApi<{ deleted?: boolean }>(`/history/${encodeURIComponent(historyID)}`, {
    method: 'DELETE',
  });
  return Boolean(envelope.data?.deleted);
}

export async function fetchSavedQueries(params: SavedQueryListParams): Promise<SavedQueryListResult> {
  const envelope = await requestQueryApi<ListData<SavedQueryApiItem>>('/saved', {
    method: 'GET',
    query: {
      page: params.page,
      page_size: params.pageSize,
      tag: params.tag?.trim(),
      keyword: params.keyword?.trim(),
    },
  });
  const items = (envelope.data?.items ?? []).map(normalizeSavedQuery);
  const total = toPositiveNumber(envelope.meta?.total, items.length);
  const page = toPositiveNumber(envelope.meta?.page, params.page);
  const pageSize = toPositiveNumber(envelope.meta?.page_size, params.pageSize);
  return {
    items,
    total,
    page,
    pageSize,
    hasNext: Boolean(envelope.meta?.has_next ?? page * pageSize < total),
  };
}

export async function createSavedQuery(payload: SavedQueryUpsertPayload): Promise<SavedQuery> {
  const envelope = await requestQueryApi<{ item?: SavedQueryApiItem; saved_query_id?: string }>('/saved', {
    method: 'POST',
    body: {
      name: payload.name,
      query: payload.query,
      tags: payload.tags,
      description: payload.description ?? '',
      filters: payload.filters ?? {},
    },
  });
  const item = envelope.data?.item ?? {
    id: envelope.data?.saved_query_id,
    name: payload.name,
    query: payload.query,
    tags: payload.tags,
    created_at: new Date().toISOString(),
  };
  return normalizeSavedQuery(item, 0);
}

export async function updateSavedQuery(savedQueryID: string, payload: SavedQueryUpsertPayload): Promise<SavedQuery> {
  const envelope = await requestQueryApi<{ item?: SavedQueryApiItem }>(`/saved/${encodeURIComponent(savedQueryID)}`, {
    method: 'PUT',
    body: {
      name: payload.name,
      query: payload.query,
      tags: payload.tags,
      description: payload.description ?? '',
      filters: payload.filters ?? {},
    },
  });
  const item = envelope.data?.item ?? {
    id: savedQueryID,
    name: payload.name,
    query: payload.query,
    tags: payload.tags,
    created_at: new Date().toISOString(),
  };
  return normalizeSavedQuery(item, 0);
}

export async function deleteSavedQuery(savedQueryID: string): Promise<boolean> {
  const envelope = await requestQueryApi<{ deleted?: boolean }>(`/saved/${encodeURIComponent(savedQueryID)}`, {
    method: 'DELETE',
  });
  return Boolean(envelope.data?.deleted);
}

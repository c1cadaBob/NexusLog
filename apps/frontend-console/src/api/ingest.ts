/**
 * API functions for ingest management (pull-sources).
 * Uses same auth pattern as query.ts (getRuntimeConfig, buildAuthHeaders with tenant/token).
 */

import { getRuntimeConfig } from '../config/runtime-config';

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

/** PullSource from backend API */
export interface PullSource {
  source_id: string;
  name: string;
  host: string;
  port: number;
  protocol: string;
  path: string;
  auth: string;
  agent_base_url?: string;
  pull_interval_sec: number;
  pull_timeout_sec: number;
  key_ref?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

/** Create pull source payload */
export interface CreatePullSourcePayload {
  name: string;
  host: string;
  port: number;
  protocol: string;
  path: string;
  auth?: string;
  agent_base_url?: string;
  pull_interval_sec?: number;
  pull_timeout_sec?: number;
  key_ref?: string;
  status?: string;
}

/** Update pull source payload (partial) */
export interface UpdatePullSourcePayload {
  name?: string;
  host?: string;
  port?: number;
  protocol?: string;
  path?: string;
  auth?: string;
  agent_base_url?: string;
  pull_interval_sec?: number;
  pull_timeout_sec?: number;
  key_ref?: string;
  status?: string;
}

interface ListPullSourcesData {
  items: PullSource[];
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
  return window.localStorage.getItem(ACCESS_TOKEN_KEY)?.trim() ?? '';
}

function buildAuthHeaders(accessToken: string): Record<string, string> {
  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  const tenantId = resolveTenantId(runtimeConfig);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

function getIngestApiBasePath(): string {
  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  const apiBaseUrl = normalizeApiBaseUrl(runtimeConfig.apiBaseUrl || '/api/v1');
  return `${apiBaseUrl}/ingest`;
}

async function requestIngestApi<TData>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<ApiEnvelope<TData>> {
  const accessToken = resolveAccessToken();
  const basePath = getIngestApiBasePath();
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
    const err = new Error(envelope?.message ?? `ingest api request failed: HTTP ${response.status}`);
    (err as Error & { status?: number; code?: string }).status = response.status;
    (err as Error & { status?: number; code?: string }).code = envelope?.code ?? 'INGEST_API_REQUEST_FAILED';
    throw err;
  }
  return envelope ?? { code: 'OK', message: 'success', data: undefined, meta: {} };
}

/** Fetch all pull sources (paginated, fetches all pages for full list) */
export async function fetchPullSources(params?: {
  page?: number;
  page_size?: number;
  status?: string;
}): Promise<PullSource[]> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 200;
  const status = params?.status?.trim() || '';

  const envelope = await requestIngestApi<ListPullSourcesData>('/pull-sources', {
    method: 'GET',
    query: { page, page_size: pageSize, ...(status ? { status } : {}) },
  });

  const items = envelope.data?.items ?? [];
  const total = Number(envelope.meta?.total ?? items.length);
  const hasNext = Boolean(envelope.meta?.has_next ?? page * pageSize < total);

  if (hasNext && items.length === pageSize) {
    const next = await fetchPullSources({ ...params, page: page + 1, page_size: pageSize });
    return [...items, ...next];
  }
  return items;
}

/** Create a new pull source */
export async function createPullSource(data: CreatePullSourcePayload): Promise<PullSource> {
  const envelope = await requestIngestApi<{ source_id: string; status: string }>('/pull-sources', {
    method: 'POST',
    body: {
      name: data.name,
      host: data.host,
      port: data.port,
      protocol: data.protocol,
      path: data.path,
      auth: data.auth ?? '',
      agent_base_url: data.agent_base_url ?? '',
      pull_interval_sec: data.pull_interval_sec ?? 30,
      pull_timeout_sec: data.pull_timeout_sec ?? 30,
      key_ref: data.key_ref ?? '',
      status: data.status ?? 'active',
    },
  });

  const sourceId = envelope.data?.source_id;
  if (!sourceId) {
    throw new Error('创建成功但未返回 source_id');
  }
  const all = await fetchPullSources();
  const created = all.find((s) => s.source_id === sourceId);
  if (!created) {
    throw new Error('创建成功但无法获取新采集源详情');
  }
  return created;
}

/** Update an existing pull source */
export async function updatePullSource(id: string, data: UpdatePullSourcePayload): Promise<PullSource> {
  await requestIngestApi<{ updated: boolean }>(`/pull-sources/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: data,
  });

  const all = await fetchPullSources();
  const updated = all.find((s) => s.source_id === id);
  if (!updated) {
    throw new Error('更新成功但无法获取采集源详情');
  }
  return updated;
}

/** Disable/delete a pull source (backend uses status=disabled; no DELETE endpoint) */
export async function deletePullSource(id: string): Promise<void> {
  await updatePullSource(id, { status: 'disabled' });
}

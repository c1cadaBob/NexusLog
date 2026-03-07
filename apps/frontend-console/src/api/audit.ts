/**
 * API functions for audit logs.
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
  code: string;
  message: string;
  request_id?: string;
  data?: TData;
  meta?: Record<string, unknown>;
}

/** Audit log item from API */
export interface AuditLogItem {
  id: string;
  tenant_id?: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  detail?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

/** Fetch audit logs params */
export interface FetchAuditLogsParams {
  user_id?: string;
  action?: string;
  resource_type?: string;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: string;
}

/** Fetch audit logs result */
export interface FetchAuditLogsResult {
  items: AuditLogItem[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
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

function getAuditApiBasePath(): string {
  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  const apiBaseUrl = normalizeApiBaseUrl(runtimeConfig.apiBaseUrl || '/api/v1');
  return `${apiBaseUrl}/audit`;
}

async function requestAuditApi<TData>(
  path: string,
  options: {
    method?: 'GET' | 'POST';
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<ApiEnvelope<TData>> {
  const accessToken = resolveAccessToken();
  const basePath = getAuditApiBasePath();
  const url = new URL(`${basePath}${path}`, window.location.origin);
  const query = options.query ?? {};
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });

  const response = await fetch(url.pathname + url.search, {
    method: options.method ?? 'GET',
    headers: buildAuthHeaders(accessToken),
  });

  const envelope = (await response.json().catch(() => null)) as ApiEnvelope<TData> | null;
  if (!response.ok) {
    const err = new Error(envelope?.message ?? `audit api request failed: HTTP ${response.status}`);
    (err as Error & { status?: number; code?: string }).status = response.status;
    (err as Error & { status?: number; code?: string }).code = envelope?.code ?? 'AUDIT_API_REQUEST_FAILED';
    throw err;
  }
  return envelope ?? { code: 'OK', message: 'success', data: undefined, meta: {} };
}

/** Fetch audit logs (paginated) */
export async function fetchAuditLogs(params: FetchAuditLogsParams = {}): Promise<FetchAuditLogsResult> {
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 20;

  const envelope = await requestAuditApi<{ items: AuditLogItem[] }>('/logs', {
    method: 'GET',
    query: {
      user_id: params.user_id,
      action: params.action,
      resource_type: params.resource_type,
      from: params.from,
      to: params.to,
      page,
      page_size: pageSize,
      sort_by: params.sort_by,
      sort_order: params.sort_order,
    },
  });

  const items = envelope.data?.items ?? [];
  const metaTotal = envelope.meta?.total;
  const total = typeof metaTotal === 'number' ? metaTotal : (typeof metaTotal === 'string' ? parseInt(metaTotal, 10) : items.length);
  const hasNext = envelope.meta?.has_next ?? (page * pageSize < total);

  return {
    items,
    total: Number.isFinite(total) ? total : items.length,
    page,
    pageSize,
    hasNext: Boolean(hasNext),
  };
}

/**
 * API functions for notification channels.
 * Uses same auth pattern as ingest.ts (getRuntimeConfig, buildAuthHeaders with tenant/token).
 */

import { getRuntimeConfig } from '../config/runtime-config';
import { getAuthStorageItem } from '../utils/authStorage';
import type { NotificationChannel, NotificationChannelType } from '../types/alert';

const TENANT_ID_KEY = 'nexuslog-tenant-id';
const NOTIFICATION_CHANNEL_CACHE_LIMIT = 24;

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

/** Backend channel response */
interface BackendChannel {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  enabled: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

interface FetchNotificationChannelsParams {
  page?: number;
  page_size?: number;
  force?: boolean;
}

const notificationChannelCache = new Map<string, NotificationChannel[]>();
const notificationChannelInFlight = new Map<string, Promise<NotificationChannel[]>>();

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

function getNotificationApiBasePath(): string {
  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  const apiBaseUrl = normalizeApiBaseUrl(runtimeConfig.apiBaseUrl || '/api/v1');
  return `${apiBaseUrl}/notification/channels`;
}

async function requestNotificationApi<TData>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<ApiEnvelope<TData>> {
  const accessToken = resolveAccessToken();
  const basePath = getNotificationApiBasePath();
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
    const err = new Error(envelope?.message ?? `notification api request failed: HTTP ${response.status}`);
    (err as Error & { status?: number; code?: string }).status = response.status;
    (err as Error & { status?: number; code?: string }).code = envelope?.code ?? 'NOTIFICATION_API_REQUEST_FAILED';
    throw err;
  }
  return envelope ?? { code: 'OK', message: 'success', data: undefined, meta: {} };
}

function mapBackendChannelToFrontend(c: BackendChannel): NotificationChannel {
  let config: Record<string, unknown> = {};
  if (typeof c.config === 'object') {
    config = c.config as Record<string, unknown>;
  } else if (typeof c.config === 'string') {
    try {
      config = JSON.parse(c.config) as Record<string, unknown>;
    } catch {
      config = {};
    }
  }

  const createdAt = c.created_at ? new Date(c.created_at).getTime() : Date.now();
  const updatedAt = c.updated_at ? new Date(c.updated_at).getTime() : Date.now();

  return {
    id: c.id,
    name: c.name,
    type: c.type as NotificationChannelType,
    config,
    enabled: c.enabled,
    createdAt,
    updatedAt,
  };
}

function buildNotificationChannelCacheKey(params?: FetchNotificationChannelsParams): string {
  return JSON.stringify({
    page: params?.page ?? 1,
    page_size: params?.page_size ?? 200,
  });
}

function cloneNotificationChannels(items: NotificationChannel[]): NotificationChannel[] {
  return items.map((item) => ({
    ...item,
    config: { ...(item.config ?? {}) },
  }));
}

function touchNotificationChannelCache(key: string): NotificationChannel[] | undefined {
  const cached = notificationChannelCache.get(key);
  if (!cached) {
    return undefined;
  }
  notificationChannelCache.delete(key);
  notificationChannelCache.set(key, cached);
  return cloneNotificationChannels(cached);
}

function setNotificationChannelCache(key: string, items: NotificationChannel[]): void {
  if (notificationChannelCache.has(key)) {
    notificationChannelCache.delete(key);
  }
  notificationChannelCache.set(key, cloneNotificationChannels(items));
  while (notificationChannelCache.size > NOTIFICATION_CHANNEL_CACHE_LIMIT) {
    const oldestKey = notificationChannelCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    notificationChannelCache.delete(oldestKey);
  }
}

export function invalidateNotificationChannelCache(): void {
  notificationChannelCache.clear();
  notificationChannelInFlight.clear();
}

/** Fetch all notification channels */
export async function fetchNotificationChannels(params?: FetchNotificationChannelsParams): Promise<NotificationChannel[]> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 200;
  const force = params?.force === true;
  const cacheKey = buildNotificationChannelCacheKey({ page, page_size: pageSize });

  if (!force) {
    const cached = touchNotificationChannelCache(cacheKey);
    if (cached) {
      return cached;
    }

    const inFlight = notificationChannelInFlight.get(cacheKey);
    if (inFlight) {
      return inFlight.then((items) => cloneNotificationChannels(items));
    }
  }

  const requestPromise = (async () => {
    const envelope = await requestNotificationApi<{ items: BackendChannel[] }>('', {
      method: 'GET',
      query: { page, page_size: pageSize },
    });

    const items = envelope.data?.items ?? [];
    const total = Number(envelope.meta?.total ?? items.length);
    const hasNext = Boolean(envelope.meta?.has_next ?? page * pageSize < total);

    let mappedItems = items.map(mapBackendChannelToFrontend);
    if (hasNext && items.length === pageSize) {
      const next = await fetchNotificationChannels({ page: page + 1, page_size: pageSize, force });
      mappedItems = [...mappedItems, ...next];
    }

    setNotificationChannelCache(cacheKey, mappedItems);
    return cloneNotificationChannels(mappedItems);
  })();

  notificationChannelInFlight.set(cacheKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    if (notificationChannelInFlight.get(cacheKey) === requestPromise) {
      notificationChannelInFlight.delete(cacheKey);
    }
  }
}

/** Create channel payload - config depends on type */
export interface CreateNotificationChannelPayload {
  name: string;
  type: 'email' | 'dingtalk' | 'sms';
  config: Record<string, unknown>;
  enabled?: boolean;
}

/** Create a new notification channel */
export async function createNotificationChannel(data: CreateNotificationChannelPayload): Promise<NotificationChannel> {
  const envelope = await requestNotificationApi<{ id: string; name: string; type: string; enabled: boolean }>('', {
    method: 'POST',
    body: {
      name: data.name,
      type: data.type,
      config: data.config,
      enabled: data.enabled ?? true,
    },
  });

  const id = envelope.data?.id;
  if (!id) {
    throw new Error('创建成功但未返回渠道 ID');
  }

  invalidateNotificationChannelCache();
  const all = await fetchNotificationChannels({ force: true });
  const created = all.find((c) => c.id === id);
  if (!created) {
    throw new Error('创建成功但无法获取渠道详情');
  }
  return created;
}

/** Update channel payload */
export interface UpdateNotificationChannelPayload {
  name?: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
}

/** Update an existing notification channel */
export async function updateNotificationChannel(
  id: string,
  data: UpdateNotificationChannelPayload,
): Promise<NotificationChannel> {
  await requestNotificationApi<BackendChannel>(`/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: data,
  });

  invalidateNotificationChannelCache();
  const all = await fetchNotificationChannels({ force: true });
  const updated = all.find((c) => c.id === id);
  if (!updated) {
    throw new Error('更新成功但无法获取渠道详情');
  }
  return updated;
}

/** Delete a notification channel */
export async function deleteNotificationChannel(id: string): Promise<void> {
  await requestNotificationApi<{ deleted: boolean }>(`/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  invalidateNotificationChannelCache();
}

/** Test a notification channel */
export async function testNotificationChannel(id: string, to?: string): Promise<{ sent: boolean }> {
  const envelope = await requestNotificationApi<{ sent: boolean; to?: string; type?: string }>(
    `/${encodeURIComponent(id)}/test`,
    {
      method: 'POST',
      body: to ? { to } : {},
    },
  );
  return { sent: envelope.data?.sent ?? false };
}

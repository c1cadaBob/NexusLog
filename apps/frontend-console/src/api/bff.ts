import { getRuntimeConfig } from '../config/runtime-config';
import { getAuthStorageItem } from '../utils/authStorage';

const TENANT_ID_KEY = 'nexuslog-tenant-id';

interface RuntimeConfigWithTenant {
  apiBaseUrl: string;
  tenantId?: string;
  tenantID?: string;
}

export interface BffServiceProbe {
  service: string;
  upstream: string;
  available: boolean;
  latencyMs: number;
  statusCode: number;
  status: string;
  details: string;
}

export interface BffOverviewResponse {
  generatedAt: string;
  services: {
    controlPlane: BffServiceProbe;
    apiService: BffServiceProbe;
    dataServices: {
      queryApi: BffServiceProbe;
      auditApi: BffServiceProbe;
      exportApi: BffServiceProbe;
    };
  };
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    availabilityRate: number;
  };
  cache: {
    hit: boolean;
    ttlMs: number;
  };
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

function getBffBasePath(): string {
  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  const apiBaseUrl = normalizeApiBaseUrl(runtimeConfig.apiBaseUrl || '/api/v1');
  return `${apiBaseUrl}/bff`;
}

async function requestBffApi<TData>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<TData> {
  const accessToken = resolveAccessToken();
  const basePath = getBffBasePath();
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

  const json = (await response.json().catch(() => null)) as TData | { message?: string } | null;
  if (!response.ok) {
    const err = new Error(
      json && typeof json === 'object' && 'message' in json && json.message
        ? String(json.message)
        : `bff api request failed: HTTP ${response.status}`,
    );
    (err as Error & { status?: number }).status = response.status;
    throw err;
  }
  return json as TData;
}

export async function fetchBffOverview(options: { refresh?: boolean } = {}): Promise<BffOverviewResponse> {
  return requestBffApi<BffOverviewResponse>('/overview', {
    method: 'GET',
    query: {
      refresh: options.refresh ? '1' : undefined,
    },
  });
}

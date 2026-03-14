import { getRuntimeConfig } from '../config/runtime-config';
import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  getAuthStorageItem,
  isEmergencyAccessToken,
} from '../utils/authStorage';

const TENANT_ID_KEY = 'nexuslog-tenant-id';

interface RuntimeConfigWithTenant {
  apiBaseUrl: string;
  tenantId?: string;
  tenantID?: string;
}

interface ApiEnvelope<TData> {
  code?: string;
  message?: string;
  request_id?: string;
  data?: TData;
}

interface LogoutResponseData {
  logged_out?: boolean;
}

function normalizeApiBaseUrl(rawBaseUrl: string): string {
  const normalized = (rawBaseUrl || '/api/v1').trim();
  if (!normalized) {
    return '/api/v1';
  }
  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function buildLogoutUrl(apiBaseUrl: string): string {
  return `${normalizeApiBaseUrl(apiBaseUrl)}/auth/logout`;
}

function resolveTenantId(config: RuntimeConfigWithTenant): string {
  const localTenant = window.localStorage.getItem(TENANT_ID_KEY)?.trim();
  if (localTenant) {
    return localTenant;
  }
  return (config.tenantId ?? config.tenantID ?? '').trim();
}

export async function revokeCurrentSession(): Promise<boolean> {
  const accessToken = getAuthStorageItem(ACCESS_TOKEN_KEY)?.trim() ?? '';
  const refreshToken = getAuthStorageItem(REFRESH_TOKEN_KEY)?.trim() ?? '';

  if (!refreshToken || !accessToken || isEmergencyAccessToken(accessToken)) {
    return false;
  }

  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
  const tenantId = resolveTenantId(runtimeConfig);
  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }

  const response = await fetch(buildLogoutUrl(runtimeConfig.apiBaseUrl || '/api/v1'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const body = (await response.json().catch(() => null)) as ApiEnvelope<LogoutResponseData> | null;
  if (!response.ok) {
    throw new Error(body?.message ?? `logout request failed: HTTP ${response.status}`);
  }

  return body?.data?.logged_out !== false;
}

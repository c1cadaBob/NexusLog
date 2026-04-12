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

export interface LoginPolicyIPWhitelistItem {
  ip: string;
  note: string;
}

export interface LoginPolicySettings {
  totpEnabled: boolean;
  smsEnabled: boolean;
  minLength: number;
  passwordExpiry: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  historyCheck: string;
  idleTimeout: number;
  maxConcurrentSessions: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  ipWhitelistEnabled: boolean;
  ipWhitelist: LoginPolicyIPWhitelistItem[];
}

export interface LoginPolicyResponse {
  settings: LoginPolicySettings;
  updated_at?: string;
  updated_by?: string;
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

function getLoginPolicyApiPath(): string {
  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  return `${normalizeApiBaseUrl(runtimeConfig.apiBaseUrl || '/api/v1')}/security/login-policy`;
}

async function requestLoginPolicyApi<TData>(method: 'GET' | 'PUT', body?: unknown): Promise<ApiEnvelope<TData>> {
  const accessToken = resolveAccessToken();
  const url = getLoginPolicyApiPath();
  const response = await fetch(url, {
    method,
    headers: buildAuthHeaders(accessToken),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const envelope = (await response.json().catch(() => null)) as ApiEnvelope<TData> | null;
  if (!response.ok) {
    const err = new Error(envelope?.message ?? `login policy request failed: HTTP ${response.status}`);
    (err as Error & { status?: number; code?: string }).status = response.status;
    (err as Error & { status?: number; code?: string }).code = envelope?.code ?? 'LOGIN_POLICY_REQUEST_FAILED';
    throw err;
  }
  return envelope ?? { code: 'OK', message: 'success', data: undefined, meta: {} };
}

export async function fetchLoginPolicy(): Promise<LoginPolicyResponse> {
  const envelope = await requestLoginPolicyApi<LoginPolicyResponse>('GET');
  if (!envelope.data?.settings) {
    throw new Error('登录策略响应为空');
  }
  return envelope.data;
}

export async function updateLoginPolicy(settings: LoginPolicySettings): Promise<LoginPolicyResponse> {
  const envelope = await requestLoginPolicyApi<LoginPolicyResponse>('PUT', { settings });
  if (!envelope.data?.settings) {
    throw new Error('保存成功但未返回登录策略');
  }
  return envelope.data;
}

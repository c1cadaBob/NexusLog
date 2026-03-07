/**
 * API functions for user and role management.
 * Uses same auth pattern as ingest.ts (getRuntimeConfig, tenant/token headers).
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

/** User from backend API */
export interface UserData {
  id: string;
  username: string;
  email: string;
  display_name: string;
  status: string;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
  roles?: RoleData[];
}

/** Role from backend API */
export interface RoleData {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

/** List users response */
export interface ListUsersResponse {
  users: UserData[];
  total: number;
  page: number;
  limit: number;
}

export interface FetchUsersParams {
  page?: number;
  pageSize?: number;
  query?: string;
  status?: string;
  roleId?: string;
}

export interface BatchUpdateUsersStatusResponse {
  requested: number;
  updated: number;
  status: string;
}

/** Create user payload */
export interface CreateUserPayload {
  username: string;
  password: string;
  email: string;
  display_name?: string;
  role_id?: string;
}

/** Update user payload */
export interface UpdateUserPayload {
  display_name?: string;
  email?: string;
  status?: string;
}

/** Current user response (GET /users/me) */
export interface GetMeResponse {
  user: UserData;
  roles: RoleData[];
  permissions: string[];
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

function getUserApiBasePath(): string {
  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  const apiBaseUrl = normalizeApiBaseUrl(runtimeConfig.apiBaseUrl || '/api/v1');
  return `${apiBaseUrl}/users`;
}

function getRolesApiBasePath(): string {
  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  const apiBaseUrl = normalizeApiBaseUrl(runtimeConfig.apiBaseUrl || '/api/v1');
  return `${apiBaseUrl}/roles`;
}

async function requestUserApi<TData>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<ApiEnvelope<TData>> {
  const accessToken = resolveAccessToken();
  const basePath = getUserApiBasePath();
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
    const err = new Error(envelope?.message ?? `user api request failed: HTTP ${response.status}`);
    (err as Error & { status?: number; code?: string }).status = response.status;
    (err as Error & { status?: number; code?: string }).code = envelope?.code ?? 'USER_API_REQUEST_FAILED';
    throw err;
  }
  return envelope ?? { code: 'OK', message: 'success', data: undefined, meta: {} };
}

async function requestRolesApi<TData>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<ApiEnvelope<TData>> {
  const accessToken = resolveAccessToken();
  const basePath = getRolesApiBasePath();
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
    const err = new Error(envelope?.message ?? `roles api request failed: HTTP ${response.status}`);
    (err as Error & { status?: number; code?: string }).status = response.status;
    (err as Error & { status?: number; code?: string }).code = envelope?.code ?? 'ROLES_API_REQUEST_FAILED';
    throw err;
  }
  return envelope ?? { code: 'OK', message: 'success', data: undefined, meta: {} };
}

/** Fetch users list (paginated) */
export async function fetchUsers(params: FetchUsersParams = {}): Promise<ListUsersResponse> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 10;
  const envelope = await requestUserApi<ListUsersResponse>('', {
    method: 'GET',
    query: {
      page,
      page_size: pageSize,
      query: params.query?.trim() || undefined,
      status: params.status || undefined,
      role_id: params.roleId || undefined,
    },
  });

  const data = envelope.data;
  return {
    users: data?.users ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? page,
    limit: data?.limit ?? pageSize,
  };
}

/** Fetch user detail */
export async function fetchUser(id: string): Promise<UserData> {
  const envelope = await requestUserApi<UserData>(`/${encodeURIComponent(id)}`, {
    method: 'GET',
  });

  const data = envelope.data;
  if (!data?.id) throw new Error('获取用户详情失败');
  return {
    ...data,
    roles: data.roles ?? [],
  };
}

/** Create user */
export async function createUser(data: CreateUserPayload): Promise<{ id: string; username: string }> {
  const envelope = await requestUserApi<{ id: string; username: string }>('', {
    method: 'POST',
    body: {
      username: data.username,
      password: data.password,
      email: data.email,
      display_name: data.display_name ?? '',
      role_id: data.role_id ?? undefined,
    },
  });

  const d = envelope.data;
  if (!d?.id) throw new Error('创建成功但未返回用户 ID');
  return { id: d.id, username: d.username ?? data.username };
}

/** Update user */
export async function updateUser(id: string, data: UpdateUserPayload): Promise<void> {
  await requestUserApi(`/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: data,
  });
}

/** Disable user (DELETE) */
export async function disableUser(id: string): Promise<void> {
  await requestUserApi(`/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/** Batch update users status */
export async function batchUpdateUsersStatus(userIds: string[], status: 'active' | 'disabled'): Promise<BatchUpdateUsersStatusResponse> {
  const envelope = await requestUserApi<BatchUpdateUsersStatusResponse>('/batch/status', {
    method: 'POST',
    body: {
      user_ids: userIds,
      status,
    },
  });

  const data = envelope.data;
  return {
    requested: data?.requested ?? userIds.length,
    updated: data?.updated ?? 0,
    status: data?.status ?? status,
  };
}

/** Assign role to user */
export async function assignRole(userId: string, roleId: string): Promise<void> {
  await requestUserApi(`/${encodeURIComponent(userId)}/roles`, {
    method: 'POST',
    body: { role_id: roleId },
  });
}

/** Remove role from user */
export async function removeRole(userId: string, roleId: string): Promise<void> {
  await requestUserApi(`/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`, {
    method: 'DELETE',
  });
}

/** Fetch roles list */
export async function fetchRoles(): Promise<RoleData[]> {
  const envelope = await requestRolesApi<{ roles: RoleData[] }>('', {
    method: 'GET',
  });

  const roles = envelope.data?.roles ?? [];
  return Array.isArray(roles) ? roles : [];
}

/** Fetch current user (me) */
export async function fetchCurrentUser(): Promise<GetMeResponse> {
  const envelope = await requestUserApi<GetMeResponse>('/me', {
    method: 'GET',
  });

  const data = envelope.data;
  if (!data?.user) throw new Error('获取当前用户失败');
  return {
    user: data.user,
    roles: data.roles ?? [],
    permissions: data.permissions ?? [],
  };
}

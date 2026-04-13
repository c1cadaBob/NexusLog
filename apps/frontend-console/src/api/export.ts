/**
 * API functions for export jobs and backup.
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

// ============================================================================
// Export API
// ============================================================================

function getExportApiBasePath(): string {
  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  const apiBaseUrl = normalizeApiBaseUrl(runtimeConfig.apiBaseUrl || '/api/v1');
  return `${apiBaseUrl}/export`;
}

async function requestExportApi<TData>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<ApiEnvelope<TData>> {
  const accessToken = resolveAccessToken();
  const basePath = getExportApiBasePath();
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
    const err = new Error(envelope?.message ?? `export api request failed: HTTP ${response.status}`);
    (err as Error & { status?: number; code?: string }).status = response.status;
    (err as Error & { status?: number; code?: string }).code = envelope?.code ?? 'EXPORT_API_REQUEST_FAILED';
    throw err;
  }
  return envelope ?? { code: 'OK', message: 'success', data: undefined, meta: {} };
}

export interface CreateExportJobParams {
  query_params: Record<string, unknown>;
  format: 'csv' | 'json';
}

/** Raw backend response (兼容 snake_case / camelCase / PascalCase) */
interface RawExportJobItem {
  id?: string;
  format?: string;
  status?: string;
  total_records?: number;
  file_path?: string;
  file_size_bytes?: number;
  error_message?: string;
  created_at?: string;
  completed_at?: string;
  expires_at?: string;
  ID?: string;
  Format?: string;
  Status?: string;
  TotalRecords?: number;
  FilePath?: string;
  FileSizeBytes?: number;
  ErrorMessage?: string;
  CreatedAt?: string;
  CompletedAt?: string;
  ExpiresAt?: string;
  totalRecords?: number;
  filePath?: string;
  fileSizeBytes?: number;
  errorMessage?: string;
  createdAt?: string;
  completedAt?: string;
  expiresAt?: string;
}

/** Normalized export job for frontend use */
export interface ExportJobItem {
  id: string;
  format: string;
  status: string;
  total_records?: number;
  file_path?: string;
  file_size_bytes?: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
  expires_at?: string;
}

function normalizeExportJob(raw: RawExportJobItem): ExportJobItem {
  return {
    id: raw.id ?? raw.ID ?? '',
    format: raw.format ?? raw.Format ?? 'csv',
    status: raw.status ?? raw.Status ?? 'pending',
    total_records: raw.total_records ?? raw.TotalRecords ?? raw.totalRecords,
    file_path: raw.file_path ?? raw.FilePath ?? raw.filePath,
    file_size_bytes: raw.file_size_bytes ?? raw.FileSizeBytes ?? raw.fileSizeBytes,
    error_message: raw.error_message ?? raw.ErrorMessage ?? raw.errorMessage,
    created_at: raw.created_at ?? raw.CreatedAt ?? raw.createdAt ?? '',
    completed_at: raw.completed_at ?? raw.CompletedAt ?? raw.completedAt,
    expires_at: raw.expires_at ?? raw.ExpiresAt ?? raw.expiresAt,
  };
}

/** Create export job */
export async function createExportJob(params: CreateExportJobParams): Promise<{ job_id: string; status: string }> {
  const envelope = await requestExportApi<{ job_id: string; status: string }>('/jobs', {
    method: 'POST',
    body: params,
  });
  const data = envelope.data;
  if (!data?.job_id) {
    throw new Error('创建成功但未返回任务 ID');
  }
  return { job_id: data.job_id, status: data.status ?? 'pending' };
}

/** Fetch export jobs (paginated) */
export async function fetchExportJobs(
  page: number = 1,
  pageSize: number = 20,
): Promise<{ items: ExportJobItem[]; total: number; page: number; pageSize: number }> {
  const envelope = await requestExportApi<{ items: RawExportJobItem[] }>('/jobs', {
    method: 'GET',
    query: { page, page_size: pageSize },
  });
  const rawItems = envelope.data?.items ?? [];
  const items = rawItems.map(normalizeExportJob);
  const total = Number(envelope.meta?.total ?? items.length);
  const pageNum = Number(envelope.meta?.page ?? page);
  const pageSizeNum = Number(envelope.meta?.page_size ?? pageSize);
  return { items, total, page: pageNum, pageSize: pageSizeNum };
}

/** Fetch single export job */
export async function fetchExportJob(id: string): Promise<ExportJobItem>;
export async function fetchExportJob(id: string): Promise<{ job: ExportJobItem } | ExportJobItem> {
  const envelope = await requestExportApi<{ job?: RawExportJobItem } | RawExportJobItem>('/jobs/' + encodeURIComponent(id), {
    method: 'GET',
  });
  const rawJob = 'job' in (envelope.data ?? {}) ? (envelope.data as { job?: RawExportJobItem }).job : (envelope.data as RawExportJobItem | undefined);
  if (!rawJob) {
    throw new Error('导出任务不存在');
  }
  return normalizeExportJob(rawJob);
}

/** Download export file (returns blob) */
export async function downloadExportFile(id: string): Promise<Blob> {
  const accessToken = resolveAccessToken();
  const basePath = getExportApiBasePath();
  const url = `${basePath}/jobs/${encodeURIComponent(id)}/download`;
  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  const tenantId = resolveTenantId(runtimeConfig);
  const headers: Record<string, string> = {};
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(url, { method: 'GET', headers });
  if (!response.ok) {
    const text = await response.text();
    let message = `下载失败: HTTP ${response.status}`;
    try {
      const json = JSON.parse(text) as { message?: string };
      if (json.message) message = json.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return response.blob();
}

// ============================================================================
// Backup API
// ============================================================================

function getBackupApiBasePath(): string {
  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  const apiBaseUrl = normalizeApiBaseUrl(runtimeConfig.apiBaseUrl || '/api/v1');
  return `${apiBaseUrl}/backup`;
}

async function requestBackupApi<TData>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    query?: Record<string, string | undefined>;
  } = {},
): Promise<ApiEnvelope<TData>> {
  const accessToken = resolveAccessToken();
  const basePath = getBackupApiBasePath();
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
    const err = new Error(envelope?.message ?? `backup api request failed: HTTP ${response.status}`);
    (err as Error & { status?: number; code?: string }).status = response.status;
    (err as Error & { status?: number; code?: string }).code = envelope?.code ?? 'BACKUP_API_REQUEST_FAILED';
    throw err;
  }
  return envelope ?? { code: 'OK', message: 'success', data: undefined, meta: {} };
}

export interface BackupRepository {
  name: string;
  type: string;
  settings?: Record<string, unknown>;
}

export interface BackupSnapshot {
  snapshot: string;
  state: string;
  indices: string | string[];  // ES returns array, handler may pass as-is
  start_time?: string;
  end_time?: string;
  metadata?: Record<string, unknown>;
}

/** Fetch backup repositories */
export async function fetchBackupRepositories(): Promise<BackupRepository[]> {
  const envelope = await requestBackupApi<{ repositories: BackupRepository[] }>('/repositories');
  const repos = envelope.data?.repositories ?? [];
  return Array.isArray(repos) ? repos : [];
}

/** Create backup repository */
export interface CreateBackupRepositoryData {
  name: string;
  settings?: Record<string, string>;
}

export async function createBackupRepository(data: CreateBackupRepositoryData): Promise<{ name: string }> {
  const envelope = await requestBackupApi<{ name: string }>('/repositories', {
    method: 'POST',
    body: data,
  });
  const name = envelope.data?.name;
  if (!name) {
    throw new Error('创建成功但未返回仓库名称');
  }
  return { name };
}

/** Fetch backup snapshots */
export async function fetchBackupSnapshots(repo: string): Promise<BackupSnapshot[]> {
  const envelope = await requestBackupApi<{ snapshots: BackupSnapshot[] }>('/snapshots', {
    method: 'GET',
    query: { repository: repo },
  });
  const snapshots = envelope.data?.snapshots ?? [];
  return Array.isArray(snapshots) ? snapshots : [];
}

/** Create backup snapshot */
export interface CreateBackupSnapshotData {
  repository: string;
  name: string;
  indices?: string;
  description?: string;
}

export async function createBackupSnapshot(data: CreateBackupSnapshotData): Promise<{ repository: string; snapshot: string }> {
  const envelope = await requestBackupApi<{ repository: string; snapshot: string }>('/snapshots', {
    method: 'POST',
    body: data,
  });
  const repository = envelope.data?.repository ?? data.repository;
  const snapshot = envelope.data?.snapshot ?? data.name;
  return { repository, snapshot };
}

/** Get snapshot status */
export async function getSnapshotStatus(name: string, repo?: string): Promise<BackupSnapshot> {
  const envelope = await requestBackupApi<BackupSnapshot>('/snapshots/' + encodeURIComponent(name), {
    method: 'GET',
    query: repo ? { repository: repo } : undefined,
  });
  const data = envelope.data;
  if (!data) {
    throw new Error('快照不存在');
  }
  return data;
}

/** Restore snapshot */
export interface RestoreSnapshotData {
  repository: string;
  indices?: string[];
}

export async function restoreSnapshot(name: string, data: RestoreSnapshotData): Promise<void> {
  await requestBackupApi('/snapshots/' + encodeURIComponent(name) + '/restore', {
    method: 'POST',
    body: data,
  });
}

/** Delete snapshot (repository query param required by backend) */
export async function deleteSnapshot(name: string, repo: string): Promise<void> {
  await requestBackupApi('/snapshots/' + encodeURIComponent(name), {
    method: 'DELETE',
    query: { repository: repo },
  });
}

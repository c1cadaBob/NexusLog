/**
 * API functions for storage pages.
 * Uses same auth pattern as notification.ts / export.ts.
 */

import { getRuntimeConfig } from '../config/runtime-config';
import { getAuthStorageItem } from '../utils/authStorage';
import type {
  ExecutionStatus,
  IndexHealth,
  IndexInfo,
  IndexStatus,
  IndexSummary,
  LifecyclePhase,
  LifecyclePhaseCount,
  LifecyclePolicyItem,
  LifecyclePolicySummary,
  PhaseTransition,
  PolicyStatus,
} from '../types/storage';

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

interface BackendIndexItem {
  name: string;
  health: string;
  status: string;
  primary_shards: number;
  replica_shards: number;
  docs_count: number;
  store_size_bytes: number;
}

interface BackendIndexSummary {
  total: number;
  green: number;
  yellow: number;
  red: number;
  docs_count: number;
  store_size_bytes: number;
}

interface BackendIndexListResult {
  items: BackendIndexItem[];
  summary: BackendIndexSummary;
  refreshed_at?: string;
}

interface BackendPhaseTransition {
  from: string;
  to: string;
  condition: string;
}

interface BackendLifecyclePhaseCount {
  phase: string;
  count: number;
}

interface BackendLifecyclePolicyItem {
  name: string;
  status: string;
  managed_index_count: number;
  data_stream_count: number;
  template_count: number;
  updated_at?: string;
  description?: string;
  phase_sequence?: string[];
  phases?: BackendPhaseTransition[];
  execution_status: string;
  execution_message?: string;
  error_count: number;
  managed: boolean;
  deprecated: boolean;
  current_phase_counts?: BackendLifecyclePhaseCount[];
}

interface BackendLifecyclePolicySummary {
  total: number;
  active: number;
  error: number;
  unused: number;
  managed_indices: number;
  operation_mode: string;
}

interface BackendLifecyclePolicyListResult {
  items: BackendLifecyclePolicyItem[];
  summary: BackendLifecyclePolicySummary;
  refreshed_at?: string;
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

function getStorageApiBasePath(): string {
  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  const apiBaseUrl = normalizeApiBaseUrl(runtimeConfig.apiBaseUrl || '/api/v1');
  return `${apiBaseUrl}/storage`;
}

async function requestStorageApi<TData>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<ApiEnvelope<TData>> {
  const accessToken = resolveAccessToken();
  const basePath = getStorageApiBasePath();
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
    const err = new Error(envelope?.message ?? `storage api request failed: HTTP ${response.status}`);
    (err as Error & { status?: number; code?: string }).status = response.status;
    (err as Error & { status?: number; code?: string }).code = envelope?.code ?? 'STORAGE_API_REQUEST_FAILED';
    throw err;
  }
  return envelope ?? { code: 'OK', message: 'success', data: undefined, meta: {} };
}

function normalizeIndexHealth(raw: string): IndexHealth {
  switch ((raw || '').trim().toLowerCase()) {
    case 'green':
      return 'Green';
    case 'yellow':
      return 'Yellow';
    case 'red':
      return 'Red';
    default:
      return 'Unknown';
  }
}

function normalizeIndexStatus(raw: string): IndexStatus {
  switch ((raw || '').trim().toLowerCase()) {
    case 'open':
      return 'Open';
    case 'closed':
    case 'close':
      return 'Closed';
    default:
      return 'Closed';
  }
}

function normalizePolicyStatus(raw: string): PolicyStatus {
  switch ((raw || '').trim().toLowerCase()) {
    case 'error':
      return 'Error';
    case 'unused':
      return 'Unused';
    default:
      return 'Active';
  }
}

function normalizeExecutionStatus(raw: string): ExecutionStatus {
  switch ((raw || '').trim().toLowerCase()) {
    case 'failed':
      return 'Failed';
    case 'idle':
      return 'Idle';
    default:
      return 'Success';
  }
}

function normalizeLifecyclePhase(raw: string): LifecyclePhase {
  switch ((raw || '').trim().toLowerCase()) {
    case 'warm':
      return 'Warm';
    case 'cold':
      return 'Cold';
    case 'delete':
      return 'Delete';
    default:
      return 'Hot';
  }
}

function formatCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(value >= 10_000_000_000 ? 0 : 1)} B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)} M`;
  if (value >= 1_000) return value.toLocaleString('en-US');
  return String(value);
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const digits = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function mapBackendIndexToFrontend(item: BackendIndexItem): IndexInfo {
  const primaryShards = Number(item.primary_shards ?? 0);
  const replicaShards = Number(item.replica_shards ?? 0);
  const docsCount = Number(item.docs_count ?? 0);
  const storeSizeBytes = Number(item.store_size_bytes ?? 0);

  return {
    name: item.name,
    health: normalizeIndexHealth(item.health),
    status: normalizeIndexStatus(item.status),
    shards: `${primaryShards} / ${replicaShards}`,
    docs: formatCount(docsCount),
    size: formatBytes(storeSizeBytes),
    primaryShards,
    replicaShards,
    docsCount,
    storeSizeBytes,
  };
}

function mapBackendPhaseTransition(item: BackendPhaseTransition): PhaseTransition {
  return {
    from: normalizeLifecyclePhase(item.from),
    to: normalizeLifecyclePhase(item.to),
    condition: String(item.condition ?? '').trim() || '按策略条件',
  };
}

function mapBackendPhaseCount(item: BackendLifecyclePhaseCount): LifecyclePhaseCount {
  return {
    phase: normalizeLifecyclePhase(item.phase),
    count: Number(item.count ?? 0),
  };
}

function mapBackendLifecyclePolicyToFrontend(item: BackendLifecyclePolicyItem): LifecyclePolicyItem {
  return {
    name: String(item.name ?? '').trim(),
    status: normalizePolicyStatus(item.status),
    managedIndexCount: Number(item.managed_index_count ?? 0),
    dataStreamCount: Number(item.data_stream_count ?? 0),
    templateCount: Number(item.template_count ?? 0),
    updatedAt: item.updated_at ? Date.parse(item.updated_at) : undefined,
    description: String(item.description ?? '').trim() || undefined,
    phaseSequence: (item.phase_sequence ?? []).map(normalizeLifecyclePhase),
    phases: (item.phases ?? []).map(mapBackendPhaseTransition),
    executionStatus: normalizeExecutionStatus(item.execution_status),
    executionMessage: String(item.execution_message ?? '').trim() || undefined,
    errorCount: Number(item.error_count ?? 0),
    managed: Boolean(item.managed),
    deprecated: Boolean(item.deprecated),
    currentPhaseCounts: (item.current_phase_counts ?? []).map(mapBackendPhaseCount),
  };
}

export async function fetchStorageIndices(): Promise<{ items: IndexInfo[]; summary: IndexSummary }> {
  const envelope = await requestStorageApi<BackendIndexListResult>('/indices', {
    method: 'GET',
  });
  const data = envelope.data;
  const items = (data?.items ?? []).map(mapBackendIndexToFrontend);
  const summary: IndexSummary = {
    total: Number(data?.summary?.total ?? items.length),
    green: Number(data?.summary?.green ?? items.filter((item) => item.health === 'Green').length),
    yellow: Number(data?.summary?.yellow ?? items.filter((item) => item.health === 'Yellow').length),
    red: Number(data?.summary?.red ?? items.filter((item) => item.health === 'Red').length),
    docsCount: Number(data?.summary?.docs_count ?? items.reduce((sum, item) => sum + item.docsCount, 0)),
    storeSizeBytes: Number(data?.summary?.store_size_bytes ?? items.reduce((sum, item) => sum + item.storeSizeBytes, 0)),
    refreshedAt: data?.refreshed_at ? Date.parse(data.refreshed_at) : Date.now(),
  };
  return { items, summary };
}

export async function fetchLifecyclePolicies(): Promise<{ items: LifecyclePolicyItem[]; summary: LifecyclePolicySummary }> {
  const envelope = await requestStorageApi<BackendLifecyclePolicyListResult>('/lifecycle-policies', {
    method: 'GET',
  });
  const data = envelope.data;
  const items = (data?.items ?? []).map(mapBackendLifecyclePolicyToFrontend);
  const summary: LifecyclePolicySummary = {
    total: Number(data?.summary?.total ?? items.length),
    active: Number(data?.summary?.active ?? items.filter((item) => item.status === 'Active').length),
    error: Number(data?.summary?.error ?? items.filter((item) => item.status === 'Error').length),
    unused: Number(data?.summary?.unused ?? items.filter((item) => item.status === 'Unused').length),
    managedIndices: Number(data?.summary?.managed_indices ?? items.reduce((sum, item) => sum + item.managedIndexCount, 0)),
    operationMode: String(data?.summary?.operation_mode ?? 'UNKNOWN').trim() || 'UNKNOWN',
    refreshedAt: data?.refreshed_at ? Date.parse(data.refreshed_at) : Date.now(),
  };
  return { items, summary };
}

export function formatStorageCount(value: number): string {
  return formatCount(value);
}

export function formatStorageBytes(value: number): string {
  return formatBytes(value);
}

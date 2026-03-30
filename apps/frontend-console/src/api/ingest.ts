/**
 * API functions for ingest management (pull-sources / agents / deployment scripts).
 * Uses the same auth pattern as other front-end APIs.
 */

import { getRuntimeConfig } from '../config/runtime-config';
import { getAuthStorageItem, resolveStoredAuthUserID } from '../utils/authStorage';

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

export interface IngestAgentMetricsSummary {
  cpu_usage_pct: number;
  memory_usage_pct: number;
  disk_usage_pct: number;
  disk_io_read_bytes: number;
  disk_io_write_bytes: number;
  net_in_bytes: number;
  net_out_bytes: number;
  collected_at?: string;
}

export interface IngestAgentItem {
  agent_id: string;
  agent_base_url?: string;
  host?: string;
  hostname?: string;
  ip?: string;
  version?: string;
  status: 'online' | 'paused' | 'disabled' | 'offline' | string;
  live_connected: boolean;
  last_seen_at?: string;
  source_count: number;
  active_source_count: number;
  paused_source_count: number;
  disabled_source_count: number;
  source_ids?: string[];
  source_names?: string[];
  source_paths?: string[];
  capabilities?: string[];
  metrics?: IngestAgentMetricsSummary | null;
  error_message?: string;
}

export interface PullTaskStatusSummary {
  task_id?: string;
  status?: string;
  trigger_type?: string;
  request_id?: string;
  batch_id?: string;
  retry_count?: number;
  error_code?: string;
  error_message?: string;
  scheduled_at?: string;
  started_at?: string;
  finished_at?: string;
  options?: Record<string, unknown>;
}

export interface PullTaskItem {
  task_id: string;
  source_id: string;
  trigger_type: string;
  options?: Record<string, unknown>;
  status: string;
  request_id?: string;
  batch_id?: string;
  retry_count?: number;
  last_cursor?: string;
  scheduled_at?: string;
  started_at?: string;
  finished_at?: string;
  error_code?: string;
  error_message?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PullCursorStatusSummary {
  agent_id?: string;
  source_ref?: string;
  source_path?: string;
  last_cursor?: string;
  last_offset?: number;
  last_batch_id?: string;
  updated_at?: string;
}

export interface PullPackageStatusSummary {
  package_id?: string;
  agent_id?: string;
  source_ref?: string;
  batch_id?: string;
  next_cursor?: string;
  record_count?: number;
  file_count?: number;
  size_bytes?: number;
  status?: string;
  created_at?: string;
  acked_at?: string;
  primary_file?: string;
}

export interface PullPackageFile {
  file_path: string;
  from_offset: number;
  to_offset: number;
  line_count: number;
  size_bytes: number;
  checksum?: string;
  first_record_id?: string;
  last_record_id?: string;
  first_sequence?: number;
  last_sequence?: number;
}

export interface PullPackageItem {
  package_id: string;
  source_id?: string;
  task_id?: string;
  agent_id: string;
  source_ref: string;
  package_no: string;
  batch_id?: string;
  next_cursor?: string;
  record_count: number;
  from_offset: number;
  to_offset: number;
  file_count: number;
  size_bytes: number;
  checksum: string;
  status: string;
  request_id?: string;
  files?: PullPackageFile[];
  metadata?: Record<string, string>;
  sent_at?: string;
  acked_at?: string;
  created_at: string;
}

export interface DeliveryReceiptItem {
  receipt_id: string;
  package_id: string;
  package_no?: string;
  source_ref?: string;
  status: 'ack' | 'nack' | string;
  error_code?: string;
  reason?: string;
  checksum?: string;
  accepted: boolean;
  received_at: string;
  created_at: string;
}

export interface ReceiptErrorCodeBucket {
  error_code: string;
  count: number;
}

export interface ReceiptNackReasonBucket {
  error_code?: string;
  reason?: string;
  count: number;
}

export interface ReceiptSummary {
  ack_count: number;
  nack_count: number;
  error_code_buckets: ReceiptErrorCodeBucket[];
  nack_reason_buckets: ReceiptNackReasonBucket[];
}

export interface DeadLetterItem {
  dead_letter_id: string;
  package_id?: string;
  source_ref?: string;
  error_code?: string;
  error_message?: string;
  retry_count: number;
  failed_at: string;
  created_at: string;
  replayed_at?: string;
  replay_batch_id?: string;
  replay_reason?: string;
}

export interface ReplayDeadLettersResponse {
  replay_batch_id: string;
  replayed_count: number;
}

export interface PullSourceRuntimeStatusItem {
  source_id: string;
  name: string;
  protocol: string;
  host: string;
  port: number;
  path: string;
  agent_base_url?: string;
  configured_status: string;
  runtime_status: 'healthy' | 'running' | 'paused' | 'disabled' | 'offline' | 'error' | string;
  agent_id?: string;
  agent_hostname?: string;
  agent_ip?: string;
  agent_status?: string;
  live_connected: boolean;
  pull_interval_sec: number;
  pull_timeout_sec: number;
  estimated_eps?: number;
  last_task?: PullTaskStatusSummary;
  last_cursor?: PullCursorStatusSummary;
  last_package?: PullPackageStatusSummary;
  metrics?: IngestAgentMetricsSummary | null;
  updated_at?: string;
  error_message?: string;
}

export interface PullSourceStatusSummary {
  total_sources: number;
  active_sources: number;
  paused_sources: number;
  disabled_sources: number;
  online_agents: number;
  offline_agents: number;
  healthy_sources: number;
  failed_sources: number;
  recent_record_count: number;
  recent_package_count: number;
}

export interface PullSourceStatusTrendPoint {
  bucket_start: string;
  package_count: number;
  record_count: number;
}

export interface PullSourceStatusResponse {
  summary: PullSourceStatusSummary;
  items: PullSourceRuntimeStatusItem[];
  trend: PullSourceStatusTrendPoint[];
  range: string;
  last_refresh_at: string;
}

export interface GenerateDeploymentScriptPayload {
  target_kind: 'linux-systemd' | 'linux-docker' | 'windows-startup-task' | 'windows-powershell' | 'network-syslog-udp' | 'network-syslog-tcp';
  source_name: string;
  source_type?: string;
  agent_id?: string;
  agent_base_url?: string;
  control_plane_base_url?: string;
  release_base_url?: string;
  container_image?: string;
  version?: string;
  include_paths?: string[];
  exclude_paths?: string[];
  syslog_bind?: string;
  syslog_protocol?: string;
  key_ref?: string;
}

export interface GenerateDeploymentScriptResponse {
  target_kind: string;
  script_kind: 'bash' | 'powershell' | 'network-cli' | string;
  file_name: string;
  command?: string;
  script: string;
  agent_base_url?: string;
  listener_address?: string;
  notes?: string[];
}

export interface RunPullTaskResponse {
  task_id: string;
  source_id: string;
  trigger_type: string;
  status: string;
  request_id?: string;
}

interface ListPullSourcesData {
  items: PullSource[];
}

interface ListPullTasksData {
  items: PullTaskItem[];
}

interface GetPullTaskData {
  item?: PullTaskItem;
}

interface ListPullPackagesData {
  items: PullPackageItem[];
}

interface GetPullPackageData {
  item?: PullPackageItem;
}

interface ListReceiptsData {
  items: DeliveryReceiptItem[];
  summary?: ReceiptSummary;
}

interface ListDeadLettersData {
  items: DeadLetterItem[];
}

interface ListAgentsData {
  items: IngestAgentItem[];
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
  const userId = resolveStoredAuthUserID();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  if (userId) headers['X-User-ID'] = userId;
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

export async function deletePullSource(id: string): Promise<void> {
  await updatePullSource(id, { status: 'disabled' });
}

export async function fetchIngestAgents(): Promise<IngestAgentItem[]> {
  const envelope = await requestIngestApi<ListAgentsData>('/agents', { method: 'GET' });
  return envelope.data?.items ?? [];
}

export async function fetchPullSourceStatus(range: '1h' | '6h' | '24h' | '7d' = '1h'): Promise<PullSourceStatusResponse> {
  const envelope = await requestIngestApi<PullSourceStatusResponse>('/pull-sources/status', {
    method: 'GET',
    query: { range },
  });

  return envelope.data ?? {
    summary: {
      total_sources: 0,
      active_sources: 0,
      paused_sources: 0,
      disabled_sources: 0,
      online_agents: 0,
      offline_agents: 0,
      healthy_sources: 0,
      failed_sources: 0,
      recent_record_count: 0,
      recent_package_count: 0,
    },
    items: [],
    trend: [],
    range,
    last_refresh_at: '',
  };
}

export async function fetchPullTasks(params: {
  source_id: string;
  status?: string;
  page?: number;
  page_size?: number;
}): Promise<{ items: PullTaskItem[]; total: number; hasNext: boolean }> {
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 20;
  const sourceId = params.source_id.trim();
  if (!sourceId) {
    throw new Error('source_id 不能为空');
  }

  const status = params.status?.trim() || '';
  const envelope = await requestIngestApi<ListPullTasksData>('/pull-tasks', {
    method: 'GET',
    query: {
      source_id: sourceId,
      page,
      page_size: pageSize,
      ...(status ? { status } : {}),
    },
  });

  const items = envelope.data?.items ?? [];
  return {
    items,
    total: Number(envelope.meta?.total ?? items.length),
    hasNext: Boolean(envelope.meta?.has_next ?? false),
  };
}

export async function fetchPullPackages(params: {
  agent_id?: string;
  source_ref?: string;
  status?: string;
  page?: number;
  page_size?: number;
}): Promise<{ items: PullPackageItem[]; total: number; hasNext: boolean }> {
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 20;
  const agentId = params.agent_id?.trim() || '';
  const sourceRef = params.source_ref?.trim() || '';

  if (!agentId && !sourceRef) {
    throw new Error('agent_id 或 source_ref 不能为空');
  }

  const status = params.status?.trim() || '';
  const envelope = await requestIngestApi<ListPullPackagesData>('/packages', {
    method: 'GET',
    query: {
      ...(agentId ? { agent_id: agentId } : {}),
      ...(sourceRef ? { source_ref: sourceRef } : {}),
      ...(status ? { status } : {}),
      page,
      page_size: pageSize,
    },
  });

  const items = envelope.data?.items ?? [];
  return {
    items,
    total: Number(envelope.meta?.total ?? items.length),
    hasNext: Boolean(envelope.meta?.has_next ?? false),
  };
}

export async function fetchPullTaskById(taskId: string): Promise<PullTaskItem> {
  const normalizedTaskId = taskId.trim();
  if (!normalizedTaskId) {
    throw new Error('task_id 不能为空');
  }

  const envelope = await requestIngestApi<GetPullTaskData>(`/pull-tasks/${encodeURIComponent(normalizedTaskId)}`, {
    method: 'GET',
  });
  const item = envelope.data?.item;
  if (!item) {
    throw new Error('未返回任务详情');
  }
  return item;
}

export async function fetchPullPackageById(packageId: string): Promise<PullPackageItem> {
  const normalizedPackageId = packageId.trim();
  if (!normalizedPackageId) {
    throw new Error('package_id 不能为空');
  }

  const envelope = await requestIngestApi<GetPullPackageData>(`/packages/${encodeURIComponent(normalizedPackageId)}`, {
    method: 'GET',
  });
  const item = envelope.data?.item;
  if (!item) {
    throw new Error('未返回包详情');
  }
  return item;
}

export async function fetchReceipts(params: {
  source_ref?: string;
  package_id?: string;
  status?: 'ack' | 'nack';
  error_code?: string;
  page?: number;
  page_size?: number;
}): Promise<{ items: DeliveryReceiptItem[]; total: number; hasNext: boolean; summary: ReceiptSummary }> {
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 20;
  const sourceRef = params.source_ref?.trim() || '';
  const packageId = params.package_id?.trim() || '';

  if (!sourceRef && !packageId) {
    throw new Error('source_ref 或 package_id 不能为空');
  }

  const errorCode = params.error_code?.trim() || '';
  const envelope = await requestIngestApi<ListReceiptsData>('/receipts', {
    method: 'GET',
    query: {
      ...(sourceRef ? { source_ref: sourceRef } : {}),
      ...(packageId ? { package_id: packageId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(errorCode ? { error_code: errorCode } : {}),
      page,
      page_size: pageSize,
    },
  });

  const items = envelope.data?.items ?? [];
  const rawSummary = envelope.data?.summary;
  const summary: ReceiptSummary = {
    ack_count: Number(rawSummary?.ack_count ?? 0),
    nack_count: Number(rawSummary?.nack_count ?? 0),
    error_code_buckets: rawSummary?.error_code_buckets ?? [],
    nack_reason_buckets: rawSummary?.nack_reason_buckets ?? [],
  };
  return {
    items,
    total: Number(envelope.meta?.total ?? items.length),
    hasNext: Boolean(envelope.meta?.has_next ?? false),
    summary,
  };
}

export async function fetchDeadLetters(params: {
  source_ref?: string;
  package_id?: string;
  replayed?: 'yes' | 'no';
  page?: number;
  page_size?: number;
}): Promise<{ items: DeadLetterItem[]; total: number; hasNext: boolean }> {
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 20;
  const sourceRef = params.source_ref?.trim() || '';
  const packageId = params.package_id?.trim() || '';

  if (!sourceRef && !packageId) {
    throw new Error('source_ref 或 package_id 不能为空');
  }

  const envelope = await requestIngestApi<ListDeadLettersData>('/dead-letters', {
    method: 'GET',
    query: {
      ...(sourceRef ? { source_ref: sourceRef } : {}),
      ...(packageId ? { package_id: packageId } : {}),
      ...(params.replayed ? { replayed: params.replayed } : {}),
      page,
      page_size: pageSize,
    },
  });

  const items = envelope.data?.items ?? [];
  return {
    items,
    total: Number(envelope.meta?.total ?? items.length),
    hasNext: Boolean(envelope.meta?.has_next ?? false),
  };
}

export async function replayDeadLetters(payload: {
  dead_letter_ids: string[];
  reason: string;
}): Promise<ReplayDeadLettersResponse> {
  const deadLetterIds = payload.dead_letter_ids.map((item) => item.trim()).filter(Boolean);
  const reason = payload.reason.trim();
  if (deadLetterIds.length === 0) {
    throw new Error('dead_letter_ids 不能为空');
  }
  if (!reason) {
    throw new Error('重放原因不能为空');
  }

  const envelope = await requestIngestApi<ReplayDeadLettersResponse>('/dead-letters/replay', {
    method: 'POST',
    body: {
      dead_letter_ids: deadLetterIds,
      reason,
    },
  });

  if (!envelope.data) {
    throw new Error('死信重放成功但返回内容为空');
  }
  return envelope.data;
}

export async function generateDeploymentScript(
  payload: GenerateDeploymentScriptPayload,
): Promise<GenerateDeploymentScriptResponse> {
  const envelope = await requestIngestApi<GenerateDeploymentScriptResponse>('/deployment-scripts/generate', {
    method: 'POST',
    body: payload,
  });

  if (!envelope.data) {
    throw new Error('脚本生成成功但返回内容为空');
  }
  return envelope.data;
}

export async function runPullTask(sourceId: string): Promise<RunPullTaskResponse> {
  const normalizedSourceId = sourceId.trim();
  if (!normalizedSourceId) {
    throw new Error('source_id 不能为空');
  }

  const envelope = await requestIngestApi<RunPullTaskResponse>('/pull-tasks/run', {
    method: 'POST',
    body: {
      source_id: normalizedSourceId,
      trigger_type: 'manual',
    },
  });

  if (!envelope.data) {
    throw new Error('任务已提交但返回内容为空');
  }
  return envelope.data;
}

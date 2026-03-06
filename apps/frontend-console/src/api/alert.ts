/**
 * API functions for alert rules and events.
 * Uses same auth pattern as ingest.ts (getRuntimeConfig, buildAuthHeaders with tenant/token).
 */

import { getRuntimeConfig } from '../config/runtime-config';
import type { AlertRule, AlertSeverity, RuleStatus } from '../types/alert';

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

/** Backend alert rule response */
interface BackendAlertRule {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  condition: Record<string, unknown>;
  severity: string;
  enabled: boolean;
  notification_channels?: unknown;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

/** Backend alert event response */
interface BackendAlertEvent {
  id: string;
  name?: string;
  title?: string;
  severity: string;
  status: string;
  source_id?: string;
  fired_at: string;
  resolved_at?: string;
  count?: number;
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

function getAlertApiBasePath(): string {
  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  const apiBaseUrl = normalizeApiBaseUrl(runtimeConfig.apiBaseUrl || '/api/v1');
  return `${apiBaseUrl}/alert`;
}

async function requestAlertApi<TData>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<ApiEnvelope<TData>> {
  const accessToken = resolveAccessToken();
  const basePath = getAlertApiBasePath();
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
    const err = new Error(envelope?.message ?? `alert api request failed: HTTP ${response.status}`);
    (err as Error & { status?: number; code?: string }).status = response.status;
    (err as Error & { status?: number; code?: string }).code = envelope?.code ?? 'ALERT_API_REQUEST_FAILED';
    throw err;
  }
  return envelope ?? { code: 'OK', message: 'success', data: undefined, meta: {} };
}

function mapBackendRuleToFrontend(r: BackendAlertRule): AlertRule {
  const cond = r.condition || {};
  const condType = (cond.type as string) || 'keyword';
  let query = '';
  let metric = '';
  let operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne' = 'gt';
  let threshold = 0;

  if (condType === 'keyword') {
    const kw = (cond.keyword as string) || '';
    const field = (cond.field as string) || 'message';
    query = `contains(${field}, '${kw}')`;
  } else if (condType === 'level_count') {
    const level = (cond.level as string) || 'ERROR';
    const th = (cond.threshold as number) || 10;
    const win = (cond.window_seconds as number) || 300;
    query = `count(level='${level}') in ${win}s`;
    metric = 'level_count';
    threshold = th;
  } else if (condType === 'threshold') {
    const m = (cond.metric as string) || '';
    const op = (cond.operator as string) || '>';
    const val = (cond.value as number) || 0;
    metric = m;
    threshold = val;
    operator = op === '>=' ? 'gte' : op === '<=' ? 'lte' : op === '<' ? 'lt' : op === '=' ? 'eq' : op === '!=' ? 'ne' : 'gt';
    query = `${m} ${op} ${val}`;
  } else {
    query = JSON.stringify(cond);
  }

  const createdAt = r.created_at ? new Date(r.created_at).getTime() : Date.now();
  const updatedAt = r.updated_at ? new Date(r.updated_at).getTime() : Date.now();

  return {
    id: r.id,
    name: r.name,
    description: r.description || '',
    query,
    severity: (r.severity?.toLowerCase() || 'medium') as AlertSeverity,
    status: (r.enabled ? 'enabled' : 'disabled') as RuleStatus,
    evaluationInterval: 60,
    forDuration: 300,
    conditions: [{ metric: metric || 'value', operator, threshold }],
    labels: {},
    annotations: {},
    actions: [],
    createdBy: r.created_by || '',
    createdAt,
    updatedAt,
    lastEvaluatedAt: updatedAt,
  };
}

/** Fetch alert rules (paginated) */
export async function fetchAlertRules(
  page: number = 1,
  pageSize: number = 20,
): Promise<{ items: AlertRule[]; total: number }> {
  const envelope = await requestAlertApi<{ items: BackendAlertRule[] }>('/rules', {
    method: 'GET',
    query: { page, page_size: pageSize },
  });

  const items = envelope.data?.items ?? [];
  const total = Number(envelope.meta?.total ?? items.length);

  return {
    items: items.map(mapBackendRuleToFrontend),
    total,
  };
}

/** Create alert rule payload - condition type: keyword | level_count | threshold */
export interface CreateAlertRulePayload {
  name: string;
  description?: string;
  conditionType: 'keyword' | 'level_count' | 'threshold';
  condition: {
    keyword?: string;
    field?: string;
    level?: string;
    threshold?: number;
    window_seconds?: number;
    metric?: string;
    operator?: string;
    value?: number;
  };
  severity?: string;
  enabled?: boolean;
}

function buildCondition(payload: CreateAlertRulePayload): Record<string, unknown> {
  const { conditionType, condition } = payload;
  if (conditionType === 'keyword') {
    return {
      type: 'keyword',
      keyword: condition.keyword || '',
      field: condition.field || 'message',
    };
  }
  if (conditionType === 'level_count') {
    return {
      type: 'level_count',
      level: condition.level || 'ERROR',
      threshold: condition.threshold ?? 10,
      window_seconds: condition.window_seconds ?? 300,
    };
  }
  if (conditionType === 'threshold') {
    const opMap: Record<string, string> = {
      gt: '>', gte: '>=', lt: '<', lte: '<=', eq: '=', ne: '!=',
    };
    return {
      type: 'threshold',
      metric: condition.metric || '',
      operator: opMap[condition.operator || 'gt'] || '>',
      value: condition.value ?? 0,
    };
  }
  return { type: 'keyword', keyword: '', field: 'message' };
}

/** Create a new alert rule */
export async function createAlertRule(data: CreateAlertRulePayload): Promise<AlertRule> {
  const condition = buildCondition(data);
  const envelope = await requestAlertApi<{ id: string; enabled: boolean }>('/rules', {
    method: 'POST',
    body: {
      name: data.name,
      description: data.description || '',
      condition,
      severity: data.severity || 'medium',
      enabled: data.enabled ?? true,
      notification_channels: [],
    },
  });

  const id = envelope.data?.id;
  if (!id) {
    throw new Error('创建成功但未返回规则 ID');
  }

  const result = await fetchAlertRules(1, 200);
  const created = result.items.find((r) => r.id === id);
  if (!created) {
    throw new Error('创建成功但无法获取规则详情');
  }
  return created;
}

/** Update alert rule payload */
export interface UpdateAlertRulePayload {
  name?: string;
  description?: string;
  conditionType?: 'keyword' | 'level_count' | 'threshold';
  condition?: Record<string, unknown>;
  severity?: string;
  enabled?: boolean;
}

/** Update an existing alert rule */
export async function updateAlertRule(id: string, data: UpdateAlertRulePayload): Promise<AlertRule> {
  let condition: Record<string, unknown> | undefined;
  if (data.conditionType && data.condition) {
    if (data.conditionType === 'keyword') {
      condition = { type: 'keyword', keyword: data.condition.keyword || '', field: data.condition.field || 'message' };
    } else if (data.conditionType === 'level_count') {
      condition = {
        type: 'level_count',
        level: data.condition.level || 'ERROR',
        threshold: data.condition.threshold ?? 10,
        window_seconds: data.condition.window_seconds ?? 300,
      };
    } else if (data.conditionType === 'threshold') {
      const opMap: Record<string, string> = {
        gt: '>', gte: '>=', lt: '<', lte: '<=', eq: '=', ne: '!=',
      };
      condition = {
        type: 'threshold',
        metric: data.condition.metric || '',
        operator: opMap[(data.condition.operator as string) || 'gt'] || '>',
        value: data.condition.value ?? 0,
      };
    }
  }

  await requestAlertApi<{ updated: boolean }>(`/rules/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: {
      ...(data.name != null && { name: data.name }),
      ...(data.description != null && { description: data.description }),
      ...(condition != null && { condition }),
      ...(data.severity != null && { severity: data.severity }),
      ...(data.enabled != null && { enabled: data.enabled }),
    },
  });

  const result = await fetchAlertRules(1, 200);
  const updated = result.items.find((r) => r.id === id);
  if (!updated) {
    throw new Error('更新成功但无法获取规则详情');
  }
  return updated;
}

/** Delete an alert rule */
export async function deleteAlertRule(id: string): Promise<void> {
  await requestAlertApi<{ deleted: boolean }>(`/rules/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/** Enable an alert rule */
export async function enableAlertRule(id: string): Promise<void> {
  await requestAlertApi<{ enabled: boolean }>(`/rules/${encodeURIComponent(id)}/enable`, {
    method: 'PUT',
  });
}

/** Disable an alert rule */
export async function disableAlertRule(id: string): Promise<void> {
  await requestAlertApi<{ enabled: boolean }>(`/rules/${encodeURIComponent(id)}/disable`, {
    method: 'PUT',
  });
}

/** Alert event summary for list (matches AlertSummary) */
export interface AlertEventSummary {
  id: string;
  name: string;
  severity: AlertSeverity;
  status: 'active' | 'acknowledged' | 'resolved' | 'silenced';
  source: string;
  count: number;
  lastTriggeredAt: number;
}

/** Fetch alert events (paginated, optional status filter) */
export async function fetchAlertEvents(
  page: number = 1,
  pageSize: number = 20,
  status?: 'firing' | 'resolved' | 'silenced',
): Promise<{ items: AlertEventSummary[]; total: number }> {
  const query: Record<string, string | number> = { page, page_size: pageSize };
  if (status) query.status = status;

  const envelope = await requestAlertApi<{ items: BackendAlertEvent[] }>('/events', {
    method: 'GET',
    query,
  });

  const items = envelope.data?.items ?? [];
  const total = Number(envelope.meta?.total ?? items.length);

  const mapStatus = (s: string): AlertEventSummary['status'] => {
    if (s === 'firing' || s === 'active') return 'active';
    if (s === 'acknowledged') return 'acknowledged';
    if (s === 'resolved') return 'resolved';
    if (s === 'silenced') return 'silenced';
    return 'active';
  };

  return {
    items: items.map((e) => ({
      id: e.id,
      name: e.name || e.title || '未知告警',
      severity: (e.severity?.toLowerCase() || 'medium') as AlertSeverity,
      status: mapStatus(e.status || 'firing'),
      source: e.source_id || '-',
      count: e.count ?? 1,
      lastTriggeredAt: e.fired_at ? new Date(e.fired_at).getTime() : Date.now(),
    })),
    total,
  };
}

/**
 * API functions for incident management.
 * Uses same auth pattern as alert.ts (getRuntimeConfig, buildAuthHeaders with tenant/token).
 */

import { getRuntimeConfig } from '../config/runtime-config';
import type { Incident, IncidentStatus, IncidentSeverity, TimelineEvent } from '../types/incident';

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

/** Backend incident response (matches control-plane Incident struct) */
interface BackendIncident {
  id: string;
  tenant_id?: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  source_alert_id?: string;
  assigned_to?: string;
  created_by?: string;
  acknowledged_at?: string;
  resolved_at?: string;
  closed_at?: string;
  root_cause?: string;
  resolution?: string;
  verdict?: string;  // 归档研判结论
  sla_response_minutes?: number;
  sla_resolve_minutes?: number;
  created_at: string;
  updated_at: string;
}

/** Backend timeline entry */
interface BackendTimelineEntry {
  id: string;
  incident_id: string;
  action: string;
  actor_id?: string;
  detail: string;
  created_at: string;
}

/** Backend SLA summary */
interface BackendSLASummary {
  total_incidents?: number;
  compliant_incidents?: number;
  avg_response_minutes?: number;
  avg_resolve_minutes?: number;
  sla_compliance_rate_pct?: number;
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

function getIncidentApiBasePath(): string {
  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  const apiBaseUrl = normalizeApiBaseUrl(runtimeConfig.apiBaseUrl || '/api/v1');
  return `${apiBaseUrl}/incidents`;
}

async function requestIncidentApi<TData>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT';
    body?: unknown;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<ApiEnvelope<TData>> {
  const accessToken = resolveAccessToken();
  const basePath = getIncidentApiBasePath();
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
    const err = new Error(envelope?.message ?? `incident api request failed: HTTP ${response.status}`);
    (err as Error & { status?: number; code?: string }).status = response.status;
    (err as Error & { status?: number; code?: string }).code = envelope?.code ?? 'INCIDENT_API_REQUEST_FAILED';
    throw err;
  }
  return envelope ?? { code: 'OK', message: 'success', data: undefined, meta: {} };
}

/** Map backend severity to frontend IncidentSeverity */
function mapSeverity(sev: string): IncidentSeverity {
  const s = (sev || '').toLowerCase();
  if (s === 'critical' || s === 'p0') return 'P0';
  if (s === 'major' || s === 'p1') return 'P1';
  if (s === 'minor' || s === 'p2') return 'P2';
  return 'P3';
}

/** Map backend status to frontend IncidentStatus */
function mapStatus(s: string): IncidentStatus {
  const lower = (s || '').toLowerCase();
  const map: Record<string, IncidentStatus> = {
    open: 'alerted',
    acknowledged: 'acknowledged',
    investigating: 'analyzing',
    resolved: 'resolved',
    closed: 'archived',
    detected: 'detected',
    alerted: 'alerted',
    analyzing: 'analyzing',
    mitigated: 'mitigated',
    postmortem: 'postmortem',
    archived: 'archived',
  };
  return map[lower] ?? 'detected';
}

function parseTime(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return isNaN(t) ? null : t;
}

function mapBackendIncidentToFrontend(r: BackendIncident): Incident {
  const createdAt = parseTime(r.created_at) ?? Date.now();
  const updatedAt = parseTime(r.updated_at) ?? Date.now();
  const alertedAt = parseTime(r.created_at); // backend may not have separate alerted_at
  const ackedAt = parseTime(r.acknowledged_at);
  const resolvedAt = parseTime(r.resolved_at);
  const archivedAt = parseTime(r.closed_at);

  return {
    id: r.id,
    title: r.title,
    description: r.description || '',
    severity: mapSeverity(r.severity),
    status: mapStatus(r.status),
    source: r.source_alert_id || r.title || '-',
    fingerprint: r.id,
    assignee: r.assigned_to || '',
    escalationLevel: 1,
    detectedAt: createdAt,
    alertedAt,
    ackedAt,
    mitigatedAt: null,
    resolvedAt,
    archivedAt,
    alertIds: r.source_alert_id ? [r.source_alert_id] : [],
    logBundleIds: [],
    affectedServices: r.title ? [r.title] : [],
    affectedUsers: 0,
    tags: [],
    createdAt,
    updatedAt,
    verdict: r.verdict || undefined,
  };
}

export interface IncidentFilters {
  status?: IncidentStatus | string;
  severity?: IncidentSeverity | string;
  /** Time range: start timestamp (ms) */
  from?: number;
  /** Time range: end timestamp (ms) */
  to?: number;
}

/** Map frontend status to backend status for API */
function toBackendStatus(s: IncidentStatus | string): string {
  const map: Record<string, string> = {
    detected: 'open',
    alerted: 'open',
    acknowledged: 'acknowledged',
    analyzing: 'investigating',
    mitigated: 'resolved',
    resolved: 'resolved',
    postmortem: 'resolved',
    archived: 'closed',
  };
  return map[String(s)] ?? String(s);
}

function toBackendSeverity(s: IncidentSeverity | string): string {
  const map: Record<string, string> = {
    P0: 'critical',
    P1: 'major',
    P2: 'minor',
    P3: 'minor',
  };
  return map[String(s)] ?? 'minor';
}

/** Fetch incidents (paginated, optional filters) */
export async function fetchIncidents(
  page: number = 1,
  pageSize: number = 20,
  filters?: IncidentFilters,
): Promise<{ items: Incident[]; total: number }> {
  const query: Record<string, string | number> = { page, page_size: pageSize };
  if (filters?.status && filters.status !== 'all') {
    query.status = toBackendStatus(filters.status);
  }
  if (filters?.severity && filters.severity !== 'all') {
    query.severity = toBackendSeverity(filters.severity);
  }

  const envelope = await requestIncidentApi<{ items: BackendIncident[] }>('', {
    method: 'GET',
    query,
  });

  const items = envelope.data?.items ?? [];
  const total = Number(envelope.meta?.total ?? items.length);

  return {
    items: items.map(mapBackendIncidentToFrontend),
    total,
  };
}

/** Create incident payload */
export interface CreateIncidentPayload {
  title: string;
  description?: string;
  severity?: IncidentSeverity | string;
  assigned_to?: string;
}

/** Create a new incident */
export async function createIncident(data: CreateIncidentPayload): Promise<{ id: string }> {
  const envelope = await requestIncidentApi<{ id: string }>('', {
    method: 'POST',
    body: {
      title: data.title,
      description: data.description || '',
      severity: data.severity ? toBackendSeverity(String(data.severity)) : 'minor',
      assigned_to: data.assigned_to || undefined,
    },
  });

  const id = envelope.data?.id;
  if (!id) {
    throw new Error('创建成功但未返回事件 ID');
  }
  return { id };
}

/** Update incident payload */
export interface UpdateIncidentPayload {
  title?: string;
  description?: string;
  severity?: IncidentSeverity | string;
  assigned_to?: string;
  root_cause?: string;
  resolution?: string;
}

/** Update an existing incident */
export async function updateIncident(id: string, data: UpdateIncidentPayload): Promise<void> {
  await requestIncidentApi<{ updated: boolean }>(`/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: {
      ...(data.title != null && { title: data.title }),
      ...(data.description != null && { description: data.description }),
      ...(data.severity != null && { severity: toBackendSeverity(String(data.severity)) }),
      ...(data.assigned_to != null && { assigned_to: data.assigned_to }),
      ...(data.root_cause != null && { root_cause: data.root_cause }),
      ...(data.resolution != null && { resolution: data.resolution }),
    },
  });
}

/** Archive an incident with verdict (研判结论) */
export async function archiveIncident(id: string, verdict: string): Promise<void> {
  if (!verdict || !String(verdict).trim()) {
    throw new Error('verdict is required');
  }
  await requestIncidentApi<{ archived: boolean }>(`/${encodeURIComponent(id)}/archive`, {
    method: 'POST',
    body: { verdict: String(verdict).trim() },
  });
}

/** Acknowledge an incident */
export async function acknowledgeIncident(id: string): Promise<void> {
  await requestIncidentApi<{ status: string }>(`/${encodeURIComponent(id)}/acknowledge`, {
    method: 'POST',
  });
}

/** Start investigating an incident */
export async function investigateIncident(id: string): Promise<void> {
  await requestIncidentApi<{ status: string }>(`/${encodeURIComponent(id)}/investigate`, {
    method: 'POST',
  });
}

/** Resolve an incident (optional resolution text) */
export async function resolveIncident(id: string, resolution?: string): Promise<void> {
  await requestIncidentApi<{ status: string }>(`/${encodeURIComponent(id)}/resolve`, {
    method: 'POST',
    body: resolution ? { resolution } : {},
  });
}

/** Close an incident */
export async function closeIncident(id: string): Promise<void> {
  await requestIncidentApi<{ status: string }>(`/${encodeURIComponent(id)}/close`, {
    method: 'POST',
  });
}

/** Map backend action to frontend TimelineEventType */
function mapActionToType(action: string): TimelineEvent['type'] {
  const lower = (action || '').toLowerCase();
  const map: Record<string, TimelineEvent['type']> = {
    created: 'incident_created',
    acknowledged: 'incident_acked',
    assigned: 'analysis_started',
    resolved: 'incident_resolved',
    closed: 'incident_archived',
  };
  return map[lower] ?? 'comment';
}

/** Fetch incident timeline */
export async function fetchIncidentTimeline(id: string): Promise<TimelineEvent[]> {
  const envelope = await requestIncidentApi<{ items: BackendTimelineEntry[] }>(
    `/${encodeURIComponent(id)}/timeline`,
    { method: 'GET' },
  );

  const items = envelope.data?.items ?? [];
  return items.map((e) => ({
    id: e.id,
    incidentId: e.incident_id,
    type: mapActionToType(e.action),
    title: e.action,
    description: e.detail || '',
    operator: e.actor_id || 'system',
    timestamp: parseTime(e.created_at) ?? Date.now(),
  }));
}

/** Fetch incident detail */
export async function fetchIncidentDetail(id: string): Promise<Incident> {
  const envelope = await requestIncidentApi<BackendIncident>(`/${encodeURIComponent(id)}`, {
    method: 'GET',
  });

  const data = envelope.data;
  if (!data) {
    throw new Error('incident not found');
  }
  return mapBackendIncidentToFrontend(data);
}

/** SLA summary response */
export interface SLASummary {
  totalIncidents: number;
  compliantIncidents: number;
  avgResponseMinutes?: number;
  avgResolveMinutes?: number;
}

/** Fetch SLA summary */
export async function fetchSLASummary(): Promise<SLASummary> {
  const envelope = await requestIncidentApi<BackendSLASummary>('/sla/summary', {
    method: 'GET',
  });

  const d = envelope.data;
  return {
    totalIncidents: d?.total_incidents ?? 0,
    compliantIncidents: d?.compliant_incidents ?? 0,
    avgResponseMinutes: d?.avg_response_minutes,
    avgResolveMinutes: d?.avg_resolve_minutes,
  };
}

import { getRuntimeConfig } from '../config/runtime-config';
import type { LogEntry, RealtimeLogFields } from '../types/log';
import { getAuthStorageItem } from '../utils/authStorage';
import { queryRealtimeLogs } from './query';

const TENANT_ID_KEY = 'nexuslog-tenant-id';
const AUDIT_TYPE_PATTERN = /\btype=([A-Z0-9_]+)/;
const AUDIT_SEQUENCE_PATTERN = /audit\([^:]+:(\d+)\)/;
const AUDIT_PID_PATTERN = /\bpid=(\d+)/;
const AUDIT_ACCOUNT_PATTERNS = [
  /\bacct="([^"]+)"/,
  /\bAUID="([^"]+)"/,
  /\bID="([^"]+)"/,
  /\bUID="([^"]+)"/,
  /\bauid=(\d+)/,
  /\buid=(\d+)/,
];
const AUDIT_OPERATION_PATTERN = /\bop=([^\s'"]+)/;
const AUDIT_RESULT_PATTERN = /\bres=([^\s'"]+)/;
const AUDIT_ADDR_PATTERN = /\baddr=([^\s'"]+)/;
const AUDIT_HOSTNAME_PATTERN = /\bhostname=([^\s'"]+)/;
const AUDIT_COMM_PATTERN = /\bcomm="([^"]+)"/;
const AUDIT_EXE_PATTERN = /\bexe="([^"]+)"/;

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

export interface AuditLogItem {
  id: string;
  tenant_id?: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  detail?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface FetchAuditLogsParams {
  user_id?: string;
  action?: string;
  resource_type?: string;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: string;
}

export interface FetchAuditLogsResult {
  items: AuditLogItem[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

interface ParsedAuditMessage {
  type: string;
  sequence: string;
  pid: string;
  user: string;
  operation: string;
  result: string;
  address: string;
  hostname: string;
  process: string;
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

function getAuditApiBasePath(): string {
  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  const apiBaseUrl = normalizeApiBaseUrl(runtimeConfig.apiBaseUrl || '/api/v1');
  return `${apiBaseUrl}/audit`;
}

async function requestAuditApi<TData>(
  path: string,
  options: {
    method?: 'GET' | 'POST';
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<ApiEnvelope<TData>> {
  const accessToken = resolveAccessToken();
  const basePath = getAuditApiBasePath();
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

  const envelope = (await response.json().catch(() => null)) as ApiEnvelope<TData> | null;
  if (!response.ok) {
    const err = new Error(envelope?.message ?? `audit api request failed: HTTP ${response.status}`);
    (err as Error & { status?: number; code?: string }).status = response.status;
    (err as Error & { status?: number; code?: string }).code = envelope?.code ?? 'AUDIT_API_REQUEST_FAILED';
    throw err;
  }
  return envelope ?? { code: 'OK', message: 'success', data: undefined, meta: {} };
}

function cleanAuditToken(value: string | undefined): string {
  const normalized = (value ?? '').trim().replace(/^['"]|['"]$/g, '');
  if (!normalized || normalized === '?' || normalized === '4294967295') {
    return '';
  }
  return normalized;
}

function extractFirstMatch(raw: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) {
      const value = cleanAuditToken(match[1]);
      if (value) {
        return value;
      }
    }
  }
  return '';
}

function normalizeProcessName(raw: string): string {
  const value = cleanAuditToken(raw);
  if (!value) {
    return '';
  }
  const segments = value.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? value;
}

function isIPAddress(value: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) || value.includes(':');
}

export function parseAuditMessage(raw: string): ParsedAuditMessage {
  const typeMatch = raw.match(AUDIT_TYPE_PATTERN);
  const sequenceMatch = raw.match(AUDIT_SEQUENCE_PATTERN);
  const pidMatch = raw.match(AUDIT_PID_PATTERN);
  const operationMatch = raw.match(AUDIT_OPERATION_PATTERN);
  const resultMatch = raw.match(AUDIT_RESULT_PATTERN);
  const addressMatch = raw.match(AUDIT_ADDR_PATTERN);
  const hostnameMatch = raw.match(AUDIT_HOSTNAME_PATTERN);
  const process = normalizeProcessName(extractFirstMatch(raw, [AUDIT_COMM_PATTERN, AUDIT_EXE_PATTERN]));

  return {
    type: cleanAuditToken(typeMatch?.[1]),
    sequence: cleanAuditToken(sequenceMatch?.[1]),
    pid: cleanAuditToken(pidMatch?.[1]),
    user: extractFirstMatch(raw, AUDIT_ACCOUNT_PATTERNS),
    operation: cleanAuditToken(operationMatch?.[1]),
    result: cleanAuditToken(resultMatch?.[1]),
    address: cleanAuditToken(addressMatch?.[1]),
    hostname: cleanAuditToken(hostnameMatch?.[1]),
    process,
  };
}

function extractEventOriginal(fields?: (RealtimeLogFields & Record<string, unknown>) | undefined): string {
  const eventValue = fields?.event;
  if (!eventValue || typeof eventValue !== 'object') {
    return '';
  }
  const original = (eventValue as Record<string, unknown>).original;
  return typeof original === 'string' ? original : '';
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = cleanAuditToken(value);
    if (normalized) {
      return normalized;
    }
  }
  return '';
}

export function mapAuditLogEntry(entry: LogEntry): AuditLogItem {
  const fields = entry.fields as (RealtimeLogFields & Record<string, unknown>) | undefined;
  const original = extractEventOriginal(fields);
  const rawMessage = firstNonEmpty(entry.message, original, entry.rawLog);
  const parsed = parseAuditMessage(rawMessage);
  const resolvedIP = firstNonEmpty(
    isIPAddress(parsed.address) ? parsed.address : '',
    isIPAddress(parsed.hostname) ? parsed.hostname : '',
    entry.hostIp,
  );
  const action = parsed.type || 'AUDIT';
  const resourceType = parsed.process || entry.service || 'audit';
  const resourceID = firstNonEmpty(parsed.sequence, parsed.pid, entry.id);

  return {
    id: entry.id,
    tenant_id: typeof fields?.tenant_id === 'string' ? fields.tenant_id : undefined,
    user_id: firstNonEmpty(parsed.user, entry.host) || '—',
    action,
    resource_type: resourceType,
    resource_id: resourceID,
    ip_address: resolvedIP || undefined,
    created_at: entry.timestamp,
    detail: {
      operation: parsed.operation || undefined,
      result: parsed.result || undefined,
      process: parsed.process || undefined,
      pid: parsed.pid || undefined,
      sequence: parsed.sequence || undefined,
      host: entry.host || undefined,
      source: typeof fields?.source === 'string' ? fields.source : (typeof fields?.source_path === 'string' ? fields.source_path : undefined),
      raw_message: rawMessage,
    },
  };
}

function buildAuditKeywords(params: FetchAuditLogsParams): string {
  const tokens: string[] = [];
  if (params.user_id?.trim()) {
    tokens.push(params.user_id.trim());
  }
  if (params.action?.trim()) {
    tokens.push(`type=${params.action.trim()}`);
  }
  if (params.resource_type?.trim()) {
    tokens.push(params.resource_type.trim());
  }
  return tokens.join(' ');
}

async function fetchAuditLogsFromQueryPipeline(params: FetchAuditLogsParams = {}): Promise<FetchAuditLogsResult> {
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 20;
  const result = await queryRealtimeLogs({
    keywords: buildAuditKeywords(params),
    page,
    pageSize,
    filters: {
      service: 'audit.log',
      exclude_internal_noise: false,
    },
    timeRange: {
      from: params.from,
      to: params.to,
    },
    recordHistory: false,
  });

  return {
    items: result.hits.map(mapAuditLogEntry),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    hasNext: result.hasNext,
  };
}

async function fetchAuditLogsFromAuditApi(params: FetchAuditLogsParams = {}): Promise<FetchAuditLogsResult> {
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 20;

  const envelope = await requestAuditApi<{ items: AuditLogItem[] }>('/logs', {
    method: 'GET',
    query: {
      user_id: params.user_id,
      action: params.action,
      resource_type: params.resource_type,
      from: params.from,
      to: params.to,
      page,
      page_size: pageSize,
      sort_by: params.sort_by,
      sort_order: params.sort_order,
    },
  });

  const items = envelope.data?.items ?? [];
  const metaTotal = envelope.meta?.total;
  const total = typeof metaTotal === 'number' ? metaTotal : (typeof metaTotal === 'string' ? parseInt(metaTotal, 10) : items.length);
  const hasNext = envelope.meta?.has_next ?? (page * pageSize < total);

  return {
    items,
    total: Number.isFinite(total) ? total : items.length,
    page,
    pageSize,
    hasNext: Boolean(hasNext),
  };
}

export async function fetchAuditLogs(params: FetchAuditLogsParams = {}): Promise<FetchAuditLogsResult> {
  try {
    return await fetchAuditLogsFromQueryPipeline(params);
  } catch (queryError) {
    try {
      return await fetchAuditLogsFromAuditApi(params);
    } catch {
      throw queryError;
    }
  }
}

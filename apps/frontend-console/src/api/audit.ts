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
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  user_query?: string;
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
      source_kind: 'system',
      source: typeof fields?.source === 'string' ? fields.source : (typeof fields?.source_path === 'string' ? fields.source_path : undefined),
      raw_message: rawMessage,
    },
  };
}

function normalizeAuditApiItem(item: AuditLogItem): AuditLogItem {
  const detail = item.detail && typeof item.detail === 'object' ? { ...item.detail } : {};
  return {
    ...item,
    detail: {
      source_kind: 'application',
      ...detail,
    },
  };
}

function compareAuditItemsByCreatedAt(left: AuditLogItem, right: AuditLogItem): number {
  const leftTime = Date.parse(left.created_at || '');
  const rightTime = Date.parse(right.created_at || '');
  return rightTime - leftTime;
}

interface AuditLogSourceCacheEntry {
  items: AuditLogItem[];
  total: number;
  hasNext: boolean;
  loadedPages: number;
}

const AUDIT_SOURCE_CACHE_LIMIT = 24;
const auditApiPageCache = new Map<string, AuditLogSourceCacheEntry>();
const auditApiFilteredCache = new Map<string, AuditLogSourceCacheEntry>();
const queryPipelinePageCache = new Map<string, AuditLogSourceCacheEntry>();

function resolveAuditFetchWindow(params: FetchAuditLogsParams): { page: number; pageSize: number; windowSize: number } {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, params.page_size ?? 20);
  return {
    page,
    pageSize,
    windowSize: page * pageSize,
  };
}

function createAuditLogSourceCacheEntry(): AuditLogSourceCacheEntry {
  return {
    items: [],
    total: 0,
    hasNext: true,
    loadedPages: 0,
  };
}

function touchAuditLogSourceCache(
  cache: Map<string, AuditLogSourceCacheEntry>,
  key: string,
): AuditLogSourceCacheEntry | undefined {
  const entry = cache.get(key);
  if (!entry) {
    return undefined;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

function setAuditLogSourceCache(
  cache: Map<string, AuditLogSourceCacheEntry>,
  key: string,
  entry: AuditLogSourceCacheEntry,
): void {
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, entry);
  while (cache.size > AUDIT_SOURCE_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    cache.delete(oldestKey);
  }
}

function normalizeAuditUserQuery(value?: string): string {
  return (value ?? '').trim();
}

function buildAuditSourceCacheKey(source: string, params: FetchAuditLogsParams, pageSize?: number): string {
  return JSON.stringify({
    source,
    user_query: normalizeAuditUserQuery(params.user_query),
    action: params.action?.trim() ?? '',
    resource_type: params.resource_type?.trim() ?? '',
    from: params.from?.trim() ?? '',
    to: params.to?.trim() ?? '',
    sort_by: params.sort_by?.trim() ?? '',
    sort_order: params.sort_order?.trim() ?? '',
    page_size: pageSize ?? 0,
  });
}

function resolveAuditApiUserIdFilter(userQuery?: string): string | undefined {
  const normalized = normalizeAuditUserQuery(userQuery);
  return UUID_PATTERN.test(normalized) ? normalized : undefined;
}

function readAuditDetailString(detail: Record<string, unknown> | undefined, key: string): string {
  const value = detail?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function matchesAuditUserQuery(item: AuditLogItem, userQuery?: string): boolean {
  const normalizedQuery = normalizeAuditUserQuery(userQuery).toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const detail = item.detail && typeof item.detail === 'object' ? item.detail : undefined;
  const candidates = [
    item.user_id,
    item.resource_id,
    readAuditDetailString(detail, 'username'),
    readAuditDetailString(detail, 'target_user_id'),
    readAuditDetailString(detail, 'raw_message'),
  ];

  return candidates.some((candidate) => candidate.toLowerCase().includes(normalizedQuery));
}

function buildAuditKeywords(params: FetchAuditLogsParams): string {
  const tokens: string[] = [];
  if (params.user_query?.trim()) {
    tokens.push(params.user_query.trim());
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
  const { page, pageSize } = resolveAuditFetchWindow(params);
  const result = await queryRealtimeLogs({
    keywords: buildAuditKeywords(params),
    page: 1,
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
    page,
    pageSize,
    hasNext: result.total > pageSize,
  };
}

async function fetchBoundedAuditLogsFromQueryPipeline(params: FetchAuditLogsParams = {}): Promise<FetchAuditLogsResult> {
  const { page, pageSize } = resolveAuditFetchWindow(params);
  const cacheKey = buildAuditSourceCacheKey('query-pipeline-window', params, pageSize);
  let cacheEntry = touchAuditLogSourceCache(queryPipelinePageCache, cacheKey) ?? createAuditLogSourceCacheEntry();

  while (cacheEntry.loadedPages < page && (cacheEntry.loadedPages === 0 || cacheEntry.hasNext)) {
    const nextPage = cacheEntry.loadedPages + 1;
    const nextWindowSize = nextPage * pageSize;
    const result = await queryRealtimeLogs({
      keywords: buildAuditKeywords(params),
      page: 1,
      pageSize: nextWindowSize,
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

    cacheEntry = {
      items: result.hits.map(mapAuditLogEntry),
      total: result.total,
      hasNext: result.total > nextWindowSize,
      loadedPages: nextPage,
    };
    setAuditLogSourceCache(queryPipelinePageCache, cacheKey, cacheEntry);

    if (!cacheEntry.hasNext) {
      break;
    }
  }

  return {
    items: cacheEntry.items,
    total: cacheEntry.total,
    page,
    pageSize,
    hasNext: page * pageSize < cacheEntry.total,
  };
}

async function requestAuditLogPage(
  params: FetchAuditLogsParams,
  requestPage: number,
  requestPageSize: number,
  userIDFilter?: string,
): Promise<FetchAuditLogsResult> {
  const envelope = await requestAuditApi<{ items: AuditLogItem[] }>('/logs', {
    method: 'GET',
    query: {
      user_id: userIDFilter,
      action: params.action,
      resource_type: params.resource_type,
      from: params.from,
      to: params.to,
      page: requestPage,
      page_size: requestPageSize,
      sort_by: params.sort_by,
      sort_order: params.sort_order,
    },
  });

  const items = (envelope.data?.items ?? []).map(normalizeAuditApiItem);
  const metaTotal = envelope.meta?.total;
  const total = typeof metaTotal === 'number' ? metaTotal : (typeof metaTotal === 'string' ? parseInt(metaTotal, 10) : items.length);
  const metaHasNext = envelope.meta?.has_next;
  const hasNext = typeof metaHasNext === 'boolean' ? metaHasNext : requestPage * requestPageSize < total;

  return {
    items,
    total: Number.isFinite(total) ? total : items.length,
    page: requestPage,
    pageSize: requestPageSize,
    hasNext,
  };
}

async function fetchBoundedAuditApiPages(
  params: FetchAuditLogsParams,
  page: number,
  pageSize: number,
  userIDFilter?: string,
): Promise<FetchAuditLogsResult> {
  const cacheKey = buildAuditSourceCacheKey('audit-api-page', params, pageSize);
  let cacheEntry = touchAuditLogSourceCache(auditApiPageCache, cacheKey) ?? createAuditLogSourceCacheEntry();

  while (cacheEntry.loadedPages < page && (cacheEntry.loadedPages === 0 || cacheEntry.hasNext)) {
    const nextPage = cacheEntry.loadedPages + 1;
    const batch = await requestAuditLogPage(params, nextPage, pageSize, userIDFilter);
    cacheEntry = {
      items: [...cacheEntry.items, ...batch.items],
      total: batch.total,
      hasNext: batch.hasNext,
      loadedPages: nextPage,
    };
    setAuditLogSourceCache(auditApiPageCache, cacheKey, cacheEntry);

    if (!batch.hasNext) {
      break;
    }
  }

  return {
    items: cacheEntry.items,
    total: cacheEntry.total,
    page,
    pageSize,
    hasNext: cacheEntry.hasNext,
  };
}

async function fetchBoundedAuditApiFilteredLogs(
  params: FetchAuditLogsParams,
  page: number,
  pageSize: number,
  userQuery: string,
): Promise<FetchAuditLogsResult> {
  const cacheKey = buildAuditSourceCacheKey('audit-api-filtered', params);
  const cachedEntry = touchAuditLogSourceCache(auditApiFilteredCache, cacheKey);

  if (cachedEntry) {
    return {
      items: cachedEntry.items,
      total: cachedEntry.total,
      page,
      pageSize,
      hasNext: page * pageSize < cachedEntry.total,
    };
  }

  const batchSize = 200;
  let requestPageNumber = 1;
  let hasNext = true;
  let total = 0;
  const matchedItems: AuditLogItem[] = [];

  while (hasNext) {
    const batch = await requestAuditLogPage(params, requestPageNumber, batchSize);
    const matchingItems = batch.items.filter((item) => matchesAuditUserQuery(item, userQuery));
    matchedItems.push(...matchingItems);
    total += matchingItems.length;
    hasNext = batch.hasNext;
    requestPageNumber += 1;
  }

  setAuditLogSourceCache(auditApiFilteredCache, cacheKey, {
    items: matchedItems,
    total,
    hasNext: false,
    loadedPages: requestPageNumber - 1,
  });

  return {
    items: matchedItems,
    total,
    page,
    pageSize,
    hasNext: page * pageSize < total,
  };
}

async function fetchAuditLogsFromAuditApi(params: FetchAuditLogsParams = {}): Promise<FetchAuditLogsResult> {
  const { page, pageSize } = resolveAuditFetchWindow(params);
  const userQuery = normalizeAuditUserQuery(params.user_query);
  const auditApiUserIDFilter = resolveAuditApiUserIdFilter(userQuery);

  if (!userQuery || auditApiUserIDFilter) {
    return requestAuditLogPage(params, 1, pageSize, auditApiUserIDFilter);
  }

  const batchSize = 200;
  let requestPageNumber = 1;
  let hasNext = true;
  let total = 0;
  const matchedItems: AuditLogItem[] = [];

  while (hasNext) {
    const batch = await requestAuditLogPage(params, requestPageNumber, batchSize);
    const matchingItems = batch.items.filter((item) => matchesAuditUserQuery(item, userQuery));
    matchedItems.push(...matchingItems);
    total += matchingItems.length;
    hasNext = batch.hasNext;
    requestPageNumber += 1;
  }

  return {
    items: matchedItems,
    total,
    page,
    pageSize,
    hasNext: total > pageSize,
  };
}

async function fetchBoundedAuditLogsFromAuditApi(params: FetchAuditLogsParams = {}): Promise<FetchAuditLogsResult> {
  const { page, pageSize } = resolveAuditFetchWindow(params);
  const userQuery = normalizeAuditUserQuery(params.user_query);
  const auditApiUserIDFilter = resolveAuditApiUserIdFilter(userQuery);

  if (!userQuery || auditApiUserIDFilter) {
    return fetchBoundedAuditApiPages(params, page, pageSize, auditApiUserIDFilter);
  }

  return fetchBoundedAuditApiFilteredLogs(params, page, pageSize, userQuery);
}

async function fetchAuditLogsWithSlidingWindow(params: FetchAuditLogsParams = {}): Promise<FetchAuditLogsResult> {
  const { page, pageSize, windowSize } = resolveAuditFetchWindow(params);
  const mergedParams: FetchAuditLogsParams = {
    ...params,
    page: 1,
    page_size: windowSize,
  };

  const [applicationResult, systemResult] = await Promise.allSettled([
    fetchAuditLogsFromAuditApi(mergedParams),
    fetchAuditLogsFromQueryPipeline(mergedParams),
  ]);

  const applicationItems = applicationResult.status === 'fulfilled' ? applicationResult.value.items : [];
  const applicationTotal = applicationResult.status === 'fulfilled' ? applicationResult.value.total : 0;
  const systemItems = systemResult.status === 'fulfilled' ? systemResult.value.items : [];
  const systemTotal = systemResult.status === 'fulfilled' ? systemResult.value.total : 0;

  if (applicationResult.status === 'rejected' && systemResult.status === 'rejected') {
    throw applicationResult.reason instanceof Error ? applicationResult.reason : systemResult.reason;
  }

  const mergedItems = [...applicationItems, ...systemItems].sort(compareAuditItemsByCreatedAt);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const total = applicationTotal + systemTotal;

  return {
    items: mergedItems.slice(start, end),
    total,
    page,
    pageSize,
    hasNext: end < total,
  };
}

async function fetchAuditLogsWithBoundedWindow(params: FetchAuditLogsParams = {}): Promise<FetchAuditLogsResult> {
  const { page, pageSize } = resolveAuditFetchWindow(params);
  const boundedParams: FetchAuditLogsParams = {
    ...params,
    page,
    page_size: pageSize,
  };

  const [applicationResult, systemResult] = await Promise.allSettled([
    fetchBoundedAuditLogsFromAuditApi(boundedParams),
    fetchBoundedAuditLogsFromQueryPipeline(boundedParams),
  ]);

  const applicationItems = applicationResult.status === 'fulfilled' ? applicationResult.value.items : [];
  const applicationTotal = applicationResult.status === 'fulfilled' ? applicationResult.value.total : 0;
  const systemItems = systemResult.status === 'fulfilled' ? systemResult.value.items : [];
  const systemTotal = systemResult.status === 'fulfilled' ? systemResult.value.total : 0;

  if (applicationResult.status === 'rejected' && systemResult.status === 'rejected') {
    throw applicationResult.reason instanceof Error ? applicationResult.reason : systemResult.reason;
  }

  const mergedItems = [...applicationItems, ...systemItems].sort(compareAuditItemsByCreatedAt);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const total = applicationTotal + systemTotal;

  return {
    items: mergedItems.slice(start, end),
    total,
    page,
    pageSize,
    hasNext: end < total,
  };
}

export async function fetchAuditLogs(params: FetchAuditLogsParams = {}): Promise<FetchAuditLogsResult> {
  const normalizedTo = params.to?.trim();
  if (!normalizedTo) {
    return fetchAuditLogsWithSlidingWindow(params);
  }

  return fetchAuditLogsWithBoundedWindow({
    ...params,
    to: normalizedTo,
  });
}

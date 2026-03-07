import { getRuntimeConfig } from '../config/runtime-config';
import type { LogEntry, QueryHistory, RealtimeLogFields, SavedQuery } from '../types/log';
import { getAuthStorageItem } from '../utils/authStorage';

const ACCESS_TOKEN_KEY = 'nexuslog-access-token';
const TENANT_ID_KEY = 'nexuslog-tenant-id';
const TOKEN_EXPIRES_AT_KEY = 'nexuslog-token-expires-at';
const EMERGENCY_ACCESS_TOKEN_PREFIX = 'emergency-access-';
const LOCAL_QUERY_HISTORY_KEY = 'nexuslog-local-query-history';
const LOCAL_SAVED_QUERIES_KEY = 'nexuslog-local-saved-queries';
const LOCAL_QUERY_HISTORY_LIMIT = 200;
const LOCAL_QUERY_HISTORY_DEDUP_WINDOW_MS = 1500;
const LOG_LEVEL_TOKEN_PATTERN = /\b(trace|debug|info|warn(?:ing)?|error|fatal|panic)\b/i;
const ANSI_COLOR_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

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

interface QueryLogsApiHit {
  id?: string;
  timestamp?: string;
  level?: string;
  service?: string;
  message?: string;
  raw_log?: string;
  fields?: RealtimeLogFields & Record<string, unknown>;
}

interface QueryLogsApiData {
  hits?: QueryLogsApiHit[];
  aggregations?: Record<string, unknown>;
}

interface QueryHistoryApiItem {
  id?: string;
  query?: string;
  executed_at?: string;
  duration_ms?: number;
  result_count?: number;
}

interface SavedQueryApiItem {
  id?: string;
  name?: string;
  query?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  run_count?: number;
}

interface ListData<TItem> {
  items?: TItem[];
}

interface QueryLogsPayload {
  keywords: string;
  page: number;
  pageSize: number;
  filters?: Record<string, unknown>;
  timeRange?: {
    from?: string;
    to?: string;
  };
  /** 仅用于前端本地功能：是否写入本地查询历史 */
  recordHistory?: boolean;
}

export interface QueryLogsResult {
  hits: LogEntry[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  queryTimeMS: number;
  timedOut: boolean;
  aggregations: Record<string, unknown>;
}

export interface QueryHistoryListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  from?: string;
  to?: string;
}

export interface QueryHistoryListResult {
  items: QueryHistory[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

export interface SavedQueryListParams {
  page: number;
  pageSize: number;
  tag?: string;
  keyword?: string;
}

export interface SavedQueryListResult {
  items: SavedQuery[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

export interface SavedQueryUpsertPayload {
  name: string;
  query: string;
  tags: string[];
  description?: string;
  filters?: Record<string, unknown>;
}

/** Dashboard overview stats from GET /api/v1/query/stats/overview */
export interface DashboardOverviewStats {
  total_logs: number;
  level_distribution: Record<string, number>;
  top_sources: Array<{ source: string; count: number }>;
  alert_summary: { total: number; firing: number; resolved: number };
  log_trend: Array<{ time: string; count: number }>;
}

type QueryApiAuthErrorCode =
  | 'AUTH_UNAUTHORIZED';

class QueryApiAuthError extends Error {
  readonly code: QueryApiAuthErrorCode;
  readonly status: number;

  constructor(code: QueryApiAuthErrorCode, message: string, status = 401) {
    super(message);
    this.name = 'QueryApiAuthError';
    this.code = code;
    this.status = status;
  }
}

class QueryApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'QueryApiRequestError';
    this.status = status;
    this.code = code;
  }
}

function normalizeApiBaseUrl(rawBaseUrl: string): string {
  const normalized = (rawBaseUrl || '/api/v1').trim();
  if (!normalized) {
    return '/api/v1';
  }
  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function resolveTenantId(config: RuntimeConfigWithTenant): string {
  const localTenant = window.localStorage.getItem(TENANT_ID_KEY)?.trim();
  if (localTenant) {
    return localTenant;
  }
  return (config.tenantId ?? config.tenantID ?? '').trim();
}

function unwrapMessageForLevel(message: unknown): string {
  const raw = String(message ?? '').trim();
  if (!raw) {
    return '';
  }
  if (!raw.startsWith('{') || !raw.endsWith('}')) {
    return raw;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return raw;
    }
    const payload = parsed as Record<string, unknown>;
    for (const key of ['log', 'message', 'msg', 'raw_log']) {
      const candidate = String(payload[key] ?? '').trim();
      if (!candidate) {
        continue;
      }
      return candidate;
    }
    return raw;
  } catch {
    return raw;
  }
}

function sanitizeDisplayMessage(message: string): string {
  if (!message) {
    return '';
  }
  let cleaned = message.replace(ANSI_COLOR_PATTERN, '');
  cleaned = cleaned.replace(/\r\n?/g, '\n');
  cleaned = cleaned.replace(/\t/g, ' ');
  cleaned = cleaned.replace(CONTROL_CHAR_PATTERN, ' ');
  cleaned = cleaned.replace(/\n+/g, ' ');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  return cleaned.trim();
}

function normalizeDisplayMessage(message: unknown): string {
  const raw = String(message ?? '').trim();
  if (!raw) {
    return '';
  }
  const unwrapped = unwrapMessageForLevel(raw);
  return sanitizeDisplayMessage(unwrapped || raw);
}

function detectExplicitLevelFromMessage(message: unknown): LogEntry['level'] | null {
  const text = unwrapMessageForLevel(message);
  if (!text) {
    return null;
  }
  const matched = text.match(LOG_LEVEL_TOKEN_PATTERN);
  if (!matched?.[1]) {
    return null;
  }
  const token = matched[1].trim().toLowerCase();
  if (token === 'warn' || token === 'warning') {
    return 'warn';
  }
  if (token === 'error' || token === 'fatal' || token === 'panic') {
    return 'error';
  }
  if (token === 'debug' || token === 'trace') {
    return 'debug';
  }
  if (token === 'info') {
    return 'info';
  }
  return null;
}

function earliestKeywordIndex(text: string, keywords: string[]): number {
  let result = -1;
  keywords.forEach((keyword) => {
    const index = text.indexOf(keyword);
    if (index < 0) {
      return;
    }
    if (result < 0 || index < result) {
      result = index;
    }
  });
  return result;
}

function normalizeLevel(rawLevel: unknown, message: unknown): LogEntry['level'] {
  const level = String(rawLevel ?? '').trim().toLowerCase();
  if (level === 'error') return 'error';
  if (level === 'warn' || level === 'warning') return 'warn';
  if (level === 'debug') return 'debug';
  if (level === 'info') return 'info';

  const explicit = detectExplicitLevelFromMessage(message);
  if (explicit) {
    return explicit;
  }

  const text = String(message ?? '').toLowerCase();
  const warnIndex = earliestKeywordIndex(text, ['warn', 'warning']);
  const errorIndex = earliestKeywordIndex(text, ['error', 'panic', 'fatal', 'fail']);
  if (warnIndex >= 0 && (errorIndex < 0 || warnIndex < errorIndex)) {
    return 'warn';
  }
  if (errorIndex >= 0) {
    return 'error';
  }
  if (text.includes('debug')) {
    return 'debug';
  }
  return 'info';
}

function normalizeHit(hit: QueryLogsApiHit, index: number): LogEntry {
  const fields = (hit.fields ?? {}) as RealtimeLogFields & Record<string, unknown>;
  const timestamp = String(hit.timestamp ?? fields.timestamp ?? fields.collect_time ?? '').trim() || new Date().toISOString();
  const sourceMessage = String(hit.message ?? fields.message ?? '').trim();
  const rawLogSource = hit.raw_log ?? fields.raw_message ?? fields.raw_log ?? fields['data'] ?? sourceMessage;
  const rawLog = String(rawLogSource || sourceMessage).trim();
  const message = normalizeDisplayMessage(sourceMessage || rawLog) || '(empty message)';
  const service = String(
    hit.service
      ?? fields.service_name
      ?? fields.service
      ?? fields.service_instance_id
      ?? fields.container_name
      ?? fields.agent_id
      ?? fields['source_id']
      ?? 'unknown',
  ).trim() || 'unknown';

  return {
    id: String(hit.id ?? fields.event_id ?? fields['record_id'] ?? `log-${index + 1}`).trim() || `log-${index + 1}`,
    timestamp,
    level: normalizeLevel(hit.level ?? fields.level, sourceMessage || rawLog || message),
    service,
    message,
    rawLog,
    fields,
  };
}

function normalizeQueryHistory(item: QueryHistoryApiItem, index: number): QueryHistory {
  return {
    id: String(item.id ?? `query-history-${index + 1}`),
    query: String(item.query ?? ''),
    executedAt: String(item.executed_at ?? new Date().toISOString()),
    duration: Number(item.duration_ms ?? 0),
    resultCount: Number(item.result_count ?? 0),
  };
}

function normalizeSavedQuery(item: SavedQueryApiItem, index: number): SavedQuery {
  const tags = Array.isArray(item.tags)
    ? item.tags
      .map((tag) => String(tag).trim())
      .filter(Boolean)
    : [];
  return {
    id: String(item.id ?? `saved-query-${index + 1}`),
    name: String(item.name ?? '未命名查询'),
    query: String(item.query ?? ''),
    tags,
    createdAt: String(item.created_at ?? new Date().toISOString()),
  };
}

function toPositiveNumber(raw: unknown, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function createLocalID(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

function readLocalList<T>(storageKey: string): T[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as T[];
  } catch {
    return [];
  }
}

function writeLocalList<T>(storageKey: string, items: T[]): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(items));
  } catch {
    // ignore localStorage write errors
  }
}

function readLocalQueryHistory(): QueryHistory[] {
  const rawItems = readLocalList<QueryHistory>(LOCAL_QUERY_HISTORY_KEY);
  return rawItems
    .filter((item) => Boolean(item?.id) && Boolean(item?.query))
    .map((item) => ({
      id: String(item.id),
      query: String(item.query),
      executedAt: String(item.executedAt ?? new Date().toISOString()),
      duration: Number(item.duration ?? 0),
      resultCount: Number(item.resultCount ?? 0),
    }));
}

function writeLocalQueryHistory(items: QueryHistory[]): void {
  writeLocalList(LOCAL_QUERY_HISTORY_KEY, items);
}

function readLocalSavedQueries(): SavedQuery[] {
  const rawItems = readLocalList<SavedQuery>(LOCAL_SAVED_QUERIES_KEY);
  return rawItems
    .filter((item) => Boolean(item?.id) && Boolean(item?.name))
    .map((item) => ({
      id: String(item.id),
      name: String(item.name),
      query: String(item.query ?? ''),
      tags: Array.isArray(item.tags)
        ? item.tags.map((tag) => String(tag)).filter(Boolean)
        : [],
      createdAt: String(item.createdAt ?? new Date().toISOString()),
    }));
}

function writeLocalSavedQueries(items: SavedQuery[]): void {
  writeLocalList(LOCAL_SAVED_QUERIES_KEY, items);
}

function toPagedResult<T>(
  source: T[],
  page: number,
  pageSize: number,
): { items: T[]; total: number; page: number; pageSize: number; hasNext: boolean } {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const total = source.length;
  const start = (safePage - 1) * safePageSize;
  const items = source.slice(start, start + safePageSize);
  return {
    items,
    total,
    page: safePage,
    pageSize: safePageSize,
    hasNext: start + safePageSize < total,
  };
}

function buildLocalQueryHistoryResult(params: QueryHistoryListParams): QueryHistoryListResult {
  const keyword = params.keyword?.trim().toLowerCase() ?? '';
  const fromMs = params.from ? Date.parse(params.from) : Number.NaN;
  const toMs = params.to ? Date.parse(params.to) : Number.NaN;

  const filtered = readLocalQueryHistory()
    .filter((item) => {
      if (keyword && !item.query.toLowerCase().includes(keyword)) {
        return false;
      }
      const executedAtMs = Date.parse(item.executedAt);
      if (Number.isFinite(fromMs) && Number.isFinite(executedAtMs) && executedAtMs < fromMs) {
        return false;
      }
      if (Number.isFinite(toMs) && Number.isFinite(executedAtMs) && executedAtMs > toMs) {
        return false;
      }
      return true;
    })
    .sort((a, b) => Date.parse(b.executedAt) - Date.parse(a.executedAt));

  const paged = toPagedResult(filtered, params.page, params.pageSize);
  return {
    items: paged.items,
    total: paged.total,
    page: paged.page,
    pageSize: paged.pageSize,
    hasNext: paged.hasNext,
  };
}

function buildLocalSavedQueryResult(params: SavedQueryListParams): SavedQueryListResult {
  const keyword = params.keyword?.trim().toLowerCase() ?? '';
  const tag = params.tag?.trim() ?? '';

  const filtered = readLocalSavedQueries()
    .filter((item) => {
      if (keyword) {
        const inName = item.name.toLowerCase().includes(keyword);
        const inQuery = item.query.toLowerCase().includes(keyword);
        if (!inName && !inQuery) {
          return false;
        }
      }
      if (tag && !item.tags.includes(tag)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const paged = toPagedResult(filtered, params.page, params.pageSize);
  return {
    items: paged.items,
    total: paged.total,
    page: paged.page,
    pageSize: paged.pageSize,
    hasNext: paged.hasNext,
  };
}

function appendLocalQueryHistory(query: string, durationMS: number, resultCount: number): void {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return;
  }
  const current = readLocalQueryHistory();
  const nowMs = Date.now();
  const latest = current[0];
  if (
    latest
    && latest.query === trimmedQuery
    && Number.isFinite(Date.parse(latest.executedAt))
    && nowMs - Date.parse(latest.executedAt) <= LOCAL_QUERY_HISTORY_DEDUP_WINDOW_MS
  ) {
    latest.duration = Math.max(0, Math.floor(durationMS));
    latest.resultCount = Math.max(0, Math.floor(resultCount));
    writeLocalQueryHistory(current);
    return;
  }
  const next: QueryHistory = {
    id: createLocalID('query-history'),
    query: trimmedQuery,
    executedAt: new Date(nowMs).toISOString(),
    duration: Math.max(0, Math.floor(durationMS)),
    resultCount: Math.max(0, Math.floor(resultCount)),
  };
  current.unshift(next);
  writeLocalQueryHistory(current.slice(0, LOCAL_QUERY_HISTORY_LIMIT));
}

function saveLocalSavedQuery(item: SavedQuery): SavedQuery {
  const current = readLocalSavedQueries();
  const existingIndex = current.findIndex((candidate) => candidate.id === item.id);
  if (existingIndex >= 0) {
    current[existingIndex] = item;
  } else {
    current.unshift(item);
  }
  writeLocalSavedQueries(current);
  return item;
}

function removeLocalSavedQuery(savedQueryID: string): boolean {
  const current = readLocalSavedQueries();
  const next = current.filter((item) => item.id !== savedQueryID);
  if (next.length === current.length) {
    return false;
  }
  writeLocalSavedQueries(next);
  return true;
}

function removeLocalQueryHistory(historyID: string): boolean {
  const current = readLocalQueryHistory();
  const next = current.filter((item) => item.id !== historyID);
  if (next.length === current.length) {
    return false;
  }
  writeLocalQueryHistory(next);
  return true;
}

function shouldFallbackToLocalStore(error: unknown): boolean {
  if (error instanceof QueryApiAuthError) {
    return true;
  }
  if (!(error instanceof QueryApiRequestError)) {
    return false;
  }
  if (error.status >= 500 || error.status === 404) {
    return true;
  }
  return error.code === 'QUERY_SERVICE_UNAVAILABLE' || error.code === 'QUERY_INTERNAL_ERROR';
}

function getQueryApiBasePath(): string {
  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  const apiBaseUrl = normalizeApiBaseUrl(runtimeConfig.apiBaseUrl || '/api/v1');
  return `${apiBaseUrl}/query`;
}

function resolveAccessToken(): string {
  const accessToken = getAuthStorageItem(ACCESS_TOKEN_KEY)?.trim() ?? '';
  if (!accessToken) {
    return '';
  }
  const expiresAtRaw = getAuthStorageItem(TOKEN_EXPIRES_AT_KEY)?.trim() ?? '';
  if (expiresAtRaw) {
    const expiresAtMs = Number(expiresAtRaw);
    if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
      return '';
    }
  }

  return accessToken;
}

function buildAuthHeaders(accessToken: string): Record<string, string> {
  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  const tenantId = resolveTenantId(runtimeConfig);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

async function requestQueryApi<TData>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<ApiEnvelope<TData>> {
  const accessToken = resolveAccessToken();
  const url = new URL(`${getQueryApiBasePath()}${path}`, window.location.origin);
  const query = options.query ?? {};
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    url.searchParams.set(key, String(value));
  });

  const response = await fetch(url.pathname + url.search, {
    method: options.method ?? 'GET',
    headers: buildAuthHeaders(accessToken),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const envelope = (await response.json().catch(() => null)) as ApiEnvelope<TData> | null;
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new QueryApiAuthError(
        'AUTH_UNAUTHORIZED',
        envelope?.message ?? '当前会话未授权，请重新登录',
        response.status,
      );
    }
    throw new QueryApiRequestError(
      response.status,
      envelope?.code ?? 'QUERY_API_REQUEST_FAILED',
      envelope?.message ?? `query api request failed: HTTP ${response.status}`,
    );
  }
  return envelope ?? {
    code: 'OK',
    message: 'success',
    data: undefined,
    meta: {},
  };
}

function shouldUseQueryCollectionFallback(): boolean {
  const accessToken = resolveAccessToken();
  if (!accessToken) {
    return true;
  }
  return accessToken.startsWith(EMERGENCY_ACCESS_TOKEN_PREFIX);
}

/** Fetch dashboard overview stats */
export async function fetchDashboardOverview(): Promise<DashboardOverviewStats> {
  const envelope = await requestQueryApi<DashboardOverviewStats>('/stats/overview', { method: 'GET' });
  const data = envelope.data;
  if (!data) {
    throw new QueryApiRequestError(500, 'QUERY_STATS_EMPTY', 'Overview stats empty');
  }
  return {
    total_logs: Number(data.total_logs) || 0,
    level_distribution: data.level_distribution ?? {},
    top_sources: data.top_sources ?? [],
    alert_summary: data.alert_summary ?? { total: 0, firing: 0, resolved: 0 },
    log_trend: data.log_trend ?? [],
  };
}

export async function queryRealtimeLogs(payload: QueryLogsPayload): Promise<QueryLogsResult> {
  const envelope = await requestQueryApi<QueryLogsApiData>('/logs', {
    method: 'POST',
    body: {
      keywords: payload.keywords.trim(),
      page: payload.page,
      page_size: payload.pageSize,
      filters: payload.filters ?? {},
      time_range: {
        from: payload.timeRange?.from ?? '',
        to: payload.timeRange?.to ?? '',
      },
      sort: [{ field: '@timestamp', order: 'desc' }],
      record_history: payload.recordHistory === true,
    },
  });

  const hits = (envelope.data?.hits ?? []).map(normalizeHit);
  const total = Number(envelope.meta?.total ?? hits.length);
  const page = Number(envelope.meta?.page ?? payload.page);
  const pageSize = Number(envelope.meta?.page_size ?? payload.pageSize);
  const hasNext = Boolean(envelope.meta?.has_next ?? page * pageSize < total);
  const queryTimeMS = Number(envelope.meta?.query_time_ms ?? 0);
  const timedOut = Boolean(envelope.meta?.timed_out ?? false);

  const result: QueryLogsResult = {
    hits,
    total: Number.isFinite(total) ? total : hits.length,
    page: Number.isFinite(page) ? page : payload.page,
    pageSize: Number.isFinite(pageSize) ? pageSize : payload.pageSize,
    hasNext,
    queryTimeMS: Number.isFinite(queryTimeMS) ? queryTimeMS : 0,
    timedOut,
    aggregations: envelope.data?.aggregations ?? {},
  };
  if (payload.recordHistory) {
    appendLocalQueryHistory(payload.keywords, result.queryTimeMS, result.total);
  }
  return result;
}

export async function fetchQueryHistory(params: QueryHistoryListParams): Promise<QueryHistoryListResult> {
  if (shouldUseQueryCollectionFallback()) {
    return buildLocalQueryHistoryResult(params);
  }

  try {
    const envelope = await requestQueryApi<ListData<QueryHistoryApiItem>>('/history', {
      method: 'GET',
      query: {
        page: params.page,
        page_size: params.pageSize,
        keyword: params.keyword?.trim(),
        from: params.from,
        to: params.to,
      },
    });
    const items = (envelope.data?.items ?? []).map(normalizeQueryHistory);
    const total = toPositiveNumber(envelope.meta?.total, items.length);
    const page = toPositiveNumber(envelope.meta?.page, params.page);
    const pageSize = toPositiveNumber(envelope.meta?.page_size, params.pageSize);
    const backendResult: QueryHistoryListResult = {
      items,
      total,
      page,
      pageSize,
      hasNext: Boolean(envelope.meta?.has_next ?? page * pageSize < total),
    };
    if (backendResult.total === 0) {
      const localResult = buildLocalQueryHistoryResult(params);
      if (localResult.total > 0) {
        return localResult;
      }
    }
    return backendResult;
  } catch (error) {
    if (shouldFallbackToLocalStore(error)) {
      return buildLocalQueryHistoryResult(params);
    }
    throw error;
  }
}

export async function deleteQueryHistory(historyID: string): Promise<boolean> {
  if (shouldUseQueryCollectionFallback()) {
    return removeLocalQueryHistory(historyID);
  }

  try {
    const envelope = await requestQueryApi<{ deleted?: boolean }>(`/history/${encodeURIComponent(historyID)}`, {
      method: 'DELETE',
    });
    return Boolean(envelope.data?.deleted);
  } catch (error) {
    if (shouldFallbackToLocalStore(error)) {
      return removeLocalQueryHistory(historyID);
    }
    throw error;
  }
}

export async function fetchSavedQueries(params: SavedQueryListParams): Promise<SavedQueryListResult> {
  if (shouldUseQueryCollectionFallback()) {
    return buildLocalSavedQueryResult(params);
  }

  try {
    const envelope = await requestQueryApi<ListData<SavedQueryApiItem>>('/saved', {
      method: 'GET',
      query: {
        page: params.page,
        page_size: params.pageSize,
        tag: params.tag?.trim(),
        keyword: params.keyword?.trim(),
      },
    });
    const items = (envelope.data?.items ?? []).map(normalizeSavedQuery);
    const total = toPositiveNumber(envelope.meta?.total, items.length);
    const page = toPositiveNumber(envelope.meta?.page, params.page);
    const pageSize = toPositiveNumber(envelope.meta?.page_size, params.pageSize);
    const backendResult: SavedQueryListResult = {
      items,
      total,
      page,
      pageSize,
      hasNext: Boolean(envelope.meta?.has_next ?? page * pageSize < total),
    };
    if (backendResult.total === 0) {
      const localResult = buildLocalSavedQueryResult(params);
      if (localResult.total > 0) {
        return localResult;
      }
    }
    return backendResult;
  } catch (error) {
    if (shouldFallbackToLocalStore(error)) {
      return buildLocalSavedQueryResult(params);
    }
    throw error;
  }
}

export async function createSavedQuery(payload: SavedQueryUpsertPayload): Promise<SavedQuery> {
  const localItem: SavedQuery = {
    id: createLocalID('saved-query'),
    name: payload.name.trim() || '未命名查询',
    query: payload.query.trim(),
    tags: payload.tags,
    createdAt: new Date().toISOString(),
  };

  if (shouldUseQueryCollectionFallback()) {
    return saveLocalSavedQuery(localItem);
  }

  try {
    const envelope = await requestQueryApi<{ item?: SavedQueryApiItem; saved_query_id?: string }>('/saved', {
      method: 'POST',
      body: {
        name: payload.name,
        query: payload.query,
        tags: payload.tags,
        description: payload.description ?? '',
        filters: payload.filters ?? {},
      },
    });
    const item = envelope.data?.item ?? {
      id: envelope.data?.saved_query_id,
      name: payload.name,
      query: payload.query,
      tags: payload.tags,
      created_at: new Date().toISOString(),
    };
    const normalized = normalizeSavedQuery(item, 0);
    saveLocalSavedQuery(normalized);
    return normalized;
  } catch (error) {
    if (shouldFallbackToLocalStore(error)) {
      return saveLocalSavedQuery(localItem);
    }
    throw error;
  }
}

export async function updateSavedQuery(savedQueryID: string, payload: SavedQueryUpsertPayload): Promise<SavedQuery> {
  const localItem: SavedQuery = {
    id: savedQueryID,
    name: payload.name.trim() || '未命名查询',
    query: payload.query.trim(),
    tags: payload.tags,
    createdAt: new Date().toISOString(),
  };

  if (shouldUseQueryCollectionFallback()) {
    return saveLocalSavedQuery(localItem);
  }

  try {
    const envelope = await requestQueryApi<{ item?: SavedQueryApiItem }>(`/saved/${encodeURIComponent(savedQueryID)}`, {
      method: 'PUT',
      body: {
        name: payload.name,
        query: payload.query,
        tags: payload.tags,
        description: payload.description ?? '',
        filters: payload.filters ?? {},
      },
    });
    const item = envelope.data?.item ?? {
      id: savedQueryID,
      name: payload.name,
      query: payload.query,
      tags: payload.tags,
      created_at: new Date().toISOString(),
    };
    const normalized = normalizeSavedQuery(item, 0);
    saveLocalSavedQuery(normalized);
    return normalized;
  } catch (error) {
    if (shouldFallbackToLocalStore(error)) {
      return saveLocalSavedQuery(localItem);
    }
    throw error;
  }
}

/** Aggregate stats request for POST /api/v1/query/stats/aggregate */
export interface FetchAggregateStatsParams {
  groupBy: 'level' | 'source' | 'hour';
  timeRange: '1h' | '6h' | '24h' | '7d';
  filters?: Record<string, unknown>;
}

/** Aggregate bucket from API */
export interface AggregateBucket {
  key: string;
  count: number;
}

/** Aggregate stats result */
export interface FetchAggregateStatsResult {
  buckets: AggregateBucket[];
}

/** Fetch aggregate stats from query API */
export async function fetchAggregateStats(params: FetchAggregateStatsParams): Promise<FetchAggregateStatsResult> {
  const envelope = await requestQueryApi<{ buckets?: AggregateBucket[] }>('/stats/aggregate', {
    method: 'POST',
    body: {
      group_by: params.groupBy,
      time_range: params.timeRange,
      filters: params.filters ?? {},
    },
  });

  const buckets = envelope.data?.buckets ?? [];
  return { buckets };
}

export async function deleteSavedQuery(savedQueryID: string): Promise<boolean> {
  if (shouldUseQueryCollectionFallback()) {
    return removeLocalSavedQuery(savedQueryID);
  }

  try {
    const envelope = await requestQueryApi<{ deleted?: boolean }>(`/saved/${encodeURIComponent(savedQueryID)}`, {
      method: 'DELETE',
    });
    const deleted = Boolean(envelope.data?.deleted);
    if (deleted) {
      removeLocalSavedQuery(savedQueryID);
    }
    return deleted;
  } catch (error) {
    if (shouldFallbackToLocalStore(error)) {
      return removeLocalSavedQuery(savedQueryID);
    }
    throw error;
  }
}

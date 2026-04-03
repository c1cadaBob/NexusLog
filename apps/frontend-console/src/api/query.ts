import { getRuntimeConfig } from '../config/runtime-config';
import type { LogEntry, QueryHistory, RealtimeLogFields, SavedQuery } from '../types/log';
import { getAuthStorageItem, resolveStoredAuthUserID } from '../utils/authStorage';

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
const RFC3164_HOSTNAME_PATTERN = /^[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+([^\s]+)\s+/;
const RFC5424_HOSTNAME_PATTERN = /^(?:<\d{1,3}>)?\d+\s+\S+\s+([^\s]+)\s+/;
const BOGUS_SERVICE_NAMES = new Set(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']);

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
  pitId?: string;
  searchAfter?: unknown[];
  signal?: AbortSignal;
  /** 仅用于前端本地功能：是否写入本地查询历史 */
  recordHistory?: boolean;
}

export interface QueryLogsResult {
  hits: LogEntry[];
  total: number;
  totalIsLowerBound: boolean;
  page: number;
  pageSize: number;
  hasNext: boolean;
  queryTimeMS: number;
  timedOut: boolean;
  aggregations: Record<string, unknown>;
  pitId?: string;
  nextSearchAfter?: unknown[];
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
  availableTags?: string[];
}

export interface SavedQueryUpsertPayload {
  name: string;
  query: string;
  tags: string[];
  description?: string;
  filters?: Record<string, unknown>;
}

export type DashboardOverviewRange = '24h' | '7d';

/** Dashboard top source summary from GET /api/v1/query/stats/overview */
export interface DashboardTopSource {
  source: string;
  host: string;
  service: string;
  count: number;
}

/** Dashboard overview stats from GET /api/v1/query/stats/overview */
export interface DashboardOverviewStats {
  total_logs: number;
  level_distribution: Record<string, number>;
  top_sources: DashboardTopSource[];
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

const IN_FLIGHT_QUERY_GET_REQUESTS = new Map<string, Promise<ApiEnvelope<unknown>>>();

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

function toHostString(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value == null || typeof value === 'object') {
    return '';
  }
  return String(value).trim();
}

function extractHostnameFromSyslogMessage(message: unknown): string {
  const text = unwrapMessageForLevel(message).trim();
  if (!text) {
    return '';
  }
  for (const pattern of [RFC3164_HOSTNAME_PATTERN, RFC5424_HOSTNAME_PATTERN]) {
    const matched = text.match(pattern);
    const hostname = matched?.[1]?.trim() ?? '';
    if (hostname && hostname !== '-') {
      return hostname;
    }
  }
  return '';
}

function toDisplayIP(value: unknown): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = toDisplayIP(item);
      if (normalized) {
        return normalized;
      }
    }
    return '';
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized && normalized !== '-' ? normalized : '';
  }
  if (value == null || typeof value === 'object') {
    return '';
  }
  const normalized = String(value).trim();
  return normalized && normalized !== '-' ? normalized : '';
}

export function resolveLogHost(fields: RealtimeLogFields & Record<string, unknown>, ...messages: unknown[]): string {
  const candidates = [
    fields.host,
    fields['host.name'],
    fields.hostname,
    fields.syslog_hostname,
    fields.server_id,
  ];
  for (const candidate of candidates) {
    const value = toHostString(candidate);
    if (value) {
      return value;
    }
  }
  for (const message of messages) {
    const hostname = extractHostnameFromSyslogMessage(message);
    if (hostname) {
      return hostname;
    }
  }
  return '—';
}

export function resolveLogHostIP(fields: RealtimeLogFields & Record<string, unknown>): string {
  const candidates = [
    fields.host_ip,
    fields['host.ip'],
    fields['hostIp'],
    fields['server_ip'],
    fields['agent.ip'],
    fields['agent_ip'],
  ];
  for (const candidate of candidates) {
    const value = toDisplayIP(candidate);
    if (value) {
      return value;
    }
  }
  return '—';
}

function extractServiceNameFromSourcePath(sourcePath: unknown): string {
  const raw = String(sourcePath ?? '').trim();
  if (!raw) {
    return '';
  }
  const normalized = raw.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  return segments.at(-1)?.trim() ?? '';
}

function toServiceString(value: unknown): string {
  const normalized = typeof value === 'string'
    ? value.trim()
    : value == null || typeof value === 'object'
      ? ''
      : String(value).trim();
  if (!normalized || BOGUS_SERVICE_NAMES.has(normalized.toLowerCase())) {
    return '';
  }
  if (normalized.startsWith('{') || normalized.startsWith('[')) {
    return '';
  }
  if (normalized.includes('{"') || normalized.includes('\\"') || /[\r\n\t]/.test(normalized)) {
    return '';
  }
  return normalized;
}

export function resolveLogService(fields: RealtimeLogFields & Record<string, unknown>, ...candidates: unknown[]): string {
  const directCandidates = [
    ...candidates,
    fields.service_name,
    fields.service,
    fields.container_name,
  ];
  for (const candidate of directCandidates) {
    const value = toServiceString(candidate);
    if (value) {
      return value;
    }
  }
  for (const sourceCandidate of [fields.source_path, fields.source, fields.source_internal]) {
    const value = extractServiceNameFromSourcePath(sourceCandidate);
    if (value) {
      return value;
    }
  }
  for (const fallback of [fields.service_instance_id, fields.agent_id, fields['source_id']]) {
    const value = toServiceString(fallback);
    if (value) {
      return value;
    }
  }
  return 'unknown';
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
  const service = resolveLogService(
    fields,
    hit.service,
    fields.service_name,
    fields.service,
  );

  return {
    id: String(hit.id ?? fields.event_id ?? fields['record_id'] ?? `log-${index + 1}`).trim() || `log-${index + 1}`,
    timestamp,
    level: normalizeLevel(hit.level ?? fields.level, sourceMessage || rawLog || message),
    service,
    host: resolveLogHost(fields, sourceMessage, rawLog),
    hostIp: resolveLogHostIP(fields),
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

function normalizeSavedQueryTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, 'zh-CN'));
}

function buildLocalSavedQueryResult(params: SavedQueryListParams): SavedQueryListResult {
  const keyword = params.keyword?.trim().toLowerCase() ?? '';
  const tag = params.tag?.trim() ?? '';
  const allSavedQueries = readLocalSavedQueries();
  const availableTags = normalizeSavedQueryTags(allSavedQueries.flatMap((item) => item.tags));

  const filtered = allSavedQueries
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
    availableTags,
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

interface LocalDemoLogSeed {
  host: string;
  hostIp: string;
  service: string;
  source: string;
  env: string;
  region: string;
  count: number;
  intervalMinutes: number;
  messagePrefix: string;
}

const LOCAL_DEMO_LOG_SEEDS: LocalDemoLogSeed[] = [
  {
    host: 'prod-node-sh01',
    hostIp: '10.20.1.21',
    service: 'nginx-gateway',
    source: '/var/log/nginx/access.log',
    env: 'prod',
    region: 'cn-east-1',
    count: 18,
    intervalMinutes: 6,
    messagePrefix: 'gateway access',
  },
  {
    host: 'billing-node-a-02',
    hostIp: '10.20.2.34',
    service: 'payments-processor-api',
    source: '/var/log/app/payment/processor.log',
    env: 'prod',
    region: 'cn-east-1',
    count: 14,
    intervalMinutes: 9,
    messagePrefix: 'payment workflow',
  },
  {
    host: 'order-node-b-11',
    hostIp: '10.20.3.18',
    service: 'order-event-consumer',
    source: '/var/log/app/order/consumer.log',
    env: 'prod',
    region: 'cn-east-1',
    count: 11,
    intervalMinutes: 11,
    messagePrefix: 'order event',
  },
  {
    host: 'k8s-worker-cn-east-1a',
    hostIp: '10.20.4.45',
    service: 'inventory-sync-worker',
    source: '/var/lib/docker/containers/abcdef123456/abcdef123456-json.log',
    env: 'prod',
    region: 'cn-east-1',
    count: 8,
    intervalMinutes: 15,
    messagePrefix: 'inventory sync',
  },
  {
    host: 'audit-gateway-01',
    hostIp: '10.20.5.16',
    service: 'auditd',
    source: '/var/log/audit/audit.log',
    env: 'prod',
    region: 'cn-east-1',
    count: 6,
    intervalMinutes: 19,
    messagePrefix: 'audit event',
  },
];

function isOfflineModeEnabled(): boolean {
  return Boolean(getRuntimeConfig().features.enableOfflineMode);
}

function shouldUseEmergencyQueryFallback(): boolean {
  const accessToken = resolveAccessToken();
  return Boolean(accessToken) && accessToken.startsWith(EMERGENCY_ACCESS_TOKEN_PREFIX);
}

function resolveDemoLogLevel(seedIndex: number, itemIndex: number): LogEntry['level'] {
  if ((seedIndex + itemIndex) % 11 === 0) {
    return 'error';
  }
  if ((seedIndex + itemIndex) % 5 === 0) {
    return 'warn';
  }
  return itemIndex % 2 === 0 ? 'info' : 'debug';
}

function buildLocalDemoLogEntries(): LogEntry[] {
  const nowMs = Date.now();
  const tenantId = resolveTenantId(getRuntimeConfig() as RuntimeConfigWithTenant) || '00000000-0000-0000-0000-000000000001';
  const logs: LogEntry[] = [];

  LOCAL_DEMO_LOG_SEEDS.forEach((seed, seedIndex) => {
    for (let itemIndex = 0; itemIndex < seed.count; itemIndex += 1) {
      const level = resolveDemoLogLevel(seedIndex, itemIndex);
      const timestamp = new Date(
        nowMs - ((seedIndex * 17) + itemIndex * seed.intervalMinutes) * 60_000,
      ).toISOString();
      const statusCode = level === 'error' ? 500 : level === 'warn' ? 429 : 200;
      const message = `${seed.messagePrefix} ${itemIndex + 1} on ${seed.service} returned ${statusCode}`;
      const rawLog = `[${level.toUpperCase()}] ${timestamp} ${seed.host} ${seed.service}: ${message}`;
      const sourcePath = seed.source;
      const fields: RealtimeLogFields & Record<string, unknown> = {
        timestamp,
        level,
        message,
        raw_log: rawLog,
        raw_message: rawLog,
        source: sourcePath,
        source_path: sourcePath,
        source_internal: sourcePath,
        host: seed.host,
        host_ip: seed.hostIp,
        env: seed.env,
        region: seed.region,
        service_name: seed.service,
        service_instance_id: `${seed.service}-${seed.host}`,
        container_name: seed.service,
        tenant_id: tenantId,
        statusCode,
      };

      logs.push({
        id: createLocalID(`demo-log-${seed.service}-${itemIndex}`),
        timestamp,
        level,
        service: seed.service,
        host: seed.host,
        hostIp: seed.hostIp,
        message,
        fields,
        rawLog,
      });
    }
  });

  return logs.sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
}

function stripQuotedTerm(raw: string): string {
  return raw.replace(/^"(.+)"$/, '$1').replace(/^'(.+)'$/, '$1').trim();
}

function matchesLocalDemoKeyword(log: LogEntry, token: string): boolean {
  const normalized = stripQuotedTerm(token).toLowerCase();
  if (!normalized || normalized === 'and' || normalized === 'or') {
    return true;
  }

  const source = String(log.fields?.source_path ?? log.fields?.source ?? '').toLowerCase();
  const service = log.service.toLowerCase();
  const host = log.host.toLowerCase();
  const message = `${log.message} ${log.rawLog ?? ''}`.toLowerCase();

  if (normalized.includes(':')) {
    const [rawField, ...rest] = normalized.split(':');
    const expected = rest.join(':').trim();
    if (!expected) {
      return true;
    }
    switch (rawField) {
      case 'level':
        return log.level.includes(expected);
      case 'service':
      case 'service.name':
        return service.includes(expected);
      case 'source':
      case 'source.path':
        return source.includes(expected);
      case 'host':
      case 'host.name':
        return host.includes(expected);
      default:
        return message.includes(expected) || service.includes(expected) || source.includes(expected) || host.includes(expected);
    }
  }

  return message.includes(normalized) || service.includes(normalized) || source.includes(normalized) || host.includes(normalized);
}

function matchesLocalDemoKeywords(log: LogEntry, keywords: string): boolean {
  const trimmed = keywords.trim();
  if (!trimmed) {
    return true;
  }
  return trimmed.split(/\s+/).every((token) => matchesLocalDemoKeyword(log, token));
}

function matchesLocalDemoFilters(log: LogEntry, filters?: Record<string, unknown>): boolean {
  if (!filters) {
    return true;
  }

  const level = String(filters.level ?? '').trim().toLowerCase();
  if (level && log.level !== level) {
    return false;
  }

  const service = String(filters.service ?? '').trim().toLowerCase();
  if (service && !log.service.toLowerCase().includes(service)) {
    return false;
  }

  return true;
}

function matchesLocalDemoTimeRange(log: LogEntry, timeRange?: { from?: string; to?: string }): boolean {
  const timestampMs = Date.parse(log.timestamp);
  if (!Number.isFinite(timestampMs)) {
    return false;
  }

  const fromMs = timeRange?.from ? Date.parse(timeRange.from) : Number.NaN;
  if (Number.isFinite(fromMs) && timestampMs < fromMs) {
    return false;
  }

  const toMs = timeRange?.to ? Date.parse(timeRange.to) : Number.NaN;
  if (Number.isFinite(toMs) && timestampMs > toMs) {
    return false;
  }

  return true;
}

function filterLocalDemoLogs(params: {
  keywords?: string;
  filters?: Record<string, unknown>;
  timeRange?: { from?: string; to?: string };
}): LogEntry[] {
  return buildLocalDemoLogEntries().filter((log) => (
    matchesLocalDemoTimeRange(log, params.timeRange)
    && matchesLocalDemoFilters(log, params.filters)
    && matchesLocalDemoKeywords(log, params.keywords ?? '')
  ));
}

function toOverviewTopSources(logs: LogEntry[]): DashboardTopSource[] {
  const buckets = new Map<string, DashboardTopSource>();
  logs.forEach((log) => {
    const host = typeof log.host === 'string' && log.host.trim() ? log.host.trim() : 'unknown';
    const service = typeof log.service === 'string' && log.service.trim() ? log.service.trim() : 'unknown';
    const identity = buildDashboardTopSourceIdentity(host, service);
    const current = buckets.get(identity) ?? {
      source: buildDashboardTopSourceLabel(host, service),
      host,
      service,
      count: 0,
    };
    current.count += 1;
    buckets.set(identity, current);
  });

  return Array.from(buckets.values())
    .sort((left, right) => right.count - left.count || left.source.localeCompare(right.source))
    .slice(0, 5)
    .map((item) => normalizeDashboardTopSource(item));
}

function truncateDateToHour(date: Date): Date {
  const next = new Date(date.getTime());
  next.setMinutes(0, 0, 0);
  return next;
}

function truncateDateToMinute(date: Date): Date {
  const next = new Date(date.getTime());
  next.setSeconds(0, 0);
  return next;
}

function truncateDateToDay(date: Date): Date {
  const next = new Date(date.getTime());
  next.setHours(0, 0, 0, 0);
  return next;
}

function resolveDashboardOverviewRangeDuration(range: DashboardOverviewRange): number {
  return range === '7d' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
}

function buildLocalDashboardOverview(range: DashboardOverviewRange = '24h'): DashboardOverviewStats {
  const now = new Date();
  const from = new Date(now.getTime() - resolveDashboardOverviewRangeDuration(range));
  const logs = filterLocalDemoLogs({
    timeRange: {
      from: from.toISOString(),
      to: now.toISOString(),
    },
  });
  const levelDistribution: Record<string, number> = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
    fatal: 0,
  };
  logs.forEach((log) => {
    if (levelDistribution[log.level] !== undefined) {
      levelDistribution[log.level] += 1;
    }
  });

  const trendBuckets = new Map<string, number>();
  if (range === '7d') {
    for (let index = 6; index >= 0; index -= 1) {
      const key = truncateDateToDay(new Date(now.getTime() - index * 24 * 60 * 60 * 1000)).toISOString();
      trendBuckets.set(key, 0);
    }
    logs.forEach((log) => {
      const key = truncateDateToDay(new Date(log.timestamp)).toISOString();
      trendBuckets.set(key, (trendBuckets.get(key) ?? 0) + 1);
    });
  } else {
    for (let index = 23; index >= 0; index -= 1) {
      const key = truncateDateToHour(new Date(now.getTime() - index * 60 * 60 * 1000)).toISOString();
      trendBuckets.set(key, 0);
    }
    logs.forEach((log) => {
      const key = truncateDateToHour(new Date(log.timestamp)).toISOString();
      trendBuckets.set(key, (trendBuckets.get(key) ?? 0) + 1);
    });
  }

  const firing = logs.filter((log) => log.level === 'error').length;
  const resolved = logs.filter((log) => log.level === 'warn').length;

  return {
    total_logs: logs.length,
    level_distribution: levelDistribution,
    top_sources: toOverviewTopSources(logs),
    alert_summary: {
      total: firing + resolved,
      firing,
      resolved,
    },
    log_trend: Array.from(trendBuckets.entries()).map(([time, count]) => ({ time, count })),
  };
}

function buildLocalRealtimeLogsResult(payload: QueryLogsPayload): QueryLogsResult {
  const filtered = filterLocalDemoLogs({
    keywords: payload.keywords,
    filters: payload.filters,
    timeRange: payload.timeRange,
  });
  const paged = toPagedResult(filtered, payload.page, payload.pageSize);
  return {
    hits: paged.items,
    total: paged.total,
    page: paged.page,
    pageSize: paged.pageSize,
    totalIsLowerBound: false,
    hasNext: paged.hasNext,
    queryTimeMS: 12,
    timedOut: false,
    aggregations: {},
  };
}

function resolveAggregateTimeRange(timeRange: FetchAggregateStatsParams['timeRange']): { from: string; to: string } {
  const now = new Date();
  const durationMap: Record<FetchAggregateStatsParams['timeRange'], number> = {
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
  };
  return {
    from: new Date(now.getTime() - durationMap[timeRange]).toISOString(),
    to: now.toISOString(),
  };
}

const SOURCE_AGGREGATE_KEY_SEPARATOR = '\u001f';
const CLUSTER_TREND_BUCKET_COUNT = 8;
const CLUSTER_IP_PATTERN = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const CLUSTER_UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const CLUSTER_EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const CLUSTER_PORT_PATTERN = /\bport\s+(\d{2,5})\b/gi;
const CLUSTER_DURATION_PATTERN = /\b\d+(?:\.\d+)?\s?(?:ms|s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?)\b/gi;
const CLUSTER_USER_PATTERN = /\b(user)\s+([A-Za-z0-9._:@-]+)/gi;
const CLUSTER_REQUEST_PATTERN = /\b(request)\s+([A-Za-z0-9._:@-]+)/gi;
const CLUSTER_JOB_PATTERN = /\b(job)\s+([A-Za-z0-9._:@-]+)/gi;
const CLUSTER_IDENTIFIER_PATTERN = /\b[a-f0-9]{12,}\b/gi;
const CLUSTER_LONG_NUMBER_PATTERN = /\b\d{3,}\b/g;
const CLUSTER_PLACEHOLDER_PATTERN = /\{[A-Z_]+\}/g;

function buildAggregateStatsFromLogs(
  logs: LogEntry[],
  groupBy: FetchAggregateStatsParams['groupBy'],
): FetchAggregateStatsResult {
  const buckets = new Map<string, number>();
  const sourceBucketMeta = new Map<string, { label: string; host: string; service: string }>();

  logs.forEach((log) => {
    let key = '';
    switch (groupBy) {
      case 'level':
        key = log.level;
        break;
      case 'source': {
        const host = String(log.host || log.fields?.host || 'unknown-host').trim() || 'unknown-host';
        const service = String(log.service || log.fields?.service_name || log.fields?.service || 'unknown-service').trim() || 'unknown-service';
        key = `${host}${SOURCE_AGGREGATE_KEY_SEPARATOR}${service}`;
        sourceBucketMeta.set(key, {
          host,
          service,
          label: `${host} / ${service}`,
        });
        break;
      }
      case 'hour': {
        const timestamp = new Date(log.timestamp);
        if (Number.isNaN(timestamp.getTime())) {
          return;
        }
        key = truncateDateToHour(timestamp).toISOString();
        break;
      }
      case 'minute': {
        const timestamp = new Date(log.timestamp);
        if (Number.isNaN(timestamp.getTime())) {
          return;
        }
        key = truncateDateToMinute(timestamp).toISOString();
        break;
      }
      default:
        key = '-';
    }
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  });

  const items = Array.from(buckets.entries()).map(([key, count]) => {
    if (groupBy !== 'source') {
      return { key, count };
    }
    const sourceMeta = sourceBucketMeta.get(key);
    return {
      key,
      count,
      label: sourceMeta?.label,
      host: sourceMeta?.host,
      service: sourceMeta?.service,
    };
  });

  if (groupBy === 'hour' || groupBy === 'minute') {
    items.sort((left, right) => left.key.localeCompare(right.key));
  } else {
    items.sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
  }

  return { buckets: items };
}

function buildLocalAggregateStats(params: FetchAggregateStatsParams): FetchAggregateStatsResult {
  const logs = filterLocalDemoLogs({
    keywords: params.keywords,
    filters: params.filters,
    timeRange: resolveAggregateTimeRange(params.timeRange),
  });
  return buildAggregateStatsFromLogs(logs, params.groupBy);
}

function resolveClusterTimeRange(timeRange: FetchLogClustersParams['timeRange']): { from: string; to: string } {
  const now = new Date();
  const durationMap: Record<FetchLogClustersParams['timeRange'], number> = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
  };
  return {
    from: new Date(now.getTime() - durationMap[timeRange]).toISOString(),
    to: now.toISOString(),
  };
}

function replaceLocalClusterPattern(
  source: string,
  pattern: RegExp,
  placeholder: string,
  variables: Record<string, string>,
): string {
  return source.replace(pattern, (match) => {
    const value = match.trim();
    if (value && !variables[placeholder]) {
      variables[placeholder] = value;
    }
    return `{${placeholder}}`;
  });
}

function replaceLocalClusterKeywordPattern(
  source: string,
  pattern: RegExp,
  placeholder: string,
  variables: Record<string, string>,
): string {
  return source.replace(pattern, (_match, keyword: string, value: string) => {
    const normalizedValue = String(value ?? '').trim();
    if (normalizedValue && !variables[placeholder]) {
      variables[placeholder] = normalizedValue;
    }
    return `${String(keyword ?? '').trim() || placeholder.toLowerCase()} {${placeholder}}`;
  });
}

function normalizeLocalClusterTemplate(message: string): { template: string; variables: Record<string, string> } {
  const variables: Record<string, string> = {};
  let template = String(message ?? '').trim();
  if (!template) {
    return { template: '', variables };
  }

  template = replaceLocalClusterKeywordPattern(template, CLUSTER_USER_PATTERN, 'USER_ID', variables);
  template = replaceLocalClusterKeywordPattern(template, CLUSTER_REQUEST_PATTERN, 'REQUEST_ID', variables);
  template = replaceLocalClusterKeywordPattern(template, CLUSTER_JOB_PATTERN, 'JOB_ID', variables);
  template = template.replace(CLUSTER_PORT_PATTERN, (_match, port: string) => {
    const normalizedPort = String(port ?? '').trim();
    if (normalizedPort && !variables.PORT) {
      variables.PORT = normalizedPort;
    }
    return 'port {PORT}';
  });
  template = replaceLocalClusterPattern(template, CLUSTER_DURATION_PATTERN, 'DURATION', variables);
  template = replaceLocalClusterPattern(template, CLUSTER_UUID_PATTERN, 'UUID', variables);
  template = replaceLocalClusterPattern(template, CLUSTER_IP_PATTERN, 'IP_ADDRESS', variables);
  template = replaceLocalClusterPattern(template, CLUSTER_EMAIL_PATTERN, 'EMAIL', variables);
  template = replaceLocalClusterPattern(template, CLUSTER_IDENTIFIER_PATTERN, 'IDENTIFIER', variables);
  template = replaceLocalClusterPattern(template, CLUSTER_LONG_NUMBER_PATTERN, 'NUMBER', variables);
  template = template.replace(/\s+/g, ' ').trim();
  return { template, variables };
}

function resolveLocalClusterTrendBucket(timestamp: string, from: Date, to: Date): number {
  const ts = new Date(timestamp);
  if (Number.isNaN(ts.getTime())) {
    return CLUSTER_TREND_BUCKET_COUNT - 1;
  }
  const totalWindow = to.getTime() - from.getTime();
  if (totalWindow <= 0) {
    return CLUSTER_TREND_BUCKET_COUNT - 1;
  }
  const offset = Math.max(0, Math.min(totalWindow, ts.getTime() - from.getTime()));
  const index = Math.floor((offset / totalWindow) * CLUSTER_TREND_BUCKET_COUNT);
  return Math.max(0, Math.min(CLUSTER_TREND_BUCKET_COUNT - 1, index));
}

function buildLocalClusterTrend(counts: number[], from: Date, to: Date): LogClusterTrendPoint[] {
  const totalWindow = Math.max(60_000, to.getTime() - from.getTime());
  const bucketWidth = Math.max(60_000, Math.floor(totalWindow / CLUSTER_TREND_BUCKET_COUNT));
  return Array.from({ length: CLUSTER_TREND_BUCKET_COUNT }, (_, index) => ({
    time: new Date(from.getTime() + index * bucketWidth).toISOString(),
    count: counts[index] ?? 0,
  }));
}

function estimateLocalClusterSimilarity(template: string): number {
  const words = template.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return 100;
  }
  const placeholders = template.match(CLUSTER_PLACEHOLDER_PATTERN)?.length ?? 0;
  if (placeholders === 0) {
    return 100;
  }
  const score = Math.round(100 - (placeholders / words.length) * 45);
  return Math.max(72, Math.min(100, score));
}

function buildLogClustersFromLogs(
  logs: LogEntry[],
  params: Pick<FetchLogClustersParams, 'timeRange' | 'limit' | 'sampleSize'>,
  analyzedLogsTotal = logs.length,
): FetchLogClustersResult {
  const timeRange = resolveClusterTimeRange(params.timeRange);
  const sampleSize = Math.max(1, Math.min(params.sampleSize ?? 400, 1000));
  const limit = Math.max(1, Math.min(params.limit ?? 20, 50));
  const sampledLogs = logs.slice(0, sampleSize);
  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);
  const patternMap = new Map<string, {
    id: string;
    template: string;
    level: string;
    occurrences: number;
    firstSeen: string;
    lastSeen: string;
    samples: LogClusterSample[];
    trend: number[];
  }>();

  sampledLogs.forEach((log) => {
    const { template, variables } = normalizeLocalClusterTemplate(log.message || log.rawLog || '');
    if (!template) {
      return;
    }
    const key = `${String(log.level).toLowerCase()}\u0000${template.toLowerCase()}`;
    const existing = patternMap.get(key) ?? {
      id: key,
      template,
      level: log.level,
      occurrences: 0,
      firstSeen: log.timestamp,
      lastSeen: log.timestamp,
      samples: [],
      trend: Array.from({ length: CLUSTER_TREND_BUCKET_COUNT }, () => 0),
    };
    existing.occurrences += 1;
    if (log.timestamp < existing.firstSeen) {
      existing.firstSeen = log.timestamp;
    }
    if (log.timestamp > existing.lastSeen) {
      existing.lastSeen = log.timestamp;
    }
    const bucketIndex = resolveLocalClusterTrendBucket(log.timestamp, from, to);
    existing.trend[bucketIndex] += 1;
    if (existing.samples.length < 3) {
      existing.samples.push({
        timestamp: log.timestamp,
        message: log.message,
        variables,
        host: log.host,
        service: log.service,
        level: log.level,
      });
    }
    patternMap.set(key, existing);
  });

  const newPatternCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const patterns = Array.from(patternMap.values())
    .map((pattern) => ({
      id: pattern.id,
      template: pattern.template,
      similarity: estimateLocalClusterSimilarity(pattern.template),
      occurrences: pattern.occurrences,
      first_seen: pattern.firstSeen,
      last_seen: pattern.lastSeen,
      level: pattern.level,
      trend: buildLocalClusterTrend(pattern.trend, from, to),
      samples: pattern.samples,
    }))
    .sort((left, right) => right.occurrences - left.occurrences || right.last_seen.localeCompare(left.last_seen) || left.template.localeCompare(right.template));

  return {
    summary: {
      analyzed_logs_total: Math.max(logs.length, Number.isFinite(analyzedLogsTotal) ? analyzedLogsTotal : logs.length),
      sampled_logs: sampledLogs.length,
      unique_patterns: patternMap.size,
      new_patterns_today: patterns.filter((pattern) => Date.parse(pattern.first_seen) >= newPatternCutoff).length,
    },
    patterns: patterns.slice(0, limit),
  };
}

function buildLocalLogClusters(params: FetchLogClustersParams): FetchLogClustersResult {
  const timeRange = resolveClusterTimeRange(params.timeRange);
  const allLogs = filterLocalDemoLogs({
    keywords: params.keywords,
    filters: params.filters,
    timeRange,
  });
  return buildLogClustersFromLogs(allLogs, params, allLogs.length);
}

function resolveAnomalyTimeRange(timeRange: FetchAnomalyStatsParams['timeRange']): { from: string; to: string } {
  const now = new Date();
  const durationMap: Record<FetchAnomalyStatsParams['timeRange'], number> = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
  };
  return {
    from: new Date(now.getTime() - durationMap[timeRange]).toISOString(),
    to: now.toISOString(),
  };
}

function resolveAnomalyBucketSize(timeRange: FetchAnomalyStatsParams['timeRange']): number {
  switch (timeRange) {
    case '1h':
      return 5 * 60 * 1000;
    case '6h':
      return 30 * 60 * 1000;
    case '7d':
      return 12 * 60 * 60 * 1000;
    case '24h':
    default:
      return 2 * 60 * 60 * 1000;
  }
}

function computeMeanAndStd(values: number[]): { mean: number; std: number } {
  if (values.length === 0) {
    return { mean: 0, std: 0 };
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return { mean, std: Math.sqrt(variance) };
}

function computeRollingExpectation(values: number[], index: number, lookback = 4): { mean: number; std: number } {
  if (index <= 0) {
    return { mean: 0, std: 0 };
  }
  const start = Math.max(0, index - lookback);
  return computeMeanAndStd(values.slice(start, index));
}

function roundMetric(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function classifyAnomalySeverity(changeRatio: number): DetectedAnomaly['severity'] {
  if (changeRatio >= 2) {
    return 'critical';
  }
  if (changeRatio >= 1.2) {
    return 'high';
  }
  if (changeRatio >= 0.6) {
    return 'medium';
  }
  return 'low';
}

function classifyAnomalyConfidence(changeRatio: number): number {
  return Math.max(55, Math.min(99, 65 + Math.round(changeRatio * 20)));
}

function resolveAnomalyStatus(timestamp: string): DetectedAnomaly['status'] {
  const ts = Date.parse(timestamp);
  if (Number.isNaN(ts)) {
    return 'investigating';
  }
  return Date.now() - ts <= 2 * 60 * 60 * 1000 ? 'active' : 'investigating';
}

function buildAnomalyStatsFromBuckets(
  buckets: Array<{ time: string; actual: number; errorCount: number }>,
  dominantService: string,
): FetchAnomalyStatsResult {
  const actualValues = buckets.map((bucket) => bucket.actual);
  const errorRates = buckets.map((bucket) => (bucket.actual > 0 ? (bucket.errorCount / bucket.actual) * 100 : 0));
  const globalActualStats = computeMeanAndStd(actualValues);
  const globalErrorStats = computeMeanAndStd(errorRates);
  const trend: AnomalyTrendPoint[] = [];
  const anomalies: DetectedAnomaly[] = [];

  buckets.forEach((bucket, index) => {
    const actual = bucket.actual;
    const expectedStats = computeRollingExpectation(actualValues, index, 4);
    const expected = expectedStats.mean > 0 ? expectedStats.mean : globalActualStats.mean;
    const expectedStd = expectedStats.std > 0 ? expectedStats.std : globalActualStats.std;
    const margin = Math.max(5, expected * 0.25, expectedStd * 2);
    const lowerBound = Math.max(0, expected - margin);
    const upperBound = expected + margin;
    const errorRate = errorRates[index];
    const errorStats = computeRollingExpectation(errorRates, index, 4);
    const expectedError = errorStats.mean > 0 ? errorStats.mean : globalErrorStats.mean;
    const errorStd = errorStats.std > 0 ? errorStats.std : globalErrorStats.std;
    const errorMargin = Math.max(1.5, expectedError * 0.5, errorStd * 2);
    const isVolumeAnomaly = actual > upperBound || actual < lowerBound;
    const isErrorAnomaly = actual >= 20 && errorRate > expectedError + errorMargin;

    trend.push({
      time: bucket.time,
      actual,
      expected: roundMetric(expected),
      lower_bound: roundMetric(lowerBound),
      upper_bound: roundMetric(upperBound),
      is_anomaly: isVolumeAnomaly || isErrorAnomaly,
      error_rate: roundMetric(errorRate),
    });

    if (isVolumeAnomaly && (actual > 0 || expected > 0)) {
      const changeRatio = expected > 0 ? Math.abs(actual - expected) / expected : 0;
      const title = actual < lowerBound ? '流量突降' : '日志量激增';
      anomalies.push({
        id: `${bucket.time}-volume`,
        title,
        description: `${new Date(bucket.time).toLocaleString('zh-CN')} 的日志量为 ${actual}，基线约为 ${roundMetric(expected, 0)}。`,
        severity: classifyAnomalySeverity(changeRatio),
        status: resolveAnomalyStatus(bucket.time),
        timestamp: bucket.time,
        service: dominantService,
        confidence: classifyAnomalyConfidence(changeRatio),
        metric: 'log_volume',
        expected_value: roundMetric(expected),
        actual_value: roundMetric(actual),
        root_cause: actual < lowerBound
          ? '当前时间桶日志量显著低于历史基线，建议检查采集链路、Agent 在线状态和上游服务流量。'
          : '当前时间桶日志量显著高于历史基线，建议检查异常重试、批量任务或噪声日志激增。',
      });
    }

    if (isErrorAnomaly) {
      const changeRatio = expectedError > 0 ? Math.abs(errorRate - expectedError) / expectedError : errorRate / 5;
      anomalies.push({
        id: `${bucket.time}-error-rate`,
        title: '异常错误率',
        description: `${new Date(bucket.time).toLocaleString('zh-CN')} 的错误日志占比达到 ${roundMetric(errorRate)}%，高于基线 ${roundMetric(expectedError)}%。`,
        severity: classifyAnomalySeverity(changeRatio),
        status: resolveAnomalyStatus(bucket.time),
        timestamp: bucket.time,
        service: dominantService,
        confidence: classifyAnomalyConfidence(changeRatio),
        metric: 'error_rate',
        expected_value: roundMetric(expectedError),
        actual_value: roundMetric(errorRate),
        root_cause: '错误级别日志占比显著升高，建议结合聚类分析定位高频报错模式。',
      });
    }
  });

  const sortedAnomalies = anomalies.sort((left, right) => {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const severityDelta = severityOrder[right.severity] - severityOrder[left.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }
    return right.timestamp.localeCompare(left.timestamp);
  });
  const criticalCount = sortedAnomalies.filter((item) => item.severity === 'critical').length;
  const anomalousBuckets = trend.filter((item) => item.is_anomaly).length;
  const healthScore = Math.max(0, 100 - sortedAnomalies.length * 8 - criticalCount * 10);

  return {
    summary: {
      total_anomalies: sortedAnomalies.length,
      critical_count: criticalCount,
      health_score: healthScore,
      anomalous_buckets: anomalousBuckets,
      affected_services: sortedAnomalies.length > 0 ? 1 : 0,
    },
    trend,
    anomalies: sortedAnomalies.slice(0, 20),
  };
}

function resolveFallbackAnomalyService(filters?: Record<string, unknown>): string {
  const candidate = typeof filters?.service === 'string' ? filters.service.trim() : '';
  return candidate || '全局';
}

function resolveAggregateGroupByForAnomalyTimeRange(timeRange: FetchAnomalyStatsParams['timeRange']): FetchAggregateStatsParams['groupBy'] {
  switch (timeRange) {
    case '1h':
    case '6h':
      return 'minute';
    case '24h':
    case '7d':
    default:
      return 'hour';
  }
}

function buildAggregateBackedAnomalyStats(
  buckets: AggregateBucket[],
  dominantService: string,
): FetchAnomalyStatsResult {
  const normalizedBuckets = [...buckets]
    .map((bucket) => ({
      time: bucket.key,
      actual: Math.max(0, Number(bucket.count || 0)),
      errorCount: 0,
    }))
    .sort((left, right) => left.time.localeCompare(right.time));

  return buildAnomalyStatsFromBuckets(normalizedBuckets, dominantService);
}

function buildLocalAnomalyStats(params: FetchAnomalyStatsParams): FetchAnomalyStatsResult {
  const timeRange = resolveAnomalyTimeRange(params.timeRange);
  const logs = filterLocalDemoLogs({
    keywords: params.keywords,
    filters: params.filters,
    timeRange,
  });
  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);
  const bucketSize = resolveAnomalyBucketSize(params.timeRange);
  const buckets: Array<{ time: string; actual: number; errorCount: number }> = [];

  for (let cursor = from.getTime(); cursor <= to.getTime(); cursor += bucketSize) {
    const time = new Date(cursor).toISOString();
    buckets.push({ time, actual: 0, errorCount: 0 });
  }

  logs.forEach((log) => {
    const ts = Date.parse(log.timestamp);
    if (Number.isNaN(ts)) {
      return;
    }
    const normalized = Math.floor((ts - from.getTime()) / bucketSize);
    if (normalized < 0 || normalized >= buckets.length) {
      return;
    }
    buckets[normalized].actual += 1;
    if (['error', 'fatal', 'warn'].includes(log.level)) {
      buckets[normalized].errorCount += 1;
    }
  });

  const dominantService = logs.reduce<{ service: string; count: number }>((best, log) => {
    const current = logs.filter((item) => item.service === log.service).length;
    if (current > best.count) {
      return { service: log.service || '全局', count: current };
    }
    return best;
  }, { service: '全局', count: 0 }).service || '全局';

  return buildAnomalyStatsFromBuckets(buckets, dominantService);
}

function shouldFallbackToLocalStore(error: unknown): boolean {
  if (shouldUseEmergencyQueryFallback() && error instanceof QueryApiAuthError) {
    return true;
  }
  if (!isOfflineModeEnabled()) {
    return false;
  }
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

function shouldFallbackToAggregateDerivedAnomalyStats(error: unknown): boolean {
  if (!(error instanceof QueryApiRequestError)) {
    return false;
  }
  if (error.status >= 500 || error.status === 404) {
    return true;
  }
  return error.code === 'QUERY_SERVICE_UNAVAILABLE' || error.code === 'QUERY_INTERNAL_ERROR';
}

function shouldFallbackToRealtimeLogDerivation(error: unknown): boolean {
  if (!(error instanceof QueryApiRequestError)) {
    return false;
  }
  if (error.status >= 500 || error.status === 404) {
    return true;
  }
  return error.code === 'QUERY_SERVICE_UNAVAILABLE' || error.code === 'QUERY_INTERNAL_ERROR';
}

async function fetchRealtimeLogsForDerivedStats(params: {
  keywords?: string;
  filters?: Record<string, unknown>;
  timeRange: { from: string; to: string };
  limit: number;
  signal?: AbortSignal;
}): Promise<{ hits: LogEntry[]; total: number }> {
  const hits: LogEntry[] = [];
  const normalizedLimit = Math.max(1, Math.min(params.limit, 2000));
  const pageSize = Math.min(200, normalizedLimit);
  let page = 1;
  let pitId: string | undefined;
  let searchAfter: unknown[] | undefined;
  let total = 0;

  while (hits.length < normalizedLimit) {
    const nextResult = await queryRealtimeLogs({
      keywords: params.keywords ?? '',
      page,
      pageSize: Math.min(pageSize, normalizedLimit - hits.length),
      filters: params.filters,
      timeRange: params.timeRange,
      pitId,
      searchAfter,
      signal: params.signal,
      recordHistory: false,
    });

    hits.push(...nextResult.hits);
    total = Math.max(total, nextResult.total, hits.length);

    if (!nextResult.hasNext || nextResult.hits.length === 0) {
      break;
    }

    const nextPitId = typeof nextResult.pitId === 'string' ? nextResult.pitId.trim() : '';
    pitId = nextPitId || undefined;
    searchAfter = pitId && Array.isArray(nextResult.nextSearchAfter) && nextResult.nextSearchAfter.length > 0
      ? [...nextResult.nextSearchAfter]
      : undefined;
    page += 1;
  }

  return {
    hits: hits.slice(0, normalizedLimit),
    total,
  };
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
  const userId = resolveStoredAuthUserID();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }
  if (userId) {
    headers['X-User-ID'] = userId;
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
    signal?: AbortSignal;
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

  const method = options.method ?? 'GET';
  const requestPath = url.pathname + url.search;
  const requestKey = `${method} ${requestPath}`;
  const shouldDedupe = method === 'GET' && !options.signal;

  const performRequest = async (): Promise<ApiEnvelope<TData>> => {
    const response = await fetch(requestPath, {
      method,
      headers: buildAuthHeaders(accessToken),
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
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
  };

  if (!shouldDedupe) {
    return performRequest();
  }

  const existingRequest = IN_FLIGHT_QUERY_GET_REQUESTS.get(requestKey) as Promise<ApiEnvelope<TData>> | undefined;
  if (existingRequest) {
    return existingRequest;
  }

  const requestPromise = performRequest();
  IN_FLIGHT_QUERY_GET_REQUESTS.set(requestKey, requestPromise as Promise<ApiEnvelope<unknown>>);
  try {
    return await requestPromise;
  } finally {
    if (IN_FLIGHT_QUERY_GET_REQUESTS.get(requestKey) === requestPromise) {
      IN_FLIGHT_QUERY_GET_REQUESTS.delete(requestKey);
    }
  }
}

function shouldUseQueryCollectionFallback(): boolean {
  if (shouldUseEmergencyQueryFallback()) {
    return true;
  }
  if (!isOfflineModeEnabled()) {
    return false;
  }
  const accessToken = resolveAccessToken();
  return !accessToken;
}

function deriveDashboardTopSourceHost(source: string): string {
  const normalized = source.trim();
  if (!normalized) {
    return 'unknown';
  }
  const parts = normalized.split(' / ').map((item) => item.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts[0] || 'unknown';
  }
  return 'unknown';
}

function deriveDashboardTopSourceService(source: string): string {
  const normalized = source.trim();
  if (!normalized) {
    return 'unknown';
  }
  const pairParts = normalized.split(' / ').map((item) => item.trim()).filter(Boolean);
  if (pairParts.length >= 2) {
    return pairParts[pairParts.length - 1] || 'unknown';
  }
  const normalizedPath = normalized.replace(/\\/g, '/');
  const segments = normalizedPath.split('/').filter(Boolean);
  const tail = segments[segments.length - 1] ?? normalizedPath;
  const display = tail.replace(/\.(log|txt|out|jsonl?)$/i, '').trim();
  return display || tail || 'unknown';
}

function buildDashboardTopSourceLabel(host: string, service: string): string {
  return `${host} / ${service}`;
}

function buildDashboardTopSourceIdentity(host: string, service: string): string {
  return `${host}${SOURCE_AGGREGATE_KEY_SEPARATOR}${service}`;
}

function normalizeDashboardTopSource(source: Partial<DashboardTopSource> | null | undefined): DashboardTopSource {
  const rawSource = typeof source?.source === 'string' ? source.source.trim() : '';
  const host = typeof source?.host === 'string' && source.host.trim()
    ? source.host.trim()
    : deriveDashboardTopSourceHost(rawSource);
  const service = typeof source?.service === 'string' && source.service.trim()
    ? source.service.trim()
    : deriveDashboardTopSourceService(rawSource);

  return {
    source: rawSource || buildDashboardTopSourceLabel(host, service),
    host,
    service,
    count: Number(source?.count) || 0,
  };
}

/** Fetch dashboard overview stats */
export async function fetchDashboardOverview(range: DashboardOverviewRange = '24h'): Promise<DashboardOverviewStats> {
  if (shouldUseQueryCollectionFallback()) {
    return buildLocalDashboardOverview(range);
  }

  try {
    const params = new URLSearchParams({ range });
    const envelope = await requestQueryApi<DashboardOverviewStats>(`/stats/overview?${params.toString()}`, { method: 'GET' });
    const data = envelope.data;
    if (!data) {
      throw new QueryApiRequestError(500, 'QUERY_STATS_EMPTY', 'Overview stats empty');
    }
    return {
      total_logs: Number(data.total_logs) || 0,
      level_distribution: data.level_distribution ?? {},
      top_sources: Array.isArray(data.top_sources) ? data.top_sources.map((item) => normalizeDashboardTopSource(item)) : [],
      alert_summary: data.alert_summary ?? { total: 0, firing: 0, resolved: 0 },
      log_trend: data.log_trend ?? [],
    };
  } catch (error) {
    if (shouldFallbackToLocalStore(error)) {
      return buildLocalDashboardOverview(range);
    }
    throw error;
  }
}

export async function queryRealtimeLogs(payload: QueryLogsPayload): Promise<QueryLogsResult> {
  const buildLocalResult = () => {
    const result = buildLocalRealtimeLogsResult(payload);
    if (payload.recordHistory) {
      appendLocalQueryHistory(payload.keywords, result.queryTimeMS, result.total);
    }
    return result;
  };

  if (shouldUseQueryCollectionFallback()) {
    return buildLocalResult();
  }

  try {
    const envelope = await requestQueryApi<QueryLogsApiData>('/logs', {
      method: 'POST',
      signal: payload.signal,
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
        pit_id: payload.pitId?.trim() || undefined,
        search_after: Array.isArray(payload.searchAfter) && payload.searchAfter.length > 0 ? payload.searchAfter : undefined,
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
    const totalRelation = String(envelope.meta?.total_relation ?? '').trim().toLowerCase();

    const result: QueryLogsResult = {
      hits,
      total: Number.isFinite(total) ? total : hits.length,
      totalIsLowerBound: totalRelation === 'gte' || Boolean(envelope.meta?.total_is_lower_bound),
      page: Number.isFinite(page) ? page : payload.page,
      pageSize: Number.isFinite(pageSize) ? pageSize : payload.pageSize,
      hasNext,
      queryTimeMS: Number.isFinite(queryTimeMS) ? queryTimeMS : 0,
      timedOut,
      aggregations: envelope.data?.aggregations ?? {},
      pitId: typeof envelope.meta?.pit_id === 'string' ? envelope.meta.pit_id.trim() : undefined,
      nextSearchAfter: Array.isArray(envelope.meta?.next_search_after)
        ? [...(envelope.meta.next_search_after as unknown[])]
        : undefined,
    };
    if (payload.recordHistory) {
      appendLocalQueryHistory(payload.keywords, result.queryTimeMS, result.total);
    }
    return result;
  } catch (error) {
    if (shouldFallbackToLocalStore(error)) {
      return buildLocalResult();
    }
    throw error;
  }
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
    const backendAvailableTags = Array.isArray(envelope.meta?.available_tags)
      ? normalizeSavedQueryTags((envelope.meta?.available_tags as unknown[]).map((tag) => String(tag ?? '')))
      : undefined;
    const backendResult: SavedQueryListResult = {
      items,
      total,
      page,
      pageSize,
      hasNext: Boolean(envelope.meta?.has_next ?? page * pageSize < total),
      availableTags: backendAvailableTags,
    };
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
  groupBy: 'level' | 'source' | 'hour' | 'minute';
  timeRange: '30m' | '1h' | '6h' | '24h' | '7d';
  keywords?: string;
  filters?: Record<string, unknown>;
  signal?: AbortSignal;
}

/** Aggregate bucket from API */
export interface AggregateBucket {
  key: string;
  count: number;
  label?: string;
  host?: string;
  service?: string;
}

export interface QueryResultFallbackInfo {
  kind: 'realtime-log-derived' | 'aggregate-derived' | 'local-demo';
  label: string;
  description: string;
}

/** Aggregate stats result */
export interface FetchAggregateStatsResult {
  buckets: AggregateBucket[];
  fallbackInfo?: QueryResultFallbackInfo;
}

/** Fetch aggregate stats from query API */
export async function fetchAggregateStats(params: FetchAggregateStatsParams): Promise<FetchAggregateStatsResult> {
  if (shouldUseQueryCollectionFallback()) {
    return buildLocalAggregateStats(params);
  }

  try {
    const envelope = await requestQueryApi<{ buckets?: AggregateBucket[] }>('/stats/aggregate', {
      method: 'POST',
      signal: params.signal,
      body: {
        group_by: params.groupBy,
        time_range: params.timeRange,
        keywords: params.keywords?.trim() ?? '',
        filters: params.filters ?? {},
      },
    });

    const buckets = envelope.data?.buckets ?? [];
    return { buckets };
  } catch (error) {
    if (shouldFallbackToLocalStore(error)) {
      return buildLocalAggregateStats(params);
    }
    if (shouldFallbackToRealtimeLogDerivation(error)) {
      try {
        const realtimeResult = await fetchRealtimeLogsForDerivedStats({
          keywords: params.keywords,
          filters: params.filters,
          timeRange: resolveAggregateTimeRange(params.timeRange),
          limit: 2000,
          signal: params.signal,
        });
        return {
          ...buildAggregateStatsFromLogs(realtimeResult.hits, params.groupBy),
          fallbackInfo: {
            kind: 'realtime-log-derived',
            label: '已使用实时日志降级计算',
            description: '聚合统计接口暂不可用，当前结果由实时日志命中结果临时推导生成。',
          },
        };
      } catch {
        throw error;
      }
    }
    throw error;
  }
}

export interface AnomalyTrendPoint {
  time: string;
  actual: number;
  expected: number;
  lower_bound: number;
  upper_bound: number;
  is_anomaly: boolean;
  error_rate: number;
}

export interface DetectedAnomaly {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'investigating' | 'resolved' | 'dismissed';
  timestamp: string;
  service: string;
  confidence: number;
  metric: string;
  expected_value: number;
  actual_value: number;
  root_cause?: string;
}

export interface AnomalySummary {
  total_anomalies: number;
  critical_count: number;
  health_score: number;
  anomalous_buckets: number;
  affected_services: number;
}

export interface FetchAnomalyStatsParams {
  timeRange: '1h' | '6h' | '24h' | '7d';
  keywords?: string;
  filters?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface FetchAnomalyStatsResult {
  summary: AnomalySummary;
  trend: AnomalyTrendPoint[];
  anomalies: DetectedAnomaly[];
  fallbackInfo?: QueryResultFallbackInfo;
}

export interface LogClusterTrendPoint {
  time: string;
  count: number;
}

export interface LogClusterSample {
  timestamp: string;
  message: string;
  variables: Record<string, string>;
  host?: string;
  service?: string;
  level?: string;
}

export interface LogClusterPattern {
  id: string;
  template: string;
  similarity: number;
  occurrences: number;
  first_seen: string;
  last_seen: string;
  level: string;
  trend: LogClusterTrendPoint[];
  samples: LogClusterSample[];
}

export interface LogClusterSummary {
  analyzed_logs_total: number;
  sampled_logs: number;
  unique_patterns: number;
  new_patterns_today: number;
}

export interface FetchLogClustersParams {
  timeRange: '1h' | '24h' | '7d';
  keywords?: string;
  filters?: Record<string, unknown>;
  limit?: number;
  sampleSize?: number;
  signal?: AbortSignal;
}

export interface FetchLogClustersResult {
  summary: LogClusterSummary;
  patterns: LogClusterPattern[];
  fallbackInfo?: QueryResultFallbackInfo;
}

export async function fetchLogClusters(params: FetchLogClustersParams): Promise<FetchLogClustersResult> {
  if (shouldUseQueryCollectionFallback()) {
    return buildLocalLogClusters(params);
  }

  try {
    const envelope = await requestQueryApi<FetchLogClustersResult>('/stats/clusters', {
      method: 'POST',
      signal: params.signal,
      body: {
        time_range: params.timeRange,
        keywords: params.keywords?.trim() ?? '',
        filters: params.filters ?? {},
        limit: params.limit ?? 20,
        sample_size: params.sampleSize ?? 400,
      },
    });

    return {
      summary: envelope.data?.summary ?? {
        analyzed_logs_total: 0,
        sampled_logs: 0,
        unique_patterns: 0,
        new_patterns_today: 0,
      },
      patterns: envelope.data?.patterns ?? [],
    };
  } catch (error) {
    if (shouldFallbackToLocalStore(error)) {
      return buildLocalLogClusters(params);
    }
    if (shouldFallbackToRealtimeLogDerivation(error)) {
      try {
        const realtimeResult = await fetchRealtimeLogsForDerivedStats({
          keywords: params.keywords,
          filters: params.filters,
          timeRange: resolveClusterTimeRange(params.timeRange),
          limit: Math.max(400, Math.min(params.sampleSize ?? 400, 1000)),
          signal: params.signal,
        });
        return {
          ...buildLogClustersFromLogs(realtimeResult.hits, params, realtimeResult.total),
          fallbackInfo: {
            kind: 'realtime-log-derived',
            label: '已使用实时日志降级计算',
            description: '聚类分析接口暂不可用，当前模式结果由实时日志命中结果临时推导生成。',
          },
        };
      } catch {
        throw error;
      }
    }
    throw error;
  }
}

export async function fetchAnomalyStats(params: FetchAnomalyStatsParams): Promise<FetchAnomalyStatsResult> {
  if (shouldUseQueryCollectionFallback()) {
    return buildLocalAnomalyStats(params);
  }

  try {
    const envelope = await requestQueryApi<FetchAnomalyStatsResult>('/stats/anomalies', {
      method: 'POST',
      signal: params.signal,
      body: {
        time_range: params.timeRange,
        keywords: params.keywords?.trim() ?? '',
        filters: params.filters ?? {},
      },
    });

    return {
      summary: envelope.data?.summary ?? {
        total_anomalies: 0,
        critical_count: 0,
        health_score: 100,
        anomalous_buckets: 0,
        affected_services: 0,
      },
      trend: envelope.data?.trend ?? [],
      anomalies: envelope.data?.anomalies ?? [],
    };
  } catch (error) {
    if (shouldFallbackToLocalStore(error)) {
      return buildLocalAnomalyStats(params);
    }
    if (shouldFallbackToAggregateDerivedAnomalyStats(error)) {
      try {
        const aggregateResult = await fetchAggregateStats({
          groupBy: resolveAggregateGroupByForAnomalyTimeRange(params.timeRange),
          timeRange: params.timeRange,
          keywords: params.keywords,
          filters: params.filters,
          signal: params.signal,
        });
        const fallbackInfo: QueryResultFallbackInfo = aggregateResult.fallbackInfo?.kind === 'realtime-log-derived'
          ? {
            kind: 'realtime-log-derived',
            label: '已使用实时日志降级计算',
            description: '异常检测接口暂不可用，且聚合统计已回退为实时日志推导，当前异常结果为降级计算结果。',
          }
          : {
            kind: 'aggregate-derived',
            label: '已使用聚合统计降级计算',
            description: '异常检测接口暂不可用，当前异常结果由聚合统计临时推导生成。',
          };
        return {
          ...buildAggregateBackedAnomalyStats(aggregateResult.buckets, resolveFallbackAnomalyService(params.filters)),
          fallbackInfo,
        };
      } catch {
        throw error;
      }
    }
    throw error;
  }
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

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
    const source = String(log.fields?.source_path ?? log.fields?.source ?? '').trim();
    if (!source) {
      return;
    }
    const current = buckets.get(source) ?? {
      source,
      host: log.host,
      service: log.service,
      count: 0,
    };
    current.count += 1;
    buckets.set(source, current);
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

function buildLocalDashboardOverview(): DashboardOverviewStats {
  const now = new Date();
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
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
  for (let index = 23; index >= 0; index -= 1) {
    const key = truncateDateToHour(new Date(now.getTime() - index * 60 * 60 * 1000)).toISOString();
    trendBuckets.set(key, 0);
  }
  logs.forEach((log) => {
    const key = truncateDateToHour(new Date(log.timestamp)).toISOString();
    trendBuckets.set(key, (trendBuckets.get(key) ?? 0) + 1);
  });

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

function buildLocalAggregateStats(params: FetchAggregateStatsParams): FetchAggregateStatsResult {
  const logs = filterLocalDemoLogs({
    keywords: params.keywords,
    filters: params.filters,
    timeRange: resolveAggregateTimeRange(params.timeRange),
  });
  const buckets = new Map<string, number>();

  const sourceBucketMeta = new Map<string, { label: string; host: string; service: string }>();

  logs.forEach((log) => {
    let key = '';
    switch (params.groupBy) {
      case 'level':
        key = log.level;
        break;
      case 'source': {
        const host = String(log.host || log.fields?.host || 'unknown-host').trim() || 'unknown-host';
        const service = String(log.service || log.fields?.service_name || log.fields?.service || 'unknown-service').trim() || 'unknown-service';
        key = `${host}\u001f${service}`;
        sourceBucketMeta.set(key, {
          host,
          service,
          label: `${host} / ${service}`,
        });
        break;
      }
      case 'hour':
        key = truncateDateToHour(new Date(log.timestamp)).toISOString();
        break;
      case 'minute':
        key = truncateDateToMinute(new Date(log.timestamp)).toISOString();
        break;
      default:
        key = '-';
    }
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  });

  const items = Array.from(buckets.entries()).map(([key, count]) => {
    if (params.groupBy !== 'source') {
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
  if (params.groupBy === 'hour' || params.groupBy === 'minute') {
    items.sort((left, right) => left.key.localeCompare(right.key));
  } else {
    items.sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
  }
  return { buckets: items };
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

function deriveDashboardTopSourceService(source: string): string {
  const normalized = source.trim().replace(/\\/g, '/');
  if (!normalized) {
    return 'unknown';
  }
  const segments = normalized.split('/').filter(Boolean);
  const tail = segments[segments.length - 1] ?? normalized;
  const display = tail.replace(/\.(log|txt|out|jsonl?)$/i, '').trim();
  return display || tail || 'unknown';
}

function normalizeDashboardTopSource(source: Partial<DashboardTopSource> | null | undefined): DashboardTopSource {
  const rawSource = typeof source?.source === 'string' ? source.source.trim() : '';
  const host = typeof source?.host === 'string' && source.host.trim() ? source.host.trim() : 'unknown';
  const service = typeof source?.service === 'string' && source.service.trim()
    ? source.service.trim()
    : deriveDashboardTopSourceService(rawSource);

  return {
    source: rawSource,
    host,
    service,
    count: Number(source?.count) || 0,
  };
}

/** Fetch dashboard overview stats */
export async function fetchDashboardOverview(): Promise<DashboardOverviewStats> {
  if (shouldUseQueryCollectionFallback()) {
    return buildLocalDashboardOverview();
  }

  try {
    const envelope = await requestQueryApi<DashboardOverviewStats>('/stats/overview', { method: 'GET' });
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
      return buildLocalDashboardOverview();
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

/** Aggregate stats result */
export interface FetchAggregateStatsResult {
  buckets: AggregateBucket[];
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

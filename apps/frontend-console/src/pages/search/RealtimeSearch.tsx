import React, {
  useEffect,
  useMemo,
  useCallback,
  useState,
  useRef,
} from "react";
import { usePaginationQuickJumperAccessibility } from "../../components/common/usePaginationQuickJumperAccessibility";
import InlineLoadingState from "../../components/common/InlineLoadingState";
import InlineErrorState from "../../components/common/InlineErrorState";
import {
  App,
  Input,
  Button,
  Tag,
  Table,
  Drawer,
  Space,
  Tooltip,
  Descriptions,
  Divider,
  Typography,
  Select,
  Collapse,
  Empty,
  Alert,
  Pagination,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useLocation } from "react-router-dom";
import { useThemeStore } from "../../stores/themeStore";
import { usePreferencesStore } from "../../stores/preferencesStore";
import { COLORS } from "../../theme/tokens";
import ChartWrapper from "../../components/charts/ChartWrapper";
import type { EChartsCoreOption } from "echarts/core";
import type { LogEntry } from "../../types/log";
import {
  createSavedQuery,
  fetchAggregateStats,
  queryRealtimeLogs,
} from "../../api/query";
import {
  aggregateRealtimeDisplayLogs,
  summarizeImageAggregation,
} from "./realtimeLogAggregation";
import {
  readRealtimeRecentQueries,
  recordRealtimeRecentQuery,
} from "./realtimeRecentQueries";
import {
  clearPendingRealtimeStartupQuery,
  readPendingRealtimeStartupQuery,
} from "./realtimeStartupQuery";
import {
  buildRealtimeHistogramData,
  type RealtimeHistogramPoint,
} from "./realtimeHistogram";
import {
  buildRealtimeHistogramFilters,
  buildRealtimeQueryFilters,
  shouldRelaxRealtimeHistogramNoiseFilter,
} from "./realtimeNoiseFilters";
import {
  buildRealtimeHistogramRefreshKey,
  shouldRefreshRealtimeHistogram,
  type RealtimeHistogramRefreshMode,
} from "./realtimeRefreshPolicy";
import { normalizeRealtimePresetQuery } from "./realtimePresetQuery";
import type {
  RealtimeQueryFilters,
  RealtimeQueryFilterValue,
} from "./realtimeQueryFilterTypes";
import {
  buildQueryCleanupFallbackFilters,
  buildQueryCleanupState,
} from "./queryCleanupState";
import QueryCleanupPreviewContent from "./queryCleanupPreviewContent";
import {
  resolveRealtimeLogsEmptyDescription,
  resolveSearchPageLoadingLabel,
} from "./searchPagePresentation";

// ============================================================================
// 本地 UI 辅助数据
// ============================================================================

const MAX_PAGINATION_WINDOW_ROWS = 10_000;
const LIVE_POLL_INTERVAL_MS = 5_000;
const STARTUP_QUERY_DELAY_MS = 200;
const MOBILE_BREAKPOINT = 768;

type RealtimeExplicitTimeRange = {
  from?: string;
  to?: string;
};

type LiveWindowOption = "5m" | "15m" | "30m" | "1h" | "all" | "custom";

const DEFAULT_LIVE_WINDOW: LiveWindowOption = "15m";
const BASE_LIVE_WINDOW_OPTIONS: Array<{
  value: Exclude<LiveWindowOption, "custom">;
  label: string;
}> = [
  { value: "5m", label: "最近 5 分钟" },
  { value: "15m", label: "最近 15 分钟" },
  { value: "30m", label: "最近 30 分钟" },
  { value: "1h", label: "最近 1 小时" },
  { value: "all", label: "全部时间" },
];

function normalizeRealtimeExplicitTimeRange(
  timeRange?: RealtimeExplicitTimeRange | null,
): RealtimeExplicitTimeRange | null {
  if (!timeRange) {
    return null;
  }
  const from = timeRange.from?.trim() ?? "";
  const to = timeRange.to?.trim() ?? "";
  if (!from && !to) {
    return null;
  }
  return {
    from: from || undefined,
    to: to || undefined,
  };
}

function hasRealtimeExplicitTimeRange(
  timeRange?: RealtimeExplicitTimeRange | null,
): boolean {
  return Boolean(timeRange?.from?.trim() || timeRange?.to?.trim());
}

function formatRealtimeExplicitTimeRange(
  timeRange?: RealtimeExplicitTimeRange | null,
): string {
  const normalized = normalizeRealtimeExplicitTimeRange(timeRange);
  if (!normalized) {
    return "";
  }
  const fromText = normalized.from
    ? new Date(normalized.from).toLocaleString("zh-CN")
    : "起始未限制";
  const toText = normalized.to
    ? new Date(normalized.to).toLocaleString("zh-CN")
    : "结束未限制";
  return `${fromText} ~ ${toText}`;
}

function normalizeRealtimeExtraFilterValue(
  value: RealtimeQueryFilterValue,
): RealtimeQueryFilterValue | null {
  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue ? trimmedValue : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    const normalizedValues = value
      .map((item) => normalizeRealtimeExtraFilterValue(item))
      .filter((item): item is RealtimeQueryFilterValue => item != null);
    return normalizedValues.length > 0 ? normalizedValues : null;
  }
  if (value && typeof value === "object") {
    const normalizedObject = normalizeRealtimeExtraFilters(
      value as RealtimeQueryFilters,
    );
    return Object.keys(normalizedObject).length > 0 ? normalizedObject : null;
  }
  return null;
}

function normalizeRealtimeExtraFilters(
  filters?: RealtimeQueryFilters | null,
): RealtimeQueryFilters {
  return Object.entries(filters ?? {}).reduce<RealtimeQueryFilters>(
    (result, [key, value]) => {
      const normalizedKey = key.trim();
      if (
        !normalizedKey ||
        normalizedKey === "level" ||
        normalizedKey === "service" ||
        normalizedKey === "source"
      ) {
        return result;
      }
      const normalizedValue = normalizeRealtimeExtraFilterValue(value);
      if (normalizedValue == null) {
        return result;
      }
      result[normalizedKey] = normalizedValue;
      return result;
    },
    {},
  );
}

function sortRealtimeFilterValue(
  value: RealtimeQueryFilterValue,
): RealtimeQueryFilterValue {
  if (Array.isArray(value)) {
    return value.map((item) => sortRealtimeFilterValue(item));
  }
  if (value && typeof value === "object") {
    const objectValue = value as RealtimeQueryFilters;
    return Object.keys(objectValue)
      .sort((left, right) => left.localeCompare(right))
      .reduce<RealtimeQueryFilters>((result, key) => {
        result[key] = sortRealtimeFilterValue(objectValue[key]);
        return result;
      }, {});
  }
  return value;
}

function serializeRealtimeExtraFilterState(
  filters?: RealtimeQueryFilters | null,
): string {
  const normalizedFilters = normalizeRealtimeExtraFilters(filters);
  if (Object.keys(normalizedFilters).length === 0) {
    return "";
  }
  return JSON.stringify(sortRealtimeFilterValue(normalizedFilters));
}

function buildRealtimeFilterStateKey(params: {
  levelFilter?: string;
  sourceFilter?: string;
  extraFilters?: RealtimeQueryFilters | null;
}): string {
  return [
    params.levelFilter?.trim() ?? "",
    params.sourceFilter?.trim() ?? "",
    serializeRealtimeExtraFilterState(params.extraFilters),
  ].join("\u0000");
}

function formatRealtimeFilterTagValue(value: RealtimeQueryFilterValue): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(sortRealtimeFilterValue(value));
}

function resolveRealtimeExtraFilterTags(
  filters?: RealtimeQueryFilters | null,
): Array<{ key: string; label: string; value: string }> {
  const normalizedFilters = normalizeRealtimeExtraFilters(filters);
  return Object.keys(normalizedFilters)
    .sort((left, right) => left.localeCompare(right))
    .map((key) => ({
      key,
      label: key,
      value: formatRealtimeFilterTagValue(normalizedFilters[key]),
    }));
}

function resolveRealtimeWindowDurationMS(liveWindow: LiveWindowOption): number {
  switch (liveWindow) {
    case "5m":
      return 5 * 60 * 1000;
    case "30m":
      return 30 * 60 * 1000;
    case "1h":
      return 60 * 60 * 1000;
    case "15m":
    default:
      return 15 * 60 * 1000;
  }
}

function shouldAutoFallbackEmptyRealtimeWindow(params: {
  fallbackMode?: "none" | "autoAll";
  resultTotal: number;
  page: number;
  queryText: string;
  levelFilter: string;
  sourceFilter: string;
  extraFilters: RealtimeQueryFilters;
  liveWindow: LiveWindowOption;
  explicitTimeRange?: RealtimeExplicitTimeRange | null;
}): boolean {
  if (params.fallbackMode !== "autoAll") {
    return false;
  }
  if (params.resultTotal > 0 || params.page !== 1) {
    return false;
  }
  if (params.queryText.trim()) {
    return false;
  }
  if (params.levelFilter.trim() || params.sourceFilter.trim()) {
    return false;
  }
  if (Object.keys(normalizeRealtimeExtraFilters(params.extraFilters)).length > 0) {
    return false;
  }
  if (hasRealtimeExplicitTimeRange(params.explicitTimeRange)) {
    return false;
  }
  return params.liveWindow !== "all" && params.liveWindow !== "custom";
}

export function shouldSuppressNextLiveTickAfterInteractiveRefresh(params: {
  isLive: boolean;
  liveWindow: LiveWindowOption;
  explicitTimeRange?: RealtimeExplicitTimeRange | null;
}): boolean {
  if (!params.isLive) {
    return false;
  }
  if (hasRealtimeExplicitTimeRange(params.explicitTimeRange)) {
    return false;
  }
  return params.liveWindow !== "all" && params.liveWindow !== "custom";
}

export function shouldSuppressNextLiveTickAfterPaginationRefresh(params: {
  isLive: boolean;
  liveWindow: LiveWindowOption;
  explicitTimeRange?: RealtimeExplicitTimeRange | null;
  pageSizeChanged: boolean;
  targetPage: number;
}): boolean {
  if (!params.pageSizeChanged || params.targetPage !== 1) {
    return false;
  }
  return shouldSuppressNextLiveTickAfterInteractiveRefresh({
    isLive: params.isLive,
    liveWindow: params.liveWindow,
    explicitTimeRange: params.explicitTimeRange,
  });
}

function shouldUseUnboundedRealtimeQuery(
  liveWindow: LiveWindowOption,
  explicitTimeRange?: RealtimeExplicitTimeRange | null,
): boolean {
  return (
    liveWindow === "all" && !hasRealtimeExplicitTimeRange(explicitTimeRange)
  );
}

export function buildRealtimeTableTimeRange(
  liveWindow: LiveWindowOption,
  snapshotTo?: string,
  explicitTimeRange?: RealtimeExplicitTimeRange | null,
) {
  const snapshot = snapshotTo?.trim() ? new Date(snapshotTo) : new Date();
  const normalizedSnapshot = Number.isNaN(snapshot.getTime())
    ? new Date()
    : snapshot;
  const normalizedExplicitTimeRange =
    normalizeRealtimeExplicitTimeRange(explicitTimeRange);
  if (normalizedExplicitTimeRange) {
    return {
      from: normalizedExplicitTimeRange.from ?? "",
      to: normalizedExplicitTimeRange.to ?? normalizedSnapshot.toISOString(),
    };
  }
  if (
    shouldUseUnboundedRealtimeQuery(liveWindow, normalizedExplicitTimeRange)
  ) {
    return {
      from: "",
      to: normalizedSnapshot.toISOString(),
    };
  }
  return {
    from: new Date(
      normalizedSnapshot.getTime() -
        resolveRealtimeWindowDurationMS(liveWindow),
    ).toISOString(),
    to: normalizedSnapshot.toISOString(),
  };
}

export function getRealtimeTableDataSourceForRender(params: {
  logs: LogEntry[];
  pageSize: number;
  currentPage: number;
  tableRefreshing: boolean;
}): LogEntry[] {
  if (
    !params.tableRefreshing ||
    params.currentPage !== 1 ||
    params.logs.length <= params.pageSize
  ) {
    return params.logs;
  }
  return params.logs.slice(0, params.pageSize);
}

function resolveRealtimeHistogramRequestTimeRange(
  liveWindow: LiveWindowOption,
  explicitTimeRange?: RealtimeExplicitTimeRange | null,
): "30m" | "1h" | null {
  if (
    hasRealtimeExplicitTimeRange(explicitTimeRange) ||
    liveWindow === "all" ||
    liveWindow === "custom"
  ) {
    return null;
  }
  return liveWindow === "1h" ? "1h" : "30m";
}

function filterRealtimeHistogramBucketsByLiveWindow<
  T extends { key: string; count: number },
>(buckets: T[], liveWindow: LiveWindowOption, snapshotTo?: string): T[] {
  if (liveWindow === "30m" || liveWindow === "1h") {
    return buckets;
  }

  const snapshot = snapshotTo?.trim() ? new Date(snapshotTo) : new Date();
  const normalizedSnapshotMS = Number.isNaN(snapshot.getTime())
    ? Date.now()
    : snapshot.getTime();
  const fromMS =
    normalizedSnapshotMS - resolveRealtimeWindowDurationMS(liveWindow);

  return buckets.filter((bucket) => {
    const bucketTimeMS = new Date(bucket.key).getTime();
    if (Number.isNaN(bucketTimeMS)) {
      return true;
    }
    return bucketTimeMS >= fromMS && bucketTimeMS <= normalizedSnapshotMS;
  });
}

function resolveMaxPaginationPage(pageSize: number): number {
  const normalizedPageSize = Math.max(1, Math.floor(pageSize || 1));
  return Math.max(
    1,
    Math.floor(MAX_PAGINATION_WINDOW_ROWS / normalizedPageSize),
  );
}

export function shouldBlockRealtimeDirectPageJump(
  page: number,
  pageSize: number,
  deepPaginationRestricted: boolean,
  cursor?: RealtimePageCursor,
): boolean {
  if (!deepPaginationRestricted) {
    return false;
  }
  return page > resolveMaxPaginationPage(pageSize) && !cursor;
}

export function shouldResolveRealtimeDeepPageCursor(
  page: number,
  pageSize: number,
  cursor?: RealtimePageCursor,
): boolean {
  if (page <= resolveMaxPaginationPage(pageSize)) {
    return false;
  }
  return !Array.isArray(cursor?.searchAfter) || cursor.searchAfter.length === 0;
}

function formatRealtimeTotal(total: number, isLowerBound: boolean): string {
  const normalizedTotal = Number.isFinite(total) ? total : 0;
  const displayTotal = Math.max(
    0,
    Math.floor(normalizedTotal),
  ).toLocaleString();
  return isLowerBound ? `${displayTotal}+` : displayTotal;
}

function formatRealtimeTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return toDisplayText(value);
  }
  return parsed.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function toDisplayText(value: unknown, fallback = "—"): string {
  if (value == null) {
    return fallback;
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || fallback;
  }
  return String(value);
}

function formatDetailValue(value: unknown, fallback = "—"): string {
  if (value == null || value === "") {
    return fallback;
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || fallback;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// ============================================================================
// 级别颜色映射
// ============================================================================
const LEVEL_CONFIG: Record<string, { color: string; tagColor: string }> = {
  error: { color: COLORS.danger, tagColor: "error" },
  warn: { color: COLORS.warning, tagColor: "warning" },
  info: { color: COLORS.info, tagColor: "processing" },
  debug: { color: COLORS.purple, tagColor: "purple" },
};

interface RealtimeNavigationState {
  autoRun?: boolean;
  presetQuery?: string;
  timeRange?: RealtimeExplicitTimeRange;
}

export interface RealtimePageCursor {
  pitId?: string;
  searchAfter?: unknown[];
}

function cloneSearchAfter(searchAfter?: unknown[]): unknown[] | undefined {
  return Array.isArray(searchAfter) && searchAfter.length > 0
    ? [...searchAfter]
    : undefined;
}

function buildRealtimePageCursor(
  pitId?: string,
  searchAfter?: unknown[],
): RealtimePageCursor | undefined {
  const normalizedPitId = pitId?.trim() || undefined;
  const normalizedSearchAfter = cloneSearchAfter(searchAfter);
  if (!normalizedPitId && !normalizedSearchAfter) {
    return undefined;
  }
  return {
    pitId: normalizedPitId,
    searchAfter: normalizedSearchAfter,
  };
}

function cloneRealtimePageCursor(
  cursor?: RealtimePageCursor,
): RealtimePageCursor | undefined {
  if (!cursor) {
    return undefined;
  }
  return buildRealtimePageCursor(cursor.pitId, cursor.searchAfter);
}

function cloneRealtimePageCursorMap(
  source: Map<number, RealtimePageCursor>,
): Map<number, RealtimePageCursor> {
  const next = new Map<number, RealtimePageCursor>();
  source.forEach((cursor, page) => {
    const cloned = cloneRealtimePageCursor(cursor);
    if (cloned) {
      next.set(page, cloned);
    }
  });
  return next;
}

function refreshCursorMapPitID(
  cursorMap: Map<number, RealtimePageCursor>,
  pitId: string,
): void {
  const normalizedPitId = pitId.trim();
  if (!normalizedPitId) {
    return;
  }
  cursorMap.forEach((cursor, page) => {
    cursorMap.set(page, {
      pitId: normalizedPitId,
      searchAfter: cloneSearchAfter(cursor.searchAfter),
    });
  });
}

interface EnsureRealtimePageCursorOptions {
  targetPage: number;
  pageSize: number;
  queryText: string;
  filters: Record<string, unknown>;
  timeRange: { from?: string; to?: string };
  cursorMap: Map<number, RealtimePageCursor>;
  isRequestStale?: () => boolean;
  registerAbortController?: (controller: AbortController) => AbortController;
  unregisterAbortController?: (controller: AbortController | null) => void;
  queryLogs?: typeof queryRealtimeLogs;
}

type RealtimeExecuteQueryStatus = "success" | "failed" | "stale";

export async function ensureRealtimePageCursor(
  options: EnsureRealtimePageCursorOptions,
): Promise<{
  cursorMap: Map<number, RealtimePageCursor>;
  cursor?: RealtimePageCursor;
}> {
  const {
    targetPage,
    pageSize,
    queryText,
    filters,
    timeRange,
    isRequestStale,
    registerAbortController,
    unregisterAbortController,
  } = options;
  const queryLogs = options.queryLogs ?? queryRealtimeLogs;
  const nextCursorMap = cloneRealtimePageCursorMap(options.cursorMap);
  const maxPaginationPage = resolveMaxPaginationPage(pageSize);
  const cachedTargetCursor = cloneRealtimePageCursor(
    nextCursorMap.get(targetPage),
  );

  if (
    targetPage <= maxPaginationPage ||
    !shouldResolveRealtimeDeepPageCursor(
      targetPage,
      pageSize,
      cachedTargetCursor,
    )
  ) {
    return { cursorMap: nextCursorMap, cursor: cachedTargetCursor };
  }

  const rootCursor = cloneRealtimePageCursor(nextCursorMap.get(1));
  let currentPage = 0;
  nextCursorMap.forEach((cursor, page) => {
    if (
      page <= targetPage &&
      page > currentPage &&
      Array.isArray(cursor.searchAfter) &&
      cursor.searchAfter.length > 0
    ) {
      currentPage = page;
    }
  });
  let currentCursor =
    currentPage > 0
      ? cloneRealtimePageCursor(nextCursorMap.get(currentPage))
      : undefined;

  const runCursorQuery = async (
    payload: Parameters<typeof queryRealtimeLogs>[0],
  ) => {
    const controller = registerAbortController?.(new AbortController()) ?? null;
    try {
      return await queryLogs({
        ...payload,
        recordHistory: false,
        signal: controller?.signal,
      });
    } finally {
      unregisterAbortController?.(controller);
    }
  };

  if (!currentCursor) {
    const bridgePage = maxPaginationPage;
    const bridgeResult = await runCursorQuery({
      keywords: queryText,
      page: bridgePage,
      pageSize,
      filters,
      timeRange,
      pitId: rootCursor?.pitId,
    });
    if (isRequestStale?.()) {
      return { cursorMap: nextCursorMap };
    }
    const bridgePitId = bridgeResult.pitId?.trim() || "";
    if (bridgePitId) {
      refreshCursorMapPitID(nextCursorMap, bridgePitId);
      nextCursorMap.set(1, { pitId: bridgePitId });
    }
    currentPage = bridgePage + 1;
    currentCursor = buildRealtimePageCursor(
      bridgePitId,
      bridgeResult.nextSearchAfter,
    );
    if (currentCursor) {
      nextCursorMap.set(currentPage, currentCursor);
    }
  }

  while (currentPage < targetPage && currentCursor) {
    const stepResult = await runCursorQuery({
      keywords: queryText,
      page: currentPage,
      pageSize,
      filters,
      timeRange,
      pitId: currentCursor.pitId,
      searchAfter: currentCursor.searchAfter,
    });
    if (isRequestStale?.()) {
      return { cursorMap: nextCursorMap };
    }
    const nextPitId =
      stepResult.pitId?.trim() || currentCursor.pitId?.trim() || "";
    if (nextPitId) {
      refreshCursorMapPitID(nextCursorMap, nextPitId);
    }
    currentPage += 1;
    currentCursor = buildRealtimePageCursor(
      nextPitId,
      stepResult.nextSearchAfter,
    );
    if (currentCursor) {
      nextCursorMap.set(currentPage, currentCursor);
    }
  }

  return {
    cursorMap: nextCursorMap,
    cursor: cloneRealtimePageCursor(nextCursorMap.get(targetPage)),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

// ============================================================================
// RealtimeSearch 主组件
// ============================================================================
const RealtimeSearch: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const location = useLocation();
  const { message, modal } = App.useApp();

  // 查询状态
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [isLive, setIsLive] = useState(true);
  const [liveWindow, setLiveWindow] =
    useState<LiveWindowOption>(DEFAULT_LIVE_WINDOW);
  const [customTimeRange, setCustomTimeRange] =
    useState<RealtimeExplicitTimeRange | null>(null);
  const [recentQueries, setRecentQueries] = useState<string[]>(() =>
    readRealtimeRecentQueries(),
  );

  // 筛选器
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [extraFilters, setExtraFilters] = useState<RealtimeQueryFilters>({});
  const normalizedCustomTimeRange = useMemo(
    () => normalizeRealtimeExplicitTimeRange(customTimeRange),
    [customTimeRange],
  );
  const hasCustomTimeRange = hasRealtimeExplicitTimeRange(
    normalizedCustomTimeRange,
  );
  const customTimeRangeLabel = useMemo(
    () => formatRealtimeExplicitTimeRange(normalizedCustomTimeRange),
    [normalizedCustomTimeRange],
  );
  const normalizedExtraFilters = useMemo(
    () => normalizeRealtimeExtraFilters(extraFilters),
    [extraFilters],
  );
  const extraFilterStateKey = useMemo(
    () => serializeRealtimeExtraFilterState(normalizedExtraFilters),
    [normalizedExtraFilters],
  );
  const extraFilterTags = useMemo(
    () => resolveRealtimeExtraFilterTags(normalizedExtraFilters),
    [normalizedExtraFilters],
  );
  const livePollingDisabled = hasCustomTimeRange || liveWindow === "all";
  const histogramDisabled = hasCustomTimeRange || liveWindow === "all";
  const liveWindowOptions = useMemo(() => {
    if (!hasCustomTimeRange) {
      return BASE_LIVE_WINDOW_OPTIONS;
    }
    return [
      ...BASE_LIVE_WINDOW_OPTIONS,
      { value: "custom" as const, label: "历史时间范围" },
    ];
  }, [hasCustomTimeRange]);

  // 日志详情抽屉
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  // 查询结果状态
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [queryTimeMS, setQueryTimeMS] = useState(0);
  const [queryTimedOut, setQueryTimedOut] = useState(false);
  const [totalIsLowerBound, setTotalIsLowerBound] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [tableRefreshing, setTableRefreshing] = useState(false);
  const [tableUsingStaleData, setTableUsingStaleData] = useState(false);
  const [tableErrorText, setTableErrorText] = useState("");
  const [tableStaleErrorText, setTableStaleErrorText] = useState("");
  const [retryingCurrentQuery, setRetryingCurrentQuery] = useState(false);
  const [retryingHistogram, setRetryingHistogram] = useState(false);
  const [histogramInitialLoading, setHistogramInitialLoading] = useState(true);
  const [histogramRefreshing, setHistogramRefreshing] = useState(false);
  const [histogramUsingStaleData, setHistogramUsingStaleData] = useState(false);
  const [histogramErrorText, setHistogramErrorText] = useState("");
  const [histogramNoiseFilterRelaxed, setHistogramNoiseFilterRelaxed] =
    useState(false);
  const [histogramData, setHistogramData] = useState<RealtimeHistogramPoint[]>(
    [],
  );
  const [tableSnapshotTo, setTableSnapshotTo] = useState(() =>
    new Date().toISOString(),
  );

  // 分页（pageSize 持久化）
  const [currentPage, setCurrentPage] = useState(1);
  const storedPageSize = usePreferencesStore(
    (s) => s.pageSizes["realtimeSearch"] ?? 20,
  );
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);
  const [isMobile, setIsMobile] = useState(false);
  const setPageSize = useCallback(
    (size: number) => {
      setPageSizeLocal(size);
      setStoredPageSize("realtimeSearch", size);
    },
    [setStoredPageSize],
  );

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const latestQueryRequestRef = useRef(0);
  const latestHistogramRequestRef = useRef(0);
  const inFlightRequestIDRef = useRef<number | null>(null);
  const initialQueryTriggeredRef = useRef(false);
  const pageCursorMapRef = useRef<Map<number, RealtimePageCursor>>(new Map());
  const resultsTableRef =
    usePaginationQuickJumperAccessibility("realtime-search");
  const activeAbortControllersRef = useRef<Set<AbortController>>(new Set());
  const liveTimerRef = useRef<number | null>(null);
  const isLiveRef = useRef(isLive);
  const isUnmountedRef = useRef(false);
  const scheduleNextLiveTickRef = useRef<(delay?: number) => void>(
    () => undefined,
  );
  const lastHistogramRefreshKeyRef = useRef("");
  const lastHistogramFetchedAtRef = useRef(0);
  const activeQueryRef = useRef(activeQuery);
  const pageSizeRef = useRef(pageSize);
  const currentPageRef = useRef(currentPage);
  const startupQueryTimerRef = useRef<number | null>(null);
  const lastFilterStateRef = useRef(
    buildRealtimeFilterStateKey({
      levelFilter,
      sourceFilter,
      extraFilters,
    }),
  );
  const suppressNextLiveTickRef = useRef(false);

  const clearLiveTimer = useCallback(() => {
    if (liveTimerRef.current != null) {
      window.clearTimeout(liveTimerRef.current);
      liveTimerRef.current = null;
    }
  }, []);

  const clearStartupQueryTimer = useCallback(() => {
    if (startupQueryTimerRef.current != null) {
      window.clearTimeout(startupQueryTimerRef.current);
      startupQueryTimerRef.current = null;
    }
  }, []);

  const abortActiveRequests = useCallback(() => {
    activeAbortControllersRef.current.forEach((controller) => {
      controller.abort();
    });
    activeAbortControllersRef.current.clear();
  }, []);

  const registerAbortController = useCallback((controller: AbortController) => {
    activeAbortControllersRef.current.add(controller);
    return controller;
  }, []);

  const unregisterAbortController = useCallback(
    (controller: AbortController | null) => {
      if (!controller) {
        return;
      }
      activeAbortControllersRef.current.delete(controller);
    },
    [],
  );

  const handleRetryHistogram = useCallback(() => {
    if (histogramDisabled) {
      return;
    }

    const histogramRequestID = latestHistogramRequestRef.current + 1;
    latestHistogramRequestRef.current = histogramRequestID;
    const queryText = activeQueryRef.current;
    const hasStaleHistogramData = histogramData.length > 0;
    const histogramFilters = buildRealtimeHistogramFilters({
      levelFilter,
      sourceFilter,
      queryText,
      extraFilters: normalizedExtraFilters,
    });
    const shouldRelaxHistogramNoiseFilter =
      shouldRelaxRealtimeHistogramNoiseFilter({
        levelFilter,
        sourceFilter,
        queryText,
        extraFilters: normalizedExtraFilters,
      });
    const histogramTimeRange = resolveRealtimeHistogramRequestTimeRange(
      liveWindow,
      normalizedCustomTimeRange,
    );

    if (!histogramTimeRange) {
      setRetryingHistogram(false);
      setHistogramRefreshing(false);
      return;
    }

    const histogramRefreshKey = buildRealtimeHistogramRefreshKey({
      queryText,
      levelFilter,
      sourceFilter,
      extraFiltersKey: extraFilterStateKey,
    });
    const totalHistogramController = registerAbortController(
      new AbortController(),
    );
    const errorHistogramController = levelFilter
      ? null
      : registerAbortController(new AbortController());

    setRetryingHistogram(true);
    setHistogramRefreshing(true);

    void (async () => {
      let resolvedTotalHistogram: Awaited<
        ReturnType<typeof fetchAggregateStats>
      > | null = null;
      let resolvedErrorHistogram: Awaited<
        ReturnType<typeof fetchAggregateStats>
      > | null = null;
      let histogramFailed = false;
      let histogramAbortOnly = true;

      try {
        try {
          resolvedTotalHistogram = await fetchAggregateStats({
            groupBy: "minute",
            timeRange: histogramTimeRange,
            keywords: queryText,
            filters: histogramFilters,
            signal: totalHistogramController.signal,
          });
        } catch (error) {
          histogramFailed = true;
          if (!isAbortError(error)) {
            histogramAbortOnly = false;
          }
        }

        if (histogramRequestID !== latestHistogramRequestRef.current) {
          return;
        }

        if (resolvedTotalHistogram && !levelFilter && errorHistogramController) {
          try {
            resolvedErrorHistogram = await fetchAggregateStats({
              groupBy: "minute",
              timeRange: histogramTimeRange,
              keywords: queryText,
              filters: {
                ...histogramFilters,
                level: "error",
              },
              signal: errorHistogramController.signal,
            });
          } catch (error) {
            histogramFailed = true;
            if (!isAbortError(error)) {
              histogramAbortOnly = false;
            }
          }
        }

        if (histogramRequestID !== latestHistogramRequestRef.current) {
          return;
        }

        if (resolvedTotalHistogram) {
          const totalBuckets = filterRealtimeHistogramBucketsByLiveWindow(
            resolvedTotalHistogram.buckets,
            liveWindow,
            tableSnapshotTo,
          );
          const errorBuckets =
            levelFilter === "error"
              ? totalBuckets
              : filterRealtimeHistogramBucketsByLiveWindow(
                  resolvedErrorHistogram?.buckets ?? [],
                  liveWindow,
                  tableSnapshotTo,
                );
          setHistogramData(
            buildRealtimeHistogramData(totalBuckets, errorBuckets),
          );
          setHistogramUsingStaleData(false);
          setHistogramErrorText("");
          setHistogramNoiseFilterRelaxed(shouldRelaxHistogramNoiseFilter);
          setHistogramInitialLoading(false);
          lastHistogramRefreshKeyRef.current = histogramRefreshKey;
          lastHistogramFetchedAtRef.current = Date.now();
          return;
        }

        if (histogramFailed && !histogramAbortOnly) {
          const readableHistogramError = "图表刷新失败，请稍后重试";
          setHistogramUsingStaleData(hasStaleHistogramData);
          setHistogramErrorText(readableHistogramError);
          if (!hasStaleHistogramData) {
            setHistogramNoiseFilterRelaxed(false);
          }
          setHistogramInitialLoading(false);
          message.warning(
            hasStaleHistogramData
              ? "图表刷新失败，已保留上一版统计"
              : readableHistogramError,
          );
        }
      } finally {
        unregisterAbortController(totalHistogramController);
        unregisterAbortController(errorHistogramController);
        if (histogramRequestID === latestHistogramRequestRef.current) {
          setHistogramRefreshing(false);
          setHistogramInitialLoading(false);
          setRetryingHistogram(false);
        }
      }
    })();
  }, [
    extraFilterStateKey,
    histogramData.length,
    histogramDisabled,
    levelFilter,
    liveWindow,
    message,
    normalizedCustomTimeRange,
    normalizedExtraFilters,
    registerAbortController,
    sourceFilter,
    tableSnapshotTo,
    unregisterAbortController,
  ]);

  const executeQuery = useCallback(
    async (options: {
      queryText: string;
      page: number;
      pageSize: number;
      silent?: boolean;
      recordHistory?: boolean;
      snapshotTo?: string;
      cursor?: RealtimePageCursor;
      resetCursor?: boolean;
      liveWindowOverride?: LiveWindowOption;
      timeRangeOverride?: RealtimeExplicitTimeRange | null;
      histogramRefreshMode?: RealtimeHistogramRefreshMode;
      levelFilterOverride?: string;
      sourceFilterOverride?: string;
      extraFiltersOverride?: RealtimeQueryFilters;
      emptyWindowFallbackMode?: "none" | "autoAll";
    }): Promise<RealtimeExecuteQueryStatus> => {
      const requestID = latestQueryRequestRef.current + 1;
      latestQueryRequestRef.current = requestID;
      latestHistogramRequestRef.current += 1;
      inFlightRequestIDRef.current = requestID;
      clearLiveTimer();
      abortActiveRequests();

      const snapshotTo = options.snapshotTo?.trim() || new Date().toISOString();
      setRetryingHistogram(false);
      setTableErrorText("");
      setTableStaleErrorText("");
      setHistogramErrorText("");
      const effectiveLiveWindow = options.liveWindowOverride ?? liveWindow;
      const effectiveLevelFilter = options.levelFilterOverride ?? levelFilter;
      const effectiveSourceFilter =
        options.sourceFilterOverride ?? sourceFilter;
      const effectiveExtraFilters = normalizeRealtimeExtraFilters(
        options.extraFiltersOverride ?? normalizedExtraFilters,
      );
      const workingCursorMap = options.resetCursor
        ? new Map<number, RealtimePageCursor>()
        : cloneRealtimePageCursorMap(pageCursorMapRef.current);
      if (options.resetCursor) {
        pageCursorMapRef.current = new Map();
      }
      const requestedCursor =
        cloneRealtimePageCursor(options.cursor) ??
        cloneRealtimePageCursor(workingCursorMap.get(options.page));
      const rootCursor = cloneRealtimePageCursor(workingCursorMap.get(1));
      let activeCursor =
        requestedCursor ??
        (options.page > 1 && rootCursor?.pitId
          ? { pitId: rootCursor.pitId }
          : undefined);

      let tableSucceeded = false;
      let shouldRefreshHistogram = false;
      let histogramRefreshKey = "";
      const tableController = registerAbortController(new AbortController());
      let totalHistogramController: AbortController | null = null;
      let errorHistogramController: AbortController | null = null;

      try {
        const filters = buildRealtimeQueryFilters({
          levelFilter: effectiveLevelFilter,
          sourceFilter: effectiveSourceFilter,
          queryText: options.queryText,
          extraFilters: effectiveExtraFilters,
        });
        const histogramFilters = buildRealtimeHistogramFilters({
          levelFilter: effectiveLevelFilter,
          sourceFilter: effectiveSourceFilter,
          queryText: options.queryText,
          extraFilters: effectiveExtraFilters,
        });
        const shouldRelaxHistogramNoiseFilter =
          shouldRelaxRealtimeHistogramNoiseFilter({
            levelFilter: effectiveLevelFilter,
            sourceFilter: effectiveSourceFilter,
            queryText: options.queryText,
            extraFilters: effectiveExtraFilters,
          });
        const effectiveExplicitTimeRange = normalizeRealtimeExplicitTimeRange(
          options.timeRangeOverride ?? customTimeRange,
        );
        const realtimeTableTimeRange = buildRealtimeTableTimeRange(
          effectiveLiveWindow,
          snapshotTo,
          effectiveExplicitTimeRange,
        );
        const histogramTimeRange = resolveRealtimeHistogramRequestTimeRange(
          effectiveLiveWindow,
          effectiveExplicitTimeRange,
        );
        histogramRefreshKey = buildRealtimeHistogramRefreshKey({
          queryText: options.queryText,
          levelFilter: effectiveLevelFilter,
          sourceFilter: effectiveSourceFilter,
          extraFiltersKey: serializeRealtimeExtraFilterState(
            effectiveExtraFilters,
          ),
        });
        shouldRefreshHistogram =
          histogramTimeRange != null &&
          shouldRefreshRealtimeHistogram({
            mode: options.histogramRefreshMode,
            nextRequestKey: histogramRefreshKey,
            lastRequestKey: lastHistogramRefreshKeyRef.current,
            lastFetchedAt: lastHistogramFetchedAtRef.current,
            hasHistogramData: histogramData.length > 0,
          });

        if (shouldRefreshHistogram) {
          totalHistogramController = registerAbortController(
            new AbortController(),
          );
          if (!effectiveLevelFilter) {
            errorHistogramController = registerAbortController(
              new AbortController(),
            );
          }
        } else if (histogramTimeRange == null) {
          setHistogramData([]);
          setHistogramUsingStaleData(false);
          setHistogramNoiseFilterRelaxed(false);
          setHistogramInitialLoading(false);
        }

        setTableRefreshing(true);
        setHistogramRefreshing(shouldRefreshHistogram);

        const aggregateParams = histogramTimeRange
          ? {
              groupBy: "minute" as const,
              timeRange: histogramTimeRange,
              keywords: options.queryText,
              filters: histogramFilters,
            }
          : null;
        let resolvedTotalHistogram: Awaited<
          ReturnType<typeof fetchAggregateStats>
        > | null = null;
        let resolvedErrorHistogram: Awaited<
          ReturnType<typeof fetchAggregateStats>
        > | null = null;
        let histogramFailed = false;
        let histogramAbortOnly = true;

        try {
          if (
            shouldResolveRealtimeDeepPageCursor(
              options.page,
              options.pageSize,
              activeCursor,
            )
          ) {
            const { cursorMap: resolvedCursorMap, cursor: resolvedCursor } =
              await ensureRealtimePageCursor({
                targetPage: options.page,
                pageSize: options.pageSize,
                queryText: options.queryText,
                filters,
                timeRange: realtimeTableTimeRange,
                cursorMap: workingCursorMap,
                isRequestStale: () =>
                  requestID !== latestQueryRequestRef.current,
                registerAbortController,
                unregisterAbortController,
              });
            if (requestID !== latestQueryRequestRef.current) {
              return tableSucceeded ? "success" : "stale";
            }
            pageCursorMapRef.current = resolvedCursorMap;
            workingCursorMap.clear();
            resolvedCursorMap.forEach((cursor, page) => {
              workingCursorMap.set(page, cursor);
            });
            activeCursor = cloneRealtimePageCursor(resolvedCursor);
            if (!activeCursor) {
              if (!options.silent) {
                message.warning("深分页游标定位失败，请稍后重试");
              }
              return "failed";
            }
          }

          const result = await queryRealtimeLogs({
            keywords: options.queryText,
            page: options.page,
            pageSize: options.pageSize,
            filters,
            timeRange: realtimeTableTimeRange,
            pitId: activeCursor?.pitId,
            searchAfter: activeCursor?.searchAfter,
            signal: tableController.signal,
            recordHistory: options.recordHistory,
          });

          if (requestID !== latestQueryRequestRef.current) {
            return tableSucceeded ? "success" : "stale";
          }

          const effectivePitId =
            result.pitId?.trim() || activeCursor?.pitId?.trim() || "";
          if (effectivePitId) {
            refreshCursorMapPitID(workingCursorMap, effectivePitId);
            workingCursorMap.set(1, { pitId: effectivePitId });
            const currentPageCursor = workingCursorMap.get(result.page);
            workingCursorMap.set(result.page, {
              pitId: effectivePitId,
              searchAfter: cloneSearchAfter(currentPageCursor?.searchAfter),
            });
            workingCursorMap.delete(result.page + 1);
            if (result.nextSearchAfter && result.nextSearchAfter.length > 0) {
              workingCursorMap.set(result.page + 1, {
                pitId: effectivePitId,
                searchAfter: cloneSearchAfter(result.nextSearchAfter),
              });
            }
          }
          if (
            shouldAutoFallbackEmptyRealtimeWindow({
              fallbackMode: options.emptyWindowFallbackMode,
              resultTotal: result.total,
              page: result.page,
              queryText: options.queryText,
              levelFilter: effectiveLevelFilter,
              sourceFilter: effectiveSourceFilter,
              extraFilters: effectiveExtraFilters,
              liveWindow: effectiveLiveWindow,
              explicitTimeRange: effectiveExplicitTimeRange,
            })
          ) {
            isLiveRef.current = false;
            setIsLive(false);
            setCustomTimeRange(null);
            setLiveWindow("all");
            message.info("最近时段暂无日志，已切换到全部时间展示最近可用日志");
            return executeQuery({
              ...options,
              page: 1,
              resetCursor: true,
              liveWindowOverride: "all",
              timeRangeOverride: null,
              histogramRefreshMode: "force",
              emptyWindowFallbackMode: "none",
              silent: true,
            });
          }

          pageCursorMapRef.current = workingCursorMap;
          setLogs(result.hits);
          setTotal(result.total);
          setTotalIsLowerBound(result.totalIsLowerBound);
          setCurrentPage(result.page);
          setQueryTimeMS(result.queryTimeMS);
          setQueryTimedOut(result.timedOut);
          setTableSnapshotTo(snapshotTo);
          setTableUsingStaleData(false);
          setTableErrorText("");
          setTableStaleErrorText("");
          if (result.timedOut && !options.silent) {
            message.warning("查询超时，结果可能不完整");
          }
          tableSucceeded = true;
        } catch (error) {
          if (requestID !== latestQueryRequestRef.current) {
            return tableSucceeded ? "success" : "stale";
          }
          if (isAbortError(error)) {
            return tableSucceeded ? "success" : "stale";
          }
          const hasStaleTableData = logs.length > 0;
          const readableError =
            error instanceof Error ? error.message : "查询失败，请稍后重试";
          setTableUsingStaleData(hasStaleTableData);
          setTableErrorText(hasStaleTableData ? "" : readableError);
          setTableStaleErrorText(hasStaleTableData ? readableError : "");
          if (!options.silent) {
            if (hasStaleTableData) {
              message.warning("表格刷新失败，已保留上一版结果");
            } else {
              message.error(readableError);
            }
          }
        } finally {
          if (requestID === latestQueryRequestRef.current) {
            setInitialLoading(false);
            setTableRefreshing(false);
          }
        }

        if (requestID !== latestQueryRequestRef.current) {
          return tableSucceeded ? "success" : "stale";
        }

        if (!shouldRefreshHistogram) {
          return tableSucceeded ? "success" : "failed";
        }

        if (aggregateParams && totalHistogramController) {
          try {
            resolvedTotalHistogram = await fetchAggregateStats({
              ...aggregateParams,
              signal: totalHistogramController.signal,
            });
          } catch (error) {
            histogramFailed = true;
            if (!isAbortError(error)) {
              histogramAbortOnly = false;
            }
          }
        }

        if (requestID !== latestQueryRequestRef.current) {
          return tableSucceeded ? "success" : "stale";
        }

        if (
          resolvedTotalHistogram &&
          !effectiveLevelFilter &&
          aggregateParams &&
          errorHistogramController
        ) {
          try {
            resolvedErrorHistogram = await fetchAggregateStats({
              ...aggregateParams,
              filters: {
                ...histogramFilters,
                level: "error",
              },
              signal: errorHistogramController.signal,
            });
          } catch (error) {
            histogramFailed = true;
            if (!isAbortError(error)) {
              histogramAbortOnly = false;
            }
          }
        }

        if (requestID !== latestQueryRequestRef.current) {
          return tableSucceeded ? "success" : "stale";
        }

        const canUpdateHistogram = Boolean(resolvedTotalHistogram);

        if (canUpdateHistogram && resolvedTotalHistogram) {
          const totalBuckets = filterRealtimeHistogramBucketsByLiveWindow(
            resolvedTotalHistogram.buckets,
            effectiveLiveWindow,
            snapshotTo,
          );
          const errorBuckets =
            effectiveLevelFilter === "error"
              ? totalBuckets
              : filterRealtimeHistogramBucketsByLiveWindow(
                  resolvedErrorHistogram?.buckets ?? [],
                  effectiveLiveWindow,
                  snapshotTo,
                );
          setHistogramData(
            buildRealtimeHistogramData(totalBuckets, errorBuckets),
          );
          setHistogramUsingStaleData(false);
          setHistogramErrorText("");
          setHistogramNoiseFilterRelaxed(shouldRelaxHistogramNoiseFilter);
          setHistogramInitialLoading(false);
          lastHistogramRefreshKeyRef.current = histogramRefreshKey;
          lastHistogramFetchedAtRef.current = Date.now();
        } else if (histogramFailed && !histogramAbortOnly) {
          const readableHistogramError = "图表刷新失败，请稍后重试";
          setHistogramUsingStaleData(histogramData.length > 0);
          setHistogramErrorText(readableHistogramError);
          if (histogramData.length === 0) {
            setHistogramNoiseFilterRelaxed(false);
          }
          setHistogramInitialLoading(false);
          if (!options.silent) {
            message.warning(
              histogramData.length > 0
                ? "图表刷新失败，已保留上一版统计"
                : readableHistogramError,
            );
          }
        }

        return tableSucceeded ? "success" : "failed";
      } finally {
        unregisterAbortController(tableController);
        unregisterAbortController(totalHistogramController);
        unregisterAbortController(errorHistogramController);
        if (inFlightRequestIDRef.current === requestID) {
          inFlightRequestIDRef.current = null;
        }
        if (requestID === latestQueryRequestRef.current) {
          setInitialLoading(false);
          setTableRefreshing(false);
          setHistogramRefreshing(false);
          setHistogramInitialLoading(false);
          if (isLiveRef.current && !isUnmountedRef.current) {
            scheduleNextLiveTickRef.current();
          }
        }
      }
    },
    [
      abortActiveRequests,
      clearLiveTimer,
      customTimeRange,
      histogramData.length,
      levelFilter,
      liveWindow,
      logs.length,
      message,
      normalizedExtraFilters,
      registerAbortController,
      sourceFilter,
      unregisterAbortController,
    ],
  );

  const executeQueryRef = useRef(executeQuery);
  const startupAutoRunState = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const queryPreset = searchParams.get("presetQuery")?.trim() ?? "";
    const queryAutoRun = searchParams.get("autoRun")?.trim() ?? "";
    if (
      (queryAutoRun === "1" || queryAutoRun.toLowerCase() === "true") &&
      queryPreset
    ) {
      return { presetQuery: queryPreset, timeRange: null };
    }

    const state = (location.state as RealtimeNavigationState | null) ?? null;
    const presetQuery = state?.presetQuery?.trim() ?? "";
    if (state?.autoRun && presetQuery) {
      return {
        presetQuery,
        timeRange: normalizeRealtimeExplicitTimeRange(state.timeRange),
      };
    }

    const pendingPresetQuery = readPendingRealtimeStartupQuery();
    if (!pendingPresetQuery) {
      return null;
    }
    return { presetQuery: pendingPresetQuery, timeRange: null };
  }, [location.search, location.state]);

  useEffect(() => {
    executeQueryRef.current = executeQuery;
  }, [executeQuery]);

  useEffect(() => {
    activeQueryRef.current = activeQuery;
  }, [activeQuery]);

  useEffect(() => {
    pageSizeRef.current = pageSize;
  }, [pageSize]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  const scheduleNextLiveTick = useCallback(
    (delay = LIVE_POLL_INTERVAL_MS) => {
      clearLiveTimer();
      if (
        !isLiveRef.current ||
        isUnmountedRef.current ||
        document.hidden ||
        livePollingDisabled
      ) {
        return;
      }
      liveTimerRef.current = window.setTimeout(() => {
        liveTimerRef.current = null;
        if (!isLiveRef.current || isUnmountedRef.current || document.hidden) {
          return;
        }
        if (inFlightRequestIDRef.current != null) {
          scheduleNextLiveTickRef.current(delay);
          return;
        }
        if (suppressNextLiveTickRef.current) {
          suppressNextLiveTickRef.current = false;
          scheduleNextLiveTickRef.current(delay);
          return;
        }
        void executeQueryRef.current({
          queryText: activeQueryRef.current,
          page: currentPageRef.current,
          pageSize: pageSizeRef.current,
          silent: true,
          resetCursor: currentPageRef.current === 1,
          histogramRefreshMode: "auto",
        });
      }, delay);
    },
    [clearLiveTimer, livePollingDisabled],
  );

  useEffect(() => {
    scheduleNextLiveTickRef.current = scheduleNextLiveTick;
  }, [scheduleNextLiveTick]);

  const armSuppressedNextLiveTick = useCallback(() => {
    suppressNextLiveTickRef.current = true;
    if (!isLiveRef.current || livePollingDisabled) {
      return;
    }
    scheduleNextLiveTickRef.current(LIVE_POLL_INTERVAL_MS);
  }, [livePollingDisabled]);

  useEffect(() => {
    if (livePollingDisabled && isLive) {
      isLiveRef.current = false;
      setIsLive(false);
      clearLiveTimer();
    }
  }, [clearLiveTimer, isLive, livePollingDisabled]);

  useEffect(() => {
    isLiveRef.current = isLive;
    if (!isLive || livePollingDisabled) {
      clearLiveTimer();
      return;
    }
    if (inFlightRequestIDRef.current == null) {
      scheduleNextLiveTick(LIVE_POLL_INTERVAL_MS);
    }
  }, [clearLiveTimer, isLive, livePollingDisabled, scheduleNextLiveTick]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!isLiveRef.current || livePollingDisabled) {
        return;
      }
      if (document.hidden) {
        clearLiveTimer();
        return;
      }
      if (inFlightRequestIDRef.current != null) {
        return;
      }
      void executeQueryRef.current({
        queryText: activeQueryRef.current,
        page: currentPageRef.current,
        pageSize: pageSizeRef.current,
        silent: true,
        resetCursor: currentPageRef.current === 1,
        histogramRefreshMode: "auto",
      });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [clearLiveTimer, livePollingDisabled]);

  useEffect(
    () => () => {
      isUnmountedRef.current = true;
      clearLiveTimer();
      clearStartupQueryTimer();
      abortActiveRequests();
    },
    [abortActiveRequests, clearLiveTimer, clearStartupQueryTimer],
  );

  useEffect(() => {
    if (initialQueryTriggeredRef.current || startupAutoRunState?.presetQuery) {
      return;
    }
    clearStartupQueryTimer();
    startupQueryTimerRef.current = window.setTimeout(() => {
      startupQueryTimerRef.current = null;
      initialQueryTriggeredRef.current = true;
      void executeQueryRef.current({
        queryText: "",
        page: 1,
        pageSize: pageSizeRef.current,
        silent: true,
        resetCursor: true,
        emptyWindowFallbackMode: "autoAll",
      });
    }, STARTUP_QUERY_DELAY_MS);
    return clearStartupQueryTimer;
  }, [clearStartupQueryTimer, startupAutoRunState]);

  useEffect(() => {
    if (!startupAutoRunState?.presetQuery) {
      return;
    }
    clearStartupQueryTimer();
    startupQueryTimerRef.current = window.setTimeout(() => {
      startupQueryTimerRef.current = null;
      initialQueryTriggeredRef.current = true;
      const normalizedPresetQuery = normalizeRealtimePresetQuery(
        startupAutoRunState.presetQuery,
      );
      const startupTimeRange = normalizeRealtimeExplicitTimeRange(
        startupAutoRunState.timeRange ?? normalizedPresetQuery.timeRange,
      );
      const nextExtraFilters = normalizeRealtimeExtraFilters(
        normalizedPresetQuery.extractedFilters ? normalizedPresetQuery.filters : {},
      );
      lastFilterStateRef.current = buildRealtimeFilterStateKey({
        levelFilter: normalizedPresetQuery.levelFilter,
        sourceFilter: normalizedPresetQuery.sourceFilter,
        extraFilters: nextExtraFilters,
      });
      clearPendingRealtimeStartupQuery();
      setLevelFilter(normalizedPresetQuery.levelFilter);
      setSourceFilter(normalizedPresetQuery.sourceFilter);
      setExtraFilters(nextExtraFilters);
      setQuery(normalizedPresetQuery.queryText);
      setActiveQuery(normalizedPresetQuery.queryText);
      setCustomTimeRange(startupTimeRange);
      if (startupTimeRange) {
        isLiveRef.current = false;
        setIsLive(false);
        setLiveWindow("custom");
      }
      void executeQueryRef.current({
        queryText: normalizedPresetQuery.queryText,
        page: 1,
        pageSize: pageSizeRef.current,
        silent: false,
        resetCursor: true,
        timeRangeOverride: startupTimeRange,
        liveWindowOverride: startupTimeRange ? "custom" : undefined,
        histogramRefreshMode: "force",
        levelFilterOverride: normalizedPresetQuery.levelFilter,
        sourceFilterOverride: normalizedPresetQuery.sourceFilter,
        extraFiltersOverride: nextExtraFilters,
      });
    }, STARTUP_QUERY_DELAY_MS);
    return clearStartupQueryTimer;
  }, [clearStartupQueryTimer, startupAutoRunState]);

  // 筛选器变化时重新执行查询（仅在筛选值实际变化时触发，避免 StrictMode 首次挂载重复执行）
  useEffect(() => {
    const nextFilterState = buildRealtimeFilterStateKey({
      levelFilter,
      sourceFilter,
      extraFilters: normalizedExtraFilters,
    });
    if (lastFilterStateRef.current === nextFilterState) {
      return;
    }
    lastFilterStateRef.current = nextFilterState;
    if (
      shouldSuppressNextLiveTickAfterInteractiveRefresh({
        isLive: isLiveRef.current,
        liveWindow,
        explicitTimeRange: normalizedCustomTimeRange,
      })
    ) {
      armSuppressedNextLiveTick();
    }
    setCurrentPage(1);
    void executeQueryRef.current({
      queryText: activeQueryRef.current,
      page: 1,
      pageSize: pageSizeRef.current,
      silent: true,
      resetCursor: true,
      histogramRefreshMode: "force",
    });
  }, [extraFilterStateKey, levelFilter, normalizedExtraFilters, sourceFilter]);

  // 直方图数据
  const displayLogs = useMemo(() => aggregateRealtimeDisplayLogs(logs), [logs]);
  const tableDataSource = useMemo(
    () =>
      getRealtimeTableDataSourceForRender({
        logs: displayLogs,
        pageSize,
        currentPage,
        tableRefreshing,
      }),
    [currentPage, displayLogs, pageSize, tableRefreshing],
  );
  const imageAggregationSummary = useMemo(
    () => summarizeImageAggregation(displayLogs),
    [displayLogs],
  );
  const uniqueSources = useMemo(() => {
    const seen = new Set<string>();
    logs.forEach((log) => {
      const s = log.service?.trim();
      if (s) seen.add(s);
    });
    return Array.from(seen).sort();
  }, [logs]);

  // 打开日志详情
  const handleRowClick = useCallback((record: LogEntry) => {
    setSelectedLog(record);
    setDrawerOpen(true);
  }, []);

  const runSearch = useCallback(
    (value: string, recordHistory: boolean) => {
      const normalizedQuery = normalizeRealtimePresetQuery(value);
      const keyword = normalizedQuery.queryText;
      const nextLevelFilter = normalizedQuery.extractedFilters
        ? normalizedQuery.levelFilter
        : levelFilter;
      const nextSourceFilter = normalizedQuery.extractedFilters
        ? normalizedQuery.sourceFilter
        : sourceFilter;
      const nextExplicitTimeRange = normalizeRealtimeExplicitTimeRange(
        normalizedQuery.timeRange,
      );
      const nextExtraFilters = normalizedQuery.extractedFilters
        ? normalizeRealtimeExtraFilters(normalizedQuery.filters)
        : normalizedExtraFilters;
      const shouldRecordHistory = recordHistory && keyword !== "";

      if (shouldRecordHistory) {
        setRecentQueries(recordRealtimeRecentQuery(keyword));
      }

      lastFilterStateRef.current = buildRealtimeFilterStateKey({
        levelFilter: nextLevelFilter,
        sourceFilter: nextSourceFilter,
        extraFilters: nextExtraFilters,
      });
      if (
        shouldSuppressNextLiveTickAfterInteractiveRefresh({
          isLive: isLiveRef.current,
          liveWindow,
          explicitTimeRange: nextExplicitTimeRange,
        })
      ) {
        armSuppressedNextLiveTick();
      }
      setCurrentPage(1);
      if (normalizedQuery.extractedFilters) {
        setLevelFilter(nextLevelFilter);
        setSourceFilter(nextSourceFilter);
        setExtraFilters(nextExtraFilters);
      }
      if (nextExplicitTimeRange) {
        isLiveRef.current = false;
        clearLiveTimer();
        setIsLive(false);
        setCustomTimeRange(nextExplicitTimeRange);
        setLiveWindow("custom");
      }
      setQuery(keyword);
      setActiveQuery(keyword);
      void executeQuery({
        queryText: keyword,
        page: 1,
        pageSize,
        silent: false,
        recordHistory: shouldRecordHistory,
        resetCursor: true,
        timeRangeOverride: nextExplicitTimeRange ?? normalizedCustomTimeRange,
        liveWindowOverride: nextExplicitTimeRange ? "custom" : undefined,
        histogramRefreshMode: "force",
        levelFilterOverride: nextLevelFilter,
        sourceFilterOverride: nextSourceFilter,
        extraFiltersOverride: nextExtraFilters,
      });
    },
    [
      clearLiveTimer,
      executeQuery,
      levelFilter,
      normalizedCustomTimeRange,
      normalizedExtraFilters,
      pageSize,
      sourceFilter,
    ],
  );

  const handleLiveWindowChange = useCallback(
    (value: LiveWindowOption) => {
      if (value === liveWindow && !(value === "custom" && hasCustomTimeRange)) {
        return;
      }
      const nextExplicitTimeRange =
        value === "custom" ? normalizedCustomTimeRange : null;
      setLiveWindow(value);
      if (value !== "custom") {
        setCustomTimeRange(null);
      }
      if (value === "all" || value === "custom") {
        isLiveRef.current = false;
        clearLiveTimer();
        setIsLive(false);
      } else if (
        shouldSuppressNextLiveTickAfterInteractiveRefresh({
          isLive: isLiveRef.current,
          liveWindow: value,
          explicitTimeRange: nextExplicitTimeRange,
        })
      ) {
        armSuppressedNextLiveTick();
      }
      setCurrentPage(1);
      void executeQuery({
        queryText: activeQueryRef.current,
        page: 1,
        pageSize: pageSizeRef.current,
        silent: true,
        resetCursor: true,
        timeRangeOverride: nextExplicitTimeRange,
        liveWindowOverride: value,
        histogramRefreshMode: "force",
      });
    },
    [
      clearLiveTimer,
      executeQuery,
      hasCustomTimeRange,
      liveWindow,
      normalizedCustomTimeRange,
    ],
  );

  const handleToggleLive = useCallback(() => {
    if (livePollingDisabled) {
      message.info("全部时间或历史时间范围下不支持实时轮询");
      return;
    }
    if (isLive) {
      isLiveRef.current = false;
      clearLiveTimer();
      setIsLive(false);
      return;
    }
    isLiveRef.current = true;
    setIsLive(true);
    if (currentPage !== 1) {
      setCurrentPage(1);
      void executeQuery({
        queryText: activeQuery,
        page: 1,
        pageSize,
        silent: true,
        resetCursor: true,
        histogramRefreshMode: "skip",
      });
    }
  }, [
    activeQuery,
    clearLiveTimer,
    currentPage,
    executeQuery,
    isLive,
    livePollingDisabled,
    message,
    pageSize,
  ]);

  const handleBookmarkCurrentQuery = useCallback(() => {
    const now = new Date();
    const rawQuery = query.trim();
    const fallbackFilters = {
      ...normalizedExtraFilters,
      ...buildQueryCleanupFallbackFilters({
        levelFilter,
        sourceFilter,
      }),
    };
    const cleanupState = buildQueryCleanupState({
      rawQuery,
      fallbackFilters,
    });

    if (!cleanupState.cleanedQuery) {
      message.warning("请先输入查询语句或选择筛选条件");
      return;
    }

    const persistBookmark = async () => {
      try {
        await createSavedQuery({
          name: `实时查询 ${now.toLocaleString("zh-CN")}`,
          query: cleanupState.cleanedQuery,
          tags: [],
        });
        if (cleanupState.normalized.strippedTimeRange) {
          message.success("已收藏当前查询，并自动移除旧格式时间范围");
          return;
        }
        if (cleanupState.needsCleanup) {
          message.success("已收藏当前查询，并自动规范旧格式查询");
          return;
        }
        message.success("已收藏当前查询");
      } catch (error) {
        const readable = error instanceof Error ? error.message : "收藏失败";
        message.error(readable);
      }
    };

    if (!cleanupState.needsCleanup) {
      void persistBookmark();
      return;
    }

    modal.confirm({
      title: "收藏前将清洗旧格式查询",
      okText: "收藏并清洗",
      cancelText: "取消",
      width: 720,
      content: (
        <QueryCleanupPreviewContent
          cleanupState={cleanupState}
          intro="当前输入包含旧格式时间范围或遗留筛选表达式。为避免后续继续传播旧格式，收藏时将仅保留可复用的查询语义。"
          sourceQuery={rawQuery}
        />
      ),
      onOk: async () => {
        await persistBookmark();
      },
    });
  }, [levelFilter, message, modal, normalizedExtraFilters, query, sourceFilter]);

  // 执行检索（仅手动点击执行/回车时写入历史）
  const handleSearch = useCallback(
    (value: string) => {
      runSearch(value, true);
    },
    [runSearch],
  );

  // 直方图 ECharts 配置
  const histogramOption: EChartsCoreOption = useMemo(
    () => ({
      grid: { top: 24, right: 16, bottom: 24, left: 48 },
      legend: {
        show: true,
        top: 0,
        right: 0,
        textStyle: { fontSize: 10, color: isDark ? "#94a3b8" : "#475569" },
        itemWidth: 10,
        itemHeight: 10,
      },
      xAxis: {
        type: "category",
        data: histogramData.map((d) => d.time),
        axisLabel: { fontSize: 10 },
      },
      yAxis: {
        type: "value",
        splitLine: {
          lineStyle: {
            color: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
          },
        },
      },
      series: [
        {
          name: "正常",
          type: "bar",
          stack: "total",
          data: histogramData.map((d) => d.normal),
          itemStyle: { color: COLORS.primary, borderRadius: [0, 0, 0, 0] },
          barMaxWidth: 20,
        },
        {
          name: "错误",
          type: "bar",
          stack: "total",
          data: histogramData.map((d) => d.error),
          itemStyle: { color: COLORS.danger, borderRadius: [2, 2, 0, 0] },
          barMaxWidth: 20,
        },
      ],
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
      },
    }),
    [histogramData, isDark],
  );

  const deepPaginationRestricted =
    total > MAX_PAGINATION_WINDOW_ROWS ||
    (totalIsLowerBound && total >= MAX_PAGINATION_WINDOW_ROWS);
  const realtimeEmptyDescription = useMemo(
    () =>
      resolveRealtimeLogsEmptyDescription({
        queryText: activeQuery,
        levelFilter,
        sourceFilter,
        hasCustomTimeRange,
        liveWindow,
      }),
    [activeQuery, hasCustomTimeRange, levelFilter, liveWindow, sourceFilter],
  );
  const realtimeLoadingPlaceholderVisible =
    tableRefreshing && tableDataSource.length === 0 && !retryingCurrentQuery;
  const realtimeLoadingStateVisible =
    initialLoading || realtimeLoadingPlaceholderVisible;
  const showRealtimeInlineErrorState =
    (Boolean(tableErrorText) || retryingCurrentQuery) &&
    !tableUsingStaleData &&
    tableDataSource.length === 0 &&
    !realtimeLoadingStateVisible;
  const realtimeResultsSummaryText = realtimeLoadingStateVisible
    ? "正在加载日志..."
    : `共 ${formatRealtimeTotal(total, totalIsLowerBound)} 条结果 · 耗时 ${queryTimeMS}ms`;
  const realtimeVisibleSummaryText = realtimeLoadingStateVisible
    ? "正在加载日志..."
    : `当前页 ${tableDataSource.length} 条 · 共 ${formatRealtimeTotal(total, totalIsLowerBound)} 条`;

  const handleRetryCurrentQuery = useCallback(() => {
    setRetryingCurrentQuery(true);
    void executeQueryRef.current({
      queryText: activeQueryRef.current,
      page: currentPageRef.current,
      pageSize: pageSizeRef.current,
      silent: false,
      resetCursor: currentPageRef.current === 1,
      histogramRefreshMode: 'force',
    }).finally(() => {
      setRetryingCurrentQuery(false);
    });
  }, []);

  const handleResultsPaginationChange = useCallback(
    (page: number, size?: number) => {
      const nextPageSize = size ?? pageSize;
      const pageSizeChanged = nextPageSize !== pageSize;
      const targetPage = pageSizeChanged ? 1 : page;
      const previousPage = currentPage;
      const previousPageSize = pageSize;

      if (targetPage > 1 && isLiveRef.current) {
        isLiveRef.current = false;
        clearLiveTimer();
        setIsLive(false);
      }

      const cachedCursor = cloneRealtimePageCursor(
        pageCursorMapRef.current.get(targetPage),
      );
      if (
        shouldBlockRealtimeDirectPageJump(
          targetPage,
          nextPageSize,
          deepPaginationRestricted,
          cachedCursor,
        )
      ) {
        void message.warning(
          "当前结果集超过 10,000 条，首 10,000 条内可直接跳页，更深页码需顺序翻页建立游标",
        );
        return;
      }
      if (
        shouldResolveRealtimeDeepPageCursor(
          targetPage,
          nextPageSize,
          cachedCursor,
        )
      ) {
        void message.open({
          key: "realtime-deep-pagination",
          type: "loading",
          content: `正在顺序定位第 ${targetPage} 页，请稍候...`,
          duration: 0,
        });
      }

      clearLiveTimer();
      abortActiveRequests();

      if (
        shouldSuppressNextLiveTickAfterPaginationRefresh({
          isLive: isLiveRef.current,
          liveWindow,
          explicitTimeRange: normalizedCustomTimeRange,
          pageSizeChanged,
          targetPage,
        })
      ) {
        armSuppressedNextLiveTick();
      }

      if (pageSizeChanged) {
        setPageSize(nextPageSize);
      }
      if (targetPage !== currentPage || pageSizeChanged) {
        setCurrentPage(targetPage);
      }
      const requestCursor =
        cachedCursor ??
        (targetPage > 1
          ? cloneRealtimePageCursor(pageCursorMapRef.current.get(1))
          : undefined);
      void executeQuery({
        queryText: activeQueryRef.current,
        page: targetPage,
        pageSize: nextPageSize,
        silent: false,
        snapshotTo: tableSnapshotTo,
        cursor: requestCursor,
        resetCursor: pageSizeChanged,
        histogramRefreshMode: "skip",
      }).then((status) => {
        void message.destroy("realtime-deep-pagination");
        if (status === "failed") {
          setCurrentPage(previousPage);
          if (nextPageSize !== previousPageSize) {
            setPageSize(previousPageSize);
          }
        }
      });
    },
    [
      abortActiveRequests,
      clearLiveTimer,
      currentPage,
      deepPaginationRestricted,
      executeQuery,
      liveWindow,
      message,
      normalizedCustomTimeRange,
      pageSize,
      setPageSize,
      tableSnapshotTo,
    ],
  );

  // 表格列定义
  const columns: ColumnsType<LogEntry> = useMemo(
    () => [
      {
        title: "时间",
        dataIndex: "timestamp",
        key: "timestamp",
        width: 180,
        render: (v: string) => (
          <span className="text-sm font-mono opacity-70">
            {formatRealtimeTimestamp(v)}
          </span>
        ),
      },
      {
        title: "级别",
        dataIndex: "level",
        key: "level",
        width: 80,
        render: (v: string) => {
          const cfg = LEVEL_CONFIG[v] || LEVEL_CONFIG.info;
          return (
            <Tag color={cfg.tagColor} style={{ margin: 0, fontSize: 12 }}>
              {v.toUpperCase()}
            </Tag>
          );
        },
      },
      {
        title: "服务",
        dataIndex: "service",
        key: "service",
        width: 150,
        render: (v: string) => <span className="text-sm font-medium">{v}</span>,
      },
      {
        title: "主机",
        dataIndex: "host",
        key: "host",
        width: 180,
        ellipsis: true,
        render: (v: string) => {
          const displayValue = toDisplayText(v);
          if (displayValue === "—") {
            return <span className="text-sm opacity-50">—</span>;
          }
          return (
            <Tooltip title={displayValue}>
              <span className="text-sm font-mono">{displayValue}</span>
            </Tooltip>
          );
        },
      },
      {
        title: "主机IP",
        dataIndex: "hostIp",
        key: "hostIp",
        width: 160,
        ellipsis: true,
        render: (v: string) => {
          const displayValue = toDisplayText(v);
          if (displayValue === "—") {
            return <span className="text-sm opacity-50">—</span>;
          }
          return (
            <Tooltip title={displayValue}>
              <span className="text-sm font-mono">{displayValue}</span>
            </Tooltip>
          );
        },
      },
      {
        title: "消息",
        dataIndex: "message",
        key: "message",
        ellipsis: true,
        render: (v: string, record) => {
          if (!record.aggregated) {
            return <span className="text-sm">{v}</span>;
          }
          return (
            <div className="flex items-center gap-2 min-w-0">
              <Tag color="blue" style={{ margin: 0 }}>
                聚合 {record.aggregated.count}
              </Tag>
              <Tooltip title={record.aggregated.samplePaths.join("\n") || v}>
                <span className="text-sm truncate">{v}</span>
              </Tooltip>
            </div>
          );
        },
      },
    ],
    [],
  );

  const copyToClipboard = useCallback(
    async (content: string, successText: string) => {
      const normalized = content.trim();
      if (!normalized || normalized === "—") {
        message.warning("没有可复制的内容");
        return;
      }
      try {
        if (
          typeof navigator !== "undefined" &&
          navigator.clipboard?.writeText
        ) {
          await navigator.clipboard.writeText(normalized);
        } else if (typeof document !== "undefined") {
          const textarea = document.createElement("textarea");
          textarea.value = normalized;
          textarea.setAttribute("readonly", "true");
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
        }
        message.success(successText);
      } catch {
        message.error("复制失败，请检查浏览器权限");
      }
    },
    [],
  );

  const selectedFields = selectedLog?.fields;
  const selectedAggregation = selectedLog?.aggregated;
  const drawerEventID = toDisplayText(
    selectedFields?.event_id ?? selectedLog?.id,
  );
  const drawerLevel = toDisplayText(
    selectedFields?.level ?? selectedLog?.level,
  );
  const drawerTimestamp = toDisplayText(
    selectedFields?.timestamp ??
      selectedLog?.timestamp ??
      selectedFields?.collect_time,
  );
  const drawerMessage = toDisplayText(
    selectedLog?.message ?? selectedFields?.message,
  );
  const drawerSource = toDisplayText(
    selectedFields?.source ??
      selectedFields?.source_path ??
      selectedFields?.source_internal,
  );
  const drawerService = toDisplayText(
    selectedLog?.service ??
      selectedFields?.service_name ??
      selectedFields?.service,
  );
  const drawerHost = toDisplayText(
    selectedLog?.host ?? selectedFields?.host ?? selectedFields?.server_id,
  );
  const drawerHostIP = toDisplayText(
    selectedLog?.hostIp ?? selectedFields?.host_ip,
    "—",
  );
  const drawerRawLog =
    selectedLog?.rawLog ??
    selectedFields?.raw_message ??
    selectedFields?.raw_log ??
    drawerMessage;
  const drawerTraceId = toDisplayText(selectedFields?.traceId, "—");
  const drawerSpanId = toDisplayText(selectedFields?.spanId, "—");
  const drawerMethod = toDisplayText(selectedFields?.method, "—");
  const drawerStatusCode = toDisplayText(selectedFields?.statusCode, "—");
  const drawerUserAgent = toDisplayText(selectedFields?.userAgent, "—");
  const drawerRawContent = formatDetailValue(drawerRawLog);
  const drawerFieldsJson = useMemo(() => {
    if (!selectedFields) {
      return "—";
    }
    return formatDetailValue(
      Object.fromEntries(
        Object.entries(selectedFields).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    );
  }, [selectedFields]);
  const drawerPayloadJson = useMemo(() => {
    if (!selectedLog) {
      return "—";
    }
    return formatDetailValue({
      id: selectedLog.id,
      timestamp: selectedLog.timestamp,
      level: selectedLog.level,
      service: selectedLog.service,
      host: selectedLog.host,
      hostIp: selectedLog.hostIp,
      message: selectedLog.message,
      rawLog: selectedLog.rawLog ?? null,
      aggregated: selectedAggregation ?? null,
      fields: selectedFields ?? {},
    });
  }, [selectedAggregation, selectedFields, selectedLog]);
  const drawerSummaryItems = useMemo(() => {
    const items = [
      {
        key: "event-id",
        label: "事件 ID",
        value: drawerEventID,
        mono: true,
        copyable: true,
      },
      {
        key: "timestamp",
        label: "时间",
        value: drawerTimestamp,
        mono: true,
        copyable: true,
      },
      {
        key: "service",
        label: "服务",
        value: drawerService,
        mono: false,
        copyable: false,
      },
      {
        key: "host",
        label: "主机",
        value: drawerHost,
        mono: true,
        copyable: true,
      },
      {
        key: "host-ip",
        label: "主机 IP",
        value: drawerHostIP,
        mono: true,
        copyable: drawerHostIP !== "—",
      },
      {
        key: "source",
        label: "来源",
        value: drawerSource,
        mono: true,
        copyable: true,
      },
      {
        key: "trace",
        label: "Trace ID",
        value: drawerTraceId,
        mono: true,
        copyable: drawerTraceId !== "—",
      },
    ];
    if (selectedAggregation) {
      items.push({
        key: "aggregation",
        label: "图片聚合",
        value: `${selectedAggregation.count} 条已折叠`,
        mono: false,
        copyable: false,
      });
    }
    return items;
  }, [
    drawerEventID,
    drawerHost,
    drawerHostIP,
    drawerService,
    drawerSource,
    drawerTimestamp,
    drawerTraceId,
    selectedAggregation,
  ]);

  return (
    <div className="flex flex-col gap-4">
      {/* 查询栏 */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 items-center flex-wrap">
          <Input.Search
            id="realtime-query-input"
            name="realtime-query"
            autoComplete="off"
            size={isMobile ? "large" : "middle"}
            placeholder='输入查询语句，例如: level:error AND service:"payment-service"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            enterButton={
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">
                  play_arrow
                </span>
                执行
              </span>
            }
            onSearch={handleSearch}
            style={{ flex: 1, minWidth: 300 }}
            allowClear
          />
          <Tooltip title="保存查询">
            <Button
              size={isMobile ? "large" : "middle"}
              icon={
                <span className="material-symbols-outlined text-sm">
                  bookmark_add
                </span>
              }
              onClick={handleBookmarkCurrentQuery}
            />
          </Tooltip>
          <Button
            type="link"
            size={isMobile ? "middle" : "small"}
            style={isMobile ? { minHeight: 36 } : undefined}
          >
            <span className="flex items-center gap-1 text-xs">
              <span className="material-symbols-outlined text-sm">
                help_outline
              </span>
              语法指南
            </span>
          </Button>
        </div>
        {/* 最近查询标签 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs opacity-50">最近查询:</span>
          {recentQueries.map((q) => (
            <Tag
              key={q}
              role="button"
              tabIndex={0}
              aria-label={`执行最近查询 ${q}`}
              className="cursor-pointer"
              style={{
                fontSize: 11,
                margin: 0,
                maxWidth: 320,
                minHeight: isMobile ? 32 : undefined,
                paddingInline: isMobile ? 12 : undefined,
                display: isMobile ? "inline-flex" : undefined,
                alignItems: isMobile ? "center" : undefined,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={q}
              onClick={() => runSearch(q, true)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  runSearch(q, true);
                }
              }}
            >
              {q}
            </Tag>
          ))}
        </div>

        {/* 级别 / 来源筛选 */}
        <Space wrap>
          <Select
            size={isMobile ? "large" : "middle"}
            placeholder="级别"
            allowClear
            value={levelFilter || undefined}
            onChange={(v) => setLevelFilter(v ?? "")}
            style={{ minWidth: 120 }}
            options={[
              { value: "", label: "ALL" },
              { value: "debug", label: "DEBUG" },
              { value: "info", label: "INFO" },
              { value: "warn", label: "WARN" },
              { value: "error", label: "ERROR" },
              { value: "fatal", label: "FATAL" },
            ]}
          />
          <Select
            size={isMobile ? "large" : "middle"}
            placeholder="来源/服务"
            allowClear
            showSearch
            value={sourceFilter || undefined}
            onChange={(v) => setSourceFilter(v ?? "")}
            style={{ minWidth: 180 }}
            optionFilterProp="label"
            options={[
              { value: "", label: "ALL" },
              ...uniqueSources.map((s) => ({ value: s, label: s })),
            ]}
          />
        </Space>
        {extraFilterTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs opacity-50">结构化筛选:</span>
            {extraFilterTags.map((filterTag) => (
              <Tag
                key={filterTag.key}
                closable
                style={{ margin: 0 }}
                onClose={() => {
                  setExtraFilters((currentFilters) => {
                    const nextFilters = { ...currentFilters };
                    delete nextFilters[filterTag.key];
                    return nextFilters;
                  });
                }}
              >
                {filterTag.label}={filterTag.value}
              </Tag>
            ))}
          </div>
        )}
      </div>

      {/* 事件量直方图 */}
      <ChartWrapper
        title="事件量分布"
        loading={histogramRefreshing && histogramData.length === 0}
        empty={
          histogramDisabled ||
          (!histogramRefreshing &&
            !histogramInitialLoading &&
            histogramData.length === 0)
        }
        subtitle={
          histogramDisabled ? "全部时间或精确时间范围下不展示趋势图" : undefined
        }
        actions={
          <Space size={8}>
            {histogramDisabled && (
              <Tag color="default" style={{ margin: 0 }}>
                {hasCustomTimeRange ? "精确时间范围" : "全部时间"}
              </Tag>
            )}
            {histogramRefreshing && (
              <Tag color="processing" style={{ margin: 0 }}>
                {resolveSearchPageLoadingLabel(histogramData.length)}
              </Tag>
            )}
            {histogramUsingStaleData && (
              <Tag color="warning" style={{ margin: 0 }}>
                使用上次统计
              </Tag>
            )}
            {histogramNoiseFilterRelaxed && !histogramDisabled && (
              <Tooltip title="空查询趋势图为避免后端聚合超时，未应用“排除系统噪声”过滤；日志列表仍保持原过滤口径。">
                <Tag color="gold" style={{ margin: 0 }}>
                  空查询未过滤系统噪声
                </Tag>
              </Tooltip>
            )}
          </Space>
        }
        option={histogramOption}
        height={160}
      />

      {/* 日志结果表格 */}
      <div ref={resultsTableRef} className="flex flex-col gap-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Button
              size={isMobile ? "large" : "small"}
              type={isLive ? "primary" : "default"}
              onClick={handleToggleLive}
              icon={
                <span className="material-symbols-outlined text-sm">
                  {isLive ? "pause" : "play_arrow"}
                </span>
              }
            >
              {isLive ? "实时" : "已暂停"}
            </Button>
            <Select
              size={isMobile ? "large" : "small"}
              value={liveWindow}
              onChange={handleLiveWindowChange}
              style={{ minWidth: 132 }}
              options={liveWindowOptions}
            />
            <span className="text-xs opacity-50">
              {realtimeResultsSummaryText}
            </span>
            {hasCustomTimeRange && (
              <Tooltip title={customTimeRangeLabel}>
                <Tag color="blue" style={{ margin: 0 }}>
                  历史时间范围
                </Tag>
              </Tooltip>
            )}
            {tableRefreshing && (
              <Tag color="processing" style={{ margin: 0 }}>
                {resolveSearchPageLoadingLabel(logs.length)}
              </Tag>
            )}
            {tableUsingStaleData && (
              <Tag color="warning" style={{ margin: 0 }}>
                使用上次结果
              </Tag>
            )}
            {totalIsLowerBound && (
              <Tag color="default" style={{ margin: 0 }}>
                总数按阈值统计
              </Tag>
            )}
            {imageAggregationSummary.hiddenRows > 0 && (
              <Tag color="blue" style={{ margin: 0 }}>
                本页已聚合 {imageAggregationSummary.groupedRows}{" "}
                组图片日志，折叠 {imageAggregationSummary.hiddenRows} 条
              </Tag>
            )}
            {queryTimedOut && (
              <Tag color="warning" style={{ margin: 0 }}>
                查询超时
              </Tag>
            )}
            {deepPaginationRestricted && (
              <Tag color="gold" style={{ margin: 0 }}>
                超过前 {MAX_PAGINATION_WINDOW_ROWS.toLocaleString()}{" "}
                条后，首个窗口内仍可跳页，更深页码需顺序翻页建立游标
              </Tag>
            )}
          </div>
          <Space size="small">
            <Tooltip title="列设置">
              <Button
                size={isMobile ? "middle" : "small"}
                style={isMobile ? { minHeight: 36, minWidth: 36 } : undefined}
                icon={
                  <span className="material-symbols-outlined text-sm">
                    view_column
                  </span>
                }
              />
            </Tooltip>
            <Tooltip title="下载">
              <Button
                size={isMobile ? "middle" : "small"}
                style={isMobile ? { minHeight: 36, minWidth: 36 } : undefined}
                icon={
                  <span className="material-symbols-outlined text-sm">
                    download
                  </span>
                }
              />
            </Tooltip>
          </Space>
        </div>

        {tableUsingStaleData && tableStaleErrorText && (
          <Alert
            type="warning"
            showIcon
            message="日志刷新失败，已保留上一版结果"
            description={tableStaleErrorText}
            action={
              <Button
                size="small"
                loading={retryingCurrentQuery}
                onClick={handleRetryCurrentQuery}
              >
                重试
              </Button>
            }
          />
        )}

        {histogramErrorText && (
          <Alert
            type={histogramUsingStaleData ? "warning" : "error"}
            showIcon
            message={histogramUsingStaleData ? "趋势图刷新失败，已保留上一版统计" : "趋势图加载失败"}
            description={histogramErrorText}
            action={
              <Button
                size="small"
                loading={retryingHistogram}
                onClick={handleRetryHistogram}
              >
                重试
              </Button>
            }
          />
        )}

        {isMobile ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-[var(--ant-color-border-secondary)] bg-[var(--ant-color-bg-container)] px-4 py-3 text-xs opacity-70">
              {realtimeVisibleSummaryText}
            </div>

            {realtimeLoadingStateVisible ? (
              <div className="rounded-xl border border-[var(--ant-color-border-secondary)] bg-[var(--ant-color-bg-container)] px-4 py-8">
                <InlineLoadingState size="large" tip="加载日志..." />
              </div>
            ) : showRealtimeInlineErrorState ? (
              <div className="rounded-xl border border-dashed border-[var(--ant-color-border-secondary)] bg-[var(--ant-color-bg-container)] p-6">
                <InlineErrorState
                  title="日志加载失败"
                  description={tableErrorText || "正在重新请求，请稍候..."}
                  actionLoading={retryingCurrentQuery}
                  onAction={handleRetryCurrentQuery}
                />
              </div>
            ) : tableDataSource.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--ant-color-border-secondary)] bg-[var(--ant-color-bg-container)] p-6">
                <Empty
                  description={realtimeEmptyDescription}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              </div>
            ) : (
              tableDataSource.map((record) => {
                const levelConfig = LEVEL_CONFIG[record.level] || LEVEL_CONFIG.info;
                const service = toDisplayText(record.service);
                const host = toDisplayText(record.host);
                const hostIp = toDisplayText(record.hostIp);
                const messageText = toDisplayText(record.message);

                return (
                  <div
                    key={record.id}
                    className="rounded-xl border border-[var(--ant-color-border-secondary)] bg-[var(--ant-color-bg-container)] p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                        <Tag color={levelConfig.tagColor} style={{ margin: 0, fontSize: 12 }}>
                          {record.level.toUpperCase()}
                        </Tag>
                        {record.aggregated && (
                          <Tag color="blue" style={{ margin: 0, fontSize: 12 }}>
                            聚合 {record.aggregated.count}
                          </Tag>
                        )}
                        <span className="text-xs font-mono opacity-60">
                          {formatRealtimeTimestamp(record.timestamp)}
                        </span>
                      </div>
                      <Button
                        size="middle"
                        style={{ minHeight: 36 }}
                        onClick={() => handleRowClick(record)}
                        aria-label={`查看日志详情 ${record.id}`}
                      >
                        查看详情
                      </Button>
                    </div>

                    <div className="mt-3 break-all text-sm leading-6">{messageText}</div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="opacity-50">服务</div>
                        <div className="break-all font-medium">{service}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="opacity-50">主机</div>
                        <div className="break-all font-mono">{host}</div>
                      </div>
                    </div>

                    <div className="mt-3 text-xs opacity-60">
                      主机IP：<span className="font-mono">{hostIp}</span>
                    </div>
                  </div>
                );
              })
            )}

            {total > 0 && (
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={total}
                size="small"
                showSizeChanger
                showQuickJumper={false}
                showTotal={(itemsTotal) =>
                  `共 ${formatRealtimeTotal(itemsTotal, totalIsLowerBound)} 条`
                }
                pageSizeOptions={["10", "20", "50", "100"]}
                onChange={handleResultsPaginationChange}
              />
            )}
          </div>
        ) : (
          <Table<LogEntry>
            dataSource={tableDataSource}
            columns={columns}
            rowKey="id"
            loading={tableRefreshing}
            locale={{
              emptyText: realtimeLoadingStateVisible ? (
                <span />
              ) : showRealtimeInlineErrorState ? (
                <InlineErrorState
                  title="日志加载失败"
                  description={tableErrorText || "正在重新请求，请稍候..."}
                  actionLoading={retryingCurrentQuery}
                  onAction={handleRetryCurrentQuery}
                />
              ) : (
                <Empty
                  description={realtimeEmptyDescription}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ),
            }}
            size="small"
            pagination={{
              current: currentPage,
              pageSize,
              total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (itemsTotal) =>
                `共 ${formatRealtimeTotal(itemsTotal, totalIsLowerBound)} 条`,
              pageSizeOptions: ["10", "20", "50", "100"],
              onChange: handleResultsPaginationChange,
              position: ["bottomLeft"],
            }}
            onRow={(record) => ({
              onClick: () => handleRowClick(record),
              style: { cursor: "pointer" },
            })}
            scroll={{ x: 980 }}
          />
        )}
      </div>

      {/* 日志详情抽屉 */}
      <Drawer
        title={
          selectedLog ? (
            <div className="flex items-center gap-2">
              <span
                className="material-symbols-outlined text-base"
                style={{ color: LEVEL_CONFIG[selectedLog.level]?.color }}
              >
                {selectedLog.level === "error"
                  ? "error"
                  : selectedLog.level === "warn"
                    ? "warning"
                    : "info"}
              </span>
              <span>日志详情</span>
              <Tag
                color={LEVEL_CONFIG[selectedLog.level]?.tagColor || "default"}
                style={{ margin: 0 }}
              >
                {selectedLog.level.toUpperCase()}
              </Tag>
            </div>
          ) : (
            "日志详情"
          )
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={760}
        styles={{ body: { paddingTop: 12, paddingBottom: 12 } }}
        footer={
          selectedLog ? (
            <div className="flex items-center justify-end gap-2 flex-wrap">
              <Button
                icon={
                  <span className="material-symbols-outlined text-sm">
                    data_object
                  </span>
                }
                onClick={() =>
                  void copyToClipboard(drawerFieldsJson, "已复制字段 JSON")
                }
              >
                字段 JSON
              </Button>
              <Button
                type="primary"
                ghost
                icon={
                  <span className="material-symbols-outlined text-sm">
                    content_copy
                  </span>
                }
                onClick={() =>
                  void copyToClipboard(drawerPayloadJson, "已复制完整载荷")
                }
              >
                完整载荷
              </Button>
            </div>
          ) : null
        }
      >
        {selectedLog && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {drawerSummaryItems.map((item) => (
                <div
                  key={item.key}
                  className="rounded-lg p-3"
                  style={{
                    backgroundColor: isDark
                      ? "rgba(15,23,42,0.65)"
                      : "rgba(248,250,252,0.95)",
                    border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                  }}
                >
                  <div className="text-[11px] uppercase tracking-wide opacity-50 mb-1">
                    {item.label}
                  </div>
                  <Typography.Text
                    copyable={item.copyable ? { text: item.value } : false}
                    style={{
                      fontSize: 12,
                      display: "block",
                      lineHeight: 1.6,
                      wordBreak: "break-all",
                      fontFamily: item.mono
                        ? "var(--font-mono, monospace)"
                        : "inherit",
                    }}
                  >
                    {item.value}
                  </Typography.Text>
                </div>
              ))}
            </div>

            <div
              className="rounded-lg p-3"
              style={{
                backgroundColor: isDark
                  ? "rgba(0,0,0,0.25)"
                  : "rgba(0,0,0,0.03)",
                border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] uppercase tracking-wide opacity-50">
                  消息
                </span>
                <Space size="small">
                  <Tooltip title="复制消息">
                    <Button
                      size="small"
                      icon={
                        <span className="material-symbols-outlined text-sm">
                          content_copy
                        </span>
                      }
                      onClick={() =>
                        void copyToClipboard(drawerMessage, "已复制日志消息")
                      }
                    />
                  </Tooltip>
                  <Tooltip title="复制原始日志">
                    <Button
                      size="small"
                      icon={
                        <span className="material-symbols-outlined text-sm">
                          article
                        </span>
                      }
                      onClick={() =>
                        void copyToClipboard(drawerRawContent, "已复制原始日志")
                      }
                    />
                  </Tooltip>
                </Space>
              </div>
              <Typography.Paragraph
                className="!mb-0 text-sm leading-6 whitespace-pre-wrap break-all"
                ellipsis={{ rows: 6, expandable: true, symbol: "展开" }}
              >
                {drawerMessage}
              </Typography.Paragraph>
            </div>

            <div className="flex flex-wrap gap-2">
              <Tag>service={drawerService}</Tag>
              <Tag>level={drawerLevel}</Tag>
              {drawerHost !== "—" && <Tag>host={drawerHost}</Tag>}
              {drawerHostIP !== "—" && <Tag>host_ip={drawerHostIP}</Tag>}
              {selectedFields?.env != null && (
                <Tag color="cyan">env={toDisplayText(selectedFields.env)}</Tag>
              )}
              {selectedFields?.region != null && (
                <Tag>region={toDisplayText(selectedFields.region)}</Tag>
              )}
              {selectedFields?.method != null && (
                <Tag>method={toDisplayText(selectedFields.method)}</Tag>
              )}
              {selectedFields?.statusCode != null && (
                <Tag
                  color={
                    Number(selectedFields.statusCode) >= 500
                      ? "error"
                      : Number(selectedFields.statusCode) >= 400
                        ? "warning"
                        : "success"
                  }
                >
                  status={toDisplayText(selectedFields.statusCode)}
                </Tag>
              )}
              {selectedFields?.traceId != null && (
                <Tag color="purple">
                  trace={toDisplayText(selectedFields.traceId)}
                </Tag>
              )}
              {selectedFields?.spanId != null && (
                <Tag color="purple">
                  span={toDisplayText(selectedFields.spanId)}
                </Tag>
              )}
            </div>

            <Collapse
              defaultActiveKey={["event"]}
              items={[
                {
                  key: "event",
                  label: (
                    <span className="flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-sm">
                        event
                      </span>
                      事件层 (Event Layer)
                    </span>
                  ),
                  children: (
                    <Descriptions column={2} size="small" bordered>
                      <Descriptions.Item label="event_id">
                        <Typography.Text
                          copyable
                          style={{
                            fontSize: 12,
                            fontFamily: "var(--font-mono, monospace)",
                          }}
                        >
                          {drawerEventID}
                        </Typography.Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="level">
                        <Tag
                          color={
                            LEVEL_CONFIG[selectedLog.level]?.tagColor ||
                            "default"
                          }
                          style={{ margin: 0 }}
                        >
                          {drawerLevel.toUpperCase()}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="timestamp">
                        <span className="font-mono text-xs">
                          {drawerTimestamp}
                        </span>
                      </Descriptions.Item>
                      <Descriptions.Item label="service_name">
                        <span className="text-xs">{drawerService}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="host">
                        <span className="font-mono text-xs">{drawerHost}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="host_ip">
                        <span className="font-mono text-xs">
                          {drawerHostIP}
                        </span>
                      </Descriptions.Item>
                      {selectedAggregation && (
                        <Descriptions.Item label="image_aggregation" span={2}>
                          <span className="text-xs">
                            {selectedAggregation.summary}
                          </span>
                        </Descriptions.Item>
                      )}
                      <Descriptions.Item label="message" span={2}>
                        <Typography.Paragraph className="!mb-0 text-xs whitespace-pre-wrap break-all">
                          {drawerMessage}
                        </Typography.Paragraph>
                      </Descriptions.Item>
                      <Descriptions.Item label="source" span={2}>
                        <Typography.Text
                          copyable
                          style={{
                            fontSize: 12,
                            fontFamily: "var(--font-mono, monospace)",
                          }}
                        >
                          {drawerSource}
                        </Typography.Text>
                      </Descriptions.Item>
                    </Descriptions>
                  ),
                },
                ...(selectedAggregation
                  ? [
                      {
                        key: "aggregation",
                        label: (
                          <span className="flex items-center gap-1 text-xs">
                            <span className="material-symbols-outlined text-sm">
                              stacked_email
                            </span>
                            图片聚合清单 (Aggregated Image Logs)
                          </span>
                        ),
                        children: (
                          <div className="flex flex-col gap-2">
                            <div className="text-xs opacity-70">
                              {selectedAggregation.summary}
                            </div>
                            <div
                              className="p-3 rounded font-mono text-xs leading-relaxed whitespace-pre-wrap break-all max-h-72 overflow-auto"
                              style={{
                                backgroundColor: isDark
                                  ? "rgba(0,0,0,0.25)"
                                  : "rgba(0,0,0,0.04)",
                                border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                              }}
                            >
                              {selectedAggregation.entries
                                .map(
                                  (entry, entryIndex) =>
                                    `${entryIndex + 1}. ${entry.rawLog ?? entry.message}`,
                                )
                                .join("\n")}
                            </div>
                          </div>
                        ),
                      },
                    ]
                  : []),
                {
                  key: "raw",
                  label: (
                    <span className="flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-sm">
                        article
                      </span>
                      原始层 (Raw Layer)
                    </span>
                  ),
                  children: (
                    <div
                      className="p-3 rounded font-mono text-xs leading-relaxed whitespace-pre-wrap break-all max-h-80 overflow-auto"
                      style={{
                        backgroundColor: isDark
                          ? "rgba(0,0,0,0.25)"
                          : "rgba(0,0,0,0.04)",
                        border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                      }}
                    >
                      {drawerRawContent}
                    </div>
                  ),
                },
                {
                  key: "transport",
                  label: (
                    <span className="flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-sm">
                        swap_horiz
                      </span>
                      传输层 (Transport Layer)
                    </span>
                  ),
                  children: (
                    <Descriptions column={2} size="small" bordered>
                      <Descriptions.Item label="agent_id">
                        <span className="font-mono text-xs">
                          {toDisplayText(selectedFields?.agent_id)}
                        </span>
                      </Descriptions.Item>
                      <Descriptions.Item label="batch_id">
                        <span className="font-mono text-xs">
                          {toDisplayText(selectedFields?.batch_id)}
                        </span>
                      </Descriptions.Item>
                      <Descriptions.Item label="collect_time">
                        <span className="font-mono text-xs">
                          {toDisplayText(
                            selectedFields?.collect_time ??
                              selectedLog?.timestamp,
                          )}
                        </span>
                      </Descriptions.Item>
                      <Descriptions.Item label="sequence">
                        <span className="font-mono text-xs">
                          {toDisplayText(selectedFields?.sequence)}
                        </span>
                      </Descriptions.Item>
                    </Descriptions>
                  ),
                },
                {
                  key: "ingest",
                  label: (
                    <span className="flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-sm">
                        input
                      </span>
                      接入层 (Ingest Layer)
                    </span>
                  ),
                  children: (
                    <Descriptions column={2} size="small" bordered>
                      <Descriptions.Item label="ingested_at">
                        <span className="font-mono text-xs">
                          {toDisplayText(selectedFields?.ingested_at)}
                        </span>
                      </Descriptions.Item>
                      <Descriptions.Item label="schema_version">
                        <span className="font-mono text-xs">
                          {toDisplayText(selectedFields?.schema_version)}
                        </span>
                      </Descriptions.Item>
                      <Descriptions.Item label="pipeline_version">
                        <span className="font-mono text-xs">
                          {toDisplayText(selectedFields?.pipeline_version)}
                        </span>
                      </Descriptions.Item>
                    </Descriptions>
                  ),
                },
                {
                  key: "governance",
                  label: (
                    <span className="flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-sm">
                        admin_panel_settings
                      </span>
                      治理层 (Governance Layer)
                    </span>
                  ),
                  children: (
                    <Descriptions column={2} size="small" bordered>
                      <Descriptions.Item label="tenant_id">
                        <span className="font-mono text-xs">
                          {toDisplayText(selectedFields?.tenant_id)}
                        </span>
                      </Descriptions.Item>
                      <Descriptions.Item label="retention_policy">
                        <span className="font-mono text-xs">
                          {toDisplayText(selectedFields?.retention_policy)}
                        </span>
                      </Descriptions.Item>
                      <Descriptions.Item label="pii_masked">
                        <span className="font-mono text-xs">
                          {toDisplayText(selectedFields?.pii_masked)}
                        </span>
                      </Descriptions.Item>
                    </Descriptions>
                  ),
                },
                {
                  key: "payload",
                  label: (
                    <span className="flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-sm">
                        data_object
                      </span>
                      完整载荷 (Full Payload)
                    </span>
                  ),
                  children: (
                    <div
                      className="p-3 rounded font-mono text-xs leading-relaxed whitespace-pre-wrap break-all max-h-96 overflow-auto"
                      style={{
                        backgroundColor: isDark
                          ? "rgba(0,0,0,0.25)"
                          : "rgba(0,0,0,0.04)",
                        border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                      }}
                    >
                      {drawerPayloadJson}
                    </div>
                  ),
                },
              ]}
            />

            <Divider
              orientation="left"
              orientationMargin={0}
              style={{ margin: "8px 0 12px" }}
            >
              <span className="flex items-center gap-1 text-xs">
                <span className="material-symbols-outlined text-sm">link</span>
                追踪信息
              </span>
            </Divider>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Trace ID">
                <Typography.Text
                  copyable={drawerTraceId !== "—"}
                  style={{
                    fontSize: 12,
                    fontFamily: "var(--font-mono, monospace)",
                  }}
                >
                  {drawerTraceId}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Span ID">
                <Typography.Text
                  copyable={drawerSpanId !== "—"}
                  style={{
                    fontSize: 12,
                    fontFamily: "var(--font-mono, monospace)",
                  }}
                >
                  {drawerSpanId}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Method / Status">
                <span className="font-mono text-xs">
                  {[
                    drawerMethod !== "—" ? drawerMethod : "",
                    drawerStatusCode !== "—" ? drawerStatusCode : "",
                  ]
                    .filter(Boolean)
                    .join(" / ") || "—"}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="User-Agent">
                <span className="font-mono text-xs break-all">
                  {drawerUserAgent}
                </span>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default RealtimeSearch;

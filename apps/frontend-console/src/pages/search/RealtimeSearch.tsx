import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { usePaginationQuickJumperAccessibility } from '../../components/common/usePaginationQuickJumperAccessibility';
import { App, Input, Button, Tag, Table, Drawer, Space, Tooltip, Descriptions, Divider, Typography, Select, Collapse } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useLocation } from 'react-router-dom';
import { useThemeStore } from '../../stores/themeStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { COLORS } from '../../theme/tokens';
import ChartWrapper from '../../components/charts/ChartWrapper';
import type { EChartsCoreOption } from 'echarts/core';
import type { LogEntry } from '../../types/log';
import { createSavedQuery, fetchAggregateStats, queryRealtimeLogs } from '../../api/query';
import { aggregateRealtimeDisplayLogs, summarizeImageAggregation } from './realtimeLogAggregation';
import { readRealtimeRecentQueries, recordRealtimeRecentQuery } from './realtimeRecentQueries';
import {
  clearPendingRealtimeStartupQuery,
  readPendingRealtimeStartupQuery,
} from './realtimeStartupQuery';
import { buildRealtimeHistogramData, sumRealtimeHistogramEvents, type RealtimeHistogramPoint } from './realtimeHistogram';
import { buildRealtimeQueryFilters } from './realtimeNoiseFilters';
import {
  buildRealtimeHistogramRefreshKey,
  shouldRefreshRealtimeHistogram,
  type RealtimeHistogramRefreshMode,
} from './realtimeRefreshPolicy';
import { buildRealtimePresetQuery, normalizeRealtimePresetQuery } from './realtimePresetQuery';

// ============================================================================
// 本地 UI 辅助数据
// ============================================================================

const HISTOGRAM_TIME_RANGE = '30m' as const;
const MAX_PAGINATION_WINDOW_ROWS = 10_000;
const LIVE_POLL_INTERVAL_MS = 5_000;
const STARTUP_QUERY_DELAY_MS = 200;

type LiveWindowOption = '5m' | '15m' | '30m' | '1h';

const DEFAULT_LIVE_WINDOW: LiveWindowOption = '15m';
const LIVE_WINDOW_OPTIONS: Array<{ value: LiveWindowOption; label: string }> = [
  { value: '5m', label: '最近 5 分钟' },
  { value: '15m', label: '最近 15 分钟' },
  { value: '30m', label: '最近 30 分钟' },
  { value: '1h', label: '最近 1 小时' },
];

function resolveRealtimeWindowDurationMS(liveWindow: LiveWindowOption): number {
  switch (liveWindow) {
    case '5m':
      return 5 * 60 * 1000;
    case '30m':
      return 30 * 60 * 1000;
    case '1h':
      return 60 * 60 * 1000;
    case '15m':
    default:
      return 15 * 60 * 1000;
  }
}

function buildRealtimeTableTimeRange(liveWindow: LiveWindowOption, snapshotTo?: string) {
  const snapshot = snapshotTo?.trim() ? new Date(snapshotTo) : new Date();
  const normalizedSnapshot = Number.isNaN(snapshot.getTime()) ? new Date() : snapshot;
  return {
    from: new Date(normalizedSnapshot.getTime() - resolveRealtimeWindowDurationMS(liveWindow)).toISOString(),
    to: normalizedSnapshot.toISOString(),
  };
}

function resolveMaxPaginationPage(pageSize: number): number {
  const normalizedPageSize = Math.max(1, Math.floor(pageSize || 1));
  return Math.max(1, Math.floor(MAX_PAGINATION_WINDOW_ROWS / normalizedPageSize));
}

function formatRealtimeTotal(total: number, isLowerBound: boolean): string {
  const normalizedTotal = Number.isFinite(total) ? total : 0;
  const displayTotal = Math.max(0, Math.floor(normalizedTotal)).toLocaleString();
  return isLowerBound ? `${displayTotal}+` : displayTotal;
}

function toDisplayText(value: unknown, fallback = '—'): string {
  if (value == null) {
    return fallback;
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || fallback;
  }
  return String(value);
}

function formatDetailValue(value: unknown, fallback = '—'): string {
  if (value == null || value === '') {
    return fallback;
  }
  if (typeof value === 'string') {
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
  error: { color: COLORS.danger, tagColor: 'error' },
  warn: { color: COLORS.warning, tagColor: 'warning' },
  info: { color: COLORS.info, tagColor: 'processing' },
  debug: { color: COLORS.purple, tagColor: 'purple' },
};

interface RealtimeNavigationState {
  autoRun?: boolean;
  presetQuery?: string;
}

interface RealtimePageCursor {
  pitId?: string;
  searchAfter?: unknown[];
}

function cloneSearchAfter(searchAfter?: unknown[]): unknown[] | undefined {
  return Array.isArray(searchAfter) && searchAfter.length > 0 ? [...searchAfter] : undefined;
}

function cloneRealtimePageCursor(cursor?: RealtimePageCursor): RealtimePageCursor | undefined {
  if (!cursor) {
    return undefined;
  }
  return {
    pitId: cursor.pitId?.trim() || undefined,
    searchAfter: cloneSearchAfter(cursor.searchAfter),
  };
}

function cloneRealtimePageCursorMap(source: Map<number, RealtimePageCursor>): Map<number, RealtimePageCursor> {
  const next = new Map<number, RealtimePageCursor>();
  source.forEach((cursor, page) => {
    const cloned = cloneRealtimePageCursor(cursor);
    if (cloned) {
      next.set(page, cloned);
    }
  });
  return next;
}

function refreshCursorMapPitID(cursorMap: Map<number, RealtimePageCursor>, pitId: string): void {
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

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

// ============================================================================
// RealtimeSearch 主组件
// ============================================================================
const RealtimeSearch: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const location = useLocation();
  const { message, modal } = App.useApp();

  // 查询状态
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [isLive, setIsLive] = useState(true);
  const [liveWindow, setLiveWindow] = useState<LiveWindowOption>(DEFAULT_LIVE_WINDOW);
  const [recentQueries, setRecentQueries] = useState<string[]>(() => readRealtimeRecentQueries());

  // 筛选器
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');

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
  const [histogramInitialLoading, setHistogramInitialLoading] = useState(true);
  const [histogramRefreshing, setHistogramRefreshing] = useState(false);
  const [histogramUsingStaleData, setHistogramUsingStaleData] = useState(false);
  const [histogramData, setHistogramData] = useState<RealtimeHistogramPoint[]>([]);
  const [tableSnapshotTo, setTableSnapshotTo] = useState(() => new Date().toISOString());

  // 分页（pageSize 持久化）
  const [currentPage, setCurrentPage] = useState(1);
  const storedPageSize = usePreferencesStore((s) => s.pageSizes['realtimeSearch'] ?? 20);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeLocal(size);
    setStoredPageSize('realtimeSearch', size);
  }, [setStoredPageSize]);
  const latestQueryRequestRef = useRef(0);
  const inFlightRequestIDRef = useRef<number | null>(null);
  const initialQueryTriggeredRef = useRef(false);
  const pageCursorMapRef = useRef<Map<number, RealtimePageCursor>>(new Map());
  const resultsTableRef = usePaginationQuickJumperAccessibility('realtime-search');
  const activeAbortControllersRef = useRef<Set<AbortController>>(new Set());
  const liveTimerRef = useRef<number | null>(null);
  const isLiveRef = useRef(isLive);
  const isUnmountedRef = useRef(false);
  const scheduleNextLiveTickRef = useRef<(delay?: number) => void>(() => undefined);
  const lastHistogramRefreshKeyRef = useRef('');
  const lastHistogramFetchedAtRef = useRef(0);
  const activeQueryRef = useRef(activeQuery);
  const pageSizeRef = useRef(pageSize);
  const currentPageRef = useRef(currentPage);
  const startupQueryTimerRef = useRef<number | null>(null);
  const lastFilterStateRef = useRef(`${levelFilter}\u0000${sourceFilter}`);

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

  const unregisterAbortController = useCallback((controller: AbortController | null) => {
    if (!controller) {
      return;
    }
    activeAbortControllersRef.current.delete(controller);
  }, []);

  const executeQuery = useCallback(async (options: {
    queryText: string;
    page: number;
    pageSize: number;
    silent?: boolean;
    recordHistory?: boolean;
    snapshotTo?: string;
    cursor?: RealtimePageCursor;
    resetCursor?: boolean;
    liveWindowOverride?: LiveWindowOption;
    histogramRefreshMode?: RealtimeHistogramRefreshMode;
    levelFilterOverride?: string;
    sourceFilterOverride?: string;
  }): Promise<boolean> => {
    const requestID = latestQueryRequestRef.current + 1;
    latestQueryRequestRef.current = requestID;
    inFlightRequestIDRef.current = requestID;
    clearLiveTimer();
    abortActiveRequests();

    const snapshotTo = options.snapshotTo?.trim() || new Date().toISOString();
    const effectiveLiveWindow = options.liveWindowOverride ?? liveWindow;
    const effectiveLevelFilter = options.levelFilterOverride ?? levelFilter;
    const effectiveSourceFilter = options.sourceFilterOverride ?? sourceFilter;
    const workingCursorMap = options.resetCursor
      ? new Map<number, RealtimePageCursor>()
      : cloneRealtimePageCursorMap(pageCursorMapRef.current);
    const requestedCursor = cloneRealtimePageCursor(options.cursor) ?? cloneRealtimePageCursor(workingCursorMap.get(options.page));
    const rootCursor = cloneRealtimePageCursor(workingCursorMap.get(1));
    const activeCursor = requestedCursor ?? (options.page > 1 && rootCursor?.pitId
      ? { pitId: rootCursor.pitId }
      : undefined);

    let tableSucceeded = false;
    let shouldRefreshHistogram = false;
    let histogramRefreshKey = '';
    const tableController = registerAbortController(new AbortController());
    let totalHistogramController: AbortController | null = null;
    let errorHistogramController: AbortController | null = null;

    try {
      const filters = buildRealtimeQueryFilters({
        levelFilter: effectiveLevelFilter,
        sourceFilter: effectiveSourceFilter,
        queryText: options.queryText,
      });
      const realtimeTableTimeRange = buildRealtimeTableTimeRange(effectiveLiveWindow, snapshotTo);
      histogramRefreshKey = buildRealtimeHistogramRefreshKey({
        queryText: options.queryText,
        levelFilter: effectiveLevelFilter,
        sourceFilter: effectiveSourceFilter,
      });
      shouldRefreshHistogram = shouldRefreshRealtimeHistogram({
        mode: options.histogramRefreshMode,
        nextRequestKey: histogramRefreshKey,
        lastRequestKey: lastHistogramRefreshKeyRef.current,
        lastFetchedAt: lastHistogramFetchedAtRef.current,
        hasHistogramData: histogramData.length > 0,
      });

      if (shouldRefreshHistogram) {
        totalHistogramController = registerAbortController(new AbortController());
        if (!effectiveLevelFilter) {
          errorHistogramController = registerAbortController(new AbortController());
        }
      }

      setTableRefreshing(true);
      setHistogramRefreshing(shouldRefreshHistogram);

      const aggregateParams = {
        groupBy: 'minute' as const,
        timeRange: HISTOGRAM_TIME_RANGE,
        keywords: options.queryText,
        filters,
      };
      const totalHistogramPromise = shouldRefreshHistogram && totalHistogramController
        ? fetchAggregateStats({
          ...aggregateParams,
          signal: totalHistogramController.signal,
        })
        : Promise.resolve(null);
      void totalHistogramPromise.catch(() => undefined);
      const errorHistogramPromise = !shouldRefreshHistogram || effectiveLevelFilter === 'error'
        ? Promise.resolve(null)
        : effectiveLevelFilter
          ? Promise.resolve(null)
          : fetchAggregateStats({
            ...aggregateParams,
            filters: {
              ...filters,
              level: 'error',
            },
            signal: errorHistogramController?.signal,
          });
      void errorHistogramPromise.catch(() => undefined);

      try {
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
          return false;
        }

        const effectivePitId = result.pitId?.trim() || activeCursor?.pitId?.trim() || '';
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
        pageCursorMapRef.current = workingCursorMap;
        setLogs(result.hits);
        setTotal(result.total);
        setTotalIsLowerBound(result.totalIsLowerBound);
        setCurrentPage(result.page);
        setQueryTimeMS(result.queryTimeMS);
        setQueryTimedOut(result.timedOut);
        setTableSnapshotTo(snapshotTo);
        setTableUsingStaleData(false);
        if (result.timedOut && !options.silent) {
          message.warning('查询超时，结果可能不完整');
        }
        tableSucceeded = true;
      } catch (error) {
        if (requestID !== latestQueryRequestRef.current) {
          return false;
        }
        if (isAbortError(error)) {
          return false;
        }
        const hasStaleTableData = logs.length > 0;
        setTableUsingStaleData(hasStaleTableData);
        if (!options.silent) {
          if (hasStaleTableData) {
            message.warning('表格刷新失败，已保留上一版结果');
          } else {
            const readableError = error instanceof Error ? error.message : '查询失败，请稍后重试';
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
        return tableSucceeded;
      }

      if (!shouldRefreshHistogram) {
        return tableSucceeded;
      }

      const [totalHistogramResult, errorHistogramResult] = await Promise.allSettled([
        totalHistogramPromise,
        errorHistogramPromise,
      ]);

      if (requestID !== latestQueryRequestRef.current) {
        return tableSucceeded;
      }

      const resolvedTotalHistogram = totalHistogramResult.status === 'fulfilled'
        ? totalHistogramResult.value
        : null;
      const resolvedErrorHistogram = errorHistogramResult.status === 'fulfilled'
        ? errorHistogramResult.value
        : null;
      const histogramFailed = totalHistogramResult.status === 'rejected'
        || errorHistogramResult.status === 'rejected';
      const histogramAbortOnly = [totalHistogramResult, errorHistogramResult].every((result) => {
        if (result.status === 'fulfilled') {
          return true;
        }
        return isAbortError(result.reason);
      });
      const canUpdateHistogram = Boolean(resolvedTotalHistogram)
        && (effectiveLevelFilter === 'error' || Boolean(effectiveLevelFilter) || Boolean(resolvedErrorHistogram));

      if (canUpdateHistogram && resolvedTotalHistogram) {
        const errorBuckets = effectiveLevelFilter === 'error'
          ? resolvedTotalHistogram.buckets
          : resolvedErrorHistogram?.buckets ?? [];
        setHistogramData(buildRealtimeHistogramData(resolvedTotalHistogram.buckets, errorBuckets));
        setHistogramUsingStaleData(false);
        setHistogramInitialLoading(false);
        lastHistogramRefreshKeyRef.current = histogramRefreshKey;
        lastHistogramFetchedAtRef.current = Date.now();
      } else if (histogramFailed && !histogramAbortOnly) {
        setHistogramUsingStaleData(histogramData.length > 0);
        setHistogramInitialLoading(false);
        if (!options.silent) {
          message.warning(histogramData.length > 0 ? '图表刷新失败，已保留上一版统计' : '图表刷新失败');
        }
      }

      return tableSucceeded;
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
  }, [abortActiveRequests, clearLiveTimer, histogramData.length, levelFilter, liveWindow, logs.length, message, registerAbortController, sourceFilter, unregisterAbortController]);

  const executeQueryRef = useRef(executeQuery);
  const startupAutoRunPresetQuery = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const queryPreset = searchParams.get('presetQuery')?.trim() ?? '';
    const queryAutoRun = searchParams.get('autoRun')?.trim() ?? '';
    if ((queryAutoRun === '1' || queryAutoRun.toLowerCase() === 'true') && queryPreset) {
      return queryPreset;
    }

    const state = (location.state as RealtimeNavigationState | null) ?? null;
    const presetQuery = state?.presetQuery?.trim() ?? '';
    if (state?.autoRun && presetQuery) {
      return presetQuery;
    }

    return readPendingRealtimeStartupQuery();
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

  const scheduleNextLiveTick = useCallback((delay = LIVE_POLL_INTERVAL_MS) => {
    clearLiveTimer();
    if (!isLiveRef.current || isUnmountedRef.current || document.hidden) {
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
      void executeQueryRef.current({
        queryText: activeQueryRef.current,
        page: currentPageRef.current,
        pageSize: pageSizeRef.current,
        silent: true,
        resetCursor: currentPageRef.current === 1,
        histogramRefreshMode: 'auto',
      });
    }, delay);
  }, [clearLiveTimer]);

  useEffect(() => {
    scheduleNextLiveTickRef.current = scheduleNextLiveTick;
  }, [scheduleNextLiveTick]);

  useEffect(() => {
    isLiveRef.current = isLive;
    if (!isLive) {
      clearLiveTimer();
      return;
    }
    if (inFlightRequestIDRef.current == null) {
      scheduleNextLiveTick(LIVE_POLL_INTERVAL_MS);
    }
  }, [clearLiveTimer, isLive, scheduleNextLiveTick]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!isLiveRef.current) {
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
        histogramRefreshMode: 'auto',
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [clearLiveTimer]);

  useEffect(() => () => {
    isUnmountedRef.current = true;
    clearLiveTimer();
    clearStartupQueryTimer();
    abortActiveRequests();
  }, [abortActiveRequests, clearLiveTimer, clearStartupQueryTimer]);

  useEffect(() => {
    if (initialQueryTriggeredRef.current || startupAutoRunPresetQuery) {
      return;
    }
    clearStartupQueryTimer();
    startupQueryTimerRef.current = window.setTimeout(() => {
      startupQueryTimerRef.current = null;
      initialQueryTriggeredRef.current = true;
      void executeQueryRef.current({
        queryText: '',
        page: 1,
        pageSize: pageSizeRef.current,
        silent: true,
        resetCursor: true,
      });
    }, STARTUP_QUERY_DELAY_MS);
    return clearStartupQueryTimer;
  }, [clearStartupQueryTimer, startupAutoRunPresetQuery]);

  useEffect(() => {
    if (!startupAutoRunPresetQuery) {
      return;
    }
    clearStartupQueryTimer();
    startupQueryTimerRef.current = window.setTimeout(() => {
      startupQueryTimerRef.current = null;
      initialQueryTriggeredRef.current = true;
      const normalizedPresetQuery = normalizeRealtimePresetQuery(startupAutoRunPresetQuery);
      lastFilterStateRef.current = `${normalizedPresetQuery.levelFilter}\u0000${normalizedPresetQuery.sourceFilter}`;
      clearPendingRealtimeStartupQuery();
      setLevelFilter(normalizedPresetQuery.levelFilter);
      setSourceFilter(normalizedPresetQuery.sourceFilter);
      setQuery(normalizedPresetQuery.queryText);
      setActiveQuery(normalizedPresetQuery.queryText);
      void executeQueryRef.current({
        queryText: normalizedPresetQuery.queryText,
        page: 1,
        pageSize: pageSizeRef.current,
        silent: false,
        resetCursor: true,
        histogramRefreshMode: 'force',
        levelFilterOverride: normalizedPresetQuery.levelFilter,
        sourceFilterOverride: normalizedPresetQuery.sourceFilter,
      });
    }, STARTUP_QUERY_DELAY_MS);
    return clearStartupQueryTimer;
  }, [clearStartupQueryTimer, startupAutoRunPresetQuery]);

  // 筛选器变化时重新执行查询（仅在筛选值实际变化时触发，避免 StrictMode 首次挂载重复执行）
  useEffect(() => {
    const nextFilterState = `${levelFilter}\u0000${sourceFilter}`;
    if (lastFilterStateRef.current === nextFilterState) {
      return;
    }
    lastFilterStateRef.current = nextFilterState;
    void executeQueryRef.current({
      queryText: activeQueryRef.current,
      page: 1,
      pageSize: pageSizeRef.current,
      silent: true,
      resetCursor: true,
      histogramRefreshMode: 'force',
    });
  }, [levelFilter, sourceFilter]);

  // 直方图数据
  const displayLogs = useMemo(() => aggregateRealtimeDisplayLogs(logs), [logs]);
  const imageAggregationSummary = useMemo(() => summarizeImageAggregation(displayLogs), [displayLogs]);
  const uniqueSources = useMemo(() => {
    const seen = new Set<string>();
    logs.forEach((log) => {
      const s = log.service?.trim();
      if (s) seen.add(s);
    });
    return Array.from(seen).sort();
  }, [logs]);
  const totalEvents = useMemo(() => sumRealtimeHistogramEvents(histogramData), [histogramData]);

  // 打开日志详情
  const handleRowClick = useCallback((record: LogEntry) => {
    setSelectedLog(record);
    setDrawerOpen(true);
  }, []);

  const runSearch = useCallback((value: string, recordHistory: boolean) => {
    const normalizedQuery = normalizeRealtimePresetQuery(value);
    const keyword = normalizedQuery.queryText;
    const nextLevelFilter = normalizedQuery.extractedFilters ? normalizedQuery.levelFilter : levelFilter;
    const nextSourceFilter = normalizedQuery.extractedFilters ? normalizedQuery.sourceFilter : sourceFilter;
    const shouldRecordHistory = recordHistory && keyword !== '';

    if (shouldRecordHistory) {
      setRecentQueries(recordRealtimeRecentQuery(keyword));
    }

    lastFilterStateRef.current = `${nextLevelFilter}\u0000${nextSourceFilter}`;
    setCurrentPage(1);
    if (normalizedQuery.extractedFilters) {
      setLevelFilter(nextLevelFilter);
      setSourceFilter(nextSourceFilter);
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
      histogramRefreshMode: 'force',
      levelFilterOverride: nextLevelFilter,
      sourceFilterOverride: nextSourceFilter,
    });
  }, [executeQuery, levelFilter, pageSize, sourceFilter]);

  const handleLiveWindowChange = useCallback((value: LiveWindowOption) => {
    if (value === liveWindow) {
      return;
    }
    setLiveWindow(value);
    setCurrentPage(1);
    void executeQuery({
      queryText: activeQuery,
      page: 1,
      pageSize,
      silent: true,
      resetCursor: true,
      liveWindowOverride: value,
      histogramRefreshMode: 'skip',
    });
  }, [activeQuery, executeQuery, liveWindow, pageSize]);

  const handleToggleLive = useCallback(() => {
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
        histogramRefreshMode: 'skip',
      });
    }
  }, [activeQuery, clearLiveTimer, currentPage, executeQuery, isLive, pageSize]);

  const handleBookmarkCurrentQuery = useCallback(() => {
    const now = new Date();
    const rawQuery = query.trim();
    const normalizedQuery = normalizeRealtimePresetQuery(rawQuery);
    const selectedFilters: Record<string, unknown> = {};

    if (!normalizedQuery.extractedFilters) {
      const normalizedLevelFilter = levelFilter.trim();
      const normalizedSourceFilter = sourceFilter.trim();
      if (normalizedLevelFilter) {
        selectedFilters.level = normalizedLevelFilter;
      }
      if (normalizedSourceFilter) {
        selectedFilters.service = normalizedSourceFilter;
      }
    }

    const effectiveFilters = normalizedQuery.extractedFilters ? normalizedQuery.filters : selectedFilters;
    const cleanedQuery = buildRealtimePresetQuery({
      queryText: normalizedQuery.queryText,
      filters: effectiveFilters,
    });

    if (!cleanedQuery) {
      message.warning('请先输入查询语句或选择筛选条件');
      return;
    }

    const comparisonBaseQuery = normalizedQuery.extractedFilters
      ? rawQuery
      : buildRealtimePresetQuery({
        queryText: rawQuery,
        filters: selectedFilters,
      });
    const shouldConfirmCleanup = cleanedQuery !== comparisonBaseQuery;
    const filterCount = Object.keys(effectiveFilters).length;

    const persistBookmark = async () => {
      try {
        await createSavedQuery({
          name: `实时查询 ${now.toLocaleString('zh-CN')}`,
          query: cleanedQuery,
          tags: [],
        });
        if (normalizedQuery.strippedTimeRange) {
          message.success('已收藏当前查询，并自动移除旧格式时间范围');
          return;
        }
        if (shouldConfirmCleanup) {
          message.success('已收藏当前查询，并自动规范旧格式查询');
          return;
        }
        message.success('已收藏当前查询');
      } catch (error) {
        const readable = error instanceof Error ? error.message : '收藏失败';
        message.error(readable);
      }
    };

    if (!shouldConfirmCleanup) {
      void persistBookmark();
      return;
    }

    modal.confirm({
      title: '收藏前将清洗旧格式查询',
      okText: '收藏并清洗',
      cancelText: '取消',
      width: 720,
      content: (
        <div className="flex flex-col gap-3">
          <div className="text-sm opacity-80">当前输入包含旧格式时间范围或遗留筛选表达式。为避免后续继续传播旧格式，收藏时将仅保留可复用的查询语义。</div>
          <div className="flex gap-2 flex-wrap">
            {normalizedQuery.strippedTimeRange && <Tag color="warning" style={{ margin: 0 }}>将移除历史时间范围</Tag>}
            {filterCount > 0 && <Tag color="blue" style={{ margin: 0 }}>保留 {filterCount} 个筛选条件</Tag>}
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-xs opacity-60">原始查询</div>
            <div className="font-mono text-sm p-2 rounded break-all" style={{ backgroundColor: 'rgba(0,0,0,0.04)' }}>
              {rawQuery}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-xs opacity-60">收藏后写入</div>
            <div className="font-mono text-sm p-2 rounded break-all" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}>
              {cleanedQuery}
            </div>
          </div>
        </div>
      ),
      onOk: async () => {
        await persistBookmark();
      },
    });
  }, [levelFilter, message, modal, query, sourceFilter]);

  // 执行检索（仅手动点击执行/回车时写入历史）
  const handleSearch = useCallback((value: string) => {
    runSearch(value, true);
  }, [runSearch]);

  // 直方图 ECharts 配置
  const histogramOption: EChartsCoreOption = useMemo(() => ({
    grid: { top: 24, right: 16, bottom: 24, left: 48 },
    legend: {
      show: true,
      top: 0,
      right: 0,
      textStyle: { fontSize: 10, color: isDark ? '#94a3b8' : '#475569' },
      itemWidth: 10,
      itemHeight: 10,
    },
    xAxis: {
      type: 'category',
      data: histogramData.map((d) => d.time),
      axisLabel: { fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' } },
    },
    series: [
      {
        name: '正常',
        type: 'bar',
        stack: 'total',
        data: histogramData.map((d) => d.normal),
        itemStyle: { color: COLORS.primary, borderRadius: [0, 0, 0, 0] },
        barMaxWidth: 20,
      },
      {
        name: '错误',
        type: 'bar',
        stack: 'total',
        data: histogramData.map((d) => d.error),
        itemStyle: { color: COLORS.danger, borderRadius: [2, 2, 0, 0] },
        barMaxWidth: 20,
      },
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
  }), [histogramData, isDark]);

  // 表格列定义
  const columns: ColumnsType<LogEntry> = useMemo(() => [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (v: string) => (
        <span className="text-sm font-mono opacity-70">
          {new Date(v).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </span>
      ),
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (v: string) => {
        const cfg = LEVEL_CONFIG[v] || LEVEL_CONFIG.info;
        return <Tag color={cfg.tagColor} style={{ margin: 0, fontSize: 12 }}>{v.toUpperCase()}</Tag>;
      },
    },
    {
      title: '服务',
      dataIndex: 'service',
      key: 'service',
      width: 150,
      render: (v: string) => <span className="text-sm font-medium">{v}</span>,
    },
    {
      title: '主机',
      dataIndex: 'host',
      key: 'host',
      width: 180,
      ellipsis: true,
      render: (v: string) => {
        const displayValue = toDisplayText(v);
        if (displayValue === '—') {
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
      title: '主机IP',
      dataIndex: 'hostIp',
      key: 'hostIp',
      width: 160,
      ellipsis: true,
      render: (v: string) => {
        const displayValue = toDisplayText(v);
        if (displayValue === '—') {
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
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (v: string, record) => {
        if (!record.aggregated) {
          return <span className="text-sm">{v}</span>;
        }
        return (
          <div className="flex items-center gap-2 min-w-0">
            <Tag color="blue" style={{ margin: 0 }}>聚合 {record.aggregated.count}</Tag>
            <Tooltip title={record.aggregated.samplePaths.join('\n') || v}>
              <span className="text-sm truncate">{v}</span>
            </Tooltip>
          </div>
        );
      },
    },
  ], []);

  const copyToClipboard = useCallback(async (content: string, successText: string) => {
    const normalized = content.trim();
    if (!normalized || normalized === '—') {
      message.warning('没有可复制的内容');
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(normalized);
      } else if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = normalized;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      message.success(successText);
    } catch {
      message.error('复制失败，请检查浏览器权限');
    }
  }, []);

  const selectedFields = selectedLog?.fields;
  const selectedAggregation = selectedLog?.aggregated;
  const drawerEventID = toDisplayText(selectedFields?.event_id ?? selectedLog?.id);
  const drawerLevel = toDisplayText(selectedFields?.level ?? selectedLog?.level);
  const drawerTimestamp = toDisplayText(selectedFields?.timestamp ?? selectedLog?.timestamp ?? selectedFields?.collect_time);
  const drawerMessage = toDisplayText(selectedLog?.message ?? selectedFields?.message);
  const drawerSource = toDisplayText(selectedFields?.source ?? selectedFields?.source_path ?? selectedFields?.source_internal);
  const drawerService = toDisplayText(selectedLog?.service ?? selectedFields?.service_name ?? selectedFields?.service);
  const drawerHost = toDisplayText(selectedLog?.host ?? selectedFields?.host ?? selectedFields?.server_id);
  const drawerHostIP = toDisplayText(selectedLog?.hostIp ?? selectedFields?.host_ip, '—');
  const drawerRawLog = selectedLog?.rawLog ?? selectedFields?.raw_message ?? selectedFields?.raw_log ?? drawerMessage;
  const drawerTraceId = toDisplayText(selectedFields?.traceId, '—');
  const drawerSpanId = toDisplayText(selectedFields?.spanId, '—');
  const drawerMethod = toDisplayText(selectedFields?.method, '—');
  const drawerStatusCode = toDisplayText(selectedFields?.statusCode, '—');
  const drawerUserAgent = toDisplayText(selectedFields?.userAgent, '—');
  const drawerRawContent = formatDetailValue(drawerRawLog);
  const drawerFieldsJson = useMemo(() => {
    if (!selectedFields) {
      return '—';
    }
    return formatDetailValue(
      Object.fromEntries(Object.entries(selectedFields).sort(([left], [right]) => left.localeCompare(right))),
    );
  }, [selectedFields]);
  const drawerPayloadJson = useMemo(() => {
    if (!selectedLog) {
      return '—';
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
      { key: 'event-id', label: '事件 ID', value: drawerEventID, mono: true, copyable: true },
      { key: 'timestamp', label: '时间', value: drawerTimestamp, mono: true, copyable: true },
      { key: 'service', label: '服务', value: drawerService, mono: false, copyable: false },
      { key: 'host', label: '主机', value: drawerHost, mono: true, copyable: true },
      { key: 'host-ip', label: '主机 IP', value: drawerHostIP, mono: true, copyable: drawerHostIP !== '—' },
      { key: 'source', label: '来源', value: drawerSource, mono: true, copyable: true },
      { key: 'trace', label: 'Trace ID', value: drawerTraceId, mono: true, copyable: drawerTraceId !== '—' },
    ];
    if (selectedAggregation) {
      items.push({
        key: 'aggregation',
        label: '图片聚合',
        value: `${selectedAggregation.count} 条已折叠`,
        mono: false,
        copyable: false,
      });
    }
    return items;
  }, [drawerEventID, drawerHost, drawerHostIP, drawerService, drawerSource, drawerTimestamp, drawerTraceId, selectedAggregation]);

  return (
    <div className="flex flex-col gap-4">
      {/* 查询栏 */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 items-center flex-wrap">
          <Input.Search
            id="realtime-query-input"
            name="realtime-query"
            placeholder='输入查询语句，例如: level:error AND service:"payment-service"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            enterButton={
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">play_arrow</span>
                执行
              </span>
            }
            onSearch={handleSearch}
            style={{ flex: 1, minWidth: 300 }}
            allowClear
          />
          <Tooltip title="保存查询">
            <Button
              icon={<span className="material-symbols-outlined text-sm">bookmark_add</span>}
              onClick={handleBookmarkCurrentQuery}
            />
          </Tooltip>
          <Button type="link" size="small">
            <span className="flex items-center gap-1 text-xs">
              <span className="material-symbols-outlined text-sm">help_outline</span>
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
              className="cursor-pointer"
              style={{ fontSize: 11, margin: 0 }}
              onClick={() => runSearch(q, true)}
            >
              {q}
            </Tag>
          ))}
        </div>

        {/* 级别 / 来源筛选 */}
        <Space wrap>
          <Select
            placeholder="级别"
            allowClear
            value={levelFilter || undefined}
            onChange={(v) => setLevelFilter(v ?? '')}
            style={{ minWidth: 120 }}
            options={[
              { value: '', label: 'ALL' },
              { value: 'debug', label: 'DEBUG' },
              { value: 'info', label: 'INFO' },
              { value: 'warn', label: 'WARN' },
              { value: 'error', label: 'ERROR' },
              { value: 'fatal', label: 'FATAL' },
            ]}
          />
          <Select
            placeholder="来源/服务"
            allowClear
            showSearch
            value={sourceFilter || undefined}
            onChange={(v) => setSourceFilter(v ?? '')}
            style={{ minWidth: 180 }}
            optionFilterProp="label"
            options={[
              { value: '', label: 'ALL' },
              ...uniqueSources.map((s) => ({ value: s, label: s })),
            ]}
          />
        </Space>
      </div>

      {/* 事件量直方图 */}
      <ChartWrapper
        title="事件量分布"
        subtitle={`最近 30 分钟 · 共 ${totalEvents.toLocaleString()} 条`}
        loading={histogramInitialLoading && histogramRefreshing && histogramData.length === 0}
        actions={(
          <Space size={8}>
            {histogramRefreshing && !histogramInitialLoading && <Tag color="processing" style={{ margin: 0 }}>刷新中</Tag>}
            {histogramUsingStaleData && <Tag color="warning" style={{ margin: 0 }}>使用上次统计</Tag>}
          </Space>
        )}
        option={histogramOption}
        height={160}
      />

      {/* 日志结果表格 */}
      <div ref={resultsTableRef} className="flex flex-col gap-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Button
              size="small"
              type={isLive ? 'primary' : 'default'}
              onClick={handleToggleLive}
              icon={
                <span className="material-symbols-outlined text-sm">
                  {isLive ? 'pause' : 'play_arrow'}
                </span>
              }
            >
              {isLive ? '实时' : '已暂停'}
            </Button>
            <Select
              size="small"
              value={liveWindow}
              onChange={handleLiveWindowChange}
              style={{ minWidth: 132 }}
              options={LIVE_WINDOW_OPTIONS}
            />
            <span className="text-xs opacity-50">
              共 {formatRealtimeTotal(total, totalIsLowerBound)} 条结果 · 耗时 {queryTimeMS}ms · 时间窗 {liveWindow}
            </span>
            {tableRefreshing && !initialLoading && <Tag color="processing" style={{ margin: 0 }}>刷新中</Tag>}
            {tableUsingStaleData && <Tag color="warning" style={{ margin: 0 }}>使用上次结果</Tag>}
            {totalIsLowerBound && <Tag color="default" style={{ margin: 0 }}>总数按阈值统计</Tag>}
            {imageAggregationSummary.hiddenRows > 0 && (
              <Tag color="blue" style={{ margin: 0 }}>
                本页已聚合 {imageAggregationSummary.groupedRows} 组图片日志，折叠 {imageAggregationSummary.hiddenRows} 条
              </Tag>
            )}
            {queryTimedOut && <Tag color="warning" style={{ margin: 0 }}>查询超时</Tag>}
            {(total > MAX_PAGINATION_WINDOW_ROWS || (totalIsLowerBound && total >= MAX_PAGINATION_WINDOW_ROWS)) && (
              <Tag color="gold" style={{ margin: 0 }}>
                超过前 {MAX_PAGINATION_WINDOW_ROWS.toLocaleString()} 条后，仅支持顺序翻页或返回已访问页
              </Tag>
            )}
          </div>
          <Space size="small">
            <Tooltip title="列设置">
              <Button size="small" icon={<span className="material-symbols-outlined text-sm">view_column</span>} />
            </Tooltip>
            <Tooltip title="下载">
              <Button size="small" icon={<span className="material-symbols-outlined text-sm">download</span>} />
            </Tooltip>
          </Space>
        </div>

        <Table<LogEntry>
          dataSource={displayLogs}
          columns={columns}
          rowKey="id"
          loading={initialLoading && tableRefreshing}
          size="small"
          pagination={{
            current: currentPage,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (itemsTotal) => `共 ${formatRealtimeTotal(itemsTotal, totalIsLowerBound)} 条`,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, size) => {
              const nextPageSize = size ?? pageSize;
              const pageSizeChanged = nextPageSize !== pageSize;
              const targetPage = pageSizeChanged ? 1 : page;
              const maxPaginationPage = resolveMaxPaginationPage(nextPageSize);
              const cachedCursor = cloneRealtimePageCursor(pageCursorMapRef.current.get(targetPage));
              if (targetPage > maxPaginationPage && !cachedCursor) {
                message.warning(`超过前 ${MAX_PAGINATION_WINDOW_ROWS.toLocaleString()} 条后仅支持顺序深分页；请先逐页浏览到目标页，或返回已访问页。`);
                return;
              }
              const previousPage = currentPage;
              const previousPageSize = pageSize;
              if (targetPage > 1 && isLive) {
                setIsLive(false);
              }
              const requestCursor = cachedCursor ?? (targetPage > 1
                ? cloneRealtimePageCursor(pageCursorMapRef.current.get(1))
                : undefined);
              setCurrentPage(targetPage);
              setPageSize(nextPageSize);
              void executeQuery({
                queryText: activeQuery,
                page: targetPage,
                pageSize: nextPageSize,
                silent: false,
                snapshotTo: tableSnapshotTo,
                cursor: requestCursor,
                resetCursor: pageSizeChanged,
                histogramRefreshMode: 'skip',
              }).then((success) => {
                if (!success) {
                  setCurrentPage(previousPage);
                  if (nextPageSize !== previousPageSize) {
                    setPageSize(previousPageSize);
                  }
                }
              });
            },
            position: ['bottomLeft'],
          }}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: { cursor: 'pointer' },
          })}
          scroll={{ x: 980 }}
        />
      </div>

      {/* 日志详情抽屉 */}
      <Drawer
        title={
          selectedLog ? (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base" style={{ color: LEVEL_CONFIG[selectedLog.level]?.color }}>
                {selectedLog.level === 'error' ? 'error' : selectedLog.level === 'warn' ? 'warning' : 'info'}
              </span>
              <span>日志详情</span>
              <Tag color={LEVEL_CONFIG[selectedLog.level]?.tagColor || 'default'} style={{ margin: 0 }}>
                {selectedLog.level.toUpperCase()}
              </Tag>
            </div>
          ) : '日志详情'
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={760}
        styles={{ body: { paddingTop: 12, paddingBottom: 12 } }}
        footer={selectedLog ? (
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <Button
              icon={<span className="material-symbols-outlined text-sm">data_object</span>}
              onClick={() => void copyToClipboard(drawerFieldsJson, '已复制字段 JSON')}
            >
              字段 JSON
            </Button>
            <Button
              type="primary"
              ghost
              icon={<span className="material-symbols-outlined text-sm">content_copy</span>}
              onClick={() => void copyToClipboard(drawerPayloadJson, '已复制完整载荷')}
            >
              完整载荷
            </Button>
          </div>
        ) : null}
      >
        {selectedLog && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {drawerSummaryItems.map((item) => (
                <div
                  key={item.key}
                  className="rounded-lg p-3"
                  style={{
                    backgroundColor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(248,250,252,0.95)',
                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  }}
                >
                  <div className="text-[11px] uppercase tracking-wide opacity-50 mb-1">{item.label}</div>
                  <Typography.Text
                    copyable={item.copyable ? { text: item.value } : false}
                    style={{
                      fontSize: 12,
                      display: 'block',
                      lineHeight: 1.6,
                      wordBreak: 'break-all',
                      fontFamily: item.mono ? 'var(--font-mono, monospace)' : 'inherit',
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
                backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] uppercase tracking-wide opacity-50">消息</span>
                <Space size="small">
                  <Tooltip title="复制消息">
                    <Button
                      size="small"
                      icon={<span className="material-symbols-outlined text-sm">content_copy</span>}
                      onClick={() => void copyToClipboard(drawerMessage, '已复制日志消息')}
                    />
                  </Tooltip>
                  <Tooltip title="复制原始日志">
                    <Button
                      size="small"
                      icon={<span className="material-symbols-outlined text-sm">article</span>}
                      onClick={() => void copyToClipboard(drawerRawContent, '已复制原始日志')}
                    />
                  </Tooltip>
                </Space>
              </div>
              <Typography.Paragraph
                className="!mb-0 text-sm leading-6 whitespace-pre-wrap break-all"
                ellipsis={{ rows: 6, expandable: true, symbol: '展开' }}
              >
                {drawerMessage}
              </Typography.Paragraph>
            </div>

            <div className="flex flex-wrap gap-2">
              <Tag>service={drawerService}</Tag>
              <Tag>level={drawerLevel}</Tag>
              {drawerHost !== '—' && <Tag>host={drawerHost}</Tag>}
              {drawerHostIP !== '—' && <Tag>host_ip={drawerHostIP}</Tag>}
              {selectedFields?.env != null && <Tag color="cyan">env={toDisplayText(selectedFields.env)}</Tag>}
              {selectedFields?.region != null && <Tag>region={toDisplayText(selectedFields.region)}</Tag>}
              {selectedFields?.method != null && <Tag>method={toDisplayText(selectedFields.method)}</Tag>}
              {selectedFields?.statusCode != null && <Tag color={Number(selectedFields.statusCode) >= 500 ? 'error' : Number(selectedFields.statusCode) >= 400 ? 'warning' : 'success'}>status={toDisplayText(selectedFields.statusCode)}</Tag>}
              {selectedFields?.traceId != null && <Tag color="purple">trace={toDisplayText(selectedFields.traceId)}</Tag>}
              {selectedFields?.spanId != null && <Tag color="purple">span={toDisplayText(selectedFields.spanId)}</Tag>}
            </div>

            <Collapse
              defaultActiveKey={['event']}
              items={[
                {
                  key: 'event',
                  label: (
                    <span className="flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-sm">event</span>
                      事件层 (Event Layer)
                    </span>
                  ),
                  children: (
                    <Descriptions column={2} size="small" bordered>
                      <Descriptions.Item label="event_id">
                        <Typography.Text copyable style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)' }}>
                          {drawerEventID}
                        </Typography.Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="level">
                        <Tag color={LEVEL_CONFIG[selectedLog.level]?.tagColor || 'default'} style={{ margin: 0 }}>
                          {drawerLevel.toUpperCase()}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="timestamp">
                        <span className="font-mono text-xs">{drawerTimestamp}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="service_name">
                        <span className="text-xs">{drawerService}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="host">
                        <span className="font-mono text-xs">{drawerHost}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="host_ip">
                        <span className="font-mono text-xs">{drawerHostIP}</span>
                      </Descriptions.Item>
                      {selectedAggregation && (
                        <Descriptions.Item label="image_aggregation" span={2}>
                          <span className="text-xs">{selectedAggregation.summary}</span>
                        </Descriptions.Item>
                      )}
                      <Descriptions.Item label="message" span={2}>
                        <Typography.Paragraph className="!mb-0 text-xs whitespace-pre-wrap break-all">
                          {drawerMessage}
                        </Typography.Paragraph>
                      </Descriptions.Item>
                      <Descriptions.Item label="source" span={2}>
                        <Typography.Text copyable style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)' }}>
                          {drawerSource}
                        </Typography.Text>
                      </Descriptions.Item>
                    </Descriptions>
                  ),
                },
                ...(selectedAggregation ? [{
                  key: 'aggregation',
                  label: (
                    <span className="flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-sm">stacked_email</span>
                      图片聚合清单 (Aggregated Image Logs)
                    </span>
                  ),
                  children: (
                    <div className="flex flex-col gap-2">
                      <div className="text-xs opacity-70">{selectedAggregation.summary}</div>
                      <div
                        className="p-3 rounded font-mono text-xs leading-relaxed whitespace-pre-wrap break-all max-h-72 overflow-auto"
                        style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}
                      >
                        {selectedAggregation.entries.map((entry, entryIndex) => `${entryIndex + 1}. ${entry.rawLog ?? entry.message}`).join('\n')}
                      </div>
                    </div>
                  ),
                }] : []),
                {
                  key: 'raw',
                  label: (
                    <span className="flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-sm">article</span>
                      原始层 (Raw Layer)
                    </span>
                  ),
                  children: (
                    <div
                      className="p-3 rounded font-mono text-xs leading-relaxed whitespace-pre-wrap break-all max-h-80 overflow-auto"
                      style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}
                    >
                      {drawerRawContent}
                    </div>
                  ),
                },
                {
                  key: 'transport',
                  label: (
                    <span className="flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-sm">swap_horiz</span>
                      传输层 (Transport Layer)
                    </span>
                  ),
                  children: (
                    <Descriptions column={2} size="small" bordered>
                      <Descriptions.Item label="agent_id">
                        <span className="font-mono text-xs">{toDisplayText(selectedFields?.agent_id)}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="batch_id">
                        <span className="font-mono text-xs">{toDisplayText(selectedFields?.batch_id)}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="collect_time">
                        <span className="font-mono text-xs">{toDisplayText(selectedFields?.collect_time ?? selectedLog?.timestamp)}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="sequence">
                        <span className="font-mono text-xs">{toDisplayText(selectedFields?.sequence)}</span>
                      </Descriptions.Item>
                    </Descriptions>
                  ),
                },
                {
                  key: 'ingest',
                  label: (
                    <span className="flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-sm">input</span>
                      接入层 (Ingest Layer)
                    </span>
                  ),
                  children: (
                    <Descriptions column={2} size="small" bordered>
                      <Descriptions.Item label="ingested_at">
                        <span className="font-mono text-xs">{toDisplayText(selectedFields?.ingested_at)}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="schema_version">
                        <span className="font-mono text-xs">{toDisplayText(selectedFields?.schema_version)}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="pipeline_version">
                        <span className="font-mono text-xs">{toDisplayText(selectedFields?.pipeline_version)}</span>
                      </Descriptions.Item>
                    </Descriptions>
                  ),
                },
                {
                  key: 'governance',
                  label: (
                    <span className="flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
                      治理层 (Governance Layer)
                    </span>
                  ),
                  children: (
                    <Descriptions column={2} size="small" bordered>
                      <Descriptions.Item label="tenant_id">
                        <span className="font-mono text-xs">{toDisplayText(selectedFields?.tenant_id)}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="retention_policy">
                        <span className="font-mono text-xs">{toDisplayText(selectedFields?.retention_policy)}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="pii_masked">
                        <span className="font-mono text-xs">{toDisplayText(selectedFields?.pii_masked)}</span>
                      </Descriptions.Item>
                    </Descriptions>
                  ),
                },
                {
                  key: 'payload',
                  label: (
                    <span className="flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-sm">data_object</span>
                      完整载荷 (Full Payload)
                    </span>
                  ),
                  children: (
                    <div
                      className="p-3 rounded font-mono text-xs leading-relaxed whitespace-pre-wrap break-all max-h-96 overflow-auto"
                      style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}
                    >
                      {drawerPayloadJson}
                    </div>
                  ),
                },
              ]}
            />

            <Divider orientation="left" orientationMargin={0} style={{ margin: '8px 0 12px' }}>
              <span className="flex items-center gap-1 text-xs">
                <span className="material-symbols-outlined text-sm">link</span>
                追踪信息
              </span>
            </Divider>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Trace ID">
                <Typography.Text copyable={drawerTraceId !== '—'} style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)' }}>
                  {drawerTraceId}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Span ID">
                <Typography.Text copyable={drawerSpanId !== '—'} style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)' }}>
                  {drawerSpanId}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Method / Status">
                <span className="font-mono text-xs">
                  {[drawerMethod !== '—' ? drawerMethod : '', drawerStatusCode !== '—' ? drawerStatusCode : ''].filter(Boolean).join(' / ') || '—'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="User-Agent">
                <span className="font-mono text-xs break-all">{drawerUserAgent}</span>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default RealtimeSearch;

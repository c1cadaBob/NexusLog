export interface SearchPageVisibleRange {
  start: number;
  end: number;
}

export interface ResolveSearchPageVisibleRangeOptions {
  total: number;
  page: number;
  pageSize: number;
  itemCount: number;
}

export interface ResolveRealtimeLogsEmptyDescriptionOptions {
  queryText?: string;
  levelFilter?: string;
  sourceFilter?: string;
  hasCustomTimeRange?: boolean;
  liveWindow?: string;
}

export function resolveSearchPageVisibleRange(
  options: ResolveSearchPageVisibleRangeOptions,
): SearchPageVisibleRange {
  const total = Number.isFinite(options.total)
    ? Math.max(0, Math.floor(options.total))
    : 0;
  const itemCount = Number.isFinite(options.itemCount)
    ? Math.max(0, Math.floor(options.itemCount))
    : 0;
  if (total === 0 || itemCount === 0) {
    return { start: 0, end: 0 };
  }

  const page = Number.isFinite(options.page)
    ? Math.max(1, Math.floor(options.page))
    : 1;
  const pageSize = Number.isFinite(options.pageSize)
    ? Math.max(1, Math.floor(options.pageSize))
    : 1;
  const start = (page - 1) * pageSize + 1;
  return {
    start,
    end: start + itemCount - 1,
  };
}

export function hasSearchPageVisibleRange(
  range: SearchPageVisibleRange,
): boolean {
  return range.start > 0 && range.end >= range.start;
}

export function formatSearchPageTotal(
  total: number,
  unitLabel: string,
): string {
  const normalizedTotal = Number.isFinite(total)
    ? Math.max(0, Math.floor(total))
    : 0;
  return `共 ${normalizedTotal.toLocaleString()} ${unitLabel}`;
}

export function formatSearchPageSummary(
  total: number,
  unitLabel: string,
  visibleRange?: SearchPageVisibleRange,
  visibleRangeUnitLabel = "条",
): string {
  const totalLabel = formatSearchPageTotal(total, unitLabel);
  if (!visibleRange || !hasSearchPageVisibleRange(visibleRange)) {
    return totalLabel;
  }
  return `${totalLabel}（当前显示第 ${visibleRange.start}-${visibleRange.end} ${visibleRangeUnitLabel}）`;
}

export function resolveSearchPageLoadingLabel(itemCount: number): string {
  return itemCount > 0 ? "后台刷新中" : "加载中";
}

export function resolveSearchPageEmptyDescription(
  hasFilters: boolean,
  filteredDescription: string,
  idleDescription: string,
): string {
  return hasFilters ? filteredDescription : idleDescription;
}

export function resolveRealtimeLogsEmptyDescription(
  options: ResolveRealtimeLogsEmptyDescriptionOptions,
): string {
  const hasQueryText = (options.queryText ?? "").trim().length > 0;
  const hasLevelFilter = (options.levelFilter ?? "").trim().length > 0;
  const hasSourceFilter = (options.sourceFilter ?? "").trim().length > 0;

  if (hasQueryText || hasLevelFilter || hasSourceFilter) {
    return "当前条件下没有匹配日志";
  }
  if (options.hasCustomTimeRange) {
    return "所选时间范围暂无日志";
  }
  if ((options.liveWindow ?? "").trim() === "all") {
    return "全部时间范围暂无日志";
  }
  return "当前时间范围暂无日志";
}

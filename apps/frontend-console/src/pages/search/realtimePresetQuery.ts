import type { RealtimeQueryFilters, RealtimeQueryFilterValue } from './realtimeQueryFilterTypes';

interface RealtimePresetTimeRange {
  from?: string;
  to?: string;
}

interface NormalizedRealtimePresetQuery {
  queryText: string;
  filters: RealtimeQueryFilters;
  levelFilter: string;
  sourceFilter: string;
  strippedTimeRange: boolean;
  extractedFilters: boolean;
  timeRange?: RealtimePresetTimeRange;
}

const TRAILING_TIME_RANGE_PATTERN = /(?:^|\s)time:\[\s*([^,\]]*)\s*,\s*([^\]]*)\s*\]\s*$/i;
const FILTERS_PREFIX = 'filters:';

function normalizeFilterString(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value)) {
    const firstString = value.find((item): item is string => typeof item === 'string' && item.trim().length > 0);
    return firstString?.trim() ?? '';
  }
  return '';
}

function normalizeTimeRangeBoundary(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  const normalized = value.trim();
  if (!normalized) {
    return '';
  }
  return Number.isNaN(Date.parse(normalized)) ? '' : normalized;
}

function extractTrailingTimeRange(queryText: string): {
  queryText: string;
  timeRange?: RealtimePresetTimeRange;
  extracted: boolean;
} {
  const trimmedQuery = queryText.trim();
  if (!trimmedQuery) {
    return { queryText: '', extracted: false };
  }

  const matched = trimmedQuery.match(TRAILING_TIME_RANGE_PATTERN);
  if (!matched || typeof matched.index !== 'number') {
    return { queryText: trimmedQuery, extracted: false };
  }

  const from = normalizeTimeRangeBoundary(matched[1]);
  const to = normalizeTimeRangeBoundary(matched[2]);
  const hasTimeRange = Boolean(from || to);

  return {
    queryText: trimmedQuery.slice(0, matched.index).trim(),
    timeRange: hasTimeRange ? { from, to } : undefined,
    extracted: true,
  };
}

function extractTrailingFilters(queryText: string): {
  queryText: string;
  filters: Record<string, unknown>;
  extracted: boolean;
} {
  const trimmedQuery = queryText.trim();
  if (!trimmedQuery) {
    return { queryText: '', filters: {}, extracted: false };
  }

  let filterTokenIndex = -1;
  if (trimmedQuery.startsWith(FILTERS_PREFIX)) {
    filterTokenIndex = 0;
  } else {
    const trailingIndex = trimmedQuery.lastIndexOf(` ${FILTERS_PREFIX}`);
    if (trailingIndex >= 0) {
      filterTokenIndex = trailingIndex + 1;
    }
  }

  if (filterTokenIndex < 0) {
    return { queryText: trimmedQuery, filters: {}, extracted: false };
  }

  const candidateJSON = trimmedQuery.slice(filterTokenIndex + FILTERS_PREFIX.length).trim();
  try {
    const parsed = JSON.parse(candidateJSON);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { queryText: trimmedQuery, filters: {}, extracted: false };
    }

    return {
      queryText: trimmedQuery.slice(0, filterTokenIndex).trim(),
      filters: parsed as Record<string, unknown>,
      extracted: true,
    };
  } catch {
    return { queryText: trimmedQuery, filters: {}, extracted: false };
  }
}

function normalizeRealtimePresetFilterValue(value: unknown): RealtimeQueryFilterValue | null {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    return trimmedValue ? trimmedValue : null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    const normalizedValues = value
      .map((item) => normalizeRealtimePresetFilterValue(item))
      .filter((item): item is RealtimeQueryFilterValue => item != null);
    return normalizedValues.length > 0 ? normalizedValues : null;
  }

  if (value && typeof value === 'object') {
    const normalizedObject = normalizeRealtimePresetFilters(value as Record<string, unknown>);
    return Object.keys(normalizedObject).length > 0 ? normalizedObject : null;
  }

  return null;
}

function normalizeRealtimePresetFilters(filters: Record<string, unknown>): RealtimeQueryFilters {
  return Object.entries(filters).reduce<RealtimeQueryFilters>((result, [key, value]) => {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      return result;
    }

    const normalizedValue = normalizeRealtimePresetFilterValue(value);
    if (normalizedValue == null) {
      return result;
    }

    result[normalizedKey] = normalizedValue;
    return result;
  }, {});
}

function sortJSONValue(value: RealtimeQueryFilterValue): RealtimeQueryFilterValue {
  if (Array.isArray(value)) {
    return value.map((item) => sortJSONValue(item));
  }
  if (value && typeof value === 'object') {
    const objectValue = value as RealtimeQueryFilters;
    return Object.keys(objectValue)
      .sort((left, right) => left.localeCompare(right))
      .reduce<RealtimeQueryFilters>((result, key) => {
        result[key] = sortJSONValue(objectValue[key]);
        return result;
      }, {});
  }
  return value;
}

function hasRealtimePresetFilters(filters: RealtimeQueryFilters): boolean {
  return Object.keys(filters).length > 0;
}

export type { NormalizedRealtimePresetQuery };

export function buildRealtimePresetQuery(params: {
  queryText: string;
  filters?: RealtimeQueryFilters;
}): string {
  const queryText = params.queryText.trim();
  const normalizedFilters = normalizeRealtimePresetFilters(params.filters ?? {});
  const filtersText = hasRealtimePresetFilters(normalizedFilters)
    ? `${FILTERS_PREFIX}${JSON.stringify(sortJSONValue(normalizedFilters))}`
    : '';
  return [queryText, filtersText].filter(Boolean).join(' ').trim();
}

export function normalizeRealtimePresetQuery(rawQuery: string): NormalizedRealtimePresetQuery {
  const extractedTimeRange = extractTrailingTimeRange(rawQuery);
  const strippedTimeRange = extractedTimeRange.extracted;
  const { queryText: queryWithoutFilters, filters, extracted } = extractTrailingFilters(extractedTimeRange.queryText);
  const normalizedFilters = normalizeRealtimePresetFilters(filters);

  return {
    queryText: queryWithoutFilters,
    filters: normalizedFilters,
    levelFilter: normalizeFilterString(normalizedFilters.level),
    sourceFilter: normalizeFilterString(normalizedFilters.service) || normalizeFilterString(normalizedFilters.source),
    strippedTimeRange,
    extractedFilters: extracted,
    timeRange: extractedTimeRange.timeRange,
  };
}

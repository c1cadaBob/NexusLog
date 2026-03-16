interface NormalizedRealtimePresetQuery {
  queryText: string;
  filters: Record<string, unknown>;
  levelFilter: string;
  sourceFilter: string;
  strippedTimeRange: boolean;
  extractedFilters: boolean;
}

const TRAILING_TIME_RANGE_PATTERN = /(?:^|\s)time:\[[^\]]*\]\s*$/i;
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

function normalizeRealtimePresetFilters(filters: Record<string, unknown>): Record<string, unknown> {
  return Object.entries(filters).reduce<Record<string, unknown>>((result, [key, value]) => {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      return result;
    }

    if (typeof value === 'string') {
      const trimmedValue = value.trim();
      if (!trimmedValue) {
        return result;
      }
      result[normalizedKey] = trimmedValue;
      return result;
    }

    if (Array.isArray(value)) {
      const normalizedValues = value
        .map((item) => (typeof item === 'string' ? item.trim() : item))
        .filter((item) => item != null && item !== '');
      if (normalizedValues.length === 0) {
        return result;
      }
      result[normalizedKey] = normalizedValues;
      return result;
    }

    if (value && typeof value === 'object') {
      const normalizedObject = normalizeRealtimePresetFilters(value as Record<string, unknown>);
      if (Object.keys(normalizedObject).length === 0) {
        return result;
      }
      result[normalizedKey] = normalizedObject;
      return result;
    }

    if (value != null) {
      result[normalizedKey] = value;
    }
    return result;
  }, {});
}

function sortJSONValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJSONValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort((left, right) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortJSONValue((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return value;
}

function hasRealtimePresetFilters(filters: Record<string, unknown>): boolean {
  return Object.keys(filters).length > 0;
}

export type { NormalizedRealtimePresetQuery };

export function buildRealtimePresetQuery(params: {
  queryText: string;
  filters?: Record<string, unknown>;
}): string {
  const queryText = params.queryText.trim();
  const normalizedFilters = normalizeRealtimePresetFilters(params.filters ?? {});
  const filtersText = hasRealtimePresetFilters(normalizedFilters)
    ? `${FILTERS_PREFIX}${JSON.stringify(sortJSONValue(normalizedFilters))}`
    : '';
  return [queryText, filtersText].filter(Boolean).join(' ').trim();
}

export function normalizeRealtimePresetQuery(rawQuery: string): NormalizedRealtimePresetQuery {
  let queryText = rawQuery.trim();
  let strippedTimeRange = false;

  const timeMatch = queryText.match(TRAILING_TIME_RANGE_PATTERN);
  if (timeMatch && typeof timeMatch.index === 'number') {
    queryText = queryText.slice(0, timeMatch.index).trim();
    strippedTimeRange = true;
  }

  const { queryText: queryWithoutFilters, filters, extracted } = extractTrailingFilters(queryText);
  const normalizedFilters = normalizeRealtimePresetFilters(filters);

  return {
    queryText: queryWithoutFilters,
    filters: normalizedFilters,
    levelFilter: normalizeFilterString(normalizedFilters.level),
    sourceFilter: normalizeFilterString(normalizedFilters.service) || normalizeFilterString(normalizedFilters.source),
    strippedTimeRange,
    extractedFilters: extracted,
  };
}

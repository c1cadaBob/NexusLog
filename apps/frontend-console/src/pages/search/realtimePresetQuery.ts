interface NormalizedRealtimePresetQuery {
  queryText: string;
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

export type { NormalizedRealtimePresetQuery };

export function normalizeRealtimePresetQuery(rawQuery: string): NormalizedRealtimePresetQuery {
  let queryText = rawQuery.trim();
  let strippedTimeRange = false;

  const timeMatch = queryText.match(TRAILING_TIME_RANGE_PATTERN);
  if (timeMatch && typeof timeMatch.index === 'number') {
    queryText = queryText.slice(0, timeMatch.index).trim();
    strippedTimeRange = true;
  }

  const { queryText: queryWithoutFilters, filters, extracted } = extractTrailingFilters(queryText);

  return {
    queryText: queryWithoutFilters,
    levelFilter: normalizeFilterString(filters.level),
    sourceFilter: normalizeFilterString(filters.service) || normalizeFilterString(filters.source),
    strippedTimeRange,
    extractedFilters: extracted,
  };
}

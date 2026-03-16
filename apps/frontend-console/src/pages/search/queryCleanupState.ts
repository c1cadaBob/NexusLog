import { buildRealtimePresetQuery, normalizeRealtimePresetQuery, type NormalizedRealtimePresetQuery } from './realtimePresetQuery';
import { buildQueryCleanupPreviewFilters, type QueryCleanupPreviewFilter } from './queryCleanupPreview';
import type { RealtimeQueryFilters } from './realtimeQueryFilterTypes';

export interface QueryCleanupState {
  rawQuery: string;
  normalized: NormalizedRealtimePresetQuery;
  effectiveFilters: RealtimeQueryFilters;
  cleanedQuery: string;
  comparisonBaseQuery: string;
  needsCleanup: boolean;
  strippedTimeRange: boolean;
  extractedFilters: boolean;
  previewFilters: QueryCleanupPreviewFilter[];
  filterCount: number;
}

export function buildQueryCleanupFallbackFilters(params: {
  levelFilter?: string;
  sourceFilter?: string;
}): RealtimeQueryFilters {
  const filters: RealtimeQueryFilters = {};
  const levelFilter = params.levelFilter?.trim() ?? '';
  const sourceFilter = params.sourceFilter?.trim() ?? '';

  if (levelFilter) {
    filters.level = levelFilter;
  }

  if (sourceFilter) {
    filters.service = sourceFilter;
  }

  return filters;
}

export function buildQueryCleanupState(params: {
  rawQuery: string;
  fallbackFilters?: RealtimeQueryFilters;
}): QueryCleanupState {
  const rawQuery = params.rawQuery.trim();
  const fallbackFilters = params.fallbackFilters ?? {};
  const normalized = normalizeRealtimePresetQuery(rawQuery);
  const effectiveFilters = normalized.extractedFilters ? normalized.filters : fallbackFilters;
  const cleanedQuery = buildRealtimePresetQuery({
    queryText: normalized.queryText,
    filters: effectiveFilters,
  });
  const comparisonBaseQuery = normalized.extractedFilters
    ? rawQuery
    : buildRealtimePresetQuery({
      queryText: rawQuery,
      filters: fallbackFilters,
    });
  const previewFilters = buildQueryCleanupPreviewFilters(effectiveFilters);

  return {
    rawQuery,
    normalized,
    effectiveFilters,
    cleanedQuery,
    comparisonBaseQuery,
    needsCleanup: cleanedQuery !== comparisonBaseQuery,
    strippedTimeRange: normalized.strippedTimeRange,
    extractedFilters: normalized.extractedFilters,
    previewFilters,
    filterCount: previewFilters.length,
  };
}

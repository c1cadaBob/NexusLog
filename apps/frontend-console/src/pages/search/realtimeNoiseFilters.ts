export const REALTIME_NOISE_FILTER_KEY = 'exclude_internal_noise';

interface BuildRealtimeQueryFiltersParams {
  levelFilter?: string;
  sourceFilter?: string;
  queryText?: string;
  extraFilters?: Record<string, unknown>;
}

function normalizeRealtimeExtraFilters(extraFilters?: Record<string, unknown>): Record<string, unknown> {
  return Object.entries(extraFilters ?? {}).reduce<Record<string, unknown>>((result, [key, value]) => {
    if (value == null) {
      return result;
    }
    if (typeof value === 'string' && value.trim() === '') {
      return result;
    }
    if (Array.isArray(value) && value.length === 0) {
      return result;
    }
    if (!key.trim()) {
      return result;
    }
    result[key] = value;
    return result;
  }, {});
}

export function shouldApplyRealtimeNoiseFilter(params: BuildRealtimeQueryFiltersParams): boolean {
  const queryText = params.queryText?.trim() ?? '';
  const sourceFilter = params.sourceFilter?.trim() ?? '';
  const extraFilters = normalizeRealtimeExtraFilters(params.extraFilters);
  return queryText === '' && sourceFilter === '' && Object.keys(extraFilters).length === 0;
}

export function shouldRelaxRealtimeHistogramNoiseFilter(params: BuildRealtimeQueryFiltersParams): boolean {
  const queryText = params.queryText?.trim() ?? '';
  return queryText === '' && shouldApplyRealtimeNoiseFilter(params);
}

export function buildRealtimeQueryFilters(params: BuildRealtimeQueryFiltersParams): Record<string, unknown> {
  const filters: Record<string, unknown> = {
    ...normalizeRealtimeExtraFilters(params.extraFilters),
    level: params.levelFilter?.trim() || undefined,
    service: params.sourceFilter?.trim() || undefined,
  };

  if (shouldApplyRealtimeNoiseFilter(params)) {
    filters[REALTIME_NOISE_FILTER_KEY] = true;
  }

  return filters;
}

export function buildRealtimeHistogramFilters(params: BuildRealtimeQueryFiltersParams): Record<string, unknown> {
  const filters = buildRealtimeQueryFilters(params);
  if (!shouldRelaxRealtimeHistogramNoiseFilter(params)) {
    return filters;
  }

  const { [REALTIME_NOISE_FILTER_KEY]: _ignored, ...histogramFilters } = filters;
  return histogramFilters;
}

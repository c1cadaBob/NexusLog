export const REALTIME_NOISE_FILTER_KEY = 'exclude_internal_noise';

interface BuildRealtimeQueryFiltersParams {
  levelFilter?: string;
  sourceFilter?: string;
  queryText?: string;
}

export function shouldApplyRealtimeNoiseFilter(params: BuildRealtimeQueryFiltersParams): boolean {
  const queryText = params.queryText?.trim() ?? '';
  const sourceFilter = params.sourceFilter?.trim() ?? '';
  return queryText === '' && sourceFilter === '';
}

export function buildRealtimeQueryFilters(params: BuildRealtimeQueryFiltersParams): Record<string, unknown> {
  const filters: Record<string, unknown> = {
    level: params.levelFilter?.trim() || undefined,
    service: params.sourceFilter?.trim() || undefined,
  };

  if (shouldApplyRealtimeNoiseFilter(params)) {
    filters[REALTIME_NOISE_FILTER_KEY] = true;
  }

  return filters;
}

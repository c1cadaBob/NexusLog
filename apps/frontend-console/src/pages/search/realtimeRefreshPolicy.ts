export const LIVE_HISTOGRAM_REFRESH_INTERVAL_MS = 15_000;

export type RealtimeHistogramRefreshMode = 'auto' | 'force' | 'skip';

interface BuildRealtimeHistogramRefreshKeyParams {
  queryText?: string;
  levelFilter?: string;
  sourceFilter?: string;
  extraFiltersKey?: string;
}

interface ShouldRefreshRealtimeHistogramParams {
  mode?: RealtimeHistogramRefreshMode;
  nextRequestKey: string;
  lastRequestKey: string;
  lastFetchedAt: number;
  now?: number;
  hasHistogramData: boolean;
}

export function buildRealtimeHistogramRefreshKey(params: BuildRealtimeHistogramRefreshKeyParams): string {
  return [
    params.queryText?.trim() ?? '',
    params.levelFilter?.trim() ?? '',
    params.sourceFilter?.trim() ?? '',
    params.extraFiltersKey?.trim() ?? '',
  ].join('\u0000');
}

export function shouldRefreshRealtimeHistogram(params: ShouldRefreshRealtimeHistogramParams): boolean {
  if (!params.hasHistogramData) {
    return true;
  }

  if (params.nextRequestKey !== params.lastRequestKey) {
    return true;
  }

  if (params.mode === 'force') {
    return true;
  }

  if (params.mode === 'skip') {
    return false;
  }

  const now = Number.isFinite(params.now) ? Number(params.now) : Date.now();
  return now - params.lastFetchedAt >= LIVE_HISTOGRAM_REFRESH_INTERVAL_MS;
}

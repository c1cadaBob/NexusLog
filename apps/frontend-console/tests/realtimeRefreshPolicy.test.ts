import { describe, expect, it } from 'vitest';

import {
  buildRealtimeHistogramRefreshKey,
  LIVE_HISTOGRAM_REFRESH_INTERVAL_MS,
  shouldRefreshRealtimeHistogram,
} from '../src/pages/search/realtimeRefreshPolicy';

describe('realtime refresh policy', () => {
  it('builds a stable key from query and filters', () => {
    expect(buildRealtimeHistogramRefreshKey({
      queryText: ' level:error ',
      levelFilter: 'error',
      sourceFilter: 'api',
    })).toBe('level:error\u0000error\u0000api');
  });

  it('always refreshes when histogram data is empty', () => {
    expect(shouldRefreshRealtimeHistogram({
      mode: 'skip',
      nextRequestKey: 'same',
      lastRequestKey: 'same',
      lastFetchedAt: Date.now(),
      hasHistogramData: false,
    })).toBe(true);
  });

  it('refreshes immediately when query conditions changed', () => {
    expect(shouldRefreshRealtimeHistogram({
      mode: 'skip',
      nextRequestKey: 'next',
      lastRequestKey: 'prev',
      lastFetchedAt: Date.now(),
      hasHistogramData: true,
    })).toBe(true);
  });

  it('skips refresh for table-only updates', () => {
    expect(shouldRefreshRealtimeHistogram({
      mode: 'skip',
      nextRequestKey: 'same',
      lastRequestKey: 'same',
      lastFetchedAt: Date.now(),
      hasHistogramData: true,
    })).toBe(false);
  });

  it('refreshes on cadence during live polling', () => {
    const now = Date.now();
    expect(shouldRefreshRealtimeHistogram({
      mode: 'auto',
      nextRequestKey: 'same',
      lastRequestKey: 'same',
      lastFetchedAt: now - LIVE_HISTOGRAM_REFRESH_INTERVAL_MS + 500,
      now,
      hasHistogramData: true,
    })).toBe(false);

    expect(shouldRefreshRealtimeHistogram({
      mode: 'auto',
      nextRequestKey: 'same',
      lastRequestKey: 'same',
      lastFetchedAt: now - LIVE_HISTOGRAM_REFRESH_INTERVAL_MS,
      now,
      hasHistogramData: true,
    })).toBe(true);
  });
});

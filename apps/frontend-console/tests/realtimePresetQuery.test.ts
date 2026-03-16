import { describe, expect, it } from 'vitest';
import { buildRealtimePresetQuery, normalizeRealtimePresetQuery } from '../src/pages/search/realtimePresetQuery';

describe('normalizeRealtimePresetQuery', () => {
  it('strips trailing time ranges from history-style queries', () => {
    expect(
      normalizeRealtimePresetQuery('service:vault time:[2026-03-16T05:10:26.361Z,2026-03-16T05:25:26.361Z]'),
    ).toMatchObject({
      queryText: 'service:vault',
      filters: {},
      levelFilter: '',
      sourceFilter: '',
      strippedTimeRange: true,
      extractedFilters: false,
    });
  });

  it('extracts trailing filters into realtime filter fields', () => {
    expect(
      normalizeRealtimePresetQuery('error filters:{"level":"error","service":"vault"} time:[2026-03-16T05:10:26.361Z,2026-03-16T05:25:26.361Z]'),
    ).toMatchObject({
      queryText: 'error',
      filters: { level: 'error', service: 'vault' },
      levelFilter: 'error',
      sourceFilter: 'vault',
      strippedTimeRange: true,
      extractedFilters: true,
    });
  });

  it('keeps plain queries unchanged', () => {
    expect(normalizeRealtimePresetQuery('service:vault')).toMatchObject({
      queryText: 'service:vault',
      filters: {},
      levelFilter: '',
      sourceFilter: '',
      strippedTimeRange: false,
      extractedFilters: false,
    });
  });

  it('rebuilds a normalized preset query without time range', () => {
    const normalized = normalizeRealtimePresetQuery('error filters:{"service":"vault","level":"error"} time:[2026-03-16T05:10:26.361Z,2026-03-16T05:25:26.361Z]');

    expect(buildRealtimePresetQuery({
      queryText: normalized.queryText,
      filters: normalized.filters,
    })).toBe('error filters:{"level":"error","service":"vault"}');
  });
});

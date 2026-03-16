import { describe, expect, it } from 'vitest';
import { normalizeRealtimePresetQuery } from '../src/pages/search/realtimePresetQuery';

describe('normalizeRealtimePresetQuery', () => {
  it('strips trailing time ranges from history-style queries', () => {
    expect(
      normalizeRealtimePresetQuery('service:vault time:[2026-03-16T05:10:26.361Z,2026-03-16T05:25:26.361Z]'),
    ).toMatchObject({
      queryText: 'service:vault',
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
      levelFilter: 'error',
      sourceFilter: 'vault',
      strippedTimeRange: true,
      extractedFilters: true,
    });
  });

  it('keeps plain queries unchanged', () => {
    expect(normalizeRealtimePresetQuery('service:vault')).toMatchObject({
      queryText: 'service:vault',
      levelFilter: '',
      sourceFilter: '',
      strippedTimeRange: false,
      extractedFilters: false,
    });
  });
});

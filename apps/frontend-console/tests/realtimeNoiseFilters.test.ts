import { describe, expect, it } from 'vitest';
import {
  REALTIME_NOISE_FILTER_KEY,
  buildRealtimeQueryFilters,
  shouldApplyRealtimeNoiseFilter,
} from '../src/pages/search/realtimeNoiseFilters';

describe('realtime noise filters', () => {
  it('enables internal-noise exclusion for the default realtime view', () => {
    expect(shouldApplyRealtimeNoiseFilter({ queryText: '', sourceFilter: '' })).toBe(true);
    expect(buildRealtimeQueryFilters({ queryText: '', sourceFilter: '', levelFilter: '' })).toMatchObject({
      [REALTIME_NOISE_FILTER_KEY]: true,
    });
  });

  it('keeps level filters while still excluding internal noise', () => {
    expect(buildRealtimeQueryFilters({ queryText: '   ', sourceFilter: '', levelFilter: 'error' })).toMatchObject({
      level: 'error',
      [REALTIME_NOISE_FILTER_KEY]: true,
    });
  });

  it('disables internal-noise exclusion when the user enters a query', () => {
    const filters = buildRealtimeQueryFilters({ queryText: 'service:query-api', sourceFilter: '', levelFilter: '' });
    expect(filters[REALTIME_NOISE_FILTER_KEY]).toBeUndefined();
  });

  it('disables internal-noise exclusion when a service/source filter is selected', () => {
    const filters = buildRealtimeQueryFilters({ queryText: '', sourceFilter: 'query-api', levelFilter: '' });
    expect(filters.service).toBe('query-api');
    expect(filters[REALTIME_NOISE_FILTER_KEY]).toBeUndefined();
  });
});

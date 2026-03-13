import { describe, expect, it } from 'vitest';
import { buildRealtimeHistogramData, sumRealtimeHistogramEvents } from '../src/pages/search/realtimeHistogram';

describe('buildRealtimeHistogramData', () => {
  it('builds stacked normal and error counts from backend buckets', () => {
    const points = buildRealtimeHistogramData(
      [
        { key: '2026-03-11T12:00:00.000Z', count: 10 },
        { key: '2026-03-11T12:01:00.000Z', count: 3 },
      ],
      [
        { key: '2026-03-11T12:00:00.000Z', count: 2 },
      ],
    );

    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ key: '2026-03-11T12:00', normal: 8, error: 2 });
    expect(points[1]).toMatchObject({ key: '2026-03-11T12:01', normal: 3, error: 0 });
    expect(points[0].time).toMatch(/\d{2}:\d{2}/);
    expect(points[1].time).toMatch(/\d{2}:\d{2}/);
  });

  it('clamps error buckets when backend returns a larger count than total', () => {
    const points = buildRealtimeHistogramData(
      [{ key: '2026-03-11T12:00:00.000Z', count: 1 }],
      [{ key: '2026-03-11T12:00:00.000Z', count: 5 }],
    );

    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ key: '2026-03-11T12:00', normal: 0, error: 1 });
    expect(points[0].time).toMatch(/\d{2}:\d{2}/);
    expect(sumRealtimeHistogramEvents(points)).toBe(1);
  });
});

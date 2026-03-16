import { describe, expect, it } from 'vitest';
import { buildQueryCleanupFallbackFilters, buildQueryCleanupState } from '../src/pages/search/queryCleanupState';

describe('query cleanup state', () => {
  it('builds cleanup state for legacy queries with extracted filters', () => {
    const cleanupState = buildQueryCleanupState({
      rawQuery: 'error filters:{"service":"vault","level":"error"} time:[2026-03-16T05:10:26.361Z,2026-03-16T05:25:26.361Z]',
    });

    expect(cleanupState.needsCleanup).toBe(true);
    expect(cleanupState.cleanedQuery).toBe('error filters:{"level":"error","service":"vault"}');
    expect(cleanupState.filterCount).toBe(2);
    expect(cleanupState.previewFilters).toEqual([
      { key: 'level', label: '级别', value: 'error' },
      { key: 'service', label: '来源/服务', value: 'vault' },
    ]);
  });

  it('uses fallback filters when realtime query has no embedded filters', () => {
    const fallbackFilters = buildQueryCleanupFallbackFilters({
      levelFilter: ' error ',
      sourceFilter: ' vault ',
    });
    const cleanupState = buildQueryCleanupState({
      rawQuery: 'error time:[2026-03-16T05:10:26.361Z,2026-03-16T05:25:26.361Z]',
      fallbackFilters,
    });

    expect(cleanupState.effectiveFilters).toEqual({
      level: 'error',
      service: 'vault',
    });
    expect(cleanupState.cleanedQuery).toBe('error filters:{"level":"error","service":"vault"}');
    expect(cleanupState.needsCleanup).toBe(true);
  });

  it('keeps clean realtime filter state as not needing cleanup', () => {
    const fallbackFilters = buildQueryCleanupFallbackFilters({
      levelFilter: 'error',
      sourceFilter: 'vault',
    });
    const cleanupState = buildQueryCleanupState({
      rawQuery: 'error',
      fallbackFilters,
    });

    expect(cleanupState.cleanedQuery).toBe('error filters:{"level":"error","service":"vault"}');
    expect(cleanupState.comparisonBaseQuery).toBe('error filters:{"level":"error","service":"vault"}');
    expect(cleanupState.needsCleanup).toBe(false);
  });
});

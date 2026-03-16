import { describe, expect, it } from 'vitest';
import {
  buildQueryCleanupPreviewFilters,
  formatQueryCleanupFilterLabel,
  formatQueryCleanupFilterValue,
} from '../src/pages/search/queryCleanupPreview';

describe('query cleanup preview helpers', () => {
  it('maps built-in filter labels to user-facing names', () => {
    expect(formatQueryCleanupFilterLabel('level')).toBe('级别');
    expect(formatQueryCleanupFilterLabel('service')).toBe('来源/服务');
    expect(formatQueryCleanupFilterLabel('source')).toBe('来源');
    expect(formatQueryCleanupFilterLabel('tenant')).toBe('tenant');
  });

  it('formats array and object filter values into readable strings', () => {
    expect(formatQueryCleanupFilterValue(['error', 'warn'])).toBe('error, warn');
    expect(formatQueryCleanupFilterValue({ region: 'cn-hz', zone: 'a' })).toBe('{"region":"cn-hz","zone":"a"}');
    expect(formatQueryCleanupFilterValue('vault')).toBe('vault');
  });

  it('builds preview filters in key order and removes empty values', () => {
    expect(
      buildQueryCleanupPreviewFilters({
        service: 'vault',
        emptyText: '',
        nullable: null,
        tags: [],
        level: 'error',
        zone: ['cn-hz-a', 'cn-hz-b'],
      }),
    ).toEqual([
      { key: 'level', label: '级别', value: 'error' },
      { key: 'service', label: '来源/服务', value: 'vault' },
      { key: 'zone', label: 'zone', value: 'cn-hz-a, cn-hz-b' },
    ]);
  });
});

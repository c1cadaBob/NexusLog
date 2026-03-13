import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearRealtimeRecentQueries,
  DEFAULT_RECENT_QUERIES,
  readRealtimeRecentQueries,
  recordRealtimeRecentQuery,
} from '../src/pages/search/realtimeRecentQueries';

const localStorageMock = (() => {
  const storage = new Map<string, string>();
  return {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
    key: (index: number) => Array.from(storage.keys())[index] ?? null,
    get length() {
      return storage.size;
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});
Object.defineProperty(globalThis, 'window', {
  value: { localStorage: localStorageMock },
  configurable: true,
});

describe('realtime recent queries', () => {
  beforeEach(() => {
    localStorageMock.clear();
    clearRealtimeRecentQueries();
  });

  it('falls back to default suggestions when storage is empty', () => {
    expect(readRealtimeRecentQueries()).toEqual([...DEFAULT_RECENT_QUERIES]);
  });

  it('records a new query at the front and deduplicates existing items', () => {
    const first = recordRealtimeRecentQuery('service:query-api');
    expect(first[0]).toBe('service:query-api');
    expect(first).toHaveLength(5);

    const second = recordRealtimeRecentQuery('status:500');
    expect(second[0]).toBe('status:500');
    expect(second.filter((item) => item === 'status:500')).toHaveLength(1);
    expect(second).toHaveLength(5);
  });

  it('ignores empty queries', () => {
    recordRealtimeRecentQuery('   ');
    expect(readRealtimeRecentQueries()).toEqual([...DEFAULT_RECENT_QUERIES]);
  });
});

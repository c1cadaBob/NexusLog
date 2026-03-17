/* @vitest-environment jsdom */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from 'antd';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RealtimeSearch, {
  buildRealtimeTableTimeRange,
  ensureRealtimePageCursor,
  shouldBlockRealtimeDirectPageJump,
  shouldResolveRealtimeDeepPageCursor,
  shouldSuppressNextLiveTickAfterInteractiveRefresh,
} from '../src/pages/search/RealtimeSearch';

const queryRealtimeLogsMock = vi.fn();
const fetchAggregateStatsMock = vi.fn();
const createSavedQueryMock = vi.fn();
const setPageSizeMock = vi.fn();

vi.mock('../src/api/query', () => ({
  queryRealtimeLogs: (...args: unknown[]) => queryRealtimeLogsMock(...args),
  fetchAggregateStats: (...args: unknown[]) => fetchAggregateStatsMock(...args),
  createSavedQuery: (...args: unknown[]) => createSavedQueryMock(...args),
}));

vi.mock('../src/stores/themeStore', () => ({
  useThemeStore: (selector: (state: { isDark: boolean }) => unknown) => selector({ isDark: false }),
}));

vi.mock('../src/stores/preferencesStore', () => ({
  usePreferencesStore: (
    selector: (state: { pageSizes: Record<string, number>; setPageSize: typeof setPageSizeMock }) => unknown,
  ) => selector({ pageSizes: { realtimeSearch: 20 }, setPageSize: setPageSizeMock }),
}));

vi.mock('../src/components/charts/ChartWrapper', () => ({
  default: ({ option }: { option?: { xAxis?: { data?: unknown[] }; series?: Array<{ data?: unknown[] }> } }) => {
    const bucketCount = Array.isArray(option?.xAxis?.data) ? option.xAxis.data.length : 0;
    const normalCount = Array.isArray(option?.series?.[0]?.data) ? option.series[0].data.length : 0;
    const errorCount = Array.isArray(option?.series?.[1]?.data) ? option.series[1].data.length : 0;
    return (
      <div data-testid="histogram-state">
        {`buckets:${bucketCount};normal:${normalCount};error:${errorCount}`}
      </div>
    );
  },
}));

vi.mock('../src/components/common/usePaginationQuickJumperAccessibility', () => ({
  usePaginationQuickJumperAccessibility: () => null,
}));

vi.mock('../src/pages/search/realtimeRecentQueries', () => ({
  readRealtimeRecentQueries: () => ['service:vault'],
  recordRealtimeRecentQuery: (value: string) => [value],
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createQueryResult(overrides: Record<string, unknown> = {}) {
  return {
    hits: [
      {
        id: 'log-1',
        timestamp: '2026-03-16T07:04:27.236Z',
        level: 'info',
        service: 'vault',
        host: 'dev-server-centos8',
        hostIp: '192.168.0.202',
        message: 'test message',
        rawLog: 'test message',
        fields: {},
      },
    ],
    total: 1,
    totalIsLowerBound: false,
    page: 1,
    pageSize: 20,
    hasNext: false,
    queryTimeMS: 12,
    timedOut: false,
    aggregations: {},
    pitId: 'pit-1',
    nextSearchAfter: ['cursor-1'],
    ...overrides,
  };
}

function installDomMocks() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });

  Object.defineProperty(window, 'getComputedStyle', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      getPropertyValue: () => '0px',
      overflow: 'auto',
      overflowX: 'auto',
      overflowY: 'auto',
    })),
  });

  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    writable: true,
    value: vi.fn(),
  });
}

describe('RealtimeSearch regressions', () => {
  beforeEach(() => {
    queryRealtimeLogsMock.mockReset();
    fetchAggregateStatsMock.mockReset();
    createSavedQueryMock.mockReset();
    setPageSizeMock.mockReset();
    installDomMocks();

    queryRealtimeLogsMock.mockResolvedValue(createQueryResult());
    fetchAggregateStatsMock.mockResolvedValue({
      buckets: [{ key: new Date().toISOString(), count: 1 }],
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('uses the selected live window for manual search without explicit historical range', async () => {
    render(
      <App>
        <MemoryRouter initialEntries={['/search/realtime']}>
          <Routes>
            <Route path="/search/realtime" element={<RealtimeSearch />} />
          </Routes>
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByPlaceholderText('输入查询语句，例如: level:error AND service:"payment-service"'), {
      target: { value: 'service:vault' },
    });

    const searchButton = document.querySelector('.ant-input-search-button');
    expect(searchButton).toBeTruthy();
    fireEvent.click(searchButton as Element);

    await waitFor(() => {
      expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(2);
    });

    expect(queryRealtimeLogsMock.mock.calls[1]?.[0]).toEqual(expect.objectContaining({
      keywords: 'service:vault',
      timeRange: expect.objectContaining({
        from: expect.any(String),
        to: expect.any(String),
      }),
    }));
    expect(queryRealtimeLogsMock.mock.calls[1]?.[0]?.timeRange?.from).not.toBe('');
  });

  it('keeps histogram refresh working when the error-only aggregate request fails', async () => {
    fetchAggregateStatsMock
      .mockResolvedValueOnce({
        buckets: [{ key: new Date().toISOString(), count: 3 }],
      })
      .mockRejectedValueOnce(new Error('aggregate error only request failed'));

    render(
      <App>
        <MemoryRouter initialEntries={['/search/realtime']}>
          <Routes>
            <Route path="/search/realtime" element={<RealtimeSearch />} />
          </Routes>
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(fetchAggregateStatsMock).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('histogram-state').textContent).toBe('buckets:1;normal:1;error:1');
    });
  });

  it('drops internal-noise exclusion only for empty-query histogram requests', async () => {
    render(
      <App>
        <MemoryRouter initialEntries={['/search/realtime']}>
          <Routes>
            <Route path="/search/realtime" element={<RealtimeSearch />} />
          </Routes>
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(1);
      expect(fetchAggregateStatsMock).toHaveBeenCalledTimes(2);
    });

    expect(queryRealtimeLogsMock.mock.calls[0]?.[0]?.filters).toMatchObject({
      exclude_internal_noise: true,
    });
    expect(fetchAggregateStatsMock.mock.calls[0]?.[0]?.filters?.exclude_internal_noise).toBeUndefined();
    expect(fetchAggregateStatsMock.mock.calls[1]?.[0]?.filters?.exclude_internal_noise).toBeUndefined();
    expect(fetchAggregateStatsMock.mock.calls[1]?.[0]?.filters).toMatchObject({
      level: 'error',
    });
  });

  it('builds deep-page cursors by bridging from the max offset window', async () => {
    const queryLogs = vi.fn()
      .mockResolvedValueOnce(createQueryResult({
        hits: [],
        total: 20000,
        page: 100,
        pageSize: 100,
        pitId: 'pit-bridge',
        nextSearchAfter: ['cursor-100'],
      }))
      .mockResolvedValueOnce(createQueryResult({
        hits: [],
        total: 20000,
        page: 101,
        pageSize: 100,
        pitId: 'pit-bridge',
        nextSearchAfter: ['cursor-101'],
      }));

    const result = await ensureRealtimePageCursor({
      targetPage: 102,
      pageSize: 100,
      queryText: '',
      filters: {},
      timeRange: { from: '', to: '2026-03-16T08:00:00.000Z' },
      cursorMap: new Map([[1, { pitId: 'pit-root' }]]),
      queryLogs,
    });

    expect(queryLogs).toHaveBeenCalledTimes(2);
    expect(queryLogs.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      page: 100,
      pageSize: 100,
      pitId: 'pit-root',
    }));
    expect(queryLogs.mock.calls[0]?.[0]).not.toHaveProperty('searchAfter');
    expect(queryLogs.mock.calls[1]?.[0]).toEqual(expect.objectContaining({
      page: 101,
      pageSize: 100,
      pitId: 'pit-bridge',
      searchAfter: ['cursor-100'],
    }));
    expect(result.cursor).toEqual({ pitId: 'pit-bridge', searchAfter: ['cursor-101'] });
    expect(result.cursorMap.get(102)).toEqual({ pitId: 'pit-bridge', searchAfter: ['cursor-101'] });
  });

  it('detects when a deep page still needs sequential cursor resolution', () => {
    expect(shouldResolveRealtimeDeepPageCursor(101, 100, { pitId: 'pit-root' })).toBe(true);
    expect(shouldResolveRealtimeDeepPageCursor(101, 100, { pitId: 'pit-root', searchAfter: ['cursor-100'] })).toBe(false);
    expect(shouldResolveRealtimeDeepPageCursor(100, 100, undefined)).toBe(false);
  });

  it('allows direct jumps up to the last page inside the max offset window', () => {
    expect(shouldBlockRealtimeDirectPageJump(100, 100, true, undefined)).toBe(false);
    expect(shouldBlockRealtimeDirectPageJump(500, 20, true, undefined)).toBe(false);
    expect(shouldBlockRealtimeDirectPageJump(101, 100, true, undefined)).toBe(true);
    expect(shouldBlockRealtimeDirectPageJump(101, 100, true, { pitId: 'pit-root' })).toBe(false);
  });

  it('keeps the quick jumper visible for large result sets', async () => {
    queryRealtimeLogsMock.mockResolvedValueOnce(createQueryResult({
      total: 20000,
      page: 1,
      pageSize: 20,
    }));

    render(
      <App>
        <MemoryRouter initialEntries={['/search/realtime']}>
          <Routes>
            <Route path="/search/realtime" element={<RealtimeSearch />} />
          </Routes>
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(document.querySelector('.ant-pagination-options-quick-jumper input')).toBeTruthy();
    });
  });

  it('updates the active page immediately while pagination requests are loading', async () => {
    const deferred = createDeferred<ReturnType<typeof createQueryResult>>();
    queryRealtimeLogsMock
      .mockResolvedValueOnce(createQueryResult({
        total: 200,
        page: 1,
        pageSize: 20,
      }))
      .mockReturnValueOnce(deferred.promise);

    render(
      <App>
        <MemoryRouter initialEntries={['/search/realtime']}>
          <Routes>
            <Route path="/search/realtime" element={<RealtimeSearch />} />
          </Routes>
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(1);
    });

    const pageTwo = Array.from(document.querySelectorAll('.ant-pagination-item'))
      .find((element) => element.textContent?.trim() === '2');
    expect(pageTwo).toBeTruthy();
    fireEvent.click(pageTwo as Element);

    await waitFor(() => {
      expect(document.querySelector('.ant-pagination-item-active')?.textContent?.trim()).toBe('2');
      expect(document.querySelector('.ant-spin-spinning')).toBeTruthy();
    });

    deferred.resolve(createQueryResult({
      total: 200,
      page: 2,
      pageSize: 20,
      hits: [
        {
          id: 'log-2',
          timestamp: '2026-03-16T07:05:27.236Z',
          level: 'warn',
          service: 'vault',
          host: 'dev-server-centos8',
          hostIp: '192.168.0.202',
          message: 'page two result',
          rawLog: 'page two result',
          fields: {},
        },
      ],
    }));

    await waitFor(() => {
      expect(screen.getByText('page two result')).toBeTruthy();
      expect(document.querySelector('.ant-pagination-item-active')?.textContent?.trim()).toBe('2');
    });
  });

  it('reverts the active page when a pagination request fails', async () => {
    const deferred = createDeferred<ReturnType<typeof createQueryResult>>();
    queryRealtimeLogsMock
      .mockResolvedValueOnce(createQueryResult({
        total: 200,
        page: 1,
        pageSize: 20,
      }))
      .mockReturnValueOnce(deferred.promise);

    render(
      <App>
        <MemoryRouter initialEntries={['/search/realtime']}>
          <Routes>
            <Route path="/search/realtime" element={<RealtimeSearch />} />
          </Routes>
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(1);
    });

    const pageTwo = Array.from(document.querySelectorAll('.ant-pagination-item'))
      .find((element) => element.textContent?.trim() === '2');
    expect(pageTwo).toBeTruthy();
    fireEvent.click(pageTwo as Element);

    await waitFor(() => {
      expect(document.querySelector('.ant-pagination-item-active')?.textContent?.trim()).toBe('2');
    });

    deferred.reject(new Error('page change failed'));

    await waitFor(() => {
      expect(document.querySelector('.ant-pagination-item-active')?.textContent?.trim()).toBe('1');
    });
  });

  it('suppresses the next live auto-refresh after a manual execute', async () => {
    vi.useFakeTimers();

    render(
      <App>
        <MemoryRouter initialEntries={['/search/realtime']}>
          <Routes>
            <Route path="/search/realtime" element={<RealtimeSearch />} />
          </Routes>
        </MemoryRouter>
      </App>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByPlaceholderText('输入查询语句，例如: level:error AND service:"payment-service"'), {
      target: { value: 'service:api-service' },
    });

    const searchButton = document.querySelector('.ant-input-search-button');
    expect(searchButton).toBeTruthy();
    fireEvent.click(searchButton as Element);

    await act(async () => {
      await Promise.resolve();
    });

    expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_100);
    });

    expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(3);
  });

  it('suppresses interactive refreshes only for active bounded live mode', () => {
    expect(shouldSuppressNextLiveTickAfterInteractiveRefresh({
      isLive: true,
      liveWindow: '15m',
      explicitTimeRange: null,
    })).toBe(true);
    expect(shouldSuppressNextLiveTickAfterInteractiveRefresh({
      isLive: true,
      liveWindow: '5m',
      explicitTimeRange: null,
    })).toBe(true);
    expect(shouldSuppressNextLiveTickAfterInteractiveRefresh({
      isLive: false,
      liveWindow: '15m',
      explicitTimeRange: null,
    })).toBe(false);
    expect(shouldSuppressNextLiveTickAfterInteractiveRefresh({
      isLive: true,
      liveWindow: 'all',
      explicitTimeRange: null,
    })).toBe(false);
    expect(shouldSuppressNextLiveTickAfterInteractiveRefresh({
      isLive: true,
      liveWindow: 'custom',
      explicitTimeRange: { from: '2026-03-16T08:00:00.000Z' },
    })).toBe(false);
  });

  it('returns an unbounded from-range only for the all-time mode', () => {
    const result = buildRealtimeTableTimeRange('all', '2026-03-16T08:00:00.000Z', null);

    expect(result).toEqual({
      from: '',
      to: '2026-03-16T08:00:00.000Z',
    });
  });
});

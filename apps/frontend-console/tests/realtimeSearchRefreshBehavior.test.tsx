/* @vitest-environment jsdom */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from 'antd';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import RealtimeSearch from '../src/pages/search/RealtimeSearch';

const queryRealtimeLogsMock = vi.fn();
const fetchAggregateStatsMock = vi.fn();
const setPageSizeMock = vi.fn();
const chartWrapperPropsMock = vi.fn();

vi.mock('../src/api/query', () => ({
  queryRealtimeLogs: (...args: unknown[]) => queryRealtimeLogsMock(...args),
  fetchAggregateStats: (...args: unknown[]) => fetchAggregateStatsMock(...args),
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
  default: (props: unknown) => {
    chartWrapperPropsMock(props);
    const title = typeof props === 'object' && props && 'title' in props ? String((props as { title?: string }).title ?? 'chart') : 'chart';
    return <div>{title}</div>;
  },
}));

vi.mock('../src/components/common/usePaginationQuickJumperAccessibility', () => ({
  usePaginationQuickJumperAccessibility: () => null,
}));

vi.mock('../src/pages/search/realtimeRecentQueries', () => ({
  readRealtimeRecentQueries: () => ['service:vault'],
  recordRealtimeRecentQuery: (value: string) => [value],
}));

function buildHits(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `log-${index + 1}`,
    timestamp: new Date(Date.UTC(2026, 2, 16, 12, 0, 0) - index * 1000).toISOString(),
    level: 'info',
    service: 'vault',
    host: 'dev-server-centos8',
    hostIp: '192.168.0.202',
    message: `message ${index + 1}`,
    rawLog: `message ${index + 1}`,
    fields: {},
  }));
}

describe('RealtimeSearch refresh behavior', () => {
  beforeEach(() => {
    queryRealtimeLogsMock.mockReset();
    fetchAggregateStatsMock.mockReset();
    setPageSizeMock.mockReset();
    chartWrapperPropsMock.mockReset();

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
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('prefetches 200 logs on blank startup refresh without a lower time bound', async () => {
    queryRealtimeLogsMock.mockResolvedValue({
      hits: buildHits(200),
      total: 500,
      totalIsLowerBound: false,
      page: 1,
      pageSize: 200,
      hasNext: true,
      queryTimeMS: 12,
      timedOut: false,
      aggregations: {},
      nextSearchAfter: ['cursor-200'],
    });
    fetchAggregateStatsMock.mockResolvedValue({
      buckets: [{ key: '2026-03-16T12:00:00.000Z', count: 200 }],
    });

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

    expect(queryRealtimeLogsMock).toHaveBeenCalledWith(expect.objectContaining({
      keywords: '',
      page: 1,
      pageSize: 200,
      timeRange: expect.objectContaining({ from: '' }),
    }));
  });

  it('keeps histogram renderable when the error histogram request fails', async () => {
    queryRealtimeLogsMock.mockResolvedValue({
      hits: buildHits(200),
      total: 200,
      totalIsLowerBound: false,
      page: 1,
      pageSize: 200,
      hasNext: false,
      queryTimeMS: 12,
      timedOut: false,
      aggregations: {},
      nextSearchAfter: undefined,
    });
    const currentBucketKey = new Date().toISOString();
    fetchAggregateStatsMock
      .mockResolvedValueOnce({
        buckets: [{ key: currentBucketKey, count: 3 }],
      })
      .mockRejectedValueOnce(new Error('error histogram failed'));

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

    await waitFor(() => {
      const histogramCall = [...chartWrapperPropsMock.mock.calls]
        .map((call) => call[0] as { title?: string; subtitle?: string; option?: { xAxis?: { data?: unknown[] } } })
        .reverse()
        .find((props) => props.title === '事件量分布');
      expect(histogramCall?.subtitle).toBeUndefined();
      expect(histogramCall?.option?.xAxis?.data).toHaveLength(1);
    });
  });

  it('switches to page 2 from the prefetched window without another logs request', async () => {
    queryRealtimeLogsMock.mockResolvedValue({
      hits: buildHits(200),
      total: 500,
      totalIsLowerBound: false,
      page: 1,
      pageSize: 200,
      hasNext: true,
      queryTimeMS: 12,
      timedOut: false,
      aggregations: {},
      nextSearchAfter: ['cursor-200'],
    });
    fetchAggregateStatsMock.mockResolvedValue({
      buckets: [{ key: '2026-03-16T12:00:00.000Z', count: 200 }],
    });

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

    const secondPageButton = document.querySelector('.ant-pagination-item-2');
    expect(secondPageButton).toBeTruthy();
    fireEvent.click(secondPageButton as Element);

    await waitFor(() => {
      expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText('message 21')).toBeTruthy();
    });
  });
});

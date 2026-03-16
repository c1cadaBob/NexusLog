/* @vitest-environment jsdom */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from 'antd';
import { render, waitFor, cleanup, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import RealtimeSearch from '../src/pages/search/RealtimeSearch';
import {
  clearPendingRealtimeStartupQuery,
  persistPendingRealtimeStartupQuery,
} from '../src/pages/search/realtimeStartupQuery';

const queryRealtimeLogsMock = vi.fn();
const fetchAggregateStatsMock = vi.fn();
const setPageSizeMock = vi.fn();

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
  default: ({ title }: { title?: string }) => <div>{title ?? 'chart'}</div>,
}));

vi.mock('../src/components/common/usePaginationQuickJumperAccessibility', () => ({
  usePaginationQuickJumperAccessibility: () => null,
}));

vi.mock('../src/pages/search/realtimeRecentQueries', () => ({
  readRealtimeRecentQueries: () => ['service:vault'],
  recordRealtimeRecentQuery: (value: string) => [value],
}));

const NavigateToPresetQuery: React.FC = () => {
  const navigate = useNavigate();

  React.useEffect(() => {
    navigate('/search/realtime?autoRun=1&presetQuery=service%3Avault', {
      replace: true,
      state: { autoRun: true, presetQuery: 'service:vault' },
    });
  }, [navigate]);

  return <div>redirecting</div>;
};

describe('RealtimeSearch startup query behavior', () => {
  beforeEach(() => {
    clearPendingRealtimeStartupQuery();
    queryRealtimeLogsMock.mockReset();
    fetchAggregateStatsMock.mockReset();
    setPageSizeMock.mockReset();

    queryRealtimeLogsMock.mockResolvedValue({
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
    });

    fetchAggregateStatsMock.mockResolvedValue({
      buckets: [{ key: '2026-03-16T07:04:00.000Z', count: 1 }],
    });

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
    clearPendingRealtimeStartupQuery();
    cleanup();
    vi.clearAllMocks();
  });

  it('issues only one startup query batch under StrictMode', async () => {
    render(
      <React.StrictMode>
        <App>
          <MemoryRouter initialEntries={['/search/realtime']}>
            <Routes>
              <Route path="/search/realtime" element={<RealtimeSearch />} />
            </Routes>
          </MemoryRouter>
        </App>
      </React.StrictMode>,
    );

    await waitFor(() => {
      expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(1);
      expect(fetchAggregateStatsMock).toHaveBeenCalledTimes(2);
    });

    await new Promise((resolve) => window.setTimeout(resolve, 260));

    expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(1);
    expect(fetchAggregateStatsMock).toHaveBeenCalledTimes(2);
    expect(queryRealtimeLogsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        keywords: '',
        page: 1,
        pageSize: 200,
        timeRange: expect.objectContaining({ from: '' }),
      }),
    );
  });

  it('skips blank startup query when preset autoRun query exists', async () => {
    render(
      <App>
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/search/realtime',
              search: '?autoRun=1&presetQuery=service%3Avault',
              state: { autoRun: true, presetQuery: 'service:vault' },
            },
          ]}
        >
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

    await new Promise((resolve) => window.setTimeout(resolve, 260));

    expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(1);
    expect(fetchAggregateStatsMock).toHaveBeenCalledTimes(2);
    expect(queryRealtimeLogsMock).toHaveBeenCalledWith(
      expect.objectContaining({ keywords: 'service:vault', page: 1, pageSize: 20 }),
    );
  });

  it('skips blank startup query during in-app autoRun navigation', async () => {
    render(
      <React.StrictMode>
        <App>
          <MemoryRouter initialEntries={['/start']}>
            <Routes>
              <Route path="/start" element={<NavigateToPresetQuery />} />
              <Route path="/search/realtime" element={<RealtimeSearch />} />
            </Routes>
          </MemoryRouter>
        </App>
      </React.StrictMode>,
    );

    await waitFor(() => {
      expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(1);
      expect(fetchAggregateStatsMock).toHaveBeenCalledTimes(2);
    });

    await new Promise((resolve) => window.setTimeout(resolve, 260));

    expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(1);
    expect(fetchAggregateStatsMock).toHaveBeenCalledTimes(2);
    expect(queryRealtimeLogsMock).toHaveBeenCalledWith(
      expect.objectContaining({ keywords: 'service:vault', page: 1, pageSize: 20 }),
    );
  });

  it('uses pending startup query fallback without issuing a blank query', async () => {
    persistPendingRealtimeStartupQuery('service:vault');

    render(
      <React.StrictMode>
        <App>
          <MemoryRouter initialEntries={['/search/realtime']}>
            <Routes>
              <Route path="/search/realtime" element={<RealtimeSearch />} />
            </Routes>
          </MemoryRouter>
        </App>
      </React.StrictMode>,
    );

    await waitFor(() => {
      expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(1);
      expect(fetchAggregateStatsMock).toHaveBeenCalledTimes(2);
    });

    await new Promise((resolve) => window.setTimeout(resolve, 260));

    expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(1);
    expect(fetchAggregateStatsMock).toHaveBeenCalledTimes(2);
    expect(queryRealtimeLogsMock).toHaveBeenCalledWith(
      expect.objectContaining({ keywords: 'service:vault', page: 1, pageSize: 20 }),
    );
  });

  it('normalizes history-style startup queries before auto run', async () => {
    render(
      <App>
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/search/realtime',
              state: {
                autoRun: true,
                presetQuery: 'service:vault time:[2026-03-16T05:10:26.361Z,2026-03-16T05:25:26.361Z]',
              },
            },
          ]}
        >
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

    await new Promise((resolve) => window.setTimeout(resolve, 260));

    expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(1);
    expect(fetchAggregateStatsMock).toHaveBeenCalledTimes(2);
    expect(queryRealtimeLogsMock).toHaveBeenCalledWith(
      expect.objectContaining({ keywords: 'service:vault', page: 1, pageSize: 20 }),
    );
    expect(fetchAggregateStatsMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ keywords: 'service:vault' }),
    );
    expect((screen.getByPlaceholderText('输入查询语句，例如: level:error AND service:"payment-service"') as HTMLInputElement).value).toBe('service:vault');
  });

  it('normalizes manually executed history-style queries', async () => {
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

    queryRealtimeLogsMock.mockClear();
    fetchAggregateStatsMock.mockClear();

    const queryInput = screen.getByPlaceholderText('输入查询语句，例如: level:error AND service:"payment-service"');
    fireEvent.change(queryInput, {
      target: {
        value: 'service:vault time:[2026-03-16T05:10:26.361Z,2026-03-16T05:25:26.361Z]',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /执行/ }));

    await waitFor(() => {
      expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(1);
      expect(fetchAggregateStatsMock).toHaveBeenCalledTimes(2);
    });

    expect(queryRealtimeLogsMock).toHaveBeenCalledWith(
      expect.objectContaining({ keywords: 'service:vault', page: 1, pageSize: 20 }),
    );
    expect(fetchAggregateStatsMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ keywords: 'service:vault' }),
    );
    expect((queryInput as HTMLInputElement).value).toBe('service:vault');
  });
});

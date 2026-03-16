/* @vitest-environment jsdom */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from 'antd';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RealtimeSearch from '../src/pages/search/RealtimeSearch';

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
  default: ({ title }: { title?: string }) => <div>{title ?? 'chart'}</div>,
}));

vi.mock('../src/components/common/usePaginationQuickJumperAccessibility', () => ({
  usePaginationQuickJumperAccessibility: () => null,
}));

vi.mock('../src/pages/search/realtimeRecentQueries', () => ({
  readRealtimeRecentQueries: () => ['service:vault'],
  recordRealtimeRecentQuery: (value: string) => [value],
}));

describe('RealtimeSearch bookmark cleanup', () => {
  beforeEach(() => {
    queryRealtimeLogsMock.mockReset();
    fetchAggregateStatsMock.mockReset();
    createSavedQueryMock.mockReset();
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
    cleanup();
    vi.clearAllMocks();
  });

  it('shows cleanup confirmation before bookmarking a legacy realtime query', async () => {
    const legacyQuery = 'error filters:{"service":"vault","level":"error"} time:[2026-03-16T05:10:26.361Z,2026-03-16T05:25:26.361Z]';
    const cleanedQuery = 'error filters:{"level":"error","service":"vault"}';

    createSavedQueryMock.mockResolvedValue({
      id: 'saved-1',
      name: '实时查询 2026/3/16 13:25:26',
      query: cleanedQuery,
      tags: [],
      createdAt: '2026-03-16T05:25:26.361Z',
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

    fireEvent.change(screen.getByPlaceholderText('输入查询语句，例如: level:error AND service:"payment-service"'), {
      target: { value: legacyQuery },
    });
    fireEvent.click(screen.getByRole('button', { name: 'bookmark_add' }));

    await waitFor(() => {
      expect(screen.getAllByText('收藏前将清洗旧格式查询').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('将移除历史时间范围')).toBeTruthy();
    expect(screen.getByText('保留 2 个筛选条件')).toBeTruthy();
    expect(screen.getAllByText(legacyQuery).length).toBeGreaterThan(0);
    expect(screen.getByText(cleanedQuery)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '收藏并清洗' }));

    await waitFor(() => {
      expect(createSavedQueryMock).toHaveBeenCalledWith({
        name: expect.stringMatching(/^实时查询 /),
        query: cleanedQuery,
        tags: [],
      });
    });
  });

  it('bookmarks a clean realtime query directly', async () => {
    const cleanQuery = 'service:vault';

    createSavedQueryMock.mockResolvedValue({
      id: 'saved-2',
      name: '实时查询 2026/3/16 13:30:26',
      query: cleanQuery,
      tags: [],
      createdAt: '2026-03-16T05:30:26.361Z',
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

    fireEvent.change(screen.getByPlaceholderText('输入查询语句，例如: level:error AND service:"payment-service"'), {
      target: { value: cleanQuery },
    });
    fireEvent.click(screen.getByRole('button', { name: 'bookmark_add' }));

    await waitFor(() => {
      expect(createSavedQueryMock).toHaveBeenCalledWith({
        name: expect.stringMatching(/^实时查询 /),
        query: cleanQuery,
        tags: [],
      });
    });

    expect(screen.queryByText('收藏前将清洗旧格式查询')).toBeNull();
  });
});

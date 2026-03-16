/* @vitest-environment jsdom */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from 'antd';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SearchHistory from '../src/pages/search/SearchHistory';

const fetchQueryHistoryMock = vi.fn();
const createSavedQueryMock = vi.fn();
const deleteQueryHistoryMock = vi.fn();
const setPageSizeMock = vi.fn();

vi.mock('../src/api/query', () => ({
  fetchQueryHistory: (...args: unknown[]) => fetchQueryHistoryMock(...args),
  createSavedQuery: (...args: unknown[]) => createSavedQueryMock(...args),
  deleteQueryHistory: (...args: unknown[]) => deleteQueryHistoryMock(...args),
}));

vi.mock('../src/stores/preferencesStore', () => ({
  usePreferencesStore: (
    selector: (state: { pageSizes: Record<string, number>; setPageSize: typeof setPageSizeMock }) => unknown,
  ) => selector({ pageSizes: { searchHistory: 15 }, setPageSize: setPageSizeMock }),
}));

vi.mock('../src/components/common/usePaginationQuickJumperAccessibility', () => ({
  usePaginationQuickJumperAccessibility: () => null,
}));

vi.mock('../src/pages/search/realtimeStartupQuery', () => ({
  persistPendingRealtimeStartupQuery: vi.fn(),
}));

describe('SearchHistory bookmark cleanup', () => {
  beforeEach(() => {
    fetchQueryHistoryMock.mockReset();
    createSavedQueryMock.mockReset();
    deleteQueryHistoryMock.mockReset();
    setPageSizeMock.mockReset();

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

  it('shows cleanup confirmation before bookmarking a legacy history query', async () => {
    const legacyQuery = 'error filters:{"service":"vault","level":"error"} time:[2026-03-16T05:10:26.361Z,2026-03-16T05:25:26.361Z]';
    const cleanedQuery = 'error filters:{"level":"error","service":"vault"}';

    fetchQueryHistoryMock.mockResolvedValue({
      items: [
        {
          id: 'history-1',
          query: legacyQuery,
          executedAt: '2026-03-16T05:25:26.361Z',
          duration: 28,
          resultCount: 32,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 15,
      hasNext: false,
    });

    createSavedQueryMock.mockResolvedValue({
      id: 'saved-1',
      name: '历史查询 2026/3/16 13:25:26',
      query: cleanedQuery,
      tags: ['历史查询'],
      createdAt: '2026-03-16T05:25:26.361Z',
    });

    render(
      <App>
        <MemoryRouter>
          <SearchHistory />
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(fetchQueryHistoryMock).toHaveBeenCalledTimes(1);
    });

    const row = screen.getByText(legacyQuery).closest('tr');
    expect(row).toBeTruthy();

    const buttons = row?.querySelectorAll('button') ?? [];
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(buttons[1] as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getAllByText('收藏前将清洗旧格式查询').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('将移除历史时间范围')).toBeTruthy();
    expect(screen.getByText('保留 2 个筛选条件')).toBeTruthy();
    expect(screen.getByText('保留筛选')).toBeTruthy();
    expect(screen.getByText('级别: error')).toBeTruthy();
    expect(screen.getByText('来源/服务: vault')).toBeTruthy();
    expect(screen.getAllByText(legacyQuery).length).toBeGreaterThan(1);
    expect(screen.getByText(cleanedQuery)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '收藏并清洗' }));

    await waitFor(() => {
      expect(createSavedQueryMock).toHaveBeenCalledWith({
        name: expect.stringMatching(/^历史查询 /),
        query: cleanedQuery,
        tags: ['历史查询'],
      });
    });
  });

  it('bookmarks a clean history query without showing cleanup confirmation', async () => {
    const cleanQuery = 'service:vault';

    fetchQueryHistoryMock.mockResolvedValue({
      items: [
        {
          id: 'history-2',
          query: cleanQuery,
          executedAt: '2026-03-16T05:30:26.361Z',
          duration: 16,
          resultCount: 12,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 15,
      hasNext: false,
    });

    createSavedQueryMock.mockResolvedValue({
      id: 'saved-2',
      name: '历史查询 2026/3/16 13:30:26',
      query: cleanQuery,
      tags: ['历史查询'],
      createdAt: '2026-03-16T05:30:26.361Z',
    });

    render(
      <App>
        <MemoryRouter>
          <SearchHistory />
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(fetchQueryHistoryMock).toHaveBeenCalledTimes(1);
    });

    const row = screen.getByText(cleanQuery).closest('tr');
    expect(row).toBeTruthy();

    const buttons = row?.querySelectorAll('button') ?? [];
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(buttons[1] as HTMLButtonElement);

    await waitFor(() => {
      expect(createSavedQueryMock).toHaveBeenCalledWith({
        name: expect.stringMatching(/^历史查询 /),
        query: cleanQuery,
        tags: ['历史查询'],
      });
    });

    expect(screen.queryByText('收藏前将清洗旧格式查询')).toBeNull();
  });
});

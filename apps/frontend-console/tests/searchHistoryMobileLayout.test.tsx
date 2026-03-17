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

function mockBrowserApis() {
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

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

function buildHistoryItem(id: string, query: string, executedAt: string) {
  return {
    id,
    query,
    executedAt,
    duration: 12,
    resultCount: 3,
  };
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

describe('SearchHistory mobile layout', () => {
  beforeEach(() => {
    fetchQueryHistoryMock.mockReset();
    createSavedQueryMock.mockReset();
    deleteQueryHistoryMock.mockReset();
    setPageSizeMock.mockReset();
    mockBrowserApis();
    setViewport(390);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows a loading placeholder before the first history response resolves', async () => {
    const deferred = createDeferred<{
      items: Array<ReturnType<typeof buildHistoryItem>>;
      total: number;
      page: number;
      pageSize: number;
      hasNext: boolean;
    }>();

    fetchQueryHistoryMock.mockImplementation(() => deferred.promise);

    render(
      <App>
        <MemoryRouter>
          <SearchHistory />
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(screen.getByText('加载查询历史...')).toBeTruthy();
    });
    expect(screen.queryByText('暂无查询历史')).toBeNull();

    deferred.resolve({
      items: [],
      total: 0,
      page: 1,
      pageSize: 15,
      hasNext: false,
    });

    await waitFor(() => {
      expect(screen.getByText('暂无查询历史')).toBeTruthy();
    });
  });

  it('shows a loading placeholder again when a new empty history request is pending', async () => {
    const deferred = createDeferred<{
      items: Array<ReturnType<typeof buildHistoryItem>>;
      total: number;
      page: number;
      pageSize: number;
      hasNext: boolean;
    }>();

    fetchQueryHistoryMock
      .mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        pageSize: 15,
        hasNext: false,
      })
      .mockImplementationOnce(() => deferred.promise);

    render(
      <App>
        <MemoryRouter>
          <SearchHistory />
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(screen.getByText('暂无查询历史')).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText('搜索查询语句...'), {
      target: { value: 'vault' },
    });
    const searchButton = document.querySelector('.ant-input-search-button');
    expect(searchButton).toBeTruthy();
    fireEvent.click(searchButton as Element);

    await waitFor(() => {
      expect(screen.getByText('加载查询历史...')).toBeTruthy();
    });
    expect(screen.queryByText('没有匹配的查询历史')).toBeNull();

    deferred.resolve({
      items: [],
      total: 0,
      page: 1,
      pageSize: 15,
      hasNext: false,
    });

    await waitFor(() => {
      expect(screen.getByText('没有匹配的查询历史')).toBeTruthy();
    });
  });

  it('hides mobile pagination when history results are empty', async () => {
    fetchQueryHistoryMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 15,
      hasNext: false,
    });

    render(
      <App>
        <MemoryRouter>
          <SearchHistory />
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(screen.getByText('暂无查询历史')).toBeTruthy();
    });

    expect(document.querySelector('.ant-pagination')).toBeNull();
  });

  it('renders history entries as cards on mobile and keeps selection actions usable', async () => {
    fetchQueryHistoryMock.mockResolvedValue({
      items: [
        buildHistoryItem('history-mobile-1', 'mobile-query-1', '2026-03-17T09:58:00.000Z'),
        buildHistoryItem('history-mobile-2', 'mobile-query-2', '2026-03-17T09:57:00.000Z'),
      ],
      total: 2,
      page: 1,
      pageSize: 15,
      hasNext: false,
    });

    render(
      <App>
        <MemoryRouter>
          <SearchHistory />
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(screen.getByText('mobile-query-1')).toBeTruthy();
      expect(screen.getByText('mobile-query-2')).toBeTruthy();
    });

    expect(document.querySelector('.ant-table')).toBeNull();
    expect(screen.getByText('当前页全选')).toBeTruthy();

    const searchButton = document.querySelector('.ant-input-search-button') as HTMLButtonElement | null;
    const resetButton = screen.getByRole('button', { name: /重\s*置/ });
    const batchDeleteButton = screen.getByRole('button', { name: /批量删除/ });
    expect(searchButton?.className).toContain('ant-btn-lg');
    expect(resetButton.className).toContain('ant-btn-lg');
    expect(batchDeleteButton.className).toContain('ant-btn-lg');

    const replayButtons = screen.getAllByRole('button', { name: /重新执行/ });
    const bookmarkButtons = screen.getAllByRole('button', { name: /收藏/ });
    const deleteButtons = screen.getAllByRole('button', { name: /删除/ });

    expect(replayButtons).toHaveLength(2);
    expect(bookmarkButtons).toHaveLength(2);
    expect(deleteButtons.length).toBeGreaterThanOrEqual(2);
    expect(replayButtons[0].className).not.toContain('ant-btn-sm');
    expect(bookmarkButtons[0].className).not.toContain('ant-btn-sm');
    expect(deleteButtons[0].className).not.toContain('ant-btn-sm');

    fireEvent.click(screen.getByLabelText('选择查询历史 history-mobile-1'));

    await waitFor(() => {
      expect(screen.getByText('已选择 1 项')).toBeTruthy();
    });

    fireEvent.click(screen.getByLabelText('选择当前页全部查询历史'));

    await waitFor(() => {
      expect(screen.getByText('已选择 2 项')).toBeTruthy();
    });
  });
});

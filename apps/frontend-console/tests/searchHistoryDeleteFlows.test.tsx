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
  ) => selector({ pageSizes: { searchHistory: 10 }, setPageSize: setPageSizeMock }),
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

function buildHistoryItem(id: string, query: string, executedAt: string): {
  id: string;
  query: string;
  executedAt: string;
  duration: number;
  resultCount: number;
} {
  return {
    id,
    query,
    executedAt,
    duration: 12,
    resultCount: 3,
  };
}

describe('SearchHistory delete flows', () => {
  beforeEach(() => {
    fetchQueryHistoryMock.mockReset();
    createSavedQueryMock.mockReset();
    deleteQueryHistoryMock.mockReset();
    setPageSizeMock.mockReset();
    mockBrowserApis();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('returns to the previous page after deleting the only item on page 2', async () => {
    const pageOneItems = Array.from({ length: 10 }, (_, index) =>
      buildHistoryItem(
        `history-page-1-${index + 1}`,
        `page-one-query-${index + 1}`,
        `2026-03-17T04:${String(index).padStart(2, '0')}:00.000Z`,
      ),
    );

    fetchQueryHistoryMock
      .mockResolvedValueOnce({
        items: pageOneItems,
        total: 11,
        page: 1,
        pageSize: 10,
        hasNext: true,
      })
      .mockResolvedValueOnce({
        items: [
          buildHistoryItem(
            'history-last-page',
            'last-page-query',
            '2026-03-17T03:59:00.000Z',
          ),
        ],
        total: 11,
        page: 2,
        pageSize: 10,
        hasNext: false,
      })
      .mockResolvedValueOnce({
        items: pageOneItems,
        total: 10,
        page: 1,
        pageSize: 10,
        hasNext: false,
      });

    deleteQueryHistoryMock.mockResolvedValue(true);

    render(
      <App>
        <MemoryRouter>
          <SearchHistory />
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(screen.getByText('page-one-query-1')).toBeTruthy();
    });

    const pageTwo = Array.from(document.querySelectorAll('.ant-pagination-item')).find(
      (element) => element.textContent?.trim() === '2',
    );
    expect(pageTwo).toBeTruthy();
    fireEvent.click(pageTwo as Element);

    await waitFor(() => {
      expect(screen.getByText('last-page-query')).toBeTruthy();
      expect(document.querySelector('.ant-pagination-item-active')?.textContent?.trim()).toBe('2');
    });

    const row = screen.getByText('last-page-query').closest('tr');
    expect(row).toBeTruthy();
    const buttons = row?.querySelectorAll('button') ?? [];
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    fireEvent.click(buttons[2] as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getByText('确认删除')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '删 除' }));

    await waitFor(() => {
      expect(deleteQueryHistoryMock).toHaveBeenCalledWith('history-last-page');
    });

    await waitFor(() => {
      expect(fetchQueryHistoryMock).toHaveBeenCalledTimes(3);
      expect(fetchQueryHistoryMock).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 10,
        keyword: '',
        from: undefined,
        to: undefined,
      });
      expect(screen.getByText('page-one-query-1')).toBeTruthy();
      expect(document.querySelector('.ant-pagination-item-active')?.textContent?.trim()).toBe('1');
    });
  });

  it('returns to the previous page after batch deleting the remaining page-2 rows', async () => {
    const pageOneItems = Array.from({ length: 10 }, (_, index) =>
      buildHistoryItem(
        `history-batch-page-1-${index + 1}`,
        `batch-page-one-query-${index + 1}`,
        `2026-03-17T04:${String(index).padStart(2, '0')}:00.000Z`,
      ),
    );

    fetchQueryHistoryMock
      .mockResolvedValueOnce({
        items: pageOneItems,
        total: 12,
        page: 1,
        pageSize: 10,
        hasNext: true,
      })
      .mockResolvedValueOnce({
        items: [
          buildHistoryItem('history-batch-a', 'batch-last-page-query-a', '2026-03-17T03:58:00.000Z'),
          buildHistoryItem('history-batch-b', 'batch-last-page-query-b', '2026-03-17T03:57:00.000Z'),
        ],
        total: 12,
        page: 2,
        pageSize: 10,
        hasNext: false,
      })
      .mockResolvedValueOnce({
        items: pageOneItems,
        total: 10,
        page: 1,
        pageSize: 10,
        hasNext: false,
      });

    deleteQueryHistoryMock.mockResolvedValue(true);

    render(
      <App>
        <MemoryRouter>
          <SearchHistory />
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(screen.getByText('batch-page-one-query-1')).toBeTruthy();
    });

    const pageTwo = Array.from(document.querySelectorAll('.ant-pagination-item')).find(
      (element) => element.textContent?.trim() === '2',
    );
    expect(pageTwo).toBeTruthy();
    fireEvent.click(pageTwo as Element);

    await waitFor(() => {
      expect(screen.getByText('batch-last-page-query-a')).toBeTruthy();
      expect(screen.getByText('batch-last-page-query-b')).toBeTruthy();
      expect(document.querySelector('.ant-pagination-item-active')?.textContent?.trim()).toBe('2');
    });

    fireEvent.click(screen.getByLabelText('选择查询历史 history-batch-a'));
    fireEvent.click(screen.getByLabelText('选择查询历史 history-batch-b'));

    await waitFor(() => {
      expect(screen.getByText('已选择 2 项')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /批量删除/ }));

    await waitFor(() => {
      expect(screen.getByText('确认批量删除')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '删 除' }));

    await waitFor(() => {
      expect(deleteQueryHistoryMock).toHaveBeenCalledTimes(2);
      expect(deleteQueryHistoryMock).toHaveBeenNthCalledWith(1, 'history-batch-a');
      expect(deleteQueryHistoryMock).toHaveBeenNthCalledWith(2, 'history-batch-b');
    });

    await waitFor(() => {
      expect(fetchQueryHistoryMock).toHaveBeenCalledTimes(3);
      expect(fetchQueryHistoryMock).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 10,
        keyword: '',
        from: undefined,
        to: undefined,
      });
      expect(screen.getByText('batch-page-one-query-1')).toBeTruthy();
      expect(document.querySelector('.ant-pagination-item-active')?.textContent?.trim()).toBe('1');
      expect(screen.queryByText('已选择 2 项')).toBeNull();
    });
  });

  it('keeps the active keyword filter when reloading after delete', async () => {
    fetchQueryHistoryMock
      .mockResolvedValueOnce({
        items: [
          buildHistoryItem('history-billing', 'billing-service-error', '2026-03-17T04:00:00.000Z'),
          buildHistoryItem('history-ops', 'ops-service-error', '2026-03-17T03:59:00.000Z'),
        ],
        total: 2,
        page: 1,
        pageSize: 10,
        hasNext: false,
      })
      .mockResolvedValueOnce({
        items: [
          buildHistoryItem('history-ops', 'ops-service-error', '2026-03-17T03:59:00.000Z'),
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        hasNext: false,
      })
      .mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        hasNext: false,
      });

    deleteQueryHistoryMock.mockResolvedValue(true);

    render(
      <App>
        <MemoryRouter>
          <SearchHistory />
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(screen.getByText('billing-service-error')).toBeTruthy();
      expect(screen.getByText('ops-service-error')).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText('搜索查询语句...'), {
      target: { value: 'ops' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'search' }));

    await waitFor(() => {
      expect(fetchQueryHistoryMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText('ops-service-error')).toBeTruthy();
      expect(screen.queryByText('billing-service-error')).toBeNull();
    });

    const row = screen.getByText('ops-service-error').closest('tr');
    expect(row).toBeTruthy();
    const buttons = row?.querySelectorAll('button') ?? [];
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    fireEvent.click(buttons[2] as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getByText('确认删除')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '删 除' }));

    await waitFor(() => {
      expect(deleteQueryHistoryMock).toHaveBeenCalledWith('history-ops');
    });

    await waitFor(() => {
      expect(fetchQueryHistoryMock).toHaveBeenCalledTimes(3);
      expect(fetchQueryHistoryMock).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 10,
        keyword: 'ops',
        from: undefined,
        to: undefined,
      });
      expect(screen.getByText('没有匹配的查询历史')).toBeTruthy();
    });
  });
});

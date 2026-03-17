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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('SearchHistory request race guard', () => {
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

  it('ignores stale history responses when a newer search finishes first', async () => {
    const first = createDeferred<any>();
    const second = createDeferred<any>();

    fetchQueryHistoryMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    render(
      <App>
        <MemoryRouter>
          <SearchHistory />
        </MemoryRouter>
      </App>,
    );

    fireEvent.change(screen.getByPlaceholderText('搜索查询语句...'), {
      target: { value: 'error' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'search' }));

    await waitFor(() => {
      expect(fetchQueryHistoryMock).toHaveBeenCalledTimes(2);
    });

    second.resolve({
      items: [
        {
          id: 'history-new',
          query: 'error',
          executedAt: '2026-03-17T04:00:00.000Z',
          duration: 12,
          resultCount: 3,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 15,
      hasNext: false,
    });

    await waitFor(() => {
      expect(screen.getByText('error')).toBeTruthy();
    });

    first.resolve({
      items: [
        {
          id: 'history-old',
          query: 'vault',
          executedAt: '2026-03-16T04:00:00.000Z',
          duration: 8,
          resultCount: 1,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 15,
      hasNext: false,
    });

    await waitFor(() => {
      expect(screen.queryByText('vault')).toBeNull();
      expect(screen.getByText('error')).toBeTruthy();
    });
  });

  it('reverts the active page when a history pagination request fails', async () => {
    const pageTwoRequest = createDeferred<any>();

    fetchQueryHistoryMock
      .mockResolvedValueOnce({
        items: [
          {
            id: 'history-page-1',
            query: 'page-one-query',
            executedAt: '2026-03-17T04:00:00.000Z',
            duration: 12,
            resultCount: 3,
          },
        ],
        total: 30,
        page: 1,
        pageSize: 15,
        hasNext: true,
      })
      .mockReturnValueOnce(pageTwoRequest.promise)
      .mockResolvedValueOnce({
        items: [
          {
            id: 'history-page-1',
            query: 'page-one-query',
            executedAt: '2026-03-17T04:00:00.000Z',
            duration: 12,
            resultCount: 3,
          },
        ],
        total: 30,
        page: 1,
        pageSize: 15,
        hasNext: true,
      });

    render(
      <App>
        <MemoryRouter>
          <SearchHistory />
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(screen.getByText('page-one-query')).toBeTruthy();
    });

    const pageTwo = Array.from(document.querySelectorAll('.ant-pagination-item'))
      .find((element) => element.textContent?.trim() === '2');
    expect(pageTwo).toBeTruthy();
    fireEvent.click(pageTwo as Element);

    await waitFor(() => {
      expect(document.querySelector('.ant-pagination-item-active')?.textContent?.trim()).toBe('2');
      expect(screen.getByText('刷新中')).toBeTruthy();
      expect(screen.getByText('page-one-query')).toBeTruthy();
      expect(document.body.textContent).toContain('当前显示第 1-1 条');
    });

    pageTwoRequest.reject(new Error('page 2 failed'));

    await waitFor(() => {
      expect(document.querySelector('.ant-pagination-item-active')?.textContent?.trim()).toBe('1');
      expect(screen.getByText('page-one-query')).toBeTruthy();
      expect(fetchQueryHistoryMock).toHaveBeenCalledTimes(3);
    });
  });
});

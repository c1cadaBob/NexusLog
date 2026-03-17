/* @vitest-environment jsdom */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from 'antd';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SavedQueries from '../src/pages/search/SavedQueries';

const fetchSavedQueriesMock = vi.fn();
const updateSavedQueryMock = vi.fn();
const createSavedQueryMock = vi.fn();
const deleteSavedQueryMock = vi.fn();
const setPageSizeMock = vi.fn();

vi.mock('../src/api/query', () => ({
  fetchSavedQueries: (...args: unknown[]) => fetchSavedQueriesMock(...args),
  updateSavedQuery: (...args: unknown[]) => updateSavedQueryMock(...args),
  createSavedQuery: (...args: unknown[]) => createSavedQueryMock(...args),
  deleteSavedQuery: (...args: unknown[]) => deleteSavedQueryMock(...args),
}));

vi.mock('../src/pages/search/realtimeStartupQuery', () => ({
  persistPendingRealtimeStartupQuery: vi.fn(),
}));

vi.mock('../src/stores/preferencesStore', () => ({
  usePreferencesStore: (
    selector: (state: { pageSizes: Record<string, number>; setPageSize: typeof setPageSizeMock }) => unknown,
  ) => selector({ pageSizes: { savedQueries: 12 }, setPageSize: setPageSizeMock }),
}));

vi.mock('../src/components/common/usePaginationQuickJumperAccessibility', () => ({
  usePaginationQuickJumperAccessibility: () => null,
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

describe('SavedQueries request race guard', () => {
  beforeEach(() => {
    fetchSavedQueriesMock.mockReset();
    updateSavedQueryMock.mockReset();
    createSavedQueryMock.mockReset();
    deleteSavedQueryMock.mockReset();
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
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('ignores stale saved-query responses when a newer search finishes first', async () => {
    const first = createDeferred<any>();
    const second = createDeferred<any>();

    fetchSavedQueriesMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    render(
      <App>
        <MemoryRouter>
          <SavedQueries />
        </MemoryRouter>
      </App>,
    );

    fireEvent.change(screen.getByPlaceholderText('搜索查询名称或语句...'), {
      target: { value: 'vault' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'search' }));

    await waitFor(() => {
      expect(fetchSavedQueriesMock).toHaveBeenCalledTimes(2);
    });

    second.resolve({
      items: [
        {
          id: 'saved-new',
          name: 'Vault Query',
          query: 'service:vault',
          tags: [],
          createdAt: '2026-03-17T04:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 12,
      hasNext: false,
    });

    await waitFor(() => {
      expect(screen.getByText('Vault Query')).toBeTruthy();
    });

    first.resolve({
      items: [
        {
          id: 'saved-old',
          name: 'Old Query',
          query: 'service:old',
          tags: [],
          createdAt: '2026-03-16T04:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 12,
      hasNext: false,
    });

    await waitFor(() => {
      expect(screen.queryByText('Old Query')).toBeNull();
      expect(screen.getByText('Vault Query')).toBeTruthy();
    });
  });

  it('reverts the active page when a saved-query pagination request fails', async () => {
    const pageTwoRequest = createDeferred<any>();

    fetchSavedQueriesMock
      .mockResolvedValueOnce({
        items: [
          {
            id: 'saved-page-1',
            name: 'Page One Query',
            query: 'service:page-one',
            tags: [],
            createdAt: '2026-03-17T04:00:00.000Z',
          },
        ],
        total: 24,
        page: 1,
        pageSize: 12,
        hasNext: true,
      })
      .mockReturnValueOnce(pageTwoRequest.promise)
      .mockResolvedValueOnce({
        items: [
          {
            id: 'saved-page-1',
            name: 'Page One Query',
            query: 'service:page-one',
            tags: [],
            createdAt: '2026-03-17T04:00:00.000Z',
          },
        ],
        total: 24,
        page: 1,
        pageSize: 12,
        hasNext: true,
      });

    render(
      <App>
        <MemoryRouter>
          <SavedQueries />
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(screen.getByText('Page One Query')).toBeTruthy();
    });

    const pageTwo = Array.from(document.querySelectorAll('.ant-pagination-item'))
      .find((element) => element.textContent?.trim() === '2');
    expect(pageTwo).toBeTruthy();
    fireEvent.click(pageTwo as Element);

    await waitFor(() => {
      expect(document.querySelector('.ant-pagination-item-active')?.textContent?.trim()).toBe('2');
      expect(screen.getByText('刷新中')).toBeTruthy();
    });

    pageTwoRequest.reject(new Error('saved page 2 failed'));

    await waitFor(() => {
      expect(document.querySelector('.ant-pagination-item-active')?.textContent?.trim()).toBe('1');
      expect(screen.getByText('Page One Query')).toBeTruthy();
      expect(fetchSavedQueriesMock).toHaveBeenCalledTimes(3);
    });
  });
});

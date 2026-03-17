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

describe('SavedQueries delete flows', () => {
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

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('returns to the previous page after deleting the only item on page 2', async () => {
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
        total: 13,
        page: 1,
        pageSize: 12,
        hasNext: true,
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 'saved-last-page',
            name: 'Last Page Query',
            query: 'service:last-page',
            tags: [],
            createdAt: '2026-03-17T03:00:00.000Z',
          },
        ],
        total: 13,
        page: 2,
        pageSize: 12,
        hasNext: false,
      })
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
        total: 12,
        page: 1,
        pageSize: 12,
        hasNext: false,
      });

    deleteSavedQueryMock.mockResolvedValue(true);

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

    const pageTwo = Array.from(document.querySelectorAll('.ant-pagination-item')).find(
      (element) => element.textContent?.trim() === '2',
    );
    expect(pageTwo).toBeTruthy();
    fireEvent.click(pageTwo as Element);

    await waitFor(() => {
      expect(screen.getByText('Last Page Query')).toBeTruthy();
      expect(document.querySelector('.ant-pagination-item-active')?.textContent?.trim()).toBe('2');
    });

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    await waitFor(() => {
      expect(screen.getByText('确认删除')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '删 除' }));

    await waitFor(() => {
      expect(deleteSavedQueryMock).toHaveBeenCalledWith('saved-last-page');
    });

    await waitFor(() => {
      expect(fetchSavedQueriesMock).toHaveBeenCalledTimes(3);
      expect(fetchSavedQueriesMock).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 12,
        keyword: '',
        tag: undefined,
      });
      expect(screen.getByText('Page One Query')).toBeTruthy();
      expect(document.querySelector('.ant-pagination-item-active')?.textContent?.trim()).toBe('1');
    });
  });

  it('reloads the filtered list when the backend reports the saved query was already deleted', async () => {
    fetchSavedQueriesMock
      .mockResolvedValueOnce({
        items: [
          {
            id: 'saved-billing',
            name: 'Billing Query',
            query: 'service:billing',
            tags: ['billing'],
            createdAt: '2026-03-17T04:00:00.000Z',
          },
          {
            id: 'saved-ops',
            name: 'Ops Query',
            query: 'service:ops',
            tags: ['ops'],
            createdAt: '2026-03-17T03:00:00.000Z',
          },
        ],
        total: 2,
        page: 1,
        pageSize: 12,
        hasNext: false,
        availableTags: ['billing', 'ops'],
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 'saved-ops',
            name: 'Ops Query',
            query: 'service:ops',
            tags: ['ops'],
            createdAt: '2026-03-17T03:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 12,
        hasNext: false,
        availableTags: ['ops'],
      })
      .mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        pageSize: 12,
        hasNext: false,
        availableTags: [],
      });

    deleteSavedQueryMock.mockResolvedValue(false);

    render(
      <App>
        <MemoryRouter>
          <SavedQueries />
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(screen.getByText('Billing Query')).toBeTruthy();
      expect(screen.getByText('Ops Query')).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText('搜索查询名称或语句...'), {
      target: { value: 'ops' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'search' }));

    await waitFor(() => {
      expect(fetchSavedQueriesMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Ops Query')).toBeTruthy();
      expect(screen.queryByText('Billing Query')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    await waitFor(() => {
      expect(screen.getByText('确认删除')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '删 除' }));

    await waitFor(() => {
      expect(deleteSavedQueryMock).toHaveBeenCalledWith('saved-ops');
    });

    await waitFor(() => {
      expect(fetchSavedQueriesMock).toHaveBeenCalledTimes(3);
      expect(fetchSavedQueriesMock).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 12,
        keyword: 'ops',
        tag: undefined,
      });
      expect(screen.getByText('没有匹配的收藏查询')).toBeTruthy();
    });
  });

  it('reloads the filtered list when delete returns a not-found error', async () => {
    fetchSavedQueriesMock
      .mockResolvedValueOnce({
        items: [
          {
            id: 'saved-billing',
            name: 'Billing Query',
            query: 'service:billing',
            tags: ['billing'],
            createdAt: '2026-03-17T04:00:00.000Z',
          },
          {
            id: 'saved-ops',
            name: 'Ops Query',
            query: 'service:ops',
            tags: ['ops'],
            createdAt: '2026-03-17T03:00:00.000Z',
          },
        ],
        total: 2,
        page: 1,
        pageSize: 12,
        hasNext: false,
        availableTags: ['billing', 'ops'],
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 'saved-ops',
            name: 'Ops Query',
            query: 'service:ops',
            tags: ['ops'],
            createdAt: '2026-03-17T03:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 12,
        hasNext: false,
        availableTags: ['ops'],
      })
      .mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        pageSize: 12,
        hasNext: false,
        availableTags: [],
      });

    deleteSavedQueryMock.mockRejectedValue(
      Object.assign(new Error('saved query not found'), { status: 404 }),
    );

    render(
      <App>
        <MemoryRouter>
          <SavedQueries />
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(screen.getByText('Billing Query')).toBeTruthy();
      expect(screen.getByText('Ops Query')).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText('搜索查询名称或语句...'), {
      target: { value: 'ops' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'search' }));

    await waitFor(() => {
      expect(fetchSavedQueriesMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Ops Query')).toBeTruthy();
      expect(screen.queryByText('Billing Query')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    await waitFor(() => {
      expect(screen.getByText('确认删除')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '删 除' }));

    await waitFor(() => {
      expect(deleteSavedQueryMock).toHaveBeenCalledWith('saved-ops');
    });

    await waitFor(() => {
      expect(fetchSavedQueriesMock).toHaveBeenCalledTimes(3);
      expect(fetchSavedQueriesMock).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 12,
        keyword: 'ops',
        tag: undefined,
      });
      expect(screen.getByText('没有匹配的收藏查询')).toBeTruthy();
    });
  });

  it('keeps the active search filter when reloading after delete', async () => {
    fetchSavedQueriesMock
      .mockResolvedValueOnce({
        items: [
          {
            id: 'saved-billing',
            name: 'Billing Query',
            query: 'service:billing',
            tags: ['billing'],
            createdAt: '2026-03-17T04:00:00.000Z',
          },
          {
            id: 'saved-ops',
            name: 'Ops Query',
            query: 'service:ops',
            tags: ['ops'],
            createdAt: '2026-03-17T03:00:00.000Z',
          },
        ],
        total: 2,
        page: 1,
        pageSize: 12,
        hasNext: false,
        availableTags: ['billing', 'ops'],
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 'saved-ops',
            name: 'Ops Query',
            query: 'service:ops',
            tags: ['ops'],
            createdAt: '2026-03-17T03:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 12,
        hasNext: false,
        availableTags: ['ops'],
      })
      .mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        pageSize: 12,
        hasNext: false,
        availableTags: [],
      });

    deleteSavedQueryMock.mockResolvedValue(true);

    render(
      <App>
        <MemoryRouter>
          <SavedQueries />
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(screen.getByText('Billing Query')).toBeTruthy();
      expect(screen.getByText('Ops Query')).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText('搜索查询名称或语句...'), {
      target: { value: 'ops' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'search' }));

    await waitFor(() => {
      expect(fetchSavedQueriesMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Ops Query')).toBeTruthy();
      expect(screen.queryByText('Billing Query')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    await waitFor(() => {
      expect(screen.getByText('确认删除')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '删 除' }));

    await waitFor(() => {
      expect(deleteSavedQueryMock).toHaveBeenCalledWith('saved-ops');
    });

    await waitFor(() => {
      expect(fetchSavedQueriesMock).toHaveBeenCalledTimes(3);
      expect(fetchSavedQueriesMock).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 12,
        keyword: 'ops',
        tag: undefined,
      });
      expect(screen.getByText('没有匹配的收藏查询')).toBeTruthy();
    });
  });
});

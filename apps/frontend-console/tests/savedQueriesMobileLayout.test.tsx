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

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

describe('SavedQueries mobile layout', () => {
  beforeEach(() => {
    fetchSavedQueriesMock.mockReset();
    updateSavedQueryMock.mockReset();
    createSavedQueryMock.mockReset();
    deleteSavedQueryMock.mockReset();
    setPageSizeMock.mockReset();
    installDomMocks();
    setViewport(390);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows a loading placeholder before the first saved-query response resolves', async () => {
    const deferred = createDeferred<{
      items: Array<{
        id: string;
        name: string;
        query: string;
        tags: string[];
        createdAt: string;
      }>;
      total: number;
      page: number;
      pageSize: number;
      hasNext: boolean;
      availableTags: string[];
    }>();

    fetchSavedQueriesMock.mockImplementation(() => deferred.promise);

    render(
      <App>
        <MemoryRouter>
          <SavedQueries />
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(screen.getByText('加载收藏查询...')).toBeTruthy();
    });
    expect(screen.queryByText('暂无收藏查询')).toBeNull();

    deferred.resolve({
      items: [],
      total: 0,
      page: 1,
      pageSize: 12,
      hasNext: false,
      availableTags: [],
    });

    await waitFor(() => {
      expect(screen.getByText('暂无收藏查询')).toBeTruthy();
    });
  });

  it('keeps the inline retry state visible with loading feedback while a saved-query retry is pending', async () => {
    const deferred = createDeferred<{
      items: Array<{
        id: string;
        name: string;
        query: string;
        tags: string[];
        createdAt: string;
      }>;
      total: number;
      page: number;
      pageSize: number;
      hasNext: boolean;
      availableTags: string[];
    }>();

    fetchSavedQueriesMock
      .mockRejectedValueOnce(new Error('saved load failed'))
      .mockImplementationOnce(() => deferred.promise);

    render(
      <App>
        <MemoryRouter>
          <SavedQueries />
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(screen.getByText('收藏查询加载失败')).toBeTruthy();
      expect(screen.getByText('saved load failed')).toBeTruthy();
    });
    expect(screen.queryByText('暂无收藏查询')).toBeNull();

    const retryButton = screen.getByRole('button', { name: /重\s*试/ });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(fetchSavedQueriesMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText('正在重试收藏查询...')).toBeTruthy();
      expect(document.querySelector('.ant-btn-loading')).toBeTruthy();
    });
    expect(screen.queryByText('加载收藏查询...')).toBeNull();

    deferred.resolve({
      items: [],
      total: 0,
      page: 1,
      pageSize: 12,
      hasNext: false,
      availableTags: [],
    });

    await waitFor(() => {
      expect(screen.getByText('暂无收藏查询')).toBeTruthy();
    });
  });

  it('keeps existing saved-query cards visible and shows a top retry alert after a refresh failure', async () => {
    fetchSavedQueriesMock
      .mockResolvedValueOnce({
        items: [
          {
            id: 'saved-existing-1',
            name: 'existing saved query',
            query: 'service:vault',
            tags: ['历史查询'],
            createdAt: '2026-03-17T09:58:44.000Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 12,
        hasNext: false,
        availableTags: ['历史查询'],
      })
      .mockRejectedValueOnce(new Error('saved refresh failed'));

    render(
      <App>
        <MemoryRouter>
          <SavedQueries />
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(screen.getByText('existing saved query')).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText('搜索查询名称或语句...'), {
      target: { value: 'vault' },
    });
    const searchButton = document.querySelector('.ant-input-search-button');
    expect(searchButton).toBeTruthy();
    fireEvent.click(searchButton as Element);

    await waitFor(() => {
      expect(screen.getByText('收藏查询加载失败')).toBeTruthy();
      expect(screen.getByText('saved refresh failed')).toBeTruthy();
      expect(screen.getByText('existing saved query')).toBeTruthy();
    });
  });

  it('shows a loading placeholder again when a new empty saved-query request is pending', async () => {
    const deferred = createDeferred<{
      items: Array<{
        id: string;
        name: string;
        query: string;
        tags: string[];
        createdAt: string;
      }>;
      total: number;
      page: number;
      pageSize: number;
      hasNext: boolean;
      availableTags: string[];
    }>();

    fetchSavedQueriesMock
      .mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        pageSize: 12,
        hasNext: false,
        availableTags: [],
      })
      .mockImplementationOnce(() => deferred.promise);

    render(
      <App>
        <MemoryRouter>
          <SavedQueries />
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(screen.getByText('暂无收藏查询')).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText('搜索查询名称或语句...'), {
      target: { value: 'vault' },
    });
    const searchButton = document.querySelector('.ant-input-search-button');
    expect(searchButton).toBeTruthy();
    fireEvent.click(searchButton as Element);

    await waitFor(() => {
      expect(screen.getByText('加载收藏查询...')).toBeTruthy();
    });
    expect(screen.queryByText('没有匹配的收藏查询')).toBeNull();

    deferred.resolve({
      items: [],
      total: 0,
      page: 1,
      pageSize: 12,
      hasNext: false,
      availableTags: [],
    });

    await waitFor(() => {
      expect(screen.getByText('没有匹配的收藏查询')).toBeTruthy();
    });
  });

  it('shows wrapped query text, mobile-friendly actions, and no quick jumper on mobile', async () => {
    const longQuery = 'service:__no_such_service__ AND message:"__definitely_no_match__" AND host:"very-long-host-name.example.internal"';

    fetchSavedQueriesMock.mockResolvedValue({
      items: [
        {
          id: 'saved-mobile-1',
          name: '历史查询 2026/3/17 17:58:44',
          query: longQuery,
          tags: ['历史查询'],
          createdAt: '2026-03-17T09:58:44.000Z',
        },
      ],
      total: 18,
      page: 1,
      pageSize: 12,
      hasNext: true,
      availableTags: ['历史查询'],
    });

    render(
      <App>
        <MemoryRouter>
          <SavedQueries />
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(screen.getByText('历史查询 2026/3/17 17:58:44')).toBeTruthy();
      expect(screen.getByText(longQuery)).toBeTruthy();
    });

    const searchButton = document.querySelector('.ant-input-search-button') as HTMLButtonElement | null;
    const createButton = screen.getByRole('button', { name: /新建收藏/ });
    const resetButton = screen.getByRole('button', { name: /重\s*置/ });
    const executeButton = screen.getByRole('button', { name: /执行收藏查询/ });
    const editButton = screen.getByRole('button', { name: /编辑收藏查询/ });
    const deleteButton = screen.getByRole('button', { name: /删除收藏查询/ });

    expect(searchButton?.className).toContain('ant-btn-lg');
    expect(createButton.className).toContain('ant-btn-lg');
    expect(resetButton.className).toContain('ant-btn-lg');

    expect(executeButton).toBeTruthy();
    expect(editButton).toBeTruthy();
    expect(deleteButton).toBeTruthy();
    expect(executeButton.className).not.toContain('ant-btn-sm');
    expect(editButton.className).not.toContain('ant-btn-sm');
    expect(deleteButton.className).not.toContain('ant-btn-sm');
    expect(screen.getByText('共 18 个收藏')).toBeTruthy();
    expect(document.querySelector('.ant-pagination-options-quick-jumper')).toBeNull();
  });
});

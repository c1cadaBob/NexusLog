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

describe('SavedQueries save flows', () => {
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

  it('creates a clean saved query from page 2 and reloads page 1', async () => {
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
            id: 'saved-page-2',
            name: 'Page Two Query',
            query: 'service:page-two',
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
            id: 'saved-created',
            name: 'New Clean Query',
            query: 'service:new-clean',
            tags: [],
            createdAt: '2026-03-17T05:00:00.000Z',
          },
          {
            id: 'saved-page-1',
            name: 'Page One Query',
            query: 'service:page-one',
            tags: [],
            createdAt: '2026-03-17T04:00:00.000Z',
          },
        ],
        total: 14,
        page: 1,
        pageSize: 12,
        hasNext: true,
      });

    createSavedQueryMock.mockResolvedValue({
      id: 'saved-created',
      name: 'New Clean Query',
      query: 'service:new-clean',
      tags: [],
      createdAt: '2026-03-17T05:00:00.000Z',
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

    const pageTwo = Array.from(document.querySelectorAll('.ant-pagination-item')).find(
      (element) => element.textContent?.trim() === '2',
    );
    expect(pageTwo).toBeTruthy();
    fireEvent.click(pageTwo as Element);

    await waitFor(() => {
      expect(screen.getByText('Page Two Query')).toBeTruthy();
      expect(document.querySelector('.ant-pagination-item-active')?.textContent?.trim()).toBe('2');
    });

    fireEvent.click(screen.getByRole('button', { name: '新建收藏' }));
    fireEvent.change(screen.getByPlaceholderText('例如：支付服务错误'), {
      target: { value: 'New Clean Query' },
    });
    fireEvent.change(screen.getByPlaceholderText('例如: level:error AND service:"payment-service"'), {
      target: { value: 'service:new-clean' },
    });
    fireEvent.click(screen.getByRole('button', { name: /创\s*建/ }));

    await waitFor(() => {
      expect(createSavedQueryMock).toHaveBeenCalledWith({
        name: 'New Clean Query',
        query: 'service:new-clean',
        tags: [],
      });
    });

    await waitFor(() => {
      expect(fetchSavedQueriesMock).toHaveBeenCalledTimes(3);
      expect(fetchSavedQueriesMock).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 12,
        keyword: '',
        tag: undefined,
      });
      expect(screen.getByText('New Clean Query')).toBeTruthy();
      expect(document.querySelector('.ant-pagination-item-active')?.textContent?.trim()).toBe('1');
    });
  });

  it('edits an existing saved query and refreshes the current page', async () => {
    fetchSavedQueriesMock
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
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 'saved-ops',
            name: 'Ops Query Updated',
            query: 'service:ops-updated',
            tags: ['ops'],
            createdAt: '2026-03-17T03:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 12,
        hasNext: false,
      });

    updateSavedQueryMock.mockResolvedValue({
      id: 'saved-ops',
      name: 'Ops Query Updated',
      query: 'service:ops-updated',
      tags: ['ops'],
      createdAt: '2026-03-17T03:00:00.000Z',
    });

    render(
      <App>
        <MemoryRouter>
          <SavedQueries />
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(screen.getByText('Ops Query')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    await waitFor(() => {
      expect(screen.getByText('编辑收藏查询')).toBeTruthy();
    });

    fireEvent.change(screen.getByDisplayValue('Ops Query'), {
      target: { value: 'Ops Query Updated' },
    });
    fireEvent.change(screen.getByDisplayValue('service:ops'), {
      target: { value: 'service:ops-updated' },
    });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    await waitFor(() => {
      expect(updateSavedQueryMock).toHaveBeenCalledWith('saved-ops', {
        name: 'Ops Query Updated',
        query: 'service:ops-updated',
        tags: ['ops'],
      });
    });

    await waitFor(() => {
      expect(fetchSavedQueriesMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Ops Query Updated')).toBeTruthy();
      expect(screen.queryByText('Ops Query')).toBeNull();
    });
  });
});

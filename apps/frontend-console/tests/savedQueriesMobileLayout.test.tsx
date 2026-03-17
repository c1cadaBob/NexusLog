/* @vitest-environment jsdom */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from 'antd';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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

    expect(screen.getByRole('button', { name: /执行收藏查询/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /编辑收藏查询/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /删除收藏查询/ })).toBeTruthy();
    expect(screen.getByText('共 18 个收藏')).toBeTruthy();
    expect(document.querySelector('.ant-pagination-options-quick-jumper')).toBeNull();
  });
});

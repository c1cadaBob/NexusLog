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

vi.mock('../src/api/query', () => ({
  fetchSavedQueries: (...args: unknown[]) => fetchSavedQueriesMock(...args),
  updateSavedQuery: (...args: unknown[]) => updateSavedQueryMock(...args),
  createSavedQuery: (...args: unknown[]) => createSavedQueryMock(...args),
  deleteSavedQuery: (...args: unknown[]) => deleteSavedQueryMock(...args),
}));

vi.mock('../src/pages/search/realtimeStartupQuery', () => ({
  persistPendingRealtimeStartupQuery: vi.fn(),
}));

describe('SavedQueries legacy cleanup', () => {
  beforeEach(() => {
    fetchSavedQueriesMock.mockReset();
    updateSavedQueryMock.mockReset();
    createSavedQueryMock.mockReset();
    deleteSavedQueryMock.mockReset();

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
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('detects dirty saved queries and bulk normalizes them', async () => {
    fetchSavedQueriesMock
      .mockResolvedValueOnce({
        items: [
          {
            id: 'saved-1',
            name: 'Vault Error Legacy',
            query: 'error filters:{"service":"vault","level":"error"} time:[2026-03-16T05:10:26.361Z,2026-03-16T05:25:26.361Z]',
            tags: ['历史查询'],
            createdAt: '2026-03-16T05:25:26.361Z',
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
            id: 'saved-1',
            name: 'Vault Error Legacy',
            query: 'error filters:{"level":"error","service":"vault"}',
            tags: ['历史查询'],
            createdAt: '2026-03-16T05:25:26.361Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 12,
        hasNext: false,
      });

    updateSavedQueryMock.mockResolvedValue({
      id: 'saved-1',
      name: 'Vault Error Legacy',
      query: 'error filters:{"level":"error","service":"vault"}',
      tags: ['历史查询'],
      createdAt: '2026-03-16T05:25:26.361Z',
    });

    render(
      <App>
        <MemoryRouter>
          <SavedQueries />
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(fetchSavedQueriesMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText('检测到 1 条旧格式收藏查询')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '一键清洗' }));

    await waitFor(() => {
      expect(updateSavedQueryMock).toHaveBeenCalledWith('saved-1', {
        name: 'Vault Error Legacy',
        query: 'error filters:{"level":"error","service":"vault"}',
        tags: ['历史查询'],
      });
    });

    await waitFor(() => {
      expect(fetchSavedQueriesMock).toHaveBeenCalledTimes(2);
      expect(screen.queryByText('检测到 1 条旧格式收藏查询')).toBeNull();
    });
  });
});

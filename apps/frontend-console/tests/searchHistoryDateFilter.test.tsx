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

vi.mock('antd', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  const actual = await vi.importActual<typeof import('antd')>('antd');
  const dayjsModule = await import('dayjs');

  const RangePicker = ({ value, onChange, placeholder = ['开始时间', '结束时间'] }: any) => {
    const [startText, setStartText] = ReactModule.useState(value?.[0]?.toISOString?.() ?? '');
    const [endText, setEndText] = ReactModule.useState(value?.[1]?.toISOString?.() ?? '');

    ReactModule.useEffect(() => {
      setStartText(value?.[0]?.toISOString?.() ?? '');
      setEndText(value?.[1]?.toISOString?.() ?? '');
    }, [value]);

    return (
      <div>
        <input
          aria-label={placeholder[0]}
          placeholder={placeholder[0]}
          value={startText}
          onChange={(event) => setStartText(event.target.value)}
        />
        <input
          aria-label={placeholder[1]}
          placeholder={placeholder[1]}
          value={endText}
          onChange={(event) => setEndText(event.target.value)}
        />
        <button
          type="button"
          onClick={() =>
            onChange?.(
              [
                startText ? dayjsModule.default(startText) : null,
                endText ? dayjsModule.default(endText) : null,
              ],
              [startText, endText],
            )
          }
        >
          应用时间范围
        </button>
      </div>
    );
  };

  return {
    ...actual,
    DatePicker: {
      ...actual.DatePicker,
      RangePicker,
    },
  };
});

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

describe('SearchHistory date range filters', () => {
  beforeEach(() => {
    fetchQueryHistoryMock.mockReset();
    createSavedQueryMock.mockReset();
    deleteQueryHistoryMock.mockReset();
    setPageSizeMock.mockReset();

    fetchQueryHistoryMock.mockResolvedValue({
      items: [
        {
          id: 'history-1',
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

  it('passes explicit date range filters to history requests', async () => {
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

    fireEvent.change(screen.getByLabelText('开始时间'), {
      target: { value: '2026-03-17T00:00:00.000Z' },
    });
    fireEvent.change(screen.getByLabelText('结束时间'), {
      target: { value: '2026-03-17T23:59:59.000Z' },
    });
    fireEvent.click(screen.getByRole('button', { name: '应用时间范围' }));

    await waitFor(() => {
      expect(fetchQueryHistoryMock).toHaveBeenCalledTimes(2);
      expect(fetchQueryHistoryMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 15,
          from: '2026-03-17T00:00:00.000Z',
          to: '2026-03-17T23:59:59.000Z',
        }),
      );
    });
  });

  it('clears keyword and date range filters on reset', async () => {
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

    fireEvent.change(screen.getByPlaceholderText('搜索查询语句...'), {
      target: { value: 'error' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'search' }));

    await waitFor(() => {
      expect(fetchQueryHistoryMock).toHaveBeenCalledTimes(2);
      expect(fetchQueryHistoryMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          keyword: 'error',
          from: undefined,
          to: undefined,
        }),
      );
    });

    fireEvent.change(screen.getByLabelText('开始时间'), {
      target: { value: '2026-03-17T00:00:00.000Z' },
    });
    fireEvent.change(screen.getByLabelText('结束时间'), {
      target: { value: '2026-03-17T23:59:59.000Z' },
    });
    fireEvent.click(screen.getByRole('button', { name: '应用时间范围' }));

    await waitFor(() => {
      expect(fetchQueryHistoryMock).toHaveBeenCalledTimes(3);
      expect(fetchQueryHistoryMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          keyword: 'error',
          from: '2026-03-17T00:00:00.000Z',
          to: '2026-03-17T23:59:59.000Z',
        }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: '重 置' }));

    await waitFor(() => {
      expect(fetchQueryHistoryMock).toHaveBeenCalledTimes(4);
      expect(fetchQueryHistoryMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 15,
          keyword: '',
          from: undefined,
          to: undefined,
        }),
      );
    });

    expect((screen.getByPlaceholderText('搜索查询语句...') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('开始时间') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('结束时间') as HTMLInputElement).value).toBe('');
  });
});

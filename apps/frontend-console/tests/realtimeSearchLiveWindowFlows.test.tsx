/* @vitest-environment jsdom */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from 'antd';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RealtimeSearch from '../src/pages/search/RealtimeSearch';

const queryRealtimeLogsMock = vi.fn();
const fetchAggregateStatsMock = vi.fn();
const createSavedQueryMock = vi.fn();
const setPageSizeMock = vi.fn();

vi.mock('../src/api/query', () => ({
  queryRealtimeLogs: (...args: unknown[]) => queryRealtimeLogsMock(...args),
  fetchAggregateStats: (...args: unknown[]) => fetchAggregateStatsMock(...args),
  createSavedQuery: (...args: unknown[]) => createSavedQueryMock(...args),
}));

vi.mock('../src/stores/themeStore', () => ({
  useThemeStore: (selector: (state: { isDark: boolean }) => unknown) =>
    selector({ isDark: false }),
}));

vi.mock('../src/stores/preferencesStore', () => ({
  usePreferencesStore: (
    selector: (state: { pageSizes: Record<string, number>; setPageSize: typeof setPageSizeMock }) => unknown,
  ) => selector({ pageSizes: { realtimeSearch: 20 }, setPageSize: setPageSizeMock }),
}));

vi.mock('../src/components/charts/ChartWrapper', () => ({
  default: ({
    title,
    subtitle,
    empty,
    loading,
  }: {
    title?: string;
    subtitle?: string;
    empty?: boolean;
    loading?: boolean;
  }) => (
    <div data-testid="chart-wrapper-state">
      {`${title ?? ''}|subtitle:${subtitle ?? ''}|empty:${String(Boolean(empty))}|loading:${String(Boolean(loading))}`}
    </div>
  ),
}));

vi.mock('../src/components/common/usePaginationQuickJumperAccessibility', () => ({
  usePaginationQuickJumperAccessibility: () => null,
}));

vi.mock('../src/pages/search/realtimeRecentQueries', () => ({
  readRealtimeRecentQueries: () => ['service:vault'],
  recordRealtimeRecentQuery: (value: string) => [value],
}));

function createQueryResult(overrides: Record<string, unknown> = {}) {
  return {
    hits: [
      {
        id: 'log-1',
        timestamp: '2026-03-16T07:04:27.236Z',
        level: 'info',
        service: 'vault',
        host: 'dev-server-centos8',
        hostIp: '192.168.0.202',
        message: 'test message',
        rawLog: 'test message',
        fields: {},
      },
    ],
    total: 1,
    totalIsLowerBound: false,
    page: 1,
    pageSize: 20,
    hasNext: false,
    queryTimeMS: 12,
    timedOut: false,
    aggregations: {},
    pitId: 'pit-1',
    nextSearchAfter: ['cursor-1'],
    ...overrides,
  };
}

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

function openLiveWindowSelect() {
  const currentSelection = screen.getByText('最近 15 分钟');
  const liveWindowSelect = currentSelection.closest('.ant-select');
  expect(liveWindowSelect).toBeTruthy();
  const selector = liveWindowSelect?.querySelector('.ant-select-selector');
  expect(selector).toBeTruthy();
  fireEvent.mouseDown(selector as Element);
}

async function chooseLiveWindowOption(label: string) {
  openLiveWindowSelect();
  const findOption = () =>
    Array.from(document.querySelectorAll('.ant-select-item-option-content')).find(
      (node) => node.textContent?.trim() === label,
    );
  await waitFor(() => {
    expect(findOption()).toBeTruthy();
  });
  fireEvent.click(findOption() as Element);
}

describe('RealtimeSearch live window flows', () => {
  beforeEach(() => {
    queryRealtimeLogsMock.mockReset();
    fetchAggregateStatsMock.mockReset();
    createSavedQueryMock.mockReset();
    setPageSizeMock.mockReset();
    installDomMocks();

    queryRealtimeLogsMock.mockResolvedValue(createQueryResult());
    fetchAggregateStatsMock.mockResolvedValue({
      buckets: [{ key: new Date().toISOString(), count: 1 }],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('switches to all-time mode without requesting histogram aggregates again', async () => {
    render(
      <App>
        <MemoryRouter initialEntries={['/search/realtime']}>
          <Routes>
            <Route path="/search/realtime" element={<RealtimeSearch />} />
          </Routes>
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(1);
      expect(fetchAggregateStatsMock).toHaveBeenCalledTimes(2);
    });

    await chooseLiveWindowOption('全部时间');

    await waitFor(() => {
      expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(2);
    });

    expect(queryRealtimeLogsMock.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 20,
        timeRange: expect.objectContaining({
          from: '',
          to: expect.any(String),
        }),
      }),
    );
    expect(fetchAggregateStatsMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText('已暂停')).toBeTruthy();
    expect(document.querySelector('.ant-select-selection-item[title="全部时间"]')).toBeTruthy();
    expect(screen.getByTestId('chart-wrapper-state').textContent).toContain(
      'subtitle:全部时间或精确时间范围下不展示趋势图',
    );
    expect(screen.getByTestId('chart-wrapper-state').textContent).toContain(
      'empty:true',
    );
  });

  it('shows a notice instead of resuming live polling while all-time mode is active', async () => {
    render(
      <App>
        <MemoryRouter initialEntries={['/search/realtime']}>
          <Routes>
            <Route path="/search/realtime" element={<RealtimeSearch />} />
          </Routes>
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(1);
      expect(fetchAggregateStatsMock).toHaveBeenCalledTimes(2);
    });

    await chooseLiveWindowOption('全部时间');

    await waitFor(() => {
      expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(2);
    });

    const pausedButton = screen.getByText('已暂停').closest('button');
    expect(pausedButton).toBeTruthy();
    fireEvent.click(pausedButton as HTMLButtonElement);

    await waitFor(() => {
      expect(
        screen.getByText('全部时间或历史时间范围下不支持实时轮询'),
      ).toBeTruthy();
    });

    expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(2);
    expect(fetchAggregateStatsMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText('已暂停')).toBeTruthy();
  });
});

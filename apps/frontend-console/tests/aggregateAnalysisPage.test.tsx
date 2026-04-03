/* @vitest-environment jsdom */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from 'antd';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AggregateAnalysis from '../src/pages/analysis/AggregateAnalysis';

const fetchAggregateStatsMock = vi.fn();

vi.mock('../src/api/query', () => ({
  fetchAggregateStats: (...args: unknown[]) => fetchAggregateStatsMock(...args),
}));

vi.mock('../src/stores/themeStore', () => ({
  useThemeStore: (selector: (state: { isDark: boolean }) => unknown) => selector({ isDark: false }),
}));

vi.mock('../src/components/charts/ChartWrapper', () => ({
  default: ({ title, subtitle, loading, empty, error }: {
    title?: string;
    subtitle?: string;
    loading?: boolean;
    empty?: boolean;
    error?: string;
  }) => (
    <div data-testid={`chart-${title ?? 'untitled'}`}>
      {title} | {subtitle} | {loading ? 'loading' : empty ? 'empty' : error ?? 'ready'}
    </div>
  ),
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

function renderPage() {
  return render(
    <App>
      <AggregateAnalysis />
    </App>,
  );
}

async function waitForAnalyzeButton() {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /开始分析|分析中/ })).toBeTruthy();
  });
  return screen.getByRole('button', { name: /开始分析|分析中/ });
}

function openSelect(index: number) {
  const selectors = document.querySelectorAll('.ant-select-selector');
  const selector = selectors[index];
  expect(selector).toBeTruthy();
  fireEvent.mouseDown(selector as Element);
}

async function chooseOption(index: number, label: string) {
  openSelect(index);
  const findOption = () =>
    Array.from(document.querySelectorAll('.ant-select-item-option-content')).find(
      (node) => node.textContent?.trim() === label,
    );
  await waitFor(() => {
    expect(findOption()).toBeTruthy();
  });
  fireEvent.click(findOption() as Element);
}

describe('AggregateAnalysis page', () => {
  beforeEach(() => {
    installDomMocks();
    fetchAggregateStatsMock.mockReset();
    fetchAggregateStatsMock.mockResolvedValue({
      buckets: [
        { key: 'info', count: 120 },
        { key: 'warn', count: 30 },
        { key: 'error', count: 10 },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('loads with 7d default range and renders aggregate summaries', async () => {
    renderPage();

    await waitFor(() => {
      expect(fetchAggregateStatsMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchAggregateStatsMock).toHaveBeenCalledWith(expect.objectContaining({
      groupBy: 'level',
      timeRange: '7d',
      keywords: '',
      filters: {},
    }));

    await waitFor(() => {
      expect(screen.getByText('总事件量')).toBeTruthy();
      expect(screen.getByText('160')).toBeTruthy();
      expect(screen.getAllByText('INFO').length).toBeGreaterThan(0);
      expect(screen.getAllByText('ERROR').length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(fetchAggregateStatsMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId('chart-日志级别分布').textContent).toContain('最近 7 天');
  });

  it('submits keyword and service filters to aggregate api', async () => {
    renderPage();

    await waitFor(() => {
      expect(fetchAggregateStatsMock).toHaveBeenCalledTimes(1);
    });

    await waitForAnalyzeButton();
    fetchAggregateStatsMock.mockClear();

    fireEvent.change(screen.getByPlaceholderText('例如 docker / error / timeout'), {
      target: { value: 'docker' },
    });
    fireEvent.change(screen.getByPlaceholderText('例如 audit.log'), {
      target: { value: 'audit.log' },
    });
    fireEvent.click(await waitForAnalyzeButton());

    await waitFor(() => {
      expect(fetchAggregateStatsMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchAggregateStatsMock).toHaveBeenCalledWith(expect.objectContaining({
      groupBy: 'level',
      timeRange: '7d',
      keywords: 'docker',
      filters: { service: 'audit.log' },
    }));
  });

  it('shows default empty guidance when 7d aggregate result is empty', async () => {
    fetchAggregateStatsMock.mockResolvedValueOnce({ buckets: [] });

    renderPage();

    await waitFor(() => {
      expect(fetchAggregateStatsMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText('当前筛选条件下暂无聚合结果，请尝试调整关键词、服务名或切换分组维度。')).toBeTruthy();
    });

    expect(screen.queryByText('切换到最近 7 天')).toBeNull();
  });

  it('renders source aggregation as host and service columns', async () => {
    fetchAggregateStatsMock
      .mockResolvedValueOnce({ buckets: [{ key: 'info', count: 12 }] })
      .mockResolvedValueOnce({
        buckets: [
          {
            key: '/var/log/nginx/access.log',
            count: 9,
            label: 'node-a / nginx',
            host: 'node-a',
            service: 'nginx',
          },
        ],
      });

    renderPage();

    await waitFor(() => {
      expect(fetchAggregateStatsMock).toHaveBeenCalledTimes(1);
    });

    await chooseOption(0, '按主机 / 服务 (Source)');
    fireEvent.click(await waitForAnalyzeButton());

    await waitFor(() => {
      expect(fetchAggregateStatsMock.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(fetchAggregateStatsMock.mock.calls.at(-1)?.[0]).toMatchObject({ groupBy: 'source' });
    });

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: '主机名' })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: '服务名' })).toBeTruthy();
    });

    expect(screen.queryByText('/var/log/nginx/access.log')).toBeNull();
  });
});

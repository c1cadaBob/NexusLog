/* @vitest-environment jsdom */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from 'antd';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import LogClustering from '../src/pages/analysis/LogClustering';

const fetchLogClustersMock = vi.fn();

vi.mock('../src/api/query', () => ({
  fetchLogClusters: (...args: unknown[]) => fetchLogClustersMock(...args),
}));

vi.mock('../src/stores/themeStore', () => ({
  useThemeStore: (selector: (state: { isDark: boolean }) => unknown) => selector({ isDark: false }),
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

  Object.defineProperty(window.URL, 'createObjectURL', {
    writable: true,
    value: vi.fn(() => 'blob:test'),
  });

  Object.defineProperty(window.URL, 'revokeObjectURL', {
    writable: true,
    value: vi.fn(),
  });
}

function renderPage() {
  return render(
    <App>
      <LogClustering />
    </App>,
  );
}

function buildMockResult() {
  return {
    summary: {
      analyzed_logs_total: 420,
      sampled_logs: 240,
      unique_patterns: 12,
      new_patterns_today: 3,
    },
    patterns: [
      {
        id: 'pattern-error',
        template: 'Error: Connection timed out to database {IP_ADDRESS} at port {PORT}',
        similarity: 96,
        occurrences: 132,
        first_seen: '2026-03-22T01:00:00Z',
        last_seen: '2026-03-22T08:15:00Z',
        level: 'error',
        trend: [
          { time: '2026-03-22T01:00:00Z', count: 2 },
          { time: '2026-03-22T02:00:00Z', count: 5 },
          { time: '2026-03-22T03:00:00Z', count: 9 },
          { time: '2026-03-22T04:00:00Z', count: 16 },
          { time: '2026-03-22T05:00:00Z', count: 20 },
          { time: '2026-03-22T06:00:00Z', count: 24 },
          { time: '2026-03-22T07:00:00Z', count: 28 },
          { time: '2026-03-22T08:00:00Z', count: 28 },
        ],
        samples: [
          {
            timestamp: '2026-03-22T08:15:00Z',
            message: 'Error: Connection timed out to database 192.168.1.101 at port 5432',
            variables: { IP_ADDRESS: '192.168.1.101', PORT: '5432' },
            host: 'db-node-01',
            service: 'order-api',
            level: 'error',
          },
        ],
      },
    ],
  };
}

describe('LogClustering page', () => {
  beforeEach(() => {
    installDomMocks();
    fetchLogClustersMock.mockReset();
    fetchLogClustersMock.mockResolvedValue(buildMockResult());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('loads real clustering data and opens detail drawer', async () => {
    renderPage();

    await waitFor(() => {
      expect(fetchLogClustersMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchLogClustersMock).toHaveBeenCalledWith(expect.objectContaining({
      timeRange: '7d',
      keywords: '',
      filters: {},
      limit: 24,
      sampleSize: 400,
    }));

    await waitFor(() => {
      expect(screen.getByText('匹配事件总量')).toBeTruthy();
      expect(screen.getByText('420')).toBeTruthy();
      expect(screen.getAllByText(/Connection timed out to database/).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: '查看详情' }));

    await waitFor(() => {
      expect(screen.getAllByText('模式详情').length).toBeGreaterThan(0);
      expect(screen.getByText('db-node-01')).toBeTruthy();
      expect(screen.getByText('order-api')).toBeTruthy();
    });
  });

  it('submits level filter to clustering api', async () => {
    renderPage();

    await waitFor(() => {
      expect(fetchLogClustersMock).toHaveBeenCalledTimes(1);
    });

    fetchLogClustersMock.mockClear();

    const errorToggle = Array.from(document.querySelectorAll('.ant-segmented-item')).find((element) =>
      element.textContent?.trim() === 'ERROR');
    expect(errorToggle).toBeTruthy();
    fireEvent.click(errorToggle as Element);

    await waitFor(() => {
      expect(fetchLogClustersMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchLogClustersMock).toHaveBeenCalledWith(expect.objectContaining({
      timeRange: '7d',
      filters: { level: 'error' },
    }));
  });

  it('keeps previous clustering result visible when refresh fails', async () => {
    fetchLogClustersMock.mockReset();
    fetchLogClustersMock
      .mockResolvedValueOnce(buildMockResult())
      .mockRejectedValueOnce(new Error('search backend is temporarily unavailable'));

    renderPage();

    await waitFor(() => {
      expect(fetchLogClustersMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/Connection timed out to database/).length).toBeGreaterThan(0);
      expect(screen.getByText(/最近更新：/)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '刷新分析' }));

    await waitFor(() => {
      expect(fetchLogClustersMock).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByText('当前结果为最近一次成功查询的数据')).toBeTruthy();
      expect(screen.getAllByText(/Connection timed out to database/).length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('聚类分析加载失败')).toBeNull();
  });
});

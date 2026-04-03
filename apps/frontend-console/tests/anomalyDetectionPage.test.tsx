/* @vitest-environment jsdom */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from 'antd';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AnomalyDetection from '../src/pages/analysis/AnomalyDetection';
import { consumePendingAlertRuleDraft } from '../src/utils/alertRulePrefill';

const fetchAnomalyStatsMock = vi.fn();

vi.mock('../src/api/query', () => ({
  fetchAnomalyStats: (...args: unknown[]) => fetchAnomalyStatsMock(...args),
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
    <MemoryRouter initialEntries={['/analysis/anomaly']}>
      <App>
        <AnomalyDetection />
      </App>
    </MemoryRouter>,
  );
}

function buildMockResult() {
  return {
    summary: {
      total_anomalies: 2,
      critical_count: 1,
      health_score: 76,
      anomalous_buckets: 3,
      affected_services: 1,
    },
    trend: [
      {
        time: '2026-03-22T01:00:00Z',
        actual: 120,
        expected: 80,
        lower_bound: 60,
        upper_bound: 100,
        is_anomaly: true,
        error_rate: 25,
      },
      {
        time: '2026-03-22T02:00:00Z',
        actual: 70,
        expected: 75,
        lower_bound: 55,
        upper_bound: 95,
        is_anomaly: false,
        error_rate: 8,
      },
    ],
    anomalies: [
      {
        id: 'anomaly-1',
        title: '日志量激增',
        description: '2026-03-22 09:00 的日志量为 120，基线约为 80。',
        severity: 'critical' as const,
        status: 'active' as const,
        timestamp: '2026-03-22T01:00:00Z',
        service: 'order-api',
        confidence: 96,
        metric: 'log_volume',
        expected_value: 80,
        actual_value: 120,
        root_cause: '建议检查最近的发布、重试与上游流量变化。',
      },
      {
        id: 'anomaly-2',
        title: '异常错误率',
        description: '错误率达到 25%，高于基线。',
        severity: 'high' as const,
        status: 'investigating' as const,
        timestamp: '2026-03-22T00:00:00Z',
        service: 'order-api',
        confidence: 88,
        metric: 'error_rate',
        expected_value: 10,
        actual_value: 25,
      },
    ],
  };
}

describe('AnomalyDetection page', () => {
  beforeEach(() => {
    installDomMocks();
    window.sessionStorage.clear();
    fetchAnomalyStatsMock.mockReset();
    fetchAnomalyStatsMock.mockResolvedValue(buildMockResult());
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('loads anomaly stats with 7d default range and renders summaries', async () => {
    renderPage();

    await waitFor(() => {
      expect(fetchAnomalyStatsMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchAnomalyStatsMock).toHaveBeenCalledWith(expect.objectContaining({
      timeRange: '7d',
    }));

    await waitFor(() => {
      expect(screen.getByText('当前异常数')).toBeTruthy();
      expect(screen.getByText('2')).toBeTruthy();
      expect(screen.getByText('严重异常')).toBeTruthy();
      expect(screen.getByText('系统健康度')).toBeTruthy();
      expect(screen.getAllByText('日志量激增').length).toBeGreaterThan(0);
    });

    expect(screen.getByTestId('chart-日志量异常趋势').textContent).toContain('过去 7 天');
  });

  it('opens anomaly detail drawer after clicking detail button', async () => {
    renderPage();

    await waitFor(() => {
      expect(fetchAnomalyStatsMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getAllByText('日志量激增').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /查看异常详情/ })[0]);

    await waitFor(() => {
      expect(screen.getByText('处置建议')).toBeTruthy();
      expect(screen.getAllByText('order-api').length).toBeGreaterThan(0);
      expect(screen.getByText('建议检查最近的发布、重试与上游流量变化。')).toBeTruthy();
    });
  });

  it('stores a prefilled alert rule draft from anomaly detail', async () => {
    renderPage();

    await waitFor(() => {
      expect(fetchAnomalyStatsMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(await screen.findAllByRole('button', { name: /查看异常详情/ }).then((buttons) => buttons[0]));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '创建告警规则' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '创建告警规则' }));

    const draft = consumePendingAlertRuleDraft();
    expect(draft).toMatchObject({
      source: 'anomaly_detection',
      severity: 'critical',
      conditionMetric: 'log_volume',
      conditionOperator: 'gte',
      conditionThreshold: 120,
    });
    expect(draft?.name).toContain('日志量激增');
    expect(draft?.description).toContain('来源：异常检测');
  });

  it('keeps previous anomaly result visible when refresh fails', async () => {
    fetchAnomalyStatsMock.mockReset();
    fetchAnomalyStatsMock
      .mockResolvedValueOnce(buildMockResult())
      .mockRejectedValueOnce(new Error('search backend is temporarily unavailable'));

    renderPage();

    await waitFor(() => {
      expect(fetchAnomalyStatsMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getAllByText('日志量激增').length).toBeGreaterThan(0);
      expect(screen.getByText(/最近更新：/)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /刷新检测/ }));

    await waitFor(() => {
      expect(fetchAnomalyStatsMock).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByText('当前结果为最近一次成功查询的数据')).toBeTruthy();
      expect(screen.getAllByText('日志量激增').length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('异常检测加载失败')).toBeNull();
  });
});

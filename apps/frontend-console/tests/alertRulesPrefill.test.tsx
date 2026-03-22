/* @vitest-environment jsdom */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from 'antd';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AlertRules from '../src/pages/alerts/AlertRules';
import { savePendingAlertRuleDraft, consumePendingAlertRuleDraft } from '../src/utils/alertRulePrefill';

const fetchAlertRulesMock = vi.fn();
const createAlertRuleMock = vi.fn();
const updateAlertRuleMock = vi.fn();
const deleteAlertRuleMock = vi.fn();
const enableAlertRuleMock = vi.fn();
const disableAlertRuleMock = vi.fn();

vi.mock('../src/api/alert', () => ({
  fetchAlertRules: (...args: unknown[]) => fetchAlertRulesMock(...args),
  createAlertRule: (...args: unknown[]) => createAlertRuleMock(...args),
  updateAlertRule: (...args: unknown[]) => updateAlertRuleMock(...args),
  deleteAlertRule: (...args: unknown[]) => deleteAlertRuleMock(...args),
  enableAlertRule: (...args: unknown[]) => enableAlertRuleMock(...args),
  disableAlertRule: (...args: unknown[]) => disableAlertRuleMock(...args),
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
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/alerts/rules']}>
      <App>
        <Routes>
          <Route path="/alerts/rules" element={<AlertRules />} />
        </Routes>
      </App>
    </MemoryRouter>,
  );
}

describe('AlertRules prefill', () => {
  beforeEach(() => {
    installDomMocks();
    window.sessionStorage.clear();
    fetchAlertRulesMock.mockReset();
    createAlertRuleMock.mockReset();
    updateAlertRuleMock.mockReset();
    deleteAlertRuleMock.mockReset();
    enableAlertRuleMock.mockReset();
    disableAlertRuleMock.mockReset();
    fetchAlertRulesMock.mockResolvedValue({ items: [], total: 0 });
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('opens create modal with anomaly draft values', async () => {
    savePendingAlertRuleDraft({
      source: 'anomaly_detection',
      name: '[异常检测] 异常错误率 - order-api',
      description: '来源：异常检测；服务：order-api；指标：error_rate',
      ruleType: 'threshold',
      severity: 'high',
      conditionMetric: 'error_rate',
      conditionOperator: 'gte',
      conditionThreshold: 25,
    });

    renderPage();

    await waitFor(() => {
      expect(fetchAlertRulesMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getAllByText('新建告警规则').length).toBeGreaterThan(0);
    });

    expect((document.getElementById('name') as HTMLInputElement | null)?.value).toBe('[异常检测] 异常错误率 - order-api');
    expect((document.getElementById('description') as HTMLTextAreaElement | null)?.value).toContain('来源：异常检测');
    expect((document.getElementById('conditionMetric') as HTMLInputElement | null)?.value).toBe('error_rate');
    expect((document.getElementById('conditionThreshold') as HTMLInputElement | null)?.value).toBe('25');
    expect(consumePendingAlertRuleDraft()).toBeNull();
  });
});

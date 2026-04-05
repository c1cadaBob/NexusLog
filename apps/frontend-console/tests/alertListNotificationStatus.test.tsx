/* @vitest-environment jsdom */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import AlertList from '../src/pages/alerts/AlertList';

const fetchAlertEventsMock = vi.fn();
const acknowledgeAlertEventMock = vi.fn();
const resolveAlertEventMock = vi.fn();
const silenceAlertEventMock = vi.fn();
const setPageSizeMock = vi.fn();
const markAllAsReadMock = vi.fn();

vi.mock('../src/api/alert', () => ({
  fetchAlertEvents: (...args: unknown[]) => fetchAlertEventsMock(...args),
  acknowledgeAlertEvent: (...args: unknown[]) => acknowledgeAlertEventMock(...args),
  resolveAlertEvent: (...args: unknown[]) => resolveAlertEventMock(...args),
  silenceAlertEvent: (...args: unknown[]) => silenceAlertEventMock(...args),
}));

vi.mock('../src/stores/themeStore', () => ({
  useThemeStore: (selector: (state: { isDark: boolean }) => unknown) => selector({ isDark: false }),
}));

vi.mock('../src/stores/preferencesStore', () => ({
  usePreferencesStore: (
    selector: (state: { pageSizes: Record<string, number>; setPageSize: typeof setPageSizeMock }) => unknown,
  ) => selector({ pageSizes: { alertList: 10 }, setPageSize: setPageSizeMock }),
}));

vi.mock('../src/stores/alertStore', () => ({
  useAlertStore: (selector: (state: { markAllAsRead: typeof markAllAsReadMock }) => unknown) =>
    selector({ markAllAsRead: markAllAsReadMock }),
}));

describe('AlertList notification status', () => {
  beforeEach(() => {
    fetchAlertEventsMock.mockReset();
    acknowledgeAlertEventMock.mockReset();
    resolveAlertEventMock.mockReset();
    silenceAlertEventMock.mockReset();
    setPageSizeMock.mockReset();
    markAllAsReadMock.mockReset();

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
    vi.clearAllMocks();
  });

  it('renders notification dispatch summary in the list', async () => {
    fetchAlertEventsMock.mockResolvedValue({
      items: [
        {
          id: 'event-1',
          name: 'CPU 阈值告警',
          severity: 'high',
          status: 'active',
          source: 'cpu_usage_pct',
          count: 1,
          lastTriggeredAt: Date.now(),
          notificationSummary: {
            status: 'sent',
            attemptedChannels: 1,
            successfulChannels: 1,
            lastAttemptAt: Date.now(),
          },
        },
      ],
      total: 1,
      summary: { pending: 1, critical: 0, warning: 1, silenced: 0 },
    });

    render(
      <App>
        <MemoryRouter>
          <AlertList />
        </MemoryRouter>
      </App>,
    );

    await waitFor(() => {
      expect(fetchAlertEventsMock).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText('发送成功')).toBeTruthy();
    expect(screen.getByText(/1\/1 渠道成功/)).toBeTruthy();
  });
});

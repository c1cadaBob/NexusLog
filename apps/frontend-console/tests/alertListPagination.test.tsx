/* @vitest-environment jsdom */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

describe('AlertList pagination', () => {
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

  it('requests the selected page from the backend', async () => {
    fetchAlertEventsMock
      .mockResolvedValueOnce({
        items: [
          {
            id: 'event-page-1',
            name: '第一页告警',
            severity: 'critical',
            status: 'active',
            source: 'source-page-1',
            count: 1,
            lastTriggeredAt: Date.now(),
          },
        ],
        total: 25,
        summary: { pending: 25, critical: 25, warning: 0, silenced: 0 },
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 'event-page-2',
            name: '第二页告警',
            severity: 'critical',
            status: 'active',
            source: 'source-page-2',
            count: 1,
            lastTriggeredAt: Date.now(),
          },
        ],
        total: 25,
        summary: { pending: 25, critical: 25, warning: 0, silenced: 0 },
      });

    render(
      <MemoryRouter>
        <AlertList />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fetchAlertEventsMock).toHaveBeenCalledWith(1, 10, {
        status: undefined,
        severity: undefined,
        query: undefined,
      });
    });

    expect(await screen.findByText('第一页告警')).toBeTruthy();

    fireEvent.click(screen.getByText('2'));

    await waitFor(() => {
      expect(fetchAlertEventsMock).toHaveBeenCalledWith(2, 10, {
        status: undefined,
        severity: undefined,
        query: undefined,
      });
    });

    expect(await screen.findByText('第二页告警')).toBeTruthy();
  });
});

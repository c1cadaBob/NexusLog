/* @vitest-environment jsdom */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

describe('AlertList initial fetch dedupe', () => {
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

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('issues only one initial fetch under StrictMode while the first request is in flight', async () => {
    let resolveFetch: ((value: { items: []; total: number }) => void) | undefined;

    fetchAlertEventsMock.mockImplementation(
      () =>
        new Promise<{ items: []; total: number }>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    render(
      <React.StrictMode>
        <MemoryRouter>
          <AlertList />
        </MemoryRouter>
      </React.StrictMode>,
    );

    await waitFor(() => {
      expect(fetchAlertEventsMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchAlertEventsMock).toHaveBeenCalledWith(1, 200, undefined);

    if (!resolveFetch) {
      throw new Error('resolveFetch was not initialized');
    }

    resolveFetch({ items: [], total: 0 });

    await screen.findByText('暂无告警');
  });
});

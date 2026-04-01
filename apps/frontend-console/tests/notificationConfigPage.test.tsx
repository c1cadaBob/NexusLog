/* @vitest-environment jsdom */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from 'antd';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import NotificationConfig from '../src/pages/alerts/NotificationConfig';

const fetchNotificationChannelsMock = vi.fn();
const createNotificationChannelMock = vi.fn();
const updateNotificationChannelMock = vi.fn();
const deleteNotificationChannelMock = vi.fn();
const testNotificationChannelMock = vi.fn();

vi.mock('../src/api/notification', () => ({
  fetchNotificationChannels: (...args: unknown[]) => fetchNotificationChannelsMock(...args),
  createNotificationChannel: (...args: unknown[]) => createNotificationChannelMock(...args),
  updateNotificationChannel: (...args: unknown[]) => updateNotificationChannelMock(...args),
  deleteNotificationChannel: (...args: unknown[]) => deleteNotificationChannelMock(...args),
  testNotificationChannel: (...args: unknown[]) => testNotificationChannelMock(...args),
}));

vi.mock('../src/stores/themeStore', () => ({
  useThemeStore: (selector: (state: { isDark: boolean }) => unknown) => selector({ isDark: false }),
}));

vi.mock('../src/components/common/useUnnamedFormFieldAccessibility', () => ({
  useUnnamedFormFieldAccessibility: () => null,
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
      <NotificationConfig />
    </App>,
  );
}

describe('NotificationConfig page', () => {
  beforeEach(() => {
    installDomMocks();
    fetchNotificationChannelsMock.mockReset();
    createNotificationChannelMock.mockReset();
    updateNotificationChannelMock.mockReset();
    deleteNotificationChannelMock.mockReset();
    testNotificationChannelMock.mockReset();
    fetchNotificationChannelsMock.mockResolvedValue([]);
    createNotificationChannelMock.mockResolvedValue({ id: 'channel-new' });
    updateNotificationChannelMock.mockResolvedValue({});
    deleteNotificationChannelMock.mockResolvedValue(undefined);
    testNotificationChannelMock.mockResolvedValue({ sent: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('submits email recipients in channel config', async () => {
    renderPage();

    await waitFor(() => {
      expect(fetchNotificationChannelsMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /新建渠道/ }));

    fireEvent.change(screen.getByPlaceholderText('输入渠道名称'), {
      target: { value: '运维告警邮箱' },
    });
    fireEvent.change(screen.getByPlaceholderText('smtp.example.com'), {
      target: { value: 'smtp.example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('587'), {
      target: { value: '465' },
    });
    fireEvent.change(screen.getByPlaceholderText('alerts@example.com'), {
      target: { value: 'alerts@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('ops@example.com, oncall@example.com'), {
      target: { value: 'ops@example.com, oncall@example.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: /创\s*建/ }));

    await waitFor(() => {
      expect(createNotificationChannelMock).toHaveBeenCalledTimes(1);
    });

    expect(createNotificationChannelMock).toHaveBeenCalledWith(expect.objectContaining({
      name: '运维告警邮箱',
      type: 'email',
      enabled: true,
      config: expect.objectContaining({
        smtp_host: 'smtp.example.com',
        smtp_port: 465,
        from_email: 'alerts@example.com',
        recipients: ['ops@example.com', 'oncall@example.com'],
      }),
    }));
  });

  it('uses the first configured recipient for test email', async () => {
    fetchNotificationChannelsMock.mockResolvedValueOnce([
      {
        id: 'channel-1',
        name: '值班邮箱',
        type: 'email',
        config: {
          smtp_host: 'smtp.example.com',
          smtp_port: 465,
          from_email: 'alerts@example.com',
          recipients: ['ops@example.com', 'oncall@example.com'],
          use_tls: true,
        },
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    renderPage();

    await waitFor(() => {
      expect(fetchNotificationChannelsMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /测试连接/ }));

    await waitFor(() => {
      expect(testNotificationChannelMock).toHaveBeenCalledTimes(1);
    });

    expect(testNotificationChannelMock).toHaveBeenCalledWith('channel-1', 'ops@example.com');
  });
});

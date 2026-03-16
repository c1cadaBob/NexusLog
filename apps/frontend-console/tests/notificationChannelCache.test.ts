// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/runtime-config', () => ({
  getRuntimeConfig: () => ({
    apiBaseUrl: '/api/v1',
    tenantId: '00000000-0000-0000-0000-000000000001',
    tenantID: '00000000-0000-0000-0000-000000000001',
  }),
}));

function buildChannel(id: string) {
  return {
    id,
    tenant_id: '00000000-0000-0000-0000-000000000001',
    name: `channel-${id}`,
    type: 'email',
    config: {
      from_email: `${id}@example.com`,
    },
    enabled: true,
    created_at: '2026-03-16T06:00:00Z',
    updated_at: '2026-03-16T06:00:00Z',
  };
}

describe('notification channel cache', () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('nexuslog-access-token', 'notification-cache-test-token');
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        code: 'OK',
        message: 'ok',
        data: {
          items: [buildChannel('1')],
        },
        meta: {
          total: 1,
          has_next: false,
        },
      }),
    } as Response));
  });

  it('dedupes concurrent list loads and reuses cached result', async () => {
    const notificationApi = await import('../src/api/notification');

    const [first, second] = await Promise.all([
      notificationApi.fetchNotificationChannels(),
      notificationApi.fetchNotificationChannels(),
    ]);
    const third = await notificationApi.fetchNotificationChannels();

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(third).toHaveLength(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('invalidates cached list when forced refresh is requested', async () => {
    const notificationApi = await import('../src/api/notification');

    await notificationApi.fetchNotificationChannels();
    await notificationApi.fetchNotificationChannels({ force: true });

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});

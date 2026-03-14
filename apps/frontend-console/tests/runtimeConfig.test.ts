/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRuntimeConfig, loadRuntimeConfig } from '../src/config/runtime-config';

describe('runtime config loader', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('merges local override config and syncs tenant id to localStorage', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({
            apiBaseUrl: '/api/v1',
            appName: 'NexusLog',
            version: '0.2.0',
            features: { enableAnalytics: false },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({
            tenantId: '11111111-1111-1111-1111-111111111111',
            theme: { primaryColor: '#722ed1' },
          }),
        }),
    );

    const config = await loadRuntimeConfig();

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/^\/config\/app-config\.json\?t=\d+$/),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/^\/config\/app-config\.local\.json\?t=\d+$/),
    );
    expect(config.tenantId).toBe('11111111-1111-1111-1111-111111111111');
    expect(config.theme.primaryColor).toBe('#722ed1');
    expect(getRuntimeConfig().tenantId).toBe('11111111-1111-1111-1111-111111111111');
    expect(window.localStorage.getItem('nexuslog-tenant-id')).toBe(
      '11111111-1111-1111-1111-111111111111',
    );
  });

  it('keeps base config when local override file is absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({
            apiBaseUrl: '/api/v1',
            tenantId: '22222222-2222-2222-2222-222222222222',
            appName: 'NexusLog',
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: vi.fn(),
        }),
    );

    const config = await loadRuntimeConfig();

    expect(config.tenantId).toBe('22222222-2222-2222-2222-222222222222');
    expect(window.localStorage.getItem('nexuslog-tenant-id')).toBe(
      '22222222-2222-2222-2222-222222222222',
    );
  });
});

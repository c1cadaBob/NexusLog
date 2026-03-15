// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/runtime-config', () => ({
  getRuntimeConfig: () => ({
    apiBaseUrl: '/api/v1',
    tenantId: '00000000-0000-0000-0000-000000000001',
    tenantID: '00000000-0000-0000-0000-000000000001',
    wsBaseUrl: '/ws',
    appName: 'NexusLog',
    version: '0.0.0-test',
    features: {
      enableWebSocket: false,
      enableOfflineMode: false,
      enableAnalytics: false,
    },
    theme: {
      defaultMode: 'light',
      primaryColor: '#1890ff',
    },
    session: {
      idleTimeoutMinutes: 30,
      refreshIntervalMinutes: 5,
    },
  }),
}));

import { fetchAggregateStats, fetchDashboardOverview, queryRealtimeLogs } from '../src/api/query';
import { ACCESS_TOKEN_KEY, TOKEN_EXPIRES_AT_KEY } from '../src/utils/authStorage';

describe('query api emergency fallback', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(ACCESS_TOKEN_KEY, 'emergency-access-demo-token');
    window.localStorage.setItem(TOKEN_EXPIRES_AT_KEY, String(Date.now() + 60_000));
    globalThis.fetch = vi.fn();
  });

  it('builds dashboard overview locally when current token is emergency access', async () => {
    const result = await fetchDashboardOverview();

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result.total_logs).toBeGreaterThan(0);
    expect(result.top_sources.length).toBeGreaterThan(0);
    expect(result.top_sources[0]).toEqual(expect.objectContaining({
      host: expect.any(String),
      service: expect.any(String),
      source: expect.any(String),
    }));
  });

  it('returns realtime logs locally for emergency access sessions', async () => {
    const result = await queryRealtimeLogs({
      keywords: 'service:payments',
      page: 1,
      pageSize: 10,
      recordHistory: true,
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result.hits.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
    expect(result.hits[0]?.service.toLowerCase()).toContain('payments');
  });

  it('builds aggregate buckets locally for emergency access sessions', async () => {
    const result = await fetchAggregateStats({
      groupBy: 'minute',
      timeRange: '1h',
      keywords: 'host:prod-node-sh01',
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result.buckets.length).toBeGreaterThan(0);
    expect(result.buckets[0]?.key).toContain('T');
  });
});

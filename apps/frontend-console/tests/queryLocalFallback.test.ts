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
      source: expect.stringContaining(' / '),
    }));
    expect(result.top_sources.every((item) => !item.source.startsWith('/'))).toBe(true);
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

  it('uses stable host-service keys for local source aggregates', async () => {
    const result = await fetchAggregateStats({
      groupBy: 'source',
      timeRange: '7d',
      keywords: '',
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result.buckets.length).toBeGreaterThan(0);
    expect(result.buckets[0]).toEqual(expect.objectContaining({
      host: expect.any(String),
      service: expect.any(String),
      label: expect.stringContaining(' / '),
    }));
    expect(result.buckets.every((bucket) => bucket.key.includes('\u001f'))).toBe(true);
    expect(result.buckets.every((bucket) => !bucket.key.startsWith('/'))).toBe(true);
  });

  it('parses lower-bound totals from query api metadata', async () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, 'standard-demo-token');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 'OK',
        message: 'ok',
        data: {
          hits: [
            {
              id: 'log-1',
              timestamp: '2026-03-16T06:00:00Z',
              level: 'info',
              service: 'query-api',
              message: 'hello',
              fields: {},
            },
          ],
        },
        meta: {
          total: 10000,
          total_relation: 'gte',
          page: 1,
          page_size: 20,
          has_next: true,
          query_time_ms: 88,
          timed_out: false,
        },
      }),
    } as Response);

    const result = await queryRealtimeLogs({
      keywords: '',
      page: 1,
      pageSize: 20,
    });

    expect(globalThis.fetch).toHaveBeenCalled();
    expect(result.total).toBe(10000);
    expect(result.totalIsLowerBound).toBe(true);
    expect(result.hasNext).toBe(true);
  });
});

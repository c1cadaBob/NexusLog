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

import { fetchAggregateStats, fetchAnomalyStats, fetchDashboardOverview, fetchLogClusters, queryRealtimeLogs } from '../src/api/query';
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

  it('requests dashboard overview with explicit range when using query api', async () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, 'standard-demo-token');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 'OK',
        message: 'ok',
        data: {
          total_logs: 7,
          level_distribution: { debug: 0, info: 7, warn: 0, error: 0, fatal: 0 },
          top_sources: [],
          alert_summary: { total: 0, firing: 0, resolved: 0 },
          log_trend: [],
        },
      }),
    } as Response);

    await fetchDashboardOverview('7d');

    expect(globalThis.fetch).toHaveBeenCalled();
    const [requestUrl] = vi.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(String(requestUrl)).toContain('/api/v1/query/stats/overview?range=7d');
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

  it('falls back to realtime-log-derived aggregate stats when aggregate endpoint is temporarily unavailable', async () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, 'standard-demo-token');
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          code: 'QUERY_SERVICE_UNAVAILABLE',
          message: 'search backend is temporarily unavailable',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          code: 'OK',
          message: 'ok',
          data: {
            hits: [
              { id: 'agg-1', timestamp: '2026-04-01T00:00:00Z', level: 'error', service: 'audit.log', message: 'failure 1', fields: {} },
              { id: 'agg-2', timestamp: '2026-04-01T00:05:00Z', level: 'error', service: 'audit.log', message: 'failure 2', fields: {} },
              { id: 'agg-3', timestamp: '2026-04-01T00:10:00Z', level: 'warn', service: 'audit.log', message: 'warning 1', fields: {} },
              { id: 'agg-4', timestamp: '2026-04-01T00:15:00Z', level: 'info', service: 'audit.log', message: 'info 1', fields: {} },
            ],
          },
          meta: {
            total: 4,
            page: 1,
            page_size: 4,
            has_next: false,
            query_time_ms: 25,
            timed_out: false,
          },
        }),
      } as Response);

    const result = await fetchAggregateStats({
      groupBy: 'level',
      timeRange: '24h',
      filters: { service: 'audit.log' },
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(globalThis.fetch).mock.calls[0]?.[0])).toContain('/api/v1/query/stats/aggregate');
    expect(String(vi.mocked(globalThis.fetch).mock.calls[1]?.[0])).toContain('/api/v1/query/logs');
    expect(result.buckets).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'error', count: 2 }),
      expect.objectContaining({ key: 'warn', count: 1 }),
      expect.objectContaining({ key: 'info', count: 1 }),
    ]));
  });

  it('falls back to realtime-log-derived clusters when clustering endpoint is temporarily unavailable', async () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, 'standard-demo-token');
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          code: 'QUERY_SERVICE_UNAVAILABLE',
          message: 'search backend is temporarily unavailable',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          code: 'OK',
          message: 'ok',
          data: {
            hits: [
              { id: 'cluster-1', timestamp: '2026-04-01T00:00:00Z', level: 'error', service: 'auth-api', host: 'node-1', message: 'user alice login failed from 10.0.0.1', fields: {} },
              { id: 'cluster-2', timestamp: '2026-04-01T00:01:00Z', level: 'error', service: 'auth-api', host: 'node-1', message: 'user bob login failed from 10.0.0.2', fields: {} },
              { id: 'cluster-3', timestamp: '2026-04-01T00:02:00Z', level: 'error', service: 'auth-api', host: 'node-2', message: 'user carol login failed from 10.0.0.3', fields: {} },
            ],
          },
          meta: {
            total: 3,
            page: 1,
            page_size: 3,
            has_next: false,
            query_time_ms: 18,
            timed_out: false,
          },
        }),
      } as Response);

    const result = await fetchLogClusters({
      timeRange: '24h',
      filters: { service: 'auth-api' },
      sampleSize: 200,
      limit: 10,
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(globalThis.fetch).mock.calls[0]?.[0])).toContain('/api/v1/query/stats/clusters');
    expect(String(vi.mocked(globalThis.fetch).mock.calls[1]?.[0])).toContain('/api/v1/query/logs');
    expect(result.summary.analyzed_logs_total).toBe(3);
    expect(result.summary.unique_patterns).toBeGreaterThan(0);
    expect(result.patterns[0]).toEqual(expect.objectContaining({
      level: 'error',
      occurrences: 3,
    }));
    expect(result.patterns[0]?.template).toContain('user {USER_ID}');
  });

  it('falls back to aggregate-derived anomaly stats when anomaly endpoint is temporarily unavailable', async () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, 'standard-demo-token');
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          code: 'QUERY_SERVICE_UNAVAILABLE',
          message: 'search backend is temporarily unavailable',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          code: 'OK',
          message: 'ok',
          data: {
            buckets: [
              { key: '2026-04-01T00:00:00Z', count: 100 },
              { key: '2026-04-01T01:00:00Z', count: 110 },
              { key: '2026-04-01T02:00:00Z', count: 95 },
              { key: '2026-04-01T03:00:00Z', count: 105 },
              { key: '2026-04-01T04:00:00Z', count: 520 },
              { key: '2026-04-01T05:00:00Z', count: 98 },
            ],
          },
        }),
      } as Response);

    const result = await fetchAnomalyStats({
      timeRange: '24h',
      filters: { service: 'audit.log' },
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(globalThis.fetch).mock.calls[0]?.[0])).toContain('/api/v1/query/stats/anomalies');
    expect(String(vi.mocked(globalThis.fetch).mock.calls[1]?.[0])).toContain('/api/v1/query/stats/aggregate');
    expect(result.trend.length).toBe(6);
    expect(result.summary.total_anomalies).toBeGreaterThan(0);
    expect(result.anomalies[0]).toEqual(expect.objectContaining({
      title: '日志量激增',
      service: 'audit.log',
      metric: 'log_volume',
    }));
  });
});

// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRealtimeLogsMock } = vi.hoisted(() => ({
  queryRealtimeLogsMock: vi.fn(),
}));

vi.mock('../src/config/runtime-config', () => ({
  getRuntimeConfig: () => ({
    apiBaseUrl: '/api/v1',
    tenantId: '00000000-0000-0000-0000-000000000001',
    tenantID: '00000000-0000-0000-0000-000000000001',
  }),
}));

vi.mock('../src/api/query', () => ({
  queryRealtimeLogs: queryRealtimeLogsMock,
}));

function buildApplicationAuditItems(page: number, pageSize: number) {
  return Array.from({ length: pageSize }, (_, index) => {
    const ordinal = (page - 1) * pageSize + index + 1;
    return {
      id: `app-${ordinal}`,
      user_id: `user-${ordinal}`,
      action: 'users.read',
      resource_type: 'users',
      resource_id: `user-${ordinal}`,
      detail: {},
      ip_address: '192.168.0.10',
      created_at: new Date(Date.UTC(2026, 2, 16, 6, 0, 0) - ordinal * 1000).toISOString(),
    };
  });
}

function buildSystemAuditHits(page: number, pageSize: number) {
  return Array.from({ length: pageSize }, (_, index) => {
    const ordinal = (page - 1) * pageSize + index + 1;
    return {
      id: `system-${ordinal}`,
      timestamp: new Date(Date.UTC(2026, 2, 16, 6, 30, 0) - ordinal * 1000).toISOString(),
      level: 'info',
      service: 'audit.log',
      host: 'dev-server-centos8',
      hostIp: '192.168.0.202',
      message: `type=SYSCALL msg=audit(1773399501.815:${ordinal}): pid=${1000 + ordinal} uid=0 auid=0`,
      fields: {
        tenant_id: '00000000-0000-0000-0000-000000000001',
      },
    };
  });
}

describe('fetchAuditLogs pagination strategy', () => {
  beforeEach(() => {
    vi.resetModules();
    queryRealtimeLogsMock.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('nexuslog-access-token', 'audit-pagination-test-token');
  });

  it('uses incremental per-page fetches when the query has an explicit snapshot end time', async () => {
    const auditRequests: Array<{ page: number; pageSize: number; to: string }> = [];
    const snapshotTo = '2026-03-16T14:30:00.000Z';

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://127.0.0.1:3000');
      if (url.pathname !== '/api/v1/audit/logs') {
        throw new Error(`unexpected request: ${url.pathname}`);
      }

      const page = Number(url.searchParams.get('page') ?? '1');
      const pageSize = Number(url.searchParams.get('page_size') ?? '20');
      const to = url.searchParams.get('to') ?? '';
      auditRequests.push({ page, pageSize, to });

      return {
        ok: true,
        status: 200,
        json: async () => ({
          code: 'OK',
          message: 'ok',
          data: {
            items: buildApplicationAuditItems(page, pageSize),
          },
          meta: {
            total: 100,
            has_next: page * pageSize < 100,
          },
        }),
      } as Response;
    });

    queryRealtimeLogsMock.mockImplementation(async (payload: { page: number; pageSize: number; timeRange?: { to?: string } }) => ({
      hits: buildSystemAuditHits(payload.page, payload.pageSize),
      total: 100,
      page: payload.page,
      pageSize: payload.pageSize,
      hasNext: payload.page * payload.pageSize < 100,
      queryTimeMS: 5,
      timedOut: false,
      aggregations: {},
      totalIsLowerBound: false,
    }));

    const { fetchAuditLogs } = await import('../src/api/audit');

    const firstPage = await fetchAuditLogs({
      page: 1,
      page_size: 10,
      to: snapshotTo,
      sort_by: 'created_at',
      sort_order: 'desc',
    });
    const secondPage = await fetchAuditLogs({
      page: 2,
      page_size: 10,
      to: snapshotTo,
      sort_by: 'created_at',
      sort_order: 'desc',
    });
    await fetchAuditLogs({
      page: 2,
      page_size: 10,
      to: snapshotTo,
      sort_by: 'created_at',
      sort_order: 'desc',
    });

    expect(firstPage.items).toHaveLength(10);
    expect(secondPage.items).toHaveLength(10);
    expect(auditRequests).toEqual([
      { page: 1, pageSize: 10, to: snapshotTo },
      { page: 2, pageSize: 10, to: snapshotTo },
    ]);
    expect(queryRealtimeLogsMock).toHaveBeenCalledTimes(2);
    expect(queryRealtimeLogsMock.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      page: 1,
      pageSize: 10,
      timeRange: expect.objectContaining({ to: snapshotTo }),
    }));
    expect(queryRealtimeLogsMock.mock.calls[1]?.[0]).toEqual(expect.objectContaining({
      page: 1,
      pageSize: 20,
      timeRange: expect.objectContaining({ to: snapshotTo }),
    }));
  });
});

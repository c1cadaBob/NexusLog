import { describe, expect, it } from 'vitest';
import {
  canAccessRoute,
  evaluateRouteAccess,
  findRouteAuthorizationRule,
} from '../src/auth/routeAuthorization';

const USER_WRITE_ROUTE_REMOVALS = [
  '/ingestion/sources',
  '/ingestion/agents',
  '/ingestion/wizard',
  '/ingestion/status',
  '/parsing/mapping',
  '/parsing/rules',
  '/parsing/masking',
  '/parsing/dictionary',
  '/storage/indices',
  '/storage/ilm',
  '/storage/backup',
  '/storage/capacity',
  '/performance/dr',
  '/integration/webhook',
  '/integration/plugins',
] as const;

describe('route authorization registry', () => {
  it('matches dynamic incident detail route', () => {
    const rule = findRouteAuthorizationRule('/incidents/detail/123');
    expect(rule?.path).toBe('/incidents/detail/:id');
  });

  it('allows route access via capability or legacy permission alias', () => {
    expect(
      canAccessRoute('/security/audit', {
        permissions: [],
        capabilities: ['audit.log.read'],
      }),
    ).toBe(true);

    expect(
      canAccessRoute('/security/audit', {
        permissions: ['audit:read'],
        capabilities: [],
      }),
    ).toBe(true);
  });

  it('keeps bookmark alias aligned with saved query authorization', () => {
    expect(findRouteAuthorizationRule('/search/bookmark')?.path).toBe('/search/bookmark');

    expect(
      canAccessRoute('/search/bookmark', {
        permissions: [],
        capabilities: ['query.saved.read'],
      }),
    ).toBe(true);

    expect(
      canAccessRoute('/search/bookmark', {
        permissions: ['logs:read'],
        capabilities: [],
      }),
    ).toBe(true);

    expect(
      evaluateRouteAccess('/search/bookmark', {
        permissions: [],
        capabilities: ['query.saved.read'],
      }),
    ).toEqual({ allowed: true });
  });

  it('does not let dashboards:read borrow access to report management', () => {
    expect(
      canAccessRoute('/reports/management', {
        permissions: ['dashboards:read'],
        capabilities: [],
      }),
    ).toBe(false);

    expect(
      canAccessRoute('/reports/management', {
        permissions: [],
        capabilities: ['report.read'],
      }),
    ).toBe(true);

    expect(
      canAccessRoute('/reports/management', {
        permissions: [],
        capabilities: ['query.saved.read'],
      }),
    ).toBe(true);
  });

  it('removes scheduled tasks from the route authorization registry', () => {
    expect(findRouteAuthorizationRule('/reports/scheduled')).toBeUndefined();
  });

  it('does not let dashboards:read borrow access to download records', () => {
    expect(
      canAccessRoute('/reports/downloads', {
        permissions: ['dashboards:read'],
        capabilities: [],
      }),
    ).toBe(false);

    expect(
      canAccessRoute('/reports/downloads', {
        permissions: ['logs:export'],
        capabilities: [],
      }),
    ).toBe(true);
  });

  it('does not let users:write borrow access to login policy and settings routes', () => {
    expect(
      canAccessRoute('/security/login-policy', {
        permissions: ['users:write'],
        capabilities: [],
      }),
    ).toBe(false);

    expect(
      canAccessRoute('/settings/parameters', {
        permissions: ['users:write'],
        capabilities: [],
      }),
    ).toBe(false);

    expect(
      canAccessRoute('/settings/global', {
        permissions: ['users:write'],
        capabilities: [],
      }),
    ).toBe(false);

    expect(
      canAccessRoute('/settings/versions', {
        permissions: ['users:write'],
        capabilities: [],
      }),
    ).toBe(false);
  });

  it('keeps login policy and settings routes available through explicit capabilities', () => {
    expect(
      canAccessRoute('/security/login-policy', {
        permissions: [],
        capabilities: ['auth.login_policy.read'],
      }),
    ).toBe(true);

    expect(
      canAccessRoute('/settings/parameters', {
        permissions: [],
        capabilities: ['settings.parameter.read'],
      }),
    ).toBe(true);

    expect(
      canAccessRoute('/settings/global', {
        permissions: [],
        capabilities: ['settings.global.read'],
      }),
    ).toBe(true);

    expect(
      canAccessRoute('/settings/versions', {
        permissions: [],
        capabilities: ['settings.version.read'],
      }),
    ).toBe(true);
  });

  it('does not let users:write borrow access to ingestion, parsing, storage, platform, and integration routes', () => {
    for (const path of USER_WRITE_ROUTE_REMOVALS) {
      expect(
        canAccessRoute(path, {
          permissions: ['users:write'],
          capabilities: [],
        }),
      ).toBe(false);
    }
  });

  it('keeps those routes available through their explicit capabilities', () => {
    expect(
      canAccessRoute('/ingestion/sources', {
        permissions: [],
        capabilities: ['ingest.source.read'],
      }),
    ).toBe(true);

    expect(
      canAccessRoute('/ingestion/agents', {
        permissions: [],
        capabilities: ['agent.read'],
      }),
    ).toBe(true);

    expect(
      canAccessRoute('/ingestion/status', {
        permissions: [],
        capabilities: ['ingest.task.read'],
      }),
    ).toBe(true);

    expect(
      canAccessRoute('/parsing/mapping', {
        permissions: [],
        capabilities: ['field.mapping.read'],
      }),
    ).toBe(true);

    expect(
      canAccessRoute('/storage/indices', {
        permissions: [],
        capabilities: ['storage.index.read'],
      }),
    ).toBe(true);

    expect(
      canAccessRoute('/integration/webhook', {
        permissions: [],
        capabilities: ['integration.webhook.read_metadata'],
      }),
    ).toBe(true);

    expect(
      canAccessRoute('/integration/webhook', {
        permissions: [],
        capabilities: ['notification.channel.read_metadata'],
      }),
    ).toBe(true);

    expect(
      canAccessRoute('/integration/webhook', {
        permissions: ['alerts:read'],
        capabilities: [],
      }),
    ).toBe(true);
  });

  it('keeps metrics:read compatibility for metrics-adjacent routes', () => {
    expect(
      canAccessRoute('/ingestion/status', {
        permissions: ['metrics:read'],
        capabilities: [],
      }),
    ).toBe(true);

    expect(
      canAccessRoute('/storage/capacity', {
        permissions: ['metrics:read'],
        capabilities: [],
      }),
    ).toBe(true);

    expect(
      canAccessRoute('/performance/dr', {
        permissions: ['metrics:read'],
        capabilities: [],
      }),
    ).toBe(true);
  });

  it('returns first accessible fallback for denied route', () => {
    const decision = evaluateRouteAccess('/security/users', {
      permissions: ['logs:read'],
      capabilities: ['log.query.read'],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.fallbackPath).toBe('/search/realtime');
  });
});

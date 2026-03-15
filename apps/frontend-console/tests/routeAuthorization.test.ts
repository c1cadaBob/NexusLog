import { describe, expect, it } from 'vitest';
import {
  canAccessRoute,
  evaluateRouteAccess,
  findRouteAuthorizationRule,
} from '../src/auth/routeAuthorization';

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
  });

  it('does not let dashboards:read borrow access to scheduled tasks', () => {
    expect(
      canAccessRoute('/reports/scheduled', {
        permissions: ['dashboards:read'],
        capabilities: [],
      }),
    ).toBe(false);

    expect(
      canAccessRoute('/reports/scheduled', {
        permissions: [],
        capabilities: ['report.schedule.read'],
      }),
    ).toBe(true);
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

  it('returns first accessible fallback for denied route', () => {
    const decision = evaluateRouteAccess('/security/users', {
      permissions: ['logs:read'],
      capabilities: ['log.query.read'],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.fallbackPath).toBe('/search/realtime');
  });
});

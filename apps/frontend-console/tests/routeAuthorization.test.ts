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

  it('returns first accessible fallback for denied route', () => {
    const decision = evaluateRouteAccess('/security/users', {
      permissions: ['logs:read'],
      capabilities: ['log.query.read'],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.fallbackPath).toBe('/search/realtime');
  });
});

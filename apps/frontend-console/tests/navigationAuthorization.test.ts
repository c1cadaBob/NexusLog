import { describe, expect, it } from 'vitest';
import { MENU_SECTIONS } from '../src/constants/menu';
import { filterSectionsByAuthorization } from '../src/components/layout/AppSidebar';
import { resolveMobileBottomNavItems } from '../src/components/layout/MobileBottomNav';

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
  '/integration/webhook',
] as const;

function collectVisiblePaths(sections: typeof MENU_SECTIONS): string[] {
  return sections.flatMap((section) =>
    section.items.flatMap((item) => {
      if (item.children) {
        return item.children.map((child) => child.path).filter((path): path is string => Boolean(path));
      }
      return item.path ? [item.path] : [];
    }),
  );
}

describe('navigation authorization', () => {
  it('filters sidebar entries by route registry for dashboard-only sessions', () => {
    const sections = filterSectionsByAuthorization(
      MENU_SECTIONS,
      {
        permissions: ['dashboards:read'],
        capabilities: [],
      },
      true,
    );

    const visiblePaths = collectVisiblePaths(sections);

    expect(visiblePaths).toContain('/');
    expect(visiblePaths).not.toContain('/alerts/list');
    expect(visiblePaths).not.toContain('/reports/management');
    expect(visiblePaths).not.toContain('/security/users');
    expect(visiblePaths).not.toContain('/settings/parameters');
  });

  it('keeps only accessible report center children for granular report access', () => {
    const sections = filterSectionsByAuthorization(
      MENU_SECTIONS,
      {
        permissions: [],
        capabilities: ['report.read'],
      },
      true,
    );

    const observabilitySection = sections.find((section) => section.title === '可观测性扩展');
    const reportCenterItem = observabilitySection?.items.find((item) => item.label === '报表中心');
    const childPaths = reportCenterItem?.children?.map((child) => child.path) ?? [];

    expect(childPaths).toEqual(['/reports/management']);
  });

  it('returns only overview in mobile nav for dashboard-only sessions', () => {
    const navItems = resolveMobileBottomNavItems(
      {
        permissions: ['dashboards:read'],
        capabilities: [],
      },
      true,
    );

    expect(navItems.map((item) => item.path)).toEqual(['/']);
  });

  it('does not expose settings, ingestion, parsing, storage, platform, and integration navigation through users:write alone', () => {
    const sections = filterSectionsByAuthorization(
      MENU_SECTIONS,
      {
        permissions: ['users:write', 'dashboards:read'],
        capabilities: [],
      },
      true,
    );

    const visiblePaths = collectVisiblePaths(sections);

    expect(visiblePaths).not.toContain('/security/login-policy');
    expect(visiblePaths).not.toContain('/settings/parameters');
    expect(visiblePaths).not.toContain('/settings/global');
    expect(visiblePaths).not.toContain('/settings/versions');

    for (const path of USER_WRITE_ROUTE_REMOVALS) {
      expect(visiblePaths).not.toContain(path);
    }

    const navItems = resolveMobileBottomNavItems(
      {
        permissions: ['users:write', 'dashboards:read'],
        capabilities: [],
      },
      true,
    );

    expect(navItems.map((item) => item.path)).toEqual(['/']);
  });

  it('returns route-accessible mobile tabs with granular capabilities', () => {
    const navItems = resolveMobileBottomNavItems(
      {
        permissions: [],
        capabilities: ['dashboard.read', 'log.query.read', 'alert.event.read', 'settings.parameter.read'],
      },
      true,
    );

    expect(navItems.map((item) => item.path)).toEqual([
      '/',
      '/search/realtime',
      '/alerts/list',
      '/settings/parameters',
    ]);
  });

  it('returns no mobile nav items before authorization is ready', () => {
    const navItems = resolveMobileBottomNavItems(
      {
        permissions: ['*'],
        capabilities: ['*'],
      },
      false,
    );

    expect(navItems).toEqual([]);
  });
});

import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Badge } from 'antd';
import { canAccessRoute } from '../../auth/routeAuthorization';
import { useAlertStore } from '../../stores/alertStore';
import { useAuthStore } from '../../stores/authStore';
import type { AuthorizationSnapshot } from '../../types/authz';

export const NAV_ITEMS = [
  { icon: 'dashboard', label: '概览', path: '/' },
  { icon: 'search', label: '搜索', path: '/search/realtime' },
  { icon: 'notifications_active', label: '告警', path: '/alerts/list' },
  { icon: 'settings', label: '设置', path: '/settings/parameters' },
];

export function resolveMobileBottomNavItems(
  authorization: Pick<AuthorizationSnapshot, 'permissions' | 'capabilities'>,
  authzReady: boolean,
): typeof NAV_ITEMS {
  if (!authzReady) {
    return [];
  }

  return NAV_ITEMS.filter((item) => canAccessRoute(item.path, authorization));
}

/** 移动端底部导航栏 */
const MobileBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useAlertStore((s) => s.unreadCount);
  const permissions = useAuthStore((s) => s.permissions);
  const capabilities = useAuthStore((s) => s.capabilities);
  const authzReady = useAuthStore((s) => s.authzReady);

  const navItems = useMemo(
    () => resolveMobileBottomNavItems({ permissions, capabilities }, authzReady),
    [authzReady, capabilities, permissions],
  );

  return (
    <nav
      className="safe-area-bottom"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: 56,
        borderTop: '1px solid var(--ant-color-border, #334155)',
        background: 'var(--ant-color-bg-container, #1e293b)',
        zIndex: 100,
      }}
      role="navigation"
      aria-label="移动端导航"
    >
      {navItems.map((item) => {
        const isActive = item.path === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(item.path);

        const content = (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 12px',
              color: isActive
                ? 'var(--ant-color-primary, #135bec)'
                : 'var(--ant-color-text-secondary, #94a3b8)',
              fontSize: 10,
              minHeight: 44,
              minWidth: 44,
              justifyContent: 'center',
            }}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        );

        if (item.icon === 'notifications_active' && unreadCount > 0) {
          return (
            <Badge key={item.path} count={unreadCount} size="small" offset={[-4, 4]}>
              {content}
            </Badge>
          );
        }

        return content;
      })}
    </nav>
  );
};

export default MobileBottomNav;

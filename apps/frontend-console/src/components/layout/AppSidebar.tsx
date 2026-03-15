import React, { useMemo } from 'react';
import { Menu, Badge, theme } from 'antd';
import type { MenuProps } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { MENU_SECTIONS } from '../../constants/menu';
import { canAccessRoute } from '../../auth/routeAuthorization';
import { useAlertStore } from '../../stores/alertStore';
import { useAuthStore } from '../../stores/authStore';
import type { AuthorizationSnapshot } from '../../types/authz';
import type { MenuItem as MenuItemType } from '../../types/navigation';

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapse?: () => void;
}

/** 根据路径查找父级菜单 key，用于自动展开（基于已过滤的 sections） */
export function getOpenKeysForPath(pathname: string, sections: typeof MENU_SECTIONS): string[] {
  const openKeys: string[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      if (item.children) {
        for (const child of item.children) {
          if (child.path === pathname) {
            openKeys.push(item.label);
          }
        }
      }
    }
  }
  return openKeys;
}

/** 获取当前选中的菜单 key（基于已过滤的 sections） */
function getSelectedKey(pathname: string, sections: typeof MENU_SECTIONS): string {
  for (const section of sections) {
    for (const item of section.items) {
      if (item.path === pathname) return item.path;
      if (item.children) {
        for (const child of item.children) {
          if (child.path === pathname) return child.path;
        }
      }
    }
  }
  for (const section of sections) {
    for (const item of section.items) {
      if (item.children) {
        for (const child of item.children) {
          if (child.path && pathname.startsWith(child.path)) return child.path;
        }
      }
    }
  }
  return '/';
}

function canAccessMenuPath(path: string | undefined, authorization: Pick<AuthorizationSnapshot, 'permissions' | 'capabilities'>): boolean {
  if (!path) return false;
  return canAccessRoute(path, authorization);
}

/** 按统一注册表过滤菜单 sections。授权未就绪时不渲染可点击菜单。 */
export function filterSectionsByAuthorization(
  sections: typeof MENU_SECTIONS,
  authorization: Pick<AuthorizationSnapshot, 'permissions' | 'capabilities'>,
  authzReady: boolean,
): typeof MENU_SECTIONS {
  if (!authzReady) {
    return [];
  }

  return sections
    .map((section) => ({
      ...section,
      items: section.items
        .map((item) => {
          if (item.children) {
            const filteredChildren = item.children.filter((child) => canAccessMenuPath(child.path, authorization));
            if (filteredChildren.length === 0) return null;
            return { ...item, children: filteredChildren };
          }
          if (canAccessMenuPath(item.path, authorization)) {
            return item;
          }
          return null;
        })
        .filter((menuItem): menuItem is NonNullable<typeof menuItem> => menuItem !== null),
    }))
    .filter((section) => section.items.length > 0);
}

/** 构建 AntD Menu items */
function buildMenuItems(
  sections: typeof MENU_SECTIONS,
  unreadCount: number,
  collapsed: boolean,
): MenuProps['items'] {
  const items: MenuProps['items'] = [];

  for (const section of sections) {
    items.push({
      type: 'group',
      label: section.title,
      children: section.items.map((item) => {
        const isAlert = item.label === '告警中心' && unreadCount > 0;

        const baseIcon = (
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            {item.icon}
          </span>
        );

        const icon = isAlert && collapsed ? (
          <Badge count={unreadCount} size="small" offset={[-2, 2]}>
            {baseIcon}
          </Badge>
        ) : baseIcon;

        const label = isAlert && !collapsed ? (
          <Badge count={unreadCount} size="small" offset={[14, 0]}>
            {item.label}
          </Badge>
        ) : (
          item.label
        );

        if (item.children) {
          return {
            key: item.label,
            icon,
            label,
            children: item.children.map((child: MenuItemType) => ({
              key: child.path!,
              icon: (
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  {child.icon}
                </span>
              ),
              label: child.label,
            })),
          };
        }

        return {
          key: item.path!,
          icon,
          label,
        };
      }),
    });
  }

  return items;
}

const AppSidebar: React.FC<AppSidebarProps> = ({ collapsed, onToggleCollapse }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useAlertStore((s) => s.unreadCount);
  const permissions = useAuthStore((s) => s.permissions);
  const capabilities = useAuthStore((s) => s.capabilities);
  const authzReady = useAuthStore((s) => s.authzReady);
  const { token } = theme.useToken();

  const authorization = useMemo(
    () => ({ permissions, capabilities }),
    [permissions, capabilities],
  );

  const filteredSections = useMemo(
    () => filterSectionsByAuthorization(MENU_SECTIONS, authorization, authzReady),
    [authorization, authzReady],
  );

  const selectedKey = useMemo(
    () => getSelectedKey(location.pathname, filteredSections),
    [location.pathname, filteredSections],
  );
  const defaultOpenKeys = useMemo(
    () => getOpenKeysForPath(location.pathname, filteredSections),
    [location.pathname, filteredSections],
  );

  const menuItems = useMemo(
    () => buildMenuItems(filteredSections, unreadCount, collapsed),
    [filteredSections, unreadCount, collapsed],
  );

  const handleClick: MenuProps['onClick'] = ({ key }) => {
    navigate(String(key));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: collapsed ? '16px 0' : '16px 12px 16px 20px',
          justifyContent: collapsed ? 'center' : 'space-between',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          minHeight: 56,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10 }}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 28, color: '#135bec' }}
          >
            analytics
          </span>
          {!collapsed && (
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>NexusLog</div>
              <div style={{ fontSize: 10, opacity: 0.5 }}>Enterprise Edition</div>
            </div>
          )}
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            style={{
              background: 'none',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              padding: 4,
              color: 'inherit',
              display: 'flex',
              alignItems: 'center',
              opacity: 0.6,
              flexShrink: 0,
            }}
            aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              {collapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={collapsed ? [] : defaultOpenKeys}
          items={menuItems}
          onClick={handleClick}
          style={{ border: 'none' }}
          inlineCollapsed={collapsed}
        />
      </div>
    </div>
  );
};

export default AppSidebar;

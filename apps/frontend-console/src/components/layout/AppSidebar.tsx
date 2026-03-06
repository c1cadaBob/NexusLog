import React, { useMemo } from 'react';
import { Menu, Badge, theme } from 'antd';
import type { MenuProps } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { MENU_SECTIONS } from '../../constants/menu';
import { useAlertStore } from '../../stores/alertStore';
import { useAuthStore } from '../../stores/authStore';
import type { MenuItem as MenuItemType } from '../../types/navigation';

function hasPermission(userPermissions: string[], required?: string | string[]): boolean {
  if (!required) return true;
  if (userPermissions.includes('*')) return true;
  const arr = Array.isArray(required) ? required : [required];
  return arr.some((p) => userPermissions.includes(p));
}

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
      if (item.path === pathname) return item.path!;
      if (item.children) {
        for (const child of item.children) {
          if (child.path === pathname) return child.path!;
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

/** 按权限过滤菜单 sections。权限未加载时显示全部菜单，避免闪烁。 */
function filterSectionsByPermission(
  sections: typeof MENU_SECTIONS,
  permissions: string[],
): typeof MENU_SECTIONS {
  if (permissions.length === 0) return sections;
  return sections
    .map((section) => ({
      ...section,
      items: section.items
        .map((item) => {
          if (item.requiredPermission && !hasPermission(permissions, item.requiredPermission)) {
            return null;
          }
          if (item.children) {
            const filteredChildren = item.children.filter(
              (child) => !child.requiredPermission || hasPermission(permissions, child.requiredPermission),
            );
            if (filteredChildren.length === 0) return null;
            return { ...item, children: filteredChildren };
          }
          return item;
        })
        .filter((i): i is NonNullable<typeof i> => i !== null),
    }))
    .filter((s) => s.items.length > 0);
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

        // 收缩时红点放图标上，展开时放文字上
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
  const { token } = theme.useToken();

  const filteredSections = useMemo(
    () => filterSectionsByPermission(MENU_SECTIONS, permissions),
    [permissions],
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
    navigate(key);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 品牌 Logo 区域 + 折叠按钮 */}
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

      {/* 菜单 */}
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

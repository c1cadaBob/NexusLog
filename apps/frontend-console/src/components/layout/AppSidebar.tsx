import React, { useMemo } from 'react';
import { Menu, Badge, theme } from 'antd';
import type { MenuProps } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { MENU_SECTIONS } from '../../constants/menu';
import { useAlertStore } from '../../stores/alertStore';
import type { MenuItem as MenuItemType } from '../../types/navigation';

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapse?: () => void;
}

/** 根据路径查找父级菜单 key，用于自动展开 */
export function getOpenKeysForPath(pathname: string): string[] {
  const openKeys: string[] = [];
  for (const section of MENU_SECTIONS) {
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

/** 获取当前选中的菜单 key */
function getSelectedKey(pathname: string): string {
  // 精确匹配
  for (const section of MENU_SECTIONS) {
    for (const item of section.items) {
      if (item.path === pathname) return item.path;
      if (item.children) {
        for (const child of item.children) {
          if (child.path === pathname) return child.path;
        }
      }
    }
  }
  // 前缀匹配
  for (const section of MENU_SECTIONS) {
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

/** 构建 AntD Menu items */
function buildMenuItems(
  sections: typeof MENU_SECTIONS,
  unreadCount: number,
  collapsed: boolean,
): MenuProps['items'] {
  const items: MenuProps['items'] = [];

  for (const section of sections) {
    // 分组标题
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
  const { token } = theme.useToken();

  const selectedKey = useMemo(() => getSelectedKey(location.pathname), [location.pathname]);
  const defaultOpenKeys = useMemo(() => getOpenKeysForPath(location.pathname), [location.pathname]);

  const menuItems = useMemo(() => buildMenuItems(MENU_SECTIONS, unreadCount, collapsed), [unreadCount, collapsed]);

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

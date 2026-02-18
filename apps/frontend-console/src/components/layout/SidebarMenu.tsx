/**
 * SidebarMenu 侧边栏菜单组件
 * 
 * 使用 Ant Design Menu 实现多级菜单导航
 * 根据当前路由自动高亮对应菜单项
 * 
 * @module components/layout/SidebarMenu
 */

import React, { useMemo } from 'react';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import * as Icons from '@ant-design/icons';
import { menuConfig, getMenuKeyByPath, getParentKeys } from '@/constants/menu';
import type { MenuConfig } from '@/constants/menu';

// ============================================================================
// 类型定义
// ============================================================================

export interface SidebarMenuProps {
  /** 是否折叠 */
  collapsed?: boolean;
}

type MenuItem = Required<MenuProps>['items'][number];

// ============================================================================
// 图标映射
// ============================================================================

/**
 * 根据图标名称获取 Ant Design 图标组件
 */
const getIcon = (iconName?: string): React.ReactNode => {
  if (!iconName) return null;
  
  // 动态获取图标组件
  const IconComponent = (Icons as unknown as Record<string, React.ComponentType>)[iconName];
  
  if (IconComponent) {
    return <IconComponent />;
  }
  
  return null;
};

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 将菜单配置转换为 Ant Design Menu items 格式
 */
const convertToMenuItems = (configs: MenuConfig[]): MenuItem[] => {
  return configs
    .filter(config => !config.hidden)
    .map(config => {
      const item: MenuItem = {
        key: config.key,
        icon: getIcon(config.icon),
        label: config.label,
      };

      if (config.children && config.children.length > 0) {
        return {
          ...item,
          children: convertToMenuItems(config.children),
        } as MenuItem;
      }

      return item;
    });
};

// ============================================================================
// 组件实现
// ============================================================================

/**
 * SidebarMenu 侧边栏菜单组件
 * 
 * 功能：
 * - 使用 Ant Design Menu 实现多级菜单导航
 * - 根据当前路由自动高亮对应菜单项
 * - 从 constants/menu.ts 读取菜单配置
 * 
 * @example
 * ```tsx
 * <SidebarMenu collapsed={false} />
 * ```
 */
export const SidebarMenu: React.FC<SidebarMenuProps> = ({ collapsed = false }) => {
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * 转换后的菜单项
   */
  const menuItems = useMemo(() => convertToMenuItems(menuConfig), []);

  /**
   * 当前选中的菜单项 key
   */
  const selectedKey = useMemo(() => {
    return getMenuKeyByPath(location.pathname) || 'dashboard';
  }, [location.pathname]);

  /**
   * 当前展开的菜单项 keys
   */
  const openKeys = useMemo(() => {
    if (collapsed) return [];
    return getParentKeys(location.pathname);
  }, [location.pathname, collapsed]);

  /**
   * 处理菜单点击
   */
  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    // 查找对应的路径
    const findPath = (items: MenuConfig[]): string | undefined => {
      for (const item of items) {
        if (item.key === key && item.path) {
          return item.path;
        }
        if (item.children) {
          const found = findPath(item.children);
          if (found) return found;
        }
      }
      return undefined;
    };

    const path = findPath(menuConfig);
    if (path) {
      navigate(path);
    }
  };

  return (
    <Menu
      mode="inline"
      selectedKeys={[selectedKey]}
      defaultOpenKeys={openKeys}
      items={menuItems}
      onClick={handleMenuClick}
      inlineCollapsed={collapsed}
      style={{
        border: 'none',
        height: 'calc(100vh - 64px)',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    />
  );
};

export default SidebarMenu;

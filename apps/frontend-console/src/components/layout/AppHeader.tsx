/**
 * AppHeader 顶部导航组件
 * 
 * 包含面包屑导航、用户信息下拉、主题切换按钮
 * 
 * @module components/layout/AppHeader
 */

import React, { useMemo } from 'react';
import { Layout, Breadcrumb, Dropdown, Button, Space, Avatar } from 'antd';
import type { MenuProps } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  BulbOutlined,
  BulbFilled,
  BellOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useThemeStore, useAuthStore, useNotificationStore } from '@/stores';
import { getBreadcrumbs } from '@/constants/menu';

const { Header } = Layout;

// ============================================================================
// 类型定义
// ============================================================================

export interface AppHeaderProps {
  /** 侧边栏是否折叠 */
  collapsed: boolean;
  /** 是否为移动端 */
  isMobile: boolean;
  /** 切换折叠状态回调 */
  onToggleCollapsed: () => void;
}

// ============================================================================
// 组件实现
// ============================================================================

/**
 * AppHeader 顶部导航组件
 * 
 * 功能：
 * - 面包屑导航
 * - 用户信息下拉菜单
 * - 主题切换按钮
 * - 通知图标
 * 
 * @example
 * ```tsx
 * <AppHeader
 *   collapsed={false}
 *   isMobile={false}
 *   onToggleCollapsed={() => setCollapsed(!collapsed)}
 * />
 * ```
 */
export const AppHeader: React.FC<AppHeaderProps> = ({
  collapsed,
  isMobile,
  onToggleCollapsed,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { colors, isDark, toggleTheme } = useThemeStore();
  const { user, logout } = useAuthStore();
  const { unreadCount } = useNotificationStore();

  /**
   * 面包屑数据
   */
  const breadcrumbItems = useMemo(() => {
    const items = getBreadcrumbs(location.pathname);
    
    // 添加首页
    const result = [
      {
        key: 'home',
        title: (
          <Link to="/dashboard">
            <HomeOutlined />
          </Link>
        ),
      },
    ];

    // 添加路径面包屑
    items.forEach((item, index) => {
      const isLast = index === items.length - 1;
      result.push({
        key: item.key,
        title: isLast ? (
          <span>{item.label}</span>
        ) : item.path ? (
          <Link to={item.path}>{item.label}</Link>
        ) : (
          <span>{item.label}</span>
        ),
      });
    });

    return result;
  }, [location.pathname]);

  /**
   * 用户下拉菜单项
   */
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
      onClick: () => navigate('/settings/profile'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '账户设置',
      onClick: () => navigate('/settings/parameters'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {
        logout();
        navigate('/login');
      },
    },
  ];

  return (
    <Header
      style={{
        padding: '0 24px',
        background: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* 左侧：折叠按钮 + 面包屑 */}
      <Space size="middle">
        {/* 折叠/展开按钮 */}
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={onToggleCollapsed}
          style={{
            fontSize: 16,
            width: 40,
            height: 40,
          }}
          aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'}
        />

        {/* 面包屑导航 - 移动端隐藏 */}
        {!isMobile && (
          <Breadcrumb items={breadcrumbItems} />
        )}
      </Space>

      {/* 右侧：主题切换 + 通知 + 用户信息 */}
      <Space size="middle">
        {/* 主题切换 */}
        <Button
          type="text"
          icon={isDark ? <BulbOutlined /> : <BulbFilled />}
          onClick={toggleTheme}
          style={{
            fontSize: 16,
            width: 40,
            height: 40,
          }}
          aria-label={isDark ? '切换到亮色模式' : '切换到暗色模式'}
        />

        {/* 通知图标 */}
        <Button
          type="text"
          icon={<BellOutlined />}
          onClick={() => navigate('/alerts/list')}
          style={{
            fontSize: 16,
            width: 40,
            height: 40,
            position: 'relative',
          }}
          aria-label="通知"
        >
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: colors.danger,
              }}
            />
          )}
        </Button>

        {/* 用户信息下拉 */}
        <Dropdown
          menu={{ items: userMenuItems }}
          placement="bottomRight"
          trigger={['click']}
        >
          <Button
            type="text"
            style={{
              height: 40,
              padding: '0 8px',
            }}
          >
            <Space>
              <Avatar
                size="small"
                icon={<UserOutlined />}
                style={{
                  background: colors.primary,
                }}
              />
              {!isMobile && (
                <span style={{ color: colors.text }}>
                  {user?.displayName || user?.username || '用户'}
                </span>
              )}
            </Space>
          </Button>
        </Dropdown>
      </Space>
    </Header>
  );
};

export default AppHeader;

/**
 * AppLayout 布局组件
 * 
 * 使用 Ant Design Layout 组件实现应用主布局
 * 包含侧边栏导航、顶部导航栏和主内容区域
 * 
 * @module components/layout/AppLayout
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Drawer } from 'antd';
import { useLocation } from 'react-router-dom';
import { SidebarMenu } from './SidebarMenu';
import { AppHeader } from './AppHeader';
import { useThemeStore } from '@/stores';
import { DEFAULT_SIDEBAR_CONFIG } from '@/types/navigation';

const { Sider, Content } = Layout;

// ============================================================================
// 类型定义
// ============================================================================

export interface AppLayoutProps {
  /** 子组件 */
  children: React.ReactNode;
}

// ============================================================================
// 常量
// ============================================================================

/** 响应式断点：小于此宽度时使用抽屉式导航 */
const MOBILE_BREAKPOINT = 768;

// ============================================================================
// 组件实现
// ============================================================================

/**
 * AppLayout 布局组件
 * 
 * 功能：
 * - 使用 Ant Design Layout、Sider、Header、Content 组件
 * - 实现侧边栏折叠/展开功能
 * - 响应式：屏幕宽度 < 768px 时转为抽屉式导航
 * - 在侧边栏顶部显示 "NexusLog" 品牌标识
 * 
 * @example
 * ```tsx
 * <AppLayout>
 *   <Dashboard />
 * </AppLayout>
 * ```
 */
export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const location = useLocation();
  const { colors } = useThemeStore();
  
  // 侧边栏折叠状态
  const [collapsed, setCollapsed] = useState(false);
  
  // 是否为移动端视图
  const [isMobile, setIsMobile] = useState(false);
  
  // 移动端抽屉可见状态
  const [drawerVisible, setDrawerVisible] = useState(false);

  /**
   * 检测屏幕宽度并更新移动端状态
   */
  const checkMobile = useCallback(() => {
    const mobile = window.innerWidth < MOBILE_BREAKPOINT;
    setIsMobile(mobile);
    
    // 移动端时自动折叠侧边栏
    if (mobile && !collapsed) {
      setCollapsed(true);
    }
  }, [collapsed]);

  /**
   * 监听窗口大小变化
   */
  useEffect(() => {
    checkMobile();
    
    const handleResize = () => {
      checkMobile();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [checkMobile]);

  /**
   * 路由变化时关闭移动端抽屉
   */
  useEffect(() => {
    if (isMobile) {
      setDrawerVisible(false);
    }
  }, [location.pathname, isMobile]);

  /**
   * 切换侧边栏折叠状态
   */
  const toggleCollapsed = useCallback(() => {
    if (isMobile) {
      setDrawerVisible(prev => !prev);
    } else {
      setCollapsed(prev => !prev);
    }
  }, [isMobile]);

  /**
   * 关闭移动端抽屉
   */
  const closeDrawer = useCallback(() => {
    setDrawerVisible(false);
  }, []);

  /**
   * 渲染侧边栏内容
   */
  const renderSidebarContent = () => (
    <>
      {/* 品牌标识 */}
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
          padding: collapsed && !isMobile ? '0 16px' : '0 24px',
          borderBottom: `1px solid ${colors.border}`,
          transition: 'all 0.2s',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {/* Logo 图标 */}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `linear-gradient(135deg, ${colors.primary} 0%, #1890ff 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            N
          </div>
          
          {/* 品牌名称 - 折叠时隐藏 */}
          {(!collapsed || isMobile) && (
            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: colors.text,
                whiteSpace: 'nowrap',
              }}
            >
              NexusLog
            </span>
          )}
        </div>
      </div>
      
      {/* 菜单 */}
      <SidebarMenu collapsed={collapsed && !isMobile} />
    </>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 桌面端侧边栏 */}
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          width={DEFAULT_SIDEBAR_CONFIG.width}
          collapsedWidth={DEFAULT_SIDEBAR_CONFIG.collapsedWidth}
          trigger={null}
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            background: colors.surface,
            borderRight: `1px solid ${colors.border}`,
          }}
        >
          {renderSidebarContent()}
        </Sider>
      )}

      {/* 移动端抽屉式导航 */}
      {isMobile && (
        <Drawer
          placement="left"
          open={drawerVisible}
          onClose={closeDrawer}
          width={DEFAULT_SIDEBAR_CONFIG.width}
          styles={{
            body: {
              padding: 0,
              background: colors.surface,
            },
            header: {
              display: 'none',
            },
          }}
        >
          {renderSidebarContent()}
        </Drawer>
      )}

      {/* 主内容区域 */}
      <Layout
        style={{
          marginLeft: isMobile ? 0 : (collapsed ? DEFAULT_SIDEBAR_CONFIG.collapsedWidth : DEFAULT_SIDEBAR_CONFIG.width),
          transition: 'margin-left 0.2s',
        }}
      >
        {/* 顶部导航栏 */}
        <AppHeader
          collapsed={collapsed}
          isMobile={isMobile}
          onToggleCollapsed={toggleCollapsed}
        />

        {/* 内容区域 */}
        <Content
          style={{
            margin: 24,
            minHeight: 'calc(100vh - 64px - 48px)',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;

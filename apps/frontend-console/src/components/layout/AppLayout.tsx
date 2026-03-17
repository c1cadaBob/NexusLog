import React, { useState, useEffect } from 'react';
import { Layout, Drawer, FloatButton } from 'antd';
import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';
import MobileBottomNav from './MobileBottomNav';
import SkipLink from '../common/SkipLink';

const { Sider, Content } = Layout;

const MOBILE_BREAKPOINT = 768;
const SIDER_WIDTH = 256;
const SIDER_COLLAPSED_WIDTH = 72;
const MOBILE_BOTTOM_NAV_HEIGHT = 56;
const MOBILE_FLOAT_BUTTON_OFFSET = MOBILE_BOTTOM_NAV_HEIGHT + 24;
const MOBILE_CONTENT_BOTTOM_PADDING = MOBILE_FLOAT_BUTTON_OFFSET + 40 + 16;

const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 响应式检测
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (mobile) setDrawerOpen(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <SkipLink />

      {/* 桌面端侧边栏 */}
      {!isMobile && (
        <Sider
          width={SIDER_WIDTH}
          collapsedWidth={SIDER_COLLAPSED_WIDTH}
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 20,
            overflow: 'auto',
          }}
          trigger={null}
        >
          <AppSidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
        </Sider>
      )}

      {/* 移动端侧边栏抽屉 */}
      {isMobile && (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={SIDER_WIDTH}
          styles={{ body: { padding: 0 } }}
          closable={false}
        >
          <AppSidebar collapsed={false} />
        </Drawer>
      )}

      {/* 主内容区 */}
      <Layout
        style={{
          marginLeft: isMobile ? 0 : collapsed ? SIDER_COLLAPSED_WIDTH : SIDER_WIDTH,
          transition: 'margin-left 0.2s',
        }}
      >
        <AppHeader
          isMobile={isMobile}
          onMenuClick={() => setDrawerOpen(true)}
        />

        <Content
          id="main-content"
          style={{
            padding: isMobile ? 16 : 24,
            maxWidth: 1800,
            width: '100%',
            margin: '0 auto',
            paddingBottom: isMobile
              ? `calc(${MOBILE_CONTENT_BOTTOM_PADDING}px + env(safe-area-inset-bottom))`
              : 24,
          }}
        >
          <Outlet />
        </Content>
      </Layout>

      {/* 移动端底部导航 */}
      {isMobile && <MobileBottomNav />}

      {/* 右下角帮助按钮 */}
      <FloatButton
        icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>support_agent</span>}
        tooltip="帮助"
        style={{
          bottom: isMobile
            ? `calc(${MOBILE_FLOAT_BUTTON_OFFSET}px + env(safe-area-inset-bottom))`
            : 24,
        }}
      />
    </Layout>
  );
};

export default AppLayout;

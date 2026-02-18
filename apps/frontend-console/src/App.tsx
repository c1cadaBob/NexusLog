/**
 * App 应用入口组件
 * 
 * 配置 HashRouter 路由
 * 配置 Ant Design ConfigProvider（主题、语言）
 * 使用 Zustand Store 管理全局状态（替代 Context Provider 嵌套）
 * 
 * @requirements 2.6, 5.3
 */

import React, { Suspense } from 'react';
import { HashRouter } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useThemeStore } from '@/stores/useThemeStore';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { AppRoutes } from '@/routes';

/**
 * 应用根组件
 * 
 * 使用 Ant Design ConfigProvider 配置：
 * - 主题（从 useThemeStore 获取）
 * - 中文语言包 zh_CN
 * - 全局样式
 * 
 * 使用 HashRouter 作为路由模式，适合静态部署
 */
const App: React.FC = () => {
  // 从 Zustand Store 获取主题配置（替代 Context API）
  const antdTheme = useThemeStore(state => state.antdTheme);

  return (
    <ConfigProvider
      theme={antdTheme}
      locale={zhCN}
      componentSize="middle"
    >
      <AntdApp>
        <HashRouter>
          <Suspense fallback={<LoadingScreen message="正在加载应用..." />}>
            <AppRoutes />
          </Suspense>
        </HashRouter>
      </AntdApp>
    </ConfigProvider>
  );
};

export default App;

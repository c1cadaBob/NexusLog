/**
 * 应用入口文件
 * 
 * 初始化应用监控服务
 * 渲染 React 应用到 DOM
 * 
 * @requirements 2.1
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initAppMonitoring } from '@/services/monitoring/init';

// 初始化应用监控（错误跟踪、分析、性能监控）
const cleanupMonitoring = initAppMonitoring();

// 获取根 DOM 元素
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('无法找到根元素 #root，请检查 index.html');
}

// 创建 React 根节点并渲染应用
const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

// 热模块替换（HMR）支持
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    // 清理监控服务
    cleanupMonitoring();
  });
}

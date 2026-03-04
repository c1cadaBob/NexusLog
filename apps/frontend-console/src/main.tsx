import React from 'react';
import ReactDOM from 'react-dom/client';
import '@ant-design/v5-patch-for-react-19';
import App from './App';
import { loadRuntimeConfig } from './config/runtime-config';
import './index.css';

// 页面加载时先获取最新运行时配置，再渲染应用
loadRuntimeConfig().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});

import React from 'react';
import { Spin } from 'antd';

/** 懒加载过渡屏幕 */
const LoadingScreen: React.FC = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: 16,
    }}
  >
    <Spin size="large" />
    <span style={{ opacity: 0.6, fontSize: 14 }}>加载页面中...</span>
  </div>
);

export default LoadingScreen;

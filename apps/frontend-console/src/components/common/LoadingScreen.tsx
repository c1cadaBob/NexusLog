/**
 * LoadingScreen 组件
 * 
 * 基于 Ant Design Spin 的全屏加载组件
 * 
 * @requirements 8.4
 */

import React from 'react';
import { Spin, Typography } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * LoadingScreen 组件属性
 */
export interface LoadingScreenProps {
  /** 自定义加载消息 */
  message?: string;
  /** 是否全屏 */
  fullScreen?: boolean;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 全屏加载组件
 * 
 * 使用 Ant Design Spin 组件实现加载状态展示
 */
export const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = '正在加载...', 
  fullScreen = true,
  style,
}) => {
  const antIcon = <LoadingOutlined style={{ fontSize: 48 }} spin />;

  const containerStyle: React.CSSProperties = fullScreen
    ? {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        ...style,
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        gap: 16,
        ...style,
      };

  return (
    <div 
      style={containerStyle}
      role="status"
      aria-label="加载中"
    >
      <Spin indicator={antIcon} />
      <Text type="secondary">{message}</Text>
    </div>
  );
};

export default LoadingScreen;

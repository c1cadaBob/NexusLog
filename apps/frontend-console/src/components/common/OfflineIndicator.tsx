/**
 * OfflineIndicator 组件
 * 
 * 离线状态指示器组件
 * 
 * @requirements 5.5
 */

import React from 'react';
import { Tag, Tooltip } from 'antd';
import { WifiOutlined, DisconnectOutlined } from '@ant-design/icons';

/**
 * OfflineIndicator 组件属性
 */
export interface OfflineIndicatorProps {
  /** 是否在线 */
  isOnline?: boolean;
  /** 是否显示文字 */
  showText?: boolean;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 离线状态指示器
 */
export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isOnline = navigator.onLine,
  showText = true,
  style,
}) => {
  if (isOnline) {
    return (
      <Tooltip title="网络连接正常">
        <Tag icon={<WifiOutlined />} color="success" style={style}>
          {showText && '在线'}
        </Tag>
      </Tooltip>
    );
  }

  return (
    <Tooltip title="当前处于离线状态，部分功能可能不可用">
      <Tag icon={<DisconnectOutlined />} color="error" style={style}>
        {showText && '离线'}
      </Tag>
    </Tooltip>
  );
};

export default OfflineIndicator;

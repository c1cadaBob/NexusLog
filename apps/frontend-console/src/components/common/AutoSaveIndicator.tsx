/**
 * AutoSaveIndicator 组件
 * 
 * 自动保存状态指示器
 * 
 * @requirements 5.5
 */

import React from 'react';
import { Tag, Tooltip, Space } from 'antd';
import { 
  CheckCircleOutlined, 
  SyncOutlined, 
  ExclamationCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';

/**
 * 保存状态类型
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * AutoSaveIndicator 组件属性
 */
export interface AutoSaveIndicatorProps {
  /** 保存状态 */
  status: SaveStatus;
  /** 最后保存时间 */
  lastSavedAt?: Date | number;
  /** 错误信息 */
  errorMessage?: string;
  /** 是否显示时间 */
  showTime?: boolean;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 格式化时间
 */
const formatTime = (date: Date | number): string => {
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

/**
 * 状态配置
 */
const statusConfig: Record<SaveStatus, {
  icon: React.ReactNode;
  color: string;
  text: string;
}> = {
  idle: {
    icon: <ClockCircleOutlined />,
    color: 'default',
    text: '等待保存',
  },
  saving: {
    icon: <SyncOutlined spin />,
    color: 'processing',
    text: '保存中...',
  },
  saved: {
    icon: <CheckCircleOutlined />,
    color: 'success',
    text: '已保存',
  },
  error: {
    icon: <ExclamationCircleOutlined />,
    color: 'error',
    text: '保存失败',
  },
};

/**
 * 自动保存状态指示器
 */
export const AutoSaveIndicator: React.FC<AutoSaveIndicatorProps> = ({
  status,
  lastSavedAt,
  errorMessage,
  showTime = true,
  style,
}) => {
  const config = statusConfig[status];
  
  const tooltipTitle = status === 'error' && errorMessage
    ? errorMessage
    : status === 'saved' && lastSavedAt
    ? `上次保存: ${formatTime(lastSavedAt)}`
    : config.text;

  return (
    <Tooltip title={tooltipTitle}>
      <Tag icon={config.icon} color={config.color} style={style}>
        <Space size={4}>
          <span>{config.text}</span>
          {showTime && status === 'saved' && lastSavedAt && (
            <span style={{ opacity: 0.7 }}>{formatTime(lastSavedAt)}</span>
          )}
        </Space>
      </Tag>
    </Tooltip>
  );
};

export default AutoSaveIndicator;

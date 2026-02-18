/**
 * StatCard 组件
 * 
 * 基于 Ant Design Card + Statistic 的统计卡片组件
 * 
 * @requirements 8.5
 */

import React from 'react';
import { Card, Statistic, Skeleton, Space, Typography } from 'antd';
import { 
  ArrowUpOutlined, 
  ArrowDownOutlined, 
  MinusOutlined,
  RightOutlined,
} from '@ant-design/icons';
import type { StatCardProps, TrendType } from '@/types';

const { Text } = Typography;

// ============================================================================
// 辅助组件
// ============================================================================

interface TrendIndicatorProps {
  value: string;
  type: TrendType;
  label?: string;
}

/**
 * 趋势指示器组件
 */
const TrendIndicator: React.FC<TrendIndicatorProps> = ({ value, type, label }) => {
  const trendConfig: Record<TrendType, { icon: React.ReactNode; color: string }> = {
    up: {
      icon: <ArrowUpOutlined />,
      color: '#52c41a', // success
    },
    down: {
      icon: <ArrowDownOutlined />,
      color: '#ff4d4f', // danger
    },
    neutral: {
      icon: <MinusOutlined />,
      color: '#faad14', // warning
    },
  };

  const config = trendConfig[type];

  return (
    <Space size={4}>
      <Text style={{ color: config.color, fontSize: 12 }}>
        {config.icon} {value}
      </Text>
      {label && (
        <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
      )}
    </Space>
  );
};

// ============================================================================
// 颜色配置
// ============================================================================

const colorConfig: Record<string, string> = {
  primary: '#1677ff',
  success: '#52c41a',
  warning: '#faad14',
  danger: '#ff4d4f',
  info: '#1677ff',
};

// ============================================================================
// 主组件
// ============================================================================

/**
 * 统计卡片组件
 * 
 * 使用 Ant Design Card + Statistic 展示 KPI 数据
 */
export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  color = 'primary',
  trend,
  loading = false,
  prefix,
  suffix,
  precision,
  onClick,
  className,
  style,
}) => {
  const valueColor = colorConfig[color] || colorConfig.primary;
  const isClickable = !!onClick;

  // 加载状态
  if (loading) {
    return (
      <Card 
        className={className} 
        style={style}
        styles={{ body: { padding: 16 } }}
      >
        <Skeleton active paragraph={{ rows: 1 }} />
      </Card>
    );
  }

  // 格式化数值
  const formattedValue = typeof value === 'number' && precision !== undefined
    ? value.toFixed(precision)
    : value;

  return (
    <Card
      className={className}
      style={{
        cursor: isClickable ? 'pointer' : undefined,
        ...style,
      }}
      styles={{ body: { padding: 16 } }}
      hoverable={isClickable}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      } : undefined}
      aria-label={isClickable ? `${title}: ${value}` : undefined}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Statistic
          title={title}
          value={formattedValue}
          prefix={prefix}
          suffix={suffix}
          valueStyle={{ color: valueColor, fontSize: 24 }}
        />
        {icon && (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              backgroundColor: `${valueColor}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: valueColor,
              fontSize: 20,
            }}
          >
            {icon}
          </div>
        )}
      </div>
      
      {/* 趋势指示器 */}
      {trend && (
        <div style={{ marginTop: 8 }}>
          <TrendIndicator
            value={trend.value}
            type={trend.type}
            label={trend.label}
          />
        </div>
      )}

      {/* 可点击指示器 */}
      {isClickable && (
        <div style={{ 
          position: 'absolute', 
          bottom: 8, 
          right: 8, 
          opacity: 0.5,
        }}>
          <RightOutlined style={{ fontSize: 12 }} />
        </div>
      )}
    </Card>
  );
};

export default StatCard;

/**
 * ChartCard 图表卡片组件
 * 
 * 使用 Ant Design Card 包装图表组件
 * 
 * @module components/charts/ChartCard
 */

import { memo, type ReactNode } from 'react';
import { Card, Spin, Empty, Typography } from 'antd';
import type { CardProps } from 'antd';

const { Text } = Typography;

// ============================================================================
// 类型定义
// ============================================================================

/**
 * ChartCard 组件 Props
 */
export interface ChartCardProps extends Omit<CardProps, 'children'> {
  /** 卡片标题 */
  title?: ReactNode;
  /** 副标题 */
  subtitle?: string;
  /** 额外内容（右上角） */
  extra?: ReactNode;
  /** 是否加载中 */
  loading?: boolean;
  /** 错误信息 */
  error?: string;
  /** 是否无数据 */
  empty?: boolean;
  /** 空数据提示文本 */
  emptyText?: string;
  /** 图表内容 */
  children?: ReactNode;
  /** 卡片高度 */
  height?: number | string;
  /** 内边距 */
  padding?: number | string;
  /** 是否显示边框 */
  bordered?: boolean;
  /** 是否可悬停 */
  hoverable?: boolean;
}

// ============================================================================
// 组件实现
// ============================================================================

/**
 * ChartCard 图表卡片组件
 * 
 * 提供统一的图表容器样式，包含：
 * - 标题和副标题
 * - 加载状态
 * - 错误状态
 * - 空数据状态
 * 
 * @example
 * ```tsx
 * <ChartCard
 *   title="日志趋势"
 *   subtitle="最近 24 小时"
 *   extra={<Button>刷新</Button>}
 *   loading={isLoading}
 *   error={error}
 * >
 *   <TimeSeriesChart data={data} series={series} />
 * </ChartCard>
 * ```
 */
export const ChartCard = memo(function ChartCard({
  title,
  subtitle,
  extra,
  loading = false,
  error,
  empty = false,
  emptyText = '暂无数据',
  children,
  height,
  padding = 16,
  bordered = true,
  hoverable = false,
  style,
  ...cardProps
}: ChartCardProps) {
  // 构建标题
  const cardTitle = title ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span>{title}</span>
      {subtitle && (
        <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
          {subtitle}
        </Text>
      )}
    </div>
  ) : undefined;

  // 渲染内容
  const renderContent = () => {
    // 错误状态
    if (error) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: height || 200,
            color: '#ef4444',
          }}
        >
          <Text type="danger">{error}</Text>
        </div>
      );
    }

    // 加载状态
    if (loading) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: height || 200,
          }}
        >
          <Spin tip="加载中..." />
        </div>
      );
    }

    // 空数据状态
    if (empty) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: height || 200,
          }}
        >
          <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      );
    }

    // 正常内容
    return children;
  };

  return (
    <Card
      title={cardTitle}
      extra={extra}
      bordered={bordered}
      hoverable={hoverable}
      style={{
        height: height ? `calc(${typeof height === 'number' ? `${height}px` : height} + 57px)` : undefined,
        ...style,
      }}
      styles={{
        body: {
          padding: typeof padding === 'number' ? padding : undefined,
          height: height,
        },
      }}
      {...cardProps}
    >
      {renderContent()}
    </Card>
  );
});

export default ChartCard;

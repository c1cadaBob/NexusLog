/**
 * PieChart 饼图组件
 * 
 * 基于 ECharts pie series 实现
 * 
 * @module components/charts/PieChart
 */

import { useMemo, memo } from 'react';
import type { EChartsOption } from 'echarts';
import { BaseChart } from './BaseChart';
import type { BaseChartProps } from './BaseChart';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 饼图数据项
 */
export interface PieDataItem {
  /** 名称 */
  name: string;
  /** 数值 */
  value: number;
  /** 可选颜色 */
  color?: string;
}

/**
 * PieChart 组件 Props
 */
export interface PieChartProps extends Omit<BaseChartProps, 'option'> {
  /** 数据 */
  data: PieDataItem[];
  /** 是否为环形图 */
  donut?: boolean;
  /** 内半径（环形图） */
  innerRadius?: number | string;
  /** 外半径 */
  outerRadius?: number | string;
  /** 是否显示图例 */
  showLegend?: boolean;
  /** 是否显示工具提示 */
  showTooltip?: boolean;
  /** 是否显示标签 */
  showLabel?: boolean;
  /** 标签位置 */
  labelPosition?: 'inside' | 'outside';
  /** 标题 */
  title?: string;
  /** 数值格式化函数 */
  valueFormatter?: (value: number) => string;
  /** 百分比格式化函数 */
  percentFormatter?: (percent: number) => string;
  /** 是否显示百分比 */
  showPercent?: boolean;
  /** 中心文本（环形图） */
  centerText?: string;
  /** 中心副文本（环形图） */
  centerSubText?: string;
  /** 颜色列表 */
  colors?: string[];
  /** 是否启用玫瑰图模式 */
  roseType?: boolean | 'radius' | 'area';
}

// ============================================================================
// 默认配置
// ============================================================================

/**
 * 默认颜色列表
 */
const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

/**
 * 默认数值格式化
 */
function defaultValueFormatter(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

/**
 * 默认百分比格式化
 */
function defaultPercentFormatter(percent: number): string {
  return `${percent.toFixed(1)}%`;
}

// ============================================================================
// 组件实现
// ============================================================================

/**
 * PieChart 饼图组件
 * 
 * @example
 * ```tsx
 * // 基础饼图
 * <PieChart
 *   data={[
 *     { name: 'INFO', value: 1200 },
 *     { name: 'WARN', value: 300 },
 *     { name: 'ERROR', value: 50 },
 *   ]}
 *   height={300}
 * />
 * 
 * // 环形图
 * <PieChart
 *   data={[...]}
 *   donut
 *   centerText="总计"
 *   centerSubText="1550"
 *   height={300}
 * />
 * ```
 */
export const PieChart = memo(function PieChart({
  data,
  donut = false,
  innerRadius = '50%',
  outerRadius = '70%',
  showLegend = true,
  showTooltip = true,
  showLabel = true,
  labelPosition = 'outside',
  title,
  valueFormatter = defaultValueFormatter,
  percentFormatter = defaultPercentFormatter,
  showPercent = true,
  centerText,
  centerSubText,
  colors = DEFAULT_COLORS,
  roseType = false,
  height = 300,
  loading,
  theme,
  onEvents,
  style,
  className,
  onChartReady,
}: PieChartProps) {
  // 生成 ECharts 配置
  const option = useMemo<EChartsOption>(() => {
    // 计算总值
    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    // 处理数据，添加颜色
    const pieData = data.map((item, index) => ({
      name: item.name,
      value: item.value,
      itemStyle: {
        color: item.color || colors[index % colors.length],
      },
    }));
    
    // 计算中心位置
    const centerX = showLegend ? '40%' : '50%';
    
    return {
      title: title ? {
        text: title,
        left: 'center',
        textStyle: {
          fontSize: 14,
          fontWeight: 500,
        },
      } : undefined,
      tooltip: showTooltip ? {
        trigger: 'item',
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number; percent: number; color: string };
          return `
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${p.color};"></span>
              <span>${p.name}</span>
            </div>
            <div style="margin-top: 4px;">
              <span style="font-weight: 500;">${valueFormatter(p.value)}</span>
              ${showPercent ? `<span style="margin-left: 8px; color: #94a3b8;">(${percentFormatter(p.percent)})</span>` : ''}
            </div>
          `;
        },
      } : undefined,
      legend: showLegend ? {
        orient: 'vertical',
        right: 20,
        top: 'center',
        icon: 'circle',
        itemWidth: 10,
        itemHeight: 10,
        formatter: (name: string) => {
          const item = data.find(d => d.name === name);
          if (!item) return name;
          const percent = total > 0 ? (item.value / total) * 100 : 0;
          return `${name}  ${percentFormatter(percent)}`;
        },
      } : undefined,
      graphic: donut && (centerText || centerSubText) ? [
        {
          type: 'text',
          left: 'center',
          top: '42%',
          style: {
            text: centerText || '',
            textAlign: 'center',
            fontSize: 14,
          },
          z: 100,
        },
        {
          type: 'text',
          left: 'center',
          top: '52%',
          style: {
            text: centerSubText || '',
            textAlign: 'center',
            fontSize: 20,
            fontWeight: 'bold',
          },
          z: 100,
        },
      ] : undefined,
      series: [{
        type: 'pie',
        radius: donut ? [innerRadius, outerRadius] : outerRadius,
        center: [centerX, '50%'],
        data: pieData,
        roseType: roseType === true ? 'radius' : roseType || undefined,
        label: showLabel ? {
          show: true,
          position: labelPosition,
          formatter: showPercent ? '{b}\n{d}%' : '{b}',
        } : {
          show: false,
        },
        labelLine: showLabel && labelPosition === 'outside' ? {
          show: true,
          length: 10,
          length2: 10,
        } : {
          show: false,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.2)',
          },
          label: {
            show: true,
            fontWeight: 'bold',
          },
        },
        animationType: 'scale',
        animationEasing: 'elasticOut',
      }],
    };
  }, [data, donut, innerRadius, outerRadius, showLegend, showTooltip, showLabel, labelPosition, title, valueFormatter, percentFormatter, showPercent, centerText, centerSubText, colors, roseType]);

  return (
    <BaseChart
      option={option}
      height={height}
      loading={loading}
      theme={theme}
      onEvents={onEvents}
      style={style}
      className={className}
      onChartReady={onChartReady}
    />
  );
});

export default PieChart;

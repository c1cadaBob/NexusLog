/**
 * TimeSeriesChart 时间序列图表组件
 * 
 * 基于 ECharts line/area series 实现
 * 
 * @module components/charts/TimeSeriesChart
 */

import { useMemo, memo } from 'react';
import type { EChartsOption } from 'echarts';
import { BaseChart } from './BaseChart';
import type { BaseChartProps } from './BaseChart';
import { useThemeStore } from '@/stores/useThemeStore';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 时间序列数据点
 */
export interface TimeSeriesDataPoint {
  /** 时间戳（毫秒） */
  timestamp: number;
  /** 动态数据字段 */
  [key: string]: number;
}

/**
 * 系列配置
 */
export interface TimeSeriesConfig {
  /** 数据字段名 */
  dataKey: string;
  /** 系列名称 */
  name: string;
  /** 系列颜色 */
  color: string;
  /** 图表类型 */
  type?: 'line' | 'area';
  /** 线条宽度 */
  strokeWidth?: number;
  /** 是否显示数据点 */
  showDot?: boolean;
  /** 是否平滑曲线 */
  smooth?: boolean;
}

/**
 * TimeSeriesChart 组件 Props
 */
export interface TimeSeriesChartProps extends Omit<BaseChartProps, 'option'> {
  /** 数据 */
  data: TimeSeriesDataPoint[];
  /** 系列配置 */
  series: TimeSeriesConfig[];
  /** X 轴格式化函数 */
  xAxisFormatter?: (value: number) => string;
  /** Y 轴格式化函数 */
  yAxisFormatter?: (value: number) => string;
  /** 是否显示图例 */
  showLegend?: boolean;
  /** 是否显示工具提示 */
  showTooltip?: boolean;
  /** 标题 */
  title?: string;
  /** Y 轴最小值 */
  yAxisMin?: number | 'dataMin';
  /** Y 轴最大值 */
  yAxisMax?: number | 'dataMax';
  /** 是否显示网格线 */
  showGrid?: boolean;
  /** 是否显示区域填充 */
  areaStyle?: boolean;
}

// ============================================================================
// 默认格式化函数
// ============================================================================

/**
 * 默认时间格式化
 */
function defaultTimeFormatter(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

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

// ============================================================================
// 组件实现
// ============================================================================

/**
 * TimeSeriesChart 时间序列图表组件
 * 
 * @example
 * ```tsx
 * <TimeSeriesChart
 *   data={[
 *     { timestamp: 1700000000000, logs: 120, errors: 5 },
 *     { timestamp: 1700000060000, logs: 150, errors: 3 },
 *   ]}
 *   series={[
 *     { dataKey: 'logs', name: '日志量', color: '#3b82f6', type: 'area' },
 *     { dataKey: 'errors', name: '错误数', color: '#ef4444', type: 'line' },
 *   ]}
 *   height={300}
 *   showLegend
 * />
 * ```
 */
export const TimeSeriesChart = memo(function TimeSeriesChart({
  data,
  series,
  xAxisFormatter = defaultTimeFormatter,
  yAxisFormatter = defaultValueFormatter,
  showLegend = true,
  showTooltip = true,
  title,
  yAxisMin,
  yAxisMax,
  showGrid = true,
  areaStyle = false,
  height = 300,
  loading,
  theme,
  onEvents,
  style,
  className,
  onChartReady,
}: TimeSeriesChartProps) {
  // 获取主题颜色
  const colors = useThemeStore(state => state.colors);
  
  // 生成 ECharts 配置
  const option = useMemo<EChartsOption>(() => {
    // 提取时间戳作为 X 轴数据
    const xAxisData = data.map(d => d.timestamp);
    
    // 生成系列配置
    const seriesConfig = series.map(s => {
      const isArea = s.type === 'area' || areaStyle;
      
      return {
        name: s.name,
        type: 'line' as const,
        data: data.map(d => d[s.dataKey] ?? 0),
        smooth: s.smooth ?? true,
        symbol: s.showDot ? 'circle' : 'none',
        symbolSize: s.showDot ? 6 : 0,
        lineStyle: {
          width: s.strokeWidth ?? 2,
          color: s.color,
        },
        itemStyle: {
          color: s.color,
        },
        areaStyle: isArea ? {
          color: {
            type: 'linear' as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${s.color}40` },
              { offset: 1, color: `${s.color}05` },
            ],
          },
        } : undefined,
      };
    });
    
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
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          crossStyle: {
            color: colors.textMuted,
          },
        },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          
          const firstParam = params[0] as { axisValue: number };
          const time = xAxisFormatter(firstParam.axisValue);
          
          let content = `<div style="font-weight: 500; margin-bottom: 4px;">${time}</div>`;
          
          (params as Array<{ seriesName: string; value: number; color: string }>).forEach(p => {
            content += `
              <div style="display: flex; align-items: center; gap: 8px; margin: 2px 0;">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${p.color};"></span>
                <span>${p.seriesName}:</span>
                <span style="font-weight: 500;">${yAxisFormatter(p.value)}</span>
              </div>
            `;
          });
          
          return content;
        },
      } : undefined,
      legend: showLegend ? {
        data: series.map(s => s.name),
        bottom: 0,
        icon: 'roundRect',
        itemWidth: 12,
        itemHeight: 3,
      } : undefined,
      grid: {
        left: 50,
        right: 20,
        top: title ? 40 : 20,
        bottom: showLegend ? 40 : 20,
        containLabel: false,
      },
      xAxis: {
        type: 'category',
        data: xAxisData,
        axisLabel: {
          formatter: (value: string) => xAxisFormatter(Number(value)),
        },
        axisTick: {
          alignWithLabel: true,
        },
        splitLine: {
          show: false,
        },
      },
      yAxis: {
        type: 'value',
        min: yAxisMin,
        max: yAxisMax,
        axisLabel: {
          formatter: (value: number) => yAxisFormatter(value),
        },
        splitLine: {
          show: showGrid,
          lineStyle: {
            type: 'dashed',
          },
        },
      },
      series: seriesConfig,
    };
  }, [data, series, xAxisFormatter, yAxisFormatter, showLegend, showTooltip, title, yAxisMin, yAxisMax, showGrid, areaStyle, colors]);

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

export default TimeSeriesChart;

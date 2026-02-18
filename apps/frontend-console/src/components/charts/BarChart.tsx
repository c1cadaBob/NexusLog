/**
 * BarChart 柱状图组件
 * 
 * 基于 ECharts bar series 实现
 * 
 * @module components/charts/BarChart
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
 * 柱状图数据项
 */
export interface BarDataItem {
  /** 类别名称 */
  name: string;
  /** 数值 */
  value: number;
  /** 可选颜色 */
  color?: string;
}

/**
 * 柱状图系列配置
 */
export interface BarSeriesConfig {
  /** 数据字段名 */
  dataKey: string;
  /** 系列名称 */
  name: string;
  /** 系列颜色 */
  color: string;
  /** 是否堆叠 */
  stack?: string;
  /** 柱子圆角 */
  barRadius?: number | [number, number, number, number];
}

/**
 * BarChart 组件 Props
 */
export interface BarChartProps extends Omit<BaseChartProps, 'option'> {
  /** 数据（简单模式） */
  data?: BarDataItem[];
  /** 类别数据（多系列模式） */
  categories?: string[];
  /** 系列数据（多系列模式） */
  seriesData?: Record<string, number[]>;
  /** 系列配置（多系列模式） */
  series?: BarSeriesConfig[];
  /** 是否水平方向 */
  horizontal?: boolean;
  /** 是否显示图例 */
  showLegend?: boolean;
  /** 是否显示工具提示 */
  showTooltip?: boolean;
  /** 标题 */
  title?: string;
  /** 数值格式化函数 */
  valueFormatter?: (value: number) => string;
  /** 是否显示数值标签 */
  showLabel?: boolean;
  /** 柱子宽度 */
  barWidth?: number | string;
  /** 是否显示网格线 */
  showGrid?: boolean;
}

// ============================================================================
// 默认格式化函数
// ============================================================================

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
 * BarChart 柱状图组件
 * 
 * 支持两种使用模式：
 * 1. 简单模式：传入 data 数组
 * 2. 多系列模式：传入 categories、seriesData 和 series
 * 
 * @example
 * ```tsx
 * // 简单模式
 * <BarChart
 *   data={[
 *     { name: '周一', value: 120 },
 *     { name: '周二', value: 200 },
 *   ]}
 *   height={300}
 * />
 * 
 * // 多系列模式
 * <BarChart
 *   categories={['周一', '周二', '周三']}
 *   seriesData={{
 *     logs: [120, 200, 150],
 *     errors: [5, 3, 8],
 *   }}
 *   series={[
 *     { dataKey: 'logs', name: '日志量', color: '#3b82f6' },
 *     { dataKey: 'errors', name: '错误数', color: '#ef4444' },
 *   ]}
 *   height={300}
 * />
 * ```
 */
export const BarChart = memo(function BarChart({
  data,
  categories,
  seriesData,
  series,
  horizontal = false,
  showLegend = true,
  showTooltip = true,
  title,
  valueFormatter = defaultValueFormatter,
  showLabel = false,
  barWidth,
  showGrid = true,
  height = 300,
  loading,
  theme,
  onEvents,
  style,
  className,
  onChartReady,
}: BarChartProps) {
  // 获取主题颜色
  const colors = useThemeStore(state => state.colors);
  
  // 生成 ECharts 配置
  const option = useMemo<EChartsOption>(() => {
    // 判断使用哪种模式
    const isSimpleMode = data && data.length > 0;
    
    // 简单模式
    if (isSimpleMode) {
      const categoryData = data.map(d => d.name);
      const valueData = data.map(d => ({
        value: d.value,
        itemStyle: d.color ? { color: d.color } : undefined,
      }));
      
      const categoryAxis = {
        type: 'category' as const,
        data: categoryData,
        axisTick: {
          alignWithLabel: true,
        },
      };
      
      const valueAxis = {
        type: 'value' as const,
        axisLabel: {
          formatter: (value: number) => valueFormatter(value),
        },
        splitLine: {
          show: showGrid,
          lineStyle: {
            type: 'dashed' as const,
          },
        },
      };
      
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
            type: 'shadow',
          },
          formatter: (params: unknown) => {
            if (!Array.isArray(params) || params.length === 0) return '';
            const p = params[0] as { name: string; value: number; color: string };
            return `
              <div style="font-weight: 500; margin-bottom: 4px;">${p.name}</div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${p.color};"></span>
                <span style="font-weight: 500;">${valueFormatter(p.value)}</span>
              </div>
            `;
          },
        } : undefined,
        grid: {
          left: 50,
          right: 20,
          top: title ? 40 : 20,
          bottom: 30,
          containLabel: false,
        },
        xAxis: horizontal ? valueAxis : categoryAxis,
        yAxis: horizontal ? categoryAxis : valueAxis,
        series: [{
          type: 'bar',
          data: valueData,
          barWidth: barWidth,
          itemStyle: {
            color: colors.primary,
            borderRadius: [4, 4, 0, 0],
          },
          label: showLabel ? {
            show: true,
            position: horizontal ? 'right' : 'top',
            formatter: '{c}',
          } : undefined,
        }],
      };
    }
    
    // 多系列模式
    const categoryData = categories || [];
    const seriesConfig = (series || []).map(s => ({
      name: s.name,
      type: 'bar' as const,
      data: seriesData?.[s.dataKey] || [],
      stack: s.stack,
      barWidth: barWidth,
      itemStyle: {
        color: s.color,
        borderRadius: s.barRadius ?? [4, 4, 0, 0],
      },
      label: showLabel ? {
        show: true,
        position: (horizontal ? 'right' : 'top') as 'right' | 'top',
        formatter: '{c}',
      } : undefined,
    }));
    
    const categoryAxis = {
      type: 'category' as const,
      data: categoryData,
      axisTick: {
        alignWithLabel: true,
      },
    };
    
    const valueAxis = {
      type: 'value' as const,
      axisLabel: {
        formatter: (value: number) => valueFormatter(value),
      },
      splitLine: {
        show: showGrid,
        lineStyle: {
          type: 'dashed' as const,
        },
      },
    };
    
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
          type: 'shadow',
        },
      } : undefined,
      legend: showLegend && series && series.length > 1 ? {
        data: series.map(s => s.name),
        bottom: 0,
        icon: 'roundRect',
        itemWidth: 12,
        itemHeight: 8,
      } : undefined,
      grid: {
        left: 50,
        right: 20,
        top: title ? 40 : 20,
        bottom: showLegend && series && series.length > 1 ? 40 : 30,
        containLabel: false,
      },
      xAxis: horizontal ? valueAxis : categoryAxis,
      yAxis: horizontal ? categoryAxis : valueAxis,
      series: seriesConfig,
    };
  }, [data, categories, seriesData, series, horizontal, showLegend, showTooltip, title, valueFormatter, showLabel, barWidth, showGrid, colors]);

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

export default BarChart;

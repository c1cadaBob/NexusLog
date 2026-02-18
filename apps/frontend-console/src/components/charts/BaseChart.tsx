/**
 * BaseChart 通用 ECharts 包装组件
 * 
 * 封装 ECharts 实例的初始化、更新、销毁生命周期管理
 * 
 * @module components/charts/BaseChart
 */

import { useRef, useEffect, useCallback, memo } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption, ECharts } from 'echarts';
import { useThemeStore } from '@/stores/useThemeStore';

/**
 * ECharts 主题配置类型
 * ECharts 没有导出 ThemeOption 类型，这里定义一个兼容类型
 */
type EChartsThemeOption = Record<string, unknown>;

// ============================================================================
// 类型定义
// ============================================================================

/**
 * ECharts 事件处理器类型
 */
export type EChartsEventHandler = (params: unknown) => void;

/**
 * BaseChart 组件 Props
 */
export interface BaseChartProps {
  /** ECharts 配置项 */
  option: EChartsOption;
  /** 图表高度 */
  height?: number | string;
  /** 是否显示加载状态 */
  loading?: boolean;
  /** 主题模式（覆盖全局主题） */
  theme?: 'dark' | 'light';
  /** 事件处理器映射 */
  onEvents?: Record<string, EChartsEventHandler>;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 自定义类名 */
  className?: string;
  /** 图表实例就绪回调 */
  onChartReady?: (chart: ECharts) => void;
  /** 是否不合并配置（默认 false，即合并） */
  notMerge?: boolean;
  /** 是否延迟更新（默认 false） */
  lazyUpdate?: boolean;
}

// ============================================================================
// 主题配置
// ============================================================================

/**
 * 暗色主题配置
 */
const DARK_THEME: EChartsThemeOption = {
  backgroundColor: 'transparent',
  textStyle: {
    color: '#f8fafc',
  },
  title: {
    textStyle: {
      color: '#f8fafc',
    },
    subtextStyle: {
      color: '#94a3b8',
    },
  },
  legend: {
    textStyle: {
      color: '#f8fafc',
    },
  },
  tooltip: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderColor: '#334155',
    textStyle: {
      color: '#f8fafc',
    },
  },
  xAxis: {
    axisLine: {
      lineStyle: {
        color: '#475569',
      },
    },
    axisTick: {
      lineStyle: {
        color: '#475569',
      },
    },
    axisLabel: {
      color: '#94a3b8',
    },
    splitLine: {
      lineStyle: {
        color: '#334155',
      },
    },
  },
  yAxis: {
    axisLine: {
      lineStyle: {
        color: '#475569',
      },
    },
    axisTick: {
      lineStyle: {
        color: '#475569',
      },
    },
    axisLabel: {
      color: '#94a3b8',
    },
    splitLine: {
      lineStyle: {
        color: '#334155',
      },
    },
  },
  categoryAxis: {
    axisLine: {
      lineStyle: {
        color: '#475569',
      },
    },
    axisTick: {
      lineStyle: {
        color: '#475569',
      },
    },
    axisLabel: {
      color: '#94a3b8',
    },
    splitLine: {
      lineStyle: {
        color: '#334155',
      },
    },
  },
  valueAxis: {
    axisLine: {
      lineStyle: {
        color: '#475569',
      },
    },
    axisTick: {
      lineStyle: {
        color: '#475569',
      },
    },
    axisLabel: {
      color: '#94a3b8',
    },
    splitLine: {
      lineStyle: {
        color: '#334155',
      },
    },
  },
};

/**
 * 亮色主题配置
 */
const LIGHT_THEME: EChartsThemeOption = {
  backgroundColor: 'transparent',
  textStyle: {
    color: '#0f172a',
  },
  title: {
    textStyle: {
      color: '#0f172a',
    },
    subtextStyle: {
      color: '#475569',
    },
  },
  legend: {
    textStyle: {
      color: '#0f172a',
    },
  },
  tooltip: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: '#e2e8f0',
    textStyle: {
      color: '#0f172a',
    },
  },
  xAxis: {
    axisLine: {
      lineStyle: {
        color: '#cbd5e1',
      },
    },
    axisTick: {
      lineStyle: {
        color: '#cbd5e1',
      },
    },
    axisLabel: {
      color: '#475569',
    },
    splitLine: {
      lineStyle: {
        color: '#e2e8f0',
      },
    },
  },
  yAxis: {
    axisLine: {
      lineStyle: {
        color: '#cbd5e1',
      },
    },
    axisTick: {
      lineStyle: {
        color: '#cbd5e1',
      },
    },
    axisLabel: {
      color: '#475569',
    },
    splitLine: {
      lineStyle: {
        color: '#e2e8f0',
      },
    },
  },
  categoryAxis: {
    axisLine: {
      lineStyle: {
        color: '#cbd5e1',
      },
    },
    axisTick: {
      lineStyle: {
        color: '#cbd5e1',
      },
    },
    axisLabel: {
      color: '#475569',
    },
    splitLine: {
      lineStyle: {
        color: '#e2e8f0',
      },
    },
  },
  valueAxis: {
    axisLine: {
      lineStyle: {
        color: '#cbd5e1',
      },
    },
    axisTick: {
      lineStyle: {
        color: '#cbd5e1',
      },
    },
    axisLabel: {
      color: '#475569',
    },
    splitLine: {
      lineStyle: {
        color: '#e2e8f0',
      },
    },
  },
};

// 注册主题
echarts.registerTheme('nexuslog-dark', DARK_THEME);
echarts.registerTheme('nexuslog-light', LIGHT_THEME);

// ============================================================================
// 组件实现
// ============================================================================

/**
 * BaseChart 通用 ECharts 包装组件
 * 
 * 功能：
 * - ECharts 实例的初始化、更新、销毁生命周期管理
 * - 容器 resize 自动适配
 * - 主题切换响应（dark/light）
 * - 事件绑定支持
 * 
 * @example
 * ```tsx
 * <BaseChart
 *   option={{
 *     xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed'] },
 *     yAxis: { type: 'value' },
 *     series: [{ data: [120, 200, 150], type: 'line' }]
 *   }}
 *   height={300}
 *   onEvents={{ click: (params) => console.log(params) }}
 * />
 * ```
 */
export const BaseChart = memo(function BaseChart({
  option,
  height = 300,
  loading = false,
  theme: themeProp,
  onEvents,
  style,
  className,
  onChartReady,
  notMerge = false,
  lazyUpdate = false,
}: BaseChartProps) {
  // 容器引用
  const containerRef = useRef<HTMLDivElement>(null);
  // ECharts 实例引用
  const chartRef = useRef<ECharts | null>(null);
  // 已绑定的事件引用（用于清理）
  const bindedEventsRef = useRef<Record<string, EChartsEventHandler>>({});
  
  // 从全局主题 store 获取主题状态
  const globalIsDark = useThemeStore(state => state.isDark);
  
  // 确定使用的主题
  const effectiveTheme = themeProp ?? (globalIsDark ? 'dark' : 'light');
  const themeName = effectiveTheme === 'dark' ? 'nexuslog-dark' : 'nexuslog-light';

  /**
   * 初始化 ECharts 实例
   */
  const initChart = useCallback(() => {
    if (!containerRef.current) return null;
    
    // 如果已存在实例，先销毁
    if (chartRef.current) {
      chartRef.current.dispose();
    }
    
    // 创建新实例
    const chart = echarts.init(containerRef.current, themeName, {
      renderer: 'canvas',
    });
    
    chartRef.current = chart;
    
    // 触发就绪回调
    onChartReady?.(chart);
    
    return chart;
  }, [themeName, onChartReady]);

  /**
   * 绑定事件处理器
   */
  const bindEvents = useCallback((chart: ECharts, events?: Record<string, EChartsEventHandler>) => {
    // 先解绑之前的事件
    Object.entries(bindedEventsRef.current).forEach(([eventName, handler]) => {
      chart.off(eventName, handler);
    });
    bindedEventsRef.current = {};
    
    // 绑定新事件
    if (events) {
      Object.entries(events).forEach(([eventName, handler]) => {
        chart.on(eventName, handler);
        bindedEventsRef.current[eventName] = handler;
      });
    }
  }, []);

  /**
   * 处理容器 resize
   */
  const handleResize = useCallback(() => {
    if (chartRef.current && !chartRef.current.isDisposed()) {
      chartRef.current.resize();
    }
  }, []);

  // 初始化和主题切换时重新创建实例
  useEffect(() => {
    const chart = initChart();
    
    if (chart) {
      // 设置配置
      chart.setOption(option, notMerge, lazyUpdate);
      
      // 绑定事件
      bindEvents(chart, onEvents);
      
      // 设置加载状态
      if (loading) {
        chart.showLoading('default', {
          text: '加载中...',
          maskColor: effectiveTheme === 'dark' ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.8)',
          textColor: effectiveTheme === 'dark' ? '#f8fafc' : '#0f172a',
        });
      }
    }
    
    // 清理函数
    return () => {
      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }
    };
  }, [themeName]); // 仅在主题变化时重新初始化

  // 配置更新
  useEffect(() => {
    if (chartRef.current && !chartRef.current.isDisposed()) {
      chartRef.current.setOption(option, notMerge, lazyUpdate);
    }
  }, [option, notMerge, lazyUpdate]);

  // 事件绑定更新
  useEffect(() => {
    if (chartRef.current && !chartRef.current.isDisposed()) {
      bindEvents(chartRef.current, onEvents);
    }
  }, [onEvents, bindEvents]);

  // 加载状态更新
  useEffect(() => {
    if (chartRef.current && !chartRef.current.isDisposed()) {
      if (loading) {
        chartRef.current.showLoading('default', {
          text: '加载中...',
          maskColor: effectiveTheme === 'dark' ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.8)',
          textColor: effectiveTheme === 'dark' ? '#f8fafc' : '#0f172a',
        });
      } else {
        chartRef.current.hideLoading();
      }
    }
  }, [loading, effectiveTheme]);

  // 监听容器 resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 使用 ResizeObserver 监听容器尺寸变化
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    
    resizeObserver.observe(container);
    
    // 同时监听窗口 resize 事件作为备用
    window.addEventListener('resize', handleResize);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [handleResize]);

  // 计算容器样式
  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: typeof height === 'number' ? `${height}px` : height,
    ...style,
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      data-testid="base-chart"
    />
  );
});

// ============================================================================
// 导出工具函数
// ============================================================================

/**
 * 获取 ECharts 主题名称
 */
export function getEChartsThemeName(isDark: boolean): string {
  return isDark ? 'nexuslog-dark' : 'nexuslog-light';
}

/**
 * 获取 ECharts 主题配置
 */
export function getEChartsTheme(isDark: boolean): EChartsThemeOption {
  return isDark ? DARK_THEME : LIGHT_THEME;
}

export default BaseChart;

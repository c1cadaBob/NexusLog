import React, { useRef, useEffect, useMemo } from 'react';
import { Card, Empty } from 'antd';
import * as echarts from 'echarts/core';
import {
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
} from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useThemeStore } from '../../stores/themeStore';
import { getEChartsTheme } from '../../theme/echartsTheme';
import InlineLoadingState from '../common/InlineLoadingState';

// 注册 ECharts 组件
echarts.use([
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  CanvasRenderer,
]);

export interface ChartWrapperProps {
  /** 图表标题 */
  title?: string;
  /** 副标题 */
  subtitle?: string;
  /** 图表高度，默认 300；也支持 `100%` 这类字符串高度 */
  height?: number | string;
  /** 是否按父容器剩余高度拉伸 */
  fullHeight?: boolean;
  /** 是否加载中 */
  loading?: boolean;
  /** 错误信息 */
  error?: string;
  /** 是否无数据 */
  empty?: boolean;
  /** ECharts 配置项 */
  option: echarts.EChartsCoreOption;
  /** 右上角操作区域 */
  actions?: React.ReactNode;
  /** 自定义类名 */
  className?: string;
}

const ChartWrapper: React.FC<ChartWrapperProps> = ({
  title,
  subtitle,
  height = 300,
  fullHeight = false,
  loading = false,
  error,
  empty = false,
  option,
  actions,
  className,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const isDark = useThemeStore((s) => s.isDark);

  const themeOption = useMemo(() => getEChartsTheme(isDark), [isDark]);
  const mergedOption = useMemo(
    () => ({ ...themeOption, ...option }),
    [themeOption, option],
  );

  // 初始化实例并绑定 ResizeObserver；卸载时统一释放，避免 React StrictMode 下残留实例。
  useEffect(() => {
    const dom = chartRef.current;
    if (!dom) return;

    const existing = echarts.getInstanceByDom(dom);
    const instance = existing ?? echarts.init(dom);
    instanceRef.current = instance;

    const observer = new ResizeObserver(() => {
      instance.resize();
    });
    observer.observe(dom);

    return () => {
      observer.disconnect();

      const current = instanceRef.current ?? echarts.getInstanceByDom(dom);
      if (current) {
        current.dispose();
      }
      instanceRef.current = null;
    };
  }, []);

  // 配置变化时更新图表；实例已存在时只 setOption，不重复 init。
  useEffect(() => {
    if (loading || error || empty) {
      return;
    }

    const dom = chartRef.current;
    if (!dom) return;

    const instance =
      instanceRef.current ??
      echarts.getInstanceByDom(dom) ??
      echarts.init(dom);
    instanceRef.current = instance;
    instance.setOption(mergedOption, true);
  }, [mergedOption, loading, error, empty]);

  const resolvedHeight = typeof height === 'number' ? `${height}px` : height;
  const minHeight = typeof height === 'number' ? height : 220;

  // 渲染内容区域
  const renderContent = () => {
    const mask = (() => {
      if (loading) {
        return <InlineLoadingState tip="加载中..." />;
      }
      if (error) {
        return <Empty description={error} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
      }
      if (empty) {
        return <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
      }
      return null;
    })();

    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: resolvedHeight,
          minHeight,
          flex: fullHeight ? 1 : undefined,
        }}
      >
        <div
          ref={chartRef}
          style={{
            width: '100%',
            height: '100%',
            minHeight,
            visibility: mask ? 'hidden' : 'visible',
          }}
        />
        {mask && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {mask}
          </div>
        )}
      </div>
    );
  };

  // 如果没有标题，直接渲染图表
  if (!title) {
    return (
      <div className={fullHeight ? `${className ?? ''} h-full flex flex-col`.trim() : className}>
        {renderContent()}
      </div>
    );
  }

  return (
    <Card
      title={
        <div>
          <span>{title}</span>
          {subtitle && (
            <span style={{ fontSize: 12, fontWeight: 'normal', marginLeft: 8, opacity: 0.6 }}>
              {subtitle}
            </span>
          )}
        </div>
      }
      extra={actions}
      className={fullHeight ? `${className ?? ''} h-full flex flex-col`.trim() : className}
      styles={{
        body: {
          padding: '12px 16px',
          ...(fullHeight ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' as const } : {}),
        },
      }}
    >
      {renderContent()}
    </Card>
  );
};

export default ChartWrapper;

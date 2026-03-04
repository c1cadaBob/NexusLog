import React, { useRef, useEffect, useMemo } from 'react';
import { Card, Spin, Empty } from 'antd';
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
  /** 图表高度，默认 300 */
  height?: number;
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

  // 初始化和销毁 ECharts 实例
  useEffect(() => {
    if (!chartRef.current) return;

    const instance = echarts.init(chartRef.current);
    instanceRef.current = instance;

    return () => {
      instance.dispose();
      instanceRef.current = null;
    };
  }, []);

  // 主题切换时重新创建实例
  useEffect(() => {
    if (!chartRef.current) return;

    if (instanceRef.current) {
      instanceRef.current.dispose();
    }
    const instance = echarts.init(chartRef.current);
    instanceRef.current = instance;

    // 合并主题配置和用户配置
    instance.setOption({ ...themeOption, ...option }, true);
  }, [isDark]);

  // 更新图表配置
  useEffect(() => {
    if (!instanceRef.current) return;
    instanceRef.current.setOption({ ...themeOption, ...option }, true);
  }, [option, themeOption]);

  // 响应式 resize
  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;

    const observer = new ResizeObserver(() => {
      instance.resize();
    });

    if (chartRef.current) {
      observer.observe(chartRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // 渲染内容区域
  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin tip="加载中..." />
        </div>
      );
    }

    if (error) {
      return (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description={error} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      );
    }

    if (empty) {
      return (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      );
    }

    return <div ref={chartRef} style={{ width: '100%', height }} />;
  };

  // 如果没有标题，直接渲染图表
  if (!title) {
    return <div className={className}>{renderContent()}</div>;
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
      className={className}
      styles={{ body: { padding: '12px 16px' } }}
    >
      {renderContent()}
    </Card>
  );
};

export default ChartWrapper;

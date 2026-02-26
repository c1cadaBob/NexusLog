import React, { useState, useMemo, useCallback } from 'react';
import { Card, Select, Button, Tag, Table, Space, Segmented, Tooltip, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS } from '../../theme/tokens';
import ChartWrapper from '../../components/charts/ChartWrapper';
import type { EChartsCoreOption } from 'echarts/core';

// ============================================================================
// 类型定义
// ============================================================================

type VisualizationType = 'bar' | 'pie' | 'line' | 'area' | 'table';
type MetricType = 'count' | 'avg' | 'sum' | 'min' | 'max' | 'p99';

interface Filter {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface QueryConfig {
  aggregateField: string;
  metric: MetricType;
  groupBy: string;
  timeRange: string;
  filters: Filter[];
}

// ============================================================================
// 常量 & 模拟数据
// ============================================================================

const AGGREGATE_FIELDS = [
  { value: 'status_code', label: 'Status Code (状态码)' },
  { value: 'response_time', label: 'Response Time (响应时间)' },
  { value: 'request_method', label: 'Request Method (请求方法)' },
  { value: 'error_type', label: 'Error Type (错误类型)' },
  { value: 'log_level', label: 'Log Level (日志级别)' },
];

const GROUP_BY_FIELDS = [
  { value: 'service_name', label: 'Service Name (服务名)' },
  { value: 'host', label: 'Host (主机)' },
  { value: 'region', label: 'Region (区域)' },
  { value: 'environment', label: 'Environment (环境)' },
  { value: 'user_id', label: 'User ID (用户ID)' },
];

const METRICS: { value: MetricType; label: string }[] = [
  { value: 'count', label: 'Count (计数)' },
  { value: 'avg', label: 'Average (平均值)' },
  { value: 'sum', label: 'Sum (总和)' },
  { value: 'min', label: 'Min (最小值)' },
  { value: 'max', label: 'Max (最大值)' },
  { value: 'p99', label: 'P99 (99分位)' },
];

const TIME_RANGES = [
  { value: '15m', label: '最近 15 分钟' },
  { value: '1h', label: '最近 1 小时' },
  { value: '6h', label: '最近 6 小时' },
  { value: '24h', label: '最近 24 小时' },
  { value: '7d', label: '最近 7 天' },
  { value: '30d', label: '最近 30 天' },
];

const SERVICE_DATA = [
  { name: 'Payment', requests: 90, errors: 25, latency: 120 },
  { name: 'Auth', requests: 85, errors: 15, latency: 80 },
  { name: 'User', requests: 45, errors: 10, latency: 95 },
  { name: 'Cart', requests: 90, errors: 35, latency: 150 },
  { name: 'Search', requests: 30, errors: 5, latency: 200 },
  { name: 'Order', requests: 60, errors: 20, latency: 110 },
];

const LOG_DISTRIBUTION = [
  { name: 'INFO', value: 65, color: COLORS.primary },
  { name: 'WARN', value: 20, color: COLORS.warning },
  { name: 'ERROR', value: 12, color: COLORS.danger },
  { name: 'DEBUG', value: 3, color: COLORS.purple },
];

const TIME_SERIES_DATA = [
  { time: '00:00', value: 180, errors: 12 },
  { time: '04:00', value: 150, errors: 8 },
  { time: '08:00', value: 280, errors: 25 },
  { time: '12:00', value: 350, errors: 30 },
  { time: '16:00', value: 320, errors: 22 },
  { time: '20:00', value: 250, errors: 18 },
  { time: '24:00', value: 180, errors: 10 },
];

const DETAIL_DATA = [
  { key: '1', service: 'payment-service', code: 500, count: '14,203', percent: 24, trend: [10, 20, 15, 25, 30] },
  { key: '2', service: 'auth-service', code: 503, count: '8,432', percent: 15, trend: [30, 25, 20, 15, 10] },
  { key: '3', service: 'user-service', code: 404, count: '5,100', percent: 9, trend: [5, 10, 5, 10, 15] },
  { key: '4', service: 'cart-service', code: 500, count: '3,205', percent: 6, trend: [10, 10, 10, 10, 10] },
  { key: '5', service: 'order-service', code: 502, count: '2,890', percent: 5, trend: [8, 12, 10, 14, 11] },
];

const VIZ_OPTIONS = [
  { value: 'bar', label: '柱状图', icon: 'bar_chart' },
  { value: 'pie', label: '饼图', icon: 'pie_chart' },
  { value: 'line', label: '折线图', icon: 'show_chart' },
  { value: 'area', label: '面积图', icon: 'area_chart' },
  { value: 'table', label: '表格', icon: 'table_chart' },
];

// ============================================================================
// 主组件
// ============================================================================

const AggregateAnalysis: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);

  const [vizType, setVizType] = useState<VisualizationType>('bar');
  const [loading, setLoading] = useState(false);
  const [queryConfig, setQueryConfig] = useState<QueryConfig>({
    aggregateField: 'status_code',
    metric: 'count',
    groupBy: 'service_name',
    timeRange: '24h',
    filters: [
      { id: '1', field: 'env', operator: 'eq', value: 'production' },
      { id: '2', field: 'level', operator: 'in', value: 'error,warn' },
    ],
  });

  const handleExecute = useCallback(() => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  }, []);

  const addFilter = useCallback(() => {
    setQueryConfig((prev) => ({
      ...prev,
      filters: [...prev.filters, { id: Date.now().toString(), field: 'service_name', operator: 'eq', value: '' }],
    }));
  }, []);

  const removeFilter = useCallback((id: string) => {
    setQueryConfig((prev) => ({
      ...prev,
      filters: prev.filters.filter((f) => f.id !== id),
    }));
  }, []);

  // ---- ECharts 配置 ----

  const barOption: EChartsCoreOption = useMemo(() => ({
    grid: { top: 40, right: 16, bottom: 32, left: 48 },
    legend: { show: true, top: 0, right: 0, textStyle: { fontSize: 10, color: isDark ? '#94a3b8' : '#475569' } },
    xAxis: { type: 'category', data: SERVICE_DATA.map((d) => d.name) },
    yAxis: { type: 'value' },
    series: [
      { name: '请求数', type: 'bar', data: SERVICE_DATA.map((d) => d.requests), itemStyle: { color: COLORS.primary, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 32 },
      { name: '错误数', type: 'bar', data: SERVICE_DATA.map((d) => d.errors), itemStyle: { color: COLORS.danger, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 32 },
    ],
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  }), [isDark]);

  const pieOption: EChartsCoreOption = useMemo(() => ({
    legend: { orient: 'vertical', right: 16, top: 'center', textStyle: { fontSize: 12, color: isDark ? '#94a3b8' : '#475569' } },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['40%', '50%'],
      padAngle: 3,
      itemStyle: { borderRadius: 4 },
      data: LOG_DISTRIBUTION.map((d) => ({ name: d.name, value: d.value, itemStyle: { color: d.color } })),
      label: { show: true, formatter: '{b}: {d}%', fontSize: 11, color: isDark ? '#94a3b8' : '#475569' },
    }],
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  }), [isDark]);

  const lineOption: EChartsCoreOption = useMemo(() => ({
    grid: { top: 40, right: 16, bottom: 32, left: 48 },
    legend: { show: true, top: 0, right: 0, textStyle: { fontSize: 10, color: isDark ? '#94a3b8' : '#475569' } },
    xAxis: { type: 'category', data: TIME_SERIES_DATA.map((d) => d.time) },
    yAxis: { type: 'value' },
    series: [
      { name: '请求量', type: 'line', data: TIME_SERIES_DATA.map((d) => d.value), smooth: true, symbol: 'none', lineStyle: { width: 2 }, itemStyle: { color: COLORS.primary } },
      { name: '错误数', type: 'line', data: TIME_SERIES_DATA.map((d) => d.errors), smooth: true, symbol: 'none', lineStyle: { width: 2 }, itemStyle: { color: COLORS.danger } },
    ],
    tooltip: { trigger: 'axis' },
  }), [isDark]);

  const areaOption: EChartsCoreOption = useMemo(() => ({
    grid: { top: 40, right: 16, bottom: 32, left: 48 },
    legend: { show: true, top: 0, right: 0, textStyle: { fontSize: 10, color: isDark ? '#94a3b8' : '#475569' } },
    xAxis: { type: 'category', data: TIME_SERIES_DATA.map((d) => d.time) },
    yAxis: { type: 'value' },
    series: [
      { name: '请求量', type: 'line', data: TIME_SERIES_DATA.map((d) => d.value), smooth: true, symbol: 'none', areaStyle: { opacity: 0.3 }, itemStyle: { color: COLORS.primary } },
      { name: '错误数', type: 'line', data: TIME_SERIES_DATA.map((d) => d.errors), smooth: true, symbol: 'none', areaStyle: { opacity: 0.3 }, itemStyle: { color: COLORS.danger } },
    ],
    tooltip: { trigger: 'axis' },
  }), [isDark]);

  // ---- 详细数据表格列 ----

  const detailColumns: ColumnsType<typeof DETAIL_DATA[0]> = useMemo(() => [
    {
      title: '服务名称',
      dataIndex: 'service',
      key: 'service',
      width: 200,
      render: (v: string, _r, idx: number) => {
        const colors = [COLORS.success, COLORS.warning, COLORS.info, COLORS.purple, COLORS.danger];
        return (
          <span className="flex items-center gap-2 font-medium text-sm">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: colors[idx % colors.length] }} />
            {v}
          </span>
        );
      },
    },
    { title: '状态码', dataIndex: 'code', key: 'code', width: 100, render: (v: number) => <span className="font-mono text-sm">{v}</span> },
    { title: '数量', dataIndex: 'count', key: 'count', width: 120, align: 'right' as const, render: (v: string) => <span className="font-mono text-sm">{v}</span> },
    {
      title: '占比',
      dataIndex: 'percent',
      key: 'percent',
      width: 160,
      align: 'right' as const,
      render: (v: number) => (
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs opacity-60">{v}%</span>
          <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? '#334155' : '#e2e8f0' }}>
            <div className="h-full rounded-full" style={{ width: `${v}%`, backgroundColor: COLORS.primary }} />
          </div>
        </div>
      ),
    },
    {
      title: '趋势 (24h)',
      dataIndex: 'trend',
      key: 'trend',
      width: 120,
      render: (trend: number[]) => (
        <div className="flex items-end gap-0.5 h-6">
          {trend.map((h, i) => (
            <div key={i} className="flex-1 rounded-sm" style={{ height: `${h * 3}%`, backgroundColor: `${COLORS.primary}80` }} />
          ))}
        </div>
      ),
    },
  ], [isDark]);

  // ---- 渲染图表区域 ----

  const renderMainChart = () => {
    if (vizType === 'table') {
      return (
        <Card title="服务指标分布" styles={{ body: { padding: '0 16px 16px' } }}>
          <Table
            dataSource={SERVICE_DATA.map((d, i) => ({ ...d, key: i, errorRate: ((d.errors / d.requests) * 100).toFixed(1) }))}
            columns={[
              { title: '服务名称', dataIndex: 'name', key: 'name' },
              { title: '请求数', dataIndex: 'requests', key: 'requests', render: (v: number) => <span className="font-mono">{v}</span> },
              { title: '错误数', dataIndex: 'errors', key: 'errors', render: (v: number) => <span className="font-mono" style={{ color: COLORS.danger }}>{v}</span> },
              { title: '延迟 (ms)', dataIndex: 'latency', key: 'latency', render: (v: number) => <span className="font-mono">{v}</span> },
              {
                title: '错误率', dataIndex: 'errorRate', key: 'errorRate',
                render: (v: string) => <Tag color={parseFloat(v) > 20 ? 'error' : 'success'}>{v}%</Tag>,
              },
            ]}
            pagination={false}
            size="small"
          />
        </Card>
      );
    }

    const optionMap: Record<string, EChartsCoreOption> = { bar: barOption, pie: pieOption, line: lineOption, area: areaOption };
    const titleMap: Record<string, string> = { bar: '服务请求分布', pie: '日志级别占比', line: '请求量趋势', area: '请求量趋势' };

    return (
      <ChartWrapper
        title={titleMap[vizType] || '服务请求分布'}
        subtitle={`按 ${queryConfig.groupBy} 分组 · ${queryConfig.timeRange}`}
        option={optionMap[vizType] || barOption}
        height={340}
      />
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 页面头部 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold m-0">聚合分析</h2>
          <span className="text-xs opacity-50">Log Analysis / Aggregation</span>
        </div>
        <Space wrap>
          <Segmented
            value={vizType}
            onChange={(v) => setVizType(v as VisualizationType)}
            options={VIZ_OPTIONS.map((o) => ({
              value: o.value,
              label: (
                <span className="flex items-center gap-1 px-1">
                  <span className="material-symbols-outlined text-base">{o.icon}</span>
                  <span className="hidden sm:inline text-xs">{o.label}</span>
                </span>
              ),
            }))}
            size="small"
          />
          <Button
            icon={<span className="material-symbols-outlined text-sm">refresh</span>}
            type="primary"
            size="small"
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* 查询构建器 */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base" style={{ color: COLORS.primary }}>query_stats</span>
            聚合查询构建器
          </span>
        }
        styles={{ body: { padding: '16px' } }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1" style={{ minWidth: 170 }}>
            <div className="text-xs font-medium opacity-50 mb-1.5 uppercase tracking-wider">聚合字段</div>
            <Select
              value={queryConfig.aggregateField}
              onChange={(v) => setQueryConfig((p) => ({ ...p, aggregateField: v }))}
              options={AGGREGATE_FIELDS}
              style={{ width: '100%' }}
              size="middle"
            />
          </div>
          <div className="flex-1" style={{ minWidth: 170 }}>
            <div className="text-xs font-medium opacity-50 mb-1.5 uppercase tracking-wider">指标类型</div>
            <Select
              value={queryConfig.metric}
              onChange={(v) => setQueryConfig((p) => ({ ...p, metric: v }))}
              options={METRICS}
              style={{ width: '100%' }}
              size="middle"
            />
          </div>
          <div className="flex-1" style={{ minWidth: 170 }}>
            <div className="text-xs font-medium opacity-50 mb-1.5 uppercase tracking-wider">分组字段</div>
            <Select
              value={queryConfig.groupBy}
              onChange={(v) => setQueryConfig((p) => ({ ...p, groupBy: v }))}
              options={GROUP_BY_FIELDS}
              style={{ width: '100%' }}
              size="middle"
            />
          </div>
          <div className="flex-1" style={{ minWidth: 170 }}>
            <div className="text-xs font-medium opacity-50 mb-1.5 uppercase tracking-wider">时间范围</div>
            <Select
              value={queryConfig.timeRange}
              onChange={(v) => setQueryConfig((p) => ({ ...p, timeRange: v }))}
              options={TIME_RANGES}
              style={{ width: '100%' }}
              size="middle"
            />
          </div>
          <Button
            type="primary"
            loading={loading}
            onClick={handleExecute}
            icon={<span className="material-symbols-outlined text-sm">play_arrow</span>}
          >
            {loading ? '分析中...' : '开始分析'}
          </Button>
        </div>

        {/* 筛选条件 */}
        <div className="flex items-center gap-2 flex-wrap mt-4 pt-3" style={{ borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
          <span className="text-xs opacity-50">过滤条件:</span>
          {queryConfig.filters.map((f) => (
            <Tag
              key={f.id}
              closable
              onClose={() => removeFilter(f.id)}
              color="blue"
              style={{ margin: 0 }}
            >
              {f.value || `${f.field}: *`}
            </Tag>
          ))}
          <Button type="dashed" size="small" onClick={addFilter} icon={<span className="material-symbols-outlined text-sm">add</span>}>
            添加过滤器
          </Button>
        </div>
      </Card>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {renderMainChart()}
        </div>
        <div>
          <ChartWrapper
            title="日志级别占比"
            subtitle="Total Events: 2.4M"
            option={pieOption}
            height={340}
          />
        </div>
      </div>

      {/* 详细数据表格 */}
      <Card
        title="详细数据"
        extra={
          <Space>
            <Tooltip title="导出 CSV">
              <Button
                size="small"
                icon={<span className="material-symbols-outlined text-sm">download</span>}
                onClick={() => message.success('CSV 导出成功')}
              >
                导出 CSV
              </Button>
            </Tooltip>
            <Tooltip title="导出 JSON">
              <Button
                size="small"
                icon={<span className="material-symbols-outlined text-sm">code</span>}
                onClick={() => message.success('JSON 导出成功')}
              >
                导出 JSON
              </Button>
            </Tooltip>
          </Space>
        }
      >
        <Table
          dataSource={DETAIL_DATA}
          columns={detailColumns}
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
};

export default AggregateAnalysis;

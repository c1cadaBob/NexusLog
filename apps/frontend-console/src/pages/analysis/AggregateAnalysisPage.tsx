/**
 * 聚合分析页面
 * 
 * 提供聚合查询构建器、多种可视化类型（柱状图、饼图、折线图、面积图、表格）
 * 以及详细数据表格和导出功能
 * 
 * @requirements 9.5
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Row, Col, Card, Typography, Space, Button, Select, Tag, Table, Input,
  Segmented, Spin, Progress, Tooltip,
} from 'antd';
import {
  PlayCircleOutlined, ReloadOutlined, DownloadOutlined, PlusOutlined,
  BarChartOutlined, PieChartOutlined, LineChartOutlined,
  AreaChartOutlined, TableOutlined, SearchOutlined,
} from '@ant-design/icons';
import { BaseChart } from '@/components/charts';
import type { EChartsOption } from 'echarts';

const { Title, Text } = Typography;

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
// 模拟数据
// ============================================================================

const AGGREGATE_FIELDS = [
  { value: 'status_code', label: '状态码 (Status Code)' },
  { value: 'response_time', label: '响应时间 (Response Time)' },
  { value: 'request_method', label: '请求方法 (Request Method)' },
  { value: 'error_type', label: '错误类型 (Error Type)' },
  { value: 'log_level', label: '日志级别 (Log Level)' },
];

const GROUP_BY_FIELDS = [
  { value: 'service_name', label: '服务名 (Service Name)' },
  { value: 'host', label: '主机 (Host)' },
  { value: 'region', label: '区域 (Region)' },
  { value: 'environment', label: '环境 (Environment)' },
  { value: 'user_id', label: '用户ID (User ID)' },
];

const METRICS: { value: MetricType; label: string }[] = [
  { value: 'count', label: '计数 (Count)' },
  { value: 'avg', label: '平均值 (Average)' },
  { value: 'sum', label: '总和 (Sum)' },
  { value: 'min', label: '最小值 (Min)' },
  { value: 'max', label: '最大值 (Max)' },
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

const serviceData = [
  { name: 'Payment', requests: 90, errors: 25, latency: 120 },
  { name: 'Auth', requests: 85, errors: 15, latency: 80 },
  { name: 'User', requests: 45, errors: 10, latency: 95 },
  { name: 'Cart', requests: 90, errors: 35, latency: 150 },
  { name: 'Search', requests: 30, errors: 5, latency: 200 },
  { name: 'Order', requests: 60, errors: 20, latency: 110 },
];

const logDistribution = [
  { name: 'INFO', value: 65, color: '#1677ff' },
  { name: 'WARN', value: 20, color: '#faad14' },
  { name: 'ERROR', value: 12, color: '#ef4444' },
  { name: 'DEBUG', value: 3, color: '#8b5cf6' },
];

const timeSeriesData = [
  { time: '00:00', value: 180, errors: 12 },
  { time: '04:00', value: 150, errors: 8 },
  { time: '08:00', value: 280, errors: 25 },
  { time: '12:00', value: 350, errors: 30 },
  { time: '16:00', value: 320, errors: 22 },
  { time: '20:00', value: 250, errors: 18 },
  { time: '24:00', value: 180, errors: 10 },
];

const detailData = [
  { key: '1', service: 'payment-service', code: 500, count: 14203, percent: 24 },
  { key: '2', service: 'auth-service', code: 503, count: 8432, percent: 15 },
  { key: '3', service: 'user-service', code: 404, count: 5100, percent: 9 },
  { key: '4', service: 'cart-service', code: 500, count: 3205, percent: 6 },
  { key: '5', service: 'order-service', code: 502, count: 2890, percent: 5 },
];

// ============================================================================
// ECharts 配置生成
// ============================================================================

function getBarOption(): EChartsOption {
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { bottom: 0 },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: serviceData.map(d => d.name) },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
    series: [
      { name: '请求数', type: 'bar', data: serviceData.map(d => d.requests), itemStyle: { color: '#1677ff', borderRadius: [4, 4, 0, 0] } },
      { name: '错误数', type: 'bar', data: serviceData.map(d => d.errors), itemStyle: { color: '#ef4444', borderRadius: [4, 4, 0, 0] } },
    ],
  };
}

function getPieOption(): EChartsOption {
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '45%'],
      padAngle: 3,
      itemStyle: { borderRadius: 6 },
      data: logDistribution.map(d => ({ name: d.name, value: d.value, itemStyle: { color: d.color } })),
      label: { show: true, formatter: '{b}\n{d}%' },
    }],
  };
}

function getLineOption(): EChartsOption {
  return {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: timeSeriesData.map(d => d.time) },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
    series: [
      { name: '请求量', type: 'line', data: timeSeriesData.map(d => d.value), smooth: true, itemStyle: { color: '#1677ff' } },
      { name: '错误数', type: 'line', data: timeSeriesData.map(d => d.errors), smooth: true, itemStyle: { color: '#ef4444' } },
    ],
  };
}

function getAreaOption(): EChartsOption {
  return {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: timeSeriesData.map(d => d.time), boundaryGap: false },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
    series: [
      {
        name: '请求量', type: 'line', data: timeSeriesData.map(d => d.value), smooth: true,
        areaStyle: { opacity: 0.3 }, itemStyle: { color: '#1677ff' },
      },
      {
        name: '错误数', type: 'line', data: timeSeriesData.map(d => d.errors), smooth: true,
        areaStyle: { opacity: 0.3 }, itemStyle: { color: '#ef4444' },
      },
    ],
  };
}

// ============================================================================
// 查询构建器组件
// ============================================================================

interface QueryBuilderProps {
  config: QueryConfig;
  onChange: (config: QueryConfig) => void;
  onExecute: () => void;
  loading?: boolean;
}

const QueryBuilder: React.FC<QueryBuilderProps> = ({ config, onChange, onExecute, loading }) => {
  const addFilter = () => {
    const newFilter: Filter = { id: Date.now().toString(), field: 'service_name', operator: 'eq', value: '' };
    onChange({ ...config, filters: [...config.filters, newFilter] });
  };

  const removeFilter = (id: string) => {
    onChange({ ...config, filters: config.filters.filter(f => f.id !== id) });
  };

  const updateFilter = (id: string, value: string) => {
    onChange({ ...config, filters: config.filters.map(f => f.id === id ? { ...f, value } : f) });
  };

  return (
    <Card size="small" title={<Space><SearchOutlined />聚合查询构建器</Space>}>
      <Row gutter={[12, 12]} align="bottom">
        <Col xs={24} sm={12} md={5}>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>聚合字段</Text>
            <Select
              value={config.aggregateField}
              onChange={v => onChange({ ...config, aggregateField: v })}
              options={AGGREGATE_FIELDS}
              style={{ width: '100%' }}
              size="small"
            />
          </div>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>指标</Text>
            <Select
              value={config.metric}
              onChange={v => onChange({ ...config, metric: v })}
              options={METRICS}
              style={{ width: '100%' }}
              size="small"
            />
          </div>
        </Col>
        <Col xs={24} sm={12} md={5}>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>分组依据</Text>
            <Select
              value={config.groupBy}
              onChange={v => onChange({ ...config, groupBy: v })}
              options={GROUP_BY_FIELDS}
              style={{ width: '100%' }}
              size="small"
            />
          </div>
        </Col>
        <Col xs={24} sm={12} md={5}>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>时间范围</Text>
            <Select
              value={config.timeRange}
              onChange={v => onChange({ ...config, timeRange: v })}
              options={TIME_RANGES}
              style={{ width: '100%' }}
              size="small"
            />
          </div>
        </Col>
        <Col xs={24} sm={24} md={5}>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={onExecute}
            loading={loading}
            block
            size="small"
          >
            {loading ? '分析中...' : '开始分析'}
          </Button>
        </Col>
      </Row>

      {/* 过滤条件 */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
        <Space size={[8, 8]} wrap>
          <Text type="secondary" style={{ fontSize: 12 }}>过滤条件:</Text>
          {config.filters.map(filter => (
            <Tag
              key={filter.id}
              closable
              onClose={() => removeFilter(filter.id)}
              color="blue"
            >
              <Input
                size="small"
                variant="borderless"
                value={filter.value || `${filter.field}: *`}
                onChange={e => updateFilter(filter.id, e.target.value)}
                style={{ width: 100, padding: 0, fontSize: 12 }}
              />
            </Tag>
          ))}
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addFilter}>
            添加过滤器
          </Button>
        </Space>
      </div>
    </Card>
  );
};


// ============================================================================
// 详细数据表格
// ============================================================================

const detailColumns = [
  {
    title: '服务名称',
    dataIndex: 'service',
    key: 'service',
    render: (text: string) => <Text strong>{text}</Text>,
  },
  {
    title: '状态码',
    dataIndex: 'code',
    key: 'code',
    render: (code: number) => <Tag color={code >= 500 ? 'error' : code >= 400 ? 'warning' : 'success'}>{code}</Tag>,
  },
  {
    title: '数量',
    dataIndex: 'count',
    key: 'count',
    align: 'right' as const,
    render: (v: number) => <Text style={{ fontFamily: 'monospace' }}>{v.toLocaleString()}</Text>,
  },
  {
    title: '占比',
    dataIndex: 'percent',
    key: 'percent',
    align: 'right' as const,
    width: 200,
    render: (percent: number) => (
      <Space>
        <Progress percent={percent} size="small" style={{ width: 100, margin: 0 }} />
        <Text type="secondary" style={{ fontSize: 12 }}>{percent}%</Text>
      </Space>
    ),
  },
];

// ============================================================================
// 可视化类型选项
// ============================================================================

const VIZ_OPTIONS = [
  { value: 'bar', icon: <BarChartOutlined />, label: '柱状图' },
  { value: 'pie', icon: <PieChartOutlined />, label: '饼图' },
  { value: 'line', icon: <LineChartOutlined />, label: '折线图' },
  { value: 'area', icon: <AreaChartOutlined />, label: '面积图' },
  { value: 'table', icon: <TableOutlined />, label: '表格' },
];

// ============================================================================
// 主组件
// ============================================================================

export const AggregateAnalysisPage: React.FC = () => {
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

  const handleExecuteQuery = useCallback(() => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  }, []);

  // 根据可视化类型获取 ECharts 配置
  const chartOption = useMemo<EChartsOption>(() => {
    switch (vizType) {
      case 'bar': return getBarOption();
      case 'pie': return getPieOption();
      case 'line': return getLineOption();
      case 'area': return getAreaOption();
      default: return getBarOption();
    }
  }, [vizType]);

  // 表格模式的列定义
  const tableColumns = [
    { title: '服务名称', dataIndex: 'name', key: 'name' },
    { title: '请求数', dataIndex: 'requests', key: 'requests', align: 'right' as const },
    { title: '错误数', dataIndex: 'errors', key: 'errors', align: 'right' as const, render: (v: number) => <Text type="danger">{v}</Text> },
    { title: '延迟 (ms)', dataIndex: 'latency', key: 'latency', align: 'right' as const },
    {
      title: '错误率', key: 'errorRate', align: 'right' as const,
      render: (_: unknown, record: typeof serviceData[0]) => {
        const rate = ((record.errors / record.requests) * 100).toFixed(1);
        return <Tag color={Number(rate) > 20 ? 'error' : 'success'}>{rate}%</Tag>;
      },
    },
  ];

  return (
    <div>
      {/* 页面头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>聚合分析</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>Log Analysis / Aggregation</Text>
        </div>
        <Space>
          <Segmented
            value={vizType}
            onChange={v => setVizType(v as VisualizationType)}
            options={VIZ_OPTIONS.map(opt => ({
              value: opt.value,
              icon: opt.icon,
              label: opt.label,
            }))}
            size="small"
          />
          <Button icon={<ReloadOutlined />} size="small">刷新</Button>
        </Space>
      </div>

      {/* 查询构建器 */}
      <div style={{ marginBottom: 16 }}>
        <QueryBuilder
          config={queryConfig}
          onChange={setQueryConfig}
          onExecute={handleExecuteQuery}
          loading={loading}
        />
      </div>

      {/* 图表区域 */}
      <Spin spinning={loading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={16}>
            <Card
              title={`服务${queryConfig.metric === 'count' ? '请求' : '指标'}分布`}
              extra={<Text type="secondary" style={{ fontSize: 12 }}>按 {queryConfig.groupBy} 分组 · {queryConfig.timeRange}</Text>}
              styles={{ body: { padding: '12px 16px' } }}
            >
              {vizType === 'table' ? (
                <Table
                  dataSource={serviceData.map((d, i) => ({ ...d, key: i }))}
                  columns={tableColumns}
                  pagination={false}
                  size="small"
                />
              ) : (
                <BaseChart option={chartOption} height={360} />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card
              title="日志级别占比"
              extra={<Text type="secondary" style={{ fontSize: 12 }}>Total: 2.4M</Text>}
              styles={{ body: { padding: '12px 16px' } }}
            >
              <BaseChart option={getPieOption()} height={360} />
            </Card>
          </Col>
        </Row>
      </Spin>

      {/* 详细数据表格 */}
      <Card
        title="详细数据"
        extra={
          <Space>
            <Tooltip title="导出 CSV">
              <Button size="small" icon={<DownloadOutlined />}>CSV</Button>
            </Tooltip>
            <Tooltip title="导出 JSON">
              <Button size="small" icon={<DownloadOutlined />}>JSON</Button>
            </Tooltip>
          </Space>
        }
      >
        <Table
          dataSource={detailData}
          columns={detailColumns}
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
};

export default AggregateAnalysisPage;

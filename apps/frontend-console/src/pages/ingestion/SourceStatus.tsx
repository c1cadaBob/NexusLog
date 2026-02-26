import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Input, Select, Button, Card, Table, Tag, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS } from '../../theme/tokens';
import type { SourceStatusData } from '../../types/ingestion';

echarts.use([LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

// ============================================================================
// 模拟数据
// ============================================================================

interface TrendDataPoint { time: string; eps: number; }

const generateTrendData = (): TrendDataPoint[] => {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const time = new Date(now.getTime() - (11 - i) * 5 * 60 * 1000);
    return { time: time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), eps: Math.floor(25000 + Math.random() * 25000) };
  });
};

const initialSources: SourceStatusData[] = [
  { id: 'src-k8s-001', name: 'Kafka-Prod-Log-01', type: 'Kafka', status: 'Running', eps: '12,450', latency: '5ms', lag: '102', health: 'Healthy' },
  { id: 'src-http-023', name: 'Nginx-Access-GW', type: 'HTTP', status: 'Running', eps: '8,320', latency: '12ms', lag: '-', health: 'Healthy' },
  { id: 'src-k8s-005', name: 'Kafka-Billing-02', type: 'Kafka', status: 'Lagging', eps: '24,100', latency: '45ms', lag: '15,400', health: 'Warning' },
  { id: 'src-file-112', name: 'App-Error-Logs', type: 'File', status: 'Running', eps: '360', latency: '2ms', lag: '-', health: 'Healthy' },
  { id: 'src-sys-999', name: 'Legacy-Syslog-Old', type: 'Syslog', status: 'Disconnected', eps: '0', latency: '-', lag: '-', health: 'Error' },
];

const errorData = [
  { name: 'Timeout', value: 120, color: COLORS.primary },
  { name: 'Auth Fail', value: 15, color: COLORS.danger },
  { name: 'Format Err', value: 8, color: COLORS.warning },
];

const getTypeIcon = (type: string) => {
  switch (type) { case 'Kafka': return 'dns'; case 'HTTP': return 'public'; case 'Syslog': return 'dns'; default: return 'description'; }
};

// ============================================================================
// 组件
// ============================================================================

const SourceStatus: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);

  const [sources, setSources] = useState<SourceStatusData[]>(initialSources);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>(generateTrendData());
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'1H' | '6H' | '24H'>('1H');
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [metrics, setMetrics] = useState({
    eps: 45230, epsTrend: 2.4, latency: 12, latencyTrend: 1.5,
    errorRate: 0.01, errorTrend: -0.05, kafkaLag: 1204,
  });

  // 实时数据更新
  useEffect(() => {
    if (!isAutoRefresh) return;
    const interval = setInterval(() => {
      setTrendData(prev => {
        const newData = [...prev.slice(1)];
        const now = new Date();
        newData.push({ time: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), eps: Math.floor(25000 + Math.random() * 25000) });
        return newData;
      });
      setMetrics({
        eps: Math.floor(40000 + Math.random() * 15000), epsTrend: parseFloat((Math.random() * 5 - 1).toFixed(1)),
        latency: Math.floor(8 + Math.random() * 10), latencyTrend: parseFloat((Math.random() * 3 - 1).toFixed(1)),
        errorRate: parseFloat((Math.random() * 0.05).toFixed(2)), errorTrend: parseFloat((Math.random() * 0.1 - 0.05).toFixed(2)),
        kafkaLag: Math.floor(800 + Math.random() * 800),
      });
      setSources(prev => prev.map(s => ({
        ...s,
        eps: s.status !== 'Disconnected' ? `${Math.floor(parseInt(s.eps.replace(/,/g, '')) * (0.9 + Math.random() * 0.2)).toLocaleString()}` : '0',
        latency: s.status !== 'Disconnected' ? `${Math.floor(parseInt(s.latency) * (0.8 + Math.random() * 0.4))}ms` : '-',
      })));
      setLastRefresh(new Date());
    }, 5000);
    return () => clearInterval(interval);
  }, [isAutoRefresh]);

  const filteredSources = useMemo(() => {
    let result = sources;
    if (typeFilter !== 'all') result = result.filter(s => s.type === typeFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
    }
    return result;
  }, [sources, typeFilter, searchQuery]);

  const handleRefresh = useCallback(() => { setTrendData(generateTrendData()); setLastRefresh(new Date()); }, []);

  const handleReconnect = useCallback((sourceId: string) => {
    setSources(prev => prev.map(s => s.id === sourceId ? { ...s, status: 'Running' as const, health: 'Healthy' as const, eps: '1,000', latency: '10ms' } : s));
  }, []);

  // ECharts 配置 - EPS 趋势
  const epsChartOption = useMemo(() => ({
    grid: { top: 10, right: 16, bottom: 30, left: 50 },
    xAxis: { type: 'category' as const, data: trendData.map(d => d.time), axisLine: { lineStyle: { color: isDark ? '#334155' : '#e2e8f0' } },
      axisLabel: { fontSize: 10, color: isDark ? '#94a3b8' : '#64748b' } },
    yAxis: { type: 'value' as const, axisLine: { lineStyle: { color: isDark ? '#334155' : '#e2e8f0' } },
      axisLabel: { fontSize: 10, color: isDark ? '#94a3b8' : '#64748b', formatter: (v: number) => `${(v / 1000).toFixed(0)}K` },
      splitLine: { lineStyle: { color: isDark ? '#334155' : '#e2e8f0', opacity: 0.3 } } },
    tooltip: { trigger: 'axis' as const, backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0',
      textStyle: { color: isDark ? '#fff' : '#1e293b', fontSize: 12 },
      formatter: (params: Array<{ value: number; axisValue: string }>) => {
        const p = params[0]; return `${p.axisValue}<br/>采集速率: ${p.value.toLocaleString()} EPS`;
      } },
    series: [{ type: 'line' as const, data: trendData.map(d => d.eps), smooth: true, lineStyle: { color: COLORS.primary, width: 2 },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: `${COLORS.primary}4d` }, { offset: 1, color: `${COLORS.primary}00` }
      ]) }, itemStyle: { color: COLORS.primary }, symbol: 'none' }],
  }), [trendData, isDark]);

  // ECharts 配置 - 错误类型饼图
  const pieChartOption = useMemo(() => ({
    tooltip: { trigger: 'item' as const, backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0',
      textStyle: { color: isDark ? '#fff' : '#1e293b', fontSize: 12 } },
    series: [{ type: 'pie' as const, radius: ['55%', '75%'], padAngle: 5, itemStyle: { borderRadius: 4 },
      data: errorData.map(d => ({ value: d.value, name: d.name, itemStyle: { color: d.color } })),
      label: { show: false }, emphasis: { scale: true, scaleSize: 4 } }],
  }), [isDark]);

  // 表格列
  const columns: ColumnsType<SourceStatusData> = [
    {
      title: '数据源名称', key: 'name',
      render: (_, src) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ padding: 8, borderRadius: 6, background: isDark ? '#111722' : '#f1f5f9', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{getTypeIcon(src.type)}</span>
          </div>
          <div>
            <div style={{ fontWeight: 500 }}>{src.name}</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>ID: {src.id}</div>
          </div>
        </div>
      ),
    },
    { title: '类型', dataIndex: 'type', key: 'type', width: 80, render: (type: string) => <Tag>{type}</Tag> },
    {
      title: '状态', key: 'status', width: 120,
      render: (_, src) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%',
            background: src.health === 'Healthy' ? COLORS.success : src.health === 'Warning' ? COLORS.warning : COLORS.danger }} />
          <span>{src.health === 'Healthy' ? '正常运行' : src.health === 'Warning' ? '积压告警' : '连接断开'}</span>
        </div>
      ),
    },
    { title: 'EPS (条/秒)', dataIndex: 'eps', key: 'eps', width: 120, align: 'right' as const,
      render: (v: string) => <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{v}</span> },
    { title: '延迟 (ms)', dataIndex: 'latency', key: 'latency', width: 100, align: 'right' as const,
      render: (v: string, src) => <span style={{ fontFamily: 'JetBrains Mono, monospace', color: src.health === 'Warning' ? COLORS.warning : COLORS.success }}>{v}</span> },
    { title: '积压量 (Offset)', dataIndex: 'lag', key: 'lag', width: 120, align: 'right' as const,
      render: (v: string, src) => <span style={{ fontFamily: 'JetBrains Mono, monospace', color: src.health === 'Warning' ? COLORS.warning : '#94a3b8', fontWeight: src.health === 'Warning' ? 700 : 400 }}>{v}</span> },
    {
      title: '操作', key: 'actions', width: 100, align: 'right' as const,
      render: (_, src) => src.health === 'Error' ? (
        <Space>
          <Button type="link" size="small" onClick={() => handleReconnect(src.id)}>重连</Button>
          <Button type="link" size="small" danger>日志</Button>
        </Space>
      ) : <Button type="link" size="small">详情</Button>,
    },
  ];

  // 指标卡片渲染
  const renderMetricCard = (label: string, value: string, trend: number, icon: string, iconColor: string, invertTrend = false, extra?: React.ReactNode) => {
    const isPositive = invertTrend ? trend <= 0 : trend >= 0;
    return (
      <Card size="small" styles={{ body: { padding: 20 } }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 700 }}>{value}</span>
              <span style={{ fontSize: 12, fontWeight: 500, padding: '2px 6px', borderRadius: 4,
                background: isPositive ? `${COLORS.success}1a` : `${COLORS.danger}1a`,
                color: isPositive ? COLORS.success : COLORS.danger, display: 'flex', alignItems: 'center', gap: 2 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{isPositive ? 'trending_up' : 'trending_down'}</span>
                {Math.abs(trend)}%
              </span>
            </div>
          </div>
          <div style={{ padding: 8, borderRadius: 8, background: `${iconColor}1a` }}>
            <span className="material-symbols-outlined" style={{ color: iconColor }}>{icon}</span>
          </div>
        </div>
        {extra}
      </Card>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>数据源状态</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>实时监控所有接入点的数据吞吐、延迟及 Kafka 积压情况</p>
        </div>
        <Space>
          <span style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: isAutoRefresh ? COLORS.success : '#94a3b8' }} />
            {isAutoRefresh ? '自动刷新中' : '已暂停'}
          </span>
          <Button size="small" type={isAutoRefresh ? 'primary' : 'default'}
            style={isAutoRefresh ? { background: `${COLORS.success}1a`, color: COLORS.success, borderColor: `${COLORS.success}33` } : {}}
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}>
            {isAutoRefresh ? '暂停' : '恢复'}
          </Button>
          <Button type="primary" icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>}>接入新数据源</Button>
        </Space>
      </div>

      {/* 指标卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {renderMetricCard('实时采集速率 (EPS)', metrics.eps.toLocaleString(), metrics.epsTrend, 'speed', COLORS.primary, false,
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40, opacity: 0.5 }}>
            {trendData.slice(-12).map((d, i) => (
              <div key={i} style={{ flex: 1, background: COLORS.primary, borderRadius: '2px 2px 0 0', height: `${(d.eps / 50000) * 100}%` }} />
            ))}
          </div>
        )}
        {renderMetricCard('平均延迟 (ms)', `${metrics.latency}ms`, metrics.latencyTrend, 'timer', '#6366f1', true,
          <div style={{ height: 2, background: `linear-gradient(to right, transparent, #6366f1, transparent)`, marginTop: 16 }} />
        )}
        {renderMetricCard('错误/丢弃率', `${metrics.errorRate}%`, metrics.errorTrend, 'error', COLORS.danger, true,
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: 4, height: 40, opacity: 0.5 }}>
            {[10, 5, 20, 0, 5, 2, 8, 3, 15, 5].map((h, i) => (
              <div key={i} style={{ width: 4, background: COLORS.danger, borderRadius: '2px 2px 0 0', height: `${h * 3}%` }} />
            ))}
          </div>
        )}
        <Card size="small" styles={{ body: { padding: 20 } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Kafka 总积压量</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 24, fontWeight: 700 }}>{metrics.kafkaLag.toLocaleString()}</span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>消息</span>
              </div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.warning}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.warning }}>layers</span>
            </div>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: isDark ? '#334155' : '#e2e8f0' }}>
            <div style={{ height: '100%', borderRadius: 3, background: COLORS.warning, transition: 'width 0.5s', width: `${Math.min((metrics.kafkaLag / 10000) * 100, 100)}%` }} />
          </div>
          <p style={{ fontSize: 10, color: '#94a3b8', textAlign: 'right', marginTop: 8, marginBottom: 0 }}>阈值: 10,000</p>
        </Card>
      </div>

      {/* 图表区域 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        <Card title={<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <span style={{ fontWeight: 700 }}>采集速率趋势 (EPS)</span>
          <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 8, background: isDark ? '#111722' : '#f1f5f9' }}>
            {(['1H', '6H', '24H'] as const).map(range => (
              <Button key={range} type={timeRange === range ? 'primary' : 'text'} size="small"
                onClick={() => setTimeRange(range)} style={{ borderRadius: 6 }}>{range}</Button>
            ))}
          </div>
        </div>} styles={{ body: { padding: '0 16px 16px' } }}>
          <ReactEChartsCore echarts={echarts} option={epsChartOption} style={{ height: 240 }} notMerge />
        </Card>

        <Card title={<span style={{ fontWeight: 700 }}>错误类型分布</span>} styles={{ body: { padding: '0 16px 16px' } }}>
          <div style={{ position: 'relative' }}>
            <ReactEChartsCore echarts={echarts} option={pieChartOption} style={{ height: 180 }} notMerge />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>99.9%</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>可用性</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            {errorData.map(item => (
              <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: item.color }} />
                  <span style={{ color: isDark ? '#cbd5e1' : '#475569' }}>{item.name}</span>
                </div>
                <span style={{ fontWeight: 500 }}>{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 数据源状态表格 */}
      <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' } }}>
        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
          <Input prefix={<span className="material-symbols-outlined" style={{ fontSize: 20, color: '#94a3b8' }}>search</span>}
            placeholder="搜索数据源名称或ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            style={{ maxWidth: 400 }} allowClear />
          <Space>
            <Select value={typeFilter} onChange={setTypeFilter} style={{ width: 120 }}
              options={[{ value: 'all', label: '全部类型' }, { value: 'Kafka', label: 'Kafka' }, { value: 'HTTP', label: 'HTTP' }, { value: 'File', label: 'File' }, { value: 'Syslog', label: 'Syslog' }]} />
            <Button icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>} onClick={handleRefresh}>刷新</Button>
          </Space>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Table<SourceStatusData> rowKey="id" columns={columns} dataSource={filteredSources} size="middle" pagination={false} scroll={{ x: 800 }} />
        </div>
        <div style={{ padding: '12px 24px', borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: '#94a3b8' }}>
          <span>显示 1 到 {filteredSources.length} 条，共 {sources.length} 条 · 最后更新: {lastRefresh.toLocaleTimeString('zh-CN')}</span>
        </div>
      </Card>
    </div>
  );
};

export default SourceStatus;

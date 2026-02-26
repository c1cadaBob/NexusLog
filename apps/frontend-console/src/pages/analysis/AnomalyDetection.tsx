import React, { useState, useMemo, useCallback } from 'react';
import { Card, Tag, Select, Button, Statistic, Drawer, Descriptions, Progress, Space } from 'antd';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS } from '../../theme/tokens';
import ChartWrapper from '../../components/charts/ChartWrapper';
import type { EChartsCoreOption } from 'echarts/core';

// ============================================================================
// 类型定义
// ============================================================================

type AnomalySeverity = 'critical' | 'high' | 'medium' | 'low';
type AnomalyStatus = 'active' | 'investigating' | 'resolved' | 'dismissed';

interface Anomaly {
  id: string;
  title: string;
  description: string;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  timestamp: string;
  service: string;
  confidence: number;
  metric: string;
  expectedValue: number;
  actualValue: number;
  rootCause?: string;
}

// ============================================================================
// 模拟数据
// ============================================================================

const TIME_RANGES = [
  { value: '1h', label: '过去 1 小时' },
  { value: '6h', label: '过去 6 小时' },
  { value: '24h', label: '过去 24 小时' },
  { value: '7d', label: '过去 7 天' },
];

const ANOMALY_CHART_DATA = [
  { time: '00:00', value: 180, expected: 175, low: 160, high: 200 },
  { time: '02:00', value: 175, expected: 170, low: 155, high: 195 },
  { time: '04:00', value: 185, expected: 180, low: 160, high: 210 },
  { time: '06:00', value: 170, expected: 175, low: 150, high: 200 },
  { time: '08:00', value: 190, expected: 185, low: 165, high: 210 },
  { time: '10:00', value: 200, expected: 195, low: 175, high: 220 },
  { time: '12:00', value: 350, expected: 200, low: 180, high: 225, anomaly: true },
  { time: '14:00', value: 210, expected: 205, low: 185, high: 230 },
  { time: '16:00', value: 180, expected: 190, low: 170, high: 215 },
  { time: '18:00', value: 165, expected: 175, low: 155, high: 200 },
  { time: '20:00', value: 50, expected: 170, low: 150, high: 195, anomaly: true },
  { time: '22:00', value: 175, expected: 170, low: 150, high: 195 },
  { time: '24:00', value: 185, expected: 175, low: 155, high: 200 },
];

const ANOMALIES: Anomaly[] = [
  {
    id: '1',
    title: 'API 延迟激增',
    description: 'Payment Gateway 服务的 API 响应时间突然增加到正常值的 3 倍',
    severity: 'critical',
    status: 'active',
    timestamp: '14:32:01',
    service: 'Payment-GW',
    confidence: 98,
    metric: 'response_time',
    expectedValue: 200,
    actualValue: 650,
    rootCause: '数据库连接池耗尽导致请求排队',
  },
  {
    id: '2',
    title: '异常错误率',
    description: 'Auth Service 的错误率从 0.5% 上升到 5.2%',
    severity: 'high',
    status: 'investigating',
    timestamp: '12:10:45',
    service: 'Auth-Svc',
    confidence: 85,
    metric: 'error_rate',
    expectedValue: 0.5,
    actualValue: 5.2,
  },
  {
    id: '3',
    title: '流量突降',
    description: 'Web Frontend 的请求量突然下降 70%',
    severity: 'medium',
    status: 'active',
    timestamp: '09:15:22',
    service: 'Web-Frontend',
    confidence: 72,
    metric: 'request_count',
    expectedValue: 1000,
    actualValue: 300,
  },
  {
    id: '4',
    title: '内存使用异常',
    description: 'Order Service 内存使用率持续上升',
    severity: 'low',
    status: 'resolved',
    timestamp: '08:45:10',
    service: 'Order-Svc',
    confidence: 65,
    metric: 'memory_usage',
    expectedValue: 60,
    actualValue: 85,
    rootCause: '内存泄漏已修复，服务已重启',
  },
];

// ============================================================================
// 辅助函数
// ============================================================================

const SEVERITY_MAP: Record<AnomalySeverity, { color: string; tagColor: string; icon: string; label: string }> = {
  critical: { color: COLORS.danger, tagColor: 'error', icon: 'error', label: '严重' },
  high: { color: COLORS.warning, tagColor: 'warning', icon: 'warning', label: '高' },
  medium: { color: COLORS.info, tagColor: 'processing', icon: 'info', label: '中' },
  low: { color: COLORS.success, tagColor: 'success', icon: 'info', label: '低' },
};

const STATUS_MAP: Record<AnomalyStatus, { tagColor: string; label: string }> = {
  active: { tagColor: 'error', label: '活跃' },
  investigating: { tagColor: 'warning', label: '调查中' },
  resolved: { tagColor: 'success', label: '已解决' },
  dismissed: { tagColor: 'default', label: '已忽略' },
};

// ============================================================================
// 主组件
// ============================================================================

const AnomalyDetection: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);

  const handleAnomalyClick = useCallback((anomaly: Anomaly) => {
    setSelectedAnomaly(anomaly);
  }, []);

  const activeCount = ANOMALIES.filter((a) => a.status === 'active' || a.status === 'investigating').length;
  const criticalCount = ANOMALIES.filter((a) => a.severity === 'critical' && a.status === 'active').length;

  // 异常检测时间线图表
  const timelineOption: EChartsCoreOption = useMemo(() => ({
    grid: { top: 40, right: 16, bottom: 32, left: 48 },
    legend: {
      show: true,
      top: 0,
      right: 0,
      textStyle: { fontSize: 10, color: isDark ? '#94a3b8' : '#475569' },
      data: ['实际值', '预期值', '正常范围'],
    },
    xAxis: { type: 'category', data: ANOMALY_CHART_DATA.map((d) => d.time), boundaryGap: false },
    yAxis: { type: 'value' },
    series: [
      {
        name: '正常范围',
        type: 'line',
        data: ANOMALY_CHART_DATA.map((d) => d.high),
        lineStyle: { opacity: 0 },
        stack: 'range',
        symbol: 'none',
        areaStyle: { opacity: 0 },
      },
      {
        name: '正常范围',
        type: 'line',
        data: ANOMALY_CHART_DATA.map((d) => d.high - d.low),
        lineStyle: { opacity: 0 },
        stack: 'range',
        symbol: 'none',
        areaStyle: { opacity: 0.15, color: COLORS.info },
      },
      {
        name: '预期值',
        type: 'line',
        data: ANOMALY_CHART_DATA.map((d) => d.expected),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, type: 'dashed', color: COLORS.success, opacity: 0.6 },
        itemStyle: { color: COLORS.success },
      },
      {
        name: '实际值',
        type: 'line',
        data: ANOMALY_CHART_DATA.map((d) => d.value),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: COLORS.info },
        itemStyle: { color: COLORS.info },
        markPoint: {
          symbol: 'circle',
          symbolSize: 12,
          data: ANOMALY_CHART_DATA
            .map((d, i) => d.anomaly ? { coord: [i, d.value], itemStyle: { color: COLORS.danger, borderColor: isDark ? '#1e293b' : '#fff', borderWidth: 2 } } : null)
            .filter(Boolean) as any[],
        },
      },
    ],
    tooltip: { trigger: 'axis' },
  }), [isDark]);

  return (
    <div className="flex flex-col gap-4">
      {/* 页面头部 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold m-0">异常检测</h2>
          <Tag color="success" style={{ margin: 0 }}>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              实时监控中
            </span>
          </Tag>
        </div>
        <Space>
          <Select
            value={selectedTimeRange}
            onChange={setSelectedTimeRange}
            options={TIME_RANGES}
            style={{ width: 140 }}
            size="small"
          />
          <Button
            size="small"
            icon={<span className="material-symbols-outlined text-sm">refresh</span>}
          />
        </Space>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <Statistic
            title="今日异常总数"
            value={ANOMALIES.length}
            prefix={<span className="material-symbols-outlined text-base" style={{ color: COLORS.danger }}>warning</span>}
            suffix={<span className="text-xs text-green-500 ml-1">↓ 12%</span>}
          />
        </Card>
        <Card>
          <Statistic
            title="严重告警"
            value={criticalCount}
            prefix={<span className="material-symbols-outlined text-base" style={{ color: COLORS.warning }}>priority_high</span>}
            suffix={<span className="text-xs text-red-500 ml-1">↑ 1</span>}
          />
        </Card>
        <Card>
          <Statistic
            title="系统健康度"
            value={92}
            suffix="%"
            prefix={<span className="material-symbols-outlined text-base" style={{ color: COLORS.success }}>health_and_safety</span>}
          />
        </Card>
        <Card>
          <Statistic
            title="平均修复时间"
            value="15m"
            prefix={<span className="material-symbols-outlined text-base" style={{ color: COLORS.info }}>timer</span>}
            suffix={<span className="text-xs text-green-500 ml-1">↓ 5m</span>}
          />
        </Card>
      </div>

      {/* 主内容区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: 400 }}>
        {/* 时间线图表 */}
        <div className="lg:col-span-2">
          <ChartWrapper
            title="日志量异常趋势"
            subtitle="基于机器学习模型的实时预测分析"
            option={timelineOption}
            height={360}
          />
        </div>

        {/* 异常事件列表 */}
        <Card
          title={
            <div className="flex items-center justify-between">
              <span>检测到的异常</span>
              <Tag style={{ margin: 0 }}>{activeCount} Active</Tag>
            </div>
          }
          styles={{ body: { padding: '8px 12px', maxHeight: 360, overflowY: 'auto' } }}
        >
          <div className="flex flex-col gap-2">
            {ANOMALIES.map((anomaly, idx) => {
              const sev = SEVERITY_MAP[anomaly.severity];
              const isCritical = anomaly.severity === 'critical';
              return (
                <div
                  key={anomaly.id}
                  onClick={() => handleAnomalyClick(anomaly)}
                  className="p-3 rounded-lg cursor-pointer transition-colors"
                  style={{
                    borderLeft: `3px solid ${sev.color}`,
                    backgroundColor: isCritical
                      ? (isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)')
                      : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
                  }}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base" style={{ color: sev.color }}>{sev.icon}</span>
                      <span className="text-sm font-medium">{anomaly.title}</span>
                      {idx < 2 && <Tag color="blue" style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>NEW</Tag>}
                    </div>
                    <span className="text-xs opacity-50 font-mono">{anomaly.timestamp}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs opacity-60 mb-2">
                    <span>置信度: <strong>{anomaly.confidence}%</strong></span>
                    <span>服务: <strong>{anomaly.service}</strong></span>
                  </div>
                  <Button size="small" block type="default" className="text-xs">
                    <span className="material-symbols-outlined text-sm mr-1">troubleshoot</span>
                    分析根本原因
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* 异常详情抽屉 */}
      <Drawer
        title={
          selectedAnomaly ? (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ color: SEVERITY_MAP[selectedAnomaly.severity].color }}>
                {SEVERITY_MAP[selectedAnomaly.severity].icon}
              </span>
              <span>{selectedAnomaly.title}</span>
              <Tag color={SEVERITY_MAP[selectedAnomaly.severity].tagColor} style={{ margin: 0 }}>{SEVERITY_MAP[selectedAnomaly.severity].label}</Tag>
              <Tag color={STATUS_MAP[selectedAnomaly.status].tagColor} style={{ margin: 0 }}>{STATUS_MAP[selectedAnomaly.status].label}</Tag>
            </div>
          ) : '异常详情'
        }
        open={!!selectedAnomaly}
        onClose={() => setSelectedAnomaly(null)}
        width={480}
        footer={
          selectedAnomaly && (
            <Space style={{ width: '100%' }}>
              <Button type="primary" block>分析根本原因</Button>
              <Button block>创建告警规则</Button>
            </Space>
          )
        }
      >
        {selectedAnomaly && (
          <div className="flex flex-col gap-4">
            {/* 描述 */}
            <div>
              <div className="text-xs font-medium opacity-50 mb-1">描述</div>
              <p className="text-sm m-0">{selectedAnomaly.description}</p>
            </div>

            {/* 指标对比 */}
            <div className="grid grid-cols-2 gap-3">
              <Card size="small">
                <Statistic title="预期值" value={selectedAnomaly.expectedValue} valueStyle={{ fontSize: 20 }} />
              </Card>
              <Card size="small">
                <Statistic
                  title="实际值"
                  value={selectedAnomaly.actualValue}
                  valueStyle={{
                    fontSize: 20,
                    color: selectedAnomaly.actualValue > selectedAnomaly.expectedValue ? COLORS.danger : COLORS.success,
                  }}
                />
              </Card>
            </div>

            {/* 详细信息 */}
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="服务">{selectedAnomaly.service}</Descriptions.Item>
              <Descriptions.Item label="指标">{selectedAnomaly.metric}</Descriptions.Item>
              <Descriptions.Item label="置信度">
                <Progress percent={selectedAnomaly.confidence} size="small" style={{ margin: 0, width: 120 }} />
              </Descriptions.Item>
              <Descriptions.Item label="检测时间">
                <span className="font-mono text-xs">{selectedAnomaly.timestamp}</span>
              </Descriptions.Item>
            </Descriptions>

            {/* 根本原因 */}
            {selectedAnomaly.rootCause && (
              <div
                className="p-3 rounded-lg text-sm"
                style={{
                  backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.05)',
                  border: `1px solid ${isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)'}`,
                  color: COLORS.success,
                }}
              >
                <div className="text-xs font-medium mb-1 opacity-70">根本原因分析</div>
                {selectedAnomaly.rootCause}
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default AnomalyDetection;

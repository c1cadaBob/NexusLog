/**
 * Dashboard 首页
 * 
 * 包含 KPI 卡片、日志趋势图表和基础设施监控面板
 * 
 * @requirements 9.1
 */

import React, { useMemo, useCallback } from 'react';
import { Row, Col, Card, Typography, Space, Button, Select, Badge, Progress, Tag, Tooltip } from 'antd';
import { 
  FileTextOutlined, 
  AlertOutlined, 
  ThunderboltOutlined,
  ReloadOutlined,
  WifiOutlined,
  DisconnectOutlined,
  ExclamationCircleOutlined,
  DatabaseOutlined,
  SafetyCertificateOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { StatCard } from '@/components/common';
import { TimeSeriesChart, PieChart, BarChart, BaseChart } from '@/components/charts';
import { useDashboardData, REFRESH_INTERVAL_OPTIONS } from '@/hooks/useDashboardData';
import type { TimeSeriesDataPoint, TimeSeriesConfig, PieDataItem, BarDataItem } from '@/components/charts';
import type { EChartsOption } from 'echarts';

const { Title, Text } = Typography;

// ============================================================================
// 模拟数据生成
// ============================================================================

/**
 * 生成日志趋势模拟数据
 */
function generateLogTrendData(): TimeSeriesDataPoint[] {
  const now = Date.now();
  const data: TimeSeriesDataPoint[] = [];
  
  // 生成过去 24 小时的数据，每小时一个点
  for (let i = 23; i >= 0; i--) {
    const timestamp = now - i * 60 * 60 * 1000;
    const baseValue = 50000 + Math.random() * 30000;
    const errorRate = 0.02 + Math.random() * 0.03;
    const warnRate = 0.05 + Math.random() * 0.05;
    
    data.push({
      timestamp,
      total: Math.round(baseValue),
      info: Math.round(baseValue * (1 - errorRate - warnRate)),
      warn: Math.round(baseValue * warnRate),
      error: Math.round(baseValue * errorRate),
    });
  }
  
  return data;
}

/**
 * 生成日志级别分布数据
 */
function generateLogLevelData(): PieDataItem[] {
  return [
    { name: 'INFO', value: 1250000, color: '#3b82f6' },
    { name: 'DEBUG', value: 450000, color: '#8b5cf6' },
    { name: 'WARN', value: 180000, color: '#f59e0b' },
    { name: 'ERROR', value: 85000, color: '#ef4444' },
    { name: 'FATAL', value: 5000, color: '#dc2626' },
  ];
}

/**
 * 生成服务错误率数据
 */
function generateServiceErrorData(): BarDataItem[] {
  return [
    { name: 'auth-service', value: 2401, color: '#ef4444' },
    { name: 'payment-gateway', value: 1120, color: '#ef4444' },
    { name: 'inventory-api', value: 856, color: '#f59e0b' },
    { name: 'user-service', value: 423, color: '#f59e0b' },
    { name: 'order-service', value: 215, color: '#3b82f6' },
  ];
}

// ============================================================================
// 基础设施监控组件（增强版）
// ============================================================================

/**
 * 基础设施监控面板 - 增强版
 * 包含 CPU 仪表盘、内存使用、连接数统计、带宽流量
 */
const InfrastructureMonitor: React.FC = () => {
  // CPU 仪表盘 ECharts 配置
  const cpuGaugeOption = useMemo<EChartsOption>(() => ({
    series: [{
      type: 'gauge',
      startAngle: 180,
      endAngle: 0,
      min: 0,
      max: 100,
      radius: '100%',
      center: ['50%', '80%'],
      pointer: { show: true, length: '60%', width: 4, itemStyle: { color: '#1677ff' } },
      axisLine: {
        lineStyle: {
          width: 12,
          color: [[0.3, '#52c41a'], [0.7, '#faad14'], [1, '#ff4d4f']],
        },
      },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      detail: {
        valueAnimation: true,
        formatter: '{value}%',
        fontSize: 18,
        fontWeight: 'bold',
        offsetCenter: [0, '-10%'],
      },
      data: [{ value: 42 }],
    }],
  }), []);

  // 带宽迷你折线图配置
  const bandwidthOption = useMemo<EChartsOption>(() => ({
    grid: { left: 0, right: 0, top: 5, bottom: 0 },
    xAxis: { type: 'category', show: false, data: ['1', '2', '3', '4', '5', '6', '7'] },
    yAxis: { type: 'value', show: false },
    series: [
      { type: 'line', data: [100, 150, 120, 200, 180, 250, 300], smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#1677ff' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(22,119,255,0.3)' }, { offset: 1, color: 'rgba(22,119,255,0)' }] } } },
      { type: 'line', data: [200, 250, 300, 220, 350, 400, 300], smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#52c41a' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(82,196,26,0.3)' }, { offset: 1, color: 'rgba(82,196,26,0)' }] } } },
    ],
  }), []);

  return (
    <Card
      title={
        <Space>
          <DashboardOutlined style={{ color: '#722ed1' }} />
          <span>系统基础设施监控</span>
          <Tag color="success" style={{ marginLeft: 8 }}>系统健康</Tag>
          <Tag>Cluster Node-01</Tag>
        </Space>
      }
    >
      <Row gutter={[24, 16]}>
        {/* CPU 负载 */}
        <Col xs={24} sm={12} lg={6}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>负载 (CPU Load)</Text>
              <Text strong>42%</Text>
            </div>
            <BaseChart option={cpuGaugeOption} height={120} />
            <Text type="secondary" style={{ fontSize: 11 }}>8 vCPUs</Text>
            <Row gutter={4} style={{ marginTop: 8 }}>
              {[85, 60, 30, 42].map((v, i) => (
                <Col span={6} key={i}>
                  <div style={{ height: 16, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${v}%`, background: '#1677ff', borderRadius: 4 }} />
                  </div>
                </Col>
              ))}
            </Row>
          </div>
        </Col>

        {/* 内存 */}
        <Col xs={24} sm={12} lg={6}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>内存 (Memory)</Text>
              <Text strong style={{ fontSize: 13 }}>12.4 GB <Text type="secondary" style={{ fontSize: 11 }}>/ 16 GB</Text></Text>
            </div>
            <Progress
              percent={78}
              strokeColor={{ from: '#52c41a', to: '#13c2c2' }}
              showInfo={false}
              style={{ marginBottom: 8 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>已使用: 78%</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>可用: 3.6 GB</Text>
            </div>
            <div style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>缓存 (Cache)</Text>
                <Text style={{ fontSize: 11 }}>4.2 GB</Text>
              </div>
              <Progress percent={26} size="small" showInfo={false} strokeColor="#1677ff" />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>Swap</Text>
                <Text style={{ fontSize: 11 }}>0.8 GB</Text>
              </div>
              <Progress percent={10} size="small" showInfo={false} strokeColor="#faad14" />
            </div>
          </div>
        </Col>

        {/* 连接数 */}
        <Col xs={24} sm={12} lg={6}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>传输连接数</Text>
              <Tag color="success" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>实时</Tag>
            </div>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 28, lineHeight: 1 }}>8,492</Text>
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>活跃连接</Text>
            </div>
            <Row gutter={8}>
              <Col span={8}>
                <Card size="small" styles={{ body: { padding: 8, textAlign: 'center' } }}>
                  <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>TCP</Text>
                  <Text strong style={{ fontSize: 13 }}>8.1k</Text>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" styles={{ body: { padding: 8, textAlign: 'center' } }}>
                  <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>UDP</Text>
                  <Text strong style={{ fontSize: 13 }}>372</Text>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" styles={{ body: { padding: 8, textAlign: 'center' } }}>
                  <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>HTTP</Text>
                  <Text strong style={{ fontSize: 13 }}>1.2k</Text>
                </Card>
              </Col>
            </Row>
          </div>
        </Col>

        {/* 带宽流量 */}
        <Col xs={24} sm={12} lg={6}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>带宽与流量统计</Text>
              <Space size={8}>
                <Space size={4}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1677ff' }} /><Text style={{ fontSize: 10 }}>In</Text></Space>
                <Space size={4}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#52c41a' }} /><Text style={{ fontSize: 10 }}>Out</Text></Space>
              </Space>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 11 }}>450 Mbps</Text>
              <Text style={{ fontSize: 11 }}>1.2 Gbps</Text>
            </div>
            <BaseChart option={bandwidthOption} height={100} />
          </div>
        </Col>
      </Row>
    </Card>
  );
};

// ============================================================================
// Dashboard 主组件
// ============================================================================

/**
 * Dashboard 首页组件
 */
export const DashboardPage: React.FC = () => {
  // 使用 Dashboard 数据 Hook
  const {
    data,
    isLoading,
    wsConnected,
    refreshConfig,
    countdown,
    refresh,
    setRefreshInterval,
  } = useDashboardData();

  // 图表数据（使用 useMemo 缓存）
  const logTrendData = useMemo(() => generateLogTrendData(), []);
  const logLevelData = useMemo(() => generateLogLevelData(), []);
  const serviceErrorData = useMemo(() => generateServiceErrorData(), []);

  // 时间序列图表配置
  const trendSeriesConfig: TimeSeriesConfig[] = useMemo(() => [
    { dataKey: 'info', name: 'INFO', color: '#3b82f6', type: 'area', smooth: true },
    { dataKey: 'warn', name: 'WARN', color: '#f59e0b', type: 'line', smooth: true },
    { dataKey: 'error', name: 'ERROR', color: '#ef4444', type: 'line', smooth: true },
  ], []);

  // 刷新间隔变更处理
  const handleRefreshIntervalChange = useCallback((value: number) => {
    setRefreshInterval(value);
  }, [setRefreshInterval]);

  // 计算总日志量
  const totalLogs = useMemo(() => {
    return logLevelData.reduce((sum, item) => sum + item.value, 0);
  }, [logLevelData]);

  return (
    <div>
      {/* 页面标题和控制栏 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 24,
      }}>
        <Title level={4} style={{ margin: 0 }}>仪表盘</Title>
        
        <Space>
          {/* WebSocket 连接状态 */}
          <Tooltip title={wsConnected ? 'WebSocket 已连接' : 'WebSocket 未连接'}>
            <Badge 
              status={wsConnected ? 'success' : 'error'} 
              text={
                <Space size={4}>
                  {wsConnected ? <WifiOutlined /> : <DisconnectOutlined />}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {wsConnected ? '实时' : '离线'}
                  </Text>
                </Space>
              }
            />
          </Tooltip>
          
          {/* 自动刷新配置 */}
          <Select
            value={refreshConfig.interval}
            onChange={handleRefreshIntervalChange}
            options={REFRESH_INTERVAL_OPTIONS}
            style={{ width: 100 }}
            size="small"
          />
          
          {/* 刷新倒计时 */}
          {refreshConfig.enabled && countdown > 0 && (
            <Text type="secondary" style={{ fontSize: 12, minWidth: 30 }}>
              {countdown}s
            </Text>
          )}
          
          {/* 手动刷新按钮 */}
          <Button 
            icon={<ReloadOutlined spin={isLoading} />} 
            onClick={refresh}
            loading={isLoading}
            size="small"
          >
            刷新
          </Button>
        </Space>
      </div>
      
      {/* KPI 卡片 - 6列布局 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={4}>
          <StatCard
            title="今日日志量"
            value={1234567}
            prefix={<FileTextOutlined />}
            trend={{ value: '+12.5%', type: 'up', label: '较昨日' }}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <StatCard
            title="错误率"
            value={2.3}
            prefix={<ExclamationCircleOutlined />}
            suffix="%"
            trend={{ value: '-0.5%', type: 'down', label: '较昨日' }}
            color="danger"
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <StatCard
            title="活跃告警"
            value={23}
            prefix={<AlertOutlined />}
            trend={{ value: '-5', type: 'down', label: '较昨日' }}
            color="warning"
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <StatCard
            title="写入 QPS"
            value={24500}
            prefix={<ThunderboltOutlined />}
            trend={{ value: '+8.2%', type: 'up', label: '较昨日' }}
            color="success"
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <StatCard
            title="存储使用率"
            value={72.4}
            prefix={<DatabaseOutlined />}
            suffix="%"
            color="info"
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <StatCard
            title="采集成功率"
            value={99.8}
            prefix={<SafetyCertificateOutlined />}
            suffix="%"
            color="success"
          />
        </Col>
      </Row>

      {/* 图表区域 - 日志趋势和级别分布 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card 
            title="日志趋势（24小时）" 
            styles={{ body: { padding: '12px 16px' } }}
          >
            <TimeSeriesChart
              data={logTrendData}
              series={trendSeriesConfig}
              height={320}
              showLegend
              showTooltip
              areaStyle
              yAxisFormatter={(value) => {
                if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                return value.toString();
              }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card 
            title="日志级别分布" 
            styles={{ body: { padding: '12px 16px' } }}
          >
            <PieChart
              data={logLevelData}
              height={320}
              donut
              innerRadius="55%"
              outerRadius="75%"
              showLegend
              showLabel={false}
              centerText="总计"
              centerSubText={`${(totalLogs / 1000000).toFixed(1)}M`}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表区域 - 服务错误率 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card 
            title="服务错误率 Top 5" 
            styles={{ body: { padding: '12px 16px' } }}
          >
            <BarChart
              data={serviceErrorData}
              height={280}
              horizontal
              showLabel
              valueFormatter={(value) => value.toLocaleString()}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card 
            title="最近审计日志"
            styles={{ body: { padding: '12px 16px' } }}
          >
            <div style={{ height: 280, overflow: 'auto' }}>
              {data.recentAudits.map((audit, index) => (
                <div 
                  key={index}
                  style={{ 
                    padding: '12px 0',
                    borderBottom: index < data.recentAudits.length - 1 ? '1px solid #f0f0f0' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Space>
                      <Tag color={
                        audit.type === 'create' ? 'success' : 
                        audit.type === 'update' ? 'processing' : 
                        'error'
                      }>
                        {audit.type === 'create' ? '创建' : audit.type === 'update' ? '更新' : '删除'}
                      </Tag>
                      <Text strong>{audit.user}</Text>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>{audit.time}</Text>
                  </div>
                  <Text type="secondary">
                    {audit.action} <Text code>{audit.target}</Text>
                  </Text>
                </div>
              ))}
              
              {/* 补充更多审计日志示例 */}
              <div style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Space>
                    <Tag color="processing">更新</Tag>
                    <Text strong>operator</Text>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>12:45</Text>
                </div>
                <Text type="secondary">
                  修改了 <Text code>告警规则 #1024</Text>
                </Text>
              </div>
              
              <div style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Space>
                    <Tag color="success">创建</Tag>
                    <Text strong>developer</Text>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>11:30</Text>
                </div>
                <Text type="secondary">
                  创建了新的 <Text code>数据源 mysql-prod-01</Text>
                </Text>
              </div>
              
              <div style={{ padding: '12px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Space>
                    <Tag color="error">删除</Tag>
                    <Text strong>admin</Text>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>10:15</Text>
                </div>
                <Text type="secondary">
                  删除了过期索引 <Text code>logs-dev-2023.09.*</Text>
                </Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 基础设施监控 */}
      <InfrastructureMonitor />
    </div>
  );
};

export default DashboardPage;

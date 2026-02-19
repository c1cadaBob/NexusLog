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
  CloudServerOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  WifiOutlined,
  DisconnectOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  HddOutlined,
  ApiOutlined,
  ClusterOutlined,
} from '@ant-design/icons';
import { StatCard } from '@/components/common';
import { TimeSeriesChart, PieChart, BarChart } from '@/components/charts';
import { useDashboardData, REFRESH_INTERVAL_OPTIONS } from '@/hooks/useDashboardData';
import type { TimeSeriesDataPoint, TimeSeriesConfig, PieDataItem, BarDataItem } from '@/components/charts';

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
// 基础设施监控组件
// ============================================================================

interface InfrastructureNodeProps {
  name: string;
  icon: React.ReactNode;
  status: 'healthy' | 'warning' | 'critical';
  metrics: {
    label: string;
    value: number;
    unit: string;
    threshold?: number;
  }[];
}

/**
 * 基础设施节点组件
 */
const InfrastructureNode: React.FC<InfrastructureNodeProps> = ({ 
  name, 
  icon, 
  status, 
  metrics 
}) => {
  const statusConfig = {
    healthy: { color: '#52c41a', text: '健康', icon: <CheckCircleOutlined /> },
    warning: { color: '#faad14', text: '警告', icon: <ExclamationCircleOutlined /> },
    critical: { color: '#ff4d4f', text: '异常', icon: <CloseCircleOutlined /> },
  };

  const config = statusConfig[status];

  return (
    <Card 
      size="small" 
      style={{ height: '100%' }}
      styles={{ body: { padding: 12 } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ 
          fontSize: 20, 
          marginRight: 8,
          color: config.color,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <Text strong style={{ fontSize: 13 }}>{name}</Text>
        </div>
        <Tooltip title={config.text}>
          <Tag 
            color={status === 'healthy' ? 'success' : status === 'warning' ? 'warning' : 'error'}
            style={{ margin: 0 }}
          >
            {config.icon}
          </Tag>
        </Tooltip>
      </div>
      
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {metrics.map((metric, index) => {
          const percent = metric.threshold 
            ? Math.min((metric.value / metric.threshold) * 100, 100)
            : metric.value;
          const strokeColor = percent > 90 ? '#ff4d4f' : percent > 70 ? '#faad14' : '#52c41a';
          
          return (
            <div key={index}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{metric.label}</Text>
                <Text style={{ fontSize: 12 }}>{metric.value}{metric.unit}</Text>
              </div>
              <Progress 
                percent={percent} 
                size="small" 
                showInfo={false}
                strokeColor={strokeColor}
              />
            </div>
          );
        })}
      </Space>
    </Card>
  );
};

/**
 * 基础设施监控面板
 */
const InfrastructureMonitor: React.FC = () => {
  const infrastructureData: InfrastructureNodeProps[] = [
    {
      name: 'Elasticsearch 集群',
      icon: <DatabaseOutlined />,
      status: 'healthy',
      metrics: [
        { label: 'CPU 使用率', value: 45, unit: '%', threshold: 100 },
        { label: '内存使用率', value: 68, unit: '%', threshold: 100 },
        { label: '磁盘使用率', value: 72, unit: '%', threshold: 100 },
      ],
    },
    {
      name: 'Kafka 集群',
      icon: <ClusterOutlined />,
      status: 'healthy',
      metrics: [
        { label: '消息积压', value: 1250, unit: '', threshold: 10000 },
        { label: '分区数', value: 128, unit: '', threshold: 200 },
        { label: '副本同步率', value: 99.8, unit: '%', threshold: 100 },
      ],
    },
    {
      name: 'API 网关',
      icon: <ApiOutlined />,
      status: 'warning',
      metrics: [
        { label: 'QPS', value: 24500, unit: '', threshold: 30000 },
        { label: '平均延迟', value: 45, unit: 'ms', threshold: 100 },
        { label: '错误率', value: 0.12, unit: '%', threshold: 1 },
      ],
    },
    {
      name: '存储服务',
      icon: <HddOutlined />,
      status: 'healthy',
      metrics: [
        { label: '已用空间', value: 2.4, unit: 'TB', threshold: 5 },
        { label: 'IOPS', value: 8500, unit: '', threshold: 15000 },
        { label: '吞吐量', value: 450, unit: 'MB/s', threshold: 800 },
      ],
    },
  ];

  return (
    <Row gutter={[12, 12]}>
      {infrastructureData.map((node, index) => (
        <Col xs={24} sm={12} lg={6} key={index}>
          <InfrastructureNode {...node} />
        </Col>
      ))}
    </Row>
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
      
      {/* KPI 卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="今日日志量"
            value={1234567}
            prefix={<FileTextOutlined />}
            trend={{ value: '+12.5%', type: 'up', label: '较昨日' }}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="活跃告警"
            value={23}
            prefix={<AlertOutlined />}
            trend={{ value: '-5', type: 'down', label: '较昨日' }}
            color="warning"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="数据源"
            value={156}
            prefix={<CloudServerOutlined />}
            suffix="个"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="查询延迟"
            value={45}
            prefix={<ThunderboltOutlined />}
            suffix="ms"
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
      <Card title="基础设施监控">
        <InfrastructureMonitor />
      </Card>
    </div>
  );
};

export default DashboardPage;

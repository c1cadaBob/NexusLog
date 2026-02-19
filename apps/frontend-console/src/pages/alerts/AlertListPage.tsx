/**
 * 告警列表页面
 *
 * 提供告警管理功能：
 * - 告警列表展示（Ant Design Table）
 * - 按严重程度/状态过滤
 * - 搜索告警
 * - 单条/批量确认、解决、静默操作
 * - 统计卡片
 *
 * @requirements 9.3
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Input,
  Select,
  Modal,
  Statistic,
  Row,
  Col,
  Typography,
  message,
  InputNumber,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  StopOutlined,
  BellOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { AlertSummary, AlertStatus, AlertSeverity } from '@/types';
import { ALERT_SEVERITY_CONFIG, ALERT_STATUS_CONFIG } from '@/types/alert';

const { Text } = Typography;

// ============================================================================
// 模拟数据
// ============================================================================

const mockAlerts: AlertSummary[] = [
  { id: '1', name: 'CPU Usage > 90%', severity: 'critical', status: 'active', source: 'auth-service-prod', count: 5, lastTriggeredAt: Date.now() - 920000 },
  { id: '2', name: 'Memory High (85%)', severity: 'high', status: 'active', source: 'payment-gateway', count: 3, lastTriggeredAt: Date.now() - 1145000 },
  { id: '3', name: 'Database Connection Timeout', severity: 'critical', status: 'acknowledged', source: 'db-service', count: 12, lastTriggeredAt: Date.now() - 1640000 },
  { id: '4', name: 'New Deployment', severity: 'low', status: 'resolved', source: 'ci-cd-pipeline', count: 1, lastTriggeredAt: Date.now() - 5522000 },
  { id: '5', name: 'High Memory Usage', severity: 'medium', status: 'active', source: 'worker-node-05', count: 8, lastTriggeredAt: Date.now() - 3730000 },
  { id: '6', name: 'Slow Query Detected', severity: 'medium', status: 'active', source: 'db-master', count: 15, lastTriggeredAt: Date.now() - 4205000 },
  { id: '7', name: 'API Latency Spike', severity: 'high', status: 'silenced', source: 'api-gateway', count: 7, lastTriggeredAt: Date.now() - 2100000 },
  { id: '8', name: 'Disk Space Low', severity: 'critical', status: 'active', source: 'storage-node-01', count: 2, lastTriggeredAt: Date.now() - 600000 },
];

// ============================================================================
// 辅助函数
// ============================================================================

const formatTimeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
};

const severityTagColor: Record<AlertSeverity, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'blue',
  low: 'green',
};

const statusTagColor: Record<AlertStatus, string> = {
  active: 'error',
  acknowledged: 'warning',
  resolved: 'success',
  silenced: 'default',
};

// ============================================================================
// 主组件
// ============================================================================

export const AlertListPage: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertSummary[]>(mockAlerts);
  const [searchText, setSearchText] = useState('');
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'all'>('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [silenceModalOpen, setSilenceModalOpen] = useState(false);
  const [silenceDuration, setSilenceDuration] = useState(1);
  const [loading, setLoading] = useState(false);

  // 过滤后的告警
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      if (searchText) {
        const q = searchText.toLowerCase();
        if (!alert.name.toLowerCase().includes(q) && !alert.source.toLowerCase().includes(q)) return false;
      }
      if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
      if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
      return true;
    });
  }, [alerts, searchText, severityFilter, statusFilter]);

  // 统计
  const stats = useMemo(() => ({
    pending: alerts.filter(a => a.status === 'active').length,
    critical: alerts.filter(a => a.severity === 'critical' && a.status !== 'resolved').length,
    warning: alerts.filter(a => (a.severity === 'high' || a.severity === 'medium') && a.status !== 'resolved').length,
    silenced: alerts.filter(a => a.status === 'silenced').length,
  }), [alerts]);

  // 确认告警
  const handleAcknowledge = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged' as AlertStatus } : a));
    message.success('告警已确认');
  }, []);

  // 解决告警
  const handleResolve = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved' as AlertStatus } : a));
    message.success('告警已解决');
  }, []);

  // 静默告警
  const handleSilence = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'silenced' as AlertStatus } : a));
    message.success('告警已静默');
  }, []);

  // 批量操作
  const executeBatch = useCallback((type: 'acknowledge' | 'resolve' | 'silence') => {
    const newStatus: AlertStatus = type === 'acknowledge' ? 'acknowledged' : type === 'resolve' ? 'resolved' : 'silenced';
    setAlerts(prev => prev.map(a => selectedRowKeys.includes(a.id) ? { ...a, status: newStatus } : a));
    setSelectedRowKeys([]);
    message.success(`成功处理 ${selectedRowKeys.length} 条告警`);
  }, [selectedRowKeys]);

  // 刷新
  const handleRefresh = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      message.success('告警数据已更新');
    }, 500);
  }, []);

  // 表格列定义
  const columns: ColumnsType<AlertSummary> = useMemo(() => [
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: AlertSeverity) => (
        <Tag color={severityTagColor[severity]}>{ALERT_SEVERITY_CONFIG[severity].label}</Tag>
      ),
      sorter: (a, b) => ALERT_SEVERITY_CONFIG[a.severity].priority - ALERT_SEVERITY_CONFIG[b.severity].priority,
    },
    {
      title: '告警名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 160,
      render: (source: string) => <Text code style={{ fontSize: 12 }}>{source}</Text>,
    },
    {
      title: '触发次数',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      sorter: (a, b) => a.count - b.count,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: AlertStatus) => (
        <Tag color={statusTagColor[status]}>{ALERT_STATUS_CONFIG[status].label}</Tag>
      ),
    },
    {
      title: '最后触发',
      dataIndex: 'lastTriggeredAt',
      key: 'lastTriggeredAt',
      width: 120,
      render: (ts: number) => <Text type="secondary" style={{ fontSize: 12 }}>{formatTimeAgo(ts)}</Text>,
      sorter: (a, b) => a.lastTriggeredAt - b.lastTriggeredAt,
      defaultSortOrder: 'descend',
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space size="small">
          {record.status === 'active' && (
            <Button type="link" size="small" onClick={() => handleAcknowledge(record.id)}>确认</Button>
          )}
          {(record.status === 'active' || record.status === 'acknowledged') && (
            <Button type="link" size="small" onClick={() => handleResolve(record.id)}>解决</Button>
          )}
          {record.status !== 'silenced' && record.status !== 'resolved' && (
            <Button type="link" size="small" onClick={() => handleSilence(record.id)}>静默</Button>
          )}
        </Space>
      ),
    },
  ], [handleAcknowledge, handleResolve, handleSilence]);

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 16 }}>
        <Space align="center">
          <Typography.Title level={4} style={{ margin: 0 }}>告警列表</Typography.Title>
          <Tag color="blue">告警中心</Tag>
          <Tag color="green" icon={<ClockCircleOutlined />}>Live</Tag>
        </Space>
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          查看和管理所有告警
        </Typography.Paragraph>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="待处理告警" value={stats.pending} prefix={<BellOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="严重告警" value={stats.critical} valueStyle={{ color: '#cf1322' }} prefix={<ExclamationCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="警告告警" value={stats.warning} valueStyle={{ color: '#faad14' }} prefix={<WarningOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="静默中" value={stats.silenced} prefix={<StopOutlined />} />
          </Card>
        </Col>
      </Row>

      {/* 过滤器和操作 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col flex="auto">
            <Input
              placeholder="按告警名称、来源搜索..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col>
            <Select
              value={severityFilter}
              onChange={setSeverityFilter}
              style={{ width: 130 }}
              options={[
                { label: '所有等级', value: 'all' },
                { label: '严重', value: 'critical' },
                { label: '高', value: 'high' },
                { label: '中', value: 'medium' },
                { label: '低', value: 'low' },
              ]}
            />
          </Col>
          <Col>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 130 }}
              options={[
                { label: '所有状态', value: 'all' },
                { label: '活跃', value: 'active' },
                { label: '已确认', value: 'acknowledged' },
                { label: '已解决', value: 'resolved' },
                { label: '已静默', value: 'silenced' },
              ]}
            />
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>刷新</Button>
          </Col>
        </Row>

        {/* 批量操作 */}
        {selectedRowKeys.length > 0 && (
          <Row style={{ marginTop: 12 }} align="middle">
            <Col flex="auto">
              <Space>
                <Text type="secondary">已选择 {selectedRowKeys.length} 项</Text>
                <Button size="small" onClick={() => executeBatch('acknowledge')}>批量确认</Button>
                <Button size="small" onClick={() => executeBatch('resolve')}>批量解决</Button>
                <Button size="small" onClick={() => { setSilenceModalOpen(true); }}>批量静默</Button>
              </Space>
            </Col>
          </Row>
        )}
      </Card>

      {/* 告警表格 */}
      <Card>
        <Table<AlertSummary>
          columns={columns}
          dataSource={filteredAlerts}
          rowKey="id"
          loading={loading}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          scroll={{ x: 900 }}
          size="middle"
        />
      </Card>

      {/* 批量静默模态框 */}
      <Modal
        title="批量静默告警"
        open={silenceModalOpen}
        onOk={() => {
          setSilenceModalOpen(false);
          executeBatch('silence');
        }}
        onCancel={() => setSilenceModalOpen(false)}
        okText="确认静默"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <Text>将对 <Text strong>{selectedRowKeys.length}</Text> 条告警执行静默操作</Text>
        </div>
        <div>
          <Text style={{ display: 'block', marginBottom: 8 }}>静默时长（小时）</Text>
          <InputNumber
            min={0.5}
            max={24}
            step={0.5}
            value={silenceDuration}
            onChange={v => setSilenceDuration(v ?? 1)}
            style={{ width: '100%' }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default AlertListPage;

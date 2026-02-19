/**
 * 审计日志页面
 *
 * 提供审计日志查看功能：
 * - 审计日志列表展示（Ant Design Table）
 * - 按操作人/操作类型/资源过滤
 * - 导出 CSV
 * - 日志不可篡改提示
 *
 * @requirements 9.4
 */

import React, { useState, useMemo } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Input,
  Select,
  Row,
  Col,
  Typography,
  Avatar,
  message,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  LockOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

// ============================================================================
// 本地类型
// ============================================================================

type AuditAction = 'login' | 'update' | 'delete' | 'create';
type AuditStatus = 'success' | 'failed';

interface AuditLogRecord {
  id: string;
  timestamp: string;
  operator: string;
  action: AuditAction;
  target: string;
  sourceIp: string;
  status: AuditStatus;
}

// ============================================================================
// 模拟数据
// ============================================================================

const mockLogs: AuditLogRecord[] = [
  { id: '1', timestamp: '2024-03-15 14:35:22', operator: 'admin_01', action: 'update', target: 'Dashboard Config / Main', sourceIp: '192.168.1.10', status: 'success' },
  { id: '2', timestamp: '2024-03-15 14:32:15', operator: 'user_mike', action: 'delete', target: 'Alert Rule #402', sourceIp: '10.0.0.5', status: 'failed' },
  { id: '3', timestamp: '2024-03-15 14:30:01', operator: 'admin_01', action: 'login', target: 'System / Auth', sourceIp: '192.168.1.10', status: 'success' },
  { id: '4', timestamp: '2024-03-15 14:15:45', operator: 'sys_bot', action: 'create', target: 'Auto-Backup #992', sourceIp: 'localhost', status: 'success' },
  { id: '5', timestamp: '2024-03-15 13:58:12', operator: 'admin_01', action: 'update', target: 'User Role / user_mike', sourceIp: '192.168.1.10', status: 'success' },
  { id: '6', timestamp: '2024-03-15 13:45:33', operator: 'unknown', action: 'login', target: 'System / Auth', sourceIp: '203.0.113.42', status: 'failed' },
  { id: '7', timestamp: '2024-03-15 12:30:00', operator: 'user_jane', action: 'create', target: 'Dashboard / Sales', sourceIp: '192.168.1.25', status: 'success' },
  { id: '8', timestamp: '2024-03-15 11:20:15', operator: 'admin_02', action: 'update', target: 'System Config', sourceIp: '192.168.1.11', status: 'success' },
  { id: '9', timestamp: '2024-03-14 18:45:00', operator: 'user_mike', action: 'login', target: 'System / Auth', sourceIp: '10.0.0.5', status: 'success' },
  { id: '10', timestamp: '2024-03-14 16:30:22', operator: 'sys_bot', action: 'delete', target: 'Old Logs / Archive', sourceIp: 'localhost', status: 'success' },
];

// ============================================================================
// 辅助
// ============================================================================

const actionTagConfig: Record<AuditAction, { color: string; label: string }> = {
  login: { color: 'default', label: '登录' },
  update: { color: 'blue', label: '更新' },
  delete: { color: 'red', label: '删除' },
  create: { color: 'green', label: '创建' },
};

const getAvatarColor = (name: string): string => {
  const colors = ['#1677ff', '#722ed1', '#fa8c16', '#52c41a', '#eb2f96'] as const;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length] ?? '#1677ff';
};

// ============================================================================
// 主组件
// ============================================================================

export const AuditLogsPage: React.FC = () => {
  const [operatorFilter, setOperatorFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AuditStatus | 'all'>('all');
  const [loading, setLoading] = useState(false);

  // 过滤
  const filteredLogs = useMemo(() => {
    return mockLogs.filter(log => {
      if (operatorFilter && !log.operator.toLowerCase().includes(operatorFilter.toLowerCase())) return false;
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      if (statusFilter !== 'all' && log.status !== statusFilter) return false;
      return true;
    });
  }, [operatorFilter, actionFilter, statusFilter]);

  // 刷新
  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      message.success('审计日志已刷新');
    }, 500);
  };

  // 重置过滤器
  const handleReset = () => {
    setOperatorFilter('');
    setActionFilter('all');
    setStatusFilter('all');
  };

  // 导出
  const handleExport = () => {
    message.success('审计日志导出已开始');
  };

  // 表格列
  const columns: ColumnsType<AuditLogRecord> = useMemo(() => [
    {
      title: '时间戳',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (ts: string) => <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{ts}</Text>,
      sorter: (a, b) => a.timestamp.localeCompare(b.timestamp),
      defaultSortOrder: 'descend',
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 150,
      render: (op: string) => (
        <Space>
          <Avatar size="small" style={{ backgroundColor: getAvatarColor(op), fontSize: 12 }}>
            {(op[0] ?? '?').toUpperCase()}
          </Avatar>
          <Text>{op}</Text>
        </Space>
      ),
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (action: AuditAction) => (
        <Tag color={actionTagConfig[action].color}>{actionTagConfig[action].label}</Tag>
      ),
    },
    {
      title: '操作对象',
      dataIndex: 'target',
      key: 'target',
      ellipsis: true,
    },
    {
      title: 'IP 地址',
      dataIndex: 'sourceIp',
      key: 'sourceIp',
      width: 150,
      render: (ip: string) => <Text code style={{ fontSize: 12 }}>{ip}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: AuditStatus) => (
        status === 'success'
          ? <Tag icon={<CheckCircleOutlined />} color="success">成功</Tag>
          : <Tag icon={<CloseCircleOutlined />} color="error">失败</Tag>
      ),
    },
  ], []);

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 16 }}>
        <Space align="center" style={{ marginBottom: 4 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>审计日志</Typography.Title>
          <Tag color="blue">安全审计</Tag>
        </Space>
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          查看系统操作审计日志，所有记录不可篡改
        </Typography.Paragraph>
      </div>

      {/* 过滤器 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={6}>
            <Input
              placeholder="按操作人搜索..."
              prefix={<SearchOutlined />}
              value={operatorFilter}
              onChange={e => setOperatorFilter(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} sm={4}>
            <Select value={actionFilter} onChange={setActionFilter} style={{ width: '100%' }} options={[
              { label: '所有类型', value: 'all' },
              { label: '登录', value: 'login' },
              { label: '创建', value: 'create' },
              { label: '更新', value: 'update' },
              { label: '删除', value: 'delete' },
            ]} />
          </Col>
          <Col xs={12} sm={4}>
            <Select value={statusFilter} onChange={setStatusFilter} style={{ width: '100%' }} options={[
              { label: '所有状态', value: 'all' },
              { label: '成功', value: 'success' },
              { label: '失败', value: 'failed' },
            ]} />
          </Col>
          <Col flex="auto" />
          <Col>
            <Space>
              <Button onClick={handleReset}>重置</Button>
              <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>刷新</Button>
              <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>导出 CSV</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 审计日志表格 */}
      <Card>
        <Table<AuditLogRecord>
          columns={columns}
          dataSource={filteredLogs}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          scroll={{ x: 900 }}
          size="middle"
        />
      </Card>

      {/* 安全提示 */}
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <LockOutlined style={{ marginRight: 4 }} />
          所有审计日志已加密存储，且不可篡改
        </Text>
      </div>
    </div>
  );
};

export default AuditLogsPage;

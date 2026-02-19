/**
 * 告警规则页面
 *
 * 提供告警规则管理功能：
 * - 规则列表展示（Ant Design Table）
 * - 创建/编辑/删除规则（Ant Design Form + Modal）
 * - 启用/禁用规则
 * - 按状态过滤和搜索
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
  Form,
  Statistic,
  Row,
  Col,
  Typography,
  Switch,
  InputNumber,
  message,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { AlertRule, AlertSeverity, RuleStatus, ConditionOperator } from '@/types/alert';

const { Text } = Typography;
const { TextArea } = Input;

// ============================================================================
// 模拟数据
// ============================================================================

const mockRules: AlertRule[] = [
  {
    id: '1', name: 'Error Rate Spikes', description: '监控错误率突增',
    query: "count(level='ERROR') / count(*) * 100",
    conditions: [{ metric: 'error_rate', operator: 'gt', threshold: 5, duration: 300 }],
    severity: 'critical', status: 'enabled', evaluationInterval: 60, forDuration: 300,
    labels: { team: 'devops' }, annotations: {}, actions: [],
    createdBy: 'admin', createdAt: Date.now() - 86400000 * 30, updatedAt: Date.now() - 86400000 * 2,
    lastEvaluatedAt: Date.now() - 60000,
  },
  {
    id: '2', name: 'Latency Warning', description: '监控 P99 延迟',
    query: 'p99(latency)',
    conditions: [{ metric: 'latency_p99', operator: 'gt', threshold: 500 }],
    severity: 'high', status: 'enabled', evaluationInterval: 300, forDuration: 600,
    labels: { team: 'sre' }, annotations: {}, actions: [],
    createdBy: 'admin', createdAt: Date.now() - 86400000 * 20, updatedAt: Date.now() - 86400000 * 5,
    lastEvaluatedAt: Date.now() - 300000,
  },
  {
    id: '3', name: 'Login Failures', description: '监控登录失败次数',
    query: "count(event='login_fail')",
    conditions: [{ metric: 'login_failures', operator: 'gt', threshold: 10 }],
    severity: 'medium', status: 'error', evaluationInterval: 600, forDuration: 600,
    labels: { team: 'security' }, annotations: {}, actions: [],
    createdBy: 'admin', createdAt: Date.now() - 86400000 * 15, updatedAt: Date.now() - 86400000,
    lastEvaluatedAt: Date.now() - 120000,
  },
];

// ============================================================================
// 辅助函数
// ============================================================================

const severityTagColor: Record<AlertSeverity, string> = {
  critical: 'red', high: 'orange', medium: 'blue', low: 'green',
};

const severityLabel: Record<AlertSeverity, string> = {
  critical: '严重', high: '高', medium: '中', low: '低',
};

const statusConfig: Record<RuleStatus, { color: string; label: string }> = {
  enabled: { color: 'success', label: '正常' },
  disabled: { color: 'default', label: '已禁用' },
  error: { color: 'error', label: '异常' },
};

const formatInterval = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
};

const formatTimeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
};

// ============================================================================
// 表单接口
// ============================================================================

interface RuleFormValues {
  name: string;
  description?: string;
  query: string;
  severity: AlertSeverity;
  evaluationInterval: number;
  forDuration: number;
  conditionMetric: string;
  conditionOperator: ConditionOperator;
  conditionThreshold: number;
}

// ============================================================================
// 主组件
// ============================================================================

export const AlertRulesPage: React.FC = () => {
  const [rules, setRules] = useState<AlertRule[]>(mockRules);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RuleStatus | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [form] = Form.useForm<RuleFormValues>();

  // 过滤
  const filteredRules = useMemo(() => {
    return rules.filter(rule => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!rule.name.toLowerCase().includes(q) && !rule.query.toLowerCase().includes(q)) return false;
      }
      if (statusFilter !== 'all' && rule.status !== statusFilter) return false;
      return true;
    });
  }, [rules, searchQuery, statusFilter]);

  // 统计
  const stats = useMemo(() => ({
    total: rules.length,
    enabled: rules.filter(r => r.status === 'enabled').length,
    disabled: rules.filter(r => r.status === 'disabled').length,
    error: rules.filter(r => r.status === 'error').length,
  }), [rules]);

  // 打开创建/编辑模态框
  const openModal = useCallback((rule?: AlertRule) => {
    if (rule) {
      setEditingRule(rule);
      form.setFieldsValue({
        name: rule.name,
        description: rule.description,
        query: rule.query,
        severity: rule.severity,
        evaluationInterval: rule.evaluationInterval,
        forDuration: rule.forDuration,
        conditionMetric: rule.conditions[0]?.metric || '',
        conditionOperator: rule.conditions[0]?.operator || 'gt',
        conditionThreshold: rule.conditions[0]?.threshold || 0,
      });
    } else {
      setEditingRule(null);
      form.resetFields();
    }
    setModalOpen(true);
  }, [form]);

  // 提交表单
  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (editingRule) {
        setRules(prev => prev.map(r => r.id === editingRule.id ? {
          ...r, ...values,
          conditions: [{ metric: values.conditionMetric, operator: values.conditionOperator, threshold: values.conditionThreshold }],
          updatedAt: Date.now(),
        } : r));
        message.success(`规则 "${values.name}" 已更新`);
      } else {
        const newRule: AlertRule = {
          id: `rule-${Date.now()}`, ...values,
          conditions: [{ metric: values.conditionMetric, operator: values.conditionOperator, threshold: values.conditionThreshold }],
          status: 'enabled', labels: {}, annotations: {}, actions: [],
          createdBy: 'current_user', createdAt: Date.now(), updatedAt: Date.now(),
        };
        setRules(prev => [...prev, newRule]);
        message.success(`规则 "${values.name}" 已创建`);
      }
      setModalOpen(false);
    } catch { /* validation error */ }
  }, [form, editingRule]);

  // 删除规则
  const handleDelete = useCallback((rule: AlertRule) => {
    setRules(prev => prev.filter(r => r.id !== rule.id));
    message.success(`规则 "${rule.name}" 已删除`);
  }, []);

  // 切换启用/禁用
  const toggleStatus = useCallback((rule: AlertRule) => {
    const newStatus: RuleStatus = rule.status === 'enabled' ? 'disabled' : 'enabled';
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, status: newStatus, updatedAt: Date.now() } : r));
    message.success(`规则 "${rule.name}" 已${newStatus === 'enabled' ? '启用' : '禁用'}`);
  }, []);

  // 表格列
  const columns: ColumnsType<AlertRule> = useMemo(() => [
    {
      title: '规则名称',
      key: 'name',
      render: (_, rule) => (
        <div>
          <Text strong>{rule.name}</Text>
          {rule.description && <div><Text type="secondary" style={{ fontSize: 12 }}>{rule.description}</Text></div>}
        </div>
      ),
    },
    {
      title: '查询条件',
      dataIndex: 'query',
      key: 'query',
      width: 220,
      ellipsis: true,
      render: (query: string) => <Text code style={{ fontSize: 12 }}>{query}</Text>,
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (s: AlertSeverity) => <Tag color={severityTagColor[s]}>{severityLabel[s]}</Tag>,
    },
    {
      title: '评估间隔',
      dataIndex: 'evaluationInterval',
      key: 'evaluationInterval',
      width: 100,
      render: (v: number) => formatInterval(v),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: RuleStatus) => <Tag color={statusConfig[s].color}>{statusConfig[s].label}</Tag>,
    },
    {
      title: '最后评估',
      dataIndex: 'lastEvaluatedAt',
      key: 'lastEvaluatedAt',
      width: 120,
      render: (ts?: number) => ts ? <Text type="secondary" style={{ fontSize: 12 }}>{formatTimeAgo(ts)}</Text> : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, rule) => (
        <Space size="small">
          <Switch
            size="small"
            checked={rule.status === 'enabled'}
            onChange={() => toggleStatus(rule)}
          />
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(rule)} />
          <Popconfirm title={`确定删除规则 "${rule.name}"？`} onConfirm={() => handleDelete(rule)} okText="删除" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ], [toggleStatus, openModal, handleDelete]);

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 16 }}>
        <Space align="center" style={{ marginBottom: 4 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>告警规则</Typography.Title>
          <Tag color="blue">告警中心</Tag>
        </Space>
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          配置告警条件和通知路由
        </Typography.Paragraph>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="总规则数" value={stats.total} prefix={<UnorderedListOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="已启用" value={stats.enabled} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="已禁用" value={stats.disabled} prefix={<CloseCircleOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="异常" value={stats.error} valueStyle={{ color: '#cf1322' }} prefix={<ExclamationCircleOutlined />} /></Card>
        </Col>
      </Row>

      {/* 过滤器 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col flex="auto">
            <Input placeholder="搜索规则名称或查询..." prefix={<SearchOutlined />} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} allowClear />
          </Col>
          <Col>
            <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 120 }} options={[
              { label: '所有状态', value: 'all' },
              { label: '已启用', value: 'enabled' },
              { label: '已禁用', value: 'disabled' },
              { label: '异常', value: 'error' },
            ]} />
          </Col>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>新建规则</Button>
          </Col>
        </Row>
      </Card>

      {/* 规则表格 */}
      <Card>
        <Table<AlertRule>
          columns={columns}
          dataSource={filteredRules}
          rowKey="id"
          pagination={{ showSizeChanger: true, showTotal: (total, range) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条` }}
          scroll={{ x: 900 }}
          size="middle"
        />
      </Card>

      {/* 创建/编辑模态框 */}
      <Modal
        title={editingRule ? '编辑告警规则' : '新建告警规则'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editingRule ? '保存' : '创建'}
        cancelText="取消"
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ severity: 'medium', evaluationInterval: 60, forDuration: 300, conditionOperator: 'gt' }}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="输入规则名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="输入规则描述" />
          </Form.Item>
          <Form.Item name="query" label="查询表达式" rules={[{ required: true, message: '请输入查询表达式' }]}>
            <TextArea rows={3} placeholder="输入查询表达式，如: count(level='ERROR') > 10" style={{ fontFamily: 'monospace' }} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="severity" label="严重程度">
                <Select options={[
                  { label: '严重 (Critical)', value: 'critical' },
                  { label: '高 (High)', value: 'high' },
                  { label: '中 (Medium)', value: 'medium' },
                  { label: '低 (Low)', value: 'low' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="evaluationInterval" label="评估间隔">
                <Select options={[
                  { label: '30 秒', value: 30 },
                  { label: '1 分钟', value: 60 },
                  { label: '5 分钟', value: 300 },
                  { label: '10 分钟', value: 600 },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="conditionMetric" label="条件指标">
                <Input placeholder="指标名称" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="conditionOperator" label="操作符">
                <Select options={[
                  { label: '大于 (>)', value: 'gt' },
                  { label: '大于等于 (>=)', value: 'gte' },
                  { label: '小于 (<)', value: 'lt' },
                  { label: '小于等于 (<=)', value: 'lte' },
                  { label: '等于 (=)', value: 'eq' },
                  { label: '不等于 (!=)', value: 'ne' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="conditionThreshold" label="阈值">
                <InputNumber style={{ width: '100%' }} placeholder="阈值" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default AlertRulesPage;

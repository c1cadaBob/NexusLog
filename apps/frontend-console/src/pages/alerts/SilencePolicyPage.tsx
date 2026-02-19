/**
 * 静默策略页面
 *
 * 提供静默策略管理功能：
 * - 策略列表展示（Ant Design Table）
 * - 创建/编辑/删除策略
 * - 匹配规则管理
 * - 策略状态（生效中/未开始/已失效）
 * - 立即失效/重新激活操作
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
  Modal,
  Form,
  Statistic,
  Row,
  Col,
  Typography,
  DatePicker,
  Checkbox,
  message,
  Popconfirm,
  Segmented,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  StopOutlined,
  ReloadOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { SilencePolicy as SilencePolicyType, SilenceMatcher } from '@/types/alert';

const { Text } = Typography;
const { TextArea } = Input;

// ============================================================================
// 模拟数据
// ============================================================================

const mockPolicies: SilencePolicyType[] = [
  {
    id: 'sil-9821-ab', name: '订单服务维护窗口', description: '全链路压测期间忽略非致命告警',
    matchers: [{ name: 'service', value: 'order-api', isRegex: false }, { name: 'severity', value: 'warning', isRegex: false }],
    startsAt: Date.now() - 3600000, endsAt: Date.now() + 4500000,
    createdBy: 'zhang.san', createdAt: Date.now() - 86400000 * 2, updatedAt: Date.now() - 3600000,
    comment: '全链路压测期间忽略非致命告警',
  },
  {
    id: 'sil-3301-xx', name: '测试环境全量静默', description: '测试环境告警静默',
    matchers: [{ name: 'env', value: 'test', isRegex: false }],
    startsAt: Date.now() - 86400000 * 25, endsAt: Date.now() + 86400000 * 60,
    createdBy: 'li.si', createdAt: Date.now() - 86400000 * 25, updatedAt: Date.now() - 86400000 * 25,
  },
  {
    id: 'sil-7721-qq', name: '支付网关数据库迁移', description: '数据库迁移期间静默',
    matchers: [{ name: 'service', value: 'payment-gateway', isRegex: false }, { name: 'component', value: 'database', isRegex: false }],
    startsAt: Date.now() + 50400000, endsAt: Date.now() + 57600000,
    createdBy: 'wang.wu', createdAt: Date.now() - 86400000, updatedAt: Date.now() - 86400000,
    comment: '计划内数据库迁移',
  },
  {
    id: 'sil-1102-zz', name: '临时扩容告警抑制', description: '扩容期间告警抑制',
    matchers: [{ name: 'host', value: 'web-server-01', isRegex: false }],
    startsAt: Date.now() - 86400000 * 40, endsAt: Date.now() - 86400000 * 39,
    createdBy: 'admin', createdAt: Date.now() - 86400000 * 40, updatedAt: Date.now() - 86400000 * 40,
  },
];

// ============================================================================
// 辅助函数
// ============================================================================

type PolicyStatus = 'active' | 'pending' | 'expired';

const getPolicyStatus = (policy: SilencePolicyType): PolicyStatus => {
  const now = Date.now();
  if (policy.endsAt < now) return 'expired';
  if (policy.startsAt > now) return 'pending';
  return 'active';
};

const statusConfig: Record<PolicyStatus, { color: string; label: string }> = {
  active: { color: 'success', label: '生效中' },
  pending: { color: 'processing', label: '未开始' },
  expired: { color: 'default', label: '已失效' },
};

const formatDateTime = (ts: number) => dayjs(ts).format('YYYY-MM-DD HH:mm');

const formatRemaining = (endsAt: number): string => {
  const remaining = endsAt - Date.now();
  if (remaining <= 0) return '-';
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}天+`;
  return `${hours}h ${minutes}m`;
};

// ============================================================================
// 主组件
// ============================================================================

export const SilencePolicyPage: React.FC = () => {
  const [policies, setPolicies] = useState<SilencePolicyType[]>(mockPolicies);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PolicyStatus | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<SilencePolicyType | null>(null);
  const [form] = Form.useForm();

  // 过滤
  const filteredPolicies = useMemo(() => {
    return policies.filter(policy => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!policy.name.toLowerCase().includes(q) && !policy.createdBy.toLowerCase().includes(q)) return false;
      }
      if (statusFilter !== 'all' && getPolicyStatus(policy) !== statusFilter) return false;
      return true;
    });
  }, [policies, searchQuery, statusFilter]);

  // 统计
  const stats = useMemo(() => ({
    active: policies.filter(p => getPolicyStatus(p) === 'active').length,
    pending: policies.filter(p => getPolicyStatus(p) === 'pending').length,
    expired: policies.filter(p => getPolicyStatus(p) === 'expired').length,
  }), [policies]);

  // 打开创建/编辑模态框
  const openModal = useCallback((policy?: SilencePolicyType) => {
    if (policy) {
      setEditingPolicy(policy);
      form.setFieldsValue({
        name: policy.name,
        description: policy.description,
        matchers: policy.matchers.length > 0 ? policy.matchers : [{ name: '', value: '', isRegex: false }],
        timeRange: [dayjs(policy.startsAt), dayjs(policy.endsAt)],
        comment: policy.comment,
      });
    } else {
      setEditingPolicy(null);
      form.resetFields();
      form.setFieldsValue({
        matchers: [{ name: '', value: '', isRegex: false }],
        timeRange: [dayjs(), dayjs().add(1, 'hour')],
      });
    }
    setModalOpen(true);
  }, [form]);

  // 提交表单
  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const matchers = (values.matchers as SilenceMatcher[]).filter(m => m.name && m.value);
      const [start, end] = values.timeRange as [dayjs.Dayjs, dayjs.Dayjs];

      if (editingPolicy) {
        setPolicies(prev => prev.map(p => p.id === editingPolicy.id ? {
          ...p, name: values.name, description: values.description, matchers,
          startsAt: start.valueOf(), endsAt: end.valueOf(), comment: values.comment, updatedAt: Date.now(),
        } : p));
        message.success(`静默策略 "${values.name}" 已更新`);
      } else {
        const newPolicy: SilencePolicyType = {
          id: `sil-${Date.now().toString(36)}`, name: values.name, description: values.description,
          matchers, startsAt: start.valueOf(), endsAt: end.valueOf(),
          createdBy: 'current_user', createdAt: Date.now(), updatedAt: Date.now(), comment: values.comment,
        };
        setPolicies(prev => [...prev, newPolicy]);
        message.success(`静默策略 "${values.name}" 已创建`);
      }
      setModalOpen(false);
    } catch { /* validation error */ }
  }, [form, editingPolicy]);

  // 删除
  const handleDelete = useCallback((policy: SilencePolicyType) => {
    setPolicies(prev => prev.filter(p => p.id !== policy.id));
    message.success(`静默策略 "${policy.name}" 已删除`);
  }, []);

  // 立即失效
  const handleExpire = useCallback((policy: SilencePolicyType) => {
    setPolicies(prev => prev.map(p => p.id === policy.id ? { ...p, endsAt: Date.now() - 1000, updatedAt: Date.now() } : p));
    message.success(`静默策略 "${policy.name}" 已失效`);
  }, []);

  // 重新激活
  const handleReactivate = useCallback((policy: SilencePolicyType) => {
    setPolicies(prev => prev.map(p => p.id === policy.id ? {
      ...p, startsAt: Date.now(), endsAt: Date.now() + 3600000, updatedAt: Date.now(),
    } : p));
    message.success(`静默策略 "${policy.name}" 已重新激活`);
  }, []);

  // 表格列
  const columns: ColumnsType<SilencePolicyType> = useMemo(() => [
    {
      title: '策略名称',
      key: 'name',
      render: (_, policy) => (
        <div>
          <Text strong>{policy.name}</Text>
          <div><Text type="secondary" style={{ fontSize: 12 }}>ID: {policy.id}</Text></div>
          <div><Text type="secondary" style={{ fontSize: 12 }}>创建人: {policy.createdBy}</Text></div>
        </div>
      ),
    },
    {
      title: '匹配规则',
      key: 'matchers',
      width: 200,
      render: (_, policy) => (
        <Space direction="vertical" size={2}>
          {policy.matchers.map((m, i) => (
            <Tag key={i} style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {m.name}={m.value}{m.isRegex ? ' *' : ''}
            </Tag>
          ))}
          {policy.comment && <Text type="secondary" style={{ fontSize: 11 }}>备注: {policy.comment}</Text>}
        </Space>
      ),
    },
    {
      title: '起止时间',
      key: 'timeRange',
      width: 200,
      render: (_, policy) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>开始: {formatDateTime(policy.startsAt)}</Text>
          <Text style={{ fontSize: 12 }}>结束: {formatDateTime(policy.endsAt)}</Text>
        </Space>
      ),
    },
    {
      title: '剩余时间',
      key: 'remaining',
      width: 120,
      render: (_, policy) => {
        const status = getPolicyStatus(policy);
        if (status === 'active') return <Text type="warning" strong>{formatRemaining(policy.endsAt)}</Text>;
        if (status === 'pending') return <Text type="secondary">{formatRemaining(policy.startsAt)}</Text>;
        return <Text type="secondary">-</Text>;
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, policy) => {
        const status = getPolicyStatus(policy);
        return <Tag color={statusConfig[status].color}>{statusConfig[status].label}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_, policy) => {
        const status = getPolicyStatus(policy);
        return (
          <Space size="small">
            {status !== 'expired' && (
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(policy)} />
            )}
            {status === 'active' && (
              <Popconfirm title="确定立即失效？" onConfirm={() => handleExpire(policy)} okText="确定" cancelText="取消">
                <Button type="link" size="small" danger icon={<StopOutlined />} />
              </Popconfirm>
            )}
            {status === 'expired' && (
              <Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => handleReactivate(policy)} />
            )}
            <Popconfirm title={`确定删除 "${policy.name}"？`} onConfirm={() => handleDelete(policy)} okText="删除" cancelText="取消">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        );
      },
    },
  ], [openModal, handleExpire, handleReactivate, handleDelete]);

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space align="center" style={{ marginBottom: 4 }}>
              <Typography.Title level={4} style={{ margin: 0 }}>静默策略</Typography.Title>
              <Tag color="blue">告警中心</Tag>
            </Space>
            <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
              管理告警静默规则，在维护窗口或已知故障期间屏蔽指定告警通知
            </Typography.Paragraph>
          </Col>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>新建静默策略</Button>
          </Col>
        </Row>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={8}>
          <Card size="small"><Statistic title="生效中" value={stats.active} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} /></Card>
        </Col>
        <Col xs={8}>
          <Card size="small"><Statistic title="待生效" value={stats.pending} prefix={<ClockCircleOutlined />} /></Card>
        </Col>
        <Col xs={8}>
          <Card size="small"><Statistic title="已失效" value={stats.expired} prefix={<HistoryOutlined />} /></Card>
        </Col>
      </Row>

      {/* 过滤器 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col flex="auto">
            <Input placeholder="搜索策略名称、创建人..." prefix={<SearchOutlined />} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} allowClear />
          </Col>
          <Col>
            <Segmented
              value={statusFilter}
              onChange={v => setStatusFilter(v as PolicyStatus | 'all')}
              options={[
                { label: '全部', value: 'all' },
                { label: '生效中', value: 'active' },
                { label: '未开始', value: 'pending' },
                { label: '已失效', value: 'expired' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {/* 策略表格 */}
      <Card>
        <Table<SilencePolicyType>
          columns={columns}
          dataSource={filteredPolicies}
          rowKey="id"
          pagination={{ showSizeChanger: true, showTotal: (total, range) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条` }}
          scroll={{ x: 900 }}
          size="middle"
        />
      </Card>

      {/* 创建/编辑模态框 */}
      <Modal
        title={editingPolicy ? '编辑静默策略' : '新建静默策略'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editingPolicy ? '保存' : '创建'}
        cancelText="取消"
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="策略名称" rules={[{ required: true, message: '请输入策略名称' }]}>
            <Input placeholder="输入策略名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="输入策略描述" />
          </Form.Item>

          {/* 匹配规则 */}
          <Form.List name="matchers">
            {(fields, { add, remove }) => (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text strong>匹配规则</Text>
                  <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => add({ name: '', value: '', isRegex: false })}>
                    添加规则
                  </Button>
                </div>
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={8} style={{ marginBottom: 8 }} align="middle">
                    <Col flex="auto">
                      <Form.Item {...restField} name={[name, 'name']} noStyle>
                        <Input placeholder="标签名" />
                      </Form.Item>
                    </Col>
                    <Col><Text type="secondary">=</Text></Col>
                    <Col flex="auto">
                      <Form.Item {...restField} name={[name, 'value']} noStyle>
                        <Input placeholder="标签值" />
                      </Form.Item>
                    </Col>
                    <Col>
                      <Form.Item {...restField} name={[name, 'isRegex']} valuePropName="checked" noStyle>
                        <Checkbox>正则</Checkbox>
                      </Form.Item>
                    </Col>
                    <Col>
                      {fields.length > 1 && (
                        <Button type="link" size="small" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                      )}
                    </Col>
                  </Row>
                ))}
              </div>
            )}
          </Form.List>

          {/* 时间范围 */}
          <Form.Item name="timeRange" label="时间范围" rules={[{ required: true, message: '请选择时间范围' }]}>
            <DatePicker.RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="comment" label="备注">
            <TextArea rows={2} placeholder="输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SilencePolicyPage;

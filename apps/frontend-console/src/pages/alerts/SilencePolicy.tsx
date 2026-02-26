import React, { useState, useMemo, useCallback } from 'react';
import { Input, Select, Table, Tag, Button, Card, Space, Modal, Form, DatePicker, Checkbox, Segmented, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS } from '../../theme/tokens';
import type { SilencePolicy as SilencePolicyType, SilenceMatcher } from '../../types/alert';

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

const statusConfig: Record<PolicyStatus, { label: string; color: string }> = {
  active: { label: '生效中', color: 'success' },
  pending: { label: '未开始', color: 'processing' },
  expired: { label: '已失效', color: 'default' },
};

const formatDateTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
};

const formatRemainingTime = (endsAt: number): string => {
  const remaining = endsAt - Date.now();
  if (remaining <= 0) return '-';
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  if (hours > 24) return `${Math.floor(hours / 24)}天+`;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// ============================================================================
// 组件
// ============================================================================

const SilencePolicy: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const [form] = Form.useForm();

  const [policies, setPolicies] = useState<SilencePolicyType[]>(mockPolicies);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PolicyStatus | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [currentPolicy, setCurrentPolicy] = useState<SilencePolicyType | null>(null);
  const [matchers, setMatchers] = useState<SilenceMatcher[]>([{ name: '', value: '', isRegex: false }]);

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

  // 打开创建
  const openCreate = useCallback(() => {
    setModalMode('create');
    setCurrentPolicy(null);
    setMatchers([{ name: '', value: '', isRegex: false }]);
    form.resetFields();
    setModalOpen(true);
  }, [form]);

  // 打开编辑
  const openEdit = useCallback((policy: SilencePolicyType) => {
    setModalMode('edit');
    setCurrentPolicy(policy);
    setMatchers(policy.matchers.length > 0 ? [...policy.matchers] : [{ name: '', value: '', isRegex: false }]);
    form.setFieldsValue({
      name: policy.name,
      description: policy.description || '',
      comment: policy.comment || '',
    });
    setModalOpen(true);
  }, [form]);

  // 提交
  const handleSubmit = useCallback(() => {
    form.validateFields().then(values => {
      const validMatchers = matchers.filter(m => m.name && m.value);
      if (modalMode === 'create') {
        const newPolicy: SilencePolicyType = {
          id: `sil-${Date.now().toString(36)}`,
          name: values.name,
          description: values.description || '',
          matchers: validMatchers,
          startsAt: Date.now(),
          endsAt: Date.now() + 3600000,
          createdBy: 'current_user',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          comment: values.comment || '',
        };
        setPolicies(prev => [...prev, newPolicy]);
        message.success(`静默策略 "${values.name}" 已创建`);
      } else if (currentPolicy) {
        setPolicies(prev => prev.map(p => p.id === currentPolicy.id ? {
          ...p, name: values.name, description: values.description || '',
          matchers: validMatchers, comment: values.comment || '', updatedAt: Date.now(),
        } : p));
        message.success(`静默策略 "${values.name}" 已更新`);
      }
      setModalOpen(false);
    });
  }, [form, modalMode, currentPolicy, matchers]);

  // 删除
  const handleDelete = useCallback(() => {
    if (!currentPolicy) return;
    setPolicies(prev => prev.filter(p => p.id !== currentPolicy.id));
    setDeleteModalOpen(false);
    message.success(`静默策略 "${currentPolicy.name}" 已删除`);
    setCurrentPolicy(null);
  }, [currentPolicy]);

  // 立即失效
  const handleExpire = useCallback((policy: SilencePolicyType) => {
    setPolicies(prev => prev.map(p => p.id === policy.id ? { ...p, endsAt: Date.now() - 1000, updatedAt: Date.now() } : p));
    message.success(`静默策略 "${policy.name}" 已失效`);
  }, []);

  // 重新激活
  const handleReactivate = useCallback((policy: SilencePolicyType) => {
    setPolicies(prev => prev.map(p => p.id === policy.id ? { ...p, startsAt: Date.now(), endsAt: Date.now() + 3600000, updatedAt: Date.now() } : p));
    message.success(`静默策略 "${policy.name}" 已重新激活`);
  }, []);

  // 匹配器操作
  const addMatcher = useCallback(() => {
    setMatchers(prev => [...prev, { name: '', value: '', isRegex: false }]);
  }, []);

  const removeMatcher = useCallback((index: number) => {
    setMatchers(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateMatcher = useCallback((index: number, field: keyof SilenceMatcher, value: string | boolean) => {
    setMatchers(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  }, []);

  // 表格列
  const columns: ColumnsType<SilencePolicyType> = [
    {
      title: '策略名称 / ID',
      key: 'name',
      render: (_, policy) => {
        const status = getPolicyStatus(policy);
        const isExpired = status === 'expired';
        return (
          <div style={{ opacity: isExpired ? 0.6 : 1 }}>
            <div style={{ fontWeight: 500 }}>{policy.name}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace', marginTop: 4 }}>ID: {policy.id}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: isDark ? '#334155' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
                {policy.createdBy.slice(0, 2).toUpperCase()}
              </div>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{policy.createdBy}</span>
            </div>
          </div>
        );
      },
    },
    {
      title: '匹配规则',
      key: 'matchers',
      render: (_, policy) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {policy.matchers.map((matcher, idx) => (
            <Tag key={idx} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
              {matcher.name}={matcher.value}
              {matcher.isRegex && <span style={{ color: COLORS.warning, marginLeft: 4 }}>*</span>}
            </Tag>
          ))}
          {policy.comment && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>备注: {policy.comment}</div>
          )}
        </div>
      ),
    },
    {
      title: '起止时间',
      key: 'time',
      width: 220,
      render: (_, policy) => {
        const isExpired = getPolicyStatus(policy) === 'expired';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, opacity: isExpired ? 0.6 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ color: '#94a3b8', width: 36, textAlign: 'right' }}>Start:</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatDateTime(policy.startsAt)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ color: '#94a3b8', width: 36, textAlign: 'right' }}>End:</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatDateTime(policy.endsAt)}</span>
            </div>
          </div>
        );
      },
    },
    {
      title: '剩余时间',
      key: 'remaining',
      width: 140,
      render: (_, policy) => {
        const status = getPolicyStatus(policy);
        if (status === 'active') {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: COLORS.warning }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, animation: 'pulse 2s infinite' }}>timer</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 14 }}>{formatRemainingTime(policy.endsAt)}</span>
            </div>
          );
        }
        if (status === 'pending') {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: COLORS.info }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>hourglass_empty</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14 }}>{formatRemainingTime(policy.startsAt)}</span>
            </div>
          );
        }
        return <span style={{ color: '#94a3b8' }}>-</span>;
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 90,
      render: (_, policy) => {
        const status = getPolicyStatus(policy);
        return <Tag color={statusConfig[status].color}>{statusConfig[status].label}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      align: 'right',
      render: (_, policy) => {
        const status = getPolicyStatus(policy);
        return (
          <Space size={4}>
            {status !== 'expired' && (
              <Button type="text" size="small" onClick={() => openEdit(policy)} title="编辑"
                icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>}
              />
            )}
            {status === 'active' && (
              <Button type="text" size="small" danger onClick={() => handleExpire(policy)} title="立即失效"
                icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>block</span>}
              />
            )}
            {status === 'expired' && (
              <Button type="text" size="small" onClick={() => handleReactivate(policy)} title="重新激活"
                icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.success }}>replay</span>}
              />
            )}
            <Button type="text" size="small" danger onClick={() => { setCurrentPolicy(policy); setDeleteModalOpen(true); }} title="删除"
              icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>}
            />
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ maxWidth: 640 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>静默策略</h1>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#94a3b8' }}>
            管理告警静默规则，在特定的维护窗口或已知故障期间屏蔽指定告警的通知发送。
          </p>
        </div>
        <Button type="primary" icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>} onClick={openCreate}>
          新建静默策略
        </Button>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <Card size="small" styles={{ body: { padding: 16 } }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: `${COLORS.success}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.success }}>check_circle</span>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>生效中策略</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.active}</div>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: 16 } }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: `${COLORS.info}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.info }}>schedule</span>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>待生效</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.pending}</div>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: 16 } }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: isDark ? '#334155' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ color: '#94a3b8' }}>history</span>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>已失效</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.expired}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* 过滤器 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <Input
          prefix={<span className="material-symbols-outlined" style={{ fontSize: 20, color: '#94a3b8' }}>search</span>}
          placeholder="搜索策略名称、创建人..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ maxWidth: 400 }}
          allowClear
        />
        <Segmented
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as PolicyStatus | 'all')}
          options={[
            { value: 'all', label: '全部' },
            { value: 'active', label: '生效中' },
            { value: 'pending', label: '未开始' },
            { value: 'expired', label: '已失效' },
          ]}
        />
      </div>

      {/* 策略表格 */}
      <Card style={{ flex: 1, overflow: 'hidden' }}
        styles={{ body: { padding: 0, overflow: 'auto', height: '100%' } }}>
        <Table<SilencePolicyType>
          rowKey="id"
          columns={columns}
          dataSource={filteredPolicies}
          size="middle"
          pagination={false}
          scroll={{ x: 900 }}
        />
      </Card>

      {/* 创建/编辑模态框 */}
      <Modal
        open={modalOpen}
        title={modalMode === 'create' ? '新建静默策略' : '编辑静默策略'}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText={modalMode === 'create' ? '创建' : '保存'}
        cancelText="取消"
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="策略名称" rules={[{ required: true, message: '请输入策略名称' }]}>
            <Input placeholder="输入策略名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="输入策略描述" rows={2} />
          </Form.Item>

          {/* 匹配规则 */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontWeight: 500, fontSize: 14 }}>匹配规则</label>
              <Button type="link" size="small" onClick={addMatcher}
                icon={<span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>}
              >添加规则</Button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {matchers.map((matcher, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Input
                    value={matcher.name}
                    onChange={(e) => updateMatcher(index, 'name', e.target.value)}
                    placeholder="标签名"
                    style={{ flex: 1 }}
                  />
                  <span style={{ color: '#94a3b8' }}>=</span>
                  <Input
                    value={matcher.value}
                    onChange={(e) => updateMatcher(index, 'value', e.target.value)}
                    placeholder="标签值"
                    style={{ flex: 1 }}
                  />
                  <Checkbox
                    checked={matcher.isRegex}
                    onChange={(e) => updateMatcher(index, 'isRegex', e.target.checked)}
                  >
                    <span style={{ fontSize: 12 }}>正则</span>
                  </Checkbox>
                  {matchers.length > 1 && (
                    <Button type="text" size="small" danger onClick={() => removeMatcher(index)}
                      icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <Form.Item name="comment" label="备注">
            <Input.TextArea placeholder="输入备注信息" rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 删除确认 */}
      <Modal
        open={deleteModalOpen}
        title="删除静默策略"
        onCancel={() => setDeleteModalOpen(false)}
        onOk={handleDelete}
        okText="删除"
        okButtonProps={{ danger: true }}
        cancelText="取消"
      >
        <p style={{ color: '#94a3b8' }}>
          确定要删除静默策略 <span style={{ fontWeight: 500 }}>"{currentPolicy?.name}"</span> 吗？此操作不可撤销。
        </p>
      </Modal>
    </div>
  );
};

export default SilencePolicy;

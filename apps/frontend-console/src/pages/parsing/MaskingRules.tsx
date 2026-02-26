import React, { useState, useCallback, useMemo } from 'react';
import { Button, Table, Tag, Modal, Form, Input, Select, Switch, Card, Statistic, Space, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';
import type { MaskingRule, MaskType } from '../../types/parsing';
import { MASK_TYPES } from '../../types/parsing';

// ============================================================================
// 模拟数据
// ============================================================================

const initialRules: MaskingRule[] = [
  { id: '1', name: '手机号脱敏', description: '基础隐私保护', field: 'user.phone', maskType: 'partial', pattern: '138****0000', scope: '全索引 (All Indexes)', enabled: true, priority: 1 },
  { id: '2', name: '邮箱掩码', description: '替换敏感字符', field: 'user.email', maskType: 'replace', pattern: '*@*.com', scope: 'app-logs-*', enabled: true, priority: 2 },
  { id: '3', name: '密码哈希', description: '不可逆加密', field: 'auth.password', maskType: 'hash', scope: 'auth-service', enabled: true, priority: 3 },
  { id: '4', name: '银行卡号截断', description: '支付安全合规', field: 'payment.card_num', maskType: 'truncate', pattern: '后4位', scope: 'payment-logs', enabled: false, priority: 4 },
];

const previewRaw = `{
  "timestamp": "2023-10-27T10:00:00Z",
  "level": "INFO",
  "user": {
    "id": 1001,
    "email": "john.doe@example.com",
    "phone": "13812345678"
  },
  "auth": {
    "password": "secret_pass_123"
  }
}`;

const previewMasked = `{
  "timestamp": "2023-10-27T10:00:00Z",
  "level": "INFO",
  "user": {
    "id": 1001,
    "email": "j***@example.com",
    "phone": "138****5678"
  },
  "auth": {
    "password": "5f4dcc3b5aa765d61d8327deb882cf99"
  }
}`;

// ============================================================================
// 脱敏方式 Tag 颜色映射
// ============================================================================

const maskTagColor: Record<MaskType, string> = {
  partial: 'purple',
  replace: 'warning',
  hash: 'geekblue',
  truncate: 'error',
  null: 'default',
};

// ============================================================================
// 组件
// ============================================================================

const MaskingRules: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  const [rules, setRules] = useState<MaskingRule[]>(initialRules);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<MaskingRule | null>(null);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // 统计
  const stats = useMemo(() => ({
    activeRules: rules.filter(r => r.enabled).length,
    maskedFieldsToday: '1.4M',
    coveredIndexes: '8/10',
  }), [rules]);

  // 切换启用
  const handleToggle = useCallback((id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }, []);

  // 删除
  const handleDelete = useCallback((id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    message.success('规则已删除');
  }, []);

  // 添加
  const handleAdd = useCallback(() => {
    addForm.validateFields().then(values => {
      const rule: MaskingRule = {
        id: Date.now().toString(),
        name: values.name,
        description: values.description || '',
        field: values.field,
        maskType: values.maskType,
        scope: values.scope || '全索引',
        enabled: true,
        priority: rules.length + 1,
      };
      setRules(prev => [...prev, rule]);
      addForm.resetFields();
      setAddModalOpen(false);
      message.success('规则已创建');
    });
  }, [addForm, rules.length]);

  // 编辑
  const handleStartEdit = useCallback((rule: MaskingRule) => {
    setEditingRule(rule);
    editForm.setFieldsValue(rule);
  }, [editForm]);

  const handleSaveEdit = useCallback(() => {
    if (!editingRule) return;
    editForm.validateFields().then(values => {
      setRules(prev => prev.map(r => r.id === editingRule.id ? { ...editingRule, ...values } : r));
      setEditingRule(null);
      message.success('规则已更新');
    });
  }, [editingRule, editForm]);

  // 表格列
  const columns: ColumnsType<MaskingRule> = [
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      align: 'center',
      render: (priority: number) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: palette.textTertiary, cursor: 'grab' }}>drag_indicator</span>
          <span style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, background: isDark ? '#334155' : '#e2e8f0', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>{priority}</span>
        </div>
      ),
    },
    {
      title: '规则名称',
      key: 'name',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.name}</div>
          <div style={{ fontSize: 12, color: palette.textSecondary }}>{record.description}</div>
        </div>
      ),
    },
    {
      title: '匹配字段',
      dataIndex: 'field',
      key: 'field',
      render: (field: string) => (
        <code style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: isDark ? '#0f172a' : '#f1f5f9', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)', fontFamily: 'JetBrains Mono, monospace' }}>
          {field}
        </code>
      ),
    },
    {
      title: '脱敏方式',
      key: 'maskType',
      render: (_, record) => {
        const cfg = MASK_TYPES.find(t => t.value === record.maskType);
        return (
          <Tag
            color={maskTagColor[record.maskType]}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>{cfg?.icon}</span>}
          >
            {cfg?.label}{record.pattern ? ` (${record.pattern})` : ''}
          </Tag>
        );
      },
    },
    {
      title: '应用范围',
      dataIndex: 'scope',
      key: 'scope',
      render: (scope: string) => <Tag>{scope}</Tag>,
    },
    {
      title: '状态',
      key: 'enabled',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Switch size="small" checked={record.enabled} onChange={() => handleToggle(record.id)} />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button type="text" size="small" title="预览"
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.info }}>preview</span>} />
          <Button type="text" size="small" onClick={() => handleStartEdit(record)} title="编辑"
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>} />
          <Button type="text" size="small" onClick={() => handleDelete(record.id)} title="删除"
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.danger }}>delete</span>} />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>脱敏规则管理</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: palette.textSecondary }}>
            配置敏感数据的自动脱敏规则，确保数据在存储和展示时的隐私安全。
          </p>
        </div>
        <Space>
          <Button icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>history</span>}>操作日志</Button>
          <Button type="primary" onClick={() => setAddModalOpen(true)}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>}
          >新建规则</Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <Card size="small" styles={{ body: { padding: 20 } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 14, color: palette.textSecondary, marginBottom: 8 }}>启用规则总数</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.activeRules}</div>
              <div style={{ marginTop: 8, fontSize: 12, color: COLORS.success, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                运行正常
              </div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.info}1a`, opacity: 0.8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 28, color: COLORS.info }}>shield</span>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: 20 } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 14, color: palette.textSecondary, marginBottom: 8 }}>今日脱敏字段数</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.maskedFieldsToday}</div>
              <div style={{ marginTop: 8, fontSize: 12, color: COLORS.info, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>trending_up</span>
                较昨日 +12%
              </div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.purple}1a`, opacity: 0.8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 28, color: COLORS.purple }}>fingerprint</span>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: 20 } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 14, color: palette.textSecondary, marginBottom: 8 }}>覆盖索引范围</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.coveredIndexes}</div>
              <div style={{ marginTop: 8, fontSize: 12, color: palette.textSecondary }}>
                未覆盖: system-logs, debug-logs
              </div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.warning}1a`, opacity: 0.8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 28, color: COLORS.warning }}>lock</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 规则表格 */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ color: COLORS.primary }}>list_alt</span>
            规则列表
          </div>
        }
        extra={
          <Space>
            <Button type="text" size="small" icon={<span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_list</span>}>筛选</Button>
            <Button type="text" size="small" icon={<span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>}>导出配置</Button>
          </Space>
        }
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        styles={{ body: { flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' } }}
      >
        <Table<MaskingRule>
          rowKey="id"
          columns={columns}
          dataSource={rules}
          size="middle"
          pagination={{
            showSizeChanger: true,
            showTotal: (total, range) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条规则`,
          }}
          scroll={{ x: 900 }}
        />
      </Card>

      {/* 实时脱敏预览 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span className="material-symbols-outlined" style={{ color: COLORS.primary }}>science</span>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>实时脱敏预览</h3>
        </div>
        <Card styles={{ body: { padding: 0 } }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ padding: 20, borderRight: `1px solid ${palette.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: palette.textSecondary, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.danger }} />
                原始数据 (Raw)
              </div>
              <pre style={{
                margin: 0, padding: 16, borderRadius: 8, fontSize: 12, lineHeight: 1.6,
                fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap',
                background: isDark ? '#111722' : '#f8fafc', border: `1px solid ${palette.border}`,
                color: isDark ? '#cbd5e1' : '#334155', overflow: 'auto',
              }}>
                {previewRaw}
              </pre>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: palette.textSecondary, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.success }} />
                  脱敏结果 (Masked)
                </div>
                <Tag color="blue" style={{ fontSize: 11 }}>匹配规则: {rules.filter(r => r.enabled).length}项</Tag>
              </div>
              <pre style={{
                margin: 0, padding: 16, borderRadius: 8, fontSize: 12, lineHeight: 1.6,
                fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap',
                background: isDark ? '#111722' : '#f8fafc', border: `1px solid ${palette.border}`,
                color: isDark ? '#cbd5e1' : '#334155', overflow: 'auto',
              }}>
                {previewMasked}
              </pre>
            </div>
          </div>
        </Card>
      </div>

      {/* 新建规则弹窗 */}
      <Modal
        open={addModalOpen}
        title="新建脱敏规则"
        onCancel={() => { setAddModalOpen(false); addForm.resetFields(); }}
        onOk={handleAdd}
        okText="创建"
        cancelText="取消"
      >
        <Form form={addForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="例如: 手机号脱敏" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="规则描述" />
          </Form.Item>
          <Form.Item name="field" label="匹配字段" rules={[{ required: true, message: '请输入匹配字段' }]}>
            <Input placeholder="例如: user.phone" style={{ fontFamily: 'JetBrains Mono, monospace' }} />
          </Form.Item>
          <Form.Item name="maskType" label="脱敏方式" initialValue="partial">
            <Select options={MASK_TYPES.map(t => ({ value: t.value, label: t.label }))} />
          </Form.Item>
          <Form.Item name="scope" label="应用范围">
            <Input placeholder="例如: app-logs-* 或 全索引" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑规则弹窗 */}
      <Modal
        open={!!editingRule}
        title="编辑脱敏规则"
        onCancel={() => setEditingRule(null)}
        onOk={handleSaveEdit}
        okText="保存"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="field" label="匹配字段" rules={[{ required: true, message: '请输入匹配字段' }]}>
            <Input style={{ fontFamily: 'JetBrains Mono, monospace' }} />
          </Form.Item>
          <Form.Item name="maskType" label="脱敏方式">
            <Select options={MASK_TYPES.map(t => ({ value: t.value, label: t.label }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MaskingRules;

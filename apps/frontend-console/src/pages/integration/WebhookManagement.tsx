import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Input, Select, Table, Tag, Button, Card, Space, Modal, Form, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';
import { useUnnamedFormFieldAccessibility } from '../../components/common/useUnnamedFormFieldAccessibility';

// ============================================================================
// 类型与模拟数据
// ============================================================================

interface Webhook {
  id: string;
  name: string;
  url: string;
  trigger: string;
  status: 'Active' | 'Failed' | 'Disabled';
  health: 'Healthy' | 'Error' | 'Inactive';
  secret: string;
  createdAt: string;
  lastTriggered?: string;
}

const initialWebhooks: Webhook[] = [
  { id: 'wh_8f92k', name: '关键告警推送', url: 'https://api.opsgenie.com/v2/alerts', trigger: '告警触发', status: 'Active', health: 'Healthy', secret: 'whsec_8f92k...', createdAt: '2024-01-15', lastTriggered: '2024-02-10 14:30' },
  { id: 'wh_k92ls', name: '每日报表 Slack 通知', url: 'https://hooks.slack.com/services/T000.../B000...', trigger: '报表生成', status: 'Active', health: 'Healthy', secret: 'whsec_k92ls...', createdAt: '2024-01-20' },
  { id: 'wh_p93ms', name: 'Jira 工单同步', url: 'https://jira.company.com/rest/api/2/issue', trigger: '告警触发', status: 'Failed', health: 'Error', secret: 'whsec_p93ms...', createdAt: '2024-02-01', lastTriggered: '2024-02-09 09:15' },
  { id: 'wh_19fk2', name: 'S3 归档服务', url: 'https://archive-service.internal/hooks/logs', trigger: '系统错误', status: 'Disabled', health: 'Inactive', secret: 'whsec_19fk2...', createdAt: '2024-02-05' },
];

const triggerOptions = [
  { label: '告警触发', value: '告警触发' },
  { label: '报表生成', value: '报表生成' },
  { label: '系统错误', value: '系统错误' },
  { label: '日志摄入', value: '日志摄入' },
  { label: '用户登录', value: '用户登录' },
];

// ============================================================================
// 组件
// ============================================================================

const WebhookManagement: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;
  const [form] = Form.useForm();

  const [webhooks, setWebhooks] = useState<Webhook[]>(initialWebhooks);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const createWebhookModalRef = useUnnamedFormFieldAccessibility('webhook-create-modal');
  const editWebhookModalRef = useUnnamedFormFieldAccessibility('webhook-edit-modal');
  const [isTesting, setIsTesting] = useState(false);

  // 分页
  const storedPageSize = usePreferencesStore((s) => s.pageSizes['webhookManagement'] ?? 10);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeLocal(size);
    setStoredPageSize('webhookManagement', size);
  }, [setStoredPageSize]);

  // 过滤
  const filteredWebhooks = useMemo(() => {
    return webhooks.filter(wh => {
      const matchesSearch = wh.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           wh.url.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || wh.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [webhooks, searchQuery, statusFilter]);

  // 创建
  const handleCreate = useCallback(() => {
    form.validateFields().then((values) => {
      const newWebhook: Webhook = {
        id: `wh_${Math.random().toString(36).substr(2, 5)}`,
        name: values.name, url: values.url, trigger: values.trigger,
        status: 'Active', health: 'Healthy',
        secret: `whsec_${Math.random().toString(36).substr(2, 10)}`,
        createdAt: new Date().toISOString().split('T')[0],
      };
      setWebhooks(prev => [...prev, newWebhook]);
      setCreateModalOpen(false);
      message.success(`Webhook "${values.name}" 已创建`);
    });
  }, [form]);

  // 编辑
  const handleEdit = useCallback(() => {
    if (!selectedWebhook) return;
    form.validateFields().then((values) => {
      setWebhooks(prev => prev.map(wh =>
        wh.id === selectedWebhook.id ? { ...wh, name: values.name, url: values.url, trigger: values.trigger } : wh
      ));
      setEditModalOpen(false);
      message.success(`Webhook "${values.name}" 已更新`);
    });
  }, [form, selectedWebhook]);

  // 删除
  const handleDelete = useCallback(() => {
    if (!selectedWebhook) return;
    setWebhooks(prev => prev.filter(wh => wh.id !== selectedWebhook.id));
    setDeleteModalOpen(false);
    message.success(`Webhook "${selectedWebhook.name}" 已删除`);
    setSelectedWebhook(null);
  }, [selectedWebhook]);

  // 测试
  const handleTest = useCallback(async () => {
    setIsTesting(true);
    setTestResult(null);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const success = Math.random() > 0.3;
    setTestResult({
      success,
      message: success
        ? '测试成功！Webhook 端点响应正常 (HTTP 200)'
        : '测试失败：连接超时，请检查目标 URL 是否可访问',
    });
    setIsTesting(false);
  }, []);

  const openCreate = useCallback(() => {
    setSelectedWebhook(null);
    setCreateModalOpen(true);
  }, []);

  // 打开编辑
  const openEdit = useCallback((wh: Webhook) => {
    setSelectedWebhook(wh);
    setEditModalOpen(true);
  }, []);

  useEffect(() => {
    if (!createModalOpen) {
      return;
    }
    form.resetFields();
    form.setFieldsValue({ trigger: '告警触发' });
  }, [createModalOpen, form]);

  useEffect(() => {
    if (!editModalOpen || !selectedWebhook) {
      return;
    }
    form.setFieldsValue({
      name: selectedWebhook.name,
      url: selectedWebhook.url,
      trigger: selectedWebhook.trigger,
    });
  }, [editModalOpen, form, selectedWebhook]);

  // 表格列
  const columns: ColumnsType<Webhook> = [
    {
      title: 'Webhook 名称',
      key: 'name', width: '20%',
      render: (_, wh) => (
        <div>
          <div style={{ fontWeight: 500 }}>{wh.name}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>ID: {wh.id}</div>
        </div>
      ),
    },
    {
      title: '目标 URL',
      dataIndex: 'url', key: 'url', width: '25%',
      render: (url: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <code style={{ fontSize: 12, color: isDark ? '#cbd5e1' : '#475569', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
            {url}
          </code>
          <Button type="text" size="small"
            icon={<span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>}
            onClick={() => { navigator.clipboard.writeText(url); message.success('已复制'); }}
          />
        </div>
      ),
    },
    {
      title: '触发事件',
      dataIndex: 'trigger', key: 'trigger', width: '12%',
      render: (trigger: string) => <Tag color="blue">{trigger}</Tag>,
    },
    {
      title: '密钥 (Secret)',
      key: 'secret', width: '15%',
      render: (_, wh) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'monospace', color: '#94a3b8', letterSpacing: 2 }}>••••••••••••</span>
          <Button type="text" size="small"
            icon={<span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span>}
            onClick={() => { navigator.clipboard.writeText(wh.secret); message.success('已复制'); }}
          />
        </div>
      ),
    },
    {
      title: '状态',
      key: 'status', width: '10%',
      render: (_, wh) => {
        const color = wh.health === 'Healthy' ? 'success' : wh.health === 'Error' ? 'error' : 'default';
        return (
          <Tag color={color} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {wh.health === 'Healthy' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.success, display: 'inline-block' }} />}
            {wh.health === 'Error' && <span className="material-symbols-outlined" style={{ fontSize: 14 }}>error</span>}
            {wh.status}
          </Tag>
        );
      },
    },
    {
      title: '操作', key: 'actions', width: '18%', align: 'right',
      render: (_, wh) => (
        <Space size={4}>
          <Button type="text" size="small" title="测试推送"
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>}
            onClick={() => { setSelectedWebhook(wh); setTestResult(null); setTestModalOpen(true); }}
          />
          <Button type="text" size="small" title="编辑"
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>}
            onClick={() => openEdit(wh)}
          />
          <Button type="text" size="small" danger title="删除"
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>}
            onClick={() => { setSelectedWebhook(wh); setDeleteModalOpen(true); }}
          />
        </Space>
      ),
    },
  ];

  // 表单
  const renderForm = (containerRef?: React.RefObject<HTMLDivElement | null>) => (
    <div ref={containerRef}>
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
      <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入 Webhook 名称' }]}>
        <Input placeholder="例如：告警通知推送" autoComplete="off" />
      </Form.Item>
      <Form.Item name="url" label="目标 URL" rules={[{ required: true, message: '请输入目标 URL' }, { type: 'url', message: '请输入有效的 URL' }]}>
        <Input placeholder="https://example.com/webhook" autoComplete="url" />
      </Form.Item>
      <Form.Item name="trigger" label="触发事件" rules={[{ required: true }]}>
        <Select options={triggerOptions} />
      </Form.Item>
      </Form>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Webhook 管理 Webhook Management</h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#94a3b8' }}>
            集成与开放平台 / <span style={{ color: COLORS.primary }}>Webhook</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>menu_book</span>}>
            开发文档
          </Button>
          <Button type="primary" icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>}
            onClick={openCreate}>
            新建 Webhook
          </Button>
        </div>
      </div>

      {/* 过滤器 */}
      <Card size="small" styles={{ body: { padding: 16 } }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Input
            id="webhook-management-search"
            name="webhook-management-search"
            prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: '#94a3b8' }}>search</span>}
            placeholder="搜索 Webhook 名称或目标 URL..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            style={{ maxWidth: 400 }} allowClear
            autoComplete="off"
          />
          <Space>
            <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 160 }}
              options={[
                { label: '所有状态', value: 'all' },
                { label: '活跃 (Active)', value: 'active' },
                { label: '失败 (Failed)', value: 'failed' },
                { label: '停用 (Disabled)', value: 'disabled' },
              ]}
            />
            <Button type="text" icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>refresh</span>} />
          </Space>
        </div>
      </Card>

      {/* 表格 */}
      <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' } }}>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Table<Webhook>
            rowKey="id" columns={columns} dataSource={filteredWebhooks} size="middle"
            pagination={{ pageSize, showSizeChanger: true, showTotal: (total) => `共 ${total} 条记录`,
              onShowSizeChange: (_, size) => setPageSize(size) }}
            scroll={{ x: 900 }}
          />
        </div>
      </Card>

      {/* 提示信息 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card size="small" styles={{ body: { padding: 20 } }}
          style={{ borderColor: isDark ? '#1e3a5f' : '#bfdbfe', background: isDark ? '#0c1929' : '#eff6ff' }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${COLORS.info}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.info }}>security</span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: isDark ? '#93c5fd' : '#1e3a5f' }}>安全提示</div>
              <p style={{ margin: 0, fontSize: 13, color: isDark ? '#60a5fa' : '#2563eb', lineHeight: 1.6 }}>
                为保证 Webhook 安全，请务必验证 HTTP 请求头中的{' '}
                <code style={{ padding: '1px 6px', borderRadius: 4, background: isDark ? '#1e3a5f' : '#dbeafe', fontFamily: 'monospace', fontSize: 12 }}>X-LogMaster-Signature</code>。
              </p>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: 20 } }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? '#1e293b' : '#f1f5f9' }}>
              <span className="material-symbols-outlined" style={{ color: '#94a3b8' }}>troubleshoot</span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>遇到问题？</div>
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
                如果您的 Webhook 状态显示为 "Failed"，您可以点击测试按钮来诊断具体的错误。
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* 创建模态框 */}
      <Modal open={createModalOpen} title="新建 Webhook" onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreate} okText="创建" cancelText="取消" width={520} destroyOnHidden>
        {renderForm(createWebhookModalRef)}
      </Modal>

      {/* 编辑模态框 */}
      <Modal open={editModalOpen} title="编辑 Webhook" onCancel={() => setEditModalOpen(false)}
        onOk={handleEdit} okText="保存" cancelText="取消" width={520} destroyOnHidden>
        {renderForm(editWebhookModalRef)}
      </Modal>

      {/* 删除确认 */}
      <Modal open={deleteModalOpen} title="删除 Webhook" onCancel={() => setDeleteModalOpen(false)}
        onOk={handleDelete} okText="删除" okButtonProps={{ danger: true }} cancelText="取消">
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: COLORS.danger, display: 'block', marginBottom: 16 }}>warning</span>
          <p>确定要删除 Webhook "<span style={{ fontWeight: 600 }}>{selectedWebhook?.name}</span>" 吗？</p>
          <p style={{ fontSize: 13, color: '#94a3b8' }}>此操作无法撤销。</p>
        </div>
      </Modal>

      {/* 测试模态框 */}
      <Modal open={testModalOpen} title="测试 Webhook" onCancel={() => setTestModalOpen(false)} footer={null} width={520}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
          <Card size="small" styles={{ body: { padding: 16 } }} style={{ background: isDark ? '#0f172a' : '#f8fafc' }}>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>目标 URL</div>
            <div style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all' }}>{selectedWebhook?.url}</div>
          </Card>

          {testResult && (
            <Card size="small" styles={{ body: { padding: 16 } }}
              style={{ borderColor: testResult.success ? `${COLORS.success}40` : `${COLORS.danger}40`, background: testResult.success ? `${COLORS.success}08` : `${COLORS.danger}08` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: testResult.success ? COLORS.success : COLORS.danger }}>
                  {testResult.success ? 'check_circle' : 'error'}
                </span>
                <span style={{ fontWeight: 600, color: testResult.success ? COLORS.success : COLORS.danger }}>
                  {testResult.success ? '测试成功' : '测试失败'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: testResult.success ? COLORS.success : COLORS.danger, opacity: 0.8 }}>
                {testResult.message}
              </p>
            </Card>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button onClick={() => setTestModalOpen(false)}>关闭</Button>
            <Button type="primary" loading={isTesting} onClick={handleTest}
              icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>}>
              {isTesting ? '测试中...' : '发送测试请求'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default WebhookManagement;
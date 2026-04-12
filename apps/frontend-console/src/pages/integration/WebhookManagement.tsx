import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Empty, Form, Input, Modal, Select, Space, Switch, Table, Tag, Tooltip, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import {
  createNotificationChannel,
  deleteNotificationChannel,
  fetchNotificationChannels,
  testNotificationChannel,
  updateNotificationChannel,
} from '../../api/notification';
import type { NotificationChannel } from '../../types/alert';
import { resolveWebhookManagementActionAccess } from './webhookManagementAuthorization';

interface WebhookRecord {
  id: string;
  name: string;
  webhookURL: string;
  events: string[];
  secret: string;
  enabled: boolean;
  updatedAt: number;
}

const EVENT_OPTIONS = [
  { label: '告警触发', value: 'alert.firing' },
  { label: '告警恢复', value: 'alert.resolved' },
  { label: '审计导出完成', value: 'audit.export.completed' },
  { label: '报表导出完成', value: 'report.export.completed' },
  { label: '资源拉取异常', value: 'ingest.pull.failed' },
];

function normalizeWebhookRecord(channel: NotificationChannel): WebhookRecord {
  const config = channel.config ?? {};
  const events = Array.isArray(config.events)
    ? config.events.map((item) => String(item).trim()).filter(Boolean)
    : [];
  return {
    id: channel.id,
    name: channel.name,
    webhookURL: typeof config.webhook_url === 'string'
      ? config.webhook_url
      : typeof config.url === 'string'
        ? config.url
        : '',
    events,
    secret: typeof config.secret === 'string' ? config.secret : '',
    enabled: channel.enabled,
    updatedAt: channel.updatedAt,
  };
}

function formatDateTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '—';
  }
  return new Date(value).toLocaleString('zh-CN');
}

const WebhookManagement: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const capabilities = useAuthStore((state) => state.capabilities);
  const [form] = Form.useForm();
  const [records, setRecords] = useState<WebhookRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [testingID, setTestingID] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WebhookRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<WebhookRecord | null>(null);

  const actionAccess = useMemo(
    () => resolveWebhookManagementActionAccess({ capabilities }),
    [capabilities],
  );

  const storedPageSize = usePreferencesStore((s) => s.pageSizes.webhookManagement ?? 10);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeLocal(size);
    setStoredPageSize('webhookManagement', size);
  }, [setStoredPageSize]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const items = await fetchNotificationChannels({ force: true });
      setRecords(items.filter((item) => item.type === 'webhook').map(normalizeWebhookRecord));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载 Webhook 列表失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const filteredRecords = useMemo(() => records.filter((item) => {
    const keyword = searchQuery.trim().toLowerCase();
    const matchesKeyword = !keyword
      || item.name.toLowerCase().includes(keyword)
      || item.webhookURL.toLowerCase().includes(keyword)
      || item.events.some((event) => event.toLowerCase().includes(keyword));
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'enabled' ? item.enabled : !item.enabled);
    return matchesKeyword && matchesStatus;
  }), [records, searchQuery, statusFilter]);

  const openCreateModal = useCallback(() => {
    if (!actionAccess.canCreateWebhook) {
      message.warning('当前会话缺少 Webhook 创建权限');
      return;
    }
    setEditingRecord(null);
    form.setFieldsValue({
      name: '',
      webhook_url: '',
      events: ['alert.firing'],
      secret: '',
      enabled: true,
    });
    setModalOpen(true);
  }, [actionAccess.canCreateWebhook, form]);

  const openEditModal = useCallback((record: WebhookRecord) => {
    if (!actionAccess.canUpdateWebhook) {
      message.warning('当前会话缺少 Webhook 编辑权限');
      return;
    }
    setEditingRecord(record);
    form.setFieldsValue({
      name: record.name,
      webhook_url: record.webhookURL,
      events: record.events,
      secret: record.secret,
      enabled: record.enabled,
    });
    setModalOpen(true);
  }, [actionAccess.canUpdateWebhook, form]);

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = {
        name: String(values.name).trim(),
        config: {
          webhook_url: String(values.webhook_url).trim(),
          events: Array.isArray(values.events) ? values.events : [],
          secret: String(values.secret ?? '').trim(),
        },
        enabled: Boolean(values.enabled),
      };
      if (editingRecord) {
        await updateNotificationChannel(editingRecord.id, payload);
        message.success('Webhook 已更新');
      } else {
        await createNotificationChannel({ ...payload, type: 'webhook' });
        message.success('Webhook 已创建');
      }
      setModalOpen(false);
      setEditingRecord(null);
      await loadRecords();
    } catch (err) {
      if (err instanceof Error && err.message.includes('validateFields')) {
        return;
      }
      const msg = err instanceof Error ? err.message : '保存 Webhook 失败';
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  }, [editingRecord, form, loadRecords]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    if (!actionAccess.canDeleteWebhook) {
      message.warning('当前会话缺少 Webhook 删除权限');
      return;
    }
    try {
      await deleteNotificationChannel(deleteTarget.id);
      message.success('Webhook 已删除');
      setDeleteTarget(null);
      await loadRecords();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '删除 Webhook 失败';
      message.error(msg);
    }
  }, [actionAccess.canDeleteWebhook, deleteTarget, loadRecords]);

  const handleTest = useCallback(async (record: WebhookRecord) => {
    if (!actionAccess.canTestWebhook) {
      message.warning('当前会话缺少 Webhook 测试权限');
      return;
    }
    setTestingID(record.id);
    try {
      await testNotificationChannel(record.id);
      message.success('测试请求已发送');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '测试 Webhook 失败';
      message.error(msg);
    } finally {
      setTestingID(null);
    }
  }, [actionAccess.canTestWebhook]);

  const columns = useMemo<ColumnsType<WebhookRecord>>(() => [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (value: string) => <span style={{ fontWeight: 600 }}>{value}</span>,
    },
    {
      title: '目标地址',
      dataIndex: 'webhookURL',
      key: 'webhookURL',
      render: (value: string) => <code style={{ fontSize: 12 }}>{value || '—'}</code>,
    },
    {
      title: '事件',
      dataIndex: 'events',
      key: 'events',
      width: 260,
      render: (events: string[]) => (
        <Space size={[4, 4]} wrap>
          {events.length > 0 ? events.map((event) => <Tag key={event}>{event}</Tag>) : <span>未配置</span>}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (enabled: boolean) => <Tag color={enabled ? 'success' : 'default'}>{enabled ? '启用' : '停用'}</Tag>,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (value: number) => formatDateTime(value),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_, record) => (
        <Space>
          <Tooltip title={actionAccess.canUpdateWebhook ? '编辑 Webhook' : '当前会话缺少 notification.channel.update 能力'}>
            <span>
              <Button size="small" disabled={!actionAccess.canUpdateWebhook} onClick={() => openEditModal(record)}>编辑</Button>
            </span>
          </Tooltip>
          <Tooltip title={actionAccess.canTestWebhook ? '发送测试请求' : '当前会话缺少 notification.channel.test 能力'}>
            <span>
              <Button
                size="small"
                type="primary"
                ghost
                loading={testingID === record.id}
                disabled={!actionAccess.canTestWebhook}
                onClick={() => { void handleTest(record); }}
              >
                测试
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={actionAccess.canDeleteWebhook ? '删除 Webhook' : '当前会话缺少 notification.channel.delete 能力'}>
            <span>
              <Button danger size="small" disabled={!actionAccess.canDeleteWebhook} onClick={() => setDeleteTarget(record)}>删除</Button>
            </span>
          </Tooltip>
        </Space>
      ),
    },
  ], [actionAccess.canDeleteWebhook, actionAccess.canTestWebhook, actionAccess.canUpdateWebhook, handleTest, openEditModal, testingID]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', minHeight: 64, borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, background: isDark ? '#111722' : '#fff' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Webhook 管理</h2>
          <div style={{ fontSize: 13, color: isDark ? '#94a3b8' : '#64748b' }}>真实对接通知渠道，支持创建、更新、删除和测试请求</div>
        </div>
        <Space>
          <Button onClick={() => { window.location.hash = '#/help/faq'; }}>帮助</Button>
          <Button onClick={() => { void loadRecords(); }}>刷新</Button>
          <Tooltip title={actionAccess.canCreateWebhook ? undefined : '当前会话缺少 notification.channel.create 能力'}>
            <span>
              <Button type="primary" disabled={!actionAccess.canCreateWebhook} onClick={openCreateModal}>新建 Webhook</Button>
            </span>
          </Tooltip>
        </Space>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, padding: '0 24px' }}>
        <Input.Search value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索名称、地址或事件" allowClear />
        <Select value={statusFilter} onChange={(value) => setStatusFilter(value)} options={[{ label: '全部状态', value: 'all' }, { label: '启用', value: 'enabled' }, { label: '停用', value: 'disabled' }]} />
      </div>

      <div style={{ flex: 1, padding: '0 24px 24px', overflow: 'hidden' }}>
        <div style={{ height: '100%', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: 16, background: isDark ? '#0f172a' : '#fff', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: isDark ? '#94a3b8' : '#64748b' }}>正在加载 Webhook 列表...</div>
          ) : filteredRecords.length === 0 ? (
            <div style={{ paddingTop: 64 }}><Empty description="暂无 Webhook 配置" /></div>
          ) : (
            <Table<WebhookRecord>
              rowKey="id"
              columns={columns}
              dataSource={filteredRecords}
              pagination={{
                pageSize,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50'],
                onShowSizeChange: (_, size) => setPageSize(size),
              }}
              scroll={{ x: 1100 }}
            />
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        title={editingRecord ? '编辑 Webhook' : '新建 Webhook'}
        onCancel={() => setModalOpen(false)}
        onOk={() => { void handleSubmit(); }}
        okText={editingRecord ? '保存' : '创建'}
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={{ enabled: true, events: ['alert.firing'] }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：告警推送到工作流平台" />
          </Form.Item>
          <Form.Item name="webhook_url" label="Webhook URL" rules={[{ required: true, message: '请输入 Webhook URL' }]}>
            <Input placeholder="https://example.com/hooks/nexuslog" />
          </Form.Item>
          <Form.Item name="events" label="订阅事件">
            <Select mode="multiple" options={EVENT_OPTIONS} placeholder="选择需要推送的事件" />
          </Form.Item>
          <Form.Item name="secret" label="签名密钥">
            <Input.Password placeholder="留空则不附带签名头" />
          </Form.Item>
          <Form.Item name="enabled" label="启用状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal open={Boolean(deleteTarget)} title="删除 Webhook" onCancel={() => setDeleteTarget(null)} onOk={() => { void handleDelete(); }} okText="删除" okButtonProps={{ danger: true }}>
        <div>确认删除 Webhook “{deleteTarget?.name}” 吗？删除后将立即失效。</div>
      </Modal>
    </div>
  );
};

export default WebhookManagement;

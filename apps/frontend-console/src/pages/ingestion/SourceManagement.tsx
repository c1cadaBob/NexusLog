import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Input, Select, Table, Tag, Button, Card, Space, Modal, Form, message, Spin, Empty, InputNumber } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { COLORS } from '../../theme/tokens';
import {
  fetchPullSources,
  createPullSource,
  updatePullSource,
  deletePullSource,
  type PullSource,
  type CreatePullSourcePayload,
  type UpdatePullSourcePayload,
} from '../../api/ingest';

const PROTOCOL_OPTIONS = [
  { label: 'SSH', value: 'ssh' },
  { label: 'SFTP', value: 'sftp' },
  { label: 'HTTP', value: 'http' },
  { label: 'HTTPS', value: 'https' },
  { label: 'Syslog TCP', value: 'syslog_tcp' },
  { label: 'Syslog UDP', value: 'syslog_udp' },
  { label: 'TCP', value: 'tcp' },
];

function protocolToDisplayType(protocol: string): string {
  if (protocol === 'http' || protocol === 'https') return 'HTTP';
  if (protocol === 'syslog_tcp' || protocol === 'syslog_udp') return 'Syslog';
  if (protocol === 'ssh' || protocol === 'sftp') return 'File';
  return protocol;
}

function protocolToFilterGroup(protocol: string): string {
  if (protocol === 'http' || protocol === 'https') return 'HTTP';
  if (protocol === 'syslog_tcp' || protocol === 'syslog_udp') return 'Syslog';
  if (protocol === 'ssh' || protocol === 'sftp') return 'File';
  return 'other';
}

function getTypeIcon(protocol: string) {
  if (protocol === 'http' || protocol === 'https') return 'public';
  if (protocol === 'syslog_tcp' || protocol === 'syslog_udp') return 'dns';
  return 'description';
}

function statusToDisplay(status: string): string {
  if (status === 'active') return 'Running';
  if (status === 'paused') return 'Paused';
  if (status === 'disabled') return 'Disabled';
  return status;
}

function statusToTagColor(status: string): string {
  if (status === 'active') return 'success';
  if (status === 'paused') return 'warning';
  if (status === 'disabled') return 'default';
  return 'default';
}

const SourceManagement: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const [form] = Form.useForm();

  const [sources, setSources] = useState<PullSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<PullSource | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const storedPageSize = usePreferencesStore((s) => s.pageSizes['sourceManagement'] ?? 10);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeLocal(size);
    setStoredPageSize('sourceManagement', size);
  }, [setStoredPageSize]);

  const loadSources = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPullSources();
      setSources(data);
    } catch (err) {
      message.error('数据加载失败：' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const stats = useMemo(() => {
    const total = sources.length;
    const running = sources.filter((s) => s.status === 'active').length;
    const errors = sources.filter((s) => s.status === 'disabled').length;
    return { total, running, errors, totalVolume: '-' };
  }, [sources]);

  const filteredSources = useMemo(() => {
    let result = sources;
    if (activeFilter !== 'all') {
      result = result.filter((s) => protocolToFilterGroup(s.protocol) === activeFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.source_id.toLowerCase().includes(q) ||
          s.path.toLowerCase().includes(q)
      );
    }
    return result;
  }, [sources, activeFilter, searchQuery]);

  const openCreate = useCallback(() => {
    form.resetFields();
    form.setFieldsValue({
      protocol: 'http',
      port: 80,
      pull_interval_sec: 30,
      pull_timeout_sec: 30,
      status: 'active',
    });
    setCreateModalOpen(true);
  }, [form]);

  const openEdit = useCallback(
    (source: PullSource) => {
      setSelectedSource(source);
      form.setFieldsValue({
        name: source.name,
        host: source.host,
        port: source.port,
        protocol: source.protocol,
        path: source.path,
        auth: source.auth || '',
        agent_base_url: source.agent_base_url || '',
        pull_interval_sec: source.pull_interval_sec,
        pull_timeout_sec: source.pull_timeout_sec,
        status: source.status,
      });
      setEditModalOpen(true);
    },
    [form]
  );

  const handleCreate = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const payload: CreatePullSourcePayload = {
        name: values.name,
        host: values.host,
        port: values.port,
        protocol: values.protocol,
        path: values.path,
        auth: values.auth,
        agent_base_url: values.agent_base_url,
        pull_interval_sec: values.pull_interval_sec,
        pull_timeout_sec: values.pull_timeout_sec,
        status: values.status ?? 'active',
      };
      setSubmitting(true);
      await createPullSource(payload);
      setCreateModalOpen(false);
      message.success(`采集源 "${values.name}" 已创建`);
      loadSources();
    } catch (err) {
      message.error('创建失败：' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  }, [form, loadSources]);

  const handleUpdate = useCallback(async () => {
    if (!selectedSource) return;
    try {
      const values = await form.validateFields();
      const payload: UpdatePullSourcePayload = {
        name: values.name,
        host: values.host,
        port: values.port,
        protocol: values.protocol,
        path: values.path,
        auth: values.auth,
        agent_base_url: values.agent_base_url,
        pull_interval_sec: values.pull_interval_sec,
        pull_timeout_sec: values.pull_timeout_sec,
        status: values.status,
      };
      setSubmitting(true);
      await updatePullSource(selectedSource.source_id, payload);
      setEditModalOpen(false);
      message.success(`采集源 "${values.name}" 已更新`);
      loadSources();
    } catch (err) {
      message.error('更新失败：' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  }, [form, selectedSource, loadSources]);

  const handleDelete = useCallback(async () => {
    if (!selectedSource) return;
    try {
      setSubmitting(true);
      await deletePullSource(selectedSource.source_id);
      setDeleteModalOpen(false);
      message.success(`采集源 "${selectedSource.name}" 已禁用`);
      setSelectedSource(null);
      loadSources();
    } catch (err) {
      message.error('禁用失败：' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  }, [selectedSource, loadSources]);

  const handleToggleStatus = useCallback(
    async (source: PullSource) => {
      const nextStatus = source.status === 'active' ? 'paused' : 'active';
      try {
        await updatePullSource(source.source_id, { status: nextStatus });
        message.success(`采集源已${nextStatus === 'active' ? '启用' : '暂停'}`);
        loadSources();
      } catch (err) {
        message.error('操作失败：' + (err instanceof Error ? err.message : String(err)));
      }
    },
    [loadSources]
  );

  const columns: ColumnsType<PullSource> = [
    {
      title: '采集源名称 Source Name',
      key: 'name',
      width: '25%',
      render: (_, source) => (
        <div>
          <div style={{ fontWeight: 500 }}>{source.name}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>ID: {source.source_id}</div>
        </div>
      ),
    },
    {
      title: '类型 Type',
      key: 'type',
      width: '15%',
      render: (_, source) => {
        const displayType = protocolToDisplayType(source.protocol);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#94a3b8' }}>
              {getTypeIcon(source.protocol)}
            </span>
            <span>{displayType}</span>
          </div>
        );
      },
    },
    {
      title: '路径 Path',
      dataIndex: 'path',
      key: 'path',
      width: '20%',
      render: (path: string) => (
        <code
          style={{
            fontSize: 12,
            padding: '2px 8px',
            borderRadius: 4,
            fontFamily: 'JetBrains Mono, monospace',
            background: isDark ? '#0f172a' : '#f1f5f9',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          }}
        >
          {path}
        </code>
      ),
    },
    {
      title: '主机 Host',
      key: 'host',
      width: '15%',
      render: (_, source) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
          {source.host}:{source.port}
        </span>
      ),
    },
    {
      title: '状态 Status',
      key: 'status',
      width: '10%',
      render: (_, source) => (
        <Tag
          color={statusToTagColor(source.status)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          {source.status === 'active' && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: COLORS.success,
                display: 'inline-block',
              }}
            />
          )}
          {statusToDisplay(source.status)}
        </Tag>
      ),
    },
    {
      title: '操作 Actions',
      key: 'actions',
      width: '15%',
      align: 'right',
      render: (_, source) => (
        <Space size={4}>
          {source.status !== 'disabled' && (
            source.status === 'active' ? (
              <Button
                type="text"
                size="small"
                onClick={() => handleToggleStatus(source)}
                icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.warning }}>pause_circle</span>}
              />
            ) : (
              <Button
                type="text"
                size="small"
                onClick={() => handleToggleStatus(source)}
                icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.success }}>play_circle</span>}
              />
            )
          )}
          <Button
            type="text"
            size="small"
            onClick={() => openEdit(source)}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>}
          />
          {source.status !== 'disabled' && (
            <Button
              type="text"
              size="small"
              danger
              onClick={() => {
                setSelectedSource(source);
                setDeleteModalOpen(true);
              }}
              icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>}
            />
          )}
        </Space>
      ),
    },
  ];

  const renderForm = (isEdit: boolean) => (
    <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
      <Form.Item name="name" label="数据源名称" rules={[{ required: true, message: '请输入数据源名称' }, { min: 2, message: '名称至少需要2个字符' }]}>
        <Input placeholder="例如: Nginx-Access-Logs-Prod" />
      </Form.Item>
      <Form.Item name="host" label="主机地址" rules={[{ required: true, message: '请输入主机地址' }]}>
        <Input placeholder="例如: 10.0.0.1 或 agent.example.com" />
      </Form.Item>
      <Form.Item name="port" label="端口" rules={[{ required: true, message: '请输入端口' }]}>
        <InputNumber min={1} max={65535} style={{ width: '100%' }} placeholder="80" />
      </Form.Item>
      <Form.Item name="protocol" label="协议" rules={[{ required: true }]}>
        <Select options={PROTOCOL_OPTIONS} />
      </Form.Item>
      <Form.Item name="path" label="采集路径" rules={[{ required: true, message: '请输入采集路径' }]}>
        <Input placeholder="例如: /var/log/*.log 或 /api/logs" />
      </Form.Item>
      <Form.Item name="auth" label="认证引用">
        <Input placeholder="可选：认证密钥引用" />
      </Form.Item>
      <Form.Item name="agent_base_url" label="Agent 基础 URL">
        <Input placeholder="可选：例如 http://10.0.0.1:16666/" />
      </Form.Item>
      <Form.Item name="pull_interval_sec" label="拉取间隔 (秒)">
        <InputNumber min={1} max={3600} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="pull_timeout_sec" label="拉取超时 (秒)">
        <InputNumber min={1} max={300} style={{ width: '100%' }} />
      </Form.Item>
      {isEdit && (
        <Form.Item name="status" label="状态">
          <Select
            options={[
              { label: '运行中', value: 'active' },
              { label: '已暂停', value: 'paused' },
              { label: '已禁用', value: 'disabled' },
            ]}
          />
        </Form.Item>
      )}
    </Form>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>采集源管理 Source Management</h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#94a3b8', maxWidth: 600 }}>
            管理所有日志采集来源，监控数据接入状态与健康指标。支持 SSH、HTTP、Syslog 等多种协议接入。
          </p>
        </div>
        <Button type="primary" icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>} onClick={openCreate}>
          新建采集源 Add Source
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <Card size="small" styles={{ body: { padding: 16 } }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Total Sources</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.total}</div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${COLORS.info}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.info }}>dns</span>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: 16 } }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Running</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.success }}>{stats.running}</div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${COLORS.success}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.success }}>check_circle</span>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: 16 } }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Disabled</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.danger }}>{stats.errors}</div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${COLORS.danger}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.danger }}>error</span>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: 16 } }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Total Volume</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.totalVolume}</div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${COLORS.purple}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.purple }}>storage</span>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Space>
          {['all', 'File', 'HTTP', 'Syslog'].map((type) => (
            <Button key={type} type={activeFilter === type ? 'primary' : 'default'} size="small" onClick={() => setActiveFilter(type)}>
              {type === 'all' ? '全部 All' : type === 'File' ? 'File / Log' : type}
            </Button>
          ))}
        </Space>
        <Space>
          <Input
            prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: '#94a3b8' }}>search</span>}
            placeholder="搜索数据源..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Button type="text" icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>refresh</span>} onClick={loadSources} />
        </Space>
      </div>

      <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' } }}>
        <Spin spinning={loading}>
          <div style={{ flex: 1, overflow: 'auto', minHeight: 200 }}>
            {!loading && filteredSources.length === 0 ? (
              <Empty description="暂无采集源数据" style={{ padding: 48 }} />
            ) : (
              <Table<PullSource>
                rowKey="source_id"
                columns={columns}
                dataSource={filteredSources}
                size="middle"
                loading={false}
                pagination={{
                  pageSize,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条数据源`,
                  onShowSizeChange: (_, size) => setPageSize(size),
                }}
                scroll={{ x: 900 }}
              />
            )}
          </div>
        </Spin>
      </Card>

      <Modal
        open={createModalOpen}
        title="新建采集源"
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreate}
        okText="创建"
        cancelText="取消"
        width={560}
        destroyOnClose
        confirmLoading={submitting}
      >
        {renderForm(false)}
      </Modal>

      <Modal
        open={editModalOpen}
        title="编辑采集源"
        onCancel={() => setEditModalOpen(false)}
        onOk={handleUpdate}
        okText="保存"
        cancelText="取消"
        width={560}
        destroyOnClose
        confirmLoading={submitting}
      >
        {renderForm(true)}
      </Modal>

      <Modal
        open={deleteModalOpen}
        title="确认禁用"
        onCancel={() => setDeleteModalOpen(false)}
        onOk={handleDelete}
        okText="禁用"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        confirmLoading={submitting}
      >
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: COLORS.danger, display: 'block', marginBottom: 16 }}>warning</span>
          <p>
            确定要禁用数据源 <span style={{ fontWeight: 600 }}>{selectedSource?.name}</span> 吗？
          </p>
          <p style={{ fontSize: 13, color: '#94a3b8' }}>禁用后该采集源将停止拉取日志。</p>
        </div>
      </Modal>
    </div>
  );
};

export default SourceManagement;

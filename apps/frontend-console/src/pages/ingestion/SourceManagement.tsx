import React, { useState, useMemo, useCallback } from 'react';
import { Input, Select, Table, Tag, Button, Card, Space, Modal, Form, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { COLORS } from '../../theme/tokens';
import type { DataSource, DataSourceFormData } from '../../types/ingestion';

// ============================================================================
// 模拟数据
// ============================================================================

const initialSources: DataSource[] = [
  { id: 'src-8f2k9x', name: 'Nginx-Access-Logs-Prod', type: 'File', index: 'idx_nginx_prod_2023', volume: '45.2 GB', status: 'Running', health: 'Healthy', createdAt: '2025-12-01', description: 'Nginx 生产环境访问日志' },
  { id: 'src-km39v2', name: 'Kafka-Order-Topic', type: 'Kafka', index: 'idx_orders_raw', volume: '128.5 GB', status: 'Running', health: 'Healthy', createdAt: '2025-11-15', description: 'Kafka 订单主题日志' },
  { id: 'src-fw772b', name: 'Syslog-Firewall-Main', type: 'Syslog', index: 'idx_fw_logs', volume: '12.1 GB', status: 'Error', health: 'Error', createdAt: '2025-10-20', description: '防火墙系统日志' },
  { id: 'src-trc92x', name: 'App-Error-Trace', type: 'HTTP', index: 'idx_app_errors', volume: '2.4 GB', status: 'Running', health: 'Healthy', createdAt: '2025-09-10', description: '应用错误追踪日志' },
  { id: 'src-db001z', name: 'Legacy-DB-Audit', type: 'File', index: 'idx_db_audit_arch', volume: '0 B', status: 'Paused', health: 'Neutral', createdAt: '2025-08-05', description: '数据库审计日志（已归档）' },
];

const typeOptions = [
  { label: 'Kafka', value: 'Kafka' },
  { label: 'File / Log', value: 'File' },
  { label: 'HTTP', value: 'HTTP' },
  { label: 'Syslog', value: 'Syslog' },
];

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'Kafka': return 'hub';
    case 'HTTP': return 'public';
    case 'Syslog': return 'dns';
    default: return 'description';
  }
};

// ============================================================================
// 组件
// ============================================================================

const SourceManagement: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const [form] = Form.useForm();

  // 状态
  const [sources, setSources] = useState<DataSource[]>(initialSources);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null);

  // 分页
  const storedPageSize = usePreferencesStore((s) => s.pageSizes['sourceManagement'] ?? 10);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeLocal(size);
    setStoredPageSize('sourceManagement', size);
  }, [setStoredPageSize]);

  // 统计
  const stats = useMemo(() => {
    const total = sources.length;
    const running = sources.filter(s => s.status === 'Running').length;
    const errors = sources.filter(s => s.health === 'Error').length;
    const totalVolume = sources.reduce((acc, s) => {
      const match = s.volume.match(/^([\d.]+)/);
      return acc + (match ? parseFloat(match[1]) : 0);
    }, 0);
    return { total, running, errors, totalVolume: `${totalVolume.toFixed(1)} GB` };
  }, [sources]);

  // 过滤
  const filteredSources = useMemo(() => {
    let result = sources;
    if (activeFilter !== 'all') result = result.filter(s => s.type === activeFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || s.index.toLowerCase().includes(q));
    }
    return result;
  }, [sources, activeFilter, searchQuery]);

  // 打开创建
  const openCreate = useCallback(() => {
    form.resetFields();
    setCreateModalOpen(true);
  }, [form]);

  // 打开编辑
  const openEdit = useCallback((source: DataSource) => {
    setSelectedSource(source);
    form.setFieldsValue({ name: source.name, type: source.type, index: source.index, description: source.description || '' });
    setEditModalOpen(true);
  }, [form]);

  // 创建
  const handleCreate = useCallback(() => {
    form.validateFields().then((values: DataSourceFormData) => {
      const newSource: DataSource = {
        id: `src-${Math.random().toString(36).substr(2, 6)}`,
        name: values.name, type: values.type, index: values.index,
        volume: '0 B', status: 'Running', health: 'Healthy',
        createdAt: new Date().toISOString().split('T')[0], description: values.description,
      };
      setSources(prev => [newSource, ...prev]);
      setCreateModalOpen(false);
      message.success(`采集源 "${values.name}" 已创建`);
    });
  }, [form]);

  // 更新
  const handleUpdate = useCallback(() => {
    if (!selectedSource) return;
    form.validateFields().then((values: DataSourceFormData) => {
      setSources(prev => prev.map(s => s.id === selectedSource.id
        ? { ...s, name: values.name, type: values.type, index: values.index, description: values.description } : s
      ));
      setEditModalOpen(false);
      message.success(`采集源 "${values.name}" 已更新`);
    });
  }, [form, selectedSource]);

  // 删除
  const handleDelete = useCallback(() => {
    if (!selectedSource) return;
    setSources(prev => prev.filter(s => s.id !== selectedSource.id));
    setDeleteModalOpen(false);
    message.success(`采集源 "${selectedSource.name}" 已删除`);
    setSelectedSource(null);
  }, [selectedSource]);

  // 切换状态
  const handleToggleStatus = useCallback((source: DataSource) => {
    setSources(prev => prev.map(s =>
      s.id === source.id ? { ...s, status: s.status === 'Running' ? 'Paused' : 'Running' } : s
    ));
  }, []);

  // 表格列
  const columns: ColumnsType<DataSource> = [
    {
      title: '采集源名称 Source Name',
      key: 'name',
      width: '25%',
      render: (_, source) => (
        <div>
          <div style={{ fontWeight: 500 }}>{source.name}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>ID: {source.id}</div>
        </div>
      ),
    },
    {
      title: '类型 Type',
      dataIndex: 'type',
      key: 'type',
      width: '15%',
      render: (type: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#94a3b8' }}>{getTypeIcon(type)}</span>
          <span>{type}</span>
        </div>
      ),
    },
    {
      title: '目标索引 Target Index',
      dataIndex: 'index',
      key: 'index',
      width: '20%',
      render: (index: string) => (
        <code style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace',
          background: isDark ? '#0f172a' : '#f1f5f9', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        }}>{index}</code>
      ),
    },
    {
      title: '24h数据量 Volume',
      dataIndex: 'volume',
      key: 'volume',
      width: '15%',
      render: (volume: string, source) => (
        <div>
          <div style={{ fontWeight: 500 }}>{volume}</div>
          <div style={{ width: 96, height: 4, borderRadius: 2, marginTop: 6,
            background: isDark ? '#334155' : '#e2e8f0',
          }}>
            <div style={{
              height: '100%', borderRadius: 2, background: COLORS.primary,
              width: source.type === 'Kafka' ? '85%' : source.type === 'HTTP' ? '5%' : source.type === 'Syslog' ? '12%' : source.status === 'Paused' ? '0%' : '45%',
            }} />
          </div>
        </div>
      ),
    },
    {
      title: '状态 Status',
      key: 'status',
      width: '10%',
      render: (_, source) => {
        const color = source.health === 'Healthy' ? COLORS.success : source.health === 'Error' ? COLORS.danger : COLORS.warning;
        return (
          <Tag color={source.health === 'Healthy' ? 'success' : source.health === 'Error' ? 'error' : 'warning'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {source.health === 'Healthy' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />}
            {source.status}
          </Tag>
        );
      },
    },
    {
      title: '操作 Actions',
      key: 'actions',
      width: '15%',
      align: 'right',
      render: (_, source) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>monitoring</span>} />
          {source.status === 'Running' ? (
            <Button type="text" size="small" onClick={() => handleToggleStatus(source)}
              icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.warning }}>pause_circle</span>} />
          ) : (
            <Button type="text" size="small" onClick={() => handleToggleStatus(source)}
              icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.success }}>play_circle</span>} />
          )}
          <Button type="text" size="small" onClick={() => openEdit(source)}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>} />
          <Button type="text" size="small" danger onClick={() => { setSelectedSource(source); setDeleteModalOpen(true); }}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>} />
        </Space>
      ),
    },
  ];

  // 表单渲染
  const renderForm = () => (
    <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
      <Form.Item name="name" label="数据源名称" rules={[{ required: true, message: '请输入数据源名称' }, { min: 3, message: '名称至少需要3个字符' }]}>
        <Input placeholder="例如: Nginx-Access-Logs-Prod" />
      </Form.Item>
      <Form.Item name="type" label="数据源类型" initialValue="Kafka" rules={[{ required: true }]}>
        <Select options={typeOptions} />
      </Form.Item>
      <Form.Item name="index" label="目标索引" rules={[
        { required: true, message: '请输入目标索引' },
        { pattern: /^[a-z][a-z0-9_]*$/, message: '索引名称必须以小写字母开头，只能包含小写字母、数字和下划线' },
      ]}>
        <Input placeholder="例如: idx_nginx_prod" />
      </Form.Item>
      <Form.Item name="description" label="描述">
        <Input.TextArea placeholder="可选：描述此数据源的用途" rows={3} />
      </Form.Item>
    </Form>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>采集源管理 Source Management</h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#94a3b8', maxWidth: 600 }}>
            管理所有日志采集来源，监控数据接入状态与健康指标。支持 Kafka, Filebeat, Syslog 等多种协议接入。
          </p>
        </div>
        <Button type="primary" icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>} onClick={openCreate}>
          新建采集源 Add Source
        </Button>
      </div>

      {/* 统计卡片 */}
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
              <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Errors</div>
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

      {/* 过滤器 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Space>
          {['all', 'Kafka', 'File', 'HTTP', 'Syslog'].map(type => (
            <Button key={type} type={activeFilter === type ? 'primary' : 'default'} size="small"
              onClick={() => setActiveFilter(type)}>
              {type === 'all' ? '全部 All' : type === 'File' ? 'File / Log' : type}
            </Button>
          ))}
        </Space>
        <Space>
          <Input prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: '#94a3b8' }}>search</span>}
            placeholder="搜索数据源..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 200 }} allowClear />
          <Button type="text" icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>refresh</span>} />
          <Button type="text" icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>view_column</span>} />
        </Space>
      </div>

      {/* 表格 */}
      <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' } }}>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Table<DataSource>
            rowKey="id" columns={columns} dataSource={filteredSources} size="middle"
            pagination={{ pageSize, showSizeChanger: true, showTotal: (total) => `共 ${total} 条数据源`,
              onShowSizeChange: (_, size) => setPageSize(size) }}
            scroll={{ x: 900 }}
          />
        </div>
      </Card>

      {/* 创建模态框 */}
      <Modal open={createModalOpen} title="新建采集源" onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreate} okText="创建" cancelText="取消" width={560} destroyOnClose>
        {renderForm()}
      </Modal>

      {/* 编辑模态框 */}
      <Modal open={editModalOpen} title="编辑采集源" onCancel={() => setEditModalOpen(false)}
        onOk={handleUpdate} okText="保存" cancelText="取消" width={560} destroyOnClose>
        {renderForm()}
      </Modal>

      {/* 删除确认 */}
      <Modal open={deleteModalOpen} title="确认删除" onCancel={() => setDeleteModalOpen(false)}
        onOk={handleDelete} okText="删除" okButtonProps={{ danger: true }} cancelText="取消">
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: COLORS.danger, display: 'block', marginBottom: 16 }}>warning</span>
          <p>确定要删除数据源 <span style={{ fontWeight: 600 }}>{selectedSource?.name}</span> 吗？</p>
          <p style={{ fontSize: 13, color: '#94a3b8' }}>此操作不可撤销，删除后相关数据将无法恢复。</p>
        </div>
      </Modal>
    </div>
  );
};

export default SourceManagement;

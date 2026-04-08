import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Empty, Form, Input, InputNumber, Modal, Select, Space, Spin, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import {
  createPullSource,
  deletePullSource,
  fetchIngestAgents,
  fetchPullSourceStatus,
  fetchPullSources,
  runPullTask,
  updatePullSource,
  type CreatePullSourcePayload,
  type IngestAgentItem,
  type PullSource,
  type PullSourceStatusResponse,
  type UpdatePullSourcePayload,
} from '../../api/ingest';
import { hasAnyCapability } from '../../auth/routeAuthorization';
import PullPackageHistoryDrawer from './PullPackageHistoryDrawer';
import PullTaskHistoryDrawer from './PullTaskHistoryDrawer';
import { useAuthStore } from '../../stores/authStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { COLORS } from '../../theme/tokens';

const STATUS_FILTER_OPTIONS = [
  { label: '全部状态', value: 'all' },
  { label: '健康', value: 'healthy' },
  { label: '运行中', value: 'running' },
  { label: '启用中', value: 'active' },
  { label: '已暂停', value: 'paused' },
  { label: '已禁用', value: 'disabled' },
  { label: '离线', value: 'offline' },
  { label: '错误', value: 'error' },
];

const CONFIG_STATUS_OPTIONS = [
  { label: '启用中', value: 'active' },
  { label: '已暂停', value: 'paused' },
  { label: '已禁用', value: 'disabled' },
];

const PROTOCOL_OPTIONS = [
  { label: 'HTTP Pull', value: 'http' },
  { label: 'HTTPS Pull', value: 'https' },
  { label: 'Syslog UDP', value: 'syslog_udp' },
  { label: 'Syslog TCP', value: 'syslog_tcp' },
  { label: 'TCP', value: 'tcp' },
];

function parseHostPort(agentBaseUrl?: string) {
  if (!agentBaseUrl) return { host: '', port: 9091 };
  try {
    const url = new URL(agentBaseUrl);
    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
    };
  } catch {
    return { host: '', port: 9091 };
  }
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN');
}

function formatNumber(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return value.toLocaleString('zh-CN');
}

function formatBytes(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function getConfiguredStatusMeta(status: string) {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'active') return { label: '启用中', color: 'success', dot: COLORS.success };
  if (normalized === 'paused') return { label: '已暂停', color: 'warning', dot: COLORS.warning };
  return { label: '已禁用', color: 'default', dot: '#94a3b8' };
}

function getRuntimeStatusMeta(status?: string) {
  const normalized = String(status ?? '').toLowerCase();
  if (!normalized) {
    return { label: '未上报', color: 'default', dot: '#94a3b8' };
  }
  switch (normalized) {
    case 'healthy':
      return { label: '健康', color: 'success', dot: COLORS.success };
    case 'running':
      return { label: '运行中', color: 'processing', dot: COLORS.info };
    case 'paused':
      return { label: '暂停', color: 'warning', dot: COLORS.warning };
    case 'disabled':
      return { label: '禁用', color: 'default', dot: '#94a3b8' };
    case 'offline':
      return { label: '离线', color: 'error', dot: COLORS.danger };
    default:
      return { label: '错误', color: 'error', dot: COLORS.danger };
  }
}

function getTaskStatusMeta(status?: string) {
  const normalized = String(status ?? '').toLowerCase();
  switch (normalized) {
    case 'success':
    case 'succeeded':
    case 'done':
    case 'completed':
      return { label: '成功', color: 'success' as const };
    case 'running':
    case 'processing':
      return { label: '运行中', color: 'processing' as const };
    case 'queued':
    case 'scheduled':
    case 'pending':
      return { label: '待执行', color: 'default' as const };
    case 'failed':
    case 'error':
      return { label: '失败', color: 'error' as const };
    default:
      return { label: status || '未知', color: 'default' as const };
  }
}

function getPackageStatusMeta(status?: string) {
  const normalized = String(status ?? '').toLowerCase();
  switch (normalized) {
    case 'acked':
    case 'ack':
      return { label: '已确认', color: 'success' as const };
    case 'nacked':
    case 'nack':
      return { label: '回执失败', color: 'error' as const };
    case 'created':
    case 'sent':
    case 'running':
      return { label: '处理中', color: 'processing' as const };
    default:
      return { label: status || '未知', color: 'default' as const };
  }
}

function renderPathPreview(value?: string, maxItems = 2) {
  const paths = String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!paths.length) {
    return <span style={{ color: '#94a3b8', fontSize: 12 }}>-</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {paths.slice(0, maxItems).map((path) => (
        <Typography.Text
          key={path}
          code
          style={{ margin: 0, fontSize: 12, whiteSpace: 'normal', wordBreak: 'break-all' }}
        >
          {path}
        </Typography.Text>
      ))}
      {paths.length > maxItems ? (
        <span style={{ fontSize: 12, color: '#94a3b8' }}>还有 {paths.length - maxItems} 个路径...</span>
      ) : null}
    </div>
  );
}

const SourceManagement: React.FC = () => {
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm();
  const [sources, setSources] = useState<PullSource[]>([]);
  const [agents, setAgents] = useState<IngestAgentItem[]>([]);
  const [statusResponse, setStatusResponse] = useState<PullSourceStatusResponse | null>(null);
  const [runtimeStatusError, setRuntimeStatusError] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<PullSource | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [runningSourceIds, setRunningSourceIds] = useState<string[]>([]);
  const [taskHistorySource, setTaskHistorySource] = useState<PullSource | null>(null);
  const [packageHistorySource, setPackageHistorySource] = useState<PullSource | null>(null);

  const capabilities = useAuthStore((s) => s.capabilities);
  const canRunPullTask = useMemo(() => hasAnyCapability(capabilities, ['ingest.task.run']), [capabilities]);
  const canReadPullTask = useMemo(() => hasAnyCapability(capabilities, ['ingest.task.read']), [capabilities]);
  const canReadPullPackage = useMemo(() => hasAnyCapability(capabilities, ['ingest.package.read']), [capabilities]);

  const storedPageSize = usePreferencesStore((s) => s.pageSizes.sourceManagement ?? 10);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeLocal(size);
    setStoredPageSize('sourceManagement', size);
  }, [setStoredPageSize]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setRuntimeStatusError('');
    try {
      const [sourceResult, agentResult, statusResult] = await Promise.allSettled([
        fetchPullSources(),
        fetchIngestAgents(),
        fetchPullSourceStatus('1h'),
      ]);

      const errors: string[] = [];

      if (sourceResult.status === 'fulfilled') {
        setSources(sourceResult.value);
      } else {
        errors.push(`采集源配置：${sourceResult.reason instanceof Error ? sourceResult.reason.message : String(sourceResult.reason)}`);
        setSources([]);
      }

      if (agentResult.status === 'fulfilled') {
        setAgents(agentResult.value);
      } else {
        errors.push(`Agent：${agentResult.reason instanceof Error ? agentResult.reason.message : String(agentResult.reason)}`);
        setAgents([]);
      }

      if (statusResult.status === 'fulfilled') {
        setStatusResponse(statusResult.value);
      } else {
        const reason = statusResult.reason instanceof Error ? statusResult.reason.message : String(statusResult.reason);
        setStatusResponse(null);
        setRuntimeStatusError(reason);
      }

      if (errors.length > 0) {
        messageApi.error(`采集与接入加载失败：${errors.join('；')}`);
      }
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const runtimeStatusMap = useMemo(() => new Map((statusResponse?.items ?? []).map((item) => [item.source_id, item])), [statusResponse]);

  const filteredSources = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return sources.filter((source) => {
      const runtime = runtimeStatusMap.get(source.source_id);
      if (statusFilter !== 'all') {
        if (source.status !== statusFilter && String(runtime?.runtime_status ?? '').toLowerCase() !== statusFilter) return false;
      }
      if (!normalizedQuery) return true;
      const haystacks = [
        source.name,
        source.source_id,
        source.host,
        source.protocol,
        source.path,
        source.agent_base_url,
        runtime?.agent_hostname,
        runtime?.agent_id,
        runtime?.error_message,
        runtime?.last_task?.status,
        runtime?.last_package?.status,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystacks.includes(normalizedQuery);
    });
  }, [runtimeStatusMap, searchQuery, sources, statusFilter]);

  const stats = useMemo(() => ({
    total: sources.length,
    active: sources.filter((item) => item.status === 'active').length,
    paused: sources.filter((item) => item.status === 'paused').length,
    disabled: sources.filter((item) => item.status === 'disabled').length,
    healthy: statusResponse?.summary.healthy_sources ?? 0,
    onlineAgents: statusResponse?.summary.online_agents ?? 0,
    recentPackageCount: statusResponse?.summary.recent_package_count ?? 0,
    recentRecordCount: statusResponse?.summary.recent_record_count ?? 0,
  }), [sources, statusResponse]);

  const agentMap = useMemo(() => new Map(agents.map((agent) => [agent.agent_base_url ?? '', agent])), [agents]);
  const agentOptions = useMemo(() => agents
    .filter((agent) => agent.agent_base_url)
    .map((agent) => ({
      label: `${agent.hostname || agent.host || agent.agent_id} (${agent.status})`,
      value: agent.agent_base_url as string,
    })), [agents]);

  const openCreateModal = useCallback(() => {
    setModalMode('create');
    setSelectedSource(null);
    form.resetFields();
    form.setFieldsValue({
      protocol: 'http',
      path: '/var/log/*.log',
      pull_interval_sec: 30,
      pull_timeout_sec: 30,
      status: 'active',
    });
    setModalOpen(true);
  }, [form]);

  const openEditModal = useCallback((source: PullSource) => {
    setModalMode('edit');
    setSelectedSource(source);
    form.setFieldsValue({
      name: source.name,
      host: source.host,
      port: source.port,
      protocol: source.protocol,
      path: source.path,
      auth: source.auth,
      agent_base_url: source.agent_base_url,
      pull_interval_sec: source.pull_interval_sec,
      pull_timeout_sec: source.pull_timeout_sec,
      status: source.status,
    });
    setModalOpen(true);
  }, [form]);

  const handleAgentSelect = useCallback((value: string) => {
    const parsed = parseHostPort(value);
    form.setFieldsValue({
      agent_base_url: value,
      host: parsed.host,
      port: parsed.port,
    });
  }, [form]);

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (modalMode === 'create') {
        const payload: CreatePullSourcePayload = {
          name: values.name,
          host: values.host,
          port: values.port,
          protocol: values.protocol,
          path: values.path,
          auth: values.auth || 'agent-key',
          agent_base_url: values.agent_base_url,
          pull_interval_sec: values.pull_interval_sec,
          pull_timeout_sec: values.pull_timeout_sec,
          key_ref: 'active',
          status: values.status,
        };
        await createPullSource(payload);
        messageApi.success('采集源已创建');
      } else if (selectedSource) {
        const payload: UpdatePullSourcePayload = {
          name: values.name,
          host: values.host,
          port: values.port,
          protocol: values.protocol,
          path: values.path,
          auth: values.auth || 'agent-key',
          agent_base_url: values.agent_base_url,
          pull_interval_sec: values.pull_interval_sec,
          pull_timeout_sec: values.pull_timeout_sec,
          status: values.status,
        };
        await updatePullSource(selectedSource.source_id, payload);
        messageApi.success('采集源已更新');
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      messageApi.error(`保存失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }, [form, loadData, messageApi, modalMode, selectedSource]);

  const handleDisable = useCallback(async (source: PullSource) => {
    try {
      await deletePullSource(source.source_id);
      messageApi.success(`已禁用采集源：${source.name}`);
      loadData();
    } catch (err) {
      messageApi.error(`禁用失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }, [loadData, messageApi]);

  const handleRunNow = useCallback(async (source: PullSource) => {
    setRunningSourceIds((current) => (current.includes(source.source_id) ? current : [...current, source.source_id]));
    try {
      const result = await runPullTask(source.source_id);
      messageApi.success(`已提交采集任务：${source.name} · ${result.task_id}`);
      window.setTimeout(() => {
        void loadData();
      }, 1200);
    } catch (err) {
      messageApi.error(`执行采集失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunningSourceIds((current) => current.filter((item) => item !== source.source_id));
    }
  }, [loadData, messageApi]);

  const columns: ColumnsType<PullSource> = [
    {
      title: '采集源',
      key: 'source',
      width: 260,
      render: (_, source) => (
        <div>
          <div style={{ fontWeight: 600 }}>{source.name}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{source.protocol.toUpperCase()} · {source.source_id}</div>
        </div>
      ),
    },
    {
      title: '绑定 Agent',
      key: 'agent',
      width: 260,
      render: (_, source) => {
        const agent = agentMap.get(source.agent_base_url ?? '');
        const runtime = runtimeStatusMap.get(source.source_id);
        return (
          <div>
            <div>{runtime?.agent_hostname || agent?.hostname || agent?.host || source.host || '-'}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>{runtime?.agent_id || source.agent_base_url || '-'}</div>
          </div>
        );
      },
    },
    {
      title: '采集路径',
      dataIndex: 'path',
      key: 'path',
      width: 320,
      render: (value: string) => renderPathPreview(value),
    },
    {
      title: '拉取参数',
      key: 'settings',
      width: 160,
      render: (_, source) => (
        <div style={{ fontSize: 12 }}>
          <div>间隔：{source.pull_interval_sec}s</div>
          <div>超时：{source.pull_timeout_sec}s</div>
        </div>
      ),
    },
    {
      title: '运行状态',
      key: 'runtime_status',
      width: 120,
      render: (_, source) => {
        const runtime = runtimeStatusMap.get(source.source_id);
        const meta = getRuntimeStatusMeta(runtime?.runtime_status);
        return (
          <Tag color={meta.color} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot, display: 'inline-block' }} />
            {meta.label}
          </Tag>
        );
      },
    },
    {
      title: '配置状态',
      key: 'configured_status',
      width: 120,
      render: (_, source) => {
        const meta = getConfiguredStatusMeta(source.status);
        return (
          <Tag color={meta.color} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot, display: 'inline-block' }} />
            {meta.label}
          </Tag>
        );
      },
    },
    {
      title: '最近拉取事件',
      key: 'latest_event',
      width: 280,
      render: (_, source) => {
        const runtime = runtimeStatusMap.get(source.source_id);
        if (!runtime) {
          return <span style={{ fontSize: 12, color: '#94a3b8' }}>暂无运行态数据</span>;
        }
        const taskMeta = getTaskStatusMeta(runtime.last_task?.status);
        const packageMeta = getPackageStatusMeta(runtime.last_package?.status);
        const taskTime = runtime.last_task?.finished_at || runtime.last_task?.started_at || runtime.last_task?.scheduled_at;
        const packageTime = runtime.last_package?.acked_at || runtime.last_package?.created_at;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ color: '#94a3b8' }}>任务</span>
              <Tag color={taskMeta.color} style={{ marginInlineEnd: 0 }}>{taskMeta.label}</Tag>
              <span style={{ color: '#94a3b8' }}>{formatDateTime(taskTime)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ color: '#94a3b8' }}>资源包</span>
              <Tag color={packageMeta.color} style={{ marginInlineEnd: 0 }}>{packageMeta.label}</Tag>
              <span>{formatNumber(runtime.last_package?.record_count)} 条</span>
              <span>{formatBytes(runtime.last_package?.size_bytes)}</span>
              <span style={{ color: '#94a3b8' }}>{formatDateTime(packageTime)}</span>
            </div>
            {runtime.error_message ? (
              <Typography.Text type="danger" ellipsis={{ tooltip: runtime.error_message }} style={{ maxWidth: 240 }}>
                {runtime.error_message}
              </Typography.Text>
            ) : null}
          </div>
        );
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (value: string, source) => {
        const runtime = runtimeStatusMap.get(source.source_id);
        return <span style={{ fontSize: 12, color: '#94a3b8' }}>{formatDateTime(runtime?.updated_at || value)}</span>;
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      align: 'right',
      render: (_, source) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => openEditModal(source)}>编辑</Button>
          <Button size="small" type="link" onClick={() => navigate('/ingestion/status')}>状态</Button>
          {canReadPullTask ? (
            <Button size="small" type="link" onClick={() => setTaskHistorySource(source)}>任务</Button>
          ) : null}
          {canReadPullPackage ? (
            <Button size="small" type="link" onClick={() => setPackageHistorySource(source)}>包</Button>
          ) : null}
          {canRunPullTask ? (
            <Button
              size="small"
              type="link"
              loading={runningSourceIds.includes(source.source_id)}
              disabled={String(source.status).toLowerCase() === 'disabled'}
              onClick={() => handleRunNow(source)}
            >
              立即采集
            </Button>
          ) : null}
          <Button size="small" type="link" danger onClick={() => handleDisable(source)}>禁用</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>采集源管理</Typography.Title>
          <Typography.Paragraph style={{ margin: '4px 0 0', color: '#94a3b8' }}>
            同时展示真实 pull source 配置、运行态状态与最近资源拉取事件，便于在一个页面完成排查与操作。
          </Typography.Paragraph>
        </div>
        <Space>
          <Button onClick={loadData}>刷新</Button>
          <Button onClick={() => navigate('/ingestion/wizard')}>接入向导</Button>
          <Button type="primary" onClick={openCreateModal}>新建采集源</Button>
        </Space>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: 16 }}>
        <Card><Statistic title="采集源总数" value={stats.total} /></Card>
        <Card><Statistic title="启用中" value={stats.active} valueStyle={{ color: COLORS.success }} /></Card>
        <Card><Statistic title="健康运行" value={stats.healthy} valueStyle={{ color: COLORS.info }} /></Card>
        <Card><Statistic title="在线 Agent" value={stats.onlineAgents} valueStyle={{ color: COLORS.success }} /></Card>
        <Card><Statistic title="最近资源包" value={stats.recentPackageCount} /></Card>
        <Card><Statistic title="最近日志条数" value={stats.recentRecordCount} /></Card>
        <Card><Statistic title="已暂停" value={stats.paused} valueStyle={{ color: COLORS.warning }} /></Card>
        <Card><Statistic title="已禁用" value={stats.disabled} valueStyle={{ color: '#94a3b8' }} /></Card>
      </div>

      {runtimeStatusError ? (
        <Alert
          type="warning"
          showIcon
          message="运行态状态暂时不可用"
          description={`已回退展示配置数据；运行态接口错误：${runtimeStatusError}`}
        />
      ) : null}

      <Card>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Input
            name="sourceSearchQuery"
            allowClear
            style={{ width: 320 }}
            placeholder="搜索采集源、主机、路径、URL"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: '#94a3b8' }}>search</span>}
          />
          <Select id="source-status-filter" value={statusFilter} options={STATUS_FILTER_OPTIONS} style={{ width: 160 }} onChange={setStatusFilter} />
        </Space>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spin size="large" /></div>
        ) : filteredSources.length === 0 ? (
          <Empty description="当前没有符合条件的采集源" />
        ) : (
          <Table<PullSource>
            rowKey={(record) => record.source_id}
            columns={columns}
            dataSource={filteredSources}
            pagination={{
              pageSize,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              onShowSizeChange: (_, size) => setPageSize(size),
            }}
            scroll={{ x: 1900 }}
          />
        )}
      </Card>

      <Modal
        title={modalMode === 'create' ? '新建采集源' : '编辑采集源'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={760}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="数据源名称" name="name" rules={[{ required: true, message: '请输入数据源名称' }]}>
            <Input />
          </Form.Item>

          <Card size="small" type="inner" title="绑定 Agent" style={{ marginBottom: 16 }}>
            <Form.Item label="选择已探测到的 Agent">
              <Select allowClear options={agentOptions} onChange={handleAgentSelect} placeholder="可选：从在线 Agent 中快速填充" />
            </Form.Item>
            <Form.Item label="Agent 基础 URL" name="agent_base_url">
              <Input placeholder="例如：http://collector-agent:9091" />
            </Form.Item>
          </Card>

          <Space style={{ width: '100%' }} align="start" wrap>
            <Form.Item label="主机地址" name="host" rules={[{ required: true, message: '请输入主机地址' }]}>
              <Input style={{ width: 220 }} />
            </Form.Item>
            <Form.Item label="端口" name="port" rules={[{ required: true, message: '请输入端口' }]}>
              <InputNumber style={{ width: 140 }} min={1} max={65535} />
            </Form.Item>
            <Form.Item label="协议" name="protocol" rules={[{ required: true, message: '请选择协议' }]}>
              <Select style={{ width: 180 }} options={PROTOCOL_OPTIONS} />
            </Form.Item>
          </Space>

          <Form.Item label="采集路径 / source_path" name="path" rules={[{ required: true, message: '请输入采集路径' }]}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Space style={{ width: '100%' }} align="start" wrap>
            <Form.Item label="拉取间隔（秒）" name="pull_interval_sec">
              <InputNumber style={{ width: 160 }} min={2} max={3600} />
            </Form.Item>
            <Form.Item label="拉取超时（秒）" name="pull_timeout_sec">
              <InputNumber style={{ width: 160 }} min={5} max={3600} />
            </Form.Item>
            <Form.Item label="状态" name="status">
              <Select style={{ width: 160 }} options={CONFIG_STATUS_OPTIONS} />
            </Form.Item>
          </Space>

          <Form.Item label="认证引用" name="auth">
            <Input placeholder="默认使用 agent-key" />
          </Form.Item>
        </Form>
      </Modal>

      <PullTaskHistoryDrawer
        open={Boolean(taskHistorySource)}
        sourceId={taskHistorySource?.source_id}
        sourceName={taskHistorySource?.name}
        onClose={() => setTaskHistorySource(null)}
      />
      <PullPackageHistoryDrawer
        open={Boolean(packageHistorySource)}
        sourceName={packageHistorySource?.name}
        sourceRef={packageHistorySource?.path}
        onClose={() => setPackageHistorySource(null)}
      />
    </div>
  );
};

export default SourceManagement;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Dropdown, Empty, Form, Input, InputNumber, Modal, Select, Space, Spin, Statistic, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import {
  createPullSource,
  deletePullSource,
  fetchIngestAgents,
  fetchPullPackages,
  fetchPullSourceStatus,
  fetchPullSources,
  fetchPullTasks,
  runPullTask,
  updatePullSource,
  type CreatePullSourcePayload,
  type IngestAgentItem,
  type PullPackageItem,
  type PullSource,
  type PullSourceStatusResponse,
  type PullTaskItem,
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

function formatCompactDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function pickLatestDateTime(values: Array<string | undefined>) {
  let latestValue: string | undefined;
  let latestTimestamp = Number.NEGATIVE_INFINITY;

  values.forEach((value) => {
    if (!value) return;
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) {
      if (!latestValue) latestValue = value;
      return;
    }
    if (timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
      latestValue = value;
    }
  });

  return latestValue;
}

function formatShortId(value?: string, head = 8, tail = 4) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '-';
  if (normalized.length <= head + tail + 1) return normalized;
  return `${normalized.slice(0, head)}…${normalized.slice(-tail)}`;
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

function renderPathPreview(value?: string) {
  const paths = String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!paths.length) {
    return <span style={{ color: '#94a3b8', fontSize: 12 }}>-</span>;
  }

  const primaryPath = paths[0];
  const tooltipContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {paths.map((path) => (
        <span key={path} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{path}</span>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <Tooltip title={tooltipContent}>
        <Typography.Text
          code
          ellipsis
          style={{ margin: 0, fontSize: 12, maxWidth: '100%', display: 'inline-block' }}
        >
          {primaryPath}
        </Typography.Text>
      </Tooltip>
      {paths.length > 1 ? (
        <span style={{ fontSize: 12, color: '#94a3b8' }}>共 {paths.length} 个路径</span>
      ) : null}
    </div>
  );
}

interface TaskHistoryViewState {
  source: PullSource;
  tasks: PullTaskItem[];
  total: number;
  error?: string;
}

interface PackageHistoryViewState {
  source: PullSource;
  packages: PullPackageItem[];
  total: number;
  error?: string;
}

interface HistoryLoadingState {
  kind: 'task' | 'package';
  sourceId: string;
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
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetSource, setDeleteTargetSource] = useState<PullSource | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [runningSourceIds, setRunningSourceIds] = useState<string[]>([]);
  const [taskHistoryState, setTaskHistoryState] = useState<TaskHistoryViewState | null>(null);
  const [packageHistoryState, setPackageHistoryState] = useState<PackageHistoryViewState | null>(null);
  const [historyLoadingState, setHistoryLoadingState] = useState<HistoryLoadingState | null>(null);

  const capabilities = useAuthStore((s) => s.capabilities);
  const canRunPullTask = useMemo(() => hasAnyCapability(capabilities, ['ingest.task.run']), [capabilities]);
  const canReadPullTask = useMemo(() => hasAnyCapability(capabilities, ['ingest.task.read']), [capabilities]);
  const canReadPullPackage = useMemo(() => hasAnyCapability(capabilities, ['ingest.package.read']), [capabilities]);
  const canDeletePullSource = useMemo(() => hasAnyCapability(capabilities, ['ingest.source.delete']), [capabilities]);

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
      await updatePullSource(source.source_id, { status: 'disabled' });
      messageApi.success(`已禁用采集源：${source.name}`);
      loadData();
    } catch (err) {
      messageApi.error(`禁用失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }, [loadData, messageApi]);

  const openDeleteModal = useCallback((source: PullSource) => {
    setDeleteTargetSource(source);
    setDeleteConfirmText('');
    setDeleteModalOpen(true);
  }, []);

  const closeDeleteModal = useCallback(() => {
    setDeleteModalOpen(false);
    setDeleteTargetSource(null);
    setDeleteConfirmText('');
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTargetSource) return;
    if (deleteConfirmText.trim() !== deleteTargetSource.name.trim()) {
      messageApi.error('请输入正确的采集源名称后再删除');
      return;
    }

    setDeleting(true);
    try {
      await deletePullSource(deleteTargetSource.source_id);
      messageApi.success(`已删除采集源：${deleteTargetSource.name}`);
      closeDeleteModal();
      loadData();
    } catch (err) {
      messageApi.error(`删除失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeleting(false);
    }
  }, [closeDeleteModal, deleteConfirmText, deleteTargetSource, loadData, messageApi]);

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

  const openTaskHistory = useCallback(async (source: PullSource) => {
    const toastKey = `source-management-task-${source.source_id}`;
    setHistoryLoadingState({ kind: 'task', sourceId: source.source_id });
    messageApi.open({ key: toastKey, type: 'loading', content: `正在加载 ${source.name} 的任务记录...`, duration: 0 });
    try {
      const result = await fetchPullTasks({
        source_id: source.source_id,
        page: 1,
        page_size: 20,
      });
      setTaskHistoryState({ source, tasks: result.items, total: result.total, error: '' });
      messageApi.destroy(toastKey);
    } catch (err) {
      setTaskHistoryState({
        source,
        tasks: [],
        total: 0,
        error: err instanceof Error ? err.message : String(err),
      });
      messageApi.destroy(toastKey);
    } finally {
      setHistoryLoadingState((current) => (
        current?.kind === 'task' && current.sourceId === source.source_id ? null : current
      ));
    }
  }, [messageApi]);

  const openPackageHistory = useCallback(async (source: PullSource) => {
    const toastKey = `source-management-package-${source.source_id}`;
    setHistoryLoadingState({ kind: 'package', sourceId: source.source_id });
    messageApi.open({ key: toastKey, type: 'loading', content: `正在加载 ${source.name} 的资源包记录...`, duration: 0 });
    try {
      const result = await fetchPullPackages({
        source_ref: source.path,
        page: 1,
        page_size: 20,
      });
      setPackageHistoryState({ source, packages: result.items, total: result.total, error: '' });
      messageApi.destroy(toastKey);
    } catch (err) {
      setPackageHistoryState({
        source,
        packages: [],
        total: 0,
        error: err instanceof Error ? err.message : String(err),
      });
      messageApi.destroy(toastKey);
    } finally {
      setHistoryLoadingState((current) => (
        current?.kind === 'package' && current.sourceId === source.source_id ? null : current
      ));
    }
  }, [messageApi]);

  const columns: ColumnsType<PullSource> = [
    {
      title: '采集源',
      key: 'source',
      width: 200,
      render: (_, source) => (
        <div style={{ minWidth: 0 }}>
          <Tooltip title={source.name}>
            <Typography.Text strong ellipsis style={{ maxWidth: '100%', display: 'block' }}>{source.name}</Typography.Text>
          </Tooltip>
          <Tooltip title={source.source_id}>
            <Typography.Text type="secondary" ellipsis style={{ maxWidth: '100%', display: 'block', fontSize: 12 }}>
              {`${source.protocol.toUpperCase()} · ${formatShortId(source.source_id)}`}
            </Typography.Text>
          </Tooltip>
        </div>
      ),
    },
    {
      title: 'Agent',
      key: 'agent',
      width: 180,
      render: (_, source) => {
        const agent = agentMap.get(source.agent_base_url ?? '');
        const runtime = runtimeStatusMap.get(source.source_id);
        const primary = runtime?.agent_hostname || agent?.hostname || agent?.host || source.host || '-';
        const secondary = runtime?.agent_id || agent?.agent_id || source.agent_base_url || '-';
        return (
          <div style={{ minWidth: 0 }}>
            <Tooltip title={primary}>
              <Typography.Text ellipsis style={{ maxWidth: '100%', display: 'block' }}>{primary}</Typography.Text>
            </Tooltip>
            <Tooltip title={secondary}>
              <Typography.Text
                type="secondary"
                ellipsis
                style={{ maxWidth: '100%', display: 'block', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
              >
                {formatShortId(secondary, 6, 4)}
              </Typography.Text>
            </Tooltip>
          </div>
        );
      },
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      width: 220,
      render: (value: string) => renderPathPreview(value),
    },
    {
      title: '参数',
      key: 'settings',
      width: 100,
      render: (_, source) => {
        const detail = `间隔 ${source.pull_interval_sec}s / 超时 ${source.pull_timeout_sec}s`;
        return (
          <Tooltip title={detail}>
            <Typography.Text style={{ fontSize: 12 }}>{`${source.pull_interval_sec}s / ${source.pull_timeout_sec}s`}</Typography.Text>
          </Tooltip>
        );
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 140,
      render: (_, source) => {
        const runtimeMeta = getRuntimeStatusMeta(runtimeStatusMap.get(source.source_id)?.runtime_status);
        const configMeta = getConfiguredStatusMeta(source.status);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: runtimeMeta.dot, display: 'inline-block', flex: '0 0 auto' }} />
              <span style={{ color: '#94a3b8' }}>运行</span>
              <span>{runtimeMeta.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: configMeta.dot, display: 'inline-block', flex: '0 0 auto' }} />
              <span style={{ color: '#94a3b8' }}>配置</span>
              <span>{configMeta.label}</span>
            </div>
          </div>
        );
      },
    },
    {
      title: '最近事件',
      key: 'latest_event',
      width: 220,
      render: (_, source) => {
        const runtime = runtimeStatusMap.get(source.source_id);
        if (!runtime) {
          return <span style={{ fontSize: 12, color: '#94a3b8' }}>暂无运行态</span>;
        }

        const taskMeta = getTaskStatusMeta(runtime.last_task?.status);
        const packageMeta = getPackageStatusMeta(runtime.last_package?.status);
        const taskTime = runtime.last_task?.finished_at || runtime.last_task?.started_at || runtime.last_task?.scheduled_at;
        const packageTime = runtime.last_package?.acked_at || runtime.last_package?.created_at;
        const latestTime = pickLatestDateTime([taskTime, packageTime, runtime.updated_at]);
        const summaryParts = [
          runtime.last_package?.record_count !== undefined && runtime.last_package?.record_count !== null ? `${formatNumber(runtime.last_package.record_count)} 条` : null,
          runtime.last_package?.size_bytes !== undefined && runtime.last_package?.size_bytes !== null ? formatBytes(runtime.last_package.size_bytes) : null,
          latestTime ? formatShortDateTime(latestTime) : null,
        ].filter(Boolean) as string[];
        const detailLines = [
          `任务：${taskMeta.label} · ${formatDateTime(taskTime)}`,
          `资源包：${packageMeta.label} · ${formatDateTime(packageTime)}`,
          `上报：${formatDateTime(runtime.updated_at)}`,
        ];

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <Tag color={taskMeta.color} style={{ marginInlineEnd: 0 }}>任务 {taskMeta.label}</Tag>
              <Tag color={packageMeta.color} style={{ marginInlineEnd: 0 }}>包 {packageMeta.label}</Tag>
              {runtime.error_message ? (
                <Tooltip title={runtime.error_message}>
                  <Tag color="error" style={{ marginInlineEnd: 0 }}>错误</Tag>
                </Tooltip>
              ) : null}
            </div>
            <Tooltip
              title={(
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {detailLines.map((line) => <div key={line}>{line}</div>)}
                </div>
              )}
            >
              <Typography.Text type="secondary" ellipsis style={{ maxWidth: '100%', fontSize: 12 }}>
                {summaryParts.join(' · ') || '-'}
              </Typography.Text>
            </Tooltip>
          </div>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      align: 'right',
      render: (_, source) => {
        const isTaskHistoryLoading = historyLoadingState?.kind === 'task' && historyLoadingState.sourceId === source.source_id;
        const isPackageHistoryLoading = historyLoadingState?.kind === 'package' && historyLoadingState.sourceId === source.source_id;
        const menuItems = [
          { key: 'status', label: '查看状态' },
          canReadPullTask ? { key: 'task', label: isTaskHistoryLoading ? '任务记录加载中...' : '任务记录', disabled: isTaskHistoryLoading } : null,
          canReadPullPackage ? { key: 'package', label: isPackageHistoryLoading ? '资源包记录加载中...' : '资源包记录', disabled: isPackageHistoryLoading } : null,
          canRunPullTask ? { key: 'run', label: '立即采集', disabled: String(source.status).toLowerCase() === 'disabled' } : null,
          { key: 'disable', label: '停用', danger: true },
          canDeletePullSource ? { key: 'delete', label: '删除', danger: true } : null,
        ].filter(Boolean);

        return (
          <Space size={4}>
            <Button size="small" type="link" onClick={() => openEditModal(source)}>编辑</Button>
            <Dropdown
              trigger={['click']}
              menu={{
                items: menuItems,
                onClick: ({ key }) => {
                  if (key === 'status') {
                    navigate('/ingestion/status');
                    return;
                  }
                  if (key === 'task') {
                    void openTaskHistory(source);
                    return;
                  }
                  if (key === 'package') {
                    void openPackageHistory(source);
                    return;
                  }
                  if (key === 'run') {
                    void handleRunNow(source);
                    return;
                  }
                  if (key === 'disable') {
                    void handleDisable(source);
                    return;
                  }
                  if (key === 'delete') {
                    openDeleteModal(source);
                  }
                },
              }}
            >
              <Button size="small" type="link">更多</Button>
            </Dropdown>
          </Space>
        );
      },
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
            size="small"
            rowKey={(record) => record.source_id}
            columns={columns}
            dataSource={filteredSources}
            pagination={{
              pageSize,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              onShowSizeChange: (_, size) => setPageSize(size),
            }}
            scroll={{ x: 1240 }}
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

      <Modal
        title="删除采集源"
        open={deleteModalOpen}
        onCancel={() => {
          if (!deleting) closeDeleteModal();
        }}
        onOk={() => void handleDeleteConfirm()}
        confirmLoading={deleting}
        okText="确认删除"
        okButtonProps={{ danger: true, disabled: !deleteTargetSource || deleteConfirmText.trim() !== deleteTargetSource.name.trim() }}
        cancelText="取消"
        cancelButtonProps={{ disabled: deleting }}
        destroyOnHidden
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Alert
            type="warning"
            showIcon
            message="删除后不可恢复"
            description="删除采集源后，将移除其拉取配置和关联的 Agent 展示项。"
          />
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            请输入采集源名称 <Typography.Text code>{deleteTargetSource?.name ?? '-'}</Typography.Text> 以确认删除。
          </Typography.Paragraph>
          <Input
            id="source-delete-confirm-name"
            name="sourceDeleteConfirmName"
            value={deleteConfirmText}
            onChange={(event) => setDeleteConfirmText(event.target.value)}
            placeholder="请输入采集源名称"
          />
        </div>
      </Modal>

      <PullTaskHistoryDrawer
        open={Boolean(taskHistoryState)}
        sourceName={taskHistoryState?.source.name}
        tasks={taskHistoryState?.tasks ?? []}
        total={taskHistoryState?.total ?? 0}
        error={taskHistoryState?.error}
        onClose={() => setTaskHistoryState(null)}
      />
      <PullPackageHistoryDrawer
        open={Boolean(packageHistoryState)}
        sourceName={packageHistoryState?.source.name}
        packages={packageHistoryState?.packages ?? []}
        total={packageHistoryState?.total ?? 0}
        error={packageHistoryState?.error}
        onClose={() => setPackageHistoryState(null)}
      />
    </div>
  );
};

export default SourceManagement;

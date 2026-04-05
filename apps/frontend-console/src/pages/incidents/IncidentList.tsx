import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  App,
  AutoComplete,
  Badge,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { COLORS } from '../../theme/tokens';
import type { Incident, IncidentStatus, IncidentSeverity } from '../../types/incident';
import {
  acknowledgeIncident,
  archiveIncident,
  createIncident,
  deleteIncident,
  fetchIncidents,
  fetchSLASummary,
  investigateIncident,
  resolveIncident,
  updateIncident,
} from '../../api/incident';
import type { CreateIncidentPayload } from '../../api/incident';
import { fetchUsers, type UserData } from '../../api/user';
import { usePaginationQuickJumperAccessibility } from '../../components/common/usePaginationQuickJumperAccessibility';
import { useAuthStore } from '../../stores/authStore';
import {
  getIncidentPermissionDeniedReason,
  resolveIncidentActionAccess,
} from './incidentAuthorization';
import AnalysisPageHeader from '../../components/common/AnalysisPageHeader';

const SEVERITY_CONFIG: Record<IncidentSeverity, { color: string; label: string; icon: string }> = {
  P0: { color: COLORS.danger, label: 'P0 紧急', icon: 'crisis_alert' },
  P1: { color: '#f97316', label: 'P1 严重', icon: 'error' },
  P2: { color: COLORS.warning, label: 'P2 一般', icon: 'warning' },
  P3: { color: COLORS.info, label: 'P3 提示', icon: 'info' },
};

const STATUS_CONFIG: Record<IncidentStatus, { color: string; label: string }> = {
  detected: { color: 'default', label: '已检测' },
  alerted: { color: 'orange', label: '已告警' },
  acknowledged: { color: 'blue', label: '已响应' },
  analyzing: { color: 'processing', label: '分析中' },
  mitigated: { color: 'cyan', label: '已止损' },
  resolved: { color: 'success', label: '已解决' },
  postmortem: { color: 'purple', label: '复盘中' },
  archived: { color: 'default', label: '已归档' },
};

function formatTime(ts: number | null): string {
  if (!ts) return '-';
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${Math.floor(diff / 86400000)} 天前`;
}

function calcDuration(start: number | null, end: number | null): string {
  if (!start || !end) return '-';
  const diff = end - start;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`;
}

function resolveUserLabel(user: UserData): string {
  const displayName = user.display_name?.trim();
  const username = user.username?.trim();
  if (displayName && username && displayName !== username) {
    return `${displayName} (${username})`;
  }
  return displayName || username || user.email || user.id;
}

function summarizeFailureReasons(reasons: string[]): string {
  if (reasons.length === 0) return '';
  const preview = reasons.slice(0, 2).join('；');
  return reasons.length > 2 ? `${preview} 等` : preview;
}

function normalizeErrorMessage(reason: unknown): string {
  if (reason instanceof Error && reason.message) return reason.message;
  if (typeof reason === 'string' && reason.trim()) return reason.trim();
  return '操作失败';
}

const IncidentList: React.FC = () => {
  const { message } = App.useApp();
  const isDark = useThemeStore((s) => s.isDark);
  const navigate = useNavigate();
  const permissions = useAuthStore((state) => state.permissions);
  const capabilities = useAuthStore((state) => state.capabilities);

  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'all'>('all');

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [stats, setStats] = useState<{ label: string; value: number; icon: string; color: string }[]>([]);

  const [users, setUsers] = useState<UserData[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetIds, setAssignTargetIds] = useState<string[]>([]);
  const [assignUserId, setAssignUserId] = useState('');

  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveTargetIds, setArchiveTargetIds] = useState<string[]>([]);
  const [archiveVerdict, setArchiveVerdict] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const storedPageSize = usePreferencesStore((s) => s.pageSizes.incidentList ?? 20);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeLocal(size);
    setStoredPageSize('incidentList', size);
  }, [setStoredPageSize]);
  const incidentsTableRef = usePaginationQuickJumperAccessibility('incident-list');
  const [modal, modalContextHolder] = Modal.useModal();

  const selectedIds = useMemo(() => selectedRowKeys.map((value) => String(value)), [selectedRowKeys]);
  const authorization = useMemo(() => ({ permissions, capabilities }), [capabilities, permissions]);
  const actionAccess = useMemo(() => resolveIncidentActionAccess(authorization), [authorization]);

  const userLabelMap = useMemo(() => {
    return new Map(users.map((user) => [user.id, resolveUserLabel(user)]));
  }, [users]);

  const assigneeOptions = useMemo(() => {
    return users.map((user) => ({
      value: user.id,
      label: resolveUserLabel(user),
    }));
  }, [users]);

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: { status?: string; severity?: string; query?: string } = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (severityFilter !== 'all') filters.severity = severityFilter;
      if (search.trim()) filters.query = search.trim();

      const { items, total: nextTotal } = await fetchIncidents(currentPage, pageSize, filters);
      setIncidents(items);
      setTotal(nextTotal);
      setLastUpdatedAt(new Date());
    } catch (err) {
      const nextError = err instanceof Error ? err.message : '加载事件列表失败';
      setError(nextError);
      message.error(nextError);
      setIncidents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, search, severityFilter, statusFilter]);

  const loadStats = useCallback(async () => {
    try {
      const sla = actionAccess.canReadSlaSummary ? await fetchSLASummary() : { totalIncidents: 0 };
      const openCount = incidents.filter((item) => !['resolved', 'postmortem', 'archived'].includes(item.status)).length;
      const p0Count = incidents.filter((item) => item.severity === 'P0' && item.status !== 'archived').length;
      const unackedCount = incidents.filter((item) => item.status === 'alerted').length;
      const pendingPostmortem = incidents.filter((item) => item.status === 'postmortem').length;

      setStats([
        { label: '进行中事件', value: incidents.length > 0 ? openCount : sla.totalIncidents, icon: 'local_fire_department', color: COLORS.danger },
        { label: 'P0 紧急', value: p0Count, icon: 'crisis_alert', color: '#f97316' },
        { label: '待响应', value: unackedCount, icon: 'notification_important', color: COLORS.warning },
        { label: '待复盘', value: pendingPostmortem, icon: 'rate_review', color: COLORS.primary },
      ]);
    } catch {
      setStats([
        { label: '进行中事件', value: 0, icon: 'local_fire_department', color: COLORS.danger },
        { label: 'P0 紧急', value: 0, icon: 'crisis_alert', color: '#f97316' },
        { label: '待响应', value: 0, icon: 'notification_important', color: COLORS.warning },
        { label: '待复盘', value: 0, icon: 'rate_review', color: COLORS.primary },
      ]);
    }
  }, [actionAccess.canReadSlaSummary, incidents]);

  const loadUsers = useCallback(async () => {
    if (!actionAccess.canAssignIncident) {
      setUsers([]);
      setUsersLoading(false);
      return;
    }
    setUsersLoading(true);
    try {
      const response = await fetchUsers({ page: 1, pageSize: 200, status: 'active' });
      setUsers(response.users);
    } catch {
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [actionAccess.canAssignIncident]);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    setSelectedRowKeys([]);
  }, [currentPage, pageSize, search, severityFilter, statusFilter]);

  const refreshCurrentPage = useCallback(async (deletedCount?: number) => {
    const deletedItems = deletedCount ?? 0;
    const shouldFallbackPage = deletedItems > 0 && currentPage > 1 && deletedItems >= incidents.length;
    if (shouldFallbackPage) {
      setCurrentPage((page) => Math.max(page - 1, 1));
      return;
    }
    await loadIncidents();
  }, [currentPage, incidents.length, loadIncidents]);

  const runBatchRequest = useCallback(async (
    ids: string[],
    actionLabel: string,
    request: (id: string) => Promise<void>,
    options: { clearSelection?: boolean; deletedCount?: number } = {},
  ) => {
    const uniqueIds = Array.from(new Set(ids.map((value) => value.trim()).filter(Boolean)));
    if (uniqueIds.length === 0) {
      message.warning('请先选择事件');
      return;
    }

    setSubmitting(true);
    try {
      const results = await Promise.allSettled(uniqueIds.map((id) => request(id)));
      const failedReasons = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => normalizeErrorMessage(result.reason));
      const successCount = results.length - failedReasons.length;

      if (successCount > 0 && failedReasons.length === 0) {
        message.success(`${actionLabel}成功，共处理 ${successCount} 条事件`);
      } else if (successCount > 0) {
        message.warning(`${actionLabel}部分完成：成功 ${successCount} 条，失败 ${failedReasons.length} 条（${summarizeFailureReasons(failedReasons)}）`);
      } else {
        message.error(`${actionLabel}失败：${summarizeFailureReasons(failedReasons) || '全部请求失败'}`);
      }

      if (options.clearSelection !== false) {
        setSelectedRowKeys([]);
      }
      await refreshCurrentPage(options.deletedCount);
    } finally {
      setSubmitting(false);
    }
  }, [refreshCurrentPage]);

  const handleCreateIncident = useCallback(async () => {
    if (!actionAccess.canCreateIncident) {
      message.warning(getIncidentPermissionDeniedReason('create'));
      return;
    }
    try {
      const payload: CreateIncidentPayload = {
        title: `手动创建事件 ${new Date().toLocaleString('zh-CN')}`,
        description: '',
        severity: 'P2',
      };
      const { id } = await createIncident(payload);
      message.success('事件创建成功');
      navigate(`/incidents/detail/${id}`);
    } catch (err) {
      const nextError = err instanceof Error ? err.message : '创建事件失败';
      message.error(nextError);
    }
  }, [actionAccess.canCreateIncident, message, navigate]);

  const openAssignModal = useCallback((ids: string[], presetAssignee?: string) => {
    if (!actionAccess.canAssignIncident) {
      message.warning(getIncidentPermissionDeniedReason('assign'));
      return;
    }
    setAssignTargetIds(ids);
    setAssignUserId(presetAssignee ?? '');
    setAssignModalOpen(true);
  }, [actionAccess.canAssignIncident, message]);

  const handleConfirmAssign = useCallback(async () => {
    const nextAssignee = assignUserId.trim();
    const targetIds = assignTargetIds;
    if (targetIds.length === 0) {
      message.warning('未选择待指派事件');
      return;
    }

    await runBatchRequest(targetIds, nextAssignee ? '指派事件' : '清空负责人', (id) => updateIncident(id, {
      assigned_to: nextAssignee,
    }));

    setAssignModalOpen(false);
    setAssignTargetIds([]);
    setAssignUserId('');
  }, [assignTargetIds, assignUserId, runBatchRequest]);

  const openArchiveModal = useCallback((ids: string[]) => {
    setArchiveTargetIds(ids);
    setArchiveVerdict('');
    setArchiveModalOpen(true);
  }, []);

  const handleConfirmArchive = useCallback(async () => {
    if (!actionAccess.canArchiveIncident) {
      message.warning(getIncidentPermissionDeniedReason('archive'));
      return;
    }
    const verdict = archiveVerdict.trim();
    if (!verdict) {
      message.error('请输入归档结论');
      return;
    }

    await runBatchRequest(archiveTargetIds, '归档事件', (id) => archiveIncident(id, verdict));

    setArchiveModalOpen(false);
    setArchiveTargetIds([]);
    setArchiveVerdict('');
  }, [actionAccess.canArchiveIncident, archiveTargetIds, archiveVerdict, message, runBatchRequest]);

  const handleDeleteIncidents = useCallback(async (ids: string[]) => {
    if (!actionAccess.canCloseIncident) {
      message.warning(getIncidentPermissionDeniedReason('close'));
      return;
    }
    await runBatchRequest(ids, '删除事件', (id) => deleteIncident(id), { deletedCount: ids.length });
  }, [actionAccess.canCloseIncident, message, runBatchRequest]);

  const confirmBatchTransition = useCallback((title: string, ids: string[], request: (id: string) => Promise<void>) => {
    if (!actionAccess.canUpdateIncident) {
      message.warning(getIncidentPermissionDeniedReason('update'));
      return;
    }
    modal.confirm({
      title,
      content: `将处理 ${ids.length} 条事件，是否继续？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        await runBatchRequest(ids, title, request);
      },
    });
  }, [actionAccess.canUpdateIncident, message, modal, runBatchRequest]);

  const renderAssignee = useCallback((value: string) => {
    if (!value) return <span className="text-xs opacity-40">未分配</span>;
    return <span className="text-xs">{userLabelMap.get(value) ?? value}</span>;
  }, [userLabelMap]);

  const columns: ColumnsType<Incident> = useMemo(() => [
    {
      title: '事件 ID',
      dataIndex: 'id',
      key: 'id',
      width: 180,
      render: (value: string) => (
        <Button
          type="link"
          size="small"
          className="font-mono text-xs p-0"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/incidents/detail/${value}`);
          }}
        >
          {value}
        </Button>
      ),
    },
    {
      title: '级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (value: IncidentSeverity) => {
        const config = SEVERITY_CONFIG[value];
        return (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-base" style={{ color: config.color }}>{config.icon}</span>
            <span className="text-xs font-medium" style={{ color: config.color }}>{config.label}</span>
          </span>
        );
      },
    },
    {
      title: '事件标题',
      dataIndex: 'title',
      key: 'title',
      render: (value: string, record: Incident) => (
        <div>
          <div className="text-sm font-medium">{value}</div>
          <div className="text-xs opacity-50 mt-0.5">{record.source} · 影响 {record.affectedServices.length} 个服务</div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: IncidentStatus) => {
        const config = STATUS_CONFIG[value];
        return <Tag color={config.color} style={{ margin: 0 }}>{config.label}</Tag>;
      },
    },
    {
      title: '负责人',
      dataIndex: 'assignee',
      key: 'assignee',
      width: 180,
      render: renderAssignee,
    },
    {
      title: 'MTTA',
      key: 'mtta',
      width: 80,
      render: (_value: unknown, record: Incident) => <span className="font-mono text-xs">{calcDuration(record.alertedAt, record.ackedAt)}</span>,
    },
    {
      title: 'MTTR',
      key: 'mttr',
      width: 80,
      render: (_value: unknown, record: Incident) => <span className="font-mono text-xs">{calcDuration(record.alertedAt, record.resolvedAt)}</span>,
    },
    {
      title: '检测时间',
      dataIndex: 'detectedAt',
      key: 'detectedAt',
      width: 120,
      sorter: (left, right) => left.detectedAt - right.detectedAt,
      defaultSortOrder: 'descend',
      render: (value: number) => <span className="text-xs opacity-70">{formatTime(value)}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_value: unknown, record: Incident) => (
        <Space size={4} onClick={(event) => event.stopPropagation()}>
          <Tooltip title={actionAccess.canAssignIncident ? '指派负责人' : getIncidentPermissionDeniedReason('assign')}>
            <Button
              type="link"
              size="small"
              disabled={!actionAccess.canAssignIncident}
              icon={<span className="material-symbols-outlined text-sm">person_add</span>}
              onClick={() => openAssignModal([record.id], record.assignee)}
            />
          </Tooltip>
          <Tooltip title={actionAccess.canReadIncident ? '查看详情' : getIncidentPermissionDeniedReason('read')}>
            <Button
              type="link"
              size="small"
              disabled={!actionAccess.canReadIncident}
              icon={<span className="material-symbols-outlined text-sm">open_in_new</span>}
              onClick={() => navigate(`/incidents/detail/${record.id}`)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除该事件？"
            description="删除后不可恢复，事件时间线也会一并移除。"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            disabled={!actionAccess.canCloseIncident}
            onConfirm={() => handleDeleteIncidents([record.id])}
          >
            <Tooltip title={actionAccess.canCloseIncident ? '删除事件' : getIncidentPermissionDeniedReason('close')}>
              <Button
                danger
                type="link"
                size="small"
                disabled={!actionAccess.canCloseIncident}
                icon={<span className="material-symbols-outlined text-sm">delete</span>}
                onClick={(event) => event.stopPropagation()}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ], [actionAccess.canAssignIncident, actionAccess.canCloseIncident, actionAccess.canReadIncident, handleDeleteIncidents, navigate, openAssignModal, renderAssignee]);

  return (
    <div className="flex flex-col gap-4">
      {modalContextHolder}
      <AnalysisPageHeader
        title="事件管理"
        subtitle="集中查看真实事件状态、指派、流转与归档"
        statusTag={stats.length > 0 ? <Badge count={stats[0].value} style={{ backgroundColor: COLORS.danger }} /> : null}
        lastUpdatedAt={lastUpdatedAt}
        actions={(
          <>
            <Button size="small" icon={<span className="material-symbols-outlined text-sm">support_agent</span>} onClick={() => navigate('/help/faq')}>
              帮助
            </Button>
            <Button size="small" icon={<span className="material-symbols-outlined text-sm">refresh</span>} onClick={() => { void loadIncidents(); }}>
              刷新数据
            </Button>
            <Tooltip title={actionAccess.canCreateIncident ? '创建事件' : getIncidentPermissionDeniedReason('create')}>
              <Button size="small" type="primary" disabled={!actionAccess.canCreateIncident} icon={<span className="material-symbols-outlined text-sm">add</span>} onClick={handleCreateIncident}>
                创建事件
              </Button>
            </Tooltip>
          </>
        )}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((item) => (
          <Card key={item.label} size="small" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }} styles={{ body: { padding: '16px 20px' } }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs opacity-50 mb-1">{item.label}</div>
                <div className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</div>
              </div>
              <span className="material-symbols-outlined text-2xl" style={{ color: item.color, opacity: 0.6 }}>{item.icon}</span>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Input.Search
          id="incident-list-search"
          name="incident-list-search"
          autoComplete="off"
          placeholder="按事件 ID、标题、来源搜索..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setCurrentPage(1);
          }}
          allowClear
          style={{ flex: 1, minWidth: 200 }}
        />
        <Select
          value={severityFilter}
          onChange={(value) => {
            setSeverityFilter(value);
            setCurrentPage(1);
          }}
          style={{ width: 140 }}
          options={[
            { value: 'all', label: '所有级别' },
            { value: 'P0', label: 'P0 紧急' },
            { value: 'P1', label: 'P1 严重' },
            { value: 'P2', label: 'P2 一般' },
            { value: 'P3', label: 'P3 提示' },
          ]}
        />
        <Select
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value);
            setCurrentPage(1);
          }}
          style={{ width: 140 }}
          options={[
            { value: 'all', label: '状态: 全部' },
            { value: 'alerted', label: '已告警' },
            { value: 'acknowledged', label: '已响应' },
            { value: 'analyzing', label: '分析中' },
            { value: 'resolved', label: '已解决' },
            { value: 'archived', label: '已归档' },
          ]}
        />
      </div>

      {actionAccess.isReadOnly && (
        <Card size="small" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
          <div className="text-sm opacity-70">
            当前会话为事件只读模式，创建、指派、状态流转、归档和删除操作已禁用。
          </div>
        </Card>
      )}

      {selectedIds.length > 0 && (
        <Card size="small" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm">
              已选择 <span className="font-semibold">{selectedIds.length}</span> 条事件
            </div>
            <Space wrap>
              <Tooltip title={actionAccess.canAssignIncident ? undefined : getIncidentPermissionDeniedReason('assign')}>
                <Button loading={submitting} disabled={!actionAccess.canAssignIncident} onClick={() => openAssignModal(selectedIds)}>
                  批量指派
                </Button>
              </Tooltip>
              <Tooltip title={actionAccess.canUpdateIncident ? undefined : getIncidentPermissionDeniedReason('update')}>
                <Button loading={submitting} disabled={!actionAccess.canUpdateIncident} onClick={() => confirmBatchTransition('批量响应事件', selectedIds, acknowledgeIncident)}>
                  批量响应
                </Button>
              </Tooltip>
              <Tooltip title={actionAccess.canUpdateIncident ? undefined : getIncidentPermissionDeniedReason('update')}>
                <Button loading={submitting} disabled={!actionAccess.canUpdateIncident} onClick={() => confirmBatchTransition('批量转为分析中', selectedIds, investigateIncident)}>
                  批量分析
                </Button>
              </Tooltip>
              <Tooltip title={actionAccess.canUpdateIncident ? undefined : getIncidentPermissionDeniedReason('update')}>
                <Button loading={submitting} disabled={!actionAccess.canUpdateIncident} onClick={() => confirmBatchTransition('批量解决事件', selectedIds, (id) => resolveIncident(id))}>
                  批量解决
                </Button>
              </Tooltip>
              <Tooltip title={actionAccess.canArchiveIncident ? undefined : getIncidentPermissionDeniedReason('archive')}>
                <Button loading={submitting} disabled={!actionAccess.canArchiveIncident} onClick={() => openArchiveModal(selectedIds)}>
                  批量归档
                </Button>
              </Tooltip>
              <Tooltip title={actionAccess.canCloseIncident ? undefined : getIncidentPermissionDeniedReason('close')}>
                <Button
                  danger
                  loading={submitting}
                  disabled={!actionAccess.canCloseIncident}
                  onClick={() => {
                    modal.confirm({
                      title: '批量删除事件',
                      content: `将删除 ${selectedIds.length} 条事件，删除后不可恢复，是否继续？`,
                      okText: '删除',
                      cancelText: '取消',
                      okButtonProps: { danger: true },
                      onOk: async () => {
                        await handleDeleteIncidents(selectedIds);
                      },
                    });
                  }}
                >
                  批量删除
                </Button>
              </Tooltip>
              <Button type="link" onClick={() => setSelectedRowKeys([])}>
                清空选择
              </Button>
            </Space>
          </div>
        </Card>
      )}

      {error ? (
        <Empty description={error} />
      ) : (
        <div ref={incidentsTableRef}>
          <Table<Incident>
            dataSource={incidents}
            columns={columns}
            rowKey="id"
            size="small"
            loading={loading || submitting}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
              getTitleCheckboxProps: () => ({
                name: 'incident-list-select-all',
                'aria-label': '选择全部事件',
              }),
              getCheckboxProps: (record) => ({
                name: `incident-list-select-${record.id}`,
                'aria-label': `选择事件 ${record.id}`,
              }),
            }}
            pagination={{
              current: currentPage,
              pageSize,
              total,
              showSizeChanger: true,
              showQuickJumper: total > pageSize,
              showTotal: (count, range) => `显示 ${range[0]}-${range[1]} 条，共 ${count} 条`,
              pageSizeOptions: ['10', '20', '50', '100'],
              onChange: (page, size) => {
                const nextSize = size ?? pageSize;
                if (nextSize !== pageSize) {
                  setPageSize(nextSize);
                  setCurrentPage(1);
                  return;
                }
                setCurrentPage(page);
              },
              position: ['bottomLeft'],
            }}
            onRow={(record) => ({
              onClick: () => navigate(`/incidents/detail/${record.id}`),
              style: { cursor: 'pointer' },
            })}
            scroll={{ x: 1100 }}
            locale={{ emptyText: loading ? <Spin size="small" /> : <Empty description="暂无事件" /> }}
          />
        </div>
      )}

      <Modal
        open={assignModalOpen}
        title={assignTargetIds.length > 1 ? '批量指派事件' : '指派负责人'}
        okText="保存"
        cancelText="取消"
        confirmLoading={submitting}
        destroyOnHidden
        onOk={() => {
          void handleConfirmAssign();
        }}
        onCancel={() => {
          setAssignModalOpen(false);
          setAssignTargetIds([]);
          setAssignUserId('');
        }}
      >
        <div className="flex flex-col gap-3">
          <div className="text-xs opacity-60">
            输入用户 ID 或从建议列表中选择；留空可清空当前负责人。
          </div>
          <AutoComplete
            id="incident-assignee-input"
            value={assignUserId}
            options={assigneeOptions}
            onChange={setAssignUserId}
            style={{ width: '100%' }}
            placeholder="请输入用户 ID 或选择负责人"
            filterOption={(inputValue, option) => {
              const normalized = inputValue.trim().toLowerCase();
              return String(option?.label ?? '').toLowerCase().includes(normalized)
                || String(option?.value ?? '').toLowerCase().includes(normalized);
            }}
          />
          <div className="text-xs opacity-50">
            {usersLoading ? '正在加载可指派用户...' : `已加载 ${users.length} 个活跃用户建议`}
          </div>
        </div>
      </Modal>

      <Modal
        open={archiveModalOpen}
        title={archiveTargetIds.length > 1 ? '批量归档事件' : '归档事件'}
        okText="归档"
        cancelText="取消"
        confirmLoading={submitting}
        destroyOnHidden
        onOk={() => {
          void handleConfirmArchive();
        }}
        onCancel={() => {
          setArchiveModalOpen(false);
          setArchiveTargetIds([]);
          setArchiveVerdict('');
        }}
      >
        <div className="flex flex-col gap-3">
          <div className="text-xs opacity-60">请输入归档结论，归档后事件将转为已归档状态。</div>
          <Input.TextArea
            rows={4}
            value={archiveVerdict}
            onChange={(event) => setArchiveVerdict(event.target.value)}
            placeholder="请输入归档结论"
            maxLength={500}
            showCount
          />
        </div>
      </Modal>
    </div>
  );
};

export default IncidentList;

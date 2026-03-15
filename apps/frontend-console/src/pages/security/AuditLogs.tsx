import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, Input, Select, Table, Tag, Button, Card, DatePicker, message, Space, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';
import { fetchAuditLogs, type AuditLogItem, type FetchAuditLogsParams } from '../../api/audit';
import { buildAuditDetailSummary } from './auditDetailSummary';
import { protectedGovernanceUsernames, protectedGovernanceTagLabel } from './securityGovernance';
import {
  isReservedAuditSubjectQuery,
  resolveAuditLogsActionAccess,
} from './auditLogsAuthorization';

const AUDIT_ACTION_OPTIONS = [
  { value: 'auth.login', label: 'auth.login' },
  { value: 'auth.refresh', label: 'auth.refresh' },
  { value: 'auth.logout', label: 'auth.logout' },
  { value: 'auth.register', label: 'auth.register' },
  { value: 'auth.password_reset_request', label: 'auth.password_reset_request' },
  { value: 'auth.password_reset_confirm', label: 'auth.password_reset_confirm' },
  { value: 'users.list', label: 'users.list' },
  { value: 'users.read', label: 'users.read' },
  { value: 'users.create', label: 'users.create' },
  { value: 'users.update', label: 'users.update' },
  { value: 'users.delete', label: 'users.delete' },
  { value: 'users.assign_role', label: 'users.assign_role' },
  { value: 'users.remove_role', label: 'users.remove_role' },
  { value: 'users.batch_status', label: 'users.batch_status' },
  { value: 'roles.list', label: 'roles.list' },
  { value: 'pull_sources.list', label: 'pull_sources.list' },
  { value: 'pull_sources.create', label: 'pull_sources.create' },
  { value: 'pull_sources.update', label: 'pull_sources.update' },
  { value: 'pull_sources.pause', label: 'pull_sources.pause' },
  { value: 'pull_sources.resume', label: 'pull_sources.resume' },
  { value: 'pull_sources.disable', label: 'pull_sources.disable' },
  { value: 'alert_rules.list', label: 'alert_rules.list' },
  { value: 'alert_rules.read', label: 'alert_rules.read' },
  { value: 'alert_rules.create', label: 'alert_rules.create' },
  { value: 'alert_rules.update', label: 'alert_rules.update' },
  { value: 'alert_rules.delete', label: 'alert_rules.delete' },
  { value: 'alert_rules.enable', label: 'alert_rules.enable' },
  { value: 'alert_rules.disable', label: 'alert_rules.disable' },
  { value: 'alert_silences.list', label: 'alert_silences.list' },
  { value: 'alert_silences.create', label: 'alert_silences.create' },
  { value: 'alert_silences.update', label: 'alert_silences.update' },
  { value: 'alert_silences.delete', label: 'alert_silences.delete' },
  { value: 'backup_repositories.list', label: 'backup_repositories.list' },
  { value: 'backup_repositories.create', label: 'backup_repositories.create' },
  { value: 'backup_snapshots.list', label: 'backup_snapshots.list' },
  { value: 'backup_snapshots.read', label: 'backup_snapshots.read' },
  { value: 'backup_snapshots.create', label: 'backup_snapshots.create' },
  { value: 'backup_snapshots.restore', label: 'backup_snapshots.restore' },
  { value: 'backup_snapshots.delete', label: 'backup_snapshots.delete' },
  { value: 'backup_snapshots.cancel', label: 'backup_snapshots.cancel' },
  { value: 'USER_LOGIN', label: 'USER_LOGIN' },
  { value: 'USER_START', label: 'USER_START' },
  { value: 'USER_END', label: 'USER_END' },
  { value: 'CRED_ACQ', label: 'CRED_ACQ' },
  { value: 'CRED_DISP', label: 'CRED_DISP' },
  { value: 'SYSCALL', label: 'SYSCALL' },
  { value: 'ANOM_PROMISCUOUS', label: 'ANOM_PROMISCUOUS' },
  { value: 'CRYPTO_KEY_USER', label: 'CRYPTO_KEY_USER' },
];

const AUDIT_RESOURCE_TYPE_OPTIONS = [
  { value: 'auth', label: 'auth' },
  { value: 'users', label: 'users' },
  { value: 'roles', label: 'roles' },
  { value: 'pull_sources', label: 'pull_sources' },
  { value: 'alert_rules', label: 'alert_rules' },
  { value: 'alert_silences', label: 'alert_silences' },
  { value: 'backup_repositories', label: 'backup_repositories' },
  { value: 'backup_snapshots', label: 'backup_snapshots' },
  { value: 'sshd', label: 'sshd' },
  { value: 'sudo', label: 'sudo' },
  { value: 'dockerd', label: 'dockerd' },
  { value: 'systemd', label: 'systemd' },
  { value: 'chronyd', label: 'chronyd' },
  { value: 'auditd', label: 'auditd' },
];

function resolveActionTagColor(action: string): string {
  const normalized = action.trim().toUpperCase();
  if (!normalized) {
    return 'default';
  }
  if (normalized.includes('ANOM') || normalized.includes('DENIED') || normalized.includes('AVC')) {
    return 'error';
  }
  if (normalized.includes('LOGIN') || normalized.startsWith('USER_') || normalized.startsWith('CRED_')) {
    return 'processing';
  }
  if (normalized.includes('CONFIG') || normalized.includes('SYSCALL')) {
    return 'warning';
  }
  if (normalized.includes('CRYPTO')) {
    return 'purple';
  }
  return 'default';
}

function renderDetail(detail: Record<string, unknown> | undefined, textColor: string): React.ReactNode {
  if (!detail || Object.keys(detail).length === 0) {
    return '—';
  }
  const summary = buildAuditDetailSummary(detail);
  const raw = typeof detail.raw_message === 'string' ? detail.raw_message : JSON.stringify(detail);
  return (
    <Tooltip title={raw}>
      <span style={{ fontSize: 12, color: textColor }}>{summary}</span>
    </Tooltip>
  );
}

const governanceAuditQuickFilters = [
  { label: '系统超级管理员', username: protectedGovernanceUsernames[0] },
  { label: '系统自动化账号', username: protectedGovernanceUsernames[1] },
] as const;

const RESERVED_SUBJECT_DENIED_MESSAGE = '当前会话缺少保留主体审计读取权限';

type AuditLogFiltersSnapshot = {
  userFilter: string;
  actionFilter?: string;
  resourceTypeFilter?: string;
  dateRange: [dayjs.Dayjs | null, dayjs.Dayjs | null];
};

const AuditLogs: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const capabilities = useAuthStore((state) => state.capabilities);
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;
  const initialLoadCompletedRef = useRef(false);

  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<string | undefined>(undefined);
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const actionAccess = useMemo(
    () => resolveAuditLogsActionAccess({ capabilities }),
    [capabilities],
  );
  const missingAuditRestrictions = useMemo(() => {
    const restrictions: string[] = [];
    if (!actionAccess.canReadReservedSubjects) {
      restrictions.push('系统保留账号快速筛选');
    }
    if (!actionAccess.canExportAuditLogs) {
      restrictions.push('审计日志导出');
    }
    return restrictions;
  }, [actionAccess.canExportAuditLogs, actionAccess.canReadReservedSubjects]);

  const loadData = useCallback(async (
    pageOverride?: number,
    pageSizeOverride?: number,
    filtersOverride?: Partial<AuditLogFiltersSnapshot>,
  ) => {
    const currentPage = pageOverride ?? page;
    const currentPageSize = pageSizeOverride ?? pageSize;
    const resolvedFilters: AuditLogFiltersSnapshot = {
      userFilter: filtersOverride?.userFilter ?? userFilter,
      actionFilter: filtersOverride?.actionFilter ?? actionFilter,
      resourceTypeFilter: filtersOverride?.resourceTypeFilter ?? resourceTypeFilter,
      dateRange: filtersOverride?.dateRange ?? dateRange,
    };
    const normalizedUserFilter = resolvedFilters.userFilter.trim();

    if (
      !actionAccess.canReadReservedSubjects &&
      isReservedAuditSubjectQuery(normalizedUserFilter, protectedGovernanceUsernames)
    ) {
      message.warning(RESERVED_SUBJECT_DENIED_MESSAGE);
      setError(RESERVED_SUBJECT_DENIED_MESSAGE);
      setItems([]);
      setTotal(0);
      setPage(currentPage);
      setPageSize(currentPageSize);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params: FetchAuditLogsParams = {
        page: currentPage,
        page_size: currentPageSize,
        user_query: normalizedUserFilter || undefined,
        action: resolvedFilters.actionFilter,
        resource_type: resolvedFilters.resourceTypeFilter,
        from: resolvedFilters.dateRange[0]?.toISOString(),
        to: resolvedFilters.dateRange[1]?.toISOString(),
        sort_by: 'created_at',
        sort_order: 'desc',
      };
      const result = await fetchAuditLogs(params);
      setItems(result.items);
      setTotal(result.total);
      setPage(currentPage);
      setPageSize(currentPageSize);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载审计日志失败';
      message.error(msg);
      setError(msg);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [actionAccess.canReadReservedSubjects, actionFilter, dateRange, page, pageSize, resourceTypeFilter, userFilter]);

  useEffect(() => {
    if (initialLoadCompletedRef.current) {
      return;
    }
    initialLoadCompletedRef.current = true;
    void loadData();
  }, [loadData]);

  const handleSearch = useCallback(() => {
    void loadData(1, pageSize);
  }, [loadData, pageSize]);

  const handleReset = useCallback(() => {
    const nextDateRange: [dayjs.Dayjs | null, dayjs.Dayjs | null] = [null, null];
    setUserFilter('');
    setActionFilter(undefined);
    setResourceTypeFilter(undefined);
    setDateRange(nextDateRange);
    setError(null);
    void loadData(1, 10, {
      userFilter: '',
      actionFilter: undefined,
      resourceTypeFilter: undefined,
      dateRange: nextDateRange,
    });
  }, [loadData]);

  const applyGovernanceQuickFilter = useCallback((username: string) => {
    if (!actionAccess.canReadReservedSubjects) {
      message.warning(RESERVED_SUBJECT_DENIED_MESSAGE);
      return;
    }
    setUserFilter(username);
    setPage(1);
    void loadData(1, pageSize, { userFilter: username });
  }, [actionAccess.canReadReservedSubjects, loadData, pageSize]);

  const handleExportAuditLogs = useCallback(() => {
    if (!actionAccess.canExportAuditLogs) {
      message.warning('当前会话缺少审计导出权限');
      return;
    }
    message.info('审计导出接口接入中，后续将按 audit.log.export 能力创建正式导出任务');
  }, [actionAccess.canExportAuditLogs]);

  const columns: ColumnsType<AuditLogItem> = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: palette.textSecondary }}>
          {text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '—'}
        </span>
      ),
    },
    {
      title: '用户',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 140,
      render: (text: string) => <span style={{ fontWeight: 500, fontSize: 13 }}>{text || '—'}</span>,
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 160,
      render: (action: string) => <Tag color={resolveActionTagColor(action)}>{action || '—'}</Tag>,
    },
    {
      title: '资源类型',
      dataIndex: 'resource_type',
      key: 'resource_type',
      width: 120,
      render: (text: string) => <span style={{ color: palette.textSecondary, fontSize: 13 }}>{text || '—'}</span>,
    },
    {
      title: '资源ID',
      dataIndex: 'resource_id',
      key: 'resource_id',
      width: 140,
      render: (text: string) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: palette.textSecondary }}>{text || '—'}</span>
      ),
    },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 140,
      render: (text: string) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: palette.textSecondary }}>{text || '—'}</span>
      ),
    },
    {
      title: '详情',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
      render: (detail: Record<string, unknown> | undefined) => renderDetail(detail, palette.textSecondary),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ height: 56, padding: '0 24px', borderBottom: `1px solid ${palette.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: isDark ? '#111722' : palette.bgContainer }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>审计日志</h2>
          <Tag style={{ fontSize: 10 }}>Audit Logs</Tag>
        </div>
        <Tooltip title={actionAccess.canExportAuditLogs ? '当前会话已具备审计导出能力；正式导出接口接入后将直接落到导出任务' : '当前会话缺少审计导出权限；正式导出将按 audit.log.export 单独开放'}>
          <span>
            <Button
              disabled={!actionAccess.canExportAuditLogs}
              onClick={handleExportAuditLogs}
              icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>}
            >
              导出日志
            </Button>
          </span>
        </Tooltip>
      </div>

      <div style={{ padding: '16px 24px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Alert
          showIcon
          type="info"
          message="审计治理说明"
          description={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span>
                系统保留账号会持续出现在审计记录中，用于平台治理和自动化归因；筛选时可直接输入{' '}
                <code>{protectedGovernanceUsernames[0]}</code> 或 <code>{protectedGovernanceUsernames[1]}</code>。
              </span>
              <Space wrap>
                {governanceAuditQuickFilters.map((filter) => {
                  const button = (
                    <Button
                      key={filter.username}
                      size="small"
                      onClick={() => applyGovernanceQuickFilter(filter.username)}
                      disabled={!actionAccess.canReadReservedSubjects}
                    >
                      筛选 {filter.label}
                    </Button>
                  );

                  return actionAccess.canReadReservedSubjects ? button : (
                    <Tooltip key={filter.username} title="当前会话缺少 audit.log.read_reserved_subject 能力">
                      <span>{button}</span>
                    </Tooltip>
                  );
                })}
                <Tag color="magenta">{protectedGovernanceTagLabel}账号</Tag>
              </Space>
            </div>
          }
        />
        {missingAuditRestrictions.length > 0 ? (
          <Alert
            showIcon
            type="info"
            message="当前会话存在审计动作限制"
            description={`当前会话仍可查看普通审计记录；${missingAuditRestrictions.join('、')}需要额外能力。`}
          />
        ) : null}
        <Card size="small" style={{ background: palette.bgContainer, borderColor: palette.border }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>用户</div>
              <Input
                name="audit_user_query"
                prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: palette.textSecondary }}>person</span>}
                placeholder="输入用户 / UID / AUID..."
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                allowClear
              />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>操作类型</div>
              <Select
                placeholder="全部"
                value={actionFilter}
                onChange={setActionFilter}
                allowClear
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                options={AUDIT_ACTION_OPTIONS}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>资源类型</div>
              <Select
                placeholder="全部"
                value={resourceTypeFilter}
                onChange={setResourceTypeFilter}
                allowClear
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                options={AUDIT_RESOURCE_TYPE_OPTIONS}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>时间范围</div>
              <DatePicker.RangePicker
                id={{ start: 'audit_start_time', end: 'audit_end_time' }}
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
                showTime
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                type="primary"
                onClick={handleSearch}
                loading={loading}
                icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>search</span>}
              >
                查询
              </Button>
              <Button
                onClick={handleReset}
                icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>}
              >
                重置
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
        <Table<AuditLogItem>
          columns={columns}
          dataSource={items}
          rowKey="id"
          size="middle"
          loading={loading}
          locale={{ emptyText: error || '暂无数据' }}
          pagination={{
            current: page,
            pageSize,
            total,
            showTotal: (t, range) => `显示 ${range[0]} 到 ${range[1]} 条，共 ${t} 条记录`,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            onChange: (nextPage, nextPageSize) => {
              void loadData(nextPage, nextPageSize ?? pageSize);
            },
          }}
        />
      </div>
    </div>
  );
};

export default AuditLogs;

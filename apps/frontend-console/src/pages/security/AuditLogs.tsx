import React, { useState, useCallback, useEffect } from 'react';
import { Input, Select, Table, Tag, Button, Card, DatePicker, message, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';
import { fetchAuditLogs, type AuditLogItem, type FetchAuditLogsParams } from '../../api/audit';
import dayjs from 'dayjs';

const AUDIT_ACTION_OPTIONS = [
  { value: 'auth.login', label: 'auth.login' },
  { value: 'auth.logout', label: 'auth.logout' },
  { value: 'auth.register', label: 'auth.register' },
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
  const sourceKind = typeof detail.source_kind === 'string' ? detail.source_kind : '';
  const pairs = [
    sourceKind === 'application' ? '应用审计' : '',
    sourceKind === 'system' ? '系统审计' : '',
    detail.operation ? `op=${String(detail.operation)}` : '',
    detail.result ? `res=${String(detail.result)}` : '',
    detail.username ? `user=${String(detail.username)}` : '',
    detail.target_user_id ? `target=${String(detail.target_user_id)}` : '',
    detail.source_name ? `source=${String(detail.source_name)}` : '',
    detail.target_source_id ? `source_id=${String(detail.target_source_id)}` : '',
    detail.role_id ? `role=${String(detail.role_id)}` : '',
    detail.protocol ? `proto=${String(detail.protocol)}` : '',
    detail.host ? `host=${String(detail.host)}` : '',
    detail.status ? `status=${String(detail.status)}` : '',
    detail.process ? `proc=${String(detail.process)}` : '',
    detail.pid ? `pid=${String(detail.pid)}` : '',
    detail.sequence ? `seq=${String(detail.sequence)}` : '',
    detail.error_code ? `code=${String(detail.error_code)}` : '',
  ].filter(Boolean);
  const summary = pairs.join(' · ') || String(detail.raw_message ?? '—');
  const raw = typeof detail.raw_message === 'string' ? detail.raw_message : JSON.stringify(detail);
  return (
    <Tooltip title={raw}>
      <span style={{ fontSize: 12, color: textColor }}>{summary}</span>
    </Tooltip>
  );
}

const AuditLogs: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

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

  const loadData = useCallback(async (pageOverride?: number, pageSizeOverride?: number) => {
    setLoading(true);
    setError(null);
    const currentPage = pageOverride ?? page;
    const currentPageSize = pageSizeOverride ?? pageSize;
    try {
      const params: FetchAuditLogsParams = {
        page: currentPage,
        page_size: currentPageSize,
        user_id: userFilter.trim() || undefined,
        action: actionFilter,
        resource_type: resourceTypeFilter,
        from: dateRange[0]?.toISOString(),
        to: dateRange[1]?.toISOString(),
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
  }, [page, pageSize, userFilter, actionFilter, resourceTypeFilter, dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearch = useCallback(() => {
    loadData(1, pageSize);
  }, [loadData, pageSize]);

  const handleReset = useCallback(() => {
    setUserFilter('');
    setActionFilter(undefined);
    setResourceTypeFilter(undefined);
    setDateRange([null, null]);
    void loadData(1, 10);
  }, [loadData]);

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
      </div>

      <div style={{ padding: '16px 24px', flexShrink: 0 }}>
        <Card size="small" style={{ background: palette.bgContainer, borderColor: palette.border }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>用户</div>
              <Input
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

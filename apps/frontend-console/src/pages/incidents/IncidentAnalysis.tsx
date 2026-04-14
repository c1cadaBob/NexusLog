import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Empty, Input, Select, Space, Table, Tag, Tooltip, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchIncidents } from '../../api/incident';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { useThemeStore } from '../../stores/themeStore';
import { usePaginationQuickJumperAccessibility } from '../../components/common/usePaginationQuickJumperAccessibility';
import { COLORS } from '../../theme/tokens';
import type { Incident, IncidentSeverity, IncidentStatus } from '../../types/incident';
import { useAuthStore } from '../../stores/authStore';
import {
  getIncidentPermissionDeniedReason,
  resolveIncidentActionAccess,
} from './incidentAuthorization';
import AnalysisPageHeader from '../../components/common/AnalysisPageHeader';

const SEVERITY_CONFIG: Record<IncidentSeverity, { color: string; label: string }> = {
  P0: { color: COLORS.danger, label: 'P0 紧急' },
  P1: { color: '#f97316', label: 'P1 严重' },
  P2: { color: COLORS.warning, label: 'P2 一般' },
  P3: { color: COLORS.info, label: 'P3 提示' },
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

function summarizeText(value?: string, maxLength: number = 64): string {
  const normalized = (value || '').trim();
  if (!normalized) return '-';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}

function formatDateTime(timestamp?: number | null): string {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString('zh-CN');
}

const IncidentAnalysis: React.FC = () => {
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const permissions = useAuthStore((state) => state.permissions);
  const capabilities = useAuthStore((state) => state.capabilities);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'all'>('all');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const tableRef = usePaginationQuickJumperAccessibility('incident-analysis');
  const authorization = useMemo(() => ({ permissions, capabilities }), [capabilities, permissions]);
  const actionAccess = useMemo(() => resolveIncidentActionAccess(authorization), [authorization]);

  const storedPageSize = usePreferencesStore((s) => s.pageSizes['incidentAnalysis'] ?? 20);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeState] = useState(storedPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setStoredPageSize('incidentAnalysis', size);
  }, [setStoredPageSize]);

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: { status?: string; severity?: string; query?: string } = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (severityFilter !== 'all') filters.severity = severityFilter;
      if (search.trim()) filters.query = search.trim();
      const response = await fetchIncidents(currentPage, pageSize, filters);
      setIncidents(response.items);
      setTotal(response.total);
      setLastUpdatedAt(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载根因分析列表失败';
      setError(msg);
      setIncidents([]);
      setTotal(0);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, search, severityFilter, statusFilter]);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  const stats = useMemo(() => {
    const withRootCause = incidents.filter((incident) => Boolean(incident.rootCause?.trim())).length;
    const withResolution = incidents.filter((incident) => Boolean(incident.resolution?.trim())).length;
    const archived = incidents.filter((incident) => incident.status === 'archived').length;
    return [
      { label: '当前筛选事件', value: total, icon: 'assignment', color: COLORS.primary },
      { label: '当前页已填根因', value: withRootCause, icon: 'biotech', color: '#8b5cf6' },
      { label: '当前页已填方案', value: withResolution, icon: 'build', color: COLORS.success },
      { label: '当前页已归档', value: archived, icon: 'archive', color: '#64748b' },
    ];
  }, [incidents, total]);

  const columns: ColumnsType<Incident> = useMemo(() => [
    {
      title: '事件 ID',
      dataIndex: 'id',
      key: 'id',
      width: 180,
      render: (value: string) => (
        <Tooltip title={actionAccess.canReadIncident ? '查看详情' : getIncidentPermissionDeniedReason('read')}>
          <Button type="link" size="small" disabled={!actionAccess.canReadIncident} className="font-mono text-xs p-0" onClick={() => navigate(`/incidents/detail/${value}`)}>
            {value}
          </Button>
        </Tooltip>
      ),
    },
    {
      title: '级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (value: IncidentSeverity) => <Tag color={SEVERITY_CONFIG[value].color}>{SEVERITY_CONFIG[value].label}</Tag>,
    },
    {
      title: '事件标题',
      dataIndex: 'title',
      key: 'title',
      render: (value: string, record: Incident) => (
        <div>
          <div className="text-sm font-medium">{value}</div>
          <div className="text-xs opacity-50 mt-0.5">{record.source}</div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: IncidentStatus) => <Tag color={STATUS_CONFIG[value].color}>{STATUS_CONFIG[value].label}</Tag>,
    },
    {
      title: '根因概述',
      dataIndex: 'rootCause',
      key: 'rootCause',
      render: (value?: string) => <span className="text-xs">{summarizeText(value)}</span>,
    },
    {
      title: '处置方案',
      dataIndex: 'resolution',
      key: 'resolution',
      render: (value?: string) => <span className="text-xs">{summarizeText(value)}</span>,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (value: number) => <span className="text-xs opacity-70">{formatDateTime(value)}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: Incident) => (
        <Tooltip title={actionAccess.canReadIncident ? '查看详情并补充分析' : getIncidentPermissionDeniedReason('read')}>
          <Button
            type="link"
            size="small"
            disabled={!actionAccess.canReadIncident}
            icon={<span className="material-symbols-outlined text-sm">open_in_new</span>}
            onClick={() => navigate(`/incidents/detail/${record.id}`)}
          />
        </Tooltip>
      ),
    },
  ], [actionAccess.canReadIncident, navigate]);

  return (
    <div className="flex flex-col gap-4">
      <AnalysisPageHeader
        title="根因分析"
        subtitle="仅展示后端真实返回的根因、处置和归档分析结果"
        lastUpdatedAt={lastUpdatedAt}
        actions={(
          <>
            <Button size="small" onClick={() => navigate('/help/faq')} icon={<span className="material-symbols-outlined text-sm">support_agent</span>}>
              帮助
            </Button>
            <Button size="small" onClick={() => void loadIncidents()} icon={<span className="material-symbols-outlined text-sm">refresh</span>}>
              刷新数据
            </Button>
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

      <Card size="small" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
        <div className="text-xs leading-6 opacity-70">
          当前页面仅保留事件接口已返回的根因描述、处置方案与归档结果；不再展示前端按关键词临时推导的根因分类，避免与后端真实分析能力混淆。
        </div>
      </Card>

      <div className="flex items-center gap-3 flex-wrap">
        <Input.Search
          id="incident-analysis-search"
          name="incident-analysis-search"
          autoComplete="off"
          placeholder="按事件 ID、标题、根因、处置方案搜索..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setCurrentPage(1);
          }}
          allowClear
          style={{ flex: 1, minWidth: 260 }}
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
          style={{ width: 160 }}
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

      {error ? (
        <Empty description={error} />
      ) : (
        <div ref={tableRef}>
          <Table<Incident>
            rowKey="id"
            columns={columns}
            dataSource={incidents}
            loading={loading}
            pagination={{
              current: currentPage,
              pageSize,
              total,
              showSizeChanger: true,
              showQuickJumper: total > pageSize,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (count, range) => `显示 ${range[0]}-${range[1]} 条，共 ${count} 条`,
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
            scroll={{ x: 1200 }}
            locale={{ emptyText: loading ? '加载中...' : '暂无分析数据' }}
          />
        </div>
      )}
    </div>
  );
};

export default IncidentAnalysis;

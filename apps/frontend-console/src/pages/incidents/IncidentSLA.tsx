import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Empty, Input, Progress, Select, Table, Tag, Tooltip, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchIncidents, fetchSLASummary, type SLASummary } from '../../api/incident';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import {
  getIncidentPermissionDeniedReason,
  resolveIncidentActionAccess,
} from './incidentAuthorization';
import { usePaginationQuickJumperAccessibility } from '../../components/common/usePaginationQuickJumperAccessibility';
import { COLORS } from '../../theme/tokens';
import type { Incident, IncidentSeverity, IncidentStatus } from '../../types/incident';
import AnalysisPageHeader from '../../components/common/AnalysisPageHeader';

const SEVERITY_COLOR: Record<IncidentSeverity, string> = {
  P0: COLORS.danger,
  P1: '#f97316',
  P2: COLORS.warning,
  P3: COLORS.info,
};

interface SlaRow {
  incident: Incident;
  ackMinutes: number | null;
  resolveMinutes: number | null;
  mtta: number | null;
  mttr: number | null;
  ackBreached: boolean | null;
  resolveBreached: boolean | null;
}

function formatDurationMs(value: number | null): string {
  if (value === null) return '-';
  const minutes = Math.floor(value / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatDurationMinutes(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  if (value < 60) return `${Math.round(value)}m`;
  const hours = Math.floor(value / 60);
  return `${hours}h ${Math.round(value % 60)}m`;
}

function buildSlaRow(incident: Incident, now: number): SlaRow {
  const ackMinutes = typeof incident.slaResponseMinutes === 'number' ? incident.slaResponseMinutes : null;
  const resolveMinutes = typeof incident.slaResolveMinutes === 'number' ? incident.slaResolveMinutes : null;
  const startAt = incident.alertedAt ?? incident.detectedAt;
  const mtta = incident.ackedAt ? Math.max(incident.ackedAt - startAt, 0) : null;
  const mttr = incident.resolvedAt ? Math.max(incident.resolvedAt - startAt, 0) : null;

  const ackBreached = ackMinutes === null
    ? null
    : mtta !== null
      ? mtta > ackMinutes * 60000
      : ['alerted'].includes(incident.status) && now - startAt > ackMinutes * 60000;

  const resolveBreached = resolveMinutes === null
    ? null
    : mttr !== null
      ? mttr > resolveMinutes * 60000
      : ['alerted', 'acknowledged', 'analyzing'].includes(incident.status) && now - startAt > resolveMinutes * 60000;

  return {
    incident,
    ackMinutes,
    resolveMinutes,
    mtta,
    mttr,
    ackBreached,
    resolveBreached,
  };
}

const IncidentSLA: React.FC = () => {
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const permissions = useAuthStore((state) => state.permissions);
  const capabilities = useAuthStore((state) => state.capabilities);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'all'>('all');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [summary, setSummary] = useState<SLASummary>({ totalIncidents: 0, compliantIncidents: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const tableRef = usePaginationQuickJumperAccessibility('incident-sla');
  const authorization = useMemo(() => ({ permissions, capabilities }), [capabilities, permissions]);
  const actionAccess = useMemo(() => resolveIncidentActionAccess(authorization), [authorization]);

  const storedPageSize = usePreferencesStore((s) => s.pageSizes['incidentSla'] ?? 20);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeState] = useState(storedPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setStoredPageSize('incidentSla', size);
  }, [setStoredPageSize]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: { status?: string; severity?: string; query?: string } = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (severityFilter !== 'all') filters.severity = severityFilter;
      if (search.trim()) filters.query = search.trim();
      const [incidentResponse, slaSummary] = await Promise.all([
        fetchIncidents(currentPage, pageSize, filters),
        fetchSLASummary(),
      ]);
      setIncidents(incidentResponse.items);
      setTotal(incidentResponse.total);
      setSummary(slaSummary);
      setLastUpdatedAt(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载 SLA 页面失败';
      setError(msg);
      setIncidents([]);
      setTotal(0);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, search, severityFilter, statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const rows = useMemo(() => {
    const now = Date.now();
    return incidents.map((incident) => buildSlaRow(incident, now));
  }, [incidents]);

  const hasEventLevelAckSla = useMemo(
    () => rows.some((row) => row.ackMinutes !== null),
    [rows],
  );

  const hasEventLevelResolveSla = useMemo(
    () => rows.some((row) => row.resolveMinutes !== null),
    [rows],
  );

  const columns: ColumnsType<SlaRow> = useMemo(() => {
    const nextColumns: ColumnsType<SlaRow> = [
    {
      title: '事件 ID',
      key: 'incidentId',
      width: 180,
      render: (_: unknown, record: SlaRow) => (
        <Tooltip title={actionAccess.canReadIncident ? '查看详情' : getIncidentPermissionDeniedReason('read')}>
          <Button type="link" size="small" disabled={!actionAccess.canReadIncident} className="font-mono text-xs p-0" onClick={() => navigate(`/incidents/detail/${record.incident.id}`)}>
            {record.incident.id}
          </Button>
        </Tooltip>
      ),
    },
    {
      title: '事件标题',
      key: 'title',
      render: (_: unknown, record: SlaRow) => (
        <div>
          <div className="text-sm">{record.incident.title}</div>
          <Tag color={SEVERITY_COLOR[record.incident.severity]} style={{ marginTop: 4 }}>
            {record.incident.severity}
          </Tag>
        </div>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 90,
      render: (_: unknown, record: SlaRow) => <span className="text-xs">{record.incident.status}</span>,
    },
    {
      title: 'MTTA',
      key: 'mtta',
      width: 120,
      render: (_: unknown, record: SlaRow) => <span className="font-mono text-xs">{formatDurationMs(record.mtta)}</span>,
    },
    {
      title: 'MTTR',
      key: 'mttr',
      width: 120,
      render: (_: unknown, record: SlaRow) => <span className="font-mono text-xs">{formatDurationMs(record.mttr)}</span>,
    },
    ];

    if (hasEventLevelAckSla) {
      nextColumns.push({
        title: '响应 SLA',
        key: 'ackSla',
        width: 180,
        render: (_: unknown, record: SlaRow) => {
          if (record.ackMinutes === null) {
            return (
              <div className="flex flex-col gap-1">
                <Tag color="default" style={{ width: 'fit-content' }}>未配置</Tag>
                <span className="text-[11px] opacity-60">后端未返回响应 SLA</span>
              </div>
            );
          }

          const percent = record.mtta === null ? 0 : Math.min(100, Math.round((record.mtta / (record.ackMinutes * 60000)) * 100));
          return (
            <div className="flex flex-col gap-1">
              <Tag color={record.ackBreached ? 'error' : 'success'} style={{ width: 'fit-content' }}>
                {record.ackBreached ? '已超时' : '达标'}
              </Tag>
              <Progress percent={percent} size="small" showInfo={false} status={record.ackBreached ? 'exception' : 'active'} />
              <span className="text-[11px] opacity-60">SLA {record.ackMinutes} 分钟</span>
            </div>
          );
        },
      });
    }

    if (hasEventLevelResolveSla) {
      nextColumns.push({
        title: '解决 SLA',
        key: 'resolveSla',
        width: 180,
        render: (_: unknown, record: SlaRow) => {
          if (record.resolveMinutes === null) {
            return (
              <div className="flex flex-col gap-1">
                <Tag color="default" style={{ width: 'fit-content' }}>未配置</Tag>
                <span className="text-[11px] opacity-60">后端未返回解决 SLA</span>
              </div>
            );
          }

          const percent = record.mttr === null ? 0 : Math.min(100, Math.round((record.mttr / (record.resolveMinutes * 60000)) * 100));
          return (
            <div className="flex flex-col gap-1">
              <Tag color={record.resolveBreached ? 'error' : 'success'} style={{ width: 'fit-content' }}>
                {record.resolveBreached ? '已超时' : '达标'}
              </Tag>
              <Progress percent={percent} size="small" showInfo={false} status={record.resolveBreached ? 'exception' : 'active'} />
              <span className="text-[11px] opacity-60">SLA {record.resolveMinutes} 分钟</span>
            </div>
          );
        },
      });
    }

    return nextColumns;
  }, [actionAccess.canReadIncident, hasEventLevelAckSla, hasEventLevelResolveSla, navigate]);

  const cards = useMemo(() => ([
    { label: '总事件数', value: summary.totalIncidents, icon: 'assignment', color: COLORS.primary },
    { label: 'SLA 达标事件', value: summary.compliantIncidents, icon: 'verified', color: COLORS.success },
    { label: '平均 MTTA', value: formatDurationMinutes(summary.avgResponseMinutes), icon: 'schedule', color: COLORS.warning },
    { label: '平均 MTTR', value: formatDurationMinutes(summary.avgResolveMinutes), icon: 'avg_pace', color: '#8b5cf6' },
  ]), [summary]);

  return (
    <div className="flex flex-col gap-4">
      <AnalysisPageHeader
        title="SLA 监控"
        subtitle="仅展示后端真实返回的事件时效与 SLA 汇总"
        lastUpdatedAt={lastUpdatedAt}
        actions={(
          <>
            <Button size="small" onClick={() => navigate('/help/faq')} icon={<span className="material-symbols-outlined text-sm">support_agent</span>}>
              帮助
            </Button>
            <Button size="small" onClick={() => void loadData()} icon={<span className="material-symbols-outlined text-sm">refresh</span>}>
              刷新数据
            </Button>
          </>
        )}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card) => (
          <Card key={card.label} size="small" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }} styles={{ body: { padding: '12px 16px' } }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs opacity-50 mb-1">{card.label}</div>
                <div className="text-xl font-bold font-mono" style={{ color: card.color }}>{card.value}</div>
              </div>
              <span className="material-symbols-outlined text-xl" style={{ color: card.color, opacity: 0.5 }}>{card.icon}</span>
            </div>
          </Card>
        ))}
      </div>

      <Card size="small" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
        <div className="text-xs leading-6 opacity-70">
          当前页面仅保留后端已返回的 SLA 汇总与事件时效数据。若事件详情接口未返回响应 / 解决阈值，则不展示本地默认策略与升级层级，避免与系统真实能力不一致。
        </div>
      </Card>

      <div className="flex items-center gap-3 flex-wrap">
        <Input.Search
          id="incident-sla-search"
          name="incident-sla-search"
          autoComplete="off"
          placeholder="按事件 ID、标题、负责人搜索..."
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
          <Table<SlaRow>
            rowKey={(row) => row.incident.id}
            columns={columns}
            dataSource={rows}
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
            scroll={{ x: 1280 }}
            locale={{ emptyText: loading ? '加载中...' : '暂无 SLA 数据' }}
          />
        </div>
      )}
    </div>
  );
};

export default IncidentSLA;

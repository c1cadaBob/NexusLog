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
import type { Incident, IncidentSeverity, IncidentStatus, SLAConfig } from '../../types/incident';

const SLA_CONFIGS: SLAConfig[] = [
  { severity: 'P0', maxAckMinutes: 5, maxResolveMinutes: 60, escalationRules: [
    { afterMinutes: 5, fromLevel: 1, toLevel: 2, notifyChannels: ['钉钉', '电话'] },
    { afterMinutes: 15, fromLevel: 2, toLevel: 3, notifyChannels: ['钉钉', '电话', '短信'] },
  ] },
  { severity: 'P1', maxAckMinutes: 15, maxResolveMinutes: 240, escalationRules: [
    { afterMinutes: 15, fromLevel: 1, toLevel: 2, notifyChannels: ['钉钉'] },
    { afterMinutes: 60, fromLevel: 2, toLevel: 3, notifyChannels: ['钉钉', '电话'] },
  ] },
  { severity: 'P2', maxAckMinutes: 30, maxResolveMinutes: 480, escalationRules: [
    { afterMinutes: 30, fromLevel: 1, toLevel: 2, notifyChannels: ['钉钉'] },
  ] },
  { severity: 'P3', maxAckMinutes: 120, maxResolveMinutes: 1440, escalationRules: [] },
];

const SEVERITY_COLOR: Record<IncidentSeverity, string> = {
  P0: COLORS.danger,
  P1: '#f97316',
  P2: COLORS.warning,
  P3: COLORS.info,
};

interface SlaRow {
  incident: Incident;
  ackMinutes: number;
  resolveMinutes: number;
  mtta: number | null;
  mttr: number | null;
  ackBreached: boolean;
  resolveBreached: boolean;
  currentEscalation: number;
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

function getSlaConfig(severity: IncidentSeverity): SLAConfig {
  return SLA_CONFIGS.find((config) => config.severity === severity) ?? SLA_CONFIGS[SLA_CONFIGS.length - 1];
}

function buildSlaRow(incident: Incident, now: number): SlaRow {
  const config = getSlaConfig(incident.severity);
  const ackMinutes = incident.slaResponseMinutes ?? config.maxAckMinutes;
  const resolveMinutes = incident.slaResolveMinutes ?? config.maxResolveMinutes;
  const startAt = incident.alertedAt ?? incident.detectedAt;
  const mtta = incident.ackedAt ? Math.max(incident.ackedAt - startAt, 0) : null;
  const mttr = incident.resolvedAt ? Math.max(incident.resolvedAt - startAt, 0) : null;

  const ackBreached = mtta !== null
    ? mtta > ackMinutes * 60000
    : ['alerted'].includes(incident.status) && now - startAt > ackMinutes * 60000;

  const resolveBreached = mttr !== null
    ? mttr > resolveMinutes * 60000
    : ['alerted', 'acknowledged', 'analyzing'].includes(incident.status) && now - startAt > resolveMinutes * 60000;

  const elapsedMinutes = Math.max(Math.floor((now - startAt) / 60000), 0);
  const currentEscalation = config.escalationRules.reduce((level, rule) => {
    if (elapsedMinutes >= rule.afterMinutes) {
      return Math.max(level, rule.toLevel);
    }
    return level;
  }, 1);

  return {
    incident,
    ackMinutes,
    resolveMinutes,
    mtta,
    mttr,
    ackBreached,
    resolveBreached,
    currentEscalation,
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

  const columns: ColumnsType<SlaRow> = useMemo(() => [
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
    {
      title: '响应 SLA',
      key: 'ackSla',
      width: 180,
      render: (_: unknown, record: SlaRow) => {
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
    },
    {
      title: '解决 SLA',
      key: 'resolveSla',
      width: 180,
      render: (_: unknown, record: SlaRow) => {
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
    },
    {
      title: '升级层级',
      key: 'escalation',
      width: 100,
      render: (_: unknown, record: SlaRow) => <Tag color={record.currentEscalation >= 3 ? 'error' : record.currentEscalation >= 2 ? 'warning' : 'processing'}>L{record.currentEscalation}</Tag>,
    },
  ], [actionAccess.canReadIncident, navigate]);

  const cards = useMemo(() => ([
    { label: '总事件数', value: summary.totalIncidents, icon: 'assignment', color: COLORS.primary },
    { label: 'SLA 达标事件', value: summary.compliantIncidents, icon: 'verified', color: COLORS.success },
    { label: '平均 MTTA', value: formatDurationMinutes(summary.avgResponseMinutes), icon: 'schedule', color: COLORS.warning },
    { label: '平均 MTTR', value: formatDurationMinutes(summary.avgResolveMinutes), icon: 'avg_pace', color: '#8b5cf6' },
  ]), [summary]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-lg font-semibold">SLA 监控</div>
          <div className="text-xs opacity-50 mt-1">展示真实事件的响应/解决时效与升级层级</div>
        </div>
        <Button onClick={() => void loadData()} icon={<span className="material-symbols-outlined text-sm">refresh</span>}>
          刷新
        </Button>
      </div>

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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {SLA_CONFIGS.map((config) => (
            <div key={config.severity} className="rounded border px-3 py-3" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
              <div className="flex items-center justify-between mb-2">
                <Tag color={SEVERITY_COLOR[config.severity]} style={{ margin: 0 }}>{config.severity}</Tag>
                <span className="text-xs opacity-50">默认策略</span>
              </div>
              <div className="text-xs opacity-70">响应 SLA：{config.maxAckMinutes} 分钟</div>
              <div className="text-xs opacity-70 mt-1">解决 SLA：{config.maxResolveMinutes} 分钟</div>
              <div className="text-xs opacity-50 mt-2">升级规则：{config.escalationRules.length > 0 ? `${config.escalationRules.length} 条` : '无'}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-3 flex-wrap">
        <Input.Search
          id="incident-sla-search"
          name="incident-sla-search"
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
            scroll={{ x: 1400 }}
            locale={{ emptyText: loading ? '加载中...' : '暂无 SLA 数据' }}
          />
        </div>
      )}
    </div>
  );
};

export default IncidentSLA;

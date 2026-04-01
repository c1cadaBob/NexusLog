import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Tag, Input, Select, Button, Card, Tooltip, Badge, Spin, Empty, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { COLORS } from '../../theme/tokens';
import type { Incident, IncidentStatus, IncidentSeverity } from '../../types/incident';
import { fetchIncidents, fetchSLASummary, createIncident } from '../../api/incident';
import type { CreateIncidentPayload } from '../../api/incident';
import { usePaginationQuickJumperAccessibility } from '../../components/common/usePaginationQuickJumperAccessibility';

// ============================================================================
// 映射工具
// ============================================================================

const SEVERITY_CONFIG: Record<IncidentSeverity, { color: string; label: string; icon: string }> = {
  P0: { color: COLORS.danger, label: 'P0 紧急', icon: 'crisis_alert' },
  P1: { color: '#f97316', label: 'P1 严重', icon: 'error' },
  P2: { color: COLORS.warning, label: 'P2 一般', icon: 'warning' },
  P3: { color: COLORS.info, label: 'P3 提示', icon: 'info' },
};

const STATUS_CONFIG: Record<IncidentStatus, { color: string; label: string; step: number }> = {
  detected: { color: 'default', label: '已检测', step: 0 },
  alerted: { color: 'orange', label: '已告警', step: 1 },
  acknowledged: { color: 'blue', label: '已响应', step: 2 },
  analyzing: { color: 'processing', label: '分析中', step: 3 },
  mitigated: { color: 'cyan', label: '已止损', step: 4 },
  resolved: { color: 'success', label: '已解决', step: 5 },
  postmortem: { color: 'purple', label: '复盘中', step: 6 },
  archived: { color: 'default', label: '已归档', step: 7 },
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

// ============================================================================
// IncidentList 主组件
// ============================================================================

const IncidentList: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const navigate = useNavigate();

  // 筛选状态
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'all'>('all');

  // 数据状态
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 统计
  const [stats, setStats] = useState<{ label: string; value: number; icon: string; color: string }[]>([]);

  // 分页
  const [currentPage, setCurrentPage] = useState(1);
  const storedPageSize = usePreferencesStore((s) => s.pageSizes['incidentList'] ?? 20);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeLocal(size);
    setStoredPageSize('incidentList', size);
  }, [setStoredPageSize]);
  const incidentsTableRef = usePaginationQuickJumperAccessibility('incident-list');

  // 加载事件列表
  const loadIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: { status?: string; severity?: string; query?: string } = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (severityFilter !== 'all') filters.severity = severityFilter;
      if (search.trim()) filters.query = search.trim();

      const { items, total: t } = await fetchIncidents(currentPage, pageSize, filters);
      setIncidents(items);
      setTotal(t);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载事件列表失败';
      setError(msg);
      message.error(msg);
      setIncidents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, search, statusFilter, severityFilter]);

  // 加载 SLA 统计（基于当前页数据 + SLA 汇总）
  const loadStats = useCallback(async () => {
    try {
      const sla = await fetchSLASummary();
      const openCount = incidents.filter((i) => !['resolved', 'postmortem', 'archived'].includes(i.status)).length;
      const p0Count = incidents.filter((i) => i.severity === 'P0' && i.status !== 'archived').length;
      const unackedCount = incidents.filter((i) => i.status === 'alerted').length;
      const pendingPostmortem = incidents.filter((i) => i.status === 'postmortem').length;

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
  }, [incidents]);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // 创建事件
  const handleCreateIncident = useCallback(async () => {
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
      const msg = err instanceof Error ? err.message : '创建事件失败';
      message.error(msg);
    }
  }, [navigate]);

  // 表格列
  const columns: ColumnsType<Incident> = useMemo(() => [
    {
      title: '事件 ID',
      dataIndex: 'id',
      key: 'id',
      width: 180,
      render: (v: string) => (
        <Button type="link" size="small" className="font-mono text-xs p-0" onClick={(e) => { e.stopPropagation(); navigate(`/incidents/detail/${v}`); }}>
          {v}
        </Button>
      ),
    },
    {
      title: '级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (v: IncidentSeverity) => {
        const cfg = SEVERITY_CONFIG[v];
        return (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-base" style={{ color: cfg.color }}>{cfg.icon}</span>
            <span className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
          </span>
        );
      },
    },
    {
      title: '事件标题',
      dataIndex: 'title',
      key: 'title',
      render: (v: string, record: Incident) => (
        <div>
          <div className="text-sm font-medium">{v}</div>
          <div className="text-xs opacity-50 mt-0.5">{record.source} · 影响 {record.affectedServices.length} 个服务</div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: IncidentStatus) => {
        const cfg = STATUS_CONFIG[v];
        return <Tag color={cfg.color} style={{ margin: 0 }}>{cfg.label}</Tag>;
      },
    },
    {
      title: '负责人',
      dataIndex: 'assignee',
      key: 'assignee',
      width: 100,
      render: (v: string) => v || <span className="text-xs opacity-40">未分配</span>,
    },
    {
      title: 'MTTA',
      key: 'mtta',
      width: 80,
      render: (_: unknown, r: Incident) => (
        <span className="font-mono text-xs">{calcDuration(r.alertedAt, r.ackedAt)}</span>
      ),
    },
    {
      title: 'MTTR',
      key: 'mttr',
      width: 80,
      render: (_: unknown, r: Incident) => (
        <span className="font-mono text-xs">{calcDuration(r.alertedAt, r.resolvedAt)}</span>
      ),
    },
    {
      title: '检测时间',
      dataIndex: 'detectedAt',
      key: 'detectedAt',
      width: 120,
      sorter: (a, b) => a.detectedAt - b.detectedAt,
      defaultSortOrder: 'descend',
      render: (v: number) => <span className="text-xs opacity-70">{formatTime(v)}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: Incident) => (
        <Tooltip title="查看详情">
          <Button
            type="link"
            size="small"
            icon={<span className="material-symbols-outlined text-sm">open_in_new</span>}
            onClick={(e) => { e.stopPropagation(); navigate(`/incidents/detail/${record.id}`); }}
          />
        </Tooltip>
      ),
    },
  ], [navigate]);

  return (
    <div className="flex flex-col gap-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold">事件管理</span>
          {stats.length > 0 && <Badge count={stats[0].value} style={{ backgroundColor: COLORS.danger }} />}
        </div>
        <Button type="primary" icon={<span className="material-symbols-outlined text-sm">add</span>} onClick={handleCreateIncident}>
          创建事件
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label} size="small" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }} styles={{ body: { padding: '16px 20px' } }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs opacity-50 mb-1">{s.label}</div>
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
              </div>
              <span className="material-symbols-outlined text-2xl" style={{ color: s.color, opacity: 0.6 }}>{s.icon}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input.Search
          id="incident-list-search"
          name="incident-list-search"
          placeholder="按事件 ID、标题、来源搜索..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          allowClear
          style={{ flex: 1, minWidth: 200 }}
        />
        <Select
          value={severityFilter}
          onChange={(v) => { setSeverityFilter(v); setCurrentPage(1); }}
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
          onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
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

      {/* 事件表格 — 点击行跳转详情页 */}
      {error ? (
        <Empty description={error} />
      ) : (
        <div ref={incidentsTableRef}>
          <Table<Incident>
            dataSource={incidents}
            columns={columns}
            rowKey="id"
            size="small"
            loading={loading}
            pagination={{
              current: currentPage,
              pageSize,
              total,
              showSizeChanger: true,
              showQuickJumper: total > pageSize,
              showTotal: (t, range) => `显示 ${range[0]}-${range[1]} 条，共 ${t} 条`,
              pageSizeOptions: ['10', '20', '50'],
              onChange: (page, size) => { setCurrentPage(page); setPageSize(size); },
              position: ['bottomLeft'],
            }}
            onRow={(record) => ({
              onClick: () => navigate(`/incidents/detail/${record.id}`),
              style: { cursor: 'pointer' },
            })}
            scroll={{ x: 1000 }}
            locale={{ emptyText: loading ? <Spin size="small" /> : <Empty description="暂无事件" /> }}
          />
        </div>
      )}
    </div>
  );
};

export default IncidentList;

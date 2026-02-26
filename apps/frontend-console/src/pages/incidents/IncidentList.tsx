import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Tag, Input, Select, Button, Card, Tooltip, Badge } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { COLORS } from '../../theme/tokens';
import type { Incident, IncidentStatus, IncidentSeverity } from '../../types/incident';

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
// 模拟数据
// ============================================================================

const now = Date.now();
const MOCK_INCIDENTS: Incident[] = [
  {
    id: 'INC-20260220-001', title: 'payment-service 高错误率', description: '支付服务错误率飙升至 12.3%，影响订单处理',
    severity: 'P0', status: 'acknowledged', source: 'payment-service', fingerprint: 'fp-pay-err-001',
    assignee: '张运维', escalationLevel: 2,
    detectedAt: now - 1800000, alertedAt: now - 1740000, ackedAt: now - 1500000,
    mitigatedAt: null, resolvedAt: null, archivedAt: null,
    alertIds: ['alert-001', 'alert-005'], logBundleIds: ['lb-001'], affectedServices: ['payment-service', 'order-service'],
    affectedUsers: 1250, tags: ['支付', '高优先级'], createdAt: now - 1800000, updatedAt: now - 1500000,
  },
  {
    id: 'INC-20260220-002', title: 'node-03 磁盘空间告警', description: '磁盘使用率超过 85%，需要清理或扩容',
    severity: 'P2', status: 'analyzing', source: 'node-03', fingerprint: 'fp-disk-003',
    assignee: '李运维', escalationLevel: 1,
    detectedAt: now - 7200000, alertedAt: now - 7140000, ackedAt: now - 6600000,
    mitigatedAt: null, resolvedAt: null, archivedAt: null,
    alertIds: ['alert-002'], logBundleIds: ['lb-002'], affectedServices: ['node-03'],
    affectedUsers: 0, tags: ['磁盘', '基础设施'], createdAt: now - 7200000, updatedAt: now - 3600000,
  },
  {
    id: 'INC-20260219-003', title: 'ES 集群响应超时', description: 'Elasticsearch 集群 node-05 连续超时',
    severity: 'P1', status: 'resolved', source: 'es-cluster', fingerprint: 'fp-es-timeout-005',
    assignee: '王运维', escalationLevel: 1,
    detectedAt: now - 86400000, alertedAt: now - 86340000, ackedAt: now - 85800000,
    mitigatedAt: now - 82800000, resolvedAt: now - 79200000, archivedAt: null,
    alertIds: ['alert-003'], logBundleIds: ['lb-003', 'lb-004'], affectedServices: ['es-cluster', 'search-service'],
    affectedUsers: 320, tags: ['ES', '超时'], createdAt: now - 86400000, updatedAt: now - 79200000,
  },
  {
    id: 'INC-20260218-004', title: 'Kafka 消费延迟', description: '消费者组积压消息超过 10 万条',
    severity: 'P1', status: 'postmortem', source: 'kafka-consumer-group', fingerprint: 'fp-kafka-lag-001',
    assignee: '赵运维', escalationLevel: 1,
    detectedAt: now - 172800000, alertedAt: now - 172740000, ackedAt: now - 172200000,
    mitigatedAt: now - 169200000, resolvedAt: now - 165600000, archivedAt: null,
    alertIds: ['alert-009'], logBundleIds: ['lb-005'], affectedServices: ['kafka-consumer-group', 'log-pipeline'],
    affectedUsers: 0, tags: ['Kafka', '消息积压'], createdAt: now - 172800000, updatedAt: now - 165600000,
  },
  {
    id: 'INC-20260215-005', title: '证书过期导致 API 不可用', description: 'Gateway TLS 证书过期，外部 API 全部 503',
    severity: 'P0', status: 'archived', source: 'gateway', fingerprint: 'fp-cert-expire-001',
    assignee: '张运维', escalationLevel: 3,
    detectedAt: now - 432000000, alertedAt: now - 431940000, ackedAt: now - 431400000,
    mitigatedAt: now - 430200000, resolvedAt: now - 428400000, archivedAt: now - 345600000,
    alertIds: ['alert-007'], logBundleIds: ['lb-006', 'lb-007'], affectedServices: ['gateway', 'all-external-apis'],
    affectedUsers: 8500, tags: ['证书', '安全', 'P0'], createdAt: now - 432000000, updatedAt: now - 345600000,
  },
  {
    id: 'INC-20260220-006', title: 'user-service 连接池耗尽', description: '数据库连接池满，新请求全部超时',
    severity: 'P1', status: 'alerted', source: 'user-service', fingerprint: 'fp-connpool-001',
    assignee: '', escalationLevel: 1,
    detectedAt: now - 300000, alertedAt: now - 240000, ackedAt: null,
    mitigatedAt: null, resolvedAt: null, archivedAt: null,
    alertIds: ['alert-005'], logBundleIds: ['lb-008'], affectedServices: ['user-service', 'auth-service'],
    affectedUsers: 2100, tags: ['连接池', '数据库'], createdAt: now - 300000, updatedAt: now - 240000,
  },
];


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

  // 分页
  const [currentPage, setCurrentPage] = useState(1);
  const storedPageSize = usePreferencesStore((s) => s.pageSizes['incidentList'] ?? 20);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeLocal(size);
    setStoredPageSize('incidentList', size);
  }, [setStoredPageSize]);

  // 筛选
  const filtered = useMemo(() => {
    return MOCK_INCIDENTS.filter((inc) => {
      if (severityFilter !== 'all' && inc.severity !== severityFilter) return false;
      if (statusFilter !== 'all' && inc.status !== statusFilter) return false;
      if (search) {
        const kw = search.toLowerCase();
        if (!inc.title.toLowerCase().includes(kw) && !inc.source.toLowerCase().includes(kw) && !inc.id.toLowerCase().includes(kw)) return false;
      }
      return true;
    });
  }, [severityFilter, statusFilter, search]);

  // 统计卡片
  const stats = useMemo(() => {
    const open = MOCK_INCIDENTS.filter((i) => !['resolved', 'postmortem', 'archived'].includes(i.status)).length;
    const p0 = MOCK_INCIDENTS.filter((i) => i.severity === 'P0' && i.status !== 'archived').length;
    const unacked = MOCK_INCIDENTS.filter((i) => i.status === 'alerted').length;
    const pendingPostmortem = MOCK_INCIDENTS.filter((i) => i.status === 'postmortem').length;
    return [
      { label: '进行中事件', value: open, icon: 'local_fire_department', color: COLORS.danger },
      { label: 'P0 紧急', value: p0, icon: 'crisis_alert', color: '#f97316' },
      { label: '待响应', value: unacked, icon: 'notification_important', color: COLORS.warning },
      { label: '待复盘', value: pendingPostmortem, icon: 'rate_review', color: COLORS.primary },
    ];
  }, []);

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
          <Badge count={stats[0].value} style={{ backgroundColor: COLORS.danger }} />
        </div>
        <Button type="primary" icon={<span className="material-symbols-outlined text-sm">add</span>}>
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
            { value: 'detected', label: '已检测' },
            { value: 'alerted', label: '已告警' },
            { value: 'acknowledged', label: '已响应' },
            { value: 'analyzing', label: '分析中' },
            { value: 'mitigated', label: '已止损' },
            { value: 'resolved', label: '已解决' },
            { value: 'postmortem', label: '复盘中' },
            { value: 'archived', label: '已归档' },
          ]}
        />
      </div>

      {/* 事件表格 — 点击行跳转详情页 */}
      <Table<Incident>
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={{
          current: currentPage,
          pageSize,
          total: filtered.length,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          pageSizeOptions: ['10', '20', '50'],
          onChange: (page, size) => { setCurrentPage(page); setPageSize(size); },
          position: ['bottomLeft'],
        }}
        onRow={(record) => ({
          onClick: () => navigate(`/incidents/detail/${record.id}`),
          style: { cursor: 'pointer' },
        })}
        scroll={{ x: 1000 }}
      />
    </div>
  );
};

export default IncidentList;

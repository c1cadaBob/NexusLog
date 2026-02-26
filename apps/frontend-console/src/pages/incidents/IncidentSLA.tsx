import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Tag, Progress, Descriptions, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS } from '../../theme/tokens';
import type { IncidentSeverity, SLAConfig, SLAMetrics } from '../../types/incident';

// ============================================================================
// SLA 配置
// ============================================================================

const SLA_CONFIGS: SLAConfig[] = [
  { severity: 'P0', maxAckMinutes: 5, maxResolveMinutes: 60, escalationRules: [
    { afterMinutes: 5, fromLevel: 1, toLevel: 2, notifyChannels: ['钉钉', '电话'] },
    { afterMinutes: 15, fromLevel: 2, toLevel: 3, notifyChannels: ['钉钉', '电话', '短信'] },
  ]},
  { severity: 'P1', maxAckMinutes: 15, maxResolveMinutes: 240, escalationRules: [
    { afterMinutes: 15, fromLevel: 1, toLevel: 2, notifyChannels: ['钉钉'] },
    { afterMinutes: 60, fromLevel: 2, toLevel: 3, notifyChannels: ['钉钉', '电话'] },
  ]},
  { severity: 'P2', maxAckMinutes: 30, maxResolveMinutes: 480, escalationRules: [
    { afterMinutes: 30, fromLevel: 1, toLevel: 2, notifyChannels: ['钉钉'] },
  ]},
  { severity: 'P3', maxAckMinutes: 120, maxResolveMinutes: 1440, escalationRules: [] },
];

const SEVERITY_COLOR: Record<IncidentSeverity, string> = {
  P0: COLORS.danger, P1: '#f97316', P2: COLORS.warning, P3: COLORS.info,
};

// ============================================================================
// 模拟 SLA 指标数据
// ============================================================================

interface SLARow extends SLAMetrics {
  incidentTitle: string;
  severity: IncidentSeverity;
  status: string;
}

const MOCK_SLA: SLARow[] = [
  { incidentId: 'INC-20260220-001', incidentTitle: 'payment-service 高错误率', severity: 'P0', status: '已响应',
    mtta: 4 * 60000, mttr: null, ackBreached: false, resolveBreached: false, currentEscalation: 2 },
  { incidentId: 'INC-20260220-006', incidentTitle: 'user-service 连接池耗尽', severity: 'P1', status: '已告警',
    mtta: null, mttr: null, ackBreached: true, resolveBreached: false, currentEscalation: 1 },
  { incidentId: 'INC-20260220-002', incidentTitle: 'node-03 磁盘空间告警', severity: 'P2', status: '分析中',
    mtta: 10 * 60000, mttr: null, ackBreached: false, resolveBreached: false, currentEscalation: 1 },
  { incidentId: 'INC-20260219-003', incidentTitle: 'ES 集群响应超时', severity: 'P1', status: '已解决',
    mtta: 9 * 60000, mttr: 120 * 60000, ackBreached: false, resolveBreached: false, currentEscalation: 1 },
  { incidentId: 'INC-20260218-004', incidentTitle: 'Kafka 消费延迟', severity: 'P1', status: '复盘中',
    mtta: 9 * 60000, mttr: 119 * 60000, ackBreached: false, resolveBreached: false, currentEscalation: 1 },
  { incidentId: 'INC-20260215-005', incidentTitle: '证书过期导致 API 不可用', severity: 'P0', status: '已归档',
    mtta: 10 * 60000, mttr: 30 * 60000, ackBreached: true, resolveBreached: false, currentEscalation: 3 },
];

function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}


// ============================================================================
// IncidentSLA 主组件
// ============================================================================

const IncidentSLA: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const navigate = useNavigate();

  // 汇总统计
  const summaryStats = useMemo(() => {
    const total = MOCK_SLA.length;
    const ackBreached = MOCK_SLA.filter((s) => s.ackBreached).length;
    const resolveBreached = MOCK_SLA.filter((s) => s.resolveBreached).length;
    const avgMtta = MOCK_SLA.filter((s) => s.mtta !== null).reduce((sum, s) => sum + (s.mtta ?? 0), 0) /
      Math.max(MOCK_SLA.filter((s) => s.mtta !== null).length, 1);
    const avgMttr = MOCK_SLA.filter((s) => s.mttr !== null).reduce((sum, s) => sum + (s.mttr ?? 0), 0) /
      Math.max(MOCK_SLA.filter((s) => s.mttr !== null).length, 1);
    return [
      { label: 'SLA 达标率', value: `${Math.round(((total - ackBreached - resolveBreached) / total) * 100)}%`, icon: 'verified', color: COLORS.success },
      { label: '响应超时', value: ackBreached, icon: 'timer_off', color: COLORS.danger },
      { label: '平均 MTTA', value: formatDuration(avgMtta), icon: 'schedule', color: COLORS.primary },
      { label: '平均 MTTR', value: formatDuration(avgMttr), icon: 'avg_pace', color: COLORS.warning },
    ];
  }, []);

  // SLA 指标表格列
  const columns: ColumnsType<SLARow> = useMemo(() => [
    {
      title: '事件 ID',
      dataIndex: 'incidentId',
      key: 'incidentId',
      width: 180,
      render: (v: string) => (
        <Button type="link" size="small" className="font-mono text-xs p-0" onClick={() => navigate(`/incidents/detail/${v}`)}>
          {v}
        </Button>
      ),
    },
    {
      title: '事件标题',
      dataIndex: 'incidentTitle',
      key: 'incidentTitle',
      render: (v: string, r: SLARow) => (
        <div>
          <div className="text-sm">{v}</div>
          <Tag color={SEVERITY_COLOR[r.severity]} style={{ margin: 0, marginTop: 2, fontSize: 10 }}>{r.severity}</Tag>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (v: string) => <span className="text-xs">{v}</span>,
    },
    {
      title: 'MTTA（响应时间）',
      key: 'mtta',
      width: 160,
      render: (_: unknown, r: SLARow) => {
        const sla = SLA_CONFIGS.find((c) => c.severity === r.severity);
        const limit = (sla?.maxAckMinutes ?? 0) * 60000;
        const pct = r.mtta !== null && limit > 0 ? Math.min((r.mtta / limit) * 100, 100) : 0;
        return (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs">{formatDuration(r.mtta)}</span>
              {r.ackBreached && <Tag color="error" style={{ margin: 0, fontSize: 10 }}>超时</Tag>}
            </div>
            {r.mtta !== null && (
              <Progress
                percent={pct}
                size="small"
                showInfo={false}
                strokeColor={r.ackBreached ? COLORS.danger : COLORS.success}
                style={{ marginBottom: 0 }}
              />
            )}
          </div>
        );
      },
    },
    {
      title: 'MTTR（解决时间）',
      key: 'mttr',
      width: 160,
      render: (_: unknown, r: SLARow) => {
        const sla = SLA_CONFIGS.find((c) => c.severity === r.severity);
        const limit = (sla?.maxResolveMinutes ?? 0) * 60000;
        const pct = r.mttr !== null && limit > 0 ? Math.min((r.mttr / limit) * 100, 100) : 0;
        return (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs">{formatDuration(r.mttr)}</span>
              {r.resolveBreached && <Tag color="error" style={{ margin: 0, fontSize: 10 }}>超时</Tag>}
            </div>
            {r.mttr !== null && (
              <Progress
                percent={pct}
                size="small"
                showInfo={false}
                strokeColor={r.resolveBreached ? COLORS.danger : COLORS.success}
                style={{ marginBottom: 0 }}
              />
            )}
          </div>
        );
      },
    },
    {
      title: '升级层级',
      dataIndex: 'currentEscalation',
      key: 'escalation',
      width: 80,
      render: (v: number) => (
        <span className="font-mono text-xs" style={{ color: v >= 3 ? COLORS.danger : v >= 2 ? COLORS.warning : undefined }}>
          L{v}
        </span>
      ),
    },
  ], []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">SLA 监控</span>
        <span className="text-xs opacity-50">响应时效与升级策略</span>
      </div>

      {/* 汇总统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summaryStats.map((s) => (
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

      {/* SLA 配置概览 */}
      <Card size="small" title="SLA 配置" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
        <Descriptions column={4} size="small" bordered>
          {SLA_CONFIGS.map((cfg) => (
            <React.Fragment key={cfg.severity}>
              <Descriptions.Item label={<span style={{ color: SEVERITY_COLOR[cfg.severity], fontWeight: 600 }}>{cfg.severity}</span>}>
                <div className="text-xs">
                  <div>响应: ≤{cfg.maxAckMinutes}m</div>
                  <div>解决: ≤{cfg.maxResolveMinutes}m</div>
                  <div className="opacity-50 mt-1">
                    {cfg.escalationRules.length > 0
                      ? cfg.escalationRules.map((r) => `${r.afterMinutes}m→L${r.toLevel}`).join(', ')
                      : '无自动升级'}
                  </div>
                </div>
              </Descriptions.Item>
            </React.Fragment>
          ))}
        </Descriptions>
      </Card>

      {/* SLA 指标表格 */}
      <Table<SLARow>
        dataSource={MOCK_SLA}
        columns={columns}
        rowKey="incidentId"
        size="small"
        pagination={false}
        scroll={{ x: 900 }}
      />
    </div>
  );
};

export default IncidentSLA;

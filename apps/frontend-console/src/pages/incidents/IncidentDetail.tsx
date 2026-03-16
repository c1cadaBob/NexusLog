import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, Tag, Button, Steps, Descriptions, Space, Card, Timeline, Empty, message, Modal, Input } from 'antd';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS } from '../../theme/tokens';
import type {
  Incident, IncidentStatus, IncidentSeverity,
  TimelineEvent, TimelineEventType,
} from '../../types/incident';
import {
  fetchIncidentDetail,
  fetchIncidentTimeline,
  acknowledgeIncident,
  investigateIncident,
  resolveIncident,
  closeIncident,
  archiveIncident,
} from '../../api/incident';
import InlineLoadingState from '../../components/common/InlineLoadingState';

// ============================================================================
// 共享配置映射
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

const EVENT_TYPE_CONFIG: Record<TimelineEventType, { color: string; icon: string; label: string }> = {
  log_bundle_created: { color: COLORS.info, icon: 'inventory_2', label: '日志打包' },
  log_bundle_pulled: { color: COLORS.info, icon: 'cloud_download', label: '日志拉取' },
  alert_triggered: { color: COLORS.danger, icon: 'notifications_active', label: '告警触发' },
  incident_created: { color: COLORS.primary, icon: 'add_circle', label: '事件创建' },
  incident_acked: { color: COLORS.warning, icon: 'check_circle', label: '运维响应' },
  analysis_started: { color: '#8b5cf6', icon: 'biotech', label: '开始分析' },
  action_taken: { color: '#06b6d4', icon: 'build', label: '处置动作' },
  incident_mitigated: { color: '#14b8a6', icon: 'shield', label: '已止损' },
  incident_resolved: { color: COLORS.success, icon: 'task_alt', label: '已解决' },
  postmortem_completed: { color: '#a855f7', icon: 'rate_review', label: '复盘完成' },
  incident_archived: { color: '#64748b', icon: 'archive', label: '已归档' },
  escalation: { color: '#f97316', icon: 'trending_up', label: '升级通知' },
  comment: { color: '#94a3b8', icon: 'comment', label: '备注' },
};

// ============================================================================
// 工具函数
// ============================================================================

function calcDuration(start: number | null, end: number | null): string {
  if (!start || !end) return '-';
  const diff = end - start;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`;
}

function getEventConfig(type: TimelineEventType) {
  return EVENT_TYPE_CONFIG[type] ?? EVENT_TYPE_CONFIG.comment;
}

// ============================================================================
// Tab 1: 概览面板
// ============================================================================

const OverviewTab: React.FC<{ incident: Incident }> = ({ incident }) => (
  <div className="flex flex-col gap-4">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MetricCard label="MTTA（响应时间）" value={calcDuration(incident.alertedAt, incident.ackedAt)} icon="schedule" color={COLORS.primary} />
      <MetricCard label="MTTR（解决时间）" value={calcDuration(incident.alertedAt, incident.resolvedAt)} icon="avg_pace" color={COLORS.primary} />
      <MetricCard label="升级层级" value={`L${incident.escalationLevel}`} icon="trending_up" color={incident.escalationLevel >= 3 ? COLORS.danger : incident.escalationLevel >= 2 ? COLORS.warning : COLORS.info} />
      <MetricCard label="影响用户" value={incident.affectedUsers.toLocaleString()} icon="people" color={incident.affectedUsers > 1000 ? COLORS.danger : COLORS.info} />
    </div>

    <Descriptions column={2} size="small" bordered>
      <Descriptions.Item label="事件 ID" span={2}><span className="font-mono text-xs">{incident.id}</span></Descriptions.Item>
      <Descriptions.Item label="标题" span={2}>{incident.title}</Descriptions.Item>
      <Descriptions.Item label="描述" span={2}><span className="text-xs">{incident.description || '-'}</span></Descriptions.Item>
      <Descriptions.Item label="级别">
        <span style={{ color: SEVERITY_CONFIG[incident.severity].color }} className="font-medium">{SEVERITY_CONFIG[incident.severity].label}</span>
      </Descriptions.Item>
      <Descriptions.Item label="负责人">{incident.assignee || '未分配'}</Descriptions.Item>
      <Descriptions.Item label="来源服务"><Tag style={{ margin: 0 }}>{incident.source}</Tag></Descriptions.Item>
      <Descriptions.Item label="指纹"><span className="font-mono text-xs opacity-60">{incident.fingerprint}</span></Descriptions.Item>
      <Descriptions.Item label="影响服务" span={2}>
        <Space size={4} wrap>{incident.affectedServices.length > 0 ? incident.affectedServices.map((s) => <Tag key={s} style={{ margin: 0 }}>{s}</Tag>) : '-'}</Space>
      </Descriptions.Item>
      <Descriptions.Item label="关联告警">{incident.alertIds.length} 条</Descriptions.Item>
      <Descriptions.Item label="日志包">{incident.logBundleIds.length} 个</Descriptions.Item>
      <Descriptions.Item label="检测时间">{new Date(incident.detectedAt).toLocaleString('zh-CN')}</Descriptions.Item>
      <Descriptions.Item label="告警时间">{incident.alertedAt ? new Date(incident.alertedAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
      <Descriptions.Item label="响应时间">{incident.ackedAt ? new Date(incident.ackedAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
      <Descriptions.Item label="解决时间">{incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
    </Descriptions>
  </div>
);

const MetricCard: React.FC<{ label: string; value: string; icon: string; color: string }> = ({ label, value, icon, color }) => {
  const isDark = useThemeStore((s) => s.isDark);
  return (
    <Card size="small" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }} styles={{ body: { padding: '12px 16px' } }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs opacity-50 mb-1">{label}</div>
          <div className="text-xl font-bold font-mono" style={{ color }}>{value}</div>
        </div>
        <span className="material-symbols-outlined text-xl" style={{ color, opacity: 0.5 }}>{icon}</span>
      </div>
    </Card>
  );
};

// ============================================================================
// Tab 2: 时间线面板
// ============================================================================

const TimelineTab: React.FC<{ incidentId: string; events: TimelineEvent[]; loading: boolean }> = ({ incidentId, events, loading }) => {
  const isDark = useThemeStore((s) => s.isDark);
  const sorted = useMemo(() => [...events].sort((a, b) => a.timestamp - b.timestamp), [events]);

  if (loading) return <InlineLoadingState tip="加载时间线..." />;
  if (sorted.length === 0) return <Empty description="暂无时间线记录" />;

  return (
    <Card size="small" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
      <Timeline
        items={sorted.map((event) => {
          const cfg = getEventConfig(event.type);
          return {
            key: event.id,
            color: cfg.color,
            dot: <span className="material-symbols-outlined text-base" style={{ color: cfg.color }}>{cfg.icon}</span>,
            children: (
              <div className="pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <Tag color={cfg.color} style={{ margin: 0, fontSize: 11 }}>{cfg.label}</Tag>
                  <span className="text-sm font-medium">{event.title}</span>
                </div>
                {event.description && <div className="text-xs opacity-60 mb-1">{event.description}</div>}
                <div className="flex items-center gap-3 text-xs opacity-40">
                  <span>操作人: {event.operator}</span>
                  <span>{new Date(event.timestamp).toLocaleString('zh-CN')}</span>
                </div>
              </div>
            ),
          };
        })}
      />
    </Card>
  );
};

// ============================================================================
// Tab 3: 根因分析面板（API 暂无，保留空状态）
// ============================================================================

const AnalysisTab: React.FC<{ incidentId: string }> = () => (
  <Empty description="暂无根因分析记录">
    <Button type="primary" icon={<span className="material-symbols-outlined text-sm">add</span>} disabled>新建分析（敬请期待）</Button>
  </Empty>
);

// ============================================================================
// Tab 4: 归档面板（已归档时显示 verdict）
// ============================================================================

const ArchiveTab: React.FC<{ incident: Incident }> = ({ incident }) => {
  if (incident.status !== 'archived') {
    return <Empty description="暂未归档" />;
  }
  return (
    <Descriptions column={2} size="small" bordered>
      <Descriptions.Item label="事件 ID" span={2}><span className="font-mono text-xs">{incident.id}</span></Descriptions.Item>
      <Descriptions.Item label="研判结论" span={2}>
        <span className="text-xs">{incident.verdict || '-'}</span>
      </Descriptions.Item>
      <Descriptions.Item label="归档时间" span={2}>
        {incident.archivedAt ? new Date(incident.archivedAt).toLocaleString('zh-CN') : '-'}
      </Descriptions.Item>
    </Descriptions>
  );
};

// ============================================================================
// IncidentDetail 主组件
// ============================================================================

const statusSteps = ['detected', 'alerted', 'acknowledged', 'analyzing', 'mitigated', 'resolved', 'postmortem', 'archived'] as const;

const IncidentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveVerdict, setArchiveVerdict] = useState('');

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const inc = await fetchIncidentDetail(id);
      setIncident(inc);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载事件详情失败';
      setError(msg);
      message.error(msg);
      setIncident(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadTimeline = useCallback(async () => {
    if (!id) return;
    setTimelineLoading(true);
    try {
      const events = await fetchIncidentTimeline(id);
      setTimeline(events);
    } catch {
      setTimeline([]);
    } finally {
      setTimelineLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (incident) loadTimeline();
    else setTimelineLoading(false);
  }, [incident, loadTimeline]);

  const handleTransition = useCallback(async (action: () => Promise<void>, label: string) => {
    setActionLoading(true);
    try {
      await action();
      message.success(`事件已变更为「${label}」`);
      await loadDetail();
      await loadTimeline();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '操作失败';
      message.error(msg);
    } finally {
      setActionLoading(false);
    }
  }, [loadDetail, loadTimeline]);

  const handleArchive = useCallback(async () => {
    if (!id || !archiveVerdict.trim()) {
      message.error('请输入研判结论');
      return;
    }
    setActionLoading(true);
    try {
      await archiveIncident(id, archiveVerdict.trim());
      message.success('归档成功');
      setArchiveModalOpen(false);
      setArchiveVerdict('');
      await loadDetail();
      await loadTimeline();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '归档失败';
      message.error(msg);
    } finally {
      setActionLoading(false);
    }
  }, [id, archiveVerdict, loadDetail, loadTimeline]);

  if (!id) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Empty description="缺少事件 ID" />
        <Button type="primary" onClick={() => navigate('/incidents/list')}>返回事件列表</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <InlineLoadingState size="large" tip="加载事件详情..." />
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Empty description={error || `未找到事件 ${id}`} />
        <Button type="primary" onClick={() => navigate('/incidents/list')}>返回事件列表</Button>
      </div>
    );
  }

  const sevCfg = SEVERITY_CONFIG[incident.severity];
  const staCfg = STATUS_CONFIG[incident.status];

  return (
    <div className="flex flex-col gap-4">
      {/* 顶部：返回 + 标题 + 状态操作 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button
            type="text"
            size="small"
            icon={<span className="material-symbols-outlined text-base">arrow_back</span>}
            onClick={() => navigate('/incidents/list')}
          />
          <span className="material-symbols-outlined text-lg" style={{ color: sevCfg.color }}>{sevCfg.icon}</span>
          <span className="text-lg font-semibold">{incident.title}</span>
          <Tag color={sevCfg.color} style={{ margin: 0 }}>{sevCfg.label}</Tag>
          <Tag color={staCfg.color} style={{ margin: 0 }}>{staCfg.label}</Tag>
        </div>
        <Space>
          {incident.status === 'alerted' && (
            <Button type="primary" loading={actionLoading} onClick={() => handleTransition(() => acknowledgeIncident(id), '已响应')}>确认响应</Button>
          )}
          {incident.status === 'acknowledged' && (
            <Button type="primary" loading={actionLoading} onClick={() => handleTransition(() => investigateIncident(id), '分析中')}>开始分析</Button>
          )}
          {incident.status === 'analyzing' && (
            <Button type="primary" loading={actionLoading} onClick={() => handleTransition(() => resolveIncident(id), '已解决')}>标记解决</Button>
          )}
          {incident.status === 'resolved' && (
            <Button type="primary" loading={actionLoading} onClick={() => setArchiveModalOpen(true)}>归档</Button>
          )}
          {incident.status === 'postmortem' && (
            <Button type="primary" loading={actionLoading} onClick={() => setArchiveModalOpen(true)}>归档</Button>
          )}
        </Space>
      </div>

      {/* 状态流转步骤条 */}
      <Steps
        size="small"
        current={staCfg.step}
        items={statusSteps.map((s) => ({ title: STATUS_CONFIG[s].label }))}
      />

      {/* Tabs：概览 / 时间线 / 根因分析 / 归档 */}
      <Tabs
        defaultActiveKey="overview"
        items={[
          {
            key: 'overview',
            label: (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">info</span> 概览
              </span>
            ),
            children: <OverviewTab incident={incident} />,
          },
          {
            key: 'timeline',
            label: (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">timeline</span> 处理时间线
              </span>
            ),
            children: <TimelineTab incidentId={incident.id} events={timeline} loading={timelineLoading} />,
          },
          {
            key: 'analysis',
            label: (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">biotech</span> 根因分析
              </span>
            ),
            children: <AnalysisTab incidentId={incident.id} />,
          },
          {
            key: 'archive',
            label: (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">archive</span> 归档
              </span>
            ),
            children: <ArchiveTab incident={incident} />,
          },
        ]}
      />

      {/* 归档弹窗 */}
      <Modal
        title="归档事件"
        open={archiveModalOpen}
        onCancel={() => { setArchiveModalOpen(false); setArchiveVerdict(''); }}
        onOk={handleArchive}
        okText="确认归档"
        cancelText="取消"
        confirmLoading={actionLoading}
      >
        <div className="py-2">
          <div className="text-sm mb-2">请输入研判结论（必填）：</div>
          <Input.TextArea
            value={archiveVerdict}
            onChange={(e) => setArchiveVerdict(e.target.value)}
            placeholder="例如：根因为证书过期，已部署自动续期"
            rows={4}
          />
        </div>
      </Modal>
    </div>
  );
};

export default IncidentDetail;

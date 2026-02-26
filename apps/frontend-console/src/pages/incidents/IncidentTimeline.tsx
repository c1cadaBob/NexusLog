import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Timeline, Card, Tag, Select, Input, Descriptions, Empty, Button } from 'antd';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS } from '../../theme/tokens';
import type { TimelineEvent, TimelineEventType } from '../../types/incident';

// ============================================================================
// 事件类型配置
// ============================================================================

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
// 模拟时间线数据
// ============================================================================

const now = Date.now();
const MOCK_INCIDENTS_BRIEF = [
  { id: 'INC-20260220-001', title: 'payment-service 高错误率' },
  { id: 'INC-20260220-002', title: 'node-03 磁盘空间告警' },
  { id: 'INC-20260219-003', title: 'ES 集群响应超时' },
  { id: 'INC-20260218-004', title: 'Kafka 消费延迟' },
  { id: 'INC-20260215-005', title: '证书过期导致 API 不可用' },
];

const MOCK_TIMELINE: TimelineEvent[] = [
  // INC-001 时间线
  { id: 'tl-001', incidentId: 'INC-20260220-001', type: 'log_bundle_created', title: '目标服务器日志打包完成', description: 'payment-service 节点 3 台服务器日志已打包，总大小 2.3GB', operator: 'system', timestamp: now - 1800000 },
  { id: 'tl-002', incidentId: 'INC-20260220-001', type: 'log_bundle_pulled', title: '日志服务器拉取完成', description: '日志包已拉取至中心日志服务器，校验通过', operator: 'system', timestamp: now - 1770000 },
  { id: 'tl-003', incidentId: 'INC-20260220-001', type: 'alert_triggered', title: '触发 P0 告警：高错误率', description: 'payment-service 错误率 12.3%，超过阈值 5%，触发 P0 告警规则', operator: 'system', timestamp: now - 1740000 },
  { id: 'tl-004', incidentId: 'INC-20260220-001', type: 'incident_created', title: '自动创建事件工单', description: '系统根据告警规则自动创建事件 INC-20260220-001', operator: 'system', timestamp: now - 1740000 },
  { id: 'tl-005', incidentId: 'INC-20260220-001', type: 'escalation', title: '升级通知：L1 → L2', description: '5 分钟内未响应，自动升级至 L2 值班组', operator: 'system', timestamp: now - 1620000 },
  { id: 'tl-006', incidentId: 'INC-20260220-001', type: 'incident_acked', title: '运维人员响应', description: '张运维确认接手处理，开始排查', operator: '张运维', timestamp: now - 1500000 },
  // INC-003 完整时间线
  { id: 'tl-010', incidentId: 'INC-20260219-003', type: 'log_bundle_created', title: 'ES 集群日志打包', description: 'es-cluster 5 个节点日志打包完成', operator: 'system', timestamp: now - 86400000 },
  { id: 'tl-011', incidentId: 'INC-20260219-003', type: 'log_bundle_pulled', title: '日志拉取完成', description: '日志包拉取成功，大小 4.1GB', operator: 'system', timestamp: now - 86370000 },
  { id: 'tl-012', incidentId: 'INC-20260219-003', type: 'alert_triggered', title: '触发 P1 告警', description: 'ES node-05 连续 3 次响应超时', operator: 'system', timestamp: now - 86340000 },
  { id: 'tl-013', incidentId: 'INC-20260219-003', type: 'incident_created', title: '创建事件工单', description: '自动创建事件 INC-20260219-003', operator: 'system', timestamp: now - 86340000 },
  { id: 'tl-014', incidentId: 'INC-20260219-003', type: 'incident_acked', title: '王运维响应', description: '王运维确认接手', operator: '王运维', timestamp: now - 85800000 },
  { id: 'tl-015', incidentId: 'INC-20260219-003', type: 'analysis_started', title: '开始根因分析', description: '检查 ES 集群状态、JVM 堆内存、磁盘 IO', operator: '王运维', timestamp: now - 85200000 },
  { id: 'tl-016', incidentId: 'INC-20260219-003', type: 'action_taken', title: '执行处置：重启 node-05', description: '重启 ES node-05 节点，等待集群恢复', operator: '王运维', timestamp: now - 84600000 },
  { id: 'tl-017', incidentId: 'INC-20260219-003', type: 'incident_mitigated', title: '止损完成', description: 'node-05 重启后恢复正常，集群状态变绿', operator: '王运维', timestamp: now - 82800000 },
  { id: 'tl-018', incidentId: 'INC-20260219-003', type: 'incident_resolved', title: '问题解决', description: '确认根因为 JVM 堆内存溢出，已调整 heap size 配置', operator: '王运维', timestamp: now - 79200000 },
];


// ============================================================================
// IncidentTimeline 主组件
// ============================================================================

const IncidentTimeline: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialIncident = searchParams.get('incidentId') ?? 'all';
  const [selectedIncident, setSelectedIncident] = useState<string>(initialIncident);
  const [typeFilter, setTypeFilter] = useState<TimelineEventType | 'all'>('all');

  const filtered = useMemo(() => {
    return MOCK_TIMELINE
      .filter((e) => selectedIncident === 'all' || e.incidentId === selectedIncident)
      .filter((e) => typeFilter === 'all' || e.type === typeFilter)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [selectedIncident, typeFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">全流程时间线</span>
        <span className="text-xs opacity-50">事件全生命周期追踪</span>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={selectedIncident}
          onChange={setSelectedIncident}
          style={{ width: 320 }}
          options={[
            { value: 'all', label: '所有事件' },
            ...MOCK_INCIDENTS_BRIEF.map((i) => ({ value: i.id, label: `${i.id} - ${i.title}` })),
          ]}
        />
        <Select
          value={typeFilter}
          onChange={setTypeFilter}
          style={{ width: 160 }}
          options={[
            { value: 'all', label: '所有类型' },
            ...Object.entries(EVENT_TYPE_CONFIG).map(([k, v]) => ({ value: k, label: v.label })),
          ]}
        />
      </div>

      {/* 时间线 */}
      {filtered.length === 0 ? (
        <Empty description="暂无时间线记录" />
      ) : (
        <Card size="small" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
          <Timeline
            mode="left"
            items={filtered.map((event) => {
              const cfg = EVENT_TYPE_CONFIG[event.type];
              return {
                key: event.id,
                color: cfg.color,
                dot: (
                  <span className="material-symbols-outlined text-base" style={{ color: cfg.color }}>
                    {cfg.icon}
                  </span>
                ),
                children: (
                  <div className="pb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Tag color={cfg.color} style={{ margin: 0, fontSize: 11 }}>{cfg.label}</Tag>
                      <span className="text-sm font-medium">{event.title}</span>
                    </div>
                    <div className="text-xs opacity-60 mb-1">{event.description}</div>
                    <div className="flex items-center gap-3 text-xs opacity-40">
                      <span>操作人: {event.operator}</span>
                      <span>{new Date(event.timestamp).toLocaleString('zh-CN')}</span>
                      {selectedIncident === 'all' && (
                        <Button type="link" size="small" className="p-0 text-xs" style={{ height: 'auto', lineHeight: 1 }}
                          onClick={(e) => { e.stopPropagation(); navigate(`/incidents/detail/${event.incidentId}`); }}>
                          {event.incidentId}
                        </Button>
                      )}
                    </div>
                  </div>
                ),
              };
            })}
          />
        </Card>
      )}
    </div>
  );
};

export default IncidentTimeline;

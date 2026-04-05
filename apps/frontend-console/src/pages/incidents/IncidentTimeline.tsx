import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Timeline, Card, Tag, Select, Button, Empty, Tooltip } from 'antd';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS } from '../../theme/tokens';
import type { TimelineEvent, TimelineEventType } from '../../types/incident';
import { fetchIncidents, fetchIncidentTimeline } from '../../api/incident';
import InlineLoadingState from '../../components/common/InlineLoadingState';
import type { Incident } from '../../types/incident';
import { useAuthStore } from '../../stores/authStore';
import {
  getIncidentPermissionDeniedReason,
  resolveIncidentActionAccess,
} from './incidentAuthorization';
import AnalysisPageHeader from '../../components/common/AnalysisPageHeader';

// ============================================================================
// 事件类型配置
// ============================================================================

const EVENT_TYPE_CONFIG: Record<TimelineEventType, { color: string; icon: string; label: string }> = {
  log_bundle_created: { color: COLORS.info, icon: 'inventory_2', label: '日志打包' },
  log_bundle_pulled: { color: COLORS.info, icon: 'cloud_download', label: '日志拉取' },
  alert_triggered: { color: COLORS.danger, icon: 'notifications_active', label: '告警触发' },
  incident_created: { color: COLORS.primary, icon: 'add_circle', label: '事件创建' },
  incident_acked: { color: COLORS.warning, icon: 'check_circle', label: '运维响应' },
  assignment_updated: { color: COLORS.info, icon: 'person_add', label: '负责人变更' },
  analysis_started: { color: '#8b5cf6', icon: 'biotech', label: '开始分析' },
  action_taken: { color: '#06b6d4', icon: 'build', label: '处置动作' },
  incident_mitigated: { color: '#14b8a6', icon: 'shield', label: '已止损' },
  incident_resolved: { color: COLORS.success, icon: 'task_alt', label: '已解决' },
  postmortem_completed: { color: '#a855f7', icon: 'rate_review', label: '复盘完成' },
  incident_archived: { color: '#64748b', icon: 'archive', label: '已归档' },
  escalation: { color: '#f97316', icon: 'trending_up', label: '升级通知' },
  comment: { color: '#94a3b8', icon: 'comment', label: '备注' },
};

function getEventConfig(type: TimelineEventType) {
  return EVENT_TYPE_CONFIG[type] ?? EVENT_TYPE_CONFIG.comment;
}

// ============================================================================
// IncidentTimeline 主组件
// ============================================================================

const IncidentTimeline: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const navigate = useNavigate();
  const permissions = useAuthStore((state) => state.permissions);
  const capabilities = useAuthStore((state) => state.capabilities);
  const [searchParams] = useSearchParams();
  const initialIncident = searchParams.get('incidentId') ?? 'all';
  const [selectedIncident, setSelectedIncident] = useState<string>(initialIncident);
  const [typeFilter, setTypeFilter] = useState<TimelineEventType | 'all'>('all');
  const authorization = useMemo(() => ({ permissions, capabilities }), [capabilities, permissions]);
  const actionAccess = useMemo(() => resolveIncidentActionAccess(authorization), [authorization]);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentsLoading, setIncidentsLoading] = useState(true);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  // 加载事件列表（用于下拉选择）
  const loadIncidents = useCallback(async () => {
    setIncidentsLoading(true);
    try {
      const { items } = await fetchIncidents(1, 100);
      setIncidents(items);
      setLastUpdatedAt(new Date());
    } catch {
      setIncidents([]);
    } finally {
      setIncidentsLoading(false);
    }
  }, []);

  // 加载时间线
  const loadTimeline = useCallback(async () => {
    if (selectedIncident === 'all') {
      setTimeline([]);
      setTimelineLoading(false);
      return;
    }
    setTimelineLoading(true);
    try {
      const events = await fetchIncidentTimeline(selectedIncident);
      setTimeline(events);
      setLastUpdatedAt(new Date());
    } catch {
      setTimeline([]);
    } finally {
      setTimelineLoading(false);
    }
  }, [selectedIncident]);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  const filtered = useMemo(() => {
    return timeline
      .filter((e) => typeFilter === 'all' || e.type === typeFilter)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [timeline, typeFilter]);

  const handleRefresh = useCallback(() => {
    void loadIncidents();
    void loadTimeline();
  }, [loadIncidents, loadTimeline]);

  return (
    <div className="flex flex-col gap-4">
      <AnalysisPageHeader
        title="全流程时间线"
        subtitle="追踪事件从触发到归档的全生命周期过程"
        lastUpdatedAt={lastUpdatedAt}
        actions={(
          <Button size="small" onClick={handleRefresh} icon={<span className="material-symbols-outlined text-sm">refresh</span>}>
            刷新数据
          </Button>
        )}
      />

      {/* 筛选栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={selectedIncident}
          onChange={setSelectedIncident}
          style={{ width: 320 }}
          loading={incidentsLoading}
          options={[
            { value: 'all', label: '所有事件（请选择具体事件）' },
            ...incidents.map((i) => ({ value: i.id, label: `${i.id} - ${i.title}` })),
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
      {selectedIncident === 'all' ? (
        <Empty description="请从下拉框选择具体事件查看时间线" />
      ) : timelineLoading ? (
        <InlineLoadingState tip="加载时间线..." />
      ) : filtered.length === 0 ? (
        <Empty description="暂无时间线记录" />
      ) : (
        <Card size="small" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
          <Timeline
            mode="left"
            items={filtered.map((event) => {
              const cfg = getEventConfig(event.type);
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
                      <Tooltip title={actionAccess.canReadIncident ? '查看详情' : getIncidentPermissionDeniedReason('read')}>
                        <Button
                          type="link"
                          size="small"
                          disabled={!actionAccess.canReadIncident}
                          className="p-0 text-xs"
                          style={{ height: 'auto', lineHeight: 1 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/incidents/detail/${event.incidentId}`);
                          }}
                        >
                          {event.incidentId}
                        </Button>
                      </Tooltip>
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

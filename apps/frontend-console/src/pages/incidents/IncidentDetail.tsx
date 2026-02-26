import React, { useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, Tag, Button, Steps, Descriptions, Space, Card, Timeline, Table, Progress, Empty, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS } from '../../theme/tokens';
import type {
  Incident, IncidentStatus, IncidentSeverity,
  TimelineEvent, TimelineEventType,
  IncidentAnalysis as AnalysisType, RootCauseCategory, ActionType,
  SLAConfig, SLAMetrics,
  IncidentArchive as ArchiveType,
} from '../../types/incident';

// ============================================================================
// 共享配置映射（从各子页面提取）
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

const ROOT_CAUSE_CONFIG: Record<RootCauseCategory, { label: string; color: string; icon: string }> = {
  config: { label: '配置错误', color: COLORS.warning, icon: 'settings_suggest' },
  capacity: { label: '容量不足', color: '#f97316', icon: 'storage' },
  dependency: { label: '依赖故障', color: COLORS.danger, icon: 'link_off' },
  code_defect: { label: '代码缺陷', color: '#8b5cf6', icon: 'bug_report' },
  security: { label: '安全事件', color: '#ef4444', icon: 'gpp_maybe' },
  network: { label: '网络问题', color: COLORS.info, icon: 'wifi_off' },
  hardware: { label: '硬件故障', color: '#64748b', icon: 'memory' },
  unknown: { label: '未知', color: '#94a3b8', icon: 'help' },
};

const ACTION_TYPE_LABEL: Record<ActionType, string> = {
  rollback: '回滚', scale_up: '扩容', restart: '重启',
  rate_limit: '限流', hotfix: '热修复', config_change: '配置变更', other: '其他',
};

const SEVERITY_COLOR: Record<IncidentSeverity, string> = {
  P0: COLORS.danger, P1: '#f97316', P2: COLORS.warning, P3: COLORS.info,
};

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

function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

// ============================================================================
// 模拟数据（集中管理，后续可替换为 API 调用）
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

const MOCK_TIMELINE: TimelineEvent[] = [
  { id: 'tl-001', incidentId: 'INC-20260220-001', type: 'log_bundle_created', title: '目标服务器日志打包完成', description: 'payment-service 节点 3 台服务器日志已打包，总大小 2.3GB', operator: 'system', timestamp: now - 1800000 },
  { id: 'tl-002', incidentId: 'INC-20260220-001', type: 'log_bundle_pulled', title: '日志服务器拉取完成', description: '日志包已拉取至中心日志服务器，校验通过', operator: 'system', timestamp: now - 1770000 },
  { id: 'tl-003', incidentId: 'INC-20260220-001', type: 'alert_triggered', title: '触发 P0 告警：高错误率', description: 'payment-service 错误率 12.3%，超过阈值 5%，触发 P0 告警规则', operator: 'system', timestamp: now - 1740000 },
  { id: 'tl-004', incidentId: 'INC-20260220-001', type: 'incident_created', title: '自动创建事件工单', description: '系统根据告警规则自动创建事件 INC-20260220-001', operator: 'system', timestamp: now - 1740000 },
  { id: 'tl-005', incidentId: 'INC-20260220-001', type: 'escalation', title: '升级通知：L1 → L2', description: '5 分钟内未响应，自动升级至 L2 值班组', operator: 'system', timestamp: now - 1620000 },
  { id: 'tl-006', incidentId: 'INC-20260220-001', type: 'incident_acked', title: '运维人员响应', description: '张运维确认接手处理，开始排查', operator: '张运维', timestamp: now - 1500000 },
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

const MOCK_ANALYSES: AnalysisType[] = [
  {
    id: 'ana-001', incidentId: 'INC-20260219-003', category: 'capacity',
    summary: 'ES node-05 JVM 堆内存溢出导致节点不可用',
    detail: '由于近期日志量增长 40%，node-05 的 JVM heap size 配置（8GB）不足以处理当前索引负载，导致频繁 Full GC 最终 OOM。',
    impactScope: 'ES 集群降级为黄色状态，search-service 查询延迟从 200ms 升至 5s',
    affectedServiceCount: 2, affectedUserCount: 320,
    actions: [
      { id: 'act-001', type: 'restart', description: '重启 ES node-05 节点', operator: '王运维', executedAt: now - 84600000, result: 'success' },
      { id: 'act-002', type: 'config_change', description: '调整 JVM heap size 从 8GB 到 16GB', operator: '王运维', executedAt: now - 80000000, result: 'success' },
    ],
    preventionPlan: '1. 设置 JVM heap 使用率 75% 告警阈值\n2. 制定 ES 集群容量规划，按月评估\n3. 启用自动扩容策略',
    analyst: '王运维', createdAt: now - 82000000,
  },
  {
    id: 'ana-002', incidentId: 'INC-20260218-004', category: 'config',
    summary: 'Kafka 消费者组配置不当导致消息积压',
    detail: '消费者组 max.poll.records 设置过低（100），且 session.timeout.ms 过短导致频繁 rebalance。',
    impactScope: '日志处理管道延迟 30 分钟',
    affectedServiceCount: 2, affectedUserCount: 0,
    actions: [
      { id: 'act-003', type: 'config_change', description: '调整 max.poll.records=500, session.timeout.ms=30000', operator: '赵运维', executedAt: now - 170000000, result: 'success' },
      { id: 'act-004', type: 'scale_up', description: '增加消费者实例从 3 个到 6 个', operator: '赵运维', executedAt: now - 169000000, result: 'success' },
    ],
    preventionPlan: '1. 建立 Kafka 消费延迟监控看板\n2. 设置 lag > 5000 的告警规则',
    analyst: '赵运维', createdAt: now - 168000000,
  },
  {
    id: 'ana-003', incidentId: 'INC-20260215-005', category: 'config',
    summary: 'Gateway TLS 证书过期未及时续期',
    detail: '证书管理流程缺失，未设置证书到期提醒。',
    impactScope: '所有外部 API 不可用，持续约 20 分钟，影响 8500 用户',
    affectedServiceCount: 10, affectedUserCount: 8500,
    actions: [
      { id: 'act-005', type: 'config_change', description: '紧急更新 TLS 证书', operator: '张运维', executedAt: now - 430200000, result: 'success' },
      { id: 'act-006', type: 'hotfix', description: '部署证书自动续期脚本', operator: '张运维', executedAt: now - 428000000, result: 'success' },
    ],
    preventionPlan: '1. 部署 cert-manager 自动续期\n2. 证书到期前 30/7/1 天三级告警\n3. 建立证书资产清单',
    analyst: '张运维', createdAt: now - 429000000,
  },
];

const MOCK_ARCHIVES: ArchiveType[] = [
  {
    id: 'arc-001', incidentId: 'INC-20260215-005',
    reportUrl: '/archives/INC-20260215-005/report.pdf',
    logBundleUrl: 's3://nexuslog-archives/INC-20260215-005/logs.tar.gz',
    hash: 'sha256:a1b2c3d4e5f6...', retentionDays: 365,
    archivedBy: '张运维', archivedAt: now - 345600000,
    postmortemSummary: 'Gateway TLS 证书过期导致全部外部 API 不可用约 20 分钟。根因：证书管理流程缺失。已部署 cert-manager 自动续期并建立三级告警。',
  },
];

interface SLARow extends SLAMetrics {
  severity: IncidentSeverity;
}

const MOCK_SLA_MAP: Record<string, SLARow> = {
  'INC-20260220-001': { incidentId: 'INC-20260220-001', severity: 'P0', mtta: 4 * 60000, mttr: null, ackBreached: false, resolveBreached: false, currentEscalation: 2 },
  'INC-20260220-006': { incidentId: 'INC-20260220-006', severity: 'P1', mtta: null, mttr: null, ackBreached: true, resolveBreached: false, currentEscalation: 1 },
  'INC-20260220-002': { incidentId: 'INC-20260220-002', severity: 'P2', mtta: 10 * 60000, mttr: null, ackBreached: false, resolveBreached: false, currentEscalation: 1 },
  'INC-20260219-003': { incidentId: 'INC-20260219-003', severity: 'P1', mtta: 9 * 60000, mttr: 120 * 60000, ackBreached: false, resolveBreached: false, currentEscalation: 1 },
  'INC-20260218-004': { incidentId: 'INC-20260218-004', severity: 'P1', mtta: 9 * 60000, mttr: 119 * 60000, ackBreached: false, resolveBreached: false, currentEscalation: 1 },
  'INC-20260215-005': { incidentId: 'INC-20260215-005', severity: 'P0', mtta: 10 * 60000, mttr: 30 * 60000, ackBreached: true, resolveBreached: false, currentEscalation: 3 },
};


// ============================================================================
// Tab 1: 概览面板
// ============================================================================

const OverviewTab: React.FC<{ incident: Incident }> = ({ incident }) => {
  const sla = MOCK_SLA_MAP[incident.id];
  const slaCfg = SLA_CONFIGS.find((c) => c.severity === incident.severity);

  return (
    <div className="flex flex-col gap-4">
      {/* 关键指标卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="MTTA（响应时间）" value={calcDuration(incident.alertedAt, incident.ackedAt)} icon="schedule" color={sla?.ackBreached ? COLORS.danger : COLORS.success} />
        <MetricCard label="MTTR（解决时间）" value={calcDuration(incident.alertedAt, incident.resolvedAt)} icon="avg_pace" color={sla?.resolveBreached ? COLORS.danger : COLORS.primary} />
        <MetricCard label="升级层级" value={`L${incident.escalationLevel}`} icon="trending_up" color={incident.escalationLevel >= 3 ? COLORS.danger : incident.escalationLevel >= 2 ? COLORS.warning : COLORS.info} />
        <MetricCard label="影响用户" value={incident.affectedUsers.toLocaleString()} icon="people" color={incident.affectedUsers > 1000 ? COLORS.danger : COLORS.info} />
      </div>

      <Descriptions column={2} size="small" bordered>
        <Descriptions.Item label="事件 ID" span={2}><span className="font-mono text-xs">{incident.id}</span></Descriptions.Item>
        <Descriptions.Item label="标题" span={2}>{incident.title}</Descriptions.Item>
        <Descriptions.Item label="描述" span={2}><span className="text-xs">{incident.description}</span></Descriptions.Item>
        <Descriptions.Item label="级别">
          <span style={{ color: SEVERITY_CONFIG[incident.severity].color }} className="font-medium">{SEVERITY_CONFIG[incident.severity].label}</span>
        </Descriptions.Item>
        <Descriptions.Item label="负责人">{incident.assignee || '未分配'}</Descriptions.Item>
        <Descriptions.Item label="来源服务"><Tag style={{ margin: 0 }}>{incident.source}</Tag></Descriptions.Item>
        <Descriptions.Item label="指纹"><span className="font-mono text-xs opacity-60">{incident.fingerprint}</span></Descriptions.Item>
        <Descriptions.Item label="影响服务" span={2}>
          <Space size={4} wrap>{incident.affectedServices.map((s) => <Tag key={s} style={{ margin: 0 }}>{s}</Tag>)}</Space>
        </Descriptions.Item>
        <Descriptions.Item label="关联告警">{incident.alertIds.length} 条</Descriptions.Item>
        <Descriptions.Item label="日志包">{incident.logBundleIds.length} 个</Descriptions.Item>
        <Descriptions.Item label="检测时间">{new Date(incident.detectedAt).toLocaleString('zh-CN')}</Descriptions.Item>
        <Descriptions.Item label="告警时间">{incident.alertedAt ? new Date(incident.alertedAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
        <Descriptions.Item label="响应时间">{incident.ackedAt ? new Date(incident.ackedAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
        <Descriptions.Item label="解决时间">{incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
      </Descriptions>

      {/* SLA 进度 */}
      {sla && slaCfg && (
        <Card size="small" title="SLA 达标情况">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs opacity-50 mb-1">响应 SLA（≤{slaCfg.maxAckMinutes}m）</div>
              <Progress
                percent={sla.mtta !== null ? Math.min((sla.mtta / (slaCfg.maxAckMinutes * 60000)) * 100, 100) : 0}
                strokeColor={sla.ackBreached ? COLORS.danger : COLORS.success}
                format={() => formatDuration(sla.mtta)}
              />
            </div>
            <div>
              <div className="text-xs opacity-50 mb-1">解决 SLA（≤{slaCfg.maxResolveMinutes}m）</div>
              <Progress
                percent={sla.mttr !== null ? Math.min((sla.mttr / (slaCfg.maxResolveMinutes * 60000)) * 100, 100) : 0}
                strokeColor={sla.resolveBreached ? COLORS.danger : COLORS.success}
                format={() => formatDuration(sla.mttr)}
              />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

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

const TimelineTab: React.FC<{ incidentId: string }> = ({ incidentId }) => {
  const isDark = useThemeStore((s) => s.isDark);
  const events = useMemo(
    () => MOCK_TIMELINE.filter((e) => e.incidentId === incidentId).sort((a, b) => a.timestamp - b.timestamp),
    [incidentId],
  );

  if (events.length === 0) return <Empty description="暂无时间线记录" />;

  return (
    <Card size="small" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
      <Timeline
        items={events.map((event) => {
          const cfg = EVENT_TYPE_CONFIG[event.type];
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
                <div className="text-xs opacity-60 mb-1">{event.description}</div>
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
// Tab 3: 根因分析面板
// ============================================================================

const AnalysisTab: React.FC<{ incidentId: string }> = ({ incidentId }) => {
  const isDark = useThemeStore((s) => s.isDark);
  const analyses = useMemo(() => MOCK_ANALYSES.filter((a) => a.incidentId === incidentId), [incidentId]);

  if (analyses.length === 0) {
    return (
      <Empty description="暂无根因分析记录">
        <Button type="primary" icon={<span className="material-symbols-outlined text-sm">add</span>}>新建分析</Button>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {analyses.map((analysis) => (
        <Card key={analysis.id} size="small" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base" style={{ color: ROOT_CAUSE_CONFIG[analysis.category].color }}>
                {ROOT_CAUSE_CONFIG[analysis.category].icon}
              </span>
              <Tag color={ROOT_CAUSE_CONFIG[analysis.category].color} style={{ margin: 0 }}>
                {ROOT_CAUSE_CONFIG[analysis.category].label}
              </Tag>
              <span className="text-sm font-medium flex-1">{analysis.summary}</span>
              <span className="text-xs opacity-40">分析人: {analysis.analyst}</span>
            </div>

            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="详细分析" span={2}>
                <span className="text-xs whitespace-pre-wrap">{analysis.detail}</span>
              </Descriptions.Item>
              <Descriptions.Item label="影响范围" span={2}>
                <span className="text-xs">{analysis.impactScope}</span>
              </Descriptions.Item>
              <Descriptions.Item label="影响服务数">{analysis.affectedServiceCount}</Descriptions.Item>
              <Descriptions.Item label="影响用户数">{analysis.affectedUserCount.toLocaleString()}</Descriptions.Item>
            </Descriptions>

            {/* 处置动作 */}
            <div>
              <div className="text-xs font-medium opacity-60 mb-2">处置动作</div>
              {analysis.actions.map((act) => (
                <div key={act.id} className="flex items-center gap-3 py-2 border-b last:border-b-0" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                  <Tag style={{ margin: 0 }}>{ACTION_TYPE_LABEL[act.type]}</Tag>
                  <span className="text-sm flex-1">{act.description}</span>
                  <Tag color={act.result === 'success' ? 'success' : act.result === 'failed' ? 'error' : 'warning'} style={{ margin: 0 }}>
                    {act.result === 'success' ? '成功' : act.result === 'failed' ? '失败' : '部分成功'}
                  </Tag>
                  <span className="text-xs opacity-50">{act.operator}</span>
                </div>
              ))}
            </div>

            {/* 预防措施 */}
            <div>
              <div className="text-xs font-medium opacity-60 mb-2">预防措施</div>
              <pre className="text-xs whitespace-pre-wrap m-0 opacity-80">{analysis.preventionPlan}</pre>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

// ============================================================================
// Tab 4: 归档面板
// ============================================================================

const ArchiveTab: React.FC<{ incidentId: string }> = ({ incidentId }) => {
  const archives = useMemo(() => MOCK_ARCHIVES.filter((a) => a.incidentId === incidentId), [incidentId]);

  if (archives.length === 0) {
    return <Empty description="暂未归档" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {archives.map((archive) => (
        <Descriptions key={archive.id} column={2} size="small" bordered title={`归档 ${archive.id}`}>
          <Descriptions.Item label="复盘摘要" span={2}>
            <span className="text-xs">{archive.postmortemSummary}</span>
          </Descriptions.Item>
          <Descriptions.Item label="归档报告">
            <span className="font-mono text-xs break-all">{archive.reportUrl}</span>
          </Descriptions.Item>
          <Descriptions.Item label="日志包地址">
            <span className="font-mono text-xs break-all">{archive.logBundleUrl}</span>
          </Descriptions.Item>
          <Descriptions.Item label="完整性校验">
            <span className="font-mono text-xs">{archive.hash}</span>
          </Descriptions.Item>
          <Descriptions.Item label="保留期">
            <Tag color={archive.retentionDays >= 365 ? 'success' : 'warning'} style={{ margin: 0 }}>{archive.retentionDays} 天</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="归档人">{archive.archivedBy}</Descriptions.Item>
          <Descriptions.Item label="归档时间">{new Date(archive.archivedAt).toLocaleString('zh-CN')}</Descriptions.Item>
          <Descriptions.Item label="操作" span={2}>
            <Space>
              <Button size="small" icon={<span className="material-symbols-outlined text-sm">download</span>}>下载报告</Button>
              <Button size="small" icon={<span className="material-symbols-outlined text-sm">folder_zip</span>}>下载日志包</Button>
            </Space>
          </Descriptions.Item>
        </Descriptions>
      ))}
    </div>
  );
};

// ============================================================================
// IncidentDetail 主组件
// ============================================================================

const statusSteps = ['detected', 'alerted', 'acknowledged', 'analyzing', 'mitigated', 'resolved', 'postmortem', 'archived'] as const;

const IncidentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const incident = useMemo(() => MOCK_INCIDENTS.find((i) => i.id === id), [id]);

  const handleStatusChange = useCallback((inc: Incident, newStatus: IncidentStatus) => {
    message.success(`事件 ${inc.id} 已变更为「${STATUS_CONFIG[newStatus].label}」`);
  }, []);

  if (!incident) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Empty description={`未找到事件 ${id}`} />
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
            <Button type="primary" onClick={() => handleStatusChange(incident, 'acknowledged')}>确认响应</Button>
          )}
          {incident.status === 'acknowledged' && (
            <Button type="primary" onClick={() => handleStatusChange(incident, 'analyzing')}>开始分析</Button>
          )}
          {incident.status === 'analyzing' && (
            <Button type="primary" onClick={() => handleStatusChange(incident, 'mitigated')}>标记止损</Button>
          )}
          {incident.status === 'mitigated' && (
            <Button type="primary" onClick={() => handleStatusChange(incident, 'resolved')}>标记解决</Button>
          )}
          {incident.status === 'resolved' && (
            <Button type="primary" onClick={() => handleStatusChange(incident, 'postmortem')}>开始复盘</Button>
          )}
          {incident.status === 'postmortem' && (
            <Button type="primary" onClick={() => handleStatusChange(incident, 'archived')}>归档</Button>
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
            children: <TimelineTab incidentId={incident.id} />,
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
            children: <ArchiveTab incidentId={incident.id} />,
          },
        ]}
      />
    </div>
  );
};

export default IncidentDetail;

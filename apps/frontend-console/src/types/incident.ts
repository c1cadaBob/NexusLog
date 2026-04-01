/**
 * 事件管理（Incident）类型定义
 * 覆盖全流程日志审计闭环：日志打包 → 拉取 → 告警 → 分析 → 响应 → 解决 → 研判 → 归档
 */

// ============================================================================
// 事件状态机
// ============================================================================

/** 事件状态（状态机） */
export type IncidentStatus =
  | 'detected'       // 已检测（日志打包/拉取完成）
  | 'alerted'        // 已告警
  | 'acknowledged'   // 已响应（运维确认）
  | 'analyzing'      // 分析中
  | 'mitigated'      // 已止损
  | 'resolved'       // 已解决
  | 'postmortem'     // 复盘中
  | 'archived';      // 已归档

/** 事件严重级别 */
export type IncidentSeverity = 'P0' | 'P1' | 'P2' | 'P3';

/** 根因分类 */
export type RootCauseCategory =
  | 'config'         // 配置错误
  | 'capacity'       // 容量不足
  | 'dependency'     // 依赖故障
  | 'code_defect'    // 代码缺陷
  | 'security'       // 安全事件
  | 'network'        // 网络问题
  | 'hardware'       // 硬件故障
  | 'unknown';       // 未知

/** 处置动作类型 */
export type ActionType = 'rollback' | 'scale_up' | 'restart' | 'rate_limit' | 'hotfix' | 'config_change' | 'other';

// ============================================================================
// 事件主体
// ============================================================================

/** 事件工单主记录 */
export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  source: string;                // 来源服务
  fingerprint: string;           // 告警指纹（去重用）
  assignee: string;              // 当前负责人
  escalationLevel: number;       // 升级层级 L1/L2/L3

  // 关键时间节点
  detectedAt: number;
  alertedAt: number | null;
  ackedAt: number | null;
  mitigatedAt: number | null;
  resolvedAt: number | null;
  archivedAt: number | null;

  // 关联
  alertIds: string[];            // 关联告警 ID
  logBundleIds: string[];        // 关联日志包 ID
  affectedServices: string[];    // 影响的服务
  affectedUsers: number;         // 影响用户数

  tags: string[];
  createdAt: number;
  updatedAt: number;
  sourceAlertId?: string;
  createdBy?: string;
  rootCause?: string;
  resolution?: string;
  slaResponseMinutes?: number;
  slaResolveMinutes?: number;

  /** 归档时的研判结论（仅当 status=archived 时有效） */
  verdict?: string;
}


// ============================================================================
// 时间线事件
// ============================================================================

/** 时间线事件类型 */
export type TimelineEventType =
  | 'log_bundle_created'
  | 'log_bundle_pulled'
  | 'alert_triggered'
  | 'incident_created'
  | 'incident_acked'
  | 'assignment_updated'
  | 'analysis_started'
  | 'action_taken'
  | 'incident_mitigated'
  | 'incident_resolved'
  | 'postmortem_completed'
  | 'incident_archived'
  | 'escalation'
  | 'comment';

/** 时间线条目 */
export interface TimelineEvent {
  id: string;
  incidentId: string;
  type: TimelineEventType;
  title: string;
  description: string;
  operator: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// 根因分析
// ============================================================================

/** 根因分析记录 */
export interface IncidentAnalysis {
  id: string;
  incidentId: string;
  category: RootCauseCategory;
  summary: string;              // 根因概述
  detail: string;               // 详细分析
  impactScope: string;          // 影响范围描述
  affectedServiceCount: number;
  affectedUserCount: number;
  actions: IncidentAction[];    // 处置动作
  preventionPlan: string;       // 预防措施
  analyst: string;
  createdAt: number;
}

/** 处置动作 */
export interface IncidentAction {
  id: string;
  type: ActionType;
  description: string;
  operator: string;
  executedAt: number;
  result: 'success' | 'failed' | 'partial';
}

// ============================================================================
// SLA 相关
// ============================================================================

/** SLA 配置 */
export interface SLAConfig {
  severity: IncidentSeverity;
  maxAckMinutes: number;        // 最大响应时间（分钟）
  maxResolveMinutes: number;    // 最大解决时间（分钟）
  escalationRules: EscalationRule[];
}

/** 升级规则 */
export interface EscalationRule {
  afterMinutes: number;
  fromLevel: number;
  toLevel: number;
  notifyChannels: string[];
}

/** SLA 计算结果 */
export interface SLAMetrics {
  incidentId: string;
  mtta: number | null;          // 平均确认时间（毫秒）
  mttr: number | null;          // 平均修复时间（毫秒）
  ackBreached: boolean;         // 响应是否超时
  resolveBreached: boolean;     // 解决是否超时
  currentEscalation: number;    // 当前升级层级
}

// ============================================================================
// 归档
// ============================================================================

/** 归档记录 */
export interface IncidentArchive {
  id: string;
  incidentId: string;
  reportUrl: string;            // 归档报告地址
  logBundleUrl: string;         // 日志包存储地址
  hash: string;                 // 完整性校验哈希
  retentionDays: number;        // 保留天数
  archivedBy: string;
  archivedAt: number;
  postmortemSummary: string;    // 复盘摘要
}

// ============================================================================
// 日志包
// ============================================================================

/** 日志包记录 */
export interface LogBundle {
  id: string;
  sourceServer: string;
  fileName: string;
  fileSize: number;
  status: 'created' | 'pulling' | 'pulled' | 'failed' | 'archived';
  createdAt: number;
  pulledAt: number | null;
  storageUrl: string;
  checksum: string;
}

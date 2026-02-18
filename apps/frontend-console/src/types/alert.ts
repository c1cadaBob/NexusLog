/**
 * 告警相关类型定义
 */

import type { ID, Timestamp } from './common';

// ============================================================================
// 告警严重程度
// ============================================================================

/**
 * 告警严重程度
 */
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * 严重程度配置
 */
export const ALERT_SEVERITY_CONFIG: Record<AlertSeverity, { label: string; color: string; priority: number }> = {
  critical: { label: '严重', color: 'danger', priority: 4 },
  high: { label: '高', color: 'warning', priority: 3 },
  medium: { label: '中', color: 'info', priority: 2 },
  low: { label: '低', color: 'success', priority: 1 },
};

// ============================================================================
// 告警状态
// ============================================================================

/**
 * 告警状态
 */
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'silenced';

/**
 * 状态配置
 */
export const ALERT_STATUS_CONFIG: Record<AlertStatus, { label: string; color: string }> = {
  active: { label: '活跃', color: 'danger' },
  acknowledged: { label: '已确认', color: 'warning' },
  resolved: { label: '已解决', color: 'success' },
  silenced: { label: '已静默', color: 'info' },
};

// ============================================================================
// 告警
// ============================================================================

/**
 * 告警
 */
export interface Alert {
  id: ID;
  name: string;
  description?: string;
  severity: AlertSeverity;
  status: AlertStatus;
  source: string;
  message: string;
  count: number;
  firstTriggeredAt: Timestamp;
  lastTriggeredAt: Timestamp;
  acknowledgedAt?: Timestamp;
  acknowledgedBy?: ID;
  resolvedAt?: Timestamp;
  resolvedBy?: ID;
  rule: AlertRule;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

/**
 * 告警摘要
 */
export interface AlertSummary {
  id: ID;
  name: string;
  severity: AlertSeverity;
  status: AlertStatus;
  source: string;
  count: number;
  lastTriggeredAt: Timestamp;
}

// ============================================================================
// 告警规则
// ============================================================================

/**
 * 规则状态
 */
export type RuleStatus = 'enabled' | 'disabled' | 'error';

/**
 * 条件操作符
 */
export type ConditionOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';

/**
 * 告警条件
 */
export interface AlertCondition {
  metric: string;
  operator: ConditionOperator;
  threshold: number;
  duration?: number;
}

/**
 * 告警规则
 */
export interface AlertRule {
  id: ID;
  name: string;
  description?: string;
  query: string;
  conditions: AlertCondition[];
  severity: AlertSeverity;
  status: RuleStatus;
  evaluationInterval: number;
  forDuration: number;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  actions: AlertAction[];
  createdBy: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastEvaluatedAt?: Timestamp;
  lastTriggeredAt?: Timestamp;
}

/**
 * 创建告警规则请求
 */
export interface CreateAlertRuleRequest {
  name: string;
  description?: string;
  query: string;
  conditions: AlertCondition[];
  severity: AlertSeverity;
  evaluationInterval: number;
  forDuration: number;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  actions: AlertAction[];
}

// ============================================================================
// 告警动作
// ============================================================================

/**
 * 动作类型
 */
export type AlertActionType = 'email' | 'webhook' | 'slack' | 'dingtalk' | 'wechat' | 'pagerduty' | 'sms';

/**
 * 告警动作
 */
export interface AlertAction {
  id: ID;
  type: AlertActionType;
  name: string;
  config: AlertActionConfig;
  enabled: boolean;
}

/**
 * 动作配置基类
 */
export interface AlertActionConfig {
  [key: string]: unknown;
}

/**
 * 邮件动作配置
 */
export interface EmailActionConfig extends AlertActionConfig {
  recipients: string[];
  subject?: string;
  template?: string;
}

/**
 * Webhook 动作配置
 */
export interface WebhookActionConfig extends AlertActionConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  body?: string;
}

/**
 * Slack 动作配置
 */
export interface SlackActionConfig extends AlertActionConfig {
  webhookUrl: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
}

// ============================================================================
// 静默策略
// ============================================================================

/**
 * 静默匹配器
 */
export interface SilenceMatcher {
  name: string;
  value: string;
  isRegex: boolean;
}

/**
 * 静默策略
 */
export interface SilencePolicy {
  id: ID;
  name: string;
  description?: string;
  matchers: SilenceMatcher[];
  startsAt: Timestamp;
  endsAt: Timestamp;
  createdBy: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  comment?: string;
}

/**
 * 创建静默策略请求
 */
export interface CreateSilencePolicyRequest {
  name: string;
  description?: string;
  matchers: SilenceMatcher[];
  startsAt: Timestamp;
  endsAt: Timestamp;
  comment?: string;
}

// ============================================================================
// 通知配置
// ============================================================================

/**
 * 通知渠道
 */
export interface NotificationChannel {
  id: ID;
  name: string;
  type: AlertActionType;
  config: AlertActionConfig;
  enabled: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * 通知策略
 */
export interface NotificationPolicy {
  id: ID;
  name: string;
  description?: string;
  matchers: SilenceMatcher[];
  channels: ID[];
  groupBy: string[];
  groupWait: number;
  groupInterval: number;
  repeatInterval: number;
  enabled: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

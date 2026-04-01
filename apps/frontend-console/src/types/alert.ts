export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'silenced';
export type RuleStatus = 'enabled' | 'disabled' | 'error';
export type ConditionOperator = 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'ne';
export type NotificationChannelType = 'email' | 'slack' | 'webhook' | 'dingtalk' | 'wechat' | 'sms';

export interface AlertSummary {
  id: string;
  name: string;
  severity: AlertSeverity;
  status: AlertStatus;
  source: string;
  count: number;
  lastTriggeredAt: number;
}

export interface AlertCondition {
  metric: string;
  operator: ConditionOperator;
  threshold: number;
  duration?: number;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  query: string;
  severity: AlertSeverity;
  status: RuleStatus;
  evaluationInterval: number;
  forDuration: number;
  conditions: AlertCondition[];
  labels: Record<string, string>;
  annotations: Record<string, string>;
  actions: string[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  lastEvaluatedAt?: number;
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: NotificationChannelType;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SilenceMatcher {
  name: string;
  value: string;
  isRegex: boolean;
}

export interface SilencePolicy {
  id: string;
  name: string;
  description: string;
  matchers: SilenceMatcher[];
  startsAt: number;
  endsAt: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  comment?: string;
}

// 严重级别配置
export const ALERT_SEVERITY_CONFIG: Record<AlertSeverity, { label: string; color: string; icon: string }> = {
  critical: { label: '严重', color: 'error', icon: 'error' },
  high: { label: '高', color: 'warning', icon: 'warning' },
  medium: { label: '中', color: 'processing', icon: 'info' },
  low: { label: '低', color: 'success', icon: 'check_circle' },
};

// 告警状态配置
export const ALERT_STATUS_CONFIG: Record<AlertStatus, { label: string; color: string }> = {
  active: { label: '活跃', color: 'error' },
  acknowledged: { label: '已确认', color: 'warning' },
  resolved: { label: '已解决', color: 'success' },
  silenced: { label: '静默', color: 'default' },
};

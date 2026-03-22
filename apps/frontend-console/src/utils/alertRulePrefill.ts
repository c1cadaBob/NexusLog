import type { DetectedAnomaly } from '../api/query';
import type { AlertSeverity, ConditionOperator } from '../types/alert';

const ALERT_RULE_DRAFT_STORAGE_KEY = 'nexuslog-pending-alert-rule-draft';

export interface PendingAlertRuleDraft {
  source: 'anomaly_detection';
  name: string;
  description: string;
  ruleType: 'threshold';
  severity: AlertSeverity;
  conditionMetric: string;
  conditionOperator: ConditionOperator;
  conditionThreshold: number;
}

function normalizeSeverity(value: string): AlertSeverity {
  switch (value) {
    case 'critical':
    case 'high':
    case 'medium':
    case 'low':
      return value;
    default:
      return 'medium';
  }
}

function roundThreshold(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return Math.round(value * 100) / 100;
}

function resolveOperator(anomaly: DetectedAnomaly): ConditionOperator {
  const title = anomaly.title.trim();
  const actual = Number(anomaly.actual_value) || 0;
  const expected = Number(anomaly.expected_value) || 0;
  if (title.includes('突降') || actual < expected) {
    return 'lte';
  }
  return 'gte';
}

function resolveThreshold(anomaly: DetectedAnomaly, operator: ConditionOperator): number {
  const actual = Math.max(0, Number(anomaly.actual_value) || 0);
  const expected = Math.max(0, Number(anomaly.expected_value) || 0);

  if (operator === 'lte') {
    if (actual > 0 && expected > 0) {
      return roundThreshold(Math.max(actual, expected * 0.25));
    }
    if (expected > 0) {
      return roundThreshold(expected * 0.25);
    }
    return 1;
  }

  if (actual > 0) {
    return roundThreshold(actual);
  }
  if (expected > 0) {
    return roundThreshold(expected * 1.2);
  }
  return 1;
}

export function buildAlertRuleDraftFromAnomaly(anomaly: DetectedAnomaly): PendingAlertRuleDraft {
  const service = anomaly.service.trim() || 'global';
  const metric = anomaly.metric.trim() || 'log_volume';
  const operator = resolveOperator(anomaly);
  const conditionThreshold = resolveThreshold(anomaly, operator);
  const detailParts = [
    '来源：异常检测',
    `服务：${service}`,
    `指标：${metric}`,
    `检测时间：${anomaly.timestamp}`,
    `异常描述：${anomaly.description.trim()}`,
  ];
  if (anomaly.root_cause?.trim()) {
    detailParts.push(`处置建议：${anomaly.root_cause.trim()}`);
  }

  return {
    source: 'anomaly_detection',
    name: `[异常检测] ${anomaly.title.trim()} - ${service}`,
    description: detailParts.join('；'),
    ruleType: 'threshold',
    severity: normalizeSeverity(anomaly.severity),
    conditionMetric: metric,
    conditionOperator: operator,
    conditionThreshold,
  };
}

export function savePendingAlertRuleDraft(draft: PendingAlertRuleDraft): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem(ALERT_RULE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // ignore storage failures
  }
}

export function consumePendingAlertRuleDraft(): PendingAlertRuleDraft | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(ALERT_RULE_DRAFT_STORAGE_KEY)?.trim();
    if (!raw) {
      return null;
    }
    window.sessionStorage.removeItem(ALERT_RULE_DRAFT_STORAGE_KEY);

    const parsed = JSON.parse(raw) as Partial<PendingAlertRuleDraft> | null;
    if (!parsed) {
      return null;
    }

    return {
      source: 'anomaly_detection',
      name: String(parsed.name ?? '').trim(),
      description: String(parsed.description ?? '').trim(),
      ruleType: 'threshold',
      severity: normalizeSeverity(String(parsed.severity ?? 'medium').trim()),
      conditionMetric: String(parsed.conditionMetric ?? '').trim(),
      conditionOperator: parsed.conditionOperator === 'lte' ? 'lte' : parsed.conditionOperator === 'lt' ? 'lt' : parsed.conditionOperator === 'eq' ? 'eq' : parsed.conditionOperator === 'ne' ? 'ne' : parsed.conditionOperator === 'gt' ? 'gt' : 'gte',
      conditionThreshold: roundThreshold(Number(parsed.conditionThreshold) || 0),
    };
  } catch {
    try {
      window.sessionStorage.removeItem(ALERT_RULE_DRAFT_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
    return null;
  }
}

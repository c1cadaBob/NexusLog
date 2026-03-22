import type { DetectedAnomaly } from '../api/query';
import type { AlertSeverity, ConditionOperator, NotificationChannel } from '../types/alert';

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
  owner: string;
  labels: string[];
  notificationChannelIDs: string[];
}

export interface ParsedAlertRuleDescription {
  body: string;
  owner: string;
  labels: string[];
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
    owner: service,
    labels: [
      'source:anomaly_detection',
      `service:${service}`,
      `metric:${metric}`,
      `severity:${normalizeSeverity(anomaly.severity)}`,
    ],
    notificationChannelIDs: [],
  };
}

function normalizeLabelList(labels: string[]): string[] {
  return Array.from(new Set(labels.map((label) => String(label).trim()).filter(Boolean)));
}

export function composeAlertRuleDescription(input: {
  body: string;
  owner?: string;
  labels?: string[];
}): string {
  const body = String(input.body ?? '').trim();
  const owner = String(input.owner ?? '').trim();
  const labels = normalizeLabelList(input.labels ?? []);
  if (!owner && labels.length === 0) {
    return body;
  }

  const lines = ['[规则元数据]'];
  if (owner) {
    lines.push(`负责人：${owner}`);
  }
  if (labels.length > 0) {
    lines.push(`标签：${labels.join(', ')}`);
  }
  lines.push('---');
  if (body) {
    lines.push(body);
  }
  return lines.join('\n').trim();
}

export function parseAlertRuleDescription(rawDescription: string): ParsedAlertRuleDescription {
  const description = String(rawDescription ?? '').trim();
  if (!description.startsWith('[规则元数据]')) {
    return { body: description, owner: '', labels: [] };
  }

  const lines = description.split(/\r?\n/);
  let owner = '';
  let labels: string[] = [];
  let bodyStartIndex = -1;

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) {
      continue;
    }
    if (line === '---') {
      bodyStartIndex = index + 1;
      break;
    }
    if (line.startsWith('负责人：')) {
      owner = line.slice('负责人：'.length).trim();
      continue;
    }
    if (line.startsWith('标签：')) {
      labels = normalizeLabelList(line.slice('标签：'.length).split(/[，,]/));
    }
  }

  const body = bodyStartIndex >= 0 ? lines.slice(bodyStartIndex).join('\n').trim() : '';
  return { body, owner, labels };
}

function notificationChannelScore(channel: NotificationChannel, hints: string[]): number {
  const haystack = `${channel.name} ${channel.type}`.toLowerCase();
  let score = 0;
  for (const hint of hints) {
    const normalizedHint = hint.trim().toLowerCase();
    if (normalizedHint && haystack.includes(normalizedHint)) {
      score += 3;
    }
  }
  for (const keyword of ['alert', 'alarm', '告警', '异常', '值班', 'oncall']) {
    if (haystack.includes(keyword)) {
      score += 2;
    }
  }
  if (channel.enabled) {
    score += 1;
  }
  if (channel.type === 'dingtalk') {
    score += 1;
  }
  if (channel.type === 'email') {
    score += 1;
  }
  return score;
}

export function resolveSuggestedNotificationChannelIDs(
  draft: PendingAlertRuleDraft,
  channels: NotificationChannel[],
): string[] {
  if (draft.notificationChannelIDs.length > 0) {
    return draft.notificationChannelIDs;
  }
  const enabledChannels = channels.filter((channel) => channel.enabled);
  if (enabledChannels.length === 0) {
    return [];
  }

  const hints = [draft.owner, ...draft.labels, draft.conditionMetric, draft.name];
  const ranked = enabledChannels
    .map((channel) => ({ channel, score: notificationChannelScore(channel, hints) }))
    .sort((left, right) => right.score - left.score || left.channel.name.localeCompare(right.channel.name, 'zh-CN'));

  const positive = ranked.filter((item) => item.score > 1).slice(0, 2).map((item) => item.channel.id);
  if (positive.length > 0) {
    return positive;
  }
  return [enabledChannels[0].id];
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
      owner: String(parsed.owner ?? '').trim(),
      labels: normalizeLabelList(Array.isArray(parsed.labels) ? parsed.labels.map((label) => String(label)) : []),
      notificationChannelIDs: Array.isArray(parsed.notificationChannelIDs)
        ? Array.from(new Set(parsed.notificationChannelIDs.map((id) => String(id).trim()).filter(Boolean)))
        : [],
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

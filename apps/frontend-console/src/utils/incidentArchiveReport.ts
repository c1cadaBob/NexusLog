import type { Incident, TimelineEvent } from '../types/incident';

function sanitizeFilenameSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'incident';
}

export function buildIncidentArchiveReportFilename(incident: Incident, extension: 'md' | 'html'): string {
  const title = sanitizeFilenameSegment(incident.title || 'archive-report');
  return `incident-archive-${incident.id}-${title}.${extension}`;
}

export function formatIncidentReportDateTime(timestamp?: number | null): string {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
}

function timelineTypeLabel(type: TimelineEvent['type']): string {
  const map: Record<TimelineEvent['type'], string> = {
    log_bundle_created: '日志打包',
    log_bundle_pulled: '日志拉取',
    alert_triggered: '告警触发',
    incident_created: '事件创建',
    incident_acked: '运维响应',
    assignment_updated: '负责人变更',
    analysis_started: '开始分析',
    action_taken: '处置动作',
    incident_mitigated: '已止损',
    incident_resolved: '已解决',
    postmortem_completed: '复盘完成',
    incident_archived: '已归档',
    escalation: '升级通知',
    comment: '备注',
  };
  return map[type] ?? type;
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}\[\]()#+\-.!|>]/g, '\\$&');
}

export function buildIncidentArchiveReportMarkdown(incident: Incident, timeline: TimelineEvent[]): string {
  const lines: string[] = [
    '# 事件归档报告',
    '',
    '## 基本信息',
    '',
    `- 事件 ID：${escapeMarkdown(incident.id)}`,
    `- 标题：${escapeMarkdown(incident.title)}`,
    `- 当前状态：${escapeMarkdown(incident.status)}`,
    `- 严重级别：${escapeMarkdown(incident.severity)}`,
    `- 负责人：${escapeMarkdown(incident.assignee || '未分配')}`,
    `- 创建人：${escapeMarkdown(incident.createdBy || '未知')}`,
    `- 来源告警：${escapeMarkdown(incident.sourceAlertId || '-')}`,
    `- 检测时间：${escapeMarkdown(formatIncidentReportDateTime(incident.detectedAt))}`,
    `- 响应时间：${escapeMarkdown(formatIncidentReportDateTime(incident.ackedAt))}`,
    `- 解决时间：${escapeMarkdown(formatIncidentReportDateTime(incident.resolvedAt))}`,
    `- 归档时间：${escapeMarkdown(formatIncidentReportDateTime(incident.archivedAt))}`,
    `- SLA 响应时限：${escapeMarkdown(incident.slaResponseMinutes != null ? `${incident.slaResponseMinutes} 分钟` : '-')}`,
    `- SLA 解决时限：${escapeMarkdown(incident.slaResolveMinutes != null ? `${incident.slaResolveMinutes} 分钟` : '-')}`,
    '',
    '## 研判结论',
    '',
    incident.verdict?.trim() || '暂无研判结论',
    '',
    '## 根因分析',
    '',
    incident.rootCause?.trim() || '暂无根因分析',
    '',
    '## 处置方案',
    '',
    incident.resolution?.trim() || '暂无处置方案',
    '',
    '## 处理时间线',
    '',
  ];

  if (timeline.length === 0) {
    lines.push('- 暂无时间线记录');
  } else {
    timeline.forEach((event, index) => {
      lines.push(`${index + 1}. **${timelineTypeLabel(event.type)}**`);
      lines.push(`   - 时间：${formatIncidentReportDateTime(event.timestamp)}`);
      lines.push(`   - 操作人：${event.operator || '系统'}`);
      lines.push(`   - 标题：${event.title || '-'}`);
      lines.push(`   - 描述：${event.description || '-'}`);
    });
  }

  lines.push('', `> 报告生成时间：${formatIncidentReportDateTime(Date.now())}`);
  return lines.join('\n');
}

export function downloadBlobFile(blob: Blob, filename: string): void {
  const objectURL = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectURL;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectURL);
}

export function downloadIncidentArchiveMarkdown(incident: Incident, timeline: TimelineEvent[]): void {
  const content = buildIncidentArchiveReportMarkdown(incident, timeline);
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  downloadBlobFile(blob, buildIncidentArchiveReportFilename(incident, 'md'));
}

export function shouldAllowIncidentArchiveReport(incident: Incident): boolean {
  return incident.status === 'archived';
}

export function buildIncidentArchivePrintRoute(incidentID: string, autoPrint: boolean = false): string {
  const query = autoPrint ? '?print=1' : '';
  return `/#/incidents/archive/report/${encodeURIComponent(incidentID)}${query}`;
}

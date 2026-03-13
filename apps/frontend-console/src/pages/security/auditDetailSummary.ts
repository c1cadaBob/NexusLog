export function buildAuditDetailSummary(detail: Record<string, unknown> | undefined): string {
  if (!detail || Object.keys(detail).length === 0) {
    return '—';
  }

  const sourceKind = typeof detail.source_kind === 'string' ? detail.source_kind : '';
  const hasPort = detail.port !== undefined && detail.port !== null && detail.port !== '';

  const pairs = [
    sourceKind === 'application' ? '应用审计' : '',
    sourceKind === 'system' ? '系统审计' : '',
    detail.operation ? `op=${String(detail.operation)}` : '',
    detail.result ? `res=${String(detail.result)}` : '',
    detail.username ? `user=${String(detail.username)}` : '',
    detail.target_user_id ? `target=${String(detail.target_user_id)}` : '',
    detail.source_name ? `source=${String(detail.source_name)}` : '',
    detail.target_source_id ? `source_id=${String(detail.target_source_id)}` : '',
    detail.role_id ? `role=${String(detail.role_id)}` : '',
    detail.rule_name ? `rule=${String(detail.rule_name)}` : '',
    detail.target_rule_id ? `rule_id=${String(detail.target_rule_id)}` : '',
    detail.target_silence_id ? `silence_id=${String(detail.target_silence_id)}` : '',
    detail.repository ? `repo=${String(detail.repository)}` : '',
    detail.snapshot ? `snapshot=${String(detail.snapshot)}` : '',
    detail.location ? `location=${String(detail.location)}` : '',
    detail.protocol ? `proto=${String(detail.protocol)}` : '',
    detail.host ? `host=${String(detail.host)}` : '',
    hasPort ? `port=${String(detail.port)}` : '',
    detail.path ? `path=${String(detail.path)}` : '',
    detail.severity ? `severity=${String(detail.severity)}` : '',
    typeof detail.enabled === 'boolean' ? `enabled=${String(detail.enabled)}` : '',
    detail.matcher_count ? `matchers=${String(detail.matcher_count)}` : '',
    detail.indices && Array.isArray(detail.indices) ? `indices=${detail.indices.join(',')}` : '',
    detail.indices && !Array.isArray(detail.indices) ? `indices=${String(detail.indices)}` : '',
    detail.state ? `state=${String(detail.state)}` : '',
    detail.status ? `status=${String(detail.status)}` : '',
    detail.process ? `proc=${String(detail.process)}` : '',
    detail.pid ? `pid=${String(detail.pid)}` : '',
    detail.sequence ? `seq=${String(detail.sequence)}` : '',
    detail.updated_fields && Array.isArray(detail.updated_fields) ? `fields=${detail.updated_fields.join(',')}` : '',
    detail.error_code ? `code=${String(detail.error_code)}` : '',
  ].filter(Boolean);

  return pairs.join(' · ') || String(detail.raw_message ?? '—');
}

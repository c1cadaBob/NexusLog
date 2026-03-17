import { matchPath } from 'react-router-dom';
import type { AuthorizationSnapshot } from '../types/authz';

export interface RouteAuthorizationRule {
  path: string;
  requiredCapabilities: string[];
  legacyPermissions?: string[];
  fallbackPath?: string;
}

export const ROUTE_AUTHORIZATION_RULES: RouteAuthorizationRule[] = [
  { path: '/', requiredCapabilities: ['dashboard.read'], legacyPermissions: ['dashboards:read'] },
  { path: '/search/realtime', requiredCapabilities: ['log.query.read'], legacyPermissions: ['logs:read'] },
  { path: '/search/history', requiredCapabilities: ['query.history.read'], legacyPermissions: ['logs:read'] },
  {
    path: '/search/bookmark',
    requiredCapabilities: ['query.saved.read'],
    legacyPermissions: ['logs:read'],
    fallbackPath: '/search/saved',
  },
  { path: '/search/saved', requiredCapabilities: ['query.saved.read'], legacyPermissions: ['logs:read'] },
  { path: '/analysis/aggregate', requiredCapabilities: ['log.query.aggregate'], legacyPermissions: ['logs:read'] },
  { path: '/analysis/anomaly', requiredCapabilities: ['analysis.anomaly.read'], legacyPermissions: ['logs:read'] },
  { path: '/analysis/clustering', requiredCapabilities: ['analysis.cluster.read'], legacyPermissions: ['logs:read'] },
  { path: '/alerts/list', requiredCapabilities: ['alert.event.read'], legacyPermissions: ['alerts:read'] },
  { path: '/alerts/rules', requiredCapabilities: ['alert.rule.read'], legacyPermissions: ['alerts:read'] },
  { path: '/alerts/notifications', requiredCapabilities: ['notification.channel.read_metadata'], legacyPermissions: ['alerts:read'] },
  { path: '/alerts/silence', requiredCapabilities: ['alert.silence.read'], legacyPermissions: ['alerts:read'] },
  { path: '/incidents/list', requiredCapabilities: ['incident.read'], legacyPermissions: ['incidents:read'] },
  { path: '/incidents/detail/:id', requiredCapabilities: ['incident.read'], legacyPermissions: ['incidents:read'], fallbackPath: '/incidents/list' },
  { path: '/incidents/timeline', requiredCapabilities: ['incident.timeline.read'], legacyPermissions: ['incidents:read'] },
  { path: '/incidents/analysis', requiredCapabilities: ['incident.analysis.read'], legacyPermissions: ['incidents:read'] },
  { path: '/incidents/sla', requiredCapabilities: ['incident.sla.read'], legacyPermissions: ['incidents:read'] },
  { path: '/incidents/archive', requiredCapabilities: ['incident.archive.read'], legacyPermissions: ['incidents:read'] },
  { path: '/ingestion/sources', requiredCapabilities: ['ingest.source.read'] },
  { path: '/ingestion/agents', requiredCapabilities: ['agent.read'] },
  { path: '/ingestion/wizard', requiredCapabilities: ['ingest.source.read'] },
  { path: '/ingestion/status', requiredCapabilities: ['ingest.task.read'], legacyPermissions: ['metrics:read'] },
  { path: '/parsing/mapping', requiredCapabilities: ['field.mapping.read'] },
  { path: '/parsing/rules', requiredCapabilities: ['parse.rule.read'] },
  { path: '/parsing/masking', requiredCapabilities: ['masking.rule.read'] },
  { path: '/parsing/dictionary', requiredCapabilities: ['field.dictionary.read'] },
  { path: '/storage/indices', requiredCapabilities: ['storage.index.read'] },
  { path: '/storage/ilm', requiredCapabilities: ['data.retention.read'] },
  { path: '/storage/backup', requiredCapabilities: ['backup.read'] },
  { path: '/storage/capacity', requiredCapabilities: ['storage.capacity.read'], legacyPermissions: ['metrics:read'] },
  { path: '/performance/monitoring', requiredCapabilities: ['metric.read'], legacyPermissions: ['metrics:read'] },
  { path: '/performance/health', requiredCapabilities: ['ops.health.read'], legacyPermissions: ['metrics:read'] },
  { path: '/performance/scaling', requiredCapabilities: ['ops.scaling.read'], legacyPermissions: ['metrics:read'] },
  { path: '/performance/dr', requiredCapabilities: ['dr.read'], legacyPermissions: ['metrics:read'] },
  { path: '/tracing/search', requiredCapabilities: ['trace.read'], legacyPermissions: ['logs:read'] },
  { path: '/tracing/analysis', requiredCapabilities: ['trace.analysis.read'], legacyPermissions: ['logs:read'] },
  { path: '/tracing/topology', requiredCapabilities: ['trace.topology.read'], legacyPermissions: ['logs:read'] },
  { path: '/reports/management', requiredCapabilities: ['report.read'] },
  { path: '/reports/scheduled', requiredCapabilities: ['report.schedule.read'] },
  { path: '/reports/downloads', requiredCapabilities: ['report.download.read'], legacyPermissions: ['logs:export'] },
  { path: '/security/users', requiredCapabilities: ['iam.user.read'], legacyPermissions: ['users:read'] },
  { path: '/security/roles', requiredCapabilities: ['iam.role.read'], legacyPermissions: ['users:read'] },
  { path: '/security/audit', requiredCapabilities: ['audit.log.read'], legacyPermissions: ['audit:read'] },
  { path: '/security/login-policy', requiredCapabilities: ['auth.login_policy.read'] },
  { path: '/integration/api', requiredCapabilities: ['integration.api_doc.read'], legacyPermissions: ['dashboards:read'] },
  { path: '/integration/webhook', requiredCapabilities: ['integration.webhook.read_metadata'] },
  { path: '/integration/sdk', requiredCapabilities: ['integration.sdk.read'], legacyPermissions: ['dashboards:read'] },
  { path: '/integration/plugins', requiredCapabilities: ['integration.plugin.read'] },
  { path: '/cost/overview', requiredCapabilities: ['cost.read'], legacyPermissions: ['dashboards:read'] },
  { path: '/cost/budgets', requiredCapabilities: ['cost.budget.read'], legacyPermissions: ['dashboards:read'] },
  { path: '/cost/optimization', requiredCapabilities: ['cost.optimization.read'], legacyPermissions: ['dashboards:read'] },
  { path: '/settings/parameters', requiredCapabilities: ['settings.parameter.read'] },
  { path: '/settings/global', requiredCapabilities: ['settings.global.read'] },
  { path: '/settings/versions', requiredCapabilities: ['settings.version.read'] },
  { path: '/help/syntax', requiredCapabilities: ['help.read'], legacyPermissions: ['dashboards:read', 'logs:read'] },
  { path: '/help/faq', requiredCapabilities: ['help.read'], legacyPermissions: ['dashboards:read', 'logs:read'] },
  { path: '/help/tickets', requiredCapabilities: ['help.read'], legacyPermissions: ['dashboards:read', 'logs:read'] },
];

function hasWildcard(values: string[]): boolean {
  return values.includes('*');
}

function normalizeValues(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

export function findRouteAuthorizationRule(pathname: string): RouteAuthorizationRule | undefined {
  return ROUTE_AUTHORIZATION_RULES.find((rule) => Boolean(matchPath({ path: rule.path, end: true }, pathname)));
}

export function hasAnyCapability(capabilities: string[], requiredCapabilities: string[]): boolean {
  if (requiredCapabilities.length === 0) return true;
  const normalizedCapabilities = normalizeValues(capabilities);
  if (hasWildcard(normalizedCapabilities)) return true;
  return requiredCapabilities.some((capability) => normalizedCapabilities.includes(capability));
}

export function hasAnyLegacyPermission(permissions: string[], requiredPermissions?: string[]): boolean {
  if (!requiredPermissions || requiredPermissions.length === 0) return false;
  const normalizedPermissions = normalizeValues(permissions);
  if (hasWildcard(normalizedPermissions)) return true;
  return requiredPermissions.some((permission) => normalizedPermissions.includes(permission));
}

export function canAccessRoute(pathname: string, authorization: Pick<AuthorizationSnapshot, 'permissions' | 'capabilities'>): boolean {
  const rule = findRouteAuthorizationRule(pathname);
  if (!rule) return true;
  return (
    hasAnyCapability(authorization.capabilities, rule.requiredCapabilities) ||
    hasAnyLegacyPermission(authorization.permissions, rule.legacyPermissions)
  );
}

export function findFirstAccessiblePath(authorization: Pick<AuthorizationSnapshot, 'permissions' | 'capabilities'>): string | undefined {
  return ROUTE_AUTHORIZATION_RULES
    .filter((rule) => !rule.path.includes(':'))
    .find((rule) => canAccessRoute(rule.path, authorization))?.path;
}

export function evaluateRouteAccess(
  pathname: string,
  authorization: Pick<AuthorizationSnapshot, 'permissions' | 'capabilities'>,
): { allowed: boolean; fallbackPath?: string } {
  const rule = findRouteAuthorizationRule(pathname);
  if (!rule) {
    return { allowed: true };
  }
  if (canAccessRoute(pathname, authorization)) {
    return { allowed: true };
  }
  if (rule.fallbackPath && canAccessRoute(rule.fallbackPath, authorization)) {
    return { allowed: false, fallbackPath: rule.fallbackPath };
  }
  return {
    allowed: false,
    fallbackPath: findFirstAccessiblePath(authorization),
  };
}

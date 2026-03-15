import { canAccessRoute, hasAnyCapability, hasAnyLegacyPermission } from '../auth/routeAuthorization';
import type { AuthorizationSnapshot } from '../types/authz';

export interface DashboardEntryGate {
  allowed: boolean;
  deniedTooltip?: string;
}

export interface DashboardQuickActionAccess {
  realtimeSearch: DashboardEntryGate;
  alertsList: DashboardEntryGate;
  ingestSourceCreate: DashboardEntryGate;
  alertRuleCreate: DashboardEntryGate;
  storageIndexCreate: DashboardEntryGate;
  reportGenerate: DashboardEntryGate;
  auditLogs: DashboardEntryGate;
}

function allow(): DashboardEntryGate {
  return { allowed: true };
}

function deny(deniedTooltip: string): DashboardEntryGate {
  return {
    allowed: false,
    deniedTooltip,
  };
}

export function resolveDashboardQuickActionAccess(
  authorization: Pick<AuthorizationSnapshot, 'permissions' | 'capabilities'>,
): DashboardQuickActionAccess {
  const canAccessRealtimeSearch = canAccessRoute('/search/realtime', authorization);
  const canAccessAlertsList = canAccessRoute('/alerts/list', authorization);
  const canAccessAlertRules = canAccessRoute('/alerts/rules', authorization);
  const canAccessIngestionWizard = canAccessRoute('/ingestion/wizard', authorization);
  const canAccessStorageIndices = canAccessRoute('/storage/indices', authorization);
  const canAccessReportManagement = canAccessRoute('/reports/management', authorization);
  const canAccessAuditLogs = canAccessRoute('/security/audit', authorization);

  const canCreateAlertRule =
    canAccessAlertRules &&
    (
      hasAnyCapability(authorization.capabilities, ['alert.rule.create']) ||
      hasAnyLegacyPermission(authorization.permissions, ['alerts:write'])
    );
  const canCreateIngestSource =
    canAccessIngestionWizard && hasAnyCapability(authorization.capabilities, ['ingest.source.create']);
  const canCreateStorageIndex =
    canAccessStorageIndices && hasAnyCapability(authorization.capabilities, ['storage.index.update']);
  const canGenerateReport =
    canAccessReportManagement && hasAnyCapability(authorization.capabilities, ['report.generate']);

  return {
    realtimeSearch: canAccessRealtimeSearch
      ? allow()
      : deny('当前会话缺少 log.query.read / logs:read 能力'),
    alertsList: canAccessAlertsList
      ? allow()
      : deny('当前会话缺少 alert.event.read / alerts:read 能力'),
    ingestSourceCreate: !canAccessIngestionWizard
      ? deny('当前会话缺少 ingest.source.read 页面访问能力')
      : canCreateIngestSource
      ? allow()
      : deny('当前会话缺少 ingest.source.create 能力'),
    alertRuleCreate: !canAccessAlertRules
      ? deny('当前会话缺少 alert.rule.read / alerts:read 页面访问能力')
      : canCreateAlertRule
      ? allow()
      : deny('当前会话缺少 alert.rule.create / alerts:write 能力'),
    storageIndexCreate: !canAccessStorageIndices
      ? deny('当前会话缺少 storage.index.read 页面访问能力')
      : canCreateStorageIndex
      ? allow()
      : deny('当前会话缺少 storage.index.update 能力'),
    reportGenerate: !canAccessReportManagement
      ? deny('当前会话缺少 report.read 能力')
      : canGenerateReport
      ? allow()
      : deny('当前会话缺少 report.generate 能力'),
    auditLogs: canAccessAuditLogs
      ? allow()
      : deny('当前会话缺少 audit.log.read / audit:read 能力'),
  };
}

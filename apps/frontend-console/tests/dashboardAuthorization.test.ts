import { describe, expect, it } from 'vitest';
import { resolveDashboardQuickActionAccess } from '../src/pages/dashboardAuthorization';

describe('dashboardAuthorization', () => {
  it('keeps dashboard shortcuts disabled for dashboard-only sessions', () => {
    const access = resolveDashboardQuickActionAccess({
      permissions: ['dashboards:read'],
      capabilities: ['dashboard.read'],
    });

    expect(access.realtimeSearch.allowed).toBe(false);
    expect(access.alertsList.allowed).toBe(false);
    expect(access.ingestSourceCreate.allowed).toBe(false);
    expect(access.alertRuleCreate.allowed).toBe(false);
    expect(access.storageIndexCreate.allowed).toBe(false);
    expect(access.reportGenerate.allowed).toBe(false);
    expect(access.auditLogs.allowed).toBe(false);
    expect(access.reportGenerate.deniedTooltip).toBe('当前会话缺少 report.read 能力');
  });

  it('allows alert rule creation through legacy alerts write compatibility only after route access exists', () => {
    const access = resolveDashboardQuickActionAccess({
      permissions: ['alerts:read', 'alerts:write'],
      capabilities: [],
    });

    expect(access.alertsList.allowed).toBe(true);
    expect(access.alertRuleCreate.allowed).toBe(true);
    expect(access.ingestSourceCreate.allowed).toBe(false);
    expect(access.auditLogs.allowed).toBe(false);
  });

  it('does not treat read-only page access as create authority', () => {
    const access = resolveDashboardQuickActionAccess({
      permissions: [],
      capabilities: ['ingest.source.read', 'alert.rule.read', 'storage.index.read', 'report.read'],
    });

    expect(access.ingestSourceCreate.allowed).toBe(false);
    expect(access.ingestSourceCreate.deniedTooltip).toBe('当前会话缺少 ingest.source.create 能力');
    expect(access.alertRuleCreate.allowed).toBe(false);
    expect(access.alertRuleCreate.deniedTooltip).toBe('当前会话缺少 alert.rule.create / alerts:write 能力');
    expect(access.storageIndexCreate.allowed).toBe(false);
    expect(access.storageIndexCreate.deniedTooltip).toBe('当前会话缺少 storage.index.update 能力');
    expect(access.reportGenerate.allowed).toBe(false);
    expect(access.reportGenerate.deniedTooltip).toBe('当前会话缺少 report.generate 能力');
  });

  it('grants every dashboard shortcut with matching granular capabilities', () => {
    const access = resolveDashboardQuickActionAccess({
      permissions: [],
      capabilities: [
        'log.query.read',
        'alert.event.read',
        'alert.rule.read',
        'alert.rule.create',
        'ingest.source.read',
        'ingest.source.create',
        'storage.index.read',
        'storage.index.update',
        'report.read',
        'report.generate',
        'audit.log.read',
      ],
    });

    expect(access.realtimeSearch.allowed).toBe(true);
    expect(access.alertsList.allowed).toBe(true);
    expect(access.ingestSourceCreate.allowed).toBe(true);
    expect(access.alertRuleCreate.allowed).toBe(true);
    expect(access.storageIndexCreate.allowed).toBe(true);
    expect(access.reportGenerate.allowed).toBe(true);
    expect(access.auditLogs.allowed).toBe(true);
  });
});

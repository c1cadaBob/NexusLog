import { describe, expect, it } from 'vitest';
import {
  isReservedAuditSubjectQuery,
  resolveAuditLogsActionAccess,
} from '../src/pages/security/auditLogsAuthorization';

describe('auditLogsAuthorization', () => {
  it('keeps audit page sensitive actions disabled when only read capability exists', () => {
    const access = resolveAuditLogsActionAccess({
      capabilities: ['audit.log.read'],
    });

    expect(access.canExportAuditLogs).toBe(false);
    expect(access.canReadReservedSubjects).toBe(false);
    expect(access.hasSensitiveAuditAccess).toBe(false);
  });

  it('enables reserved subject filtering and export only for explicit capabilities', () => {
    const reservedAccess = resolveAuditLogsActionAccess({
      capabilities: ['audit.log.read_reserved_subject'],
    });
    const exportAccess = resolveAuditLogsActionAccess({
      capabilities: ['audit.log.export'],
    });

    expect(reservedAccess.canReadReservedSubjects).toBe(true);
    expect(reservedAccess.canExportAuditLogs).toBe(false);
    expect(exportAccess.canExportAuditLogs).toBe(true);
    expect(exportAccess.canReadReservedSubjects).toBe(false);
  });

  it('treats wildcard capability as having all sensitive audit actions', () => {
    const access = resolveAuditLogsActionAccess({
      capabilities: ['*'],
    });

    expect(access.canReadReservedSubjects).toBe(true);
    expect(access.canExportAuditLogs).toBe(true);
    expect(access.hasSensitiveAuditAccess).toBe(true);
  });

  it('matches reserved subject queries exactly', () => {
    expect(isReservedAuditSubjectQuery('sys-superadmin', ['sys-superadmin', 'system-automation'])).toBe(true);
    expect(isReservedAuditSubjectQuery(' system-automation ', ['sys-superadmin', 'system-automation'])).toBe(true);
    expect(isReservedAuditSubjectQuery('sys', ['sys-superadmin', 'system-automation'])).toBe(false);
    expect(isReservedAuditSubjectQuery('alice sys-superadmin', ['sys-superadmin', 'system-automation'])).toBe(false);
  });
});

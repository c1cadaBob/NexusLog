import { describe, expect, it } from 'vitest';
import { resolveReportManagementActionAccess } from '../src/pages/reports/reportManagementAuthorization';

describe('reportManagementAuthorization', () => {
  it('keeps page view-only when only report.read exists', () => {
    const access = resolveReportManagementActionAccess({
      capabilities: ['report.read'],
    });

    expect(access.canCreateReport).toBe(false);
    expect(access.canUpdateReport).toBe(false);
    expect(access.canDeleteReport).toBe(false);
    expect(access.canGenerateReport).toBe(false);
    expect(access.hasAnyWriteAccess).toBe(false);
    expect(access.isViewOnly).toBe(true);
  });

  it('grants matching report actions independently', () => {
    const access = resolveReportManagementActionAccess({
      capabilities: ['report.create', 'report.generate'],
    });

    expect(access.canCreateReport).toBe(true);
    expect(access.canGenerateReport).toBe(true);
    expect(access.canUpdateReport).toBe(false);
    expect(access.canDeleteReport).toBe(false);
    expect(access.hasAnyWriteAccess).toBe(true);
    expect(access.isViewOnly).toBe(false);
  });

  it('treats wildcard capability as full report management access', () => {
    const access = resolveReportManagementActionAccess({
      capabilities: ['*'],
    });

    expect(access.canCreateReport).toBe(true);
    expect(access.canUpdateReport).toBe(true);
    expect(access.canDeleteReport).toBe(true);
    expect(access.canGenerateReport).toBe(true);
    expect(access.isViewOnly).toBe(false);
  });
});

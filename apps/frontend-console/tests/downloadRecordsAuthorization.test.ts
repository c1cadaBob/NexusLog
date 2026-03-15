import { describe, expect, it } from 'vitest';
import { resolveDownloadRecordsActionAccess } from '../src/pages/reports/downloadRecordsAuthorization';

describe('downloadRecordsAuthorization', () => {
  it('maps legacy logs:export to export creation and download actions', () => {
    const access = resolveDownloadRecordsActionAccess({
      permissions: ['logs:export'],
      capabilities: [],
    });

    expect(access.canCreateExportJob).toBe(true);
    expect(access.canDownloadExportJob).toBe(true);
    expect(access.hasAnyWriteAccess).toBe(true);
    expect(access.isViewOnly).toBe(false);
  });

  it('keeps page view-only when only report.download.read exists', () => {
    const access = resolveDownloadRecordsActionAccess({
      permissions: [],
      capabilities: ['report.download.read'],
    });

    expect(access.canCreateExportJob).toBe(false);
    expect(access.canDownloadExportJob).toBe(false);
    expect(access.hasAnyWriteAccess).toBe(false);
    expect(access.isViewOnly).toBe(true);
  });

  it('allows partial export actions when only matching capability exists', () => {
    const createOnly = resolveDownloadRecordsActionAccess({
      permissions: [],
      capabilities: ['export.job.create'],
    });
    const downloadOnly = resolveDownloadRecordsActionAccess({
      permissions: [],
      capabilities: ['export.job.download'],
    });

    expect(createOnly.canCreateExportJob).toBe(true);
    expect(createOnly.canDownloadExportJob).toBe(false);
    expect(createOnly.isViewOnly).toBe(false);

    expect(downloadOnly.canCreateExportJob).toBe(false);
    expect(downloadOnly.canDownloadExportJob).toBe(true);
    expect(downloadOnly.isViewOnly).toBe(false);
  });
});

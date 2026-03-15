import { describe, expect, it } from 'vitest';
import { resolveScheduledTasksActionAccess } from '../src/pages/reports/scheduledTasksAuthorization';

describe('scheduledTasksAuthorization', () => {
  it('keeps page view-only when only report.schedule.read exists', () => {
    const access = resolveScheduledTasksActionAccess({
      capabilities: ['report.schedule.read'],
    });

    expect(access.canCreateScheduledTask).toBe(false);
    expect(access.canUpdateScheduledTask).toBe(false);
    expect(access.canDeleteScheduledTask).toBe(false);
    expect(access.canToggleScheduledTask).toBe(false);
    expect(access.hasAnyWriteAccess).toBe(false);
    expect(access.isViewOnly).toBe(true);
  });

  it('grants all schedule write actions when report.schedule.update exists', () => {
    const access = resolveScheduledTasksActionAccess({
      capabilities: ['report.schedule.update'],
    });

    expect(access.canCreateScheduledTask).toBe(true);
    expect(access.canUpdateScheduledTask).toBe(true);
    expect(access.canDeleteScheduledTask).toBe(true);
    expect(access.canToggleScheduledTask).toBe(true);
    expect(access.hasAnyWriteAccess).toBe(true);
    expect(access.isViewOnly).toBe(false);
  });

  it('treats wildcard capability as full scheduled task access', () => {
    const access = resolveScheduledTasksActionAccess({
      capabilities: ['*'],
    });

    expect(access.canCreateScheduledTask).toBe(true);
    expect(access.canUpdateScheduledTask).toBe(true);
    expect(access.canDeleteScheduledTask).toBe(true);
    expect(access.canToggleScheduledTask).toBe(true);
    expect(access.isViewOnly).toBe(false);
  });
});

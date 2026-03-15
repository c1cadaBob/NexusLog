import { hasAnyCapability } from '../../auth/routeAuthorization';
import type { AuthorizationSnapshot } from '../../types/authz';

export interface ScheduledTasksActionAccess {
  canCreateScheduledTask: boolean;
  canUpdateScheduledTask: boolean;
  canDeleteScheduledTask: boolean;
  canToggleScheduledTask: boolean;
  hasAnyWriteAccess: boolean;
  isViewOnly: boolean;
}

const SCHEDULE_UPDATE_CAPABILITIES = ['report.schedule.update'];

export function resolveScheduledTasksActionAccess(
  authorization: Pick<AuthorizationSnapshot, 'capabilities'>,
): ScheduledTasksActionAccess {
  const canManageSchedules = hasAnyCapability(authorization.capabilities, SCHEDULE_UPDATE_CAPABILITIES);

  return {
    canCreateScheduledTask: canManageSchedules,
    canUpdateScheduledTask: canManageSchedules,
    canDeleteScheduledTask: canManageSchedules,
    canToggleScheduledTask: canManageSchedules,
    hasAnyWriteAccess: canManageSchedules,
    isViewOnly: !canManageSchedules,
  };
}

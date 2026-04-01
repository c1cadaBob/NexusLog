import { hasAnyCapability, hasAnyLegacyPermission } from '../../auth/routeAuthorization';
import type { AuthorizationSnapshot } from '../../types/authz';

interface ActionRequirement {
  requiredCapabilities: string[];
  legacyPermissions?: string[];
}

export interface IncidentActionAccess {
  canReadIncident: boolean;
  canReadSlaSummary: boolean;
  canCreateIncident: boolean;
  canUpdateIncident: boolean;
  canAssignIncident: boolean;
  canCloseIncident: boolean;
  canArchiveIncident: boolean;
  hasAnyWriteAccess: boolean;
  isReadOnly: boolean;
}

const INCIDENT_READ_REQUIREMENT: ActionRequirement = {
  requiredCapabilities: ['incident.read'],
  legacyPermissions: ['incidents:read'],
};

const INCIDENT_SLA_READ_REQUIREMENT: ActionRequirement = {
  requiredCapabilities: ['incident.sla.read', 'incident.read'],
  legacyPermissions: ['incidents:read'],
};

const INCIDENT_CREATE_REQUIREMENT: ActionRequirement = {
  requiredCapabilities: ['incident.create'],
  legacyPermissions: ['incidents:write'],
};

const INCIDENT_UPDATE_REQUIREMENT: ActionRequirement = {
  requiredCapabilities: ['incident.update'],
  legacyPermissions: ['incidents:write'],
};

const INCIDENT_ASSIGN_REQUIREMENT: ActionRequirement = {
  requiredCapabilities: ['incident.assign'],
  legacyPermissions: ['incidents:write'],
};

const INCIDENT_CLOSE_REQUIREMENT: ActionRequirement = {
  requiredCapabilities: ['incident.close'],
  legacyPermissions: ['incidents:write'],
};

const INCIDENT_ARCHIVE_REQUIREMENT: ActionRequirement = {
  requiredCapabilities: ['incident.archive'],
  legacyPermissions: ['incidents:write'],
};

function hasActionAccess(
  authorization: Pick<AuthorizationSnapshot, 'permissions' | 'capabilities'>,
  requirement: ActionRequirement,
): boolean {
  return (
    hasAnyCapability(authorization.capabilities, requirement.requiredCapabilities)
    || hasAnyLegacyPermission(authorization.permissions, requirement.legacyPermissions)
  );
}

export function resolveIncidentActionAccess(
  authorization: Pick<AuthorizationSnapshot, 'permissions' | 'capabilities'>,
): IncidentActionAccess {
  const canReadIncident = hasActionAccess(authorization, INCIDENT_READ_REQUIREMENT);
  const canReadSlaSummary = hasActionAccess(authorization, INCIDENT_SLA_READ_REQUIREMENT);
  const canCreateIncident = hasActionAccess(authorization, INCIDENT_CREATE_REQUIREMENT);
  const canUpdateIncident = hasActionAccess(authorization, INCIDENT_UPDATE_REQUIREMENT);
  const canAssignIncident = hasActionAccess(authorization, INCIDENT_ASSIGN_REQUIREMENT);
  const canCloseIncident = hasActionAccess(authorization, INCIDENT_CLOSE_REQUIREMENT);
  const canArchiveIncident = hasActionAccess(authorization, INCIDENT_ARCHIVE_REQUIREMENT);
  const hasAnyWriteAccess = [
    canCreateIncident,
    canUpdateIncident,
    canAssignIncident,
    canCloseIncident,
    canArchiveIncident,
  ].some(Boolean);

  return {
    canReadIncident,
    canReadSlaSummary,
    canCreateIncident,
    canUpdateIncident,
    canAssignIncident,
    canCloseIncident,
    canArchiveIncident,
    hasAnyWriteAccess,
    isReadOnly: !hasAnyWriteAccess,
  };
}

export function getIncidentPermissionDeniedReason(
  capability: 'read' | 'create' | 'update' | 'assign' | 'close' | 'archive' | 'sla',
): string {
  switch (capability) {
    case 'create':
      return '当前会话缺少 incident.create / incidents:write 能力';
    case 'update':
      return '当前会话缺少 incident.update / incidents:write 能力';
    case 'assign':
      return '当前会话缺少 incident.assign / incidents:write 能力';
    case 'close':
      return '当前会话缺少 incident.close / incidents:write 能力';
    case 'archive':
      return '当前会话缺少 incident.archive / incidents:write 能力';
    case 'sla':
      return '当前会话缺少 incident.sla.read / incident.read / incidents:read 能力';
    case 'read':
    default:
      return '当前会话缺少 incident.read / incidents:read 能力';
  }
}

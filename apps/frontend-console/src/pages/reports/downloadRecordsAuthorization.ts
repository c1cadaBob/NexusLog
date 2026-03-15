import { hasAnyCapability, hasAnyLegacyPermission } from '../../auth/routeAuthorization';
import type { AuthorizationSnapshot } from '../../types/authz';

interface ActionRequirement {
  requiredCapabilities: string[];
  legacyPermissions?: string[];
}

export interface DownloadRecordsActionAccess {
  canCreateExportJob: boolean;
  canDownloadExportJob: boolean;
  hasAnyWriteAccess: boolean;
  isViewOnly: boolean;
}

const DOWNLOAD_RECORDS_ACTION_REQUIREMENTS: Record<string, ActionRequirement> = {
  createExportJob: {
    requiredCapabilities: ['export.job.create'],
    legacyPermissions: ['logs:export'],
  },
  downloadExportJob: {
    requiredCapabilities: ['export.job.download'],
    legacyPermissions: ['logs:export'],
  },
};

function hasActionAccess(
  authorization: Pick<AuthorizationSnapshot, 'permissions' | 'capabilities'>,
  requirement: ActionRequirement,
): boolean {
  return (
    hasAnyCapability(authorization.capabilities, requirement.requiredCapabilities) ||
    hasAnyLegacyPermission(authorization.permissions, requirement.legacyPermissions)
  );
}

export function resolveDownloadRecordsActionAccess(
  authorization: Pick<AuthorizationSnapshot, 'permissions' | 'capabilities'>,
): DownloadRecordsActionAccess {
  const canCreateExportJob = hasActionAccess(authorization, DOWNLOAD_RECORDS_ACTION_REQUIREMENTS.createExportJob);
  const canDownloadExportJob = hasActionAccess(authorization, DOWNLOAD_RECORDS_ACTION_REQUIREMENTS.downloadExportJob);
  const hasAnyWriteAccess = canCreateExportJob || canDownloadExportJob;

  return {
    canCreateExportJob,
    canDownloadExportJob,
    hasAnyWriteAccess,
    isViewOnly: !hasAnyWriteAccess,
  };
}

import { hasAnyCapability } from '../../auth/routeAuthorization';
import type { AuthorizationSnapshot } from '../../types/authz';

export interface ReportManagementActionAccess {
  canCreateReport: boolean;
  canUpdateReport: boolean;
  canDeleteReport: boolean;
  canGenerateReport: boolean;
  hasAnyWriteAccess: boolean;
  isViewOnly: boolean;
}

const REPORT_CREATE_CAPABILITIES = ['report.create'];
const REPORT_UPDATE_CAPABILITIES = ['report.update'];
const REPORT_DELETE_CAPABILITIES = ['report.delete'];
const REPORT_GENERATE_CAPABILITIES = ['report.generate'];

export function resolveReportManagementActionAccess(
  authorization: Pick<AuthorizationSnapshot, 'capabilities'>,
): ReportManagementActionAccess {
  const canCreateReport = hasAnyCapability(authorization.capabilities, REPORT_CREATE_CAPABILITIES);
  const canUpdateReport = hasAnyCapability(authorization.capabilities, REPORT_UPDATE_CAPABILITIES);
  const canDeleteReport = hasAnyCapability(authorization.capabilities, REPORT_DELETE_CAPABILITIES);
  const canGenerateReport = hasAnyCapability(authorization.capabilities, REPORT_GENERATE_CAPABILITIES);
  const hasAnyWriteAccess = canCreateReport || canUpdateReport || canDeleteReport || canGenerateReport;

  return {
    canCreateReport,
    canUpdateReport,
    canDeleteReport,
    canGenerateReport,
    hasAnyWriteAccess,
    isViewOnly: !hasAnyWriteAccess,
  };
}

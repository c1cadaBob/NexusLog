import { hasAnyCapability } from '../../auth/routeAuthorization';
import type { AuthorizationSnapshot } from '../../types/authz';

export interface AuditLogsActionAccess {
  canExportAuditLogs: boolean;
  canReadReservedSubjects: boolean;
  hasSensitiveAuditAccess: boolean;
}

const AUDIT_EXPORT_CAPABILITIES = ['audit.log.export'];
const AUDIT_RESERVED_SUBJECT_CAPABILITIES = ['audit.log.read_reserved_subject'];

export function resolveAuditLogsActionAccess(
  authorization: Pick<AuthorizationSnapshot, 'capabilities'>,
): AuditLogsActionAccess {
  const canExportAuditLogs = hasAnyCapability(authorization.capabilities, AUDIT_EXPORT_CAPABILITIES);
  const canReadReservedSubjects = hasAnyCapability(authorization.capabilities, AUDIT_RESERVED_SUBJECT_CAPABILITIES);

  return {
    canExportAuditLogs,
    canReadReservedSubjects,
    hasSensitiveAuditAccess: canExportAuditLogs || canReadReservedSubjects,
  };
}

export function isReservedAuditSubjectQuery(
  value: string,
  reservedUsernames: readonly string[],
): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return reservedUsernames.some((username) => username.trim().toLowerCase() === normalized);
}

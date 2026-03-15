import { hasAnyCapability } from '../../auth/routeAuthorization';
import type { AuthorizationSnapshot } from '../../types/authz';

export interface RolePermissionsActionAccess {
  canCopyPermissions: boolean;
  hasExplicitCopyCapability: boolean;
  isViewOnly: boolean;
}

const COPY_PERMISSION_CAPABILITIES = ['iam.role.copy_permission', 'iam.role.export'];

export function resolveRolePermissionsActionAccess(
  authorization: Pick<AuthorizationSnapshot, 'capabilities'>,
): RolePermissionsActionAccess {
  const hasExplicitCopyCapability = hasAnyCapability(authorization.capabilities, COPY_PERMISSION_CAPABILITIES);

  return {
    canCopyPermissions: hasExplicitCopyCapability,
    hasExplicitCopyCapability,
    isViewOnly: !hasExplicitCopyCapability,
  };
}

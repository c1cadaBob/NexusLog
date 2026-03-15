import { hasAnyCapability, hasAnyLegacyPermission } from '../../auth/routeAuthorization';
import type { AuthorizationSnapshot } from '../../types/authz';

interface ActionRequirement {
  requiredCapabilities: string[];
  legacyPermissions?: string[];
}

export interface UserManagementActionAccess {
  canCreateUser: boolean;
  canUpdateUserProfile: boolean;
  canUpdateUserStatus: boolean;
  canGrantUserRole: boolean;
  canRevokeUserRole: boolean;
  canInviteUser: boolean;
  canImportUser: boolean;
  hasAnyWriteAccess: boolean;
  isReadOnly: boolean;
}

const USER_MANAGEMENT_ACTION_REQUIREMENTS: Record<string, ActionRequirement> = {
  createUser: {
    requiredCapabilities: ['iam.user.create'],
    legacyPermissions: ['users:write'],
  },
  updateUserProfile: {
    requiredCapabilities: ['iam.user.update_profile'],
    legacyPermissions: ['users:write'],
  },
  updateUserStatus: {
    requiredCapabilities: ['iam.user.update_status'],
    legacyPermissions: ['users:write'],
  },
  grantUserRole: {
    requiredCapabilities: ['iam.user.grant_role'],
    legacyPermissions: ['users:write'],
  },
  revokeUserRole: {
    requiredCapabilities: ['iam.user.revoke_role'],
    legacyPermissions: ['users:write'],
  },
  inviteUser: {
    requiredCapabilities: ['iam.user.invite'],
  },
  importUser: {
    requiredCapabilities: ['iam.user.import'],
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

export function resolveUserManagementActionAccess(
  authorization: Pick<AuthorizationSnapshot, 'permissions' | 'capabilities'>,
): UserManagementActionAccess {
  const canCreateUser = hasActionAccess(authorization, USER_MANAGEMENT_ACTION_REQUIREMENTS.createUser);
  const canUpdateUserProfile = hasActionAccess(authorization, USER_MANAGEMENT_ACTION_REQUIREMENTS.updateUserProfile);
  const canUpdateUserStatus = hasActionAccess(authorization, USER_MANAGEMENT_ACTION_REQUIREMENTS.updateUserStatus);
  const canGrantUserRole = hasActionAccess(authorization, USER_MANAGEMENT_ACTION_REQUIREMENTS.grantUserRole);
  const canRevokeUserRole = hasActionAccess(authorization, USER_MANAGEMENT_ACTION_REQUIREMENTS.revokeUserRole);
  const canInviteUser = hasActionAccess(authorization, USER_MANAGEMENT_ACTION_REQUIREMENTS.inviteUser);
  const canImportUser = hasActionAccess(authorization, USER_MANAGEMENT_ACTION_REQUIREMENTS.importUser);
  const hasAnyWriteAccess = [
    canCreateUser,
    canUpdateUserProfile,
    canUpdateUserStatus,
    canGrantUserRole,
    canRevokeUserRole,
    canInviteUser,
    canImportUser,
  ].some(Boolean);

  return {
    canCreateUser,
    canUpdateUserProfile,
    canUpdateUserStatus,
    canGrantUserRole,
    canRevokeUserRole,
    canInviteUser,
    canImportUser,
    hasAnyWriteAccess,
    isReadOnly: !hasAnyWriteAccess,
  };
}

export function canOpenUserEditModal(access: UserManagementActionAccess): boolean {
  return access.canUpdateUserProfile || access.canGrantUserRole || access.canRevokeUserRole;
}

export function canAssignRoleOnCreate(access: UserManagementActionAccess): boolean {
  return access.canGrantUserRole;
}

export function canEditRoleForUser(access: UserManagementActionAccess, currentPrimaryRoleId?: string): boolean {
  return access.canGrantUserRole || Boolean(currentPrimaryRoleId && access.canRevokeUserRole);
}

export function canApplyPrimaryRoleChange(
  access: UserManagementActionAccess,
  currentPrimaryRoleId?: string,
  nextPrimaryRoleId?: string,
): boolean {
  if ((currentPrimaryRoleId ?? '') === (nextPrimaryRoleId ?? '')) {
    return true;
  }

  if (!currentPrimaryRoleId && nextPrimaryRoleId) {
    return access.canGrantUserRole;
  }

  if (currentPrimaryRoleId && !nextPrimaryRoleId) {
    return access.canRevokeUserRole;
  }

  return access.canGrantUserRole && access.canRevokeUserRole;
}

export function getPrimaryRoleChangeDeniedReason(
  access: UserManagementActionAccess,
  currentPrimaryRoleId?: string,
  nextPrimaryRoleId?: string,
): string | null {
  if (canApplyPrimaryRoleChange(access, currentPrimaryRoleId, nextPrimaryRoleId)) {
    return null;
  }

  if (!currentPrimaryRoleId && nextPrimaryRoleId) {
    return '当前会话缺少用户角色授予权限';
  }

  if (currentPrimaryRoleId && !nextPrimaryRoleId) {
    return '当前会话缺少用户角色移除权限';
  }

  return '当前会话缺少完整的角色调整权限';
}

import { describe, expect, it } from 'vitest';
import {
  canApplyPrimaryRoleChange,
  canAssignRoleOnCreate,
  canEditRoleForUser,
  canOpenUserEditModal,
  getPrimaryRoleChangeDeniedReason,
  resolveUserManagementActionAccess,
} from '../src/pages/security/userManagementAuthorization';

describe('userManagementAuthorization', () => {
  it('maps legacy users:write to core user write actions but not invite/import', () => {
    const access = resolveUserManagementActionAccess({
      permissions: ['users:write'],
      capabilities: [],
    });

    expect(access.canCreateUser).toBe(true);
    expect(access.canUpdateUserProfile).toBe(true);
    expect(access.canUpdateUserStatus).toBe(true);
    expect(access.canGrantUserRole).toBe(true);
    expect(access.canRevokeUserRole).toBe(true);
    expect(access.canInviteUser).toBe(false);
    expect(access.canImportUser).toBe(false);
    expect(access.isReadOnly).toBe(false);
  });

  it('keeps read-only access when only iam.user.read is present', () => {
    const access = resolveUserManagementActionAccess({
      permissions: ['users:read'],
      capabilities: ['iam.user.read'],
    });

    expect(access.canCreateUser).toBe(false);
    expect(access.canUpdateUserProfile).toBe(false);
    expect(access.canUpdateUserStatus).toBe(false);
    expect(access.isReadOnly).toBe(true);
    expect(canOpenUserEditModal(access)).toBe(false);
    expect(canAssignRoleOnCreate(access)).toBe(false);
  });

  it('allows partial role operations only when the requested change matches available capabilities', () => {
    const revokeOnlyAccess = resolveUserManagementActionAccess({
      permissions: [],
      capabilities: ['iam.user.revoke_role'],
    });

    expect(canEditRoleForUser(revokeOnlyAccess, 'role-1')).toBe(true);
    expect(canApplyPrimaryRoleChange(revokeOnlyAccess, 'role-1', undefined)).toBe(true);
    expect(canApplyPrimaryRoleChange(revokeOnlyAccess, 'role-1', 'role-2')).toBe(false);
    expect(getPrimaryRoleChangeDeniedReason(revokeOnlyAccess, 'role-1', 'role-2')).toBe('当前会话缺少完整的角色调整权限');

    const grantOnlyAccess = resolveUserManagementActionAccess({
      permissions: [],
      capabilities: ['iam.user.grant_role'],
    });

    expect(canEditRoleForUser(grantOnlyAccess)).toBe(true);
    expect(canApplyPrimaryRoleChange(grantOnlyAccess, undefined, 'role-2')).toBe(true);
    expect(canApplyPrimaryRoleChange(grantOnlyAccess, 'role-1', 'role-2')).toBe(false);
    expect(getPrimaryRoleChangeDeniedReason(grantOnlyAccess, undefined, 'role-2')).toBeNull();
  });
});

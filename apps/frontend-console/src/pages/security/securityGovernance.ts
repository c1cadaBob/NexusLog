import type { RoleData, UserData } from '../../api/user';

const protectedRoleNames = new Set(['super_admin', 'system_automation']);
const protectedUsernames = new Set(['sys-superadmin', 'system-automation']);

export const protectedGovernanceTagLabel = '系统保留';

function normalizeGovernanceName(value?: string): string {
  return (value ?? '').trim().toLowerCase();
}

export function isProtectedRoleName(name?: string): boolean {
  return protectedRoleNames.has(normalizeGovernanceName(name));
}

export function isProtectedRole(role?: Pick<RoleData, 'name'> | null): boolean {
  return isProtectedRoleName(role?.name);
}

export function isProtectedUser(user?: Pick<UserData, 'username' | 'roles'> | null): boolean {
  if (!user) return false;
  if (protectedUsernames.has(normalizeGovernanceName(user.username))) {
    return true;
  }
  return (user.roles ?? []).some((role) => isProtectedRole(role));
}

export function getAssignableRoles(roles: RoleData[]): RoleData[] {
  return roles.filter((role) => !isProtectedRole(role));
}

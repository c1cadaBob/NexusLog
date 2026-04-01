import type { RoleData, UserData } from '../../api/user';

export const protectedGovernanceUsernames = ['sys-superadmin', 'system-automation'] as const;
export const testGovernanceUsernamePrefixes = ['e2e_login_', 'e2e_reg_', 'e2e_reset_'] as const;

const protectedRoleNames = new Set(['super_admin', 'system_automation']);
const protectedUsernames = new Set<string>(protectedGovernanceUsernames);

export const protectedGovernanceTagLabel = '系统保留';
export const testGovernanceTagLabel = '测试账号';

export interface UserGovernanceTag {
  key: 'protected' | 'test';
  label: string;
  color: string;
  description: string;
}

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

export function isTestGovernanceUser(user?: Pick<UserData, 'username'> | null): boolean {
  if (!user) return false;
  const normalizedUsername = normalizeGovernanceName(user.username);
  return testGovernanceUsernamePrefixes.some((prefix) => normalizedUsername.startsWith(prefix));
}

export function resolveUserGovernanceTags(user?: Pick<UserData, 'username' | 'roles'> | null): UserGovernanceTag[] {
  const tags: UserGovernanceTag[] = [];

  if (isProtectedUser(user)) {
    tags.push({
      key: 'protected',
      label: protectedGovernanceTagLabel,
      color: 'magenta',
      description: '系统保留账号，仅用于平台管理或自动化归因，不建议作为普通业务用户处理。',
    });
  }

  if (isTestGovernanceUser(user)) {
    tags.push({
      key: 'test',
      label: testGovernanceTagLabel,
      color: 'orange',
      description: '该账号由 E2E/联调用例创建，建议在验证完成后及时清理，避免与真实业务账号混淆。',
    });
  }

  return tags;
}

export function getUserGovernanceNotice(user?: Pick<UserData, 'username' | 'roles'> | null): { type: 'info' | 'warning'; message: string; description: string } | null {
  if (isProtectedUser(user)) {
    return {
      type: 'info',
      message: '系统保留账号',
      description: '该账号由系统治理规则保护，仅用于平台管理或自动化审计归因，不支持按普通用户流程处理。',
    };
  }

  if (isTestGovernanceUser(user)) {
    return {
      type: 'warning',
      message: '测试账号',
      description: '该账号由 E2E/联调用例创建，仅用于自动化验证。若已完成验证，建议尽快清理，避免影响用户管理视图。',
    };
  }

  return null;
}

export function getAssignableRoles(roles: RoleData[]): RoleData[] {
  return roles.filter((role) => !isProtectedRole(role));
}

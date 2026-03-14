import { describe, expect, it } from 'vitest';
import type { RoleData, UserData } from '../src/api/user';
import {
  getAssignableRoles,
  isProtectedRole,
  isProtectedRoleName,
  isProtectedUser,
} from '../src/pages/security/securityGovernance';

function buildRole(name: string): RoleData {
  return {
    id: `${name}-id`,
    name,
    description: `${name} description`,
    permissions: [],
  };
}

function buildUser(username: string, roles: RoleData[] = []): UserData {
  return {
    id: `${username}-id`,
    username,
    email: `${username}@example.com`,
    display_name: username,
    status: 'active',
    created_at: '2026-03-14T00:00:00Z',
    updated_at: '2026-03-14T00:00:00Z',
    roles,
  };
}

describe('security governance helpers', () => {
  it('identifies protected roles by name', () => {
    expect(isProtectedRoleName('super_admin')).toBe(true);
    expect(isProtectedRoleName('system_automation')).toBe(true);
    expect(isProtectedRoleName('operator')).toBe(false);
  });

  it('filters protected roles from assignable role list', () => {
    const roles = [buildRole('super_admin'), buildRole('system_admin'), buildRole('system_automation'), buildRole('viewer')];

    expect(getAssignableRoles(roles).map((role) => role.name)).toEqual(['system_admin', 'viewer']);
  });

  it('marks protected users by reserved username or protected role', () => {
    expect(isProtectedUser(buildUser('sys-superadmin'))).toBe(true);
    expect(isProtectedUser(buildUser('alice', [buildRole('system_automation')]))).toBe(true);
    expect(isProtectedUser(buildUser('alice', [buildRole('viewer')]))).toBe(false);
    expect(isProtectedRole(buildRole('system_automation'))).toBe(true);
  });
});

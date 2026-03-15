import { describe, expect, it } from 'vitest';
import { resolveRolePermissionsActionAccess } from '../src/pages/security/rolePermissionsAuthorization';

describe('rolePermissionsAuthorization', () => {
  it('keeps role page in view-only mode when only read capability exists', () => {
    const access = resolveRolePermissionsActionAccess({
      capabilities: ['iam.role.read'],
    });

    expect(access.canCopyPermissions).toBe(false);
    expect(access.hasExplicitCopyCapability).toBe(false);
    expect(access.isViewOnly).toBe(true);
  });

  it('allows copying when explicit copy capability exists', () => {
    const access = resolveRolePermissionsActionAccess({
      capabilities: ['iam.role.read', 'iam.role.copy_permission'],
    });

    expect(access.canCopyPermissions).toBe(true);
    expect(access.hasExplicitCopyCapability).toBe(true);
    expect(access.isViewOnly).toBe(false);
  });

  it('treats wildcard capability and export capability as copy-capable', () => {
    expect(resolveRolePermissionsActionAccess({ capabilities: ['*'] }).canCopyPermissions).toBe(true);
    expect(resolveRolePermissionsActionAccess({ capabilities: ['iam.role.export'] }).canCopyPermissions).toBe(true);
  });
});

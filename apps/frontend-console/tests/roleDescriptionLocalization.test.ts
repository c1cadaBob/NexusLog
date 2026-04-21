import { describe, expect, it } from 'vitest';
import { localizeRoleDescription } from '../src/pages/security/roleDescriptionLocalization';

describe('roleDescriptionLocalization', () => {
  it('localizes built-in English role descriptions to Chinese', () => {
    expect(
      localizeRoleDescription({
        name: 'system_admin',
        description: 'System administrator with user, audit, alert, incident, and monitoring management permissions',
      }),
    ).toBe('系统管理员，具备用户、审计、告警、事件与监控管理权限');

    expect(
      localizeRoleDescription({
        name: 'viewer',
        description: 'Read-only access: view logs, dashboards, and monitoring data',
      }),
    ).toBe('只读访问：查看日志、概览与监控数据');
  });

  it('keeps existing Chinese descriptions unchanged', () => {
    expect(
      localizeRoleDescription({
        name: 'system_admin',
        description: '系统管理员',
      }),
    ).toBe('系统管理员');
  });

  it('falls back to built-in Chinese labels when description is empty', () => {
    expect(
      localizeRoleDescription({
        name: 'super_admin',
        description: '',
      }),
    ).toBe('系统超级管理员（保留角色）');
  });
});

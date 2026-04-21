import type { RoleData } from '../../api/user';

const BUILTIN_ROLE_DESCRIPTION_LOCALIZATION: Record<string, string> = {
  'Full system access including user management and system settings': '完整系统访问权限，包括用户管理与系统设置',
  'System administrator with user, audit, alert, incident, and monitoring management permissions': '系统管理员，具备用户、审计、告警、事件与监控管理权限',
  'Operational access: log search, alert management, incident handling, monitoring': '运维访问：日志检索、告警管理、事件处置与监控查看',
  'Read-only access: view logs, dashboards, and monitoring data': '只读访问：查看日志、概览与监控数据',
  'Reserved super administrator role. Only one bootstrap user may hold this role.': '系统超级管理员（保留角色），仅允许唯一引导创建用户持有',
  'Reserved system account role for automated operation and audit attribution.': '系统自动化保留角色，用于自动化操作与审计归因',
};

const BUILTIN_ROLE_NAME_DESCRIPTION_FALLBACK: Record<string, string> = {
  admin: '管理员',
  system_admin: '系统管理员',
  operator: '运维人员',
  viewer: '只读用户',
  super_admin: '系统超级管理员（保留角色）',
  system_automation: '系统自动化操作（保留角色）',
};

export function localizeRoleDescription(role: Pick<RoleData, 'name' | 'description'>): string {
  const normalizedDescription = role.description.trim();

  if (!normalizedDescription) {
    return BUILTIN_ROLE_NAME_DESCRIPTION_FALLBACK[role.name] ?? '';
  }

  return BUILTIN_ROLE_DESCRIPTION_LOCALIZATION[normalizedDescription] ?? normalizedDescription;
}

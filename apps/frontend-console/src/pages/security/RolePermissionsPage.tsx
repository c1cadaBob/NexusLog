/**
 * 角色权限页面
 * @requirements 9.4
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const RolePermissionsPage: React.FC = () => (
  <PageSkeleton
    title="角色权限"
    description="管理角色和权限配置"
    module="安全审计"
  />
);

export default RolePermissionsPage;

/**
 * 用户管理页面
 * @requirements 9.4
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const UserManagementPage: React.FC = () => (
  <PageSkeleton
    title="用户管理"
    description="管理系统用户账号"
    module="安全审计"
  />
);

export default UserManagementPage;

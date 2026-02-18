/**
 * 登录策略页面
 * @requirements 9.4
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const LoginPolicyPage: React.FC = () => (
  <PageSkeleton
    title="登录策略"
    description="配置登录安全策略"
    module="安全审计"
  />
);

export default LoginPolicyPage;

/**
 * 生命周期策略页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const LifecyclePolicyPage: React.FC = () => (
  <PageSkeleton
    title="生命周期策略"
    description="配置索引生命周期管理策略"
    module="索引存储"
  />
);

export default LifecyclePolicyPage;

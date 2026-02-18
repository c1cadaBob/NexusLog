/**
 * 灾备管理页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const DisasterRecoveryPage: React.FC = () => (
  <PageSkeleton
    title="灾备管理"
    description="管理灾难恢复配置"
    module="性能高可用"
  />
);

export default DisasterRecoveryPage;

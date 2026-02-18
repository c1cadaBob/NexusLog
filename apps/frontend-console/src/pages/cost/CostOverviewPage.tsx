/**
 * 成本概览页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const CostOverviewPage: React.FC = () => (
  <PageSkeleton
    title="成本概览"
    description="查看资源使用成本"
    module="成本管理"
  />
);

export default CostOverviewPage;

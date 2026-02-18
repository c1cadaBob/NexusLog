/**
 * 预算告警页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const BudgetAlertsPage: React.FC = () => (
  <PageSkeleton
    title="预算告警"
    description="配置成本预算告警"
    module="成本管理"
  />
);

export default BudgetAlertsPage;

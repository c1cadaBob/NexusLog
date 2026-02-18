/**
 * 告警规则页面
 * @requirements 9.3
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const AlertRulesPage: React.FC = () => (
  <PageSkeleton
    title="告警规则"
    description="配置和管理告警规则"
    module="告警中心"
  />
);

export default AlertRulesPage;

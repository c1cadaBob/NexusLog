/**
 * 静默策略页面
 * @requirements 9.3
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const SilencePolicyPage: React.FC = () => (
  <PageSkeleton
    title="静默策略"
    description="配置告警静默规则"
    module="告警中心"
  />
);

export default SilencePolicyPage;

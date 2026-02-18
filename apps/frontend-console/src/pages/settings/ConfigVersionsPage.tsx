/**
 * 配置版本页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const ConfigVersionsPage: React.FC = () => (
  <PageSkeleton
    title="配置版本"
    description="查看配置变更历史"
    module="系统设置"
  />
);

export default ConfigVersionsPage;

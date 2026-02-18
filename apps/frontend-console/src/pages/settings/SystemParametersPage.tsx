/**
 * 系统参数页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const SystemParametersPage: React.FC = () => (
  <PageSkeleton
    title="系统参数"
    description="配置系统运行参数"
    module="系统设置"
  />
);

export default SystemParametersPage;

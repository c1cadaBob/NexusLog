/**
 * 全局配置页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const GlobalConfigPage: React.FC = () => (
  <PageSkeleton
    title="全局配置"
    description="管理全局配置项"
    module="系统设置"
  />
);

export default GlobalConfigPage;

/**
 * 数据源管理页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const SourceManagementPage: React.FC = () => (
  <PageSkeleton
    title="数据源管理"
    description="管理日志数据源配置"
    module="采集接入"
  />
);

export default SourceManagementPage;

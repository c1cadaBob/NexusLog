/**
 * 数据源状态页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const SourceStatusPage: React.FC = () => (
  <PageSkeleton
    title="数据源状态"
    description="监控数据源运行状态"
    module="采集接入"
  />
);

export default SourceStatusPage;

/**
 * 容量监控页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const CapacityMonitoringPage: React.FC = () => (
  <PageSkeleton
    title="容量监控"
    description="监控存储容量使用情况"
    module="索引存储"
  />
);

export default CapacityMonitoringPage;

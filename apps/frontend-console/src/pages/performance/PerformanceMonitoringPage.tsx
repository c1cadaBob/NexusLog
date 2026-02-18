/**
 * 性能监控页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const PerformanceMonitoringPage: React.FC = () => (
  <PageSkeleton
    title="性能监控"
    description="监控系统性能指标"
    module="性能高可用"
  />
);

export default PerformanceMonitoringPage;

/**
 * 健康检查页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const HealthCheckPage: React.FC = () => (
  <PageSkeleton
    title="健康检查"
    description="系统健康状态检查"
    module="性能高可用"
  />
);

export default HealthCheckPage;

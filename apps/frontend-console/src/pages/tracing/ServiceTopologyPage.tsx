/**
 * 服务拓扑页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const ServiceTopologyPage: React.FC = () => (
  <PageSkeleton
    title="服务拓扑"
    description="查看服务依赖拓扑图"
    module="分布式追踪"
  />
);

export default ServiceTopologyPage;

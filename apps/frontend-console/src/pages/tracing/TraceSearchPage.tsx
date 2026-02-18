/**
 * 链路搜索页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const TraceSearchPage: React.FC = () => (
  <PageSkeleton
    title="链路搜索"
    description="搜索分布式追踪链路"
    module="分布式追踪"
  />
);

export default TraceSearchPage;

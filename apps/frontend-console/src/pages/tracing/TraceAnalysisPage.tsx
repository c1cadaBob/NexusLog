/**
 * 链路分析页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const TraceAnalysisPage: React.FC = () => (
  <PageSkeleton
    title="链路分析"
    description="分析追踪链路性能"
    module="分布式追踪"
  />
);

export default TraceAnalysisPage;

/**
 * 聚合分析页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const AggregateAnalysisPage: React.FC = () => (
  <PageSkeleton
    title="聚合分析"
    description="日志数据聚合统计分析"
    module="日志分析"
  />
);

export default AggregateAnalysisPage;

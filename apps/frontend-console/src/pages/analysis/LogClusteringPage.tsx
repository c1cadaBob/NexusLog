/**
 * 日志聚类页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const LogClusteringPage: React.FC = () => (
  <PageSkeleton
    title="日志聚类"
    description="自动日志模式聚类分析"
    module="日志分析"
  />
);

export default LogClusteringPage;

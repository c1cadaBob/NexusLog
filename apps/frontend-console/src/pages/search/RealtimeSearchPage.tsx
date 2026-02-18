/**
 * 实时搜索页面
 * @requirements 9.2
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const RealtimeSearchPage: React.FC = () => (
  <PageSkeleton
    title="实时搜索"
    description="实时日志检索和查询"
    module="日志检索"
  />
);

export default RealtimeSearchPage;

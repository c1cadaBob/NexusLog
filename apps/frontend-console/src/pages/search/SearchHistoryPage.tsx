/**
 * 搜索历史页面
 * @requirements 9.2
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const SearchHistoryPage: React.FC = () => (
  <PageSkeleton
    title="搜索历史"
    description="查看和管理历史搜索记录"
    module="日志检索"
  />
);

export default SearchHistoryPage;

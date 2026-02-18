/**
 * 保存的查询页面
 * @requirements 9.2
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const SavedQueriesPage: React.FC = () => (
  <PageSkeleton
    title="保存的查询"
    description="管理已保存的查询语句"
    module="日志检索"
  />
);

export default SavedQueriesPage;

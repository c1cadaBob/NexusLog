/**
 * 索引管理页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const IndexManagementPage: React.FC = () => (
  <PageSkeleton
    title="索引管理"
    description="管理 Elasticsearch 索引"
    module="索引存储"
  />
);

export default IndexManagementPage;

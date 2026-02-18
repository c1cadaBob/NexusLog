/**
 * API 文档页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const ApiDocsPage: React.FC = () => (
  <PageSkeleton
    title="API 文档"
    description="查看 API 接口文档"
    module="集成平台"
  />
);

export default ApiDocsPage;

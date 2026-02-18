/**
 * 查询语法页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const QuerySyntaxPage: React.FC = () => (
  <PageSkeleton
    title="查询语法"
    description="日志查询语法参考"
    module="帮助中心"
  />
);

export default QuerySyntaxPage;

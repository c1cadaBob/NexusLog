/**
 * 优化建议页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const OptimizationSuggestionsPage: React.FC = () => (
  <PageSkeleton
    title="优化建议"
    description="查看成本优化建议"
    module="成本管理"
  />
);

export default OptimizationSuggestionsPage;

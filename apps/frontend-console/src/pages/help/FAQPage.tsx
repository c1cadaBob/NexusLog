/**
 * 常见问题页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const FAQPage: React.FC = () => (
  <PageSkeleton
    title="常见问题"
    description="常见问题解答"
    module="帮助中心"
  />
);

export default FAQPage;

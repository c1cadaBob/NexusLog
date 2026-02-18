/**
 * 自动扩缩容页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const AutoScalingPage: React.FC = () => (
  <PageSkeleton
    title="自动扩缩容"
    description="配置自动扩缩容策略"
    module="性能高可用"
  />
);

export default AutoScalingPage;

/**
 * 异常检测页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const AnomalyDetectionPage: React.FC = () => (
  <PageSkeleton
    title="异常检测"
    description="AI 驱动的日志异常检测"
    module="日志分析"
  />
);

export default AnomalyDetectionPage;

/**
 * 告警列表页面
 * @requirements 9.3
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const AlertListPage: React.FC = () => (
  <PageSkeleton
    title="告警列表"
    description="查看和管理所有告警"
    module="告警中心"
  />
);

export default AlertListPage;

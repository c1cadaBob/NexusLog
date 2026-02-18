/**
 * 定时任务页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const ScheduledTasksPage: React.FC = () => (
  <PageSkeleton
    title="定时任务"
    description="管理报表定时生成任务"
    module="报表中心"
  />
);

export default ScheduledTasksPage;

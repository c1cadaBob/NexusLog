/**
 * 下载记录页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const DownloadRecordsPage: React.FC = () => (
  <PageSkeleton
    title="下载记录"
    description="查看报表下载历史"
    module="报表中心"
  />
);

export default DownloadRecordsPage;

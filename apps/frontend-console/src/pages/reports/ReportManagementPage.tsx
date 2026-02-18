/**
 * 报表管理页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const ReportManagementPage: React.FC = () => (
  <PageSkeleton
    title="报表管理"
    description="管理和生成报表"
    module="报表中心"
  />
);

export default ReportManagementPage;

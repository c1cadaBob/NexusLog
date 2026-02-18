/**
 * 审计日志页面
 * @requirements 9.4
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const AuditLogsPage: React.FC = () => (
  <PageSkeleton
    title="审计日志"
    description="查看系统操作审计日志"
    module="安全审计"
  />
);

export default AuditLogsPage;

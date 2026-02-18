/**
 * 备份恢复页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const BackupRecoveryPage: React.FC = () => (
  <PageSkeleton
    title="备份恢复"
    description="管理数据备份和恢复"
    module="索引存储"
  />
);

export default BackupRecoveryPage;

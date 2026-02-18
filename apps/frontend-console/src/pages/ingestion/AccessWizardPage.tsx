/**
 * 接入向导页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const AccessWizardPage: React.FC = () => (
  <PageSkeleton
    title="接入向导"
    description="快速接入新数据源"
    module="采集接入"
  />
);

export default AccessWizardPage;

/**
 * Agent 管理页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const AgentManagementPage: React.FC = () => (
  <PageSkeleton
    title="Agent 管理"
    description="管理日志采集 Agent"
    module="采集接入"
  />
);

export default AgentManagementPage;

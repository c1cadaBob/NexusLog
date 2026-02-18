/**
 * Webhook 管理页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const WebhookManagementPage: React.FC = () => (
  <PageSkeleton
    title="Webhook 管理"
    description="管理 Webhook 配置"
    module="集成平台"
  />
);

export default WebhookManagementPage;

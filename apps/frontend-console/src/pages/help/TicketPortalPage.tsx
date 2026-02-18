/**
 * 工单入口页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const TicketPortalPage: React.FC = () => (
  <PageSkeleton
    title="工单入口"
    description="提交技术支持工单"
    module="帮助中心"
  />
);

export default TicketPortalPage;

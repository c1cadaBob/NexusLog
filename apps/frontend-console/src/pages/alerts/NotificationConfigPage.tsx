/**
 * 通知配置页面
 * @requirements 9.3
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const NotificationConfigPage: React.FC = () => (
  <PageSkeleton
    title="通知配置"
    description="配置告警通知渠道和规则"
    module="告警中心"
  />
);

export default NotificationConfigPage;

/**
 * 插件市场页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const PluginMarketPage: React.FC = () => (
  <PageSkeleton
    title="插件市场"
    description="浏览和安装插件"
    module="集成平台"
  />
);

export default PluginMarketPage;

/**
 * SDK 下载页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const SdkDownloadPage: React.FC = () => (
  <PageSkeleton
    title="SDK 下载"
    description="下载各语言 SDK"
    module="集成平台"
  />
);

export default SdkDownloadPage;

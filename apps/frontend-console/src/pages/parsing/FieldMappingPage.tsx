/**
 * 字段映射页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const FieldMappingPage: React.FC = () => (
  <PageSkeleton
    title="字段映射"
    description="配置日志字段映射规则"
    module="解析字段"
  />
);

export default FieldMappingPage;

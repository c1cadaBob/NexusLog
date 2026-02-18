/**
 * 脱敏规则页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const MaskingRulesPage: React.FC = () => (
  <PageSkeleton
    title="脱敏规则"
    description="配置敏感数据脱敏规则"
    module="解析字段"
  />
);

export default MaskingRulesPage;

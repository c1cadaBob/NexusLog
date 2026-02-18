/**
 * 解析规则页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const ParsingRulesPage: React.FC = () => (
  <PageSkeleton
    title="解析规则"
    description="配置日志解析规则"
    module="解析字段"
  />
);

export default ParsingRulesPage;

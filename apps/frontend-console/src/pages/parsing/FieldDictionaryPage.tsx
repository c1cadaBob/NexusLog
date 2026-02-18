/**
 * 字段字典页面
 * @requirements 9.5
 */
import React from 'react';
import { PageSkeleton } from '@/pages/_shared';

export const FieldDictionaryPage: React.FC = () => (
  <PageSkeleton
    title="字段字典"
    description="管理字段定义和元数据"
    module="解析字段"
  />
);

export default FieldDictionaryPage;

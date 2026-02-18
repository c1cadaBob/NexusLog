/**
 * 页面骨架组件
 * 
 * 用于快速创建模块页面的基础骨架
 */

import React from 'react';
import { Card, Typography, Space, Tag } from 'antd';
import { ToolOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

export interface PageSkeletonProps {
  /** 页面标题 */
  title: string;
  /** 页面描述 */
  description?: string;
  /** 所属模块 */
  module: string;
  /** 子组件 */
  children?: React.ReactNode;
}

/**
 * 页面骨架组件
 * 
 * 提供统一的页面布局结构，包含标题和基本布局
 */
export const PageSkeleton: React.FC<PageSkeletonProps> = ({
  title,
  description,
  module,
  children,
}) => {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Space align="center" style={{ marginBottom: 8 }}>
          <Title level={4} style={{ margin: 0 }}>{title}</Title>
          <Tag color="blue">{module}</Tag>
        </Space>
        {description && (
          <Paragraph type="secondary" style={{ margin: 0 }}>
            {description}
          </Paragraph>
        )}
      </div>
      
      {children || (
        <Card>
          <div style={{ 
            minHeight: 400, 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center',
            gap: 16,
          }}>
            <ToolOutlined style={{ fontSize: 48, opacity: 0.3 }} />
            <Text type="secondary">页面开发中...</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              此页面将在后续任务中实现完整功能
            </Text>
          </div>
        </Card>
      )}
    </div>
  );
};

export default PageSkeleton;

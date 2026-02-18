/**
 * Dashboard 首页
 * 
 * 包含 KPI 卡片、日志趋势图表和基础设施监控面板
 * 
 * @requirements 9.1
 */

import React from 'react';
import { Row, Col, Card, Typography } from 'antd';
import { 
  FileTextOutlined, 
  AlertOutlined, 
  CloudServerOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { StatCard } from '@/components/common';

const { Title } = Typography;

/**
 * Dashboard 首页组件
 */
export const DashboardPage: React.FC = () => {
  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>仪表盘</Title>
      
      {/* KPI 卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="今日日志量"
            value={1234567}
            prefix={<FileTextOutlined />}
            trend={{ value: '+12.5%', type: 'up', label: '较昨日' }}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="活跃告警"
            value={23}
            prefix={<AlertOutlined />}
            trend={{ value: '-5', type: 'down', label: '较昨日' }}
            color="warning"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="数据源"
            value={156}
            prefix={<CloudServerOutlined />}
            suffix="个"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="查询延迟"
            value={45}
            prefix={<ThunderboltOutlined />}
            suffix="ms"
            color="success"
          />
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card title="日志趋势" style={{ height: 400 }}>
            <div style={{ 
              height: 320, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#999',
            }}>
              日志趋势图表（待任务 15 实现）
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="日志级别分布" style={{ height: 400 }}>
            <div style={{ 
              height: 320, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#999',
            }}>
              饼图（待任务 15 实现）
            </div>
          </Card>
        </Col>
      </Row>

      {/* 基础设施监控 */}
      <Card title="基础设施监控">
        <div style={{ 
          height: 200, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#999',
        }}>
          基础设施监控面板（待任务 15 实现）
        </div>
      </Card>
    </div>
  );
};

export default DashboardPage;

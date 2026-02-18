/**
 * ForgotPasswordPage 忘记密码页面
 * 
 * 基于 Ant Design 的忘记密码页面
 * 
 * @requirements 3.5, 9.4
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Typography } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { useThemeStore } from '@/stores/useThemeStore';
import { ForgotPasswordForm } from '@/components/auth';

const { Title, Text } = Typography;

/**
 * 忘记密码页面组件
 */
export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useThemeStore();

  const handleBack = () => {
    navigate('/login');
  };

  const cardStyle: React.CSSProperties = {
    maxWidth: 420,
    width: '100%',
    borderRadius: 12,
  };

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: isDark 
      ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
      : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
  };

  return (
    <div style={containerStyle}>
      <Card style={cardStyle} bordered={false}>
        {/* 品牌标识 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: 'rgba(19, 91, 236, 0.1)',
            marginBottom: 12,
          }}>
            <BarChartOutlined style={{ fontSize: 24, color: '#135bec' }} />
          </div>
          <Title level={4} style={{ margin: 0 }}>NexusLog</Title>
          <Text type="secondary">重置您的密码</Text>
        </div>

        {/* 忘记密码表单 */}
        <ForgotPasswordForm onBack={handleBack} />
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;

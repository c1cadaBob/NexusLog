/**
 * RegisterPage 注册页面
 * 
 * 基于 Ant Design 的用户注册页面
 * 
 * @requirements 3.5, 9.4
 */

import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, Typography } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { useThemeStore } from '@/stores/useThemeStore';
import { RegisterForm } from '@/components/auth';

const { Title, Text } = Typography;

/**
 * 注册页面组件
 */
export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useThemeStore();

  const handleSuccess = () => {
    // 注册成功后跳转到登录页
    navigate('/login', { replace: true });
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
          <Title level={4} style={{ margin: 0 }}>创建 NexusLog 账号</Title>
          <Text type="secondary">注册以开始使用日志管理平台</Text>
        </div>

        {/* 注册表单 */}
        <RegisterForm onSuccess={handleSuccess} />

        {/* 登录链接 */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary">
            已有账号？
            <Link to="/login" style={{ marginLeft: 4 }}>立即登录</Link>
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default RegisterPage;

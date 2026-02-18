/**
 * LoginPage 登录页面
 * 
 * 基于 Ant Design 的登录页面，支持多种登录方式
 * 
 * @requirements 3.5, 9.4
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Card, Typography, Space, Row, Col, Statistic, Divider } from 'antd';
import { 
  ThunderboltOutlined, 
  SafetyOutlined, 
  AlertOutlined, 
  ApiOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/useAuthStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { LoginForm, ForgotPasswordForm, SSOLoginForm, SocialLoginButtons } from '@/components/auth';
import type { SocialProvider } from '@/components/auth/SocialLoginButtons';

const { Title, Text, Paragraph } = Typography;

type ViewType = 'login' | 'forgot-password' | 'sso';

// 产品特性数据
const features = [
  {
    icon: <ThunderboltOutlined style={{ fontSize: 24 }} />,
    title: '实时日志分析',
    description: '毫秒级日志检索，支持 PB 级数据实时查询',
  },
  {
    icon: <SafetyOutlined style={{ fontSize: 24 }} />,
    title: '企业级安全',
    description: '端到端加密，符合 SOC2、GDPR 等合规要求',
  },
  {
    icon: <AlertOutlined style={{ fontSize: 24 }} />,
    title: '智能告警',
    description: 'AI 驱动的异常检测，提前发现潜在问题',
  },
  {
    icon: <ApiOutlined style={{ fontSize: 24 }} />,
    title: '无缝集成',
    description: '支持 200+ 数据源，一键接入主流云平台',
  },
];

// 统计数据
const stats = [
  { value: '99.99%', label: '服务可用性' },
  { value: '10PB+', label: '日处理数据' },
  { value: '500+', label: '企业客户' },
  { value: '<100ms', label: '平均响应' },
];

/**
 * 登录页面组件
 */
export const LoginPage: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewType>('login');
  const { isAuthenticated, isLoading } = useAuthStore();
  const { isDark } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();

  // 获取重定向路径
  const searchParams = new URLSearchParams(location.search);
  const redirectPath = searchParams.get('redirect') || '/';

  // 已认证用户重定向
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, redirectPath]);

  // 处理第三方登录
  const handleSocialLogin = (provider: SocialProvider) => {
    const oauthUrls: Record<SocialProvider, string> = {
      github: '/api/auth/github',
      google: '/api/auth/google',
      microsoft: '/api/auth/microsoft',
    };
    window.location.href = oauthUrls[provider];
  };

  // 渲染当前视图
  const renderView = () => {
    switch (activeView) {
      case 'forgot-password':
        return <ForgotPasswordForm onBack={() => setActiveView('login')} />;
      case 'sso':
        return <SSOLoginForm onBack={() => setActiveView('login')} />;
      default:
        return (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {/* 登录表单 */}
            <LoginForm
              onForgotPassword={() => setActiveView('forgot-password')}
              onSSOLogin={() => setActiveView('sso')}
            />

            {/* 分隔线 */}
            <Divider plain>或使用以下方式登录</Divider>

            {/* 第三方登录按钮 */}
            <SocialLoginButtons onLogin={handleSocialLogin} />
          </Space>
        );
    }
  };

  const cardStyle: React.CSSProperties = {
    maxWidth: 420,
    width: '100%',
    borderRadius: 12,
  };

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    background: isDark 
      ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
      : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
  };

  return (
    <div style={containerStyle}>
      {/* 左侧产品介绍区域 - 仅在大屏幕显示 */}
      <div 
        style={{ 
          flex: 1, 
          display: 'none',
          padding: '48px',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
        className="login-left-panel"
      >
        <div style={{ maxWidth: 560 }}>
          {/* 品牌标识 */}
          <Space align="center" size="middle" style={{ marginBottom: 32 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: 'rgba(19, 91, 236, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <BarChartOutlined style={{ fontSize: 24, color: '#135bec' }} />
            </div>
            <Title level={3} style={{ margin: 0 }}>NexusLog</Title>
          </Space>

          {/* 主标题 */}
          <Title level={1} style={{ marginBottom: 16 }}>
            企业级日志管理
            <br />
            <Text type="secondary" style={{ fontSize: '0.7em' }}>智能分析平台</Text>
          </Title>

          <Paragraph type="secondary" style={{ fontSize: 16, marginBottom: 32 }}>
            实时收集、存储、分析海量日志数据，助力企业快速定位问题、
            优化性能、保障业务稳定运行。
          </Paragraph>

          {/* 产品特性 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
            {features.map((feature, index) => (
              <Col span={12} key={index}>
                <Card size="small" bordered={false} style={{ height: '100%' }}>
                  <Space direction="vertical" size="small">
                    <div style={{ color: '#135bec' }}>{feature.icon}</div>
                    <Text strong>{feature.title}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{feature.description}</Text>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>

          {/* 统计数据 */}
          <Row gutter={32}>
            {stats.map((stat, index) => (
              <Col key={index}>
                <Statistic 
                  title={stat.label} 
                  value={stat.value}
                  valueStyle={{ fontSize: 20 }}
                />
              </Col>
            ))}
          </Row>
        </div>
      </div>

      {/* 右侧登录区域 */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: 24,
      }}>
        <Card style={cardStyle} bordered={false}>
          {/* 品牌标识 - 小屏幕显示 */}
          {activeView === 'login' && (
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
              <Text type="secondary">登录以访问您的日志管理控制台</Text>
            </div>
          )}

          {/* 动态视图 */}
          {renderView()}

          {/* 注册链接 */}
          {activeView === 'login' && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Text type="secondary">
                还没有账号？
                <Link to="/register" style={{ marginLeft: 4 }}>立即注册</Link>
              </Text>
            </div>
          )}
        </Card>
      </div>

      {/* CSS for responsive layout */}
      <style>{`
        @media (min-width: 992px) {
          .login-left-panel {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
};

export default LoginPage;

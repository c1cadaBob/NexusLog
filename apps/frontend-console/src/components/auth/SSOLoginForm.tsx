/**
 * SSOLoginForm 组件
 * 
 * 基于 Ant Design Form 的企业 SSO 单点登录表单
 * 
 * @requirements 3.5, 9.4
 */

import React, { useState, useRef, useEffect } from 'react';
import { Form, Input, Button, Alert, Typography, Space } from 'antd';
import { GlobalOutlined, ArrowLeftOutlined, LoginOutlined, LoadingOutlined } from '@ant-design/icons';
import type { InputRef } from 'antd';

const { Title, Text } = Typography;

/**
 * SSOLoginForm 组件属性
 */
export interface SSOLoginFormProps {
  /** 返回普通登录回调 */
  onBack: () => void;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 企业 SSO 登录表单组件
 * 
 * 允许用户输入企业域名进行单点登录
 */
export const SSOLoginForm: React.FC<SSOLoginFormProps> = ({ onBack, disabled }) => {
  const [domain, setDomain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const domainRef = useRef<InputRef>(null);

  useEffect(() => {
    domainRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    const trimmedDomain = domain.trim();
    if (!trimmedDomain) {
      setError('请输入企业域名');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 模拟 SSO 重定向逻辑
      const ssoUrl = `/api/auth/sso?domain=${encodeURIComponent(trimmedDomain)}`;
      window.location.href = ssoUrl;
    } catch {
      setError('SSO 认证失败，请检查域名是否正确');
      setIsSubmitting(false);
    }
  };

  const isDisabled = disabled || isSubmitting;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* 标题 */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          width: 48,
          height: 48,
          borderRadius: 8,
          backgroundColor: 'rgba(19, 91, 236, 0.1)',
          marginBottom: 12,
        }}>
          <GlobalOutlined style={{ fontSize: 24, color: '#135bec' }} />
        </div>
        <Title level={4} style={{ margin: 0 }}>企业 SSO 登录</Title>
        <Text type="secondary">输入您的企业域名以使用单点登录</Text>
      </div>

      <Form layout="vertical" onFinish={handleSubmit}>
        {/* 错误提示 */}
        {error && (
          <Form.Item>
            <Alert
              message={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
            />
          </Form.Item>
        )}

        {/* 企业域名输入 */}
        <Form.Item label="企业域名">
          <Input
            ref={domainRef}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="例如：company.com"
            prefix={<GlobalOutlined />}
            disabled={isDisabled}
            size="large"
          />
        </Form.Item>

        {/* 支持的协议提示 */}
        <Text type="secondary" style={{ fontSize: 12 }}>
          支持 SAML 2.0 和 OAuth 2.0/OIDC 协议
        </Text>

        {/* 提交按钮 */}
        <Form.Item style={{ marginTop: 16 }}>
          <Button
            type="primary"
            htmlType="submit"
            disabled={isDisabled}
            loading={isSubmitting}
            icon={isSubmitting ? <LoadingOutlined /> : <LoginOutlined />}
            block
            size="large"
          >
            {isSubmitting ? '正在跳转...' : '继续'}
          </Button>
        </Form.Item>

        {/* 返回按钮 */}
        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="default"
            onClick={onBack}
            disabled={isDisabled}
            icon={<ArrowLeftOutlined />}
            block
          >
            返回普通登录
          </Button>
        </Form.Item>
      </Form>
    </Space>
  );
};

export default SSOLoginForm;

/**
 * ForgotPasswordForm 组件
 * 
 * 基于 Ant Design Form 的忘记密码表单
 * 
 * @requirements 3.5, 9.4
 */

import React, { useState, useRef, useEffect } from 'react';
import { Form, Input, Button, Alert, Typography, Space, Result } from 'antd';
import { MailOutlined, ArrowLeftOutlined, SendOutlined, LoadingOutlined } from '@ant-design/icons';
import type { InputRef } from 'antd';

const { Title, Text } = Typography;

/**
 * ForgotPasswordForm 组件属性
 */
export interface ForgotPasswordFormProps {
  /** 返回登录回调 */
  onBack: () => void;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 忘记密码表单组件
 * 
 * 允许用户输入邮箱地址请求密码重置链接
 */
export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onBack, disabled }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emailRef = useRef<InputRef>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('请输入邮箱地址');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError('请输入有效的邮箱地址');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 模拟密码重置请求
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSuccess(true);
    } catch {
      setError('发送重置邮件失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDisabled = disabled || isSubmitting;

  // 成功状态显示
  if (success) {
    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Result
          status="success"
          title="邮件已发送"
          subTitle={
            <>
              重置链接已发送到 <Text strong>{email}</Text>
              <br />
              请检查您的收件箱并按照邮件中的说明重置密码
            </>
          }
          extra={
            <Button
              type="default"
              onClick={onBack}
              icon={<ArrowLeftOutlined />}
            >
              返回登录
            </Button>
          }
        />
      </Space>
    );
  }

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
          <MailOutlined style={{ fontSize: 24, color: '#135bec' }} />
        </div>
        <Title level={4} style={{ margin: 0 }}>忘记密码</Title>
        <Text type="secondary">输入您的注册邮箱，我们将发送重置链接</Text>
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

        {/* 邮箱输入 */}
        <Form.Item label="邮箱地址">
          <Input
            ref={emailRef}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="请输入注册邮箱"
            prefix={<MailOutlined />}
            disabled={isDisabled}
            size="large"
          />
        </Form.Item>

        {/* 安全提示 */}
        <Text type="secondary" style={{ fontSize: 12 }}>
          重置链接将发送到您的注册邮箱
        </Text>

        {/* 提交按钮 */}
        <Form.Item style={{ marginTop: 16 }}>
          <Button
            type="primary"
            htmlType="submit"
            disabled={isDisabled}
            loading={isSubmitting}
            icon={isSubmitting ? <LoadingOutlined /> : <SendOutlined />}
            block
            size="large"
          >
            {isSubmitting ? '发送中...' : '发送重置链接'}
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
            返回登录
          </Button>
        </Form.Item>
      </Form>
    </Space>
  );
};

export default ForgotPasswordForm;

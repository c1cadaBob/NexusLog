/**
 * RegisterForm 组件
 * 
 * 基于 Ant Design Form 的用户注册表单
 * 
 * @requirements 3.5, 9.4
 */

import React, { useState } from 'react';
import { Form, Input, Button, Alert, Checkbox, Typography } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined, UserAddOutlined, LoadingOutlined } from '@ant-design/icons';

const { Link } = Typography;

/**
 * RegisterForm 组件属性
 */
export interface RegisterFormProps {
  /** 注册成功回调 */
  onSuccess?: () => void;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 表单字段接口
 */
interface RegisterFormValues {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeTerms: boolean;
}

/**
 * 用户注册表单组件
 * 
 * 提供完整的用户注册功能，包括表单验证和错误提示
 */
export const RegisterForm: React.FC<RegisterFormProps> = ({ 
  onSuccess,
  disabled: externalDisabled = false,
}) => {
  const [form] = Form.useForm<RegisterFormValues>();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const isDisabled = isLoading || externalDisabled;

  const handleSubmit = async (_values: RegisterFormValues) => {
    setIsLoading(true);
    setServerError(null);

    try {
      // 模拟注册请求
      await new Promise(resolve => setTimeout(resolve, 1500));
      onSuccess?.();
    } catch {
      setServerError('注册失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      disabled={isDisabled}
      autoComplete="off"
    >
      {/* 错误提示 */}
      {serverError && (
        <Form.Item>
          <Alert
            message={serverError}
            type="error"
            showIcon
            closable
            onClose={() => setServerError(null)}
          />
        </Form.Item>
      )}

      {/* 用户名 */}
      <Form.Item
        name="username"
        label="用户名"
        rules={[
          { required: true, message: '请输入用户名' },
          { min: 3, message: '用户名至少需要 3 个字符' },
        ]}
      >
        <Input
          prefix={<UserOutlined />}
          placeholder="请输入用户名"
          size="large"
          autoComplete="username"
          autoFocus
        />
      </Form.Item>

      {/* 邮箱 */}
      <Form.Item
        name="email"
        label="邮箱"
        rules={[
          { required: true, message: '请输入邮箱地址' },
          { type: 'email', message: '请输入有效的邮箱地址' },
        ]}
      >
        <Input
          prefix={<MailOutlined />}
          placeholder="请输入邮箱地址"
          size="large"
          autoComplete="email"
        />
      </Form.Item>

      {/* 密码 */}
      <Form.Item
        name="password"
        label="密码"
        rules={[
          { required: true, message: '请输入密码' },
          { min: 8, message: '密码至少需要 8 个字符' },
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="请输入密码（至少 8 位）"
          size="large"
          autoComplete="new-password"
        />
      </Form.Item>

      {/* 确认密码 */}
      <Form.Item
        name="confirmPassword"
        label="确认密码"
        dependencies={['password']}
        rules={[
          { required: true, message: '请确认密码' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error('两次输入的密码不一致'));
            },
          }),
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="请再次输入密码"
          size="large"
          autoComplete="new-password"
        />
      </Form.Item>

      {/* 服务条款 */}
      <Form.Item
        name="agreeTerms"
        valuePropName="checked"
        rules={[
          {
            validator: (_, value) =>
              value ? Promise.resolve() : Promise.reject(new Error('请阅读并同意服务条款')),
          },
        ]}
      >
        <Checkbox>
          我已阅读并同意
          <Link href="/terms" target="_blank"> 服务条款 </Link>
          和
          <Link href="/privacy" target="_blank"> 隐私政策</Link>
        </Checkbox>
      </Form.Item>

      {/* 注册按钮 */}
      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={isLoading}
          icon={isLoading ? <LoadingOutlined /> : <UserAddOutlined />}
          block
          size="large"
        >
          {isLoading ? '注册中...' : '创建账号'}
        </Button>
      </Form.Item>
    </Form>
  );
};

export default RegisterForm;

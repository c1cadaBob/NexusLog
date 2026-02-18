/**
 * LoginForm 组件
 * 
 * 基于 Ant Design Form 的登录表单
 * 从 useAuthStore 获取认证状态和操作
 * 
 * @requirements 3.5, 9.4
 */

import React, { useEffect } from 'react';
import { Form, Input, Button, Alert, Divider } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined, LoadingOutlined, SafetyOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/useAuthStore';
import { RememberMeCheckbox } from './RememberMeCheckbox';

/**
 * LoginForm 组件属性
 */
export interface LoginFormProps {
  /** 忘记密码回调 */
  onForgotPassword?: () => void;
  /** SSO 登录回调 */
  onSSOLogin?: () => void;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 表单字段接口
 */
interface LoginFormValues {
  username: string;
  password: string;
  rememberMe: boolean;
}

/**
 * 登录表单组件
 * 
 * 集成 Ant Design Form，实现表单状态管理、客户端验证、认证流程
 */
export const LoginForm: React.FC<LoginFormProps> = ({ 
  onForgotPassword, 
  onSSOLogin,
  disabled: externalDisabled = false,
}) => {
  const [form] = Form.useForm<LoginFormValues>();
  
  // 从 Zustand Store 获取认证状态和操作
  const { login, isLoading, error, clearError } = useAuthStore();
  
  const isDisabled = isLoading || externalDisabled;

  // 组件卸载时清除错误
  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  // 处理表单提交
  const handleSubmit = async (values: LoginFormValues) => {
    try {
      await login({
        username: values.username.trim(),
        password: values.password.trim(),
        rememberMe: values.rememberMe,
      });
      // 登录成功后重定向由父组件处理
    } catch {
      // 认证失败，清空密码
      form.setFieldValue('password', '');
    }
  };

  // 表单值变化时清除错误
  const handleValuesChange = () => {
    if (error) {
      clearError();
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      onValuesChange={handleValuesChange}
      disabled={isDisabled}
      initialValues={{ rememberMe: false }}
      autoComplete="off"
    >
      {/* 错误提示 */}
      {error && (
        <Form.Item>
          <Alert
            message={error}
            type="error"
            showIcon
            closable
            onClose={clearError}
          />
        </Form.Item>
      )}

      {/* 用户名输入框 */}
      <Form.Item
        name="username"
        label="用户名"
        rules={[
          { required: true, message: '请输入用户名' },
          { whitespace: true, message: '用户名不能为空' },
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

      {/* 密码输入框 */}
      <Form.Item
        name="password"
        label="密码"
        rules={[
          { required: true, message: '请输入密码' },
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="请输入密码"
          size="large"
          autoComplete="current-password"
        />
      </Form.Item>

      {/* 记住我和忘记密码 */}
      <Form.Item>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Form.Item name="rememberMe" valuePropName="checked" noStyle>
            <RememberMeCheckbox
              checked={form.getFieldValue('rememberMe') || false}
              onChange={(checked) => form.setFieldValue('rememberMe', checked)}
              disabled={isDisabled}
            />
          </Form.Item>
          {onForgotPassword && (
            <Button
              type="link"
              onClick={onForgotPassword}
              disabled={isDisabled}
              style={{ padding: 0 }}
            >
              忘记密码？
            </Button>
          )}
        </div>
      </Form.Item>

      {/* 登录按钮 */}
      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={isLoading}
          icon={isLoading ? <LoadingOutlined /> : <LoginOutlined />}
          block
          size="large"
        >
          {isLoading ? '登录中...' : '登录'}
        </Button>
      </Form.Item>

      {/* SSO 登录入口 */}
      {onSSOLogin && (
        <>
          <Divider plain>或</Divider>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="default"
              onClick={onSSOLogin}
              disabled={isDisabled}
              icon={<SafetyOutlined />}
              block
            >
              企业 SSO 登录
            </Button>
          </Form.Item>
        </>
      )}
    </Form>
  );
};

export default LoginForm;

/**
 * 用于属性测试的辅助函数
 * 模拟认证失败后的状态
 */
export interface AuthFailureState {
  username: string;
  password: string;
}

/**
 * 模拟认证失败后的状态变化
 * 认证失败后：用户名保持不变，密码被清空
 */
export function simulateAuthFailure(
  initialUsername: string,
  _initialPassword: string
): AuthFailureState {
  return {
    username: initialUsername,
    password: '',
  };
}

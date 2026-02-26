import React, { useEffect } from 'react';
import { Form, Input, Button, Checkbox } from 'antd';
import { useAuthStore } from '../../stores/authStore';

export interface LoginFormProps {
  onForgotPassword?: () => void;
  onSSOLogin?: () => void;
  disabled?: boolean;
}

const LoginForm: React.FC<LoginFormProps> = ({ onForgotPassword, onSSOLogin, disabled }) => {
  const [form] = Form.useForm();
  const { login, isLoading } = useAuthStore();
  const isDisabled = isLoading || disabled;

  useEffect(() => {
    // 自动聚焦用户名
    const timer = setTimeout(() => {
      const el = document.getElementById('login-username');
      el?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleFinish = async (values: { username: string; password: string; remember: boolean }) => {
    // 模拟登录：使用静态用户数据
    login({
      id: '1',
      username: values.username,
      email: `${values.username}@nexuslog.com`,
      role: 'admin',
    });
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      initialValues={{ remember: false }}
      disabled={isDisabled}
      requiredMark={false}
      size="large"
      className="[&_.ant-form-item]:!mb-4"
    >
      <Form.Item
        name="username"
        label="用户名"
        rules={[{ required: true, message: '请输入用户名' }]}
      >
        <Input
          id="login-username"
          prefix={<span className="material-symbols-outlined text-base opacity-50">person</span>}
          placeholder="请输入用户名"
          autoComplete="username"
        />
      </Form.Item>

      <Form.Item
        name="password"
        label="密码"
        rules={[{ required: true, message: '请输入密码' }]}
      >
        <Input.Password
          prefix={<span className="material-symbols-outlined text-base opacity-50">lock</span>}
          placeholder="请输入密码"
          autoComplete="current-password"
        />
      </Form.Item>

      <div className="flex items-center justify-between mb-3">
        <Form.Item name="remember" valuePropName="checked" noStyle>
          <Checkbox>记住我</Checkbox>
        </Form.Item>
        {onForgotPassword && (
          <Button type="link" size="small" onClick={onForgotPassword} className="!p-0">
            忘记密码？
          </Button>
        )}
      </div>

      <Form.Item className="!mb-2">
        <Button type="primary" htmlType="submit" block loading={isLoading}>
          {isLoading ? '登录中...' : '登录'}
        </Button>
      </Form.Item>

      {onSSOLogin && (
        <Button block onClick={onSSOLogin} disabled={isDisabled} className="!mb-0">
          <span className="material-symbols-outlined text-base mr-1">business</span>
          企业 SSO 登录
        </Button>
      )}
    </Form>
  );
};

export default LoginForm;

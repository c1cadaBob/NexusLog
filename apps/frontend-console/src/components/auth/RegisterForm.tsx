import React from 'react';
import { Form, Input, Button, Checkbox, App } from 'antd';

export interface RegisterFormProps {
  onSuccess?: () => void;
  disabled?: boolean;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, disabled }) => {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = React.useState(false);
  const { message } = App.useApp();

  const handleFinish = async () => {
    setIsLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      message.success('注册成功，请登录');
      onSuccess?.();
    } catch {
      message.error('注册失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      disabled={disabled || isLoading}
      requiredMark={false}
      size="large"
      className="[&_.ant-form-item]:!mb-4"
    >
      <Form.Item
        name="username"
        label="用户名"
        rules={[
          { required: true, message: '请输入用户名' },
          { min: 3, message: '用户名至少需要 3 个字符' },
        ]}
      >
        <Input
          prefix={<span className="material-symbols-outlined text-base opacity-50">person</span>}
          placeholder="请输入用户名"
          autoComplete="username"
        />
      </Form.Item>

      <Form.Item
        name="email"
        label="邮箱"
        rules={[
          { required: true, message: '请输入邮箱地址' },
          { type: 'email', message: '请输入有效的邮箱地址' },
        ]}
      >
        <Input
          prefix={<span className="material-symbols-outlined text-base opacity-50">mail</span>}
          placeholder="请输入邮箱地址"
          autoComplete="email"
        />
      </Form.Item>

      <Form.Item
        name="password"
        label="密码"
        rules={[
          { required: true, message: '请输入密码' },
          { min: 8, message: '密码至少需要 8 个字符' },
        ]}
      >
        <Input.Password
          prefix={<span className="material-symbols-outlined text-base opacity-50">lock</span>}
          placeholder="请输入密码（至少 8 位）"
          autoComplete="new-password"
        />
      </Form.Item>

      <Form.Item
        name="confirmPassword"
        label="确认密码"
        dependencies={['password']}
        rules={[
          { required: true, message: '请确认密码' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) return Promise.resolve();
              return Promise.reject(new Error('两次输入的密码不一致'));
            },
          }),
        ]}
      >
        <Input.Password
          prefix={<span className="material-symbols-outlined text-base opacity-50">lock</span>}
          placeholder="请再次输入密码"
          autoComplete="new-password"
        />
      </Form.Item>

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
          我已阅读并同意{' '}
          <a href="#/terms" className="text-blue-500">服务条款</a> 和{' '}
          <a href="#/privacy" className="text-blue-500">隐私政策</a>
        </Checkbox>
      </Form.Item>

      <Form.Item className="!mb-0">
        <Button type="primary" htmlType="submit" block loading={isLoading}>
          {isLoading ? '注册中...' : '创建账号'}
        </Button>
      </Form.Item>
    </Form>
  );
};

export default RegisterForm;

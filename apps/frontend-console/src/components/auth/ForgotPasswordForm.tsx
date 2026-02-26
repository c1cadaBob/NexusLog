import React, { useState } from 'react';
import { Form, Input, Button, Result } from 'antd';

interface ForgotPasswordFormProps {
  onBack: () => void;
  disabled?: boolean;
}

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onBack, disabled }) => {
  const [form] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const handleFinish = async (values: { email: string }) => {
    setIsSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      setSubmittedEmail(values.email);
      setSuccess(true);
    } catch {
      // 错误处理
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-4">
        <Result
          status="success"
          title="邮件已发送"
          subTitle={
            <>
              重置链接已发送到 <strong>{submittedEmail}</strong>
              <br />
              请检查您的收件箱并按照邮件中的说明重置密码
            </>
          }
          className="!p-0 !pb-4"
        />
        <Button block onClick={onBack}>
          <span className="material-symbols-outlined text-base mr-1">arrow_back</span>
          返回登录
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-500/20 mb-3">
          <span className="material-symbols-outlined text-blue-400 text-2xl">lock_reset</span>
        </div>
        <h2 className="text-lg font-semibold">忘记密码</h2>
        <p className="text-sm opacity-60 mt-1">输入您的注册邮箱，我们将发送重置链接</p>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        disabled={disabled || isSubmitting}
        requiredMark={false}
        size="large"
        className="[&_.ant-form-item]:!mb-4"
      >
        <Form.Item
          name="email"
          label="邮箱地址"
          rules={[
            { required: true, message: '请输入邮箱地址' },
            { type: 'email', message: '请输入有效的邮箱地址' },
          ]}
        >
          <Input
            prefix={<span className="material-symbols-outlined text-base opacity-50">mail</span>}
            placeholder="请输入注册邮箱"
            autoComplete="email"
          />
        </Form.Item>

        <p className="text-xs opacity-40 mb-3">重置链接将发送到您的注册邮箱</p>

        <Form.Item className="!mb-2">
          <Button type="primary" htmlType="submit" block loading={isSubmitting}>
            {isSubmitting ? '发送中...' : '发送重置链接'}
          </Button>
        </Form.Item>

        <Button block onClick={onBack} disabled={isSubmitting}>
          <span className="material-symbols-outlined text-base mr-1">arrow_back</span>
          返回登录
        </Button>
      </Form>
    </div>
  );
};

export default ForgotPasswordForm;

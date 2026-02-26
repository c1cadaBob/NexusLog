import React, { useState } from 'react';
import { Form, Input, Button } from 'antd';

interface SSOLoginFormProps {
  onBack: () => void;
  disabled?: boolean;
}

const SSOLoginForm: React.FC<SSOLoginFormProps> = ({ onBack, disabled }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form] = Form.useForm();

  const handleFinish = async (values: { domain: string }) => {
    setIsSubmitting(true);
    try {
      const ssoUrl = `/api/auth/sso?domain=${encodeURIComponent(values.domain.trim())}`;
      window.location.href = ssoUrl;
    } catch {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-500/20 mb-3">
          <span className="material-symbols-outlined text-blue-400 text-2xl">business</span>
        </div>
        <h2 className="text-lg font-semibold">企业 SSO 登录</h2>
        <p className="text-sm opacity-60 mt-1">输入您的企业域名以使用单点登录</p>
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
          name="domain"
          label="企业域名"
          rules={[{ required: true, message: '请输入企业域名' }]}
        >
          <Input
            prefix={<span className="material-symbols-outlined text-base opacity-50">domain</span>}
            placeholder="例如：company.com"
            autoComplete="organization"
          />
        </Form.Item>

        <p className="text-xs opacity-40 mb-3">支持 SAML 2.0 和 OAuth 2.0/OIDC 协议</p>

        <Form.Item className="!mb-2">
          <Button type="primary" htmlType="submit" block loading={isSubmitting}>
            {isSubmitting ? '正在跳转...' : '继续'}
          </Button>
        </Form.Item>

        <Button block onClick={onBack} disabled={isSubmitting}>
          <span className="material-symbols-outlined text-base mr-1">arrow_back</span>
          返回普通登录
        </Button>
      </Form>
    </div>
  );
};

export default SSOLoginForm;

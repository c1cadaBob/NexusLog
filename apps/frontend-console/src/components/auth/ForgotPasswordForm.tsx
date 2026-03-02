import React, { useState } from 'react';
import { Form, Input, Button, Result, App } from 'antd';
import { getRuntimeConfig } from '../../config/runtime-config';

interface ForgotPasswordFormProps {
  onBack: () => void;
  disabled?: boolean;
  initialToken?: string;
}

/** 忘记密码阶段 */
type ForgotPasswordStep = 'request' | 'request-success' | 'confirm' | 'confirm-success';

/** 发起重置表单字段 */
interface ResetRequestFormValues {
  emailOrUsername: string;
}

/** 确认重置表单字段 */
interface ResetConfirmFormValues {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

/** 运行时配置扩展：兼容未来配置中心增加租户字段 */
interface RuntimeConfigWithTenant {
  apiBaseUrl: string;
  tenantId?: string;
  tenantID?: string;
}

/** 后端统一成功响应体 */
interface ApiSuccessEnvelope<TData> {
  code: string;
  message: string;
  request_id: string;
  data: TData;
}

/** 后端统一错误响应体 */
interface ApiErrorEnvelope {
  code?: string;
  message?: string;
  request_id?: string;
  details?: Record<string, unknown>;
}

/** reset-request 成功 data */
interface ResetRequestResponseData {
  accepted: boolean;
}

/** reset-confirm 成功 data */
interface ResetConfirmResponseData {
  reset: boolean;
}

/** 本地租户键：与登录/注册流程保持一致 */
const TENANT_ID_KEY = 'nexuslog-tenant-id';

/** 规范化 reset-request URL */
function buildResetRequestUrl(apiBaseUrl: string): string {
  const normalizedBase = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
  return `${normalizedBase}/auth/password/reset-request`;
}

/** 规范化 reset-confirm URL */
function buildResetConfirmUrl(apiBaseUrl: string): string {
  const normalizedBase = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
  return `${normalizedBase}/auth/password/reset-confirm`;
}

/** 解析租户 ID：优先 localStorage，其次运行时配置扩展字段 */
function resolveTenantId(config: RuntimeConfigWithTenant): string | null {
  try {
    const localTenant = window.localStorage.getItem(TENANT_ID_KEY)?.trim();
    if (localTenant) {
      return localTenant;
    }
  } catch (error) {
    console.warn('[ForgotPasswordForm] 读取 localStorage 租户信息失败:', error);
  }

  const configTenant = (config.tenantId ?? config.tenantID ?? '').trim();
  return configTenant || null;
}

/** 构造认证请求头（含租户信息） */
function buildRequestHeaders(tenantId: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }
  return headers;
}

/** reset-request 错误码映射为中文提示 */
function extractResetRequestErrorMessage(errorBody: ApiErrorEnvelope | null, fallback: string): string {
  if (errorBody?.code === 'AUTH_RESET_REQUEST_INVALID_ARGUMENT') {
    return '发送失败：请输入有效的邮箱或用户名';
  }

  switch (errorBody?.code) {
    case 'AUTH_RESET_REQUEST_TENANT_REQUIRED':
      return '发送失败：缺少租户信息，请先配置租户 ID（localStorage 键：nexuslog-tenant-id）';
    case 'AUTH_RESET_REQUEST_TENANT_INVALID':
      return '发送失败：租户 ID 格式无效';
    case 'AUTH_RESET_REQUEST_TENANT_NOT_FOUND':
      return '发送失败：租户不存在或未激活';
    default:
      return errorBody?.message ?? fallback;
  }
}

/** reset-confirm 错误码映射为中文提示 */
function extractResetConfirmErrorMessage(errorBody: ApiErrorEnvelope | null, fallback: string): string {
  if (errorBody?.code === 'AUTH_RESET_CONFIRM_INVALID_ARGUMENT') {
    const field = typeof errorBody.details?.field === 'string' ? errorBody.details.field : '';
    if (field === 'token') {
      return '重置失败：请输入有效的重置令牌';
    }
    if (field === 'new_password') {
      return '重置失败：新密码长度需为 8-72 位';
    }
    return '重置失败：请求参数不合法';
  }

  switch (errorBody?.code) {
    case 'AUTH_RESET_CONFIRM_TENANT_REQUIRED':
      return '重置失败：缺少租户信息，请先配置租户 ID（localStorage 键：nexuslog-tenant-id）';
    case 'AUTH_RESET_CONFIRM_TENANT_INVALID':
      return '重置失败：租户 ID 格式无效';
    case 'AUTH_RESET_CONFIRM_TENANT_NOT_FOUND':
      return '重置失败：租户不存在或未激活';
    case 'AUTH_RESET_CONFIRM_INVALID_TOKEN':
      return '重置失败：重置令牌无效或已过期';
    default:
      return errorBody?.message ?? fallback;
  }
}

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onBack, disabled, initialToken }) => {
  const [requestForm] = Form.useForm<ResetRequestFormValues>();
  const [confirmForm] = Form.useForm<ResetConfirmFormValues>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<ForgotPasswordStep>(initialToken ? 'confirm' : 'request');
  const [submittedIdentifier, setSubmittedIdentifier] = useState('');
  const { message } = App.useApp();

  /** 发起重置：调用 reset-request 接口 */
  const handleRequestFinish = async (values: ResetRequestFormValues) => {
    // 读取运行时配置并解析租户信息
    const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
    const requestUrl = buildResetRequestUrl(runtimeConfig.apiBaseUrl || '/api/v1');
    const tenantId = resolveTenantId(runtimeConfig);

    // 提交前进入 loading，避免重复点击造成并发请求
    setIsSubmitting(true);
    try {
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: buildRequestHeaders(tenantId),
        body: JSON.stringify({
          email_or_username: values.emailOrUsername.trim(),
        }),
      });

      // 兼容后端异常返回非 JSON 的场景
      const responseBody = (await response.json().catch(() => null)) as
        | ApiSuccessEnvelope<ResetRequestResponseData>
        | ApiErrorEnvelope
        | null;

      // 处理后端业务错误（4xx/5xx）
      if (!response.ok) {
        const readableMessage = extractResetRequestErrorMessage(
          responseBody as ApiErrorEnvelope | null,
          '发送失败，请稍后重试',
        );
        message.error(readableMessage);
        return;
      }

      // 校验关键字段，避免后端结构异常导致前端误提示
      const successBody = responseBody as ApiSuccessEnvelope<ResetRequestResponseData> | null;
      if (!successBody?.data || successBody.data.accepted !== true) {
        message.error('发送失败：服务端返回数据不完整');
        return;
      }

      // 记录提交标识并进入成功态
      setSubmittedIdentifier(values.emailOrUsername.trim());
      setStep('request-success');
      message.success('重置链接已发送，请检查邮箱');
    } catch (error) {
      console.error('[ForgotPasswordForm] reset-request 请求异常:', error);
      message.error('发送失败：网络异常，请稍后重试');
    } finally {
      // 请求结束，统一解除 loading
      setIsSubmitting(false);
    }
  };

  /** 确认重置：调用 reset-confirm 接口 */
  const handleConfirmFinish = async (values: ResetConfirmFormValues) => {
    // 读取运行时配置并解析租户信息
    const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
    const confirmUrl = buildResetConfirmUrl(runtimeConfig.apiBaseUrl || '/api/v1');
    const tenantId = resolveTenantId(runtimeConfig);

    // 提交前进入 loading，避免重复点击造成并发请求
    setIsSubmitting(true);
    try {
      const response = await fetch(confirmUrl, {
        method: 'POST',
        headers: buildRequestHeaders(tenantId),
        body: JSON.stringify({
          token: values.token.trim(),
          new_password: values.newPassword,
        }),
      });

      // 兼容后端异常返回非 JSON 的场景
      const responseBody = (await response.json().catch(() => null)) as
        | ApiSuccessEnvelope<ResetConfirmResponseData>
        | ApiErrorEnvelope
        | null;

      // 处理后端业务错误（4xx/5xx）
      if (!response.ok) {
        const readableMessage = extractResetConfirmErrorMessage(
          responseBody as ApiErrorEnvelope | null,
          '重置失败，请稍后重试',
        );
        message.error(readableMessage);
        return;
      }

      // 校验关键字段，避免后端结构异常导致前端误提示
      const successBody = responseBody as ApiSuccessEnvelope<ResetConfirmResponseData> | null;
      if (!successBody?.data || successBody.data.reset !== true) {
        message.error('重置失败：服务端返回数据不完整');
        return;
      }

      // 重置成功后进入成功态
      setStep('confirm-success');
      message.success('密码重置成功，请重新登录');
    } catch (error) {
      console.error('[ForgotPasswordForm] reset-confirm 请求异常:', error);
      message.error('重置失败：网络异常，请稍后重试');
    } finally {
      // 请求结束，统一解除 loading
      setIsSubmitting(false);
    }
  };

  // token 链接进入时，默认切换到确认重置并预填 token
  React.useEffect(() => {
    if (!initialToken) {
      return;
    }
    setStep('confirm');
    confirmForm.setFieldsValue({
      token: initialToken,
    });
  }, [initialToken, confirmForm]);

  if (step === 'request-success') {
    return (
      <div className="space-y-4">
        <Result
          status="success"
          title="邮件已发送"
          subTitle={
            <>
              重置链接已发送到 <strong>{submittedIdentifier}</strong>
              <br />
              请检查您的收件箱并按照邮件中的说明重置密码
            </>
          }
          className="!p-0 !pb-4"
        />
        <Button
          type="primary"
          block
          onClick={() => {
            setStep('confirm');
            confirmForm.setFieldsValue({ token: '' });
          }}
        >
          <span className="material-symbols-outlined text-base mr-1">key</span>
          我有重置令牌，去重置密码
        </Button>
        <Button block onClick={onBack}>
          <span className="material-symbols-outlined text-base mr-1">arrow_back</span>
          返回登录
        </Button>
      </div>
    );
  }

  if (step === 'confirm-success') {
    return (
      <div className="space-y-4">
        <Result
          status="success"
          title="密码重置成功"
          subTitle="您可以使用新密码重新登录系统"
          className="!p-0 !pb-4"
        />
        <Button type="primary" block onClick={onBack}>
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
        <h2 className="text-lg font-semibold">{step === 'confirm' ? '重置密码' : '忘记密码'}</h2>
        <p className="text-sm opacity-60 mt-1">
          {step === 'confirm'
            ? '请输入重置令牌和新密码'
            : '输入您的注册邮箱或用户名，我们将发送重置链接'}
        </p>
      </div>

      {step === 'confirm' ? (
        <Form
          form={confirmForm}
          layout="vertical"
          onFinish={handleConfirmFinish}
          disabled={disabled || isSubmitting}
          requiredMark={false}
          size="large"
          className="[&_.ant-form-item]:!mb-4"
        >
          <Form.Item
            name="token"
            label="重置令牌"
            rules={[{ required: true, message: '请输入重置令牌' }]}
          >
            <Input
              prefix={<span className="material-symbols-outlined text-base opacity-50">key</span>}
              placeholder="请输入邮件中的重置令牌"
              autoComplete="one-time-code"
            />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '新密码至少需要 8 个字符' },
              { max: 72, message: '新密码最多 72 个字符' },
            ]}
          >
            <Input.Password
              prefix={<span className="material-symbols-outlined text-base opacity-50">lock</span>}
              placeholder="请输入新密码"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<span className="material-symbols-outlined text-base opacity-50">lock</span>}
              placeholder="请再次输入新密码"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item className="!mb-2">
            <Button type="primary" htmlType="submit" block loading={isSubmitting}>
              {isSubmitting ? '重置中...' : '确认重置密码'}
            </Button>
          </Form.Item>

          <Button
            block
            onClick={() => setStep('request')}
            disabled={disabled || isSubmitting}
            className="!mb-2"
          >
            <span className="material-symbols-outlined text-base mr-1">mail</span>
            返回发送重置链接
          </Button>

          <Button block onClick={onBack} disabled={disabled || isSubmitting}>
            <span className="material-symbols-outlined text-base mr-1">arrow_back</span>
            返回登录
          </Button>
        </Form>
      ) : (
        <Form
          form={requestForm}
          layout="vertical"
          onFinish={handleRequestFinish}
          disabled={disabled || isSubmitting}
          requiredMark={false}
          size="large"
          className="[&_.ant-form-item]:!mb-4"
        >
          <Form.Item
            name="emailOrUsername"
            label="邮箱或用户名"
            rules={[{ required: true, message: '请输入邮箱或用户名' }]}
          >
            <Input
              prefix={<span className="material-symbols-outlined text-base opacity-50">mail</span>}
              placeholder="请输入注册邮箱或用户名"
              autoComplete="username"
            />
          </Form.Item>

          <p className="text-xs opacity-40 mb-3">重置链接将发送到您绑定的邮箱</p>

          <Form.Item className="!mb-2">
            <Button type="primary" htmlType="submit" block loading={isSubmitting}>
              {isSubmitting ? '发送中...' : '发送重置链接'}
            </Button>
          </Form.Item>

          <Button
            block
            onClick={() => setStep('confirm')}
            disabled={disabled || isSubmitting}
            className="!mb-2"
          >
            <span className="material-symbols-outlined text-base mr-1">key</span>
            我已有重置令牌
          </Button>

          <Button block onClick={onBack} disabled={disabled || isSubmitting}>
            <span className="material-symbols-outlined text-base mr-1">arrow_back</span>
            返回登录
          </Button>
        </Form>
      )}

    </div>
  );
};

export default ForgotPasswordForm;

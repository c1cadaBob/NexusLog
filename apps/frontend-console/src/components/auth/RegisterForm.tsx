import React from 'react';
import { Form, Input, Button, Checkbox, App } from 'antd';
import { getRuntimeConfig } from '../../config/runtime-config';

export interface RegisterFormProps {
  onSuccess?: () => void;
  disabled?: boolean;
}

/** 注册表单字段 */
interface RegisterFormValues {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeTerms: boolean;
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

/** 注册成功 data 结构 */
interface RegisterResponseData {
  user_id: string;
  username: string;
}

/** 本地租户键：与登录流程保持一致 */
const TENANT_ID_KEY = 'nexuslog-tenant-id';

/** 规范化注册 URL，避免 baseUrl 与路径拼接出现双斜杠 */
function buildRegisterUrl(apiBaseUrl: string): string {
  const normalizedBase = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
  return `${normalizedBase}/auth/register`;
}

/** 解析租户 ID：优先 localStorage，其次运行时配置扩展字段 */
function resolveTenantId(config: RuntimeConfigWithTenant): string | null {
  try {
    const localTenant = window.localStorage.getItem(TENANT_ID_KEY)?.trim();
    if (localTenant) {
      return localTenant;
    }
  } catch (error) {
    console.warn('[RegisterForm] 读取 localStorage 租户信息失败:', error);
  }

  const configTenant = (config.tenantId ?? config.tenantID ?? '').trim();
  return configTenant || null;
}

/** 将后端注册错误转换为可读中文提示 */
function extractRegisterErrorMessage(errorBody: ApiErrorEnvelope | null, fallback: string): string {
  if (errorBody?.code === 'AUTH_REGISTER_INVALID_ARGUMENT') {
    const field = typeof errorBody.details?.field === 'string' ? errorBody.details.field : '';
    if (field === 'username') {
      return '注册失败：用户名格式不合法（3-32 位，支持字母数字与 _.-）';
    }
    if (field === 'password') {
      return '注册失败：密码长度需为 8-72 位';
    }
    if (field === 'email') {
      return '注册失败：邮箱格式不正确';
    }
    if (field === 'display_name') {
      return '注册失败：显示名称长度不能超过 255 字符';
    }
    return '注册失败：参数不合法，请检查输入后重试';
  }

  switch (errorBody?.code) {
    case 'AUTH_REGISTER_TENANT_REQUIRED':
      return '注册失败：缺少租户信息，请先配置租户 ID（localStorage 键：nexuslog-tenant-id）';
    case 'AUTH_REGISTER_TENANT_INVALID':
      return '注册失败：租户 ID 格式无效';
    case 'AUTH_REGISTER_TENANT_NOT_FOUND':
      return '注册失败：租户不存在或未激活';
    case 'AUTH_REGISTER_USERNAME_CONFLICT':
      return '注册失败：用户名已存在';
    case 'AUTH_REGISTER_EMAIL_CONFLICT':
      return '注册失败：邮箱已被注册';
    default:
      return errorBody?.message ?? fallback;
  }
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, disabled }) => {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = React.useState(false);
  const { message } = App.useApp();

  /** 提交注册：调用真实后端注册接口并处理错误提示 */
  const handleFinish = async (values: RegisterFormValues) => {
    // 读取运行时配置，并动态拼接注册 URL
    const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
    const registerUrl = buildRegisterUrl(runtimeConfig.apiBaseUrl || '/api/v1');

    // 解析租户信息：后端注册接口要求 X-Tenant-ID
    const tenantId = resolveTenantId(runtimeConfig);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    // 提交前进入 loading，避免重复点击造成并发请求
    setIsLoading(true);
    try {
      const response = await fetch(registerUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          username: values.username.trim(),
          email: values.email.trim(),
          password: values.password,
          display_name: values.username.trim(),
        }),
      });

      // 兼容后端异常返回非 JSON 的场景
      const responseBody = (await response.json().catch(() => null)) as
        | ApiSuccessEnvelope<RegisterResponseData>
        | ApiErrorEnvelope
        | null;

      // 处理后端业务错误（4xx/5xx）
      if (!response.ok) {
        const readableMessage = extractRegisterErrorMessage(
          responseBody as ApiErrorEnvelope | null,
          '注册失败，请稍后重试',
        );
        message.error(readableMessage);
        return;
      }

      // 校验关键字段，避免后端结构异常导致前端误提示
      const successBody = responseBody as ApiSuccessEnvelope<RegisterResponseData> | null;
      if (!successBody?.data?.user_id || !successBody.data.username) {
        message.error('注册失败：服务端返回数据不完整');
        return;
      }

      // 注册成功后跳回登录页，主路径保持与现有页面逻辑一致
      message.success('注册成功，请登录');
      onSuccess?.();
    } catch (error) {
      console.error('[RegisterForm] 注册请求异常:', error);
      message.error('注册失败：网络异常，请稍后重试');
    } finally {
      // 请求结束，统一解除 loading
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

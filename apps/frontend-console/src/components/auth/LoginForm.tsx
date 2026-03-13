import React, { useEffect } from 'react';
import { Form, Input, Button, Checkbox, App } from 'antd';
import { useAuthStore } from '../../stores/authStore';
import { getRuntimeConfig } from '../../config/runtime-config';
import type { User } from '../../types/user';
import { deriveDeterministicUUID, persistAuthSession } from '../../utils/authStorage';

export interface LoginFormProps {
  onForgotPassword?: () => void;
  onSSOLogin?: () => void;
  disabled?: boolean;
}

/** 登录表单字段 */
interface LoginFormValues {
  username: string;
  password: string;
  remember: boolean;
}

/** 运行时配置扩展：兼容配置中心未来增加 tenantId 字段 */
interface RuntimeConfigWithTenant {
  apiBaseUrl: string;
  tenantId?: string;
  tenantID?: string;
  enableAuthEmergencyMock?: boolean;
  authEmergencyMockEnabled?: boolean;
  features?: {
    enableAuthEmergencyMock?: boolean;
  };
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

/** 登录成功 data 结构 */
interface LoginResponseData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    user_id: string;
    username: string;
    email: string;
    display_name?: string;
    role?: string;
  };
}

const TENANT_ID_KEY = 'nexuslog-tenant-id';
/** 前端会话有效期上限：6 小时（秒） */
const MAX_FRONTEND_TOKEN_TTL_SECONDS = 6 * 60 * 60;
/** 登录应急开关本地键：默认关闭，仅故障兜底时人工开启 */
const EMERGENCY_AUTH_MOCK_KEY = 'nexuslog-auth-emergency-mock';

/** 规范化登录 URL，避免 baseUrl 与路径拼接出现双斜杠 */
function buildLoginUrl(apiBaseUrl: string): string {
  const normalizedBase = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
  return `${normalizedBase}/auth/login`;
}

/** 解析租户 ID：优先 localStorage，其次运行时配置扩展字段 */
function resolveTenantId(config: RuntimeConfigWithTenant): string | null {
  try {
    const localTenant = window.localStorage.getItem(TENANT_ID_KEY)?.trim();
    if (localTenant) {
      return localTenant;
    }
  } catch (error) {
    console.warn('[LoginForm] 读取 localStorage 租户信息失败:', error);
  }

  const configTenant = (config.tenantId ?? config.tenantID ?? '').trim();
  return configTenant || null;
}

/** 将后端可选角色映射到前端严格角色枚举 */
function mapRole(role: unknown): User['role'] {
  if (role === 'admin' || role === 'editor' || role === 'viewer') {
    return role;
  }
  return 'viewer';
}

/** 计算前端使用的 token TTL：取后端返回值与 6 小时上限中的更小值 */
function resolveTokenTtlSeconds(expiresIn: number): number {
  const normalizedExpiresIn =
    Number.isFinite(expiresIn) && expiresIn > 0
      ? Math.floor(expiresIn)
      : MAX_FRONTEND_TOKEN_TTL_SECONDS;
  return Math.min(normalizedExpiresIn, MAX_FRONTEND_TOKEN_TTL_SECONDS);
}

/** 判断是否启用应急 mock 登录（默认 false） */
function isEmergencyMockEnabled(config: RuntimeConfigWithTenant): boolean {
  try {
    const localFlag = window.localStorage.getItem(EMERGENCY_AUTH_MOCK_KEY)?.trim().toLowerCase();
    if (localFlag === '1' || localFlag === 'true' || localFlag === 'on' || localFlag === 'enabled') {
      return true;
    }
  } catch (error) {
    console.warn('[LoginForm] 读取应急开关失败:', error);
  }

  return Boolean(
    config.enableAuthEmergencyMock ||
      config.authEmergencyMockEnabled ||
      config.features?.enableAuthEmergencyMock,
  );
}

/** 写入应急 mock 会话 token，兼容受保护路由的 token 检查逻辑 */
function buildEmergencyMockUserID(username: string): string {
  return deriveDeterministicUUID(`nexuslog-emergency:${username.trim().toLowerCase() || 'emergency-user'}`);
}

function writeEmergencyMockSessionTokens(remember: boolean): void {
  const nowMs = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  persistAuthSession({
    accessToken: `emergency-access-${randomSuffix}`,
    refreshToken: `emergency-refresh-${randomSuffix}`,
    expiresAtMs: nowMs + MAX_FRONTEND_TOKEN_TTL_SECONDS * 1000,
    remember,
  });
}

/** 提取后端错误并转换为可读中文提示 */
function extractErrorMessage(errorBody: ApiErrorEnvelope | null, fallback: string): string {
  switch (errorBody?.code) {
    case 'AUTH_LOGIN_TENANT_REQUIRED':
      return '登录失败：缺少租户信息，请先配置租户 ID（localStorage 键：nexuslog-tenant-id）';
    case 'AUTH_LOGIN_TENANT_INVALID':
      return '登录失败：租户 ID 格式无效';
    case 'AUTH_LOGIN_TENANT_NOT_FOUND':
      return '登录失败：租户不存在或未激活';
    default:
      return errorBody?.message ?? fallback;
  }
}

const LoginForm: React.FC<LoginFormProps> = ({ onForgotPassword, onSSOLogin, disabled }) => {
  const [form] = Form.useForm();
  const { login, isLoading, setLoading, syncPermissions, setPermissions } = useAuthStore();
  const { message } = App.useApp();
  const isDisabled = isLoading || disabled;

  useEffect(() => {
    // 自动聚焦用户名
    const timer = setTimeout(() => {
      const el = document.getElementById('login-username');
      el?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  /** 提交登录：调用真实后端接口并写入认证状态 */
  const handleFinish = async (values: LoginFormValues) => {
    // 读取运行时配置，并动态拼接登录 URL
    const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
    const loginUrl = buildLoginUrl(runtimeConfig.apiBaseUrl || '/api/v1');

    // 解析租户信息：后端登录接口要求 X-Tenant-ID
    const tenantId = resolveTenantId(runtimeConfig);
    const normalizedUsername = values.username.trim();

    // 主路径默认只走真实 API；仅当应急开关开启时允许本地 mock 登录
    if (isEmergencyMockEnabled(runtimeConfig)) {
      setLoading(true);
      try {
        writeEmergencyMockSessionTokens(values.remember);
        if (tenantId) {
          window.localStorage.setItem(TENANT_ID_KEY, tenantId);
        }

        const emergencyUsername = normalizedUsername || 'emergency-user';
        login({
          id: buildEmergencyMockUserID(emergencyUsername),
          username: emergencyUsername,
          email: `${emergencyUsername}@nexuslog.local`,
          role: 'admin',
        });
        setPermissions(['*']);
        message.warning('应急模式已启用：当前使用本地模拟登录');
      } finally {
        setLoading(false);
      }
      return;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    // 提交前进入 loading，避免重复点击造成并发请求
    setLoading(true);
    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          username: normalizedUsername,
          password: values.password,
          remember_me: values.remember,
        }),
      });

      // 兼容后端异常返回非 JSON 的场景
      const responseBody = (await response.json().catch(() => null)) as
        | ApiSuccessEnvelope<LoginResponseData>
        | ApiErrorEnvelope
        | null;

      // 处理后端业务错误（4xx/5xx）
      if (!response.ok) {
        const readableMessage = extractErrorMessage(
          responseBody as ApiErrorEnvelope | null,
          '登录失败，请检查账号密码后重试',
        );
        message.error(readableMessage);
        return;
      }

      // 校验关键字段，避免后端结构异常导致前端脏状态
      const successBody = responseBody as ApiSuccessEnvelope<LoginResponseData> | null;
      if (!successBody?.data?.user?.user_id || !successBody.data.user.username) {
        message.error('登录失败：服务端返回数据不完整');
        return;
      }

      // 保存 token，为后续受保护路由与刷新逻辑提供基础数据
      const tokenTtlSeconds = resolveTokenTtlSeconds(successBody.data.expires_in);
      persistAuthSession({
        accessToken: successBody.data.access_token,
        refreshToken: successBody.data.refresh_token,
        expiresAtMs: Date.now() + tokenTtlSeconds * 1000,
        remember: values.remember,
      });
      if (tenantId) {
        window.localStorage.setItem(TENANT_ID_KEY, tenantId);
      }

      // 将后端用户信息映射为前端状态结构
      login({
        id: successBody.data.user.user_id,
        username: successBody.data.user.username,
        email: successBody.data.user.email || `${successBody.data.user.username}@nexuslog.local`,
        role: mapRole(successBody.data.user.role),
      });

      // 获取当前用户权限
      await syncPermissions();

      // 提示登录成功
      message.success('登录成功');
    } catch (error) {
      console.error('[LoginForm] 登录请求异常:', error);
      message.error('登录失败：网络异常，请稍后重试');
    } finally {
      // 请求结束，统一解除 loading
      setLoading(false);
    }
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
        htmlFor="login-username"
        rules={[{ required: true, message: '请输入用户名' }]}
      >
        <Input
          id="login-username"
          prefix={<span className="material-symbols-outlined text-base opacity-50">person</span>}
          placeholder="请输入用户名"
          name="username"
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
          name="password"
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

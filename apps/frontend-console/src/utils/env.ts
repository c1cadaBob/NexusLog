/**
 * 环境变量工具函数
 * 提供类型安全的环境变量访问
 */

/**
 * 获取环境变量值
 */
export function getEnv(key: keyof ImportMetaEnv): string {
  return import.meta.env[key] || '';
}

/**
 * 获取布尔类型环境变量
 */
export function getEnvBoolean(key: keyof ImportMetaEnv): boolean {
  const value = import.meta.env[key];
  return value === 'true' || value === '1';
}

/**
 * 获取数字类型环境变量
 */
export function getEnvNumber(key: keyof ImportMetaEnv, defaultValue: number = 0): number {
  const value = import.meta.env[key];
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 环境配置对象
 */
export const config = {
  // API 配置
  api: {
    baseUrl: getEnv('VITE_API_BASE_URL') || '/api',
    wsUrl: getEnv('VITE_WS_URL') || 'ws://localhost:8080/ws',
  },
  
  // 应用配置
  app: {
    name: getEnv('VITE_APP_NAME') || 'NexusLog',
    version: getEnv('VITE_APP_VERSION') || '1.0.0',
    env: (getEnv('VITE_ENV') || 'development') as 'development' | 'staging' | 'production',
  },
  
  // 功能开关
  features: {
    debug: getEnvBoolean('VITE_DEBUG'),
    sourcemap: getEnvBoolean('VITE_SOURCEMAP'),
    monitoring: getEnvBoolean('VITE_ENABLE_MONITORING'),
    analytics: getEnvBoolean('VITE_ENABLE_ANALYTICS'),
  },
  
  // 认证配置
  auth: {
    oauthClientId: getEnv('VITE_OAUTH_CLIENT_ID'),
    oauthRedirectUri: getEnv('VITE_OAUTH_REDIRECT_URI'),
    sessionTimeout: getEnvNumber('VITE_SESSION_TIMEOUT', 30),
  },
  
  // 第三方服务
  services: {
    sentryDsn: getEnv('VITE_SENTRY_DSN'),
    gaId: getEnv('VITE_GA_ID'),
  },
  
  // 环境判断
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  isStaging: getEnv('VITE_ENV') === 'staging',
} as const;

export default config;

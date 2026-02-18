/**
 * 运行时配置类型定义
 */
export interface AppConfig {
  apiBaseUrl: string
  wsBaseUrl: string
  appName: string
  version: string
  features: {
    enableWebSocket: boolean
    enableOfflineMode: boolean
    enableAnalytics: boolean
  }
  theme: {
    defaultMode: 'light' | 'dark' | 'auto'
    primaryColor: string
  }
  session: {
    idleTimeoutMinutes: number
    refreshIntervalMinutes: number
  }
}

/**
 * 默认配置
 */
const defaultConfig: AppConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  wsBaseUrl: import.meta.env.VITE_WS_BASE_URL || '/ws',
  appName: 'NexusLog',
  version: '0.1.0',
  features: {
    enableWebSocket: true,
    enableOfflineMode: false,
    enableAnalytics: false,
  },
  theme: {
    defaultMode: 'light',
    primaryColor: '#1890ff',
  },
  session: {
    idleTimeoutMinutes: 30,
    refreshIntervalMinutes: 5,
  },
}

let cachedConfig: AppConfig | null = null

/**
 * 加载运行时配置
 * 从 /config/app-config.json 加载配置，支持热更新
 */
export async function loadAppConfig(): Promise<AppConfig> {
  if (cachedConfig) {
    return cachedConfig
  }

  try {
    const response = await fetch('/config/app-config.json')
    if (!response.ok) {
      console.warn('无法加载运行时配置，使用默认配置')
      cachedConfig = defaultConfig
      return defaultConfig
    }

    const runtimeConfig = await response.json()
    const mergedConfig: AppConfig = {
      ...defaultConfig,
      ...runtimeConfig,
      features: {
        ...defaultConfig.features,
        ...runtimeConfig.features,
      },
      theme: {
        ...defaultConfig.theme,
        ...runtimeConfig.theme,
      },
      session: {
        ...defaultConfig.session,
        ...runtimeConfig.session,
      },
    }
    cachedConfig = mergedConfig
    return mergedConfig
  } catch (error) {
    console.warn('加载运行时配置失败，使用默认配置:', error)
    cachedConfig = defaultConfig
    return defaultConfig
  }
}

/**
 * 获取当前配置（同步）
 * 注意：首次调用前需要先调用 loadAppConfig()
 */
export function getAppConfig(): AppConfig {
  if (cachedConfig !== null) {
    return cachedConfig
  }
  return defaultConfig
}

/**
 * 刷新配置（用于热更新）
 */
export async function refreshAppConfig(): Promise<AppConfig> {
  cachedConfig = null
  return loadAppConfig()
}

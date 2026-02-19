/**
 * 运行时配置模块
 * 支持从 /config/app-config.json 加载配置，页面刷新时自动获取最新配置
 * 需求: 22.1, 22.3
 */

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
 * 默认配置 - 当远程配置不可用时使用
 */
const defaultConfig: AppConfig = {
  apiBaseUrl: '/api/v1',
  wsBaseUrl: '/ws',
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

/** 配置变更监听器类型 */
export type ConfigChangeListener = (newConfig: AppConfig, oldConfig: AppConfig) => void

/** 缓存的配置实例 */
let cachedConfig: AppConfig | null = null

/** 配置变更监听器列表 */
const listeners: Set<ConfigChangeListener> = new Set()

/**
 * 获取默认配置的副本
 */
export function getDefaultConfig(): AppConfig {
  return structuredClone(defaultConfig)
}

/**
 * 深度合并运行时配置与默认配置
 * 远程配置中的字段覆盖默认值，缺失字段保留默认值
 */
export function mergeConfig(partial: Record<string, unknown>): AppConfig {
  const base = getDefaultConfig()

  return {
    apiBaseUrl: typeof partial.apiBaseUrl === 'string' ? partial.apiBaseUrl : base.apiBaseUrl,
    wsBaseUrl: typeof partial.wsBaseUrl === 'string' ? partial.wsBaseUrl : base.wsBaseUrl,
    appName: typeof partial.appName === 'string' ? partial.appName : base.appName,
    version: typeof partial.version === 'string' ? partial.version : base.version,
    features: {
      ...base.features,
      ...(typeof partial.features === 'object' && partial.features !== null
        ? Object.fromEntries(
            Object.entries(partial.features as Record<string, unknown>).filter(
              ([, v]) => typeof v === 'boolean'
            )
          )
        : {}),
    },
    theme: {
      ...base.theme,
      ...(typeof partial.theme === 'object' && partial.theme !== null
        ? Object.fromEntries(
            Object.entries(partial.theme as Record<string, unknown>).filter(
              ([, v]) => typeof v === 'string'
            )
          )
        : {}),
    },
    session: {
      ...base.session,
      ...(typeof partial.session === 'object' && partial.session !== null
        ? Object.fromEntries(
            Object.entries(partial.session as Record<string, unknown>).filter(
              ([, v]) => typeof v === 'number' && v > 0
            )
          )
        : {}),
    },
  }
}

/**
 * 加载运行时配置
 * 从 /config/app-config.json 获取配置，与默认配置深度合并
 * 页面刷新时会重新加载最新配置（热更新）
 */
export async function loadAppConfig(): Promise<AppConfig> {
  if (cachedConfig) {
    return cachedConfig
  }

  try {
    const response = await fetch('/config/app-config.json', {
      cache: 'no-cache',
    })
    if (!response.ok) {
      console.warn('无法加载运行时配置，使用默认配置')
      cachedConfig = getDefaultConfig()
      return cachedConfig
    }

    const runtimeConfig = await response.json()
    cachedConfig = mergeConfig(runtimeConfig)
    return cachedConfig
  } catch (error) {
    console.warn('加载运行时配置失败，使用默认配置:', error)
    cachedConfig = getDefaultConfig()
    return cachedConfig
  }
}

/**
 * 获取当前配置（同步）
 * 首次调用前需要先调用 loadAppConfig()
 */
export function getAppConfig(): AppConfig {
  if (cachedConfig !== null) {
    return cachedConfig
  }
  return getDefaultConfig()
}

/**
 * 刷新配置（热更新入口）
 * 清除缓存并重新加载，触发变更通知
 */
export async function refreshAppConfig(): Promise<AppConfig> {
  const oldConfig = cachedConfig ? structuredClone(cachedConfig) : getDefaultConfig()
  cachedConfig = null
  const newConfig = await loadAppConfig()

  // 配置发生变化时通知监听器
  if (JSON.stringify(oldConfig) !== JSON.stringify(newConfig)) {
    notifyListeners(newConfig, oldConfig)
  }

  return newConfig
}

/**
 * 注册配置变更监听器
 * 返回取消注册的函数
 */
export function onConfigChange(listener: ConfigChangeListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * 通知所有监听器配置已变更
 */
function notifyListeners(newConfig: AppConfig, oldConfig: AppConfig): void {
  listeners.forEach((listener) => {
    try {
      listener(newConfig, oldConfig)
    } catch (error) {
      console.error('配置变更监听器执行失败:', error)
    }
  })
}

/**
 * 重置配置状态（仅用于测试）
 */
export function resetConfigForTesting(): void {
  cachedConfig = null
  listeners.clear()
}

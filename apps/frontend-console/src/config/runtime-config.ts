/**
 * 运行时配置加载器
 *
 * 从 /config/app-config.json 加载运行时配置，支持页面刷新时自动获取最新配置。
 * 配置文件由运维团队在部署时或运行时修改，无需重新构建前端即可生效。
 *
 * 需求: 7
 */

const TENANT_ID_KEY = 'nexuslog-tenant-id';
const BASE_CONFIG_PATH = '/config/app-config.json';
const LOCAL_OVERRIDE_CONFIG_PATH = '/config/app-config.local.json';

/** 功能开关配置 */
export interface FeatureFlags {
  /** 是否启用 WebSocket 实时推送 */
  enableWebSocket: boolean;
  /** 是否启用离线模式 */
  enableOfflineMode: boolean;
  /** 是否启用数据分析埋点 */
  enableAnalytics: boolean;
}

/** 主题配置 */
export interface ThemeConfig {
  /** 默认主题模式: light | dark */
  defaultMode: 'light' | 'dark';
  /** 主色调 */
  primaryColor: string;
}

/** 会话配置 */
export interface SessionConfig {
  /** 空闲超时时间（分钟） */
  idleTimeoutMinutes: number;
  /** Token 刷新间隔（分钟） */
  refreshIntervalMinutes: number;
}

/** Collector Agent 发布配置 */
export interface CollectorAgentReleaseConfig {
  /** 发布源类型 */
  releaseProvider?: 'github' | 'gitee' | 'custom';
  /** GitHub/Gitee owner 或组织 */
  owner?: string;
  /** 发布仓库名 */
  repo?: string;
  /** 默认发布版本 */
  version?: string;
  /** 发布包下载基址 */
  releaseBaseUrl?: string;
  /** 一键安装脚本地址 */
  installScriptUrl?: string;
  /** 容器镜像来源 */
  containerImageProvider?: 'ghcr' | 'custom';
  /** 默认容器镜像地址 */
  containerImage?: string;
}

/** 运行时配置结构 */
export interface RuntimeConfig {
  /** API 基础路径 */
  apiBaseUrl: string;
  /** 默认租户 ID */
  tenantId?: string;
  /** 兼容旧字段名 */
  tenantID?: string;
  /** WebSocket 基础路径 */
  wsBaseUrl: string;
  /** 应用名称 */
  appName: string;
  /** 应用版本 */
  version: string;
  /** 功能开关 */
  features: FeatureFlags;
  /** 主题配置 */
  theme: ThemeConfig;
  /** 会话配置 */
  session: SessionConfig;
  /** Collector Agent 发布配置 */
  collectorAgent: CollectorAgentReleaseConfig;
}

type RuntimeConfigPatch = Partial<RuntimeConfig>;

/** 默认配置（当远程配置加载失败时使用） */
const DEFAULT_CONFIG: RuntimeConfig = {
  apiBaseUrl: '/api/v1',
  wsBaseUrl: '/ws',
  appName: 'NexusLog',
  version: '0.0.0',
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
  collectorAgent: {
    releaseProvider: 'github',
    owner: 'c1cadaBob',
    repo: 'NexusLog',
    version: 'v0.1.0',
    releaseBaseUrl: 'https://github.com/c1cadaBob/NexusLog/releases/download/v0.1.0',
    installScriptUrl: 'https://github.com/c1cadaBob/NexusLog/releases/download/v0.1.0/collector-agent-installer.sh',
    containerImageProvider: 'ghcr',
    containerImage: 'ghcr.io/c1cadaBob/nexuslog-collector-agent:v0.1.0',
  },
};

/** 配置单例缓存 */
let cachedConfig: RuntimeConfig | null = null;

function mergeRuntimeConfig(...configs: RuntimeConfigPatch[]): RuntimeConfig {
  return configs.reduce<RuntimeConfig>(
    (merged, current) => ({
      ...merged,
      ...current,
      features: { ...merged.features, ...(current.features ?? {}) },
      theme: { ...merged.theme, ...(current.theme ?? {}) },
      session: { ...merged.session, ...(current.session ?? {}) },
      collectorAgent: { ...merged.collectorAgent, ...(current.collectorAgent ?? {}) },
    }),
    { ...DEFAULT_CONFIG },
  );
}

function resolveConfigTenantId(config: RuntimeConfigPatch): string {
  return (config.tenantId ?? config.tenantID ?? '').trim();
}

async function fetchConfigPatch(
  path: string,
  timestamp: number,
  options: { optional?: boolean } = {},
): Promise<RuntimeConfigPatch> {
  const response = await fetch(`${path}?t=${timestamp}`);

  if (!response.ok) {
    if (options.optional && response.status === 404) {
      return {};
    }

    throw new Error(`配置加载失败 (${path}, HTTP ${response.status})`);
  }

  return (await response.json()) as RuntimeConfigPatch;
}

function syncTenantIdToStorage(config: RuntimeConfig): void {
  const tenantId = resolveConfigTenantId(config);
  if (!tenantId) {
    return;
  }

  try {
    const storedTenantId = window.localStorage.getItem(TENANT_ID_KEY)?.trim();
    if (storedTenantId !== tenantId) {
      window.localStorage.setItem(TENANT_ID_KEY, tenantId);
      console.info(`[RuntimeConfig] 已同步 tenantId 到本地缓存: ${tenantId}`);
    }
  } catch (error) {
    console.warn('[RuntimeConfig] 同步 tenantId 到本地缓存失败:', error);
  }
}

/**
 * 从远程加载运行时配置
 *
 * 每次页面刷新时调用，通过 cache-busting 参数确保获取最新配置。
 * 加载失败时回退到默认配置，不会阻塞应用启动。
 */
export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const timestamp = Date.now();
    const baseConfig = await fetchConfigPatch(BASE_CONFIG_PATH, timestamp);
    const localOverrideConfig = await fetchConfigPatch(LOCAL_OVERRIDE_CONFIG_PATH, timestamp, {
      optional: true,
    });

    cachedConfig = mergeRuntimeConfig(baseConfig, localOverrideConfig);
    syncTenantIdToStorage(cachedConfig);

    console.info(`[RuntimeConfig] 配置加载成功: ${cachedConfig.appName} v${cachedConfig.version}`);
    return cachedConfig;
  } catch (error) {
    console.warn('[RuntimeConfig] 配置加载异常，使用默认配置:', error);
    cachedConfig = { ...DEFAULT_CONFIG };
    return cachedConfig;
  }
}

/**
 * 获取当前运行时配置（同步）
 *
 * 必须在 loadRuntimeConfig() 完成后调用，否则返回默认配置。
 */
export function getRuntimeConfig(): RuntimeConfig {
  if (!cachedConfig) {
    console.warn('[RuntimeConfig] 配置尚未加载，返回默认配置');
    return { ...DEFAULT_CONFIG };
  }
  return cachedConfig;
}

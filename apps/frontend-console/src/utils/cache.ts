/**
 * API 响应缓存工具
 * 
 * 提供带过期时间的缓存功能，支持缓存失效和手动清除
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 缓存条目
 */
export interface CacheEntry<T> {
  /** 缓存的数据 */
  data: T;
  /** 过期时间戳 */
  expiresAt: number;
  /** 创建时间戳 */
  createdAt: number;
  /** 缓存标签，用于批量失效 */
  tags?: string[];
}

/**
 * 缓存配置选项
 */
export interface CacheOptions {
  /** 过期时间（毫秒），默认 5 分钟 */
  ttl?: number;
  /** 缓存标签，用于批量失效 */
  tags?: string[];
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  /** 缓存命中次数 */
  hits: number;
  /** 缓存未命中次数 */
  misses: number;
  /** 当前缓存条目数 */
  size: number;
  /** 命中率 */
  hitRate: number;
}

// ============================================================================
// 默认配置
// ============================================================================

/** 默认过期时间：5 分钟 */
export const DEFAULT_TTL = 5 * 60 * 1000;

/** 最大缓存条目数 */
export const MAX_CACHE_SIZE = 100;

// ============================================================================
// 缓存类实现
// ============================================================================

/**
 * API 响应缓存管理器
 * 
 * @example
 * ```ts
 * const cache = new ApiCache();
 * 
 * // 设置缓存
 * cache.set('users', userData, { ttl: 60000, tags: ['users'] });
 * 
 * // 获取缓存
 * const data = cache.get<User[]>('users');
 * 
 * // 按标签失效
 * cache.invalidateByTag('users');
 * ```
 */
export class ApiCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    hitRate: 0,
  };

  /**
   * 获取缓存数据
   * @param key 缓存键
   * @returns 缓存的数据，如果不存在或已过期则返回 null
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    this.stats.hits++;
    this.updateHitRate();
    return entry.data as T;
  }

  /**
   * 设置缓存数据
   * @param key 缓存键
   * @param data 要缓存的数据
   * @param options 缓存选项
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const { ttl = DEFAULT_TTL, tags } = options;
    const now = Date.now();

    // 如果缓存已满，清理过期条目
    if (this.cache.size >= MAX_CACHE_SIZE) {
      this.cleanup();
    }

    // 如果仍然满，删除最旧的条目
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = this.findOldestEntry();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const entry: CacheEntry<T> = {
      data,
      expiresAt: now + ttl,
      createdAt: now,
      tags,
    };

    this.cache.set(key, entry);
    this.stats.size = this.cache.size;
  }

  /**
   * 检查缓存是否存在且有效
   * @param key 缓存键
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      return false;
    }
    return true;
  }

  /**
   * 删除指定缓存
   * @param key 缓存键
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return result;
  }

  /**
   * 按标签批量失效缓存
   * @param tag 缓存标签
   * @returns 失效的缓存条目数
   */
  invalidateByTag(tag: string): number {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags?.includes(tag)) {
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.size = this.cache.size;
    return count;
  }

  /**
   * 按多个标签批量失效缓存
   * @param tags 缓存标签数组
   * @returns 失效的缓存条目数
   */
  invalidateByTags(tags: string[]): number {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags?.some(t => tags.includes(t))) {
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.size = this.cache.size;
    return count;
  }

  /**
   * 按键前缀批量失效缓存
   * @param prefix 键前缀
   * @returns 失效的缓存条目数
   */
  invalidateByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.size = this.cache.size;
    return count;
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * 清理过期的缓存条目
   * @returns 清理的条目数
   */
  cleanup(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.size = this.cache.size;
    return count;
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      size: this.cache.size,
      hitRate: 0,
    };
  }

  /**
   * 获取所有缓存键
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 获取缓存条目的元数据（不包含数据）
   */
  getEntryMeta(key: string): Omit<CacheEntry<unknown>, 'data'> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    return {
      expiresAt: entry.expiresAt,
      createdAt: entry.createdAt,
      tags: entry.tags,
    };
  }

  // 私有方法

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private findOldestEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    return oldestKey;
  }
}

// ============================================================================
// 全局缓存实例
// ============================================================================

/** 全局 API 缓存实例 */
export const apiCache = new ApiCache();

// ============================================================================
// 缓存键生成工具
// ============================================================================

/**
 * 生成缓存键
 * @param prefix 前缀
 * @param params 参数对象
 * @returns 缓存键
 */
export function generateCacheKey(prefix: string, params?: Record<string, unknown>): string {
  if (!params || Object.keys(params).length === 0) {
    return prefix;
  }

  // 对参数进行排序以确保一致性
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${JSON.stringify(params[key])}`)
    .join('&');

  return `${prefix}:${sortedParams}`;
}

/**
 * 资源类型到标签的映射
 */
export const RESOURCE_TAGS = {
  users: ['users', 'security'],
  roles: ['roles', 'security'],
  alerts: ['alerts'],
  sources: ['sources', 'ingestion'],
  indices: ['indices', 'storage'],
  reports: ['reports'],
  settings: ['settings', 'config'],
  dashboard: ['dashboard'],
} as const;

export type ResourceType = keyof typeof RESOURCE_TAGS;

/**
 * 带缓存功能的 API 服务包装器
 * 
 * 为 API 请求提供自动缓存支持：
 * - 带过期时间的缓存
 * - 数据变更时的缓存失效
 * - 缓存统计和管理
 */

import { apiClient } from './client';
import { apiCache, generateCacheKey, RESOURCE_TAGS } from '../../utils/cache';
import type { CacheOptions, CacheStats, ResourceType } from '../../utils/cache';
import type { RequestConfig } from '../../types/api';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 缓存请求配置
 */
export interface CachedRequestConfig extends RequestConfig {
  /** 缓存键前缀 */
  cacheKey?: string;
  /** 缓存过期时间（毫秒） */
  cacheTtl?: number;
  /** 缓存标签 */
  cacheTags?: string[];
  /** 是否跳过缓存 */
  skipCache?: boolean;
  /** 是否强制刷新（忽略缓存但更新缓存） */
  forceRefresh?: boolean;
}

/**
 * 变更请求配置
 */
export interface MutationRequestConfig extends RequestConfig {
  /** 变更后要失效的缓存标签 */
  invalidateTags?: string[];
  /** 变更后要失效的缓存键前缀 */
  invalidateKeys?: string[];
}

// ============================================================================
// 默认配置
// ============================================================================

/** 默认缓存过期时间：5 分钟 */
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

/** 短期缓存：1 分钟 */
export const SHORT_CACHE_TTL = 1 * 60 * 1000;

/** 中期缓存：5 分钟 */
export const MEDIUM_CACHE_TTL = 5 * 60 * 1000;

/** 长期缓存：30 分钟 */
export const LONG_CACHE_TTL = 30 * 60 * 1000;

// ============================================================================
// 带缓存的 API 客户端
// ============================================================================

/**
 * 带缓存功能的 API 客户端
 * 
 * @example
 * ```typescript
 * // GET 请求自动缓存
 * const users = await cachedApi.get<User[]>('/users', {
 *   cacheKey: 'users',
 *   cacheTtl: 60000,
 *   cacheTags: ['users']
 * });
 * 
 * // POST 请求自动失效相关缓存
 * await cachedApi.post('/users', userData, {
 *   invalidateTags: ['users']
 * });
 * ```
 */
export const cachedApi = {
  /**
   * 带缓存的 GET 请求
   */
  async get<T>(endpoint: string, config: CachedRequestConfig = {}): Promise<T> {
    const {
      cacheKey,
      cacheTtl = DEFAULT_CACHE_TTL,
      cacheTags,
      skipCache = false,
      forceRefresh = false,
      params,
      ...restConfig
    } = config;

    // 生成缓存键
    const fullCacheKey = cacheKey 
      ? generateCacheKey(cacheKey, params as Record<string, unknown>)
      : generateCacheKey(endpoint, params as Record<string, unknown>);

    // 检查缓存（除非跳过或强制刷新）
    if (!skipCache && !forceRefresh) {
      const cachedData = apiCache.get<T>(fullCacheKey);
      if (cachedData !== null) {
        return cachedData;
      }
    }

    // 发起请求
    const data = await apiClient.get<T>(endpoint, { params, ...restConfig });

    // 存入缓存
    const cacheOptions: CacheOptions = {
      ttl: cacheTtl,
      tags: cacheTags,
    };
    apiCache.set(fullCacheKey, data, cacheOptions);

    return data;
  },

  /**
   * 带缓存失效的 POST 请求
   */
  async post<T>(
    endpoint: string, 
    data?: unknown, 
    config: MutationRequestConfig = {}
  ): Promise<T> {
    const { invalidateTags = [], invalidateKeys = [], ...restConfig } = config;

    // 发起请求
    const result = await apiClient.post<T>(endpoint, data, restConfig);

    // 失效相关缓存
    invalidateCache(invalidateTags, invalidateKeys);

    return result;
  },

  /**
   * 带缓存失效的 PUT 请求
   */
  async put<T>(
    endpoint: string, 
    data?: unknown, 
    config: MutationRequestConfig = {}
  ): Promise<T> {
    const { invalidateTags = [], invalidateKeys = [], ...restConfig } = config;

    // 发起请求
    const result = await apiClient.put<T>(endpoint, data, restConfig);

    // 失效相关缓存
    invalidateCache(invalidateTags, invalidateKeys);

    return result;
  },

  /**
   * 带缓存失效的 PATCH 请求
   */
  async patch<T>(
    endpoint: string, 
    data?: unknown, 
    config: MutationRequestConfig = {}
  ): Promise<T> {
    const { invalidateTags = [], invalidateKeys = [], ...restConfig } = config;

    // 发起请求
    const result = await apiClient.patch<T>(endpoint, data, restConfig);

    // 失效相关缓存
    invalidateCache(invalidateTags, invalidateKeys);

    return result;
  },

  /**
   * 带缓存失效的 DELETE 请求
   */
  async delete<T>(endpoint: string, config: MutationRequestConfig = {}): Promise<T> {
    const { invalidateTags = [], invalidateKeys = [], ...restConfig } = config;

    // 发起请求
    const result = await apiClient.delete<T>(endpoint, restConfig);

    // 失效相关缓存
    invalidateCache(invalidateTags, invalidateKeys);

    return result;
  },
};

// ============================================================================
// 缓存管理函数
// ============================================================================

/**
 * 失效缓存
 * @param tags - 要失效的标签
 * @param keys - 要失效的键前缀
 */
export function invalidateCache(tags: string[], keys: string[]): void {
  // 按标签失效
  for (const tag of tags) {
    apiCache.invalidateByTag(tag);
  }

  // 按键前缀失效
  for (const key of keys) {
    apiCache.invalidateByPrefix(key);
  }
}

/**
 * 按资源类型失效缓存
 * @param resourceType - 资源类型
 */
export function invalidateByResourceType(resourceType: ResourceType): void {
  const tags = RESOURCE_TAGS[resourceType];
  if (tags) {
    for (const tag of tags) {
      apiCache.invalidateByTag(tag);
    }
  }
}

/**
 * 清除所有缓存
 */
export function clearAllCache(): void {
  apiCache.clear();
}

/**
 * 清理过期缓存
 * @returns 清理的条目数
 */
export function cleanupExpiredCache(): number {
  return apiCache.cleanup();
}

/**
 * 获取缓存统计
 * @returns 缓存统计信息
 */
export function getCacheStats(): CacheStats {
  return apiCache.getStats();
}

/**
 * 重置缓存统计
 */
export function resetCacheStats(): void {
  apiCache.resetStats();
}

/**
 * 预热缓存
 * @param requests - 要预热的请求数组
 */
export async function warmupCache(
  requests: Array<{
    endpoint: string;
    config?: CachedRequestConfig;
  }>
): Promise<void> {
  await Promise.all(
    requests.map(({ endpoint, config }) => 
      cachedApi.get(endpoint, config).catch(() => {
        // 忽略预热失败
      })
    )
  );
}

// ============================================================================
// 缓存装饰器工厂
// ============================================================================

/**
 * 创建带缓存的 API 函数
 * @param apiFunction - 原始 API 函数
 * @param cacheConfig - 缓存配置
 * @returns 带缓存的 API 函数
 */
export function withCache<T, P extends unknown[]>(
  apiFunction: (...params: P) => Promise<T>,
  cacheConfig: {
    keyPrefix: string;
    ttl?: number;
    tags?: string[];
  }
): (...params: P) => Promise<T> {
  const { keyPrefix, ttl = DEFAULT_CACHE_TTL, tags } = cacheConfig;

  return async (...params: P): Promise<T> => {
    // 生成缓存键
    const paramsObj = params.length > 0
      ? params.reduce<Record<string, unknown>>((acc, param, index) => {
          acc[`p${index}`] = param;
          return acc;
        }, {})
      : undefined;
    const cacheKey = generateCacheKey(keyPrefix, paramsObj);

    // 检查缓存
    const cachedData = apiCache.get<T>(cacheKey);
    if (cachedData !== null) {
      return cachedData;
    }

    // 发起请求
    const data = await apiFunction(...params);

    // 存入缓存
    apiCache.set(cacheKey, data, { ttl, tags });

    return data;
  };
}

/**
 * 创建带缓存失效的变更函数
 * @param mutationFunction - 原始变更函数
 * @param invalidateConfig - 失效配置
 * @returns 带缓存失效的变更函数
 */
export function withInvalidation<T, P extends unknown[]>(
  mutationFunction: (...params: P) => Promise<T>,
  invalidateConfig: {
    tags?: string[];
    keys?: string[];
  }
): (...params: P) => Promise<T> {
  const { tags = [], keys = [] } = invalidateConfig;

  return async (...params: P): Promise<T> => {
    // 执行变更
    const result = await mutationFunction(...params);

    // 失效缓存
    invalidateCache(tags, keys);

    return result;
  };
}

export default cachedApi;

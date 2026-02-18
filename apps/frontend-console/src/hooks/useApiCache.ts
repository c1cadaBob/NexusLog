/**
 * useApiCache Hook - 带缓存功能的 API 请求 Hook
 * 
 * 在 useApi 基础上添加缓存支持，实现：
 * - 带过期时间的缓存
 * - 数据变更时的缓存失效
 * - 缓存统计和管理
 * 
 * 注意：此 Hook 使用 Zustand Store 而非 Context API
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { apiCache, generateCacheKey, DEFAULT_TTL } from '../utils/cache';
import type { CacheOptions, CacheStats } from '../utils/cache';
import type { ApiError, UseApiReturn } from '../types/api';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * useApiCache 配置选项
 */
export interface UseApiCacheOptions<T> {
  /** 缓存键前缀 */
  cacheKey: string;
  /** 缓存过期时间（毫秒） */
  ttl?: number;
  /** 缓存标签，用于批量失效 */
  tags?: string[];
  /** 是否启用缓存，默认 true */
  enabled?: boolean;
  /** 成功回调 */
  onSuccess?: (data: T) => void;
  /** 错误回调 */
  onError?: (error: ApiError) => void;
  /** 是否立即执行 */
  immediate?: boolean;
  /** 立即执行时的参数 */
  immediateParams?: unknown[];
  /** 是否在组件卸载时取消请求 */
  cancelOnUnmount?: boolean;
  /** 是否在缓存命中时也触发 onSuccess */
  notifyOnCacheHit?: boolean;
}

/**
 * useApiCache 返回值
 */
export interface UseApiCacheReturn<T, P extends unknown[]> extends UseApiReturn<T, P> {
  /** 是否来自缓存 */
  fromCache: boolean;
  /** 使缓存失效 */
  invalidate: () => void;
  /** 按标签使缓存失效 */
  invalidateByTag: (tag: string) => number;
  /** 刷新数据（忽略缓存） */
  refresh: (...params: P) => Promise<T>;
  /** 获取缓存统计 */
  getCacheStats: () => CacheStats;
}

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * 带缓存功能的 API 请求 Hook
 */
export function useApiCache<T, P extends unknown[]>(
  apiFunction: (...params: P) => Promise<T>,
  options: UseApiCacheOptions<T>
): UseApiCacheReturn<T, P> {
  const {
    cacheKey,
    ttl = DEFAULT_TTL,
    tags,
    enabled = true,
    onSuccess,
    onError,
    immediate = false,
    immediateParams = [],
    cancelOnUnmount = true,
    notifyOnCacheHit = false,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const lastParamsRef = useRef<P | null>(null);

  const getFullCacheKey = useCallback((params: P): string => {
    const paramsObj = params.length > 0 
      ? params.reduce<Record<string, unknown>>((acc, param, index) => {
          acc[`p${index}`] = param;
          return acc;
        }, {})
      : undefined;
    return generateCacheKey(cacheKey, paramsObj);
  }, [cacheKey]);

  const execute = useCallback(async (...params: P): Promise<T> => {
    lastParamsRef.current = params;
    const fullKey = getFullCacheKey(params);

    if (enabled) {
      const cachedData = apiCache.get<T>(fullKey);
      if (cachedData !== null) {
        setData(cachedData);
        setFromCache(true);
        setError(null);
        if (notifyOnCacheHit) {
          onSuccess?.(cachedData);
        }
        return cachedData;
      }
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setFromCache(false);

    try {
      const result = await apiFunction(...params);

      if (!mountedRef.current) {
        return result;
      }

      if (enabled) {
        const cacheOptions: CacheOptions = { ttl, tags };
        apiCache.set(fullKey, result, cacheOptions);
      }

      setData(result);
      onSuccess?.(result);
      return result;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }

      if (!mountedRef.current) {
        throw err;
      }

      const apiError: ApiError = {
        code: 'UNKNOWN',
        message: err instanceof Error ? err.message : '请求失败',
        details: err,
      };

      setError(apiError);
      onError?.(apiError);
      throw err;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiFunction, cacheKey, enabled, getFullCacheKey, notifyOnCacheHit, onError, onSuccess, tags, ttl]);

  const refresh = useCallback(async (...params: P): Promise<T> => {
    const fullKey = getFullCacheKey(params);
    apiCache.delete(fullKey);
    return execute(...params);
  }, [execute, getFullCacheKey]);

  const invalidate = useCallback(() => {
    if (lastParamsRef.current) {
      const fullKey = getFullCacheKey(lastParamsRef.current);
      apiCache.delete(fullKey);
    }
    apiCache.invalidateByPrefix(cacheKey);
  }, [cacheKey, getFullCacheKey]);

  const invalidateByTag = useCallback((tag: string): number => {
    return apiCache.invalidateByTag(tag);
  }, []);

  const getCacheStats = useCallback((): CacheStats => {
    return apiCache.getStats();
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
    setFromCache(false);
  }, []);

  useEffect(() => {
    if (immediate) {
      execute(...(immediateParams as P)).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (cancelOnUnmount && abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [cancelOnUnmount]);

  return {
    data,
    loading,
    error,
    execute,
    reset,
    setData,
    fromCache,
    invalidate,
    invalidateByTag,
    refresh,
    getCacheStats,
  };
}

export default useApiCache;

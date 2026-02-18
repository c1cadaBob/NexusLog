/**
 * useOfflineCache Hook - 离线数据缓存
 * 
 * 提供离线数据缓存功能：
 * - 缓存最近查看的数据
 * - 允许离线查看缓存数据
 * - 自动管理缓存过期
 * 
 * @module hooks/useOfflineCache
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useOfflineStore, useCacheStore } from '@/stores';
import type { ApiError } from '@/types/api';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 缓存数据状态
 */
export interface CachedDataState<T> {
  data: T | null;
  fromCache: boolean;
  cachedAt: Date | null;
  isStale: boolean;
}

/**
 * useOfflineCache 配置选项
 */
export interface UseOfflineCacheOptions<T> {
  cacheKey: string;
  ttl?: number;
  source?: string;
  useOnOffline?: boolean;
  preferCache?: boolean;
  onCacheHit?: (data: T) => void;
  onCacheMiss?: () => void;
  onSuccess?: (data: T) => void;
  onError?: (error: ApiError) => void;
}


/**
 * useOfflineCache 返回值
 */
export interface UseOfflineCacheReturn<T, P extends unknown[]> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  fromCache: boolean;
  cachedAt: Date | null;
  isStale: boolean;
  execute: (...params: P) => Promise<T>;
  refresh: (...params: P) => Promise<T>;
  clearCache: () => void;
  setCache: (data: T) => void;
  reset: () => void;
}

// ============================================================================
// 常量
// ============================================================================

const DEFAULT_TTL = 24 * 60 * 60 * 1000;
const STALE_TIME = 5 * 60 * 1000;

// ============================================================================
// Hook 实现
// ============================================================================

export function useOfflineCache<T, P extends unknown[]>(
  apiFunction: (...params: P) => Promise<T>,
  options: UseOfflineCacheOptions<T>
): UseOfflineCacheReturn<T, P> {
  const {
    cacheKey,
    ttl = DEFAULT_TTL,
    useOnOffline = true,
    preferCache = false,
    onCacheHit,
    onCacheMiss,
    onSuccess,
    onError,
  } = options;

  // 使用 Zustand Store 替代 Context API
  const isOnline = useOfflineStore(state => state.isOnline);
  const { get: getCachedData, set: setCachedData, remove: removeCachedData } = useCacheStore();

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [cachedAt, setCachedAt] = useState<Date | null>(null);

  const mountedRef = useRef(true);
  const lastParamsRef = useRef<P | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);


  const getFullCacheKey = useCallback((params: P): string => {
    if (params.length === 0) return cacheKey;
    return `${cacheKey}:${JSON.stringify(params)}`;
  }, [cacheKey]);

  const checkIsStale = useCallback((cachedTime: Date | null): boolean => {
    if (!cachedTime) return true;
    return Date.now() - cachedTime.getTime() > STALE_TIME;
  }, []);

  const getFromCache = useCallback((params: P): T | null => {
    const fullKey = getFullCacheKey(params);
    return getCachedData<T>(fullKey);
  }, [getFullCacheKey, getCachedData]);

  const saveToCache = useCallback((params: P, value: T): void => {
    const fullKey = getFullCacheKey(params);
    setCachedData(fullKey, value, ttl);
  }, [getFullCacheKey, setCachedData, ttl]);

  const execute = useCallback(async (...params: P): Promise<T> => {
    lastParamsRef.current = params;
    const cachedValue = getFromCache(params);
    
    if (!isOnline && useOnOffline && cachedValue !== null) {
      if (mountedRef.current) {
        setData(cachedValue);
        setFromCache(true);
        setCachedAt(new Date());
        setError(null);
      }
      onCacheHit?.(cachedValue);
      return cachedValue;
    }

    if (preferCache && cachedValue !== null) {
      if (mountedRef.current) {
        setData(cachedValue);
        setFromCache(true);
        setCachedAt(new Date());
        setError(null);
      }
      onCacheHit?.(cachedValue);
      return cachedValue;
    }

    if (!isOnline) {
      const offlineError: ApiError = {
        code: 'OFFLINE',
        message: '当前处于离线状态，且没有可用的缓存数据',
      };
      if (mountedRef.current) {
        setError(offlineError);
        setLoading(false);
      }
      onCacheMiss?.();
      onError?.(offlineError);
      throw offlineError;
    }


    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const result = await apiFunction(...params);
      if (mountedRef.current) {
        setData(result);
        setFromCache(false);
        setCachedAt(new Date());
        setLoading(false);
      }
      saveToCache(params, result);
      onSuccess?.(result);
      return result;
    } catch (err) {
      if (cachedValue !== null) {
        if (mountedRef.current) {
          setData(cachedValue);
          setFromCache(true);
          setCachedAt(new Date());
          setLoading(false);
        }
        onCacheHit?.(cachedValue);
        return cachedValue;
      }

      const apiError: ApiError = {
        code: 'FETCH_ERROR',
        message: err instanceof Error ? err.message : '数据获取失败',
        details: err,
      };
      if (mountedRef.current) {
        setError(apiError);
        setLoading(false);
      }
      onError?.(apiError);
      throw apiError;
    }
  }, [isOnline, useOnOffline, preferCache, getFromCache, saveToCache, apiFunction, onCacheHit, onCacheMiss, onSuccess, onError]);

  const refresh = useCallback(async (...params: P): Promise<T> => {
    if (!isOnline) {
      const offlineError: ApiError = { code: 'OFFLINE', message: '当前处于离线状态，无法刷新数据' };
      onError?.(offlineError);
      throw offlineError;
    }
    lastParamsRef.current = params;
    if (mountedRef.current) { setLoading(true); setError(null); }

    try {
      const result = await apiFunction(...params);
      if (mountedRef.current) {
        setData(result);
        setFromCache(false);
        setCachedAt(new Date());
        setLoading(false);
      }
      saveToCache(params, result);
      onSuccess?.(result);
      return result;
    } catch (err) {
      const apiError: ApiError = { code: 'FETCH_ERROR', message: err instanceof Error ? err.message : '数据刷新失败', details: err };
      if (mountedRef.current) { setError(apiError); setLoading(false); }
      onError?.(apiError);
      throw apiError;
    }
  }, [isOnline, apiFunction, saveToCache, onSuccess, onError]);


  const clearCache = useCallback((): void => {
    if (lastParamsRef.current) {
      const fullKey = getFullCacheKey(lastParamsRef.current);
      removeCachedData(fullKey);
    }
  }, [getFullCacheKey, removeCachedData]);

  const setCache = useCallback((value: T): void => {
    if (lastParamsRef.current) {
      saveToCache(lastParamsRef.current, value);
    }
    if (mountedRef.current) {
      setData(value);
      setCachedAt(new Date());
    }
  }, [saveToCache]);

  const reset = useCallback((): void => {
    if (mountedRef.current) {
      setData(null);
      setLoading(false);
      setError(null);
      setFromCache(false);
      setCachedAt(null);
    }
  }, []);

  return {
    data,
    loading,
    error,
    fromCache,
    cachedAt,
    isStale: checkIsStale(cachedAt),
    execute,
    refresh,
    clearCache,
    setCache,
    reset,
  };
}

export default useOfflineCache;

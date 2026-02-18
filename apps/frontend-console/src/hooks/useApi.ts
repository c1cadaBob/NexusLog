/**
 * useApi Hook - 用于 API 请求的自定义 Hook
 * 
 * 提供统一的 API 请求状态管理，包括加载、错误和数据状态
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ApiError, UseApiReturn } from '../types/api';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * useApi 配置选项
 */
export interface UseApiOptions<T> {
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
}

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * 用于 API 请求的自定义 Hook
 * 
 * @param apiFunction - API 请求函数
 * @param options - 配置选项
 * @returns API 请求状态和控制方法
 * 
 * @example
 * ```tsx
 * const { data, loading, error, execute, reset } = useApi(
 *   (id: string) => fetchUser(id),
 *   { onSuccess: (user) => console.log('User loaded:', user) }
 * );
 * 
 * // 执行请求
 * await execute('user-123');
 * 
 * // 重置状态
 * reset();
 * ```
 */
export function useApi<T, P extends unknown[]>(
  apiFunction: (...params: P) => Promise<T>,
  options: UseApiOptions<T> = {}
): UseApiReturn<T, P> {
  const {
    onSuccess,
    onError,
    immediate = false,
    immediateParams = [],
    cancelOnUnmount = true,
  } = options;

  // 状态
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // 用于取消请求的 ref
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // 执行 API 请求
  const execute = useCallback(async (...params: P): Promise<T> => {
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const result = await apiFunction(...params);

      // 检查组件是否仍然挂载
      if (!mountedRef.current) {
        return result;
      }

      setData(result);
      onSuccess?.(result);
      return result;
    } catch (err) {
      // 检查是否是取消的请求
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }

      // 检查组件是否仍然挂载
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
  }, [apiFunction, onSuccess, onError]);

  // 重置状态
  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  // 立即执行
  useEffect(() => {
    if (immediate) {
      execute(...(immediateParams as P)).catch(() => {
        // 错误已在 execute 中处理
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 组件卸载时取消请求
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
  };
}

export default useApi;

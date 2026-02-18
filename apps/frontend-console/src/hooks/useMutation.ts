/**
 * useMutation Hook - 用于数据变更操作的 Hook
 * 
 * 提供数据变更（创建、更新、删除）操作，并自动处理缓存失效
 * 
 * @module hooks/useMutation
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useCacheStore } from '@/stores';
import type { ApiError } from '@/types/api';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 变更操作类型
 */
export type MutationType = 'create' | 'update' | 'delete';

/**
 * useMutation 配置选项
 */
export interface UseMutationOptions<T, V> {
  /** 变更操作类型 */
  type?: MutationType;
  /** 成功后要失效的缓存标签 */
  invalidateTags?: string[];
  /** 成功后要失效的缓存键前缀 */
  invalidateKeys?: string[];
  /** 成功回调 */
  onSuccess?: (data: T, variables: V) => void;
  /** 错误回调 */
  onError?: (error: ApiError, variables: V) => void;
  /** 完成回调（无论成功或失败） */
  onSettled?: (data: T | null, error: ApiError | null, variables: V) => void;
  /** 乐观更新函数 */
  onMutate?: (variables: V) => void | Promise<void>;
}

/**
 * useMutation 返回值
 */
export interface UseMutationReturn<T, V> {
  /** 变更后的数据 */
  data: T | null;
  /** 是否正在执行 */
  loading: boolean;
  /** 错误信息 */
  error: ApiError | null;
  /** 是否成功 */
  isSuccess: boolean;
  /** 是否失败 */
  isError: boolean;
  /** 执行变更 */
  mutate: (variables: V) => Promise<T>;
  /** 异步执行变更 */
  mutateAsync: (variables: V) => Promise<T>;
  /** 重置状态 */
  reset: () => void;
}

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * 用于数据变更操作的 Hook
 * 
 * @param mutationFn - 变更函数
 * @param options - 配置选项
 * @returns 变更状态和控制方法
 * 
 * @example
 * ```tsx
 * const { mutate, loading, error } = useMutation(
 *   (user: UserInput) => createUser(user),
 *   {
 *     type: 'create',
 *     invalidateTags: ['users'],
 *     onSuccess: (data) => {
 *       toast.success('用户创建成功');
 *     }
 *   }
 * );
 * 
 * // 执行变更
 * await mutate({ name: 'John', email: 'john@example.com' });
 * ```
 */
export function useMutation<T, V = void>(
  mutationFn: (variables: V) => Promise<T>,
  options: UseMutationOptions<T, V> = {}
): UseMutationReturn<T, V> {
  const {
    invalidateTags = [],
    invalidateKeys = [],
    onSuccess,
    onError,
    onSettled,
    onMutate,
  } = options;

  // 从 Zustand Store 获取缓存操作
  const { invalidateByTag, invalidateByPrefix } = useCacheStore();

  // 状态
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);

  // Refs
  const mountedRef = useRef(true);

  /**
   * 执行缓存失效
   */
  const invalidateCache = useCallback(() => {
    // 按标签失效
    for (const tag of invalidateTags) {
      invalidateByTag(tag);
    }

    // 按键前缀失效
    for (const key of invalidateKeys) {
      invalidateByPrefix(key);
    }
  }, [invalidateTags, invalidateKeys, invalidateByTag, invalidateByPrefix]);

  /**
   * 执行变更
   */
  const mutateAsync = useCallback(async (variables: V): Promise<T> => {
    setLoading(true);
    setError(null);
    setIsSuccess(false);
    setIsError(false);

    try {
      // 执行乐观更新
      if (onMutate) {
        await onMutate(variables);
      }

      const result = await mutationFn(variables);

      if (!mountedRef.current) {
        return result;
      }

      // 变更成功，执行缓存失效
      invalidateCache();

      setData(result);
      setIsSuccess(true);
      onSuccess?.(result, variables);
      onSettled?.(result, null, variables);

      return result;
    } catch (err) {
      if (!mountedRef.current) {
        throw err;
      }

      const apiError: ApiError = {
        code: 'MUTATION_ERROR',
        message: err instanceof Error ? err.message : '操作失败',
        details: err,
      };

      setError(apiError);
      setIsError(true);
      onError?.(apiError, variables);
      onSettled?.(null, apiError, variables);

      throw err;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [mutationFn, invalidateCache, onMutate, onSuccess, onError, onSettled]);

  /**
   * 执行变更（不抛出错误）
   */
  const mutate = useCallback(async (variables: V): Promise<T> => {
    try {
      return await mutateAsync(variables);
    } catch {
      // 错误已在 mutateAsync 中处理
      return null as T;
    }
  }, [mutateAsync]);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
    setIsSuccess(false);
    setIsError(false);
  }, []);

  // 组件卸载时标记
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    data,
    loading,
    error,
    isSuccess,
    isError,
    mutate,
    mutateAsync,
    reset,
  };
}

export default useMutation;

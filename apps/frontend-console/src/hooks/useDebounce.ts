/**
 * useDebounce Hook - 用于防抖的自定义 Hook
 * 
 * 延迟更新值，直到指定时间内没有新的更新
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ============================================================================
// useDebounce - 防抖值
// ============================================================================

/**
 * 防抖值 Hook
 * 
 * @param value - 需要防抖的值
 * @param delay - 防抖延迟时间（毫秒）
 * @returns 防抖后的值
 * 
 * @example
 * ```tsx
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearchTerm = useDebounce(searchTerm, 300);
 * 
 * useEffect(() => {
 *   // 只有当用户停止输入 300ms 后才会执行搜索
 *   if (debouncedSearchTerm) {
 *     performSearch(debouncedSearchTerm);
 *   }
 * }, [debouncedSearchTerm]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // 设置定时器
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // 清理定时器
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ============================================================================
// useDebouncedCallback - 防抖回调
// ============================================================================

/**
 * 防抖回调 Hook
 * 
 * @param callback - 需要防抖的回调函数
 * @param delay - 防抖延迟时间（毫秒）
 * @returns 防抖后的回调函数和取消函数
 * 
 * @example
 * ```tsx
 * const { debouncedCallback, cancel } = useDebouncedCallback(
 *   (value: string) => {
 *     console.log('Debounced:', value);
 *   },
 *   300
 * );
 * 
 * // 使用防抖回调
 * <input onChange={(e) => debouncedCallback(e.target.value)} />
 * 
 * // 取消待执行的回调
 * cancel();
 * ```
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): {
  debouncedCallback: (...args: Parameters<T>) => void;
  cancel: () => void;
  flush: () => void;
} {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  const argsRef = useRef<Parameters<T> | null>(null);

  // 更新回调引用
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // 取消函数
  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    argsRef.current = null;
  }, []);

  // 立即执行函数
  const flush = useCallback(() => {
    if (timerRef.current && argsRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      callbackRef.current(...argsRef.current);
      argsRef.current = null;
    }
  }, []);

  // 防抖回调
  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    argsRef.current = args;
    
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      callbackRef.current(...args);
      timerRef.current = null;
      argsRef.current = null;
    }, delay);
  }, [delay]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { debouncedCallback, cancel, flush };
}

export default useDebounce;

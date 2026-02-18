/**
 * useMemoizedValue Hook - 深度比较的记忆化 Hook
 * 
 * 提供深度比较的记忆化功能，用于优化昂贵计算
 * 
 * @module hooks/useMemoizedValue
 */

import { useRef, useMemo } from 'react';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 深度比较函数类型
 */
type DeepEqualFn = <T>(a: T, b: T) => boolean;

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 深度比较两个值是否相等
 */
export function deepEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  
  if (typeof a !== 'object') return a === b;
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  
  if (Array.isArray(a) || Array.isArray(b)) return false;
  
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  
  if (aKeys.length !== bKeys.length) return false;
  
  return aKeys.every(key => deepEqual(aObj[key], bObj[key]));
}

/**
 * 浅比较两个值是否相等
 */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  
  if (typeof a !== 'object') return a === b;
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => item === b[index]);
  }
  
  if (Array.isArray(a) || Array.isArray(b)) return false;
  
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  
  if (aKeys.length !== bKeys.length) return false;
  
  return aKeys.every(key => aObj[key] === bObj[key]);
}

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * 使用深度比较的记忆化值
 * 
 * @param value - 要记忆化的值
 * @param equalFn - 比较函数，默认使用深度比较
 * @returns 记忆化的值
 * 
 * @example
 * ```tsx
 * const filters = useMemoizedValue({ status: 'active', page: 1 });
 * // 只有当 filters 的内容真正改变时才会返回新的引用
 * ```
 */
export function useMemoizedValue<T>(
  value: T,
  equalFn: DeepEqualFn = deepEqual
): T {
  const ref = useRef<T>(value);
  
  if (!equalFn(ref.current, value)) {
    ref.current = value;
  }
  
  return ref.current;
}

/**
 * 使用深度比较的记忆化计算
 * 
 * @param factory - 计算函数
 * @param deps - 依赖数组
 * @returns 记忆化的计算结果
 * 
 * @example
 * ```tsx
 * const expensiveResult = useMemoizedComputation(
 *   () => computeExpensiveValue(data),
 *   [data]
 * );
 * ```
 */
export function useMemoizedComputation<T>(
  factory: () => T,
  deps: unknown[]
): T {
  const memoizedDeps = useMemoizedValue(deps);
  
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, [memoizedDeps]);
}

/**
 * 使用浅比较的记忆化值
 * 
 * @param value - 要记忆化的值
 * @returns 记忆化的值
 */
export function useShallowMemoizedValue<T>(value: T): T {
  return useMemoizedValue(value, shallowEqual);
}

export default useMemoizedValue;

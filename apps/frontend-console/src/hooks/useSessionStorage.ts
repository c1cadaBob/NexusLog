/**
 * useSessionStorage Hook - 用于 sessionStorage 持久化的自定义 Hook
 * 
 * 提供带 JSON 序列化的 get 和 set 功能，支持错误处理
 * 用于表单自动保存和错误恢复状态持久化
 */

import { useState, useCallback, useEffect } from 'react';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * useSessionStorage 配置选项
 */
export interface UseSessionStorageOptions<T> {
  /** 序列化函数 */
  serializer?: (value: T) => string;
  /** 反序列化函数 */
  deserializer?: (value: string) => T;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

/**
 * useSessionStorage 返回值
 */
export interface UseSessionStorageReturn<T> {
  /** 当前值 */
  value: T;
  /** 设置值 */
  setValue: (value: T | ((prev: T) => T)) => void;
  /** 移除值 */
  removeValue: () => void;
  /** 是否发生错误 */
  error: Error | null;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 默认序列化函数
 */
function defaultSerializer<T>(value: T): string {
  return JSON.stringify(value);
}

/**
 * 默认反序列化函数
 */
function defaultDeserializer<T>(value: string): T {
  return JSON.parse(value) as T;
}

/**
 * 安全读取 sessionStorage
 */
function safeGetItem<T>(
  key: string,
  initialValue: T,
  deserializer: (value: string) => T
): { value: T; error: Error | null } {
  if (typeof window === 'undefined') {
    return { value: initialValue, error: null };
  }

  try {
    const item = window.sessionStorage.getItem(key);
    if (item === null) {
      return { value: initialValue, error: null };
    }
    return { value: deserializer(item), error: null };
  } catch (error) {
    return { 
      value: initialValue, 
      error: error instanceof Error ? error : new Error('Failed to read from sessionStorage') 
    };
  }
}

/**
 * 安全写入 sessionStorage
 */
function safeSetItem<T>(
  key: string,
  value: T,
  serializer: (value: T) => string
): Error | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    window.sessionStorage.setItem(key, serializer(value));
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error('Failed to write to sessionStorage');
  }
}

/**
 * 安全移除 sessionStorage 项
 */
function safeRemoveItem(key: string): Error | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    window.sessionStorage.removeItem(key);
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error('Failed to remove from sessionStorage');
  }
}

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * 用于 sessionStorage 持久化的自定义 Hook
 * 
 * @param key - sessionStorage 键名
 * @param initialValue - 初始值
 * @param options - 配置选项
 * @returns sessionStorage 状态和控制方法
 * 
 * @example
 * ```tsx
 * const { value, setValue, removeValue } = useSessionStorage('form-data', {
 *   name: '',
 *   email: ''
 * });
 * 
 * // 更新值
 * setValue({ ...value, name: 'John' });
 * 
 * // 使用函数更新
 * setValue(prev => ({ ...prev, email: 'john@example.com' }));
 * 
 * // 移除值
 * removeValue();
 * ```
 */
export function useSessionStorage<T>(
  key: string,
  initialValue: T,
  options: UseSessionStorageOptions<T> = {}
): UseSessionStorageReturn<T> {
  const {
    serializer = defaultSerializer,
    deserializer = defaultDeserializer,
    onError,
  } = options;

  // 初始化状态
  const [storedValue, setStoredValue] = useState<T>(() => {
    const { value } = safeGetItem(key, initialValue, deserializer);
    return value;
  });

  const [error, setError] = useState<Error | null>(() => {
    const { error } = safeGetItem(key, initialValue, deserializer);
    return error;
  });

  // 设置值
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      // 支持函数式更新
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // 更新状态
      setStoredValue(valueToStore);
      
      // 写入 sessionStorage
      const writeError = safeSetItem(key, valueToStore, serializer);
      if (writeError) {
        setError(writeError);
        onError?.(writeError);
      } else {
        setError(null);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to set value');
      setError(error);
      onError?.(error);
    }
  }, [key, storedValue, serializer, onError]);

  // 移除值
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);
      const removeError = safeRemoveItem(key);
      if (removeError) {
        setError(removeError);
        onError?.(removeError);
      } else {
        setError(null);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to remove value');
      setError(error);
      onError?.(error);
    }
  }, [key, initialValue, onError]);

  // 监听 key 变化时重新读取
  useEffect(() => {
    const { value, error } = safeGetItem(key, initialValue, deserializer);
    setStoredValue(value);
    setError(error);
  }, [key, initialValue, deserializer]);

  return {
    value: storedValue,
    setValue,
    removeValue,
    error,
  };
}

// ============================================================================
// 工具函数导出
// ============================================================================

/**
 * 直接从 sessionStorage 获取值
 */
export function getSessionStorageItem<T>(key: string, defaultValue: T): T {
  const { value } = safeGetItem<T>(key, defaultValue, (v) => JSON.parse(v) as T);
  return value;
}

/**
 * 直接设置 sessionStorage 值
 */
export function setSessionStorageItem<T>(key: string, value: T): Error | null {
  return safeSetItem(key, value, defaultSerializer);
}

/**
 * 直接移除 sessionStorage 项
 */
export function removeSessionStorageItem(key: string): Error | null {
  return safeRemoveItem(key);
}

export default useSessionStorage;

/**
 * useLocalStorage Hook - 用于 localStorage 持久化的自定义 Hook
 * 
 * 提供带 JSON 序列化的 get 和 set 功能，支持错误处理
 */

import { useState, useCallback, useEffect } from 'react';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * useLocalStorage 配置选项
 */
export interface UseLocalStorageOptions<T> {
  /** 序列化函数 */
  serializer?: (value: T) => string;
  /** 反序列化函数 */
  deserializer?: (value: string) => T;
  /** 错误回调 */
  onError?: (error: Error) => void;
  /** 是否同步到其他标签页 */
  syncTabs?: boolean;
}

/**
 * useLocalStorage 返回值
 */
export interface UseLocalStorageReturn<T> {
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
 * 安全读取 localStorage
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
    const item = window.localStorage.getItem(key);
    if (item === null) {
      return { value: initialValue, error: null };
    }
    return { value: deserializer(item), error: null };
  } catch (error) {
    return { 
      value: initialValue, 
      error: error instanceof Error ? error : new Error('Failed to read from localStorage') 
    };
  }
}

/**
 * 安全写入 localStorage
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
    window.localStorage.setItem(key, serializer(value));
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error('Failed to write to localStorage');
  }
}

/**
 * 安全移除 localStorage 项
 */
function safeRemoveItem(key: string): Error | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    window.localStorage.removeItem(key);
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error('Failed to remove from localStorage');
  }
}

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * 用于 localStorage 持久化的自定义 Hook
 * 
 * @param key - localStorage 键名
 * @param initialValue - 初始值
 * @param options - 配置选项
 * @returns localStorage 状态和控制方法
 * 
 * @example
 * ```tsx
 * const { value, setValue, removeValue } = useLocalStorage('user-settings', {
 *   theme: 'dark',
 *   language: 'zh-CN'
 * });
 * 
 * // 更新值
 * setValue({ ...value, theme: 'light' });
 * 
 * // 使用函数更新
 * setValue(prev => ({ ...prev, language: 'en-US' }));
 * 
 * // 移除值
 * removeValue();
 * ```
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: UseLocalStorageOptions<T> = {}
): UseLocalStorageReturn<T> {
  const {
    serializer = defaultSerializer,
    deserializer = defaultDeserializer,
    onError,
    syncTabs = true,
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
      
      // 写入 localStorage
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

  // 监听其他标签页的变化
  useEffect(() => {
    if (!syncTabs || typeof window === 'undefined') {
      return;
    }

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== key) {
        return;
      }

      if (event.newValue === null) {
        // 值被删除
        setStoredValue(initialValue);
      } else {
        try {
          const newValue = deserializer(event.newValue);
          setStoredValue(newValue);
          setError(null);
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Failed to parse storage event');
          setError(error);
          onError?.(error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, initialValue, deserializer, syncTabs, onError]);

  return {
    value: storedValue,
    setValue,
    removeValue,
    error,
  };
}

export default useLocalStorage;

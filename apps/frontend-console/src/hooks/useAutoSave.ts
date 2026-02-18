/**
 * useAutoSave Hook - 表单自动保存功能
 * 
 * 功能：
 * - 定期自动保存表单数据到 sessionStorage
 * - 页面重新加载时恢复数据
 * - 支持防抖保存
 * - 支持手动保存和清除
 * 
 * 注意：此 Hook 使用 Zustand Store 而非 Context API
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSessionStorage } from './useSessionStorage';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 自动保存状态
 */
export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * 自动保存元数据
 */
export interface AutoSaveMetadata {
  /** 最后保存时间 */
  lastSaved: number | null;
  /** 保存版本 */
  version: number;
}

/**
 * 存储的数据结构
 */
interface StoredData<T> {
  data: T;
  metadata: AutoSaveMetadata;
}

/**
 * useAutoSave 配置选项
 */
export interface UseAutoSaveOptions<T> {
  /** 自动保存间隔（毫秒），默认 5000ms */
  interval?: number;
  /** 防抖延迟（毫秒），默认 1000ms */
  debounceDelay?: number;
  /** 是否启用自动保存，默认 true */
  enabled?: boolean;
  /** 保存前的验证函数 */
  validate?: (data: T) => boolean;
  /** 保存成功回调 */
  onSave?: (data: T) => void;
  /** 恢复数据回调 */
  onRestore?: (data: T) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

/**
 * useAutoSave 返回值
 */
export interface UseAutoSaveReturn<T> {
  /** 当前数据 */
  data: T;
  /** 更新数据 */
  setData: (data: T | ((prev: T) => T)) => void;
  /** 保存状态 */
  status: AutoSaveStatus;
  /** 元数据 */
  metadata: AutoSaveMetadata;
  /** 手动保存 */
  save: () => void;
  /** 清除保存的数据 */
  clear: () => void;
  /** 是否有已保存的数据 */
  hasStoredData: boolean;
  /** 恢复已保存的数据 */
  restore: () => void;
  /** 丢弃已保存的数据 */
  discard: () => void;
}

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * 表单自动保存 Hook
 * 
 * @param key - 存储键名
 * @param initialData - 初始数据
 * @param options - 配置选项
 * @returns 自动保存状态和控制方法
 * 
 * @example
 * ```tsx
 * const {
 *   data,
 *   setData,
 *   status,
 *   metadata,
 *   save,
 *   clear,
 *   hasStoredData,
 *   restore,
 *   discard
 * } = useAutoSave('my-form', { name: '', email: '' }, {
 *   interval: 5000,
 *   onSave: (data) => console.log('Saved:', data),
 * });
 * 
 * // 更新数据（会触发自动保存）
 * setData({ ...data, name: 'John' });
 * 
 * // 手动保存
 * save();
 * 
 * // 清除保存的数据
 * clear();
 * ```
 */
export function useAutoSave<T>(
  key: string,
  initialData: T,
  options: UseAutoSaveOptions<T> = {}
): UseAutoSaveReturn<T> {
  const {
    interval = 5000,
    debounceDelay = 1000,
    enabled = true,
    validate,
    onSave,
    onRestore,
    onError,
  } = options;

  const storageKey = `autosave:${key}`;
  
  // 使用 sessionStorage 存储
  const {
    value: storedData,
    setValue: setStoredData,
    removeValue: removeStoredData,
    error: storageError,
  } = useSessionStorage<StoredData<T> | null>(storageKey, null);

  // 当前数据状态
  const [data, setDataState] = useState<T>(initialData);
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [hasStoredData, setHasStoredData] = useState(false);
  
  // Refs
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataRef = useRef<T>(data);
  const isDirtyRef = useRef(false);

  // 更新 dataRef
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // 检查是否有已保存的数据
  useEffect(() => {
    if (storedData && storedData.metadata.lastSaved) {
      setHasStoredData(true);
    } else {
      setHasStoredData(false);
    }
  }, [storedData]);

  // 元数据
  const metadata: AutoSaveMetadata = storedData?.metadata ?? {
    lastSaved: null,
    version: 0,
  };

  // 执行保存
  const performSave = useCallback(() => {
    if (!enabled || !isDirtyRef.current) {
      return;
    }

    const currentData = dataRef.current;

    // 验证数据
    if (validate && !validate(currentData)) {
      return;
    }

    setStatus('saving');

    try {
      const newStoredData: StoredData<T> = {
        data: currentData,
        metadata: {
          lastSaved: Date.now(),
          version: (storedData?.metadata.version ?? 0) + 1,
        },
      };

      setStoredData(newStoredData);
      isDirtyRef.current = false;
      setStatus('saved');
      onSave?.(currentData);

      // 3秒后重置状态
      setTimeout(() => {
        setStatus('idle');
      }, 3000);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to save');
      setStatus('error');
      onError?.(error);
    }
  }, [enabled, validate, storedData, setStoredData, onSave, onError]);

  // 防抖保存
  const debouncedSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      performSave();
    }, debounceDelay);
  }, [performSave, debounceDelay]);

  // 更新数据
  const setData = useCallback((newData: T | ((prev: T) => T)) => {
    setDataState((prev) => {
      const updated = newData instanceof Function ? newData(prev) : newData;
      isDirtyRef.current = true;
      return updated;
    });
    
    // 触发防抖保存
    if (enabled) {
      debouncedSave();
    }
  }, [enabled, debouncedSave]);

  // 手动保存
  const save = useCallback(() => {
    isDirtyRef.current = true;
    performSave();
  }, [performSave]);

  // 清除保存的数据
  const clear = useCallback(() => {
    removeStoredData();
    setHasStoredData(false);
    isDirtyRef.current = false;
    setStatus('idle');
  }, [removeStoredData]);

  // 恢复已保存的数据
  const restore = useCallback(() => {
    if (storedData?.data) {
      setDataState(storedData.data);
      isDirtyRef.current = false;
      onRestore?.(storedData.data);
    }
  }, [storedData, onRestore]);

  // 丢弃已保存的数据
  const discard = useCallback(() => {
    clear();
  }, [clear]);

  // 设置定期保存
  useEffect(() => {
    if (!enabled || interval <= 0) {
      return;
    }

    intervalTimerRef.current = setInterval(() => {
      if (isDirtyRef.current) {
        performSave();
      }
    }, interval);

    return () => {
      if (intervalTimerRef.current) {
        clearInterval(intervalTimerRef.current);
      }
    };
  }, [enabled, interval, performSave]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (intervalTimerRef.current) {
        clearInterval(intervalTimerRef.current);
      }
    };
  }, []);

  // 处理存储错误
  useEffect(() => {
    if (storageError) {
      setStatus('error');
      onError?.(storageError);
    }
  }, [storageError, onError]);

  // 页面卸载前保存
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (enabled && isDirtyRef.current) {
        const currentData = dataRef.current;
        if (!validate || validate(currentData)) {
          const newStoredData: StoredData<T> = {
            data: currentData,
            metadata: {
              lastSaved: Date.now(),
              version: (storedData?.metadata.version ?? 0) + 1,
            },
          };
          // 同步保存
          try {
            window.sessionStorage.setItem(storageKey, JSON.stringify(newStoredData));
          } catch {
            // 忽略错误
          }
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, validate, storedData, storageKey]);

  return {
    data,
    setData,
    status,
    metadata,
    save,
    clear,
    hasStoredData,
    restore,
    discard,
  };
}

export default useAutoSave;

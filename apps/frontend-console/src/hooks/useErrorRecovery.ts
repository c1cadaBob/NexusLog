/**
 * useErrorRecovery Hook - 错误恢复状态管理
 * 
 * 功能：
 * - 将应用状态保存到 sessionStorage
 * - 错误边界恢复后恢复状态
 * - 支持多个状态片段的管理
 * 
 * 注意：此 Hook 使用 Zustand Store 而非 Context API
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  getSessionStorageItem,
  setSessionStorageItem,
  removeSessionStorageItem,
} from './useSessionStorage';

// ============================================================================
// 类型定义
// ============================================================================

export interface ErrorRecoveryMetadata {
  savedAt: number;
  errorAt?: number;
  errorMessage?: string;
  recoveryCount: number;
}

interface StoredRecoveryData<T> {
  state: T;
  metadata: ErrorRecoveryMetadata;
}

export interface UseErrorRecoveryOptions<T> {
  enabled?: boolean;
  saveInterval?: number;
  validate?: (state: T) => boolean;
  onRestore?: (state: T, metadata: ErrorRecoveryMetadata) => void;
  onSave?: (state: T) => void;
  onError?: (error: Error) => void;
}

export interface UseErrorRecoveryReturn<T> {
  saveState: (state: T) => void;
  restoreState: () => T | null;
  recordError: (error: Error) => void;
  clearRecoveryData: () => void;
  hasRecoverableState: boolean;
  metadata: ErrorRecoveryMetadata | null;
  markRecoveryComplete: () => void;
}

// ============================================================================
// 常量
// ============================================================================

const STORAGE_KEY_PREFIX = 'error-recovery:';
const DEFAULT_SAVE_INTERVAL = 10000;

// ============================================================================
// Hook 实现
// ============================================================================

export function useErrorRecovery<T>(
  key: string,
  options: UseErrorRecoveryOptions<T> = {}
): UseErrorRecoveryReturn<T> {
  const {
    enabled = true,
    saveInterval = DEFAULT_SAVE_INTERVAL,
    validate,
    onRestore,
    onSave,
    onError,
  } = options;

  const storageKey = `${STORAGE_KEY_PREFIX}${key}`;
  const lastStateRef = useRef<T | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getStoredData = useCallback((): StoredRecoveryData<T> | null => {
    return getSessionStorageItem<StoredRecoveryData<T> | null>(storageKey, null);
  }, [storageKey]);

  const hasRecoverableState = (() => {
    const stored = getStoredData();
    return stored !== null && stored.state !== undefined;
  })();

  const metadata = (() => {
    const stored = getStoredData();
    return stored?.metadata ?? null;
  })();

  const saveState = useCallback((state: T) => {
    if (!enabled) return;

    if (validate && !validate(state)) {
      return;
    }

    try {
      const existingData = getStoredData();
      const newData: StoredRecoveryData<T> = {
        state,
        metadata: {
          savedAt: Date.now(),
          errorAt: existingData?.metadata.errorAt,
          errorMessage: existingData?.metadata.errorMessage,
          recoveryCount: existingData?.metadata.recoveryCount ?? 0,
        },
      };

      const error = setSessionStorageItem(storageKey, newData);
      if (error) {
        onError?.(error);
      } else {
        lastStateRef.current = state;
        onSave?.(state);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error('Failed to save state'));
    }
  }, [enabled, validate, storageKey, getStoredData, onSave, onError]);

  const restoreState = useCallback((): T | null => {
    try {
      const stored = getStoredData();
      if (!stored || stored.state === undefined) {
        return null;
      }

      if (validate && !validate(stored.state)) {
        return null;
      }

      onRestore?.(stored.state, stored.metadata);
      return stored.state;
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error('Failed to restore state'));
      return null;
    }
  }, [getStoredData, validate, onRestore, onError]);

  const recordError = useCallback((error: Error) => {
    try {
      const existingData = getStoredData();
      if (!existingData) return;

      const updatedData: StoredRecoveryData<T> = {
        ...existingData,
        metadata: {
          ...existingData.metadata,
          errorAt: Date.now(),
          errorMessage: error.message,
        },
      };

      setSessionStorageItem(storageKey, updatedData);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error('Failed to record error'));
    }
  }, [storageKey, getStoredData, onError]);

  const clearRecoveryData = useCallback(() => {
    removeSessionStorageItem(storageKey);
    lastStateRef.current = null;
  }, [storageKey]);

  const markRecoveryComplete = useCallback(() => {
    try {
      const existingData = getStoredData();
      if (!existingData) return;

      const updatedData: StoredRecoveryData<T> = {
        ...existingData,
        metadata: {
          ...existingData.metadata,
          recoveryCount: existingData.metadata.recoveryCount + 1,
          errorAt: undefined,
          errorMessage: undefined,
        },
      };

      setSessionStorageItem(storageKey, updatedData);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error('Failed to mark recovery complete'));
    }
  }, [storageKey, getStoredData, onError]);

  useEffect(() => {
    if (!enabled || saveInterval <= 0) return;

    intervalRef.current = setInterval(() => {
      if (lastStateRef.current !== null) {
        saveState(lastStateRef.current);
      }
    }, saveInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, saveInterval, saveState]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (enabled && lastStateRef.current !== null) {
        const existingData = getStoredData();
        const newData: StoredRecoveryData<T> = {
          state: lastStateRef.current,
          metadata: {
            savedAt: Date.now(),
            errorAt: existingData?.metadata.errorAt,
            errorMessage: existingData?.metadata.errorMessage,
            recoveryCount: existingData?.metadata.recoveryCount ?? 0,
          },
        };
        try {
          window.sessionStorage.setItem(storageKey, JSON.stringify(newData));
        } catch {
          // 忽略错误
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, storageKey, getStoredData]);

  return {
    saveState,
    restoreState,
    recordError,
    clearRecoveryData,
    hasRecoverableState,
    metadata,
    markRecoveryComplete,
  };
}

// ============================================================================
// 工具函数
// ============================================================================

export function saveErrorRecoveryState<T>(key: string, state: T): Error | null {
  const storageKey = `${STORAGE_KEY_PREFIX}${key}`;
  const existingRaw = window.sessionStorage.getItem(storageKey);
  let existingData: StoredRecoveryData<T> | null = null;
  
  try {
    if (existingRaw) {
      existingData = JSON.parse(existingRaw);
    }
  } catch {
    // 忽略解析错误
  }

  const newData: StoredRecoveryData<T> = {
    state,
    metadata: {
      savedAt: Date.now(),
      errorAt: existingData?.metadata.errorAt,
      errorMessage: existingData?.metadata.errorMessage,
      recoveryCount: existingData?.metadata.recoveryCount ?? 0,
    },
  };

  return setSessionStorageItem(storageKey, newData);
}

export function getErrorRecoveryState<T>(key: string): T | null {
  const storageKey = `${STORAGE_KEY_PREFIX}${key}`;
  const data = getSessionStorageItem<StoredRecoveryData<T> | null>(storageKey, null);
  return data?.state ?? null;
}

export function clearErrorRecoveryState(key: string): Error | null {
  const storageKey = `${STORAGE_KEY_PREFIX}${key}`;
  return removeSessionStorageItem(storageKey);
}

export function recordErrorToRecoveryState(key: string, error: Error): void {
  const storageKey = `${STORAGE_KEY_PREFIX}${key}`;
  const existingRaw = window.sessionStorage.getItem(storageKey);
  
  if (!existingRaw) return;

  try {
    const existingData = JSON.parse(existingRaw);
    const updatedData = {
      ...existingData,
      metadata: {
        ...existingData.metadata,
        errorAt: Date.now(),
        errorMessage: error.message,
      },
    };
    window.sessionStorage.setItem(storageKey, JSON.stringify(updatedData));
  } catch {
    // 忽略错误
  }
}

export default useErrorRecovery;

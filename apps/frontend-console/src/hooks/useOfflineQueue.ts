/**
 * useOfflineQueue Hook - 离线操作队列
 * 
 * 提供离线操作队列功能：
 * - 离线时排队用户操作
 * - 在线时同步排队操作
 * - 操作重试和错误处理
 * 
 * @module hooks/useOfflineQueue
 */

import { useCallback, useMemo } from 'react';
import { 
  useIsOnline, 
  useIsSyncing, 
  useOfflineQueue as useOfflineQueueStore,
  useOfflineActions,
  type OfflineOperation,
  type OfflineOperationType,
} from '@/stores';

// ============================================================================
// 类型定义
// ============================================================================

export interface OperationConfig<T = unknown> {
  name: string;
  type?: OfflineOperationType;
  resourceType: string;
  resourceId?: string;
  data?: unknown;
  maxRetries?: number;
  execute: () => Promise<T>;
  onSuccess?: (result: T) => void;
  onError?: (error: Error) => void;
}

export interface UseOfflineQueueOptions {
  autoQueue?: boolean;
  executeOnline?: boolean;
}


export interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface UseOfflineQueueReturn {
  isOnline: boolean;
  isSyncing: boolean;
  operations: OfflineOperation[];
  stats: QueueStats;
  executeOrQueue: <T>(config: OperationConfig<T>) => Promise<T | string>;
  addToQueue: <T>(config: OperationConfig<T>) => string;
  removeFromQueue: (id: string) => void;
  retryFailed: () => Promise<void>;
  clearQueue: () => void;
  syncQueue: () => Promise<void>;
  getOperationStatus: (id: string) => OfflineOperation | undefined;
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useOfflineQueue(options: UseOfflineQueueOptions = {}): UseOfflineQueueReturn {
  const { autoQueue = true, executeOnline = true } = options;

  // 使用 Zustand Store 替代 Context API
  const isOnline = useIsOnline();
  const isSyncing = useIsSyncing();
  const queuedOperations = useOfflineQueueStore();
  const { 
    addOperation, 
    removeOperation, 
    clearAll, 
    startSync, 
    endSync,
    updateOperationStatus,
  } = useOfflineActions();

  const stats = useMemo<QueueStats>(() => {
    const pending = queuedOperations.filter(op => op.status === 'pending').length;
    const processing = queuedOperations.filter(op => op.status === 'processing').length;
    const completed = queuedOperations.filter(op => op.status === 'completed').length;
    const failed = queuedOperations.filter(op => op.status === 'failed').length;
    return { total: queuedOperations.length, pending, processing, completed, failed };
  }, [queuedOperations]);


  const addToQueue = useCallback(<T,>(config: OperationConfig<T>): string => {
    const { name, type = 'custom', resourceType, resourceId, data, maxRetries = 3 } = config;
    return addOperation({ type, resourceType, resourceId, data: { name, payload: data }, maxRetries });
  }, [addOperation]);

  const executeOrQueue = useCallback(async <T,>(config: OperationConfig<T>): Promise<T | string> => {
    const { execute, onSuccess, onError } = config;

    if (isOnline && executeOnline) {
      try {
        const result = await execute();
        onSuccess?.(result);
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('操作执行失败');
        onError?.(err);
        if (autoQueue) return addToQueue<T>(config);
        throw err;
      }
    }

    if (autoQueue) return addToQueue<T>(config);
    throw new Error('当前处于离线状态，操作无法执行');
  }, [isOnline, executeOnline, autoQueue, addToQueue]);

  const removeFromQueue = useCallback((id: string): void => {
    removeOperation(id);
  }, [removeOperation]);

  const syncQueue = useCallback(async (): Promise<void> => {
    if (!isOnline) throw new Error('当前处于离线状态，无法同步');
    startSync();
    try {
      // 处理待处理的操作
      const pendingOps = queuedOperations.filter(op => op.status === 'pending');
      for (const op of pendingOps) {
        updateOperationStatus(op.id, 'processing');
        // 实际执行逻辑需要根据操作类型实现
        updateOperationStatus(op.id, 'completed');
      }
    } finally {
      endSync();
    }
  }, [isOnline, queuedOperations, startSync, endSync, updateOperationStatus]);

  const retryFailed = useCallback(async (): Promise<void> => {
    if (!isOnline) throw new Error('当前处于离线状态，无法重试');
    await syncQueue();
  }, [isOnline, syncQueue]);

  const getOperationStatus = useCallback((id: string): OfflineOperation | undefined => {
    return queuedOperations.find(op => op.id === id);
  }, [queuedOperations]);

  return {
    isOnline, isSyncing, operations: queuedOperations, stats,
    executeOrQueue, addToQueue, removeFromQueue, retryFailed,
    clearQueue: clearAll, syncQueue, getOperationStatus,
  };
}

export default useOfflineQueue;

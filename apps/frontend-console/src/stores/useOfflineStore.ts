/**
 * 离线状态管理 Store
 * 
 * 使用 Zustand 替代 OfflineContext，管理离线状态和离线队列
 * 
 * @module stores/useOfflineStore
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ID } from '@/types/common';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 离线操作类型
 */
export type OfflineOperationType = 'create' | 'update' | 'delete' | 'custom';

/**
 * 离线操作状态
 */
export type OfflineOperationStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * 离线操作
 */
export interface OfflineOperation {
  /** 操作 ID */
  id: ID;
  /** 操作类型 */
  type: OfflineOperationType;
  /** 资源类型（如 'log', 'alert', 'user'） */
  resourceType: string;
  /** 资源 ID */
  resourceId?: ID;
  /** 操作数据 */
  data: unknown;
  /** 创建时间 */
  createdAt: number;
  /** 重试次数 */
  retryCount: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 状态 */
  status: OfflineOperationStatus;
  /** 错误信息 */
  error?: string;
}

/**
 * 离线状态接口
 */
export interface OfflineState {
  /** 是否在线 */
  isOnline: boolean;
  /** 离线操作队列 */
  queue: OfflineOperation[];
  /** 是否正在同步 */
  isSyncing: boolean;
  /** 上次同步时间 */
  lastSyncAt: number | null;
}

/**
 * 离线操作接口
 */
export interface OfflineActions {
  /** 设置在线状态 */
  setOnline: (isOnline: boolean) => void;
  /** 添加离线操作 */
  addOperation: (operation: Omit<OfflineOperation, 'id' | 'createdAt' | 'retryCount' | 'status'>) => string;
  /** 移除操作 */
  removeOperation: (id: ID) => void;
  /** 更新操作状态 */
  updateOperationStatus: (id: ID, status: OfflineOperationStatus, error?: string) => void;
  /** 增加重试次数 */
  incrementRetry: (id: ID) => void;
  /** 清除已完成的操作 */
  clearCompleted: () => void;
  /** 清除所有操作 */
  clearAll: () => void;
  /** 开始同步 */
  startSync: () => void;
  /** 结束同步 */
  endSync: () => void;
  /** 获取待处理操作数量 */
  getPendingCount: () => number;
}

/**
 * 完整的离线 Store 类型
 */
export type OfflineStore = OfflineState & OfflineActions;

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `offline-op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// 存储键名
// ============================================================================

const OFFLINE_STORAGE_KEY = 'nexuslog-offline';

// ============================================================================
// Store 实现
// ============================================================================

/**
 * 离线状态管理 Store
 * 
 * @example
 * ```tsx
 * const { isOnline, queue, addOperation, startSync } = useOfflineStore();
 * 
 * // 添加离线操作
 * addOperation({
 *   type: 'create',
 *   resourceType: 'alert',
 *   data: alertData,
 *   maxRetries: 3,
 * });
 * 
 * // 检查在线状态
 * if (isOnline) {
 *   startSync();
 * }
 * ```
 */
export const useOfflineStore = create<OfflineStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      queue: [],
      isSyncing: false,
      lastSyncAt: null,

      /**
       * 设置在线状态
       */
      setOnline: (isOnline: boolean) => {
        set({ isOnline });
      },

      /**
       * 添加离线操作
       */
      addOperation: (operation) => {
        const id = generateId();
        const newOperation: OfflineOperation = {
          ...operation,
          id,
          createdAt: Date.now(),
          retryCount: 0,
          status: 'pending',
        };

        set(state => ({
          queue: [...state.queue, newOperation],
        }));

        return id;
      },

      /**
       * 移除操作
       */
      removeOperation: (id: ID) => {
        set(state => ({
          queue: state.queue.filter(op => op.id !== id),
        }));
      },

      /**
       * 更新操作状态
       */
      updateOperationStatus: (id: ID, status: OfflineOperationStatus, error?: string) => {
        set(state => ({
          queue: state.queue.map(op =>
            op.id === id ? { ...op, status, error } : op
          ),
        }));
      },

      /**
       * 增加重试次数
       */
      incrementRetry: (id: ID) => {
        set(state => ({
          queue: state.queue.map(op =>
            op.id === id ? { ...op, retryCount: op.retryCount + 1 } : op
          ),
        }));
      },

      /**
       * 清除已完成的操作
       */
      clearCompleted: () => {
        set(state => ({
          queue: state.queue.filter(op => op.status !== 'completed'),
        }));
      },

      /**
       * 清除所有操作
       */
      clearAll: () => {
        set({ queue: [] });
      },

      /**
       * 开始同步
       */
      startSync: () => {
        set({ isSyncing: true });
      },

      /**
       * 结束同步
       */
      endSync: () => {
        set({
          isSyncing: false,
          lastSyncAt: Date.now(),
        });
      },

      /**
       * 获取待处理操作数量
       */
      getPendingCount: () => {
        return get().queue.filter(op => op.status === 'pending').length;
      },
    }),
    {
      name: OFFLINE_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // 只持久化队列，不持久化同步状态
      partialize: (state) => ({
        queue: state.queue,
      }),
    }
  )
);

// ============================================================================
// 网络状态监听
// ============================================================================

/**
 * 设置网络状态监听器
 */
function setupNetworkListener() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.addEventListener('online', () => {
      useOfflineStore.getState().setOnline(true);
    });

    window.addEventListener('offline', () => {
      useOfflineStore.getState().setOnline(false);
    });
  } catch {
    // 在测试环境中忽略
  }
}

// 延迟初始化监听器
if (typeof window !== 'undefined') {
  setTimeout(setupNetworkListener, 0);
}

// ============================================================================
// 选择器 Hooks
// ============================================================================

/**
 * 获取在线状态
 */
export const useIsOnline = () => useOfflineStore(state => state.isOnline);

/**
 * 获取离线队列
 */
export const useOfflineQueue = () => useOfflineStore(state => state.queue);

/**
 * 获取待处理操作
 */
export const usePendingOperations = () => 
  useOfflineStore(state => state.queue.filter(op => op.status === 'pending'));

/**
 * 获取失败操作
 */
export const useFailedOperations = () =>
  useOfflineStore(state => state.queue.filter(op => op.status === 'failed'));

/**
 * 获取同步状态
 */
export const useIsSyncing = () => useOfflineStore(state => state.isSyncing);

/**
 * 获取离线操作
 */
export const useOfflineActions = () => useOfflineStore(state => ({
  addOperation: state.addOperation,
  removeOperation: state.removeOperation,
  updateOperationStatus: state.updateOperationStatus,
  incrementRetry: state.incrementRetry,
  clearCompleted: state.clearCompleted,
  clearAll: state.clearAll,
  startSync: state.startSync,
  endSync: state.endSync,
}));

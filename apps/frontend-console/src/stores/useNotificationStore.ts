/**
 * 通知状态管理 Store
 * 
 * 使用 Zustand 替代 NotificationContext，管理应用通知
 * 集成 Ant Design message/notification API
 * 
 * @module stores/useNotificationStore
 */

import { create } from 'zustand';
import { message, notification as antdNotification } from 'antd';
import type { 
  Notification, 
  NotificationType, 
  CreateNotificationParams,
} from '@/types/notification';
import type { ID } from '@/types/common';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 通知状态接口
 */
export interface NotificationState {
  /** 通知列表 */
  notifications: Notification[];
  /** 未读通知数量 */
  unreadCount: number;
}

/**
 * 通知操作接口
 */
export interface NotificationActions {
  /** 添加通知 */
  addNotification: (params: CreateNotificationParams) => string;
  /** 移除通知 */
  removeNotification: (id: ID) => void;
  /** 标记为已读 */
  markAsRead: (id: ID) => void;
  /** 标记全部为已读 */
  markAllAsRead: () => void;
  /** 清除所有通知 */
  clearAll: () => void;
  /** Toast 快捷方法 */
  toast: {
    info: (title: string, message?: string) => string;
    success: (title: string, message?: string) => string;
    warning: (title: string, message?: string) => string;
    error: (title: string, message?: string) => string;
  };
  /** 显示 Ant Design 通知 */
  showAntdNotification: (params: CreateNotificationParams) => void;
}

/**
 * 完整的通知 Store 类型
 */
export type NotificationStore = NotificationState & NotificationActions;

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 计算未读数量
 */
function calculateUnreadCount(notifications: Notification[]): number {
  return notifications.filter(n => !n.read).length;
}

/**
 * 获取 Ant Design 通知类型
 */
function getAntdNotificationType(type: NotificationType): 'info' | 'success' | 'warning' | 'error' {
  return type;
}

// ============================================================================
// Store 实现
// ============================================================================

/**
 * 通知状态管理 Store
 * 
 * @example
 * ```tsx
 * // 在组件中使用
 * const { notifications, unreadCount, addNotification, toast } = useNotificationStore();
 * 
 * // 添加通知
 * addNotification({
 *   type: 'success',
 *   title: '操作成功',
 *   message: '数据已保存',
 * });
 * 
 * // 使用 toast 快捷方法
 * toast.success('保存成功');
 * toast.error('操作失败', '请稍后重试');
 * ```
 */
export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  // 初始状态
  notifications: [],
  unreadCount: 0,

  /**
   * 添加通知
   * 
   * @param params - 通知参数
   * @returns 通知 ID
   */
  addNotification: (params: CreateNotificationParams) => {
    const id = generateId();
    const notification: Notification = {
      id,
      type: params.type,
      title: params.title,
      message: params.message,
      timestamp: Date.now(),
      read: false,
      actions: params.actions,
      link: params.link,
      category: params.category,
      source: params.source,
      metadata: params.metadata,
    };

    set(state => {
      const newNotifications = [notification, ...state.notifications];
      return {
        notifications: newNotifications,
        unreadCount: calculateUnreadCount(newNotifications),
      };
    });

    // 同时显示 Ant Design 通知（如果指定了 duration）
    if (params.duration !== 0) {
      get().showAntdNotification(params);
    }

    return id;
  },

  /**
   * 移除通知
   * 
   * @param id - 通知 ID
   */
  removeNotification: (id: ID) => {
    set(state => {
      const newNotifications = state.notifications.filter(n => n.id !== id);
      return {
        notifications: newNotifications,
        unreadCount: calculateUnreadCount(newNotifications),
      };
    });
  },

  /**
   * 标记为已读
   * 
   * @param id - 通知 ID
   */
  markAsRead: (id: ID) => {
    set(state => {
      const newNotifications = state.notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
      );
      return {
        notifications: newNotifications,
        unreadCount: calculateUnreadCount(newNotifications),
      };
    });
  },

  /**
   * 标记全部为已读
   */
  markAllAsRead: () => {
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  /**
   * 清除所有通知
   */
  clearAll: () => {
    set({
      notifications: [],
      unreadCount: 0,
    });
  },

  /**
   * Toast 快捷方法
   * 使用 Ant Design message API
   */
  toast: {
    info: (title: string, msg?: string) => {
      const id = generateId();
      message.info(msg ? `${title}: ${msg}` : title);
      
      // 同时添加到通知列表
      get().addNotification({
        type: 'info',
        title,
        message: msg || title,
        duration: 0, // 不重复显示 Ant Design 通知
      });
      
      return id;
    },
    
    success: (title: string, msg?: string) => {
      const id = generateId();
      message.success(msg ? `${title}: ${msg}` : title);
      
      get().addNotification({
        type: 'success',
        title,
        message: msg || title,
        duration: 0,
      });
      
      return id;
    },
    
    warning: (title: string, msg?: string) => {
      const id = generateId();
      message.warning(msg ? `${title}: ${msg}` : title);
      
      get().addNotification({
        type: 'warning',
        title,
        message: msg || title,
        duration: 0,
      });
      
      return id;
    },
    
    error: (title: string, msg?: string) => {
      const id = generateId();
      message.error(msg ? `${title}: ${msg}` : title);
      
      get().addNotification({
        type: 'error',
        title,
        message: msg || title,
        duration: 0,
      });
      
      return id;
    },
  },

  /**
   * 显示 Ant Design 通知
   * 
   * @param params - 通知参数
   */
  showAntdNotification: (params: CreateNotificationParams) => {
    const type = getAntdNotificationType(params.type);
    const duration = params.duration ?? 4.5; // Ant Design 默认 4.5 秒
    
    antdNotification[type]({
      message: params.title,
      description: params.message,
      duration: duration / 1000, // Ant Design 使用秒
      placement: 'topRight',
    });
  },
}));

// ============================================================================
// 选择器 Hooks（用于性能优化）
// ============================================================================

/**
 * 获取通知列表
 */
export const useNotifications = () => useNotificationStore(state => state.notifications);

/**
 * 获取未读数量
 */
export const useUnreadCount = () => useNotificationStore(state => state.unreadCount);

/**
 * 获取 Toast 方法
 */
export const useToast = () => useNotificationStore(state => state.toast);

/**
 * 获取通知操作
 */
export const useNotificationActions = () => useNotificationStore(state => ({
  addNotification: state.addNotification,
  removeNotification: state.removeNotification,
  markAsRead: state.markAsRead,
  markAllAsRead: state.markAllAsRead,
  clearAll: state.clearAll,
}));

/**
 * 获取未读通知
 */
export const useUnreadNotifications = () => 
  useNotificationStore(state => state.notifications.filter(n => !n.read));

/**
 * 按类型获取通知
 */
export const useNotificationsByType = (type: NotificationType) =>
  useNotificationStore(state => state.notifications.filter(n => n.type === type));

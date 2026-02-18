/**
 * 通知相关类型定义
 */

import type { ID, Timestamp } from './common';

// ============================================================================
// 通知类型
// ============================================================================

/**
 * 通知类型
 */
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

/**
 * 通知类型配置
 */
export const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, { icon: string; color: string }> = {
  info: { icon: 'info', color: 'info' },
  success: { icon: 'check_circle', color: 'success' },
  warning: { icon: 'warning', color: 'warning' },
  error: { icon: 'error', color: 'danger' },
};

// ============================================================================
// 通知
// ============================================================================

/**
 * 通知动作
 */
export interface NotificationAction {
  label: string;
  action: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

/**
 * 通知
 */
export interface Notification {
  id: ID;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Timestamp;
  read: boolean;
  actions?: NotificationAction[];
  link?: string;
  category?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 创建通知参数
 */
export interface CreateNotificationParams {
  type: NotificationType;
  title: string;
  message: string;
  actions?: NotificationAction[];
  link?: string;
  category?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  duration?: number;
}

// ============================================================================
// Toast 通知
// ============================================================================

/**
 * Toast 位置
 */
export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/**
 * Toast 配置
 */
export interface ToastConfig {
  position: ToastPosition;
  duration: number;
  maxCount: number;
  pauseOnHover: boolean;
  closeOnClick: boolean;
}

/**
 * 默认 Toast 配置
 */
export const DEFAULT_TOAST_CONFIG: ToastConfig = {
  position: 'top-right',
  duration: 5000,
  maxCount: 5,
  pauseOnHover: true,
  closeOnClick: true,
};

// ============================================================================
// 通知上下文
// ============================================================================

/**
 * 通知上下文值
 */
export interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (params: CreateNotificationParams) => string;
  removeNotification: (id: ID) => void;
  markAsRead: (id: ID) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  // Toast 快捷方法
  toast: {
    info: (title: string, message?: string) => string;
    success: (title: string, message?: string) => string;
    warning: (title: string, message?: string) => string;
    error: (title: string, message?: string) => string;
  };
}

// ============================================================================
// 通知过滤
// ============================================================================

/**
 * 通知过滤器
 */
export interface NotificationFilter {
  type?: NotificationType[];
  read?: boolean;
  category?: string;
  startDate?: Timestamp;
  endDate?: Timestamp;
}

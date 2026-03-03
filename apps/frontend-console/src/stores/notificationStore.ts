import { create } from 'zustand';
import { createClientId } from '../utils/id';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  timestamp: number;
}

export interface NotificationState {
  unreadCount: number;
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'timestamp'>) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  unreadCount: 0,
  notifications: [],
  addNotification: (notification) =>
    set((state) => {
      const newNotification: Notification = {
        ...notification,
        // 非安全上下文下 randomUUID 可能不可用，统一走兼容生成器
        id: createClientId('notice'),
        read: false,
        timestamp: Date.now(),
      };
      const notifications = [newNotification, ...state.notifications];
      return { notifications, unreadCount: state.unreadCount + 1 };
    }),
  markAsRead: (id) =>
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      );
      const unreadCount = notifications.filter((n) => !n.read).length;
      return { notifications, unreadCount };
    }),
  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}));

import { create } from 'zustand';

export interface Alert {
  id: string;
  title: string;
  message: string;
  level: 'critical' | 'warning' | 'info';
  read: boolean;
  timestamp: number;
}

export interface AlertState {
  unreadCount: number;
  alerts: Alert[];
  addAlert: (alert: Omit<Alert, 'id' | 'read' | 'timestamp'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

export const useAlertStore = create<AlertState>()((set) => ({
  unreadCount: 3,
  alerts: [
    { id: '1', title: '磁盘空间告警', message: 'Node-03 磁盘使用率超过 85%', level: 'warning', read: false, timestamp: Date.now() - 60000 },
    { id: '2', title: '异常错误率', message: 'payment-service 错误率飙升至 12.3%', level: 'critical', read: false, timestamp: Date.now() - 120000 },
    { id: '3', title: '连接超时', message: 'ES 集群 node-05 响应超时 3 次', level: 'critical', read: false, timestamp: Date.now() - 300000 },
  ],
  addAlert: (alert) =>
    set((state) => {
      const newAlert: Alert = {
        ...alert,
        id: crypto.randomUUID(),
        read: false,
        timestamp: Date.now(),
      };
      return { alerts: [newAlert, ...state.alerts], unreadCount: state.unreadCount + 1 };
    }),
  markAsRead: (id) =>
    set((state) => {
      const alerts = state.alerts.map((a) => (a.id === id ? { ...a, read: true } : a));
      return { alerts, unreadCount: alerts.filter((a) => !a.read).length };
    }),
  markAllAsRead: () =>
    set((state) => ({
      alerts: state.alerts.map((a) => ({ ...a, read: true })),
      unreadCount: 0,
    })),
  clearAll: () => set({ alerts: [], unreadCount: 0 }),
}));

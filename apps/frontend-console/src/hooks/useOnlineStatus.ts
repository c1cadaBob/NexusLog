/**
 * useOnlineStatus Hook - 网络状态检测
 * 
 * 提供网络在线/离线状态检测功能
 * 
 * @module hooks/useOnlineStatus
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// 类型定义
// ============================================================================

export type NetworkStatus = 'online' | 'offline';

export interface NetworkStatusInfo {
  isOnline: boolean;
  status: NetworkStatus;
  lastOnlineAt: Date | null;
  lastOfflineAt: Date | null;
  offlineDuration: number | null;
}

export interface UseOnlineStatusOptions {
  onOnline?: () => void;
  onOffline?: () => void;
  onStatusChange?: (status: NetworkStatus, info: NetworkStatusInfo) => void;
  checkOnMount?: boolean;
}

export interface UseOnlineStatusReturn extends NetworkStatusInfo {
  checkStatus: () => boolean;
}


// ============================================================================
// Hook 实现
// ============================================================================

export function useOnlineStatus(options: UseOnlineStatusOptions = {}): UseOnlineStatusReturn {
  const { onOnline, onOffline, onStatusChange, checkOnMount = true } = options;

  const getInitialStatus = (): boolean => {
    if (typeof navigator !== 'undefined') return navigator.onLine;
    return true;
  };

  const [isOnline, setIsOnline] = useState<boolean>(getInitialStatus);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(getInitialStatus() ? new Date() : null);
  const [lastOfflineAt, setLastOfflineAt] = useState<Date | null>(null);

  const callbacksRef = useRef({ onOnline, onOffline, onStatusChange });
  callbacksRef.current = { onOnline, onOffline, onStatusChange };

  const getOfflineDuration = useCallback((): number | null => {
    if (isOnline || !lastOfflineAt) return null;
    return Date.now() - lastOfflineAt.getTime();
  }, [isOnline, lastOfflineAt]);

  const handleOnline = useCallback(() => {
    const now = new Date();
    setIsOnline(true);
    setLastOnlineAt(now);
    const info: NetworkStatusInfo = { isOnline: true, status: 'online', lastOnlineAt: now, lastOfflineAt, offlineDuration: lastOfflineAt ? now.getTime() - lastOfflineAt.getTime() : null };
    callbacksRef.current.onOnline?.();
    callbacksRef.current.onStatusChange?.('online', info);
  }, [lastOfflineAt]);

  const handleOffline = useCallback(() => {
    const now = new Date();
    setIsOnline(false);
    setLastOfflineAt(now);
    const info: NetworkStatusInfo = { isOnline: false, status: 'offline', lastOnlineAt, lastOfflineAt: now, offlineDuration: 0 };
    callbacksRef.current.onOffline?.();
    callbacksRef.current.onStatusChange?.('offline', info);
  }, [lastOnlineAt]);

  const checkStatus = useCallback((): boolean => {
    if (typeof navigator === 'undefined') return true;
    const currentStatus = navigator.onLine;
    if (currentStatus !== isOnline) {
      if (currentStatus) handleOnline();
      else handleOffline();
    }
    return currentStatus;
  }, [isOnline, handleOnline, handleOffline]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (checkOnMount) checkStatus();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline, checkOnMount, checkStatus]);

  return { isOnline, status: isOnline ? 'online' : 'offline', lastOnlineAt, lastOfflineAt, offlineDuration: getOfflineDuration(), checkStatus };
}

export default useOnlineStatus;

/**
 * 不活动自动登出 Hook
 * 检测用户不活动状态，在超时前显示警告，超时后自动登出
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// 常量
// ============================================================================

const DEFAULT_IDLE_TIMEOUT = 15 * 60 * 1000;
const DEFAULT_WARNING_TIME = 2 * 60 * 1000;

const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'wheel',
] as const;

const LAST_ACTIVITY_KEY = 'nexuslog-last-activity';

// ============================================================================
// 类型
// ============================================================================

export interface IdleTimeoutOptions {
  timeout?: number;
  warningTime?: number;
  enabled?: boolean;
  onLogout: () => void;
  onWarning?: (remainingTime: number) => void;
  onActivityResume?: () => void;
}

export interface IdleTimeoutState {
  isIdle: boolean;
  showWarning: boolean;
  remainingTime: number;
  resetTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
}

// ============================================================================
// 工具函数
// ============================================================================

function getLastActivity(): number {
  if (typeof window === 'undefined') return Date.now();
  try {
    const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
    return stored ? parseInt(stored, 10) : Date.now();
  } catch {
    return Date.now();
  }
}

function setLastActivity(time: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, time.toString());
  } catch {
    // 忽略存储错误
  }
}

function clearLastActivity(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {
    // 忽略存储错误
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useIdleTimeout(options: IdleTimeoutOptions): IdleTimeoutState {
  const {
    timeout = DEFAULT_IDLE_TIMEOUT,
    warningTime = DEFAULT_WARNING_TIME,
    enabled = true,
    onLogout,
    onWarning,
    onActivityResume,
  } = options;

  const [isIdle, setIsIdle] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(timeout);
  const [isPaused, setIsPaused] = useState(false);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const clearAllTimers = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const performLogout = useCallback(() => {
    clearAllTimers();
    setIsIdle(true);
    setShowWarning(false);
    clearLastActivity();
    onLogout();
  }, [clearAllTimers, onLogout]);

  const startWarningCountdown = useCallback(() => {
    setShowWarning(true);
    setRemainingTime(warningTime);
    
    onWarning?.(warningTime);

    countdownIntervalRef.current = setInterval(() => {
      setRemainingTime((prev) => {
        const newTime = prev - 1000;
        if (newTime <= 0) {
          performLogout();
          return 0;
        }
        return newTime;
      });
    }, 1000);

    idleTimerRef.current = setTimeout(() => {
      performLogout();
    }, warningTime);
  }, [warningTime, onWarning, performLogout]);

  const resetTimer = useCallback(() => {
    if (!enabled || isPaused) return;

    clearAllTimers();

    const now = Date.now();
    lastActivityRef.current = now;
    setLastActivity(now);

    setIsIdle(false);
    setShowWarning(false);
    setRemainingTime(timeout);

    if (showWarning) {
      onActivityResume?.();
    }

    const warningDelay = timeout - warningTime;
    if (warningDelay > 0) {
      warningTimerRef.current = setTimeout(() => {
        startWarningCountdown();
      }, warningDelay);
    } else {
      startWarningCountdown();
    }
  }, [enabled, isPaused, timeout, warningTime, showWarning, clearAllTimers, startWarningCountdown, onActivityResume]);

  const pauseTimer = useCallback(() => {
    setIsPaused(true);
    clearAllTimers();
  }, [clearAllTimers]);

  const resumeTimer = useCallback(() => {
    setIsPaused(false);
    resetTimer();
  }, [resetTimer]);

  const handleActivity = useCallback(() => {
    if (!enabled || isPaused) return;
    resetTimer();
  }, [enabled, isPaused, resetTimer]);

  useEffect(() => {
    if (!enabled) {
      clearAllTimers();
      return;
    }

    const lastActivity = getLastActivity();
    const timeSinceLastActivity = Date.now() - lastActivity;

    if (timeSinceLastActivity >= timeout) {
      performLogout();
      return;
    }

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const lastActivity = getLastActivity();
        const timeSinceLastActivity = Date.now() - lastActivity;

        if (timeSinceLastActivity >= timeout) {
          performLogout();
        } else if (timeSinceLastActivity >= timeout - warningTime) {
          startWarningCountdown();
        } else {
          resetTimer();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === LAST_ACTIVITY_KEY && event.newValue) {
        lastActivityRef.current = parseInt(event.newValue, 10);
        resetTimer();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    resetTimer();

    return () => {
      clearAllTimers();
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [enabled, timeout, warningTime, handleActivity, resetTimer, performLogout, startWarningCountdown, clearAllTimers]);

  return {
    isIdle,
    showWarning,
    remainingTime,
    resetTimer,
    pauseTimer,
    resumeTimer,
  };
}

export const IDLE_TIMEOUT_CONSTANTS = {
  DEFAULT_IDLE_TIMEOUT,
  DEFAULT_WARNING_TIME,
  ACTIVITY_EVENTS,
  LAST_ACTIVITY_KEY,
};

export default useIdleTimeout;

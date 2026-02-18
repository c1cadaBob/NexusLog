/**
 * usePullToRefresh Hook
 * 
 * 实现下拉刷新功能
 * 
 * @module hooks/usePullToRefresh
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ============================================================================
// 类型定义
// ============================================================================

export interface UsePullToRefreshOptions {
  threshold?: number;
  maxPullDistance?: number;
  onRefresh: () => Promise<void>;
  disabled?: boolean;
}

export interface UsePullToRefreshReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  pullDistance: number;
  isRefreshing: boolean;
  canRelease: boolean;
  indicatorStyle: React.CSSProperties;
}

// ============================================================================
// Hook 实现
// ============================================================================

export function usePullToRefresh({
  threshold = 80,
  maxPullDistance = 150,
  onRefresh,
  disabled = false,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);

  const canRelease = pullDistance >= threshold && !isRefreshing;


  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;
    const touch = e.touches[0];
    if (touch) {
      startY.current = touch.clientY;
      setIsPulling(true);
    }
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling || disabled || isRefreshing) return;
    const container = containerRef.current;
    if (!container) return;
    const touch = e.touches[0];
    if (touch) {
      currentY.current = touch.clientY;
      const diff = currentY.current - startY.current;
      if (diff > 0 && container.scrollTop === 0) {
        const dampedDistance = Math.min(diff * 0.5, maxPullDistance);
        setPullDistance(dampedDistance);
        if (dampedDistance > 10) e.preventDefault();
      }
    }
  }, [isPulling, disabled, isRefreshing, maxPullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;
    setIsPulling(false);
    if (canRelease && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold);
      try { await onRefresh(); } finally { setIsRefreshing(false); setPullDistance(0); }
    } else {
      setPullDistance(0);
    }
  }, [isPulling, canRelease, isRefreshing, onRefresh, threshold]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled) return;
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, disabled]);

  const indicatorStyle: React.CSSProperties = {
    transform: `translateY(${pullDistance}px)`,
    transition: isPulling ? 'none' : 'transform 0.3s ease-out',
  };

  return { containerRef, pullDistance, isRefreshing, canRelease, indicatorStyle };
}

export default usePullToRefresh;

/**
 * useSwipeGesture Hook
 * 
 * 实现滑动手势检测
 * 
 * @module hooks/useSwipeGesture
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ============================================================================
// 类型定义
// ============================================================================

export type SwipeDirection = 'left' | 'right' | 'up' | 'down' | null;

export interface SwipeState {
  direction: SwipeDirection;
  deltaX: number;
  deltaY: number;
  isSwiping: boolean;
}

export interface UseSwipeGestureOptions {
  threshold?: number;
  onSwipe?: (direction: SwipeDirection) => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  disabled?: boolean;
  preventDefault?: boolean;
}

export interface UseSwipeGestureReturn {
  ref: React.RefObject<HTMLElement>;
  swipeState: SwipeState;
  reset: () => void;
}


// ============================================================================
// Hook 实现
// ============================================================================

export function useSwipeGesture({
  threshold = 50,
  onSwipe,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  disabled = false,
  preventDefault = false,
}: UseSwipeGestureOptions = {}): UseSwipeGestureReturn {
  const ref = useRef<HTMLElement>(null);
  const [swipeState, setSwipeState] = useState<SwipeState>({ direction: null, deltaX: 0, deltaY: 0, isSwiping: false });
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);

  const reset = useCallback(() => {
    setSwipeState({ direction: null, deltaX: 0, deltaY: 0, isSwiping: false });
  }, []);

  const getDirection = useCallback((deltaX: number, deltaY: number): SwipeDirection => {
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (absX < threshold && absY < threshold) return null;
    if (absX > absY) return deltaX > 0 ? 'right' : 'left';
    return deltaY > 0 ? 'down' : 'up';
  }, [threshold]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled) return;
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    startTime.current = Date.now();
    setSwipeState(prev => ({ ...prev, isSwiping: true, deltaX: 0, deltaY: 0 }));
  }, [disabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (disabled || !swipeState.isSwiping) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - startX.current;
    const deltaY = touch.clientY - startY.current;
    const direction = getDirection(deltaX, deltaY);
    if (preventDefault && direction) e.preventDefault();
    setSwipeState(prev => ({ ...prev, deltaX, deltaY, direction }));
  }, [disabled, swipeState.isSwiping, getDirection, preventDefault]);

  const handleTouchEnd = useCallback(() => {
    if (disabled || !swipeState.isSwiping) return;
    const { direction, deltaX, deltaY } = swipeState;
    const duration = Date.now() - startTime.current;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const velocity = Math.max(absX, absY) / duration;
    const isValidSwipe = (absX >= threshold || absY >= threshold) || velocity > 0.5;

    if (isValidSwipe && direction) {
      onSwipe?.(direction);
      if (direction === 'left') onSwipeLeft?.();
      if (direction === 'right') onSwipeRight?.();
      if (direction === 'up') onSwipeUp?.();
      if (direction === 'down') onSwipeDown?.();
    }
    reset();
  }, [disabled, swipeState, threshold, onSwipe, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, reset]);

  useEffect(() => {
    const element = ref.current;
    if (!element || disabled) return;
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: !preventDefault });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, disabled, preventDefault]);

  return { ref, swipeState, reset };
}

export default useSwipeGesture;

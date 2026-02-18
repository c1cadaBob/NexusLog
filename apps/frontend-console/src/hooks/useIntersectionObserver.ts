/**
 * useIntersectionObserver Hook - 用于无限滚动和懒加载的自定义 Hook
 * 
 * 监听元素与视口的交叉状态
 */

import { useState, useEffect, useRef, type RefObject } from 'react';

// ============================================================================
// 类型定义
// ============================================================================

export interface UseIntersectionObserverOptions {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
  triggerOnce?: boolean;
  enabled?: boolean;
}

export interface UseIntersectionObserverReturn {
  ref: RefObject<Element | null>;
  entry: IntersectionObserverEntry | null;
  isIntersecting: boolean;
  hasIntersected: boolean;
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {}
): UseIntersectionObserverReturn {
  const {
    root = null,
    rootMargin = '0px',
    threshold = 0,
    triggerOnce = false,
    enabled = true,
  } = options;

  const targetRef = useRef<Element | null>(null);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const [hasIntersected, setHasIntersected] = useState(false);

  const isIntersecting = entry?.isIntersecting ?? false;

  useEffect(() => {
    if (!enabled || !targetRef.current) {
      return;
    }

    if (triggerOnce && hasIntersected) {
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      console.warn('IntersectionObserver is not supported in this browser');
      return;
    }

    const observer = new IntersectionObserver(
      ([observerEntry]) => {
        if (observerEntry) {
          setEntry(observerEntry);
          
          if (observerEntry.isIntersecting) {
            setHasIntersected(true);
            
            if (triggerOnce && targetRef.current) {
              observer.unobserve(targetRef.current);
            }
          }
        }
      },
      {
        root,
        rootMargin,
        threshold,
      }
    );

    observer.observe(targetRef.current);

    return () => {
      observer.disconnect();
    };
  }, [root, rootMargin, threshold, triggerOnce, enabled, hasIntersected]);

  return {
    ref: targetRef,
    entry,
    isIntersecting,
    hasIntersected,
  };
}

// ============================================================================
// useIntersectionObserverCallback - 带回调的版本
// ============================================================================

export function useIntersectionObserverCallback(
  callback: (entry: IntersectionObserverEntry) => void,
  options: Omit<UseIntersectionObserverOptions, 'triggerOnce'> & { triggerOnce?: boolean } = {}
): RefObject<Element | null> {
  const {
    root = null,
    rootMargin = '0px',
    threshold = 0,
    triggerOnce = false,
    enabled = true,
  } = options;

  const targetRef = useRef<Element | null>(null);
  const callbackRef = useRef(callback);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || !targetRef.current) {
      return;
    }

    if (triggerOnce && hasTriggeredRef.current) {
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          callbackRef.current(entry);
          
          if (entry.isIntersecting && triggerOnce) {
            hasTriggeredRef.current = true;
            if (targetRef.current) {
              observer.unobserve(targetRef.current);
            }
          }
        }
      },
      {
        root,
        rootMargin,
        threshold,
      }
    );

    observer.observe(targetRef.current);

    return () => {
      observer.disconnect();
    };
  }, [root, rootMargin, threshold, triggerOnce, enabled]);

  return targetRef;
}

export default useIntersectionObserver;

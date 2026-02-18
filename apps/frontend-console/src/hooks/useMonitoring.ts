/**
 * 监控 Hook
 * 
 * 提供在 React 组件中使用监控服务的便捷方法
 * 
 * @module hooks/useMonitoring
 */

import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  trackPageView,
  trackEvent,
  trackInteraction,
  trackFeatureUsage,
  captureError,
  addBreadcrumb,
  startMark,
  endMark,
  trackRender,
  type TrackEvent,
  type Breadcrumb,
} from '@/services/monitoring';

// ============================================================================
// usePageTracking - 页面浏览跟踪
// ============================================================================

/**
 * 自动跟踪页面浏览
 */
export function usePageTracking(): void {
  const location = useLocation();

  useEffect(() => {
    trackPageView({
      path: location.pathname,
      title: document.title,
    });

    // 添加导航面包屑
    addBreadcrumb({
      type: 'navigation',
      category: 'navigation',
      message: `导航到 ${location.pathname}`,
      timestamp: Date.now(),
    });
  }, [location.pathname]);
}

// ============================================================================
// useEventTracking - 事件跟踪
// ============================================================================

/**
 * 事件跟踪 Hook
 */
export function useEventTracking() {
  const track = useCallback((event: TrackEvent) => {
    trackEvent(event);
  }, []);

  const trackClick = useCallback((element: string, details?: Record<string, unknown>) => {
    trackInteraction(element, 'click', details);
  }, []);

  const trackSubmit = useCallback((formName: string, details?: Record<string, unknown>) => {
    trackInteraction(formName, 'submit', details);
  }, []);

  const trackFeature = useCallback((
    featureName: string,
    action: string,
    details?: Record<string, unknown>
  ) => {
    trackFeatureUsage(featureName, action, details);
  }, []);

  return {
    track,
    trackClick,
    trackSubmit,
    trackFeature,
  };
}

// ============================================================================
// useErrorTracking - 错误跟踪
// ============================================================================

/**
 * 错误跟踪 Hook
 */
export function useErrorTracking() {
  const capture = useCallback((error: Error, context?: Record<string, unknown>) => {
    captureError(error, context);
  }, []);

  const addCrumb = useCallback((breadcrumb: Omit<Breadcrumb, 'timestamp'>) => {
    addBreadcrumb({
      ...breadcrumb,
      timestamp: Date.now(),
    });
  }, []);

  return {
    captureError: capture,
    addBreadcrumb: addCrumb,
  };
}

// ============================================================================
// usePerformanceTracking - 性能跟踪
// ============================================================================

/**
 * 性能跟踪 Hook
 */
export function usePerformanceTracking(componentName: string) {
  const mountTimeRef = useRef<number>(0);

  useEffect(() => {
    // 记录挂载时间
    mountTimeRef.current = performance.now();
    
    // 跟踪挂载
    trackRender({
      componentName,
      duration: 0,
      type: 'mount',
    });

    return () => {
      // 跟踪卸载
      const duration = performance.now() - mountTimeRef.current;
      trackRender({
        componentName,
        duration,
        type: 'unmount',
      });
    };
  }, [componentName]);

  const trackUpdate = useCallback((updateName?: string) => {
    const name = updateName ? `${componentName}:${updateName}` : componentName;
    startMark(name);
    
    // 在下一帧结束计时
    requestAnimationFrame(() => {
      const duration = endMark(name);
      if (duration !== null) {
        trackRender({
          componentName: name,
          duration,
          type: 'update',
        });
      }
    });
  }, [componentName]);

  return {
    trackUpdate,
  };
}

// ============================================================================
// useMeasure - 测量执行时间
// ============================================================================

/**
 * 测量执行时间 Hook
 */
export function useMeasure() {
  const start = useCallback((name: string) => {
    startMark(name);
  }, []);

  const end = useCallback((name: string): number | null => {
    return endMark(name);
  }, []);

  const measure = useCallback(async <T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> => {
    startMark(name);
    try {
      return await fn();
    } finally {
      endMark(name);
    }
  }, []);

  const measureSync = useCallback(<T>(
    name: string,
    fn: () => T
  ): T => {
    startMark(name);
    try {
      return fn();
    } finally {
      endMark(name);
    }
  }, []);

  return {
    start,
    end,
    measure,
    measureSync,
  };
}

// ============================================================================
// useMonitoring - 综合监控 Hook
// ============================================================================

/**
 * 综合监控 Hook
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { trackClick, captureError, trackUpdate } = useMonitoring('MyComponent');
 *   
 *   const handleClick = () => {
 *     trackClick('submit-button');
 *     // ...
 *   };
 *   
 *   return <button onClick={handleClick}>提交</button>;
 * }
 * ```
 */
export function useMonitoring(componentName?: string) {
  const eventTracking = useEventTracking();
  const errorTracking = useErrorTracking();
  const performanceTracking = componentName 
    ? usePerformanceTracking(componentName)
    : { trackUpdate: () => {} };
  const measure = useMeasure();

  return {
    // 事件跟踪
    ...eventTracking,
    // 错误跟踪
    ...errorTracking,
    // 性能跟踪
    ...performanceTracking,
    // 测量
    ...measure,
  };
}

export default useMonitoring;

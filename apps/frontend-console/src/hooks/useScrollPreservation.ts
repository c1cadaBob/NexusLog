/**
 * useScrollPreservation - 滚动位置保留 Hook
 * 
 * 功能：
 * - 数据刷新前保存滚动位置
 * - 刷新后恢复滚动位置
 * - 支持指定容器元素或 window
 */

import { useCallback, useRef } from 'react';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 滚动位置
 */
export interface ScrollPosition {
  x: number;
  y: number;
}

/**
 * Hook 配置选项
 */
export interface UseScrollPreservationOptions {
  /** 目标容器元素的 ref，不传则使用 window */
  containerRef?: React.RefObject<HTMLElement>;
  /** 恢复滚动位置时的容差（像素），默认 5 */
  tolerance?: number;
  /** 恢复滚动位置的延迟（毫秒），默认 0 */
  restoreDelay?: number;
  /** 滚动行为，默认 'auto' */
  scrollBehavior?: ScrollBehavior;
}

/**
 * Hook 返回值
 */
export interface UseScrollPreservationReturn {
  /** 保存当前滚动位置 */
  saveScrollPosition: () => ScrollPosition;
  /** 恢复滚动位置 */
  restoreScrollPosition: (position?: ScrollPosition) => void;
  /** 获取当前滚动位置 */
  getCurrentScrollPosition: () => ScrollPosition;
  /** 获取上次保存的滚动位置 */
  getSavedScrollPosition: () => ScrollPosition | null;
  /** 包装刷新操作，自动保存和恢复滚动位置 */
  withScrollPreservation: <T>(refreshFn: () => Promise<T> | T) => Promise<T>;
  /** 清除保存的滚动位置 */
  clearSavedPosition: () => void;
}

// ============================================================================
// 默认值
// ============================================================================

const DEFAULT_TOLERANCE = 5;
const DEFAULT_RESTORE_DELAY = 0;
const DEFAULT_SCROLL_BEHAVIOR: ScrollBehavior = 'auto';

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * 滚动位置保留 Hook
 * 
 * @param options - 配置选项
 * @returns 滚动位置保留相关方法
 * 
 * @example
 * ```tsx
 * // 基本用法 - 使用 window
 * const { withScrollPreservation } = useScrollPreservation();
 * 
 * const handleRefresh = async () => {
 *   await withScrollPreservation(async () => {
 *     await fetchData();
 *   });
 * };
 * 
 * // 指定容器
 * const containerRef = useRef<HTMLDivElement>(null);
 * const { saveScrollPosition, restoreScrollPosition } = useScrollPreservation({
 *   containerRef,
 * });
 * ```
 */
export function useScrollPreservation(
  options: UseScrollPreservationOptions = {}
): UseScrollPreservationReturn {
  const {
    containerRef,
    // tolerance 参数保留用于未来扩展
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    tolerance: _tolerance = DEFAULT_TOLERANCE,
    restoreDelay = DEFAULT_RESTORE_DELAY,
    scrollBehavior = DEFAULT_SCROLL_BEHAVIOR,
  } = options;

  // 保存的滚动位置
  const savedPositionRef = useRef<ScrollPosition | null>(null);

  /**
   * 获取当前滚动位置
   */
  const getCurrentScrollPosition = useCallback((): ScrollPosition => {
    if (containerRef?.current) {
      return {
        x: containerRef.current.scrollLeft,
        y: containerRef.current.scrollTop,
      };
    }
    return {
      x: window.scrollX || window.pageXOffset || 0,
      y: window.scrollY || window.pageYOffset || 0,
    };
  }, [containerRef]);

  /**
   * 保存当前滚动位置
   */
  const saveScrollPosition = useCallback((): ScrollPosition => {
    const position = getCurrentScrollPosition();
    savedPositionRef.current = position;
    return position;
  }, [getCurrentScrollPosition]);

  /**
   * 恢复滚动位置
   */
  const restoreScrollPosition = useCallback((position?: ScrollPosition) => {
    const targetPosition = position || savedPositionRef.current;
    
    if (!targetPosition) {
      return;
    }

    const doRestore = () => {
      if (containerRef?.current) {
        containerRef.current.scrollTo({
          left: targetPosition.x,
          top: targetPosition.y,
          behavior: scrollBehavior,
        });
      } else {
        window.scrollTo({
          left: targetPosition.x,
          top: targetPosition.y,
          behavior: scrollBehavior,
        });
      }
    };

    if (restoreDelay > 0) {
      setTimeout(doRestore, restoreDelay);
    } else {
      doRestore();
    }
  }, [containerRef, restoreDelay, scrollBehavior]);

  /**
   * 获取上次保存的滚动位置
   */
  const getSavedScrollPosition = useCallback((): ScrollPosition | null => {
    return savedPositionRef.current;
  }, []);

  /**
   * 清除保存的滚动位置
   */
  const clearSavedPosition = useCallback(() => {
    savedPositionRef.current = null;
  }, []);

  /**
   * 包装刷新操作，自动保存和恢复滚动位置
   */
  const withScrollPreservation = useCallback(async <T>(
    refreshFn: () => Promise<T> | T
  ): Promise<T> => {
    // 保存刷新前的滚动位置
    const positionBeforeRefresh = saveScrollPosition();
    
    try {
      // 执行刷新操作
      const result = await refreshFn();
      
      // 恢复滚动位置
      restoreScrollPosition(positionBeforeRefresh);
      
      return result;
    } catch (error) {
      // 即使出错也尝试恢复滚动位置
      restoreScrollPosition(positionBeforeRefresh);
      throw error;
    }
  }, [saveScrollPosition, restoreScrollPosition]);

  return {
    saveScrollPosition,
    restoreScrollPosition,
    getCurrentScrollPosition,
    getSavedScrollPosition,
    withScrollPreservation,
    clearSavedPosition,
  };
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 检查两个滚动位置是否在容差范围内相等
 * 
 * @param pos1 - 第一个位置
 * @param pos2 - 第二个位置
 * @param tolerance - 容差（像素）
 * @returns 是否相等
 */
export function areScrollPositionsEqual(
  pos1: ScrollPosition,
  pos2: ScrollPosition,
  tolerance: number = DEFAULT_TOLERANCE
): boolean {
  return (
    Math.abs(pos1.x - pos2.x) <= tolerance &&
    Math.abs(pos1.y - pos2.y) <= tolerance
  );
}

export default useScrollPreservation;

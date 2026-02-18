/**
 * 焦点管理 Hook
 * 
 * 提供焦点管理和键盘导航功能
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import { 
  getFocusableElements, 
  trapFocus, 
  announce 
} from '../utils/accessibility';

// ============================================================================
// 类型定义
// ============================================================================

export interface UseFocusTrapOptions {
  active?: boolean;
  initialFocus?: string;
  restoreFocus?: boolean;
  onClose?: () => void;
}

export interface UseFocusTrapReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  activate: () => void;
  deactivate: () => void;
}

export interface UseRovingTabIndexOptions {
  currentIndex: number;
  itemCount: number;
  orientation?: 'horizontal' | 'vertical' | 'both';
  loop?: boolean;
  onSelect?: (index: number) => void;
}

export interface UseRovingTabIndexReturn {
  getTabIndex: (index: number) => number;
  getKeyboardProps: (index: number) => {
    tabIndex: number;
    onKeyDown: (e: React.KeyboardEvent) => void;
    'aria-selected': boolean;
  };
}

export interface UseFocusVisibleReturn {
  isFocusVisible: boolean;
  focusVisibleProps: {
    onFocus: () => void;
    onBlur: () => void;
    onMouseDown: () => void;
  };
}

// ============================================================================
// useFocusTrap Hook
// ============================================================================

export function useFocusTrap(options: UseFocusTrapOptions = {}): UseFocusTrapReturn {
  const { 
    active = false, 
    initialFocus, 
    restoreFocus = true,
    onClose 
  } = options;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!containerRef.current) return;

    if (event.key === 'Escape' && onClose) {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === 'Tab') {
      trapFocus(containerRef.current, event);
    }
  }, [onClose]);

  const activate = useCallback(() => {
    if (!containerRef.current) return;

    previousActiveElement.current = document.activeElement as HTMLElement;

    setTimeout(() => {
      if (!containerRef.current) return;

      let elementToFocus: HTMLElement | null = null;

      if (initialFocus) {
        elementToFocus = containerRef.current.querySelector(initialFocus);
      }

      if (!elementToFocus) {
        const focusableElements = getFocusableElements(containerRef.current);
        elementToFocus = focusableElements[0] || containerRef.current;
      }

      elementToFocus?.focus();
    }, 0);

    document.addEventListener('keydown', handleKeyDown);
  }, [initialFocus, handleKeyDown]);

  const deactivate = useCallback(() => {
    document.removeEventListener('keydown', handleKeyDown);

    if (restoreFocus && previousActiveElement.current) {
      previousActiveElement.current.focus();
    }
  }, [handleKeyDown, restoreFocus]);

  useEffect(() => {
    if (active) {
      activate();
    } else {
      deactivate();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [active, activate, deactivate, handleKeyDown]);

  return {
    containerRef,
    activate,
    deactivate,
  };
}

// ============================================================================
// useRovingTabIndex Hook
// ============================================================================

export function useRovingTabIndex(options: UseRovingTabIndexOptions): UseRovingTabIndexReturn {
  const { 
    currentIndex, 
    itemCount, 
    orientation = 'vertical', 
    loop = true,
    onSelect 
  } = options;

  const getTabIndex = useCallback((index: number): number => {
    return index === currentIndex ? 0 : -1;
  }, [currentIndex]);

  const handleKeyDown = useCallback((index: number, event: React.KeyboardEvent) => {
    let newIndex = index;
    const isVertical = orientation === 'vertical' || orientation === 'both';
    const isHorizontal = orientation === 'horizontal' || orientation === 'both';

    switch (event.key) {
      case 'ArrowDown':
        if (isVertical) {
          event.preventDefault();
          newIndex = loop 
            ? (index + 1) % itemCount 
            : Math.min(index + 1, itemCount - 1);
        }
        break;
      case 'ArrowUp':
        if (isVertical) {
          event.preventDefault();
          newIndex = loop 
            ? (index - 1 + itemCount) % itemCount 
            : Math.max(index - 1, 0);
        }
        break;
      case 'ArrowRight':
        if (isHorizontal) {
          event.preventDefault();
          newIndex = loop 
            ? (index + 1) % itemCount 
            : Math.min(index + 1, itemCount - 1);
        }
        break;
      case 'ArrowLeft':
        if (isHorizontal) {
          event.preventDefault();
          newIndex = loop 
            ? (index - 1 + itemCount) % itemCount 
            : Math.max(index - 1, 0);
        }
        break;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = itemCount - 1;
        break;
      default:
        return;
    }

    if (newIndex !== index) {
      onSelect?.(newIndex);
    }
  }, [itemCount, loop, orientation, onSelect]);

  const getKeyboardProps = useCallback((index: number) => ({
    tabIndex: getTabIndex(index),
    onKeyDown: (e: React.KeyboardEvent) => handleKeyDown(index, e),
    'aria-selected': index === currentIndex,
  }), [currentIndex, getTabIndex, handleKeyDown]);

  return {
    getTabIndex,
    getKeyboardProps,
  };
}

// ============================================================================
// useFocusVisible Hook
// ============================================================================

export function useFocusVisible(): UseFocusVisibleReturn {
  const [isFocusVisible, setIsFocusVisible] = useState(false);
  const hadKeyboardEvent = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || 
          e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        hadKeyboardEvent.current = true;
      }
    };

    const handlePointerDown = () => {
      hadKeyboardEvent.current = false;
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, []);

  const focusVisibleProps = {
    onFocus: () => {
      if (hadKeyboardEvent.current) {
        setIsFocusVisible(true);
      }
    },
    onBlur: () => {
      setIsFocusVisible(false);
    },
    onMouseDown: () => {
      setIsFocusVisible(false);
    },
  };

  return {
    isFocusVisible,
    focusVisibleProps,
  };
}

// ============================================================================
// useArrowKeyNavigation Hook
// ============================================================================

export interface UseArrowKeyNavigationOptions {
  itemRefs: React.RefObject<(HTMLElement | null)[]>;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  orientation?: 'horizontal' | 'vertical' | 'both';
  loop?: boolean;
}

export function useArrowKeyNavigation(options: UseArrowKeyNavigationOptions) {
  const { 
    itemRefs, 
    currentIndex, 
    onIndexChange, 
    orientation = 'vertical',
    loop = true 
  } = options;

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const items = itemRefs.current;
    if (!items) return;

    const itemCount = items.filter(Boolean).length;
    if (itemCount === 0) return;

    let newIndex = currentIndex;
    const isVertical = orientation === 'vertical' || orientation === 'both';
    const isHorizontal = orientation === 'horizontal' || orientation === 'both';

    switch (event.key) {
      case 'ArrowDown':
        if (isVertical) {
          event.preventDefault();
          newIndex = loop 
            ? (currentIndex + 1) % itemCount 
            : Math.min(currentIndex + 1, itemCount - 1);
        }
        break;
      case 'ArrowUp':
        if (isVertical) {
          event.preventDefault();
          newIndex = loop 
            ? (currentIndex - 1 + itemCount) % itemCount 
            : Math.max(currentIndex - 1, 0);
        }
        break;
      case 'ArrowRight':
        if (isHorizontal) {
          event.preventDefault();
          newIndex = loop 
            ? (currentIndex + 1) % itemCount 
            : Math.min(currentIndex + 1, itemCount - 1);
        }
        break;
      case 'ArrowLeft':
        if (isHorizontal) {
          event.preventDefault();
          newIndex = loop 
            ? (currentIndex - 1 + itemCount) % itemCount 
            : Math.max(currentIndex - 1, 0);
        }
        break;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = itemCount - 1;
        break;
      default:
        return;
    }

    if (newIndex !== currentIndex) {
      onIndexChange(newIndex);
      items[newIndex]?.focus();
    }
  }, [currentIndex, itemRefs, loop, onIndexChange, orientation]);

  return { handleKeyDown };
}

// ============================================================================
// useAnnounce Hook
// ============================================================================

export function useAnnounce() {
  const announceMessage = useCallback((
    message: string, 
    priority: 'polite' | 'assertive' = 'polite'
  ) => {
    announce(message, priority);
  }, []);

  return { announce: announceMessage };
}

export default {
  useFocusTrap,
  useRovingTabIndex,
  useFocusVisible,
  useArrowKeyNavigation,
  useAnnounce,
};

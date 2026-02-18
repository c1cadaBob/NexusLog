/**
 * 无障碍工具函数
 * 
 * 提供无障碍相关的工具函数和常量
 */

// ============================================================================
// 焦点管理
// ============================================================================

/**
 * 可聚焦元素选择器
 */
export const FOCUSABLE_ELEMENTS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

/**
 * 获取元素内所有可聚焦元素
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS));
}

/**
 * 焦点捕获 - 在容器内循环焦点
 */
export function trapFocus(container: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;

  const focusableElements = getFocusableElements(container);
  if (focusableElements.length === 0) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey) {
    // Shift + Tab: 如果在第一个元素，跳到最后一个
    if (document.activeElement === firstElement) {
      event.preventDefault();
      lastElement?.focus();
    }
  } else {
    // Tab: 如果在最后一个元素，跳到第一个
    if (document.activeElement === lastElement) {
      event.preventDefault();
      firstElement?.focus();
    }
  }
}

/**
 * 创建焦点捕获处理器
 */
export function createFocusTrap(container: HTMLElement | null) {
  if (!container) return { activate: () => {}, deactivate: () => {} };

  const handleKeyDown = (event: KeyboardEvent) => {
    trapFocus(container, event);
  };

  return {
    activate: () => {
      document.addEventListener('keydown', handleKeyDown);
      // 聚焦到第一个可聚焦元素
      const focusableElements = getFocusableElements(container);
      if (focusableElements.length > 0) {
        focusableElements[0]?.focus();
      }
    },
    deactivate: () => {
      document.removeEventListener('keydown', handleKeyDown);
    },
  };
}

// ============================================================================
// ARIA 工具
// ============================================================================

/**
 * 生成唯一 ID
 */
export function generateAriaId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 设置 ARIA 属性
 */
export function setAriaAttributes(
  element: HTMLElement,
  attributes: Record<string, string | boolean | undefined>
): void {
  Object.entries(attributes).forEach(([key, value]) => {
    if (value === undefined || value === false) {
      element.removeAttribute(`aria-${key}`);
    } else if (value === true) {
      element.setAttribute(`aria-${key}`, 'true');
    } else {
      element.setAttribute(`aria-${key}`, value);
    }
  });
}

/**
 * ARIA 角色常量
 * 用于自定义组件的角色定义
 */
export const ARIA_ROLES = {
  // 文档结构角色
  ARTICLE: 'article',
  BANNER: 'banner',
  COMPLEMENTARY: 'complementary',
  CONTENTINFO: 'contentinfo',
  MAIN: 'main',
  NAVIGATION: 'navigation',
  REGION: 'region',
  SEARCH: 'search',
  
  // 小部件角色
  ALERT: 'alert',
  ALERTDIALOG: 'alertdialog',
  BUTTON: 'button',
  CHECKBOX: 'checkbox',
  DIALOG: 'dialog',
  GRID: 'grid',
  GRIDCELL: 'gridcell',
  LINK: 'link',
  LISTBOX: 'listbox',
  MENU: 'menu',
  MENUBAR: 'menubar',
  MENUITEM: 'menuitem',
  OPTION: 'option',
  PROGRESSBAR: 'progressbar',
  RADIO: 'radio',
  SCROLLBAR: 'scrollbar',
  SLIDER: 'slider',
  SPINBUTTON: 'spinbutton',
  STATUS: 'status',
  SWITCH: 'switch',
  TAB: 'tab',
  TABLIST: 'tablist',
  TABPANEL: 'tabpanel',
  TEXTBOX: 'textbox',
  TIMER: 'timer',
  TOOLTIP: 'tooltip',
  TREE: 'tree',
  TREEITEM: 'treeitem',
  
  // 列表角色
  LIST: 'list',
  LISTITEM: 'listitem',
  
  // 表格角色
  TABLE: 'table',
  ROW: 'row',
  ROWGROUP: 'rowgroup',
  ROWHEADER: 'rowheader',
  COLUMNHEADER: 'columnheader',
  CELL: 'cell',
} as const;

/**
 * ARIA 状态常量
 * 用于描述元素的当前状态
 */
export const ARIA_STATES = {
  EXPANDED: 'aria-expanded',
  SELECTED: 'aria-selected',
  CHECKED: 'aria-checked',
  PRESSED: 'aria-pressed',
  DISABLED: 'aria-disabled',
  HIDDEN: 'aria-hidden',
  INVALID: 'aria-invalid',
  BUSY: 'aria-busy',
  GRABBED: 'aria-grabbed',
  CURRENT: 'aria-current',
} as const;

/**
 * ARIA 属性常量
 * 用于描述元素的关系和属性
 */
export const ARIA_PROPERTIES = {
  LABEL: 'aria-label',
  LABELLEDBY: 'aria-labelledby',
  DESCRIBEDBY: 'aria-describedby',
  CONTROLS: 'aria-controls',
  OWNS: 'aria-owns',
  LIVE: 'aria-live',
  ATOMIC: 'aria-atomic',
  RELEVANT: 'aria-relevant',
  HASPOPUP: 'aria-haspopup',
  MODAL: 'aria-modal',
  ORIENTATION: 'aria-orientation',
  VALUEMIN: 'aria-valuemin',
  VALUEMAX: 'aria-valuemax',
  VALUENOW: 'aria-valuenow',
  VALUETEXT: 'aria-valuetext',
  SORT: 'aria-sort',
  LEVEL: 'aria-level',
  POSINSET: 'aria-posinset',
  SETSIZE: 'aria-setsize',
  ROWCOUNT: 'aria-rowcount',
  ROWINDEX: 'aria-rowindex',
  COLCOUNT: 'aria-colcount',
  COLINDEX: 'aria-colindex',
} as const;

/**
 * 创建 ARIA 标签对象
 * 用于快速生成常用的 ARIA 属性组合
 */
export function createAriaLabel(label: string, describedBy?: string): Record<string, string> {
  const attrs: Record<string, string> = {
    'aria-label': label,
  };
  if (describedBy) {
    attrs['aria-describedby'] = describedBy;
  }
  return attrs;
}

/**
 * 创建可展开元素的 ARIA 属性
 */
export function createExpandableAriaProps(
  expanded: boolean,
  controlsId: string
): Record<string, string | boolean> {
  return {
    'aria-expanded': expanded,
    'aria-controls': controlsId,
  };
}

/**
 * 创建进度条的 ARIA 属性
 */
export function createProgressAriaProps(
  value: number,
  min: number = 0,
  max: number = 100,
  label?: string
): Record<string, string | number> {
  const attrs: Record<string, string | number> = {
    role: 'progressbar',
    'aria-valuenow': value,
    'aria-valuemin': min,
    'aria-valuemax': max,
  };
  if (label) {
    attrs['aria-label'] = label;
  }
  return attrs;
}

/**
 * 创建滑块的 ARIA 属性
 */
export function createSliderAriaProps(
  value: number,
  min: number,
  max: number,
  orientation: 'horizontal' | 'vertical' = 'horizontal',
  label?: string
): Record<string, string | number> {
  const attrs: Record<string, string | number> = {
    role: 'slider',
    'aria-valuenow': value,
    'aria-valuemin': min,
    'aria-valuemax': max,
    'aria-orientation': orientation,
  };
  if (label) {
    attrs['aria-label'] = label;
  }
  return attrs;
}

// ============================================================================
// 屏幕阅读器公告
// ============================================================================

let announcer: HTMLElement | null = null;

/**
 * 获取或创建屏幕阅读器公告元素
 */
function getAnnouncer(): HTMLElement {
  if (!announcer) {
    announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    announcer.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `;
    document.body.appendChild(announcer);
  }
  return announcer;
}

/**
 * 向屏幕阅读器发送公告
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcer = getAnnouncer();
  announcer.setAttribute('aria-live', priority);
  
  // 清空后重新设置，确保屏幕阅读器能检测到变化
  announcer.textContent = '';
  requestAnimationFrame(() => {
    announcer.textContent = message;
  });
}

// ============================================================================
// 键盘导航
// ============================================================================

/**
 * 处理列表键盘导航
 */
export function handleListKeyboardNavigation(
  event: KeyboardEvent,
  items: HTMLElement[],
  currentIndex: number,
  onSelect: (index: number) => void
): void {
  let newIndex = currentIndex;

  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      event.preventDefault();
      newIndex = (currentIndex + 1) % items.length;
      break;
    case 'ArrowUp':
    case 'ArrowLeft':
      event.preventDefault();
      newIndex = (currentIndex - 1 + items.length) % items.length;
      break;
    case 'Home':
      event.preventDefault();
      newIndex = 0;
      break;
    case 'End':
      event.preventDefault();
      newIndex = items.length - 1;
      break;
    default:
      return;
  }

  if (newIndex !== currentIndex) {
    onSelect(newIndex);
    items[newIndex]?.focus();
  }
}

/**
 * 处理菜单键盘导航
 * 支持上下箭头、Home、End、Enter、Space、Escape
 */
export function handleMenuKeyboardNavigation(
  event: KeyboardEvent,
  items: HTMLElement[],
  currentIndex: number,
  options: {
    onSelect: (index: number) => void;
    onActivate?: (index: number) => void;
    onClose?: () => void;
    orientation?: 'vertical' | 'horizontal';
    loop?: boolean;
  }
): void {
  const { 
    onSelect, 
    onActivate, 
    onClose, 
    orientation = 'vertical',
    loop = true 
  } = options;
  
  let newIndex = currentIndex;
  const itemCount = items.length;

  const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
  const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';

  switch (event.key) {
    case nextKey:
      event.preventDefault();
      newIndex = loop 
        ? (currentIndex + 1) % itemCount 
        : Math.min(currentIndex + 1, itemCount - 1);
      break;
    case prevKey:
      event.preventDefault();
      newIndex = loop 
        ? (currentIndex - 1 + itemCount) % itemCount 
        : Math.max(currentIndex - 1, 0);
      break;
    case 'Home':
      event.preventDefault();
      newIndex = 0;
      break;
    case 'End':
      event.preventDefault();
      newIndex = itemCount - 1;
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      onActivate?.(currentIndex);
      return;
    case 'Escape':
      event.preventDefault();
      onClose?.();
      return;
    case 'Tab':
      // 允许 Tab 键退出菜单
      onClose?.();
      return;
    default:
      return;
  }

  if (newIndex !== currentIndex) {
    onSelect(newIndex);
    items[newIndex]?.focus();
  }
}

/**
 * 处理网格键盘导航
 * 支持上下左右箭头在网格中移动
 */
export function handleGridKeyboardNavigation(
  event: KeyboardEvent,
  options: {
    currentRow: number;
    currentCol: number;
    rowCount: number;
    colCount: number;
    onNavigate: (row: number, col: number) => void;
    onActivate?: (row: number, col: number) => void;
    loop?: boolean;
  }
): void {
  const { 
    currentRow, 
    currentCol, 
    rowCount, 
    colCount, 
    onNavigate, 
    onActivate,
    loop = false 
  } = options;

  let newRow = currentRow;
  let newCol = currentCol;

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      newRow = loop 
        ? (currentRow + 1) % rowCount 
        : Math.min(currentRow + 1, rowCount - 1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      newRow = loop 
        ? (currentRow - 1 + rowCount) % rowCount 
        : Math.max(currentRow - 1, 0);
      break;
    case 'ArrowRight':
      event.preventDefault();
      newCol = loop 
        ? (currentCol + 1) % colCount 
        : Math.min(currentCol + 1, colCount - 1);
      break;
    case 'ArrowLeft':
      event.preventDefault();
      newCol = loop 
        ? (currentCol - 1 + colCount) % colCount 
        : Math.max(currentCol - 1, 0);
      break;
    case 'Home':
      event.preventDefault();
      if (event.ctrlKey) {
        newRow = 0;
        newCol = 0;
      } else {
        newCol = 0;
      }
      break;
    case 'End':
      event.preventDefault();
      if (event.ctrlKey) {
        newRow = rowCount - 1;
        newCol = colCount - 1;
      } else {
        newCol = colCount - 1;
      }
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      onActivate?.(currentRow, currentCol);
      return;
    default:
      return;
  }

  if (newRow !== currentRow || newCol !== currentCol) {
    onNavigate(newRow, newCol);
  }
}

/**
 * 创建键盘事件处理器
 * 用于简化常见的键盘交互模式
 */
export function createKeyboardHandler(handlers: {
  onEnter?: () => void;
  onSpace?: () => void;
  onEscape?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onHome?: () => void;
  onEnd?: () => void;
  onTab?: (shiftKey: boolean) => void;
}) {
  return (event: KeyboardEvent | React.KeyboardEvent) => {
    switch (event.key) {
      case 'Enter':
        if (handlers.onEnter) {
          event.preventDefault();
          handlers.onEnter();
        }
        break;
      case ' ':
        if (handlers.onSpace) {
          event.preventDefault();
          handlers.onSpace();
        }
        break;
      case 'Escape':
        if (handlers.onEscape) {
          event.preventDefault();
          handlers.onEscape();
        }
        break;
      case 'ArrowUp':
        if (handlers.onArrowUp) {
          event.preventDefault();
          handlers.onArrowUp();
        }
        break;
      case 'ArrowDown':
        if (handlers.onArrowDown) {
          event.preventDefault();
          handlers.onArrowDown();
        }
        break;
      case 'ArrowLeft':
        if (handlers.onArrowLeft) {
          event.preventDefault();
          handlers.onArrowLeft();
        }
        break;
      case 'ArrowRight':
        if (handlers.onArrowRight) {
          event.preventDefault();
          handlers.onArrowRight();
        }
        break;
      case 'Home':
        if (handlers.onHome) {
          event.preventDefault();
          handlers.onHome();
        }
        break;
      case 'End':
        if (handlers.onEnd) {
          event.preventDefault();
          handlers.onEnd();
        }
        break;
      case 'Tab':
        if (handlers.onTab) {
          handlers.onTab(event.shiftKey);
        }
        break;
    }
  };
}

// ============================================================================
// 颜色对比度
// ============================================================================

/**
 * 计算相对亮度
 * 基于 WCAG 2.1 公式
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const sRGB = c / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs! + 0.7152 * gs! + 0.0722 * bs!;
}

/**
 * 计算对比度
 * 返回值范围 1-21
 */
export function getContrastRatio(
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number }
): number {
  const l1 = getRelativeLuminance(color1.r, color1.g, color1.b);
  const l2 = getRelativeLuminance(color2.r, color2.g, color2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * 检查是否符合 WCAG AA 标准
 * 普通文本需要 4.5:1，大文本需要 3:1
 */
export function meetsWCAGAA(
  contrastRatio: number,
  isLargeText: boolean = false
): boolean {
  return isLargeText ? contrastRatio >= 3 : contrastRatio >= 4.5;
}

/**
 * 检查是否符合 WCAG AAA 标准
 * 普通文本需要 7:1，大文本需要 4.5:1
 */
export function meetsWCAGAAA(
  contrastRatio: number,
  isLargeText: boolean = false
): boolean {
  return isLargeText ? contrastRatio >= 4.5 : contrastRatio >= 7;
}

// ============================================================================
// 减少动画偏好
// ============================================================================

/**
 * 检查用户是否偏好减少动画
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 监听减少动画偏好变化
 */
export function onReducedMotionChange(callback: (prefersReduced: boolean) => void): () => void {
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handler = (e: MediaQueryListEvent) => callback(e.matches);
  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
}

export default {
  FOCUSABLE_ELEMENTS,
  getFocusableElements,
  trapFocus,
  createFocusTrap,
  generateAriaId,
  setAriaAttributes,
  ARIA_ROLES,
  ARIA_STATES,
  ARIA_PROPERTIES,
  createAriaLabel,
  createExpandableAriaProps,
  createProgressAriaProps,
  createSliderAriaProps,
  announce,
  handleListKeyboardNavigation,
  handleMenuKeyboardNavigation,
  handleGridKeyboardNavigation,
  createKeyboardHandler,
  getRelativeLuminance,
  getContrastRatio,
  meetsWCAGAA,
  meetsWCAGAAA,
  prefersReducedMotion,
  onReducedMotionChange,
};

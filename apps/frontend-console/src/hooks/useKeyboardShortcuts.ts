/**
 * 键盘快捷键 Hook
 * 实现全局键盘快捷键处理
 * 
 * @module hooks/useKeyboardShortcuts
 */

import { useEffect, useCallback, useState, useMemo } from 'react';

// ============================================================================
// 类型定义
// ============================================================================

export interface KeyboardShortcut {
  id: string;
  keys: string[];
  description: string;
  category: string;
  action: () => void;
  enabled?: boolean;
  preventDefault?: boolean;
}

export interface ShortcutCategory {
  id: string;
  name: string;
  shortcuts: KeyboardShortcut[];
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  onShortcutTriggered?: (shortcut: KeyboardShortcut) => void;
}

export interface UseKeyboardShortcutsReturn {
  shortcuts: KeyboardShortcut[];
  categories: ShortcutCategory[];
  registerShortcut: (shortcut: KeyboardShortcut) => void;
  unregisterShortcut: (id: string) => void;
  isHelpDialogOpen: boolean;
  openHelpDialog: () => void;
  closeHelpDialog: () => void;
  toggleHelpDialog: () => void;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 解析按键组合字符串
 */
const parseKeyCombo = (keys: string[]): { modifiers: Set<string>; key: string } => {
  const modifiers = new Set<string>();
  let mainKey = '';
  
  keys.forEach(k => {
    const lower = k.toLowerCase();
    if (['ctrl', 'control', 'cmd', 'command', 'meta'].includes(lower)) {
      modifiers.add('meta');
    } else if (['alt', 'option'].includes(lower)) {
      modifiers.add('alt');
    } else if (['shift'].includes(lower)) {
      modifiers.add('shift');
    } else {
      mainKey = lower;
    }
  });
  
  return { modifiers, key: mainKey };
};

/**
 * 检查事件是否匹配快捷键
 */
const matchesShortcut = (event: KeyboardEvent, shortcut: KeyboardShortcut): boolean => {
  const { modifiers, key } = parseKeyCombo(shortcut.keys);
  
  // 检查修饰键
  if (modifiers.has('meta') !== (event.metaKey || event.ctrlKey)) return false;
  if (modifiers.has('alt') !== event.altKey) return false;
  if (modifiers.has('shift') !== event.shiftKey) return false;
  
  // 检查主键
  const eventKey = event.key.toLowerCase();
  if (key === '?') {
    return eventKey === '?' || (event.shiftKey && eventKey === '/');
  }
  
  return eventKey === key;
};

/**
 * 检查是否在可编辑元素中
 */
const isInEditableElement = (): boolean => {
  const activeElement = document.activeElement;
  if (!activeElement) return false;
  
  const tagName = activeElement.tagName.toLowerCase();
  if (['input', 'textarea', 'select'].includes(tagName)) return true;
  if ((activeElement as HTMLElement).isContentEditable) return true;
  
  return false;
};

/**
 * 格式化按键显示
 */
export const formatKeyCombo = (keys: string[]): string => {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  
  return keys.map(k => {
    const lower = k.toLowerCase();
    if (['ctrl', 'control', 'cmd', 'command', 'meta'].includes(lower)) {
      return isMac ? '⌘' : 'Ctrl';
    }
    if (['alt', 'option'].includes(lower)) {
      return isMac ? '⌥' : 'Alt';
    }
    if (lower === 'shift') {
      return isMac ? '⇧' : 'Shift';
    }
    if (lower === 'enter') return '↵';
    if (lower === 'escape' || lower === 'esc') return 'Esc';
    if (lower === 'backspace') return '⌫';
    if (lower === 'delete') return 'Del';
    if (lower === 'arrowup') return '↑';
    if (lower === 'arrowdown') return '↓';
    if (lower === 'arrowleft') return '←';
    if (lower === 'arrowright') return '→';
    return k.toUpperCase();
  }).join(isMac ? '' : '+');
};

// ============================================================================
// 默认快捷键
// ============================================================================

export const DEFAULT_SHORTCUTS: Omit<KeyboardShortcut, 'action'>[] = [
  // 导航
  { id: 'go-dashboard', keys: ['Ctrl', 'D'], description: '前往仪表板', category: 'navigation' },
  { id: 'go-search', keys: ['Ctrl', 'K'], description: '打开搜索', category: 'navigation' },
  { id: 'go-alerts', keys: ['Ctrl', 'A'], description: '前往告警', category: 'navigation' },
  
  // 操作
  { id: 'refresh', keys: ['Ctrl', 'R'], description: '刷新数据', category: 'actions' },
  { id: 'save', keys: ['Ctrl', 'S'], description: '保存', category: 'actions' },
  { id: 'new', keys: ['Ctrl', 'N'], description: '新建', category: 'actions' },
  
  // 视图
  { id: 'toggle-sidebar', keys: ['Ctrl', 'B'], description: '切换侧边栏', category: 'view' },
  { id: 'toggle-theme', keys: ['Ctrl', 'Shift', 'T'], description: '切换主题', category: 'view' },
  { id: 'fullscreen', keys: ['F11'], description: '全屏', category: 'view' },
  
  // 帮助
  { id: 'help', keys: ['?'], description: '显示快捷键帮助', category: 'help' },
  { id: 'close', keys: ['Escape'], description: '关闭对话框', category: 'help' },
];

// ============================================================================
// Hook 实现
// ============================================================================

export const useKeyboardShortcuts = (
  options: UseKeyboardShortcutsOptions = {}
): UseKeyboardShortcutsReturn => {
  const { enabled = true, onShortcutTriggered } = options;
  
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>([]);
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  
  // 注册快捷键
  const registerShortcut = useCallback((shortcut: KeyboardShortcut) => {
    setShortcuts(prev => {
      const existing = prev.findIndex(s => s.id === shortcut.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = shortcut;
        return updated;
      }
      return [...prev, shortcut];
    });
  }, []);
  
  // 注销快捷键
  const unregisterShortcut = useCallback((id: string) => {
    setShortcuts(prev => prev.filter(s => s.id !== id));
  }, []);
  
  // 帮助对话框控制
  const openHelpDialog = useCallback(() => setIsHelpDialogOpen(true), []);
  const closeHelpDialog = useCallback(() => setIsHelpDialogOpen(false), []);
  const toggleHelpDialog = useCallback(() => setIsHelpDialogOpen(prev => !prev), []);
  
  // 按类别分组
  const categories = useMemo((): ShortcutCategory[] => {
    const categoryMap = new Map<string, KeyboardShortcut[]>();
    
    shortcuts.forEach(shortcut => {
      const existing = categoryMap.get(shortcut.category) || [];
      categoryMap.set(shortcut.category, [...existing, shortcut]);
    });
    
    const categoryNames: Record<string, string> = {
      navigation: '导航',
      actions: '操作',
      view: '视图',
      help: '帮助',
      custom: '自定义',
    };
    
    return Array.from(categoryMap.entries()).map(([id, shortcuts]) => ({
      id,
      name: categoryNames[id] || id,
      shortcuts,
    }));
  }, [shortcuts]);
  
  // 键盘事件处理
  useEffect(() => {
    if (!enabled) return;
    
    const handleKeyDown = (event: KeyboardEvent) => {
      // 在可编辑元素中时，只处理特定快捷键
      if (isInEditableElement()) {
        // 只允许 Escape 和帮助快捷键
        const isEscape = event.key === 'Escape';
        const isHelp = event.key === '?' || (event.shiftKey && event.key === '/');
        if (!isEscape && !isHelp) return;
      }
      
      // 查找匹配的快捷键
      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;
        
        if (matchesShortcut(event, shortcut)) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          
          shortcut.action();
          onShortcutTriggered?.(shortcut);
          return;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, shortcuts, onShortcutTriggered]);
  
  // 注册帮助快捷键
  useEffect(() => {
    registerShortcut({
      id: 'help',
      keys: ['?'],
      description: '显示快捷键帮助',
      category: 'help',
      action: toggleHelpDialog,
    });
    
    registerShortcut({
      id: 'close-help',
      keys: ['Escape'],
      description: '关闭帮助对话框',
      category: 'help',
      action: closeHelpDialog,
      enabled: isHelpDialogOpen,
    });
  }, [registerShortcut, toggleHelpDialog, closeHelpDialog, isHelpDialogOpen]);
  
  return {
    shortcuts,
    categories,
    registerShortcut,
    unregisterShortcut,
    isHelpDialogOpen,
    openHelpDialog,
    closeHelpDialog,
    toggleHelpDialog,
  };
};

export default useKeyboardShortcuts;

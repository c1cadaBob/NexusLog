/**
 * 仪表板布局管理 Hook
 * 实现布局的持久化和同步
 * 
 * 注意：此 Hook 使用 useLocalStorage 而非 Context API
 */

import { useState, useCallback, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

// ============================================================================
// 类型定义
// ============================================================================

export interface GridItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface DashboardLayoutConfig {
  id: string;
  name: string;
  items: GridItem[];
  isDefault?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UseDashboardLayoutOptions {
  dashboardId: string;
  defaultItems?: GridItem[];
  onSave?: (layout: DashboardLayoutConfig) => Promise<void>;
  onLoad?: (dashboardId: string) => Promise<DashboardLayoutConfig | null>;
}

export interface UseDashboardLayoutReturn {
  items: GridItem[];
  layouts: DashboardLayoutConfig[];
  currentLayoutId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  updateLayout: (items: GridItem[]) => void;
  saveLayout: (name?: string) => Promise<void>;
  loadLayout: (layoutId: string) => void;
  deleteLayout: (layoutId: string) => void;
  resetToDefault: () => void;
  setAsDefault: (layoutId: string) => void;
}

// ============================================================================
// 默认布局
// ============================================================================

export const DEFAULT_DASHBOARD_ITEMS: GridItem[] = [
  { id: 'kpi-1', x: 0, y: 0, w: 2, h: 1, minW: 1, minH: 1 },
  { id: 'kpi-2', x: 2, y: 0, w: 2, h: 1, minW: 1, minH: 1 },
  { id: 'kpi-3', x: 4, y: 0, w: 2, h: 1, minW: 1, minH: 1 },
  { id: 'kpi-4', x: 6, y: 0, w: 2, h: 1, minW: 1, minH: 1 },
  { id: 'kpi-5', x: 8, y: 0, w: 2, h: 1, minW: 1, minH: 1 },
  { id: 'kpi-6', x: 10, y: 0, w: 2, h: 1, minW: 1, minH: 1 },
  { id: 'infrastructure', x: 0, y: 1, w: 12, h: 3, minW: 6, minH: 2 },
  { id: 'log-trend', x: 0, y: 4, w: 8, h: 3, minW: 4, minH: 2 },
  { id: 'service-table', x: 8, y: 4, w: 4, h: 3, minW: 3, minH: 2 },
  { id: 'quick-actions', x: 0, y: 7, w: 6, h: 3, minW: 4, minH: 2 },
  { id: 'audit-log', x: 6, y: 7, w: 6, h: 3, minW: 4, minH: 2 },
];

// ============================================================================
// 存储键
// ============================================================================

const LAYOUTS_KEY = 'dashboard_layouts';
const CURRENT_LAYOUT_KEY = 'dashboard_current_layout';

// ============================================================================
// Hook 实现
// ============================================================================

export const useDashboardLayout = (
  options: UseDashboardLayoutOptions
): UseDashboardLayoutReturn => {
  const { dashboardId, defaultItems = DEFAULT_DASHBOARD_ITEMS, onSave, onLoad } = options;

  const [items, setItems] = useState<GridItem[]>(defaultItems);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { value: layouts, setValue: setLayouts } = useLocalStorage<DashboardLayoutConfig[]>(
    `${LAYOUTS_KEY}_${dashboardId}`,
    []
  );
  
  const { value: currentLayoutId, setValue: setCurrentLayoutId } = useLocalStorage<string | null>(
    `${CURRENT_LAYOUT_KEY}_${dashboardId}`,
    null
  );

  useEffect(() => {
    const loadInitialLayout = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (onLoad) {
          const serverLayout = await onLoad(dashboardId);
          if (serverLayout) {
            setItems(serverLayout.items);
            setCurrentLayoutId(serverLayout.id);
            setIsLoading(false);
            return;
          }
        }

        if (currentLayoutId) {
          const layout = layouts.find((l) => l.id === currentLayoutId);
          if (layout) {
            setItems(layout.items);
          }
        } else {
          const defaultLayout = layouts.find((l) => l.isDefault);
          if (defaultLayout) {
            setItems(defaultLayout.items);
            setCurrentLayoutId(defaultLayout.id);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载布局失败');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialLayout();
  }, [dashboardId]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateLayout = useCallback((newItems: GridItem[]) => {
    setItems(newItems);

    if (currentLayoutId) {
      setLayouts((prev) =>
        prev.map((layout) =>
          layout.id === currentLayoutId
            ? { ...layout, items: newItems, updatedAt: Date.now() }
            : layout
        )
      );
    }
  }, [currentLayoutId, setLayouts]);

  const saveLayout = useCallback(
    async (name?: string) => {
      setIsSaving(true);
      setError(null);

      try {
        const layoutId = currentLayoutId || `layout_${Date.now()}`;
        const layoutName = name || `布局 ${layouts.length + 1}`;

        const newLayout: DashboardLayoutConfig = {
          id: layoutId,
          name: layoutName,
          items,
          isDefault: layouts.length === 0,
          createdAt: currentLayoutId
            ? layouts.find((l) => l.id === currentLayoutId)?.createdAt || Date.now()
            : Date.now(),
          updatedAt: Date.now(),
        };

        if (onSave) {
          await onSave(newLayout);
        }

        setLayouts((prev) => {
          const existing = prev.findIndex((l) => l.id === layoutId);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = newLayout;
            return updated;
          }
          return [...prev, newLayout];
        });

        setCurrentLayoutId(layoutId);
      } catch (err) {
        setError(err instanceof Error ? err.message : '保存布局失败');
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [currentLayoutId, items, layouts, onSave, setLayouts, setCurrentLayoutId]
  );

  const loadLayout = useCallback(
    (layoutId: string) => {
      const layout = layouts.find((l) => l.id === layoutId);
      if (layout) {
        setItems(layout.items);
        setCurrentLayoutId(layoutId);
      }
    },
    [layouts, setCurrentLayoutId]
  );

  const deleteLayout = useCallback(
    (layoutId: string) => {
      setLayouts((prev) => prev.filter((l) => l.id !== layoutId));

      if (currentLayoutId === layoutId) {
        setCurrentLayoutId(null);
        setItems(defaultItems);
      }
    },
    [currentLayoutId, defaultItems, setLayouts, setCurrentLayoutId]
  );

  const resetToDefault = useCallback(() => {
    setItems(defaultItems);
    setCurrentLayoutId(null);
  }, [defaultItems, setCurrentLayoutId]);

  const setAsDefault = useCallback(
    (layoutId: string) => {
      setLayouts((prev) =>
        prev.map((layout) => ({
          ...layout,
          isDefault: layout.id === layoutId,
        }))
      );
    },
    [setLayouts]
  );

  return {
    items,
    layouts,
    currentLayoutId,
    isLoading,
    isSaving,
    error,
    updateLayout,
    saveLayout,
    loadLayout,
    deleteLayout,
    resetToDefault,
    setAsDefault,
  };
};

export default useDashboardLayout;

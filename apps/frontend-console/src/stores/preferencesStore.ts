import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PreferencesState {
  /** 各页面的每页条数 */
  pageSizes: Record<string, number>;
  /** Dashboard 刷新间隔（秒） */
  refreshInterval: number;
  setPageSize: (pageKey: string, size: number) => void;
  setRefreshInterval: (interval: number) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      pageSizes: {},
      refreshInterval: 30,
      setPageSize: (pageKey, size) =>
        set((state) => ({
          pageSizes: { ...state.pageSizes, [pageKey]: size },
        })),
      setRefreshInterval: (interval) => set({ refreshInterval: interval }),
    }),
    { name: 'nexuslog-preferences' },
  ),
);

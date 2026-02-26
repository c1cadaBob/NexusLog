import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeMode, DensityMode } from '../types/theme';

export interface ThemeState {
  mode: ThemeMode;
  density: DensityMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  setDensity: (density: DensityMode) => void;
}

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'auto') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  }
  return mode === 'dark';
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'dark',
      density: 'comfortable',
      isDark: true,
      setMode: (mode) => set({ mode, isDark: resolveIsDark(mode) }),
      setDensity: (density) => set({ density }),
    }),
    {
      name: 'nexuslog-theme',
      partialize: (state) => ({ mode: state.mode, density: state.density }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isDark = resolveIsDark(state.mode);
        }
      },
    },
  ),
);

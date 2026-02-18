/**
 * 主题状态管理 Store
 * 
 * 使用 Zustand 替代 ThemeContext，管理主题模式和视觉密度
 * 
 * @module stores/useThemeStore
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ThemeConfig } from 'antd';
import { theme as antdTheme } from 'antd';
import type { 
  ThemeMode, 
  DensityMode, 
  ThemeColors,
} from '@/types/theme';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 主题状态接口
 */
export interface ThemeState {
  /** 主题模式 */
  themeMode: ThemeMode;
  /** 视觉密度 */
  density: DensityMode;
  /** 是否为暗色模式（计算属性） */
  isDark: boolean;
  /** Ant Design 主题配置对象 */
  antdTheme: ThemeConfig;
  /** 当前主题颜色 */
  colors: ThemeColors;
}

/**
 * 主题操作接口
 */
export interface ThemeActions {
  /** 设置主题模式 */
  setThemeMode: (mode: ThemeMode) => void;
  /** 设置视觉密度 */
  setDensity: (density: DensityMode) => void;
  /** 切换暗色/亮色模式 */
  toggleTheme: () => void;
}

/**
 * 完整的主题 Store 类型
 */
export type ThemeStore = ThemeState & ThemeActions;

// ============================================================================
// 主题颜色配置
// ============================================================================

/**
 * 深色主题颜色
 */
const DARK_COLORS: ThemeColors = {
  primary: '#135bec',
  secondary: '#64748b',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  background: '#0f172a',
  surface: '#1e293b',
  surfaceHover: '#334155',
  text: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  border: '#334155',
  borderLight: '#475569',
};

/**
 * 浅色主题颜色
 */
const LIGHT_COLORS: ThemeColors = {
  primary: '#135bec',
  secondary: '#64748b',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceHover: '#f1f5f9',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  borderLight: '#cbd5e1',
};

/**
 * 高对比度主题颜色
 */
const HIGH_CONTRAST_COLORS: ThemeColors = {
  primary: '#0066ff',
  secondary: '#666666',
  success: '#00cc00',
  warning: '#ffcc00',
  danger: '#ff0000',
  info: '#0099ff',
  background: '#000000',
  surface: '#1a1a1a',
  surfaceHover: '#333333',
  text: '#ffffff',
  textSecondary: '#cccccc',
  textMuted: '#999999',
  border: '#666666',
  borderLight: '#808080',
};

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 检测系统是否偏好暗色模式
 */
function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined') {
    return true; // 默认暗色
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * 根据主题模式计算是否为暗色
 */
function computeIsDark(mode: ThemeMode): boolean {
  switch (mode) {
    case 'dark':
      return true;
    case 'light':
      return false;
    case 'high-contrast':
      return true; // 高对比度模式基于暗色
    case 'auto':
      return getSystemPrefersDark();
    default:
      return true;
  }
}

/**
 * 根据主题模式获取颜色配置
 */
function getColorsForMode(mode: ThemeMode): ThemeColors {
  switch (mode) {
    case 'dark':
      return DARK_COLORS;
    case 'light':
      return LIGHT_COLORS;
    case 'high-contrast':
      return HIGH_CONTRAST_COLORS;
    case 'auto':
      return getSystemPrefersDark() ? DARK_COLORS : LIGHT_COLORS;
    default:
      return DARK_COLORS;
  }
}

/**
 * 根据主题模式和密度生成 Ant Design 主题配置
 */
function generateAntdTheme(mode: ThemeMode, density: DensityMode): ThemeConfig {
  const isDark = computeIsDark(mode);
  const colors = getColorsForMode(mode);
  
  // 选择算法
  const algorithms: typeof antdTheme.darkAlgorithm[] = [];
  
  if (isDark) {
    algorithms.push(antdTheme.darkAlgorithm);
  }
  
  if (density === 'compact') {
    algorithms.push(antdTheme.compactAlgorithm);
  }
  
  // 如果没有算法，使用默认算法
  if (algorithms.length === 0) {
    algorithms.push(antdTheme.defaultAlgorithm);
  }

  return {
    algorithm: algorithms.length === 1 ? algorithms[0] : algorithms,
    token: {
      // 主色调
      colorPrimary: colors.primary,
      colorSuccess: colors.success,
      colorWarning: colors.warning,
      colorError: colors.danger,
      colorInfo: colors.info,
      
      // 背景色
      colorBgContainer: colors.surface,
      colorBgElevated: colors.surface,
      colorBgLayout: colors.background,
      
      // 文本色
      colorText: colors.text,
      colorTextSecondary: colors.textSecondary,
      colorTextTertiary: colors.textMuted,
      
      // 边框色
      colorBorder: colors.border,
      colorBorderSecondary: colors.borderLight,
      
      // 圆角
      borderRadius: 6,
      
      // 字体
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      
      // 间距（根据密度调整）
      ...(density === 'compact' ? {
        padding: 8,
        paddingLG: 12,
        paddingXS: 4,
        margin: 8,
        marginLG: 12,
        marginXS: 4,
      } : density === 'spacious' ? {
        padding: 20,
        paddingLG: 28,
        paddingXS: 12,
        margin: 20,
        marginLG: 28,
        marginXS: 12,
      } : {}),
    },
    components: {
      // 布局组件配置
      Layout: {
        headerBg: colors.surface,
        siderBg: colors.surface,
        bodyBg: colors.background,
      },
      // 菜单组件配置
      Menu: {
        darkItemBg: colors.surface,
        darkSubMenuItemBg: colors.background,
      },
      // 卡片组件配置
      Card: {
        colorBgContainer: colors.surface,
      },
    },
  };
}

// ============================================================================
// 存储键名
// ============================================================================

const THEME_STORAGE_KEY = 'nexuslog-theme';

// ============================================================================
// Store 实现
// ============================================================================

/**
 * 主题状态管理 Store
 * 
 * @example
 * ```tsx
 * // 在组件中使用
 * const { themeMode, setThemeMode, antdTheme } = useThemeStore();
 * 
 * // 在 ConfigProvider 中使用
 * <ConfigProvider theme={antdTheme}>
 *   <App />
 * </ConfigProvider>
 * 
 * // 选择性订阅
 * const isDark = useThemeStore(state => state.isDark);
 * ```
 */
export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => {
      const initialMode: ThemeMode = 'dark';
      const initialDensity: DensityMode = 'comfortable';
      
      return {
        // 初始状态
        themeMode: initialMode,
        density: initialDensity,
        isDark: computeIsDark(initialMode),
        colors: getColorsForMode(initialMode),
        antdTheme: generateAntdTheme(initialMode, initialDensity),

        /**
         * 设置主题模式
         */
        setThemeMode: (mode: ThemeMode) => {
          const density = get().density;
          set({
            themeMode: mode,
            isDark: computeIsDark(mode),
            colors: getColorsForMode(mode),
            antdTheme: generateAntdTheme(mode, density),
          });
        },

        /**
         * 设置视觉密度
         */
        setDensity: (density: DensityMode) => {
          const mode = get().themeMode;
          set({
            density,
            antdTheme: generateAntdTheme(mode, density),
          });
        },

        /**
         * 切换暗色/亮色模式
         */
        toggleTheme: () => {
          const currentMode = get().themeMode;
          const newMode: ThemeMode = currentMode === 'dark' ? 'light' : 'dark';
          get().setThemeMode(newMode);
        },
      };
    },
    {
      name: THEME_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // 只持久化模式和密度，其他属性在加载时重新计算
      partialize: (state) => ({
        themeMode: state.themeMode,
        density: state.density,
      }),
      // 加载后重新计算派生属性
      onRehydrateStorage: () => (state) => {
        if (state) {
          const mode = state.themeMode;
          const density = state.density;
          state.isDark = computeIsDark(mode);
          state.colors = getColorsForMode(mode);
          state.antdTheme = generateAntdTheme(mode, density);
        }
      },
    }
  )
);

// ============================================================================
// 选择器 Hooks（用于性能优化）
// ============================================================================

/**
 * 获取当前主题模式
 */
export const useThemeMode = () => useThemeStore(state => state.themeMode);

/**
 * 获取是否为暗色模式
 */
export const useIsDark = () => useThemeStore(state => state.isDark);

/**
 * 获取当前密度
 */
export const useDensity = () => useThemeStore(state => state.density);

/**
 * 获取 Ant Design 主题配置
 */
export const useAntdTheme = () => useThemeStore(state => state.antdTheme);

/**
 * 获取当前主题颜色
 */
export const useThemeColors = () => useThemeStore(state => state.colors);

/**
 * 获取主题操作
 */
export const useThemeActions = () => useThemeStore(state => ({
  setThemeMode: state.setThemeMode,
  setDensity: state.setDensity,
  toggleTheme: state.toggleTheme,
}));

// ============================================================================
// 系统主题变化监听
// ============================================================================

/**
 * 监听系统主题变化（用于 auto 模式）
 */
function setupSystemThemeListener() {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    mediaQuery.addEventListener('change', () => {
      const state = useThemeStore.getState();
      if (state.themeMode === 'auto') {
        // 重新计算 auto 模式下的主题
        state.setThemeMode('auto');
      }
    });
  } catch {
    // 在测试环境或不支持 matchMedia 的环境中忽略
  }
}

// 延迟初始化监听器，避免在模块加载时执行
if (typeof window !== 'undefined') {
  // 使用 setTimeout 确保在 DOM 完全加载后执行
  setTimeout(setupSystemThemeListener, 0);
}

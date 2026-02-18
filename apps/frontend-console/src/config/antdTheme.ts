/**
 * Ant Design 主题配置
 * 
 * 定义主色调、暗色/亮色模式色彩方案
 * 
 * @requirements 5.2, 5.3, 2.3
 */

import type { ThemeConfig } from 'antd';
import { theme as antdTheme } from 'antd';
import type { ThemeMode, DensityMode } from '@/types/theme';

/**
 * 主色调配置
 */
export const PRIMARY_COLOR = '#135bec';

/**
 * 深色主题 Token
 */
export const darkThemeTokens = {
  colorPrimary: PRIMARY_COLOR,
  colorSuccess: '#10b981',
  colorWarning: '#f59e0b',
  colorError: '#ef4444',
  colorInfo: '#3b82f6',
  colorBgContainer: '#1e293b',
  colorBgElevated: '#1e293b',
  colorBgLayout: '#0f172a',
  colorText: '#f8fafc',
  colorTextSecondary: '#94a3b8',
  colorTextTertiary: '#64748b',
  colorBorder: '#334155',
  colorBorderSecondary: '#475569',
  borderRadius: 6,
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
};

/**
 * 浅色主题 Token
 */
export const lightThemeTokens = {
  colorPrimary: PRIMARY_COLOR,
  colorSuccess: '#10b981',
  colorWarning: '#f59e0b',
  colorError: '#ef4444',
  colorInfo: '#3b82f6',
  colorBgContainer: '#ffffff',
  colorBgElevated: '#ffffff',
  colorBgLayout: '#f8fafc',
  colorText: '#0f172a',
  colorTextSecondary: '#475569',
  colorTextTertiary: '#94a3b8',
  colorBorder: '#e2e8f0',
  colorBorderSecondary: '#cbd5e1',
  borderRadius: 6,
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
};

/**
 * 高对比度主题 Token
 */
export const highContrastThemeTokens = {
  colorPrimary: '#0066ff',
  colorSuccess: '#00cc00',
  colorWarning: '#ffcc00',
  colorError: '#ff0000',
  colorInfo: '#0099ff',
  colorBgContainer: '#1a1a1a',
  colorBgElevated: '#1a1a1a',
  colorBgLayout: '#000000',
  colorText: '#ffffff',
  colorTextSecondary: '#cccccc',
  colorTextTertiary: '#999999',
  colorBorder: '#666666',
  colorBorderSecondary: '#808080',
  borderRadius: 6,
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
};

/**
 * 深色主题组件配置
 */
export const darkComponentsConfig = {
  Layout: {
    headerBg: '#1e293b',
    siderBg: '#1e293b',
    bodyBg: '#0f172a',
  },
  Menu: {
    darkItemBg: '#1e293b',
    darkSubMenuItemBg: '#0f172a',
  },
  Card: {
    colorBgContainer: '#1e293b',
  },
};

/**
 * 浅色主题组件配置
 */
export const lightComponentsConfig = {
  Layout: {
    headerBg: '#ffffff',
    siderBg: '#ffffff',
    bodyBg: '#f8fafc',
  },
  Menu: {
    itemBg: '#ffffff',
    subMenuItemBg: '#f8fafc',
  },
  Card: {
    colorBgContainer: '#ffffff',
  },
};

/**
 * 根据主题模式和密度生成 Ant Design 主题配置
 */
export function generateAntdThemeConfig(
  mode: ThemeMode, 
  density: DensityMode
): ThemeConfig {
  const isDark = mode === 'dark' || mode === 'high-contrast' || 
    (mode === 'auto' && typeof window !== 'undefined' && 
     window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  // 选择 Token
  let tokens;
  if (mode === 'high-contrast') {
    tokens = highContrastThemeTokens;
  } else if (isDark) {
    tokens = darkThemeTokens;
  } else {
    tokens = lightThemeTokens;
  }
  
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

  // 密度相关的间距调整
  const spacingTokens = density === 'compact' ? {
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
  } : {};

  return {
    algorithm: algorithms.length === 1 ? algorithms[0] : algorithms,
    token: {
      ...tokens,
      ...spacingTokens,
    },
    components: isDark ? darkComponentsConfig : lightComponentsConfig,
  };
}

/**
 * 默认深色主题配置
 */
export const defaultDarkTheme: ThemeConfig = generateAntdThemeConfig('dark', 'comfortable');

/**
 * 默认浅色主题配置
 */
export const defaultLightTheme: ThemeConfig = generateAntdThemeConfig('light', 'comfortable');

/**
 * 主题系统类型定义
 * 
 * 适配 Ant Design 5.x 主题系统
 */

import type { ThemeConfig } from 'antd';

// ============================================================================
// 主题模式
// ============================================================================

/**
 * 主题模式
 */
export type ThemeMode = 'dark' | 'light' | 'high-contrast' | 'auto';

/**
 * 视觉密度模式
 */
export type DensityMode = 'comfortable' | 'compact' | 'spacious';

// ============================================================================
// 主题颜色
// ============================================================================

/**
 * 主题颜色配置
 */
export interface ThemeColors {
  /** 主色 */
  primary: string;
  /** 次要色 */
  secondary: string;
  /** 成功色 */
  success: string;
  /** 警告色 */
  warning: string;
  /** 危险色 */
  danger: string;
  /** 信息色 */
  info: string;
  /** 背景色 */
  background: string;
  /** 表面色 */
  surface: string;
  /** 表面悬停色 */
  surfaceHover: string;
  /** 文本主色 */
  text: string;
  /** 文本次要色 */
  textSecondary: string;
  /** 文本禁用色 */
  textMuted: string;
  /** 边框色 */
  border: string;
  /** 边框浅色 */
  borderLight: string;
}

/**
 * 深色主题颜色
 */
export const DARK_THEME_COLORS: ThemeColors = {
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
export const LIGHT_THEME_COLORS: ThemeColors = {
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
export const HIGH_CONTRAST_THEME_COLORS: ThemeColors = {
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
// 主题排版
// ============================================================================

/**
 * 主题排版配置
 */
export interface ThemeTypography {
  fontFamily: string;
  fontFamilyMono: string;
  fontSizeBase: string;
  fontSizeSm: string;
  fontSizeLg: string;
  fontSizeXl: string;
  fontWeightNormal: number;
  fontWeightMedium: number;
  fontWeightBold: number;
  lineHeightBase: number;
  lineHeightTight: number;
  lineHeightLoose: number;
}

/**
 * 默认排版配置
 */
export const DEFAULT_TYPOGRAPHY: ThemeTypography = {
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  fontFamilyMono: 'JetBrains Mono, Fira Code, monospace',
  fontSizeBase: '14px',
  fontSizeSm: '12px',
  fontSizeLg: '16px',
  fontSizeXl: '18px',
  fontWeightNormal: 400,
  fontWeightMedium: 500,
  fontWeightBold: 600,
  lineHeightBase: 1.5,
  lineHeightTight: 1.25,
  lineHeightLoose: 1.75,
};

// ============================================================================
// 主题间距
// ============================================================================

/**
 * 主题间距配置
 */
export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
}

/**
 * 舒适模式间距
 */
export const COMFORTABLE_SPACING: ThemeSpacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
};

/**
 * 紧凑模式间距
 */
export const COMPACT_SPACING: ThemeSpacing = {
  xs: '2px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
};

/**
 * 宽松模式间距
 */
export const SPACIOUS_SPACING: ThemeSpacing = {
  xs: '8px',
  sm: '12px',
  md: '24px',
  lg: '32px',
  xl: '48px',
  '2xl': '64px',
};

// ============================================================================
// 完整主题
// ============================================================================

/**
 * 完整主题配置
 */
export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  density: DensityMode;
}

/**
 * 自定义主题配置
 */
export interface CustomTheme {
  id: string;
  name: string;
  description?: string;
  colors: Partial<ThemeColors>;
  createdAt: number;
  updatedAt: number;
}

/**
 * 主题上下文值
 * 
 * 新增 antdTheme 属性用于 Ant Design ConfigProvider
 */
export interface ThemeContextValue {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  customTheme: Partial<ThemeColors> | null;
  setCustomTheme: (colors: Partial<ThemeColors> | null) => void;
  density: DensityMode;
  setDensity: (mode: DensityMode) => void;
  isDark: boolean;
  /** Ant Design 主题配置对象，用于 ConfigProvider */
  antdTheme: ThemeConfig;
}

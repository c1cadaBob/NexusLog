/**
 * 共享颜色/字体/间距常量
 * 所有主题配置（AntD、ECharts、Tailwind）都从这里引用颜色值
 */

// 语义色
export const COLORS = {
  primary: '#135bec',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
} as const;

// 深色主题色板
export const DARK_PALETTE = {
  bgLayout: '#0f172a',
  bgContainer: '#1e293b',
  bgElevated: '#1e293b',
  bgHover: '#334155',
  border: '#334155',
  borderSecondary: '#475569',
  text: '#f8fafc',
  textSecondary: '#94a3b8',
  textTertiary: '#64748b',
} as const;

// 浅色主题色板
export const LIGHT_PALETTE = {
  bgLayout: '#f8fafc',
  bgContainer: '#ffffff',
  bgElevated: '#ffffff',
  bgHover: '#f1f5f9',
  border: '#e2e8f0',
  borderSecondary: '#cbd5e1',
  text: '#0f172a',
  textSecondary: '#475569',
  textTertiary: '#94a3b8',
} as const;

// 字体
export const FONTS = {
  base: 'Inter, system-ui, -apple-system, sans-serif',
  code: 'JetBrains Mono, Fira Code, monospace',
} as const;

// 间距（密度模式）
export const DENSITY = {
  compact: { padding: 8, gap: 8, fontSize: 13 },
  comfortable: { padding: 16, gap: 16, fontSize: 14 },
  spacious: { padding: 24, gap: 24, fontSize: 15 },
} as const;

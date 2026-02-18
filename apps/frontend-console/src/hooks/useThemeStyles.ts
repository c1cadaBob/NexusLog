/**
 * 主题样式 Hook
 * 
 * 提供常用的主题感知样式类名，避免在每个组件中重复定义
 * 使用 Zustand Store 替代 Context API
 * 
 * @module hooks/useThemeStyles
 */

import { useMemo } from 'react';
import { useIsDark } from '@/stores';

export interface ThemeStyles {
  cardBg: string;
  surfaceBg: string;
  inputBg: string;
  border: string;
  borderLight: string;
  text: string;
  textSecondary: string;
  hoverBg: string;
  activeBg: string;
  tableHeaderBg: string;
  tableRowHover: string;
  tableDivide: string;
  codeBg: string;
  codeText: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;
  buttonSecondaryBg: string;
  buttonSecondaryHover: string;
  tagBg: string;
  divider: string;
  panelBg: string;
  panelHeaderBg: string;
  selectBg: string;
  checkboxBg: string;
  isDark: boolean;
}


/**
 * 获取主题感知的样式类名
 */
export function useThemeStyles(): ThemeStyles {
  // 使用 Zustand Store 替代 Context API
  const isDark = useIsDark();
  
  return useMemo(() => ({
    cardBg: isDark ? 'bg-[#1e293b]' : 'bg-white',
    surfaceBg: isDark ? 'bg-[#0f172a]' : 'bg-slate-50',
    inputBg: isDark ? 'bg-[#0f172a]' : 'bg-white',
    border: isDark ? 'border-border-dark' : 'border-slate-200',
    borderLight: isDark ? 'border-border-dark/50' : 'border-slate-100',
    text: isDark ? 'text-white' : 'text-slate-900',
    textSecondary: 'text-text-secondary',
    hoverBg: isDark ? 'hover:bg-[#334155]' : 'hover:bg-slate-50',
    activeBg: isDark ? 'bg-white/5' : 'bg-slate-100',
    tableHeaderBg: isDark ? 'bg-[#1a2332]' : 'bg-slate-50',
    tableRowHover: isDark ? 'hover:bg-[#232f48]' : 'hover:bg-slate-50',
    tableDivide: isDark ? 'divide-border-dark' : 'divide-slate-200',
    codeBg: isDark ? 'bg-[#0f172a]' : 'bg-slate-100',
    codeText: isDark ? 'text-slate-300' : 'text-slate-700',
    inputBorder: isDark ? 'border-border-dark' : 'border-slate-200',
    inputText: isDark ? 'text-white' : 'text-slate-900',
    inputPlaceholder: isDark ? 'placeholder-text-secondary' : 'placeholder-slate-400',
    buttonSecondaryBg: isDark ? 'bg-[#0f172a]' : 'bg-slate-100',
    buttonSecondaryHover: isDark ? 'hover:bg-[#334155]' : 'hover:bg-slate-200',
    tagBg: isDark ? 'bg-[#334155]' : 'bg-slate-100',
    divider: isDark ? 'bg-border-dark' : 'bg-slate-200',
    panelBg: isDark ? 'bg-[#1e293b]' : 'bg-white',
    panelHeaderBg: isDark ? 'bg-[#0f172a]/50' : 'bg-slate-50',
    selectBg: isDark ? 'bg-[#232f48]' : 'bg-white',
    checkboxBg: isDark ? 'bg-[#111722]' : 'bg-white',
    isDark,
  }), [isDark]);
}

export default useThemeStyles;

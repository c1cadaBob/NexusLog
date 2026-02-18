/**
 * 颜色对比度验证工具
 * 
 * 用于验证所有文本/背景颜色组合是否符合 WCAG AA 标准
 */

import { getRelativeLuminance, getContrastRatio, meetsWCAGAA, meetsWCAGAAA } from './accessibility';

// ============================================================================
// 类型定义
// ============================================================================

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface ColorDefinition {
  name: string;
  hex: string;
  rgb: RGB;
}

export interface ContrastResult {
  foreground: ColorDefinition;
  background: ColorDefinition;
  ratio: number;
  meetsAA: boolean;
  meetsAALargeText: boolean;
  meetsAAA: boolean;
  meetsAAALargeText: boolean;
}

export interface ContrastReport {
  passed: ContrastResult[];
  failed: ContrastResult[];
  warnings: ContrastResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    passRate: number;
  };
}

// ============================================================================
// 颜色转换工具
// ============================================================================

/**
 * 将十六进制颜色转换为 RGB
 */
export function hexToRgb(hex: string): RGB {
  // 移除 # 前缀
  const cleanHex = hex.replace(/^#/, '');
  
  // 处理简写形式 (如 #fff)
  const fullHex = cleanHex.length === 3
    ? cleanHex.split('').map(c => c + c).join('')
    : cleanHex;
  
  const num = parseInt(fullHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * 将 RGB 转换为十六进制颜色
 */
export function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * 解析 CSS 颜色值
 * 支持 hex、rgb、rgba 格式
 */
export function parseColor(color: string): RGB | null {
  // 十六进制格式
  if (color.startsWith('#')) {
    return hexToRgb(color);
  }
  
  // rgb/rgba 格式
  const rgbMatch = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }
  
  return null;
}

// ============================================================================
// 项目颜色定义
// ============================================================================

/**
 * 深色主题颜色
 */
export const DARK_THEME_COLORS: ColorDefinition[] = [
  // 背景色
  { name: 'bg-primary', hex: '#0b1121', rgb: hexToRgb('#0b1121') },
  { name: 'bg-card', hex: '#1e293b', rgb: hexToRgb('#1e293b') },
  { name: 'bg-surface', hex: '#0f172a', rgb: hexToRgb('#0f172a') },
  { name: 'bg-hover', hex: '#334155', rgb: hexToRgb('#334155') },
  
  // 文本色
  { name: 'text-primary', hex: '#f8fafc', rgb: hexToRgb('#f8fafc') },
  { name: 'text-secondary', hex: '#94a3b8', rgb: hexToRgb('#94a3b8') },
  { name: 'text-muted', hex: '#64748b', rgb: hexToRgb('#64748b') },
  
  // 主色调
  { name: 'primary', hex: '#135bec', rgb: hexToRgb('#135bec') },
  { name: 'primary-400', hex: '#60a5fa', rgb: hexToRgb('#60a5fa') },
  { name: 'primary-500', hex: '#3b82f6', rgb: hexToRgb('#3b82f6') },
  
  // 语义色
  { name: 'success', hex: '#10b981', rgb: hexToRgb('#10b981') },
  { name: 'success-400', hex: '#34d399', rgb: hexToRgb('#34d399') },
  { name: 'warning', hex: '#f59e0b', rgb: hexToRgb('#f59e0b') },
  { name: 'warning-400', hex: '#fbbf24', rgb: hexToRgb('#fbbf24') },
  { name: 'danger', hex: '#ef4444', rgb: hexToRgb('#ef4444') },
  { name: 'danger-400', hex: '#f87171', rgb: hexToRgb('#f87171') },
  { name: 'info', hex: '#3b82f6', rgb: hexToRgb('#3b82f6') },
  
  // 边框色
  { name: 'border', hex: '#334155', rgb: hexToRgb('#334155') },
  { name: 'border-light', hex: '#475569', rgb: hexToRgb('#475569') },
];

/**
 * 浅色主题颜色
 */
export const LIGHT_THEME_COLORS: ColorDefinition[] = [
  // 背景色
  { name: 'bg-primary', hex: '#f8fafc', rgb: hexToRgb('#f8fafc') },
  { name: 'bg-card', hex: '#ffffff', rgb: hexToRgb('#ffffff') },
  { name: 'bg-surface', hex: '#f1f5f9', rgb: hexToRgb('#f1f5f9') },
  { name: 'bg-hover', hex: '#e2e8f0', rgb: hexToRgb('#e2e8f0') },
  
  // 文本色
  { name: 'text-primary', hex: '#0f172a', rgb: hexToRgb('#0f172a') },
  { name: 'text-secondary', hex: '#475569', rgb: hexToRgb('#475569') },
  { name: 'text-muted', hex: '#94a3b8', rgb: hexToRgb('#94a3b8') },
  
  // 主色调
  { name: 'primary', hex: '#135bec', rgb: hexToRgb('#135bec') },
  { name: 'primary-600', hex: '#2563eb', rgb: hexToRgb('#2563eb') },
  { name: 'primary-700', hex: '#1d4ed8', rgb: hexToRgb('#1d4ed8') },
  
  // 语义色
  { name: 'success', hex: '#10b981', rgb: hexToRgb('#10b981') },
  { name: 'success-600', hex: '#059669', rgb: hexToRgb('#059669') },
  { name: 'warning', hex: '#f59e0b', rgb: hexToRgb('#f59e0b') },
  { name: 'warning-600', hex: '#d97706', rgb: hexToRgb('#d97706') },
  { name: 'danger', hex: '#ef4444', rgb: hexToRgb('#ef4444') },
  { name: 'danger-600', hex: '#dc2626', rgb: hexToRgb('#dc2626') },
  { name: 'info', hex: '#3b82f6', rgb: hexToRgb('#3b82f6') },
  
  // 边框色
  { name: 'border', hex: '#e2e8f0', rgb: hexToRgb('#e2e8f0') },
  { name: 'border-dark', hex: '#cbd5e1', rgb: hexToRgb('#cbd5e1') },
];

// ============================================================================
// 常用颜色组合定义
// ============================================================================

export interface ColorCombination {
  foreground: string;
  background: string;
  usage: string;
  isLargeText?: boolean;
}

/**
 * 深色主题常用颜色组合
 */
export const DARK_THEME_COMBINATIONS: ColorCombination[] = [
  // 主要文本
  { foreground: '#f8fafc', background: '#0b1121', usage: '主要文本在主背景上' },
  { foreground: '#f8fafc', background: '#1e293b', usage: '主要文本在卡片背景上' },
  { foreground: '#f8fafc', background: '#0f172a', usage: '主要文本在表面背景上' },
  { foreground: '#f8fafc', background: '#334155', usage: '主要文本在悬停背景上' },
  
  // 次要文本
  { foreground: '#94a3b8', background: '#0b1121', usage: '次要文本在主背景上' },
  { foreground: '#94a3b8', background: '#1e293b', usage: '次要文本在卡片背景上' },
  { foreground: '#94a3b8', background: '#0f172a', usage: '次要文本在表面背景上' },
  
  // 静音文本
  { foreground: '#64748b', background: '#0b1121', usage: '静音文本在主背景上' },
  { foreground: '#64748b', background: '#1e293b', usage: '静音文本在卡片背景上' },
  
  // 主色调文本
  { foreground: '#3b82f6', background: '#0b1121', usage: '链接/主色调在主背景上' },
  { foreground: '#3b82f6', background: '#1e293b', usage: '链接/主色调在卡片背景上' },
  { foreground: '#60a5fa', background: '#0b1121', usage: '浅主色调在主背景上' },
  
  // 语义色文本
  { foreground: '#10b981', background: '#0b1121', usage: '成功色在主背景上' },
  { foreground: '#10b981', background: '#1e293b', usage: '成功色在卡片背景上' },
  { foreground: '#34d399', background: '#0b1121', usage: '浅成功色在主背景上' },
  
  { foreground: '#f59e0b', background: '#0b1121', usage: '警告色在主背景上' },
  { foreground: '#f59e0b', background: '#1e293b', usage: '警告色在卡片背景上' },
  { foreground: '#fbbf24', background: '#0b1121', usage: '浅警告色在主背景上' },
  
  { foreground: '#ef4444', background: '#0b1121', usage: '危险色在主背景上' },
  { foreground: '#ef4444', background: '#1e293b', usage: '危险色在卡片背景上' },
  { foreground: '#f87171', background: '#0b1121', usage: '浅危险色在主背景上' },
  
  // 按钮文本 - 使用符合 WCAG AA 标准的颜色
  { foreground: '#ffffff', background: '#135bec', usage: '白色文本在主按钮上' },
  { foreground: '#ffffff', background: '#3b82f6', usage: '白色文本在蓝色按钮上' },
  { foreground: '#ffffff', background: '#047857', usage: '白色文本在成功按钮上' },
  { foreground: '#ffffff', background: '#dc2626', usage: '白色文本在危险按钮上' },
  { foreground: '#0f172a', background: '#f59e0b', usage: '深色文本在警告按钮上' },
  
  // 大文本（标题等）
  { foreground: '#f8fafc', background: '#0b1121', usage: '标题文本', isLargeText: true },
  { foreground: '#94a3b8', background: '#0b1121', usage: '副标题文本', isLargeText: true },
];

/**
 * 浅色主题常用颜色组合
 */
export const LIGHT_THEME_COMBINATIONS: ColorCombination[] = [
  // 主要文本
  { foreground: '#0f172a', background: '#f8fafc', usage: '主要文本在主背景上' },
  { foreground: '#0f172a', background: '#ffffff', usage: '主要文本在卡片背景上' },
  { foreground: '#0f172a', background: '#f1f5f9', usage: '主要文本在表面背景上' },
  { foreground: '#0f172a', background: '#e2e8f0', usage: '主要文本在悬停背景上' },
  
  // 次要文本
  { foreground: '#475569', background: '#f8fafc', usage: '次要文本在主背景上' },
  { foreground: '#475569', background: '#ffffff', usage: '次要文本在卡片背景上' },
  { foreground: '#475569', background: '#f1f5f9', usage: '次要文本在表面背景上' },
  
  // 静音文本 - 使用更深的颜色以确保对比度
  { foreground: '#64748b', background: '#f8fafc', usage: '静音文本在主背景上' },
  { foreground: '#64748b', background: '#ffffff', usage: '静音文本在卡片背景上' },
  
  // 主色调文本
  { foreground: '#2563eb', background: '#f8fafc', usage: '链接/主色调在主背景上' },
  { foreground: '#2563eb', background: '#ffffff', usage: '链接/主色调在卡片背景上' },
  { foreground: '#1d4ed8', background: '#f8fafc', usage: '深主色调在主背景上' },
  
  // 语义色文本
  { foreground: '#059669', background: '#f8fafc', usage: '成功色在主背景上' },
  { foreground: '#059669', background: '#ffffff', usage: '成功色在卡片背景上' },
  
  { foreground: '#d97706', background: '#f8fafc', usage: '警告色在主背景上' },
  { foreground: '#d97706', background: '#ffffff', usage: '警告色在卡片背景上' },
  
  { foreground: '#dc2626', background: '#f8fafc', usage: '危险色在主背景上' },
  { foreground: '#dc2626', background: '#ffffff', usage: '危险色在卡片背景上' },
  
  // 按钮文本 - 使用符合 WCAG AA 标准的颜色
  { foreground: '#ffffff', background: '#135bec', usage: '白色文本在主按钮上' },
  { foreground: '#ffffff', background: '#2563eb', usage: '白色文本在蓝色按钮上' },
  { foreground: '#ffffff', background: '#047857', usage: '白色文本在成功按钮上' },
  { foreground: '#ffffff', background: '#dc2626', usage: '白色文本在危险按钮上' },
  { foreground: '#0f172a', background: '#fbbf24', usage: '深色文本在警告按钮上' },
  
  // 大文本（标题等）
  { foreground: '#0f172a', background: '#f8fafc', usage: '标题文本', isLargeText: true },
  { foreground: '#475569', background: '#f8fafc', usage: '副标题文本', isLargeText: true },
];

// ============================================================================
// 对比度验证函数
// ============================================================================

/**
 * 验证单个颜色组合
 */
export function validateColorCombination(
  foregroundHex: string,
  backgroundHex: string,
  isLargeText: boolean = false
): ContrastResult {
  const foregroundRgb = hexToRgb(foregroundHex);
  const backgroundRgb = hexToRgb(backgroundHex);
  
  const ratio = getContrastRatio(foregroundRgb, backgroundRgb);
  
  return {
    foreground: { name: '', hex: foregroundHex, rgb: foregroundRgb },
    background: { name: '', hex: backgroundHex, rgb: backgroundRgb },
    ratio: Math.round(ratio * 100) / 100,
    meetsAA: meetsWCAGAA(ratio, isLargeText),
    meetsAALargeText: meetsWCAGAA(ratio, true),
    meetsAAA: meetsWCAGAAA(ratio, isLargeText),
    meetsAAALargeText: meetsWCAGAAA(ratio, true),
  };
}

/**
 * 验证颜色组合列表
 */
export function validateColorCombinations(
  combinations: ColorCombination[]
): ContrastReport {
  const results: ContrastResult[] = combinations.map(combo => {
    const result = validateColorCombination(
      combo.foreground,
      combo.background,
      combo.isLargeText
    );
    result.foreground.name = combo.usage;
    return result;
  });
  
  const passed = results.filter(r => r.meetsAA);
  const failed = results.filter(r => !r.meetsAA && !r.meetsAALargeText);
  const warnings = results.filter(r => !r.meetsAA && r.meetsAALargeText);
  
  return {
    passed,
    failed,
    warnings,
    summary: {
      total: results.length,
      passed: passed.length,
      failed: failed.length,
      warnings: warnings.length,
      passRate: Math.round((passed.length / results.length) * 100),
    },
  };
}

/**
 * 验证深色主题
 */
export function validateDarkTheme(): ContrastReport {
  return validateColorCombinations(DARK_THEME_COMBINATIONS);
}

/**
 * 验证浅色主题
 */
export function validateLightTheme(): ContrastReport {
  return validateColorCombinations(LIGHT_THEME_COMBINATIONS);
}

/**
 * 验证所有主题
 */
export function validateAllThemes(): {
  dark: ContrastReport;
  light: ContrastReport;
  overall: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    passRate: number;
  };
} {
  const dark = validateDarkTheme();
  const light = validateLightTheme();
  
  const total = dark.summary.total + light.summary.total;
  const passed = dark.summary.passed + light.summary.passed;
  const failed = dark.summary.failed + light.summary.failed;
  const warnings = dark.summary.warnings + light.summary.warnings;
  
  return {
    dark,
    light,
    overall: {
      total,
      passed,
      failed,
      warnings,
      passRate: Math.round((passed / total) * 100),
    },
  };
}

// ============================================================================
// 颜色建议函数
// ============================================================================

/**
 * 调整颜色以达到目标对比度
 */
export function adjustColorForContrast(
  foregroundHex: string,
  backgroundHex: string,
  targetRatio: number = 4.5,
  adjustForeground: boolean = true
): string {
  const foregroundRgb = hexToRgb(foregroundHex);
  const backgroundRgb = hexToRgb(backgroundHex);
  
  const currentRatio = getContrastRatio(foregroundRgb, backgroundRgb);
  
  if (currentRatio >= targetRatio) {
    return adjustForeground ? foregroundHex : backgroundHex;
  }
  
  const bgLuminance = getRelativeLuminance(backgroundRgb.r, backgroundRgb.g, backgroundRgb.b);
  const isDarkBackground = bgLuminance < 0.5;
  
  // 调整颜色
  const colorToAdjust = adjustForeground ? foregroundRgb : backgroundRgb;
  let step = isDarkBackground ? 10 : -10;
  
  if (!adjustForeground) {
    step = -step;
  }
  
  let adjustedColor = { ...colorToAdjust };
  let iterations = 0;
  const maxIterations = 50;
  
  while (iterations < maxIterations) {
    adjustedColor = {
      r: Math.max(0, Math.min(255, adjustedColor.r + step)),
      g: Math.max(0, Math.min(255, adjustedColor.g + step)),
      b: Math.max(0, Math.min(255, adjustedColor.b + step)),
    };
    
    const newRatio = adjustForeground
      ? getContrastRatio(adjustedColor, backgroundRgb)
      : getContrastRatio(foregroundRgb, adjustedColor);
    
    if (newRatio >= targetRatio) {
      break;
    }
    
    iterations++;
  }
  
  return rgbToHex(adjustedColor);
}

/**
 * 获取推荐的替代颜色
 */
export function getSuggestedColors(
  foregroundHex: string,
  backgroundHex: string,
  targetRatio: number = 4.5
): {
  adjustedForeground: string;
  adjustedBackground: string;
  currentRatio: number;
  targetRatio: number;
} {
  const foregroundRgb = hexToRgb(foregroundHex);
  const backgroundRgb = hexToRgb(backgroundHex);
  const currentRatio = getContrastRatio(foregroundRgb, backgroundRgb);
  
  return {
    adjustedForeground: adjustColorForContrast(foregroundHex, backgroundHex, targetRatio, true),
    adjustedBackground: adjustColorForContrast(foregroundHex, backgroundHex, targetRatio, false),
    currentRatio: Math.round(currentRatio * 100) / 100,
    targetRatio,
  };
}

// ============================================================================
// 报告生成函数
// ============================================================================

/**
 * 生成对比度报告文本
 */
export function generateContrastReport(report: ContrastReport, themeName: string): string {
  const lines: string[] = [
    `\n${'='.repeat(60)}`,
    `${themeName} 主题颜色对比度报告`,
    `${'='.repeat(60)}`,
    '',
    `总计: ${report.summary.total} 个颜色组合`,
    `通过: ${report.summary.passed} (${report.summary.passRate}%)`,
    `失败: ${report.summary.failed}`,
    `警告: ${report.summary.warnings} (仅大文本通过)`,
    '',
  ];
  
  if (report.failed.length > 0) {
    lines.push('❌ 失败的颜色组合:');
    lines.push('-'.repeat(40));
    report.failed.forEach(result => {
      lines.push(`  用途: ${result.foreground.name}`);
      lines.push(`  前景: ${result.foreground.hex}`);
      lines.push(`  背景: ${result.background.hex}`);
      lines.push(`  对比度: ${result.ratio}:1 (需要 >= 4.5:1)`);
      
      const suggestion = getSuggestedColors(result.foreground.hex, result.background.hex);
      lines.push(`  建议前景色: ${suggestion.adjustedForeground}`);
      lines.push('');
    });
  }
  
  if (report.warnings.length > 0) {
    lines.push('⚠️ 警告的颜色组合 (仅大文本通过):');
    lines.push('-'.repeat(40));
    report.warnings.forEach(result => {
      lines.push(`  用途: ${result.foreground.name}`);
      lines.push(`  前景: ${result.foreground.hex}`);
      lines.push(`  背景: ${result.background.hex}`);
      lines.push(`  对比度: ${result.ratio}:1 (大文本需要 >= 3:1, 普通文本需要 >= 4.5:1)`);
      lines.push('');
    });
  }
  
  if (report.passed.length > 0) {
    lines.push('✅ 通过的颜色组合:');
    lines.push('-'.repeat(40));
    report.passed.forEach(result => {
      lines.push(`  ${result.foreground.name}: ${result.ratio}:1`);
    });
  }
  
  return lines.join('\n');
}

/**
 * 运行完整的颜色对比度验证
 */
export function runContrastValidation(): void {
  console.log('\n🎨 开始颜色对比度验证...\n');
  
  const results = validateAllThemes();
  
  console.log(generateContrastReport(results.dark, '深色'));
  console.log(generateContrastReport(results.light, '浅色'));
  
  console.log('\n' + '='.repeat(60));
  console.log('总体结果');
  console.log('='.repeat(60));
  console.log(`总计: ${results.overall.total} 个颜色组合`);
  console.log(`通过: ${results.overall.passed} (${results.overall.passRate}%)`);
  console.log(`失败: ${results.overall.failed}`);
  console.log(`警告: ${results.overall.warnings}`);
  
  if (results.overall.failed === 0) {
    console.log('\n✅ 所有颜色组合都符合 WCAG AA 标准!');
  } else {
    console.log('\n❌ 部分颜色组合不符合 WCAG AA 标准，请查看上方详细报告。');
  }
}

export default {
  hexToRgb,
  rgbToHex,
  parseColor,
  validateColorCombination,
  validateColorCombinations,
  validateDarkTheme,
  validateLightTheme,
  validateAllThemes,
  adjustColorForContrast,
  getSuggestedColors,
  generateContrastReport,
  runContrastValidation,
  DARK_THEME_COLORS,
  LIGHT_THEME_COLORS,
  DARK_THEME_COMBINATIONS,
  LIGHT_THEME_COMBINATIONS,
};

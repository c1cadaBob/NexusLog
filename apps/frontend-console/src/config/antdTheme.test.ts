/**
 * 主题切换一致性属性测试
 * 
 * Property 6: 主题切换一致性
 * Validates: Requirements 5.3, 6.5
 * 
 * 对于任意主题模式（dark/light），切换主题后，
 * Ant Design ConfigProvider 的 theme.algorithm 和 ECharts 图表实例的主题配置
 * 应该同步更新为对应模式的配色方案。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { theme as antdTheme } from 'antd';
import { useThemeStore } from '@/stores/useThemeStore';
import { 
  generateAntdThemeConfig, 
  darkThemeTokens, 
  lightThemeTokens,
  highContrastThemeTokens,
} from './antdTheme';
import type { ThemeMode, DensityMode } from '@/types/theme';

// ============================================================================
// 测试辅助函数
// ============================================================================

/**
 * 重置 store 到初始状态
 */
function resetStore() {
  useThemeStore.setState({
    themeMode: 'dark',
    density: 'comfortable',
    isDark: true,
    colors: {
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
    },
    antdTheme: useThemeStore.getState().antdTheme,
  });
}

/**
 * 有效的主题模式（不包含 auto，因为 auto 依赖系统设置）
 */
const themeModes: ThemeMode[] = ['dark', 'light', 'high-contrast'];

/**
 * 有效的密度模式
 */
const densityModes: DensityMode[] = ['comfortable', 'compact', 'spacious'];

/**
 * 生成有效的主题模式
 */
const themeModeArb = fc.constantFrom(...themeModes);

/**
 * 生成有效的密度模式
 */
const densityModeArb = fc.constantFrom(...densityModes);

/**
 * 检查算法是否包含 darkAlgorithm
 */
function containsDarkAlgorithm(algorithm: unknown): boolean {
  if (Array.isArray(algorithm)) {
    return algorithm.some(alg => alg === antdTheme.darkAlgorithm);
  }
  return algorithm === antdTheme.darkAlgorithm;
}

/**
 * 检查算法是否包含 compactAlgorithm
 */
function containsCompactAlgorithm(algorithm: unknown): boolean {
  if (Array.isArray(algorithm)) {
    return algorithm.some(alg => alg === antdTheme.compactAlgorithm);
  }
  return algorithm === antdTheme.compactAlgorithm;
}

/**
 * 获取 ECharts 主题名称（基于主题模式）
 */
function getEChartsThemeName(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'dark' || mode === 'high-contrast') {
    return 'dark';
  }
  return 'light';
}

// ============================================================================
// 属性测试
// ============================================================================

describe('Property 6: 主题切换一致性', () => {
  beforeEach(() => {
    resetStore();
    localStorage.clear();
  });

  /**
   * Property 6: 主题切换一致性
   * 
   * 对于任意主题模式（dark/light），切换主题后，
   * Ant Design ConfigProvider 的 theme.algorithm 和 ECharts 图表实例的主题配置
   * 应该同步更新为对应模式的配色方案。
   * 
   * **Validates: Requirements 5.3, 6.5**
   */
  describe('Ant Design 主题算法一致性', () => {
    it('dark 模式应使用 darkAlgorithm', () => {
      fc.assert(
        fc.property(densityModeArb, (density) => {
          resetStore();
          
          useThemeStore.getState().setThemeMode('dark');
          useThemeStore.getState().setDensity(density);
          
          const state = useThemeStore.getState();
          const algorithm = state.antdTheme.algorithm;
          
          // dark 模式应包含 darkAlgorithm
          expect(containsDarkAlgorithm(algorithm)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('light 模式不应使用 darkAlgorithm', () => {
      fc.assert(
        fc.property(densityModeArb, (density) => {
          resetStore();
          
          useThemeStore.getState().setThemeMode('light');
          useThemeStore.getState().setDensity(density);
          
          const state = useThemeStore.getState();
          const algorithm = state.antdTheme.algorithm;
          
          // light 模式不应包含 darkAlgorithm
          expect(containsDarkAlgorithm(algorithm)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('high-contrast 模式应使用 darkAlgorithm', () => {
      fc.assert(
        fc.property(densityModeArb, (density) => {
          resetStore();
          
          useThemeStore.getState().setThemeMode('high-contrast');
          useThemeStore.getState().setDensity(density);
          
          const state = useThemeStore.getState();
          const algorithm = state.antdTheme.algorithm;
          
          // high-contrast 模式应包含 darkAlgorithm
          expect(containsDarkAlgorithm(algorithm)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('compact 密度应使用 compactAlgorithm', () => {
      fc.assert(
        fc.property(themeModeArb, (mode) => {
          resetStore();
          
          useThemeStore.getState().setThemeMode(mode);
          useThemeStore.getState().setDensity('compact');
          
          const state = useThemeStore.getState();
          const algorithm = state.antdTheme.algorithm;
          
          // compact 密度应包含 compactAlgorithm
          expect(containsCompactAlgorithm(algorithm)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Ant Design Token 一致性', () => {
    it('主题切换后 Token 应与主题模式匹配', () => {
      fc.assert(
        fc.property(themeModeArb, densityModeArb, (mode, density) => {
          resetStore();
          
          useThemeStore.getState().setThemeMode(mode);
          useThemeStore.getState().setDensity(density);
          
          const state = useThemeStore.getState();
          const token = state.antdTheme.token;
          
          // 验证 Token 存在
          expect(token).toBeDefined();
          expect(token?.colorPrimary).toBeDefined();
          expect(token?.colorBgContainer).toBeDefined();
          expect(token?.colorText).toBeDefined();
          
          // 验证 Token 与主题模式匹配
          if (mode === 'dark') {
            expect(token?.colorPrimary).toBe(darkThemeTokens.colorPrimary);
            expect(token?.colorBgContainer).toBe(darkThemeTokens.colorBgContainer);
          } else if (mode === 'light') {
            expect(token?.colorPrimary).toBe(lightThemeTokens.colorPrimary);
            expect(token?.colorBgContainer).toBe(lightThemeTokens.colorBgContainer);
          } else if (mode === 'high-contrast') {
            expect(token?.colorPrimary).toBe(highContrastThemeTokens.colorPrimary);
            expect(token?.colorBgContainer).toBe(highContrastThemeTokens.colorBgContainer);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('ECharts 主题一致性', () => {
    it('ECharts 主题名称应与 Ant Design 主题模式同步', () => {
      fc.assert(
        fc.property(themeModeArb, (mode) => {
          resetStore();
          
          useThemeStore.getState().setThemeMode(mode);
          
          const state = useThemeStore.getState();
          const echartsTheme = getEChartsThemeName(mode);
          
          // 验证 ECharts 主题与 isDark 一致
          if (state.isDark) {
            expect(echartsTheme).toBe('dark');
          } else {
            expect(echartsTheme).toBe('light');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('主题颜色应与 ECharts 配色方案一致', () => {
      fc.assert(
        fc.property(themeModeArb, (mode) => {
          resetStore();
          
          useThemeStore.getState().setThemeMode(mode);
          
          const state = useThemeStore.getState();
          
          // 验证主色调一致
          expect(state.colors.primary).toBe(state.antdTheme.token?.colorPrimary);
          
          // 验证背景色与主题模式一致
          if (mode === 'dark') {
            expect(state.colors.background).toBe('#0f172a');
          } else if (mode === 'light') {
            expect(state.colors.background).toBe('#f8fafc');
          } else if (mode === 'high-contrast') {
            expect(state.colors.background).toBe('#000000');
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('generateAntdThemeConfig 函数一致性', () => {
    it('生成的配置应与 Store 中的配置一致', () => {
      fc.assert(
        fc.property(themeModeArb, densityModeArb, (mode, density) => {
          resetStore();
          
          useThemeStore.getState().setThemeMode(mode);
          useThemeStore.getState().setDensity(density);
          
          const storeTheme = useThemeStore.getState().antdTheme;
          const generatedTheme = generateAntdThemeConfig(mode, density);
          
          // 验证 Token 一致
          expect(storeTheme.token?.colorPrimary).toBe(generatedTheme.token?.colorPrimary);
          expect(storeTheme.token?.colorBgContainer).toBe(generatedTheme.token?.colorBgContainer);
          
          // 验证算法类型一致
          const storeHasDark = containsDarkAlgorithm(storeTheme.algorithm);
          const generatedHasDark = containsDarkAlgorithm(generatedTheme.algorithm);
          expect(storeHasDark).toBe(generatedHasDark);
          
          const storeHasCompact = containsCompactAlgorithm(storeTheme.algorithm);
          const generatedHasCompact = containsCompactAlgorithm(generatedTheme.algorithm);
          expect(storeHasCompact).toBe(generatedHasCompact);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('主题切换 round-trip 属性', () => {
    it('切换主题后再切换回来应恢复原配置', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('dark', 'light') as fc.Arbitrary<ThemeMode>,
          densityModeArb,
          (initialMode, density) => {
            resetStore();
            
            // 设置初始状态
            useThemeStore.getState().setThemeMode(initialMode);
            useThemeStore.getState().setDensity(density);
            
            const originalToken = { ...useThemeStore.getState().antdTheme.token };
            const originalIsDark = useThemeStore.getState().isDark;
            
            // 切换到另一个主题
            const otherMode: ThemeMode = initialMode === 'dark' ? 'light' : 'dark';
            useThemeStore.getState().setThemeMode(otherMode);
            
            // 验证已切换
            expect(useThemeStore.getState().isDark).not.toBe(originalIsDark);
            
            // 切换回原主题
            useThemeStore.getState().setThemeMode(initialMode);
            
            // 验证恢复原状态
            expect(useThemeStore.getState().isDark).toBe(originalIsDark);
            expect(useThemeStore.getState().antdTheme.token?.colorPrimary).toBe(originalToken.colorPrimary);
            expect(useThemeStore.getState().antdTheme.token?.colorBgContainer).toBe(originalToken.colorBgContainer);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

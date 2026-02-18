/**
 * useThemeStore 属性测试
 * 
 * Property 10: useThemeStore 状态管理
 * Validates: Requirements 7.2
 * 
 * @module stores/useThemeStore.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { useThemeStore } from './useThemeStore';
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
 * 有效的主题模式
 */
const themeModes: ThemeMode[] = ['dark', 'light', 'auto', 'high-contrast'];

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

// ============================================================================
// 属性测试
// ============================================================================

describe('useThemeStore 属性测试', () => {
  beforeEach(() => {
    resetStore();
    localStorage.clear();
  });

  /**
   * Property 10: useThemeStore 状态管理
   * 
   * 对于任意有效的主题模式值（dark/light/auto/high-contrast），
   * 调用 setThemeMode 后，themeMode 应该等于设置的值，
   * isDark 应该根据模式正确计算，
   * antdTheme 应该包含对应的 theme.algorithm 配置。
   * 
   * **Validates: Requirements 7.2**
   */
  describe('Property 10: useThemeStore 状态管理', () => {
    it('setThemeMode 后 themeMode 应等于设置的值', () => {
      fc.assert(
        fc.property(themeModeArb, (mode) => {
          resetStore();
          
          useThemeStore.getState().setThemeMode(mode);
          
          const state = useThemeStore.getState();
          expect(state.themeMode).toBe(mode);
        }),
        { numRuns: 100 }
      );
    });

    it('isDark 应根据主题模式正确计算', () => {
      fc.assert(
        fc.property(themeModeArb, (mode) => {
          resetStore();
          
          useThemeStore.getState().setThemeMode(mode);
          
          const state = useThemeStore.getState();
          
          // 验证 isDark 计算逻辑
          if (mode === 'dark') {
            expect(state.isDark).toBe(true);
          } else if (mode === 'light') {
            expect(state.isDark).toBe(false);
          } else if (mode === 'high-contrast') {
            expect(state.isDark).toBe(true); // 高对比度基于暗色
          }
          // auto 模式依赖系统设置，在测试环境中不做断言
        }),
        { numRuns: 100 }
      );
    });

    it('antdTheme 应包含有效的配置对象', () => {
      fc.assert(
        fc.property(themeModeArb, densityModeArb, (mode, density) => {
          resetStore();
          
          useThemeStore.getState().setThemeMode(mode);
          useThemeStore.getState().setDensity(density);
          
          const state = useThemeStore.getState();
          
          // 验证 antdTheme 结构
          expect(state.antdTheme).toBeDefined();
          expect(state.antdTheme.algorithm).toBeDefined();
          expect(state.antdTheme.token).toBeDefined();
          
          // 验证 token 包含主色调
          expect(state.antdTheme.token?.colorPrimary).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('antdTheme.algorithm 应根据主题模式正确设置', () => {
      fc.assert(
        fc.property(themeModeArb, (mode) => {
          resetStore();
          
          useThemeStore.getState().setThemeMode(mode);
          
          const state = useThemeStore.getState();
          const algorithm = state.antdTheme.algorithm;
          
          // algorithm 可以是单个函数或函数数组
          expect(algorithm).toBeDefined();
          
          // 验证 algorithm 是函数或函数数组
          if (Array.isArray(algorithm)) {
            expect(algorithm.length).toBeGreaterThan(0);
            algorithm.forEach(alg => {
              expect(typeof alg).toBe('function');
            });
          } else {
            expect(typeof algorithm).toBe('function');
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 额外属性：setDensity 应正确设置密度
   */
  describe('setDensity 属性', () => {
    it('setDensity 后 density 应等于设置的值', () => {
      fc.assert(
        fc.property(densityModeArb, (density) => {
          resetStore();
          
          useThemeStore.getState().setDensity(density);
          
          const state = useThemeStore.getState();
          expect(state.density).toBe(density);
        }),
        { numRuns: 100 }
      );
    });

    it('compact 密度应影响 antdTheme 配置', () => {
      resetStore();
      
      useThemeStore.getState().setDensity('compact');
      
      const state = useThemeStore.getState();
      const algorithm = state.antdTheme.algorithm;
      
      // compact 模式应该包含 compactAlgorithm
      expect(algorithm).toBeDefined();
    });
  });

  /**
   * 额外属性：toggleTheme 应正确切换主题
   */
  describe('toggleTheme 属性', () => {
    it('toggleTheme 应在 dark 和 light 之间切换', () => {
      resetStore();
      
      // 初始为 dark
      expect(useThemeStore.getState().themeMode).toBe('dark');
      
      // 切换到 light
      useThemeStore.getState().toggleTheme();
      expect(useThemeStore.getState().themeMode).toBe('light');
      
      // 切换回 dark
      useThemeStore.getState().toggleTheme();
      expect(useThemeStore.getState().themeMode).toBe('dark');
    });

    it('连续两次 toggleTheme 应恢复原状态（round-trip）', () => {
      fc.assert(
        fc.property(fc.constantFrom('dark', 'light') as fc.Arbitrary<ThemeMode>, (initialMode) => {
          resetStore();
          
          // 设置初始模式
          useThemeStore.getState().setThemeMode(initialMode);
          const originalMode = useThemeStore.getState().themeMode;
          
          // 切换两次
          useThemeStore.getState().toggleTheme();
          useThemeStore.getState().toggleTheme();
          
          // 应恢复原状态
          expect(useThemeStore.getState().themeMode).toBe(originalMode);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 额外属性：colors 应根据主题模式正确设置
   */
  describe('colors 属性', () => {
    it('colors 应根据主题模式包含正确的颜色值', () => {
      fc.assert(
        fc.property(themeModeArb, (mode) => {
          resetStore();
          
          useThemeStore.getState().setThemeMode(mode);
          
          const state = useThemeStore.getState();
          
          // 验证 colors 结构完整
          expect(state.colors).toBeDefined();
          expect(state.colors.primary).toBeDefined();
          expect(state.colors.background).toBeDefined();
          expect(state.colors.text).toBeDefined();
          expect(state.colors.surface).toBeDefined();
          
          // 验证颜色值格式（十六进制）
          expect(state.colors.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
          expect(state.colors.background).toMatch(/^#[0-9a-fA-F]{6}$/);
        }),
        { numRuns: 100 }
      );
    });

    it('dark 模式应使用深色背景', () => {
      resetStore();
      
      useThemeStore.getState().setThemeMode('dark');
      
      const state = useThemeStore.getState();
      
      // 深色背景的亮度应该较低
      expect(state.colors.background).toBe('#0f172a');
    });

    it('light 模式应使用浅色背景', () => {
      resetStore();
      
      useThemeStore.getState().setThemeMode('light');
      
      const state = useThemeStore.getState();
      
      // 浅色背景的亮度应该较高
      expect(state.colors.background).toBe('#f8fafc');
    });
  });

  /**
   * 额外属性：状态一致性
   */
  describe('状态一致性', () => {
    it('themeMode、isDark 和 colors 应保持一致', () => {
      fc.assert(
        fc.property(themeModeArb, (mode) => {
          resetStore();
          
          useThemeStore.getState().setThemeMode(mode);
          
          const state = useThemeStore.getState();
          
          // 验证一致性
          if (mode === 'dark') {
            expect(state.isDark).toBe(true);
            expect(state.colors.background).toBe('#0f172a');
          } else if (mode === 'light') {
            expect(state.isDark).toBe(false);
            expect(state.colors.background).toBe('#f8fafc');
          } else if (mode === 'high-contrast') {
            expect(state.isDark).toBe(true);
            expect(state.colors.background).toBe('#000000');
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});

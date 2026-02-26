/**
 * Property 2: ECharts 主题与 AntD 主题颜色同步
 *
 * For any 主题模式（dark/light），getEChartsTheme 返回的颜色序列中的前 5 个颜色
 * 应该与 AntD Theme Token 中的 primary/success/warning/danger/info 颜色值完全一致。
 *
 * **Validates: Requirements 3.1, 3.4**
 */
import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { getEChartsTheme } from '../../src/theme/echartsTheme';
import { getAntdThemeConfig } from '../../src/theme/antdTheme';
import { COLORS } from '../../src/theme/tokens';

describe('Property 2: ECharts 主题与 AntD 主题颜色同步', () => {
  const isDarkArb = fc.boolean();

  it('ECharts 颜色序列前 5 个与 AntD 语义色一致', () => {
    fc.assert(
      fc.property(isDarkArb, (isDark) => {
        const echartsTheme = getEChartsTheme(isDark);
        const antdConfig = getAntdThemeConfig(isDark);

        const echartsColors = echartsTheme.color;
        const antdToken = antdConfig.token!;

        // ECharts 前 5 个颜色应与 AntD 语义色一致
        return (
          echartsColors[0] === antdToken.colorPrimary &&
          echartsColors[1] === antdToken.colorSuccess &&
          echartsColors[2] === antdToken.colorWarning &&
          echartsColors[3] === antdToken.colorError &&
          echartsColors[4] === antdToken.colorInfo
        );
      }),
      { numRuns: 100 },
    );
  });

  it('ECharts 颜色序列前 5 个与共享 COLORS 常量一致', () => {
    fc.assert(
      fc.property(isDarkArb, (isDark) => {
        const echartsTheme = getEChartsTheme(isDark);
        const colors = echartsTheme.color;

        return (
          colors[0] === COLORS.primary &&
          colors[1] === COLORS.success &&
          colors[2] === COLORS.warning &&
          colors[3] === COLORS.danger &&
          colors[4] === COLORS.info
        );
      }),
      { numRuns: 100 },
    );
  });
});

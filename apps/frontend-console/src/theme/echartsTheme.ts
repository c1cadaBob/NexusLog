import { COLORS, DARK_PALETTE, LIGHT_PALETTE, FONTS } from './tokens';

/**
 * ECharts 主题配置，与 AntD Design Token 对齐
 * 颜色序列前 5 个与 AntD 语义色一致
 */
export function getEChartsTheme(isDark: boolean) {
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  return {
    color: [
      COLORS.primary,
      COLORS.success,
      COLORS.warning,
      COLORS.danger,
      COLORS.info,
      COLORS.purple,
      COLORS.cyan,
    ],
    backgroundColor: 'transparent',
    textStyle: {
      fontFamily: FONTS.base,
      color: palette.textSecondary,
      fontSize: 12,
    },
    title: {
      textStyle: { color: palette.text, fontFamily: FONTS.base, fontSize: 14 },
      subtextStyle: { color: palette.textSecondary, fontSize: 12 },
    },
    grid: { containLabel: true },
    xAxis: {
      axisLine: { lineStyle: { color: palette.border } },
      axisTick: { lineStyle: { color: palette.border } },
      axisLabel: { color: palette.textSecondary, fontSize: 10 },
      splitLine: { lineStyle: { color: palette.border, opacity: 0.3 } },
    },
    yAxis: {
      axisLine: { lineStyle: { color: palette.border } },
      axisTick: { lineStyle: { color: palette.border } },
      axisLabel: { color: palette.textSecondary, fontSize: 10 },
      splitLine: { lineStyle: { color: palette.border, opacity: 0.12, type: 'dashed' as const } },
    },
    tooltip: {
      backgroundColor: palette.bgContainer,
      borderColor: palette.border,
      textStyle: { color: palette.text, fontSize: 12, fontFamily: FONTS.base },
    },
    legend: {
      textStyle: { color: palette.textSecondary, fontSize: 12 },
    },
  };
}

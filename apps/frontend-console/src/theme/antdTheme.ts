import { theme, type ThemeConfig } from 'antd';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE, FONTS } from './tokens';

/** 深色主题 AntD Token */
export const darkThemeConfig: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: COLORS.primary,
    colorSuccess: COLORS.success,
    colorWarning: COLORS.warning,
    colorError: COLORS.danger,
    colorInfo: COLORS.info,
    colorBgContainer: DARK_PALETTE.bgContainer,
    colorBgLayout: DARK_PALETTE.bgLayout,
    colorBgElevated: DARK_PALETTE.bgElevated,
    colorBorder: DARK_PALETTE.border,
    colorBorderSecondary: DARK_PALETTE.borderSecondary,
    colorText: DARK_PALETTE.text,
    colorTextSecondary: DARK_PALETTE.textSecondary,
    fontFamily: FONTS.base,
    fontFamilyCode: FONTS.code,
    fontSize: 14,
    borderRadius: 8,
  },
  components: {
    Input: {
      activeBg: DARK_PALETTE.bgContainer,
      addonBg: DARK_PALETTE.bgContainer,
    },
    InputNumber: {
      activeBg: DARK_PALETTE.bgContainer,
    },
    Pagination: {
      itemActiveBg: COLORS.primary,
      colorBgTextHover: DARK_PALETTE.bgHover,
    },
    Select: {
      optionActiveBg: DARK_PALETTE.bgHover,
      optionSelectedBg: 'rgba(19, 91, 236, 0.15)',
      selectorBg: DARK_PALETTE.bgHover,
    },
    Layout: {
      siderBg: DARK_PALETTE.bgContainer,
      headerBg: DARK_PALETTE.bgContainer,
    },
  },
};

/** 浅色主题 AntD Token */
export const lightThemeConfig: ThemeConfig = {
  token: {
    colorPrimary: COLORS.primary,
    colorSuccess: COLORS.success,
    colorWarning: COLORS.warning,
    colorError: COLORS.danger,
    colorInfo: COLORS.info,
    colorBgContainer: LIGHT_PALETTE.bgContainer,
    colorBgLayout: LIGHT_PALETTE.bgLayout,
    colorBgElevated: LIGHT_PALETTE.bgElevated,
    colorBorder: LIGHT_PALETTE.border,
    colorBorderSecondary: LIGHT_PALETTE.borderSecondary,
    colorText: LIGHT_PALETTE.text,
    colorTextSecondary: LIGHT_PALETTE.textSecondary,
    fontFamily: FONTS.base,
    fontFamilyCode: FONTS.code,
    fontSize: 14,
    borderRadius: 8,
  },
  components: {
    Layout: {
      siderBg: LIGHT_PALETTE.bgContainer,
      headerBg: LIGHT_PALETTE.bgContainer,
    },
  },
};

/** 根据主题模式获取 AntD 主题配置 */
export function getAntdThemeConfig(isDark: boolean): ThemeConfig {
  return isDark ? darkThemeConfig : lightThemeConfig;
}

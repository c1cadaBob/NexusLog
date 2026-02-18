/**
 * 配置模块统一导出
 */

export {
  loadAppConfig,
  getAppConfig,
  refreshAppConfig,
} from './appConfig';
export type { AppConfig } from './appConfig';

export {
  PRIMARY_COLOR,
  darkThemeTokens,
  lightThemeTokens,
  highContrastThemeTokens,
  darkComponentsConfig,
  lightComponentsConfig,
  generateAntdThemeConfig,
  defaultDarkTheme,
  defaultLightTheme,
} from './antdTheme';

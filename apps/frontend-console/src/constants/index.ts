/**
 * 常量模块统一导出入口
 */

// 认证相关常量
export {
  type Language,
  type LoginPageTexts,
  type ForgotPasswordTexts,
  type SSOLoginTexts,
  type RegisterPageTexts,
  type AuthTexts,
  zhCN,
  enUS,
  authTexts,
  getAuthTexts,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  getSavedLanguage,
  saveLanguage,
} from './auth';

// 菜单配置常量
export {
  type MenuItem,
  type MenuConfig,
  type RouteModule,
  menuConfig,
  authMenuConfig,
  ROUTE_MODULES,
  PUBLIC_ROUTES,
  DEFAULT_ROUTE,
  FALLBACK_ROUTE,
  getMenuKeyByPath,
  getParentKeys,
  isPublicRoute,
  getBreadcrumbs,
} from './menu';


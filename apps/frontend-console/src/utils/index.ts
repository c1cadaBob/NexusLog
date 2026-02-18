/**
 * 工具函数统一导出
 */

// 格式化工具
export {
  formatBytes,
  formatDuration,
  formatTimestamp,
  formatRelativeTime,
  formatNumber,
  formatCompactNumber,
  formatPercent,
  truncateString,
  formatFilename,
} from './formatters';

// 验证工具
export {
  validateForm,
  validateField,
  validationPatterns,
  isValidEmail,
  isValidUrl,
  isValidIPv4,
  isValidPort,
  isValidJson,
  isEmpty,
  isNumeric,
  validateLoginForm,
  isFormValid,
  validateFormEnhanced,
  validateFieldEnhanced,
  required,
  email,
  url,
  minLength,
  maxLength,
  range,
  pattern,
  compose,
  hasNoErrors,
} from './validators';
export type {
  ValidationRule,
  ValidationRules,
  ValidationErrors,
  LoginFormData,
  LoginFormErrors,
  EnhancedValidationRule,
  EnhancedValidationRules,
} from './validators';

// 通用辅助函数
export {
  generateId,
  generateUUID,
  deepClone,
  deepMerge,
  debounce,
  throttle,
  sleep,
  retry,
  safeJsonParse,
  get,
  groupBy,
  unique,
  toQueryString,
  parseQueryString,
  copyToClipboard,
  downloadFile,
  cn,
} from './helpers';

// 日期工具
export {
  getPresetTimeRange,
  getStartOfDay,
  getEndOfDay,
  getStartOfWeek,
  getStartOfMonth,
  addTime,
  dateDiff,
  isSameDay,
  toLocalISOString,
  parseRelativeTime,
  PRESET_TIME_RANGES,
} from './date';
export type { TimeRange, PresetTimeRange } from './date';

// 全局错误处理
export {
  initGlobalErrorHandler,
  reportError,
  reportMessage,
  createIntegratedErrorTracker,
} from './globalErrorHandler';
export type {
  ErrorTracker,
  GlobalErrorHandlerConfig,
  ErrorContext,
  CleanupFunction,
} from './globalErrorHandler';

// 缓存工具
export {
  ApiCache,
  apiCache,
  generateCacheKey,
  DEFAULT_TTL,
  MAX_CACHE_SIZE,
  RESOURCE_TAGS,
} from './cache';
export type {
  CacheEntry,
  CacheOptions,
  CacheStats,
  ResourceType,
} from './cache';

// 路由预加载工具
export {
  preloadRoute,
  preloadRoutes,
  preloadModule,
  isRoutePreloaded,
  getPreloadableRoutes,
  createHoverPreloader,
  createModuleHoverPreloader,
} from './routePreloader';

// 输入清理工具
export {
  escapeHtml,
  unescapeHtml,
  stripDangerousTags,
  stripDangerousAttributes,
  sanitizeHtml,
  sanitizeInput,
  sanitizeRichText,
  sanitizeUrl,
  sanitizeFilename,
  sanitizeJson,
  containsXss,
  SANITIZE_CONSTANTS,
} from './sanitize';
export type { SanitizeOptions } from './sanitize';

// 移动端优化工具
export {
  isMobileDevice,
  isTouchDevice,
  isLowEndDevice,
  getConnectionType,
  isSlowConnection,
  getOptimalImageQuality,
  getOptimalImageSize,
  generateSrcSet,
  getRecommendedPageSize,
  getRecommendedAnimationDuration,
  shouldEnableVirtualization,
  preloadCriticalResources,
  preconnectToDomains,
  clearImageCache,
  getMemoryUsage,
  getSafeAreaInsets,
  setViewportHeight,
  MOBILE_CONFIG,
} from './mobileOptimization';

// 无障碍工具
export {
  FOCUSABLE_ELEMENTS,
  getFocusableElements,
  trapFocus,
  createFocusTrap,
  generateAriaId,
  setAriaAttributes,
  ARIA_ROLES,
  ARIA_STATES,
  ARIA_PROPERTIES,
  createAriaLabel,
  createExpandableAriaProps,
  createProgressAriaProps,
  createSliderAriaProps,
  announce,
  handleListKeyboardNavigation,
  handleMenuKeyboardNavigation,
  handleGridKeyboardNavigation,
  createKeyboardHandler,
  getRelativeLuminance,
  getContrastRatio,
  meetsWCAGAA,
  meetsWCAGAAA,
  prefersReducedMotion,
  onReducedMotionChange,
} from './accessibility';

// 颜色对比度验证工具
export {
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
} from './colorContrast';
export type {
  RGB,
  ColorDefinition,
  ContrastResult,
  ContrastReport,
  ColorCombination,
} from './colorContrast';

// 环境变量工具
export {
  getEnv,
  getEnvBoolean,
  getEnvNumber,
  config,
} from './env';

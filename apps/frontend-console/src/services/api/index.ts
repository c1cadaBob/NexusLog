/**
 * API 服务模块导出
 */

export { ApiClient, apiClient } from './client';
export type { 
  RequestInterceptor, 
  ResponseInterceptor, 
  ErrorInterceptor,
  ApiClientConfig,
} from './client';

export { authApi } from './auth';
export type {
  RegisterRequest,
  ChangePasswordRequest,
  ResetPasswordRequest,
  ConfirmResetPasswordRequest,
} from './auth';

export { logsApi } from './logs';
export type {
  LogContextRequest,
  LogContextResponse,
  FieldValuesRequest,
} from './logs';

export { alertsApi } from './alerts';
export type {
  AlertListParams,
  AlertRuleListParams,
  BatchAlertRequest,
} from './alerts';

export { dashboardApi } from './dashboard';
export type {
  DashboardListParams,
  ShareDashboardRequest,
  CloneDashboardRequest,
  WidgetDataRequest,
} from './dashboard';

// 带缓存功能的 API 服务
export { 
  cachedApi,
  invalidateCache,
  invalidateByResourceType,
  clearAllCache,
  cleanupExpiredCache,
  getCacheStats,
  resetCacheStats,
  warmupCache,
  withCache,
  withInvalidation,
  SHORT_CACHE_TTL,
  MEDIUM_CACHE_TTL,
  LONG_CACHE_TTL,
} from './cachedApi';
export type {
  CachedRequestConfig,
  MutationRequestConfig,
} from './cachedApi';

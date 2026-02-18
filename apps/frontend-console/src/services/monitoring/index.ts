/**
 * 监控服务模块导出
 * 
 * 包含：
 * - 错误跟踪服务
 * - 分析跟踪服务
 * - 性能监控服务
 */

// 错误跟踪
export {
  errorTracking,
  initErrorTracking,
  captureError,
  captureMessage,
  addBreadcrumb,
  setUser,
  setTag,
  createErrorBoundaryTracker,
} from './errorTracking';

export type {
  ErrorTracker,
  ErrorTrackingConfig,
  ErrorTrackingUser,
  ErrorEvent,
  Breadcrumb,
  BrowserInfo,
} from './errorTracking';

// 分析跟踪
export {
  analytics,
  initAnalytics,
  trackPageView,
  trackEvent,
  trackInteraction,
  trackSearch,
  trackFeatureUsage,
  updatePrivacySettings,
  getPrivacySettings,
} from './analytics';

export type {
  AnalyticsConfig,
  PageViewEvent,
  TrackEvent,
  UserProperties,
  EcommerceEvent,
  EcommerceItem,
  PrivacySettings,
} from './analytics';

// 性能监控
export {
  performanceMonitor,
  initPerformanceMonitor,
  startMark,
  endMark,
  trackApiRequest,
  trackRender,
  getPerformanceMetrics,
  measureAsync,
  measureSync,
} from './performance';

export type {
  PerformanceMonitorConfig,
  PerformanceMetrics,
  PageLoadMetrics,
  WebVitalsMetrics,
  ApiPerformanceMetrics,
  RenderPerformanceMetrics,
  ResourceMetrics,
  MemoryMetrics,
} from './performance';

// 初始化
export { initAppMonitoring } from './init';

// ============================================================================
// 统一初始化函数
// ============================================================================

import { initErrorTracking, type ErrorTrackingConfig } from './errorTracking';
import { initAnalytics, type AnalyticsConfig } from './analytics';
import { initPerformanceMonitor, type PerformanceMonitorConfig } from './performance';

/**
 * 监控配置
 */
export interface MonitoringConfig {
  /** 错误跟踪配置 */
  errorTracking?: Partial<ErrorTrackingConfig>;
  /** 分析配置 */
  analytics?: Partial<AnalyticsConfig>;
  /** 性能监控配置 */
  performance?: Partial<PerformanceMonitorConfig>;
}

/**
 * 初始化所有监控服务
 */
export function initMonitoring(config: MonitoringConfig = {}): void {
  // 初始化错误跟踪
  initErrorTracking(config.errorTracking);

  // 初始化分析
  initAnalytics(config.analytics);

  // 初始化性能监控
  initPerformanceMonitor(config.performance);

  if (import.meta.env?.DEV) {
    console.log('[Monitoring] 所有监控服务已初始化');
  }
}

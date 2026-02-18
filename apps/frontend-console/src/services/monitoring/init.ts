/**
 * 监控服务初始化
 * 
 * 在应用启动时调用此函数初始化所有监控服务
 */

import { initErrorTracking, type ErrorTrackingConfig } from './errorTracking';
import { initAnalytics, type AnalyticsConfig } from './analytics';
import { initPerformanceMonitor, type PerformanceMonitorConfig } from './performance';
import { initGlobalErrorHandler } from '../../utils/globalErrorHandler';
import { createErrorBoundaryTracker } from './errorTracking';

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
function initMonitoring(config: MonitoringConfig = {}): void {
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

/**
 * 默认监控配置
 */
const defaultConfig: MonitoringConfig = {
  errorTracking: {
    enabled: true,
    environment: import.meta.env?.MODE || 'development',
    enableInDev: true, // 开发模式下也启用（仅输出到控制台）
    sampleRate: 1.0,
    ignoreErrors: [
      // 忽略常见的非关键错误
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      /^Script error\.?$/,
      /^Network Error$/,
    ],
  },
  analytics: {
    enabled: true,
    debug: import.meta.env?.DEV,
    anonymizeIp: true,
    respectDoNotTrack: true,
    // 默认不启用，等待用户同意
    consentGranted: false,
  },
  performance: {
    enabled: true,
    debug: import.meta.env?.DEV,
    sampleRate: 1.0,
    slowRequestThreshold: 3000,
    slowRenderThreshold: 16,
    autoTrackPageLoad: true,
    autoTrackResources: true,
  },
};

/**
 * 初始化应用监控
 * 
 * @param config - 自定义配置（可选）
 * @returns 清理函数
 */
export function initAppMonitoring(config?: Partial<MonitoringConfig>): () => void {
  const mergedConfig: MonitoringConfig = {
    errorTracking: { ...defaultConfig.errorTracking, ...config?.errorTracking },
    analytics: { ...defaultConfig.analytics, ...config?.analytics },
    performance: { ...defaultConfig.performance, ...config?.performance },
  };

  // 初始化监控服务
  initMonitoring(mergedConfig);

  // 初始化全局错误处理器
  const cleanupGlobalHandler = initGlobalErrorHandler({
    errorTracker: createErrorBoundaryTracker(),
    showDetailsInDev: true,
    preventDefault: false,
  });

  if (import.meta.env?.DEV) {
    console.log('[Monitoring] 应用监控已初始化', {
      environment: mergedConfig.errorTracking?.environment,
      analyticsEnabled: mergedConfig.analytics?.enabled,
      performanceEnabled: mergedConfig.performance?.enabled,
    });
  }

  // 返回清理函数
  return () => {
    cleanupGlobalHandler();
    if (import.meta.env?.DEV) {
      console.log('[Monitoring] 应用监控已清理');
    }
  };
}

export { createErrorBoundaryTracker };
export default initAppMonitoring;

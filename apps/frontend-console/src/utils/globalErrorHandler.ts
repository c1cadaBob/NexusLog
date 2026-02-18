/**
 * 全局错误处理器
 * 
 * 功能：
 * - 添加 window error 事件监听器
 * - 添加 unhandledrejection 事件监听器
 * - 集成错误跟踪服务
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 错误跟踪器接口
 */
export interface ErrorTracker {
  captureError: (error: Error, context?: Record<string, unknown>) => void;
  captureMessage: (message: string, level?: 'info' | 'warning' | 'error') => void;
}

/**
 * 全局错误处理器配置
 */
export interface GlobalErrorHandlerConfig {
  /** 错误跟踪服务 */
  errorTracker?: ErrorTracker;
  /** 是否在开发模式下显示详细错误 */
  showDetailsInDev?: boolean;
  /** 错误发生时的回调 */
  onError?: (error: Error, context: ErrorContext) => void;
  /** 是否阻止默认错误处理 */
  preventDefault?: boolean;
}

/**
 * 错误上下文
 */
export interface ErrorContext {
  /** 错误类型 */
  type: 'error' | 'unhandledrejection';
  /** 错误来源 */
  source?: string;
  /** 行号 */
  lineno?: number;
  /** 列号 */
  colno?: number;
  /** 时间戳 */
  timestamp: number;
  /** 用户代理 */
  userAgent: string;
  /** 当前 URL */
  url: string;
}

/**
 * 清理函数类型
 */
export type CleanupFunction = () => void;

// ============================================================================
// 默认错误跟踪器
// ============================================================================

const defaultErrorTracker: ErrorTracker = {
  captureError: (error: Error, context?: Record<string, unknown>) => {
    // 默认实现：输出到控制台
    console.error('[ErrorTracker] 捕获错误:', error, context);
  },
  captureMessage: (message: string, level: 'info' | 'warning' | 'error' = 'error') => {
    // 默认实现：输出到控制台
    const logFn = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
    logFn(`[ErrorTracker] ${level.toUpperCase()}:`, message);
  },
};

// ============================================================================
// 全局错误处理器
// ============================================================================

/**
 * 初始化全局错误处理器
 * 
 * @param config - 配置选项
 * @returns 清理函数，用于移除事件监听器
 * 
 * @example
 * ```typescript
 * // 在应用入口初始化
 * const cleanup = initGlobalErrorHandler({
 *   errorTracker: myErrorTracker,
 *   onError: (error, context) => {
 *     // 自定义错误处理
 *   },
 * });
 * 
 * // 在应用卸载时清理
 * cleanup();
 * ```
 */
export function initGlobalErrorHandler(config: GlobalErrorHandlerConfig = {}): CleanupFunction {
  const {
    errorTracker = defaultErrorTracker,
    showDetailsInDev = true,
    onError,
    preventDefault = false,
  } = config;

  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

  /**
   * 构建错误上下文
   */
  function buildContext(
    type: 'error' | 'unhandledrejection',
    extra?: Partial<ErrorContext>
  ): ErrorContext {
    return {
      type,
      timestamp: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      ...extra,
    };
  }

  /**
   * 处理 window.onerror 事件
   */
  function handleError(event: ErrorEvent): boolean | void {
    const error = event.error instanceof Error 
      ? event.error 
      : new Error(event.message || '未知错误');

    const context = buildContext('error', {
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });

    // 发送到错误跟踪服务
    errorTracker.captureError(error, {
      ...context,
      errorEvent: {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });

    // 调用自定义回调
    onError?.(error, context);

    // 开发模式下显示详细错误
    if (isDev && showDetailsInDev) {
      console.group('%c[GlobalErrorHandler] 捕获到错误', 'color: #ff6b6b; font-weight: bold;');
      console.error('错误:', error);
      console.log('来源:', event.filename);
      console.log('位置:', `行 ${event.lineno}, 列 ${event.colno}`);
      console.log('上下文:', context);
      console.groupEnd();
    }

    // 是否阻止默认处理
    if (preventDefault) {
      event.preventDefault();
      return true;
    }
  }

  /**
   * 处理 unhandledrejection 事件
   */
  function handleUnhandledRejection(event: PromiseRejectionEvent): void {
    const reason = event.reason;
    const error = reason instanceof Error 
      ? reason 
      : new Error(String(reason) || '未处理的 Promise 拒绝');

    const context = buildContext('unhandledrejection');

    // 发送到错误跟踪服务
    errorTracker.captureError(error, {
      ...context,
      reason: reason instanceof Error ? undefined : reason,
      promiseRejection: true,
    });

    // 调用自定义回调
    onError?.(error, context);

    // 开发模式下显示详细错误
    if (isDev && showDetailsInDev) {
      console.group('%c[GlobalErrorHandler] 未处理的 Promise 拒绝', 'color: #ffa502; font-weight: bold;');
      console.error('原因:', reason);
      console.log('上下文:', context);
      console.groupEnd();
    }

    // 是否阻止默认处理
    if (preventDefault) {
      event.preventDefault();
    }
  }

  // 添加事件监听器
  if (typeof window !== 'undefined') {
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // 记录初始化
    if (isDev) {
      console.log('%c[GlobalErrorHandler] 已初始化', 'color: #2ed573;');
    }
  }

  // 返回清理函数
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);

      if (isDev) {
        console.log('%c[GlobalErrorHandler] 已清理', 'color: #ffa502;');
      }
    }
  };
}

// ============================================================================
// 错误报告工具
// ============================================================================

/**
 * 手动报告错误
 * 
 * @param error - 错误对象
 * @param context - 额外上下文
 * @param tracker - 错误跟踪器（可选）
 */
export function reportError(
  error: Error,
  context?: Record<string, unknown>,
  tracker: ErrorTracker = defaultErrorTracker
): void {
  const errorContext = {
    timestamp: Date.now(),
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    ...context,
  };

  tracker.captureError(error, errorContext);
}

/**
 * 手动报告消息
 * 
 * @param message - 消息内容
 * @param level - 消息级别
 * @param tracker - 错误跟踪器（可选）
 */
export function reportMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  tracker: ErrorTracker = defaultErrorTracker
): void {
  tracker.captureMessage(message, level);
}

// ============================================================================
// 错误边界集成
// ============================================================================

/**
 * 创建与 ErrorBoundary 集成的错误跟踪器
 * 
 * @param config - 配置选项
 * @returns 错误跟踪器
 */
export function createIntegratedErrorTracker(
  config: GlobalErrorHandlerConfig = {}
): ErrorTracker {
  const { errorTracker = defaultErrorTracker, onError } = config;

  return {
    captureError: (error: Error, context?: Record<string, unknown>) => {
      // 调用原始跟踪器
      errorTracker.captureError(error, context);

      // 调用自定义回调
      if (onError) {
        const errorContext: ErrorContext = {
          type: 'error',
          timestamp: Date.now(),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        };
        onError(error, errorContext);
      }
    },
    captureMessage: (message: string, level?: 'info' | 'warning' | 'error') => {
      errorTracker.captureMessage(message, level);
    },
  };
}

// ============================================================================
// 导出
// ============================================================================

export default initGlobalErrorHandler;

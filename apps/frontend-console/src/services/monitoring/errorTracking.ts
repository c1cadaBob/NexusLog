/**
 * 错误跟踪服务
 * 
 * 功能：
 * - 集成错误跟踪服务（如 Sentry）
 * - 从 ErrorBoundary 发送错误
 * - 发送未处理的错误
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 错误跟踪器接口（用于 ErrorBoundary 集成）
 */
export interface ErrorTracker {
  captureError: (error: Error, context?: Record<string, unknown>) => void;
  captureMessage: (message: string, level?: 'info' | 'warning' | 'error') => void;
}

/**
 * 错误跟踪配置
 */
export interface ErrorTrackingConfig {
  /** 是否启用错误跟踪 */
  enabled: boolean;
  /** DSN (Data Source Name) - 错误跟踪服务的端点 */
  dsn?: string;
  /** 环境标识 */
  environment?: string;
  /** 发布版本 */
  release?: string;
  /** 采样率 (0-1) */
  sampleRate?: number;
  /** 是否在开发模式下启用 */
  enableInDev?: boolean;
  /** 用户信息 */
  user?: ErrorTrackingUser;
  /** 额外标签 */
  tags?: Record<string, string>;
  /** 忽略的错误模式 */
  ignoreErrors?: (string | RegExp)[];
  /** 错误发送前的回调 */
  beforeSend?: (error: ErrorEvent) => ErrorEvent | null;
}

/**
 * 用户信息
 */
export interface ErrorTrackingUser {
  id?: string;
  email?: string;
  username?: string;
}

/**
 * 错误事件
 */
export interface ErrorEvent {
  /** 错误 ID */
  id: string;
  /** 错误消息 */
  message: string;
  /** 错误堆栈 */
  stack?: string;
  /** 错误类型 */
  type: 'error' | 'unhandledrejection' | 'component';
  /** 时间戳 */
  timestamp: number;
  /** 错误级别 */
  level: 'fatal' | 'error' | 'warning' | 'info';
  /** 上下文信息 */
  context?: Record<string, unknown>;
  /** 标签 */
  tags?: Record<string, string>;
  /** 用户信息 */
  user?: ErrorTrackingUser;
  /** 浏览器信息 */
  browser?: BrowserInfo;
  /** 页面 URL */
  url?: string;
}

/**
 * 浏览器信息
 */
export interface BrowserInfo {
  userAgent: string;
  language: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * 面包屑（用户操作记录）
 */
export interface Breadcrumb {
  /** 类型 */
  type: 'navigation' | 'click' | 'http' | 'console' | 'user';
  /** 分类 */
  category: string;
  /** 消息 */
  message: string;
  /** 数据 */
  data?: Record<string, unknown>;
  /** 时间戳 */
  timestamp: number;
  /** 级别 */
  level?: 'info' | 'warning' | 'error';
}

// ============================================================================
// 错误跟踪服务类
// ============================================================================

/**
 * 错误跟踪服务
 */
class ErrorTrackingService implements ErrorTracker {
  private config: ErrorTrackingConfig;
  private breadcrumbs: Breadcrumb[] = [];
  private maxBreadcrumbs = 100;
  private errorQueue: ErrorEvent[] = [];
  private isInitialized = false;

  constructor(config: Partial<ErrorTrackingConfig> = {}) {
    this.config = {
      enabled: true,
      environment: import.meta.env?.MODE || 'development',
      sampleRate: 1.0,
      enableInDev: false,
      ignoreErrors: [],
      ...config,
    };
  }

  /**
   * 初始化错误跟踪服务
   */
  init(config?: Partial<ErrorTrackingConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    const isDev = import.meta.env?.DEV;
    
    // 开发模式下检查是否启用
    if (isDev && !this.config.enableInDev) {
      console.log('[ErrorTracking] 开发模式下已禁用错误跟踪');
      return;
    }

    if (!this.config.enabled) {
      console.log('[ErrorTracking] 错误跟踪已禁用');
      return;
    }

    this.isInitialized = true;
    this.setupGlobalHandlers();
    
    console.log('[ErrorTracking] 错误跟踪服务已初始化', {
      environment: this.config.environment,
      release: this.config.release,
    });
  }

  /**
   * 设置全局错误处理器
   */
  private setupGlobalHandlers(): void {
    if (typeof window === 'undefined') return;

    // 捕获未处理的错误
    window.addEventListener('error', (event) => {
      this.handleGlobalError(event);
    });

    // 捕获未处理的 Promise 拒绝
    window.addEventListener('unhandledrejection', (event) => {
      this.handleUnhandledRejection(event);
    });

    // 捕获控制台错误
    this.interceptConsoleErrors();
  }

  /**
   * 拦截控制台错误
   */
  private interceptConsoleErrors(): void {
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      this.addBreadcrumb({
        type: 'console',
        category: 'console',
        message: args.map(arg => String(arg)).join(' '),
        level: 'error',
        timestamp: Date.now(),
      });
      originalError.apply(console, args);
    };
  }

  /**
   * 处理全局错误
   */
  private handleGlobalError(event: globalThis.ErrorEvent): void {
    const error = event.error instanceof Error 
      ? event.error 
      : new Error(event.message || '未知错误');

    this.captureError(error, {
      type: 'error',
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  }

  /**
   * 处理未处理的 Promise 拒绝
   */
  private handleUnhandledRejection(event: PromiseRejectionEvent): void {
    const reason = event.reason;
    const error = reason instanceof Error 
      ? reason 
      : new Error(String(reason) || '未处理的 Promise 拒绝');

    this.captureError(error, {
      type: 'unhandledrejection',
      promiseRejection: true,
    });
  }

  /**
   * 捕获错误
   */
  captureError(error: Error, context?: Record<string, unknown>): void {
    if (!this.shouldCaptureError(error)) {
      return;
    }

    const errorEvent = this.createErrorEvent(error, context);
    
    // 应用 beforeSend 回调
    const processedEvent = this.config.beforeSend 
      ? this.config.beforeSend(errorEvent)
      : errorEvent;

    if (!processedEvent) {
      return;
    }

    // 添加到队列
    this.errorQueue.push(processedEvent);

    // 发送错误
    this.sendError(processedEvent);
  }

  /**
   * 捕获消息
   */
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    if (!this.isEnabled()) {
      console.log(`[ErrorTracking] ${level.toUpperCase()}: ${message}`);
      return;
    }

    const errorEvent: ErrorEvent = {
      id: this.generateId(),
      message,
      type: 'error',
      timestamp: Date.now(),
      level: level === 'info' ? 'info' : level === 'warning' ? 'warning' : 'error',
      context: {},
      tags: this.config.tags,
      user: this.config.user,
      browser: this.getBrowserInfo(),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    };

    this.sendError(errorEvent);
  }

  /**
   * 检查是否应该捕获错误
   */
  private shouldCaptureError(error: Error): boolean {
    if (!this.isEnabled()) {
      return false;
    }

    // 采样率检查
    if (Math.random() > (this.config.sampleRate || 1)) {
      return false;
    }

    // 检查忽略列表
    const ignorePatterns = this.config.ignoreErrors || [];
    for (const pattern of ignorePatterns) {
      if (typeof pattern === 'string') {
        if (error.message.includes(pattern)) {
          return false;
        }
      } else if (pattern instanceof RegExp) {
        if (pattern.test(error.message)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 创建错误事件
   */
  private createErrorEvent(error: Error, context?: Record<string, unknown>): ErrorEvent {
    return {
      id: this.generateId(),
      message: error.message,
      stack: error.stack,
      type: (context?.type as ErrorEvent['type']) || 'error',
      timestamp: Date.now(),
      level: 'error',
      context: {
        ...context,
        breadcrumbs: [...this.breadcrumbs],
      },
      tags: this.config.tags,
      user: this.config.user,
      browser: this.getBrowserInfo(),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    };
  }

  /**
   * 发送错误到服务端
   */
  private sendError(errorEvent: ErrorEvent): void {
    // 在开发模式下，只输出到控制台
    if (import.meta.env?.DEV) {
      console.group('%c[ErrorTracking] 错误已捕获', 'color: #ff6b6b; font-weight: bold;');
      console.error('错误:', errorEvent.message);
      console.log('堆栈:', errorEvent.stack);
      console.log('上下文:', errorEvent.context);
      console.log('面包屑:', errorEvent.context?.breadcrumbs);
      console.groupEnd();
      return;
    }

    // 生产模式下，发送到错误跟踪服务
    if (this.config.dsn) {
      this.sendToServer(errorEvent);
    }
  }

  /**
   * 发送到服务端
   */
  private async sendToServer(errorEvent: ErrorEvent): Promise<void> {
    if (!this.config.dsn) return;

    try {
      const response = await fetch(this.config.dsn, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...errorEvent,
          environment: this.config.environment,
          release: this.config.release,
        }),
      });

      if (!response.ok) {
        console.warn('[ErrorTracking] 发送错误失败:', response.status);
      }
    } catch (err) {
      console.warn('[ErrorTracking] 发送错误时出错:', err);
    }
  }

  /**
   * 添加面包屑
   */
  addBreadcrumb(breadcrumb: Breadcrumb): void {
    this.breadcrumbs.push(breadcrumb);
    
    // 限制面包屑数量
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  /**
   * 设置用户信息
   */
  setUser(user: ErrorTrackingUser | null): void {
    this.config.user = user || undefined;
  }

  /**
   * 设置标签
   */
  setTag(key: string, value: string): void {
    if (!this.config.tags) {
      this.config.tags = {};
    }
    this.config.tags[key] = value;
  }

  /**
   * 设置额外上下文
   */
  setContext(name: string, context: Record<string, unknown>): void {
    this.addBreadcrumb({
      type: 'user',
      category: 'context',
      message: `设置上下文: ${name}`,
      data: context,
      timestamp: Date.now(),
    });
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    if (!this.config.enabled) return false;
    if (import.meta.env?.DEV && !this.config.enableInDev) return false;
    return this.isInitialized;
  }

  /**
   * 获取浏览器信息
   */
  private getBrowserInfo(): BrowserInfo | undefined {
    if (typeof window === 'undefined') return undefined;

    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenWidth: screen.width,
      screenHeight: screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取错误队列
   */
  getErrorQueue(): ErrorEvent[] {
    return [...this.errorQueue];
  }

  /**
   * 清空错误队列
   */
  clearErrorQueue(): void {
    this.errorQueue = [];
  }

  /**
   * 获取面包屑
   */
  getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  /**
   * 清空面包屑
   */
  clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }
}

// ============================================================================
// 单例实例
// ============================================================================

export const errorTracking = new ErrorTrackingService();

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 初始化错误跟踪
 */
export function initErrorTracking(config?: Partial<ErrorTrackingConfig>): void {
  errorTracking.init(config);
}

/**
 * 捕获错误
 */
export function captureError(error: Error, context?: Record<string, unknown>): void {
  errorTracking.captureError(error, context);
}

/**
 * 捕获消息
 */
export function captureMessage(message: string, level?: 'info' | 'warning' | 'error'): void {
  errorTracking.captureMessage(message, level);
}

/**
 * 添加面包屑
 */
export function addBreadcrumb(breadcrumb: Breadcrumb): void {
  errorTracking.addBreadcrumb(breadcrumb);
}

/**
 * 设置用户
 */
export function setUser(user: ErrorTrackingUser | null): void {
  errorTracking.setUser(user);
}

/**
 * 设置标签
 */
export function setTag(key: string, value: string): void {
  errorTracking.setTag(key, value);
}

/**
 * 创建与 ErrorBoundary 集成的错误跟踪器
 */
export function createErrorBoundaryTracker(): ErrorTracker {
  return {
    captureError: (error: Error, context?: Record<string, unknown>) => {
      errorTracking.captureError(error, {
        ...context,
        type: 'component',
      });
    },
    captureMessage: (message: string, level?: 'info' | 'warning' | 'error') => {
      errorTracking.captureMessage(message, level);
    },
  };
}

export default errorTracking;

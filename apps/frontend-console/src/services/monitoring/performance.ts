/**
 * 性能监控服务
 * 
 * 功能：
 * - 跟踪页面加载时间
 * - 跟踪 API 响应时间
 * - 跟踪渲染时间
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 性能监控配置
 */
export interface PerformanceMonitorConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 是否启用调试模式 */
  debug?: boolean;
  /** 采样率 (0-1) */
  sampleRate?: number;
  /** 慢请求阈值 (ms) */
  slowRequestThreshold?: number;
  /** 慢渲染阈值 (ms) */
  slowRenderThreshold?: number;
  /** 是否自动跟踪页面加载 */
  autoTrackPageLoad?: boolean;
  /** 是否自动跟踪资源加载 */
  autoTrackResources?: boolean;
  /** 报告回调 */
  onReport?: (metrics: PerformanceMetrics) => void;
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  /** 页面加载指标 */
  pageLoad?: PageLoadMetrics;
  /** Web Vitals 指标 */
  webVitals?: WebVitalsMetrics;
  /** API 性能指标 */
  api?: ApiPerformanceMetrics[];
  /** 渲染性能指标 */
  render?: RenderPerformanceMetrics[];
  /** 资源加载指标 */
  resources?: ResourceMetrics[];
  /** 内存使用 */
  memory?: MemoryMetrics;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 页面加载指标
 */
export interface PageLoadMetrics {
  /** DNS 查询时间 */
  dnsLookup: number;
  /** TCP 连接时间 */
  tcpConnection: number;
  /** TLS 握手时间 */
  tlsNegotiation: number;
  /** 请求时间 */
  request: number;
  /** 响应时间 */
  response: number;
  /** DOM 解析时间 */
  domParsing: number;
  /** DOM 内容加载时间 */
  domContentLoaded: number;
  /** 页面完全加载时间 */
  pageLoad: number;
  /** 首次绘制时间 */
  firstPaint?: number;
  /** 首次内容绘制时间 */
  firstContentfulPaint?: number;
}

/**
 * Web Vitals 指标
 */
export interface WebVitalsMetrics {
  /** Largest Contentful Paint */
  lcp?: number;
  /** First Input Delay */
  fid?: number;
  /** Cumulative Layout Shift */
  cls?: number;
  /** Time to First Byte */
  ttfb?: number;
  /** Interaction to Next Paint */
  inp?: number;
}

/**
 * API 性能指标
 */
export interface ApiPerformanceMetrics {
  /** 请求 URL */
  url: string;
  /** 请求方法 */
  method: string;
  /** 响应时间 (ms) */
  duration: number;
  /** 响应状态码 */
  status?: number;
  /** 是否成功 */
  success: boolean;
  /** 请求大小 (bytes) */
  requestSize?: number;
  /** 响应大小 (bytes) */
  responseSize?: number;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 渲染性能指标
 */
export interface RenderPerformanceMetrics {
  /** 组件名称 */
  componentName: string;
  /** 渲染时间 (ms) */
  duration: number;
  /** 渲染类型 */
  type: 'mount' | 'update' | 'unmount';
  /** 时间戳 */
  timestamp: number;
}

/**
 * 资源加载指标
 */
export interface ResourceMetrics {
  /** 资源名称 */
  name: string;
  /** 资源类型 */
  type: string;
  /** 加载时间 (ms) */
  duration: number;
  /** 传输大小 (bytes) */
  transferSize: number;
  /** 解码大小 (bytes) */
  decodedSize: number;
  /** 是否来自缓存 */
  fromCache: boolean;
}

/**
 * 内存指标
 */
export interface MemoryMetrics {
  /** 已使用的 JS 堆大小 (bytes) */
  usedJSHeapSize: number;
  /** JS 堆大小限制 (bytes) */
  jsHeapSizeLimit: number;
  /** 总 JS 堆大小 (bytes) */
  totalJSHeapSize: number;
}

/**
 * 性能标记
 */
interface PerformanceMark {
  name: string;
  startTime: number;
}

// ============================================================================
// 性能监控服务类
// ============================================================================

/**
 * 性能监控服务
 */
class PerformanceMonitorService {
  private config: PerformanceMonitorConfig;
  private apiMetrics: ApiPerformanceMetrics[] = [];
  private renderMetrics: RenderPerformanceMetrics[] = [];
  private marks: Map<string, PerformanceMark> = new Map();
  private isInitialized = false;
  private observer: PerformanceObserver | null = null;

  constructor(config: Partial<PerformanceMonitorConfig> = {}) {
    this.config = {
      enabled: true,
      debug: import.meta.env?.DEV,
      sampleRate: 1.0,
      slowRequestThreshold: 3000,
      slowRenderThreshold: 16,
      autoTrackPageLoad: true,
      autoTrackResources: true,
      ...config,
    };
  }

  /**
   * 初始化性能监控
   */
  init(config?: Partial<PerformanceMonitorConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (!this.config.enabled) {
      console.log('[Performance] 性能监控已禁用');
      return;
    }

    // 采样率检查
    if (Math.random() > (this.config.sampleRate || 1)) {
      console.log('[Performance] 未被采样，性能监控已跳过');
      return;
    }

    this.isInitialized = true;

    // 自动跟踪页面加载
    if (this.config.autoTrackPageLoad) {
      this.trackPageLoad();
    }

    // 设置性能观察器
    this.setupPerformanceObserver();

    if (this.config.debug) {
      console.log('[Performance] 性能监控已初始化');
    }
  }

  /**
   * 设置性能观察器
   */
  private setupPerformanceObserver(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      // 观察 LCP
      this.observeLCP();
      
      // 观察 FID
      this.observeFID();
      
      // 观察 CLS
      this.observeCLS();

      // 观察资源加载
      if (this.config.autoTrackResources) {
        this.observeResources();
      }
    } catch (error) {
      console.warn('[Performance] 设置性能观察器失败:', error);
    }
  }

  /**
   * 观察 LCP
   */
  private observeLCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          const lcp = lastEntry.startTime;
          if (this.config.debug) {
            console.log('[Performance] LCP:', lcp.toFixed(2), 'ms');
          }
        }
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // 浏览器不支持
    }
  }

  /**
   * 观察 FID
   */
  private observeFID(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const fid = (entry as PerformanceEventTiming).processingStart - entry.startTime;
          if (this.config.debug) {
            console.log('[Performance] FID:', fid.toFixed(2), 'ms');
          }
        });
      });
      observer.observe({ type: 'first-input', buffered: true });
    } catch {
      // 浏览器不支持
    }
  }

  /**
   * 观察 CLS
   */
  private observeCLS(): void {
    try {
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (!(entry as LayoutShift).hadRecentInput) {
            clsValue += (entry as LayoutShift).value;
          }
        });
        if (this.config.debug) {
          console.log('[Performance] CLS:', clsValue.toFixed(4));
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    } catch {
      // 浏览器不支持
    }
  }

  /**
   * 观察资源加载
   */
  private observeResources(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const resource = entry as PerformanceResourceTiming;
          if (this.config.debug && resource.duration > 100) {
            console.log('[Performance] 资源加载:', {
              name: resource.name,
              duration: resource.duration.toFixed(2) + 'ms',
              size: resource.transferSize,
            });
          }
        });
      });
      observer.observe({ type: 'resource', buffered: true });
      this.observer = observer;
    } catch {
      // 浏览器不支持
    }
  }

  /**
   * 跟踪页面加载
   */
  trackPageLoad(): PageLoadMetrics | null {
    if (typeof performance === 'undefined') return null;

    const timing = performance.timing || (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming);
    
    if (!timing) return null;

    let metrics: PageLoadMetrics;

    if ('navigationStart' in timing) {
      // 旧版 API
      const t = timing as PerformanceTiming;
      metrics = {
        dnsLookup: t.domainLookupEnd - t.domainLookupStart,
        tcpConnection: t.connectEnd - t.connectStart,
        tlsNegotiation: t.secureConnectionStart > 0 ? t.connectEnd - t.secureConnectionStart : 0,
        request: t.responseStart - t.requestStart,
        response: t.responseEnd - t.responseStart,
        domParsing: t.domInteractive - t.responseEnd,
        domContentLoaded: t.domContentLoadedEventEnd - t.navigationStart,
        pageLoad: t.loadEventEnd - t.navigationStart,
      };
    } else {
      // 新版 API
      const t = timing as PerformanceNavigationTiming;
      metrics = {
        dnsLookup: t.domainLookupEnd - t.domainLookupStart,
        tcpConnection: t.connectEnd - t.connectStart,
        tlsNegotiation: t.secureConnectionStart > 0 ? t.connectEnd - t.secureConnectionStart : 0,
        request: t.responseStart - t.requestStart,
        response: t.responseEnd - t.responseStart,
        domParsing: t.domInteractive - t.responseEnd,
        domContentLoaded: t.domContentLoadedEventEnd - t.startTime,
        pageLoad: t.loadEventEnd - t.startTime,
      };
    }

    // 获取绘制时间
    const paintEntries = performance.getEntriesByType('paint');
    paintEntries.forEach((entry) => {
      if (entry.name === 'first-paint') {
        metrics.firstPaint = entry.startTime;
      } else if (entry.name === 'first-contentful-paint') {
        metrics.firstContentfulPaint = entry.startTime;
      }
    });

    if (this.config.debug) {
      console.log('[Performance] 页面加载指标:', metrics);
    }

    return metrics;
  }

  /**
   * 开始计时
   */
  startMark(name: string): void {
    if (!this.isEnabled()) return;

    this.marks.set(name, {
      name,
      startTime: performance.now(),
    });

    if (typeof performance.mark === 'function') {
      performance.mark(`${name}-start`);
    }
  }

  /**
   * 结束计时并返回持续时间
   */
  endMark(name: string): number | null {
    if (!this.isEnabled()) return null;

    const mark = this.marks.get(name);
    if (!mark) {
      console.warn(`[Performance] 未找到标记: ${name}`);
      return null;
    }

    const duration = performance.now() - mark.startTime;
    this.marks.delete(name);

    if (typeof performance.mark === 'function') {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
    }

    if (this.config.debug) {
      console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  /**
   * 跟踪 API 请求
   */
  trackApiRequest(metrics: Omit<ApiPerformanceMetrics, 'timestamp'>): void {
    if (!this.isEnabled()) return;

    const fullMetrics: ApiPerformanceMetrics = {
      ...metrics,
      timestamp: Date.now(),
    };

    this.apiMetrics.push(fullMetrics);

    // 限制存储的指标数量
    if (this.apiMetrics.length > 100) {
      this.apiMetrics.shift();
    }

    // 检查慢请求
    if (metrics.duration > (this.config.slowRequestThreshold || 3000)) {
      console.warn('[Performance] 慢请求检测:', {
        url: metrics.url,
        method: metrics.method,
        duration: `${metrics.duration.toFixed(2)}ms`,
      });
    }

    if (this.config.debug) {
      console.log('[Performance] API 请求:', {
        url: metrics.url,
        method: metrics.method,
        duration: `${metrics.duration.toFixed(2)}ms`,
        status: metrics.status,
      });
    }
  }

  /**
   * 跟踪组件渲染
   */
  trackRender(metrics: Omit<RenderPerformanceMetrics, 'timestamp'>): void {
    if (!this.isEnabled()) return;

    const fullMetrics: RenderPerformanceMetrics = {
      ...metrics,
      timestamp: Date.now(),
    };

    this.renderMetrics.push(fullMetrics);

    // 限制存储的指标数量
    if (this.renderMetrics.length > 100) {
      this.renderMetrics.shift();
    }

    // 检查慢渲染
    if (metrics.duration > (this.config.slowRenderThreshold || 16)) {
      console.warn('[Performance] 慢渲染检测:', {
        component: metrics.componentName,
        type: metrics.type,
        duration: `${metrics.duration.toFixed(2)}ms`,
      });
    }

    if (this.config.debug) {
      console.log('[Performance] 组件渲染:', {
        component: metrics.componentName,
        type: metrics.type,
        duration: `${metrics.duration.toFixed(2)}ms`,
      });
    }
  }

  /**
   * 获取内存使用情况
   */
  getMemoryUsage(): MemoryMetrics | null {
    if (typeof performance === 'undefined') return null;

    const memory = (performance as Performance & { memory?: MemoryMetrics }).memory;
    if (!memory) return null;

    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      totalJSHeapSize: memory.totalJSHeapSize,
    };
  }

  /**
   * 获取所有性能指标
   */
  getMetrics(): PerformanceMetrics {
    return {
      pageLoad: this.trackPageLoad() || undefined,
      api: [...this.apiMetrics],
      render: [...this.renderMetrics],
      memory: this.getMemoryUsage() || undefined,
      timestamp: Date.now(),
    };
  }

  /**
   * 获取 API 性能指标
   */
  getApiMetrics(): ApiPerformanceMetrics[] {
    return [...this.apiMetrics];
  }

  /**
   * 获取渲染性能指标
   */
  getRenderMetrics(): RenderPerformanceMetrics[] {
    return [...this.renderMetrics];
  }

  /**
   * 清除指标
   */
  clearMetrics(): void {
    this.apiMetrics = [];
    this.renderMetrics = [];
    this.marks.clear();
  }

  /**
   * 报告指标
   */
  report(): void {
    if (!this.isEnabled()) return;

    const metrics = this.getMetrics();
    
    if (this.config.onReport) {
      this.config.onReport(metrics);
    }

    if (this.config.debug) {
      console.log('[Performance] 性能报告:', metrics);
    }
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled && this.isInitialized;
  }

  /**
   * 销毁
   */
  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.clearMetrics();
    this.isInitialized = false;
  }
}

// ============================================================================
// 类型扩展
// ============================================================================

interface PerformanceEventTiming extends PerformanceEntry {
  processingStart: number;
}

interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

// ============================================================================
// 单例实例
// ============================================================================

export const performanceMonitor = new PerformanceMonitorService();

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 初始化性能监控
 */
export function initPerformanceMonitor(config?: Partial<PerformanceMonitorConfig>): void {
  performanceMonitor.init(config);
}

/**
 * 开始计时
 */
export function startMark(name: string): void {
  performanceMonitor.startMark(name);
}

/**
 * 结束计时
 */
export function endMark(name: string): number | null {
  return performanceMonitor.endMark(name);
}

/**
 * 跟踪 API 请求
 */
export function trackApiRequest(metrics: Omit<ApiPerformanceMetrics, 'timestamp'>): void {
  performanceMonitor.trackApiRequest(metrics);
}

/**
 * 跟踪组件渲染
 */
export function trackRender(metrics: Omit<RenderPerformanceMetrics, 'timestamp'>): void {
  performanceMonitor.trackRender(metrics);
}

/**
 * 获取性能指标
 */
export function getPerformanceMetrics(): PerformanceMetrics {
  return performanceMonitor.getMetrics();
}

/**
 * 测量函数执行时间
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  performanceMonitor.startMark(name);
  try {
    return await fn();
  } finally {
    performanceMonitor.endMark(name);
  }
}

/**
 * 测量同步函数执行时间
 */
export function measureSync<T>(name: string, fn: () => T): T {
  performanceMonitor.startMark(name);
  try {
    return fn();
  } finally {
    performanceMonitor.endMark(name);
  }
}

export default performanceMonitor;

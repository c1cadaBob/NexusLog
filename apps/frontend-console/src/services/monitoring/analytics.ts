/**
 * 分析跟踪服务
 * 
 * 功能：
 * - 集成分析服务（如 Google Analytics）
 * - 跟踪页面浏览和用户交互
 * - 尊重用户隐私设置
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 分析配置
 */
export interface AnalyticsConfig {
  /** 是否启用分析 */
  enabled: boolean;
  /** 跟踪 ID (如 GA4 的 Measurement ID) */
  trackingId?: string;
  /** 是否启用调试模式 */
  debug?: boolean;
  /** 是否匿名化 IP */
  anonymizeIp?: boolean;
  /** 是否尊重 Do Not Track */
  respectDoNotTrack?: boolean;
  /** 用户同意状态 */
  consentGranted?: boolean;
  /** 自定义维度 */
  customDimensions?: Record<string, string>;
  /** 用户 ID */
  userId?: string;
}

/**
 * 页面浏览事件
 */
export interface PageViewEvent {
  /** 页面路径 */
  path: string;
  /** 页面标题 */
  title?: string;
  /** 来源页面 */
  referrer?: string;
  /** 自定义参数 */
  params?: Record<string, string>;
}

/**
 * 用户交互事件
 */
export interface TrackEvent {
  /** 事件类别 */
  category: string;
  /** 事件动作 */
  action: string;
  /** 事件标签 */
  label?: string;
  /** 事件值 */
  value?: number;
  /** 自定义参数 */
  params?: Record<string, unknown>;
}

/**
 * 用户属性
 */
export interface UserProperties {
  /** 用户 ID */
  userId?: string;
  /** 用户类型 */
  userType?: string;
  /** 订阅计划 */
  subscriptionPlan?: string;
  /** 自定义属性 */
  [key: string]: unknown;
}

/**
 * 电商事件
 */
export interface EcommerceEvent {
  /** 事件类型 */
  type: 'view_item' | 'add_to_cart' | 'purchase' | 'refund';
  /** 交易 ID */
  transactionId?: string;
  /** 金额 */
  value?: number;
  /** 货币 */
  currency?: string;
  /** 商品列表 */
  items?: EcommerceItem[];
}

/**
 * 电商商品
 */
export interface EcommerceItem {
  /** 商品 ID */
  itemId: string;
  /** 商品名称 */
  itemName: string;
  /** 商品类别 */
  itemCategory?: string;
  /** 商品价格 */
  price?: number;
  /** 数量 */
  quantity?: number;
}

/**
 * 隐私设置
 */
export interface PrivacySettings {
  /** 是否允许分析 */
  analyticsEnabled: boolean;
  /** 是否允许广告跟踪 */
  advertisingEnabled: boolean;
  /** 是否允许功能性 Cookie */
  functionalEnabled: boolean;
}

// ============================================================================
// 分析服务类
// ============================================================================

/**
 * 分析跟踪服务
 */
class AnalyticsService {
  private config: AnalyticsConfig;
  private isInitialized = false;
  private eventQueue: TrackEvent[] = [];
  private privacySettings: PrivacySettings = {
    analyticsEnabled: false,
    advertisingEnabled: false,
    functionalEnabled: true,
  };

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = {
      enabled: true,
      debug: import.meta.env?.DEV,
      anonymizeIp: true,
      respectDoNotTrack: true,
      consentGranted: false,
      ...config,
    };

    // 从 localStorage 加载隐私设置
    this.loadPrivacySettings();
  }

  /**
   * 初始化分析服务
   */
  init(config?: Partial<AnalyticsConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // 检查 Do Not Track
    if (this.config.respectDoNotTrack && this.isDoNotTrackEnabled()) {
      console.log('[Analytics] 用户启用了 Do Not Track，分析已禁用');
      this.config.enabled = false;
      return;
    }

    // 检查用户同意
    if (!this.hasUserConsent()) {
      console.log('[Analytics] 等待用户同意');
      return;
    }

    this.isInitialized = true;
    
    // 处理队列中的事件
    this.processEventQueue();

    if (this.config.debug) {
      console.log('[Analytics] 分析服务已初始化', {
        trackingId: this.config.trackingId,
        anonymizeIp: this.config.anonymizeIp,
      });
    }
  }

  /**
   * 检查是否启用了 Do Not Track
   */
  private isDoNotTrackEnabled(): boolean {
    if (typeof navigator === 'undefined') return false;
    
    const dnt = navigator.doNotTrack || 
      (window as unknown as { doNotTrack?: string }).doNotTrack || 
      (navigator as unknown as { msDoNotTrack?: string }).msDoNotTrack;
    
    return dnt === '1' || dnt === 'yes';
  }

  /**
   * 检查用户是否已同意
   */
  private hasUserConsent(): boolean {
    return this.config.consentGranted || this.privacySettings.analyticsEnabled;
  }

  /**
   * 加载隐私设置
   */
  private loadPrivacySettings(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const saved = localStorage.getItem('privacy_settings');
      if (saved) {
        this.privacySettings = JSON.parse(saved);
      }
    } catch {
      // 忽略解析错误
    }
  }

  /**
   * 保存隐私设置
   */
  private savePrivacySettings(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem('privacy_settings', JSON.stringify(this.privacySettings));
    } catch {
      // 忽略存储错误
    }
  }

  /**
   * 更新隐私设置
   */
  updatePrivacySettings(settings: Partial<PrivacySettings>): void {
    this.privacySettings = { ...this.privacySettings, ...settings };
    this.savePrivacySettings();

    if (settings.analyticsEnabled !== undefined) {
      this.config.consentGranted = settings.analyticsEnabled;
      
      if (settings.analyticsEnabled && !this.isInitialized) {
        this.init();
      }
    }

    if (this.config.debug) {
      console.log('[Analytics] 隐私设置已更新', this.privacySettings);
    }
  }

  /**
   * 获取隐私设置
   */
  getPrivacySettings(): PrivacySettings {
    return { ...this.privacySettings };
  }

  /**
   * 处理事件队列
   */
  private processEventQueue(): void {
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      if (event) {
        this.sendEvent(event);
      }
    }
  }

  /**
   * 跟踪页面浏览
   */
  trackPageView(event: PageViewEvent): void {
    if (!this.isEnabled()) {
      if (this.config.debug) {
        console.log('[Analytics] 页面浏览（未启用）:', event);
      }
      return;
    }

    const pageViewData = {
      page_path: event.path,
      page_title: event.title || document.title,
      page_referrer: event.referrer || document.referrer,
      ...event.params,
    };

    this.send('page_view', pageViewData);

    if (this.config.debug) {
      console.log('[Analytics] 页面浏览:', pageViewData);
    }
  }

  /**
   * 跟踪事件
   */
  trackEvent(event: TrackEvent): void {
    if (!this.isEnabled()) {
      // 如果未初始化，将事件加入队列
      if (!this.isInitialized && this.config.enabled) {
        this.eventQueue.push(event);
      }
      
      if (this.config.debug) {
        console.log('[Analytics] 事件（未启用）:', event);
      }
      return;
    }

    this.sendEvent(event);
  }

  /**
   * 发送事件
   */
  private sendEvent(event: TrackEvent): void {
    const eventData = {
      event_category: event.category,
      event_action: event.action,
      event_label: event.label,
      value: event.value,
      ...event.params,
    };

    this.send(event.action, eventData);

    if (this.config.debug) {
      console.log('[Analytics] 事件:', eventData);
    }
  }

  /**
   * 跟踪用户交互
   */
  trackInteraction(
    element: string,
    action: 'click' | 'hover' | 'focus' | 'scroll' | 'submit',
    details?: Record<string, unknown>
  ): void {
    this.trackEvent({
      category: 'User Interaction',
      action,
      label: element,
      params: details,
    });
  }

  /**
   * 跟踪搜索
   */
  trackSearch(searchTerm: string, resultsCount?: number): void {
    this.trackEvent({
      category: 'Search',
      action: 'search',
      label: searchTerm,
      value: resultsCount,
      params: {
        search_term: searchTerm,
        results_count: resultsCount,
      },
    });
  }

  /**
   * 跟踪功能使用
   */
  trackFeatureUsage(featureName: string, action: string, details?: Record<string, unknown>): void {
    this.trackEvent({
      category: 'Feature Usage',
      action,
      label: featureName,
      params: details,
    });
  }

  /**
   * 跟踪错误
   */
  trackError(errorType: string, errorMessage: string, fatal = false): void {
    this.trackEvent({
      category: 'Error',
      action: errorType,
      label: errorMessage,
      params: {
        fatal,
        error_type: errorType,
        error_message: errorMessage,
      },
    });
  }

  /**
   * 跟踪计时
   */
  trackTiming(category: string, variable: string, timeMs: number, label?: string): void {
    this.trackEvent({
      category: 'Timing',
      action: variable,
      label: label || category,
      value: Math.round(timeMs),
      params: {
        timing_category: category,
        timing_variable: variable,
        timing_value: timeMs,
        timing_label: label,
      },
    });
  }

  /**
   * 设置用户属性
   */
  setUserProperties(properties: UserProperties): void {
    if (properties.userId) {
      this.config.userId = properties.userId;
    }

    if (!this.isEnabled()) {
      if (this.config.debug) {
        console.log('[Analytics] 用户属性（未启用）:', properties);
      }
      return;
    }

    this.send('set_user_properties', { user_properties: properties });

    if (this.config.debug) {
      console.log('[Analytics] 用户属性:', properties);
    }
  }

  /**
   * 设置用户 ID
   */
  setUserId(userId: string | null): void {
    this.config.userId = userId || undefined;

    if (this.config.debug) {
      console.log('[Analytics] 用户 ID:', userId);
    }
  }

  /**
   * 跟踪电商事件
   */
  trackEcommerce(event: EcommerceEvent): void {
    if (!this.isEnabled()) {
      if (this.config.debug) {
        console.log('[Analytics] 电商事件（未启用）:', event);
      }
      return;
    }

    const eventData = {
      transaction_id: event.transactionId,
      value: event.value,
      currency: event.currency || 'CNY',
      items: event.items?.map(item => ({
        item_id: item.itemId,
        item_name: item.itemName,
        item_category: item.itemCategory,
        price: item.price,
        quantity: item.quantity,
      })),
    };

    this.send(event.type, eventData);

    if (this.config.debug) {
      console.log('[Analytics] 电商事件:', event.type, eventData);
    }
  }

  /**
   * 发送数据到分析服务
   */
  private send(eventName: string, data: Record<string, unknown>): void {
    // 添加通用参数
    const payload = {
      ...data,
      timestamp: Date.now(),
      user_id: this.config.userId,
      ...this.config.customDimensions,
    };

    // 在开发模式下，只输出到控制台
    if (import.meta.env?.DEV) {
      console.log(`[Analytics] 发送: ${eventName}`, payload);
      return;
    }

    // 生产模式下，发送到分析服务
    // 这里可以集成 Google Analytics、Mixpanel 等
    if (this.config.trackingId) {
      this.sendToGoogleAnalytics(eventName, payload);
    }
  }

  /**
   * 发送到 Google Analytics
   */
  private sendToGoogleAnalytics(eventName: string, data: Record<string, unknown>): void {
    // 检查 gtag 是否可用
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    
    if (typeof gtag === 'function') {
      gtag('event', eventName, data);
    }
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled && this.isInitialized && this.hasUserConsent();
  }

  /**
   * 获取配置
   */
  getConfig(): AnalyticsConfig {
    return { ...this.config };
  }
}

// ============================================================================
// 单例实例
// ============================================================================

export const analytics = new AnalyticsService();

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 初始化分析
 */
export function initAnalytics(config?: Partial<AnalyticsConfig>): void {
  analytics.init(config);
}

/**
 * 跟踪页面浏览
 */
export function trackPageView(event: PageViewEvent): void {
  analytics.trackPageView(event);
}

/**
 * 跟踪事件
 */
export function trackEvent(event: TrackEvent): void {
  analytics.trackEvent(event);
}

/**
 * 跟踪用户交互
 */
export function trackInteraction(
  element: string,
  action: 'click' | 'hover' | 'focus' | 'scroll' | 'submit',
  details?: Record<string, unknown>
): void {
  analytics.trackInteraction(element, action, details);
}

/**
 * 跟踪搜索
 */
export function trackSearch(searchTerm: string, resultsCount?: number): void {
  analytics.trackSearch(searchTerm, resultsCount);
}

/**
 * 跟踪功能使用
 */
export function trackFeatureUsage(
  featureName: string,
  action: string,
  details?: Record<string, unknown>
): void {
  analytics.trackFeatureUsage(featureName, action, details);
}

/**
 * 更新隐私设置
 */
export function updatePrivacySettings(settings: Partial<PrivacySettings>): void {
  analytics.updatePrivacySettings(settings);
}

/**
 * 获取隐私设置
 */
export function getPrivacySettings(): PrivacySettings {
  return analytics.getPrivacySettings();
}

export default analytics;

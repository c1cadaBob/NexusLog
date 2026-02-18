/**
 * 移动端优化工具
 * 
 * 提供移动端性能优化相关的工具函数
 */

// ============================================================================
// 设备检测
// ============================================================================

/**
 * 检测是否为移动设备
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * 检测是否为触摸设备
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * 检测是否为低端设备（基于内存和 CPU 核心数）
 */
export function isLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  
  // 检查设备内存（如果可用）
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (deviceMemory && deviceMemory < 4) {
    return true;
  }
  
  // 检查 CPU 核心数
  const hardwareConcurrency = navigator.hardwareConcurrency;
  if (hardwareConcurrency && hardwareConcurrency < 4) {
    return true;
  }
  
  return false;
}

/**
 * 获取网络连接类型
 */
export function getConnectionType(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  
  const connection = (navigator as Navigator & { 
    connection?: { effectiveType?: string; type?: string } 
  }).connection;
  
  return connection?.effectiveType || connection?.type || 'unknown';
}

/**
 * 检测是否为慢速网络
 */
export function isSlowConnection(): boolean {
  const connectionType = getConnectionType();
  return ['slow-2g', '2g', '3g'].includes(connectionType);
}

// ============================================================================
// 图片优化
// ============================================================================

/**
 * 根据设备和网络条件获取最佳图片质量
 */
export function getOptimalImageQuality(): number {
  if (isLowEndDevice() || isSlowConnection()) {
    return 60;
  }
  if (isMobileDevice()) {
    return 75;
  }
  return 85;
}

/**
 * 根据设备像素比获取最佳图片尺寸
 */
export function getOptimalImageSize(baseSize: number): number {
  if (typeof window === 'undefined') return baseSize;
  
  const dpr = Math.min(window.devicePixelRatio || 1, 2); // 限制最大 2x
  
  if (isLowEndDevice() || isSlowConnection()) {
    return baseSize; // 低端设备使用 1x
  }
  
  return Math.round(baseSize * dpr);
}

/**
 * 生成响应式图片 srcset
 */
export function generateSrcSet(
  baseUrl: string,
  sizes: number[] = [320, 640, 960, 1280]
): string {
  return sizes
    .map(size => `${baseUrl}?w=${size} ${size}w`)
    .join(', ');
}

// ============================================================================
// 性能优化
// ============================================================================

/**
 * 获取推荐的列表项数量（基于设备性能）
 */
export function getRecommendedPageSize(): number {
  if (isLowEndDevice()) {
    return 10;
  }
  if (isMobileDevice()) {
    return 20;
  }
  return 50;
}

/**
 * 获取推荐的动画持续时间（低端设备减少动画）
 */
export function getRecommendedAnimationDuration(baseDuration: number): number {
  if (isLowEndDevice()) {
    return 0; // 禁用动画
  }
  if (isMobileDevice()) {
    return baseDuration * 0.7; // 缩短动画
  }
  return baseDuration;
}

/**
 * 检测是否应该启用虚拟化
 */
export function shouldEnableVirtualization(itemCount: number): boolean {
  const threshold = isLowEndDevice() ? 20 : isMobileDevice() ? 50 : 100;
  return itemCount > threshold;
}

// ============================================================================
// 资源预加载
// ============================================================================

/**
 * 预加载关键资源
 */
export function preloadCriticalResources(urls: string[]): void {
  if (typeof document === 'undefined') return;
  
  // 在慢速网络上跳过预加载
  if (isSlowConnection()) return;
  
  urls.forEach(url => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    
    // 根据文件类型设置 as 属性
    if (url.endsWith('.js')) {
      link.as = 'script';
    } else if (url.endsWith('.css')) {
      link.as = 'style';
    } else if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url)) {
      link.as = 'image';
    } else if (/\.(woff|woff2|ttf|otf)$/i.test(url)) {
      link.as = 'font';
      link.crossOrigin = 'anonymous';
    }
    
    document.head.appendChild(link);
  });
}

/**
 * 预连接到关键域名
 */
export function preconnectToDomains(domains: string[]): void {
  if (typeof document === 'undefined') return;
  
  domains.forEach(domain => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = domain;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
}

// ============================================================================
// 内存管理
// ============================================================================

/**
 * 清理未使用的图片缓存
 */
export function clearImageCache(): void {
  if (typeof window === 'undefined') return;
  
  // 清理 blob URLs
  const images = document.querySelectorAll('img[src^="blob:"]');
  images.forEach(img => {
    const src = (img as HTMLImageElement).src;
    if (src.startsWith('blob:')) {
      URL.revokeObjectURL(src);
    }
  });
}

/**
 * 获取当前内存使用情况（如果可用）
 */
export function getMemoryUsage(): { usedJSHeapSize?: number; totalJSHeapSize?: number } | null {
  if (typeof performance === 'undefined') return null;
  
  const memory = (performance as Performance & { 
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number } 
  }).memory;
  
  if (!memory) return null;
  
  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
  };
}

// ============================================================================
// 视口优化
// ============================================================================

/**
 * 获取安全区域内边距
 */
export function getSafeAreaInsets(): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (typeof window === 'undefined' || typeof getComputedStyle === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  
  const style = getComputedStyle(document.documentElement);
  
  return {
    top: parseInt(style.getPropertyValue('--sat') || '0', 10),
    right: parseInt(style.getPropertyValue('--sar') || '0', 10),
    bottom: parseInt(style.getPropertyValue('--sab') || '0', 10),
    left: parseInt(style.getPropertyValue('--sal') || '0', 10),
  };
}

/**
 * 设置视口高度 CSS 变量（解决移动端 100vh 问题）
 */
export function setViewportHeight(): void {
  if (typeof window === 'undefined') return;
  
  const setVh = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };
  
  setVh();
  window.addEventListener('resize', setVh);
  window.addEventListener('orientationchange', setVh);
}

// ============================================================================
// 导出移动端优化配置
// ============================================================================

export const MOBILE_CONFIG = {
  /** 触摸目标最小尺寸 */
  minTouchTargetSize: 44,
  /** 默认动画持续时间 */
  defaultAnimationDuration: 200,
  /** 滑动阈值 */
  swipeThreshold: 50,
  /** 下拉刷新阈值 */
  pullRefreshThreshold: 80,
  /** 移动端断点 */
  mobileBreakpoint: 768,
  /** 平板断点 */
  tabletBreakpoint: 1024,
};

/**
 * 路由预加载工具
 * 
 * 提供路由级别的代码预加载功能，优化用户体验
 * 
 * 注意：页面模块将在任务 19 中创建，届时需要更新此文件中的导入路径
 */

// ============================================================================
// 路由模块映射
// ============================================================================

/**
 * 路由到模块的映射
 * 用于根据路由路径预加载对应的页面组件
 * 
 * TODO: 任务 19 完成后，取消注释并更新导入路径
 */
const routeModuleMap: Record<string, () => Promise<unknown>> = {
  // 页面模块将在任务 19 中创建
  // 当前使用空映射，避免编译错误
};

// ============================================================================
// 预加载缓存
// ============================================================================

const preloadedRoutes = new Set<string>();

// ============================================================================
// 预加载函数
// ============================================================================

/**
 * 预加载指定路由的页面组件
 * @param path 路由路径
 */
export const preloadRoute = (path: string): void => {
  // 已预加载则跳过
  if (preloadedRoutes.has(path)) {
    return;
  }
  
  const loader = routeModuleMap[path];
  if (loader) {
    preloadedRoutes.add(path);
    // 使用 requestIdleCallback 在空闲时预加载
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        loader().catch(() => {
          // 预加载失败时从缓存中移除，允许重试
          preloadedRoutes.delete(path);
        });
      });
    } else {
      // 降级使用 setTimeout
      setTimeout(() => {
        loader().catch(() => {
          preloadedRoutes.delete(path);
        });
      }, 100);
    }
  }
};

/**
 * 预加载多个路由
 * @param paths 路由路径数组
 */
export const preloadRoutes = (paths: string[]): void => {
  paths.forEach(preloadRoute);
};

/**
 * 预加载模块下的所有路由
 * @param modulePrefix 模块前缀，如 '/search'
 */
export const preloadModule = (modulePrefix: string): void => {
  const modulePaths = Object.keys(routeModuleMap).filter(
    path => path.startsWith(modulePrefix)
  );
  preloadRoutes(modulePaths);
};

/**
 * 检查路由是否已预加载
 * @param path 路由路径
 */
export const isRoutePreloaded = (path: string): boolean => {
  return preloadedRoutes.has(path);
};

/**
 * 获取所有可预加载的路由
 */
export const getPreloadableRoutes = (): string[] => {
  return Object.keys(routeModuleMap);
};

// ============================================================================
// 事件处理器工厂
// ============================================================================

/**
 * 创建鼠标悬停预加载处理器
 * 用于在用户悬停导航链接时预加载对应页面
 * 
 * @example
 * <Link to="/search" onMouseEnter={createHoverPreloader('/search')}>
 *   搜索
 * </Link>
 */
export const createHoverPreloader = (path: string): (() => void) => {
  return () => preloadRoute(path);
};

/**
 * 创建模块悬停预加载处理器
 * 用于在用户悬停模块导航时预加载整个模块
 * 
 * @example
 * <div onMouseEnter={createModuleHoverPreloader('/search')}>
 *   搜索模块
 * </div>
 */
export const createModuleHoverPreloader = (modulePrefix: string): (() => void) => {
  return () => preloadModule(modulePrefix);
};

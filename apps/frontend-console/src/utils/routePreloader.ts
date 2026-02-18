/**
 * 路由预加载工具
 * 
 * 提供路由级别的代码预加载功能，优化用户体验
 */

// ============================================================================
// 路由模块映射
// ============================================================================

/**
 * 路由到模块的映射
 * 用于根据路由路径预加载对应的页面组件
 */
const routeModuleMap: Record<string, () => Promise<unknown>> = {
  // 日志检索模块
  '/search': () => import('../pages/search/RealtimeSearch'),
  '/search/realtime': () => import('../pages/search/RealtimeSearch'),
  '/search/history': () => import('../pages/search/SearchHistory'),
  '/search/saved': () => import('../pages/search/SavedQueries'),
  
  // 日志分析模块
  '/analysis': () => import('../pages/analysis/AggregateAnalysis'),
  '/analysis/aggregate': () => import('../pages/analysis/AggregateAnalysis'),
  '/analysis/anomaly': () => import('../pages/analysis/AnomalyDetection'),
  '/analysis/clustering': () => import('../pages/analysis/LogClustering'),
  
  // 告警中心模块
  '/alerts': () => import('../pages/alerts/AlertList'),
  '/alerts/list': () => import('../pages/alerts/AlertList'),
  '/alerts/rules': () => import('../pages/alerts/AlertRules'),
  '/alerts/notifications': () => import('../pages/alerts/NotificationConfig'),
  '/alerts/silence': () => import('../pages/alerts/SilencePolicy'),
  
  // 采集与接入模块
  '/ingestion': () => import('../pages/ingestion/SourceManagement'),
  '/ingestion/sources': () => import('../pages/ingestion/SourceManagement'),
  '/ingestion/agents': () => import('../pages/ingestion/AgentManagement'),
  '/ingestion/wizard': () => import('../pages/ingestion/AccessWizard'),
  '/ingestion/status': () => import('../pages/ingestion/SourceStatus'),
  
  // 解析与字段模块
  '/parsing': () => import('../pages/parsing/FieldMapping'),
  '/parsing/mapping': () => import('../pages/parsing/FieldMapping'),
  '/parsing/rules': () => import('../pages/parsing/ParsingRules'),
  '/parsing/masking': () => import('../pages/parsing/MaskingRules'),
  '/parsing/dictionary': () => import('../pages/parsing/FieldDictionary'),
  
  // 索引与存储模块
  '/storage': () => import('../pages/storage/IndexManagement'),
  '/storage/indices': () => import('../pages/storage/IndexManagement'),
  '/storage/ilm': () => import('../pages/storage/LifecyclePolicy'),
  '/storage/backup': () => import('../pages/storage/BackupRecovery'),
  '/storage/capacity': () => import('../pages/storage/CapacityMonitoring'),
  
  // 性能与高可用模块
  '/performance': () => import('../pages/performance/PerformanceMonitoring'),
  '/performance/monitoring': () => import('../pages/performance/PerformanceMonitoring'),
  '/performance/health': () => import('../pages/performance/HealthCheck'),
  '/performance/scaling': () => import('../pages/performance/AutoScaling'),
  '/performance/dr': () => import('../pages/performance/DisasterRecovery'),
  
  // 分布式追踪模块
  '/tracing': () => import('../pages/tracing/TraceSearch'),
  '/tracing/search': () => import('../pages/tracing/TraceSearch'),
  '/tracing/analysis': () => import('../pages/tracing/TraceAnalysis'),
  '/tracing/topology': () => import('../pages/tracing/ServiceTopology'),
  
  // 报表中心模块
  '/reports': () => import('../pages/reports/ReportManagement'),
  '/reports/management': () => import('../pages/reports/ReportManagement'),
  '/reports/scheduled': () => import('../pages/reports/ScheduledTasks'),
  '/reports/downloads': () => import('../pages/reports/DownloadRecords'),
  
  // 安全与审计模块
  '/security': () => import('../pages/security/UserManagement'),
  '/security/users': () => import('../pages/security/UserManagement'),
  '/security/roles': () => import('../pages/security/RolePermissions'),
  '/security/audit': () => import('../pages/security/AuditLogs'),
  '/security/login-policy': () => import('../pages/security/LoginPolicy'),
  
  // 集成与开放平台模块
  '/integration': () => import('../pages/integration/ApiDocs'),
  '/integration/api': () => import('../pages/integration/ApiDocs'),
  '/integration/webhook': () => import('../pages/integration/WebhookManagement'),
  '/integration/sdk': () => import('../pages/integration/SdkDownload'),
  '/integration/plugins': () => import('../pages/integration/PluginMarket'),
  
  // 成本管理模块
  '/cost': () => import('../pages/cost/CostOverview'),
  '/cost/overview': () => import('../pages/cost/CostOverview'),
  '/cost/budgets': () => import('../pages/cost/BudgetAlerts'),
  '/cost/optimization': () => import('../pages/cost/OptimizationSuggestions'),
  
  // 系统设置模块
  '/settings': () => import('../pages/settings/SystemParameters'),
  '/settings/parameters': () => import('../pages/settings/SystemParameters'),
  '/settings/global': () => import('../pages/settings/GlobalConfig'),
  '/settings/versions': () => import('../pages/settings/ConfigVersions'),
  
  // 帮助中心模块
  '/help': () => import('../pages/help/QuerySyntax'),
  '/help/syntax': () => import('../pages/help/QuerySyntax'),
  '/help/faq': () => import('../pages/help/FAQ'),
  '/help/tickets': () => import('../pages/help/TicketPortal'),
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

/**
 * 懒加载属性测试
 * 
 * 验证非首页路由使用 React.lazy 实现懒加载
 * 
 * **Property 3: 非首页路由懒加载**
 * **Validates: Requirements 3.3**
 * 
 * @requirements 3.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 读取路由配置文件内容
 */
function getRoutesFileContent(): string {
  const routesPath = path.resolve(__dirname, './index.tsx');
  return fs.readFileSync(routesPath, 'utf-8');
}

/**
 * 从路由文件中提取所有 lazy 导入的页面
 */
function extractLazyImports(content: string): string[] {
  const lazyImportRegex = /const\s+(\w+Page)\s*=\s*lazy\s*\(\s*\(\)\s*=>\s*import\s*\(/g;
  const matches: string[] = [];
  let match;
  
  while ((match = lazyImportRegex.exec(content)) !== null) {
    if (match[1]) {
      matches.push(match[1]);
    }
  }
  
  return matches;
}

/**
 * 从路由文件中提取所有直接导入的页面（非懒加载）
 */
function extractDirectImports(content: string): string[] {
  // 查找直接 import 语句中的页面组件
  const directImportRegex = /import\s+\{\s*(\w+Page)\s*\}\s+from/g;
  const matches: string[] = [];
  let match;
  
  while ((match = directImportRegex.exec(content)) !== null) {
    if (match[1]) {
      matches.push(match[1]);
    }
  }
  
  return matches;
}

/**
 * 检查页面是否为首页（Dashboard）
 */
function isDashboardPage(pageName: string): boolean {
  return pageName.toLowerCase().includes('dashboard');
}

/**
 * 检查页面是否为公开页面（认证相关）
 * 保留用于未来扩展测试
 */
function _isPublicPage(pageName: string): boolean {
  const publicPagePatterns = ['Login', 'Register', 'ForgotPassword'];
  return publicPagePatterns.some(pattern => pageName.includes(pattern));
}
void _isPublicPage;

// ============================================================================
// 测试数据
// ============================================================================

const routesContent = getRoutesFileContent();
const lazyImportedPages = extractLazyImports(routesContent);
const directImportedPages = extractDirectImports(routesContent);

// 所有页面名称生成器
const lazyPageArb = fc.constantFrom(...lazyImportedPages);

// ============================================================================
// Property 3: 非首页路由懒加载
// ============================================================================

describe('Property 3: 非首页路由懒加载', () => {
  /**
   * **Validates: Requirements 3.3**
   * 
   * For any 非首页（非 Dashboard）路由组件，
   * 该组件应该通过 React.lazy 进行懒加载包装。
   */
  
  it('应该有多个懒加载的页面组件', () => {
    expect(lazyImportedPages.length).toBeGreaterThan(10);
  });

  it('Dashboard 页面应该使用懒加载', () => {
    // Dashboard 也使用懒加载以保持一致性
    const hasDashboard = lazyImportedPages.some(p => isDashboardPage(p));
    expect(hasDashboard).toBe(true);
  });

  it('所有懒加载的页面名称应该以 Page 结尾', () => {
    fc.assert(
      fc.property(lazyPageArb, (pageName) => {
        expect(pageName.endsWith('Page')).toBe(true);
        return true;
      }),
      { numRuns: lazyImportedPages.length }
    );
  });

  it('懒加载页面应该覆盖所有主要模块', () => {
    const expectedModules = [
      'Dashboard',
      'Login', 'Register', 'ForgotPassword',
      'RealtimeSearch', 'SearchHistory', 'SavedQueries',
      'AggregateAnalysis', 'AnomalyDetection', 'LogClustering',
      'AlertList', 'AlertRules', 'NotificationConfig', 'SilencePolicy',
      'SourceManagement', 'AgentManagement', 'AccessWizard', 'SourceStatus',
      'FieldMapping', 'ParsingRules', 'MaskingRules', 'FieldDictionary',
      'IndexManagement', 'LifecyclePolicy', 'BackupRecovery', 'CapacityMonitoring',
      'PerformanceMonitoring', 'HealthCheck', 'AutoScaling', 'DisasterRecovery',
      'TraceSearch', 'TraceAnalysis', 'ServiceTopology',
      'ReportManagement', 'ScheduledTasks', 'DownloadRecords',
      'UserManagement', 'RolePermissions', 'AuditLogs', 'LoginPolicy',
      'ApiDocs', 'WebhookManagement', 'SdkDownload', 'PluginMarket',
      'CostOverview', 'BudgetAlerts', 'OptimizationSuggestions',
      'SystemParameters', 'GlobalConfig', 'ConfigVersions',
      'QuerySyntax', 'FAQ', 'TicketPortal',
    ];

    for (const moduleName of expectedModules) {
      const hasModule = lazyImportedPages.some(p => p.includes(moduleName));
      expect(hasModule).toBe(true);
    }
  });

  it('不应该有直接导入的页面组件（所有页面都应该懒加载）', () => {
    // 页面组件不应该通过直接 import 导入
    expect(directImportedPages.length).toBe(0);
  });

  it('懒加载导入语句应该使用正确的语法', () => {
    // 验证懒加载语法：lazy(() => import('@/pages/...'))
    const lazyImportPattern = /lazy\s*\(\s*\(\)\s*=>\s*import\s*\(\s*['"]@\/pages\//g;
    const matches = routesContent.match(lazyImportPattern);
    
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThan(40); // 至少 40+ 个页面
  });

  it('每个懒加载的页面都应该有对应的路由定义', () => {
    // 验证路由文件中使用了这些懒加载的组件
    for (const pageName of lazyImportedPages) {
      const usagePattern = new RegExp(`<${pageName}\\s*\\/?>`, 'g');
      const hasUsage = usagePattern.test(routesContent);
      expect(hasUsage).toBe(true);
    }
  });
});

// ============================================================================
// 懒加载结构验证
// ============================================================================

describe('懒加载结构验证', () => {
  it('路由文件应该导入 React.lazy', () => {
    expect(routesContent).toContain('lazy');
    expect(routesContent).toMatch(/import\s+.*\{\s*.*lazy.*\}\s*from\s+['"]react['"]/);
  });

  it('路由文件应该使用 Suspense 包装懒加载组件', () => {
    expect(routesContent).toContain('Suspense');
  });

  it('Suspense 应该有 fallback 属性', () => {
    expect(routesContent).toMatch(/fallback\s*=\s*\{/);
  });

  it('懒加载页面数量应该与预期一致', () => {
    // 预期页面数量：
    // - Dashboard: 1
    // - Auth: 3 (Login, Register, ForgotPassword)
    // - Search: 3
    // - Analysis: 3
    // - Alerts: 4
    // - Ingestion: 4
    // - Parsing: 4
    // - Storage: 4
    // - Performance: 4
    // - Tracing: 3
    // - Reports: 3
    // - Security: 4
    // - Integration: 4
    // - Cost: 3
    // - Settings: 3
    // - Help: 3
    // Total: 53
    expect(lazyImportedPages.length).toBeGreaterThanOrEqual(50);
  });
});

/**
 * 公开/受保护路由分类属性测试
 * 
 * **Property 4: 公开路由与受保护路由分类**
 * **Validates: Requirements 3.5**
 * 
 * @requirements 3.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import { 
  menuConfig, 
  authMenuConfig, 
  PUBLIC_ROUTES,
  isPublicRoute,
  FALLBACK_ROUTE,
} from '@/constants/menu';

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
 * 从菜单配置中提取所有路径
 */
function extractAllPaths(configs: typeof menuConfig): string[] {
  const paths: string[] = [];
  
  const traverse = (items: typeof menuConfig) => {
    for (const item of items) {
      if (item.path) {
        paths.push(item.path);
      }
      if (item.children) {
        traverse(item.children);
      }
    }
  };
  
  traverse(configs);
  return paths;
}

/**
 * 从路由文件中提取公开路由定义
 */
function extractPublicRouteDefinitions(content: string): string[] {
  // 查找不使用 ProtectedLayout 的路由
  const publicRoutePattern = /<Route\s+path="([^"]+)"\s+element=\{<LazyPage>/g;
  const matches: string[] = [];
  let match;
  
  while ((match = publicRoutePattern.exec(content)) !== null) {
    if (match[1]) {
      matches.push(match[1]);
    }
  }
  
  return matches;
}

/**
 * 从路由文件中提取受保护路由定义
 */
function extractProtectedRouteDefinitions(content: string): string[] {
  // 查找使用 ProtectedLayout 的路由
  const protectedRoutePattern = /<Route\s+path="([^"]+)"\s+element=\{<ProtectedLayout>/g;
  const matches: string[] = [];
  let match;
  
  while ((match = protectedRoutePattern.exec(content)) !== null) {
    if (match[1]) {
      matches.push(match[1]);
    }
  }
  
  return matches;
}

// ============================================================================
// 测试数据
// ============================================================================

const routesContent = getRoutesFileContent();
const allPaths = extractAllPaths([...menuConfig, ...authMenuConfig]);
const publicRouteDefinitions = extractPublicRouteDefinitions(routesContent);
const protectedRouteDefinitions = extractProtectedRouteDefinitions(routesContent);

// 公开路由生成器
const publicRouteArb = fc.constantFrom(...PUBLIC_ROUTES);

// 受保护路径生成器
const protectedPathArb = fc.constantFrom(
  ...allPaths.filter(p => !PUBLIC_ROUTES.some(pr => p.startsWith(pr)))
);

// ============================================================================
// Property 4: 公开路由与受保护路由分类
// ============================================================================

describe('Property 4: 公开路由与受保护路由分类', () => {
  /**
   * **Validates: Requirements 3.5**
   * 
   * For any 路由定义，如果该路由属于认证相关页面（登录、注册、忘记密码），
   * 则该路由应该标记为公开路由；否则应该被 ProtectedRoute 组件包裹。
   */

  it('公开路由应该只包含认证相关页面', () => {
    fc.assert(
      fc.property(publicRouteArb, (route) => {
        // 公开路由应该是认证相关的
        const isAuthRoute = 
          route.includes('login') || 
          route.includes('register') || 
          route.includes('forgot-password') ||
          route.includes('sso');
        expect(isAuthRoute).toBe(true);
        return true;
      }),
      { numRuns: PUBLIC_ROUTES.length }
    );
  });

  it('公开路由在路由文件中不应该使用 ProtectedLayout', () => {
    // 验证公开路由（login, register, forgot-password）不使用 ProtectedLayout
    const publicRoutesInFile = ['/login', '/register', '/forgot-password'];
    
    for (const publicRoute of publicRoutesInFile) {
      // 公开路由应该在 publicRouteDefinitions 中
      const isPublic = publicRouteDefinitions.includes(publicRoute);
      // 公开路由不应该在 protectedRouteDefinitions 中
      const isProtected = protectedRouteDefinitions.includes(publicRoute);
      
      expect(isPublic).toBe(true);
      expect(isProtected).toBe(false);
    }
  });

  it('受保护路由应该使用 ProtectedLayout 包装', () => {
    // 验证受保护路由定义存在
    expect(protectedRouteDefinitions.length).toBeGreaterThan(0);
    
    // Dashboard 应该是受保护的
    expect(protectedRouteDefinitions).toContain('/dashboard');
  });

  it('isPublicRoute 函数应该正确识别公开路由', () => {
    fc.assert(
      fc.property(publicRouteArb, (route) => {
        expect(isPublicRoute(route)).toBe(true);
        return true;
      }),
      { numRuns: PUBLIC_ROUTES.length }
    );
  });

  it('isPublicRoute 函数应该正确识别受保护路由', () => {
    fc.assert(
      fc.property(protectedPathArb, (path) => {
        expect(isPublicRoute(path)).toBe(false);
        return true;
      }),
      { numRuns: Math.min(50, allPaths.length - PUBLIC_ROUTES.length) }
    );
  });

  it('公开路由数量应该是 4 个', () => {
    expect(PUBLIC_ROUTES.length).toBe(4);
    expect(publicRouteDefinitions.length).toBe(3); // login, register, forgot-password (sso 可能未定义)
  });

  it('受保护路由数量应该远大于公开路由', () => {
    expect(protectedRouteDefinitions.length).toBeGreaterThan(PUBLIC_ROUTES.length * 5);
  });
});

// ============================================================================
// 路由保护机制验证
// ============================================================================

describe('路由保护机制验证', () => {
  it('路由文件应该导入 ProtectedRoute 组件', () => {
    expect(routesContent).toContain('ProtectedRoute');
    expect(routesContent).toMatch(/import\s+.*ProtectedRoute.*from/);
  });

  it('路由文件应该定义 ProtectedLayout 组件', () => {
    expect(routesContent).toContain('ProtectedLayout');
    expect(routesContent).toMatch(/const\s+ProtectedLayout/);
  });

  it('ProtectedLayout 应该包含 ProtectedRoute 和 AppLayout', () => {
    // 验证 ProtectedLayout 的结构
    const protectedLayoutPattern = /ProtectedLayout.*ProtectedRoute.*AppLayout/s;
    expect(routesContent).toMatch(protectedLayoutPattern);
  });

  it('404 路由应该重定向到 Dashboard', () => {
    expect(routesContent).toContain('path="*"');
    expect(routesContent).toContain(`Navigate to={FALLBACK_ROUTE}`);
    expect(FALLBACK_ROUTE).toBe('/dashboard');
  });

  it('根路由应该重定向到 Dashboard', () => {
    expect(routesContent).toContain('path="/"');
    expect(routesContent).toMatch(/<Route\s+path="\/"\s+element=\{<Navigate\s+to="\/dashboard"/);
  });
});

// ============================================================================
// 路由分类一致性验证
// ============================================================================

describe('路由分类一致性验证', () => {
  it('所有认证相关路由都应该是公开的', () => {
    const authPaths = ['/login', '/register', '/forgot-password'];
    
    for (const authPath of authPaths) {
      expect(isPublicRoute(authPath)).toBe(true);
      expect(publicRouteDefinitions).toContain(authPath);
    }
  });

  it('所有功能模块路由都应该是受保护的', () => {
    const moduleRoots = [
      '/dashboard',
      '/search',
      '/analysis',
      '/alerts',
      '/ingestion',
      '/parsing',
      '/storage',
      '/performance',
      '/tracing',
      '/reports',
      '/security',
      '/integration',
      '/cost',
      '/settings',
      '/help',
    ];

    for (const moduleRoot of moduleRoots) {
      expect(isPublicRoute(moduleRoot)).toBe(false);
    }
  });

  it('公开路由和受保护路由不应该有交集', () => {
    const intersection = publicRouteDefinitions.filter(
      route => protectedRouteDefinitions.includes(route)
    );
    expect(intersection.length).toBe(0);
  });
});

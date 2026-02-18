/**
 * 路由属性测试
 * 
 * 验证路由配置的正确性属性
 * 
 * @requirements 3.1, 3.2, 3.3, 3.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  menuConfig, 
  authMenuConfig, 
  ROUTE_MODULES, 
  PUBLIC_ROUTES,
  getMenuKeyByPath,
  isPublicRoute,
} from '@/constants/menu';

// ============================================================================
// 辅助函数
// ============================================================================

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
 * 从菜单配置中提取所有模块
 */
function extractAllModules(configs: typeof menuConfig): string[] {
  return configs.map(item => item.key);
}

/**
 * 检查模块是否有子路由
 * 保留用于未来扩展测试
 */
function _moduleHasChildren(moduleKey: string): boolean {
  const module = menuConfig.find(m => m.key === moduleKey);
  return module?.children !== undefined && module.children.length > 0;
}
void _moduleHasChildren;

// ============================================================================
// 测试数据
// ============================================================================

const allPaths = extractAllPaths([...menuConfig, ...authMenuConfig]);
// 保留用于未来扩展测试
const _allModules = extractAllModules(menuConfig);
void _allModules;

// 路由模块名称生成器
const routeModuleArb = fc.constantFrom(...ROUTE_MODULES);

// 有效路径生成器
const validPathArb = fc.constantFrom(...allPaths);

// 公开路由生成器
const publicRouteArb = fc.constantFrom(...PUBLIC_ROUTES);

// ============================================================================
// Property 2: 路由模块完整性和嵌套结构
// ============================================================================

describe('Property 2: 路由模块完整性和嵌套结构', () => {
  /**
   * **Validates: Requirements 3.1, 3.2**
   * 
   * For any 预定义的路由模块名称（15 个模块中的任意一个），
   * 路由配置中应该包含该模块的路由定义，
   * 且该模块应该包含 index 路由和至少一个子路由。
   */
  it('所有预定义路由模块都应该存在于菜单配置中', () => {
    fc.assert(
      fc.property(routeModuleArb, (moduleName) => {
        // 跳过 auth 模块，它在 authMenuConfig 中
        if (moduleName === 'auth') {
          const authModule = authMenuConfig.find(m => m.key === 'auth');
          expect(authModule).toBeDefined();
          return true;
        }
        
        // 其他模块应该在 menuConfig 中
        const module = menuConfig.find(m => m.key === moduleName);
        expect(module).toBeDefined();
        return true;
      }),
      { numRuns: ROUTE_MODULES.length }
    );
  });

  it('非 Dashboard 模块应该包含子路由', () => {
    fc.assert(
      fc.property(routeModuleArb, (moduleName) => {
        // Dashboard 是首页，不需要子路由
        if (moduleName === 'dashboard') {
          const dashboard = menuConfig.find(m => m.key === 'dashboard');
          expect(dashboard).toBeDefined();
          expect(dashboard?.path).toBe('/dashboard');
          return true;
        }
        
        // auth 模块在 authMenuConfig 中
        if (moduleName === 'auth') {
          const authModule = authMenuConfig.find(m => m.key === 'auth');
          expect(authModule?.children).toBeDefined();
          expect(authModule?.children?.length).toBeGreaterThan(0);
          return true;
        }
        
        // 其他模块应该有子路由
        const module = menuConfig.find(m => m.key === moduleName);
        if (module) {
          expect(module.children).toBeDefined();
          expect(module.children?.length).toBeGreaterThan(0);
        }
        return true;
      }),
      { numRuns: ROUTE_MODULES.length }
    );
  });

  it('每个有子路由的模块的子路由都应该有有效路径', () => {
    fc.assert(
      fc.property(routeModuleArb, (moduleName) => {
        if (moduleName === 'dashboard') return true;
        
        const configs = moduleName === 'auth' ? authMenuConfig : menuConfig;
        const module = configs.find(m => m.key === moduleName);
        
        if (module?.children) {
          for (const child of module.children) {
            expect(child.path).toBeDefined();
            expect(child.path).toMatch(/^\//);
          }
        }
        return true;
      }),
      { numRuns: ROUTE_MODULES.length }
    );
  });

  it('应该有 15 个主要路由模块（不含 auth）', () => {
    // 15 个模块 = dashboard + 14 个功能模块
    const mainModules = ROUTE_MODULES.filter(m => m !== 'auth');
    expect(mainModules.length).toBe(15);
    
    // 验证 menuConfig 包含所有主要模块
    for (const moduleName of mainModules) {
      const module = menuConfig.find(m => m.key === moduleName);
      expect(module).toBeDefined();
    }
  });
});

// ============================================================================
// Property 3: 非首页路由懒加载
// ============================================================================

describe('Property 3: 非首页路由懒加载', () => {
  /**
   * **Validates: Requirements 3.3**
   * 
   * For any 非首页（非 Dashboard）路由组件，
   * 该组件应该通过 React.lazy 进行懒加载包装。
   * 
   * 注意：这个测试验证路由配置的结构，实际的懒加载验证需要在运行时进行。
   * 这里我们验证所有非首页路由都有对应的页面模块。
   */
  it('所有非首页路由路径都应该有对应的菜单配置', () => {
    fc.assert(
      fc.property(validPathArb, (path) => {
        // 验证路径可以找到对应的菜单项
        const menuKey = getMenuKeyByPath(path);
        expect(menuKey).toBeDefined();
        return true;
      }),
      { numRuns: allPaths.length }
    );
  });

  it('非 Dashboard 模块的路由数量应该大于 1', () => {
    const nonDashboardPaths = allPaths.filter(p => !p.startsWith('/dashboard'));
    expect(nonDashboardPaths.length).toBeGreaterThan(1);
  });
});

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

  it('isPublicRoute 函数应该正确识别公开路由', () => {
    fc.assert(
      fc.property(publicRouteArb, (route) => {
        expect(isPublicRoute(route)).toBe(true);
        return true;
      }),
      { numRuns: PUBLIC_ROUTES.length }
    );
  });

  it('非公开路由应该被正确识别', () => {
    const protectedPaths = allPaths.filter(p => !PUBLIC_ROUTES.some(pr => p.startsWith(pr)));
    
    fc.assert(
      fc.property(fc.constantFrom(...protectedPaths), (path) => {
        expect(isPublicRoute(path)).toBe(false);
        return true;
      }),
      { numRuns: Math.min(protectedPaths.length, 100) }
    );
  });

  it('公开路由数量应该是 4 个', () => {
    expect(PUBLIC_ROUTES.length).toBe(4);
  });

  it('受保护路由数量应该远大于公开路由', () => {
    const protectedPaths = allPaths.filter(p => !PUBLIC_ROUTES.some(pr => p.startsWith(pr)));
    expect(protectedPaths.length).toBeGreaterThan(PUBLIC_ROUTES.length * 5);
  });
});

// ============================================================================
// 路由结构完整性测试
// ============================================================================

describe('路由结构完整性', () => {
  it('所有模块的路径应该以 / 开头', () => {
    for (const path of allPaths) {
      expect(path.startsWith('/')).toBe(true);
    }
  });

  it('不应该有重复的路径', () => {
    const uniquePaths = new Set(allPaths);
    expect(uniquePaths.size).toBe(allPaths.length);
  });

  it('每个模块的子路由路径应该以模块路径为前缀', () => {
    for (const module of menuConfig) {
      if (module.children) {
        for (const child of module.children) {
          if (child.path) {
            expect(child.path.startsWith(`/${module.key}`)).toBe(true);
          }
        }
      }
    }
  });
});

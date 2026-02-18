/**
 * SidebarMenu 属性测试
 * 
 * Property 5: 菜单高亮与路由匹配
 * Validates: Requirements 4.5
 * 
 * @module components/layout/SidebarMenu.test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  menuConfig, 
  getMenuKeyByPath, 
  getParentKeys,
  getBreadcrumbs,
  isPublicRoute,
  PUBLIC_ROUTES,
} from '@/constants/menu';
import type { MenuConfig } from '@/constants/menu';

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 收集所有有效的路由路径
 */
function collectAllPaths(configs: MenuConfig[]): string[] {
  const paths: string[] = [];
  
  const traverse = (items: MenuConfig[]) => {
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
 * 收集所有菜单项的 key
 */
function collectAllKeys(configs: MenuConfig[]): string[] {
  const keys: string[] = [];
  
  const traverse = (items: MenuConfig[]) => {
    for (const item of items) {
      keys.push(item.key);
      if (item.children) {
        traverse(item.children);
      }
    }
  };
  
  traverse(configs);
  return keys;
}

/**
 * 根据 key 查找菜单项
 */
function findMenuItemByKey(configs: MenuConfig[], key: string): MenuConfig | undefined {
  for (const item of configs) {
    if (item.key === key) {
      return item;
    }
    if (item.children) {
      const found = findMenuItemByKey(item.children, key);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * 检查 key 是否为有效的菜单 key
 */
function isValidMenuKey(key: string): boolean {
  return collectAllKeys(menuConfig).includes(key);
}

// ============================================================================
// 测试数据
// ============================================================================

/**
 * 所有有效的路由路径
 */
const allValidPaths = collectAllPaths(menuConfig);

/**
 * 所有有效的菜单 key
 */
const allValidKeys = collectAllKeys(menuConfig);

/**
 * 生成有效路径的 Arbitrary
 */
const validPathArb = fc.constantFrom(...allValidPaths);

/**
 * 生成有效菜单 key 的 Arbitrary
 * 保留用于未来扩展测试
 */
const _validKeyArb = fc.constantFrom(...allValidKeys);
void _validKeyArb;

// ============================================================================
// 属性测试
// ============================================================================

describe('SidebarMenu 属性测试', () => {
  /**
   * Property 5: 菜单高亮与路由匹配
   * 
   * 对于任意有效的路由路径，侧边栏菜单中应该有且仅有一个菜单项处于高亮（selected）状态，
   * 且该菜单项的路径应该与当前路由路径匹配。
   * 
   * **Validates: Requirements 4.5**
   */
  describe('Property 5: 菜单高亮与路由匹配', () => {
    it('对于任意有效路径，getMenuKeyByPath 应返回唯一的菜单 key', () => {
      fc.assert(
        fc.property(validPathArb, (path) => {
          const key = getMenuKeyByPath(path);
          
          // 应该返回一个有效的 key
          expect(key).toBeDefined();
          expect(typeof key).toBe('string');
          expect(key!.length).toBeGreaterThan(0);
          
          // key 应该是有效的菜单 key
          expect(isValidMenuKey(key!)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('返回的菜单 key 对应的菜单项路径应与输入路径匹配', () => {
      fc.assert(
        fc.property(validPathArb, (path) => {
          const key = getMenuKeyByPath(path);
          
          if (key) {
            const menuItem = findMenuItemByKey(menuConfig, key);
            
            // 菜单项应该存在
            expect(menuItem).toBeDefined();
            
            // 菜单项的路径应该与输入路径匹配
            expect(menuItem!.path).toBe(path);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('每个有效路径应该只对应一个菜单 key（唯一性）', () => {
      fc.assert(
        fc.property(validPathArb, (path) => {
          // 统计有多少个菜单项的路径与输入路径匹配
          let matchCount = 0;
          
          const countMatches = (items: MenuConfig[]) => {
            for (const item of items) {
              if (item.path === path) {
                matchCount++;
              }
              if (item.children) {
                countMatches(item.children);
              }
            }
          };
          
          countMatches(menuConfig);
          
          // 应该只有一个匹配
          expect(matchCount).toBe(1);
        }),
        { numRuns: 100 }
      );
    });

    it('getMenuKeyByPath 对于无效路径应返回 undefined', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !allValidPaths.includes(s) && s.length > 0),
          (invalidPath) => {
            const key = getMenuKeyByPath(invalidPath);
            
            // 无效路径应该返回 undefined
            expect(key).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 父级菜单展开属性测试
   */
  describe('父级菜单展开', () => {
    it('getParentKeys 应返回正确的父级菜单 key 列表', () => {
      fc.assert(
        fc.property(validPathArb, (path) => {
          const parentKeys = getParentKeys(path);
          
          // 返回值应该是数组
          expect(Array.isArray(parentKeys)).toBe(true);
          
          // 所有返回的 key 都应该是有效的菜单 key
          parentKeys.forEach(key => {
            expect(isValidMenuKey(key)).toBe(true);
          });
        }),
        { numRuns: 100 }
      );
    });

    it('顶级菜单项的 parentKeys 应为空数组', () => {
      // 找出所有顶级菜单项的路径
      const topLevelPaths = menuConfig
        .filter(item => item.path)
        .map(item => item.path!);
      
      if (topLevelPaths.length > 0) {
        fc.assert(
          fc.property(fc.constantFrom(...topLevelPaths), (path) => {
            const parentKeys = getParentKeys(path);
            
            // 顶级菜单项没有父级
            expect(parentKeys).toEqual([]);
          }),
          { numRuns: 100 }
        );
      }
    });

    it('子菜单项的 parentKeys 应包含其父级菜单 key', () => {
      // 找出所有有子菜单的父级菜单
      const parentMenus = menuConfig.filter(item => item.children && item.children.length > 0);
      
      parentMenus.forEach(parent => {
        if (parent.children) {
          parent.children.forEach(child => {
            if (child.path) {
              const parentKeys = getParentKeys(child.path);
              
              // 应该包含父级菜单的 key
              expect(parentKeys).toContain(parent.key);
            }
          });
        }
      });
    });
  });

  /**
   * 面包屑导航属性测试
   */
  describe('面包屑导航', () => {
    it('getBreadcrumbs 应返回正确的面包屑数据', () => {
      fc.assert(
        fc.property(validPathArb, (path) => {
          const breadcrumbs = getBreadcrumbs(path);
          
          // 返回值应该是数组
          expect(Array.isArray(breadcrumbs)).toBe(true);
          
          // 面包屑应该至少包含当前页面
          expect(breadcrumbs.length).toBeGreaterThan(0);
          
          // 最后一个面包屑应该对应当前路径
          const lastBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
          expect(lastBreadcrumb).toBeDefined();
          expect(lastBreadcrumb!.path).toBe(path);
        }),
        { numRuns: 100 }
      );
    });

    it('面包屑的 key 应该是有效的菜单 key', () => {
      fc.assert(
        fc.property(validPathArb, (path) => {
          const breadcrumbs = getBreadcrumbs(path);
          
          breadcrumbs.forEach(crumb => {
            expect(isValidMenuKey(crumb.key)).toBe(true);
          });
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 公开路由检测属性测试
   */
  describe('公开路由检测', () => {
    it('PUBLIC_ROUTES 中的路径应被识别为公开路由', () => {
      PUBLIC_ROUTES.forEach(route => {
        expect(isPublicRoute(route)).toBe(true);
      });
    });

    it('非公开路由路径应返回 false', () => {
      fc.assert(
        fc.property(validPathArb, (path) => {
          // 如果路径不在 PUBLIC_ROUTES 中
          if (!PUBLIC_ROUTES.some(route => path.startsWith(route))) {
            expect(isPublicRoute(path)).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 菜单配置完整性测试
   */
  describe('菜单配置完整性', () => {
    it('所有菜单项应有唯一的 key', () => {
      const keys = collectAllKeys(menuConfig);
      const uniqueKeys = new Set(keys);
      
      // key 数量应该等于去重后的数量
      expect(keys.length).toBe(uniqueKeys.size);
    });

    it('所有有路径的菜单项应有唯一的路径', () => {
      const paths = collectAllPaths(menuConfig);
      const uniquePaths = new Set(paths);
      
      // 路径数量应该等于去重后的数量
      expect(paths.length).toBe(uniquePaths.size);
    });

    it('所有菜单项应有 label', () => {
      const checkLabels = (items: MenuConfig[]) => {
        items.forEach(item => {
          expect(item.label).toBeDefined();
          expect(item.label.length).toBeGreaterThan(0);
          
          if (item.children) {
            checkLabels(item.children);
          }
        });
      };
      
      checkLabels(menuConfig);
    });

    it('父级菜单项不应有路径，子菜单项应有路径', () => {
      menuConfig.forEach(item => {
        if (item.children && item.children.length > 0) {
          // 有子菜单的项不应该有路径（除了 dashboard）
          if (item.key !== 'dashboard') {
            expect(item.path).toBeUndefined();
          }
          
          // 子菜单项应该有路径
          item.children.forEach(child => {
            if (!child.children || child.children.length === 0) {
              expect(child.path).toBeDefined();
            }
          });
        }
      });
    });
  });

  /**
   * 路由路径格式测试
   */
  describe('路由路径格式', () => {
    it('所有路径应以 / 开头', () => {
      fc.assert(
        fc.property(validPathArb, (path) => {
          expect(path.startsWith('/')).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('所有路径应为小写', () => {
      fc.assert(
        fc.property(validPathArb, (path) => {
          expect(path).toBe(path.toLowerCase());
        }),
        { numRuns: 100 }
      );
    });

    it('路径不应包含空格', () => {
      fc.assert(
        fc.property(validPathArb, (path) => {
          expect(path.includes(' ')).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });
});

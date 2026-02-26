/**
 * Property 4: 路由匹配自动展开父级菜单
 *
 * For any 菜单配置中的子菜单项路径，当当前路由匹配该路径时，
 * 计算出的 openKeys 应该包含其父级菜单的 key。
 *
 * **Validates: Requirements 5.5**
 */
import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { MENU_SECTIONS } from '../../src/constants/menu';
import { getOpenKeysForPath } from '../../src/components/layout/AppSidebar';

// 收集所有子菜单项及其父级 key
interface ChildMenuEntry {
  path: string;
  parentKey: string;
}

function collectChildMenuEntries(): ChildMenuEntry[] {
  const entries: ChildMenuEntry[] = [];
  for (const section of MENU_SECTIONS) {
    for (const item of section.items) {
      if (item.children) {
        for (const child of item.children) {
          if (child.path) {
            entries.push({ path: child.path, parentKey: item.label });
          }
        }
      }
    }
  }
  return entries;
}

describe('Property 4: 路由匹配自动展开父级菜单', () => {
  const allEntries = collectChildMenuEntries();

  it('任意子菜单路径的 openKeys 包含其父级菜单 key', () => {
    // 从所有子菜单项中随机选取
    const entryArb = fc.constantFrom(...allEntries);

    fc.assert(
      fc.property(entryArb, (entry) => {
        const openKeys = getOpenKeysForPath(entry.path);
        return openKeys.includes(entry.parentKey);
      }),
      { numRuns: 100 },
    );
  });

  it('根路径 "/" 的 openKeys 为空（概览无父级菜单）', () => {
    const openKeys = getOpenKeysForPath('/');
    return openKeys.length === 0;
  });
});

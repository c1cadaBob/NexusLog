/**
 * DataTable 属性测试
 * 
 * Property 12: DataTable 排序正确性
 * Validates: Requirements 8.1
 * 
 * @module components/common/DataTable.test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { SortConfig, SortDirection } from '@/types';

// ============================================================================
// 排序逻辑（从 DataTable 组件中提取的纯函数）
// ============================================================================

/**
 * 默认排序函数
 */
function defaultSorter<T extends Record<string, unknown>>(a: T, b: T, field: string): number {
  const aVal = a[field];
  const bVal = b[field];
  
  if (aVal === bVal) return 0;
  if (aVal === null || aVal === undefined) return 1;
  if (bVal === null || bVal === undefined) return -1;
  
  if (typeof aVal === 'number' && typeof bVal === 'number') {
    return aVal - bVal;
  }
  
  return String(aVal).localeCompare(String(bVal));
}

/**
 * 对数据进行排序
 */
function sortData<T extends Record<string, unknown>>(
  data: T[],
  sort: SortConfig | null,
  customSorter?: (a: T, b: T) => number
): T[] {
  if (!sort) return data;
  
  const sorter = customSorter || ((a: T, b: T) => defaultSorter(a, b, sort.field));
  
  return [...data].sort((a, b) => {
    const result = sorter(a, b);
    return sort.direction === 'asc' ? result : -result;
  });
}

// ============================================================================
// 测试数据生成器
// ============================================================================

/**
 * 生成测试数据记录
 */
const testRecordArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  age: fc.integer({ min: 0, max: 150 }),
  score: fc.oneof(fc.integer({ min: 0, max: 100 }), fc.constant(null)),
  status: fc.constantFrom('active', 'inactive', 'pending'),
});

type TestRecord = fc.RecordValue<typeof testRecordArb>;

/**
 * 生成测试数据数组
 */
const testDataArb = fc.array(testRecordArb, { minLength: 0, maxLength: 100 });

/**
 * 生成排序字段
 */
const sortFieldArb = fc.constantFrom('id', 'name', 'age', 'score', 'status');

/**
 * 生成排序方向
 */
const sortDirectionArb: fc.Arbitrary<SortDirection> = fc.constantFrom('asc', 'desc');

/**
 * 生成排序配置
 */
const sortConfigArb: fc.Arbitrary<SortConfig> = fc.record({
  field: sortFieldArb,
  direction: sortDirectionArb,
});

// ============================================================================
// 属性测试
// ============================================================================

describe('DataTable 属性测试', () => {
  /**
   * Property 12: DataTable 排序正确性
   * 
   * 对于任意数据集和排序列，DataTable 排序后的数据应该满足：
   * 对于相邻的两行，前一行的排序列值应该小于等于（升序）或大于等于（降序）后一行的排序列值。
   * 排序操作不应改变数据集的大小（不变量属性）。
   * 
   * **Validates: Requirements 8.1**
   */
  describe('Property 12: DataTable 排序正确性', () => {
    it('排序操作不应改变数据集大小（不变量属性）', () => {
      fc.assert(
        fc.property(testDataArb, sortConfigArb, (data, sort) => {
          const sortedData = sortData(data as Record<string, unknown>[], sort);
          
          // 验证数据集大小不变
          expect(sortedData.length).toBe(data.length);
        }),
        { numRuns: 100 }
      );
    });

    it('排序操作不应丢失或添加数据（元素保持属性）', () => {
      fc.assert(
        fc.property(testDataArb, sortConfigArb, (data, sort) => {
          const sortedData = sortData(data as Record<string, unknown>[], sort);
          
          // 验证所有原始元素都存在于排序后的数据中
          const originalIds = new Set(data.map(d => d.id));
          const sortedIds = new Set(sortedData.map(d => d['id'] as string));
          
          expect(sortedIds.size).toBe(originalIds.size);
          originalIds.forEach(id => {
            expect(sortedIds.has(id)).toBe(true);
          });
        }),
        { numRuns: 100 }
      );
    });

    it('升序排序后相邻元素应满足 a <= b', () => {
      fc.assert(
        fc.property(testDataArb, sortFieldArb, (data, field) => {
          const sort: SortConfig = { field, direction: 'asc' };
          const sortedData = sortData(data as Record<string, unknown>[], sort);
          
          // 验证升序排序
          for (let i = 0; i < sortedData.length - 1; i++) {
            const aVal = sortedData[i]?.[field];
            const bVal = sortedData[i + 1]?.[field];
            
            // 跳过 null/undefined 值的比较（它们排在最后）
            if (aVal === null || aVal === undefined) continue;
            if (bVal === null || bVal === undefined) continue;
            
            if (typeof aVal === 'number' && typeof bVal === 'number') {
              expect(aVal).toBeLessThanOrEqual(bVal);
            } else {
              expect(String(aVal).localeCompare(String(bVal))).toBeLessThanOrEqual(0);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('降序排序后相邻元素应满足 a >= b', () => {
      fc.assert(
        fc.property(testDataArb, sortFieldArb, (data, field) => {
          const sort: SortConfig = { field, direction: 'desc' };
          const sortedData = sortData(data as Record<string, unknown>[], sort);
          
          // 验证降序排序
          for (let i = 0; i < sortedData.length - 1; i++) {
            const aVal = sortedData[i]?.[field];
            const bVal = sortedData[i + 1]?.[field];
            
            // 跳过 null/undefined 值的比较
            if (aVal === null || aVal === undefined) continue;
            if (bVal === null || bVal === undefined) continue;
            
            if (typeof aVal === 'number' && typeof bVal === 'number') {
              expect(aVal).toBeGreaterThanOrEqual(bVal);
            } else {
              expect(String(aVal).localeCompare(String(bVal))).toBeGreaterThanOrEqual(0);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('无排序配置时应返回原始数据顺序', () => {
      fc.assert(
        fc.property(testDataArb, (data) => {
          const sortedData = sortData(data as Record<string, unknown>[], null);
          
          // 验证数据顺序不变
          expect(sortedData).toEqual(data);
        }),
        { numRuns: 100 }
      );
    });

    it('排序应是稳定的（相等元素保持原始相对顺序）', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              category: fc.constantFrom('A', 'B', 'C'),
              order: fc.integer({ min: 0, max: 1000 }),
            }),
            { minLength: 2, maxLength: 50 }
          ),
          (data) => {
            // 按 category 排序
            const sort: SortConfig = { field: 'category', direction: 'asc' };
            const sortedData = sortData(data as Record<string, unknown>[], sort);
            
            // 验证相同 category 的元素保持原始相对顺序
            const categories = ['A', 'B', 'C'];
            for (const cat of categories) {
              const originalOrder = data
                .filter(d => d.category === cat)
                .map(d => d.id);
              const sortedOrder = sortedData
                .filter(d => d['category'] === cat)
                .map(d => d['id'] as string);
              
              expect(sortedOrder).toEqual(originalOrder);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 额外属性：数字排序正确性
   */
  describe('数字排序属性', () => {
    it('数字字段排序应按数值大小排序', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              value: fc.integer({ min: -1000, max: 1000 }),
            }),
            { minLength: 2, maxLength: 50 }
          ),
          sortDirectionArb,
          (data, direction) => {
            const sort: SortConfig = { field: 'value', direction };
            const sortedData = sortData(data as Record<string, unknown>[], sort);
            
            for (let i = 0; i < sortedData.length - 1; i++) {
              const a = sortedData[i]?.['value'] as number;
              const b = sortedData[i + 1]?.['value'] as number;
              
              if (a === undefined || b === undefined) continue;
              
              if (direction === 'asc') {
                expect(a).toBeLessThanOrEqual(b);
              } else {
                expect(a).toBeGreaterThanOrEqual(b);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 额外属性：字符串排序正确性
   */
  describe('字符串排序属性', () => {
    it('字符串字段排序应按字典序排序', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 20 }),
            }),
            { minLength: 2, maxLength: 50 }
          ),
          sortDirectionArb,
          (data, direction) => {
            const sort: SortConfig = { field: 'name', direction };
            const sortedData = sortData(data as Record<string, unknown>[], sort);
            
            for (let i = 0; i < sortedData.length - 1; i++) {
              const a = sortedData[i]?.['name'] as string;
              const b = sortedData[i + 1]?.['name'] as string;
              
              if (a === undefined || b === undefined) continue;
              
              const comparison = a.localeCompare(b);
              
              if (direction === 'asc') {
                expect(comparison).toBeLessThanOrEqual(0);
              } else {
                expect(comparison).toBeGreaterThanOrEqual(0);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

});

/**
 * StatCard 属性测试
 * 
 * Property 14: StatCard 数据展示完整性
 * Validates: Requirements 8.5
 * 
 * @module components/common/StatCard.test
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, cleanup } from '@testing-library/react';
import { StatCard } from './StatCard';
import type { TrendType } from '@/types';

// ============================================================================
// 测试数据生成器
// ============================================================================

/**
 * 生成有效的标题
 */
const titleArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0);

/**
 * 生成数值（字符串或数字）
 * 注意：Ant Design Statistic 会自动格式化数字（添加千位分隔符）
 */
const valueArb = fc.oneof(
  fc.integer({ min: 0, max: 999 }), // 使用小于1000的数字避免千位分隔符
  fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0)
);

/**
 * 格式化数字为带千位分隔符的字符串（模拟 Ant Design Statistic 的行为）
 */
const formatNumber = (value: number | string): string => {
  if (typeof value === 'string') return value;
  return value.toLocaleString('en-US');
};

/**
 * 生成颜色
 */
const colorArb = fc.constantFrom(
  'primary',
  'success',
  'warning',
  'danger',
  'info'
) as fc.Arbitrary<'primary' | 'success' | 'warning' | 'danger' | 'info'>;

/**
 * 生成趋势类型
 */
const trendTypeArb = fc.constantFrom('up', 'down', 'neutral') as fc.Arbitrary<TrendType>;

/**
 * 生成趋势配置
 */
const trendArb = fc.record({
  value: fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0),
  type: trendTypeArb,
  label: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
});

/**
 * 生成精度
 */
const precisionArb = fc.integer({ min: 0, max: 4 });

// ============================================================================
// 属性测试
// ============================================================================

describe('StatCard 属性测试', () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * Property 14: StatCard 数据展示完整性
   * 
   * 对于任意有效的 KPI 数据（包含标题和数值），StatCard 渲染结果
   * 应该包含该标题文本和数值文本。
   * 
   * **Validates: Requirements 8.5**
   */
  describe('Property 14: StatCard 数据展示完整性', () => {
    it('渲染结果应该包含标题文本', () => {
      fc.assert(
        fc.property(titleArb, valueArb, (title, value) => {
          cleanup();
          const { container } = render(
            <StatCard title={title} value={value} />
          );
          
          // 验证标题在渲染结果中
          expect(container.textContent).toContain(title);
        }),
        { numRuns: 100 }
      );
    });

    it('渲染结果应该包含数值文本', () => {
      fc.assert(
        fc.property(titleArb, valueArb, (title, value) => {
          cleanup();
          const { container } = render(
            <StatCard title={title} value={value} />
          );
          
          // 验证数值在渲染结果中（考虑 Ant Design 的数字格式化）
          const expectedValue = formatNumber(value);
          expect(container.textContent).toContain(expectedValue);
        }),
        { numRuns: 100 }
      );
    });

    it('带精度的数值应该正确格式化', () => {
      fc.assert(
        fc.property(
          titleArb,
          fc.float({ min: 0, max: 999, noNaN: true }), // 使用小于1000的数字
          precisionArb,
          (title, value, precision) => {
            cleanup();
            const { container } = render(
              <StatCard title={title} value={value} precision={precision} />
            );
            
            // 验证格式化后的数值在渲染结果中
            const formattedValue = value.toFixed(precision);
            expect(container.textContent).toContain(formattedValue);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('带趋势的卡片应该显示趋势值', () => {
      fc.assert(
        fc.property(titleArb, valueArb, trendArb, (title, value, trend) => {
          cleanup();
          const { container } = render(
            <StatCard title={title} value={value} trend={trend} />
          );
          
          // 验证趋势值在渲染结果中
          expect(container.textContent).toContain(trend.value);
        }),
        { numRuns: 50 }
      );
    });

    it('带颜色的卡片应该正常渲染', () => {
      fc.assert(
        fc.property(titleArb, valueArb, colorArb, (title, value, color) => {
          cleanup();
          const { container } = render(
            <StatCard title={title} value={value} color={color} />
          );
          
          // 验证标题和数值都在渲染结果中
          expect(container.textContent).toContain(title);
          expect(container.textContent).toContain(formatNumber(value));
        }),
        { numRuns: 50 }
      );
    });

    it('可点击的卡片应该响应点击事件', () => {
      fc.assert(
        fc.property(titleArb, valueArb, (title, value) => {
          cleanup();
          const onClick = vi.fn();
          const { container } = render(
            <StatCard title={title} value={value} onClick={onClick} />
          );
          
          // 找到卡片元素并点击
          const card = container.querySelector('.ant-card');
          if (card) {
            card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(onClick).toHaveBeenCalledTimes(1);
          }
        }),
        { numRuns: 30 }
      );
    });
  });
});

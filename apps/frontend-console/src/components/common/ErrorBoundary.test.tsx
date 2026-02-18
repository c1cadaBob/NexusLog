/**
 * ErrorBoundary 属性测试
 * 
 * Property 13: ErrorBoundary 错误捕获
 * Validates: Requirements 8.3
 * 
 * @module components/common/ErrorBoundary.test
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, cleanup } from '@testing-library/react';
import { ErrorBoundary, ErrorTracker } from './ErrorBoundary';

// ============================================================================
// 测试辅助组件
// ============================================================================

/**
 * 会抛出错误的组件
 */
interface ThrowingComponentProps {
  error: Error;
  shouldThrow: boolean;
}

const ThrowingComponent: React.FC<ThrowingComponentProps> = ({ error, shouldThrow }) => {
  if (shouldThrow) {
    throw error;
  }
  return <div data-testid="child-content">正常内容</div>;
};

// ============================================================================
// 测试数据生成器
// ============================================================================

/**
 * 生成错误消息
 */
const errorMessageArb = fc.string({ minLength: 1, maxLength: 200 })
  .filter(s => s.trim().length > 0);

/**
 * 生成错误名称
 */
const errorNameArb = fc.constantFrom(
  'Error',
  'TypeError',
  'ReferenceError',
  'SyntaxError',
  'RangeError',
  'CustomError'
);

/**
 * 生成 Error 对象
 */
const errorArb = fc.tuple(errorNameArb, errorMessageArb).map(([name, message]) => {
  const error = new Error(message);
  error.name = name;
  return error;
});

// ============================================================================
// 属性测试
// ============================================================================

describe('ErrorBoundary 属性测试', () => {
  // 抑制 React 错误边界的控制台错误输出
  const originalConsoleError = console.error;
  
  beforeEach(() => {
    console.error = vi.fn();
  });
  
  afterEach(() => {
    console.error = originalConsoleError;
    cleanup();
  });

  /**
   * Property 13: ErrorBoundary 错误捕获
   * 
   * 对于任意子组件抛出的 JavaScript 错误，ErrorBoundary 应该捕获该错误
   * 并渲染错误信息界面，而不是导致整个应用崩溃。
   * 错误信息界面应该包含错误描述。
   * 
   * **Validates: Requirements 8.3**
   */
  describe('Property 13: ErrorBoundary 错误捕获', () => {
    it('应该捕获子组件抛出的错误并渲染后备 UI', () => {
      fc.assert(
        fc.property(errorArb, (error) => {
          cleanup();
          const { container } = render(
            <ErrorBoundary>
              <ThrowingComponent error={error} shouldThrow={true} />
            </ErrorBoundary>
          );
          
          // 验证后备 UI 被渲染
          expect(container.textContent).toContain('出错了');
          
          // 验证错误消息被显示
          expect(container.textContent).toContain(error.message);
        }),
        { numRuns: 20 }
      );
    }, 15000);

    it('错误信息界面应该包含错误描述', () => {
      fc.assert(
        fc.property(errorArb, (error) => {
          cleanup();
          const { container } = render(
            <ErrorBoundary>
              <ThrowingComponent error={error} shouldThrow={true} />
            </ErrorBoundary>
          );
          
          // 验证错误消息在界面中显示
          expect(container.textContent).toContain(error.message);
        }),
        { numRuns: 20 }
      );
    }, 15000);

    it('不应该导致整个应用崩溃', () => {
      fc.assert(
        fc.property(errorArb, (error) => {
          cleanup();
          // 如果 ErrorBoundary 没有捕获错误，render 会抛出异常
          // 这个测试验证 render 不会抛出异常
          expect(() => {
            render(
              <ErrorBoundary>
                <ThrowingComponent error={error} shouldThrow={true} />
              </ErrorBoundary>
            );
          }).not.toThrow();
        }),
        { numRuns: 20 }
      );
    }, 15000);

    it('应该调用 onError 回调', () => {
      fc.assert(
        fc.property(errorArb, (error) => {
          cleanup();
          const onError = vi.fn();
          
          render(
            <ErrorBoundary onError={onError}>
              <ThrowingComponent error={error} shouldThrow={true} />
            </ErrorBoundary>
          );
          
          // 验证 onError 被调用
          expect(onError).toHaveBeenCalledTimes(1);
          expect(onError).toHaveBeenCalledWith(
            error,
            expect.objectContaining({
              componentStack: expect.any(String),
            })
          );
        }),
        { numRuns: 20 }
      );
    }, 15000);

    it('应该调用错误跟踪器的 captureError 方法', () => {
      fc.assert(
        fc.property(errorArb, (error) => {
          cleanup();
          const mockTracker: ErrorTracker = {
            captureError: vi.fn(),
            captureMessage: vi.fn(),
          };
          
          render(
            <ErrorBoundary errorTracker={mockTracker}>
              <ThrowingComponent error={error} shouldThrow={true} />
            </ErrorBoundary>
          );
          
          // 验证 captureError 被调用
          expect(mockTracker.captureError).toHaveBeenCalledTimes(1);
          expect(mockTracker.captureError).toHaveBeenCalledWith(
            error,
            expect.objectContaining({
              componentStack: expect.any(String),
              timestamp: expect.any(Number),
            })
          );
        }),
        { numRuns: 20 }
      );
    }, 15000);
  });

  /**
   * 额外属性：正常渲染
   */
  describe('正常渲染属性', () => {
    it('子组件不抛出错误时应该正常渲染子组件', () => {
      cleanup();
      const { container } = render(
        <ErrorBoundary>
          <ThrowingComponent error={new Error('test')} shouldThrow={false} />
        </ErrorBoundary>
      );
      
      // 验证正常内容被渲染
      expect(container.textContent).toContain('正常内容');
      // 验证后备 UI 没有被渲染
      expect(container.textContent).not.toContain('出错了');
    });
  });
});

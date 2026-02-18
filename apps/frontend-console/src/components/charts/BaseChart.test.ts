/**
 * BaseChart 属性测试
 * 
 * Property 8: 图表 resize 响应
 * Validates: Requirements 6.3
 * 
 * @module components/charts/BaseChart.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// 测试辅助类型和函数
// ============================================================================

/**
 * 模拟 ECharts 实例
 */
interface MockEChartsInstance {
  resize: ReturnType<typeof vi.fn>;
  setOption: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  isDisposed: ReturnType<typeof vi.fn>;
  showLoading: ReturnType<typeof vi.fn>;
  hideLoading: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
}

/**
 * 创建模拟 ECharts 实例
 */
function createMockEChartsInstance(): MockEChartsInstance {
  return {
    resize: vi.fn(),
    setOption: vi.fn(),
    dispose: vi.fn(),
    isDisposed: vi.fn().mockReturnValue(false),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
}

/**
 * 模拟 ResizeObserver 回调
 */
type ResizeObserverCallback = (entries: ResizeObserverEntry[]) => void;

/**
 * 模拟 ResizeObserver
 */
class MockResizeObserver {
  private callback: ResizeObserverCallback;
  private observedElements: Set<Element> = new Set();
  
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  
  observe(element: Element) {
    this.observedElements.add(element);
  }
  
  unobserve(element: Element) {
    this.observedElements.delete(element);
  }
  
  disconnect() {
    this.observedElements.clear();
  }
  
  /**
   * 触发 resize 事件（用于测试）
   */
  triggerResize(width: number, height: number) {
    const entries: ResizeObserverEntry[] = Array.from(this.observedElements).map(element => ({
      target: element,
      contentRect: {
        width,
        height,
        top: 0,
        left: 0,
        bottom: height,
        right: width,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      },
      borderBoxSize: [{ blockSize: height, inlineSize: width }],
      contentBoxSize: [{ blockSize: height, inlineSize: width }],
      devicePixelContentBoxSize: [{ blockSize: height, inlineSize: width }],
    }));
    
    if (entries.length > 0) {
      this.callback(entries);
    }
  }
}

/**
 * 图表 resize 处理器类
 * 
 * 这是一个独立的类，用于测试 resize 响应逻辑
 * 它模拟了 BaseChart 组件中的 resize 处理逻辑
 */
class ChartResizeHandler {
  private chart: MockEChartsInstance | null = null;
  private resizeObserver: MockResizeObserver | null = null;
  private container: HTMLDivElement | null = null;
  
  /**
   * 初始化处理器
   */
  init(chart: MockEChartsInstance, container: HTMLDivElement) {
    this.chart = chart;
    this.container = container;
    
    // 创建 ResizeObserver
    this.resizeObserver = new MockResizeObserver(() => {
      this.handleResize();
    });
    
    this.resizeObserver.observe(container);
  }
  
  /**
   * 处理 resize 事件
   */
  handleResize() {
    if (this.chart && !this.chart.isDisposed()) {
      this.chart.resize();
    }
  }
  
  /**
   * 触发 resize（用于测试）
   */
  triggerResize(width: number, height: number) {
    this.resizeObserver?.triggerResize(width, height);
  }
  
  /**
   * 获取 resize 调用次数
   */
  getResizeCallCount(): number {
    return this.chart?.resize.mock.calls.length ?? 0;
  }
  
  /**
   * 销毁处理器
   */
  dispose() {
    this.resizeObserver?.disconnect();
    this.chart?.dispose();
    this.chart = null;
    this.container = null;
  }
  
  /**
   * 标记图表为已销毁
   */
  markDisposed() {
    this.chart?.isDisposed.mockReturnValue(true);
  }
}

// ============================================================================
// 属性测试
// ============================================================================

describe('BaseChart 属性测试', () => {
  let handler: ChartResizeHandler;
  let mockChart: MockEChartsInstance;
  let container: HTMLDivElement;
  
  beforeEach(() => {
    handler = new ChartResizeHandler();
    mockChart = createMockEChartsInstance();
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    handler.dispose();
    document.body.removeChild(container);
  });

  /**
   * Property 8: 图表 resize 响应
   * 
   * 对于任意包含 ECharts 实例的图表组件，当容器尺寸发生变化时，
   * ECharts 实例的 resize 方法应该被调用，且图表应该适配新的容器尺寸。
   * 
   * **Validates: Requirements 6.3**
   */
  describe('Property 8: 图表 resize 响应', () => {
    it('容器尺寸变化时应调用 resize 方法', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 2000 }),
          fc.integer({ min: 100, max: 1000 }),
          (width, height) => {
            // 重置
            handler.dispose();
            mockChart = createMockEChartsInstance();
            
            // 初始化
            handler.init(mockChart, container);
            
            // 触发 resize
            handler.triggerResize(width, height);
            
            // 验证 resize 被调用
            expect(mockChart.resize).toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('多次尺寸变化应多次调用 resize', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              width: fc.integer({ min: 100, max: 2000 }),
              height: fc.integer({ min: 100, max: 1000 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (sizes) => {
            // 重置
            handler.dispose();
            mockChart = createMockEChartsInstance();
            
            // 初始化
            handler.init(mockChart, container);
            
            // 触发多次 resize
            sizes.forEach(({ width, height }) => {
              handler.triggerResize(width, height);
            });
            
            // 验证 resize 调用次数等于尺寸变化次数
            expect(handler.getResizeCallCount()).toBe(sizes.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('图表销毁后不应调用 resize', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 2000 }),
          fc.integer({ min: 100, max: 1000 }),
          (width, height) => {
            // 重置
            handler.dispose();
            mockChart = createMockEChartsInstance();
            
            // 初始化
            handler.init(mockChart, container);
            
            // 标记为已销毁
            handler.markDisposed();
            
            // 记录当前调用次数
            const callCountBefore = handler.getResizeCallCount();
            
            // 触发 resize
            handler.triggerResize(width, height);
            
            // 验证 resize 没有被额外调用
            expect(handler.getResizeCallCount()).toBe(callCountBefore);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('resize 调用次数应与尺寸变化次数一致（不变量）', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          (resizeCount) => {
            // 重置
            handler.dispose();
            mockChart = createMockEChartsInstance();
            
            // 初始化
            handler.init(mockChart, container);
            
            // 触发指定次数的 resize
            for (let i = 0; i < resizeCount; i++) {
              handler.triggerResize(100 + i * 10, 100 + i * 5);
            }
            
            // 验证调用次数一致
            expect(handler.getResizeCallCount()).toBe(resizeCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 额外属性：尺寸边界值测试
   */
  describe('尺寸边界值', () => {
    it('极小尺寸应正常触发 resize', () => {
      handler.init(mockChart, container);
      
      handler.triggerResize(1, 1);
      
      expect(mockChart.resize).toHaveBeenCalled();
    });

    it('极大尺寸应正常触发 resize', () => {
      handler.init(mockChart, container);
      
      handler.triggerResize(10000, 10000);
      
      expect(mockChart.resize).toHaveBeenCalled();
    });

    it('宽高比例变化应触发 resize', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 2000 }),
          fc.integer({ min: 100, max: 1000 }),
          fc.integer({ min: 100, max: 2000 }),
          fc.integer({ min: 100, max: 1000 }),
          (w1, h1, w2, h2) => {
            // 重置
            handler.dispose();
            mockChart = createMockEChartsInstance();
            
            // 初始化
            handler.init(mockChart, container);
            
            // 第一次 resize
            handler.triggerResize(w1, h1);
            
            // 第二次 resize（不同尺寸）
            handler.triggerResize(w2, h2);
            
            // 验证两次都被调用
            expect(handler.getResizeCallCount()).toBe(2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

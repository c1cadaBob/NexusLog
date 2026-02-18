import '@testing-library/jest-dom'
import { beforeAll, afterEach } from 'vitest'

// 全局测试配置
beforeAll(() => {
  // 模拟 matchMedia（Ant Design 需要）
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })

  // 模拟 ResizeObserver
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

// 清理
afterEach(() => {
  // 清理 DOM
})

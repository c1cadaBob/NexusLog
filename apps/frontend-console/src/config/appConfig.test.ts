/**
 * Property 16: 配置热更新 round-trip
 * Validates: Requirements 22.3
 *
 * For any 有效的 AppConfig 对象，将其序列化写入后，
 * 通过 mergeConfig 读取应该得到等价的 AppConfig 对象。
 */
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { mergeConfig, getDefaultConfig } from './appConfig'
import type { AppConfig } from './appConfig'

/**
 * 生成有效的 AppConfig 任意值
 */
const appConfigArb: fc.Arbitrary<AppConfig> = fc.record({
  apiBaseUrl: fc.stringMatching(/^\/[a-z0-9/]*$/),
  wsBaseUrl: fc.stringMatching(/^\/[a-z0-9/]*$/),
  appName: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  version: fc.stringMatching(/^\d+\.\d+\.\d+$/),
  features: fc.record({
    enableWebSocket: fc.boolean(),
    enableOfflineMode: fc.boolean(),
    enableAnalytics: fc.boolean(),
  }),
  theme: fc.record({
    defaultMode: fc.constantFrom('light' as const, 'dark' as const, 'auto' as const),
    primaryColor: fc.hexaString({ minLength: 6, maxLength: 6 }).map((s) => `#${s}`),
  }),
  session: fc.record({
    idleTimeoutMinutes: fc.integer({ min: 1, max: 1440 }),
    refreshIntervalMinutes: fc.integer({ min: 1, max: 60 }),
  }),
})

describe('Property 16: 配置热更新 round-trip', () => {
  /**
   * **Validates: Requirements 22.3**
   *
   * Round-trip 属性：任意有效 AppConfig 序列化后通过 mergeConfig 还原，
   * 应得到等价对象。
   */
  it('任意有效 AppConfig 经 JSON 序列化后通过 mergeConfig 还原应等价', () => {
    fc.assert(
      fc.property(appConfigArb, (config) => {
        // 序列化为 JSON（模拟写入 app-config.json）
        const serialized = JSON.parse(JSON.stringify(config))
        // 通过 mergeConfig 还原（模拟从文件加载）
        const restored = mergeConfig(serialized)
        expect(restored).toEqual(config)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 22.3**
   *
   * 部分配置合并属性：缺失字段应使用默认值填充。
   */
  it('部分配置应与默认值正确合并', () => {
    fc.assert(
      fc.property(
        fc.record({
          apiBaseUrl: fc.option(fc.stringMatching(/^\/[a-z0-9/]*$/), { nil: undefined }),
          appName: fc.option(
            fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
            { nil: undefined }
          ),
        }),
        (partial) => {
          const defaults = getDefaultConfig()
          const cleaned: Record<string, unknown> = {}
          if (partial.apiBaseUrl !== undefined) cleaned.apiBaseUrl = partial.apiBaseUrl
          if (partial.appName !== undefined) cleaned.appName = partial.appName

          const result = mergeConfig(cleaned)

          // 提供的字段应使用提供的值
          if (partial.apiBaseUrl !== undefined) {
            expect(result.apiBaseUrl).toBe(partial.apiBaseUrl)
          } else {
            expect(result.apiBaseUrl).toBe(defaults.apiBaseUrl)
          }

          if (partial.appName !== undefined) {
            expect(result.appName).toBe(partial.appName)
          } else {
            expect(result.appName).toBe(defaults.appName)
          }

          // 未提供的嵌套字段应保留默认值
          expect(result.features).toEqual(defaults.features)
          expect(result.theme).toEqual(defaults.theme)
          expect(result.session).toEqual(defaults.session)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 22.3**
   *
   * 无效类型过滤属性：非法类型的字段应被忽略，使用默认值。
   */
  it('非法类型字段应被忽略并使用默认值', () => {
    const defaults = getDefaultConfig()

    // 数字类型的 apiBaseUrl 应被忽略
    const result1 = mergeConfig({ apiBaseUrl: 123 as unknown })
    expect(result1.apiBaseUrl).toBe(defaults.apiBaseUrl)

    // 字符串类型的 features.enableWebSocket 应被忽略
    const result2 = mergeConfig({ features: { enableWebSocket: 'yes' } })
    expect(result2.features.enableWebSocket).toBe(defaults.features.enableWebSocket)

    // 负数的 session 值应被忽略
    const result3 = mergeConfig({ session: { idleTimeoutMinutes: -5 } })
    expect(result3.session.idleTimeoutMinutes).toBe(defaults.session.idleTimeoutMinutes)
  })
})

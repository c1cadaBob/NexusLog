/**
 * Property 1: 环境目录结构一致性
 *
 * For any 环境目录（dev、staging、prod），其子目录结构应该完全一致——
 * 即 dev/ 下存在的每个子目录和文件，在 staging/ 和 prod/ 下也应该存在相同的路径。
 *
 * **Validates: Requirements 1.6**
 */
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ============================================================================
// 辅助函数
// ============================================================================

/** 项目根目录（从 apps/frontend-console 向上两级） */
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..')

/** configs 目录路径 */
const CONFIGS_DIR = path.join(PROJECT_ROOT, 'configs')

/** 三个环境名称 */
const ENV_NAMES = ['dev', 'staging', 'prod'] as const

/**
 * 递归获取目录下所有相对路径（文件和子目录）
 * 返回排序后的路径列表，便于比较
 */
function getRelativePaths(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) {
    return []
  }

  const results: string[] = []

  const walk = (currentDir: string, prefix: string) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
      results.push(relativePath)
      if (entry.isDirectory()) {
        walk(path.join(currentDir, entry.name), relativePath)
      }
    }
  }

  walk(dirPath, '')
  return results.sort()
}

// ============================================================================
// 测试数据
// ============================================================================

/** 所有环境目录对的生成器 */
const envPairArb = fc.constantFrom(
  ...([
    ['dev', 'staging'],
    ['dev', 'prod'],
    ['staging', 'prod'],
  ] as const)
)

/** 单个环境名称生成器 */
const envNameArb = fc.constantFrom(...ENV_NAMES)

// ============================================================================
// Property 1: 环境目录结构一致性
// ============================================================================

describe('Property 1: 环境目录结构一致性', () => {
  /**
   * **Validates: Requirements 1.6**
   *
   * 对于任意一对环境目录，它们的子目录和文件结构应该完全一致。
   */
  it('任意两个环境目录的相对路径集合应该完全相同', () => {
    fc.assert(
      fc.property(envPairArb, ([envA, envB]) => {
        const pathsA = getRelativePaths(path.join(CONFIGS_DIR, envA))
        const pathsB = getRelativePaths(path.join(CONFIGS_DIR, envB))

        expect(pathsA).toEqual(pathsB)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 1.6**
   *
   * 每个环境目录都应该存在。
   */
  it('所有环境目录（dev、staging、prod）都应该存在', () => {
    fc.assert(
      fc.property(envNameArb, (envName) => {
        const envDir = path.join(CONFIGS_DIR, envName)
        expect(fs.existsSync(envDir)).toBe(true)
        expect(fs.statSync(envDir).isDirectory()).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 1.6**
   *
   * 对称性：如果 envA 包含路径 P，则 envB 也包含路径 P，反之亦然。
   */
  it('环境目录结构具有对称性——A 中存在的路径在 B 中也存在', () => {
    fc.assert(
      fc.property(envPairArb, ([envA, envB]) => {
        const pathsA = new Set(getRelativePaths(path.join(CONFIGS_DIR, envA)))
        const pathsB = new Set(getRelativePaths(path.join(CONFIGS_DIR, envB)))

        // A 中的每个路径都应在 B 中
        for (const p of pathsA) {
          expect(pathsB.has(p)).toBe(true)
        }
        // B 中的每个路径都应在 A 中
        for (const p of pathsB) {
          expect(pathsA.has(p)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })
})

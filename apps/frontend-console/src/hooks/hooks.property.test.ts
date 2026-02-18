/**
 * Hooks 属性测试
 * 
 * Property 15: Hooks 无 Context API 依赖
 * 
 * **Validates: Requirements 11.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// 测试辅助函数
// ============================================================================

/**
 * 获取 hooks 目录下所有 .ts 文件（排除测试文件和 index.ts）
 */
function getHookFiles(): string[] {
  const hooksDir = path.resolve(__dirname);
  const files = fs.readdirSync(hooksDir);
  
  return files.filter(file => 
    file.endsWith('.ts') && 
    !file.endsWith('.test.ts') && 
    !file.endsWith('.property.test.ts') &&
    file !== 'index.ts'
  );
}

/**
 * 读取文件内容
 */
function readFileContent(filename: string): string {
  const filePath = path.resolve(__dirname, filename);
  return fs.readFileSync(filePath, 'utf-8');
}


/**
 * 检查文件是否包含 Context API 依赖
 */
function hasContextApiDependency(content: string): {
  hasUseContext: boolean;
  hasContextImport: boolean;
  contextUsages: string[];
} {
  // 检查 useContext 调用
  const useContextCallPattern = /useContext\s*\(/g;
  const useContextCalls = content.match(useContextCallPattern) || [];
  
  // 检查从 React 导入 useContext
  const useContextImportPattern = /import\s*{[^}]*useContext[^}]*}\s*from\s*['"]react['"]/g;
  const useContextImports = content.match(useContextImportPattern) || [];
  
  // 检查从 contexts 目录导入
  const contextImportPattern = /from\s*['"][^'"]*contexts[^'"]*['"]/g;
  const contextImports = content.match(contextImportPattern) || [];
  
  // 收集所有 Context 相关用法
  const contextUsages: string[] = [
    ...useContextCalls,
    ...useContextImports,
    ...contextImports,
  ];
  
  return {
    hasUseContext: useContextCalls.length > 0,
    hasContextImport: useContextImports.length > 0 || contextImports.length > 0,
    contextUsages,
  };
}

// ============================================================================
// Property 15: Hooks 无 Context API 依赖
// ============================================================================

describe('Property 15: Hooks 无 Context API 依赖', () => {
  /**
   * **Validates: Requirements 11.3**
   * 
   * For any 迁移后的 Hook 文件，文件内容不应该包含 useContext 调用
   * 或从 React 导入 useContext。所有状态获取应该通过 Zustand Store 的 hook 完成。
   */
  it('所有 Hook 文件不应包含 Context API 依赖', () => {
    const hookFiles = getHookFiles();
    
    // 使用 fast-check 对所有 hook 文件进行属性测试
    fc.assert(
      fc.property(
        fc.constantFrom(...hookFiles),
        (filename) => {
          const content = readFileContent(filename);
          const result = hasContextApiDependency(content);
          
          // 断言：不应该有 useContext 调用
          expect(result.hasUseContext).toBe(false);
          
          // 断言：不应该从 contexts 目录导入
          expect(result.hasContextImport).toBe(false);
          
          // 如果有任何 Context 用法，测试失败
          if (result.contextUsages.length > 0) {
            throw new Error(
              `文件 ${filename} 包含 Context API 依赖:\n${result.contextUsages.join('\n')}`
            );
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('每个 Hook 文件单独验证无 Context API 依赖', () => {
    const hookFiles = getHookFiles();
    
    hookFiles.forEach(filename => {
      const content = readFileContent(filename);
      const result = hasContextApiDependency(content);
      
      expect(
        result.contextUsages,
        `文件 ${filename} 不应包含 Context API 依赖`
      ).toHaveLength(0);
    });
  });
});

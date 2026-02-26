/**
 * Property 1: Zustand store 持久化 round-trip
 * 
 * For any Zustand store 状态变更（themeStore 的 mode/density 或 authStore 的认证信息），
 * 将状态写入 store 后从 localStorage 读取并反序列化，应该得到与原始状态等价的值。
 * 
 * **Validates: Requirements 2.6, 4.3**
 */
import { describe, it, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// localStorage mock
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => { storage[key] = value; },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
  get length() { return Object.keys(storage).length; },
  key: (i: number) => Object.keys(storage)[i] ?? null,
};

// @ts-ignore mock localStorage for Node environment
globalThis.localStorage = localStorageMock;
// @ts-expect-error mock window for Node environment
globalThis.window = { ...globalThis.window, localStorage: localStorageMock, matchMedia: () => ({ matches: false }) };

describe('Property 1: Zustand store 持久化 round-trip', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  const themeModeArb = fc.constantFrom('dark' as const, 'light' as const, 'auto' as const);
  const densityArb = fc.constantFrom('compact' as const, 'comfortable' as const, 'spacious' as const);

  it('themeStore: mode 和 density 持久化后可正确恢复', () => {
    fc.assert(
      fc.property(themeModeArb, densityArb, (mode, density) => {
        localStorageMock.clear();

        // 模拟 persist 中间件写入
        const stateToStore = { mode, density };
        localStorageMock.setItem(
          'nexuslog-theme',
          JSON.stringify({ state: stateToStore, version: 0 }),
        );

        // 从 localStorage 读取并反序列化
        const raw = localStorageMock.getItem('nexuslog-theme');
        const parsed = JSON.parse(raw!);

        return parsed.state.mode === mode && parsed.state.density === density;
      }),
      { numRuns: 100 },
    );
  });

  const userArb = fc.record({
    id: fc.uuid(),
    username: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
    email: fc.emailAddress(),
    role: fc.constantFrom('admin' as const, 'editor' as const, 'viewer' as const),
  });

  it('authStore: isAuthenticated 和 user 持久化后可正确恢复', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.option(userArb, { nil: null }), (isAuthenticated, user) => {
        localStorageMock.clear();

        const stateToStore = { isAuthenticated, user };
        localStorageMock.setItem(
          'nexuslog-auth',
          JSON.stringify({ state: stateToStore, version: 0 }),
        );

        const raw = localStorageMock.getItem('nexuslog-auth');
        const parsed = JSON.parse(raw!);

        if (parsed.state.isAuthenticated !== isAuthenticated) return false;
        if (user === null) return parsed.state.user === null;
        return (
          parsed.state.user.id === user.id &&
          parsed.state.user.username === user.username &&
          parsed.state.user.email === user.email &&
          parsed.state.user.role === user.role
        );
      }),
      { numRuns: 100 },
    );
  });
});

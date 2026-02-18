/**
 * useAuthStore 属性测试
 * 
 * Property 9: useAuthStore 状态管理
 * Validates: Requirements 7.1
 * 
 * @module stores/useAuthStore.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { useAuthStore } from './useAuthStore';
import type { User } from '@/types/user';

// ============================================================================
// 测试辅助函数
// ============================================================================

/**
 * 重置 store 到初始状态
 */
function resetStore() {
  useAuthStore.setState({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });
}

/**
 * 生成有效的用户名
 */
const validUsernameArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0);

/**
 * 生成有效的密码
 */
const validPasswordArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.length > 0);

/**
 * 生成登录凭证
 */
const loginCredentialsArb = fc.record({
  username: validUsernameArb,
  password: validPasswordArb,
  rememberMe: fc.boolean(),
});

/**
 * 生成用户更新数据
 */
const userUpdatesArb = fc.record({
  displayName: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  email: fc.option(fc.emailAddress(), { nil: undefined }),
});

// ============================================================================
// 属性测试
// ============================================================================

describe('useAuthStore 属性测试', () => {
  beforeEach(() => {
    resetStore();
    // 清除 localStorage
    localStorage.clear();
  });

  /**
   * Property 9: useAuthStore 状态管理
   * 
   * 对于任意有效的用户凭证，调用 login 后 isAuthenticated 应该为 true 且 user 不为 null；
   * 调用 logout 后 isAuthenticated 应该为 false 且 user 和 token 应该为 null。
   * login 后 logout 应该恢复到初始状态（round-trip 属性）。
   * 
   * **Validates: Requirements 7.1**
   */
  describe('Property 9: useAuthStore 状态管理', () => {
    it('login 后 isAuthenticated 应为 true 且 user 不为 null', async () => {
      await fc.assert(
        fc.asyncProperty(loginCredentialsArb, async (credentials) => {
          resetStore();
          
          const { login } = useAuthStore.getState();
          await login(credentials);
          
          const state = useAuthStore.getState();
          
          // 验证登录后状态
          expect(state.isAuthenticated).toBe(true);
          expect(state.user).not.toBeNull();
          expect(state.token).not.toBeNull();
          expect(state.isLoading).toBe(false);
          expect(state.error).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('logout 后 isAuthenticated 应为 false 且 user 和 token 应为 null', async () => {
      await fc.assert(
        fc.asyncProperty(loginCredentialsArb, async (credentials) => {
          resetStore();
          
          const store = useAuthStore.getState();
          
          // 先登录
          await store.login(credentials);
          
          // 验证登录成功
          expect(useAuthStore.getState().isAuthenticated).toBe(true);
          
          // 执行登出
          useAuthStore.getState().logout();
          
          const state = useAuthStore.getState();
          
          // 验证登出后状态
          expect(state.isAuthenticated).toBe(false);
          expect(state.user).toBeNull();
          expect(state.token).toBeNull();
          expect(state.isLoading).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('login 后 logout 应恢复到初始状态（round-trip 属性）', async () => {
      await fc.assert(
        fc.asyncProperty(loginCredentialsArb, async (credentials) => {
          // 记录初始状态
          resetStore();
          const initialState = {
            user: useAuthStore.getState().user,
            token: useAuthStore.getState().token,
            isAuthenticated: useAuthStore.getState().isAuthenticated,
            isLoading: useAuthStore.getState().isLoading,
            error: useAuthStore.getState().error,
          };
          
          // 执行 login
          await useAuthStore.getState().login(credentials);
          
          // 执行 logout
          useAuthStore.getState().logout();
          
          // 验证恢复到初始状态
          const finalState = useAuthStore.getState();
          expect(finalState.user).toEqual(initialState.user);
          expect(finalState.token).toEqual(initialState.token);
          expect(finalState.isAuthenticated).toEqual(initialState.isAuthenticated);
          expect(finalState.isLoading).toEqual(initialState.isLoading);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 额外属性：updateUser 应正确更新用户信息
   */
  describe('updateUser 属性', () => {
    it('updateUser 应正确合并用户信息', async () => {
      await fc.assert(
        fc.asyncProperty(
          loginCredentialsArb,
          userUpdatesArb,
          async (credentials, updates) => {
            resetStore();
            
            // 先登录
            await useAuthStore.getState().login(credentials);
            
            const userBeforeUpdate = useAuthStore.getState().user;
            expect(userBeforeUpdate).not.toBeNull();
            
            // 执行更新
            useAuthStore.getState().updateUser(updates);
            
            const userAfterUpdate = useAuthStore.getState().user;
            expect(userAfterUpdate).not.toBeNull();
            
            // 验证更新的字段
            if (updates.displayName !== undefined) {
              expect(userAfterUpdate!.displayName).toBe(updates.displayName);
            }
            if (updates.email !== undefined) {
              expect(userAfterUpdate!.email).toBe(updates.email);
            }
            
            // 验证未更新的字段保持不变
            expect(userAfterUpdate!.id).toBe(userBeforeUpdate!.id);
            expect(userAfterUpdate!.username).toBe(userBeforeUpdate!.username);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('未登录时 updateUser 不应产生副作用', () => {
      fc.assert(
        fc.property(userUpdatesArb, (updates) => {
          resetStore();
          
          // 未登录状态
          expect(useAuthStore.getState().user).toBeNull();
          
          // 尝试更新
          useAuthStore.getState().updateUser(updates);
          
          // 状态应保持不变
          expect(useAuthStore.getState().user).toBeNull();
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 额外属性：clearError 应正确清除错误
   */
  describe('clearError 属性', () => {
    it('clearError 应将 error 设为 null', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (errorMessage) => {
          resetStore();
          
          // 设置错误
          useAuthStore.getState().setError(errorMessage);
          expect(useAuthStore.getState().error).toBe(errorMessage);
          
          // 清除错误
          useAuthStore.getState().clearError();
          expect(useAuthStore.getState().error).toBeNull();
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 额外属性：setLoading 应正确设置加载状态
   */
  describe('setLoading 属性', () => {
    it('setLoading 应正确切换加载状态', () => {
      fc.assert(
        fc.property(fc.boolean(), (isLoading) => {
          resetStore();
          
          useAuthStore.getState().setLoading(isLoading);
          expect(useAuthStore.getState().isLoading).toBe(isLoading);
        }),
        { numRuns: 100 }
      );
    });
  });
});

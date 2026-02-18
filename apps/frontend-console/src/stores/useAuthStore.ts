/**
 * 认证状态管理 Store
 * 
 * 使用 Zustand 替代 AuthContext，管理用户认证状态
 * 
 * @module stores/useAuthStore
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, LoginCredentials, AuthState } from '@/types/user';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 认证操作接口
 */
export interface AuthActions {
  /** 用户登录 */
  login: (credentials: LoginCredentials) => Promise<void>;
  /** 用户登出 */
  logout: () => void;
  /** 刷新 Token */
  refreshToken: () => Promise<void>;
  /** 更新用户信息 */
  updateUser: (updates: Partial<User>) => void;
  /** 清除错误信息 */
  clearError: () => void;
  /** 设置加载状态 */
  setLoading: (isLoading: boolean) => void;
  /** 设置错误信息 */
  setError: (error: string | null) => void;
}

/**
 * 完整的认证 Store 类型
 */
export type AuthStore = AuthState & AuthActions;

// ============================================================================
// 初始状态
// ============================================================================

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// ============================================================================
// Token 存储键名
// ============================================================================

const TOKEN_STORAGE_KEY = 'nexuslog-auth-token';
const REFRESH_TOKEN_KEY = 'nexuslog-refresh-token';

// ============================================================================
// Store 实现
// ============================================================================

/**
 * 认证状态管理 Store
 * 
 * 使用 Zustand 的 persist 中间件持久化 token 到 localStorage
 * 
 * @example
 * ```tsx
 * // 在组件中使用
 * const { user, isAuthenticated, login, logout } = useAuthStore();
 * 
 * // 选择性订阅（避免不必要的重渲染）
 * const isAuthenticated = useAuthStore(state => state.isAuthenticated);
 * ```
 */
export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      ...initialState,

      /**
       * 用户登录
       * 
       * @param credentials - 登录凭证（用户名、密码、记住我）
       */
      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });

        try {
          // TODO: 实际项目中应调用 API 服务
          // const response = await authApi.login(credentials);
          
          // 模拟 API 调用延迟（测试环境下跳过）
          if (process.env.NODE_ENV !== 'test') {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          // 模拟登录响应（实际项目中从 API 获取）
          const mockUser: User = {
            id: 'user-001',
            username: credentials.username,
            email: `${credentials.username}@example.com`,
            displayName: credentials.username,
            role: 'admin',
            roles: [],
            permissions: ['read', 'write', 'admin'],
            preferences: {
              theme: 'dark',
              density: 'comfortable',
              language: 'zh-CN',
              timezone: 'Asia/Shanghai',
              defaultTimeRange: 'last-1h',
              pageSize: 20,
              notificationsEnabled: true,
              soundEnabled: false,
              autoRefreshInterval: 30,
              dateFormat: 'YYYY-MM-DD',
              timeFormat: 'HH:mm:ss',
            },
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          const mockToken = `mock-jwt-token-${Date.now()}`;
          const mockRefreshToken = `mock-refresh-token-${Date.now()}`;

          // 存储 refresh token（如果选择记住我）
          if (credentials.rememberMe) {
            localStorage.setItem(REFRESH_TOKEN_KEY, mockRefreshToken);
          }

          set({
            user: mockUser,
            token: mockToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const errorMessage = error instanceof Error 
            ? error.message 
            : '登录失败，请检查用户名和密码';
          
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          });
          
          throw error;
        }
      },

      /**
       * 用户登出
       * 
       * 清除所有认证状态和存储的 token
       */
      logout: () => {
        // 清除 refresh token
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        
        // 重置状态
        set({
          ...initialState,
        });
      },

      /**
       * 刷新 Token
       * 
       * 使用 refresh token 获取新的 access token
       */
      refreshToken: async () => {
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        
        if (!refreshToken) {
          // 没有 refresh token，执行登出
          get().logout();
          throw new Error('No refresh token available');
        }

        set({ isLoading: true });

        try {
          // TODO: 实际项目中应调用 API 服务
          // const response = await authApi.refreshToken(refreshToken);
          
          // 模拟 API 调用延迟（测试环境下跳过）
          if (process.env.NODE_ENV !== 'test') {
            await new Promise(resolve => setTimeout(resolve, 300));
          }

          const newToken = `mock-jwt-token-refreshed-${Date.now()}`;
          const newRefreshToken = `mock-refresh-token-${Date.now()}`;

          // 更新 refresh token
          localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);

          set({
            token: newToken,
            isLoading: false,
          });
        } catch (error) {
          // 刷新失败，执行登出
          get().logout();
          throw error;
        }
      },

      /**
       * 更新用户信息
       * 
       * @param updates - 要更新的用户字段
       */
      updateUser: (updates: Partial<User>) => {
        const currentUser = get().user;
        
        if (!currentUser) {
          return;
        }

        set({
          user: {
            ...currentUser,
            ...updates,
            updatedAt: Date.now(),
          },
        });
      },

      /**
       * 清除错误信息
       */
      clearError: () => {
        set({ error: null });
      },

      /**
       * 设置加载状态
       * 
       * @param isLoading - 是否正在加载
       */
      setLoading: (isLoading: boolean) => {
        set({ isLoading });
      },

      /**
       * 设置错误信息
       * 
       * @param error - 错误信息
       */
      setError: (error: string | null) => {
        set({ error });
      },
    }),
    {
      name: TOKEN_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // 只持久化 token 和用户信息，不持久化加载状态和错误
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// ============================================================================
// 选择器 Hooks（用于性能优化）
// ============================================================================

/**
 * 获取当前用户
 */
export const useCurrentUser = () => useAuthStore(state => state.user);

/**
 * 获取认证状态
 */
export const useIsAuthenticated = () => useAuthStore(state => state.isAuthenticated);

/**
 * 获取加载状态
 */
export const useAuthLoading = () => useAuthStore(state => state.isLoading);

/**
 * 获取错误信息
 */
export const useAuthError = () => useAuthStore(state => state.error);

/**
 * 获取认证操作
 */
export const useAuthActions = () => useAuthStore(state => ({
  login: state.login,
  logout: state.logout,
  refreshToken: state.refreshToken,
  updateUser: state.updateUser,
  clearError: state.clearError,
}));

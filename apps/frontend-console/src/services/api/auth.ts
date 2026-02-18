/**
 * 认证 API 模块
 * 
 * 提供用户认证相关的 API 接口：
 * - login: 用户登录
 * - logout: 用户登出
 * - verify: 验证令牌
 * - refresh: 刷新令牌
 */

import { apiClient } from './client';
import type { 
  User, 
  LoginCredentials, 
  LoginResponse, 
  RefreshTokenResponse 
} from '../../types/user';
import type { ApiResponse } from '../../types/api';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 注册请求
 */
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}

/**
 * 修改密码请求
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * 重置密码请求
 */
export interface ResetPasswordRequest {
  email: string;
}

/**
 * 确认重置密码请求
 */
export interface ConfirmResetPasswordRequest {
  token: string;
  newPassword: string;
}

// ============================================================================
// API 接口
// ============================================================================

/**
 * 认证 API
 */
export const authApi = {
  /**
   * 用户登录
   * @param credentials - 登录凭证
   * @returns 登录响应，包含令牌和用户信息
   */
  login: (credentials: LoginCredentials): Promise<LoginResponse> => {
    return apiClient.post<LoginResponse>('/auth/login', credentials);
  },

  /**
   * 用户登出
   * @returns 空响应
   */
  logout: (): Promise<void> => {
    return apiClient.post<void>('/auth/logout');
  },

  /**
   * 验证令牌
   * @param token - 可选的令牌，如果不提供则使用当前令牌
   * @returns 用户信息
   */
  verify: (token?: string): Promise<User> => {
    const config = token 
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined;
    return apiClient.get<User>('/auth/verify', config);
  },

  /**
   * 刷新令牌
   * @returns 新的令牌信息
   */
  refresh: (): Promise<RefreshTokenResponse> => {
    return apiClient.post<RefreshTokenResponse>('/auth/refresh');
  },

  /**
   * 用户注册
   * @param data - 注册信息
   * @returns 登录响应
   */
  register: (data: RegisterRequest): Promise<LoginResponse> => {
    return apiClient.post<LoginResponse>('/auth/register', data);
  },

  /**
   * 获取当前用户信息
   * @returns 用户信息
   */
  getCurrentUser: (): Promise<User> => {
    return apiClient.get<User>('/auth/me');
  },

  /**
   * 更新当前用户信息
   * @param data - 更新数据
   * @returns 更新后的用户信息
   */
  updateCurrentUser: (data: Partial<User>): Promise<User> => {
    return apiClient.patch<User>('/auth/me', data);
  },

  /**
   * 修改密码
   * @param data - 密码修改请求
   * @returns 空响应
   */
  changePassword: (data: ChangePasswordRequest): Promise<void> => {
    return apiClient.post<void>('/auth/change-password', data);
  },

  /**
   * 请求重置密码
   * @param data - 重置密码请求
   * @returns API 响应
   */
  requestPasswordReset: (data: ResetPasswordRequest): Promise<ApiResponse> => {
    return apiClient.post<ApiResponse>('/auth/reset-password', data);
  },

  /**
   * 确认重置密码
   * @param data - 确认重置密码请求
   * @returns 空响应
   */
  confirmPasswordReset: (data: ConfirmResetPasswordRequest): Promise<void> => {
    return apiClient.post<void>('/auth/reset-password/confirm', data);
  },

  /**
   * 验证邮箱
   * @param token - 验证令牌
   * @returns 空响应
   */
  verifyEmail: (token: string): Promise<void> => {
    return apiClient.post<void>('/auth/verify-email', { token });
  },

  /**
   * 重新发送验证邮件
   * @returns 空响应
   */
  resendVerificationEmail: (): Promise<void> => {
    return apiClient.post<void>('/auth/resend-verification');
  },
};

export default authApi;
